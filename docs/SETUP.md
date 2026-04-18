# Setup Guide

Full walkthrough from zero to autofilling applications.

## Prerequisites

- Chrome, Edge, Brave, or Arc browser
- (Optional) Anthropic API key for AI company matching — [get one here](https://console.anthropic.com/settings/keys)

---

## Step 1 — Clone or download this repo

```bash
git clone https://github.com/YOUR_USERNAME/career-dispatch.git
cd career-dispatch
```

Or download the ZIP from GitHub → Code → Download ZIP, then unzip.

**Important for Windows users**: Avoid OneDrive-synced folders for the `extension/` directory — OneDrive's "online only" mode can prevent Chrome from loading the extension. Recommended location: `C:\Tools\career-dispatch\`.

---

## Step 2 — Open the web tool

Double-click `career-dispatch.html`. It opens in your default browser.

**If nothing happens**: right-click → Open with → pick Chrome/Edge.

---

## Step 3 — Create your first resume

1. Click the **◉ Resume Library** tab
2. Fill in:
   - **Resume Name**: e.g. "Senior PM — B2B SaaS"
   - **Target Role**: e.g. "Senior Product Manager"
   - **Full Resume Text**: paste your complete resume text (no formatting needed)
3. Click **+ Save Resume**

You can save as many resumes as you want. Each represents a distinct target persona.

---

## Step 4 — Fill out your Personal Dossier

1. Click the **◉ Personal Dossier** tab
2. Fill in the fields that apply to you. All fields are optional — only fill what you'd want autofilled.
3. Key sections:
   - **Contact** — name, email, phone, address
   - **Professional Links** — LinkedIn, GitHub, portfolio
   - **Work Authorization** — critical for US applications. Pick the correct visa status.
   - **Sponsorship** — whether you need current or future sponsorship
   - **EEO (Voluntary)** — optional demographic info. "Decline to self-identify" is a valid choice.
   - **Preferences** — desired salary, start date, relocation willingness
4. Click **✓ Save Profile**

---

## Step 5 — (Optional) Enable AI Match Engine

Skip this step if you want to curate target companies yourself. AI matching is most useful for exploration and finding non-obvious fits.

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account and add payment method (minimum $5 deposit)
3. Go to **Settings → API Keys → Create Key**
4. Copy the key (starts with `sk-ant-api03-...`)
5. In the Career Dispatch tool, **◉ Match Engine** tab → paste the key → **Save Key**

Cost estimates:
- ~$0.02 per match query with Claude Sonnet 4.5
- $5 lasts for hundreds of queries

---

## Step 6 — Run your first match

1. **◉ Match Engine** tab
2. Select your resume from the dropdown
3. Set **# of Targets** (start with 10)
4. Optional filters:
   - **Industry Focus**: `Fintech`, `AI/ML`, `Healthcare`, etc.
   - **Location**: `NYC`, `Remote`, `Bay Area`
   - **Target Positions** (star ★): comma-separated titles you'd accept — `Product Manager, Senior PM, Product Owner, Group PM`
   - **Keywords**: free-form qualifiers — `Japanese speaking, Series B+, visa sponsorship, AI focus`
5. Click **⟶ Generate Matches**

After ~10–20 seconds you'll see a table with:
- Match score (0–100)
- Company + ATS platform badge
- Matched position title
- Why-it-matches explanation
- 4 direct job-search links per company

---

## Step 7 — Install the Chrome extension

1. In the web tool: **◉ Autofill Toolkit** tab → click **⬇ Export Profile (profile.json)**
2. `profile.json` downloads to your Downloads folder
3. Open Chrome → type `chrome://extensions` in the address bar
4. Top right: toggle **Developer mode** ON
5. Top left: click **Load unpacked**
6. Select the `extension/` folder from this repo
7. You should see "Career Dispatch — Autofill" in the list
8. Optional: click the puzzle-piece icon in the toolbar → pin the extension

---

## Step 8 — Import profile into the extension

1. Click the extension's icon in your toolbar
2. Click **⬆ Import**
3. Select the `profile.json` you exported
4. Status bar turns green: "PROFILE ACTIVE — N fields"

---

## Step 9 — Test autofill

1. Visit any Greenhouse/Lever/Ashby/Workday job application page
   - Example test sites: `boards.greenhouse.io/stripe`, `jobs.lever.co/databricks`
2. Click "Apply" on any role
3. Press **⌘⇧F** (Mac) or **Ctrl+Shift+F** (Win/Linux)
4. Fields flash yellow as they're filled
5. A toast says "⚡ Filled N fields"
6. Review, adjust, submit

---

## Updating your profile

After editing your Personal Dossier in the web tool:

1. Click **⬇ Export Profile** again
2. Click the extension icon → **⬆ Import** → select the new `profile.json`

The extension stores a separate local copy, so it needs to be re-imported after changes.

---

## Troubleshooting

### "No matching fields found" on a site
The extension doesn't recognize the field names. Use the extension popup's **Manual Picker** mode — click a field in the list, then click the target field on the page.

### Extension won't load
- Make sure you selected the `extension/` folder (the one with `manifest.json` directly inside), not the parent folder
- Check `chrome://extensions` for error messages
- Try disabling and re-enabling Developer mode

### AI matching fails with 401/403
- Check your API key is correct (start with `sk-ant-`)
- Verify you have credits at console.anthropic.com
- Try regenerating the key

### Keyboard shortcut doesn't work
- Visit `chrome://extensions/shortcuts` and verify the Career Dispatch shortcut is set
- The shortcut may conflict with another extension — reassign if so

### OneDrive "file not found" errors
Move the extension folder out of OneDrive to a local-only location like `C:\Tools\`.

---

## Data management

All data is stored locally:
- **Web tool**: browser `localStorage` (per-origin, so opening `file://career-dispatch.html` creates its own data pool)
- **Extension**: `chrome.storage.local`

To completely wipe all data:
- Web tool: DevTools (F12) → Application → Local Storage → clear the `career_dispatch_*` keys
- Extension: click the icon → Clear button

Your API key is stored the same way. Clear it similarly if switching machines or keys.
