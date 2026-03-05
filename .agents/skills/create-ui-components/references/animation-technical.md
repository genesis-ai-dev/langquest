<overview>
Technical animation implementation: easing, timing, springs, performance, and accessibility. Covers the "how" of building polished animations in React Native.
</overview>

<timing>
- Default to `ease-out` for most animations
- Never longer than 1s (unless illustrative); most under 500ms
- Release/exit animations faster than enter (e.g., 200ms exit vs 300ms enter)
- Make things _feel_ snappy—perception matters more than raw numbers
</timing>

<easing>
- Don't use built-in CSS easings unless `ease` or `linear`
- Built-in easings lack "energy"—use custom sharp curves
- **Default: Ease-Out** — kicks off immediately, provides real-time feedback
- **Consider Ease-In-Out** — for elements that move and scale but stay on screen
- **Avoid Linear** — feels unnatural; avoid in 99% of cases

Use custom easing curves from `@constants/animations.ts`:
- Import `easeOut`, `easeInOut`, `easeSnappy`, or `easeSpring`
- Use with React Native Reanimated animations
</easing>

<button_press_feedback>
Always add subtle scale-down on press for immediate feedback:

```css
.button {
  transition: transform 160ms ease-out;
}
.button:active {
  transform: scale(0.97);
}
```

Makes UI feel responsive and "listening" to the user.
</button_press_feedback>

<never_scale_from_zero>
Don't animate from `scale(0)`. Start from slightly larger:

```css
/* Bad */
@keyframes appear {
  from { transform: scale(0); }
  to { transform: scale(1); }
}

/* Good */
@keyframes appear {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
```
</never_scale_from_zero>

<origin_aware>
Set `transform-origin` to match the trigger point:

```css
/* Dropdown from right-aligned button */
.dropdown { transform-origin: top right; }

/* Popover from bottom */
.popover { transform-origin: bottom center; }
```
</origin_aware>

<tooltip_timing>
- Add 300-500ms delay for first tooltip to prevent accidental activation
- Subsequent tooltips appear instantly while user is exploring
- Prevents tooltip "flickering" on mouse movement
</tooltip_timing>

<clip_path>
Use `clip-path` for smooth reveal animations. Hardware-accelerated, doesn't affect layout:

```css
.overlay {
  clip-path: inset(0px 100% 0px 0px); /* Hidden */
  transition: clip-path 200ms ease-out;
}
.overlay.revealed {
  clip-path: inset(0px 0px 0px 0px); /* Visible */
}
```

**Hold to Delete Pattern:**

```jsx
<button className="button">
  <div aria-hidden="true" className="hold-overlay">
    <TrashIcon /> Hold to Delete
  </div>
  <TrashIcon /> Hold to Delete
</button>
```

```css
.hold-overlay {
  position: absolute;
  inset: 0;
  clip-path: inset(0px 100% 0px 0px);
  transition: clip-path 200ms ease-out; /* Fast release */
  background: var(--destructive);
}
.button:active .hold-overlay {
  clip-path: inset(0px 0px 0px 0px);
  transition: clip-path 2s linear; /* Slow fill on hold */
}
```
</clip_path>

<spring_animations>
For interactive elements, spring physics feel more natural than duration-based:

- Springs respond to velocity (dragging fast = more bounce)
- No fixed duration—they settle naturally
- Use React Native Reanimated for spring animations
</spring_animations>

<performance>
- **Prefer opacity & transform:** Animate exclusively `opacity` and `transform` for 60 FPS
- **Avoid** animating `width`, `height`, `padding`, `margin`—they cause layout thrash
- Use `clip-path` for reveal effects instead of changing dimensions
- Use `will-change` sparingly—only on elements about to animate and only if experiencing performance issues
- **SVG:** When opacity and transform aren't enough, SVG provides smoother sub-pixel interpolation
- **Inlined assets:** Inline SVG illustrations to reduce HTTP requests and improve perceived performance
</performance>

<css_transforms>
- Transforms are GPU-accelerated, no layout recalculation
- Prefer `transform` over `top`/`left`/`width`/`height` for animations
- Combine in single property: `transform: translateX(10px) scale(0.95) rotate(2deg)`
- Order matters: transforms applied right to left
</css_transforms>

<drawer_tips>
- Use `transform: translateX()` or `translateY()` for slide animations
- Add backdrop with fade animation
- Handle swipe-to-dismiss with velocity detection
- Snap to open/closed states based on drag distance and velocity
</drawer_tips>

<toast_tips>
- Stack multiple toasts with staggered positioning
- Enter animations from screen edge
- Exit faster than enter
- Consider hover-to-pause auto-dismiss behavior
</toast_tips>

<accessibility>
**Respect user's reduced motion preferences using React Native Reanimated:**

- `ReduceMotion` enum (`System`, `Always`, `Never`) for configuring animation behavior
- `reduceMotion` option in animation functions (`withTiming`, `withSpring`, `withDelay`, etc.)
- `.reduceMotion()` method on layout animations (entering/exiting)
- `useReducedMotion()` hook for conditional animation logic

**Reference:** [React Native Reanimated Accessibility Guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/)
</accessibility>

<good_vs_great>
| Good | Great |
|---|---|
| Generic easing | Custom easing curves |
| Center origin | Origin-aware (from trigger) |
| Same speed in/out | Fast exit, slower enter |
| Abrupt start/end | Smooth acceleration |
| Single property | Orchestrated multiple properties |
</good_vs_great>

<visual_theme>
- Trays adapt to current context (dark-themed flows = darker trays)
- Maintain visual consistency across the experience
- Let the interface feel alive and responsive to its environment
</visual_theme>
