import { OpacityPressable } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { openLegalUrl } from '@/utils/openLegalUrl';
import { cn } from '@/utils/styleUtils';
import React from 'react';
import { View } from 'react-native';

interface AnalyticsConsentControlsProps {
  optedIn: boolean;
  onOptedInChange: (optedIn: boolean) => void;
  compact?: boolean;
  embedded?: boolean;
  showDescription?: boolean;
  className?: string;
}

export function AnalyticsConsentControls({
  optedIn,
  onOptedInChange,
  compact = false,
  embedded = false,
  showDescription = true,
  className
}: AnalyticsConsentControlsProps) {
  const { t } = useLocalization();

  return (
    <View
      className={cn('flex flex-col', compact ? 'gap-3' : 'gap-2', className)}
    >
      <View
        className={cn(
          'flex-row items-center gap-4',
          !embedded && 'rounded-xl bg-card',
          embedded ? undefined : compact ? 'gap-3 p-4' : 'p-5'
        )}
      >
        <Text className="flex-1 text-base font-medium text-foreground">
          {t('enableAnalytics')}
        </Text>
        <Switch checked={optedIn} onCheckedChange={onOptedInChange} />
      </View>

      {compact ? (
        showDescription && (
          <Text className="text-sm leading-5 text-muted-foreground">
            {t('analyticsDescription')}
          </Text>
        )
      ) : (
        <Text className="text-sm leading-6 text-muted-foreground">
          {t('analyticsConsentFooter')}
        </Text>
      )}
    </View>
  );
}

interface AnalyticsConsentCardProps {
  optedIn: boolean;
  onOptedInChange: (optedIn: boolean) => void;
  compact?: boolean;
  variant?: 'consent' | 'learnMore';
  showControls?: boolean;
  showLearnMore?: boolean;
  onLearnMorePress?: () => void;
  className?: string;
}

export function AnalyticsConsentCard({
  optedIn,
  onOptedInChange,
  compact = false,
  variant = 'consent',
  showControls = true,
  showLearnMore = false,
  onLearnMorePress,
  className
}: AnalyticsConsentCardProps) {
  const { t } = useLocalization();

  return (
    <View
      className={cn(
        'flex flex-col',
        compact ? 'gap-3' : variant === 'learnMore' ? 'gap-6' : 'gap-8',
        className
      )}
    >
      {!compact && variant === 'consent' && (
        <View className="gap-4">
          <Text variant="h4">{t('analyticsConsentTitle')}</Text>
          <Text className="text-base font-medium leading-6 text-foreground">
            {t('analyticsConsentMission')}
          </Text>
        </View>
      )}

      {!compact && variant === 'learnMore' && (
        <Text variant="h4" className="mt-4">
          {t('analyticsLearnMoreTitle')}
        </Text>
      )}

      {!compact && (
        <View className="gap-3">
          <Text className="text-sm leading-6 text-muted-foreground">
            {`• ${t('analyticsConsentBenefit1')}`}
          </Text>
          <Text className="text-sm leading-6 text-muted-foreground">
            {`• ${t('analyticsConsentBenefit2')}`}
          </Text>
        </View>
      )}

      {!compact && (
        <Text className="text-sm leading-6 text-muted-foreground">
          {t('analyticsConsentTransparency')}
          <Text
            className="text-sm font-medium leading-6 text-primary underline"
            onPress={() => void openLegalUrl('privacy')}
          >
            {t('privacyPolicy')}
          </Text>
          .
        </Text>
      )}

      {showControls && (
        <AnalyticsConsentControls
          optedIn={optedIn}
          onOptedInChange={onOptedInChange}
          compact={compact}
          embedded={compact && showLearnMore}
          showDescription={!showLearnMore}
        />
      )}

      {compact && showLearnMore && onLearnMorePress && (
        <OpacityPressable onPress={onLearnMorePress} className="self-start">
          <Text className="text-sm font-medium text-primary">
            {t('analyticsLearnMore')}
          </Text>
        </OpacityPressable>
      )}
    </View>
  );
}
