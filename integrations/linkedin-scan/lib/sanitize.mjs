// Personal-data guards for captured fixtures.
//
// A capture comes from a logged-in session, so the raw DOM contains the account
// holder's name, e-mail and profile links — and possibly the name of a third
// party (LinkedIn renders "people who can help" cards). None of that may end up
// in a committed file.
//
// The guard is a pure function so it can be tested without a browser, and the
// capture tool fails closed: if anything personal is still in the HTML, no file
// is written at all.

/** Any LinkedIn profile link. */
const PROFILE_HREF = /href="([^"]*linkedin\.com\/in\/[^"]*)"/gi;

/**
 * Find personal data in an HTML string.
 *
 * @param {string} html
 * @param {{names?: string[], emails?: string[]}} known what the account holder is called
 * @returns {{names: string[], emails: string[], profileHrefs: string[]}}
 */
export function findPersonalData(html, known = {}) {
  const text = String(html ?? '');
  const names = known.names ?? [];
  const emails = known.emails ?? [];

  return {
    names: names.filter((name) => name && name.length > 2 && text.includes(name)),
    emails: emails.filter((email) => email && text.includes(email)),
    profileHrefs: [...text.matchAll(PROFILE_HREF)].map((m) => m[1]),
  };
}

/** True when nothing personal is left in the document. */
export function isClean(found) {
  return found.names.length === 0 && found.emails.length === 0 && found.profileHrefs.length === 0;
}

/**
 * Remove profile links (the account holder and any third party LinkedIn shows)
 * from an HTML string, keeping everything else.
 *
 * @param {string} html
 * @returns {string}
 */
export function stripProfileLinks(html) {
  return String(html ?? '').replace(
    /<a\b[^>]*href="[^"]*linkedin\.com\/in\/[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
    ''
  );
}
