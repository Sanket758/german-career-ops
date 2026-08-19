#!/usr/bin/env python3
"""
weekly-workflow.py — German Market Weekly Application Workflow

Usage:
  python weekly-workflow.py plan          # Plan this week's 5 applications
  python weekly-workflow.py research      # Research companies for planned roles
  python weekly-workflow.py package       # Generate packages for planned roles
  python weekly-workflow.py submit        # Submit applications (manual step guide)
  python weekly-workflow.py followup      # Check follow-ups due
  python weekly-workflow.py status        # Show weekly status
"""

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
WEEKLY_PLAN_FILE = DATA_DIR / "weekly-plan.json"

def load_plan() -> Dict:
    if WEEKLY_PLAN_FILE.exists():
        return json.loads(WEEKLY_PLAN_FILE.read_text())
    return {"week": "", "applications": [], "followups": []}

def save_plan(plan: Dict):
    DATA_DIR.mkdir(exist_ok=True)
    WEEKLY_PLAN_FILE.write_text(json.dumps(plan, indent=2))

def get_week_id() -> str:
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())
    return monday.strftime("%Y-W%U")

def cmd_plan():
    """Select 5 target roles for this week from high-score evaluated"""
    import subprocess
    result = subprocess.run([
        sys.executable, "analyze_apps.py"
    ], capture_output=True, text=True, cwd=PROJECT_ROOT)
    
    # Parse high-score evaluated from analyze_apps output
    # For now, just create empty plan template
    plan = {
        "week": get_week_id(),
        "created": datetime.now().isoformat(),
        "applications": [
            {"company": "", "role": "", "url": "", "status": "planned", "priority": 1},
            {"company": "", "role": "", "url": "", "status": "planned", "priority": 2},
            {"company": "", "role": "", "url": "", "status": "planned", "priority": 3},
            {"company": "", "role": "", "url": "", "status": "planned", "priority": 4},
            {"company": "", "role": "", "url": "", "status": "planned", "priority": 5},
        ],
        "followups": []
    }
    save_plan(plan)
    print(f"📅 Weekly plan created for {plan['week']}")
    print("Edit data/weekly-plan.json to add your 5 target roles")
    print("\nTemplate:")
    for i, app in enumerate(plan["applications"], 1):
        print(f"  {i}. {app['company']} - {app['role']} ({app['url']})")

def cmd_research():
    """Research companies for planned roles"""
    plan = load_plan()
    if not plan.get("applications"):
        print("No plan found. Run 'python weekly-workflow.py plan' first.")
        return
    
    print(f"🔍 Researching {len(plan['applications'])} companies...\n")
    
    for app in plan["applications"]:
        if not app.get("company"):
            continue
        print(f"  📊 {app['company']} - {app['role']}")
        print(f"     URL: {app['url']}")
        print(f"     Tasks:")
        print(f"       [ ] Find hiring manager (XING/LinkedIn)")
        print(f"       [ ] Check Kununu/Glassdoor reviews")
        print(f"       [ ] Recent news (funding, layoffs, product launches)")
        print(f"       [ ] Tech stack from engineering blog")
        print(f"       [ ] German language requirement check")
        print(f"       [ ] Visa sponsorship policy")
        print()

def cmd_package():
    """Generate application packages for planned roles"""
    plan = load_plan()
    if not plan.get("applications"):
        print("No plan found. Run 'python weekly-workflow.py plan' first.")
        return
    
    import subprocess
    
    for app in plan["applications"]:
        if not app.get("company") or not app.get("url"):
            continue
        
        if app["status"] != "planned":
            continue
        
        print(f"📦 Generating package for {app['company']} - {app['role']}...")
        
        company_slug = app["company"].lower().replace(" ", "-").replace(".", "")
        output = f"output/pkg-{company_slug}-{datetime.now().strftime('%Y-%m-%d')}.pdf"
        
        result = subprocess.run([
            "node", "scripts/generate-application-package.mjs",
            "--url", app["url"],
            "--company", app["company"],
            "--role", app["role"],
            "--lang", "de",
            "--output", output
        ], cwd=PROJECT_ROOT, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"  ✅ {output}")
            app["status"] = "packaged"
            app["package_path"] = output
        else:
            print(f"  ❌ Failed: {result.stderr[:200]}")
    
    save_plan(plan)
    print("\n✅ Packages generated for all planned roles")

def cmd_submit():
    """Guide for manual submission"""
    plan = load_plan()
    if not plan.get("applications"):
        print("No plan found.")
        return
    
    print("📤 Submission Guide for This Week:\n")
    
    for app in plan["applications"]:
        if not app.get("company") or app["status"] != "packaged":
            continue
        
        print(f"  {app['company']} - {app['role']}")
        print(f"    Package: {app.get('package_path', 'output/pkg-...')}")
        print(f"    URL: {app['url']}")
        print(f"    Steps:")
        print(f"      1. Go to company portal: {app['url']}")
        print(f"      2. Upload: Lebenslauf + Anschreiben (single PDF or separate)")
        print(f"      3. Find hiring manager on XING/LinkedIn -> email directly")
        print(f"      4. Update status to 'Applied' in tracker")
        print(f"      5. Set follow-up reminders: 7d, 14d, 21d")
        print()

def cmd_followup():
    """Check follow-ups due this week"""
    plan = load_plan()
    today = datetime.now().date()
    
    print("📋 Follow-ups Due This Week:\n")
    
    # Load applications.md for applied apps
    apps_path = PROJECT_ROOT / "data" / "applications.md"
    if apps_path.exists():
        content = apps_path.read_text()
        # Parse applied applications with dates
        # This is simplified - would need full parser
        print("  Check applications.md for 'Applied' entries")
        print("  For each: calculate 7/14/21 days from application date")
        print()
    
    # Also check weekly plan followups
    for fu in plan.get("followups", []):
        due = datetime.fromisoformat(fu["due"]).date()
        if due <= today + timedelta(days=7):
            print(f"  ⏰ {fu['company']} - {fu['type']} (due: {due})")

def cmd_status():
    """Show weekly status"""
    plan = load_plan()
    
    print(f"📅 Week: {plan.get('week', 'Not planned')}")
    print(f"  Created: {plan.get('created', 'N/A')}")
    print()
    
    apps = plan.get("applications", [])
    if not apps:
        print("  No applications planned yet. Run 'plan' command.")
        return
    
    statuses = {}
    for app in apps:
        s = app.get("status", "planned")
        statuses[s] = statuses.get(s, 0) + 1
    
    print("  Status:")
    for s, c in statuses.items():
        print(f"    {s}: {c}")
    
    print("\n  Applications:")
    for app in apps:
        if app.get("company"):
            print(f"    {app.get('priority', '?')}. {app['company']} - {app['role']} [{app.get('status', 'planned')}]")

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    
    cmd = sys.argv[1]
    
    commands = {
        "plan": cmd_plan,
        "research": cmd_research,
        "package": cmd_package,
        "submit": cmd_submit,
        "followup": cmd_followup,
        "status": cmd_status,
    }
    
    if cmd in commands:
        commands[cmd]()
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)

if __name__ == "__main__":
    main()