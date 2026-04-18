# Career Dispatch — Chrome Extension

Companion browser extension for the Career Dispatch job-hunting tool. Autofills US job applications with your saved profile using smart field detection.

## Features

- **Keyboard shortcut**: `⌘⇧F` (Mac) or `Ctrl+Shift+F` (Win/Linux) — autofill any application page instantly
- **Smart matching** — detects fields via labels, placeholders, `name`, `id`, `aria-label`, and ancestor label text
- **React/Vue/Workday compatible** — uses native setters to trigger synthetic event handlers properly
- **EEO field support** — handles voluntary self-ID dropdowns (gender, race, veteran, disability) on Greenhouse/Lever/Workday
- **Manual picker mode** — click the extension icon → pick a specific field → click it on the page for one-off fills
- **Non-destructive** — skips fields you've already filled

## Installation

1. **Unzip** this folder to a location you'll keep (the extension loads from this folder — don't delete it)
2. Open Chrome/Edge/Brave/Arc and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle, top-right)
4. Click **Load unpacked** and select the unzipped folder
5. You should see "Career Dispatch — Autofill" in your extension list

## Setup

1. Open the Career Dispatch tool (HTML artifact)
2. Fill out your Personal Dossier
3. Go to the **Autofill Toolkit** tab
4. Click **⬇ Export Profile (profile.json)**
5. Click the Career Dispatch extension icon in your browser toolbar
6. Click **⬆ Import** and select the `profile.json` you downloaded
7. Done — the extension is ready

## Usage

### Quick autofill (recommended)
On any job application page, press `⌘⇧F` (Mac) or `Ctrl+Shift+F` (Win/Linux). A notification shows how many fields were filled.

### Manual single-field fill
Click the extension icon → click a specific field from the list → click the target field on the page. Press `ESC` to cancel.

### Updating your profile
After editing your dossier, re-export `profile.json` and re-import via the popup. The stored copy is independent until you re-import.

## Tested on

- Greenhouse, Lever, Workday, Ashby, iCIMS, Jobvite, SmartRecruiters, Taleo — major US ATS platforms
- Gmail / LinkedIn Easy Apply — not supported (different architectures)

## Privacy

- Profile data is stored locally in your browser only (`chrome.storage.local`)
- Nothing is sent to any server; the extension makes no network requests
- The extension has `<all_urls>` host permission because it needs to run on any ATS page — but it only fills fields when you explicitly trigger it

## Troubleshooting

- **"Cannot access this page"** — Chrome blocks extensions on some pages (chrome://, the Chrome Web Store, certain internal tool pages). The extension works on all normal sites.
- **Fields not detected** — use the Manual Picker mode to fill those specific fields.
- **Dropdown selects wrong option** — report the site; the semantic matcher can be extended with more value hints in `content.js`.

## Files

- `manifest.json` — extension configuration
- `background.js` — service worker (handles keyboard shortcut)
- `content.js` — injected into every page (field detection + fill logic)
- `popup.html` / `popup.js` — extension icon UI
- `icons/` — extension icons

## Changing the keyboard shortcut

Visit `chrome://extensions/shortcuts` in Chrome to customize.
