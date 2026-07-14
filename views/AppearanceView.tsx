import { ArrowRight, Check } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { clearPin, hasPin, setPin } from '@/features/appearance/guard';
import { ICON_PREVIEWS } from '@/features/appearance/iconAssets';
import { applyTheme } from '@/features/appearance/iconTheme';
import { normalizeKeypadInput } from '@/features/appearance/matchSequence';
import {
  getFamilyLabel,
  getThemeProfile,
  getThemeProfiles,
  type ThemeFamily
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

type PendingTheme =
  | { kind: 'default' }
  | { kind: 'theme'; id: string; family: ThemeFamily };

function themePreview(id: string | null): ImageSourcePropType {
  if (!id) return DEFAULT_ICON_PREVIEW;
  return ICON_PREVIEWS[id] ?? DEFAULT_ICON_PREVIEW;
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
  const [pendingTheme, setPendingTheme] = useState<PendingTheme | null>(null);

  useEffect(() => {
    void hasPin().then(setPinConfigured);
  }, []);

  const applySelection = useCallback(
    async (pending: PendingTheme) => {
      if (pending.kind === 'default') {
        setAppearanceThemeId(null);
        await applyTheme(null);
        return;
      }
      setAppearanceThemeId(pending.id);
      setEntryGuardMode(pending.family);
      await applyTheme(pending.id);
    },
    [setAppearanceThemeId, setEntryGuardMode]
  );

  const handleConfirmTheme = useCallback(() => {
    if (!pendingTheme) return;
    const next = pendingTheme;
    setPendingTheme(null);
    void applySelection(next);
  }, [applySelection, pendingTheme]);

  const handleCancelTheme = useCallback(() => {
    setPendingTheme(null);
  }, []);

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
    const digits = normalizeKeypadInput(code);
    const confirmDigits = normalizeKeypadInput(confirm);
    if (digits.length < MIN_CODE_LENGTH) {
      RNAlert.alert(t('appLock'), t('appLockTooShort'));
      return;
    }
    if (digits !== confirmDigits) {
      RNAlert.alert(t('appLock'), t('appLockMismatch'));
      return;
    }
    await setPin(digits);
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

  const currentLabel = appearanceThemeId
    ? (getThemeProfile(appearanceThemeId)?.label ?? t('appIconStandard'))
    : t('appIconStandard');
  const currentPreview = themePreview(appearanceThemeId);

  const pendingLabel =
    pendingTheme?.kind === 'theme'
      ? (getThemeProfile(pendingTheme.id)?.label ?? t('appIconStandard'))
      : t('appIconStandard');
  const pendingPreview =
    pendingTheme?.kind === 'theme'
      ? themePreview(pendingTheme.id)
      : DEFAULT_ICON_PREVIEW;

  const pendingFamily =
    pendingTheme?.kind === 'theme' ? pendingTheme.family : entryGuardMode;
  const pendingSurfaceLabel =
    pendingTheme?.kind === 'theme'
      ? (getThemeProfile(pendingTheme.id)?.label ??
        getFamilyLabel(pendingTheme.family))
      : getFamilyLabel(entryGuardMode);
  const pendingInstructions =
    (entryGuardEnabled || showCodeSetup || pinConfigured) && pendingTheme
      ? pendingFamily === 'B'
        ? t('appLockInstructionsNote', { app: pendingSurfaceLabel })
        : t('appLockInstructionsKeypad', { app: pendingSurfaceLabel })
      : null;

  return (
    <>
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
              onPress={() => {
                if (appearanceThemeId === null) return;
                setPendingTheme({ kind: 'default' });
              }}
            />
            {profiles.map((profile) => (
              <IconTile
                key={profile.id}
                selected={profile.id === appearanceThemeId}
                source={ICON_PREVIEWS[profile.id] ?? DEFAULT_ICON_PREVIEW}
                onPress={() => {
                  if (profile.id === appearanceThemeId) return;
                  setPendingTheme({
                    kind: 'theme',
                    id: profile.id,
                    family: profile.family
                  });
                }}
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
                  onChangeText={(value) =>
                    setCode(normalizeKeypadInput(value))
                  }
                  placeholder={t('appLockEnterCode')}
                  secureTextEntry
                  keyboardType="number-pad"
                />
                <Input
                  value={confirm}
                  onChangeText={(value) =>
                    setConfirm(normalizeKeypadInput(value))
                  }
                  placeholder={t('appLockConfirmCode')}
                  secureTextEntry
                  keyboardType="number-pad"
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

      <Drawer
        open={pendingTheme !== null}
        onOpenChange={(open) => {
          if (!open) handleCancelTheme();
        }}
      >
        <DrawerContent className="pb-safe">
          <DrawerHeader>
            <DrawerTitle>{t('appIconChangeTitle')}</DrawerTitle>
          </DrawerHeader>

          <View className="items-center gap-4 px-4 pb-2">
            <View className="w-full flex-row items-center justify-center gap-4">
              <View className="items-center gap-2">
                <Image
                  source={currentPreview}
                  style={{ width: 72, height: 72, borderRadius: 16 }}
                  resizeMode="cover"
                />
                <Text className="max-w-24 text-center text-sm font-medium">
                  {currentLabel}
                </Text>
              </View>
              <Icon
                as={ArrowRight}
                size={24}
                className="shrink-0 text-muted-foreground"
              />
              <View className="items-center gap-2">
                <Image
                  source={pendingPreview}
                  style={{ width: 72, height: 72, borderRadius: 16 }}
                  resizeMode="cover"
                />
                <Text className="max-w-24 text-center text-sm font-medium">
                  {pendingLabel}
                </Text>
              </View>
            </View>

            <Text className="text-center text-sm text-muted-foreground">
              {t('appIconChangeHint')}
            </Text>

            {pendingInstructions ? (
              <Text className="text-center text-sm text-muted-foreground">
                {pendingInstructions}
              </Text>
            ) : null}
          </View>

          <DrawerFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onPress={handleCancelTheme}>
              <Text>{t('cancel')}</Text>
            </Button>
            <Button onPress={handleConfirmTheme}>
              <Text>{t('ok')}</Text>
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
