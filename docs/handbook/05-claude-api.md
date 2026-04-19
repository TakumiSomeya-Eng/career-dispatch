# Chapter 5 — The Match Engine: Calling the Claude API

This is the most interesting chapter for understanding LLM-driven product features. We'll cover what we send Claude, why we structure it that way, how we parse what comes back, and how we handle errors.

## The 30,000-foot view

```
User clicks "Generate Matches"
         │
         ▼
  Build prompt string ──────► Send POST to api.anthropic.com
                                       │
                                       ▼
                              Claude generates JSON array
                                       │
                              ◄────────┘
         ┌───────────────────┘
         ▼
  Parse JSON from response
         │
         ▼
  Enrich each entry with search links
         │
         ▼
  Render table
```

The whole thing is one round-trip. We don't stream, we don't paginate, we don't use tools. Just one prompt → one response → render.

## The fetch call

Here's the actual network code:

```javascript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true"
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }]
  })
});
```

Let's break each piece down.

### Endpoint

`https://api.anthropic.com/v1/messages` is Anthropic's standard Messages API. It's not a streaming endpoint — for streaming, you'd add `stream: true` and consume an SSE response. We don't need streaming because we render the full table only after parsing complete JSON.

### Headers

| Header | Purpose |
|--------|---------|
| `Content-Type: application/json` | Tells the server we're sending JSON |
| `x-api-key: ...` | Authentication. Sent to Anthropic only. |
| `anthropic-version: 2023-06-01` | API version. Pinned so behavior doesn't change on us. |
| `anthropic-dangerous-direct-browser-access: true` | Required for browser-direct calls. Bypasses CORS guard. |

The `anthropic-dangerous-direct-browser-access` header is named that way deliberately — Anthropic wants developers to **think** before sending API keys from browsers. We thought about it (chapter 2 and chapter 10 cover the reasoning) and decided it's appropriate for this use case.

If you remove this header, the browser blocks the request with a CORS error before it even leaves your machine. Anthropic's CORS policy is "no by default, opt-in via this header."

### Body

```json
{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 8000,
  "messages": [{ "role": "user", "content": "..." }]
}
```

| Field | Notes |
|-------|-------|
| `model` | The exact model snapshot. We pin to a specific version (not `claude-sonnet-4-5-latest`) so behavior is reproducible. |
| `max_tokens` | Maximum tokens Claude can generate. 8000 is generous — typical responses are 2000–4000. |
| `messages` | The conversation. We send one user message; no system message, no prior turns. |

Why no system message? Because we want the prompt's structure to be visible in one place. Splitting between `system` and `user` would scatter the logic. For a one-shot call like this, a single user message is cleaner.

If we were building a chat experience with multiple turns, we'd use `system` for persistent instructions and accumulate user/assistant pairs.

## The prompt

Here's the meaty part — `buildMatchPrompt()`:

```javascript
function buildMatchPrompt(resume, count, industry, location, positions, keywords) {
  let criteria = '';
  if (industry) criteria += `\n- Industry focus: ${industry}`;
  if (location) criteria += `\n- Location preference: ${location}`;
  if (positions.length > 0) {
    criteria += `\n- Target positions (OR filter — the candidate is open to ANY of these titles): ${positions.join(', ')}`;
    criteria += `\n  → For each company, pick the target title MOST LIKELY to be a real, currently-open role at that company.`;
  }
  if (keywords) {
    criteria += `\n- Additional qualifiers/keywords (OR filter — bonus points if the company/role satisfies these): ${keywords}`;
    criteria += `\n  → Give higher matchScore to companies that visibly meet these qualifiers...`;
  }

  return `You are an expert US tech recruiter and career strategist...
RESUME (primary target role: ${resume.role || 'not specified'}):
"""
${resume.content}
"""

SEARCH CRITERIA:${criteria || '\n(none — infer from resume)'}

For EACH company, determine:
1. The company's official careers domain
2. Which ATS platform they use, from: "greenhouse", "lever", "ashby", "workday", ...
3. Their ATS board slug if applicable

Return ONLY a JSON array of ${count} objects. Each object must have these exact fields:
- "company": ...
- "position": ...
- "careersUrl": ...
- "atsType": ...
- "atsSlug": ...
- "matchScore": ...
- "matchReason": ...
- "tags": ...

EXAMPLES of realistic careersUrl + atsType combinations:
- Stripe → careersUrl: "https://stripe.com/jobs/search", atsType: "greenhouse", atsSlug: "stripe"
- Notion → careersUrl: "https://www.notion.so/careers", atsType: "ashby", atsSlug: "notion"
...

Output ONLY the JSON array, no markdown, no prose, no code fences.`;
}
```

This is a long prompt. Every section has a purpose.

### Section 1: Role assignment

```
You are an expert US tech recruiter and career strategist.
```

This is the "persona" line. It primes Claude to access knowledge appropriate for the task. Not magic — modern Claude is good without persona priming — but it doesn't hurt and helps with consistency.

### Section 2: Input data (the resume)

```
RESUME (primary target role: ${resume.role || 'not specified'}):
"""
${resume.content}
"""
```

Triple-quote delimiters help Claude distinguish the resume content from the surrounding instructions. Without them, a resume containing the word "instructions" might get parsed as part of our prompt (a primitive form of prompt injection).

`resume.role` is provided as context but the resume content itself is the primary signal.

### Section 3: Filters

```
SEARCH CRITERIA:
- Industry focus: Fintech
- Location preference: NYC or Remote
- Target positions (OR filter): Product Manager, Senior PM
  → For each company, pick the target title MOST LIKELY to be open
- Additional qualifiers: Japanese speaking, Series B+
  → Give higher matchScore to companies that visibly meet these qualifiers
```

Notice the **explanatory hints with `→` arrows**. These tell Claude *what to do with* each filter, not just *that* the filter exists. Without them, Claude might silently ignore filters or apply them inconsistently.

The keywords are sent verbatim — we don't tokenize, parse, or validate. Whatever the user types becomes natural language Claude interprets.

### Section 4: Required output structure

```
For EACH company, determine:
1. The company's official careers domain
2. Which ATS platform they use, from: "greenhouse", "lever", ...
3. Their ATS board slug if applicable
```

We tell Claude **what it needs to figure out before it can return**. This decomposes the task. Claude does better when complex inference is broken into named subtasks.

### Section 5: Schema specification

```
Each object must have these exact fields:
- "company": company name (string)
- "position": specific role title that matches best (string)
- "careersUrl": ...
- "atsType": ...
- "matchScore": an integer 0-100 representing fit quality
- "matchReason": 1-2 sentence explanation, max 200 chars
- "tags": array of 2-5 short strings
```

Specifying field names, types, and constraints in plain English is far more reliable than asking for "JSON" without saying what shape. Claude follows this very faithfully.

### Section 6: Few-shot examples

```
EXAMPLES of realistic careersUrl + atsType combinations:
- Stripe → "https://stripe.com/jobs/search", atsType: "greenhouse", atsSlug: "stripe"
- Notion → "https://www.notion.so/careers", atsType: "ashby", atsSlug: "notion"
- Salesforce → "https://careers.salesforce.com", atsType: "workday", atsSlug: "salesforce"
- Google → "https://www.google.com/about/careers/applications/jobs/results/", atsType: "own", atsSlug: null
```

Few-shot examples are **the single highest-leverage thing in this prompt**. Without them, Claude's `careersUrl` values would be hit-and-miss guesses. With them, Claude pattern-matches "company X uses ATS Y, slug Z" with much better accuracy.

We picked examples that span:
- Big public companies (Salesforce, Google)
- Famous startups (Stripe, Notion)
- All four major ATS platforms (Greenhouse, Lever, Ashby, Workday)
- The "own system" case (Google) with `atsSlug: null` showing how to handle uncertainty

### Section 7: Output format directive

```
Output ONLY the JSON array, no markdown, no prose, no code fences.
```

This is the most repeated instruction in our prompt for a reason. Claude has a strong tendency to wrap JSON in markdown code fences (```json ... ```) for readability. We don't want that — we want raw JSON we can `JSON.parse`.

Despite this instruction, Claude sometimes still adds fences. Our parsing code handles that case (next section).

## Parsing the response

The response from Anthropic looks roughly like:

```javascript
{
  id: "msg_...",
  type: "message",
  role: "assistant",
  content: [
    { type: "text", text: "[\n  {\n    \"company\": \"Stripe\", ...}\n  ]" }
  ],
  model: "claude-sonnet-4-5-20250929",
  stop_reason: "end_turn",
  usage: { input_tokens: 850, output_tokens: 2400 }
}
```

The actual generated text is in `content[0].text`. We extract it:

```javascript
const text = data.content
  .filter(c => c.type === 'text')
  .map(c => c.text)
  .join('\n');
```

We filter by type because future API versions might include `tool_use` or other block types. We `.join('\n')` defensively in case the response has multiple text blocks.

Then we parse:

```javascript
const cleaned = text.replace(/```json|```/g, '').trim();
let matches;
try {
  matches = JSON.parse(cleaned);
} catch (e) {
  // try to extract JSON from within text (in case Claude added prose around it)
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) matches = JSON.parse(m[0]);
  else throw new Error('Could not parse results: ' + cleaned.substring(0, 200));
}
```

Two-pass parsing:
1. Strip code fences (```json and ```) and try direct parse
2. If that fails, search for the first `[...]` block in the text and parse that

This handles three failure modes:
- Claude wrapped output in code fences → fence stripping fixes it
- Claude added a prose intro like "Here are the matches:" → regex extraction skips the prose
- Output is genuinely malformed → throw an error with the first 200 chars for debugging

We could be more aggressive (e.g., asking Claude to re-generate on parse failure) but in practice this two-pass works ~99% of the time.

## Enrichment: adding search links

Once we have the parsed array of company matches, we enrich each one with computed search URLs:

```javascript
matches = matches.map(m => ({
  ...m,
  searchLinks: buildSearchLinks(m, positions, keywords)
}));
```

`buildSearchLinks()` is covered in detail in chapter 6. Briefly: it takes the company name, position, ATS type/slug, and user-supplied filters, and generates 4 job-search URLs + 3 LinkedIn recruiter-search URLs.

## Error handling

Our code wraps the entire flow in try/catch:

```javascript
try {
  // ... build prompt, fetch, parse, enrich
  renderMatches(matches, resume);
} catch (err) {
  resultsEl.innerHTML = `
    <div class="card" style="border-color: var(--accent);">
      <div class="card-label">Error</div>
      <div class="card-title">Matching failed</div>
      <p>${escapeHtml(err.message)}</p>
      <p>Check that your API key is valid and has credits. See console (F12) for details.</p>
    </div>`;
  console.error('Match error:', err);
}
```

Error categories we catch:
- **HTTP errors** (4xx/5xx from Anthropic) — surfaced via `throw new Error(\`API ${response.status}: ${errText}\`)`
- **Network errors** (offline, DNS failure) — fetch rejects
- **Parse errors** (malformed JSON) — JSON.parse throws
- **Validation errors** (missing required fields) — currently not validated; future improvement

Common error scenarios and what they look like:

| User sees | Underlying cause |
|-----------|------------------|
| "API 401: Invalid API key" | Wrong/expired API key |
| "API 429: Rate limit exceeded" | Too many requests in short time |
| "API 529: Overloaded" | Anthropic service issue, retry |
| "Failed to fetch" | Network down or CORS blocked (missing dangerous-browser-access header) |
| "Could not parse results: ..." | Claude returned non-JSON for some reason |

Note we don't auto-retry. If a request fails, the user clicks Generate Matches again. This is acceptable for a UI-driven flow.

## Cost considerations

Each match query consumes tokens:
- **Input**: prompt (~3,500 tokens with examples) + resume (~500–1500 tokens depending on length) ≈ 4,000–5,000 tokens
- **Output**: 5–25 companies × ~120 tokens each ≈ 600–3,000 tokens

At Claude Sonnet 4.5 pricing (as of 2026: $3 per million input tokens, $15 per million output tokens):
- Input cost per query: ~$0.012–0.015
- Output cost per query: ~$0.009–0.045
- **Total: $0.02–0.06 per match query**

For most users this is negligible. Heavy users (50 queries/week) spend ~$1–3/week.

If cost matters more, you could:
- Use Claude Haiku 4.5 (cheaper, slightly less accurate)
- Cache previous match runs (we don't currently)
- Reduce the few-shot examples (cuts input tokens but reduces accuracy)

## Why we chose this prompt structure

Many alternative structures would work. We arrived at this one through iteration:

| Structure | Why we rejected it |
|-----------|-------------------|
| **Tool use / function calling** | Adds complexity (defining tool schemas) without benefit for one-shot JSON generation |
| **Multi-turn chat** | Would let us refine matches, but doubles latency and complicates UX |
| **Streaming** | We render the table only when parsing succeeds, so streaming buys nothing |
| **System message + sparse user message** | Splits the prompt across two places; harder to maintain |
| **Asking Claude to generate code that generates URLs** | Indirection without benefit; URL templates are hardcoded |
| **Pre-filtered company database + ranking by Claude** | Would need a 50,000-company database to be useful; we'd lose generality |

The current structure is "single user message, plain English specification, JSON output." It's boring but reliable. **Boring is good in production code.**

## Iteration tips

When changing the prompt, follow this loop:

1. **Run a known query** on the current prompt; record the output
2. Make ONE change to the prompt
3. Run the same query 3–5 times (LLM output varies)
4. Compare to the baseline: did your change improve the desired metric? (Specificity? Accuracy of `atsType`? Better tags?)
5. If yes, keep it. If no, revert.

Don't change multiple things at once. Don't trust a single sample.

For systematic prompt evaluation, you'd want a test harness with curated input/output pairs and an automated diff. We don't have one — at our scale, manual iteration is enough.

## Summary

The Match Engine is **a single API call wrapped in good error handling and post-processing**. The prompt is verbose but principled: every section serves a purpose. The parsing is defensive against common LLM output quirks. The cost per query is small enough to ignore.

If you understand this chapter, you understand 80% of how to build any LLM-powered feature.

In the next chapter we'll examine how `buildSearchLinks()` turns a match object into multiple actionable URLs.
