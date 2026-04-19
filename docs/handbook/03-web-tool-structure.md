# Chapter 3 — Web Tool: Structure & Bootstrapping

`career-dispatch.html` is one file containing HTML, CSS, and JavaScript. Despite being ~1,900 lines, it's organized in predictable layers. This chapter is the map.

## File layout (top to bottom)

```
career-dispatch.html
├── <!DOCTYPE html> + <head>
│   └── <style>          ~700 lines    (chapter 7)
│
├── <body>
│   ├── <div class="app-root">
│   │   ├── <div class="masthead">         (logo, tagline)
│   │   ├── <div class="nav-tabs">         (5 tab buttons)
│   │   └── <div class="main-content">
│   │       ├── #tab-match (Match Engine)
│   │       ├── #tab-resumes (Resume Library)
│   │       ├── #tab-profile (Personal Dossier)
│   │       ├── #tab-autofill (Autofill Toolkit)
│   │       └── #tab-tracker (Application Tracker)
│   ├── <div id="modal-root">              (popup overlays)
│   └── <div id="toast-root">              (notifications)
│
└── <script type="module">      ~1,000 lines
    ├── State definition
    ├── Storage helpers (load/save)
    ├── UI helpers (toast, modal)
    ├── Tab navigation
    ├── Resume management
    ├── Profile management
    ├── API key management
    ├── Match Engine (Claude API call)
    ├── Search link generation
    ├── Match rendering
    ├── CSV export
    ├── Autofill Toolkit (profile export)
    ├── Application Tracker
    ├── Utilities (escapeHtml, etc.)
    └── Boot sequence
```

The structure is **flat by design**. No imports, no modules, no dependency injection. Everything that exists is reachable from any function in the same `<script>` block. This makes navigation easy: search for a function name and you find it.

## The boot sequence

The script ends with this self-invoking async function:

```javascript
(async function init() {
  await loadState();        // pull data from localStorage into `state`
  renderResumeList();       // populate Resume Library tab
  renderMatchSelect();      // populate the resume dropdown in Match Engine
  loadProfileForm();        // hydrate Personal Dossier form fields
  updateAutofillToolkit();  // build the quick-copy grid
  initApiKeyUI();           // wire up API key buttons
  updateApiKeyStatus();     // display "Key saved" or "No key" status
})();
```

This runs once when the page loads. It's the only entry point. Everything else is event-handler-driven — buttons, form submits, etc.

### Why an IIFE (Immediately Invoked Function Expression)?

Because we have a `<script type="module">` block, top-level `await` would technically work. But wrapping in an IIFE makes the boot sequence self-contained and easier to spot. It's a stylistic choice for readability.

### What runs first when the user opens the file

1. Browser parses HTML, builds the DOM
2. Browser sees `<style>` block, applies CSS
3. Browser fetches Google Fonts (async, doesn't block)
4. Browser sees `<script type="module">`, executes it
5. The script defines functions and constants, then `init()` runs
6. `init()` reads localStorage and populates the UI
7. User sees the rendered page

There's no "loading spinner" because the data lives locally — `loadState()` finishes in <1ms.

## The `state` object

Near the top of the script:

```javascript
const state = {
  resumes: [],
  profile: {},
  savedMatches: [],
};
```

This is **the entire application state**. Everything else is derived from this object plus the DOM. There is no Redux, no Zustand, no observable. Just three properties on a plain object.

Mutations look like:

```javascript
state.resumes.push(newResume);
await saveResumes();
renderResumeList();
```

The pattern is always **mutate → persist → re-render**. The lack of automatic reactivity is the price we pay for not having a framework. The benefit is that you can read any function and immediately see what it touches.

### Why `const` if we mutate it?

`const` only prevents reassignment of the binding (`state = ...`), not mutation of the object itself (`state.resumes = ...`). We never reassign `state`, so `const` is correct. The actual data inside changes constantly.

If we wanted to enforce immutability (à la Redux), we'd need `Object.freeze` or use a library. We choose not to — the mutation pattern is simpler at this scale.

## How tabs work

Five tab buttons at the top, five `<div class="tab-content">` containers below. Click handler:

```javascript
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');

    if (btn.dataset.tab === 'tracker') renderTracker();
    if (btn.dataset.tab === 'autofill') updateAutofillToolkit();
    if (btn.dataset.tab === 'match') renderMatchSelect();
  });
});
```

Translation:
1. Remove `.active` from all tabs
2. Add `.active` to clicked tab
3. Hide all tab-content
4. Show the one matching `data-tab` attribute
5. If we're showing certain tabs, re-render them so they're fresh (e.g., tracker stats might be stale)

This is the simplest possible "router." No URL changes, no history, no router library. The tradeoff: hitting refresh always returns to the first tab. We accept this.

### Why `data-*` attributes?

`data-tab="match"` on the button maps to `id="tab-match"` on the panel. We could've used CSS classes or onclick handlers, but `data-*` is purpose-built for "extra data on an element my JS reads." It's also self-documenting in DevTools.

## Why use `innerHTML` instead of `createElement`?

Compare:

```javascript
// Option A: innerHTML (what we use)
container.innerHTML = `<div class="card">${escapeHtml(title)}</div>`;

// Option B: createElement
const div = document.createElement('div');
div.classList.add('card');
div.textContent = title;
container.appendChild(div);
```

Both are correct. Option A is:
- More compact (1 line vs. 4)
- Reads like the HTML you'd write by hand
- Easier to nest (template strings nest naturally)

Option B is:
- Inherently XSS-safe (textContent doesn't parse HTML)
- Slightly faster (no string parsing)
- Allows attaching event listeners directly without re-querying

For a personal-scale tool, the readability of Option A wins. The XSS risk is mitigated by **always passing user-supplied strings through `escapeHtml()` first**. We use Option B only when we need to attach a listener immediately.

### The escapeHtml function

```javascript
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
```

It does two things:
1. Coerces `null`/`undefined` to empty string (via `?? ''`)
2. Replaces the 5 dangerous HTML characters with their entity equivalents

If you forget to call this on a user-supplied string, you have an XSS vulnerability. Audit any `${...}` interpolation: if the value originated from user input, it must be wrapped in `escapeHtml()`. The same applies to `escapeAttr()` for attribute values.

This pattern would be enforced for you by React (which auto-escapes interpolations). In vanilla JS it's discipline. Our code passes audit — every interpolation is either escaped or a hardcoded value.

## Form handling pattern

Forms in Career Dispatch never use `<form>` with submit handlers. We use plain `<input>` elements with a button that has a click handler. Example from Personal Dossier:

```html
<input type="text" data-profile="firstName">
<input type="email" data-profile="email">
...
<button id="btn-save-profile">Save Profile</button>
```

```javascript
document.getElementById('btn-save-profile').addEventListener('click', async () => {
  const profile = {};
  document.querySelectorAll('[data-profile]').forEach(el => {
    profile[el.dataset.profile] = el.value;
  });
  state.profile = profile;
  await saveProfile();
  toast('Profile saved');
});
```

The trick: every input has a `data-profile="fieldName"` attribute. The save handler queries all of them and builds a profile object. Adding a new field is one line of HTML — no JS changes needed.

This is a **declarative pattern using imperative tools**. The HTML declares what fields exist; the JS reads the declarations.

### Why not `<form>` + submit handler?

`<form>` adds:
- Default submit behavior (page reload) we'd have to prevent with `e.preventDefault()`
- Implicit Enter-to-submit (sometimes desired, sometimes not)
- Form validation API (we don't use it)

For consistency, none of our forms use `<form>`. We trigger save manually via button clicks. The exception: the API key input has an Enter handler (saved via keypress) because it's a single-field "form."

## Templates and string interpolation

Every render function follows this pattern:

```javascript
function renderResumeList() {
  const list = document.getElementById('resume-list');
  if (state.resumes.length === 0) {
    list.innerHTML = `<div class="empty-state"><h3>No resumes yet</h3></div>`;
    return;
  }
  list.innerHTML = state.resumes.map(r => `
    <div class="resume-card" data-id="${r.id}">
      <h3>${escapeHtml(r.name)}</h3>
      <div class="resume-meta">${escapeHtml(r.role || 'No target role')}</div>
      <button data-action="delete" data-id="${r.id}">Delete</button>
    </div>
  `).join('');

  // Attach event listeners after innerHTML is set
  list.querySelectorAll('button[data-action]').forEach(b => {
    b.addEventListener('click', () => handleResumeAction(b.dataset.action, b.dataset.id));
  });
}
```

Two phases:
1. Build full HTML string from data, set `innerHTML` (replaces all children)
2. Re-query for the new buttons and attach event listeners

This is **event delegation light**. We could attach one listener to the parent and check `e.target.dataset.action`, but per-button listeners are more readable here.

### The cost of this pattern

Every re-render replaces the entire DOM subtree. That means:
- All event listeners on those elements are lost (and we re-attach them)
- Form input state inside those elements is lost (we don't have any — Personal Dossier renders once)
- Animation/transition state restarts

For our use cases, this is fine. If we had a tab with mid-edit form state, we'd need to be careful not to re-render mid-edit.

## What's NOT in the web tool

- No service worker (the web tool itself doesn't register one — only the extension has one)
- No Web Workers (no offloaded computation)
- No SharedArrayBuffer / OffscreenCanvas / WebGL
- No drag-and-drop (the bookmarklet description in old versions used draggable, but the current extension flow doesn't)
- No touch event handlers (mouse/keyboard only)

These are all things you might want in a richer app. For this tool, they're absent because they're not needed.

## A complete trace: clicking "Save Resume"

To make this concrete, here's every step from click to persisted state:

1. User has typed a name and content into the Resume Library form
2. User clicks the button `<button id="btn-save-resume">+ Save Resume</button>`
3. Browser fires the click event
4. Our listener runs (defined with `addEventListener('click', async () => {...})`)
5. Listener reads `document.getElementById('resume-name').value.trim()` and similar
6. Validates: if name or content is empty, shows toast `Name and content required`, returns
7. Checks `document.getElementById('btn-save-resume').dataset.editing` — if set, this is an update; if not, a new resume
8. For new: pushes `{id: 'r_' + Date.now(), name, role, content, created: Date.now(), updated: Date.now()}` to `state.resumes`
9. Calls `await saveResumes()` which does `localStorage.setItem('career_dispatch_resumes', JSON.stringify(state.resumes))`
10. Calls `clearResumeForm()` to blank the inputs
11. Calls `renderResumeList()` — which rebuilds the entire saved-resumes section from `state.resumes`
12. Calls `renderMatchSelect()` — which rebuilds the dropdown in the Match Engine tab
13. Calls `toast('Resume saved')` which inserts a div into `#toast-root`, schedules its removal in 2.8s
14. Listener completes; user sees the new resume in the list and a toast notification

That's it. No virtual DOM diffing, no state machine transitions, no observable subscriptions firing. The flow is linear and traceable.

## Summary

The web tool's structure prioritizes **inspectability over abstraction**. You can scroll through `career-dispatch.html` and see every piece of state, every render path, every API call. Nothing is hidden behind a framework's machinery.

The cost of this transparency is that we manually do things frameworks would do for us (escaping, re-rendering, listener cleanup). The benefit is that any reasonably proficient JS developer can read the file and modify it within an hour.

In the next chapter we'll dig into the storage layer — how state is persisted, the structure of stored data, and how to safely migrate it.
