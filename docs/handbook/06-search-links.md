# Chapter 6 — Building Smart Search Links

The most distinctive feature of Career Dispatch's match results: every company gets 7 actionable URLs (4 job-search + 3 recruiter-search). This chapter explains how those URLs are constructed and why each one exists.

## The problem this solves

The naive approach would be: ask Claude for the application URL, return that, done.

The problem: Claude doesn't know real-time job listings. It can't tell us "Stripe has an open Senior PM role at this URL." That information lives on stripe.com/jobs and changes daily — it's not in any model's training data.

The best Claude can do is tell us:
- The company exists and likely hires for this role type
- The company uses ATS X with slug Y
- The company's careers domain is Z

From that, **we** construct URLs that take the user to a filtered job list — where they can see real listings.

## The two categories of links

```
buildSearchLinks(match, positions, keywords)
  ↓
  returns array of 7 link objects:
    Job Search (4):
      🎯 ATS-native filtered URL    (e.g., boards.greenhouse.io/stripe?t=Product+Manager)
      🔎 Google site-search URL      (e.g., google.com/search?q=site:stripe.com+...)
      💼 LinkedIn Jobs URL           (linkedin.com/jobs/search?keywords=...)
      🏠 Careers homepage           (the URL Claude gave us)

    Recruiter Outreach (3):
      👤 Tech Recruiter search       (linkedin.com/search/results/people?keywords=...)
      👥 Sourcer / TA search         (linkedin.com/search/results/people?keywords=...)
      🎖 Hiring Manager search       (linkedin.com/search/results/people?keywords=...)
```

Each link object has:
```javascript
{
  label: '🎯 Greenhouse',
  url: 'https://boards.greenhouse.io/stripe?t=Product+Manager',
  desc: 'Filtered job list'  // tooltip on hover
}
```

## Job search links (the four)

### 1. ATS-native search

The most reliable link. Each ATS platform has a known URL pattern for searching their job board:

```javascript
switch ((atsType || '').toLowerCase()) {
  case 'greenhouse':
    links.push({
      label: '🎯 Greenhouse',
      url: `https://boards.greenhouse.io/${atsSlug}?t=${primaryQuery}`,
      desc: 'Filtered job list'
    });
    break;
  case 'lever':
    links.push({
      label: '🎯 Lever',
      url: `https://jobs.lever.co/${atsSlug}?query=${primaryQuery}`,
      desc: 'Filtered job list'
    });
    break;
  case 'ashby':
    links.push({
      label: '🎯 Ashby',
      url: `https://jobs.ashbyhq.com/${atsSlug}?query=${primaryQuery}`,
      desc: 'Filtered job list'
    });
    break;
  case 'workday':
    links.push({
      label: '🎯 Workday',
      url: `https://${atsSlug}.wd1.myworkdayjobs.com/en-US/External?q=${primaryQuery}`,
      desc: 'Filtered (may need adjustment)'
    });
    break;
  // ... smartrecruiters, jobvite
}
```

We support 6 ATS platforms by template. We don't support iCIMS in this list because iCIMS URL structures vary too much per company (no consistent pattern).

If `atsType` is `"unknown"` or `"own"`, we skip the ATS-native link. The fallback (Google site-search) handles those cases.

### How we know the URL templates

These come from manually inspecting many real companies' ATS pages. For each ATS:
1. Visit a company that uses it
2. Search for a job title
3. Note the resulting URL pattern
4. Generalize to a template

For Greenhouse: visiting `boards.greenhouse.io/stripe`, searching "Product Manager", and watching the URL change to `?t=Product+Manager` reveals the `?t=` query parameter. Same idea for the others.

This is **manual research, not API documentation**. ATS vendors don't publish stable URL specs. Templates can break if a vendor restructures their URLs (rare, but happens). When that occurs, the Google site-search link still works as fallback.

### 2. Google site-search

This is the reliability workhorse. It works even when ATS detection fails.

```javascript
let domain = '';
try {
  if (careersUrl) {
    const u = new URL(careersUrl);
    domain = u.hostname;
  }
} catch(e) { /* ignore malformed URL */ }

const googleTerms = [];
if (domain) googleTerms.push(`site:${domain}`);

const atsDomain = getAtsDomain(atsType, atsSlug);
if (atsDomain && atsDomain !== domain) {
  googleTerms[googleTerms.length - 1] = `(site:${domain} OR site:${atsDomain})`;
} else if (!domain && atsDomain) {
  googleTerms.push(`site:${atsDomain}`);
}
googleTerms.push(`(${orQuery})`);
if (keywords) googleTerms.push(keywords);

links.push({
  label: '🔎 Google Jobs',
  url: `https://www.google.com/search?q=${encodeURIComponent(googleTerms.join(' '))}`,
  desc: 'Site-scoped search'
});
```

Concrete example. If we have:
- `careersUrl: 'https://stripe.com/jobs'`
- `atsType: 'greenhouse'`, `atsSlug: 'stripe'`
- `positions: ['Product Manager', 'Senior PM']`
- `keywords: 'Japanese speaking'`

We build the Google query:
```
(site:stripe.com OR site:boards.greenhouse.io) ("Product Manager" OR "Senior PM") Japanese speaking
```

Then URL-encode and prefix with `https://www.google.com/search?q=`.

This Google query, executed, returns the actual JD pages on Stripe's careers site OR their Greenhouse board, filtered by job title and bonus keyword. **First or second result is usually a real, current listing.**

### Why this is so powerful

Google indexes virtually every careers page. Site-search:
- Always works (no ATS-specific knowledge needed)
- Scopes to the right domain (no false positives from other companies)
- Honors the user's keywords (Japanese, Series B, remote, etc.)
- Returns up-to-date results (Google re-indexes daily)

The only downside: one extra click compared to ATS-native (Google → click result → JD page).

### 3. LinkedIn Jobs search

```javascript
links.push({
  label: '💼 LinkedIn',
  url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(company + ' ' + queryTerms[0])}`,
  desc: 'LinkedIn Jobs'
});
```

A simple keyword search on LinkedIn Jobs. We append the company name to the position to scope it.

LinkedIn has a `f_C` filter parameter for company ID, but those IDs are LinkedIn's internal numerics — we don't have them. Keyword matching with the company name works ~80% of the time.

LinkedIn Jobs is useful because:
- Some companies only list on LinkedIn (no public careers page)
- LinkedIn surfaces "your network has connections at this company" inline
- Easy Apply works for some listings

### 4. Careers homepage (fallback)

```javascript
if (careersUrl) {
  links.push({
    label: '🏠 Careers Page',
    url: careersUrl,
    desc: 'Company careers home'
  });
}
```

The unfiltered careers page. The user has to manually search from here. We include it because:
- If all other links fail, this works
- Some users want to browse the full company offering

## Recruiter outreach links (the three)

After job links, we add 3 LinkedIn People Search URLs targeting different roles in the company's recruiting org.

### 1. Technical Recruiter

```javascript
const techRecruiterQuery = encodeURIComponent(
  `("technical recruiter" OR "tech recruiter" OR "engineering recruiter") ${company}`
);
links.push({
  label: '👤 Recruiter',
  url: `https://www.linkedin.com/search/results/people/?keywords=${techRecruiterQuery}&origin=GLOBAL_SEARCH_HEADER`,
  desc: 'LinkedIn: Tech Recruiters at company'
});
```

The query: `("technical recruiter" OR "tech recruiter" OR "engineering recruiter") Stripe`

LinkedIn's people search interprets this naturally:
- Find people whose profile contains one of those titles
- AND whose profile mentions Stripe (almost always meaning current company)

The OR alternates because companies use varying titles — some say "tech recruiter", some "engineering recruiter", etc. Including all three captures the most matches.

### 2. Sourcer / Talent Acquisition

```javascript
const sourcerQuery = encodeURIComponent(
  `("sourcer" OR "recruiting coordinator" OR "talent acquisition") ${company}`
);
```

Sourcers are often the **first point of contact** in big-company hiring funnels. They reach out to candidates before the recruiter is involved. Cold outreach to a sourcer can bypass the resume-screen step entirely.

### 3. Hiring Manager (dynamic by role)

This one is smart — it picks different titles based on what kind of position the user is matched against:

```javascript
const posLower = (position || '').toLowerCase();
let hiringMgrTitles;
if (posLower.includes('engineer') || posLower.includes('developer') || posLower.includes('swe')) {
  hiringMgrTitles = '("engineering manager" OR "director of engineering" OR "VP engineering" OR "head of engineering")';
} else if (posLower.includes('product') || posLower.includes('pm')) {
  hiringMgrTitles = '("head of product" OR "director of product" OR "VP product" OR "group product manager")';
} else if (posLower.includes('design')) {
  hiringMgrTitles = '("design manager" OR "head of design" OR "director of design")';
} else if (posLower.includes('data') || posLower.includes('ml') || posLower.includes('ai')) {
  hiringMgrTitles = '("head of data" OR "director of data" OR "ML manager" OR "head of AI")';
} else {
  hiringMgrTitles = '("hiring manager" OR "director" OR "VP" OR "head of")';
}
```

This is **route-aware logic**. A SWE candidate gets EM/VP-Engineering searches; a PM candidate gets Head-of-Product searches; a designer gets Design Manager searches.

The fallback (`else`) covers anything that doesn't match these heuristics — uses generic titles that work everywhere.

### Why these three roles

They map to the three most useful outreach targets:

| Role | When to message | What to say |
|------|----------------|-------------|
| 👤 Tech Recruiter | After you've identified a specific JD you want to apply to | "Hi, I just applied to <role>. Wanted to flag it directly given my background in X." |
| 👥 Sourcer | Cold, before you've applied | "Hi, I'm a <experience> looking for <type of role>. Curious if Stripe has anything matching." |
| 🎖 Hiring Manager | Most direct, highest leverage when it works | "Hi, your team's work on X is impressive. I'm a <experience> with relevant background. Is there a path to chat?" |

All open in LinkedIn People Search results. Once there, the user picks an actual person and uses LinkedIn's Connect or Message feature.

## URL encoding subtleties

Look at this pattern, repeated everywhere:

```javascript
const primaryQuery = encodeURIComponent(position);
// then use it as:
url: `https://example.com/jobs?q=${primaryQuery}`
```

`encodeURIComponent` escapes characters that have special meaning in URLs (space → `%20`, ampersand → `%26`, etc.). Without it:
- Spaces in "Senior Product Manager" would break the URL
- Slashes in "AI/ML Engineer" would create wrong paths
- Ampersands in "Design & Research" would be interpreted as parameter separators

We apply it to every dynamic value going into a URL. Always.

There's a related function `encodeURI` — that's for encoding **whole URLs** (it doesn't escape `:`, `/`, etc.). We use `encodeURIComponent` because we're encoding **query parameter values**, where every special char must be escaped.

## The OR query convention

For LinkedIn people search, we wrap multi-term queries in quotes:

```
("technical recruiter" OR "tech recruiter" OR "engineering recruiter") Stripe
```

The quotes around each phrase tell LinkedIn to match that exact sequence (not just the individual words). The `OR` (uppercase) is a LinkedIn search operator. The unquoted "Stripe" is treated as an additional required keyword.

Google site-search uses the same syntax — quotes for phrases, OR (uppercase) for alternation.

This is **search-engine query language**. It's not standardized but most major search engines support these conventions.

## What to do when ATS detection is wrong

Sometimes Claude misidentifies the ATS. Maybe it says Stripe uses Lever (it doesn't — Stripe uses Greenhouse), so the ATS-native link 404s.

Handling this:
1. The Google site-search link **still works** — it queries the actual careers domain
2. The user can edit the URL manually and try the right ATS
3. We could detect ATS errors at runtime by fetching the URL — but that adds complexity and CORS issues

For now we lean on the redundancy: 4 links per company means at least one works.

## Future improvements

Things we considered but didn't build:

### Verifying URLs in real-time

After Claude returns matches, we could `fetch` each generated URL and check for 200 vs. 404. URLs that 404 would be hidden or marked. This would catch ATS misdetections.

The problem: many job sites block CORS for `fetch` from arbitrary origins. We'd need a backend proxy (which violates local-first).

### Real LinkedIn company IDs

If we maintained a lookup table from company name → LinkedIn company ID, we could use the proper `f_C=` filter for tighter results. But:
- Maintaining the table is endless work
- LinkedIn IDs change occasionally
- Keyword matching is "good enough"

### Caching link templates per company

If a user matches the same company multiple times, we regenerate the same URLs. We could cache. But the cost is so low (microseconds) it's not worth the complexity.

## Summary

`buildSearchLinks()` is a pure function: given a company match and user filters, it returns a list of URLs. No I/O, no async, no side effects. It's the kind of code that's easy to test, easy to extend, and easy to understand.

The principle behind it: **redundancy beats perfection**. We can't guarantee any single URL works, so we generate four (job) + three (recruiter) and let the user pick. At least one always lands them where they need to go.

Adding new link types is straightforward — see chapter 12 for "extending the system."

In the next chapter we'll cover the Editorial UI system: the CSS architecture and design language.
