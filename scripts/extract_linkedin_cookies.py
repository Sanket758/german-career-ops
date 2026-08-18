#!/usr/bin/env python3
"""
Extract decrypted LinkedIn cookies from the user's Chrome profile and dump
them as a Playwright-compatible cookie JSON for automation.

Linux Chrome schemes (verified empirically 2026-08-14):
  - v10: key = PBKDF2-HMAC-SHA1("peanuts", "saltysalt", 1, 16)
         blob = "v10" || AES-128-CBC ciphertext, IV = 16 spaces
  - v11: key = PBKDF2-HMAC-SHA1(keyring_secret, "saltysalt", 1, 16)
         blob = "v11" || 16-byte prefix || 16-byte IV || AES-128-CBC ciphertext
         (prefix and IV are constant per profile; IV = blob[19:35])
  The keyring secret lives in gnome-keyring under "Chrome Safe Storage".

Restores the capability that scripts/.cookies.json used to provide
(see docs/brain/findings/chrome-devtools-apply-gotchas.md).
"""
import json
import os
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

try:
    import secretstorage
except ImportError:
    secretstorage = None

CHROME_COOKIES_CANDIDATES = [
    Path.home() / ".config/google-chrome/Default/Cookies",
    Path.home() / ".config/google-chrome/Default/Network/Cookies",
]
OUTPUT = Path(__file__).resolve().parent.parent / "data/linkedin_cookies.json"
LINKEDIN_HOSTS = ("linkedin.com", "licdn.com")


def derive_key(password: bytes) -> bytes:
    return PBKDF2HMAC(
        algorithm=hashes.SHA1(), length=16, salt=b"saltysalt", iterations=1
    ).derive(password)


def get_keyring_secret() -> bytes | None:
    """Return the 'Chrome Safe Storage' keyring secret, or None if unavailable."""
    if secretstorage is None:
        return None
    bus = secretstorage.dbus_init()
    col = secretstorage.get_default_collection(bus)
    try:
        col.unlock()
    except Exception:
        pass
    for item in col.get_all_items():
        if item.get_label() == "Chrome Safe Storage":
            return bytes(item.get_secret())
    return None


def decrypt_value(enc: bytes, key: bytes) -> str | None:
    if enc[:3] == b"v10":
        ct = enc[3:]
        iv = b" " * 16
    elif enc[:3] == b"v11":
        iv = enc[19:35]  # constant per-profile IV
        ct = enc[35:]
    else:
        return None  # plaintext or unknown scheme
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    dec = cipher.decryptor().update(ct)
    pad = dec[-1]
    if pad < 1 or pad > 16 or not all(b == pad for b in dec[-pad:]):
        return None
    return dec[:-pad].decode(errors="replace")


def chrome_ts_to_epoch(us: int) -> float:
    return (us / 1_000_000) - 11644473600


def main() -> None:
    db_path = next((p for p in CHROME_COOKIES_CANDIDATES if p.exists()), None)
    if not db_path:
        raise SystemExit("No Chrome cookies DB found")

    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        shutil.copyfile(db_path, tmp.name)
        tmp_db = tmp.name
    try:
        con = sqlite3.connect(tmp_db)
        con.row_factory = sqlite3.Row
        rows = con.execute(
            "SELECT host_key, name, value, encrypted_value, path, "
            "expires_utc, is_secure, is_httponly, samesite "
            "FROM cookies WHERE host_key LIKE '%linkedin%'"
        ).fetchall()
        con.close()
    finally:
        os.unlink(tmp_db)

    keyring_secret = get_keyring_secret()
    v11_key = derive_key(keyring_secret) if keyring_secret else None
    v10_key = derive_key(b"peanuts")

    cookies = []
    for r in rows:
        host = r["host_key"]
        if not any(h in host for h in LINKEDIN_HOSTS):
            continue
        val = r["value"]
        enc = bytes(r["encrypted_value"])
        if not val:
            key = v11_key if enc[:3] == b"v11" else v10_key
            val = decrypt_value(enc, key) if key else None
        if not val:
            print(f"SKIP (undecryptable): {host} {r['name']}")
            continue
        cookie = {
            "name": r["name"],
            "value": val,
            "domain": host,
            "path": r["path"],
            "secure": bool(r["is_secure"]),
            "httpOnly": bool(r["is_httponly"]),
        }
        same_site = {0: "Lax", 1: "Lax", 2: "Strict"}.get(r["samesite"])
        if same_site:
            cookie["sameSite"] = same_site
        exp = r["expires_utc"]
        if exp and exp > 0:
            cookie["expires"] = chrome_ts_to_epoch(exp)
        cookies.append(cookie)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(cookies, indent=2))
    names = [c["name"] for c in cookies]
    critical = [n for n in ("li_at", "JSESSIONID", "bscookie") if n in names]
    print(f"Wrote {len(cookies)} cookies -> {OUTPUT}")
    print("Critical auth cookies present:", critical)
    if "li_at" not in critical:
        sys.exit("WARNING: li_at missing — LinkedIn session will not work")


if __name__ == "__main__":
    main()
