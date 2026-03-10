# Workflow: Polish Existing UI

<required_reading>
**Read these reference files NOW:**
1. references/animation-principles.md
2. references/animation-technical.md
3. references/project-conventions.md
</required_reading>

<process>
## Step 1: Audit Current State

Review the existing component/screen for:

**Transitions:**
- Are screen transitions smooth or abrupt?
- Do persistent elements travel between states or duplicate?
- Is there directional awareness (tab → content direction)?
- Could text labels morph instead of instant-switching?

**Micro-interactions:**
- Do buttons have press feedback (scale 0.97)?
- Are enter/exit animations present where needed?
- Are exits faster than enters?
- Is transform-origin set to match trigger points?

**Delight assessment:**
- How frequently is this feature used? (Match intensity accordingly)
- Are there opportunities for surprise/discovery?
- Is the rest of the app polished enough to support adding delight here?

**Conventions check:**
- NativeWind styling (no margin, use gap)
- `cn()` for className merging
- Icons via `<Icon as={...} />`
- Colors via `useThemeColor` in JS
- `ActivityIndicator` for loading states
- No `forwardRef`, no ESLint disables

## Step 2: Fix Fundamentals First

Before adding delight, ensure baseline polish:

1. **Layout:** Replace any margin with flex + gap
2. **Loading states:** Swap custom spinners for `ActivityIndicator`
3. **Focus management:** Add focus trapping/return for modals/drawers
4. **Color consistency:** Use design tokens, verify dark/light mode
5. **Text:** No leading-none, minimum line-height 1.3
6. **Keyboard:** Proper handling in forms, dismiss before navigation
7. **Accessibility:** Reduced motion support, ARIA attributes, contrast

> "It's like going to a fancy restaurant but finding it has a dirty bathroom." Fix fundamentals everywhere before adding delight anywhere.

## Step 3: Add Purposeful Motion

Apply animations where they serve a purpose:

**High-impact, low-effort improvements:**
- Button press feedback (scale 0.97, 160ms ease-out)
- Origin-aware dropdowns/popovers
- Faster exit than enter animations
- Custom easing from `@constants/animations.ts`

**Medium-effort improvements:**
- Element appearing: scale from 0.9 + opacity fade, ease-out
- State transitions with directional awareness
- Text morphing between labels
- Persistent elements traveling between screens

**Higher-effort improvements (match to feature frequency):**
- Spring-based interactive elements (drag, swipe)
- Clip-path reveal animations
- Hold-to-action confirmations
- Multi-step flow with varying tray heights

## Step 4: Apply Delight (Feature Frequency Appropriate)

| Feature Frequency | Appropriate Delight |
|---|---|
| Daily use | Subtle: commas shifting in numbers, smooth transitions |
| Occasional use | Satisfying: drag-and-drop with stacking, smooth reordering |
| Rare use | Memorable: confetti on completion, interactive onboarding animation |

**Delight patterns:**
- Easter eggs discovered unexpectedly
- Gentle shimmer effects for stealth/hidden modes
- Animated arrows guiding first-time users
- Sequin-like QR code transformations
- Skeuomorphic trash can for deletion

## Step 5: Verify Polish

Run through checklist:

- [ ] No abrupt transitions — everything connects smoothly
- [ ] Button press feedback on all interactive elements
- [ ] Exit animations faster than enter
- [ ] Transform-origin matches trigger point
- [ ] Persistent elements travel (don't duplicate)
- [ ] Directional awareness in tab/page transitions
- [ ] Reduced motion respected (`useReducedMotion()`)
- [ ] No layout property animations (only opacity + transform)
- [ ] Custom easing curves (not built-in)
- [ ] Delight intensity matches feature frequency
- [ ] Dark/light mode consistent
- [ ] Loading states use `ActivityIndicator`
- [ ] NativeWind conventions followed
</process>

<anti_patterns>
Avoid:
- Adding delight before fixing fundamentals (polish everywhere first)
- Heavy animation on daily-use features (becomes tiresome)
- Generic center transform-origin (use trigger-aware origins)
- Same speed for enter/exit (exit must be faster)
- Animating layout properties (width, height, margin)
- Ignoring reduced motion preferences
- Using built-in easings (use custom curves)
- Duplicating elements that should travel between states
- Teleporting between screens (add directional transitions)
</anti_patterns>

<success_criteria>
A polished UI:
- Feels alive and responsive without being overwhelming
- Every animation serves a purpose
- Transitions connect states visually
- No abrupt state changes
- Delight matches feature frequency
- Fundamentals are flawless (layout, loading, accessibility)
- Consistent across dark/light mode
- Accessible with reduced motion support
- Follows all project conventions
</success_criteria>
