# Batch 01 — Humanoids & Physical AI (8 companies)

**Research date:** 2026-10-21
**Candidate profile:** Sanket Gadge — CV/ML Engineer, Berlin. Python, PyTorch, YOLOv8, Detectron2, DINOv3, OpenCV, FastAPI, Docker, GCP, ROS2 (cow-pose), some Nav2/SLAM/Webots. 4 yrs production ML (FMCG shelf monitoring). MSc AI Berlin 2026. English C1 / German A2 / no French. §20 job-seeker visa → work permit in Germany, no sponsorship needed.

**Actionability rule applied:** a role counts only if (a) based in Germany, (b) explicitly remote for EU/Europe/worldwide, or (c) at a company with a German entity hiring in Germany. France on-site roles are reported but not actionable.

**Method note:** several company sites (`gobanorobotics.com`, `www.wandercraft.com`) were unreachable from this host. Where that happened the careers surface was re-derived from the company's own site links / Welcome to the Jungle / the company's ATS API and that is stated explicitly. northdata.de returned HTTP 429 for every query from this IP, so German-entity evidence comes from company legal pages and ATS location data instead.

---

### Wandercraft
- **Category:** Humanoids & Physical AI
- **HQ:** Paris, France (SAS, RCS Versailles 788 627 198 000 70)
- **Does:** Self-balancing walking exoskeletons (Atalante X, Eve) and, since the Oct 2026 Ekso Bionics acquisition, the Calvin industrial humanoid robot family.
- **German presence:** UNCLEAR — three partial signals, no German posting.
  - The site's own legal notice names only the French entity: *"This website is owned by Wandercraft, a simplified joint-stock company (Société par Actions Simplifiée) ... whose registered office is located at 23-23 bis avenue d'Italie, 75013 Paris, France, registered with the Versailles Trade and Companies Register (RCS Versailles) under SIRET number 788 627 198 000 70"* — https://www.wandercraft.eu/mentions-legales
  - Welcome to the Jungle lists the company locations as *"Paris, Frankfurt Am Main, New York City"* (only Paris and New York addresses are shown) — https://www.welcometothejungle.com/en/companies/wandercraft
  - The group absorbed **Ekso Bionics Europe GmbH, An der Pönt 47, 40885 Ratingen, Germany** via the 1 Oct 2026 acquisition of Ekso Bionics, Inc. — https://eksobionics.com/contact/ and https://www.wandercraft.eu/articles/wandercraft-acquires-ekso-bionics
  - No role is posted in Germany, and there is no German-language careers page. A German-language *marketing* locale exists (https://www.wandercraft.eu/de, title "Startseite", HTTP 200) but that is not a hiring signal.
- **Careers URL:** https://www.welcometothejungle.com/en/companies/wandercraft/jobs
  - Note: `https://www.wandercraft.com/` and `https://www.wandercraft.com/en/careers` currently serve a Turbify "Under Construction" parking page (cert name mismatch; only reachable with `-k`). The live corporate site is **https://www.wandercraft.eu/** (HTTP 200), which links the WTTJ jobs board.
- **HTTP status:** 200 (ATS: Welcome to the Jungle — tenant slug `wandercraft`; 21 postings)
- **Open relevant roles:**
  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | (M/W) AI & Control Engineer – Perception and Navigation | Paris, France (Permanent contract, "Occasional remote") | https://www.welcometothejungle.com/en/companies/wandercraft/jobs/m-w-ai-control-engineer-perception-and-navigation_paris | B | Near-perfect fit (object detection, pose estimation, mapping, autonomous navigation, C++/robotics, CI); blocked — Paris on-site/hybrid |
  | (H/F) AI & Control Senior Engineer - Modeling & Simulation | Paris, France (Permanent contract, "Occasional remote") | https://www.welcometothejungle.com/en/companies/wandercraft/jobs/h-f-senior-modeling-simulation-engineer_paris | B | Simulation + modeling for humanoids; blocked — Paris on-site/hybrid |
  | (H/F) AI & Control Senior Engineer – Manipulation | Paris, France (Permanent contract, "Occasional remote") | https://www.welcometothejungle.com/en/companies/wandercraft/jobs/h-f-ai-controls-engineer-manipulation_paris | B | Robotic manipulation; blocked — Paris on-site/hybrid |
  | (M/W) AI & Control Intern – Perception and Navigation | Paris, France (Internship, "No remote work") | https://www.welcometothejungle.com/en/companies/wandercraft/jobs/m-w-ai-control-engineering-intern-perception-and-navigation_paris | C | Internship, Paris |
  | (M/W) Electronic Industrialization Engineer / (M/W) Electronics R&D Engineer / (H/F) Ingénieur R&D Conception Mécanique / (H/F) Technicien Industrialisation Robotique | Paris, France | https://www.welcometothejungle.com/en/companies/wandercraft/jobs | SKIP | Hardware / industrialization / mechanical — out of scope |
- **EU-remote:** NO — every one of the 21 postings is tagged either "No remote work" or "Occasional remote" (= hybrid, WTTJ `Télétravail occasionnel`), and the only "few days at home" role is *"Business Developer - Industrial Robotics"* (sales). No EU/Europe/worldwide remote role exists. — https://www.welcometothejungle.com/en/companies/wandercraft/jobs
- **French requirement:** not stated — the posting is published in English with *"Version française de l'offre disponible sur demande."* No "Anglais/French", "Fluent French" or "B2 French" clause found. — https://www.welcometothejungle.com/en/companies/wandercraft/jobs/m-w-ai-control-engineer-perception-and-navigation_paris
- **VERDICT:** WATCH
- **Reason:** Outstanding role fit (AI & Control / perception / navigation) and the group now owns a German GmbH in Ratingen, but every open role is Paris hybrid — worth a periodic re-check for a Frankfurt/Ratingen posting.

---

### Enchanted Tools
- **Category:** Humanoids & Physical AI
- **HQ:** Paris, France (18 rue de la Fontaine au Roi, 75011 Paris)
- **Does:** Builds the Mirokaï, character-shaped service robots with expressive avatars for hospitals and care teams.
- **German presence:** NO — the only legal entity found is the Paris address quoted on both the site footer (*"Enchanted Tools HQ — 18 rue de la Fontaine au Roi 75011 Paris"*, https://enchanted.tools/jobs) and the ATS privacy text (*"Enchanted Tools, 18 rue de la Fontaine au Roi 75011 PARIS"*, https://career.enchanted.tools/apply/sp/simplex-robotics). No GmbH/AG, no German office, no German posting, and all four board entries are Paris.
- **Careers URL:** https://career.enchanted.tools/ (company link: https://enchanted.tools/jobs)
- **HTTP status:** 200 (ATS: **Taleez** — tenant slug `simplex-robotics`; 4 postings)
- **Open relevant roles:**
  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | Open application - All talents welcome ! | Paris, France (Permanent) | https://career.enchanted.tools/apply/open-application-all-talents-welcome-paris-enchanted-tools-cdi | C | *"We are looking for AI experts, embedded software experts, industrialization experts"* — right domain, but Paris on-site and no published role to aim at |
  | Hardware Certification Engineer - Hybrid | "Fully remote" (Taleez), Permanent | https://career.enchanted.tools/apply/hardware-certification-engineer-hybrid-enchanted-tools-cdi | SKIP | Hardware certification — out of scope for a CV/ML engineer |
  | Robotics Intern – Learning Dexterous Manipulation with Mirokaï Robots | Paris (Internship, 6 months) | https://taleez.com/apply/robotics-intern-learning-dexterous-manipulation-with-mirokai-robots-paris-enchanted-tools | SKIP | Closed — *"This job posting is not available anymore"* |
  | Stage - Conformité réglementaire / Alternance - Assurance Qualité et Affaires Réglementaires | Paris (Internship / Apprenticeship) | https://career.enchanted.tools/ | SKIP | Regulatory / quality — out of scope |
- **EU-remote:** UNCLEAR — exactly one entry is labelled **"Fully remote"** (*"Hardware Certification Engineer - Hybrid"*, https://career.enchanted.tools/), but it is a hardware role and no EU/worldwide remote scope is stated. No AI/robotics-software role is remote.
- **French requirement:** not stated — no "Anglais/French", "Fluent French" or "B2 French" clause on the board or the open-application page. The board copy itself is in French.
- **VERDICT:** SKIP
- **Reason:** Paris-only company with no German entity; the only AI-relevant opening is a generic Paris spontaneous application and the robotics internship is closed.

---

### GenesisAI
- **Category:** Humanoids & Physical AI
- **HQ:** Global — *"© 2026 Genesis AI SAS"* (https://www.genesis.ai/); careers board locations are Bay Area, Paris and London.
- **Does:** Builds general-purpose robots with human-level intelligence plus foundation models and the "Genesis World" multi-physics simulation platform (with the Nyx path-traced renderer).
- **German presence:** NO — the careers location filter offers only **"Bay Area (31), London (29), Paris (30), Remote (3)"** and the Ashby posting API returns locations `{'Bay Area': 31, 'Paris': 25, 'London': 15, 'Remote': 1}` — no Germany entry, no German office, no German posting. — https://jobs.ashbyhq.com/genesis and https://api.ashbyhq.com/posting-api/job-board/genesis
- **Careers URL:** https://www.genesis.ai/careers
- **HTTP status:** 200 (ATS: **Ashby** — tenant slug `genesis`, board at https://jobs.ashbyhq.com/genesis → 200; 72 openings)
- **Open relevant roles** (same role, multiple locations — listed once per location where it matters):
  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | Foundation Models | Bay Area (On-site) / Paris (Hybrid) / London (Hybrid) | https://jobs.ashbyhq.com/genesis | B | Exact match for the profile (robotics foundation models); blocked — no Germany, Paris/London hybrid |
  | Robot Learning | Bay Area (On-site) / Paris (Hybrid) / London (Hybrid) | https://jobs.ashbyhq.com/genesis | B | Imitation/RL for robots — direct fit; blocked |
  | Simulation Infrastructure / Genesis-World: Core Simulation Engine Engineer | Bay Area (On-site) / Paris (Hybrid) / London (Hybrid) | https://jobs.ashbyhq.com/genesis | B | Simulation is on the candidate's list; blocked |
  | ML Compiler & System / Training / AI Infrastructure / Data Infrastructure / Inference | Bay Area (On-site) / Paris (Hybrid) / London (Hybrid) | https://jobs.ashbyhq.com/genesis | B | Relevant but infra-heavy; blocked |
  | Data Agent / Rendering, Pipeline Optimization | Bay Area (On-site) / Paris (Hybrid) | https://jobs.ashbyhq.com/genesis | B | Relevant; blocked |
  | Senior Asset Pipeline Engineer, Sim-Ready Content | **Remote**; Paris (Remote) | https://jobs.ashbyhq.com/genesis/3345e07a-b4d5-4e8b-ab4a-26836db9108b | B | Only genuinely remote role in the batch — but remote scope is not stated as EU/worldwide; the board shows *"Location: Remote; Paris"* and *"Location Type: Remote"* |
  | Robotics | Bay Area (On-site) / Paris (Hybrid) | https://jobs.ashbyhq.com/genesis | B | Relevant; blocked |
  | Security / QA Engineer: Nyx Renderer / Site Reliability Engineer / Member of Technical Staff, IT / Manufacturing / GTM / Talent / Operations / Deployment roles | Bay Area, Paris, London | https://jobs.ashbyhq.com/genesis | SKIP | Out of scope (QA, IT, ops, manufacturing, BD, marketing, recruiting) |
- **EU-remote:** UNCLEAR — one posting carries *"Location: Remote; Paris"* / *"Location Type: Remote"* (https://jobs.ashbyhq.com/genesis/3345e07a-b4d5-4e8b-ab4a-26836db9108b), and the board offers a "Remote" location bucket, but **no posting states "remote EU / Europe / worldwide"** and the remote role still carries a Paris secondary location. No EU-remote statement could be found.
- **French requirement:** not stated — postings are in English; no "Anglais/French", "Fluent French" or "B2 French" clause on the board or the remote posting.
- **VERDICT:** WATCH
- **Reason:** Best technical match in the batch (robotics foundation models + simulation, 72 openings) with one true "Remote" role, but no German site yet and no confirmed EU-remote scope — highest-priority company to re-scan when a Germany or EU-remote role lands.

---

### UMA
- **Category:** Humanoids & Physical AI
- **HQ:** Paris, France (UMA, SAS, share capital €10,000, 229 rue Saint-Honoré, 75001 Paris, RCS Paris 991 830 779)
- **Does:** Builds general-purpose mobile and humanoid robots with human-level dexterity ("Northstar" flagship humanoid), founded by ex-Hugging Face / ex-Tesla researchers.
- **German presence:** NO — the legal notice states *"UMA — Legal form: Société par actions simplifiée (SAS) — Registered office: 229 rue Saint-Honoré, 75001 Paris, France — Registration number: 991 830 779 RCS Paris"* (https://uma.bot/legal-terms). The careers board header lists *"LOCATION — Paris, Geneva, London"* and **all 13 roles are `workplace_type: ONSITE` in "Paris, France"** (Dover API: https://app.dover.com/api/v1/job-groups/3a4a12c9-b2ec-406b-b5c0-8c64e9024687/job-groups). No Germany, no German entity.
- **Careers URL:** https://app.dover.com/jobs/uma (linked from https://uma.bot/ "Join us")
- **HTTP status:** 200 (ATS: **Dover** — tenant slug `uma`; 13 postings)
- **Open relevant roles:**
  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | Research Scientist / Engineer | Onsite (Paris, France) | https://app.dover.com/jobs/uma/af19e413-4f01-499f-ae8b-a9ccdcc41866 | SKIP | Excellent fit, but on-site Paris — needs French work-permit sponsorship |
  | Research Scientist / Engineer - Data | Onsite (Paris, France) | https://app.dover.com/jobs/uma/ea229e96-7a3f-42a1-9239-60ba339a4bce | SKIP | As above |
  | Research Engineer / Research Scientist - Embodied World Models | Onsite (Paris, France) | https://app.dover.com/jobs/uma/1bb6bdb5-dd1d-49d5-8496-45bebaa43f3d · https://app.dover.com/jobs/uma/e223cbc4-8b0e-4b3b-9935-47d046af65b3 | SKIP | As above |
  | Research Scientist / Engineer - Large-scale Training / AI Infra - Large-scale Training | Onsite (Paris, France) | https://app.dover.com/jobs/uma/50244c14-3f79-4e8b-9ef9-3cf9a1e6ca0c · https://app.dover.com/jobs/uma/e314405d-7978-4307-9680-739e25e2ea4b | SKIP | As above |
  | Robotics Engineer - Whole-Body Control | Onsite (Paris, France) | https://app.dover.com/jobs/uma/5f0e0486-6941-4ccd-b41e-16c611b8f261 | SKIP | Controls-heavy, on-site Paris |
  | Compute Infrastructure Lead / Finance Manager / Lead Operator & Operator - Data Collection / Research Scientist & Engineer Intern / Wild card - Open candidate | Onsite (Paris, France) | https://app.dover.com/jobs/uma | SKIP | Not a fit for the candidate profile |
- **EU-remote:** NO — every one of the 13 postings is rendered as *"Onsite (Paris, France)"*, and the Dover API returns `"workplace_type": "ONSITE"` for all 13. No remote, hybrid or EU-remote option exists. — https://app.dover.com/jobs/uma
- **French requirement:** not stated — the board copy is in English and no "Anglais/French", "Fluent French" or "B2 French" clause is published on the board.
- **VERDICT:** SKIP
- **Reason:** Technically excellent but 100% on-site Paris with zero remote postings — no actionable surface for a Berlin-based, no-French candidate.

---

### Gobano Robotics
- **Category:** Humanoids & Physical AI
- **HQ:** Nantes & Paris, France (also London per the board)
- **Does:** AI pipeline for robotic manipulation — imitation learning, reinforcement learning, classical control and agentic integration to teach industrial robot arms new tasks.
- **German presence:** NO — the Welcome to the Jungle board header lists *"Paris, London, Nantes"* as the company locations, and every posting is Nantes/London. No German entity, office or posting found. — https://www.welcometothejungle.com/en/companies/gobano-robotics/jobs
- **Careers URL:** https://www.welcometothejungle.com/en/companies/gobano-robotics/jobs (redirects to the `/fr/` board)
  - **Own site could not be loaded:** `https://gobanorobotics.com/` returns HTTP **000** (connection timeout) from this host via curl and via headless Chrome, and `https://gobanorobotics.com/jobs` likewise times out. DNS resolves (128.14.74.124 / .107) but the server never completes the handshake from this network. The board was therefore re-derived from the company's Welcome to the Jungle presence; LinkedIn (`fr.linkedin.com/company/gobano-robotics`) also lists *"Software & AI Engineer chez Gobano Robotics (Nantes)"* but LinkedIn blocks logged-out page loads (authwall).
- **HTTP status:** 200 (ATS: Welcome to the Jungle — tenant slug `gobano-robotics`; 5 postings)
- **Open relevant roles:**
  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | (EN/FR) Stage Robotique & IA | Nantes, France (Internship) | https://www.welcometothejungle.com/fr/companies/gobano-robotics/jobs/en-fr-stage-robotique-ia_nantes | C | Right domain (robotic manipulation, RL/IL) but an internship, and *"Télétravail non autorisé"* |
  | (EN/FR) Stage - Software Engineering | Nantes, France (Internship) | https://www.welcometothejungle.com/fr/companies/gobano-robotics/jobs/en-fr-stage-software-engineering_nantes | C | Internship only |
  | EN/FR Deployment Engineer Internship – Physical AI & Robotics | Nantes, France (Internship) | https://www.welcometothejungle.com/fr/companies/gobano-robotics/jobs/0560a921-9153-4a57-9a28-3f25d12564ad | C | Internship only |
  | Internship: Founder Associate / CEO's Right Hand | London, UK (Internship) | https://www.welcometothejungle.com/fr/companies/gobano-robotics/jobs/internship-founder-associate-ceo-s-right-hand_london | SKIP | Business/leadership internship, not engineering |
  | Candidature spontanée | — | https://www.welcometothejungle.com/fr/companies/gobano-robotics/jobs/spontaneous-applications | C | Open application; France-based |
- **EU-remote:** NO — the Nantes postings are explicitly *"Télétravail non autorisé"* (remote not permitted) and the London one is *"Télétravail occasionnel"* (occasional/hybrid). No EU-remote role. — https://www.welcometothejungle.com/en/companies/gobano-robotics/jobs
- **French requirement:** YES — three of the five postings carry the explicit bilingual tag in the title: *"(EN/FR) Stage Robotique & IA"*, *"(EN/FR) Stage - Software Engineering"*, *"EN/FR Deployment Engineer Internship – Physical AI & Robotics"*. — https://www.welcometothejungle.com/en/companies/gobano-robotics/jobs
- **VERDICT:** SKIP
- **Reason:** Every live posting is a French-or-English internship with remote explicitly disallowed — nothing at the right level, and French B1+ would be required anyway.

---

### Inbolt
- **Category:** Humanoids & Physical AI
- **HQ:** Paris, France (plus Detroit, USA and Tokyo, Japan)
- **Does:** 3D-vision + AI software that gives industrial robots real-time guidance (Inbolt Studio), deployed in 100+ factories worldwide.
- **German presence:** NO — the contract entity list is exhaustive and contains no German company: *"These General Terms and Conditions ... apply to all quotations, sales, licenses, deliveries, and services provided by Inbolt SAS (France), Inbolt Inc. (United States) or Inbolt KK (Japan)"* (https://www.inbolt.com/general-terms-conditions/). The company profile states *"Based in Paris with offices in Detroit and Tokyo"* and the WTTJ location header lists *"Paris, Detroit"* — no Germany, no German posting.
- **Careers URL:** https://www.welcometothejungle.com/fr/companies/inbolt/jobs
  - `inbolt.com` has **no own careers page** — its only jobs link is `https://www.welcometothejungle.com/companies/inbolt/jobs`.
- **HTTP status:** 200 (ATS: Welcome to the Jungle — tenant slug `inbolt`; 6 postings)
- **Open relevant roles:**
  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | Robotics Engineer (Senior) | Paris, France (CDI, "Télétravail fréquent", exp. > 4 ans) | https://www.welcometothejungle.com/fr/companies/inbolt/jobs/robotics-engineer-senior_paris | B | *"Your mission will be to own the integration of complex robotics features into Inbolt Studio ... You will work at the intersection of robotics, 3D perception, and software engineering"* — very close to the profile; blocked — Paris, hybrid |
  | Robotics Application Engineer (Senior Level) | Detroit, USA | https://www.welcometothejungle.com/fr/companies/inbolt/jobs/robotics-application-engineer-senior-level_detroit | SKIP | US site |
  | Robotics Application Engineer (Detroit) | Detroit, USA | https://www.welcometothejungle.com/fr/companies/inbolt/jobs/field-application-engineer_paris_INBOL_Kjd9ka0 | SKIP | US site |
  | Robotics Application Engineer (Tokyo) | Yokohama, Japan | https://www.welcometothejungle.com/fr/companies/inbolt/jobs/robotics-application-engineer_tokyo | SKIP | Japan site |
  | Finance Ops | Paris, France | https://www.welcometothejungle.com/fr/companies/inbolt/jobs/financial-controller_paris | SKIP | Finance |
  | Candidature spontanée | — | https://www.welcometothejungle.com/fr/companies/inbolt/jobs/candidatures-spontanees | C | Open application; Paris-based |
- **EU-remote:** NO — the only Paris technical role is tagged *"Télétravail fréquent"* (= frequent remote / hybrid), i.e. office-based with some remote days; no posting states remote EU/Europe/worldwide. — https://www.welcometothejungle.com/fr/companies/inbolt/jobs
- **French requirement:** not stated — the "Robotics Engineer (Senior)" posting is written in English and lists no French language requirement.
- **VERDICT:** WATCH
- **Reason:** Near-perfect role fit (robotics + 3D perception + software) but every opening is Paris/Detroit/Tokyo hybrid with no German or EU-remote surface — re-check for an EMEA-remote posting.

---

### Stereolabs
- **Category:** Humanoids & Physical AI
- **HQ:** Paris, France + San Francisco, USA
- **Does:** Makes the ZED stereo cameras and ZED SDK — 3D perception, depth, tracking, SLAM/VIO and spatial AI for robots and physical AI.
- **German presence:** NO — the company states its sites plainly: *"Implantés à Paris et San Francisco, nous concevons la ZED..."* (https://careers.stereolabs.com/o/senior-software-engineer-c) and the careers board location filter shows a single country: *"All countries / France / 4 jobs"*. No German entity, office, or posting. (The marketing site has a `/en-de` locale, but that is website localisation, not presence.) — https://careers.stereolabs.com/
- **Careers URL:** https://careers.stereolabs.com/
- **HTTP status:** 200 (ATS: **Recruitee** — tenant slug `stereolabs`, assets on `careers.recruiteecdn.com`; 4 postings, all France)
- **Open relevant roles:**
  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | Senior Software Engineer C++ | MONTROUGE, Île-de-France, France (R&D) | https://careers.stereolabs.com/o/senior-software-engineer-c | B | Near-perfect stack match — *"estimation de carte de profondeur, tracking positionnel, fusion SLAM / VIO / GNSS, détection et segmentation d'objets"*, *"intégration avec ROS2, Isaac Sim, Python"*, stack *"C++ moderne, CUDA, NPP, OpenCV, bindings Python, ROS2"*. But requires *"7+ années d'expérience professionnelle en C++ de production"* and is on-site Paris |
  | Ingénieur(e) Software Embarqué Senior (H/F) | France | https://careers.stereolabs.com/o/ingenieure-software-embarque-senior-hf | C | Embedded software — adjacent but hardware-side |
  | Ingénieur Qualité Image Senior - Camera (H/F) | France | https://careers.stereolabs.com/o/ingenieur-qualite-image-senior-camera-hf | C | Image quality / camera QA — partially QA, hardware-side |
  | Ingénieur Senior en Conception Electronique (H/F) | France | https://careers.stereolabs.com/o/ingenieur-senior-en-conception-electronique-hf | SKIP | Electronic hardware design — out of scope |
- **EU-remote:** NO — the board header reads *"We are looking for exceptional people in Paris and San Francisco"* and lists only France locations; no remote option is offered on any of the four postings. — https://careers.stereolabs.com/
- **French requirement:** not stated as a requirement — the postings are published in French, but no "Anglais/French", "Fluent French" or "B2 French" clause appears in the requirements of the Senior Software Engineer C++ posting.
- **VERDICT:** SKIP
- **Reason:** Ideal stack match (OpenCV/CUDA/ROS2/SLAM) but every opening is on-site France and senior (7+ yrs C++ production).

---

### SBG Systems
- **Category:** Humanoids & Physical AI
- **HQ:** Carrières-sur-Seine, France (founded 2007, 140+ employees, exports 90% of production to 70+ countries)
- **Does:** Designs inertial navigation hardware and software — IMUs, AHRS/MRU, INS/GNSS — plus post-processing software, used in autonomous vehicles, drones, marine, geomatics and defence.
- **German presence:** YES — three independent signals:
  1. Company statement in the job posting: *"Headquartered in Carrières-sur-Seine (near Paris, France), we have an international presence in USA, **Germany**, Singapore, Australia, India, Japan, Poland and the UK."* — https://career.sbg-systems.com/jobs/8563997-junior-sales-engineer-dach
  2. The Teamtailor board's location filter lists **"Germany"** among the hiring locations, and one live role is anchored there: *"Junior Sales Engineer DACH — SALES EMEA · GERMANY"* — https://career.sbg-systems.com/jobs/8563997-junior-sales-engineer-dach
  3. A German-language careers page exists: **https://www.sbg-systems.com/de/career/** (HTTP 200, content *"Entdecken Sie unsere Stellenangebote"*), and the site also offers DE alongside EN/FR/ES/IT/PL/UK/BR/JA/KO/ZH.
- **Careers URL:** https://www.sbg-systems.com/career/ (corporate landing) → job board **https://career.sbg-systems.com/jobs**
- **HTTP status:** 200 (ATS: **Teamtailor** — tenant `Gse06Y16294@eu`; 11 postings; German-language corporate variant at https://www.sbg-systems.com/de/career/)
- **Open relevant roles:**
  | Title | Location | URL | Verdict | Why |
  |---|---|---|---|---|
  | Ingénieur algorithmes de navigation confirmé (f/h) | Carrières-sur-Seine, France (Hybride) — dept. *R&D - ALGORITHMICS (Navigation algorithm)* | https://career.sbg-systems.com/jobs/8261671-ingenieur-algorithmes-de-navigation-confirme-f-h | B | Inertial/navigation algorithms — closest technical match to the candidate's SLAM/Nav2 background; blocked — France hybrid |
  | Field Application Expert - Navigation & Drones/UAV (H/F) | Carrières-sur-Seine, France (Hybride) | https://career.sbg-systems.com/jobs/8513293-field-application-expert-navigation-drones-uav-h-f | C | Navigation domain match, but a customer-facing support role |
  | Chef de projet R&D - systèmes de navigation inertielle (f/h) | Carrières-sur-Seine, France (Hybride) | https://career.sbg-systems.com/jobs/8342802-chef-de-projet-r-d-systemes-de-navigation-inertielle-f-h | C | Project management — excluded category |
  | Ingénieur Electronique Confirmé – Navigation inertielle (H/F) | Carrières-sur-Seine, France (Hybride) | https://career.sbg-systems.com/jobs/8275150-ingenieur-electronique-confirme-navigation-inertielle-f-h | SKIP | Electronics — out of scope |
  | Junior Sales Engineer DACH | **Germany** | https://career.sbg-systems.com/jobs/8563997-junior-sales-engineer-dach | SKIP | Sales — out of scope, but proves the German hiring surface is live |
  | Sales Manager – Defense & Navigation Systems (Southern Europe) | Istanbul, Madrid, Milan — *Entièrement à distance* (fully remote) | https://career.sbg-systems.com/jobs/8259183-sales-manager-defense-navigation-systems-southern-europe | SKIP | Fully remote but sales — out of scope |
  | Administrateur Système & Réseau Sénior / Responsable Systèmes QHSE / Comptable Général / Acheteur mécanique Senior / Opérateur de Production | Carrières-sur-Seine, France | https://career.sbg-systems.com/jobs | SKIP | Out of scope |
- **EU-remote:** UNCLEAR — the Teamtailor board offers a *"Statuts à distance"* filter including *"Entièrement à distance"*, and one posting is published as *"Entièrement à distance"* (Sales Manager – Defense & Navigation Systems (Southern Europe), locations Istanbul/Madrid/Milan). However **every technical/engineering role is France hybrid** (*"Hybride"*) and no posting states remote EU/Europe/worldwide. — https://career.sbg-systems.com/jobs
- **French requirement:** not stated — the Germany role ("Junior Sales Engineer DACH") states no language requirement, and the engineering postings (in French) contain no "B2 French"/"Fluent French" clause.
- **VERDICT:** TRACK
- **Reason:** Verified German entity/hiring surface (Germany location filter + DACH posting + German-language careers page) — a German engineering role would be directly actionable without sponsorship, so the board belongs in the scan config even though today's only German role is sales.

---

## Batch summary

### TRACK (German-reachable or EU-remote; add to scan config)
| Company | Careers URL | Tier suggestion | Suggested scan_query | Why |
|---|---|---|---|---|
| SBG Systems | https://career.sbg-systems.com/jobs | Tier 2 | `SBG Systems navigation algorithm inertial` | Verified Germany presence: "international presence in USA, Germany, Singapore…" (DACH posting), Teamtailor location filter includes "Germany", German careers page at https://www.sbg-systems.com/de/career/. Relevant algorithmic-navigation roles already exist (France hybrid) — a Germany variant would be immediately actionable. |

### WATCH
- **GenesisAI** — https://www.genesis.ai/careers (ATS: **Ashby**, tenant `genesis`; board https://jobs.ashbyhq.com/genesis) — 72 openings across Bay Area/Paris/London, best technical fit in the batch, exactly one *"Location: Remote"* role (Senior Asset Pipeline Engineer, Sim-Ready Content) but no stated EU/worldwide remote scope and no Germany location yet. Re-scan monthly.
- **Wandercraft** — https://www.welcometothejungle.com/en/companies/wandercraft/jobs (ATS: Welcome to the Jungle, tenant `wandercraft`; 21 postings) — three AI & Control roles (Perception & Navigation, Modeling & Simulation, Manipulation) are near-perfect fits but Paris hybrid; the group now owns Ekso Bionics Europe GmbH in Ratingen, Germany and WTTJ lists "Frankfurt Am Main" as a company location, so a German posting is plausible. Note `wandercraft.com` is currently a Turbify "Under Construction" page — the live site is `wandercraft.eu`.
- **Inbolt** — https://www.welcometothejungle.com/fr/companies/inbolt/jobs (ATS: Welcome to the Jungle, tenant `inbolt`; 6 postings) — "Robotics Engineer (Senior)" is a strong robotics/3D-perception match, but Paris hybrid with entities only in France, USA and Japan; watch for an EMEA-remote posting.

### SKIP
- **UMA** — Paris-only entity, all 13 Dover postings on-site Paris; excellent fit but zero remote and no German surface.
- **Stereolabs** — Paris + San Francisco only, 4 Recruitee postings all in France; ideal stack (C++/CUDA/OpenCV/ROS2/SLAM) but on-site and senior (7+ yrs C++ production).
- **Gobano Robotics** — own site `gobanorobotics.com` unreachable (HTTP 000 / timeout from this host); all 5 WTTJ postings are internships with "Télétravail non autorisé" and explicit "(EN/FR)" bilingual tags.
- **Enchanted Tools** — Taleez board (tenant `simplex-robotics`) with 4 Paris postings; the robotics internship is closed, the only remote entry is a hardware-certification role, and the AI-relevant opening is a Paris spontaneous application.
