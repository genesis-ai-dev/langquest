# UX Patterns for UI Components

**This reference is live.** Fetch the latest patterns before applying them:

```
URL: https://uxgoodpatterns.com/ux-rules.md
```

**Every time** you need UX pattern guidance, fetch this URL fresh using the WebFetch tool. The source auto-updates with new patterns.

When applying patterns:

1. **Check existing components first.** The patterns include web-oriented implementation details. Before following those literally, search the codebase for components that already solve the problem (e.g., use an existing `Skeleton` component instead of raw `animate-pulse`, use existing `Drawer` instead of building modal dismiss logic). Prefer project primitives over reinventing.
2. **Adapt for React Native.** Translate web-specific APIs (e.g., `keyboardType` instead of `inputmode`, `accessibilityLabel` instead of `aria-label`, gestures instead of keyboard shortcuts).
