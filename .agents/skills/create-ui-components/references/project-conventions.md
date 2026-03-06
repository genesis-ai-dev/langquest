<overview>
Project-specific conventions for styling, icons, theming, worklets, React 19, and React Compiler. These rules apply across all UI work in this codebase.
</overview>

<styling>
- Use NativeWind (Tailwind for React Native)
- **No margin** (`m-*`). Use `View`s with `flex`, `gap-*`, and `flex-[row|col]` instead.
- **No template string concatenation** for classnames. Always use `cn` utility from `utils/styleUtils.ts`.
- **No `leading-none`** or anything with line-height less than 1.3—causes text clipping.
- **No `SafeAreaView`** around `ScrollView` or `FlatList`. Use `contentInsetAdjustmentBehavior="automatic"` on the scrollable component instead.
- Use **design tokens** (CSS variables) for theming: `--color-bg`, `--radius-md`, `--space-2`
- Support **className** merging for customization
- Components should be **headless** (behavior only) or **styled** (default visual design but override-friendly)
</styling>

<icons>
- Import icons from `lucide-react-native` with `Icon` suffix: `MailIcon`, `BellIcon`
- Use the `Icon` component from `components/ui/icon.tsx` with the `as` prop: `<Icon as={MailIcon} />`
- **Loading indicators:** Always use `ActivityIndicator` from `react-native`. Never use custom spinners or animated loading icons like `Loader2Icon`.
</icons>

<react_19>
Don't use `React.forwardRef`. In React 19, components accept `ref` as a regular prop directly. Add `ref` to your component's props interface and use it directly.
</react_19>

<colors_in_js>
- Use `useThemeColor` hook from `components` for colors in JavaScript (not Tailwind classes) to support dark/light mode
- In non-component contexts, use `getThemeColor`
</colors_in_js>

<worklet_threading>
Use `scheduleOnRN` from `react-native-worklets` (not `runOnJS` or `queueMicrotask`) to schedule work on the React Native thread.

**CRITICAL:** Pass function references only, never inline arrow functions—these crash. Declare wrapper functions outside worklets and pass by reference:

```typescript
const updateState = (value: number) => setState(value);
// Inside worklet:
scheduleOnRN(updateState, newValue);
```
</worklet_threading>

<react_compiler>
While React Compiler can auto-memoize, understand its limitations:

- **Mutation hooks:** Extract `mutate` from `useMutation()` return—the returned object isn't memoized, but `mutate` is.
- **Dynamic lists:** Always use stable, unique keys (not indices). Extract list items into separate components for complex JSX.
- **Children props:** Harder for compiler to optimize. Prefer composition patterns when performance matters.
- **Manual memoization:** Don't assume compiler handles everything. `React.memo`, `useMemo`, `useCallback` may still be needed for critical paths.
- **Composition over memoization:** Prefer moving state down, splitting contexts, extracting components over manual memoization.
- **No ESLint disable comments:** These prevent React Compiler from analyzing code. Fix the underlying problem instead.

**Reanimated shared values (compiler-compliant):**

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

Use `.get()` and `.set()` instead of `.value` to avoid compiler issues.
</react_compiler>
