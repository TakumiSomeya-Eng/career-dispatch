# Chapter 4 — State Management & Persistence

This chapter covers how Career Dispatch stores and retrieves data, how the in-memory `state` synchronizes with `localStorage`, and how to safely evolve the data schema over time.

## The two layers

```
┌─────────────────────────────────────┐
│  In-memory state (JavaScript)       │
│                                     │
│  const state = {                    │
│    resumes: [...],                  │
│    profile: {...},                  │
│    savedMatches: [...],             │
│  }                                  │
└─────────────────────────────────────┘
              ↑↓ load / save
┌─────────────────────────────────────┐
│  Persistent storage (localStorage)  │
│                                     │
│  career_dispatch_resumes        → str │
│  career_dispatch_profile        → str │
│  career_dispatch_saved-matches  → str │
│  career_dispatch_api_key        → str │
└─────────────────────────────────────┘
```

The in-memory `state` is the "live" object the UI reads from and renders. `localStorage` is the durable store that survives page reloads. They synchronize via explicit `loadState()` and `save*()` functions — there's no automatic syncing.

## The storage helpers

```javascript
const STORAGE_PREFIX = 'career_dispatch_';

async function loadState() {
  try {
    const r = localStorage.getItem(STORAGE_PREFIX + 'resumes');
    if (r) state.resumes = JSON.parse(r);
  } catch(e) {
    console.error('Failed to load resumes:', e);
    state.resumes = [];
  }
  // ... same pattern for profile, savedMatches
}

async function saveResumes() {
  try {
    localStorage.setItem(STORAGE_PREFIX + 'resumes', JSON.stringify(state.resumes));
  } catch(e) {
    console.error('Failed to save resumes:', e);
    toast('⚠ Save failed: ' + e.message);
  }
}
```

Three things to notice:

### 1. The prefix

Every key uses `career_dispatch_` as a namespace. This prevents collisions with other tools running at the same origin. If the user opens 5 different localStorage-using HTML files from `file://`, they all share one origin's storage pool — without prefixing, key collisions would scramble data between apps.

### 2. The try/catch

`localStorage.setItem` can throw in three scenarios:
- Storage quota exceeded (~5MB hit)
- User has disabled localStorage in browser settings
- Browser is in a state where storage is temporarily unavailable (rare)

We catch and surface the error via toast. We never throw past the storage layer — UI code can call `await saveResumes()` and trust it won't crash.

`JSON.parse` can throw if stored data is corrupt (e.g., user manually edited it). We catch and reset to a safe default rather than crashing the boot sequence.

### 3. The async signature, despite sync internals

`localStorage.getItem` and `setItem` are **synchronous**. They block the main thread. So why are our wrappers `async`?

Two reasons:
- **API consistency**: if we ever migrate to IndexedDB or chrome.storage (both async), callers don't change. Calling `await saveResumes()` works either way.
- **Mental model**: persistence is conceptually I/O. Treating it as async even when implemented sync prepares developers for the day it actually is.

The cost is one microtask per call (negligible).

## Data schemas

### Resume

```javascript
{
  id: 'r_1742400000000',     // 'r_' + Date.now() at creation
  name: 'Senior PM — B2B SaaS',  // user-supplied display name
  role: 'Senior Product Manager', // optional target role
  content: '...',             // the full resume text
  created: 1742400000000,     // Date.now() at creation
  updated: 1742500000000,     // Date.now() at last edit
}
```

Stored as: `state.resumes` is `Array<Resume>`. The whole array is JSON-serialized.

Why `Date.now()` instead of UUIDs? Because at our scale, creating two resumes within the same millisecond is essentially impossible (the user would need superhuman click speed). `Date.now()` is shorter and human-readable in DevTools.

If two resumes did somehow collide on ID, the latest would overwrite the earlier on next save (last-write-wins). Acceptable for this domain.

### Profile

```javascript
{
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '555-1234',
  address: '123 Main St',
  city: 'San Francisco',
  state: 'CA',
  zip: '94110',
  linkedin: 'https://linkedin.com/in/janedoe',
  github: 'https://github.com/janedoe',
  portfolio: 'https://janedoe.dev',
  twitter: '',
  workAuth: 'us_citizen',     // enum: see Personal Dossier select options
  sponsorship: 'no',
  gender: '',                 // empty if user declined
  ethnicity: '',
  veteran: 'not_veteran',
  disability: 'no',
  salary: '$150,000',
  startDate: '2 weeks notice',
  relocate: 'depends',
  source: 'LinkedIn',
  referral: '',
  bio: 'PM with 7 years experience...',
}
```

A flat object. Each key corresponds to a `data-profile="..."` attribute on a form input. Adding a new field requires:

1. Add `<input data-profile="newField">` to the Personal Dossier HTML
2. (Optional) Add a corresponding mapping in `extension/content.js` if you want autofill to handle it

That's it. The save handler iterates `[data-profile]` elements automatically.

### Saved match (tracked application)

```javascript
{
  id: 't_1742400000000_3',    // 't_' + Date.now() + '_' + rowIndex
  company: 'Stripe',
  position: 'Senior Product Manager',
  careersUrl: 'https://stripe.com/jobs',
  applyUrl: 'https://boards.greenhouse.io/stripe?t=Product+Manager',
  searchLinks: [...],         // copy of the searchLinks array at save time
  matchScore: 87,
  resumeName: 'Senior PM — B2B SaaS',
  status: 'saved',            // saved | applied | interview | offer | rejected
  savedAt: 1742400000000,
  notes: '',                  // reserved for future feature
}
```

Notice that `searchLinks` is **a snapshot at save time**, not a reference. If we re-ran the match later, the live match might have different URLs (e.g., we improve link generation). The tracker preserves what was current when the user clicked Save. This is intentional for stability.

### API key

Stored as a plain string under `career_dispatch_api_key`. No object wrapper.

Why not encrypt it? Because:
- localStorage is per-origin already (other sites can't read it)
- The user's machine is trusted (anyone with physical access can read browser storage anyway)
- Encryption keys would themselves need to be stored somewhere — chicken-and-egg problem
- Real protection comes from OS-level disk encryption, not application-level obfuscation

If you want stronger protection, store the key in a password manager and paste it into the field each session.

## The save/render dance

Every state mutation follows this exact pattern:

```javascript
// 1. Mutate state
state.resumes.push(newResume);

// 2. Persist
await saveResumes();

// 3. Re-render affected views
renderResumeList();
renderMatchSelect();  // because the dropdown shows resumes too

// 4. (Optional) feedback
toast('Resume saved');
```

The order matters:
- **Persist before re-render**: if persist fails, we still re-render with the in-memory state, but at least the user sees a toast. If we re-rendered before persisting and then persistence failed, the UI would show data that's not actually saved.
- **All affected views**: a resume change affects both the Resume Library AND the dropdown in Match Engine. If we forgot to re-render the dropdown, it'd show stale data. (Tab switches re-render some things to mitigate this — see `renderMatchSelect()` called when entering the Match tab.)

This pattern is brittle in a "you must remember to call all the renders" way. Frameworks solve this with reactivity. We accept the brittleness for simplicity.

## What happens on first load (no stored data)

`loadState()` calls `localStorage.getItem(...)` for each key. Since they're all missing, `getItem` returns `null`. Our `if (r) ...` check is falsy, so we skip the JSON.parse. The state defaults defined at module top stay in effect:

```javascript
const state = {
  resumes: [],         // empty array
  profile: {},         // empty object
  savedMatches: [],    // empty array
};
```

The UI then renders the empty states (e.g., "No resumes yet"). The user can immediately begin populating data.

This means **fresh installs need zero special handling**. The empty defaults are the initial state.

## Inspecting and editing storage manually

DevTools is your friend:

1. Open the page (`career-dispatch.html`)
2. Press F12
3. Application tab (Chrome/Edge) or Storage tab (Firefox)
4. Local Storage → file:// (or wherever the page is hosted)
5. You'll see the four `career_dispatch_*` keys

Each value is a JSON string. You can:
- **Click to view**: see the raw JSON
- **Double-click to edit**: change the value (requires page reload to take effect in `state`)
- **Delete a key**: removes that data; on next reload, defaults to empty
- **Clear all**: nuclear option, wipes everything

This is how you'd manually:
- Restore a backup (paste the JSON back in)
- Wipe just the API key
- Migrate data from one machine to another (copy-paste the JSON values)

## Data backup

Career Dispatch doesn't have a "Export All Data" button. To back up:

1. Open DevTools → Application → Local Storage
2. Copy each `career_dispatch_*` value
3. Save them in a text file

To restore on a new machine:
1. Open `career-dispatch.html` once (creates the storage namespace)
2. DevTools → Local Storage → paste each value back

We could add a one-click backup feature; it's on the roadmap but not implemented. For now, the manual route works.

## Schema migration

What happens if a future version changes the data schema? E.g., adding a required field to Resume objects?

The current code does no migration. If you load v2 with v1 data, the missing fields are `undefined`, and the UI handles that gracefully (e.g., `r.role || 'No target role'` shows the default).

For breaking changes (renaming fields, restructuring objects), you'd add a migration step in `loadState()`:

```javascript
async function loadState() {
  // ... load resumes
  state.resumes = state.resumes.map(migrateResume);
}

function migrateResume(r) {
  // v1 → v2: 'role' became 'targetRole'
  if (r.role && !r.targetRole) {
    return { ...r, targetRole: r.role };
  }
  return r;
}
```

This is enough as long as migrations stay simple. If they become complex, version each schema explicitly:

```javascript
const SCHEMA_VERSION = 2;

const stored = JSON.parse(localStorage.getItem('resumes') || '[]');
const migrated = migrate(stored, stored.version || 1, SCHEMA_VERSION);
state.resumes = migrated.data;
```

We don't do this yet because we haven't had any breaking changes.

## chrome.storage.local (extension side)

The extension uses Chrome's storage API, not localStorage. Two reasons:

1. **localStorage is per-origin**, but extensions don't have a single origin in the usual sense. The extension's popup, content scripts, and background worker need shared access. `chrome.storage.local` is shared across all extension contexts.

2. **localStorage is synchronous** in MV3 service workers — actually, it's not even available there. Service workers can't use it. `chrome.storage.local` is the only option.

The API is async-first:

```javascript
// Read
const { profile } = await chrome.storage.local.get('profile');

// Write
await chrome.storage.local.set({ profile: newProfileObject });

// Remove
await chrome.storage.local.remove('profile');
```

Notice you store actual objects (not JSON strings). Chrome handles serialization for you. The storage limit is much higher than localStorage (5–10MB by default, more if you request "unlimited" permission).

The extension's profile copy is independent from the web tool's copy. Updating one does not update the other. The user must manually re-import via the popup's Import button.

## Summary

State management in Career Dispatch is **explicit, manual, and traceable**. Every piece of state has:
- A defined location (`state.X` in memory, `career_dispatch_X` in storage)
- A defined save function (`saveX()`)
- A defined load step in `loadState()`
- A defined re-render that consumes it

There are no observers, no auto-sync, no derived state libraries. If something is wrong, you can inspect storage, inspect the in-memory `state`, and step through one save call to diagnose.

This approach scales to dozens of properties. Beyond that, you'd want either reactivity (a framework) or a state machine library (XState). For Career Dispatch's scope, neither is justified.

In the next chapter we'll cover the most distinctive piece of the system: how the Match Engine talks to Claude.
