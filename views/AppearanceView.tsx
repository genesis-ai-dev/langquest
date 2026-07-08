import { Check } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
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
import {
  getFamilyLabel,
  getThemeProfile,
  getThemeProfiles
} from '@/features/appearance/profiles.data';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { cn } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';

const MIN_CODE_LENGTH = 4;

// Standard (non-disguised) icon, shown as the first tile so the feature can be
// turned off from the same grid it was turned on from.
const DEFAULT_ICON_PREVIEW = require('@/assets/icons/icon_light.png');

interface IconTileProps {
  selected: boolean;
  source: ImageSourcePropType;
  onPress: () => void;
}

function IconTile({ selected, source, onPress }: IconTileProps) {
  return (
    <Button
      variant="plain"
      size="auto"
      className={cn(
        'w-[30%] items-center gap-2 rounded-2xl border-2 p-2',
        selected ? 'border-primary' : 'border-transparent'
      )}
      onPress={onPress}
    >
      <Image
        source={source}
        className="aspect-square w-full rounded-2xl"
        resizeMode="cover"
      />
      {selected && (
        <View className="absolute -right-2 -top-2 size-6 items-center justify-center rounded-full border-2 border-background bg-primary">
          <Icon
            as={Check}
            size={14}
            strokeWidth={3.5}
            className="text-primary-foreground"
          />
        </View>
      )}
    </Button>
  );
}

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

  const handleSelectDefault = useCallback(async () => {
    setAppearanceThemeId(null);
    await applyTheme(null);
  }, [setAppearanceThemeId]);

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

  // The disguise's home-screen name, decoded at runtime (never plaintext in
  // source). Falls back to the family's label when no theme is selected.
  const surfaceLabel = appearanceThemeId
    ? (getThemeProfile(appearanceThemeId)?.label ??
      getFamilyLabel(entryGuardMode))
    : getFamilyLabel(entryGuardMode);

  const instructions =
    entryGuardMode === 'B'
      ? t('appLockInstructionsNote', { app: surfaceLabel })
      : t('appLockInstructionsKeypad', { app: surfaceLabel });

  return (
    <KeyboardAwareScrollView
      className="flex-1"
      contentContainerClassName="p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      bottomOffset={96}
      extraKeyboardSpace={20}
    >
      <View className="gap-6">
        <View className="gap-1">
          <Text className="text-2xl font-bold">{t('appIconTheme')}</Text>
          <Text className="text-muted-foreground">
            {t('appIconThemeDescription')}
          </Text>
        </View>

        <View className="flex-row flex-wrap justify-between gap-y-4">
          <IconTile
            selected={appearanceThemeId === null}
            source={DEFAULT_ICON_PREVIEW}
            onPress={() => void handleSelectDefault()}
          />
          {profiles.map((profile) => (
            <IconTile
              key={profile.id}
              selected={profile.id === appearanceThemeId}
              source={ICON_PREVIEWS[profile.id] ?? DEFAULT_ICON_PREVIEW}
              onPress={() => void handleSelect(profile.id, profile.family)}
            />
          ))}
        </View>

        <View className="gap-2">
          <Card className="flex w-full flex-row items-center gap-2 p-6">
            <CardHeader className="flex-1 p-0">
              <CardTitle>{t('appLock')}</CardTitle>
              <CardDescription>{t('appLockDescription')}</CardDescription>
            </CardHeader>
            <Switch
              checked={entryGuardEnabled || showCodeSetup}
              onCheckedChange={handleToggleLock}
              className={cn(
                !(entryGuardEnabled || showCodeSetup) && 'dark:bg-accent/60'
              )}
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
    </KeyboardAwareScrollView>
  );
}
