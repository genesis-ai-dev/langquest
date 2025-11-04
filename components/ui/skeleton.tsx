import { cn } from '@/utils/styleUtils';
import { View } from 'react-native';

function Skeleton({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return (
    <View
      className={cn('animate-pulse rounded-md bg-border', className)}
      {...props}
    />
  );
}

export { Skeleton };
