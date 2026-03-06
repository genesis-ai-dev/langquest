<overview>
Component architecture patterns for building composable, accessible, reusable UI in React Native. Follows the components.build specification and Radix composition pattern.
</overview>

<artifact_taxonomy>
Understand the hierarchy:

1. **Primitive** - Lowest-level building block providing behavior and accessibility without styling (e.g., Radix UI Primitives)
2. **Component** - Styled, reusable UI unit that adds visual design to primitives (e.g., shadcn/ui components)
3. **Pattern** - Specific composition solving a UI/UX problem (e.g., form validation with inline errors)
</artifact_taxonomy>

<existing_components>
**Decision order when building features:**

1. **Check existing UI components** (in order):
   - [React Native Reusables](https://reactnativereusables.com/docs) - UI components
   - [React Native Primitives](https://rn-primitives.vercel.app/) - Radix primitives
   - [RNR Community Resources](https://github.com/founded-labs/react-native-reusables/blob/main/COMMUNITY_RESOURCES.md)

2. **Check Expo SDK** - [Expo SDK docs](https://docs.expo.dev/versions/latest/) for native APIs

3. **Only then** consider third-party libraries or custom components.
</existing_components>

<composition_patterns>

<pattern name="children_and_slots">
- **Children** (implicit slot): JSX between opening/closing tags
- **Named slots**: Props like `icon`, `footer`, or `<Component.Slot>` subcomponents
- **Slot forwarding**: Pass DOM attributes/className/refs through to underlying element
</pattern>

<pattern name="render_props">
Use when parent must own data/behavior but consumer controls markup:

```tsx
<ParentComponent data={data}>
  {(item) => <ChildComponent key={item.id} {...item} />}
</ParentComponent>
```
</pattern>

<pattern name="compound_components">
Use separate component imports to compose complex UI (shadcn-style):

```tsx
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter
} from '@/components/ui/card';

<Card>
  <CardHeader>Title</CardHeader>
  <CardContent>Body</CardContent>
  <CardFooter>Actions</CardFooter>
</Card>;
```
</pattern>

<pattern name="controlled_vs_uncontrolled">
- **Controlled**: Value driven by props, emits `onChange` (source of truth is parent)
- **Uncontrolled**: Holds internal state, may expose `defaultValue` and imperative reset
- Many inputs should support both patterns
</pattern>

<pattern name="polymorphism_aschild">
Use `asChild` prop to render as a different element:

```tsx
<Button asChild>
  <Link href="/">Click me</Link>
</Button>
```

Renders as `<Link>` instead of `<button>`, preserving all Button behavior.
</pattern>

</composition_patterns>

<accessibility>

<keyboard_navigation>
- Document and implement keyboard map for every interactive component
- Support standard patterns: `Tab`, `Arrow keys`, `Home/End`, `Escape`
- All interactive elements must be keyboard accessible
</keyboard_navigation>

<focus_management>
- Rules for initial focus, roving focus, focus trapping
- Focus return on teardown (e.g., modals)
- Focus indicators visible and clear
</focus_management>

<aria>
- Use semantic HTML elements (`<button>`, `<ul>/<li>`, etc.)
- Augment with ARIA when necessary:
  - `role` - Communicate semantics (`role="menu"`)
  - `aria-*` states - State (`aria-checked`, `aria-expanded`)
  - `aria-*` properties - Relationships (`aria-controls`, `aria-labelledby`)
</aria>

<color_contrast>
- Ensure sufficient contrast for text and interactive elements
- Don't rely solely on color to convey information
</color_contrast>

</accessibility>

<props_api>
- **TypeScript**: Ship with comprehensive types for safety and autocomplete
- **Stable, typed, documented** with defaults and a11y ramifications
- Support both **controlled** and **uncontrolled** patterns where applicable
- Document all props: name, type, default, required, description
- Document purpose, usage, accessibility notes, and customization options
</props_api>

<data_attributes>
Use data attributes for styling hooks and state:

- `data-slot` - Identify component parts for styling
- `data-state` - Indicate component state (open, closed, checked, etc.)
- `data-disabled`, `data-selected`, etc. - State indicators

```tsx
<View data-slot="trigger" data-state={isOpen ? 'open' : 'closed'}>
```
</data_attributes>

<variants>
Use **variants** for discrete style/behavior permutations (e.g., `size="sm|md|lg"`, `tone="neutral|destructive"`). Variants are not separate components.
</variants>
