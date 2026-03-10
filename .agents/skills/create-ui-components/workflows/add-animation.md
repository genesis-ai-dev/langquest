# Workflow: Add Animation to a Component

<required_reading>
**Read these reference files NOW:**
1. references/animation-principles.md
2. references/animation-technical.md
3. references/project-conventions.md
</required_reading>

<process>
## Step 1: Define the Purpose

Before writing any animation code, answer:

- **Why does this animation exist?** (orient users, connect states, guide attention, enhance perception, delight)
- **How frequently will users see it?** (daily → subtle, occasional → satisfying, rare → memorable)
- **Does this transition show where the user came from and where they're going?**

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

## Step 3: Implement

**Timing:**
- Most animations under 500ms, never over 1s
- Exit animations faster than enter (200ms exit, 300ms enter)
- Use custom easing from `@constants/animations.ts` (`easeOut`, `easeInOut`, `easeSnappy`, `easeSpring`)

**Performance:**
- Animate only `opacity` and `transform` for 60 FPS
- Never animate `width`, `height`, `padding`, `margin`
- Use `clip-path` for reveal effects instead of dimension changes
- Use `will-change` only if experiencing actual performance issues

**Implementation:**
- Never scale from zero — start at scale(0.9)
- Set `transform-origin` to match the trigger point (origin-aware)
- For springs, use React Native Reanimated
- Use `.get()` and `.set()` on shared values (React Compiler compliant, not `.value`)
- Use `scheduleOnRN` for worklet-to-RN thread communication — pass function references only, never inline arrows

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
- Animating for decoration without purpose
- Using `linear` easing (feels unnatural in 99% of cases)
- Scaling from `0` (use 0.9 minimum)
- Built-in CSS easings (except `ease` or `linear`) — they lack energy
- Animating layout properties (`width`, `height`, `margin`, `padding`)
- Same speed for enter and exit (exit should be faster)
- Center `transform-origin` when a specific trigger point exists
- Ignoring `useReducedMotion()` for accessibility
- Using `.value` on shared values instead of `.get()`/`.set()`
- Inline arrow functions in worklets (crashes)
- Gratuitous delight on high-frequency features (becomes annoying)
</anti_patterns>

<success_criteria>
A well-animated component:
- Every animation serves a purpose (orient, connect, guide, enhance, delight)
- Uses custom easing from project constants
- Timing is under 500ms with faster exits than enters
- Origin-aware transforms from trigger point
- Persistent elements travel between states
- Accessible with reduced motion support
- Performs at 60 FPS (opacity + transform only)
- Matches intensity to feature frequency
</success_criteria>
