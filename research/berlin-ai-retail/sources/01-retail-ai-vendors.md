# Berlin AI / ML / Computer-Vision Vendors for RETAIL — Exhaustive Research Report

**Scope:** Vendors whose product serves retail (shelves, stores, assortment, pricing, demand) — shelf monitoring / shelf recognition / planogram compliance, retail & shopper analytics, price intelligence, assortment & space planning, demand & sales forecasting, replenishment, loss prevention / shrinkage / OOS detection, checkout & queue CV / cashierless / payment fraud, grocery & e-commerce demand forecasting & promo optimisation, retail merchandising with an AI component.

**Hard constraint applied:** Berlin presence required (HQ in Berlin, or a Berlin office doing the AI/engineering work). Every fact below is sourced from a URL that was actually fetched. Companies where Berlin could not be verified are listed separately in Section 5.

**Research date:** 20 Oct 2026.
**Method:** `websearch` + Exa `exa_search` (company / keyword / neural / auto), direct page fetches, curated directories (VCNews Berlin startup list — 707 companies; appliedAI *German AI Startup Landscape 2025* — 935 startups, 238 of them Berlin; RevenueBase; EU-Startups; Startup-Germany; Tracxn; ai.berlin; Berlin Partner / Dealroom Berlin tech ecosystem report), plus vendor ATS boards (Personio, Recruitee, join.com, Greenhouse, Coda, SuccessFactors).

---

## Section 1 — TIER A: Shop-floor computer vision, loss prevention, checkout CV (highest relevance for a CV/ML engineer)

---

### Signatrix GmbH  ([signatrix.com](https://www.signatrix.com/))
- **Berlin evidence:** Own about page states "Founded in 2017 / **Based in Berlin** / Team 20" and gives the address **Karl-Liebknecht-Str. 32, 10178 Berlin Germany, +49 30 403670851** (Berlin Mitte). Also listed as a Berlin startup in the appliedAI German AI Startup Landscape 2025 (city: Berlin) and in the Berlin tech ecosystem map / RevenueBase (HQ recorded Berlin). Source: https://www.signatrix.com/about (fetched; also rendered via Exa with the same content).
- **What they do (AI + retail):** Signatrix is a *visual intelligence platform for brick-and-mortar retail*. It plugs into retailers' **existing CCTV/IP camera infrastructure** and runs AI/computer-vision analytics on the video: detecting objects, customer movements and irregular behaviour in-store in real time. Use cases span loss prevention (shrink, self-checkout fraud, shoplifting), store management, customer insight, queue/incident alerting and forensic analysis. They operate a single edge device per store ("one single piece of hardware unlocks a multitude of use-case Apps") and deploy "apps" on top of it.
- **Products:** Signatrix AI Suite; apps for **Loss Prevention**, **Store Management**, **Customer Insight**, Incident Notifications, Forensic Analysis; "Signatrix Dashboard".
- **Size / stage:** ~20 people. **Acquired 100% by ITAB Group (ITAB ist einer der großen Anbieter von Ausgangsschleusen und SB-Kassen für den Handel in Europa)** — announced 30 May 2025 ("Itab übernimmt Startup Signatrix", Lebensmittelzeitung). Website still shows "ITAB Makes Strategic Investment in Signatrix' Retail AI Technology". Investor/funding history includes several seed rounds (2018–2024 per Crunchbase-derived data).
- **Founded:** 2017.
- **Why it matters for a CV/ML engineer:** Probably the single most on-target Berlin employer for a CV/ML engineer — the public team page lists **Head of AI, Senior Deep Learning Engineer (x2), Deep Learning Engineer, Senior Software Engineer, Tech Lead, In-house Annotator / Annotation Review** i.e. a real annotation + modelling org on retail video. Own team includes several Georgian/Georgian-heritage DL engineers — a strong CV hiring pattern.
- **Open roles (Berlin):** No public ATS listing found at time of research; the careers section is an anchor on the about page. Roles currently staffed (i.e. what they hire for) are listed above.
  | Role | URL |
  |---|---|
  | Careers section (no open reqs published) | https://signatrix.com/about/#career |
  | (Team page showing live DL roles: Senior Deep Learning Engineer, Deep Learning Engineer, Head of AI, Annotator) | https://www.signatrix.com/about |
- **Sources:**
  - https://www.signatrix.com/ (fetched)
  - https://www.signatrix.com/about (fetched via Exa, full content)
  - https://www.lebensmittelzeitung.net/tech-logistik/nachrichten/video-auswertung-mit-ki-itab-uebernimmt-startup-signatrix-184547 (fetched via Exa — ITAB acquisition, 30.05.2025)
  - https://ai.berlin/news/detail/philipp-mueller-ceo-and-founder-signatrix (fetched via Exa — "Berlin-based company Signatrix")
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Berlin, IT & Security)
  - https://revenuebase.ai/companies/retail-computer-vision-companies/germany (fetched — Signatrix, HQ Berlin)
  - https://www.eu-startups.com/69-top-computer-vision-startups-and-companies-in-germany (fetched)
- **Confidence:** High

---

### Nomitri GmbH (now GK Vision)  ([nomitri.com](https://www.nomitri.com/))
- **Berlin evidence:** Recruitee ATS states "**We are a Berlin-based deep-tech company founded in 2019**… Berlin team with a hybrid set up… **Office in the heart of Berlin Mitte**" and the footer gives **13355 Berlin**; phone +49 30 200-925-5 (Berlin number). Tracxn: "Founded Year 2019, Location Berlin, Germany, Stage Acquired… Exit: Acquired by GK Software (Jan 12, 2025)"; legal entity **Nomitri GmbH, HRB 209721, Germany, Active (incorporated 27 Aug 2019)**.
- **What they do (AI + retail):** Nomitri is a deep-tech **on-device / embedded Visual AI** company for retailers. It ships **edge & embedded visual-AI software** (network pruning + quantization) for **self-checkout / SCO**, intelligent **loss prevention & product identification** on top of bar-code scanning, **age verification**, and **fruit & vegetable (produce) recognition** at the till — all designed to avoid expensive ceiling-camera installations, cloud setup and connectivity problems. It also offers an **intelligent pick-and-pack app** with visual quality checks for warehouse picking and retrofitted smart carts for supermarkets.
- **Products:** Nomitri SCO (smartphone-based self-checkout, white-label or embedded in retailer apps); GK Vision (product suite after GK acquisition); pick-and-pack visual QC app; smart cart retrofit.
- **Size / stage:** ~15–16 employees (Tracxn: 15 as of 30 Sep 2026). Raised ~$5.0M total (pre-seed 2019 €/$831k, venture 2020 $1.4M, seed 2022 $2.8M; lead investor **FoodLabs**). **Acquired by GK Software SE, Jan 2025** — now a 100% subsidiary; founders Trinh Le-Fiedler (CEO) and Max Fiedler (CTO) stay in leadership; Moritz August PhD (Head of AI). Team page mentions **three PhDs on the team** with a deep-learning/CV publication record and avg. technical experience >8 years.
- **Founded:** 2019 (Berlin).
- **Why it matters for a CV/ML engineer:** Edge-CV / embedded-optimisation work (pruning, quantisation, on-device inference) is a great CV résumé differentiator, and the team is explicitly deep-learning/embedded-CVision heavy.
- **Open roles (Berlin):**
  | Role | URL |
  |---|---|
  | "Technical Support Engineer – Retail AI Systems (all genders)" — Berlin, hybrid, Nomitri/GK Software (edge + cloud CV ops in stores) | https://talents.studysmarter.de/companies/gk-software-se/technical-support-engineer-retail-ai-systems-all-genders-32929857/ |
  | Nomitri Recruitee board — "Currently we don't have any open positions" | https://nomitri.recruitee.com/ |
- **Sources:**
  - https://nomitri.recruitee.com/ (fetched — Berlin-based, Berlin Mitte office, 13355 Berlin, no open positions)
  - https://www.nomitri.com/ (fetched — "Since 2025, Nomitri has joined retail technology leader GK Software")
  - https://www.gk-software.com/de/newsroom/corporate-news/de-press-release-20250110-nomitri (fetched via Exa — German-language acquisition PR: "Schöneck, Berlin, Germany … Berliner Deep-Tech-Startup für Computer Vision", GK Vision product suite, embedded CV + AI, age verification, produce recognition)
  - https://tracxn.com/d/companies/nomitri/__BjAAFNfyM717wsYxoRnAGoR_g9uZpC0zlUwZrSiml5w (fetched via Exa — founding, HRB209721, acquisition date, FoodLabs)
  - https://exa.ai/library/organization/l9l41wcvqnh (fetched via Exa — HQ Berlin, employees, funding)
- **Confidence:** High

---

### GK Software SE  ([gk-software.com](https://www.gk-software.com/))
- **Berlin evidence:** German press release issued **"Schöneck, Berlin, Germany"** naming GK Software as the acquirer of Berlin CV company Nomitri (https://www.gk-software.com/de/newsroom/corporate-news/de-press-release-20250110-nomitri). Careers site has Berlin-located postings (e.g. "Location: Berlin, DE, 10117"). Corporate seat is Schöneck (a Berlin locality). HQ address on imprint: Schöneck, Berlin.
- **What they do (AI + retail):** GK Software is a global provider of **cloud-based retail software** (CLOUD4RETAIL) trusted by ~24% of the world's top-50 retailers. It now owns the **GK Vision** suite (from Nomitri) and ships a whole AI retail stack: **GK Vision** (edge/shop-floor computer vision, SCO fraud & loss prevention), **GK SPOT** (store/SKU insight), **GK AIR Price Optimizer**, **GK AIR Personalization**, **GK AIR Retail** (AI-driven retail co-pilot), plus OmniPOS/MobilePOS and Store Inventory Management.
- **Products:** CLOUD4RETAIL, GK OmniPOS, GK MobilePOS, GK OmniScale, GK Self-Scanning, GK Self-Checkout, **GK Vision**, GK SPOT, GK Drive, GK e-receipt, **GK AIR Price Optimizer**, **GK AIR Personalization**, **GK AIR Retail**, GK Engage.
- **Size / stage:** Large scale-up (market cap reported >€600M annual revenue alone with the top-250 food retailers). Public company (GK Software SE); also runs "GK Artificial Intelligence for Retail AG" and "GK Africa" / "GK Americas".
- **Founded:** GK Software founded 1982 (Schöneck).
- **Why it matters for a CV/ML engineer:** Owns the Berlin CV/IP centre of gravity (GK Vision), plus pricing-AI and store-analytics product lines — the broadest *Berlin-based retail-AI product surface* of any employer found in this research.
- **Open roles (Berlin):**
  | Role | URL |
  |---|---|
  | Technical Support Engineer – Retail AI Systems (all genders), Berlin, hybrid (via GK Software / Nomitri) | https://talents.studysmarter.de/companies/gk-software-se/technical-support-engineer-retail-ai-systems-all-genders-32929857/ |
  | Werkstudent Technical Presales (all genders), Berlin, DE 10117 | https://careers.gk-software.com/job/Berlin-Werkstudent-Technical-Presales-%28all-genders%29-10117/1371085855/ |
  | All GK Software open positions (SuccessFactors board) | https://careers.gk-software.com/viewalljobs/?locale=en_US |
- **Sources:**
  - https://www.gk-software.com/ (fetched — product menu incl. GK Vision, GK SPOT, GK AIR Price Optimizer)
  - https://www.gk-software.com/de/newsroom/corporate-news/de-press-release-20250110-nomitri (fetched via Exa — "Schöneck, Berlin, Germany")
  - https://careers.gk-software.com/job/Berlin-Werkstudent-Technical-Presales-%28all-genders%29-10117/1371085855/ (fetched via Exa — Berlin, DE, 10117, posted 9 Oct 2026)
  - https://careers.gk-software.com/viewalljobs/?locale=en_US (fetched)
  - https://www.linkedin.com/company/gk-software (fetched via websearch)
- **Confidence:** High

---

### Nyris GmbH  ([nyris.io](https://www.nyris.io/))
- **Berlin evidence:** Own site footer: "**nyris GmbH, AI Campus, Max-Urich-Str. 3, 13355 Berlin**, Tel. +49 (0)211 97 63 38 99". Careers page headline: "**nyris | Berlin | Düsseldorf | Careers**"; "A well-equipped workplace either in Düsseldorf or Berlin – or Home Office"; "Regular employee events between the Berlin and Düsseldorf offices."
- **What they do (AI + retail):** Nyris is a **European computer-vision / "visual intelligence" company** building **visual search** (neural image-to-product matching) for retail and industrial spare parts. Products: **Visual Search APIs** (developers can build a visual search engine in minutes), **Spare Parts Search Suite**, **Portal**, and a **synthetic-data** pipeline for training. Its object/image-recognition stack covers fingerprint/feature extraction, perceptual hashing, OCR, logo extraction and custom neural networks — i.e. exactly the shelf-photo → SKU-detection problem, sold as an API.
- **Products:** Visual Search APIs; Spare Parts Search Suite; Portal; synthetic-data generation for visual search; SAP Store listing of the neural search solution.
- **Size / stage:** Founded 2019 (Berlin). "One of the leading European AI startups in the field of computer vision." Partner ecosystem includes SAP, Google Cloud, CADENAS, Quanos, Kaptura, Maintastic.
- **Founded:** 2019.
- **Why it matters for a CV/ML engineer:** Rare Berlin employer where the core product *is* visual search / product recognition at scale, plus synthetic-data generation — a strong CV-research-friendly topic set.
- **Open roles (Berlin):** None currently published.
  | Role | URL |
  |---|---|
  | "No open positions at this time" | https://www.nyris.io/company/careers |
  | ATS board — "No open positions at the moment" | https://nyris.jobs.personio.de/?language=en |
- **Sources:**
  - https://www.nyris.io/ (fetched — address, products)
  - https://www.nyris.io/company/careers (fetched via Exa — full careers copy, Berlin + Düsseldorf, no open positions)
  - https://nyris.jobs.personio.de/?language=en (fetched via Exa)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Nyris, city Berlin, industry Wholesale & Retail Trade)
- **Confidence:** High

---

### Data Spree GmbH  ([data-spree.com](https://www.data-spree.com/de))
- **Berlin evidence:** Own website title/claim: "**Data Spree | Künstliche Intelligenz made in Berlin**"; job page states "We founded Data Spree in **2018**, and our **headquarters is in Berlin, Germany**." RevenueBase lists Data Spree GmbH with HQ Berlin.
- **What they do (AI + retail):** Data Spree sells a **no-code Computer-Vision / Deep-Learning platform** ("Vision AI Platform Deep Learning DS", "Inference DS") plus ready-made AI applications for **industrial automation, manufacturing, retail, surveillance, logistics and transportation**. Retail-relevant applications include **"Packungs- und Montageassistenten" (packing & mounting assistants), "KI-Assistenten für Fertigung und Logistik"** — i.e. AI vision for the retail/warehouse picking & packing flow — plus **Depalettierung** (palletising/de-palletising detection), surface inspection and traffic surveillance.
- **Products:** Deep Learning DS (training/annotation/inference platform); Inference DS; Packungs- und Montageassistenten; Depalettierung; Oberflächeninspektion; KI-Entwicklung & Datenmanagement.
- **Size / stage:** Small company founded 2018; ~10 people per RevenueBase. Private.
- **Founded:** 2018 (Berlin).
- **Why it matters for a CV/ML engineer:** A rare Berlin shop where you can do applied CV (object detection, segmentation, tracking, palletising) with a hands-on platform team, explicitly serving retail/logistics use cases — and they hire working students into the DL/CV team.
- **Open roles (Berlin):**
  | Role | URL |
  |---|---|
  | Working Student – Deep Learning and Computer Vision (all genders), Berlin (Python/PyTorch/OpenCV) | https://www.data-spree.com/jobs/working-student-deep-learning-and-computer-vision |
  | Careers overview | https://www.data-spree.com/careers |
- **Sources:**
  - https://www.data-spree.com/de (fetched — "made in Berlin", product list, KI für die Logistik)
  - https://www.data-spree.com/jobs/working-student-deep-learning-and-computer-vision (fetched — HQ Berlin since 2018; Python, PyTorch, OpenCV, Deep Learning DS)
  - https://www.data-spree.com/careers (fetched)
  - https://revenuebase.ai/companies/retail-computer-vision-companies/germany (fetched — Data Spree GmbH, HQ Berlin, "Since 2018 we provide leading software technology to unleash the full potential of AI in the world of computer vision")
- **Confidence:** High

---

## Section 2 — TIER B: Retail forecasting, pricing, assortment, replenishment & supply-chain AI

---

### Freshflow GmbH  ([freshflow.ai](https://freshflow.ai/))
- **Berlin evidence:** Team page: "Founded in 2021 … **Berlin & Paris**. Forty-five people." Careers page lists roles with **Berlin** locations ("Berlin · Hybrid, in office"), Berlin internships and "Working student · 16–20 hrs/week" in Berlin. Caplight: "Berlin, Enterprise Software". appliedAI German AI Startup Landscape 2025: city Berlin, industries "Wholesale & Retail Trade / SCM & Distribution". Startup-Germany Startup-Atlas profile: Freshflow GmbH, Berlin.
- **What they do (AI + retail):** Freshflow is "**Europe's first AI replenishment system, built specifically for the fresh department**". It provides **order forecasting, replenishment and inventory control** for grocery fresh departments, using distributional forecasting and inventory simulation to cut food waste (~25%) while keeping shelves full. Customers include EDEKA, REWE, Carrefour, Intermarché, E.Leclerc (DE + FR); "93% of our order proposals are accepted by store staff"; revenue growing 400% YoY. Collaboration with the German Research Center for AI (DFKI). Product components: **Freshflow Simulator** (build-vs-buy simulation of the fresh-aisle decision problem), plus the AI replenishment engine.
- **Products:** Freshflow AI replenishment; Freshflow Simulator; order-forecasting + inventory-control modules; "Demand & order proposal" engine.
- **Size / stage:** ~45–55 employees (+57% YoY per Exa/LinkedIn data). **$10M Series A closed June 2026**; total ~$19M (seed 2022 $1.8M; venture 2025 €6.5M; seed Jun-2025 $7.3M). Investors: **IBB Ventures (lead Series A), Catatumbo Capital Partners, Caesar Ventures, Reimann Investors, Venture Stars, Capnamic Ventures, Entrepreneurs First**; advisor/board: Axel Dieter Hartenstein (CEO), Olaf Jacobi (Chairman).
- **Founded:** 2021 (Berlin; spun out of the ETH Zurich AI Lab).
- **Why it matters for a CV/ML engineer:** Berlin's most on-target **ML-forecasting** employer in retail — a "small, senior Data Science team building distributional forecasting and inventory simulation for the hardest forecasting problem in retail", i.e. real production forecasting + simulation, with a genuine Berlin office and named DS leadership (Monika Möddel, Head of Data Science; Florian Loretan, CTO).
- **Open roles (Berlin):**
  | Role | URL |
  |---|---|
  | **Senior Data Scientist (m/f/d)** — Berlin · Hybrid, in office | https://freshflow.ai/role/senior-data-scientist/ |
  | Founders Associate (m/f/d) — Berlin, full-time | https://freshflow.ai/role/founders-associate/ |
  | Internship Entrepreneur in Residence — Berlin, 6-month internship | https://freshflow.ai/role/entrepreneur-in-residence/ |
  | Business Development Intern — Berlin, 6 months | https://freshflow.ai/role/business-development-intern/ |
  | Working Student – Sales & Outreach (m/w/d) — Berlin or Remote, 16–20 h/week | https://freshflow.ai/role/working-student-sales-outreach/ |
  | Sales Development Representative (m/f/d) — Germany | https://freshflow.ai/role/sales-development-representative/ |
  | Account Executive (m/f/d) — Germany, Remote | https://freshflow.ai/role/account-executive/ |
  | Team page (shows live roles: Senior Data Engineer, Lead Product Manager, Backend Engineer, Solutions Architect, Lead Supply Chain Scientist, Senior Flutter Engineer, …) | https://freshflow.ai/team |
- **Sources:**
  - https://freshflow.ai/careers/ (fetched — full role list + locations)
  - https://freshflow.ai/team (fetched — Berlin & Paris, founded 2021 ETH Zurich AI Lab, role roster)
  - https://freshflow.ai/role/senior-data-scientist/ (fetched via Exa — "Type Full-time, Location Berlin · Hybrid, in office, Team Data Science"; $10M Series A)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Berlin, Wholesale & Retail Trade / SCM & Distribution)
  - https://www.caplight.com/company/freshflow (fetched via Exa — Berlin; $19.26M total; investors; employee growth 26% QoQ to 54)
  - https://www.startup-atlas.de/company/freshflow (fetched via Exa — Startup-Germany network profile, Freshflow GmbH Berlin)
  - https://exa.ai/library/organization/9msd3zt67fr (fetched via Exa — HQ Berlin, 55 employees, funding rounds, key executives)
- **Confidence:** High

---

### 7Learnings GmbH  ([7learnings.com](https://7learnings.com/))
- **Berlin evidence:** Careers page: "**Prime Berlin office** — Work from our centrally located Berlin office"; footer gives "**German office: Charlottenstraße 4, 12th Floor, 10969 Berlin**", VAT DE323363789. appliedAI: city Berlin, industry Wholesale & Retail Trade / Marketing. VCNews Berlin startup list: "7Learnings ist ein 2019 in Berlin gegründetes SaaS-Unternehmen für KI-gestützte Retail-Optimierung … Series B".
- **What they do (AI + retail):** 7Learnings is an **outcome-based Retail AI** company that automates **pricing, performance-marketing and ordering decisions**. Its **Advanced Predictive Engine** forecasts demand, revenue and profit per SKU at different price points; a **Target-Based Optimization** layer then emits per-product price / marketing / reorder decisions against the retailer's own profit & revenue targets. Claims: +15% profit, ~80% less manual work, 20× faster optimisation; deployment in 3–4 months. Customers include Mister Spex, meinemarkenmode, Wortmann Fashion Retail, Westwing, INTERSPORT Krumholz.
- **Products:** Price Optimization (incl. Dynamic Pricing, Competitive Pricing, Markdown & Clearance Optimization); Performance Marketing Optimization (ROAS); **Order Optimization** (AI reorder suggestions to cut markdowns and improve availability); Promotion Planning & Forecasting.
- **Size / stage:** ~63 employees (+31% YoY), 51–200 band. **Series B $11.3M (Jun 2025)**; total ~$15.5M (seed 2020/2022, non-equity 2019). Team leads: Felix Hoffmann (CEO), Eiko van Hettinga (co-founder/MD), Eva Bertalan (Head of Data Science), Henry Boeddeker (Head of Product – Data Science), 5× Lead Data Scientists, Martin (data science & engineering, ex-Mobisol Data Science Lead, ex-Ableton).
- **Founded:** 2019 (Berlin).
- **Why it matters for a CV/ML engineer:** Berlin's best-known **pricing-optimisation / retail-economics ML** employer; the ML is the whole product (self-learning models retrained continuously), so a CV/ML engineer's work *is* the product.
- **Open roles (Berlin):**
  | Role | URL |
  |---|---|
  | **Junior Product Manager** — Berlin, full-time (office in Berlin-Mitte, hybrid up to 3 days home office) | https://7learnings.jobs.personio.de/job/2431654 |
  | Fractional CMO B2B SaaS – 2 d/week (m/f/d) — Berlin, part-time, fixed-term | https://7learnings.jobs.personio.de/job/2799309 |
  | (Data Scientist roles exist but are **Remote Sydney / Malaysia / Mexico** — NOT Berlin) | https://7learnings.jobs.personio.de/job/2793420 · https://7learnings.jobs.personio.de/job/2675894 · https://7learnings.jobs.personio.de/job/2819017 |
  | All open positions | https://7learnings.jobs.personio.de/?language=en |
- **Sources:**
  - https://7learnings.jobs.personio.de/?language=en (fetched — role list + Berlin labels)
  - https://7learnings.jobs.personio.de/job/2431654 (fetched — Junior Product Manager, Berlin, full-time)
  - https://7learnings.jobs.personio.de/job/2799309 (fetched — Fractional CMO, Berlin, part-time)
  - https://7learnings.jobs.personio.de/job/2793420 · /job/2675894 · /job/2819017 (fetched — DS roles, remote AU/MY/MX)
  - https://www.7learnings.com/careers/ (fetched — Berlin office, Charlottenstraße 4, Berlin)
  - https://7learnings.com/de/ (fetched via Exa — German product page, price/marketing/order optimisation)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Berlin)
  - https://vcgermany.de/startup-liste/stadt/berlin (fetched — 7Learnings, Berlin, Series B, founded 2019)
  - https://exa.ai/library/organization/2cm5dqrt75p (fetched via Exa — 63 employees, Series B $11.3M Jun 2025, DS org)
- **Confidence:** High

---

### Fabrikatör  ([fabrikator.io](https://www.fabrikator.io/))
- **Berlin evidence:** Careers page states "**Fabrikatör is a Berlin-based supply chain technologies company backed by Axel Springer & Porsche** along with esteemed angel investors…". Imprint: "**Berlin, Germany** … Registry court: **Amtsgericht Charlottenburg**, Registry number: **HRB 219…**". VCNews Berlin list: "Fabrikatör entwickelt Bestands- und Bedarfsplanung für Shopify-Händler und wachsende E-Commerce-Marken."
- **What they do (AI + retail):** Fabrikatör builds **inventory & demand-planning software for Shopify/e-commerce brands** — "the #1 Inventory Management Software for Shopify", named a top demand-forecasting solution by Shopify's blog. It combines supply-chain practice, data science and AI to do **demand forecasting, replenishment, purchase orders, safety stock, backorders and freight planning**, explicitly to prevent stockouts and overstock. Target industries: fashion, apparel, footwear, home decor, furniture, consumer brands, beauty/skincare, electronics.
- **Products:** Forecasting; Replenishment & Purchase Orders; Analytics; Backorders; Freight Planner; Fabrikatör MCP (agent integration); Shopify/Shopify Plus/Amazon/Klaviyo integrations.
- **Size / stage:** Small scale-up, **Berlin-based**, backed by **Axel Springer & Porsche** plus angels. Bootstrapped/funded but stage not publicly quantified beyond that.
- **Founded:** Not stated on the pages fetched (registered in Berlin; VCNews list places it among Berlin startups). **Confidence in founding year: Low.**
- **Why it matters for a CV/ML engineer:** Demand-forecasting ML in production for hundreds of brands, at a small Berlin company where a senior data engineer owns a real part of the forecasting stack.
- **Open roles (Berlin):**
  | Role | URL |
  |---|---|
  | **Sr. Data Engineer** — Remote & Berlin, full-time | https://www.fabrikator.io/hiring/sr-data-engineer |
  | Full Stack Software Engineer — Remote & Berlin, full-time | https://www.fabrikator.io/hiring/full-stack-software-engineer |
  | Software Support Engineer — Remote & Berlin, full-time | https://www.fabrikator.io/hiring/software-support-engineer |
  | Working Student (multiple positions) — Berlin & Remote | https://www.fabrikator.io/hiring/working-student-multiple-positions |
- **Sources:**
  - https://www.fabrikator.io/hiring (fetched — "Berlin-based", full role list with locations)
  - https://www.fabrikator.io/imprint (fetched — Berlin, Amtsgericht Charlottenburg, HRB 219…)
  - https://www.fabrikator.io/ (fetched via Exa — Shopify demand-forecasting product)
  - https://vcgermany.de/startup-liste/stadt/berlin (fetched — Fabrikatör description, Berlin)
- **Confidence:** High (Berlin + roles); Low on founding year

---

### ARAMA  ([getarama.com](https://getarama.com/))
- **Berlin evidence:** LinkedIn company page (via Exa): "**Headquarters: berlin, germany (DE)**; Offices: berlin, germany (DE)"; employee count 7; founded 2025.
- **What they do (AI + retail):** ARAMA is a **pricing-decision partner for indie fashion and lifestyle retailers** — SKU-level **pricing intelligence** with built-in **A/B testing**, claiming +3–7 percentage points of margin lift. It positions itself as turning messy market/trend data into AI-driven, actionable decisions for SMEs (predictive analytics, demand anticipation).
- **Products:** SKU-level pricing intelligence; built-in price A/B testing; margin analytics.
- **Size / stage:** ~7 people (1–10 band), founded 2025, early/pre-seed stage; ~78 LinkedIn followers. No public funding round found.
- **Founded:** 2025 (Berlin).
- **Why it matters for a CV/ML engineer:** Very early-stage Berlin pricing-AI — for a research-minded engineer this is a chance to own the whole modelling stack, but expect a founder-stage environment.
- **Open roles (Berlin):** None published (no careers page found).
  | Role | URL |
  |---|---|
  | — (no public roles) | https://getarama.com/ |
- **Sources:**
  - https://exa.ai/library/organization/t7tss13403m (fetched via Exa — HQ Berlin, 7 employees, founded 2025, product description, LinkedIn URL https://linkedin.com/company/arama-technology)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Berlin list)
- **Confidence:** Medium (Berlin location from LinkedIn/Exa index; site itself is JS-only and the TLS cert failed on direct fetch)

---

### Logistica OS GmbH  ([logistica-os.com](https://www.logistica-os.com/))
- **Berlin evidence:** ⚠️ **Mixed.** Imprint: "Logistica OS GmbH, Rheindorfer Straße 41, 53225 **Bonn**, Germany … Registered at: **Amtsgericht Berlin (Charlottenburg)**, Commercial Register Number: **HRB 275401 B**". Exa company index and the appliedAI landscape both list HQ as **Berlin**. So: *registered in Berlin, operating address in Bonn* — treat Berlin presence as **partial** (legal seat Berlin / engineering hub asserted by indexers, office Bonn).
- **What they do (AI + retail):** Logistica OS builds an **"AI Operating System for logistics teams"** — an agentic back-office for logistics: **pallet accounting, document processing, rate management** and returns, automating the reconciliation of pallet accounts and paperwork. It is the retail/food-supply-chain back-office (document AI + agents), not a shop-floor product.
- **Products:** Pallet Accounting; Document Processing; Rate Management; AI agents for logistics back-office.
- **Size / stage:** ~16 employees (+1500% YoY). **Pre-seed $1.7M (Nov 2025)**. Founders: Flavio Alario (CEO), Florian Lehmann (CPO). Team alumni from sennder, Choco. Reference customer: Sahne Kähler Industries (food-wholesaler logistics).
- **Founded:** ~2025.
- **Why it matters for a CV/ML engineer:** Document-extraction + agentic-AI work on real logistics operations — a good ML/LLM-heavy engineering role, but verify the Berlin vs Bonn work location before applying.
- **Open roles (Berlin):**
  | Role | URL |
  |---|---|
  | Founding Engineer (self-implementing agentic flows) — **archived, no longer available** | https://join.com/companies/logistica-oscom/16647141-founding-engineer |
  | Account Executive (DACH) — Remote (Germany) | https://join.com/companies/logistica-oscom |
  | Founders Associate Intern — Munich (not Berlin) | https://join.com/companies/logistica-oscom |
  | All open positions | https://join.com/companies/logistica-oscom |
- **Sources:**
  - https://www.logistica-os.com/imprint (fetched — Bonn address, Amtsgericht Berlin HRB 275401 B)
  - https://www.logistica-os.com/ (fetched — product, team, 14-day go-live testimonial)
  - https://join.com/companies/logistica-oscom/16647141-founding-engineer (fetched via Exa — archived Founding Engineer ad)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Berlin, SCM & Distribution)
  - https://vcgermany.de/startup-liste/stadt/berlin (fetched — Logistica OS, Berlin, pre-seed)
- **Confidence:** Medium (company & Berlin registration High; actual Berlin engineering office unverified)

---

### wooms WMS GmbH  ([wooms.io](https://www.wooms.io/))
- **Berlin evidence:** openPR press release (18.10.2025): "**Berlin, 2. Oktober 2025 – Die Digitalisierung der Lagerlogistik … Am 1. Oktober 2025 wurde in Berlin die wooms WMS GmbH gegründet** … eingetragen beim **Amtsgericht Charlottenburg (HRB 279769)** … Der offizielle Firmensitz der wooms WMS GmbH befindet sich in **Berlin, Goerzallee 311**."
- **What they do (AI + retail):** wooms is a **"KI-first WMS"** — a cloud **warehouse-management system for fast-growing online retailers and fulfilment service providers**. It digitises goods-in, picking, shipping and returns, and uses AI for **optimal pick-path calculation (Dijkstra on warehouse graphs)** to cut walking distance. Integrations: Shopify, Billbee (multi-channel order management).
- **Products:** wooms WMS (KI-first warehouse management); pick-path optimisation; returns management; live KPI dashboard; multi-tenant.
- **Size / stage:** Newly founded (Oct 2025) micro-company; CEO **Ansgar Sohn** (long-time logistics/software entrepreneur, in e-commerce warehousing since 2017). Self-funded/bootstrapped; no public round found.
- **Founded:** 1 October 2025 (Berlin).
- **Why it matters for a CV/ML engineer:** Early-stage Berlin warehouse-logistics software for e-commerce retailers — the retail-warehouse overlap; good if you want to build an ops-tech product from zero.
- **Open roles (Berlin):** None published (site is a product app, no careers board found).
  | Role | URL |
  |---|---|
  | — (no public roles) | https://www.wooms.io/ |
- **Sources:**
  - https://www.openpr.de/news/1294329/wooms-WMS-GmbH-das-Tech-Stack-fuer-E-Commerce-Logistik-und-KI-gestuetztes-Warehouse-Management.html (fetched via Exa — Berlin foundation, Amtsgericht Charlottenburg HRB 279769, Goerzallee 311, Dijkstra pick-path, Shopify/Billbee)
  - https://www.wooms.io/ (fetched — product app shell)
- **Confidence:** Medium-High (company registry evidence strong; product site thin)

---

### Plato (DM Technologies GmbH)  ([getplato.co](https://www.getplato.co/) · [platoapp.ai](https://platoapp.ai/))
- **Berlin evidence:** Privacy policy (platoapp.ai): "The Plato website … and the Plato Services are offered and operated by **DM Technologies GmbH, with its registered office at Monbijouplatz 4, 10178 Berlin, Germany**, registered with the commercial register of the **Charlottenburg Local Court (Berlin) under HRB 252844 B**." Personio ATS shows every vacancy tagged **Berlin**. appliedAI landscape: Berlin, Wholesale & Retail Trade / Sales.
- **What they do (AI + retail):** Plato is "**the AI sales platform for distribution**" — it sits on top of a wholesaler's **ERP** and turns it into a **data-driven field-sales workbench**: AI-driven week planning and visit logging for outside sales, live product lookup and **on-site quoting/pricing** at the counter, real-time visit capture and quote tracking, and performance steering. Industries served: technical wholesale (HVAC & sanitary, electrical, automotive parts). This is B2B retail distribution with a genuine AI/analytics layer.
- **Products:** Plato AI sales platform — Plan & prepare / Sell & execute / Track & steer; ERP integration; on-site quoting; visit capture.
- **Size / stage:** Early scale-up; 11–50 band; Berlin HQ. Named "Customer Experience" team structure plus a "Founding GTM Engineer" hire.
- **Founded:** ~2023 (not explicitly stated on fetched pages — **Low confidence**).
- **Why it matters for a CV/ML engineer:** The AI here is applied ML on ERP + behavioural sales data in B2B retail distribution; the Founding GTM Engineer role is a classic Berlin founding-ML hybrid.
- **Open roles (Berlin):**
  | Role | URL |
  |---|---|
  | **Founding GTM Engineer** — Berlin | https://platoapp.jobs.personio.com/job/2758311 |
  | Business Development Representative – German speaking — Berlin | https://platoapp.jobs.personio.com/job/2706944 |
  | Business Development Representative Intern — Berlin | https://platoapp.jobs.personio.com/job/2827731 |
  | Customer Experience Lead — Berlin | https://platoapp.jobs.personio.com/job/2827732 |
  | Customer Experience Manager — Berlin | https://platoapp.jobs.personio.com/job/2620770 |
  | Account Executive – German Speaking — Berlin | https://platoapp.jobs.personio.com/job/2720101 |
  | Sales Lead — Berlin | https://platoapp.jobs.personio.com/job/2827719 |
  | Marketing & Content Intern (DE/EN) – 6 months — Berlin | https://platoapp.jobs.personio.com/job/2845138 |
  | Customer Experience Intern — Berlin | https://platoapp.jobs.personio.com/job/2620769 |
- **Sources:**
  - https://www.platoapp.ai/en/privacy (fetched via Exa — DM Technologies GmbH, Monbijouplatz 4, 10178 Berlin, HRB 252844 B)
  - https://platoapp.jobs.personio.com/?language=en (fetched — 9 positions, all Berlin)
  - https://platoapp.jobs.personio.com/job/2758311 · /2706944 · /2827731 · /2827732 · /2620770 · /2720101 · /2827719 · /2845138 · /2620769 (fetched — titles + Berlin locations)
  - https://www.getplato.co/ (fetched — product + "Open positions" → links to https://platoapp.jobs.personio.com/ and https://platoapp.ai/en/careers)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Plato, Berlin, Wholesale & Retail Trade / Sales)
- **Confidence:** High

---

### Frontnow GmbH  ([frontnow.com](https://www.frontnow.com/))
- **Berlin evidence:** Imprint: "**Frontnow GmbH**, … Commercial Register: **HRB 225341 B**, Register Court: **Berlin Local Court (Charlottenburg)**, Represented by Marc Funk, Bernhard Lihotzky, +49 … Berlin". Careers page: "**30+ team members. 9 different nationalities. Headquartered in Berlin.**" Patentpool (Berlin) describes Frontnow as an ML-based SaaS for retail product listing/assortment. appliedAI: Berlin, Wholesale & Retail Trade.
- **What they do (AI + retail):** Frontnow is a **Berlin Gen-AI platform for e-commerce retail**: it ingests manufacturer/supplier product data and turns it into **hyper-personalised, adaptive shopping experiences** — "Make every product count", "Turn intent into action" — for retailers (incl. organic food and D2C brands). The Patentpool project description states explicitly: "**Auf maschinellem Lernen basierende Daten verarbeitende Systeme und Technologien liefern Handlungsempfehlungen und Zukunftsvorhersagen für beide Seiten, Händler und Produzenten**" — i.e. ML-based recommendation and forecasting for retailers *and* producers, focused on getting the right products onto supermarket/drugstore shelves.
- **Products:** GenAI product-discovery & recommendation layer for e-commerce; "Make every product count"; intent-based search; merchandising/recommendation tooling (product + AI teams: VP of AI, VP Engineering, VP Products).
- **Size / stage:** ~18–30+ employees; total funding ~$7.1M (pre-seed 2020/2022, seeds 2021–2024, incl. $4.2M seed Mar 2024). Team: Bernhard Lihotzky (founder/MD), Marc Funk (founder/CRO), Gabriel Bobinski (CEO), Muhammad Hasnain Khan (VP of Artificial Intelligence), Evgeny Schibrikov (VP Engineering). Alumni from parcelLab.
- **Founded:** 2020 (Berlin).
- **Why it matters for a CV/ML engineer:** Retail-facing **assortment/merchandising AI** (product data → shelf → recommendation) with a dedicated VP of AI and Berlin HQ — directly in the "assortment optimisation with an AI component" box.
- **Open roles (Berlin):** The careers page exists and states Berlin HQ, but individual vacancies are not exposed as static URLs (JS-rendered); no per-role list could be captured.
  | Role | URL |
  |---|---|
  | Careers page (Berlin; roles listed dynamically) | https://www.frontnow.com/careers |
  | German version | https://www.frontnow.com/de/careers |
- **Sources:**
  - https://www.frontnow.com/imprint (fetched — HRB 225341 B, Berlin Charlottenburg)
  - https://www.frontnow.com/careers (fetched — "Headquartered in Berlin", 30+ team members)
  - https://www.frontnow.com/ (fetched — product positioning)
  - https://patentpool.de/project/frontnow/ (fetched via Exa — German description of ML-based recommendation/forecasting for retailers & producers)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Berlin, Wholesale & Retail Trade)
  - https://exa.ai/library/organization/pnz13lhfrwt (fetched via Exa — 18 employees, $7.09M funding, exec roster)
- **Confidence:** High (company/Berlin); Medium on open roles (dynamic page)

---

### Claro (Happy Data GmbH)  ([getclaro.ai](https://getclaro.ai/))
- **Berlin evidence:** Site footer "© 2026 **Happy Data GmbH**" + "**Berlin, Germany**"; company page states "**We're hiring in Berlin**" with the role tagged "**Berlin · Full-time**". appliedAI landscape lists Claro with city Berlin, industry Wholesale & Retail Trade.
- **What they do (AI + retail):** Claro is "**the operating system for product and supplier data**" — it ingests supplier feeds and PDFs, **decodes, classifies, matches and enriches product records** with ML (retrieval + matching models, confidence scores, human-in-the-loop), and writes trusted records back into ERP/PIM systems. For retail this is **catalogue/product-data infrastructure for brands, distributors and marketplaces** — the data layer behind assortment, availability and product findability. Positioning: "any model can write; knowing your rules is the work".
- **Products:** Claro product-data OS: Supplier onboarding, Product matching & identity, Classification (ETIM, eCl@ss, custom taxonomy), Deduplication, Enrichment/validation, confidence-scored write-back.
- **Size / stage:** Early stage, Berlin; leadership Matteo Fava (CEO & Co-founder) plus founders/small team (Tameesh, Emin, Prince, Nitin). Funding not publicly quantified in fetched sources.
- **Founded:** ~2023–2024 (inferred; **Low confidence**).
- **Why it matters for a CV/ML engineer:** Rare Berlin role explicitly titled "Machine Learning Engineer" on a retail product-data system — matching/retrieval/eval-heavy ML, close to the shelf-recognition problem's sibling task (product identity from messy inputs).
- **Open roles (Berlin):**
  | Role | URL |
  |---|---|
  | **Founding Machine Learning Engineer — Model Systems & Evals** — Berlin · Full-time | https://getclaro.ai/company |
  | (team page also names Principal Data Scientist, Sr Full-Stack Developer, AI Engineer) | https://getclaro.ai/company |
- **Sources:**
  - https://getclaro.ai/company (fetched — Berlin hiring, Founding MLE role, team, CEO)
  - https://getclaro.ai/ (fetched — product/solutions description)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Claro, Berlin, Wholesale & Retail Trade)
- **Confidence:** High (Berlin + role); Medium on founding year/funding

---

### refive GmbH  ([refive.io](https://www.refive.io/))
- **Berlin evidence:** About page: "We have an international and hybrid team, **half of which is based in Berlin**"; site footer "Made with **in Berlin**"; older job ad (join.com) mentions a "cool office space in **Mitte**". ATS: join.com/companies/refive.
- **What they do (AI + retail):** refive builds the **"engagement layer for physical retail"** — **digital receipts, QR/NFC in-store touchpoints, a Store Assistant and a Product Assistant**, post-purchase journeys, **loyalty/feedback/reviews**, **store analytics**, marketing campaigns and automations, and **Retail Media**. The mission: "help retailers increase retention by enabling them to understand and engage their in-store customers in a personalised way" using **first-party data + AI** to identify otherwise-anonymous in-store shoppers. Customers include Puma, EuroShop, Orlen.
- **Products:** Digital receipts; Store Assistant; Product Assistant; QR-Code management; Offers; Loyalty; Feedback/Reviews; Marketing campaigns & automations; **Store Analytics**; Retail Media; Enterprise Data Capture / Customer Insights.
- **Size / stage:** Small international/hybrid team (part Berlin, part worldwide). Early stage; no disclosed round.
- **Founded:** ~2020 (company formerly "Leaf Labs" — Berlin Mitte origin, join.com legacy shows 2021 postings).
- **Why it matters for a CV/ML engineer:** Brick-and-mortar customer identification + personalisation is the "shopper behaviour analytics" box; Berlin-based, ML-forward positioning.
- **Open roles (Berlin):**
  | Role | URL |
  |---|---|
  | AI-First Marketing Lead (m/w/d) — **Remote (India)**, not Berlin | https://join.com/companies/refive/16792174-ai-first-marketing-lead-m-w-d-remote |
  | (Junior Full Stack Engineer — Berlin, archived 2 years ago) | https://join.com/companies/refive/2792926-junior-full-stack-engineer |
  | All open positions (currently only the remote marketing role) | https://join.com/companies/refive |
- **Sources:**
  - https://www.refive.io/en/about-us/ (fetched via Exa — Berlin-based half of team, founders Mitul Jain & Cristian Martin)
  - https://www.refive.io/ (fetched — products, "Made with in Berlin")
  - https://join.com/companies/refive/16792174-ai-first-marketing-lead-m-w-d-remote (fetched via Exa — "distributed across three continents, with a base in Berlin")
  - https://join.com/companies/refive/2792926-junior-full-stack-engineer (fetched via Exa — Berlin Mitte, Python/Django/React stack)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — refive, Berlin, Wholesale & Retail Trade / Marketing)
- **Confidence:** High (Berlin); current Berlin tech roles: none open

---

## Section 3 — TIER C: Adjacent Berlin AI vendors whose product touches retail (merchandising, in-store CV, commerce AI)

These are Berlin-verified and genuinely AI/ML, and they serve retail/e-commerce, but their product is not shelf/stop-level monitoring or retail forecasting.

---

### Konvo GmbH  ([konvoai.com](https://www.konvoai.com/))
- **Berlin evidence:** Imprint: "**Konvo GmbH, Brunnenstr. 9a, 10119 Berlin**, Represented by Guillem Oliva de Fuenmayor, Scott Kapelewski … Register court: Local court **Berlin (Charlottenburg)**, Register number: **HRB 257880 B**". appliedAI: Berlin, Cross Industry / Marketing ("Conversational commerce platform for WhatsApp-based marketing and sales").
- **What they do (AI + retail):** Konvo is "**The AI Customer Platform for eCommerce**" — autonomous customer-service and **sales agents** for online shops that handle pre-sale product advice, order status, complex cases via connected systems, and drive conversion. Founded 2024.
- **Products:** Konvo AI Agents; WhatsApp link generator; AI Platform (support, marketing, sales automation).
- **Size / stage:** ~$5.06M raised (seed Sep 2025; investors incl. **Samaipata, JME Venture Capital**); 11–50 band; ~78 (Tracxn) — VCNews Berlin list: Series A stage, "Conversational commerce platform for WhatsApp-based marketing and sales."
- **Founded:** 2024 (Berlin).
- **Why it matters for a CV/ML engineer:** LLM-agent engineering for retail commerce; Berlin HQ; good for LLM/agent-profile CVs rather than classic CV.
- **Open roles (Berlin):**
  | Role | URL |
  |---|---|
  | ATS — "No available jobs" | https://join.com/companies/hoola |
  | Careers page | https://konvoai.com/careers |
- **Sources:**
  - https://www.konvoai.com/imprint (fetched — Brunnenstr. 9a, 10119 Berlin, HRB 257880 B)
  - https://www.konvoai.com/ (fetched — product)
  - https://join.com/companies/hoola (fetched via Exa — 11–50 employees, no open jobs)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Berlin)
  - https://vcgermany.de/startup-liste/stadt/berlin (fetched — Berlin, Series A)
- **Confidence:** High

---

### Kickbite GmbH  ([kickbite.io](https://www.kickbite.io/))
- **Berlin evidence:** Imprint: "**Kickbite GmbH, Kolonnenstr. 8, 10827 Berlin**, Deutschland, Tel. +49(0)30 – 2201 38 80, VAT DE345491091"; Managing Directors Juan Camilo Garzon Beltran, Vince Wagenknecht. Company story on About Us opens "In 2015, **Kreuzberg – Berlin**…". appliedAI: Berlin, Wholesale & Retail Trade / Marketing.
- **What they do (AI + retail):** Kickbite is a **server-side tracking & attribution / marketing-analytics platform for e-commerce**, positioned as "Enterprise-Grade AI" for retail: it collects, analyses and visualises e-commerce data in one place, provides **AI-powered click & view attribution**, consent-aware data collection, and actionable channel/campaign insights for online retailers to scale sales and ROAS.
- **Products:** Tracking & attribution for eCommerce; AI click & view attribution; analytics/dashboard; 90-day tracking test; media-cost dashboard.
- **Size / stage:** Small company; grew from 2 people (2021) to **11 developers, data scientists and product designers in 2026**, with hiring largely in **Ukraine** (Berlin is the registered HQ/management base).
- **Founded:** 2015 (Kreuzberg, Berlin).
- **Why it matters for a CV/ML engineer:** Retail/e-commerce **analytics ML** in a Berlin-registered small team — note the engineering team is mostly remote Ukraine, so verify on-site expectations.
- **Open roles (Berlin):** The About Us page lists open positions by title (Data Scientist, Frontend Engineer, Data Engineer ×3, Data Analyst, QA Engineer) but they are rendered without per-role URLs and are **Ukraine/remote** postings, not Berlin-based.
  | Role | URL |
  |---|---|
  | Open positions list (titles only; locations Ukraine/remote) | https://www.kickbite.io/about-us |
  | (example of an external ad — "Data Analyst", full remote, no longer active) | https://djinni.co/jobs/798971-data-analyst/ |
- **Sources:**
  - https://www.kickbite.io/imprint (fetched — Kolonnenstr. 8, 10827 Berlin, VAT, managing directors)
  - https://www.kickbite.io/about-us (fetched — Kreuzberg-Berlin origin, team size 11 in 2026, role titles)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Berlin, Wholesale & Retail Trade / Marketing)
- **Confidence:** High (Berlin legal entity); Low on Berlin-based open roles

---

### SAIZ  ([saiz.io](https://www.saiz.io/))
- **Berlin evidence:** Job board (Coda): "SAIZ … **headquartered in the heart of Berlin**"; "Work closely with the **Berlin product and engineering team**"; roles listed with "Berlin, Germany". appliedAI: Berlin, Wholesale & Retail Trade / Sales. VCNews Berlin list: "SAIZ ist ein Berliner KI-Größenberater für Fashion-Shops."
- **What they do (AI + retail):** SAIZ is an **AI sizing/fit intelligence platform for apparel brands** — a "Product-Customer Intelligence System" that connects per-SKU garment measurement data with customer sizing data to produce individual size recommendations, cut returns (up to 40%) and lift conversion. Live with enterprise clients incl. **s.Oliver, CBR, Hugo Boss, adidas, Zalando**.
- **Products:** Per-SKU sizing intelligence; Product-Customer Data Platform; fit/size recommendation API (Dot by SAIZ).
- **Size / stage:** Pre-Series A, profitable on unit economics. **€2.5M seed** (per Apparel Resources / Tech EU coverage surfaced via the job board). Founded 2022 (inferred).
- **Founded:** ~2022 (Berlin).
- **Why it matters for a CV/ML engineer:** Berlin-based fashion-retail ML with **data scientists, data engineers and full-stack engineers** in one tight team — the job board explicitly says "data scientists experimenting with the latest ML, engineers pushing infrastructure forward".
- **Open roles (Berlin):**
  | Role | URL |
  |---|---|
  | **Data Scientist (f/m/x)** — Berlin, Germany | https://coda.io/@saizclientinfo/saiz-job-vaccancies/saiz-job-board-1 |
  | **Data Engineer (f/m/x)** — Berlin, Germany | https://coda.io/@saizclientinfo/saiz-job-vaccancies/saiz-job-board-1 |
  | **Full Stack Developer (f/m/x)** — Berlin, Germany (or remote) | https://coda.io/@saizclientinfo/saiz-job-vaccancies/saiz-job-board-1 |
  | Front-end Developer (f/m/x) — Berlin, Germany (or remote) | https://coda.io/@saizclientinfo/saiz-job-vaccancies/saiz-job-board-1 |
  | Founding GTM Engineer — Berlin | https://coda.io/@saizclientinfo/saiz-job-vaccancies/saiz-job-board-1 |
  | Founder's Associate (f/m/x) — Berlin, Germany (or remote) | https://coda.io/@saizclientinfo/saiz-job-vaccancies/saiz-job-board-1 |
  | Product Marketing Manager (f/m/x) — Berlin, Germany (or remote) | https://coda.io/@saizclientinfo/saiz-job-vaccancies/saiz-job-board-1 |
  | Product Marketing Intern / Working Student — Berlin or remote | https://coda.io/@saizclientinfo/saiz-job-vaccancies/saiz-job-board-1 |
  | Managing Director, North America — US (not Berlin) | https://coda.io/@saizclientinfo/saiz-job-vaccancies/saiz-job-board-1 |
- **Sources:**
  - https://coda.io/@saizclientinfo/saiz-job-vaccancies/saiz-job-board-1 (fetched — full job board with locations; "headquartered in the heart of Berlin")
  - https://www.saiz.io/about (fetched via Exa — product, team incl. 4 data scientists, press list with €2.5M seed)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Berlin, Wholesale & Retail Trade / Sales)
  - https://vcgermany.de/startup-liste/stadt/berlin (fetched — Berlin)
- **Confidence:** High

---

### StellaAI GmbH  ([askstella.ai](https://www.askstella.ai/))
- **Berlin evidence:** Imprint: "… Commercial register: **HRB 223370**, Register court: **Berlin (Charlottenburg)**, VAT DE337860507, Represented by **Sandro Spieß**, +49 151 2307… **Berlin**".
- **What they do (AI + retail):** StellaAI builds the "**guided shopping layer for beauty**" — AI applied to **beauty merchandising**: personalised product recommendations (**StellaMatch**), a conversational shopping assistant (**StellaAssist**), **virtual try-on for shades and looks (StellaTryOn)** and **StellaDataAI** (insight from every interaction). It serves beauty brands and multi-brand retailers; the founding story is explicitly about recreating the in-store beauty-advice experience online.
- **Products:** StellaMatch; StellaAssist; StellaTryOn; StellaDataAI.
- **Size / stage:** Early stage; founders Sandro Spiess (CEO) & Maik Wiege (CTO, ex-DeepL PM) plus beauty CCO Farina. Berlin, HRB 223370.
- **Founded:** ~2024–2025 (**Low–Medium confidence**).
- **Why it matters for a CV/ML engineer:** **Computer vision for retail** (shade/try-on/skin-adjacent image understanding) at a Berlin beauty-retail startup — directly on the "retail merchandising software with an AI component" line and it is CV-heavy.
- **Open roles (Berlin):** A careers page exists at https://www.askstella.ai/careers but is JS-rendered and no individual vacancies could be enumerated from the fetched HTML.
  | Role | URL |
  |---|---|
  | Careers page | https://www.askstella.ai/careers |
- **Sources:**
  - https://www.askstella.ai/imprint (fetched — HRB 223370, Berlin Charlottenburg)
  - https://www.askstella.ai/about (fetched via Exa — product, founders, "Retailers" category)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — StellaAI not listed; LinkedIn profile de.linkedin.com/company/ask-stella-ai lists Computer Vision, Product Recommendations, Retail Technology)
- **Confidence:** High (Berlin entity); Low on roles

---

### IQONIC.AI (SkinTech Corp. GmbH)  ([iqonic.ai](https://iqonic.ai/))
- **Berlin evidence:** Imprint: "**IQONIC.AI — a project by SkinTech Corp. GmbH, Zimmerstraße 50, 10117 Berlin** … Represented by Maria-Liisa Bruckert, Martin Pentenrieder … Registration Court: **District Court of Charlottenburg (Berlin)**, Registration Number: **HRB 225620**".
- **What they do (AI + retail):** IQONIC.AI sells **white-label computer-vision SaaS for beauty brands, retailers, pharmacies and salons** — **AI skin analysis, hair analysis, lip analysis and a makeup advisor** that turn each customer interaction into a data-enriched profile, then into personalised product recommendations and retargeting. It works in-store (terminal/app) and online; claims 3.5× conversion, +30% order value, +75% retention, −70% CAC. The German regional-gründer profile describes the founders' motivation as digitising the beauty/health advisory market for brands and retailers.
- **Products:** AI Skin Analysis; AI Hair Analysis; AI Lip Analysis; AI Makeup Advisor; white-label deployment + CRM write-back.
- **Size / stage:** Small; founded 2021; **received a "Millionensumme"** (per deutsche-startups coverage surfaced via websearch). Region: Berlin/Brandenburg (Cottbus/Spremberg founders, BTU Cottbus).
- **Founded:** 2021 (Berlin).
- **Why it matters for a CV/ML engineer:** Real **retail computer vision** (image-based skin/hair/lip analysis) sold to retailers — a direct CV/ML-in-retail role, though the company is small (founder-stage).
- **Open roles (Berlin):** No careers page / open roles found (the /careers route renders an empty shell).
  | Role | URL |
  |---|---|
  | — (no public roles) | https://iqonic.ai/ |
- **Sources:**
  - https://iqonic.ai/imprint (fetched — SkinTech Corp. GmbH, Zimmerstraße 50, 10117 Berlin, HRB 225620)
  - https://www.iqonicai.com/ (fetched via Exa — product & claims)
  - https://exa.ai/library/organization/sj7vl22t5qs (fetched via Exa — founded 2021)
  - https://gruendung.wfbb.de/skintech-corp-gmbh (fetched via Exa — German founder profile)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Deep Skin AI not IQONIC; both Berlin)
- **Confidence:** High

---

### Deep Skin AI (Digital Retina AI UG)  ([deepskinai.com](https://deepskinai.com/))
- **Berlin evidence:** LinkedIn company page (via Exa): "**We are a Berlin-based start-up, improving current AI tools for skin analysis.** We detect acne levels and overall skin condition on every skin tone." Headquartered in Berlin, founded 2021, legal entity **Digital Retina AI UG**. appliedAI landscape: city Berlin, Wholesale & Retail Trade / Sales ("Skin analysis and product recommendation SaaS B2B for E-Commerce").
- **What they do (AI + retail):** A **CV skin-analysis engine** (acne levels, skin condition across all skin tones) sold **B2B SaaS to e-commerce**, producing product recommendations for skincare retail. Founded out of the Migrant Accelerator; GWDI startup-competition winner; F.A.Z.-Institut AI Innovation Award finalist; Dr. Silke Michelsen won third place in the Innovation Award of the German Dermatologists Association.
- **Products:** Skin-analysis API / white-label SaaS for e-commerce beauty; product-recommendation engine.
- **Size / stage:** ~3 employees (1–10 band); ~$128k non-equity assistance (2022); CEO Kai Froehner, CTO/co-founder Ludovica Lerma.
- **Founded:** 2021 (Berlin).
- **Why it matters for a CV/ML engineer:** Extremely small but a textbook **dermatology-grade CV + inclusive-skin-tone robustness** problem; a strong research-interest line for a CV/ML CV.
- **Open roles (Berlin):** None published.
  | Role | URL |
  |---|---|
  | — (no public roles) | https://deepskinai.com/ |
- **Sources:**
  - https://exa.ai/library/organization/wsvj11ff9xv (fetched via Exa — Berlin-based, Digital Retina AI UG, founded 2021, 3 employees, funding, leadership, award history)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Berlin, Wholesale & Retail Trade / Sales)
- **Confidence:** High (Berlin); Low on current activity (site did not resolve on direct fetch at www.deepskinai.com)

---

### Footprint Technologies GmbH  ([footprinttech.de](https://footprinttech.de/))
- **Berlin evidence:** Site footer: "© 2019 – 2026 **Footprint Technologies GmbH**"; site copy repeatedly references **Berlin** ("Berlin, manufactured in Portugal and delivered only in the perfect sizes for your employees", "Made in Berlin"). appliedAI landscape: Footprint Technologies, city Berlin, Wholesale & Retail Trade ("Develop a technology to measure body parts and associated clothing").
- **What they do (AI + retail):** Footprint is "**the leading AI and smartphone-based shoe size recommendation service for retailers and online shoppers**" — a CV/ML pipeline that estimates foot dimensions from a phone camera and produces the right size recommendation, embedded into the webstores of shoe retailers, reducing returns and increasing basket size.
- **Products:** Footprint size-recommendation API/web component ("Measure my feet now", no app, no signup); enterprise integration for shoe retailers.
- **Size / stage:** Small; founded 2019; scientific advisory board includes University of Gothenburg (Movement Science).
- **Founded:** 2019 (Berlin).
- **Why it matters for a CV/ML engineer:** **Computer vision + retail** (size/fit CV embedded in retailer e-commerce) — a clean, well-scoped CV product with a Berlin base.
- **Open roles (Berlin):** None published (site has a "Work with Us" section without open reqs).
  | Role | URL |
  |---|---|
  | Work with us | https://footprinttech.de/ |
- **Sources:**
  - https://footprinttech.de/ (fetched — Berlin, product, GmbH footer)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Footprint Technologies, Berlin, Wholesale & Retail Trade)
- **Confidence:** Medium-High

---

### Faircado UG  ([faircado.com](https://faircado.com/))
- **Berlin evidence:** LinkedIn company page (via Exa): "**Headquartered in Berlin, Germany**", legal entity **Faircado UG**, founded 2022. appliedAI: Berlin, Wholesale & Retail Trade ("AI-powered aggregator for second-hand shopping online").
- **What they do (AI + retail):** Faircado is an **AI-powered resale (second-hand) shopping aggregator** with a 150M+ pre-owned product catalogue and "proprietary AI delivering hyper-personalised results" — i.e. **visual/product matching and ranking at scale for retail**, plus the future of retail in the circular economy.
- **Products:** Faircado app + search & discovery platform; AI personalisation/ranking over the resale catalogue.
- **Size / stage:** ~15 employees (−37.5% YoY), annual revenue ≈$1.4M. Raised ~$3.4M (pre-seed 2022 $781k, seed 2024 €150k, pre-seed May-2024 $2.4M) + €1.0M EU grant (2021). Awards: Slush100 1M€ winner (2023), eBay Circular Fashion Fund finalist (2024), Berlin Green Buddy Award (2024), Vogue Business 9 fashion-tech startups to watch (2025), Fast Company Top 10 Most Innovative (2025), Norrsken Impact/100 (2025).
- **Founded:** 2022 (Berlin).
- **Why it matters for a CV/ML engineer:** Berlin **retail AI at scale** (matching + personalisation over 150M items) — a ranking/embedding-model CV with a strong brand.
- **Open roles (Berlin):** None found in the fetched sources.
  | Role | URL |
  |---|---|
  | — (no public roles found) | https://faircado.com/ |
- **Sources:**
  - https://exa.ai/library/organization/gvy23wcb2br (fetched via Exa — Berlin HQ, Faircado UG, founded 2022, 15 employees, funding, awards, tech description)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Berlin, Wholesale & Retail Trade)
- **Confidence:** High

---

### ModelMe UG  ([modelme.tech](https://modelme.tech/))
- **Berlin evidence:** LinkedIn (via Exa): "Headquarters: **berlin, germany (DE)** … Aliases: **ModelMe UG (haftungsbeschränkt)**", founded 2021. Tagesspiegel headline: "**Dieses Berliner Start-up** erweckt virtuelle Models zum Leben".
- **What they do (AI + retail):** ModelMe is a **generative B2B software company digitising the creation of fashion visuals** — AI-generated virtual models / product imagery for fashion & retail marketing. Tags include artificial intelligence, computer vision, fashiontech.
- **Products:** Generative fashion visuals / virtual model rendering.
- **Size / stage:** Very small (1 employee per index; ex-Presize founder Nat Wollny); pre-seed rounds Jul-2021 & Jan-2022; ex-Justa, ex-Presize (acq. by Meta) alumni.
- **Founded:** 2021 (Berlin).
- **Why it matters for a CV/ML engineer:** **Generative CV/AI for fashion retail** — but currently a 1-person company, so job risk is high.
- **Open roles (Berlin):** None found.
  | Role | URL |
  |---|---|
  | — (no public roles found) | https://modelme.tech/ |
- **Sources:**
  - https://exa.ai/library/organization/v9r85v9f47w (fetched via Exa — Berlin HQ, ModelMe UG, founded 2021, 1 employee, funding, tags)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — ModelMe, Berlin, Wholesale & Retail Trade / Production)
- **Confidence:** Medium (Berlin High; product/team size very small)

---

### yoona.ai  ([yoona.ai](https://www.yoona.ai/))
- **Berlin evidence:** Careers page: "**We are a Berlin based startup** on our way to revolutionise product design process"; intern ads state "primary location in **Berlin, Germany**". appliedAI: yoona.ai, city Berlin, Wholesale & Retail Trade / Production.
- **What they do (AI + retail):** yoona.ai is a **generative-AI design and sales-optimisation platform for fashion brands** — it analyses enterprise product data and generates multiple designs automatically (AI clothing generator), and optimises sales for fashion clients.
- **Products:** AI Clothing Generator; design-automation workflow; sales optimisation.
- **Size / stage:** Small Berlin startup; team includes alumni of Justa and ex-Presize. No public funding round found.
- **Founded:** ~2021 (**Low–Medium confidence**).
- **Why it matters for a CV/ML engineer:** Generative AI applied to **fashion assortment/design** — a Berlin example of "retail merchandising software with an AI component".
- **Open roles (Berlin):**
  | Role | URL |
  |---|---|
  | Business Development (Intern) — Berlin | https://www.yoona.ai/career |
  | Customer Success (Intern) — Berlin (hybrid, partly remote) | https://www.yoona.ai/career |
- **Sources:**
  - https://www.yoona.ai/career (fetched via Exa — Berlin-based, role descriptions)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Berlin, Wholesale & Retail Trade / Production)
- **Confidence:** Medium-High

---

### charles (hello-charles.com)  ([hello-charles.com](https://www.hello-charles.com/))
- **Berlin evidence:** appliedAI landscape: city **Berlin**, industries Cross Industry / Marketing ("Empowering brands to leverage end-to-end relationships with their consumers using the power of AI-enabled conversational commerce"). Berlin startup list (VCNews) includes the "Conversational commerce platform for WhatsApp-based marketing and sales" entry.
- **What they do (AI + retail):** charles builds **conversational commerce** — a conversation-first platform that helps D2C/enterprise brands and retailers run customer journeys (WhatsApp-first) across marketing, sales and customer success, with AI agents. Customers include Europe's innovative e-commerce and D2C brands.
- **Products:** charles conversational-commerce platform; WhatsApp-based customer journeys; AI conversation agents.
- **Size / stage:** Scale-up; Series A per VCNews Berlin list. Founding team includes a VP of Engineering, VP of Product, Sales Director, CCO.
- **Founded:** ~2021 (**Medium confidence**).
- **Why it matters for a CV/ML engineer:** Berlin LLM/agent play with retail/brand customers — good for conversational-AI and applied-ML CVs.
- **Open roles (Berlin):**
  | Role | URL |
  |---|---|
  | Careers page | https://www.hello-charles.com/jobs/ |
  | Greenhouse board ("Current openings at charles") | http://job-boards.eu.greenhouse.io/charles |
- **Sources:**
  - https://www.hello-charles.com/jobs/ (fetched via Exa — team, values, roles)
  - http://job-boards.eu.greenhouse.io/charles (fetched via Exa — Greenhouse board)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Berlin, Cross Industry / Marketing)
- **Confidence:** Medium-High (Berlin from curated index; no imprint captured)

---

### WUNDER  ([wunder.ai](https://wunder.ai/))
- **Berlin evidence:** VCNews Berlin startup list: "**Wunder ist ein Startup aus Berlin** mit Schwerpunkt auf KI-gestützter Value Discovery und Customer-Emotion-Analysen."
- **What they do (AI + retail):** WUNDER builds a **Customer Value Platform for retailers** — it creates "**Customer Twins**" (living behavioural models per customer), runs autonomous "**Value Agents**" that discover lifecycle opportunities, and activates them via hyper-personalised "**Impact Triggers**". Founded by Rupert Steffner (ex-Groupon / Otto behavioural insight head); CTO Gösta von Stebut. Explicitly retail/e-commerce marketing AI.
- **Products:** Customer Value Platform; Customer Twins; Value Agents; Impact Triggers.
- **Size / stage:** Small; founded ~2020 (**Low–Medium confidence** on year). No funding disclosed in fetched sources.
- **Founded:** ~2020 (Berlin).
- **Why it matters for a CV/ML engineer:** Behavioural/next-best-action ML for retailers, Berlin-based, founder-led.
- **Open roles (Berlin):** None published.
  | Role | URL |
  |---|---|
  | — (no public roles) | https://wunder.ai/about/ |
- **Sources:**
  - https://wunder.ai/about/ (fetched via Exa — platform, Customer Twins / Value Agents / Impact Triggers, founders)
  - https://vcgermany.de/startup-liste/stadt/berlin (fetched — Berlin, "KI-gestützte Value Discovery und Customer-Emotion-Analysen")
- **Confidence:** Medium

---

### Aklamio GmbH  ([aklamio.com](https://www.aklamio.com/))
- **Berlin evidence:** VCNews Berlin startup list: "**aklamio ist ein 2011 in Berlin gegründetes Softwareunternehmen für Kundenanreize und Empfehlungsmarketing.** Die betreute Incentives-Plattform steuert Cashback, Gutscheine, Empfehlungsprogramme und Prämien inkl. **Betrugsprävention** und Reward-Fulfillment."
- **What they do (AI + retail):** aklamio is a **B2B loyalty/incentive & recommendation-marketing platform** — cashback, vouchers, referral programmes, premium rewards, **fraud prevention** and reward fulfilment, sold as a managed service to brands, telcos, energy, insurance and banks. Its AI component is recommendation targeting + coupon/loyalty abuse & fraud detection (a retail-adjacent loss-prevention problem, but for vouchers rather than shelves).
- **Products:** Incentives platform; cashback/voucher/referral/premium campaigns; **fraud prevention**; reward fulfilment; recommendation marketing.
- **Size / stage:** Series A; Berlin; founded 2011.
- **Founded:** 2011 (Berlin).
- **Why it matters for a CV/ML engineer:** Fraud/anomaly detection + recommender systems for retail promotions — the "payment fraud / shrinkage" family, on the voucher side.
- **Open roles (Berlin):** None found in fetched sources.
  | Role | URL |
  |---|---|
  | — (no public roles found) | https://www.aklamio.com/ |
- **Sources:**
  - https://vcgermany.de/startup-liste/stadt/berlin (fetched — aklamio, Berlin 2011, Series A, fraud prevention)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Berlin list)
- **Confidence:** Medium

---

### MATREX dataware  ([matrex-dataware.com](https://www.matrex-dataware.com/))
- **Berlin evidence:** VCNews Berlin startup list: "**MATREX dataware entwickelt eine digitale Handelsplattform für Lebensmittel und Getränke.** Sie verbindet Hersteller, Verkäufer und Geschäftskunden und unterstützt die Abwicklung von Bestellungen und Geschäftsbeziehungen im **B2B-Handel**." Listed as a Berlin startup.
- **What they do (AI + retail):** A **digital B2B trade platform for food & beverages**, connecting manufacturers, sellers and business customers and supporting order and commercial relationship processing. AI/ML strength in this profile is **not evidenced** in the sources fetched — include as a *retail-trade* Berlin platform with ML to verify.
- **Products:** B2B food & beverage trade/order platform.
- **Size / stage:** Small; funding not found in fetched sources.
- **Founded:** not found (**Low confidence**).
- **Why it matters for a CV/ML engineer:** Berlin B2B food-trade infrastructure — verify AI content before applying.
- **Open roles (Berlin):** None found.
  | Role | URL |
  |---|---|
  | — (no public roles found) | https://www.matrex-dataware.com/ |
- **Sources:**
  - https://vcgermany.de/startup-liste/stadt/berlin (fetched — MATREX dataware, Berlin, B2B food & beverage trade platform)
- **Confidence:** Low-Medium (Berlin from curated list; AI component unverified)

---

### SPRK.global  ([sprk.global](https://sprk.global/))
- **Berlin evidence:** VCNews Berlin startup list: "**SPRK.global digitalisiert die Lebensmittellieferkette**, um Überproduktion und Verschwendung zu reduzern. Die **Berliner Plattform** verbindet Akteure entlang der Kette und hilft dabei, überschüssige Lebensmittel gezielter zu vermitteln und zu verwerten."
- **What they do (AI + retail):** SPRK.global digitises the **food supply chain** to reduce overproduction and waste, connecting actors along the chain (manufacturers, retail, consumers) and matching surplus food to demand — i.e. **demand-matching / excess-inventory optimisation for grocery retail and food brands**.
- **Products:** Food supply-chain matching platform for surplus redistribution.
- **Size / stage:** Small Berlin social-impact startup; funding not found in fetched sources.
- **Founded:** not found (**Low confidence**).
- **Why it matters for a CV/ML engineer:** Retail supply/demand matching with a matching-optimisation core; Berlin-based.
- **Open roles (Berlin):** None found.
  | Role | URL |
  |---|---|
  | — (no public roles found) | https://sprk.global/ |
- **Sources:**
  - https://vcgermany.de/startup-liste/stadt/berlin (fetched — SPRK.global, Berlin)
- **Confidence:** Low-Medium (Berlin from curated list)

---

### kumkju GmbH & Co. KG  ([kumkju.com](https://www.kumkju.com/))
- **Berlin evidence:** Exa company index (via LinkedIn): "**kumkju GmbH & Co. KG** … Founded 2016 … **Headquartered in Berlin, Berlin, Germany**". VCNews Berlin list: "kumkju entwickelt Digital-Signage- und POS-Lösungen für Handel und Markenhersteller … **virtuelle Regale** und Live-Videoberatung."
- **What they do (AI + retail):** kumkju builds **digital-signage and POS solutions for trade and brand manufacturers** — interactive displays, **virtual shelves**, live video advice and product information at the point of sale. The AI angle is in the recommendation/visual-merchandising layer; it is primarily a POS/retail-media platform.
- **Products:** Digital signage; POS solution; virtual shelves; live video consulting.
- **Size / stage:** Very small (1 employee per index); founded 2016; Berlin.
- **Founded:** 2016 (Berlin).
- **Why it matters for a CV/ML engineer:** Retail POS/virtual-shelf tech in Berlin, but ML depth is unclear — verify before applying.
- **Open roles (Berlin):** None found.
  | Role | URL |
  |---|---|
  | — (no public roles found) | https://www.kumkju.com/ |
- **Sources:**
  - https://exa.ai/library/organization/9vt16x96f0k (fetched via Exa — Berlin HQ, founded 2016)
  - https://vcgermany.de/startup-liste/stadt/berlin (fetched — kumkju, Berlin, digital signage/POS/virtual shelves)
- **Confidence:** Low-Medium

---

### Vyking GmbH  ([vyking.io](https://www.vyking.io/))
- **Berlin evidence:** Tracxn (via Exa): Vyking "Location: **Berlin (Germany)**", founded 2015, unfunded, ranked 6/206 in its AR-marketing competitor set. appliedAI landscape does not list it; Tracxn "AI Companies in Retail in Berlin" list includes Vyking.
- **What they do (AI + retail):** Vyking is an **AR-based marketing platform for media and e-commerce** whose SDK contains **computer vision and 3D facial tracking** (measuring/tracking movements and expressions through ~3000 parameters) plus a custom graphics engine — sold to retailers/brands for in-store and e-commerce AR product visualisation.
- **Products:** AR SDK (CV + 3D facial tracking), virtual try-on / product visualisation tooling for retail media.
- **Size / stage:** Small, unfunded/bootstrapped per Tracxn; founded 2015.
- **Founded:** 2015 (Berlin).
- **Why it matters for a CV/ML engineer:** Berlin **CV + 3D face tracking** in a retail/AR context — a legitimate CV role, though the company looks small/under-funded.
- **Open roles (Berlin):** None found.
  | Role | URL |
  |---|---|
  | — (no public roles found) | https://www.vyking.io/ |
- **Sources:**
  - https://tracxn.com/d/artificial-intelligence/ai-startups-in-retail-in-berlin-in-germany/__JYI4UtUMaufhkdd-h6V-xJUd95Kl_H3LsS-pe7vWFn0/companies (fetched via Exa — Vyking, Berlin, 2015, CV + 3D facial tracking)
- **Confidence:** Medium

---

### Vaayu  ([vaayu.tech](https://vaayu.tech/))
- **Berlin evidence:** Tracxn (via Exa): "Founded Year: 2020 … Location: **Berlin (Germany)** … Stage: **Acquired**"; total funding $13.1M; investors incl. **Atomico, CapitalT** + 16 others. Berlin retail-AI list entry.
- **What they do (AI + retail):** Vaayu built **software for retail brands to track environmental impact** — AI/ML-based life-cycle-assessment calculations across product, packaging and logistics, giving brands data-driven emissions/water/waste insight. Retail-brand facing, sustainability rather than shelf/price.
- **Products:** Product/packaging/logistics impact calculation platform (certified LCA methodologies).
- **Size / stage:** ~$13M raised; acquired (no longer independent); founded 2020.
- **Founded:** 2020 (Berlin); **status: acquired — no longer hiring as an independent vendor.**
- **Why it matters for a CV/ML engineer:** Historical Berlin retail-AI entry point; **not a current target** (acquired).
- **Open roles (Berlin):** None (acquired).
  | Role | URL |
  |---|---|
  | — (acquired; no roles) | https://vaayu.tech/ |
- **Sources:**
  - https://tracxn.com/d/artificial-intelligence/ai-startups-in-retail-in-berlin-in-germany/__JYI4UtUMaufhkdd-h6V-xJUd95Kl_H3LsS-pe7vWFn0/companies (fetched via Exa — Berlin, founded 2020, acquired, $13.1M, Atomico/CapitalT)
- **Confidence:** Medium (Berlin High; current operating status: acquired)

---

### Peregrine.ai GmbH  ([peregrine.ai](https://peregrine.ai/))
- **Berlin evidence:** Exa org index: "**Headquartered in Berlin, Germany**"; RevenueBase Germany retail-CV list records "Peregrine.ai — HQ recorded … **Berlin, Germany**". appliedAI: Peregrine Technologies, city Berlin.
- **What they do (AI + retail):** Peregrine builds **on-device ("edge") visual intelligence for cameras** — a perception model producing objects, depth and lane geometry in one forward pass, <85 ms on the camera's own processor, with anonymisation before storage. Verticals: road safety, driver assistance, **site security** and **logistics**. It is *not* a shelf/store product, but it is the strongest Berlin embedded-CV shop-floor-adjacent engine available for retail/warehouse use cases (its "site security" and "logistics" lines map onto retail CCTV and warehouse robotics).
- **Products:** Peregrine perception stack (edge inference for cameras); event-delivery backend; anonymisation on device.
- **Size / stage:** Founded 2019; ~24 contacts tracked by RevenueBase (11–50 band); funding not disclosed in fetched sources.
- **Founded:** 2019 (Berlin).
- **Why it matters for a CV/ML engineer:** Pure embedded-CV engineering in Berlin; strong CV for edge inference work even though retail is not their declared vertical.
- **Open roles (Berlin):** None found.
  | Role | URL |
  |---|---|
  | — (no public roles found) | https://peregrine.ai/ |
- **Sources:**
  - https://peregrine.ai/ (fetched via Exa — edge perception product, Berlin junction example, <85 ms)
  - https://exa.ai/library/organization/mwvdqdzfb01 (fetched via Exa — HQ Berlin, founded 2019)
  - https://revenuebase.ai/companies/retail-computer-vision-companies/germany (fetched — Peregrine.ai, HQ Berlin)
  - https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/ (fetched — Berlin, Transportation/Mobility/Storage)
- **Confidence:** High (Berlin); retail relevance: indirect

---

## Section 4 — Berlin companies excluded or de-prioritised, with reasons

| Company | Why excluded / de-prioritised | Source |
|---|---|---|
| **Trigo Retail** | HQ **Tel Aviv**; careers board lists only **Israel** and **UK/London** roles (no Berlin office found). Its Berlin presence = a *customer deployment* (REWE Schönhauser Allee autonomous store), not an engineering site. | https://www.trigoretail.com/career/ · https://www.businesswire.com/news/home/20220628005595/en/Trigo-Launches-Berlins-First-Autonomous-Grocery-Store-for-German-Supermarket-Giant-REWE · https://tracxn.com (via Exa) |
| **ShelfVision** | Product is exactly in scope (AI shelf-photo analysis → OOS, facings, share-of-shelf, planogram compliance), but leadership bios point to ex-AUDI/ex-BMW CV people and **no Berlin address/registry could be found**; "Berlin Mitte" appears only as a *demo store name*. → see Section 5 | https://shelfvision.ai/about · https://shelfvision.ai/imprint |
| **EasyPicky** | "From French R&D to international Retail Intelligence" — French origin, no Berlin entity found | https://easypicky.com/en/about-easypicky/ |
| **Pygmalios** | In-store analytics (footfall, queues, dwell) but **Bratislava, Slovakia** | https://pygmalios.com/de/ · Exa org |
| **Respory** | Shelf-level in-store customer behaviour — but **Linz, Upper Austria** | https://respory.com/ · Exa org |
| **Vision Group (EZPOG / PicToPOG / Store360)** | Excellent AI shelf-photo→planogram product, but corporate office **Hauppauge, NY** / registered **Ashburn, VA** | https://visiongroupretail.com/products/pictopog |
| **Proceso** | Planogram CV with YOLOv11, but **Pune, India** | https://linkedin.com/company/procesoapp (via Exa) |
| **ShelfOptix** | Robot-scanned shelf CV; no Berlin entity found | https://shelfoptix.com/ |
| **Autonomo** | "Just Walk Out" retail CV (Edeka, Orlen Berlin gas stations) but no Berlin company entity found | https://www.autonomo.tech/ |
| **Invent.ai / Blue Yonder / Centric / RELEX / SAP** | Sortiment & assortment AI but **Munich / Walldorf / other** | https://www.invent.ai/de/sortimentsplanung · https://www.centricsoftware.com/de/assortment-planning-software |
| **Captana (on-shelf availability), Ubica Robotics (Bremen), Aifora (Düsseldorf), Detection-X (Gummersbach), Pixolus (Cologne), Isarsoft (Munich), Focal Systems (Tel Aviv), Vusion (Luxembourg), Everseen (Cork), Standard AI (US), SymphonyAI (Israel), Trax (US)** | Right problem, wrong city | revenuebase.ai Germany retail-CV list (fetched), https://www.eu-startups.com/69-top-computer-vision-startups-and-companies-in-germany (fetched) |
| **Amazon (Just Walk Out), Zalando, REWE, Lidl, Metro, Otto Group** | They *buy* the technology (and invest in it) but do not sell retail AI products to third parties | https://www.justwalkout.com/ |

---

## Section 5 — BERLIN UNVERIFIED (in scope, Berlin presence not provable — listed separately per instructions)

### ShelfVision  ([shelfvision.ai](https://shelfvision.ai/))
- **Berlin evidence:** ⚠️ **NOT VERIFIED.** The imprint page (https://shelfvision.ai/imprint) renders client-side and returned no legal content; the string "Berlin" on the site appears only as a **demo store name** ("Berlin Mitte #014"). Leadership: CEO & Co-founder **Egzon Bajraktaraj** (6 years at AUDI AG, Business Analytics & Operations Research, M.Sc. WFI Ingolstadt); Chief AI Officer & Co-founder **Olti Gashi** (Computer Vision Engineer at BMW Group, Data Science BSc Ingolstadt). Both profiles point to an Ingolstadt/Kosovo origin rather than Berlin. No Handelsregister entry or Berlin address found.
- **What they do (AI + retail):** **Textbook in-scope vendor** — an AI-powered Retail Execution Platform that analyses shelf photos and produces **out-of-stock, facings, share-of-shelf, price-tag, POSM, planogram and competitor detection** in ~7 seconds, rolled up into a "Retail Execution Score" across countries/regions/chains/stores, with a field-audit mobile app and a management dashboard + AI chatbot.
- **Products:** Retail Audit App; AI Analysis (OOS, facings, share of shelf, planogram, price tags, POSM, competitors); Retail Execution Score; Management Dashboard.
- **Size / stage:** Very small / early; no employees, funding or founding year published (Exa org record: `workforce.total = 0`, `foundedYear = null`).
- **Founded:** Unknown.
- **Why it matters for a CV/ML engineer:** If the team turns out to have a Berlin engineering base, this is a *direct* hit for shelf-recognition CV work — worth emailing to ask.
- **Open roles (Berlin):** None published.
  | Role | URL |
  |---|---|
  | — (no public roles) | https://shelfvision.ai/about |
- **Sources:**
  - https://shelfvision.ai/ (fetched — full product description)
  - https://shelfvision.ai/about (fetched via Exa — leadership bios, four-layer model)
  - https://shelfvision.ai/imprint (fetched — JS-rendered, no legal text returned)
  - https://exa.ai/library/organization/lykxd6dmjnx (fetched via Exa — workforce 0, no founding year, no HQ)
- **Confidence:** Low (Berlin unverified) / High (product fit)

---

## Section 6 — How the search was run (for reproducibility)

**Query families used (websearch + Exa):**
`retail AI startup Berlin shelf monitoring computer vision` · `Berlin startup retail analytics KI Regal Erkennung Einzelhandel` · `shelf monitoring computer vision startup Germany Berlin planogram` · `price intelligence retail Berlin company SaaS` · `demand forecasting retail startup Berlin machine learning` · `Computer Vision Regal Einzelhandel Berlin Unternehmen KI` · `sortimentsoptimierung software Berlin KI Einzelhandel startup` · `Bestandsprognose KI Berlin Startup Unternehmen` · `KI Logistik Berlin Startup Computer Vision Lager` · `retail analytics Berlin GmbH kassenlose Kasse Computer Vision` · `Berlin AI startup list retail 2025 2026` · `Regalerkennung Regalbilder KI Dienstleistung Einzelhandel` · `Berlin startup "supply chain AI" / "demand forecasting" retail company headquarters Berlin` · `Berlin "store analytics" / "Filialanalyse" KI Software GmbH` · `BerlinStartupJobs / startupjobs.de retail AI computer vision Berlin job` · `Berlin Startup "Schwund" / "Shrinkage" / "Verlustprävention" KI Video Analytics` · `"Berlin" GmbH "Computer Vision" Regalerkennung / Regalüberwachung / Planogramm` · `Berlin company AI "store operations" grocery retailer software startup` · `Absatzprognose / Artikelprognose / Bestandsprognose Maschinelles Lernen Berlin` · `Fabrikatör / ARAMA / ShelfVision / ModelMe / SAIZ / StellaAI / IQONIC / Kickbite / Plato / Claro / refive / Logistica OS / Konvo / Frontnow / Data Spree / SAIZ` (company-profile + careers queries each) · `Trigo retail Berlin office Germany` · `Autonomo Just Walk Out headquarters Berlin` · `Everseen / Focal Systems / Vusion / Captana / Ubica / Aifora / Pygmalios / Respory / EasyPicky / Vision Group / Proceso / ShelfOptix` (exclusion checks).

**Curated directories fetched and mined:**
- `https://vcgermany.de/startup-liste/stadt/berlin` — 707 Berlin startups, filtered on retail/logistics/supply-chain/pricing/shelf keywords.
- `https://www.appliedai-institute.de/en/resources/ai-startups-deutschland/` — the full **German AI Startup Landscape 2025** (935 startups) paginated via the site's `?134880-offset=N` load-more endpoint; 238 Berlin entries extracted and filtered on "Wholesale & Retail Trade / SCM & Distribution / Sales / Marketing" industries.
- `https://revenuebase.ai/companies/retail-computer-vision-companies/germany` (top-25 Germany retail-CV list, HQ-verified Berlin subset).
- `https://www.eu-startups.com/69-top-computer-vision-startups-and-companies-in-germany`, `https://tracxn.com/d/artificial-intelligence/ai-startups-in-retail-in-berlin-in-germany/...`, `https://ai.berlin/`, `https://www.berlin-partner.de/`, `https://startup-map.berlin/`, `https://www.startup-atlas.de/`, `https://www.gitexeurope.com/`, `https://www.appliedai-institute.de/en/publications/ai-startup-landscape-2025`.

**Job sources fetched (ATS):** Personio (7Learnings, Nyris, Plato), Recruitee (Nomitri), join.com (Logistica OS, refive, Konvo), Greenhouse (charles), Coda (SAIZ), SuccessFactors (GK Software), plus company career pages (Freshflow, Fabrikatör, Signatrix, Data Spree, Frontnow, Kickbite, IQONIC, StellaAI, yoona.ai, Kickbite) and aggregators (studysmarter.de, djinni.co).
Note: the **Arbeitsagentur job API** (`rest.arbeitsagentur.de/jobboerse/...`) returned **HTTP 403** for this environment, and de.indeed.com / stepstone.de job pages are JS-rendered, so neither could be mined directly.

---

## Section 7 — Counts

- **Berlin-verified companies in scope (core + adjacent):** **34**
  - Tier A — shop-floor CV / loss prevention / checkout CV: **5** (Signatrix, Nomitri/GK Vision, GK Software, Nyris, Data Spree)
  - Tier B — retail forecasting / pricing / assortment / replenishment / supply-chain AI: **10** (Freshflow, 7Learnings, Fabrikatör, ARAMA, Logistica OS, wooms WMS, Plato, Frontnow, Claro, refive)
  - Tier C — adjacent retail AI (merchandising, in-store CV, commerce AI): **19** (Konvo, Kickbite, SAIZ, StellaAI, IQONIC.AI, Deep Skin AI, Footprint Technologies, Faircado, ModelMe, yoona.ai, charles, WUNDER, Aklamio, MATREX dataware, SPRK.global, kumkju, Vyking, Vaayu, Peregrine.ai — note Vaayu is acquired and Peregrine.ai is retail-adjacent rather than retail-facing)
- **BERLIN UNVERIFIED (listed separately):** **1** — ShelfVision
- **Companies with a confirmed open role in Berlin right now:** Freshflow, 7Learnings, Fabrikatör, Claro, Plato, SAIZ, Data Spree, GK Software/Nomitri (Technical Support Engineer – Retail AI Systems, Berlin hybrid) — 8 employers actively advertising Berlin roles.
- **Explicitly excluded despite being on-target vendors:** Trigo, EasyPicky, Pygmalios, Respory, Vision Group, Proceso, ShelfOptix, Autonomo, Invent.ai, Blue Yonder, Centric, RELEX, Captana, Ubica Robotics, Aifora, Detection-X, Pixolus, Isarsoft, Focal Systems, Vusion, Everseen, Standard AI, SymphonyAI, Trax.
