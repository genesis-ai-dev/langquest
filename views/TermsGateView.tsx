import { Icon } from '@/components/ui/icon';
import type { Option } from '@/components/ui/select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useLocalization } from '@/hooks/useLocalization';
import { SUPPORTED_LANGUAGE_NAMES } from '@/services/localizations';
import { useLocalStore } from '@/store/localStore';
import { supabaseAnon } from '@/utils/supabaseAnon';
import { PortalHost } from '@rn-primitives/portal';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { LanguagesIcon } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets
} from 'react-native-safe-area-context';
import { TermsView } from './TermsView';

interface Languoid {
  id: string;
  name: string | null;
  active: boolean | null;
  ui_ready: boolean | null;
}

interface EndonymRow {
  subject_languoid_id: string;
  label_languoid_id: string;
  name: string;
}

function useOnlineLanguages() {
  const [languoids, setLanguoids] = useState<Languoid[]>([]);
  const [endonymMap, setEndonymMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchLanguages() {
      try {
        const { data, error } = await supabaseAnon
          .from('languoid')
          .select('id, name, active, ui_ready')
          .eq('active', true)
          .eq('ui_ready', true);

        if (error || cancelled) return;

        const supported = (data as Languoid[]).filter(
          (l) => l.name && SUPPORTED_LANGUAGE_NAMES.has(l.name.toLowerCase())
        );
        setLanguoids(supported);

        const ids = supported.map((l) => l.id);
        if (ids.length > 0) {
          const { data: aliases, error: aliasError } = await supabaseAnon
            .from('languoid_alias')
            .select('subject_languoid_id, label_languoid_id, name')
            .eq('alias_type', 'endonym')
            .eq('active', true)
            .in('subject_languoid_id', ids)
            .contains('source_names', ['lexvo']);

          if (!aliasError && !cancelled && aliases) {
            const map = new Map<string, string>();
            const rows = aliases as EndonymRow[];
            const selfRef = rows.filter(
              (a) => a.subject_languoid_id === a.label_languoid_id
            );
            selfRef.forEach((a) => {
              if (!map.has(a.subject_languoid_id)) {
                map.set(a.subject_languoid_id, a.name);
              }
            });
            rows.forEach((a) => {
              if (!map.has(a.subject_languoid_id)) {
                map.set(a.subject_languoid_id, a.name);
              }
            });
            setEndonymMap(map);
          }
        }
      } catch {
        // Offline or network error — language select stays empty, English fallback is fine
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchLanguages();
    return () => {
      cancelled = true;
    };
  }, []);

  return { languoids, endonymMap, isLoading };
}

function GateLanguageSelect() {
  const insets = useSafeAreaInsets();
  const contentInsets = {
    top: insets.top,
    bottom: Platform.select({
      ios: insets.bottom,
      android: insets.bottom + 24
    }),
    left: 21,
    right: 21
  };

  const { t } = useLocalization();
  const setUILanguage = useLocalStore((state) => state.setUILanguage);
  const uiLanguage = useLocalStore((state) => state.uiLanguage);
  const setSavedLanguage = useLocalStore((state) => state.setSavedLanguage);

  const { languoids, endonymMap, isLoading } = useOnlineLanguages();

  const selectedLanguage = uiLanguage
    ? languoids.find((l) => l.id === (uiLanguage as any).id)
    : languoids.find((l) => l.name === 'English');

  const selectedOption: Option | undefined = selectedLanguage
    ? {
        value: selectedLanguage.id,
        label:
          endonymMap.get(selectedLanguage.id) ?? selectedLanguage.name ?? ''
      }
    : undefined;

  const options = useMemo(
    () =>
      languoids
        .filter((l) => l.name)
        .map((lang) => ({
          value: lang.id,
          label: endonymMap.get(lang.id) ?? lang.name ?? ''
        })),
    [languoids, endonymMap]
  );

  if (isLoading && languoids.length === 0) {
    return null;
  }

  return (
    <Select
      value={selectedOption}
      onValueChange={(option) => {
        if (!option) return;
        const lang = languoids.find((l) => l.id === option.value);
        if (lang) {
          setSavedLanguage(lang as any);
          setUILanguage(lang as any);
        }
      }}
    >
      <SelectTrigger className="h-12 flex-row items-center rounded-md px-3">
        <Icon as={LanguagesIcon} className="text-muted-foreground" />
        <SelectValue
          className="text-base text-foreground"
          placeholder={t('selectLanguage')}
        />
      </SelectTrigger>
      <SelectContent insets={contentInsets} className="w-full">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} label={opt.label}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface TermsGateViewProps {
  systemBarsStyle: 'light' | 'dark';
}

/**
 * Pre-auth terms gate rendered outside the navigation stack.
 * Uses only the Supabase anon key for language data — no PowerSync, no Auth.
 * Hides the splash screen on mount.
 */
export function TermsGateView({ systemBarsStyle }: TermsGateViewProps) {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style={systemBarsStyle} />
        <SafeAreaView className="flex-1 bg-background">
          <TermsView languageSelect={<GateLanguageSelect />} />
          <PortalHost />
        </SafeAreaView>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
