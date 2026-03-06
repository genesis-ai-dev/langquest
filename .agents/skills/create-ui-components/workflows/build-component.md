# Workflow: Build a New Component

<required_reading>
**Read these reference files NOW:**
1. references/component-architecture.md
2. references/project-conventions.md
</required_reading>

<process>
## Step 1: Check Existing Libraries

Before building anything custom, check in order:

1. [React Native Reusables](https://reactnativereusables.com/docs)
2. [React Native Primitives](https://rn-primitives.vercel.app/)
3. [RNR Community Resources](https://github.com/founded-labs/react-native-reusables/blob/main/COMMUNITY_RESOURCES.md)
4. [Expo SDK](https://docs.expo.dev/versions/latest/)

If a suitable primitive or component exists, use it. Customize rather than rebuild.

## Step 2: Define Component API

Before writing code, define:

- **Props interface** with TypeScript types, defaults, and descriptions
- **Composition pattern** — choose the right one:
  - Simple component → children + props
  - Complex UI → compound components (Card, CardHeader, CardContent)
  - Custom rendering needs → render props
  - Element swapping → `asChild` polymorphism
- **Controlled vs uncontrolled** — decide if the component owns state or if parent does (support both where applicable)
- **Variants** — enumerate style/behavior permutations (`size`, `tone`, `variant`)

## Step 3: Build the Component

- Use `ref` as a regular prop (React 19, no `forwardRef`)
- Use NativeWind for styling with `cn()` utility for className merging
- No margin — use `View` + `flex` + `gap-*` for layout
- No `leading-none` — minimum line-height 1.3
- Add `data-slot` and `data-state` attributes for styling hooks
- Use `useThemeColor` for colors needed in JavaScript
- Import icons from `lucide-react-native` with `Icon` suffix, render via `<Icon as={...} />`
- Use `ActivityIndicator` from `react-native` for loading states

## Step 4: Implement Accessibility

- Add keyboard navigation map for interactive components
- Implement focus management (initial focus, roving focus, trapping, return)
- Use semantic elements and augment with ARIA attributes
- Ensure sufficient color contrast
- Test with `useReducedMotion()` for any animations

## Step 5: Add Animations (if needed)

If the component needs animation, also read:
- references/animation-technical.md

Apply the basics:
- Button press feedback: scale(0.97) on press with 160ms ease-out
- Enter/exit: ease-out, never scale from zero, start at scale(0.9) + opacity(0)
- Origin-aware transforms matching the trigger point
- Exit faster than enter (200ms exit, 300ms enter)

## Step 6: Verify

- Component renders correctly with all variant combinations
- Props API is complete with TypeScript types
- Accessibility: keyboard navigable, proper ARIA, focus management
- Styling uses NativeWind conventions (no margin, cn() for merging)
- No `React.forwardRef` — uses ref as prop directly
- No ESLint disable comments
- Reduced motion respected if animated
</process>

<anti_patterns>
Avoid:
- Building custom when RNR/Primitives/Expo SDK already provides it
- Using `React.forwardRef` (React 19 doesn't need it)
- Hard-coding colors — use design tokens and `useThemeColor`
- Using margin for spacing — use flex + gap
- Template string classname concatenation — use `cn()`
- Custom loading spinners — use `ActivityIndicator`
- Inline arrow functions in worklets — crashes; pass function references
- ESLint disable comments — they break React Compiler
</anti_patterns>

<success_criteria>
A well-built component:
- Is composable and reusable in different contexts
- Has comprehensive TypeScript types
- Is accessible by default (keyboard, focus, ARIA)
- Follows project styling conventions
- Supports className customization
- Has sensible defaults but allows overrides
- Renders without errors across all variants
</success_criteria>
