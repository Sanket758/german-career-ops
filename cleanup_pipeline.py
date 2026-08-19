#!/usr/bin/env python3
import re

# Read the pipeline
with open('data/pipeline.md', 'r') as f:
    content = f.read()

# Clean up lines with error messages - keep only the URL part
lines = content.split('\n')
cleaned = []
for line in lines:
    # Match lines with error format: "- [ ] URL — Error: ..."
    match = re.match(r'^(\s*-\s*\[\s*\]\s*)(https?://\S+)\s*—\s*Error:.*$', line.strip())
    if match:
        # Restore clean format: "- [ ] URL"
        cleaned.append(f"{match.group(1)}{match.group(2)}")
    else:
        cleaned.append(line)

with open('data/pipeline.md', 'w') as f:
    f.write('\n'.join(cleaned))

print("Pipeline cleaned up - removed error messages from all entries")