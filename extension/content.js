// Career Dispatch — Content Script
// Runs on every page. Listens for autofill commands from popup/background.

(function() {
  'use strict';

  // ============================================
  // FIELD MAPPING DEFINITIONS
  // ============================================
  // Each entry: { profileKey, patterns: [regex strings] }
  // Patterns are matched against the field's identifiers (name, id, placeholder,
  // aria-label, label text, surrounding text).
  const TEXT_FIELD_MAP = [
    { key: 'firstName', patterns: ['\\bfirst.?name\\b', '\\bfname\\b', '\\bgiven.?name\\b', '^first$', 'legal.?first'] },
    { key: 'lastName', patterns: ['\\blast.?name\\b', '\\blname\\b', '\\bsurname\\b', '\\bfamily.?name\\b', '^last$', 'legal.?last'] },
    { key: 'email', patterns: ['\\bemail\\b', '\\be-mail\\b', 'email.?address'] },
    { key: 'phone', patterns: ['\\bphone\\b', '\\btelephone\\b', '\\bmobile\\b', '\\bcell\\b', 'phone.?number'] },
    { key: 'address', patterns: ['address.?line.?1', '\\bstreet\\b', '^address$', '\\baddr\\b', 'street.?address'] },
    { key: 'city', patterns: ['\\bcity\\b', '\\btown\\b', '\\blocality\\b'] },
    { key: 'state', patterns: ['\\bstate\\b', '\\bprovince\\b', '\\bregion\\b'] },
    { key: 'zip', patterns: ['\\bzip\\b', '\\bpostal\\b', 'zip.?code', 'postal.?code'] },
    { key: 'linkedin', patterns: ['linkedin', 'linked.?in'] },
    { key: 'github', patterns: ['github', 'git.?hub'] },
    { key: 'portfolio', patterns: ['portfolio', 'website', 'personal.?site', '^url$', 'your.?site'] },
    { key: 'twitter', patterns: ['\\btwitter\\b', '\\b(x|ex).?profile', '\\b@handle'] },
    { key: 'salary', patterns: ['\\bsalary\\b', 'compensation', 'desired.?pay', 'expected.?pay', 'pay.?expectation'] },
    { key: 'startDate', patterns: ['start.?date', 'availability', 'earliest.?start', 'when.?can.?you.?start', 'available.?to.?start'] },
    { key: 'referral', patterns: ['referr', 'refer.?by', 'who.?referred', 'referral.?name'] },
    { key: 'source', patterns: ['how.?did.?you.?hear', '\\bsource\\b', 'hear.?about.?us', 'find.?out.?about'] },
    { key: 'bio', patterns: ['\\bbio\\b', '\\bsummary\\b', 'about.?you', 'cover.?letter', 'why.?should', 'tell.?us.?about'] }
  ];

  const SELECT_FIELD_MAP = [
    { key: 'gender', patterns: ['\\bgender\\b', '\\bsex\\b'] },
    { key: 'ethnicity', patterns: ['\\brace\\b', 'ethnicity', 'racial'] },
    { key: 'veteran', patterns: ['veteran'] },
    { key: 'disability', patterns: ['disabil'] },
    { key: 'workAuth', patterns: ['work.?auth', 'authorization.?to.?work', 'eligible.?to.?work', 'legally.?authorized', 'visa.?status'] },
    { key: 'sponsorship', patterns: ['sponsor', 'require.?sponsor', 'need.?sponsor'] },
    { key: 'relocate', patterns: ['relocat', 'willing.?to.?move', 'open.?to.?relocation'] }
  ];

  // Semantic option matching for selects — maps profile values to keywords
  // the option's text/value is scanned for
  const SELECT_VALUE_HINTS = {
    // workAuth
    us_citizen: ['citizen', 'u.s. citizen', 'us citizen'],
    green_card: ['permanent resident', 'green card', 'lawful permanent'],
    h1b: ['h-1b', 'h1b', 'h1-b'],
    h1b_transfer: ['h-1b', 'h1b', 'transfer'],
    opt: ['opt', 'f-1', 'f1', 'optional practical'],
    stem_opt: ['stem', 'stem opt'],
    tn: ['tn visa', 'tn-1', 'tn1', '\\btn\\b'],
    e3: ['e-3', 'e3 visa'],
    o1: ['o-1', 'o1 visa', 'extraordinary'],
    no_auth: ['not authorized', 'no authorization', 'require sponsorship'],

    // sponsorship
    no: ['no', 'not require', 'do not require'],
    now: ['yes', 'require sponsorship', 'need sponsorship'],
    future: ['future', 'later', 'in the future'],

    // relocate
    yes: ['yes', 'willing'],
    depends: ['depend', 'maybe', 'possibly'],

    // gender
    male: ['male', '\\bman\\b'],
    female: ['female', '\\bwoman\\b'],
    non_binary: ['non.?binary', 'nonbinary', 'genderqueer'],
    decline: ['decline', 'prefer not', 'do not wish'],

    // ethnicity
    asian: ['asian'],
    black: ['black', 'african american'],
    hispanic: ['hispanic', 'latino', 'latinx'],
    white: ['white', 'caucasian'],
    native: ['american indian', 'native american', 'alaska'],
    pacific: ['pacific islander', 'native hawaiian'],
    two_or_more: ['two or more', 'multiracial'],

    // veteran
    not_veteran: ['not a protected veteran', 'not a veteran', 'i am not'],
    veteran: ['i am a veteran', 'i identify as', 'protected veteran'],

    // disability
    yes_disability: ['yes, i have', 'i have a disability'],
    no_disability: ['no, i do not', 'do not have a disability', "don't have"]
  };

  // Aliases for disability/yes/no — since values conflict with others
  const KEY_OVERRIDES = {
    disability: { yes: 'yes_disability', no: 'no_disability' }
  };

  // ============================================
  // UTILITIES
  // ============================================
  function norm(s) {
    return (s || '').toString().toLowerCase().replace(/[_\-\s]+/g, ' ').trim();
  }

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

  // Native setter to bypass React/Vue synthetic events
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

  function highlight(el) {
    const prev = el.style.backgroundColor;
    el.style.transition = 'background-color 0.3s ease';
    el.style.backgroundColor = '#fff9c4';
    setTimeout(() => {
      el.style.backgroundColor = prev || '';
    }, 2000);
  }

  function showToast(msg, isError = false) {
    const existing = document.getElementById('__cd_toast__');
    if (existing) existing.remove();
    const n = document.createElement('div');
    n.id = '__cd_toast__';
    n.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: #0a0a0a; color: #f5f1e8;
      padding: 16px 24px;
      font-family: 'JetBrains Mono', ui-monospace, Menlo, Monaco, monospace;
      font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;
      z-index: 2147483647;
      border: 2px solid ${isError ? '#d63f1f' : '#1f3d2e'};
      box-shadow: 4px 4px 0 ${isError ? '#d63f1f' : '#1f3d2e'};
    `;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3500);
  }

  // ============================================
  // AUTOFILL LOGIC
  // ============================================
  function fillTextFields(profile) {
    let count = 0;
    const fields = document.querySelectorAll(
      'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=reset]), textarea'
    );

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
    return count;
  }

  function findBestOption(select, profileValue, key) {
    const opts = Array.from(select.options).filter(o => o.value); // skip placeholder
    if (opts.length === 0) return null;

    // handle ambiguous keys via overrides
    let hintKey = profileValue;
    if (KEY_OVERRIDES[key] && KEY_OVERRIDES[key][profileValue]) {
      hintKey = KEY_OVERRIDES[key][profileValue];
    }
    const hints = SELECT_VALUE_HINTS[hintKey] || [profileValue.replace(/_/g, ' ')];

    // try exact value match first
    const exactValue = opts.find(o => o.value.toLowerCase() === profileValue.toLowerCase());
    if (exactValue) return exactValue;

    // try hint matching
    for (const hint of hints) {
      const re = new RegExp(hint, 'i');
      const match = opts.find(o => re.test(o.text) || re.test(o.value));
      if (match) return match;
    }
    return null;
  }

  function fillSelects(profile) {
    let count = 0;
    const selects = document.querySelectorAll('select');

    selects.forEach(sel => {
      if (sel.disabled) return;
      if (sel.value && sel.selectedIndex > 0) return; // already filled

      const ident = getLabelText(sel);
      if (!ident) return;

      for (const map of SELECT_FIELD_MAP) {
        const val = profile[map.key];
        if (!val) continue;
        const matched = map.patterns.some(p => new RegExp(p, 'i').test(ident));
        if (matched) {
          const option = findBestOption(sel, val, map.key);
          if (option) {
            sel.value = option.value;
            sel.selectedIndex = option.index;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            sel.dispatchEvent(new Event('input', { bubbles: true }));
            highlight(sel);
            count++;
          }
          break;
        }
      }
    });
    return count;
  }

  function fillRadios(profile) {
    let count = 0;
    // Group radios by name
    const radios = document.querySelectorAll('input[type=radio]');
    const groups = new Map();
    radios.forEach(r => {
      if (!r.name) return;
      if (!groups.has(r.name)) groups.set(r.name, []);
      groups.get(r.name).push(r);
    });

    groups.forEach((radioGroup, name) => {
      if (radioGroup.some(r => r.checked)) return; // already selected

      // identify the group via first radio's labels + fieldset legend
      const first = radioGroup[0];
      const fieldset = first.closest('fieldset');
      let groupIdent = norm(name);
      if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend) groupIdent += ' | ' + norm(legend.textContent);
      }

      for (const map of SELECT_FIELD_MAP) {
        const val = profile[map.key];
        if (!val) continue;
        const matched = map.patterns.some(p => new RegExp(p, 'i').test(groupIdent));
        if (matched) {
          // find best radio by label
          let hintKey = val;
          if (KEY_OVERRIDES[map.key] && KEY_OVERRIDES[map.key][val]) {
            hintKey = KEY_OVERRIDES[map.key][val];
          }
          const hints = SELECT_VALUE_HINTS[hintKey] || [val.replace(/_/g, ' ')];

          for (const r of radioGroup) {
            const radioLabel = getLabelText(r);
            for (const hint of hints) {
              if (new RegExp(hint, 'i').test(radioLabel)) {
                r.checked = true;
                r.dispatchEvent(new Event('change', { bubbles: true }));
                r.dispatchEvent(new Event('click', { bubbles: true }));
                highlight(r.closest('label') || r.parentElement || r);
                count++;
                return;
              }
            }
          }
          break;
        }
      }
    });
    return count;
  }

  function runAutofill(profile) {
    if (!profile) {
      showToast('⚠ No profile loaded', true);
      return 0;
    }
    const t = fillTextFields(profile);
    const s = fillSelects(profile);
    const r = fillRadios(profile);
    const total = t + s + r;

    if (total === 0) {
      showToast('⚡ No matching fields found');
    } else {
      showToast(`⚡ Filled ${total} field${total === 1 ? '' : 's'}`);
    }
    return total;
  }

  // ============================================
  // MANUAL PICKER MODE
  // ============================================
  let pickerActive = false;
  let pickerOverlay = null;
  let currentHover = null;

  function activatePicker(profile, selectedKey) {
    if (pickerActive) return;
    pickerActive = true;

    const styleEl = document.createElement('style');
    styleEl.id = '__cd_picker_style__';
    styleEl.textContent = `
      .__cd_hover__ { outline: 3px dashed #d63f1f !important; outline-offset: 2px !important; cursor: crosshair !important; }
    `;
    document.head.appendChild(styleEl);

    pickerOverlay = document.createElement('div');
    pickerOverlay.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: #0a0a0a; color: #f5f1e8;
      padding: 14px 22px;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;
      z-index: 2147483647;
      border: 2px solid #d63f1f; box-shadow: 4px 4px 0 #d63f1f;
    `;
    pickerOverlay.textContent = `◉ Click a field to fill with: "${profile[selectedKey]}"  —  ESC to cancel`;
    document.body.appendChild(pickerOverlay);

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
      const value = profile[selectedKey];
      if (el.tagName === 'SELECT') {
        const opt = findBestOption(el, value, selectedKey);
        if (opt) {
          el.value = opt.value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        setNativeValue(el, value);
      }
      highlight(el);
      deactivatePicker();
      showToast('⚡ Field filled');
    };

    const onKey = (e) => {
      if (e.key === 'Escape') deactivatePicker();
    };

    function deactivatePicker() {
      pickerActive = false;
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      if (currentHover) currentHover.classList.remove('__cd_hover__');
      currentHover = null;
      const s = document.getElementById('__cd_picker_style__');
      if (s) s.remove();
      if (pickerOverlay) { pickerOverlay.remove(); pickerOverlay = null; }
    }

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
  }

  // ============================================
  // MESSAGE HANDLER
  // ============================================
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
})();
