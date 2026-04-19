# Career Dispatch

> **AI-powered US job-hunting toolkit — resume management, company matching, and one-click application autofill.**

A two-part system for efficient US tech job applications:
1. **Web tool** — manage multiple resumes, get AI-curated company/position matches via Claude, and maintain a personal profile
2. **Chrome extension** — autofill any US job application page with one keyboard shortcut

Built with an Editorial/magazine aesthetic. Runs entirely in your browser. No server, no telemetry, no account.

📖 **New here?** Read the [Product Requirements Document](docs/PRD.md) for the origin story, target user clusters (Zone × Pattern framework), and roadmap.
- 📚 [Engineering Handbook](docs/handbook/README.md) — Complete technical guide (12 chapters)
---

## Features

### Resume Library
- Save multiple resumes tailored to different target roles
- Each resume can represent a distinct career narrative (e.g., "Senior PM — B2B SaaS" vs. "Senior PM — Consumer")

### AI Match Engine
- Feed a resume into Claude (Anthropic API) → get a curated list of 5–25 US companies hiring for matching roles
- Filter by **target positions** (OR filter, e.g. `Product Manager, Senior PM, Product Owner`)
- Filter by **free-form keywords** (e.g. `Japanese speaking`, `remote only`, `Series B+`, `visa sponsorship`)
- Each result includes **job-search links**:
  - 🎯 **ATS-native search** — Greenhouse / Lever / Ashby / Workday filtered URLs (most reliable)
  - 🔎 **Google site-search** — `site:careers.company.com (position OR position) keywords`
  - 💼 **LinkedIn Jobs search**
  - 🏠 **Company careers homepage** (fallback)
- **Recruiter Outreach links** for every match (all open LinkedIn people search with pre-filled queries):
  - 👤 **Tech Recruiters** — technical / engineering recruiters at the company
  - 👥 **Sourcers & TA** — recruiting coordinators and talent acquisition
  - 🎖 **Hiring Managers** — position-aware (EMs for SWE roles, PM leads for PM roles, etc.)
- One-click "Open All Google Searches" to mass-open targets
- CSV export with all links + metadata

### Personal Dossier
- Store standard US application fields: contact info, professional links (LinkedIn/GitHub/portfolio), **work authorization** (H-1B, OPT, Green Card, etc.), **sponsorship requirements**, EEO fields (voluntary), salary/start-date preferences, referral info
- Export as `profile.json` for use by the Chrome extension

### Chrome Extension — Autofill
- **Keyboard shortcut** `⌘⇧F` (Mac) / `Ctrl+Shift+F` (Win) autofills any application page
- Smart field detection via labels, placeholders, name/id, aria-label, ancestor labels
- Handles React/Vue/Workday properly (native setter injection bypasses synthetic events)
- Semantic dropdown matching (e.g., "H-1B" → "H-1B Visa (requires sponsorship)")
- Radio button group support for EEO questions
- Manual picker mode — click extension icon → pick a field → click on-page
- Non-destructive (skips already-filled fields)

### Application Tracker
- Save matches from the Match Engine
- Track status: Saved → Applied → Interview → Offer/Rejected
- Dashboard with pipeline stats

---

## Quick Start

### 1. Run the web tool

Open `career-dispatch.html` in Chrome, Edge, Brave, or Arc. That's it — no install, no build.

Your data (resumes, profile, tracked applications, API key) persists in browser `localStorage`. It never leaves your machine.

### 2. Enable AI matching (optional)

The Match Engine requires an Anthropic API key:

1. Get one at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Paste it into the Match Engine tab → Save Key
3. Cost: ~$0.01–$0.05 per match query (Claude Sonnet 4.5)

All other features (Resume Library, Personal Dossier, Tracker, Extension) work **without** an API key.

### 3. Install the Chrome extension

1. Export your profile from the web tool: **Autofill Toolkit tab → "Export Profile"** → saves `profile.json`
2. In Chrome, go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `extension/` folder from this repo
5. Pin the extension → click its icon → **Import** → select your `profile.json`
6. Done — press `⌘⇧F` / `Ctrl+Shift+F` on any job application page

Full extension docs: [`extension/README.md`](extension/README.md)

---

## Repository Structure

```
career-dispatch/
├── career-dispatch.html      # Main web tool (single-file, run by double-clicking)
├── extension/                # Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── background.js         # Service worker (handles keyboard shortcut)
│   ├── content.js            # Field detection + fill logic (~350 lines)
│   ├── popup.html / popup.js # Extension popup UI
│   ├── icons/                # 16/48/128px PNG icons
│   └── README.md             # Extension-specific docs
├── docs/
│   ├── PRD.md                # Product requirements + target user analysis
│   └── SETUP.md              # Detailed setup walkthrough
├── README.md                 # This file
├── LICENSE                   # MIT
└── .gitignore
```

---

## Privacy & Security

- **100% local-first**: Everything runs in your browser. No backend, no analytics, no tracking.
- **API key storage**: Your Anthropic API key is stored in browser `localStorage`. It is sent only to `api.anthropic.com` (and nowhere else) when you run a match.
- **Direct browser → API calls**: The tool uses `anthropic-dangerous-direct-browser-access: true`. This is safe because the key stays on your device; however, be aware that browser-direct API calls are not the recommended Anthropic pattern for production apps. For personal use on your own machine, it's fine.
- **Profile data**: Stored in browser `localStorage` for the web tool and `chrome.storage.local` for the extension.
- **Extension permissions**: `<all_urls>` is required to run on any job page, but the extension only fills fields when you explicitly trigger it (shortcut or button click).

---

## Development

### Tech stack
- **Web tool**: Single HTML file, vanilla JavaScript (ES modules), CSS variables. No build step.
- **Fonts**: Fraunces (display) + Inter Tight (body) + JetBrains Mono (labels/code) from Google Fonts
- **Extension**: Manifest V3, vanilla JS, no dependencies

### Local development
Just edit the files and refresh. For the extension, hit the ↻ button on `chrome://extensions` after changes.

### Extending field detection
Field mapping patterns live in [`extension/content.js`](extension/content.js) in the `TEXT_FIELD_MAP`, `SELECT_FIELD_MAP`, and `SELECT_VALUE_HINTS` constants. Each entry is a set of regex patterns matched against a field's combined identifiers (label, name, id, placeholder, aria-label, ancestor label text).

### Extending ATS support
ATS URL templates live in `buildSearchLinks()` in [`career-dispatch.html`](career-dispatch.html). Adding a new ATS requires:
1. A case in the `switch` statement with the direct-search URL template
2. An entry in `getAtsDomain()` for Google site-search scoping
3. Updating the prompt in `buildMatchPrompt()` so Claude knows to detect it

---

## Roadmap

Features that would further streamline the application process (not yet built):
- **Cover Letter Generator** — Claude-powered, tailored to company+JD+resume
- **JD → Resume Tailor** — paste a job description, get ATS-optimized resume suggestions
- **Interview Prep Pack** — auto-generated Q&A, company research, reverse-interview questions
- **Referral Radar** — LinkedIn search URL generator for finding warm connections at target companies
- **Follow-up Drafter** — templated follow-up emails for post-application, post-interview, thank-you notes
- **Batch Apply Mode** — generate cover letters for N companies at once, zipped
- **Salary Benchmarking** — Levels.fyi-style data + negotiation script
- **Offer Evaluator** — multi-offer total comp comparison (RSU/401k/benefits)

Contributions welcome — see Issues.

---

## License

MIT — see [`LICENSE`](LICENSE)

---

## Acknowledgments

Built with Claude (Anthropic). Editorial design influenced by print magazine traditions (Bookforum, The Paris Review, New Journal).
