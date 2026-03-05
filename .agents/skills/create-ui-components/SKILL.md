---
name: create-ui-components
description: Build polished, accessible UI components with animations and forms in React Native. Use when creating new components, adding animations, building forms, or polishing existing UI. Covers composition patterns, motion design, form handling with react-hook-form/Zod, and project-specific conventions.
---

<essential_principles>

**1. Composition over inheritance.** Follow the [components.build](https://www.components.build/) spec. Use compound components, render props, `asChild` polymorphism, and controlled/uncontrolled patterns. Check existing libraries (RNR → Primitives → Expo SDK) before building custom.

**2. Every animation serves a purpose.** Animate to orient users, connect states, guide attention, or enhance perception—never for decoration. Use custom easing from `@constants/animations.ts`. Keep under 500ms. Exit faster than enter. Respect `useReducedMotion()`.

**3. Accessible by default.** Keyboard navigation, focus management, ARIA attributes, color contrast, and reduced motion support are not optional—they're baseline.

**4. Project conventions are non-negotiable.**
- NativeWind styling, no margin (use flex + gap), `cn()` for classnames
- React 19: `ref` as prop, no `forwardRef`
- Icons: `lucide-react-native` with `<Icon as={...} />`
- Loading: `ActivityIndicator` only
- Worklets: `scheduleOnRN` with function references (never inline arrows)
- No ESLint disable comments (breaks React Compiler)

</essential_principles>

<intake>
What would you like to do?

1. **Build a new component** — Create a component from scratch with proper architecture
2. **Add animation** — Add purposeful motion to an existing component
3. **Build a form** — Create a form with validation, submission, and proper UX
4. **Polish existing UI** — Improve animations, transitions, and delight on existing screens

**Wait for response before proceeding.**
</intake>

<routing>
| Response | Workflow |
|----------|----------|
| 1, "build", "create", "new component", "component" | `workflows/build-component.md` |
| 2, "animate", "animation", "motion", "transition" | `workflows/add-animation.md` |
| 3, "form", "input", "validation", "submit" | `workflows/build-form.md` |
| 4, "polish", "improve", "refine", "delight", "ux" | `workflows/polish-ui.md` |

**After reading the workflow, follow it exactly.**
</routing>

<reference_index>
All domain knowledge in `references/`:

**Architecture:** component-architecture.md — Composition patterns, accessibility, existing component libraries, props API, data attributes

**Animation Design:** animation-principles.md — UX philosophy, purpose of motion, progressive disclosure, tray system, fluidity, delight-impact curve, transition checklist

**Animation Code:** animation-technical.md — Easing, timing, springs, clip-path, performance, reduced motion, good vs great comparison

**Forms:** form-patterns.md — react-hook-form + Zod structure, field rendering, drawer forms, keyboard handling, validation patterns, optimistic updates, analytics masking

**Conventions:** project-conventions.md — Styling rules, icons, React 19, theming, worklet threading, React Compiler
</reference_index>

<workflows_index>
| Workflow | Purpose |
|----------|---------|
| build-component.md | Create new component with proper architecture and accessibility |
| add-animation.md | Add purposeful motion to existing components |
| build-form.md | Build form with validation, submission, and keyboard handling |
| polish-ui.md | Audit and improve animations, transitions, and delight |
</workflows_index>
