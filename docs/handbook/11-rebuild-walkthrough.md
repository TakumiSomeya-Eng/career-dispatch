# Chapter 11 — Rebuilding from Scratch: A Walkthrough

This chapter is a hands-on guide to recreating Career Dispatch in approximately 6 hours. Following these steps builds intuition for the whole architecture and prepares you to extend or fork the project.

## What you'll build

By the end, you'll have:
- A single HTML file with Resume Library, Personal Dossier, Match Engine, and Tracker
- A Chrome extension with autofill and manual picker

We'll build incrementally, starting with the simplest possible version and adding features. At each phase, you should run what you've built and verify it works.

## Prerequisites

- A code editor (VS Code, Sublime, etc.)
- Chrome browser
- An Anthropic API key (for phase 4)
- ~6 hours of focused time

## Phase 1: Skeleton (30 min)

Create a folder. Inside, create `app.html` with this minimal skeleton:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Job Hunt Tool</title>
  <style>
    body { font-family: system-ui; max-width: 1000px; margin: 40px auto; padding: 0 20px; }
    .tab { padding: 8px 16px; background: #eee; border: none; cursor: pointer; }
    .tab.active { background: #333; color: white; }
    .tab-content { display: none; padding: 20px 0; }
    .tab-content.active { display: block; }
    input, textarea, select { display: block; width: 100%; padding: 8px; margin: 4px 0 12px; }
    button { padding: 8px 16px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Job Hunt Tool</h1>

  <div>
    <button class="tab active" data-tab="resumes">Resumes</button>
    <button class="tab" data-tab="profile">Profile</button>
    <button class="tab" data-tab="match">Match</button>
    <button class="tab" data-tab="tracker">Tracker</button>
  </div>

  <div id="tab-resumes" class="tab-content active">
    <h2>Resume Library</h2>
    <p>(coming soon)</p>
  </div>
  <div id="tab-profile" class="tab-content">
    <h2>Profile</h2>
    <p>(coming soon)</p>
  </div>
  <div id="tab-match" class="tab-content">
    <h2>Match Engine</h2>
    <p>(coming soon)</p>
  </div>
  <div id="tab-tracker" class="tab-content">
    <h2>Tracker</h2>
    <p>(coming soon)</p>
  </div>

  <script>
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      });
    });
  </script>
</body>
</html>
```

**Test**: Double-click `app.html`. You should see four tab buttons that switch the visible content.

This is the bare bones — tab navigation working. We'll add features into each tab.

## Phase 2: Resume Library with localStorage (45 min)

Replace the Resumes tab content:

```html
<div id="tab-resumes" class="tab-content active">
  <h2>Resume Library</h2>

  <h3>Add new</h3>
  <input id="r-name" placeholder="Name (e.g., Senior PM)">
  <input id="r-role" placeholder="Target role">
  <textarea id="r-content" rows="6" placeholder="Resume content..."></textarea>
  <button id="r-save">Save Resume</button>

  <h3>Saved</h3>
  <div id="r-list"></div>
</div>
```

Add to the `<script>`:

```javascript
const state = { resumes: [] };

function loadResumes() {
  const saved = localStorage.getItem('jh_resumes');
  if (saved) state.resumes = JSON.parse(saved);
}
function saveResumes() {
  localStorage.setItem('jh_resumes', JSON.stringify(state.resumes));
}

function renderResumes() {
  const list = document.getElementById('r-list');
  if (state.resumes.length === 0) {
    list.innerHTML = '<p><i>No resumes yet</i></p>';
    return;
  }
  list.innerHTML = state.resumes.map((r, i) => `
    <div style="border: 1px solid #ccc; padding: 12px; margin: 8px 0;">
      <strong>${r.name}</strong> — ${r.role}<br>
      <small>${r.content.length} chars</small>
      <button data-del="${i}">Delete</button>
    </div>
  `).join('');

  list.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', () => {
      state.resumes.splice(parseInt(b.dataset.del), 1);
      saveResumes();
      renderResumes();
    });
  });
}

document.getElementById('r-save').addEventListener('click', () => {
  const name = document.getElementById('r-name').value.trim();
  const role = document.getElementById('r-role').value.trim();
  const content = document.getElementById('r-content').value.trim();
  if (!name || !content) { alert('Name and content required'); return; }
  state.resumes.push({ name, role, content });
  saveResumes();
  renderResumes();
  document.getElementById('r-name').value = '';
  document.getElementById('r-role').value = '';
  document.getElementById('r-content').value = '';
});

loadResumes();
renderResumes();
```

**Test**: Add a resume → it should appear in Saved. Refresh the page → it should still be there. Delete it → it should disappear.

You've now demonstrated:
- Form submission
- Local persistence
- Render-from-state pattern

This pattern will repeat for every other feature.

## Phase 3: Personal Dossier (45 min)

Replace the Profile tab content:

```html
<div id="tab-profile" class="tab-content">
  <h2>Profile</h2>
  <input data-p="firstName" placeholder="First name">
  <input data-p="lastName" placeholder="Last name">
  <input data-p="email" placeholder="Email">
  <input data-p="phone" placeholder="Phone">
  <input data-p="linkedin" placeholder="LinkedIn URL">
  <select data-p="workAuth">
    <option value="">— Work auth —</option>
    <option value="us_citizen">US Citizen</option>
    <option value="green_card">Green Card</option>
    <option value="h1b">H-1B</option>
    <option value="opt">F-1 OPT</option>
  </select>
  <button id="p-save">Save Profile</button>
  <button id="p-export">Export profile.json</button>
</div>
```

Add to script:

```javascript
state.profile = {};

function loadProfile() {
  const saved = localStorage.getItem('jh_profile');
  if (saved) state.profile = JSON.parse(saved);
  document.querySelectorAll('[data-p]').forEach(el => {
    if (state.profile[el.dataset.p] != null) el.value = state.profile[el.dataset.p];
  });
}
function saveProfile() {
  localStorage.setItem('jh_profile', JSON.stringify(state.profile));
}

document.getElementById('p-save').addEventListener('click', () => {
  document.querySelectorAll('[data-p]').forEach(el => {
    state.profile[el.dataset.p] = el.value;
  });
  saveProfile();
  alert('Saved');
});

document.getElementById('p-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state.profile, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'profile.json';
  a.click();
  URL.revokeObjectURL(url);
});

loadProfile();
```

**Test**: Fill in fields, click Save, refresh — values should persist. Click Export — should download `profile.json`.

This file is what the extension (built later) will import.

## Phase 4: Match Engine with Claude API (90 min)

This is the meaty phase. Replace the Match tab content:

```html
<div id="tab-match" class="tab-content">
  <h2>Match Engine</h2>

  <p>API Key (stored locally, sent only to Anthropic):</p>
  <input type="password" id="m-key" placeholder="sk-ant-api03-...">
  <button id="m-key-save">Save Key</button>
  <p id="m-key-status"></p>

  <p>Choose a resume:</p>
  <select id="m-resume"></select>
  <input id="m-keywords" placeholder="Keywords (e.g., Japanese speaking, Series B)">
  <button id="m-run">Generate Matches</button>

  <div id="m-results"></div>
</div>
```

Script additions:

```javascript
function renderResumeSelect() {
  const sel = document.getElementById('m-resume');
  sel.innerHTML = '<option value="">— pick one —</option>' +
    state.resumes.map((r, i) => `<option value="${i}">${r.name}</option>`).join('');
}

function updateApiKeyStatus() {
  const key = localStorage.getItem('jh_api_key');
  document.getElementById('m-key-status').textContent = key
    ? `Saved: ${key.substring(0, 12)}...`
    : 'No key saved';
}

document.getElementById('m-key-save').addEventListener('click', () => {
  const v = document.getElementById('m-key').value.trim();
  if (!v) return;
  localStorage.setItem('jh_api_key', v);
  document.getElementById('m-key').value = '';
  updateApiKeyStatus();
});

document.getElementById('m-run').addEventListener('click', async () => {
  const apiKey = localStorage.getItem('jh_api_key');
  if (!apiKey) { alert('Save API key first'); return; }
  const idx = parseInt(document.getElementById('m-resume').value);
  if (isNaN(idx)) { alert('Pick a resume'); return; }
  const resume = state.resumes[idx];
  const keywords = document.getElementById('m-keywords').value.trim();

  document.getElementById('m-results').innerHTML = '<p>Loading...</p>';

  const prompt = `You are a US tech recruiter. Given this resume, find 5 US companies hiring for matching roles.

RESUME:
"""
${resume.content}
"""

KEYWORDS: ${keywords || '(none)'}

Return ONLY a JSON array of 5 objects with fields:
- "company" (string)
- "position" (string)
- "careersUrl" (string)
- "matchScore" (integer 0-100)
- "matchReason" (string, max 150 chars)

Output ONLY the JSON, no markdown.`;

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
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) throw new Error('API ' + response.status);
    const data = await response.json();
    const text = data.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    const cleaned = text.replace(/```json|```/g, '').trim();
    const matches = JSON.parse(cleaned);

    document.getElementById('m-results').innerHTML = `
      <table border="1" cellpadding="8" style="border-collapse: collapse;">
        <thead>
          <tr><th>Score</th><th>Company</th><th>Position</th><th>Reason</th><th>Link</th></tr>
        </thead>
        <tbody>
          ${matches.map(m => `
            <tr>
              <td>${m.matchScore}</td>
              <td>${m.company}</td>
              <td>${m.position}</td>
              <td>${m.matchReason}</td>
              <td><a href="${m.careersUrl}" target="_blank">Careers</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    document.getElementById('m-results').innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
  }
});

// Wire tab change to refresh resume select
document.querySelectorAll('.tab[data-tab="match"]').forEach(btn => {
  btn.addEventListener('click', renderResumeSelect);
});

updateApiKeyStatus();
```

**Test**: Save your API key, save a resume, switch to Match tab, click Generate Matches. After ~10s you should see a table of 5 companies.

This phase teaches you:
- Async API calls
- Prompt construction
- JSON parsing with fallback
- Error rendering

## Phase 5: Application Tracker (30 min)

Add a "Track" button to each row in the match results, then build the tracker view.

```javascript
state.tracked = [];
function loadTracked() {
  const s = localStorage.getItem('jh_tracked');
  if (s) state.tracked = JSON.parse(s);
}
function saveTracked() {
  localStorage.setItem('jh_tracked', JSON.stringify(state.tracked));
}

function renderTracker() {
  const html = state.tracked.length === 0
    ? '<p><i>No tracked applications</i></p>'
    : `<table border="1" cellpadding="8" style="border-collapse: collapse;">
        <tr><th>Company</th><th>Position</th><th>Status</th><th>Action</th></tr>
        ${state.tracked.map((t, i) => `
          <tr>
            <td>${t.company}</td>
            <td>${t.position}</td>
            <td>
              <select data-status="${i}">
                ${['saved','applied','interview','offer','rejected'].map(s =>
                  `<option ${t.status===s?'selected':''}>${s}</option>`
                ).join('')}
              </select>
            </td>
            <td><button data-untrack="${i}">Remove</button></td>
          </tr>
        `).join('')}
      </table>`;
  document.getElementById('tab-tracker').innerHTML = '<h2>Tracker</h2>' + html;

  document.querySelectorAll('[data-status]').forEach(s => {
    s.addEventListener('change', () => {
      state.tracked[s.dataset.status].status = s.value;
      saveTracked();
    });
  });
  document.querySelectorAll('[data-untrack]').forEach(b => {
    b.addEventListener('click', () => {
      state.tracked.splice(parseInt(b.dataset.untrack), 1);
      saveTracked();
      renderTracker();
    });
  });
}

document.querySelectorAll('.tab[data-tab="tracker"]').forEach(btn => {
  btn.addEventListener('click', renderTracker);
});

loadTracked();
```

In the match render, add a Track button per row, wire it to push to `state.tracked`. (Left as exercise — pattern is the same as the resume delete button.)

**Test**: Track a company → switch to Tracker tab → see it. Change status → refresh → status persists.

You now have the **complete web tool** in ~150 lines of JS. The Career Dispatch repo's version is more polished but functionally similar.

## Phase 6: Build the extension skeleton (45 min)

Create a sibling folder `extension/` next to `app.html`. Inside:

`extension/manifest.json`:
```json
{
  "manifest_version": 3,
  "name": "Job Hunt Autofill",
  "version": "1.0",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background.js" },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  "action": { "default_popup": "popup.html" },
  "commands": {
    "autofill": {
      "suggested_key": { "default": "Ctrl+Shift+F", "mac": "Command+Shift+F" }
    }
  }
}
```

`extension/background.js`:
```javascript
chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'autofill') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { profile } = await chrome.storage.local.get('profile');
  if (!profile) return;
  chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL', profile });
});
```

`extension/popup.html`:
```html
<!DOCTYPE html>
<html>
<head><style> body { width: 300px; padding: 16px; font-family: system-ui; } </style></head>
<body>
  <h3>Job Hunt Autofill</h3>
  <p id="status"></p>
  <input type="file" id="file" accept=".json" style="display:none">
  <button id="import">Import profile.json</button>
  <button id="autofill">Autofill This Page</button>
  <script src="popup.js"></script>
</body>
</html>
```

`extension/popup.js`:
```javascript
async function refresh() {
  const { profile } = await chrome.storage.local.get('profile');
  document.getElementById('status').textContent = profile
    ? `Profile loaded: ${Object.keys(profile).length} fields`
    : 'No profile';
}

document.getElementById('import').addEventListener('click', () =>
  document.getElementById('file').click()
);
document.getElementById('file').addEventListener('change', async (e) => {
  const text = await e.target.files[0].text();
  const profile = JSON.parse(text);
  await chrome.storage.local.set({ profile });
  refresh();
});
document.getElementById('autofill').addEventListener('click', async () => {
  const { profile } = await chrome.storage.local.get('profile');
  if (!profile) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL', profile });
});
refresh();
```

`extension/content.js` (minimal version):
```javascript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'AUTOFILL') return;

  const PATTERNS = {
    firstName: /first.?name|fname/i,
    lastName: /last.?name|lname|surname/i,
    email: /email/i,
    phone: /phone|telephone/i,
    linkedin: /linkedin/i,
  };

  let count = 0;
  document.querySelectorAll('input:not([type=hidden])').forEach(el => {
    if (el.value) return;
    const ident = `${el.name} ${el.id} ${el.placeholder}`.toLowerCase();
    for (const [key, pat] of Object.entries(PATTERNS)) {
      if (pat.test(ident) && msg.profile[key]) {
        el.value = msg.profile[key];
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        count++;
        break;
      }
    }
  });
  sendResponse({ count });
});
```

**Install and test**:
1. Chrome → chrome://extensions → enable Developer Mode
2. Load Unpacked → select your `extension/` folder
3. Click the extension icon → Import → select your `profile.json`
4. Visit any form (try `boards.greenhouse.io/stripe`)
5. Press Ctrl+Shift+F

You should see basic fields fill.

This is the **minimum viable extension**. The Career Dispatch version adds:
- Native setter trick for React/Vue
- 7-source field identification (label, parent label, etc.)
- Select handling with semantic option matching
- Radio button support
- Visual feedback (yellow flash, toast)
- Manual picker mode

Adding each is a focused task. Follow chapter 9 for details.

## Phase 7: Polish and ship (60 min)

To go from minimum viable to production-ready, in order of impact:

1. **Native setter trick** in content.js (essential for React/Vue support)
2. **Better field detection** — query labels, fieldsets, etc. (chapter 9)
3. **Select handling** with hint dictionaries (chapter 9)
4. **Visual feedback** — yellow highlight + toast
5. **Search link generation** in the web tool (chapter 6)
6. **Editorial UI** styling (chapter 7) — purely cosmetic but transforms the feel
7. **Documentation** — README, setup guide

By the time you complete all 7 phases, you've built ~2000 lines of code and gained a complete picture of:
- Vanilla JS + DOM manipulation
- localStorage persistence patterns
- LLM API integration
- Chrome extension architecture
- Form autofill across heterogeneous sites

## What you've learned

After this walkthrough you should be able to:
- Read any of Career Dispatch's source files and follow the logic
- Add a new feature (cover letter generator, batch apply, etc.) by following established patterns
- Debug an autofill issue by tracing through the field detection logic
- Modify the prompt in the Match Engine to change matching behavior
- Fork the project for a different domain (different industries, different countries)

If anything in the actual codebase looks foreign now, re-read the relevant chapter. Cross-reference with the file in question. Run the code with DevTools open.

In the next and final chapter, we cover specific extension patterns for adding new features to the system.
