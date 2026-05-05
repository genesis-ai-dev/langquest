# Workflow: Build a Form

<required_reading>
**Read these NOW:**
1. The cursor rule `/.cursor/rules/form-handling.mdc` — for react-hook-form + Zod + TanStack Query patterns, field rendering, drawer forms, keyboard handling, validation, and advanced patterns
2. references/project-conventions.md — for project-specific styling, icons, theming, and React 19/Compiler rules
</required_reading>

<process>
## Step 1: Design the Form Schema

Define the Zod schema with localized validation messages:

```typescript
const { t } = useLocalization();

const formSchema = z.object({
  // ... fields with validation
});

type FormData = z.infer<typeof formSchema>;
```

**Validation strategy decisions:**
- Simple field validation → inline `.min()`, `.max()`, `.email()`, etc.
- Cross-field validation → `.refine()` (e.g., password confirmation)
- Conditional required fields → `.superRefine()` (e.g., require current password only if new password provided)
- Real-time feedback needed → set `mode: 'onChange'` on `useForm`

## Step 2: Set Up Form Infrastructure

1. Define `defaultValues` as `const`
2. Initialize `useForm<FormData>` with `zodResolver`
3. Create `useMutation` for submission
4. Create `handleFormSubmit` from `form.handleSubmit`

**Mutation must handle:**
- `mutationFn` — API call or database operation
- `onSuccess` — reset form, close drawer/modal, invalidate queries
- `onError` — show `RNAlert` with error message

**If optimistic updates needed:** Add `onMutate` (snapshot + optimistic cache update) and `onSettled` (invalidate queries).

## Step 3: Choose Form Container

| Context | Container |
|---|---|
| Full page | `KeyboardAwareScrollView` with `bottomOffset={96}`, `extraKeyboardSpace={20}` |
| Drawer | `Drawer` + `DrawerContent` + `DrawerHeader/Footer` with `drawerInput` prop on fields |
| Long drawer form | `DrawerScrollView` instead of `View` for content |
| Complex drawer | Custom `snapPoints={['80%']}` + `enableDynamicSizing={false}` |

## Step 4: Build Form Fields

For each field:

```tsx
<FormField
  control={form.control}
  name="fieldName"
  render={({ field }) => (
    <FormItem>
      <FormControl>
        <Input {...transformInputProps(field)} placeholder={t('...')} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Field-specific props:**
- Text input → `transformInputProps(field)`
- Switch/boolean → `transformSwitchProps(field)`
- Password → `secureTextEntry`, `autoComplete="password"`, `prefix={LockIcon}`
- Email → `mask`, `keyboardType="email-address"`, `autoCapitalize="none"`
- Custom input (audio, file picker) → use `field.onChange` directly
- Multi-mode (text/audio) → wrap in `Tabs`/`TabsContent`

**Navigation between fields:**
- Middle fields → `type="next"` + `submitBehavior="submit"`
- Last field → `onSubmitEditing={() => void handleFormSubmit()}` + `returnKeyType="done"`

## Step 5: Wire Up Submission

```tsx
<FormSubmit onPress={handleFormSubmit}>
  <Text>{t('submit')}</Text>
</FormSubmit>
```

`FormSubmit` does NOT auto-disable for invalid forms. The button stays clickable; pressing an invalid form runs `form.handleSubmit(...)`, which surfaces validation errors inline via `FormMessage` so the user can see exactly what to fix instead of guessing why a greyed-out button isn't responding.

If a specific form needs to block submission for an external reason (offline, missing permission, etc.), pass `disabled` explicitly. Pair it with a visible explanation (an inline alert, banner, or hint) so the user understands why:

```tsx
<OfflineAlert />
<FormSubmit onPress={handleFormSubmit} disabled={!isOnline}>
  <Text>{t('submit')}</Text>
</FormSubmit>
```

**For drawer forms:**
- Wrap form in `<Form {...form}>` inside `<DrawerContent>`
- Submit in `<DrawerFooter>` as `<FormSubmit>`
- Cancel as `<DrawerClose disabled={isPending}>`
- Set `dismissible={!isPending}` on `Drawer`
- Reset on close: `if (!open) form.reset(defaultValues)` in `onOpenChange`

## Step 6: Handle Edge Cases

- **Network awareness:** Check `useNetworkStatus()`, render `<OfflineAlert />` near the submit button, and pass `disabled={!isOnline}` to `FormSubmit` only when the form genuinely cannot be submitted offline
- **PII masking:** Add `mask` prop to email, username, and any PII fields
- **Keyboard dismissal:** Call `Keyboard.dismiss()` in `onSuccess` before navigation
- **New password fields:** Use `textContentType="newPassword"` (iOS) + `autoComplete="new-password"` (Android)

## Step 7: Verify

- Form validates on submit (or onChange if `mode: 'onChange'`)
- All field types render correctly with proper props
- Keyboard navigation flows field-to-field, last field submits
- Drawer forms reset on close, prevent dismissal while pending
- Error messages display inline via `FormMessage`
- PII fields masked for analytics
- Network-aware if form requires connectivity
</process>

<anti_patterns>
Avoid:
- Forgetting `transformInputProps`/`transformSwitchProps` — raw field props won't work correctly
- Using `form.handleSubmit` inline in JSX — define `handleFormSubmit` once
- Not resetting form on drawer close — stale data persists
- Allowing drawer dismissal during pending mutation
- Forgetting `mask` on email/username fields — PII leaks to analytics
- Using custom loading spinners instead of `ActivityIndicator`
- Not dismissing keyboard before navigation — causes UI flickering
- Inline `onSubmitEditing` without `void` — promise returned to handler
- Disabling `FormSubmit` for invalid form state — let the user press it so `form.handleSubmit(...)` can surface the field-level error messages
- Disabling `FormSubmit` without showing *why* it's disabled (offline, permissions, etc.) — pair the disable with an inline alert/banner so the user isn't left guessing
</anti_patterns>

<success_criteria>
A well-built form:
- Has complete Zod schema with localized validation messages
- Uses `useMutation` for submission with proper success/error handling
- All fields use `transformInputProps`/`transformSwitchProps`
- Keyboard navigation works field-to-field
- PII fields masked for analytics
- Resets correctly on open/close
- Shows inline validation errors via `FormMessage`
- Handles loading state with `isPending`
- Network-aware if online-only
</success_criteria>
