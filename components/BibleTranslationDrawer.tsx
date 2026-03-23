import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerScrollView,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import type { BibleBrainBible } from '@/hooks/useBibleBrainBibles';
import { useBibleBrainBibles } from '@/hooks/useBibleBrainBibles';
import { useBibleBrainBiblesByIso } from '@/hooks/useBibleBrainBiblesByIso';
import { useBibleBrainLanguages } from '@/hooks/useBibleBrainLanguages';
import type { BibleDownloadTranslation } from '@/store/localStore';
import { useLocalStore } from '@/store/localStore';
import { cn, useThemeColor } from '@/utils/styleUtils';
import {
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  HeadphonesIcon,
  SearchIcon,
  TypeIcon,
  XIcon
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

const EMPTY_TRANSLATIONS: BibleDownloadTranslation[] = [];

function TranslationCheckboxRow({
  bible,
  checked,
  onToggle
}: {
  bible: BibleBrainBible;
  checked: boolean;
  onToggle: () => void;
}) {
  const label = bible.vname || bible.name;

  return (
    <Pressable
      onPress={onToggle}
      className={cn(
        'flex-row items-center gap-3 rounded-xl border bg-card px-4 py-3 active:bg-accent',
        checked ? 'border-primary' : 'border-border'
      )}
    >
      <View
        className={cn(
          'h-6 w-6 items-center justify-center rounded-md border-2',
          checked
            ? 'border-primary bg-primary'
            : 'border-muted-foreground bg-transparent'
        )}
      >
        {checked && <Icon as={CheckIcon} size={14} className="text-white" />}
      </View>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
        <Icon as={BookOpenIcon} size={18} className="text-primary" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium" numberOfLines={2}>
          {label}
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        {bible.hasText && (
          <View className="flex-row items-center gap-0.5 rounded-full bg-secondary/50 px-1.5 py-0.5">
            <Icon as={TypeIcon} size={10} className="text-muted-foreground" />
            {bible.textTestaments &&
              bible.textTestaments.length === 1 && (
                <Text className="text-[9px] text-muted-foreground">
                  {bible.textTestaments[0]}
                </Text>
              )}
          </View>
        )}
        {bible.hasAudio && (
          <View className="flex-row items-center gap-0.5 rounded-full bg-secondary/50 px-1.5 py-0.5">
            <Icon
              as={HeadphonesIcon}
              size={10}
              className="text-muted-foreground"
            />
            {bible.audioTestaments &&
              bible.audioTestaments.length === 1 && (
                <Text className="text-[9px] text-muted-foreground">
                  {bible.audioTestaments[0]}
                </Text>
              )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

function LanguageBiblesList({
  iso,
  languageName,
  preloadedBibles,
  selectedBibles,
  onToggle,
  searchFilter
}: {
  iso: string;
  languageName: string;
  preloadedBibles?: BibleBrainBible[];
  selectedBibles: Map<string, BibleBrainBible>;
  onToggle: (bible: BibleBrainBible) => void;
  searchFilter?: string;
}) {
  const primaryColor = useThemeColor('primary');
  const { bibles: fetchedBibles, isLoading } = useBibleBrainBiblesByIso(
    preloadedBibles ? undefined : iso
  );

  const allBibles = preloadedBibles ?? fetchedBibles;
  let activeBibles = allBibles.filter((b) => b.hasText || b.hasAudio);

  if (searchFilter?.trim()) {
    const lower = searchFilter.toLowerCase().trim();
    activeBibles = activeBibles.filter(
      (b) =>
        b.name.toLowerCase().includes(lower) ||
        (b.vname && b.vname.toLowerCase().includes(lower))
    );
  }

  if (!preloadedBibles && isLoading) {
    return (
      <View className="items-center py-4">
        <ActivityIndicator size="small" color={primaryColor} />
      </View>
    );
  }

  if (activeBibles.length === 0) {
    return (
      <Text className="py-2 text-center text-xs text-muted-foreground">
        No translations available
      </Text>
    );
  }

  const handleToggle = (bible: BibleBrainBible) => {
    onToggle({ ...bible, languageName });
  };

  return (
    <View className="gap-2">
      {activeBibles.map((bible) => (
        <TranslationCheckboxRow
          key={bible.id}
          bible={bible}
          checked={selectedBibles.has(bible.id)}
          onToggle={() => handleToggle(bible)}
        />
      ))}
    </View>
  );
}

function countSelectedForLanguage(
  selectedBibles: Map<string, BibleBrainBible>,
  languageName: string
): number {
  let count = 0;
  for (const bible of selectedBibles.values()) {
    if (bible.languageName === languageName) count++;
  }
  return count;
}

interface BibleTranslationDrawerProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the user confirms translation selection (before this drawer closes). */
  onTranslationsConfirmed?: () => void;
}

export function BibleTranslationDrawer({
  projectId,
  open,
  onOpenChange,
  onTranslationsConfirmed
}: BibleTranslationDrawerProps) {
  const primaryColor = useThemeColor('primary');

  const { bibles: projectBibles, isLoading: projectBiblesLoading } =
    useBibleBrainBibles(projectId);

  const savedTranslations = useLocalStore(
    (s) => s.bibleDownloadTranslations[projectId] ?? EMPTY_TRANSLATIONS
  );
  const setBibleDownloadTranslations = useLocalStore(
    (s) => s.setBibleDownloadTranslations
  );
  const setBibleTranslation = useLocalStore((s) => s.setBibleTranslation);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedBibles, setSelectedBibles] = React.useState<
    Map<string, BibleBrainBible>
  >(new Map());

  const { languages, isLoading: languagesLoading } =
    useBibleBrainLanguages(searchQuery);

  const projectActiveBibles = projectBibles.filter(
    (b) => b.hasText || b.hasAudio
  );
  const projectIso = projectBibles[0]?.iso ?? '';
  const projectLanguageName = projectBibles[0]?.languageName || projectIso;

  const searchedLanguages =
    searchQuery.trim().length >= 2
      ? languages.filter((lang) => lang.iso !== projectIso)
      : [];

  const projectSelectedCount = projectActiveBibles.filter((b) =>
    selectedBibles.has(b.id)
  ).length;

  const selectedNonProjectLanguages = React.useMemo(() => {
    const groups = new Map<string, { iso: string; name: string }>();
    for (const bible of selectedBibles.values()) {
      if (
        bible.iso &&
        bible.iso !== projectIso &&
        !groups.has(bible.languageName)
      ) {
        groups.set(bible.languageName, {
          iso: bible.iso,
          name: bible.languageName || bible.iso
        });
      }
    }
    return Array.from(groups.values());
  }, [selectedBibles, projectIso]);

  React.useEffect(() => {
    if (open) {
      setSearchQuery('');

      const initial = new Map<string, BibleBrainBible>();
      for (const saved of savedTranslations) {
        const projectBible = projectBibles.find((b) => b.id === saved.bibleId);
        if (projectBible) {
          initial.set(projectBible.id, projectBible);
        } else {
          initial.set(saved.bibleId, {
            id: saved.bibleId,
            name: saved.name,
            vname: saved.vname,
            hasText: saved.hasText,
            hasAudio: saved.hasAudio,
            textTestaments: saved.textTestaments ?? [],
            audioTestaments: saved.audioTestaments ?? [],
            iso: saved.iso,
            languageName: saved.languageName
          });
        }
      }
      setSelectedBibles(initial);
    }
  }, [open, savedTranslations, projectBibles]);

  const toggleBible = (bible: BibleBrainBible) => {
    setSelectedBibles((prev) => {
      const next = new Map(prev);
      if (next.has(bible.id)) {
        next.delete(bible.id);
      } else {
        next.set(bible.id, bible);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const allSelected = Array.from(selectedBibles.values());

    const translations: BibleDownloadTranslation[] = allSelected.map((b) => ({
      bibleId: b.id,
      name: b.name,
      vname: b.vname,
      hasText: b.hasText,
      hasAudio: b.hasAudio,
      textTestaments: b.textTestaments,
      audioTestaments: b.audioTestaments,
      iso: b.iso,
      languageName: b.languageName
    }));
    setBibleDownloadTranslations(projectId, translations);

    if (allSelected.length > 0) {
      const first = allSelected[0]!;
      setBibleTranslation(projectId, {
        bibleId: first.id,
        name: first.name,
        vname: first.vname,
        hasText: first.hasText,
        hasAudio: first.hasAudio
      });
    }

    onTranslationsConfirmed?.();
    onOpenChange(false);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearchQuery('');
    }
    onOpenChange(nextOpen);
  };

  const selectedCount = selectedBibles.size;

  return (
    <Drawer
      open={open}
      onOpenChange={handleClose}
      snapPoints={['100%']}
      enableDynamicSizing={false}
    >
      <DrawerContent asChild>
        <View className="flex-1 flex-col">
          <DrawerHeader>
            <DrawerTitle>Add Bible Translations</DrawerTitle>
            <DrawerDescription>
              Select translations for this project
            </DrawerDescription>
          </DrawerHeader>

          {projectBiblesLoading ? (
            <View className="flex-1 items-center justify-center py-8">
              <ActivityIndicator size="large" color={primaryColor} />
              <Text className="mt-3 text-sm text-muted-foreground">
                Loading translations...
              </Text>
            </View>
          ) : projectBibles.length === 0 && searchQuery.trim().length < 2 ? (
            <View className="flex-1 items-center justify-center gap-3 py-8">
              <Text className="text-sm text-muted-foreground">
                No translations available.
              </Text>
              <Button
                variant="outline"
                size="sm"
                onPress={() => onOpenChange(false)}
              >
                <Text>Close</Text>
              </Button>
            </View>
          ) : (
            <>
              <View className="flex-row items-center gap-2 pb-3">
                <Input
                  className="flex-1"
                  placeholder="Search languages or translations..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  prefix={SearchIcon}
                  prefixStyling={false}
                  size="sm"
                  returnKeyType="search"
                  drawerInput
                  suffix={
                    searchQuery ? (
                      languagesLoading ? (
                        <ActivityIndicator size="small" color={primaryColor} />
                      ) : (
                        <Pressable
                          onPress={() => setSearchQuery('')}
                          hitSlop={8}
                        >
                          <Icon
                            as={XIcon}
                            size={16}
                            className="text-muted-foreground"
                          />
                        </Pressable>
                      )
                    ) : undefined
                  }
                  suffixStyling={false}
                  hitSlop={12}
                />
              </View>

              <DrawerScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 16 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View>
                  <View className={cn('gap-1')}>
                    {projectActiveBibles.length > 0 && (
                      <Collapsible defaultOpen className={cn('gap-2')}>
                        <CollapsibleTrigger
                          className={cn(
                            'flex-row items-center justify-between gap-4 rounded-lg bg-card px-4 py-2.5'
                          )}
                        >
                          <View className="flex-1 flex-row items-center gap-2">
                            <Text className="flex-1 font-medium">
                              {projectLanguageName} (Project)
                            </Text>
                            {projectSelectedCount > 0 && (
                              <Badge variant="default" className="px-2 py-0.5">
                                <Text className="text-xs text-primary-foreground">
                                  {projectSelectedCount}
                                </Text>
                              </Badge>
                            )}
                          </View>
                          <Icon
                            as={ChevronDownIcon}
                            size={16}
                            className="shrink-0 text-muted-foreground"
                          />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-0 pb-4">
                          <LanguageBiblesList
                            iso={projectIso}
                            languageName={projectLanguageName}
                            preloadedBibles={projectActiveBibles}
                            selectedBibles={selectedBibles}
                            onToggle={toggleBible}
                            searchFilter={searchQuery}
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {searchedLanguages.map((lang) => {
                      const langSelectedCount = countSelectedForLanguage(
                        selectedBibles,
                        lang.name
                      );
                      return (
                        <Collapsible
                          key={`${lang.iso}:${lang.name}`}
                          defaultOpen={false}
                          className={cn('gap-2')}
                        >
                          <CollapsibleTrigger
                            className={cn(
                              'flex-row items-center justify-between gap-4 rounded-lg bg-card px-4 py-2.5'
                            )}
                          >
                            <View className="flex-1 flex-row items-center gap-2">
                              <Text className="flex-1 font-medium">
                                {lang.name}
                                {lang.autonym && lang.autonym !== lang.name
                                  ? ` (${lang.autonym})`
                                  : ''}
                              </Text>
                              {langSelectedCount > 0 && (
                                <Badge
                                  variant="default"
                                  className="px-2 py-0.5"
                                >
                                  <Text className="text-xs text-primary-foreground">
                                    {langSelectedCount}
                                  </Text>
                                </Badge>
                              )}
                            </View>
                            <Icon
                              as={ChevronDownIcon}
                              size={16}
                              className="shrink-0 text-muted-foreground"
                            />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-0 pb-4">
                            <LanguageBiblesList
                              iso={lang.iso}
                              languageName={lang.name}
                              selectedBibles={selectedBibles}
                              onToggle={toggleBible}
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}

                    {selectedNonProjectLanguages
                      .filter(
                        (g) => !searchedLanguages.some((l) => l.name === g.name)
                      )
                      .map((group) => {
                        const langSelectedCount = countSelectedForLanguage(
                          selectedBibles,
                          group.name
                        );
                        return (
                          <Collapsible
                            key={`${group.iso}:${group.name}`}
                            defaultOpen={false}
                            className={cn('gap-2')}
                          >
                            <CollapsibleTrigger
                              className={cn(
                                'flex-row items-center justify-between gap-4 rounded-lg bg-card px-4 py-2.5'
                              )}
                            >
                              <View className="flex-1 flex-row items-center gap-2">
                                <Text className="flex-1 font-medium">
                                  {group.name}
                                </Text>
                                {langSelectedCount > 0 && (
                                  <Badge
                                    variant="default"
                                    className="px-2 py-0.5"
                                  >
                                    <Text className="text-xs text-primary-foreground">
                                      {langSelectedCount}
                                    </Text>
                                  </Badge>
                                )}
                              </View>
                              <Icon
                                as={ChevronDownIcon}
                                size={16}
                                className="shrink-0 text-muted-foreground"
                              />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="px-0 pb-4">
                              <LanguageBiblesList
                                iso={group.iso}
                                languageName={group.name}
                                selectedBibles={selectedBibles}
                                onToggle={toggleBible}
                              />
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                  </View>

                  {searchQuery.trim().length >= 2 && languagesLoading && (
                    <View className="items-center py-4">
                      <ActivityIndicator size="small" color={primaryColor} />
                      <Text className="mt-2 text-xs text-muted-foreground">
                        Searching languages...
                      </Text>
                    </View>
                  )}

                  {searchQuery.trim().length >= 2 &&
                    !languagesLoading &&
                    searchedLanguages.length === 0 && (
                      <Text className="py-4 text-center text-xs text-muted-foreground">
                        No additional languages found
                      </Text>
                    )}
                </View>
              </DrawerScrollView>

              <View className="pb-safe gap-2 bg-background pt-3">
                <Button onPress={handleConfirm} disabled={selectedCount === 0}>
                  <Text className="font-semibold text-primary-foreground">
                    Select {selectedCount}{' '}
                    {selectedCount === 1 ? 'translation' : 'translations'}
                  </Text>
                </Button>
                <Button variant="ghost" onPress={() => onOpenChange(false)}>
                  <Text className="text-muted-foreground">Cancel</Text>
                </Button>
              </View>
            </>
          )}
        </View>
      </DrawerContent>
    </Drawer>
  );
}
