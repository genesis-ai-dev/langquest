import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { clearPin, hasPin, setPin } from '@/features/appearance/guard';
import { ICON_PREVIEWS } from '@/features/appearance/iconAssets';
import { applyTheme } from '@/features/appearance/iconTheme';
import { getThemeProfiles } from '@/features/appearance/profiles.data';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { cn } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';

const MIN_CODE_LENGTH = 4;

export default function AppearanceView() {
  const { t } = useLocalization();
  const profiles = getThemeProfiles();

  const appearanceThemeId = useLocalStore((s) => s.appearanceThemeId);
  const setAppearanceThemeId = useLocalStore((s) => s.setAppearanceThemeId);
  const entryGuardEnabled = useLocalStore((s) => s.entryGuardEnabled);
  const setEntryGuardEnabled = useLocalStore((s) => s.setEntryGuardEnabled);
  const setEntryGuardMode = useLocalStore((s) => s.setEntryGuardMode);
  const entryGuardMode = useLocalStore((s) => s.entryGuardMode);

  const [showCodeSetup, setShowCodeSetup] = useState(false);
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pinConfigured, setPinConfigured] = useState(false);

  useEffect(() => {
    void hasPin().then(setPinConfigured);
  }, []);

  const handleSelect = useCallback(
    async (id: string, family: 'A' | 'B') => {
      setAppearanceThemeId(id);
      setEntryGuardMode(family);
      await applyTheme(id);
    },
    [setAppearanceThemeId, setEntryGuardMode]
  );

  const handleToggleLock = useCallback(
    (next: boolean) => {
      if (next) {
        // Enabling requires a code so there is always a way back in.
        setShowCodeSetup(true);
      } else {
        setEntryGuardEnabled(false);
        setShowCodeSetup(false);
        void clearPin().then(() => setPinConfigured(false));
      }
    },
    [setEntryGuardEnabled]
  );

  const handleSaveCode = useCallback(async () => {
    if (code.length < MIN_CODE_LENGTH) {
      RNAlert.alert(t('appLock'), t('appLockTooShort'));
      return;
    }
    if (code !== confirm) {
      RNAlert.alert(t('appLock'), t('appLockMismatch'));
      return;
    }
    await setPin(code);
    setPinConfigured(true);
    setEntryGuardEnabled(true);
    setShowCodeSetup(false);
    setCode('');
    setConfirm('');
  }, [code, confirm, setEntryGuardEnabled, t]);

  const handleCancelCode = useCallback(() => {
    setShowCodeSetup(false);
    setCode('');
    setConfirm('');
  }, []);

  const instructions =
    entryGuardMode === 'B'
      ? t('appLockInstructionsNote')
      : t('appLockInstructionsKeypad');

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
    >
      <View className="gap-6">
        <View className="gap-1">
          <Text className="text-2xl font-bold">{t('appIconTheme')}</Text>
          <Text className="text-muted-foreground">
            {t('appIconThemeDescription')}
          </Text>
        </View>

        <View className="flex-row flex-wrap justify-between gap-y-4">
          {profiles.map((profile) => {
            const selected = profile.id === appearanceThemeId;
            return (
              <Button
                key={profile.id}
                variant="plain"
                size="auto"
                className={cn(
                  'w-[30%] items-center gap-2 rounded-2xl border-2 p-2',
                  selected ? 'border-primary' : 'border-transparent'
                )}
                onPress={() => void handleSelect(profile.id, profile.family)}
              >
                <Image
                  source={ICON_PREVIEWS[profile.id]}
                  className="aspect-square w-full rounded-2xl"
                  resizeMode="cover"
                />
              </Button>
            );
          })}
        </View>

        <View className="gap-2">
          <Card className="flex w-full flex-row items-center gap-2 p-6">
            <CardHeader className="flex-1 p-0">
              <CardTitle>{t('appLock')}</CardTitle>
              <CardDescription>{t('appLockDescription')}</CardDescription>
            </CardHeader>
            <Switch
              checked={entryGuardEnabled}
              onCheckedChange={handleToggleLock}
              className={cn(!entryGuardEnabled && 'dark:bg-accent/60')}
            />
          </Card>

          {showCodeSetup && (
            <Card className="w-full gap-4 p-6">
              <CardHeader className="p-0">
                <CardTitle>{t('appLockSetCode')}</CardTitle>
                <CardDescription>{instructions}</CardDescription>
              </CardHeader>
              <Input
                value={code}
                onChangeText={setCode}
                placeholder={t('appLockEnterCode')}
                secureTextEntry
                keyboardType={entryGuardMode === 'B' ? 'default' : 'number-pad'}
              />
              <Input
                value={confirm}
                onChangeText={setConfirm}
                placeholder={t('appLockConfirmCode')}
                secureTextEntry
                keyboardType={entryGuardMode === 'B' ? 'default' : 'number-pad'}
              />
              <View className="flex-row justify-end gap-2">
                <Button variant="outline" onPress={handleCancelCode}>
                  <Text>{t('appLockCancel')}</Text>
                </Button>
                <Button onPress={() => void handleSaveCode()}>
                  <Text>{t('appLockSave')}</Text>
                </Button>
              </View>
            </Card>
          )}

          {entryGuardEnabled && pinConfigured && !showCodeSetup && (
            <Card className="w-full gap-2 p-6">
              <CardDescription>{instructions}</CardDescription>
            </Card>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
