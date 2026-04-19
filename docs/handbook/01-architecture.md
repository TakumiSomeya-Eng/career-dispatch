# Chapter 1 — Overview & Architecture

## What Career Dispatch is, mechanically

Career Dispatch is two cooperating programs that share data via a JSON file the user manually carries between them.

```
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│   WEB TOOL (career-dispatch.html)│         │   CHROME EXTENSION              │
│   Runs in any browser tab       │         │   Runs in Chrome's extension    │
│                                 │         │   sandbox + content scripts     │
│   ┌─────────────────────────┐  │         │                                 │
│   │ Resume Library          │  │         │   ┌─────────────────────────┐  │
│   │ Personal Dossier        │  │ profile │   │ popup.html              │  │
│   │ Match Engine (→ Claude) │──┼─.json───┼──▶│  - Profile import       │  │
│   │ Application Tracker     │  │ (manual│   │  - Manual field picker  │  │
│   │ Autofill Toolkit (export)│  │ export │   │  - Trigger autofill     │  │
│   └─────────────────────────┘  │ /import)│   └─────────────────────────┘  │
│                                 │         │                                 │
│   localStorage:                 │         │   chrome.storage.local:         │
│   - resumes                     │         │   - profile                     │
│   - profile                     │         │                                 │
│   - saved-matches               │         │   content.js (injected per page)│
│   - api_key                     │         │   - field detection             │
└─────────────────────────────────┘         │   - smart filling               │
                                            │                                 │
                                            │   background.js (service worker)│
                                            │   - keyboard shortcut handler   │
                                            └─────────────────────────────────┘
                                                          │
                                                          ▼
                                            ┌─────────────────────────────────┐
                                            │  Job application page (any URL) │
                                            │  e.g., boards.greenhouse.io/... │
                                            └─────────────────────────────────┘
```

## Why two programs, not one?

The functions split cleanly along a hard browser boundary:

- The **web tool** is a regular webpage. It can render UI, store user data locally, and call APIs from JavaScript. But it **cannot read or write fields on pages it isn't running on**. There's no way for `career-dispatch.html` (running in tab A) to fill a form on a page in tab B. Browsers prevent this for security reasons.

- The **extension** has the missing capability: extensions can inject scripts (`content.js`) into other tabs and manipulate the DOM there. But extensions are awkward for complex UI — they're meant for focused, contextual actions, not full applications.

So: complex UI lives in the web tool. Cross-tab DOM access lives in the extension. The two share data via a JSON file the user moves between them.

This split is a **deliberate constraint**, not an oversight. A "do everything" browser extension would have a worse popup UX, would need its own AI matching code duplicated, and would lock the user into one browser. A "web tool only" approach can't autofill anywhere except its own tab.

## The data flow, end to end

Imagine a user named Maya runs the full workflow once. Here's what happens at every layer:

### 1. Maya creates a resume

She opens `career-dispatch.html` (tab in Chrome). She types resume content into a `<textarea>`. She clicks "Save Resume."

JavaScript event handler fires. It pushes a new object to `state.resumes` (an in-memory array). Then it calls `localStorage.setItem('career_dispatch_resumes', JSON.stringify(state.resumes))`. Persistence is instant.

### 2. Maya runs the Match Engine

She picks her resume, types `Japanese speaking` in the keywords field, hits Generate Matches.

JavaScript builds a prompt string. It POSTs to `https://api.anthropic.com/v1/messages` with her API key in the `x-api-key` header. **Critical**: this request goes from her browser tab directly to Anthropic. No Career Dispatch server exists. Her API key is sent only to Anthropic and never leaves her machine for any other destination.

Anthropic returns a JSON response containing a text field with a JSON array of company objects. The code parses it, then enriches each entry with generated search URLs (job board links, Google searches, LinkedIn recruiter searches). The enriched array is rendered as a table.

### 3. Maya saves a match to her tracker

Click "Save" → another array (`state.savedMatches`) gets a new entry, `localStorage` updates, the tracker tab now shows the company.

### 4. Maya clicks the LinkedIn recruiter link

This opens `linkedin.com/search/results/people/?keywords=...` in a new tab. The link was constructed at match-time from the company name and a fixed query template. Once the page is open, Career Dispatch's involvement ends — she's just on LinkedIn now.

### 5. Maya goes to apply for a role

She clicks the company's careers link, finds the role, hits "Apply." She lands on a Greenhouse-hosted application page. **Now the web tool is irrelevant** — it's a separate tab, can't see this page.

She presses **⌘⇧F**.

The keyboard shortcut is registered by the extension's `manifest.json`. Chrome routes the keypress to the extension's `background.js` service worker. That worker reads the active tab's ID, fetches the saved profile from `chrome.storage.local`, and sends a message: `chrome.tabs.sendMessage(tabId, {type: 'AUTOFILL', profile})`.

The message arrives at `content.js`, which has been injected into the application page automatically (per the `<all_urls>` host permission). Content.js iterates over every `<input>`, `<textarea>`, and `<select>` on the page, computes a 7-source identifier string for each (label text, name, id, placeholder, aria-label, ancestor label, sibling legend), tests it against regex patterns mapped to profile fields, and fills matches using a native setter that bypasses React/Vue's synthetic event system.

The user sees fields flash yellow, a black toast says "⚡ Filled 14 fields", and she reviews/submits.

### Where each piece of state lives

| Data | Storage location | Lifetime | Scope |
|------|-----------------|----------|-------|
| Resumes | `localStorage['career_dispatch_resumes']` | Until user clears browser data | Per-origin (file:// counts as one origin) |
| Profile (web tool copy) | `localStorage['career_dispatch_profile']` | Same | Same |
| Saved matches | `localStorage['career_dispatch_saved-matches']` | Same | Same |
| API key | `localStorage['career_dispatch_api_key']` | Same | Same |
| Profile (extension copy) | `chrome.storage.local['profile']` | Until extension uninstalled | Per-extension, all tabs |
| Currently displayed match list | JavaScript variables only | Until page reload | Current tab only |

The extension's profile copy is **independent** from the web tool's copy. Updating the dossier in the web tool does not auto-update the extension. The user must re-export and re-import. This is a deliberate simplification: there's no sync protocol, no shared storage, no daemon. The trade-off is that the user must remember to re-import after edits.

## What's NOT in this architecture

### No backend

There is no Career Dispatch server. Nothing the user does is logged anywhere except their own browser. This is enforced structurally, not by promise — there's literally no server URL anywhere in the code.

### No build step

The web tool is a single file you can open by double-clicking. The extension is a folder Chrome reads directly. There's no webpack, no Babel, no transpilation, no minification. What you write is what runs.

### No framework

No React, Vue, Svelte, or Angular. The UI is rendered by string interpolation into `innerHTML` and re-rendered on demand by re-running render functions. Every render is full (no virtual DOM diffing). This is fast enough because the data sizes are small (dozens of resumes max, hundreds of matches max).

### No bundled dependencies

The only third-party assets are three Google Fonts loaded via `<link>` (Fraunces, Inter Tight, JetBrains Mono). No npm, no node_modules. Stripping those would let it work fully offline.

### No real-time sync, no accounts, no telemetry, no analytics, no error reporting

By design.

## When this architecture would NOT be the right choice

Be honest with yourself: this architecture works because Career Dispatch is a personal-scale tool with very specific properties. It would be a bad choice for:

- **Multi-user collaboration**: no shared state means no team usage
- **Mobile-primary use**: the extension is desktop-only
- **Real-time updating data**: no server means no push notifications, no live sync
- **Enterprise compliance**: bring-your-own-key direct API calls don't pass most enterprise security reviews
- **Anything that needs server-side computation**: heavy ML inference, video processing, etc.

The right architecture for those would involve a backend, accounts, and possibly a proper SPA framework. We chose differently because we deliberately wanted local-first, single-user, hackable software. Match the architecture to the actual requirements — copying this design into the wrong context will hurt.

## Summary in one sentence

Career Dispatch is **a webpage that talks to Claude + a Chrome extension that fills forms, communicating via a JSON file the user copies between them, with all state stored in two independent local key-value stores.**

In the next chapter we'll examine *why* each technology choice was made.
