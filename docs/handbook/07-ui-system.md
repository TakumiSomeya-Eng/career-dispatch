# Chapter 7 — The Editorial UI System

The visual design of Career Dispatch is intentional. This chapter unpacks the CSS architecture, the typography system, and the patterns used to keep ~700 lines of CSS coherent.

## The design philosophy

The aesthetic is loosely "**editorial print magazine** meets **technical instrument**." Think: a literary journal redesigned by an engineer.

Specific influences:
- Print magazine layouts (Bookforum, Paris Review): decorative numerals, italics, generous whitespace, heavy column rules
- Brutalist web (early 2010s revival): hard borders, drop shadows offset to the bottom-right, monospace labels
- Technical instrument design (HP calculators, oscilloscopes): JetBrains Mono labels in small caps with letterspacing

The goal is to **feel deliberate**. Generic SaaS UIs (rounded corners, gradient backgrounds, sans-serif everything) signal "I was made by a template." We want users to immediately register: this was designed.

## The color palette

```css
:root {
  --ink: #0a0a0a;          /* Near-black for text and primary borders */
  --paper: #f5f1e8;        /* Warm cream for body background */
  --paper-deep: #ebe5d3;   /* Slightly deeper for subtle contrast */
  --paper-line: #d8d1bd;   /* Muted line color for soft borders */
  --accent: #d63f1f;       /* Vermillion red for emphasis and CTAs */
  --accent-deep: #a8301a;  /* Darker accent for hovers */
  --gold: #c4962b;         /* Mustard for medium-priority badges */
  --forest: #1f3d2e;       /* Deep green for high-priority states */
  --mist: #8a8275;         /* Warm gray for secondary text */
  --cream: #faf7ef;        /* Lightest cream for cards on body */
  --shadow: rgba(10, 10, 10, 0.08);
}
```

Eleven colors, not 50. Constraints force visual coherence — every UI element pulls from the same pool.

The palette is **warm-mode**, not cool. Most app UIs use cool grays (e.g., `#f5f5f5` neutral, `#e0e0e0` borders). Warm grays read as paper, ink, parchment. They feel less digital.

The accent — vermillion red — is one strong color rather than the multiple bright accents typical of dashboards. Used sparingly: CTAs, error states, asterisks. Its strength comes from scarcity.

### Why CSS variables?

Two reasons:

1. **Theming**: changing `--accent` from vermillion to navy changes every accent in the app at once
2. **Self-documentation**: reading CSS, you see `color: var(--mist)` and immediately know it's secondary text, not just a hex you have to look up

A future "dark mode" would just override these variables in a `[data-theme="dark"]` selector. We don't have one yet.

## Typography

Three fonts, three roles:

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;...&family=JetBrains+Mono:wght@400;500;600&family=Inter+Tight:wght@400;500;600;700&display=swap');
```

| Font | Use | Why |
|------|-----|-----|
| **Fraunces** | Display: headlines, masthead, big numerals | Italic variants are warm and characterful. Variable font (opsz) lets it scale gracefully |
| **Inter Tight** | Body: paragraphs, table cells, form values | Inter Tight is slightly condensed Inter — saves space in dense data without looking cramped |
| **JetBrains Mono** | Labels: tiny caps with letterspacing, code blocks, badges | True monospace, high legibility at small sizes. Tighter than Roboto Mono |

The use of Fraunces *italic* for headers is deliberate. Italics are usually a secondary text style (emphasis). Using them as the primary display style is unusual and creates immediate visual identity.

### The "small caps" label pattern

Throughout the UI, you see labels like:

```
SELECT RESUME          # OF TARGETS         INDUSTRY FOCUS
```

These are produced by:

```css
.field-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--mist);
  font-weight: 600;
}
```

The combination of:
- Monospace font
- Tiny size (10px)
- Wide letterspacing (0.15em)
- All caps
- Muted color

…produces a unique label texture used nowhere outside this app. Once you see it, you remember it.

## Component patterns

The CSS doesn't use a component framework like Tailwind or BEM. It uses **semantic class names** for components and **utility-like inline styles for one-offs**.

### Cards

```css
.card {
  background: var(--cream);
  border: 1px solid var(--ink);
  padding: 28px;
  margin-bottom: 24px;
  box-shadow: 4px 4px 0 var(--ink);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
```

The shadow is **solid color, offset 4px right and 4px down**, not the usual blurred drop shadow. This is a brutalist signature — flat, geometric, intentional.

Cards on hover (where applicable) lift up:

```css
.card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 var(--ink);
}
```

The `transform` shifts the card up-left while the shadow grows; the visual effect is "card lifts off page." Same effect appears on buttons.

### Buttons

```css
.btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 12px 20px;
  border: 1px solid var(--ink);
  background: var(--ink);
  color: var(--cream);
  cursor: pointer;
  font-weight: 600;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--ink);
}
```

Buttons are **black by default, vermillion on hover**. The lift-on-hover (`translate(-2px, -2px)` + box-shadow) is the same pattern as cards.

Variants:
- `.btn-secondary` — transparent background, ink-colored text (for less prominent actions)
- `.btn-danger` — accent color, smaller (for destructive actions)
- `.btn-small` — reduced padding and font size

### Tables

```css
.match-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--cream);
  border: 1px solid var(--ink);
}

.match-table th {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  text-align: left;
  padding: 14px 16px;
  background: var(--ink);
  color: var(--cream);
  border-bottom: 2px solid var(--accent);
}
```

Headers are **inverted** (light text on dark) with a vermillion underline. This makes the header bar feel like a header in a printed report. The contrast against the cream body adds visual weight.

### The masthead

The top bar uses CSS Grid:

```css
.masthead {
  border-bottom: 1px solid var(--ink);
  padding: 32px 48px 24px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: end;
  gap: 32px;
  background: var(--cream);
}
```

Three columns: edition info (left), logo (center, takes remaining space), tagline (right). Aligned to the bottom (`align-items: end`) so the baselines of differently-sized text line up.

The double-rule effect (one solid line, one thin line below):

```css
.masthead::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--ink);
}
```

We use a `::after` pseudo-element to draw a second line 5px below the masthead's bottom border. This double-line pattern is borrowed from print mastheads.

### The asterisk in the logo

```html
<div class="logo">
  The Career<span class="asterisk">*</span><br/>
  <em style="font-size: 0.6em; font-weight: 400;">Dispatch</em>
</div>
```

```css
.logo .asterisk { color: var(--accent); font-style: normal; }
```

A vermillion asterisk in an otherwise black italic logo. The asterisk:
- Adds an editorial flourish (footnote-like)
- Provides the only color in an otherwise monochrome logo
- Justifies the "Dispatch" being on a second line via the line break it implies

Tiny detail, large impact on identity.

## Layout strategy

The app uses **a single max-width container** for the main content:

```css
.main-content {
  padding: 40px 48px 80px;
  max-width: 1400px;
  margin: 0 auto;
}
```

Within this container, individual sections size themselves naturally. We don't use a grid system. We don't use flex containers everywhere. Most layouts are simply blocks stacked top-to-bottom.

When we do need horizontal arrangement (like the controls bar with 5 fields and a button), we use `display: flex` with `gap`:

```css
.controls-bar {
  display: flex;
  gap: 16px;
  align-items: end;
  flex-wrap: wrap;
}
```

`flex-wrap: wrap` ensures the bar collapses to multiple rows on narrow screens. `align-items: end` aligns input bottoms with the button bottom (since labels above the inputs cause height variation).

## The status badges

Match scores use color-coded badges:

```css
.score-badge {
  display: inline-block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  background: var(--paper-deep);
  border: 1px solid var(--ink);
  letter-spacing: 0.05em;
}

.score-badge.high { background: var(--forest); color: var(--cream); border-color: var(--forest); }
.score-badge.med { background: var(--gold); color: var(--ink); border-color: var(--gold); }
.score-badge.low { background: var(--paper); color: var(--mist); }
```

Forest green for 85+, gold for 70+, paper for below. Three states, three colors.

Same color logic applies to tracker statuses (saved/applied/interview/offer/rejected) — each gets a distinct background.

## Animation philosophy

We use animations sparingly and quickly:

```css
.btn { transition: all 0.15s ease; }
```

150ms transitions on hover. Fast enough to feel responsive, slow enough to feel intentional.

The only "showy" animations:
- Toast slide-in from the right: 300ms
- Modal backdrop fade: implicit via opacity
- Loading spinner: continuous rotation

We don't use scroll animations, parallax, or page transitions. These would feel out of character.

## Mobile responsiveness

The design is **desktop-first**. We don't have explicit media queries for mobile.

This is a deliberate trade-off. The Match Engine table is dense (6 columns, multi-row content per row). On a phone, it'd require excessive horizontal scrolling no matter how we styled it. The Personal Dossier with 30+ fields would also be painful on mobile.

The web tool **technically works** on mobile (browsers render it, links and buttons function), but the UX is degraded. We accept this because the primary use case (filling forms in a separate tab via the extension) is desktop-only anyway.

If we wanted real mobile support, we'd:
- Stack the controls bar vertically below 700px
- Switch the match table to a card-per-company layout
- Make the dossier into a multi-page wizard

These are doable but currently out of scope.

## CSS organization

The `<style>` block is ordered by specificity, roughly:

1. `@import` for fonts
2. `:root` for variables
3. Universal reset (`* { box-sizing: border-box; }`)
4. Body and root container
5. Top-level layout (masthead, nav-tabs, main-content)
6. Section headers
7. Cards
8. Forms (fields, buttons)
9. Tables
10. Feature-specific (resume cards, match table, autofill panel)
11. Utility (modals, toasts, status states)

This roughly follows ITCSS (Inverted Triangle CSS) but informally. Within each section, we order rules by where they appear in the UI.

## Why no CSS framework (Tailwind, etc.)

Tailwind would let us write:

```html
<div class="bg-cream border border-black p-7 mb-6 shadow-[4px_4px_0_black]">
```

instead of:

```html
<div class="card">
```

Pro: utility-first is fast for one-offs.

Con:
- Required build step (PostCSS, JIT compiler)
- HTML becomes a soup of class names
- No semantic component identity (which `div` is a card?)
- Locks us into Tailwind's design tokens

For a hand-crafted UI with strong identity, semantic class names win. Tailwind shines when you're prototyping rapidly with disposable HTML; we're not.

## Summary

The UI is built from:
- 11 CSS variables defining the entire palette
- 3 fonts with distinct roles
- ~30 component classes (`.card`, `.btn`, `.field-label`, etc.)
- ~700 lines of CSS, no framework

The result is visually cohesive without being homogeneous. Every element pulls from the same pool, but composition varies (cards within tables within tabs within mastheads).

The discipline is: **whenever you add a new UI element, ask if an existing class works first**. Adding new classes is the last resort. This keeps the design from drifting over time.

In the next chapter we'll switch from the web tool to the Chrome extension.
