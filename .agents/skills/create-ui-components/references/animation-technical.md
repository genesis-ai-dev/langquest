<overview>
React Native animation implementation specifics: Reanimated APIs, project easing constants, mobile performance, and accessibility.

For general animation philosophy, decision frameworks, easing theory, and component patterns (buttons, popovers, tooltips, clip-path, stagger, gestures), see the `emil-design-eng` skill.
</overview>

<easing>
Use custom easing curves from `@constants/animations.ts`:
- Import `easeOut`, `easeInOut`, `easeSnappy`, or `easeSpring`
- Use with React Native Reanimated animations (`withTiming`, `withSpring`)
</easing>

<spring_animations>
Use React Native Reanimated for spring animations:

- `withSpring(target, config)` for spring-based transitions
- Springs respond to velocity (dragging fast = more bounce)
- No fixed duration — they settle naturally
- Ideal for drag interactions, swipe-to-dismiss, and interruptible gestures
</spring_animations>

<reanimated_shared_values>
Use `.get()` and `.set()` on shared values (React Compiler compliant, not `.value`):

```tsx
const sv = useSharedValue(100);

const animatedStyle = useAnimatedStyle(() => {
  'worklet';
  return { width: sv.get() * 100 };
});

const handlePress = () => {
  sv.set(withTiming(200, { duration: 300 }));
};
```
</reanimated_shared_values>

<worklet_threading>
Use `scheduleOnRN` from `react-native-worklets` for worklet-to-RN thread communication.

Pass function references only, never inline arrow functions (crashes):

```typescript
const updateState = (value: number) => setState(value);
// Inside worklet:
scheduleOnRN(updateState, newValue);
```
</worklet_threading>

<performance>
- **Prefer opacity & transform:** Animate exclusively `opacity` and `transform` for 60 FPS
- **Avoid** animating `width`, `height`, `padding`, `margin` — they cause layout thrash
- **SVG:** When opacity and transform aren't enough, SVG provides smoother sub-pixel interpolation
- **Inlined assets:** Inline SVG illustrations to reduce HTTP requests and improve perceived performance
</performance>

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

<visual_theme>
- Trays adapt to current context (dark-themed flows = darker trays)
- Maintain visual consistency across the experience
- Let the interface feel alive and responsive to its environment
</visual_theme>
