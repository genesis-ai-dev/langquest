import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/utils/styleUtils';
import * as TabsPrimitive from '@rn-primitives/tabs';
import { Platform } from 'react-native';

function Tabs({
  className,
  ...props
}: TabsPrimitive.RootProps & React.RefAttributes<TabsPrimitive.RootRef>) {
  return (
    <TabsPrimitive.Root
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: TabsPrimitive.ListProps & React.RefAttributes<TabsPrimitive.ListRef>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'flex h-12 flex-row items-center justify-center rounded-lg bg-card p-1',
        Platform.select({ web: 'inline-flex w-fit', native: 'mr-auto' }),
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: TabsPrimitive.TriggerProps & React.RefAttributes<TabsPrimitive.TriggerRef>) {
  const { value } = TabsPrimitive.useRootContext();
  return (
    <TextClassContext.Provider
      value={cn(
        'text-sm font-semibold text-muted-foreground',
        value === props.value && 'text-primary-foreground',
        props.disabled && 'text-muted-foreground/50'
      )}
    >
      <TabsPrimitive.Trigger
        className={cn(
          'flex h-full flex-1 flex-row items-center justify-center gap-1.5 rounded-md px-2 py-1 shadow-none shadow-black/5',
          Platform.select({
            web: 'inline-flex cursor-default whitespace-nowrap transition-[color,box-shadow] hover:cursor-pointer focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0'
          }),
          props.value === value &&
            'border-foreground/10 bg-primary/90 text-primary-foreground',
          className
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function TabsContent({
  className,
  ...props
}: TabsPrimitive.ContentProps & React.RefAttributes<TabsPrimitive.ContentRef>) {
  return (
    <TabsPrimitive.Content
      className={cn(Platform.select({ web: 'flex-1 outline-none' }), className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
