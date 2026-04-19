# Chapter 12 — Extending the System

This final chapter is a recipe book. You've read how Career Dispatch works; now we'll cover how to add to it. Each recipe specifies the exact files to modify, the patterns to follow, and the gotchas to avoid.

## Recipe 1: Adding support for a new ATS platform

You discover that "Phenom People" is a popular ATS (used by McDonald's, Verizon, etc.) and want autofill + search links to work for it.

**Files to modify**: `career-dispatch.html` only.

### Step 1: Add to the ATS-native search switch

Find `buildSearchLinks()` in the script. Add a case to the switch:

```javascript
switch ((atsType || '').toLowerCase()) {
  // ... existing cases
  case 'phenom':
    if (atsSlug) {
      links.push({
        label: '🎯 Phenom',
        url: `https://${atsSlug}.jobs.phenompeople.com/jobs?keyword=${primaryQuery}`,
        desc: 'Filtered job list'
      });
    }
    break;
}
```

URL pattern is researched manually: visit a real Phenom-hosted careers page, search for a role, observe the URL structure.

### Step 2: Add to getAtsDomain() for Google site-search

```javascript
function getAtsDomain(atsType, atsSlug) {
  switch ((atsType || '').toLowerCase()) {
    // ... existing cases
    case 'phenom':
      return atsSlug ? `${atsSlug}.jobs.phenompeople.com` : 'jobs.phenompeople.com';
  }
  return null;
}
```

This makes Google site-search queries scope to Phenom domains as a fallback.

### Step 3: Teach Claude about Phenom in the prompt

In `buildMatchPrompt()`, find the EXAMPLES section and add:

```javascript
- McDonald's → careersUrl: "https://careers.mcdonalds.com", atsType: "phenom", atsSlug: "mcdonalds"
- Verizon → careersUrl: "https://mycareer.verizon.com", atsType: "phenom", atsSlug: "verizon"
```

Also add `phenom` to the explicit ATS list in the instruction:

```
2. Which ATS platform they use, from: "greenhouse", "lever", "ashby", "workday", "smartrecruiters", "jobvite", "phenom", "own", "unknown"
```

### Step 4: Test

Run a Match Engine query targeting a Phenom-using company. Verify:
- The 🎯 Phenom link appears in the results
- The URL correctly opens a Phenom-hosted job board

Done. New ATS supported in ~10 lines of code.

## Recipe 2: Adding a new profile field

You want to add a "Pronouns" field that gets autofilled.

**Files to modify**: `career-dispatch.html`, `extension/content.js`.

### Step 1: Add the form input

Find the Personal Dossier section. Add (in a logical position):

```html
<div class="field">
  <label class="field-label">Pronouns</label>
  <input type="text" data-profile="pronouns" placeholder="she/her, he/him, they/them">
</div>
```

The `data-profile="pronouns"` attribute is critical — the save handler iterates over `[data-profile]` elements automatically.

### Step 2: Add to the autofill toolkit grid

Find `updateAutofillToolkit()`. Find the array that defines which fields appear in the grid. Add `'pronouns'`:

```javascript
const fields = ['firstName', 'lastName', 'email', 'phone', 'pronouns', /* ... */];
```

### Step 3: Teach the extension's content.js

In `extension/content.js`, add to `TEXT_FIELD_MAP`:

```javascript
const TEXT_FIELD_MAP = [
  // ... existing
  { key: 'pronouns', patterns: ['\\bpronoun', 'preferred.?pronoun'] },
];
```

Patterns are regex strings. Use `\\b` for word boundaries to avoid false positives like "noun".

### Step 4: Reload extension, test on a real form

After modifying `content.js`:
1. `chrome://extensions` → reload Career Dispatch
2. Refresh the page you're testing on (content scripts are injected at page load)
3. Re-import the profile (the new "pronouns" field needs to be in the JSON)
4. Try autofill on a Greenhouse application — most have a pronoun field

Done. New profile field, propagated from web tool to extension.

## Recipe 3: Adding a new tab to the web tool

You want a "Cover Letter Generator" tab that takes a JD and your resume, asks Claude to generate a cover letter.

**Files to modify**: `career-dispatch.html` only.

### Step 1: Add a tab button

```html
<button class="tab" data-tab="cover">Cover Letter</button>
```

### Step 2: Add the tab content panel

```html
<div id="tab-cover" class="tab-content hidden">
  <div class="tab-header">
    <h2>Cover Letter Generator</h2>
    <p class="tab-subtitle">Paste a JD; we draft a personalized letter using your resume.</p>
  </div>

  <div class="card">
    <div class="card-label">Inputs</div>
    <div class="field-grid">
      <div class="field">
        <label class="field-label">Resume</label>
        <select id="cover-resume"></select>
      </div>
      <div class="field" style="grid-column: span 2;">
        <label class="field-label">Job Description</label>
        <textarea id="cover-jd" rows="8" placeholder="Paste the JD here..."></textarea>
      </div>
    </div>
    <div class="field">
      <label class="field-label">Tone</label>
      <select id="cover-tone">
        <option value="professional">Professional</option>
        <option value="warm">Warm/personable</option>
        <option value="direct">Direct/confident</option>
      </select>
    </div>
    <button class="btn" id="cover-generate">Generate Cover Letter</button>
  </div>

  <div id="cover-result"></div>
</div>
```

### Step 3: Add render and generate logic

```javascript
function renderCoverResumeSelect() {
  const sel = document.getElementById('cover-resume');
  sel.innerHTML = state.resumes.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
}

document.getElementById('cover-generate').addEventListener('click', async () => {
  const apiKey = localStorage.getItem(STORAGE_PREFIX + 'api_key');
  if (!apiKey) { toast('Save API key in Match Engine first'); return; }
  const resumeId = document.getElementById('cover-resume').value;
  const resume = state.resumes.find(r => r.id === resumeId);
  if (!resume) { toast('Pick a resume'); return; }
  const jd = document.getElementById('cover-jd').value.trim();
  if (!jd) { toast('Paste a JD'); return; }
  const tone = document.getElementById('cover-tone').value;

  const resultEl = document.getElementById('cover-result');
  resultEl.innerHTML = '<div class="card">Drafting...</div>';

  const prompt = `You are a professional career writer. Draft a cover letter.

RESUME:
"""
${resume.content}
"""

JOB DESCRIPTION:
"""
${jd}
"""

TONE: ${tone}

Write a 250-350 word cover letter. Address it to "Dear Hiring Manager" unless the JD names someone. Highlight the 2-3 most relevant strengths from the resume that match the JD. End with a clear next step. Output ONLY the letter text, no preamble.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) throw new Error('API ' + response.status);
    const data = await response.json();
    const letter = data.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    resultEl.innerHTML = `
      <div class="card">
        <div class="card-label">Draft</div>
        <pre style="white-space: pre-wrap; font-family: 'Inter Tight', sans-serif; line-height: 1.6;">${escapeHtml(letter)}</pre>
        <button class="btn btn-secondary" id="cover-copy">Copy to Clipboard</button>
      </div>`;
    document.getElementById('cover-copy').addEventListener('click', async () => {
      await navigator.clipboard.writeText(letter);
      toast('Copied');
    });
  } catch (e) {
    resultEl.innerHTML = `<div class="card">Error: ${escapeHtml(e.message)}</div>`;
  }
});

// Hook into the tab navigation to populate the resume dropdown when entering the tab
document.querySelectorAll('.tab[data-tab="cover"]').forEach(btn => {
  btn.addEventListener('click', renderCoverResumeSelect);
});
```

### Step 4: Test

Switch to the new tab, pick a resume, paste a JD, click Generate. After ~10s you should see a draft letter you can copy.

Done. New feature, ~80 lines of code, fully integrated.

The same pattern (`prompt → fetch → parse → render`) extends to:
- **JD Tailor**: take a JD, suggest resume bullet edits
- **Interview Prep**: generate likely questions for a role
- **Salary Benchmarker**: estimate compensation for a role + location
- **Follow-up Drafter**: draft a follow-up email after an interview

## Recipe 4: Adding a new search link type

You want to add a Glassdoor company-search link to every match.

**Files to modify**: `career-dispatch.html`.

In `buildSearchLinks()`, after the existing job links:

```javascript
links.push({
  label: '⭐ Glassdoor',
  url: `https://www.glassdoor.com/Search/results.htm?keyword=${encodeURIComponent(company)}`,
  desc: 'Reviews & salaries'
});
```

That's it. The match render automatically displays all links in the array.

You could also make it conditional — only show if there's no existing review link:

```javascript
const hasReviews = links.some(l => l.label.includes('Glassdoor'));
if (!hasReviews) {
  links.push({...});
}
```

For more sophisticated logic (e.g., different links per industry), add conditions:

```javascript
const isHealthcare = (match.tags || []).some(t => /health|medical|pharma/i.test(t));
if (isHealthcare) {
  links.push({
    label: '🏥 NIH Reporter',
    url: `https://reporter.nih.gov/search?term=${encodeURIComponent(company)}`,
    desc: 'NIH grants'
  });
}
```

Done. New link type, ~5 lines for a basic case.

## Recipe 5: Improving prompt accuracy

You notice that Claude often picks startups that have laid off recently. You want to prefer hiring-actively companies.

**Files to modify**: `career-dispatch.html` (specifically `buildMatchPrompt()`).

In the prompt, after the SEARCH CRITERIA section:

```
ADDITIONAL CONSTRAINTS:
- Prefer companies with active hiring momentum (recent funding rounds, public hiring announcements, growing engineering teams). Avoid companies that have had layoffs in the past 6 months unless the role is specifically in a growing division.
- For each match, in the matchReason, briefly indicate why you believe they're hiring (e.g., "Series C in Q4 2025; engineering team grew 30%").
```

Also adjust the matchScore guidance:

```
- "matchScore": an integer 0-100. Penalize companies with recent layoffs (-15) or hiring freezes (-25). Boost companies with recent positive momentum (+10).
```

### Iteration discipline

Don't change multiple things at once. Run the same query 3-5 times before and after each change, comparing:
- Are matches more relevant?
- Are scores more reasonable?
- Did anything regress?

Keep a "prompt changelog" comment at the top of `buildMatchPrompt`:

```javascript
// Prompt evolution:
// v1: basic match
// v2: added few-shot examples for ATS detection (improved accuracy ~3x)
// v3: added hiring momentum constraint
// v4: ...
```

Done. Iterating prompts is the highest-leverage way to improve match quality.

## Recipe 6: Adding a feature to the extension

You want to add a "Save Form Snapshot" button to the extension popup that captures the current state of all fields on a page (for resuming a partial application later).

**Files to modify**: `extension/popup.html`, `extension/popup.js`, `extension/content.js`.

### Step 1: Popup UI

Add to `popup.html`:

```html
<div class="section">
  <button id="btn-snapshot" class="btn-secondary">📸 Snapshot Current Form</button>
  <button id="btn-restore" class="btn-secondary">📂 Restore Last Snapshot</button>
</div>
```

### Step 2: popup.js handlers

```javascript
document.getElementById('btn-snapshot').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const snapshot = await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_FORM' });
    await chrome.storage.local.set({
      [`snapshot:${tab.url}`]: { snapshot, savedAt: Date.now() }
    });
    showMiniToast('📸 Snapshot saved');
  } catch (e) {
    showMiniToast('⚠ Failed', true);
  }
});

document.getElementById('btn-restore').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const data = await chrome.storage.local.get(`snapshot:${tab.url}`);
  const entry = data[`snapshot:${tab.url}`];
  if (!entry) { showMiniToast('No snapshot for this URL', true); return; }
  await chrome.tabs.sendMessage(tab.id, { type: 'RESTORE_FORM', snapshot: entry.snapshot });
  showMiniToast('📂 Restored');
});
```

### Step 3: content.js handlers

```javascript
// In the existing message listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // ... existing handlers
  if (msg.type === 'CAPTURE_FORM') {
    const snapshot = {};
    document.querySelectorAll('input, textarea, select').forEach(el => {
      const id = getLabelText(el);
      if (id) snapshot[id] = el.value;
    });
    sendResponse(snapshot);
  }
  if (msg.type === 'RESTORE_FORM') {
    let count = 0;
    document.querySelectorAll('input, textarea, select').forEach(el => {
      const id = getLabelText(el);
      if (msg.snapshot[id]) {
        setNativeValue(el, msg.snapshot[id]);
        count++;
      }
    });
    sendResponse({ count });
  }
});
```

Done. New feature spans 3 files but each addition follows the existing patterns.

## Recipe 7: Adding a backend (when you've outgrown local-first)

If your project evolves past Career Dispatch's scale (multi-user, team accounts, sync, etc.), here's the migration path.

### Step 1: Carve out the API key from the browser

Replace direct Anthropic calls with calls to your backend:

```javascript
// Before
const response = await fetch('https://api.anthropic.com/v1/messages', {
  headers: { 'x-api-key': userApiKey },
  body: JSON.stringify({...})
});

// After
const response = await fetch('https://your-backend.com/match', {
  headers: { 'Authorization': `Bearer ${sessionToken}` },
  body: JSON.stringify({ resume, keywords })
});
```

Your backend handles the Anthropic call server-side using your API key. Users authenticate to your backend, not to Anthropic.

### Step 2: Move state to a database

Replace localStorage with a remote API:

```javascript
// Before
async function saveResumes() {
  localStorage.setItem(STORAGE_PREFIX + 'resumes', JSON.stringify(state.resumes));
}

// After
async function saveResumes() {
  await fetch('https://your-backend.com/resumes', {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${sessionToken}` },
    body: JSON.stringify(state.resumes)
  });
}
```

Your backend persists to PostgreSQL or similar.

### Step 3: Add accounts

You'll need:
- Sign-up / login flow
- Email verification
- Password reset
- Session tokens (JWT or session cookies)

This is a several-week undertaking. Use a framework (Auth0, Clerk, NextAuth) unless you specifically want to roll your own.

### Step 4: Add billing if applicable

If you're charging users, integrate Stripe. Track usage server-side.

### Step 5: Maintain the local-first option

Some users want local-only. You can keep `career-dispatch.html` as a fallback that hits the public Anthropic API directly with a BYOK pattern. Branch the code with a config flag:

```javascript
const USE_BACKEND = window.location.hostname !== '';  // file:// has empty hostname
if (USE_BACKEND) {
  // call your backend
} else {
  // call Anthropic directly with localStorage API key
}
```

This is the migration the PRD's "Career Dispatch Pro" tier alludes to. We haven't done it because the local-first version covers the use case for now.

## Recipe 8: Forking for a different domain

Career Dispatch is built for US tech job hunting. The core architecture works for any domain that has:
- Per-user reference data (resumes ↔ portfolios, profile ↔ deal sheet)
- LLM-powered list generation (matches ↔ leads)
- External form fill (job applications ↔ contact forms)

Examples of clean forks:
- **Sales Lead Dispatch**: replace resumes with sales pitches, profile with seller info, matches with target accounts, autofill with CRM forms
- **Investor Outreach Dispatch**: replace resumes with pitch decks, profile with founder info, matches with relevant VCs, autofill with intake forms
- **Real Estate Buyer Dispatch**: replace resumes with buyer profiles, matches with listings, autofill with offer forms
- **Grad School Application Dispatch**: replace with statements of purpose, matches with programs, autofill with Common App

For each fork:
1. Update `Personal Dossier` fields
2. Rewrite the prompt in `buildMatchPrompt()`
3. Adjust the few-shot examples
4. Update the search link templates (different sites for different domains)
5. Re-tune the autofill regex patterns

Most other code is domain-agnostic.

## Common pitfalls when extending

### Forgetting to escape

Every dynamic value in `innerHTML` must pass through `escapeHtml()`. Adding new render code? Audit every `${...}`.

### Forgetting to re-render after state mutation

The pattern `state.X.push(...) → save → render` is brittle. If you forget the render, the UI shows stale data. If you add a new state mutation site, double-check the render is called.

### Touching content.js without reloading the extension

Editing `content.js` doesn't auto-reload. You must:
1. Reload the extension at chrome://extensions
2. Reload the test page (so the new content.js is injected)

Forgetting this leads to "I changed it but nothing's different" confusion.

### Breaking existing patterns by being clever

Career Dispatch is intentionally boring. If you add a feature using a different pattern from the rest of the codebase (e.g., introducing reactive state, adopting a new templating library), you create cognitive overhead for everyone.

If you genuinely need a different pattern, document why in a comment.

### Adding dependencies for one-off needs

Resist the urge to npm install something for a single function. Career Dispatch is dependency-free; preserving that has compounding benefits (no lockfile drift, no audit warnings, no upgrades).

If a feature genuinely requires a library (e.g., chart rendering), include it via CDN `<script>` tag, not npm.

## Roadmap from the PRD

Reference: `docs/PRD.md` lists features under consideration:

- **Cover Letter Generator** — chapter 3 recipe applies directly
- **JD → Resume Tailor** — variant of the same prompt pattern
- **Interview Prep Pack** — generate likely questions per role
- **Referral Radar** — surface 2nd-degree LinkedIn connections (would require LinkedIn API or browser scripting)
- **Follow-up Drafter** — generate post-interview emails
- **Batch Apply** — queue multiple matches and run autofill across tabs
- **Salary Benchmarking** — estimate compensation per role/location
- **Offer Evaluator** — compare offers structurally

Each is a 1-2 day feature for a focused developer. Pick whichever aligns with your needs and follow the recipes above.

## Summary

Career Dispatch was designed to be **forkable, hackable, and extensible**. Every architectural decision in chapters 1-10 was made to support exactly this kind of extension work.

The patterns to internalize:
- **Single user message + JSON output** for any new LLM feature
- **Add a tab → render function → fetch → render result** for any new UI tool
- **Add to TEXT_FIELD_MAP / SELECT_VALUE_HINTS** for any new autofill field
- **Add to switch + getAtsDomain + prompt examples** for any new ATS
- **Always escape, always re-render, always reload after edits**

If you've made it this far, you understand Career Dispatch as well as its authors do. Build something with it, fork it for a different problem, or use it as a model for your own local-first AI tools.

The full source is yours to study, modify, and rebuild. That's the entire point.

— *End of Handbook* —

---

## Appendix: Quick reference

| Task | File | Function/section |
|------|------|------------------|
| Change Match Engine prompt | `career-dispatch.html` | `buildMatchPrompt()` |
| Add ATS support | `career-dispatch.html` | `buildSearchLinks()` switch + `getAtsDomain()` + prompt examples |
| Add profile field | `career-dispatch.html` (HTML) + `extension/content.js` (`TEXT_FIELD_MAP`) |
| Add new tab | `career-dispatch.html` | New `<button class="tab">` + new `<div class="tab-content">` + render function |
| Customize colors | `career-dispatch.html` | `:root { --accent: ... }` |
| Add a new dropdown semantic | `extension/content.js` | `SELECT_FIELD_MAP` + `SELECT_VALUE_HINTS` |
| Change keyboard shortcut | `extension/manifest.json` | `commands.autofill.suggested_key` |
| Modify popup UI | `extension/popup.html` + `extension/popup.js` |
| Reset all data | DevTools → Application → Local Storage → clear `career_dispatch_*` |
