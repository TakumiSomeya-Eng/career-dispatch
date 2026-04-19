# Chapter 10 — Security, Privacy & Trade-offs

This chapter is about the security model, the privacy guarantees, and the explicit decisions we made that involve trade-offs. Read this before forking the project for a different use case.

## The threat model

Career Dispatch is designed for **a single user running it on their own personal machine**. The threats we protect against:

- ✅ Other websites stealing the user's data via XSS
- ✅ Other websites reading the user's data via cross-origin requests
- ✅ The user accidentally exposing data by sharing a URL
- ✅ Network observers reading the user's profile in transit (HTTPS only)
- ✅ The Career Dispatch developers accessing user data (we have no server, can't see anything)

The threats we **don't** protect against:

- ❌ Someone with physical access to the user's unlocked machine
- ❌ Malware running with browser-level privileges
- ❌ The user being phished into pasting their API key into a fake Career Dispatch
- ❌ The Anthropic API being compromised (out of our control)
- ❌ Other browser extensions reading our localStorage (extensions can read all sites' storage by default)

If your threat model includes any of the latter, **Career Dispatch is not the right tool for you**.

## API key storage

The user pastes their Anthropic API key into the Match Engine tab. We store it in `localStorage`:

```javascript
localStorage.setItem('career_dispatch_api_key', val);
```

### Why not encrypt?

We considered it. We rejected it for reasons covered in chapter 4. Briefly:
- We'd need a key to encrypt with. Where do we store that? localStorage. Now we've moved the problem.
- Asking the user for a master password every session degrades UX significantly.
- Real protection comes from OS-level disk encryption, not application-level obfuscation.

If a malicious browser extension reads our localStorage, it can read the key whether we encrypt or not — it'll have access to whatever decryption logic we use too.

### Risk: shared device

If a user runs Career Dispatch on a shared computer (say, a hotel business center) and forgets to clear browser data, the next user could find their API key.

Mitigations:
- The "Clear Key" button in the UI explicitly removes it
- The API key is shown in the UI as masked (only first 12 + last 4 chars visible)
- The user is implicitly responsible for their browser's session hygiene

For shared-device use, we recommend "private browsing" mode — localStorage doesn't persist across private sessions.

## Direct browser → Anthropic API

The biggest single security trade-off in the project.

### The standard pattern

For production SaaS, you'd never let the browser call third-party APIs with user-owned credentials directly. You'd build a proxy:

```
User browser
    ↓ HTTPS, your API key
Your backend
    ↓ HTTPS, your API key
Anthropic
```

This way:
- Your API key (or per-user keys) never touches the browser
- You can rate-limit, log, and bill server-side
- You can sanitize requests
- You can swap providers transparently

### The Career Dispatch pattern

```
User browser → Anthropic
   (with user's own API key)
```

Why we accept this:

1. **There is no Career Dispatch server.** That's a foundational property of the product.
2. **The user owns their key.** They created it on console.anthropic.com, they're billed for it, they can rotate it.
3. **The key never reaches us.** It's stored only on the user's machine, sent only to Anthropic. We literally cannot see it.

### The anthropic-dangerous-direct-browser-access header

Anthropic gates this pattern behind an explicit acknowledgment:

```javascript
headers: {
  "anthropic-dangerous-direct-browser-access": "true"
}
```

This header is required for the request to succeed from a browser context. Without it, Anthropic's CORS policy rejects the request.

The header's name is intentional. Anthropic wants developers to **think** about whether they should be doing this. We did. For our use case (personal-scale, local-first, BYOK), it's appropriate. For a redistributed SaaS, it would be wrong.

### When this would break our model

If we ever:
- Hosted Career Dispatch as a service (`career-dispatch.com/app`)
- Issued API keys to users
- Wanted to log usage centrally

…we'd need to add a backend immediately. The browser-direct pattern only works because we **never redistribute the running app — the user runs their own copy**.

## XSS prevention

Cross-site scripting is the bug that lets attackers inject JavaScript into your page. In Career Dispatch's case, an XSS could steal the API key and saved profile.

The vector: user-supplied strings interpolated into HTML without escaping.

```javascript
// DANGEROUS
container.innerHTML = `<div>${userInput}</div>`;

// SAFE
container.innerHTML = `<div>${escapeHtml(userInput)}</div>`;
```

Our discipline: every dynamic value going into a template via `${...}` must pass through `escapeHtml()` (or `escapeAttr()` for attribute contexts).

The `escapeHtml` function:

```javascript
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
```

It replaces five characters with their HTML entity equivalents:
- `&` → `&amp;` (must be first to avoid double-escaping)
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&#39;`

These five characters are the only ones that matter for HTML parsing. After escaping, the string is safe to interpolate as text content.

### Audit-able

Search the codebase for `${`. Every match should either:
- Be a hardcoded value (`${someConstant}`)
- Be wrapped in `escapeHtml(...)` or `escapeAttr(...)`
- Be a numeric value where escaping is unnecessary (`${index}`, `${count}`)

We pass this audit. It's worth re-running after every change.

### What about innerHTML for trusted strings?

You might think: "the resume name is user input, but the user typed it themselves, so XSS isn't a concern."

Wrong. The user might:
- Paste content from an email that contained malicious HTML
- Be tricked into entering data designed to attack themselves
- Have their data manipulated externally (corrupted localStorage, malware, etc.)

Always escape. The cost is negligible; the protection is total.

## Content Security Policy

We don't currently set a CSP for the web tool. If we did, it'd look something like:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  font-src https://fonts.gstatic.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  script-src 'self';
  connect-src https://api.anthropic.com;
">
```

This would forbid:
- Scripts from any source other than our own file
- Network requests to anything except api.anthropic.com
- External stylesheets except Google Fonts

Adding CSP is a hardening improvement; we'll do it in a future version.

## CORS for the extension

Content scripts can fetch from any URL by default — they share the host page's origin. So our extension could fetch the page being autofilled and transmit it elsewhere. We don't, of course, but Chrome would let us.

Mitigation: we make zero network requests from `content.js`. It's a pure DOM-manipulation script. Audit confirms: no `fetch`, no `XMLHttpRequest`, no `chrome.runtime.sendMessage` to anywhere except the popup/background.

## chrome.storage.local visibility

The extension's profile data lives in `chrome.storage.local`. It's:
- Visible to: the extension itself (popup, background, content scripts)
- NOT visible to: web pages, other extensions

If the user uninstalls the extension, this data is wiped automatically.

If you wanted persistence across uninstalls (sync across devices), you'd use `chrome.storage.sync` instead. We don't, because:
- Sync uploads to Google's servers (under the user's Google account)
- We want zero off-device storage by default

## Host permissions and the ⚠ warning

When users install our extension, Chrome shows:

> "Career Dispatch — Autofill" can:
> Read and change all your data on all websites

This is the standard MV3 warning for `<all_urls>` host permission.

We could request narrower permissions:
- `optional_host_permissions` with per-site grants — would require user confirmation per ATS site, friction-heavy
- `host_permissions` restricted to `*://*.greenhouse.io/*`, `*://*.lever.co/*`, etc. — would miss custom company URLs

We chose breadth for usability. The mitigation is behavioral: the extension only acts when the user explicitly triggers it. No background scraping, no auto-collection.

If a security-conscious user wants to verify, they can open `chrome://extensions`, click "Details" on Career Dispatch, and inspect:
- The source code (it's all unpacked)
- The network activity (none, by inspection)
- The storage (just the profile)

## Privacy promises

What Career Dispatch does NOT do, structurally enforced:

| Activity | Why we can't do it |
|----------|-------------------|
| Track users | No analytics SDK, no telemetry endpoint |
| Identify users | No accounts, no logins |
| Sell data | No data leaves the user's machine (except API calls to Anthropic) |
| Phone home | No background polling, no auto-update check |
| Build user profiles | No central database |
| Share data with partners | No partners, no integrations |

These aren't promises in a privacy policy — they're properties of the code. You can verify them by reading the source.

## What Anthropic sees

When the user runs the Match Engine:
- The user's resume content is sent to Anthropic (it's in the prompt)
- Anthropic processes it via Claude
- Anthropic returns the result
- Per Anthropic's data policy, requests may be logged for abuse detection but are not used for model training (for API usage, not consumer Claude.ai)

If a user is sensitive about resume content reaching Anthropic, they should use a sanitized resume (no full name, no specific employer dates) for matching.

This is a trade-off the user makes implicitly by using AI matching. We surface it indirectly via the BYOK pattern — the user actively chose to call Anthropic.

## What LinkedIn sees

When the user clicks a recruiter outreach link, it opens LinkedIn People Search in a new tab. From that point:
- LinkedIn knows the user is searching for recruiters at company X
- LinkedIn can correlate this with the user's account (if logged in)
- LinkedIn's normal data practices apply

We don't pre-load any data into LinkedIn. We just open a search URL. The user's interaction with LinkedIn is between them and LinkedIn.

## Recommendations for users

If you care about privacy:
- Use Brave or Firefox (more privacy-respecting defaults than Chrome)
- Use a separate Chrome profile for job hunting (isolates browsing data)
- Use private/incognito mode if on a shared computer (data evaporates on close)
- Rotate your Anthropic API key periodically (in case of leaks)
- Disable the extension when not actively job hunting (host permissions are only granted while installed)

For developers forking this project:
- Don't add analytics
- Don't add a backend that could leak data
- Don't store anything externally
- Maintain the audit-able simplicity

## Summary

Career Dispatch's security model is **simple by design**. We have:
- A web tool that only talks to Anthropic
- An extension that only manipulates DOM in response to user actions
- Local storage for everything

The trade-offs we accept:
- API key visible in browser (no encryption layer)
- `<all_urls>` host permission (broad access for the extension)
- BYOK direct API calls (instead of proxied through a backend)

Each trade-off is a deliberate choice for the personal-scale, local-first use case. Each would be wrong for a different context.

The strongest privacy guarantee comes from **the absence of a server**. We literally cannot collect, sell, or leak data we never receive.

In the next chapter we'll walk through rebuilding the entire system from scratch, step by step.
