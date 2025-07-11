import { colors, fontSizes, spacing } from '@/styles/theme';
import React from 'react';
import { Text, View } from 'react-native';

interface BreadcrumbBannerProps {
  language: string;
}

export const BreadcrumbBanner: React.FC<BreadcrumbBannerProps> = ({
  language: _language
}) => {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: spacing.large,
        left: 0,
        right: 0,
        alignItems: 'center'
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: fontSizes.medium
        }}
      ></Text>
    </View>
  );
};
