import { cn } from '@/utils/styleUtils';
import { getThemeColor } from '@/utils/styleUtils';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

export type OnboardingStep = 'region' | 'language' | 'projects' | 'create-project';

interface OnboardingProgressIndicatorProps {
  currentStep: OnboardingStep;
  className?: string;
}

const STEP_ORDER: OnboardingStep[] = ['region', 'language', 'projects', 'create-project'];

const STEP_LABELS: Record<OnboardingStep, string> = {
  region: 'Region',
  language: 'Language',
  projects: 'Projects',
  'create-project': 'Create'
};

export function OnboardingProgressIndicator({
  currentStep,
  className
}: OnboardingProgressIndicatorProps) {
  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const progress = useSharedValue(currentStepIndex / (STEP_ORDER.length - 1));

  // Animate progress when step changes
  useEffect(() => {
    const targetProgress = currentStepIndex / (STEP_ORDER.length - 1);
    progress.value = withSpring(targetProgress, {
      damping: 15,
      stiffness: 100
    });
  }, [currentStepIndex, progress]);

  // Animated progress bar style
  const progressBarStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`
    };
  });

  return (
    <View className={cn('w-full px-6 py-4', className)}>
      {/* Steps container */}
      <View className="relative flex-row items-center justify-between">
        {/* Progress bar background */}
        <View className="absolute left-0 right-0 top-0 h-0.5 bg-muted" style={{ top: 12 }}>
          {/* Animated progress fill */}
          <Animated.View
            style={[
              progressBarStyle,
              {
                height: '100%',
                backgroundColor: getThemeColor('primary'),
                borderRadius: 9999
              }
            ]}
          />
        </View>

        {/* Step indicators */}
        {STEP_ORDER.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <View key={step} className="relative z-10 items-center">
              {/* Step circle */}
              <View
                className={cn(
                  'h-6 w-6 items-center justify-center rounded-full border-2',
                  isActive
                    ? 'border-primary bg-primary'
                    : isCompleted
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground bg-background'
                )}
              >
                {isCompleted ? (
                  <Text className="text-xs font-semibold text-primary-foreground">✓</Text>
                ) : (
                  <Text
                    className={cn(
                      'text-xs font-semibold',
                      isActive
                        ? 'text-primary-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>

              {/* Step label */}
              <Text
                className={cn(
                  'mt-2 text-xs',
                  isActive
                    ? 'font-medium text-foreground'
                    : isCompleted
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/60'
                )}
                numberOfLines={1}
              >
                {STEP_LABELS[step]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
