import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import type { LocalizationKey } from '@/services/localizations';
import { cn } from '@/utils/styleUtils';
import { useRouter } from 'expo-router';
import { BackButton } from './BackButton';
import {
  CheckCircle2Icon,
  MessageCircleIcon,
  MicIcon,
  SparklesIcon,
  XCircleIcon
} from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

type EventType =
  | 'translation_submitted'
  | 'review_approved'
  | 'review_rejected'
  | 'comment_added'
  | 'quest_created';

// Dev-only mock data: replace with a real audit_log / activity query once the
// backend event stream exists. Ordered most-recent first.
const MOCK_EVENTS: {
  id: string;
  type: EventType;
  actor: string;
  passage: string;
  projectName: string;
  projectId: string;
  questId: string;
  timeAgo: string;
}[] = [
  {
    id: 'evt-1',
    type: 'review_approved',
    actor: 'Ruth K.',
    passage: "Noah's Ark",
    projectName: 'Kutubu Genesis',
    projectId: 'mock-1',
    questId: 'quest-103',
    timeAgo: '2m ago'
  },
  {
    id: 'evt-2',
    type: 'translation_submitted',
    actor: 'Peter M.',
    passage: 'The Fall',
    projectName: 'Kutubu Genesis',
    projectId: 'mock-1',
    questId: 'quest-102',
    timeAgo: '18m ago'
  },
  {
    id: 'evt-3',
    type: 'review_rejected',
    actor: 'Ruth K.',
    passage: 'Joseph in Egypt',
    projectName: 'Foi Luke',
    projectId: 'mock-2',
    questId: 'quest-202',
    timeAgo: '41m ago'
  },
  {
    id: 'evt-4',
    type: 'comment_added',
    actor: 'David T.',
    passage: "Abraham's Call",
    projectName: 'Foi Luke',
    projectId: 'mock-2',
    questId: 'quest-201',
    timeAgo: '1h ago'
  },
  {
    id: 'evt-5',
    type: 'translation_submitted',
    actor: 'Mary S.',
    passage: 'Creation',
    projectName: 'Kutubu Genesis',
    projectId: 'mock-1',
    questId: 'quest-101',
    timeAgo: '3h ago'
  },
  {
    id: 'evt-6',
    type: 'review_approved',
    actor: 'David T.',
    passage: "Jesus' Baptism",
    projectName: 'Angal Heneng Psalms',
    projectId: 'mock-3',
    questId: 'quest-301',
    timeAgo: 'Yesterday'
  },
  {
    id: 'evt-7',
    type: 'quest_created',
    actor: 'Ruth K.',
    passage: 'The Ten Commandments',
    projectName: 'Kutubu Genesis',
    projectId: 'mock-1',
    questId: 'quest-104',
    timeAgo: 'Yesterday'
  },
  {
    id: 'evt-8',
    type: 'review_rejected',
    actor: 'Peter M.',
    passage: 'Birth of Jesus',
    projectName: 'Angal Heneng Psalms',
    projectId: 'mock-3',
    questId: 'quest-302',
    timeAgo: '2d ago'
  }
];

// NativeWind needs statically-analyzable class strings, so each variant is
// spelled out in full rather than built with a template literal.
const EVENT_STYLES: Record<
  EventType,
  { icon: typeof MicIcon; badgeClassName: string; iconClassName: string }
> = {
  translation_submitted: {
    icon: MicIcon,
    badgeClassName: 'bg-chart-1/15',
    iconClassName: 'text-chart-1'
  },
  review_approved: {
    icon: CheckCircle2Icon,
    badgeClassName: 'bg-chart-4/15',
    iconClassName: 'text-chart-4'
  },
  review_rejected: {
    icon: XCircleIcon,
    badgeClassName: 'bg-destructive/15',
    iconClassName: 'text-destructive'
  },
  comment_added: {
    icon: MessageCircleIcon,
    badgeClassName: 'bg-chart-3/15',
    iconClassName: 'text-chart-3'
  },
  quest_created: {
    icon: SparklesIcon,
    badgeClassName: 'bg-chart-2/15',
    iconClassName: 'text-chart-2'
  }
};

function EventRow({
  event,
  onOpen
}: {
  event: (typeof MOCK_EVENTS)[number];
  onOpen: () => void;
}) {
  const { t } = useLocalization();
  const { icon, badgeClassName, iconClassName } = EVENT_STYLES[event.type];

  const labelKey: Record<EventType, LocalizationKey> = {
    translation_submitted: 'eventTranslationSubmitted',
    review_approved: 'eventReviewApproved',
    review_rejected: 'eventReviewRejected',
    comment_added: 'eventCommentAdded',
    quest_created: 'eventQuestCreated'
  };

  return (
    <Pressable onPress={onOpen}>
      <Card className="min-h-[72px] flex-row items-center gap-3 p-3">
        <View
          className={cn(
            'h-11 w-11 items-center justify-center rounded-full',
            badgeClassName
          )}
        >
          <Icon as={icon} size={20} className={iconClassName} />
        </View>

        <View className="flex-1 gap-0.5">
          <Text numberOfLines={1}>
            <Text className="font-semibold">{event.actor}</Text>
            <Text className="text-muted-foreground">
              {' '}
              {t(labelKey[event.type])}{' '}
            </Text>
            <Text className="font-semibold">{event.passage}</Text>
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {event.projectName}
          </Text>
        </View>

        <Text className="text-xs text-muted-foreground">{event.timeAgo}</Text>
      </Card>
    </Pressable>
  );
}

export default function AuditLogView() {
  const { t } = useLocalization();
  const router = useRouter();

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-4 p-4"
      showsVerticalScrollIndicator={false}
    >
      <BackButton />
      <Text variant="h3">{t('activity')}</Text>

      <View className="gap-2">
        {MOCK_EVENTS.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            onOpen={() =>
              router.push(
                `/(app)/project/${event.projectId}/quest/${event.questId}`
              )
            }
          />
        ))}
      </View>
    </ScrollView>
  );
}
