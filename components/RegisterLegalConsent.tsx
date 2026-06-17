import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { openLegalUrl } from '@/utils/openLegalUrl';
import { cn } from '@/utils/styleUtils';
import React from 'react';
import { Pressable, View } from 'react-native';

interface RegisterLegalConsentProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

function LegalLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Text
      className="text-sm font-medium text-primary underline"
      onPress={onPress}
    >
      {label}
    </Text>
  );
}

export function RegisterLegalConsent({
  checked,
  onCheckedChange,
  disabled,
  className
}: RegisterLegalConsentProps) {
  const { t } = useLocalization();

  return (
    <Pressable
      className={cn('flex-row items-start gap-3', className)}
      onPress={() => !disabled && onCheckedChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      testID="register-legal-consent"
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-0.5"
      />
      <View className="flex-1">
        <Text className="text-sm leading-5 text-foreground">
          {t('registerLegalConsentPart1')}
          <LegalLink
            label={t('termsOfService')}
            onPress={() => void openLegalUrl('terms')}
          />
          {t('registerLegalConsentPart2')}
          <LegalLink
            label={t('privacyPolicy')}
            onPress={() => void openLegalUrl('privacy')}
          />
          {t('registerLegalConsentPart3')}
          <LegalLink
            label={t('cc0PublicDomainDedication')}
            onPress={() => void openLegalUrl('cc0')}
          />
          {t('registerLegalConsentPart4')}
          <LegalLink
            label={t('privacyPolicy')}
            onPress={() => void openLegalUrl('privacy')}
          />
          {t('registerLegalConsentPart5')}
        </Text>
      </View>
    </Pressable>
  );
}
