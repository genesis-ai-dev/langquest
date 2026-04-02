# Workflow: Add Animation to a Component

<required_reading>
**Read these reference files NOW:**
1. `emil-design-eng` skill — for animation decision framework, easing theory, and component patterns
2. references/animation-principles.md — for mobile flow patterns (trays, fluidity, progressive disclosure)
3. references/animation-technical.md — for Reanimated APIs and project-specific implementation
4. references/project-conventions.md
</required_reading>

<process>
## Step 1: Run Emil's Decision Framework

Use the `emil-design-eng` skill's Animation Decision Framework:

1. **Should this animate at all?** (frequency table)
2. **What is the purpose?** (spatial consistency, state indication, feedback, preventing jarring changes)
3. **What easing should it use?** (entering/exiting → ease-out, moving → ease-in-out, hover → ease)
4. **How fast should it be?** (duration table)

If the animation doesn't serve a clear purpose, don't add it.

## Step 2: Choose the Animation Type

| Need | Approach |
|---|---|
| Button feedback | Scale to 0.97 on press, 160ms ease-out |
| Element appearing | Scale from 0.9 + opacity 0→1, ease-out |
| Sliding content | `translateX/Y`, snap to states |
| Reveal effect | `clip-path` inset animation |
| Interactive drag | Spring physics (Reanimated) |
| State change | Morph text/icons between states |
| Confirmation | Hold-to-action with clip-path fill |
| Celebration | Confetti, particle effects (rare features only) |

## Step 3: Implement (React Native Specifics)

**Easing:**
- Use custom easing from `@constants/animations.ts` (`easeOut`, `easeInOut`, `easeSnappy`, `easeSpring`)

**Performance:**
- Animate only `opacity` and `transform` for 60 FPS
- Never animate `width`, `height`, `padding`, `margin`

**Reanimated:**
- Use `.get()` and `.set()` on shared values (React Compiler compliant, not `.value`)
- Use `scheduleOnRN` for worklet-to-RN thread communication — pass function references only, never inline arrows
- For springs, use `withSpring` from Reanimated

## Step 4: Handle Transitions Between States

Check:
- Are persistent elements "traveling" between screens? (They should move, not duplicate)
- Is there directional awareness? (Left tab → content slides left)
- Could text labels morph between states instead of instant-switching?
- Are heights varying between steps in multi-step flows?

## Step 5: Accessibility

- Use `useReducedMotion()` hook from Reanimated
- Configure `reduceMotion` option in `withTiming`, `withSpring`, `withDelay`
- Use `.reduceMotion()` on layout animations (entering/exiting)
- When reduced motion is on, skip animations or use instant transitions

## Step 6: Verify

Test the animation:
- Feels snappy and purposeful (not gratuitous)
- Exit is faster than enter
- Origin matches trigger point
- Persistent elements travel (don't duplicate)
- `useReducedMotion()` respected
- No layout thrash (only opacity/transform animated)
- No inline arrow functions in worklets
- Shared values use `.get()`/`.set()` API
</process>

<anti_patterns>
Avoid:
- Animating for decoration without purpose (see Emil's decision framework)
- Animating layout properties (`width`, `height`, `margin`, `padding`)
- Using `.value` on shared values instead of `.get()`/`.set()`
- Inline arrow functions in worklets (crashes)
- Ignoring `useReducedMotion()` for accessibility
- Gratuitous delight on high-frequency features (becomes annoying)
</anti_patterns>

<success_criteria>
A well-animated component:
- Passes Emil's animation decision framework
- Uses custom easing from project constants
- Accessible with reduced motion support
- Performs at 60 FPS (opacity + transform only)
- Compiler-compliant shared value usage
- Persistent elements travel between states
</success_criteria>
