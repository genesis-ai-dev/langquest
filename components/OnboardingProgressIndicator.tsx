import { Text } from '@/components/ui/text';
import { cn, getThemeColor } from '@/utils/styleUtils';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';

export type OnboardingStep =
  | 'vision'
  | 'region'
  | 'language'
  | 'projects'
  | 'create-project'
  | 'create-project-simple'
  | 'bible-select-book'
  | 'create-quest'
  | 'record-audio'
  | 'invite-collaborators';

interface OnboardingProgressIndicatorProps {
  currentStep: OnboardingStep;
  className?: string;
}

// Simple onboarding steps (for minimal onboarding flow - Other path)
// Language selection happens on terms page, so we start with vision
const SIMPLE_STEP_ORDER: OnboardingStep[] = [
  'vision',
  'create-project-simple',
  'create-quest',
  'record-audio',
  'invite-collaborators'
];

// Bible onboarding steps (bible-create-chapter is now part of bible-select-book)
// Language selection happens on terms page, so we start with vision
const BIBLE_STEP_ORDER: OnboardingStep[] = [
  'vision',
  'create-project-simple',
  'bible-select-book',
  'record-audio',
  'invite-collaborators'
];

// Original onboarding steps (for region/language flow)
const ORIGINAL_STEP_ORDER: OnboardingStep[] = [
  'region',
  'language',
  'projects',
  'create-project'
];

// Determine which step order to use based on current step
const getStepOrder = (currentStep: OnboardingStep): OnboardingStep[] => {
  // If vision step, use simple order (will be updated when project type is selected)
  if (currentStep === 'vision') {
    return SIMPLE_STEP_ORDER;
  }
  if (BIBLE_STEP_ORDER.includes(currentStep)) {
    return BIBLE_STEP_ORDER;
  }
  if (SIMPLE_STEP_ORDER.includes(currentStep)) {
    return SIMPLE_STEP_ORDER;
  }
  return ORIGINAL_STEP_ORDER;
};

const STEP_LABELS: Record<OnboardingStep, string> = {
  vision: 'Vision',
  region: 'Region',
  language: 'Language',
  projects: 'Projects',
  'create-project': 'Create',
  'create-project-simple': 'Project',
  'bible-select-book': 'Book',
  'create-quest': 'Quest',
  'record-audio': 'Record',
  'invite-collaborators': 'Invite'
};

export function OnboardingProgressIndicator({
  currentStep,
  className
}: OnboardingProgressIndicatorProps) {
  const stepOrder = getStepOrder(currentStep);
  const currentStepIndex = stepOrder.indexOf(currentStep);
  const progress = useSharedValue(currentStepIndex / (stepOrder.length - 1));

  // Animate progress when step changes
  useEffect(() => {
    const targetProgress = currentStepIndex / (stepOrder.length - 1);
    progress.value = withSpring(targetProgress, {
      damping: 15,
      stiffness: 100
    });
  }, [currentStepIndex, progress, stepOrder.length]);

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
        <View
          className="absolute left-0 right-0 top-0 h-0.5 bg-muted"
          style={{ top: 12 }}
        >
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
        {stepOrder.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <View key={step} className="relative z-[20] items-center">
              {/* Step circle */}
              <Pressable
                testID={`onboarding-step-${step}`}
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
                  <Text className="text-xs font-semibold text-primary-foreground">
                    ✓
                  </Text>
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
              </Pressable>

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
