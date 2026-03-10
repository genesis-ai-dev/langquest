# Example Workflow: SaaS Churn Reduction

A complete walkthrough showing how to apply the Research-First Design methodology to reduce churn rate for a SaaS product — with focus on finding unique Win Strategies, not just best practices.

---

## Phase 0: Discovery

**Context:** TaskFlow — project management SaaS for small teams. Monthly churn rate at 8%, goal is to reduce to 4%. Scope: cancellation flow redesign + retention strategies.

**Questions answered:**

| Question | Answer |
|----------|--------|
| WHAT are we building? | Cancellation flow (web), retention interventions, win-back touchpoints |
| WHO is this for? | Team admins who manage billing, typically 28-45, decision-makers |
| WHAT should users accomplish? | If leaving: cancel cleanly with minimal friction. If saveable: find an alternative (pause, downgrade, discount) |
| WHAT feeling should it evoke? | Respectful, not desperate. "We value you" not "Please don't go!" |
| WHAT JOB is the user hiring this? | "Let me leave without guilt" OR "Help me find a reason to stay" |
| WHAT objections might they have? | "They're going to make this hard", "I'll lose my data", "They'll spam me" |
| WHAT should they remember tomorrow? | "That was surprisingly easy, and they actually tried to help" |
| ANY constraints? | Must work on web, integrate with Stripe billing, legal requirement to allow cancellation |

**Design Brief:**
> "Redesign the cancellation experience for TaskFlow team admins to reduce churn from 8% to 4%. The flow should feel respectful and helpful — offering genuine alternatives (pause, downgrade, discount) without being manipulative. Users who do cancel should leave with a positive impression and clear path to return."

---

## Phase 1: Research

### Focus Identified

**By Challenge:** Reducing churn (retention) + Building trust during exit
→ Focus on: retention offers, pause options, feedback collection, graceful exits

**By Goal:** UX/Flow optimization (improving journeys)
→ Focus on: step count, friction points, decision points, recovery paths

### Search Loop Executed

```
1. BROAD: "cancellation flow subscription" → 10 flows (web)
2. SPECIFIC: "cancel subscription retention" → 25 flows
3. COMPANY: "Spotify cancel" → detailed 8-step flow
4. ELEMENT: "pause subscription" → 921 screens
5. ELEMENT: "retention offer discount modal" → 1000+ screens
6. ADJACENT: "win back reactivate comeback" → fresh patterns
7. iOS SPECIFIC: "special offer discount popup" → gamification patterns
8. DEEP: get_flow for Clay, ElevenLabs, Train Fitness
```

**Total: 200+ screens/flows reviewed, 8 deep dives**

### Deep Dive Results (EXACT Details)

**Clay (flow 5888) — 7-step cancellation:**
- Step 2: "We're sorry to see you go" headline + 6 radio button reasons
- Step 4: Retention offer shows ticket-style graphic with "25% OFF FOR LIFE"
- Exact copy: "We'd love to share a special offer with you"
- Three CTAs: "Accept This Offer" (primary), "Back", "Decline Offer" (secondary)
- Step 5: Consequence screen lists EXACT features lost: "Unlimited contacts", "More frequent data enrichment", "Priority support"
- Step 7: Confirmation shows purple accent text "You won't be billed again."

**ElevenLabs (flow 8714) — 6-step cancellation:**
- Step 3: Shows THUMBNAILS of features being lost (not just text list)
- Step 4: Multi-select feedback (CHECKBOXES, not radio) — can select "Low usage" AND "Product didn't meet needs"
- Retention: "One time offer before you go!" with "Get 30% off your next month"
- Final state: "Cancelled" badge in red, "$0" next payment, "Resume subscription" button visible

**Train Fitness iOS (flow 7172):**
- Retention modal: Star icon + "You're eligible for a special offer"
- Uses native iOS subscription sheet (Edit Subscription)
- Post-cancel: "Renew: 39,99 €/year" button with exact pricing shown

### Three Lenses Applied

**Lens A: Structure**

Flow patterns discovered:
- 5-8 steps is standard (Clay: 7, ElevenLabs: 6, Spotify: 8)
- Modal-based flows dominate (prevents accidental navigation away)
- Consequence screen always BEFORE final confirm, not after

**Lens B: Visual Craft**

- Headlines: 20-28px, bold, empathetic tone ("We're sorry to see you go")
- Keep button: Primary color (green/blue), full-width or left position
- Cancel button: Ghost/secondary, gray text, smaller
- Feature loss: Uses checkmarks + thumbnail images (ElevenLabs), not just text bullets

**Lens C: Conversion & Soul**

| Company | EXACT Tactic | Why It Works |
|---------|--------------|--------------|
| Clay | "25% OFF FOR LIFE" ticket visual | Permanence ("for life") reduces "temporary fix" objection |
| ElevenLabs | Thumbnail previews of features | Loss aversion — seeing the actual UI makes loss concrete |
| BoldVoice | Strikethrough "$149.99" → "$99.99" | Anchoring + exact savings calculation visible |
| TikTok Shop | "YOU WON THE BIGGEST DISCOUNT" | Gamification — reframes cancellation as winning |

**For Flows:**
- Step count: 5-8 screens (optimal is 6 — enough for retention without frustration)
- Decision points: reason selection → offer → final confirm
- Friction reducers: "Back" always visible, progress implicit
- Recovery paths: "Resume subscription" shown immediately after cancel

### Research Summary

```
📊 RESEARCH SUMMARY
────────────────────────────────────────
Queries: 8 | Screens analyzed: 200+ | Deep dives: 8 flows

WHAT I FOUND:

  Flow structure:
  • Clay — 7-step modal flow
  • ElevenLabs — 6-step modal flow  
  • Spotify — 8-step flow
  • Most use: consequence screen before final confirm

  Discount presentation (varies significantly):
  • Clay: "25% OFF FOR LIFE" — text on ticket-style graphic
  • BoldVoice: "$149.99" strikethrough → "$99.99" 
  • TikTok: "YOU WON THE BIGGEST DISCOUNT" with coupon visual

  Feature loss display:
  • Most: bullet list of feature names
  • ElevenLabs: actual UI thumbnails (screenshots of features)

  Reason collection:
  • Clay, Spotify: radio buttons (single select)
  • ElevenLabs: checkboxes (multi-select)

  Specific copy that stood out:
  • ClassPass: "We'll send you a reminder 2 days before your trial ends"
  • Clay: "You won't be billed again." (purple accent)

GAPS: Win-back email timing not covered
────────────────────────────────────────
```

---

## Phase 2: Analyze

### Pattern Table

| Aspect | Clay | ElevenLabs | BoldVoice | TikTok | **Our Choice** |
|--------|------|------------|-----------|--------|----------------|
| Discount framing | "25% OFF FOR LIFE" | "30% off next month" | "$50 off" exact | "$100 coupon" | **"$X off for life"** (permanence + exact $) |
| Reason collection | Radio (single) | Checkbox (multi) | N/A | N/A | **Multi-select checkbox** |
| Feature loss display | Text list | Thumbnails | N/A | N/A | **Thumbnails where possible** |
| Offer language | "Special offer" | "One time offer" | "Gift just for you" | "You won" | **"One time offer"** (urgency without gamification) |
| Cancel CTA | "Decline Offer" | "Cancel Subscription" | "Proceed to cancel" | "Shop now" | **"No thanks, continue cancelling"** |

### Steal List

| Source | EXACT What | WHY It Works | How I'll Use It |
|--------|-----------|--------------|-----------------|
| Clay | "25% OFF FOR LIFE" ticket-style graphic | "For life" removes temp-fix objection; ticket visual = tangible value | Show "50% OFF FOR LIFE" after "too expensive" reason |
| ElevenLabs | Screenshot thumbnails of lost features | Loss aversion stronger with visual; abstract list < concrete UI | Show mini-screenshots of dashboard, reports, integrations |
| ElevenLabs | Multi-select checkboxes (not radio) | Users have multiple reasons; single choice loses insights | Replace radio with checkboxes, allow 1-3 selections |
| BoldVoice | Strikethrough "$149.99" → "$99.99" with exact savings | Anchoring + specific dollars > percentage | Show "$24/mo → $12/mo (save $144/year)" |
| TikTok | Scalloped coupon edge visual | Physical metaphor = perceived tangible value | Use coupon-style card for discount offer |
| ClassPass | "Reminder 2 days before" specific timing | Removes #1 anxiety about surprise charges | Add "We'll remind you 2 days before any charge" |
| Train Fitness | Exact pricing on "Renew" button | Removes friction to re-subscribe | Show "Reactivate: $24/mo" (not just "Reactivate") |
| Spotify | "How likely to return?" NPS on final screen | Predicts win-back candidates | Add 1-10 scale on goodbye screen |

**Categories covered:**
- ✅ Retention offer (permanent framing: "for life")
- ✅ Objection killer (specific timing for charge reminder)
- ✅ Friction reducer (multi-select, not forced single choice)
- ✅ Visual treatment (thumbnails, coupon visual)
- ✅ Micro-detail (strikethrough pricing, exact amounts)
- ✅ Memorable element (NPS for win-back prediction)

---

## Phase 3: Design

### Persuasion Layer

| Element | Our Answer | Implementation |
|---------|------------|----------------|
| **Hook** (first 3 sec) | "Before you go — we have a one-time offer" | Modal headline after reason selection |
| **Story arc** | Reason → Offer (conditional) → Consequences → Confirm → Goodbye | 5-6 screens |
| **Objection killers** | 1. Price → $X off for life 2. Surprise charge → "2-day reminder" 3. Data loss → "Export anytime" | Inline on relevant screens |
| **Trust signals** | "Reactivate anytime" + exact pricing on button | Confirm + Goodbye screens |
| **Urgency/Scarcity** | "This offer expires in 24 hours" (only for discount) | Countdown on offer modal |
| **The memorable thing** | Feature thumbnails + "for life" discount | Consequence + Offer screens |

### Typography System

- Display: Inter/System, 28px, -0.02em tracking
- H1: 20px, medium weight
- Body: 16px, regular, 1.5 leading
- Caption: 14px, secondary color (#666)
- ALL CAPS labels: 12px, 0.06em tracking

### Color Palette

- Background: #FFFFFF / #121212 (dark mode)
- Text primary: #1A1A1A / #FFFFFF
- Text secondary: #666666 / #A0A0A0
- Primary CTA (Keep): #22C55E (green)
- Secondary CTA (Cancel): Ghost, #666666 text
- Offer accent: #F59E0B (amber) — coupon/discount
- Destructive: #EF4444 — final confirm only

### Spacing System

- Base unit: 8px
- Scale: 8, 16, 24, 32, 48, 64
- Modal padding: 32px
- Section gap: 24px
- Element gap: 16px

### The Soul (20%)

- **Bold visual choice:** Coupon-style card with scalloped edge for discount offer
- **Voice:** "We'd hate to lose you over price" (second person, empathetic)
- **Memorable detail:** Feature thumbnails showing actual UI being lost
- **Micro-interaction:** Checkmark animation when discount is applied

### Output: Flow Architecture

```
STEP 1: Current Plan
└── [Cancel subscription] link

STEP 2: Reason Collection
├── "Help us improve — why are you leaving?"
├── ☑️ Checkboxes (multi-select, not radio):
│   □ Too expensive for my needs
│   □ Not using it enough  
│   □ Missing features I need
│   □ Found another tool
│   □ My project ended
│   □ Other
├── Optional text area
└── → Routes based on selection

STEP 3: Retention Offer (conditional — only if "too expensive")
├── Coupon-style card with scalloped edge
├── "50% OFF FOR LIFE"
├── Strikethrough: "$24/mo → $12/mo"
├── "Save $144/year"
├── Timer: "Offer expires in 23:59:42"
├── [CLAIM THIS OFFER] amber button
└── [No thanks, continue cancelling] ghost link

STEP 4: Consequence Screen
├── "Here's what you'll lose access to:"
├── Feature thumbnails (not just text):
│   [📊 Dashboard] [📈 Reports] [🔗 Integrations]
├── "Your data will be saved for 30 days"
├── [KEEP MY SUBSCRIPTION] green, full-width
└── [Confirm cancellation] ghost, smaller

STEP 5: Final Confirmation
├── "Confirm cancellation"
├── "Your access ends: [DATE]"
├── "We'll remind you 2 days before any future charges"
├── [KEEP SUBSCRIPTION] green
└── [Yes, cancel my subscription] red text

STEP 6: Goodbye + Win-back
├── "You're all set"
├── "Access until [DATE]"
├── "The door is always open"
├── [Reactivate: $24/mo] — exact pricing
├── [Get feature updates] checkbox
└── NPS: "How likely are you to try TaskFlow again?" [1-10]
```

---

## Phase 4: Implement

### Build Checklist

- [x] Multi-select checkboxes for reasons (not radio)
- [x] Conditional routing based on reason
- [x] Coupon-style card with scalloped edge for discount
- [x] "FOR LIFE" permanence framing
- [x] Strikethrough pricing with exact savings
- [x] 24h countdown timer on offer
- [x] Feature thumbnails (actual UI screenshots)
- [x] "2 days before" reminder copy
- [x] Exact pricing on reactivate button
- [x] NPS scale on final screen
- [x] Mobile-responsive modals
- [x] `prefers-reduced-motion` support

### Quality Gate

| Category | Check | Status |
|----------|-------|--------|
| **Functional** | All reason→offer routing works? Timer counts down? | ✅ |
| **Visual** | Coupon card visible? Thumbnails load? | ✅ |
| **Persuasion** | "For life" framing present? Exact $ amounts? | ✅ |
| **Polish** | Multi-select works? NPS saves? | ✅ |

### Side-by-Side Test

Compared against Clay, ElevenLabs, BoldVoice:

| Criteria | Score |
|----------|-------|
| Win Strategies implemented | ✅ 6/8 from steal list |
| Specificity (exact copy/numbers) | ✅ All offers have exact $ |
| Uniqueness | ✅ Thumbnails + FOR LIFE combo |
| Usability | ✅ Multi-select, clear paths |

**Result:** Exceeds references by combining best tactics from multiple sources.

---

## Key Takeaways

1. **Clay uses "FOR LIFE"** — "25% OFF FOR LIFE" instead of time-limited discount

2. **ElevenLabs shows thumbnails** — actual UI screenshots of features, not text list

3. **ElevenLabs uses multi-select** — checkboxes for reasons, not single radio

4. **BoldVoice shows exact $** — "$149.99 → $99.99" with strikethrough

5. **ClassPass gives specific timing** — "2 days before your trial ends"

6. **Spotify asks NPS on exit** — "How likely to return?" for win-back targeting
