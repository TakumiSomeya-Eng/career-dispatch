# Contributing to Career Dispatch

Thanks for considering a contribution. This is a personal-scale tool, so the bar for changes is:
1. Does it make US job hunting meaningfully easier?
2. Does it respect the local-first, privacy-first design?
3. Does it fit the Editorial aesthetic?

## Development setup

No build step required. Just edit and refresh.

### Web tool
Open `career-dispatch.html` directly in a browser. Changes apply on reload.

### Chrome extension
1. Load unpacked from `chrome://extensions`
2. After edits, click the ↻ refresh icon on the extension card
3. Refresh any page you want to test autofill on

## What to contribute

### High-value additions
- **New ATS support** — add a case in `buildSearchLinks()` and `getAtsDomain()` in `career-dispatch.html`. Test with a few real companies using that ATS.
- **Field detection improvements** — update regex patterns in `content.js` for specific sites that aren't filling correctly. Please note the site you tested on in the PR.
- **Option-matching hints** — add entries to `SELECT_VALUE_HINTS` in `content.js` when you find dropdowns that don't match correctly.
- **Roadmap features** — the README lists planned features. Pick one and draft a design proposal first.

### Things that will likely be rejected
- External dependencies (React, bundlers, CSS frameworks). The single-file simplicity is intentional.
- Server-side anything. Local-only is a core property.
- Data collection / analytics.
- Design overhauls that abandon the Editorial aesthetic.

## Pull request checklist
- [ ] Tested on at least 2 browsers (Chrome + one other Chromium-based)
- [ ] No personal data in commits (check `git diff` for anything resembling an email, phone, API key, or address)
- [ ] Screenshots for UI changes
- [ ] Updated README if behavior changes

## Reporting bugs

Include:
- Browser + version
- The specific job application URL (if public)
- What you expected vs. what happened
- Browser console errors (F12 → Console)

## Code style

- **Vanilla JS, ES modules** — no frameworks
- **2 spaces** indentation
- **Descriptive function names** over comments where possible
- **CSS variables** for all colors — see the `:root` block

## Security

If you find a security issue, please open a private issue rather than a public PR.
