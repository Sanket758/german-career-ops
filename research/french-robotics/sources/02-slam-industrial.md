# Batch 02 — Industrial Robotics + SLAM/industrial-vision (France-focused companies)

Research date: 2026-10-21. Candidate: Sanket Gadge — CV/ML Engineer, Berlin (German work permit, no French).
All claims below were fetched/verified during this session; URLs and HTTP statuses were measured with
`curl -s -o /dev/null -w "%{http_code} %{url_effective}\n" -L --max-time 25`.

---

### Exwayz
- **Category:** Industrial Robotics
- **HQ:** Paris, France (3 Rue de Stockholm, 75008 Paris; also 39 Rue de la Gare de Reuilly, 75012 Paris)
- **Does:** Real-time 3D LiDAR SLAM / localization SDK plus a perception layer (detection, segmentation, mapping, change detection) for autonomous robots in GPS-denied environments.
- **German presence:** NO — Legal notice lists only the French entity: *"This website is published and maintained by Exwayz SAS, a French simplified joint-stock company registered in Paris. 39 Rue de la Gare de Reuilly, 75012 Paris, France — 900 329 608 R.C.S. Paris"*, both addresses in Paris; the careers page lists 4 positions, all Paris; LinkedIn company page is `fr.linkedin.com/company/exwayz` (Paris). No German entity, address or posting found. (northdata.de could not be used as a negative check: its search results are JS-rendered and the raw HTML returns only the search landing page.) Source: https://exwayz.fr/legal/ and https://exwayz.fr/jobs/
- **Careers URL:** https://exwayz.fr/jobs/
- **HTTP status:** 200 (ATS: custom / company-hosted page — no external ATS tenant)
- **Open relevant roles:**

  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | R&D Scientist · 3D Computer Vision | Paris · Saint-Lazare (CDI, permanent) | https://exwayz.fr/jobs/ | C | Best technical match in the whole batch — *"Design, train and evaluate deep learning models across the perception stack, on our internal and public LiDAR datasets"*, stack *"Python, PyTorch, C++, ROS, CUDA, Git, Linux"*, *"3+ years of industry experience in 3D perception, computer vision"*. Blocked: Paris on-site + *"Working French and English"*; also asks for *"enough C++ to work in a real-time codebase"* and LiDAR point-cloud experience. |
  | Lead Integration Engineer | Paris · Saint-Lazare (CDI, from Sept 2026) | https://exwayz.fr/jobs/ | C | Robotics integration/leadership (C++ & ROS, customer sites) — relevant domain, but *"5 to 7 years of experience in field deployment or systems integration"* and *"Fluency in both French and English is required"*; Paris on-site. |
  | Robotics Field Engineer | Paris · Saint-Lazare (CDI) | https://exwayz.fr/jobs/ | C | Customer-success / software integration (C++, ROS keywords); Paris on-site, no German path. |
  | Research Internship · 3D Computer Vision | Paris · Saint-Lazare (6-month internship, €1,808.80 gross/month) | https://exwayz.fr/jobs/ | SKIP | Requires *"Final-year engineering school or Master's student, looking for an end-of-study internship"*; candidate has already completed his MSc. |

- **EU-remote:** NO — every posting states *"Based at our Saint-Lazare office in Paris, mostly on-site with some remote flexibility"*. The flexibility is HQ-based, not EU-wide remote. Evidence: https://exwayz.fr/jobs/
- **French requirement:** YES — *"Fluency in both French and English is required"* (Lead Integration Engineer) and *"Working French and English"* (R&D Scientist 3D CV and Research Internship). Evidence: https://exwayz.fr/jobs/
- **VERDICT:** WATCH
- **Reason:** Technically the closest fit in the batch (PyTorch + 3D CV + ROS + SLAM), but every role is a Paris CDI requiring working French — watch only in case they open an EU-remote or German role.

### Exotec
- **Category:** Industrial Robotics
- **HQ:** Lille, France (founded 2015; ~900+ employees worldwide)
- **Does:** End-to-end warehouse automation OEM — the Skypod goods-to-person robot system (battery robots that climb shelving racks) plus warehouse software.
- **German presence:** YES — company contact page lists the German entity: *"Exotec Deutschland GmbH, LabCampus 48, 85356 München-Flughafen, Deutschland"*. The en-gb contact variant lists *"Exotec Deutschland GmbH, Rödersteinstraße 6, 84034 Landshut, Deutschland"*. Registered-address aggregator: *"The registered address of Exotec Deutschland GmbH is Roedersteinstr. 6, 84034 Landshut"*. Sources: https://www.exotec.com/contact/ , https://www.exotec.com/en-gb/contact/ , https://tracxn.com/d/legal-entities/germany/exotec-deutschland-gmbh/__9F9j81Zf4v9EqfpUf478VL5ruXUYWytlW6jrhFB4R0Y
- **Careers URL:** https://careers.exotec.com/ (company entry point: https://www.exotec.com/careers/)
- **HTTP status:** 200 (ATS: **Workable**, tenant slug `exotec` — canonical board https://apply.workable.com/exotec/). Machine-readable endpoints confirmed: https://careers.exotec.com/_/llms.txt and https://apply.workable.com/exotec/jobs.md (supports `?location[0][country]=Germany`, `?department=`, `?query=`, `?workplace=remote`). A German-language board variant exists as `https://careers.exotec.com/?lng=de` → **200** (Workable i18n; note the board's published hreflang set is en/fr only, and no German strings were present in the static HTML — so treat the German variant as "URL works", not "German translations confirmed").
- **Open relevant roles:**

  Germany-filtered board (`?location[0][country]=Germany`) returns exactly **4** roles — **none** CV/ML/perception:

  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | Business Developer Leader | Munich, Germany (Hybrid) | https://apply.workable.com/exotec/jobs/view/A0603905B1.md | SKIP | Sales/business development, not engineering. |
  | Senior Solutions Engineer | Munich, Germany (Hybrid) | https://apply.workable.com/exotec/jobs/view/EF6552A1DD.md | C | Closest thing to a German technical role, but it is pre-sales solution engineering for the Skypod system, not CV/ML/R&D. |
  | Apprenticeship – Business Developer & Event Specialist | Munich, Germany (Part-time) | https://apply.workable.com/exotec/jobs/view/6A3F9079C9.md | SKIP | Apprenticeship, business development. |
  | Office Manager | Munich, Germany | https://apply.workable.com/exotec/jobs/view/EB4109C691.md | SKIP | Admin. |

  Relevant roles elsewhere on the board (for context — all off-limits from Germany):

  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | Stage Software Robotics - 2027 | Lille, France (Contract, internship, on_site) | https://apply.workable.com/exotec/jobs/view/EEFB37652E.md | C | Listing explicitly names the right topics — *"Les technologies de Machine Learning et d'Intelligence Artificielle"*, *"Les systèmes de vision par ordinateur"*, *"les outils de simulation et de validation"*, *"C++, Python, Java"*. But it is a student internship in France and the posting is in French. |
  | Senior Java Software Engineer | Lille, France | https://apply.workable.com/exotec/jobs/view/88EDA8EC98.md | SKIP | Backend Java, France. |
  | Software Engineering Manager (AI Transformation) | Lille, France (Hybrid) — salary stated EUR 75,000–85,000 | https://apply.workable.com/exotec/jobs/view/BEDBD1FF58.md | C | AI-focused manager role; France, manager level. |

- **EU-remote:** NO — the board's only two `remote` roles are country-scoped: *"Lead Solutions Engineer — France (Remote)"* (https://apply.workable.com/exotec/jobs/view/873B8BBE4A.md) and *"Lead Solutions Engineer — Netherlands (Remote)"* (https://apply.workable.com/exotec/jobs/view/20C3B81207.md). No EU- or worldwide-remote posting exists. Evidence: `https://apply.workable.com/exotec/jobs.md?workplace=remote`
- **French requirement:** not stated on the Germany roles (business/admin). On the French R&D posting: *"Bon niveau en anglais"* (good English) is required, and the whole posting is written in French — no explicit "français" requirement, but French is clearly the working language.
- **VERDICT:** TRACK
- **Reason:** Real German entity (Exotec Deutschland GmbH, Munich/Landshut) plus a filterable Workable board with a `country=Germany` locator and a `?lng=de` variant — worth scanning even though today's four German roles are sales/admin.

### Stanley Robotics
- **Category:** Industrial Robotics
- **HQ:** Paris, France (4/6 Boulevard Montmartre, 75009 Paris)
- **Does:** Autonomous vehicle-lifting robots ("Stan") for outdoor logistics — robotic valet parking and car storage — plus an intelligent storage-management software.
- **German presence:** NO — company contact page shows only the Paris address *"4/6 Boulevard Montmartre 75009 Paris – France"*, and the site states *"Founded in 2015, the SME is headquartered in Paris, France, and is also behind the world's first outdoor robotic valet parking service."* The careers board lists one role, in Paris. No German entity, address or posting found. Sources: https://www.stanley-robotics.com/contact/ , https://stanley-robotics.welcomekit.co/ , https://www.stanley-robotics.com/working-with-us/
- **Careers URL:** https://stanley-robotics.welcomekit.co/ (company page: https://www.stanley-robotics.com/working-with-us/)
- **HTTP status:** 200 (ATS: **WelcomeKit / Welcome to the Jungle** — tenant slug `stanley-robotics`)
- **Open relevant roles:** none found

  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | Sales Manager | Paris | https://stanley-robotics.welcomekit.co/jobs/sales-manager_paris | SKIP | Only published role; commercial. |

- **EU-remote:** NO — single Paris role, no remote wording anywhere on the board or company careers page. Evidence: https://stanley-robotics.welcomekit.co/
- **French requirement:** not stated (the only posting is a Sales Manager role; I did not open it).
- **VERDICT:** SKIP
- **Reason:** French-only, single commercial opening, no German footprint and no technical roles to monitor.

### MINITRUCKS ROBOTICS
- **Category:** Industrial Robotics
- **HQ:** Vénissieux (Lyon area), France — Campus Usin, Bâtiment 2.3, 41 Bd Marcel Sembat, 69200 Vénissieux
- **Does:** Ultra-compact modular heavy-load transport robots — radio-controlled and autonomous/semi-autonomous carriers for harsh industrial environments.
- **German presence:** NO — the site's own JSON-LD `Organization` schema states the single address: *"Campus Usin - Bâtiment 2.3, 41 Bd Marcel Sembat, addressLocality: Vénissieux, postalCode: 69200, addressCountry: FR"*, and the contact page shows only *"41 Bd Marcel Sembat 69200 Vénissieux"*. No German entity, address or posting found. Sources: https://www.minitrucks-robotics.fr/contact.php , https://www.minitrucks-robotics.fr/
- **Careers URL:** https://www.minitrucks-robotics.fr/recrutement.php
- **HTTP status:** 200 (ATS: none — company-hosted "Webgazelle" CMS page containing a spontaneous-application form with fields *"POSTE ACTUELLEMENT"* / *"Poste envisagé"*; no ATS tenant and no published job listings). Note: `www.minitrucksrobotics.com` does not resolve/connect (curl 000, TLS/DNS failure) — the live domain is `minitrucks-robotics.fr`.
- **Open relevant roles:** none found — the recruitment page publishes no individual postings, only a contact/application form.
- **EU-remote:** NO — no postings; no remote wording on the site.
- **French requirement:** not stated (no postings to read).
- **VERDICT:** SKIP
- **Reason:** French-only, no German entity, no ATS board and no published roles to track.

### BALYO
- **Category:** Industrial Robotics
- **HQ:** Arcueil (Paris), France — 74 avenue Vladimir Ilyich Lenin, 94110 Arcueil
- **Does:** Converts standard forklift trucks into standalone intelligent robots (AGV/AMR) using its proprietary "Driven" technology; now part of SoftBank Group.
- **German presence:** NO (no German legal entity or address) — the imprint states *"Company Name: BALYO. Legal form: Public Limited Company with a Board of Directors (S.A.). Share capital: €800,000. Headquarters: 74 avenue Vladimir Ilyich Lenin, 94110 Arcueil, France. Registration number: 483 563 029 in the Créteil Trade and Companies Register"* — a single French entity, no German address. **However, the company runs a German-language site**: https://www.balyo.com/de-de/ → 200 ("Autonome Gabelstapler und Roboter (AGV-AMR) von Balyo"), so they market into Germany. No German job posting or German office found. Sources: https://www.balyo.com/legal-notice , https://www.balyo.com/de-de/
- **Careers URL:** no careers page on balyo.com (all site links checked; `/careers`, `/en/careers`, `/fr-fr/careers` → 404). Their ATS is **Welcome to the Jungle**: https://www.welcometothejungle.com/fr/companies/balyo/jobs (403 to `curl` — CloudFront bot protection — but live in a browser and indexed by job aggregators). `https://balyo.welcomekit.co/` → 200 but serves *"No career website for balyo.welcomekit.co"*, so that is not a usable board.
- **HTTP status:** 403 via curl / 200 in browser (ATS: **Welcome to the Jungle**, slug `balyo`)
- **Open relevant roles:** 3 open roles, all Arcueil, France (via WTTJ board + aggregator mirror):

  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | AI Manager H/F | Arcueil, France (CDI, *"Télétravail fréquent"*) | https://www.welcometothejungle.com/fr/companies/balyo/jobs/ia-manager_arcueil | C | The only AI role: *"passer de l'IA expérimentale à une industrialisation à plus grande échelle"*, *"Bonne compréhension des technologies IA (LLM, Agents, RAG, bases de connaissance)"*. But it is an AI-programme/transformation lead (5–10 yrs, ROI/governance), not CV/ML engineering, and it is a France CDI. |
  | Alternance Ingénieur R&D – Software Integration & Test (H/F) | Arcueil, France | https://www.welcometothejungle.com/fr/companies/balyo | C | Right domain (R&D software integration & test on AMRs) but an apprenticeship, and Arcueil-based. |
  | Stage Contrôle de Gestion | Arcueil, France | https://www.welcometothejungle.com/fr/companies/balyo | SKIP | Finance internship. |

- **EU-remote:** NO — remote is France-based: the AI Manager posting is tagged *"Télétravail fréquent"* but anchored at Arcueil (WTTJ lists it as "Arcueil; Télétravail fréquent"). No EU- or worldwide-remote posting. Aggregator also reports *"Remote roles 0%"*. Evidence: https://www.landed.jobs/companies/balyo
- **French requirement:** not stated — the only language line in the AI Manager posting is *"Anglais courant"* (fluent English); French is not named. The posting itself is written entirely in French and is a France CDI.
- **VERDICT:** WATCH
- **Reason:** Strong robotics/AI R&D org with a German-language site and a standard ATS — watch for a German-located AI/perception role; today's 3 roles are France-only.

### OUIDROP
- **Category:** Industrial Robotics
- **HQ:** Bruges (Bordeaux), France — 12-14 rue Robert Mathieu, 33520 Bruges
- **Does:** Designs, assembles, installs and maintains robotised autonomous pickup points ("Dropper", "Ouiblock", "Megadrop", "Dropper Colis") that let shoppers collect grocery orders from supermarket Drive drives.
- **German presence:** NO — legal notice states *"Le présent site est édité par : OUIDROP SAS, Société par Actions Simplifiée au capital de 27 001 €, SIREN : 830 867 503, RCS Bordeaux : 830 867 503, Siège social : 12-14 rue Robert Mathieu, 33520 Bruges – France"* — one French entity, no German address. Note: `ouidrop.com` is **dead** (curl → TLS error, and over plain HTTP it redirects to `https://www.hugedomains.com/domain_profile.cfm?d=ouidrop.com`, a parked domain); the live site is `ouidrop.fr`. Sources: https://ouidrop.fr/mentions-legales/ , https://ouidrop.fr/contact/
- **Careers URL:** https://ouidrop.welcomekit.co/
- **HTTP status:** 200 (ATS: **WelcomeKit / Welcome to the Jungle**, slug `ouidrop`)
- **Open relevant roles:** none found — the board's "Nos offres" section renders empty and the only job link present is `/jobs/spontaneous-applications` ("Candidature spontanée"). Company profile on the board: 46 collaborators, founded 2017, average age 34.

  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | — (no published roles) | — | https://ouidrop.welcomekit.co/ | — | 0 open postings at time of check; only a spontaneous-application form. |

- **EU-remote:** NO — no postings and no remote wording on site or board.
- **French requirement:** not stated (no postings to read).
- **VERDICT:** WATCH
- **Reason:** Small but genuinely robotic company with a clean WTTJ/WelcomeKit board — cheap to keep watching for a perception/robotics engineering role; nothing open and no German entity today.

### EasyMile
- **Category:** Industrial Robotics
- **HQ:** Toulouse, France (21 Boulevard de la Marquette, 31000 Toulouse)
- **Does:** Certified Level-4 driverless vehicles and autonomy software (EZMove, EZShield) for heavy-duty goods and passenger transport.
- **German presence:** YES — the company footer/legal notice states *"GERMANY — EasyMile GmbH, Kastanienallee 84 (Fabrikgebäude), 10435 Berlin"*, and their own careers board says *"Its headquarters are in Toulouse (France), with subsidiaries in Berlin (Germany), Denver (USA), and Singapore."* Register evidence: *"EASYMILE GmbH, Berlin, Germany — Amtsgericht Charlottenburg (Berlin) HRB 193152"*. Sources: https://easymile.com/en/legal-notice , https://easymile.com/en/about-us , https://www.northdata.com/EASYMILE%20GmbH,%20Berlin/Amtsgericht%20Charlottenburg%20(Berlin)%20HRB%20193152%20B , https://easymile.welcomekit.co/
- **Careers URL:** https://easymile.welcomekit.co/ (also https://easymile.com/en/jobs → redirects to https://www.welcometothejungle.com/en/companies/easymile/jobs)
- **HTTP status:** 200 (ATS: **WelcomeKit / Welcome to the Jungle**, slug `easymile`; the WTTJ URL itself returns 403 to `curl` — bot protection — but 200 in a browser)
- **Open relevant roles:** 11 open roles, **all Toulouse, France** — no Berlin/Germany posting today:

  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | Embedded System Engineer – CDI | Toulouse | https://easymile.welcomekit.co/jobs/embedded-system-engineer-cdi-toulouse-f-m_toulouse | C | Robotics embedded/autonomy stack — right domain, but Toulouse on-site. |
  | Embedded Software Engineer – CDI | Toulouse | https://easymile.welcomekit.co/jobs/embedded-software-engineer-cdi-toulouse-f-m_toulouse | C | Autonomy/robotics software, France. |
  | System Engineer – CDI | Toulouse | https://easymile.welcomekit.co/jobs/system-engineer-cdi-toulouse-f-m_toulouse | C | Systems/safety engineering, France. |
  | Integration & Support Engineer – CDI (Francazal) | Toulouse | https://easymile.welcomekit.co/jobs/integration-support-engineer-cdi-francazal_toulouse | C | Vehicle integration, France. |
  | 3D Point Cloud Map Cleaning – Internship | Toulouse | https://easymile.welcomekit.co/jobs/3d-point-cloud-map-cleaning-internship-toulouse_toulouse | C | Literally the candidate's domain (point-cloud/perception) — but a student internship in France. |
  | Improve Localization Monitoring Safety Function – Internship | Toulouse | https://easymile.welcomekit.co/jobs/improve-localization-monitoring-safety-function-internship-toulouse_toulouse | C | Localization/SLAM-adjacent, internship, France. |
  | Path planning and control of a pseudo-omnidirectional wheeled vehicle – Internship | Toulouse | https://easymile.welcomekit.co/jobs/path-planning-and-control-of-a-pseudo-omnidirectional-wheeled-vehicle-internship-toulouse_toulouse | C | Navigation, internship, France. |
  | Test and simulation EZMove Tools – Internship | Toulouse | https://easymile.welcomekit.co/jobs/test-and-simulation-ezmove-tools-internship-toulouse_toulouse | C | Simulation, internship, France. |
  | V&V Engineer – CDI (Francazal) | Toulouse | https://easymile.welcomekit.co/jobs/v-v-engineer-cdi-francazal_toulouse | SKIP | Validation/QA. |
  | Network & Firewall Systems Administrator – Internship | Toulouse | https://easymile.welcomekit.co/jobs/network-firewall-systems-administrator-internship-toulouse_toulouse | SKIP | IT. |
  | Employee Augmentation & AI Agents Intern | Toulouse | https://easymile.welcomekit.co/jobs/employee-augmentation-ai-agents-intern-toulouse_toulouse | SKIP | Internal IT/AI agents, internship. |

  Note on the DHL Germany premise: the Deutsche Post DHL German autonomous-fleet programmes I could verify use **ZF ProAI / NVIDIA DRIVE PX**, not EasyMile — I found no EasyMile German deployment or role. The only verified EasyMile German footprint is the Berlin GmbH.
- **EU-remote:** NO — all 11 roles are Toulouse (department pages for engineering-move, engineering-navigation, r-d-ez-shield, engineering-tools, it and safety-cybersecurity each return only "Toulouse"). Evidence: https://easymile.welcomekit.co/departments/engineering-navigation
- **French requirement:** not stated — board listings are in English ("(F/M)" titles) and no French-language requirement appears on the board; the company page adds *"All our offers are open to people with disabilities."*
- **VERDICT:** TRACK
- **Reason:** Confirmed German legal entity (EasyMile GmbH, HRB 193152, Berlin) plus a standard ATS board — monitor for a Berlin perception/SLAM role; today's 11 openings are all Toulouse.

### Kickmaker
- **Category:** Industrial Robotics
- **HQ:** Paris, France — 53 BD du GAL MARTIAL VALIN, 75015 Paris (entity: *"Kickmaker – SASU 81999929300049"*)
- **Does:** Hardware design & industrialization agency — takes startups/SMEs from prototype to series in robotics, drones, medical devices, new mobility, IoT/consumer electronics (design, prototyping, industrialization). **No CV/ML product work.**
- **German presence:** NO — legal notice lists a single French entity (*"Propriétaire : Kickmaker – SASU 81999929300049 – 53 BD DU GAL MARTIAL VALIN 75015 PARIS"*), and their own careers page enumerates the offices as *"nos 4 agences de Paris, Lyon, Nantes et Grenoble"* plus Boston, San Francisco and Shenzhen — no Germany. Sources: https://www.kickmaker.fr/mentions-legales/ , https://www.kickmaker.fr/carriere/
- **Careers URL:** https://www.kickmaker.fr/carriere/ (board: https://www.welcometothejungle.com/fr/companies/kickmaker/jobs; English site variant https://www.kickmaker.fr/en/ → 200). Note `kickmaker.com` does not resolve (`curl: (6) Could not resolve host: www.kickmaker.com`); the live domains are kickmaker.fr and kickmaker.io.
- **HTTP status:** 200 (ATS: **Welcome to the Jungle**, slug `kickmaker`; WTTJ URL returns 403 to `curl` — bot protection — but 200 in a browser)
- **Open relevant roles:** ~34 open roles, none CV/ML. I could not render the WTTJ board's own list (JS-rendered / 403), so the titles below are the ones I could read from the aggregator mirror and WTTJ snippets, not a full verified enumeration:

  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | Embedded Software Engineer | France (Paris/Lyon/Nantes/Grenoble) | https://www.welcometothejungle.com/fr/companies/kickmaker/jobs | SKIP | Embedded/firmware, not CV/ML or perception. |
  | Freelance – Ingénieur logiciel C++ Moderne | Paris | https://www.welcometothejungle.com/fr/companies/kickmaker/jobs | SKIP | C++ freelance, general software. |
  | Freelance – Ingénieur Développement Logiciel C# / .NET | Paris | https://www.welcometothejungle.com/fr/companies/kickmaker/jobs | SKIP | C#/.NET freelance. |
  | Freelance – Ingénieur FPGA | Paris | https://www.welcometothejungle.com/fr/companies/kickmaker/jobs | SKIP | FPGA hardware design. |
  | Mechanical Engineer / Electronics Engineer | France | https://www.welcometothejungle.com/fr/companies/kickmaker/jobs | SKIP | Hardware. |
  | Project Manager / Business Development Manager | France (+ US postings) | https://www.welcometothejungle.com/fr/companies/kickmaker/jobs | SKIP | Management/sales. |

- **EU-remote:** NO — aggregator reports *"Remote roles 0%"* and *"Almost all of KICKMAKER's open roles are office based right now"*. Evidence: https://www.landed.jobs/companies/kickmaker
- **French requirement:** not stated in what I could read; one Talent Acquisition posting snippet states *"Anglais professionnel obligatoire (équipes internationales)"* (professional English mandatory) — no French requirement named, but all postings are in French.
- **VERDICT:** SKIP
- **Reason:** Out of scope for a CV/ML engineer — hardware design/industrialization agency with no German entity and no perception/ML openings.

---

## Batch summary

### TRACK (German-reachable or EU-remote; add to scan config)
| Company | Careers URL | Tier suggestion | Suggested scan_query | Why |
|---|---|---|---|---|
| Exotec | https://careers.exotec.com/ (Workable tenant `exotec`; `https://apply.workable.com/exotec/jobs.md`) | Tier 2 (large-company monitor) | `https://apply.workable.com/exotec/jobs.md?location%5B0%5D%5Bcountry%5D=Germany&query=robotics` | German entity Exotec Deutschland GmbH (Munich/Landshut) + filterable Workable board with `?lng=de`; today only 4 German roles (sales/admin) but R&D/perception roles would be a direct match |
| EasyMile | https://easymile.welcomekit.co/ (WelcomeKit slug `easymile`) | Tier 2 (large-company monitor) | `https://easymile.welcomekit.co/` → filter Berlin; or `https://www.welcometothejungle.com/en/companies/easymile/jobs` | Confirmed German legal entity EasyMile GmbH (HRB 193152, Kastanienallee 84, 10435 Berlin); all 11 current roles are Toulouse, so watch for a Berlin perception/SLAM posting |

### WATCH
- **BALYO** — https://www.welcometothejungle.com/fr/companies/balyo/jobs (WTTJ, slug `balyo`) — robotics/AI R&D org with a German-language site (`https://www.balyo.com/de-de/`), no German entity yet, 3 France-only roles (incl. "AI Manager H/F" with frequent French telework).
- **Exwayz** — https://exwayz.fr/jobs/ — best technical fit in the batch (R&D Scientist 3D Computer Vision: Python/PyTorch/ROS/CUDA), but Paris CDI and explicitly requires working French; watch for an EU-remote or German role.
- **OUIDROP** — https://ouidrop.welcomekit.co/ (WelcomeKit slug `ouidrop`) — robotised grocery-pickup company (46 staff, Bruges/France), board currently has 0 published roles; cheap to watch, no German entity.

### SKIP
- **Stanley Robotics** — https://stanley-robotics.welcomekit.co/ — Paris-only, single Sales Manager opening, no German footprint.
- **MINITRUCKS ROBOTICS** — https://www.minitrucks-robotics.fr/recrutement.php — Vénissieux/France only, no ATS and no published roles (note: `minitrucksrobotics.com` is dead, use `minitrucks-robotics.fr`).
- **Kickmaker** — https://www.kickmaker.fr/carriere/ (board: welcometothejungle.com/fr/companies/kickmaker/jobs) — hardware design/industrialization agency, no CV/ML scope, no German entity (note: `kickmaker.com` does not resolve).
