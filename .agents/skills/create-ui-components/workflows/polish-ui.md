# Workflow: Polish Existing UI

<required_reading>
**Read these reference files NOW:**
1. `emil-design-eng` skill — for animation review checklist, decision framework, and component patterns
2. references/animation-principles.md — for mobile flow patterns (trays, fluidity, progressive disclosure)
3. references/animation-technical.md — for Reanimated APIs and project-specific implementation
4. references/project-conventions.md
</required_reading>

<process>
## Step 1: Audit Current State

**Transitions:**
- Are screen transitions smooth or abrupt?
- Do persistent elements travel between states or duplicate?
- Is there directional awareness (tab → content direction)?
- Could text labels morph instead of instant-switching?

**Micro-interactions:**
- Run Emil's review checklist against the component
- Are enter/exit animations present where needed?

**Delight assessment:**
- Use Emil's frequency table to match intensity to usage
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

Apply animations where they serve a purpose (use Emil's decision framework):

**High-impact, low-effort:**
- Button press feedback (scale 0.97, 160ms ease-out)
- Origin-aware dropdowns/popovers
- Faster exit than enter
- Custom easing from `@constants/animations.ts`

**Medium-effort:**
- Element appearing: scale from 0.9 + opacity fade, ease-out
- State transitions with directional awareness
- Text morphing between labels
- Persistent elements traveling between screens

**Higher-effort (match to feature frequency):**
- Spring-based interactive elements (drag, swipe) via Reanimated
- Clip-path reveal animations
- Hold-to-action confirmations
- Multi-step flow with varying tray heights

## Step 4: Verify Polish

- [ ] No abrupt transitions — everything connects smoothly
- [ ] Passes Emil's review checklist
- [ ] Persistent elements travel (don't duplicate)
- [ ] Directional awareness in tab/page transitions
- [ ] Reduced motion respected (`useReducedMotion()`)
- [ ] No layout property animations (only opacity + transform)
- [ ] Custom easing curves from project constants
- [ ] Delight intensity matches feature frequency
- [ ] Dark/light mode consistent
- [ ] Loading states use `ActivityIndicator`
- [ ] NativeWind conventions followed
- [ ] Shared values use `.get()`/`.set()` API
</process>

<anti_patterns>
Avoid:
- Adding delight before fixing fundamentals (polish everywhere first)
- Animating layout properties (width, height, margin)
- Ignoring reduced motion preferences
- Duplicating elements that should travel between states
- Teleporting between screens (add directional transitions)
</anti_patterns>

<success_criteria>
A polished UI:
- Feels alive and responsive without being overwhelming
- Passes Emil's review checklist and decision framework
- Transitions connect states visually
- Fundamentals are flawless (layout, loading, accessibility)
- Consistent across dark/light mode
- Follows all project conventions
</success_criteria>
