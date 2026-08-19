import re
from collections import Counter

with open('data/applications.md', 'r') as f:
    content = f.read()

rows = []
for line in content.split('\n'):
    # Match pipe-separated rows: | 51 | 2026-08-19 | GetYourGuide | ...
    if line.startswith('| ') and not line.startswith('| #') and not line.startswith('|---'):
        parts = [p.strip() for p in line.split('|')]
        if len(parts) >= 9:
            rows.append({
                'num': parts[1],
                'date': parts[2],
                'company': parts[3],
                'role': parts[4],
                'score': parts[5],
                'status': parts[6],
                'pdf': parts[7],
                'report': parts[8],
                'notes': parts[9] if len(parts) > 9 else ''
            })

print(f'Total: {len(rows)}')
print('Status:', Counter(r['status'] for r in rows))

applied = [r for r in rows if r['status'] == 'Applied']
print(f'Applied: {len(applied)}')
for a in applied:
    print(f'  {a["num"]} {a["company"]} - {a["role"]} ({a["score"]})')

pdfs = [r for r in rows if r['pdf'] and 'output/' in r['pdf']]
print(f'PDFs: {len(pdfs)}')
for p in pdfs:
    print(f'  {p["num"]} {p["company"]}')

high = [r for r in rows if r['status'] == 'Evaluated' and r['score'].startswith('4.')]
print(f'High score not applied: {len(high)}')
for h in high:
    print(f'  {h["num"]} {h["company"]} - {h["role"]} ({h["score"]})')

linkedin = [r for r in rows if 'Auto via LinkedIn' in r['notes']]
print(f'LinkedIn auto: {len(linkedin)}')
for l in linkedin:
    print(f'  {l["num"]} {l["company"]} - {l["role"]}')

comp = Counter(r['company'] for r in rows)
print('Companies with multiple applications:')
for c, cnt in comp.most_common():
    if cnt > 1:
        print(f'  {c}: {cnt}')