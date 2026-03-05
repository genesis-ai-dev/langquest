<overview>
Complete form handling patterns using react-hook-form, Zod validation, and TanStack Query mutations. Covers structure, rendering, validation, drawer forms, keyboard handling, and advanced patterns.
</overview>

<imports>
```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormSubmit,
  transformInputProps,
  transformSwitchProps
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
```
</imports>

<form_structure>
**1. Define Zod Schema with localized messages:**

```typescript
const { t } = useLocalization();

const formSchema = z.object({
  name: z.string(t('nameRequired')).nonempty(t('nameRequired')).trim(),
  email: z.string().email(t('enterValidEmail')).nonempty(t('emailRequired')).toLowerCase().trim(),
  description: z.string().max(196, t('descriptionTooLong', { max: 196 })).trim().optional(),
  isPrivate: z.boolean()
});

type FormData = z.infer<typeof formSchema>;
```

**2. Define default values:**

```typescript
const defaultValues = {
  name: '',
  email: '',
  description: '',
  isPrivate: false
} as const;
```

**3. Initialize form:**

```typescript
const form = useForm<FormData>({
  defaultValues,
  resolver: zodResolver(formSchema),
  disabled: !currentUser?.id // optional
});
```

**4. Create mutation:**

```typescript
const { mutateAsync: submitForm, isPending } = useMutation({
  mutationFn: async (values: FormData) => {
    await someService.create(values);
  },
  onSuccess: () => {
    form.reset(defaultValues);
    setIsOpen(false);
  },
  onError: (error) => {
    console.error('Failed to submit:', error);
    RNAlert.alert(t('error'), error.message);
  }
});
```

**5. Handle submission:**

```typescript
const handleFormSubmit = form.handleSubmit((data) => submitForm(data));
```
</form_structure>

<rendering>

<basic_layout>
```tsx
<Form {...form}>
  <View className="flex flex-col gap-4">
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Input
              {...transformInputProps(field)}
              placeholder={t('name')}
              prefix={UserIcon}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormSubmit onPress={handleFormSubmit}>
      <Text>{t('submit')}</Text>
    </FormSubmit>
  </View>
</Form>
```
</basic_layout>

<with_labels>
```tsx
<FormField
  control={form.control}
  name="template"
  render={({ field }) => (
    <FormItem>
      <FormLabel>{t('template')}</FormLabel>
      <FormControl>
        <RadioGroup value={field.value} onValueChange={field.onChange}>
          {options.map((option) => (
            <RadioGroupItem key={option} value={option} label={t(option)} />
          ))}
        </RadioGroup>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```
</with_labels>

<switch_fields>
```tsx
<View className="flex-row items-center justify-between">
  <Text>{t('private')}</Text>
  <FormField
    control={form.control}
    name="private"
    render={({ field }) => (
      <FormItem>
        <FormControl>
          <Switch {...transformSwitchProps(field)} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
</View>
```
</switch_fields>

<textarea_fields>
```tsx
<FormField
  control={form.control}
  name="description"
  render={({ field }) => (
    <FormItem>
      <FormControl>
        <Textarea
          {...transformInputProps(field)}
          placeholder={t('description')}
          size="sm"
          drawerInput // when inside a drawer
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```
</textarea_fields>

<password_fields>
```tsx
<FormField
  control={form.control}
  name="password"
  render={({ field }) => (
    <FormItem>
      <FormControl>
        <Input
          {...transformInputProps(field)}
          onSubmitEditing={() => void handleFormSubmit()}
          returnKeyType="done"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          prefix={LockIcon}
          placeholder={t('password')}
          secureTextEntry
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```
</password_fields>

</rendering>

<analytics_masking>
Use `mask` prop on inputs with sensitive/PII data to prevent PostHog capture (sets `accessibilityLabel="ph-no-capture"`):

```tsx
<Input
  {...transformInputProps(field)}
  mask
  autoCapitalize="none"
  keyboardType="email-address"
  prefix={MailIcon}
  placeholder={t('email')}
/>
```

**Must mask:** Email, usernames, any PII. `secureTextEntry` fields are auto-masked.
</analytics_masking>

<drawer_forms>
```tsx
<Drawer
  open={isOpen}
  onOpenChange={(open) => {
    setIsOpen(open);
    if (!open) form.reset(defaultValues);
  }}
  dismissible={!isPending}
>
  <DrawerContent className="pb-safe">
    <Form {...form}>
      <DrawerHeader>
        <DrawerTitle>{t('createNew')}</DrawerTitle>
      </DrawerHeader>
      <View className="flex flex-col gap-4 px-4">
        <FormField ... />
      </View>
      <DrawerFooter>
        <FormSubmit onPress={handleFormSubmit}>
          <Text>{t('create')}</Text>
        </FormSubmit>
        <DrawerClose disabled={isPending}>
          <Text>{t('cancel')}</Text>
        </DrawerClose>
      </DrawerFooter>
    </Form>
  </DrawerContent>
</Drawer>
```

**Custom snap points for complex forms:**

```tsx
<Drawer
  open={visible}
  onOpenChange={(open) => !open && handleClose()}
  snapPoints={['80%']}
  enableDynamicSizing={false}
>
```

**Scrollable drawer content:**

```tsx
import { DrawerScrollView } from '@/components/ui/drawer';

<DrawerScrollView className="pb-safe flex-1 flex-col gap-4 px-4">
  {/* Form fields */}
</DrawerScrollView>;
```
</drawer_forms>

<keyboard_handling>
**Full-page forms:**

```tsx
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

<Form {...form}>
  <KeyboardAwareScrollView
    className="flex-1"
    contentContainerClassName="flex flex-col gap-4 p-6"
    bottomOffset={96}
    extraKeyboardSpace={20}
    showsVerticalScrollIndicator={false}
  >
    {/* Form fields */}
  </KeyboardAwareScrollView>
</Form>;
```

**Sequential field navigation:**

```tsx
<Input {...transformInputProps(field)} type="next" submitBehavior="submit" />
```

**Last field triggers submission:**

```tsx
<Input
  {...transformInputProps(field)}
  onSubmitEditing={() => void handleFormSubmit()}
  returnKeyType="done"
/>
```
</keyboard_handling>

<validation_patterns>

<refine>
```typescript
const formSchema = z
  .object({
    password: z.string().min(6, t('passwordMinLength')),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: t('passwordsNoMatch'),
    path: ['confirmPassword']
  });
```
</refine>

<superrefine>
```typescript
const formSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z.string().optional()
  })
  .superRefine((data, ctx) => {
    if (data.newPassword && data.newPassword.length > 0) {
      if (!data.currentPassword) {
        ctx.addIssue({
          code: 'custom',
          message: 'currentPasswordRequired',
          path: ['currentPassword']
        });
      }
      if (data.newPassword.length < 6) {
        ctx.addIssue({
          code: 'custom',
          message: 'passwordMinLength',
          path: ['newPassword']
        });
      }
    }
  });
```
</superrefine>

</validation_patterns>

<optimistic_updates>
```typescript
const { mutateAsync: createItem, isPending } = useMutation({
  mutationFn: async (values: FormData) => {
    return await db.insert(table).values(values).returning();
  },
  onMutate: async (values) => {
    await queryClient.cancelQueries({ queryKey: ['items'] });
    const previous = queryClient.getQueryData(['items']);
    queryClient.setQueryData(['items'], (old) => [
      ...(old || []),
      { ...values, id: `temp-${Date.now()}` }
    ]);
    return { previous };
  },
  onSuccess: () => {
    form.reset(defaultValues);
    setIsOpen(false);
  },
  onError: (error, _values, context) => {
    if (context?.previous) {
      queryClient.setQueryData(['items'], context.previous);
    }
    RNAlert.alert(t('error'), error.message);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['items'] });
  }
});
```
</optimistic_updates>

<reset_patterns>
**Reset on drawer open:**

```tsx
useEffect(() => {
  if (isOpen) form.reset(defaultValues);
}, [isOpen, form]);
```

**Reset with pre-filled values:**

```tsx
const resetForm = () => {
  form.reset(defaultValues);
  if (savedValue) form.setValue('fieldName', savedValue);
};
```

**Partial reset:**

```tsx
form.reset({ ...form.getValues(), password: '', confirmPassword: '' });
```
</reset_patterns>

<network_aware>
```tsx
const isOnline = useNetworkStatus();

const { mutateAsync: submit } = useMutation({
  mutationFn: async (data) => {
    if (!isOnline) throw new Error(t('internetConnectionRequired'));
    // ... proceed
  }
});

// Disable submit when offline
<Button onPress={handleFormSubmit} loading={isPending} disabled={!isOnline || isPending}>
  <Text>{t('submit')}</Text>
</Button>;

{!isOnline && (
  <Alert icon={WifiOffIcon} variant="destructive">
    <AlertTitle>{t('internetConnectionRequired')}</AlertTitle>
  </Alert>
)}
```
</network_aware>

<error_handling>
**Alert-based:**

```typescript
onError: (error) => {
  RNAlert.alert(
    t('error'),
    error instanceof Error ? error.message : t('genericError'),
    [{ text: t('ok') }, { text: t('retry'), onPress: () => handleFormSubmit() }]
  );
};
```

**Inline:** `FormMessage` automatically displays field-level errors from Zod validation.
</error_handling>

<advanced_patterns>

<use_watch>
Reactive form value subscriptions without re-rendering entire form:

```tsx
import { useWatch } from 'react-hook-form';

const subscription = useWatch({ control: form.control });
const isValid =
  (mode === 'text' && !!subscription.text) ||
  (mode === 'audio' && !!subscription.audioUri);
```
</use_watch>

<validation_mode>
Real-time validation as user types:

```typescript
const form = useForm<FormData>({
  defaultValues,
  resolver: zodResolver(formSchema),
  mode: 'onChange'
});
```
</validation_mode>

<custom_inputs>
For non-standard inputs (audio recorders, file pickers), use `field.onChange` directly:

```tsx
<FormField
  control={form.control}
  name="audioUri"
  render={({ field }) => (
    <FormItem>
      <FormControl>
        <AudioRecorder
          onRecordingComplete={field.onChange}
          resetRecording={() => field.onChange(null)}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```
</custom_inputs>

<form_with_tabs>
```tsx
<Tabs value={inputMode} onValueChange={(v) => setInputMode(v as InputMode)}>
  <TabsList>
    <TabsTrigger value="text">Text</TabsTrigger>
    <TabsTrigger value="audio">Audio</TabsTrigger>
  </TabsList>
  <TabsContent value="text">
    <FormField name="text" ... />
  </TabsContent>
  <TabsContent value="audio">
    <FormField name="audioUri" ... />
  </TabsContent>
</Tabs>
```
</form_with_tabs>

<new_password_fields>
```tsx
<Input
  {...transformInputProps(field)}
  textContentType="newPassword"
  autoComplete="new-password"
  secureTextEntry
/>
```
</new_password_fields>

<dismiss_keyboard_before_navigation>
```typescript
import { Keyboard } from 'react-native';

onSuccess: () => {
  Keyboard.dismiss();
  RNAlert.alert(t('success'), t('message'), [
    { text: t('ok'), onPress: () => safeNavigate(() => navigateAway()) }
  ]);
};
```
</dismiss_keyboard_before_navigation>

</advanced_patterns>

<quick_reference>
| Pattern | Usage |
|---|---|
| `transformInputProps(field)` | Spread on `Input`, `Textarea` |
| `transformSwitchProps(field)` | Spread on `Switch` |
| `form.handleSubmit(fn)` | Wraps submission with validation |
| `isPending` | Loading state from mutation |
| `form.reset()` | Clear form or restore defaults |
| `drawerInput` prop | Inputs inside drawers for keyboard handling |
| `type="next"` | Chain keyboard focus between fields |
| `mask` prop | Prevent analytics capture for PII |
</quick_reference>
