import { cn } from '@/utils/styleUtils';
import * as CollapsiblePrimitive from '@rn-primitives/collapsible';

function Collapsible({
  className,
  ...props
}: CollapsiblePrimitive.RootProps &
  React.RefAttributes<CollapsiblePrimitive.RootRef>) {
  return (
    <CollapsiblePrimitive.Root className={cn('gap-1', className)} {...props} />
  );
}

function CollapsibleTrigger({
  className,
  ...props
}: CollapsiblePrimitive.TriggerProps &
  React.RefAttributes<CollapsiblePrimitive.TriggerRef>) {
  return (
    <CollapsiblePrimitive.Trigger
      className={cn(
        'flex flex-row items-center gap-2 rounded-md px-3 py-2',
        className
      )}
      {...props}
    />
  );
}

function CollapsibleContent({
  className,
  ...props
}: CollapsiblePrimitive.ContentProps &
  React.RefAttributes<CollapsiblePrimitive.ContentRef>) {
  return (
    <CollapsiblePrimitive.Content
      className={cn('px-3 pb-2', className)}
      {...props}
    />
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
