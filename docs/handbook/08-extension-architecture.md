# Chapter 8 — Chrome Extension: Manifest V3 Architecture

This chapter explains how the Chrome extension is structured, what each file does, and how the pieces communicate.

## The four execution contexts

A Chrome extension runs code in **multiple isolated contexts** that share data via message passing. Career Dispatch uses four of them:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Chrome Browser                          │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │ Service      │    │ Popup window │    │ Web page        │   │
│  │ Worker       │    │ (popup.html) │    │ (any tab)       │   │
│  │ (background  │    │              │    │                 │   │
│  │  .js)        │    │ popup.js     │    │ content.js      │   │
│  │              │    │              │    │ (injected)      │   │
│  │ - keyboard   │    │ - profile    │    │ - reads DOM     │   │
│  │   shortcut   │    │   import     │    │ - fills fields  │   │
│  │ - routing    │    │ - manual     │    │                 │   │
│  │              │    │   picker     │    │                 │   │
│  └──────┬───────┘    └──────┬───────┘    └────────┬────────┘   │
│         │                    │                     │            │
│         │   chrome.runtime   │   chrome.tabs       │            │
│         └────.sendMessage────┴────.sendMessage─────┘            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  chrome.storage.local                                    │  │
│  │  Shared across all extension contexts                    │  │
│  │  Holds: profile                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

Each context:
- Runs in its own JavaScript environment
- Cannot directly access variables in other contexts
- Communicates via `chrome.runtime.sendMessage()` (extension-to-extension) or `chrome.tabs.sendMessage()` (to content scripts)
- Reads shared data via `chrome.storage.local`

## File-by-file

### `manifest.json` — The extension's spec sheet

```json
{
  "manifest_version": 3,
  "name": "Career Dispatch — Autofill",
  "version": "1.0.0",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  "action": {
    "default_popup": "popup.html"
  },
  "commands": {
    "autofill": {
      "suggested_key": {
        "default": "Ctrl+Shift+F",
        "mac": "Command+Shift+F"
      }
    }
  }
}
```

This file declares everything Chrome needs to know:

| Key | What it does |
|-----|--------------|
| `manifest_version: 3` | We're an MV3 extension (current standard) |
| `permissions` | What APIs we'll use: storage (chrome.storage), activeTab (current tab), scripting (inject scripts) |
| `host_permissions: <all_urls>` | We need to run on any website (because we don't know in advance which job sites the user will visit) |
| `background.service_worker` | Points to the script that handles extension-level events |
| `content_scripts` | Scripts injected into web pages. We inject content.js into all URLs |
| `action.default_popup` | The popup that opens when the user clicks our icon |
| `commands.autofill` | Defines the keyboard shortcut |

Chrome reads this file at load time. Any change to `manifest.json` requires reloading the extension via `chrome://extensions`.

### `background.js` — The service worker

In Manifest V2, this was a "background page" (a hidden HTML page that ran continuously). In MV3, it's a service worker — a stateless script that wakes up to handle events and goes dormant when idle.

Our service worker is tiny:

```javascript
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'autofill') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  const { profile } = await chrome.storage.local.get('profile');
  if (!profile) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const n = document.createElement('div');
        n.style.cssText = '...'; // toast styling
        n.textContent = '⚠ No profile loaded. Click the Career Dispatch icon to import.';
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 4000);
      }
    });
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL', profile }, (res) => {
    void chrome.runtime.lastError; // ignore if content script not ready
  });
});
```

Step-by-step:
1. **Listen for the keyboard shortcut.** Chrome routes the user's `Ctrl+Shift+F` to this handler.
2. **Find the active tab.** We need its ID to send messages.
3. **Load the saved profile** from `chrome.storage.local`.
4. **If no profile**, inject a notification onto the active tab via `chrome.scripting.executeScript` (an arbitrary one-off script).
5. **If we have a profile**, send a message to the content script: "fill the form using this data."

The `void chrome.runtime.lastError;` line is a defensive trick. If `sendMessage` fails (e.g., no content script in the tab), Chrome sets `chrome.runtime.lastError`. Reading it (and discarding) prevents Chrome from logging "Unchecked runtime.lastError" in the console.

### `content.js` — Injected into every web page

This is the largest file. It runs in the context of every page (because of `<all_urls>` in manifest), but it doesn't do anything until it receives a message.

The key insight: **content scripts run in an isolated world**. They can read and modify the page's DOM, but they have a separate JavaScript context. The page's own JS can't see content script variables, and vice versa.

What's in content.js:
1. **Field mapping definitions** (`TEXT_FIELD_MAP`, `SELECT_FIELD_MAP`, `SELECT_VALUE_HINTS`) — covered in chapter 9
2. **Helper functions** (`norm`, `getLabelText`, `setNativeValue`, `highlight`, `showToast`)
3. **Fill logic** (`fillTextFields`, `fillSelects`, `fillRadios`, `runAutofill`)
4. **Manual picker mode** (`activatePicker`)
5. **Message handler** at the bottom:

```javascript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'AUTOFILL') {
    const count = runAutofill(msg.profile);
    sendResponse({ count });
  } else if (msg.type === 'PICK_FIELD') {
    activatePicker(msg.profile, msg.key);
    sendResponse({ ok: true });
  } else if (msg.type === 'PING') {
    sendResponse({ ok: true });
  }
  return true;
});
```

The `return true` at the end is critical. It tells Chrome we'll respond asynchronously (even though our handlers happen to be sync). Without it, the response gets dropped.

### `popup.html` + `popup.js` — The toolbar UI

When the user clicks our extension's icon, Chrome opens this HTML in a small floating window. It's a regular webpage with full DOM and JavaScript access, but **a separate context from any tab**.

popup.html structure:
```html
<div class="header">
  <div class="logo">Career*Dispatch</div>
</div>
<div class="content">
  <div id="status-bar">...</div>
  <div class="section">
    <button id="btn-import">Import</button>
    <input type="file" id="file-input">
  </div>
  <div class="section">
    <button id="btn-autofill">Autofill This Page</button>
  </div>
  <div class="section" id="picker-section">
    <div id="field-list"></div>
  </div>
</div>
<script src="popup.js"></script>
```

popup.js handles:
- Reading current profile from `chrome.storage.local` and displaying status
- Importing a new profile from a file (via `<input type="file">`)
- Triggering autofill on the active tab
- Activating manual picker mode for individual fields

Example: the autofill button:

```javascript
btnAutofill.addEventListener('click', async () => {
  const profile = await getProfile();
  if (!profile) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL', profile });
    showMiniToast(`⚡ ${res?.count ?? 0} field(s) filled`);
    setTimeout(() => window.close(), 900);
  } catch (e) {
    showMiniToast('⚠ Cannot access this page', true);
  }
});
```

This is **the popup talking to the content script**. The popup gets the profile, finds the active tab, and tells that tab's content script to fill fields. Same effect as the keyboard shortcut, just triggered from the UI.

The `window.close()` at the end auto-closes the popup after a brief success display.

## Message passing patterns

Chrome extensions have two main APIs for inter-context messaging:

### `chrome.runtime.sendMessage` — Within the extension

Used for popup ↔ background communication. Both run in the extension's context.

```javascript
// In popup.js
const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });

// In background.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATS') {
    sendResponse({ count: 42 });
  }
  return true;
});
```

We don't actually use this API in Career Dispatch — popup talks directly to content scripts via `chrome.tabs.sendMessage`. But it's useful to know exists.

### `chrome.tabs.sendMessage` — Extension to content script

Used for popup → content script and background → content script communication.

```javascript
// From popup or background
const response = await chrome.tabs.sendMessage(tabId, { type: 'AUTOFILL', profile });

// In content.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'AUTOFILL') {
    sendResponse({ count: runAutofill(msg.profile) });
  }
  return true;
});
```

This is the primary communication pattern in Career Dispatch.

The `await` works because Chrome wraps `sendMessage` in a promise (in MV3). It rejects if the target tab has no listener (e.g., a chrome:// page where content scripts can't run).

## The service worker lifecycle

Service workers in MV3 are **not always running**. Chrome starts them when an event they're registered for fires (like our `onCommand` listener). They idle for ~30 seconds, then Chrome terminates them to save memory.

Implications:
- **No global state across invocations.** A variable defined at the top of background.js exists only as long as the worker is alive. Don't rely on it persisting.
- **Storage is for persistence.** Anything the worker needs across runs goes in `chrome.storage.local`.
- **First call is slower.** Cold-start adds ~50ms. For our use case (one-shot keyboard handler), it's imperceptible.

If you need persistent in-memory state in MV3, you have to redesign — either persist on every change, or use the offscreen document API for limited cases.

## Permissions philosophy

Career Dispatch requests:

```json
"permissions": ["storage", "activeTab", "scripting"],
"host_permissions": ["<all_urls>"]
```

| Permission | Why we need it |
|------------|---------------|
| `storage` | To save the user's profile in `chrome.storage.local` |
| `activeTab` | To send messages to the currently focused tab |
| `scripting` | To inject the "no profile loaded" notification when triggered without a profile |
| `<all_urls>` | To run our content script on any job application site |

`<all_urls>` is the broadest possible host permission. Chrome shows users a scary warning during installation: "Read and change all your data on all websites."

Why we need this: we don't know in advance which job application sites our users will visit. Greenhouse alone uses dozens of subdomains (boards.greenhouse.io, job-boards.greenhouse.io, jobs.companyname.com, etc.). Restricting to a fixed list would miss real sites.

The mitigation: we **only run when the user explicitly triggers us** (keyboard shortcut or popup button click). Our content script does nothing on page load — it just registers a message listener. It only modifies the DOM in response to a user-initiated request.

If you wanted stricter permissions, you'd:
- Use `optional_host_permissions` and request access per-site at runtime
- Restrict to specific known ATS domains

We chose breadth + behavioral discipline over technical restriction.

## Testing the extension during development

The dev loop:

1. Edit a file (`content.js`, `popup.js`, `manifest.json`, etc.)
2. Go to `chrome://extensions`
3. Find Career Dispatch in the list
4. Click the ↻ refresh icon on the extension card
5. **For content script changes**: also refresh any tabs you want to test on (content scripts are injected at page load)
6. **For popup changes**: just close and reopen the popup
7. **For background changes**: the service worker reloads automatically

To debug:
- **Content script**: open DevTools on the target page (F12) — content script logs appear in the page's Console
- **Background**: in `chrome://extensions`, click "Service worker" link under Career Dispatch — opens DevTools for the worker
- **Popup**: right-click the popup → "Inspect" — opens DevTools for the popup window

## What's NOT in our extension

- **No options page** (most extensions have one for settings; we keep settings minimal in the popup)
- **No badge text** on the icon (no notifications to display)
- **No omnibox integration** (would be `chrome_url_overrides` for new tab page customization)
- **No declarative net request** (no network filtering)
- **No alarms** (no scheduled tasks)
- **No notifications** (no system-level alerts)
- **No native messaging** (no communication with native applications)

Each of these is a feature you could add. None is needed for the core autofill flow.

## Summary

The extension's architecture is **three communicating contexts plus shared storage**:

- **Service worker** handles top-level events (keyboard shortcut)
- **Popup** handles UI for profile management
- **Content script** lives on every page, fills forms when asked

They communicate via `chrome.tabs.sendMessage` and read shared state from `chrome.storage.local`.

This split is mandated by Chrome's security model. You can't have one big script that does everything — Chrome enforces context isolation. The split makes the design more verbose but more secure.

In the next chapter we'll dig into the heart of the extension: how `content.js` actually fills form fields.
