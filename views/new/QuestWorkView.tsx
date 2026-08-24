import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { cn } from '@/utils/styleUtils';
import {
  CheckIcon,
  ChevronDownIcon,
  KeyRoundIcon,
  MessageCircleIcon,
  MicIcon,
  PlayIcon,
  RotateCcwIcon
} from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { BackButton } from './BackButton';
import {
  MOCK_BOOKS,
  MOCK_KEY_TERMS,
  TASK_TYPE_SHADE_CLASSNAME,
  type MockTask
} from './questMockData';

// Icon-only pill bar (record / comment / redo) — the same visual language as a
// device floating action bar: one rounded track, icon buttons, thin dividers,
// no labels. A small numeral badge stands in for text where a count matters.
function PillActionBar({
  buttons
}: {
  buttons: {
    icon: typeof MicIcon;
    onPress: () => void;
    badge?: number;
    accessibilityLabel: string;
  }[];
}) {
  return (
    <View className="flex-row items-center overflow-hidden rounded-full border border-border bg-card">
      {buttons.map((btn, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View className="h-6 w-px bg-border" />}
          <Pressable
            onPress={btn.onPress}
            accessibilityLabel={btn.accessibilityLabel}
            className="h-11 w-11 items-center justify-center"
          >
            <Icon as={btn.icon} size={18} className="text-foreground" />
            {!!btn.badge && (
              <View className="absolute right-1.5 top-1.5 h-4 w-4 items-center justify-center rounded-full bg-action">
                <Text className="text-[10px] font-bold text-action-foreground">
                  {btn.badge}
                </Text>
              </View>
            )}
          </Pressable>
        </React.Fragment>
      ))}
    </View>
  );
}

// One key term: a word/phrase plus a record-translation / record-comment / redo
// pill. Counts live as badges on the pill so no extra text is needed.
// `initialTranslations`/`initialComments` seed already-checked-off quests with
// real-looking counts instead of an empty first-run state.
function KeyTermRow({
  term,
  initialTranslations = 0,
  initialComments = 0
}: {
  term: string;
  initialTranslations?: number;
  initialComments?: number;
}) {
  const [translations, setTranslations] = React.useState(initialTranslations);
  const [comments, setComments] = React.useState(initialComments);
  const { t } = useLocalization();

  return (
    <View className="flex-row items-center justify-between gap-3 py-2">
      <Text className="flex-1 text-base font-medium">{term}</Text>
      <PillActionBar
        buttons={[
          {
            icon: MicIcon,
            badge: translations,
            accessibilityLabel: t('addComment'),
            onPress: () => setTranslations((n) => n + 1)
          },
          {
            icon: MessageCircleIcon,
            badge: comments,
            accessibilityLabel: t('addComment'),
            onPress: () => setComments((n) => n + 1)
          },
          {
            icon: RotateCcwIcon,
            accessibilityLabel: t('addComment'),
            onPress: () => {
              setTranslations(0);
              setComments(0);
            }
          }
        ]}
      />
    </View>
  );
}

function TranslateWork({ task }: { task: MockTask }) {
  const { t } = useLocalization();
  const terms = MOCK_KEY_TERMS[task.book];
  const [keyTermsExpanded, setKeyTermsExpanded] = React.useState(true);
  // Seeded "already checked off" quests open with a recording already in
  // place, so the primary action reads "Re-record" (outline) instead of the
  // yellow "Record" — the yellow button is reserved for what's actually next.
  const [recorded, setRecorded] = React.useState(task.done);

  return (
    <View className="gap-4">
      <Card className={cn('gap-2 p-4', TASK_TYPE_SHADE_CLASSNAME.translate)}>
        <Pressable
          onPress={() => setKeyTermsExpanded((v) => !v)}
          className="flex-row items-center gap-2"
        >
          <Icon as={KeyRoundIcon} size={18} className="text-chart-2" />
          <Text variant="h4" className="flex-1">
            {t('keyTerms')} · {terms.length}
          </Text>
          <Icon
            as={ChevronDownIcon}
            size={18}
            className={cn(
              'text-muted-foreground',
              keyTermsExpanded && '-scale-y-100'
            )}
          />
        </Pressable>

        {keyTermsExpanded && (
          <View className="divide-y divide-border">
            {terms.map((term) => (
              <KeyTermRow
                key={term}
                term={term}
                initialTranslations={task.done ? 1 : 0}
                initialComments={task.done ? 1 : 0}
              />
            ))}
          </View>
        )}
      </Card>

      <Button
        variant={recorded ? 'outline' : 'action'}
        size="lg"
        className="flex-row items-center gap-2"
        onPress={() => setRecorded(true)}
      >
        <Icon
          as={MicIcon}
          size={20}
          className={recorded ? 'text-foreground' : 'text-action-foreground'}
        />
        <Text
          className={cn(
            'font-semibold',
            recorded ? undefined : 'text-action-foreground'
          )}
        >
          {recorded ? t('reRecord') : t('taskToTranslate')}
        </Text>
      </Button>
    </View>
  );
}

const MOCK_COMMENT_DURATIONS = ['0:06', '0:11', '0:09', '0:14', '0:07'];

function ReviewWork({ task }: { task: MockTask }) {
  const { t } = useLocalization();
  // Starts empty unless the checklist already seeded this quest as done, in
  // which case its mock comments are prefilled — that's what lets the yellow
  // action visibly move from "Add comment" to "Done" on first open.
  const [comments, setComments] = React.useState(task.mockComments ?? []);
  const [isDone, setIsDone] = React.useState(false);
  const hasComments = comments.length > 0;

  const onAddComment = () => {
    const duration =
      MOCK_COMMENT_DURATIONS[
        comments.length % MOCK_COMMENT_DURATIONS.length
      ] ?? '0:10';
    setComments((prev) => [
      ...prev,
      { id: `${task.id}-comment-${prev.length}`, duration }
    ]);
  };

  return (
    <View className="gap-4">
      <Card className={cn('gap-3 p-4', TASK_TYPE_SHADE_CLASSNAME.review)}>
        <Text className="text-sm text-muted-foreground">
          {isDone
            ? t('taskReviewDone')
            : hasComments
              ? t('taskToReview')
              : t('addComment')}
        </Text>

        {hasComments && (
          <View className="flex-row flex-wrap gap-2">
            {comments.map((comment) => (
              <View
                key={comment.id}
                className="flex-row items-center gap-1.5 rounded-full bg-chart-3/10 py-1.5 pl-1.5 pr-3"
              >
                <View className="h-6 w-6 items-center justify-center rounded-full bg-chart-3">
                  <Icon as={PlayIcon} size={12} className="text-white" />
                </View>
                <Text className="text-xs text-muted-foreground">
                  {comment.duration}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {!isDone && (
        <View className="flex-row gap-2">
          <Button
            variant={hasComments ? 'outline' : 'action'}
            size="lg"
            className="flex-1 flex-row items-center gap-2"
            onPress={onAddComment}
          >
            <Icon
              as={MicIcon}
              size={18}
              className={hasComments ? 'text-foreground' : 'text-action-foreground'}
            />
            <Text className={hasComments ? undefined : 'text-action-foreground'}>
              {t('addComment')}
            </Text>
          </Button>
          {hasComments && (
            <Button
              variant="action"
              size="lg"
              className="flex-row items-center gap-2"
              onPress={() => setIsDone(true)}
            >
              <Icon
                as={CheckIcon}
                size={18}
                className="text-action-foreground"
              />
              <Text className="font-semibold text-action-foreground">
                {t('done')}
              </Text>
            </Button>
          )}
        </View>
      )}
    </View>
  );
}

export default function QuestWorkView({ task }: { task: MockTask }) {
  const book = MOCK_BOOKS[task.book];

  return (
    <View className={cn('flex-1', TASK_TYPE_SHADE_CLASSNAME[task.type])}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
        showsVerticalScrollIndicator={false}
      >
        <BackButton />

        <View className="flex-row items-center gap-2">
          <Icon
            as={book.icon}
            size={22}
            className={
              task.type === 'translate' ? 'text-chart-1' : 'text-chart-3'
            }
          />
          <Text variant="h3">
            {book.name} {task.passage}
          </Text>
        </View>

        {task.type === 'translate' ? (
          <TranslateWork task={task} />
        ) : (
          <ReviewWork task={task} />
        )}
      </ScrollView>
    </View>
  );
}
