# Chapter 9 — Field Detection & Autofill Logic

This is the most technically dense chapter. The autofill in Career Dispatch is not naive — it has to work across React, Vue, Workday, and ten different ATS conventions. We'll dissect every layer.

## The problem

You hit `⌘⇧F` on a job application page. The extension needs to:
1. Find every input field on the page
2. For each one, figure out what it's asking for (email? phone? "are you authorized to work in the US"?)
3. Fill it with the right value from your profile
4. Trigger the page's framework (React/Vue/Workday) to recognize the value

This is harder than it sounds. There's no standard for naming form fields. Every site does it differently:

- Greenhouse: `<input id="first_name" name="first_name">`
- Lever: `<input name="cards[0].fields[firstName]">`
- Workday: `<input data-automation-id="textInputBox-firstName">`
- Custom: `<input class="firstNameField" placeholder="Enter your first name">`

No single attribute is reliable. We need to look at multiple signals.

## The 7-layer identifier strategy

For each field on a page, we extract a "field identifier" string by combining seven sources:

```javascript
function getLabelText(el) {
  const parts = [];

  // direct attributes
  if (el.name) parts.push(el.name);
  if (el.id) parts.push(el.id);
  if (el.placeholder) parts.push(el.placeholder);
  const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
  if (aria) parts.push(aria);
  if (el.getAttribute('data-qa')) parts.push(el.getAttribute('data-qa'));
  if (el.getAttribute('data-testid')) parts.push(el.getAttribute('data-testid'));

  // associated label
  if (el.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl) parts.push(lbl.textContent);
  }
  // parent label
  const parentLabel = el.closest('label');
  if (parentLabel) parts.push(parentLabel.textContent);

  // sibling label or legend
  const parent = el.closest('div, fieldset, section, li, tr');
  if (parent) {
    const heading = parent.querySelector('label, legend, .label, [class*="label"]');
    if (heading && !heading.contains(el)) parts.push(heading.textContent);
  }

  return parts.filter(Boolean).map(norm).join(' | ');
}
```

The seven sources, in order:

| Source | Example value |
|--------|---------------|
| `name` attribute | `"first_name"` |
| `id` attribute | `"applicant-firstname"` |
| `placeholder` text | `"e.g., Jane"` |
| `aria-label` (or aria-labelledby) | `"Legal first name"` |
| `data-qa` / `data-testid` | `"input-first-name"` |
| `<label for="">` (associated label) | `"First Name *"` |
| Parent `<label>` (wrapping label) | `"First Name"` (when input is inside the label) |

Plus an 8th: searching upward to the nearest container (`div`, `fieldset`, `section`, etc.) for a heading element.

All sources are normalized (lowercased, hyphens/underscores → spaces) and joined with ` | ` separators:

```javascript
function norm(s) {
  return (s || '').toString().toLowerCase().replace(/[_\-\s]+/g, ' ').trim();
}
```

For our example input `<input id="applicant-firstname" name="first_name" placeholder="Enter first name">` with a label `<label for="applicant-firstname">First Name</label>`, the resulting identifier string would be:

```
first name | applicant firstname | enter first name | first name
```

## The matching pass

Once we have an identifier string, we compare it against pattern definitions:

```javascript
const TEXT_FIELD_MAP = [
  { key: 'firstName', patterns: ['\\bfirst.?name\\b', '\\bfname\\b', '\\bgiven.?name\\b', '^first$', 'legal.?first'] },
  { key: 'lastName', patterns: ['\\blast.?name\\b', '\\blname\\b', '\\bsurname\\b', '\\bfamily.?name\\b', '^last$', 'legal.?last'] },
  { key: 'email', patterns: ['\\bemail\\b', '\\be-mail\\b', 'email.?address'] },
  { key: 'phone', patterns: ['\\bphone\\b', '\\btelephone\\b', '\\bmobile\\b', '\\bcell\\b', 'phone.?number'] },
  // ... 13 more entries
];
```

Each entry maps a profile field to an array of regex patterns. The patterns are designed to be permissive — using `.?` to optionally match a separator (so "firstname" and "first name" both match).

Word boundaries (`\\b`) prevent false positives. Without them, the pattern `name` would match "username" — wrong. With `\\bname\\b`, only standalone "name" matches.

The matching loop:

```javascript
fields.forEach(el => {
  if (el.disabled || el.readOnly) return;
  if (el.value && el.value.trim().length > 0) return; // skip filled

  const ident = getLabelText(el);
  if (!ident) return;

  for (const map of TEXT_FIELD_MAP) {
    const val = profile[map.key];
    if (!val) continue;
    const matched = map.patterns.some(p => new RegExp(p, 'i').test(ident));
    if (matched) {
      setNativeValue(el, val);
      highlight(el);
      count++;
      break;
    }
  }
});
```

For each input:
1. Skip if disabled, readonly, or already filled (non-destructive)
2. Build its identifier string
3. Loop through the field map; for each entry where we have a profile value:
4. Test if any of its patterns match the identifier (case-insensitive)
5. If matched, set the value and stop (don't double-fill)

The `break` after the first match is important. If "name" patterns and "first name" patterns both might match, we want the more specific one to win — this is why field maps are ordered carefully (specific before generic).

## The native setter trick

This is the most subtle and important piece of the autofill code:

```javascript
function setNativeValue(el, value) {
  const proto = el.tagName === 'SELECT'
    ? HTMLSelectElement.prototype
    : el.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
```

Why is this here? Because **doing `el.value = "John"` doesn't work in React/Vue.**

### The React/Vue problem

Modern frameworks (React, Vue, Workday's UI library) wrap form inputs in their own state management. When you type into an input, React doesn't trust the DOM's value — it tracks a "controlled value" in JavaScript state.

When you do `inputElement.value = "John"` from outside React:
- The DOM's value attribute changes
- But React's internal state doesn't know
- On the next re-render, React **overwrites your value with its tracked state** (which is still empty)
- Net result: your fill appears for a microsecond, then disappears

### How React tracks the value

React replaces the input element's value setter with a custom one. When you assign to `.value`, React intercepts:

```javascript
input.value = "hello";  // calls React's interceptor
// React updates its internal state
// React's value setter then sets the DOM value
```

This works fine when the user types — keyboard events naturally fire and React responds.

But when an extension sets `.value`, it triggers React's interceptor without any user event. React thinks "this isn't a real change" and sometimes ignores it or syncs state inconsistently.

### Bypassing the interceptor

The trick: call the **native** setter (the one from `HTMLInputElement.prototype`) directly, bypassing React's wrapper. Then manually fire the `input` and `change` events. React listens for these events to update its state, treating them as if the user typed.

```javascript
const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
descriptor.set.call(el, value);  // bypasses React's wrapper

el.dispatchEvent(new Event('input', { bubbles: true }));  // tells React to read the new value
el.dispatchEvent(new Event('change', { bubbles: true })); // tells some libraries the value is "committed"
```

This is the only reliable way to fill React/Vue/Workday inputs from an extension.

### Why we check for SELECT and TEXTAREA

`HTMLInputElement.prototype.value` setter only works for `<input>` elements. Selects and textareas are different element classes with their own prototypes. We pick the right one based on `tagName`.

## Filling selects (dropdowns)

Selects are harder than text fields because they have a fixed set of options. We can't just inject any string — we have to find the option that matches the user's profile value.

```javascript
const SELECT_FIELD_MAP = [
  { key: 'gender', patterns: ['\\bgender\\b', '\\bsex\\b'] },
  { key: 'workAuth', patterns: ['work.?auth', 'authorization.?to.?work', 'eligible.?to.?work', 'legally.?authorized', 'visa.?status'] },
  // ...
];

const SELECT_VALUE_HINTS = {
  // workAuth values → how options are typically labeled
  us_citizen: ['citizen', 'u.s. citizen', 'us citizen'],
  green_card: ['permanent resident', 'green card', 'lawful permanent'],
  h1b: ['h-1b', 'h1b', 'h1-b'],
  opt: ['opt', 'f-1', 'f1', 'optional practical'],
  // ...
};
```

The flow:
1. Find a select whose label matches a profile field (e.g., "Work Authorization" → `workAuth`)
2. Get the user's value (e.g., `'h1b'`)
3. Look up hints for that value (`['h-1b', 'h1b', 'h1-b']`)
4. Iterate the select's options, finding the first whose text matches any hint

```javascript
function findBestOption(select, profileValue, key) {
  const opts = Array.from(select.options).filter(o => o.value);
  if (opts.length === 0) return null;

  // try exact value match first
  const exactValue = opts.find(o => o.value.toLowerCase() === profileValue.toLowerCase());
  if (exactValue) return exactValue;

  // try hint matching
  let hintKey = profileValue;
  if (KEY_OVERRIDES[key] && KEY_OVERRIDES[key][profileValue]) {
    hintKey = KEY_OVERRIDES[key][profileValue];
  }
  const hints = SELECT_VALUE_HINTS[hintKey] || [profileValue.replace(/_/g, ' ')];

  for (const hint of hints) {
    const re = new RegExp(hint, 'i');
    const match = opts.find(o => re.test(o.text) || re.test(o.value));
    if (match) return match;
  }
  return null;
}
```

So for an `<select>` with options:
- "—Select—"
- "U.S. Citizen"
- "Permanent Resident"
- "H-1B Visa (requires sponsorship)"
- "Other"

…and a profile value of `'h1b'`, the matching pass:
1. Skip the "—Select—" option (filtered by `o.value`)
2. No exact value match (option values are usually like "h1b_visa", we have "h1b")
3. Hint lookup: `h1b` → `['h-1b', 'h1b', 'h1-b']`
4. First hint `h-1b` matches "H-1B Visa (requires sponsorship)" ✓
5. Return that option

Once found, we set the select:

```javascript
sel.value = option.value;
sel.selectedIndex = option.index;
sel.dispatchEvent(new Event('change', { bubbles: true }));
sel.dispatchEvent(new Event('input', { bubbles: true }));
```

Note: for selects, the native setter trick isn't strictly needed (selects have simpler React integration) but we still fire change events so framework state updates.

### KEY_OVERRIDES — handling ambiguous values

Some profile values appear in multiple fields. For example, the disability question expects "yes I have one" or "no I don't" — but the values 'yes'/'no' are also used by other questions (relocation, sponsorship).

We use `KEY_OVERRIDES` to disambiguate:

```javascript
const KEY_OVERRIDES = {
  disability: { yes: 'yes_disability', no: 'no_disability' }
};
```

So when filling a disability select with profile value 'yes', we look up `'yes_disability'` in hints, which gives us patterns like `['yes, i have', 'i have a disability']`. These match the disability question's option text but not the relocation question's "Yes" option.

This is a workaround for our flat profile structure. A cleaner design would have a per-field type (boolean vs. enum) but adds complexity.

## Filling radio buttons

Radio buttons are like selects but without a `<select>` wrapper. They're a group of `<input type="radio">` elements that share the same `name`:

```html
<fieldset>
  <legend>Are you a US citizen?</legend>
  <label><input type="radio" name="citizen" value="yes"> Yes</label>
  <label><input type="radio" name="citizen" value="no"> No</label>
</fieldset>
```

We group radios by `name`, identify the group's purpose by combining the name with any `<legend>`, then find the radio whose label matches the user's value:

```javascript
function fillRadios(profile) {
  const radios = document.querySelectorAll('input[type=radio]');
  const groups = new Map();
  radios.forEach(r => {
    if (!r.name) return;
    if (!groups.has(r.name)) groups.set(r.name, []);
    groups.get(r.name).push(r);
  });

  groups.forEach((radioGroup, name) => {
    if (radioGroup.some(r => r.checked)) return; // already selected

    const first = radioGroup[0];
    const fieldset = first.closest('fieldset');
    let groupIdent = norm(name);
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) groupIdent += ' | ' + norm(legend.textContent);
    }

    // Find which profile field this group is asking about
    for (const map of SELECT_FIELD_MAP) {
      // ... same matching logic as selects
      // when matched, find the right radio by label
      for (const r of radioGroup) {
        const radioLabel = getLabelText(r);
        for (const hint of hints) {
          if (new RegExp(hint, 'i').test(radioLabel)) {
            r.checked = true;
            r.dispatchEvent(new Event('change', { bubbles: true }));
            r.dispatchEvent(new Event('click', { bubbles: true }));
            return;
          }
        }
      }
    }
  });
}
```

We dispatch both `change` and `click` events because some libraries listen for one or the other.

## What we don't fill

By design:
- **File inputs** (`type="file"`) — can't programmatically attach files for security reasons
- **Checkboxes for "I agree to terms"** — these need explicit consent
- **CAPTCHA** — by definition, not automatable
- **Multi-step forms with hidden fields** — we only fill what's currently visible

These limits are partly technical (file inputs) and partly ethical (consent shouldn't be auto-checked).

## The user feedback layer

After filling, we provide visual feedback:

```javascript
function highlight(el) {
  const prev = el.style.backgroundColor;
  el.style.transition = 'background-color 0.3s ease';
  el.style.backgroundColor = '#fff9c4'; // pale yellow
  setTimeout(() => {
    el.style.backgroundColor = prev || '';
  }, 2000);
}
```

Each filled field flashes pale yellow for 2 seconds, then returns to its original color. This makes it visually obvious what was filled.

We also show a toast:

```javascript
function showToast(msg, isError = false) {
  const existing = document.getElementById('__cd_toast__');
  if (existing) existing.remove();
  const n = document.createElement('div');
  n.id = '__cd_toast__';
  n.style.cssText = `
    position: fixed; top: 20px; right: 20px;
    background: #0a0a0a; color: #f5f1e8;
    padding: 16px 24px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 12px;
    z-index: 2147483647;
    border: 2px solid ${isError ? '#d63f1f' : '#1f3d2e'};
    box-shadow: 4px 4px 0 ${isError ? '#d63f1f' : '#1f3d2e'};
  `;
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3500);
}
```

The `z-index: 2147483647` is the maximum possible 32-bit integer — guarantees we render on top of any modal or overlay the host site has.

## Manual picker mode

For fields the auto-detection misses, the user can pick manually. From the popup, click a field name → activates picker mode → click a field on the page → it gets filled.

```javascript
function activatePicker(profile, selectedKey) {
  if (pickerActive) return;
  pickerActive = true;

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .__cd_hover__ { outline: 3px dashed #d63f1f !important; cursor: crosshair !important; }
  `;
  document.head.appendChild(styleEl);

  const onMouseOver = (e) => {
    const el = e.target;
    if (!el.matches('input, textarea, select')) return;
    if (currentHover) currentHover.classList.remove('__cd_hover__');
    currentHover = el;
    el.classList.add('__cd_hover__');
  };

  const onClick = (e) => {
    const el = e.target;
    if (!el.matches('input, textarea, select')) return;
    e.preventDefault();
    e.stopPropagation();
    setNativeValue(el, profile[selectedKey]);
    deactivatePicker();
  };

  // ... ESC handler, cleanup
}
```

The picker:
1. Injects CSS for hover styling (dashed orange outline)
2. Listens for mouseover on form fields, applies the hover class
3. Listens for click — preventing default navigation
4. Sets the field value
5. Deactivates and cleans up listeners

ESC cancels the picker without filling anything.

## Failure modes and how we handle them

| Failure | What happens | What user sees |
|---------|--------------|----------------|
| No fields match | Toast "⚡ No matching fields found" | Useful negative signal |
| Field is in iframe | Skipped (we don't reach into iframes) | User uses manual picker |
| Field has dynamic id (changes per render) | Identifier might still match if other attributes are stable | Usually works |
| Site uses Shadow DOM | Skipped (querySelectorAll doesn't pierce shadow boundaries) | Manual picker required |
| Site is React with hyper-aggressive re-render | Native setter trick handles it | Works |
| Field is disabled because of conditional logic | We skip disabled fields | User enables and re-runs autofill |

For Shadow DOM specifically: a few sites (like some Workday configurations) wrap their forms in shadow roots. Our `document.querySelectorAll` doesn't pierce shadow boundaries. This is a known limitation. Solutions exist (recursive shadow root traversal) but add complexity for an edge case.

## Summary

The autofill engine is **400 lines of regex matching, native setter manipulation, and DOM event dispatching**. The complexity comes from supporting heterogeneous form implementations across thousands of sites with no standard.

The principles:
- Multi-source identifier extraction (7 attributes + label proximity)
- Permissive regex patterns (.?  for separators, \\b for word boundaries)
- Native setter trick for React/Vue compatibility
- Semantic option matching for selects via hint dictionaries
- Non-destructive (skip filled fields)
- Rich feedback (yellow highlight + toast)

When extending this:
- Add new entries to `TEXT_FIELD_MAP` for new profile fields
- Add new entries to `SELECT_VALUE_HINTS` for new dropdown semantics
- Test on at least 3 different ATS platforms before committing

In the next chapter we'll cover security and privacy trade-offs.
