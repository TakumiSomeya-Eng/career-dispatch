# Product Requirements Document (PRD)
## Career Dispatch

**Version**: 1.0
**Date**: April 2026
**Status**: MVP shipped

---

## 1. Origin Story

This product began as a personal response to a painful reality: **applying to hundreds of US companies through LinkedIn and company websites without a single interview callback**, while burning dozens of hours per week just identifying roles worth applying to.

The core pain points surfaced through that experience:

1. **Discovery is exhausting.** Browsing LinkedIn, Indeed, and individual company career sites to find roles matching your background consumes enormous time — most of it spent reading job descriptions that turn out to be irrelevant.
2. **The matching signal is weak.** Generic keyword search returns thousands of results; there's no intelligent filter that understands your actual resume and surfaces the companies where you'd genuinely fit.
3. **Applying is repetitive drudgery.** Every application asks for the same 30+ fields — name, email, phone, work authorization, EEO info, salary expectations. Typing them 200 times is soul-crushing and error-prone.
4. **Multiple resume versions compound the problem.** Serious candidates maintain different resumes for different target personas (e.g., B2B SaaS PM vs. Consumer PM). No existing tool lets you manage this cleanly and match companies per-resume.

Existing solutions either solve one narrow slice (autofill extensions with no intelligence) or lock users into proprietary platforms with poor data ownership. Career Dispatch is built for the specific workflow of **serious, intentional US tech job seekers** who want AI leverage without giving up control of their data.

---

## 2. Product Vision

**Turn the US job hunt from a grind into a system.**

Career Dispatch is a local-first toolkit that:
- **Manages** multiple target-specific resumes
- **Curates** matching companies and positions using AI
- **Autofills** applications with one keyboard shortcut
- **Tracks** the full pipeline from discovery to offer

All data stays on the user's machine. No accounts, no servers, no telemetry.

---

## 3. Target Users — Zone × Pattern = Cluster

Applying the *Zone × Pattern = Cluster* framework to identify the 9 target clusters worth prioritizing.

### 3.1 Zones (macro constants / phases)

| Zone | Definition |
|------|------------|
| **Zone A: International Professionals** | Non-US-born candidates currently in the US on H-1B / OPT / STEM OPT / TN / E-3, or overseas candidates targeting US roles requiring visa sponsorship. Language and visa navigation are central. |
| **Zone B: US-Domestic Tech Workers** | US citizens / Green Card holders currently employed in US tech, searching while employed. Time-constrained, selective, prioritize fit over volume. |
| **Zone C: Career Transitioners** | Candidates moving between roles (IC → manager), industries (finance → tech), or returning after a gap (layoff, parental leave, sabbatical). High uncertainty about which roles they qualify for. |

### 3.2 Patterns (psychology / decision-making style)

| Pattern | Definition |
|---------|------------|
| **Pattern 1: Volume Maximizer** | Believes "more shots on goal = more interviews." Values speed and scale. Wants to apply to 20+ companies per day without quality loss. |
| **Pattern 2: Precision Targeter** | Believes "one great-fit application beats 50 generic ones." Values signal-to-noise ratio. Wants to identify the 10 best-fit companies and invest deeply in each. |
| **Pattern 3: Data-Driven Optimizer** | Believes "track everything, iterate." Values measurability. Wants to know which resume variants, which industries, which keywords produce interviews. |

### 3.3 Cluster Matrix (9 clusters)

|   | **Pattern 1: Volume Maximizer** | **Pattern 2: Precision Targeter** | **Pattern 3: Data-Driven Optimizer** |
|---|---|---|---|
| **Zone A: International Professionals** | **A1: The Visa-Clock Sprinter** <br> *H-1B holders with 60 days of unemployment grace; OPT candidates approaching expiry.* <br> **Message**: "Apply to 100 visa-sponsoring companies this week. Autofill work authorization fields correctly every time." | **A2: The Bilingual Specialist** <br> *Candidates leveraging Japanese/Mandarin/Korean or APAC experience for strategic US roles.* <br> **Message**: "Find the 15 US companies that value your language and market knowledge. Filter by 'Japanese speaking', 'APAC', 'Tokyo office'." | **A3: The Sponsorship Strategist** <br> *Candidates tracking which companies historically sponsor H-1B / support green cards.* <br> **Message**: "Track sponsorship history per company. See which resume + visa-status combo yields interviews." |
| **Zone B: US-Domestic Tech Workers** | **B1: The Stealth Searcher** <br> *Currently employed, applying at night/weekends, wants maximum efficiency.* <br> **Message**: "Apply to 20 companies in your lunch break. One keyboard shortcut fills every form." | **B2: The Senior IC / Manager** <br> *Staff+ engineers, senior PMs who only want roles that are an objective promotion.* <br> **Message**: "Skip generic LinkedIn spam. Curated 10-company lists where your specific experience is rare and valuable." | **B3: The Comp Maximizer** <br> *Candidates optimizing for total comp, tracking multiple offers in parallel.* <br> **Message**: "Compare offers in a dashboard. Use match scores to pick which companies to push for faster timelines." |
| **Zone C: Career Transitioners** | **C1: The Post-Layoff Sprinter** <br> *Recently laid off, severance clock ticking, need volume + speed.* <br> **Message**: "Get back to work 3× faster. AI identifies roles that actually match your background, not just keyword matches." | **C2: The Industry-Switcher** <br> *Moving from finance/consulting to tech, or tech to climate/AI/healthcare.* <br> **Message**: "Maintain 3 resume variants for 3 different narratives. See which positioning opens the most doors." | **C3: The Re-Entry Candidate** <br> *Returning after a career break (parental leave, caregiving, sabbatical); need to rebuild momentum and data.* <br> **Message**: "Track every application. Learn which messaging about your gap gets responses." |

### 3.4 Priority Clusters for v1

**Primary targets**: **A1, A2, B1, C1** — these clusters experience the most acute pain and have the strongest pull for the core features (autofill + AI matching + multi-resume management).

**Highest willingness-to-pay cluster**: **A1** (visa-clock pressure) — likely the first cluster where Career Dispatch would command paid tiers if monetized.

**Underserved by competitors**: **A2 and C2** — existing tools don't support bilingual/specialist keyword filtering or multi-resume positioning. This is where Career Dispatch differentiates most strongly.

---

## 4. Core Features (v1 — shipped)

### 4.1 Resume Library
Store multiple distinct resumes. Each represents a target persona with its own narrative (role, seniority, industry angle).

**User story**: *"As a candidate open to both B2B SaaS PM and Consumer PM roles, I can maintain two resumes and get separate company match lists for each."*

### 4.2 AI Match Engine (Anthropic API)
Submit a resume + optional filters (target positions, keywords, industry, location, count) → receive a curated list of 5–25 US companies with:
- Match score (0–100)
- Best-fit position title
- Match reasoning (150–200 chars)
- ATS platform detection (Greenhouse / Lever / Ashby / Workday / etc.)
- 4 direct job-search links per company

**Differentiator**: Free-form keyword filter handles specialized needs (`Japanese speaking`, `visa sponsorship`, `Series B+`) that LinkedIn filters can't express.

### 4.3 Smart Job-Search Link Generation
For each matched company, generate **4 direct search URLs**:

| Link Type | Purpose | Example |
|-----------|---------|---------|
| 🎯 ATS-native search | Directly filter the company's job board by position | `boards.greenhouse.io/stripe?t=Product+Manager` |
| 🔎 Google site-search | Find specific JD pages across all of the company's careers content | `site:careers.stripe.com ("PM" OR "Product Manager") Japanese` |
| 💼 LinkedIn Jobs | Alternate discovery surface | `linkedin.com/jobs/search?keywords=Stripe+PM` |
| 🏠 Careers homepage | Fallback | `stripe.com/jobs` |

**Solves the pain of**: AI matching returning only generic career-page URLs, forcing the user to manually search again.

### 4.4 Personal Dossier
Store standard US application fields: contact info, professional links, **work authorization**, **sponsorship requirements**, EEO (voluntary), preferences (salary, start date, relocation). Export as `profile.json` for the extension.

### 4.5 Chrome Extension — Autofill
- Keyboard shortcut: `⌘⇧F` (Mac) / `Ctrl+Shift+F` (Win)
- Works on Greenhouse, Lever, Ashby, Workday, iCIMS, Jobvite, SmartRecruiters
- Smart field detection via 7 identifier sources (name, id, placeholder, aria-label, label[for], ancestor label, sibling legend)
- React/Vue/Workday-compatible (native setter injection)
- Manual picker mode for edge-case fields
- Non-destructive (skips filled fields)

### 4.6 Application Tracker
Saved matches with status pipeline: Saved → Applied → Interview → Offer / Rejected. Dashboard stats.

---

## 5. Non-Goals (v1)

- ❌ Server-side persistence / accounts / sync across devices
- ❌ Scraping real-time job listings (would require server infrastructure and risk TOS violations)
- ❌ Resume writing / formatting (focus is on existing resumes, not creation)
- ❌ Non-US markets (v1 optimized for US tech hiring conventions)
- ❌ LinkedIn Easy Apply (different architecture; better served by LinkedIn's own system)
- ❌ Mobile app (web tool works on mobile browsers; the extension is desktop-only by design)

---

## 6. Success Metrics

**User-level outcomes** (what the user measures for themselves):
- Time from resume update → first application submitted: target < 10 minutes
- Applications submitted per hour: target 8–12 (vs. ~2 unassisted)
- Interview rate: directional improvement vs. user's baseline

**Product health** (observable from usage):
- Resume Library: ≥ 2 resumes per active user (signals the multi-persona workflow is being used)
- Match Engine: ≥ 3 runs per week per active user during active search
- Autofill trigger rate: ≥ 5 per week per active user during active search
- Tracker status progression: ≥ 20% of saved matches advance to "Applied"

---

## 7. Future Roadmap

Prioritized by cluster impact and implementation effort:

### High-ROI next features
1. **Cover Letter Generator** — Claude-powered, tailored to (resume × company × JD). Solves volume × personalization tradeoff. Hits A1, B1, C1 hardest.
2. **JD → Resume Tailor** — Paste a JD, get keyword-optimized resume suggestions + auto-selection of the best-fit saved resume. Hits B2, C2.
3. **Interview Prep Pack** — Auto-generate expected questions, company research, reverse questions. Hits all Precision Targeters (A2, B2, C2).

### Secondary features
4. **Referral Radar** — LinkedIn search URL builder for finding warm connections at target companies
5. **Follow-up Email Drafter** — Templates for post-application, post-interview, thank-you
6. **Batch Apply Mode** — Generate cover letters for N companies at once
7. **Visa/Sponsorship Filter** — H-1B approval data integration for Zone A users
8. **Salary Benchmarking + Negotiation Coach** — Hits B3 directly
9. **Pre-Interview Intel** — Interviewer LinkedIn summary + conversation hooks
10. **Offer Evaluator** — Multi-offer total comp comparison

### Nice-to-have
11. Calendar ICS export for interviews
12. Smart reminders ("5 days since application, no response")
13. Application analytics dashboard (response rate by industry / resume variant)

---

## 8. Technical Constraints & Design Principles

**Design principles**:
- **Local-first**: All user data stays on-device. No server, no account required.
- **Bring-your-own-key**: Users provide their own Anthropic API key. No Career Dispatch-branded API billing.
- **Single-file web tool**: `career-dispatch.html` is one file with no build step. Anyone can fork and modify.
- **Editorial aesthetic**: Deliberately distinctive visual identity (Fraunces + Inter Tight + cream palette) to signal this is a crafted tool, not generic SaaS.

**Technical stack**:
- Vanilla JS (ES modules), no framework
- `localStorage` for web tool persistence; `chrome.storage.local` for extension
- Manifest V3 Chrome extension
- Anthropic Messages API, direct browser calls via `anthropic-dangerous-direct-browser-access` header

**Known limitations**:
- AI-generated ATS URLs are best-effort, not guaranteed correct. Google site-search link serves as reliable fallback.
- Extension doesn't support LinkedIn Easy Apply or some Workday configurations with heavy iframes.
- Browser-direct API calls are non-standard; acceptable for personal-use tools but not recommended for redistributed products at scale.

---

## 9. Licensing & Distribution

- **License**: MIT
- **Distribution**: GitHub repository (open source)
- **Monetization**: None in v1. If future paid tier emerges, likely positioned at Cluster A1 (visa-clock) or A3 (sponsorship-strategy) where willingness-to-pay is highest.
