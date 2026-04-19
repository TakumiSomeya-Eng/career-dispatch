# Chapter 2 — Tech Stack & Design Decisions

Every technology choice is a trade-off. This chapter explains what was chosen, what was rejected, and why.

## The full stack

### Web tool
- **HTML 5** — single file, no preprocessor
- **CSS** — vanilla, with CSS variables for theming
- **JavaScript** — ES2017+ (async/await, destructuring, template literals, optional chaining)
- **Persistence**: browser `localStorage` (synchronous key-value store, ~5MB limit)
- **Network**: native `fetch()` API
- **External services**: Anthropic Messages API (Claude)
- **Fonts**: Google Fonts (Fraunces, Inter Tight, JetBrains Mono)

### Chrome extension
- **Manifest V3** — Chrome's current extension platform
- **Service Worker** (`background.js`) — replaces persistent background pages from MV2
- **Content Scripts** (`content.js`) — injected into web pages
- **Popup** (`popup.html` + `popup.js`) — extension toolbar UI
- **Persistence**: `chrome.storage.local` (async key-value store)
- **No external libraries**: zero npm dependencies

## Why no framework?

The most common question. The honest answer:

### What frameworks (React, Vue, Svelte) give you
1. Declarative UI (write what to render, not how)
2. Component reuse
3. Reactive state binding (state changes auto-update UI)
4. Routing
5. Ecosystem (libraries, tooling, hiring)

### What they cost you
1. Build step required (webpack/Vite/esbuild)
2. Runtime overhead (~40-100KB gzipped baseline for React)
3. Mental overhead (lifecycle, hooks, JSX vs. template syntax)
4. Tooling complexity (TypeScript configs, lint configs, transformer plugins)
5. Lock-in: you can't just open the file in a browser

### Career Dispatch has:
- **Small UI surface**: ~5 main views, ~10 forms total
- **Small state**: dozens of objects max
- **No routing needs**: single-page tabs with show/hide
- **No multiplayer**: no need for elaborate state machines
- **Personal-scale users**: not optimizing for 50 engineers maintaining it

In this regime, a framework is **negative ROI**. The boilerplate cost of "compile, bundle, deploy" exceeds any productivity gain from declarative rendering.

### The vanilla approach we use

UI updates happen by re-rendering chunks of HTML via `innerHTML`. For example, when a resume is added:

```javascript
state.resumes.push(newResume);
await saveResumes();
renderResumeList();  // re-renders the entire list
```

`renderResumeList()` builds an HTML string from `state.resumes` and assigns it to a container's `innerHTML`. The DOM is fully replaced for that section.

**Is this slow?** Not at our scale. Re-rendering 50 list items takes <1ms. React's virtual DOM diffing only matters when re-rendering thousands of nodes per frame. We don't.

**Is this XSS-safe?** Only if every user-supplied string passes through `escapeHtml()` before going into a template. We do this religiously. See chapter 7 for details.

**When would this break down?** If we had:
- A view with 10,000+ items requiring fine-grained updates
- A complex form with cross-field validation that triggers many re-renders per keystroke
- Real-time data streaming in (websockets, etc.)

We have none of these.

## Why no build step?

A build step (webpack, Vite, etc.) would let us:
- Use TypeScript
- Use modern JS in old browsers
- Bundle multiple source files
- Minify for smaller payloads
- Use SCSS/Tailwind/etc.

It would also:
- Require Node.js to install
- Require running `npm install` after every `git pull`
- Make "edit and refresh" more like "edit, build, refresh"
- Add config files (webpack.config.js, tsconfig.json, etc.)
- Make the codebase scary to non-engineers

**For a personal tool that works in 99% of browsers (anything Chromium-based or Firefox), the cost exceeds the benefit.** Career Dispatch is small enough that:

- TypeScript would catch maybe 2-3 bugs that runtime testing also catches
- Modern JS works natively in target browsers (no transpilation needed)
- Single-file delivery is a feature (one HTML to share, no archive)
- Unminified is more debuggable

**When would a build step make sense?** If we added:
- Server-side rendering
- Code splitting (lazy-loaded routes)
- A framework that requires compilation (React JSX, Svelte templates)
- A test suite with many assertions

Again, we have none of these.

## Why localStorage, not IndexedDB?

`localStorage`:
- ✅ Synchronous API (simple to use)
- ✅ Tiny (200 lines of JS to wrap)
- ✅ Universally supported
- ❌ String-only (must JSON.stringify everything)
- ❌ ~5MB total limit per origin
- ❌ Blocks the main thread on read/write (slow for huge data)

`IndexedDB`:
- ✅ Async, won't block UI
- ✅ Much larger storage (often hundreds of MB)
- ✅ Native object storage (no manual JSON)
- ✅ Indexes, queries, transactions
- ❌ Verbose API (10x the boilerplate)
- ❌ Promise-based but with idiosyncratic patterns

For Career Dispatch's data sizes (a few KB of resumes, a few KB of profile, a few KB of matches), localStorage is correct. We never approach the 5MB limit.

If we ever wanted to store full resume PDFs or large historical match logs, IndexedDB would become necessary.

## Why direct browser → Claude API calls?

Anthropic explicitly recommends **NOT** doing this in production apps, because it exposes the user's API key to anyone who can inspect their browser. The recommended pattern is:

```
Browser → Your Backend → Anthropic API
```

We do:

```
Browser → Anthropic API (with header anthropic-dangerous-direct-browser-access: true)
```

Why? Because for **personal use on the user's own machine**, the threat model is different:
- The "anyone who can inspect the browser" is the user themselves
- The API key was created by the user, owned by the user, billed to the user
- Adding a backend would require: hosting, deployment, account system, billing protection — all things that destroy the local-first promise

The trade-off is documented in the README and the PRD. **For a redistributed SaaS, this would be wrong.** For a fork-and-run-on-your-own-machine tool, it's appropriate.

The `anthropic-dangerous-direct-browser-access: true` header is Anthropic's way of saying "I know what I'm doing, bypass the CORS guard." It's not a security feature; it's a developer acknowledgment.

## Why Manifest V3 for the extension?

Manifest V3 is the **only option** as of early 2024 — Chrome stopped accepting MV2 extensions. The big differences from MV2:

- **No persistent background pages** — must use service workers, which can be killed when idle
- **No remote code execution** — `eval()` and remotely-loaded JS are blocked
- **Stricter host permission requests** — users must approve broad access
- **Better security review pipeline**

For Career Dispatch this is fine. We don't need a persistent background process; the service worker spins up only when the keyboard shortcut fires. We don't need remote code; everything is local. We need `<all_urls>` host permission because we don't know in advance which sites the user will autofill on, and Chrome accepts this with a warning.

## Why Greenhouse / Lever / Ashby / Workday for ATS detection?

These are the dominant ATS (Applicant Tracking System) platforms in US tech as of 2026:

| ATS | Approximate market share in US tech |
|-----|------------------------------------|
| Greenhouse | ~30% |
| Lever | ~15% |
| Workday | ~25% (more enterprise) |
| Ashby | ~10% (growing fast in startups) |
| iCIMS, Jobvite, SmartRecruiters, Eightfold, Taleo | Combined ~15% |
| Custom / proprietary | ~5% |

Career Dispatch's autofill tested matrix prioritizes Greenhouse, Lever, Ashby, and Workday because covering those four hits ~80% of US tech applications. The semantic dropdown matching for EEO fields is hand-tuned against Greenhouse's exact wording, which other ATS systems mostly follow.

## Why this specific font set?

| Font | Role | Why |
|------|------|-----|
| **Fraunces** | Display (headlines, big numerals) | A modern revival of warm-mode serifs (think: Cooper, Souvenir). Has italic variants with personality. Editorial without being stuffy. |
| **Inter Tight** | Body text | Inter is the default "good sans-serif" choice. Inter Tight is the slightly condensed variant — saves horizontal space in tables, looks crisp in dense data. |
| **JetBrains Mono** | Labels, code, badges | A true monospace with high legibility. Tighter than Roboto Mono, more characterful than Menlo. Used for the "small caps with letterspacing" label style. |

The combination intentionally avoids Inter alone (overused), system-ui (generic), or Helvetica (corporate). It signals "someone designed this on purpose."

## Browser compatibility

Tested and confirmed working:
- **Chrome** 120+ (primary target)
- **Edge** 120+ (Chromium-based)
- **Brave** latest
- **Arc** latest (Chromium-based)

Should work but less tested:
- **Firefox** — the web tool works; the extension would need a manifest tweak (Manifest V3 in Firefox is incomplete as of 2026)
- **Safari** — the web tool works; the extension would need full reauthoring as a Safari Web Extension

Not supported:
- **Internet Explorer** — uses ES2017 features
- **Mobile browsers** (extension only) — Chrome on Android doesn't support extensions

## Summary of trade-offs

| Choice | What we gained | What we gave up |
|--------|---------------|----------------|
| No framework | Speed of development, no build, single file delivery | Component reuse, type safety from frameworks |
| No build step | "Edit and refresh", debuggability, no toolchain rot | TypeScript, transpilation, modern CSS preprocessors |
| `localStorage` over IndexedDB | Simple sync API, easy debugging | Storage size limit, slow for large data |
| Direct API calls | No backend, true local-first | Inappropriate for redistributed SaaS |
| Manifest V3 | Future-proof for Chrome | Constraints on background processing |
| Vanilla DOM updates | No abstractions to learn | Manual XSS prevention, manual re-rendering |

In every case, the choice optimizes for **a single developer maintaining a personal-scale tool that someone else can fork in 5 minutes**. If your context is different, your trade-offs should be different.

In the next chapter we'll dive into the actual code organization of `career-dispatch.html`.
