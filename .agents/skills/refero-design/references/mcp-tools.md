# Refero MCP Tools Reference

Refero MCP has 5 tools. Tool names use `refero_*_tool` format (e.g., `refero_search_screens_tool`).

## `refero_search_screens_tool` — Visual Exploration

**Best for:** Single screens, specific UI patterns, visual inspiration.

**Parameters:**
- `query` — semantic search (required)
- `platform` — `"ios"` | `"web"` (required)

**Query examples (simple):**
```
"pricing page"
"forgot password"  
"skeleton loading"
"data table with filters"
"headspace subscription"
```

**Query examples (complex — combine freely):**
```
"iOS paywall modal with annual/monthly toggle and dark mode"
"onboarding welcome screen with illustration and progress indicator"
"error state for email input with inline validation message"
"product analytics dashboard with activity heatmap"
```

**Pro tips:**
- Use `platform: "ios"` or `platform: "web"` for focused results
- Start broad, then narrow: `"onboarding"` → `"fintech onboarding"` → `"KYC verification"`
- Mix query types: screen type + company + style = `"Notion settings dark mode"`

---

## `refero_search_flows_tool` — Journey Understanding

**Best for:** Multi-step processes, user journeys, flow logic.

**Parameters:**
- `query` — semantic search (required)
- `platform` — `"ios"` | `"web"` (required)

**Query examples:**
```
"signing up"
"onboarding airbnb"
"canceling subscription"
"checkout flow with promo code"
"password reset flow with 2FA"
```

**When to use flows vs screens:**
- **Screens** when you need visual inspiration for a single screen
- **Flows** when you need to understand the full journey (onboarding, checkout, etc.)

---

## `refero_get_screen_tool` — Deep Dive on Specific Screen

**Best for:** Detailed analysis after finding promising examples in search.

**Parameters:**
- `screen_id` — ID from search results (required)

**Optional parameters:**

**`image_size`** — choose wisely:
| Value | When to use | Size |
|-------|-------------|------|
| `"none"` | Default. Text descriptions are usually enough | 0 KB |
| `"thumbnail"` | Need to visually evaluate layout | ~30-100 KB |
| `"full"` | Need fine UI details (icons, typography, exact spacing) | ~400KB-2MB |

**`include_similar: true`** — get similar screens from other apps.

**`similar_limit`** — how many similar screens (default: 4, max: 20)

---

## `refero_get_flow_tool` — Complete Journey Analysis

**Best for:** Understanding end-to-end user experience after finding a flow in search.

**Parameters:**
- `flow_id` — ID from search results (required)

**Note:** Does NOT support `image_size` parameter. Returns text descriptions only.

Returns:
- All screens with full descriptions
- For each step: goal, action, system response
- User problem description
- Related search queries

---

## `refero_get_design_guidance_tool` — AI-Powered Best Practices

**Best for:** When you're stuck, starting fresh, or need a "second opinion." Takes ~15-30 seconds.

**How it works:**
1. You give context (queries) and ask a question.
2. The server analyzes hundreds of screens.
3. It returns a structured guide: what's standard, what's unique, and what to avoid.

**Example:**
```
queries: [
  "paywall",
  "subscription pricing screen", 
  "premium upgrade modal",
  "free trial"
]
question: "How to create a converting paywall for a photo app?"
```

**Response includes:**
- **must_do** — required elements (conventions, requirements)
- **consider** — ideas for uniqueness (who does it, why it works)
- **avoid** — anti-patterns (what to avoid and why)
- **examples** — specific screens to study

---

## Tips for Better Results

**Query formulation:**
- If 0 results → broaden query, remove specific words
- Too many irrelevant results → add context (platform, company, style)
- Combine multiple aspects: `"fintech onboarding ios"` vs just `"onboarding"`

**Efficiency:**
- Text descriptions from `get_flow` and `get_screen` are usually sufficient
- Use `image_size` only for `get_screen` when visuals needed
- Use `include_similar: true` to discover related approaches

**Platform filter:**
- `platform: "ios"` — required for mobile app patterns
- `platform: "web"` — required for web app/site patterns

**Common errors:**
- Missing `platform` → add `platform: "ios"` or `platform: "web"`
- `image_size` on `get_flow` → not supported, remove parameter
- `limit`/`num_results` on search → not supported, pagination handled automatically
