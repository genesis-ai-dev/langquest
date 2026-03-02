import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import RNAlert from '@blazejkustra/react-native-alert';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { ChevronLeftIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useMemo } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { Image, Linking, Pressable, ScrollView, View } from 'react-native';

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment */
const iconDark: ImageSourcePropType = require('@/assets/icons/icon_dark.png');
const iconLight: ImageSourcePropType = require('@/assets/icons/icon_light.png');

const siteUrl = process.env.EXPO_PUBLIC_SITE_URL || 'https://langquest.org';
const feedbackFormUrl = 'https://forms.gle/3XdNRMg5Dtj5eVdj9';

interface AboutSectionItem {
  id: string;
  title: string;
  onPress: () => void;
}

function AboutSection({
  title,
  items,
  description
}: {
  title: string;
  items: AboutSectionItem[];
  description?: string;
}) {
  return (
    <View className="gap-2">
      <Text className="px-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </Text>

      <View className="overflow-hidden rounded-2xl bg-card">
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            <Pressable
              onPress={item.onPress}
              className="px-5 py-4 active:bg-accent/50"
            >
              <Text className="text-xl font-medium text-primary">
                {item.title}
              </Text>
            </Pressable>
            {index < items.length - 1 ? (
              <View className="h-px bg-border/80" />
            ) : null}
          </React.Fragment>
        ))}
      </View>

      {description ? (
        <Text className="px-1 text-base text-muted-foreground">
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export default function AboutView() {
  const { goBack, goToSettings, canGoBack } = useAppNavigation();
  const { colorScheme } = useColorScheme();

  const iconSource = colorScheme === 'dark' ? iconDark : iconLight;

  const appName = useMemo(
    () => Application.applicationName || Constants.expoConfig?.name || 'LangQuest',
    []
  );

  const appVersion = useMemo(() => {
    const version =
      Application.nativeApplicationVersion || Constants.expoConfig?.version;
    const build =
      Application.nativeBuildVersion ||
      (Constants.expoConfig?.ios as { buildNumber?: string } | undefined)
        ?.buildNumber ||
      (
        Constants.expoConfig?.android as
          | { versionCode?: number | string }
          | undefined
      )?.versionCode?.toString();

    return build ? `${version || 'Unknown'} (${build})` : version || 'Unknown';
  }, []);

  const openUrl = useCallback(async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        RNAlert.alert('Error', 'Unable to open this link right now.');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.error('[AboutView] Failed to open URL:', error);
      RNAlert.alert('Error', 'Unable to open this link right now.');
    }
  }, []);

  const handleBackPress = useCallback(() => {
    if (canGoBack) {
      goBack();
      return;
    }
    goToSettings();
  }, [canGoBack, goBack, goToSettings]);

  const legalItems = useMemo<AboutSectionItem[]>(
    () => [
      {
        id: 'terms',
        title: 'Terms And Conditions',
        onPress: () => {
          void openUrl(`${siteUrl}/terms`);
        }
      },
      {
        id: 'privacy',
        title: 'Privacy Policy',
        onPress: () => {
          void openUrl(`${siteUrl}/privacy`);
        }
      },
      {
        id: 'licenses',
        title: 'License and Open Source Notes',
        onPress: () => {
          RNAlert.alert('Info', 'Open source notices will be available soon.');
        }
      }
    ],
    [openUrl]
  );

  const socialItems = useMemo<AboutSectionItem[]>(
    () => [
      {
        id: 'social',
        title: `Follow ${appName} on X`,
        onPress: () => {
          void openUrl(siteUrl);
        }
      }
    ],
    [appName, openUrl]
  );

  const feedbackItems = useMemo<AboutSectionItem[]>(
    () => [
      {
        id: 'feedback',
        title: 'Send Feedback',
        onPress: () => {
          void openUrl(feedbackFormUrl);
        }
      }
    ],
    [openUrl]
  );

  return (
    <ScrollView className="flex-1 px-4" contentContainerClassName="pb-10 pt-2">
      <View className="gap-8">
        <View className="flex-row items-center justify-between">
          <Button variant="ghost" size="icon" onPress={handleBackPress}>
            <Icon as={ChevronLeftIcon} size={24} className="text-foreground" />
          </Button>
          <Text className="text-2xl font-semibold text-foreground">About</Text>
          <View className="size-10" />
        </View>

        <View className="items-center">
          <View className="h-32 w-32 items-center justify-center overflow-hidden rounded-[30px] bg-card">
            <Image source={iconSource} style={{ width: 128, height: 128 }} />
          </View>
          <Text className="mt-4 text-4xl font-semibold text-foreground">
            {appName}
          </Text>
          <Text className="mt-1 text-xl text-muted-foreground">
            {appVersion}
          </Text>
        </View>

        <View className="gap-7">
          <AboutSection title="Legal" items={legalItems} />
          <AboutSection
            title="Social"
            items={socialItems}
            description={`Interested in new and upcoming features for ${appName}? Follow us to be the first to know!`}
          />
          <AboutSection title="Send Feedback" items={feedbackItems} />
        </View>
      </View>
    </ScrollView>
  );
}
