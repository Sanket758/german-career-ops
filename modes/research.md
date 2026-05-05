# Mode: research — Company Intelligence Brief

## Purpose

Generate a comprehensive intelligence brief for a target company to support
quality applications and targeted networking. This is the **right** kind of automation:
researching companies deeply, not mass-applying blindly.

## Input

- Company name or URL
- `config/profile.yml` (for matching thesis/skills to company)
- `modes/_profile.md` (for thesis leverage strategy)

## Workflow

### Step 1: Company Profile Extraction

Scrape the company's public web presence:

1. **Website Analysis**
   - Navigate to company homepage with Playwright
   - Extract: industry, mission statement, products/services
   - Check: English vs German language on site
   - Look for: tech blog, engineering blog, open-source contributions

2. **Company Facts**
   - Size (employees, if discoverable)
   - Funding stage (startup, Series A/B/C, Mittelstand, enterprise)
   - Headquarters location
   - Berlin office presence
   - Tech stack mentioned on site or in JDs

### Step 2: LinkedIn Employee Discovery

Search for relevant employees using web search:

```
Search queries:
- "[Company Name] Computer Vision site:linkedin.com"
- "[Company Name] Machine Learning site:linkedin.com"
- "[Company Name] Robotics site:linkedin.com"
- "[Company Name] AI Engineer site:linkedin.com"
- "[Company Name] CTO site:linkedin.com"
- "[Company Name] Head of Engineering site:linkedin.com"
```

Extract 5-10 employees with:
- Full name
- Job title
- LinkedIn URL
- Relevant specialization (if visible)

### Step 3: Thesis Relevance Check

Check if the company appears in `modes/_profile.md` thesis targets:
- If yes → flag as "thesis-leverage opportunity"
- If the company works in retail, logistics, computer vision, or shelf monitoring → auto-flag

### Step 4: Generate Outreach Templates

For each key employee (max 3-5), draft a **personalized** LinkedIn message:

```
Hi [Name],

I'm currently completing my MSc in AI at BSBI Berlin, with my thesis
focused on deep learning-based SKU recognition for German retail shelf
monitoring. I noticed you work on [specific area from their profile]
at [Company].

I'd love to learn more about how [Company] approaches [relevant topic].
Would you be open to a brief call? I'm also looking for Werkstudent
opportunities where I could apply my computer vision background.

Thanks,
[User Name from config/profile.yml]
```

**Customization rules:**
- Replace `[specific area]` with something from their actual profile, not generic
- If the company is in retail/logistics, emphasize the thesis angle
- If the company is in robotics, emphasize ROS2 experience
- If the company is a small startup, keep it more casual
- NEVER send the exact same message to multiple people at the same company

### Step 5: Save Intelligence Brief

Save to `reports/intel-[company-slug]-[YYYY-MM-DD].md`:

```markdown
# Company Intelligence Brief: [Company Name]

**Generated:** [YYYY-MM-DD]
**URL:** [company website]

## Company Overview
- **Industry:** [industry]
- **Size:** [employees]
- **Stage:** [startup/growth/enterprise]
- **HQ:** [location]
- **Berlin Office:** [yes/no]
- **Website Language:** [English/German/Both]

## Tech Stack
- [List technologies mentioned on site/JDs]

## Thesis Relevance
- [High/Medium/Low/None]
- [Why]

## Key Employees

| Name | Title | LinkedIn | Specialization |
| ---- | ----- | -------- | -------------- |
| [Name] | [Title] | [URL] | [Area] |

## Outreach Templates

### For [Name 1]
> [Personalized message]

### For [Name 2]
> [Personalized message]

## Open Roles (if any)
- [Role 1] — [URL]
- [Role 2] — [URL]

## Recommendation
- [Should you apply? Network first? Wait?]
```

## Usage

```
/career-ops research Metro AG
/career-ops research Fraunhofer IML
/career-ops research Data Spree
```
