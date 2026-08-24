import { FiaIcon } from '@/components/icons/FiaIcon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/hooks/useLocalization';
import { cn } from '@/utils/styleUtils';
import { useRouter } from 'expo-router';
import {
  ArrowRightIcon,
  CheckIcon,
  CircleIcon,
  ListChecksIcon,
  MessageCircleIcon,
  MicIcon,
  PlusIcon
} from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MOCK_BOOKS,
  MOCK_PROJECTS,
  MOCK_TASKS,
  TASK_TYPE_SHADE_CLASSNAME,
  type ProjectRole
} from './questMockData';

// Icon + color per project role, so "what am I here to do on this project"
// reads at a glance without a text label.
const ROLE_META: Record<
  ProjectRole,
  {
    icon: typeof MicIcon;
    badgeClassName: string;
    iconClassName: string;
    progressBaseClassName: string;
    progressAccentClassName: string;
  }
> = {
  translator: {
    icon: MicIcon,
    badgeClassName: 'bg-chart-1/15',
    iconClassName: 'text-chart-1',
    progressBaseClassName: 'bg-chart-1/40',
    progressAccentClassName: 'bg-chart-1'
  },
  reviewer: {
    icon: ListChecksIcon,
    badgeClassName: 'bg-chart-3/15',
    iconClassName: 'text-chart-3',
    progressBaseClassName: 'bg-chart-3/40',
    progressAccentClassName: 'bg-chart-3'
  },
  commenter: {
    icon: MessageCircleIcon,
    badgeClassName: 'bg-chart-2/15',
    iconClassName: 'text-chart-2',
    progressBaseClassName: 'bg-chart-2/40',
    progressAccentClassName: 'bg-chart-2'
  }
};

const ROLE_LABEL_KEY = {
  translator: 'roleTranslator',
  reviewer: 'roleReviewer',
  commenter: 'roleCommenter'
} as const;

// Same color language as the role badges, applied as a whole-surface tint so
// a card/row's type reads from its shading even before you read the icon.
const ROLE_SHADE_CLASSNAME: Record<ProjectRole, string> = {
  translator: 'bg-chart-1/[0.06]',
  reviewer: 'bg-chart-3/[0.06]',
  commenter: 'bg-chart-2/[0.06]'
};

function RoleBadge({ role }: { role: ProjectRole }) {
  const { t } = useLocalization();
  const meta = ROLE_META[role];
  return (
    <View
      className={cn(
        'h-9 w-9 items-center justify-center rounded-full',
        meta.badgeClassName
      )}
      accessibilityLabel={t(ROLE_LABEL_KEY[role])}
    >
      <Icon as={meta.icon} size={17} className={meta.iconClassName} />
    </View>
  );
}

// Static, non-animated progress bar. The shared <Progress> component (reanimated-based)
// currently throws on this platform combo, so keep this simple for the prototype.
//
// Translation and review are drawn on one track instead of two, since review is always
// a subset of what's translated: a wide translation fill behind a thinner review fill
// "chasing" it from the same starting edge.
function DualProgressBar({
  translationPct,
  reviewPct,
  baseClassName,
  accentClassName
}: {
  translationPct: number;
  reviewPct: number;
  baseClassName: string;
  accentClassName: string;
}) {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  return (
    <View className="h-3 w-full justify-center overflow-hidden rounded-full bg-muted">
      <View
        className={cn('absolute h-3 rounded-full', baseClassName)}
        style={{ width: `${clamp(translationPct)}%` }}
      />
      <View
        className={cn('absolute h-1.5 rounded-full', accentClassName)}
        style={{ width: `${clamp(reviewPct)}%` }}
      />
    </View>
  );
}

function ProjectProgressCard({
  project,
  onOpen
}: {
  project: (typeof MOCK_PROJECTS)[number];
  onOpen: () => void;
}) {
  const { t } = useLocalization();
  return (
    <Card
      className={cn('gap-3 p-4', ROLE_SHADE_CLASSNAME[project.role])}
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 gap-1">
          <Text variant="h4" numberOfLines={1}>
            {project.name}
          </Text>
          <View className="flex-row items-center gap-1.5">
            {project.template === 'fia' && (
              <Icon as={FiaIcon} size={14} className="text-muted-foreground" />
            )}
            <Text className="text-sm text-muted-foreground">
              {project.targetLanguage}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <RoleBadge role={project.role} />
          <Button
            variant="action"
            size="icon-lg"
            onPress={onOpen}
            accessibilityLabel={t('openProject')}
          >
            <Icon
              as={ArrowRightIcon}
              className="text-action-foreground"
              size={22}
            />
          </Button>
        </View>
      </View>

      <DualProgressBar
        translationPct={project.translationPct}
        reviewPct={project.reviewPct}
        baseClassName={ROLE_META[project.role].progressBaseClassName}
        accentClassName={ROLE_META[project.role].progressAccentClassName}
      />
    </Card>
  );
}

// A todo-list row, deliberately plainer than a project Card so the two don't
// read as the same kind of object. Tapping the checkbox checks the item off
// in place; tapping the rest of the row opens the quest for the real work.
// Seeded "done" items let a resuming user see at a glance where they left off.
function TodoRow({
  task,
  isDone,
  onToggleDone,
  onOpen,
  isLast
}: {
  task: (typeof MOCK_TASKS)[number];
  isDone: boolean;
  onToggleDone: () => void;
  onOpen: () => void;
  isLast: boolean;
}) {
  const { t } = useLocalization();
  const book = MOCK_BOOKS[task.book];
  const isTranslate = task.type === 'translate';

  return (
    <View
      className={cn(
        'flex-row items-center gap-3 rounded-lg px-2 py-3',
        !isDone && TASK_TYPE_SHADE_CLASSNAME[task.type],
        !isLast && 'border-b border-border'
      )}
    >
      <Pressable
        onPress={onToggleDone}
        hitSlop={8}
        accessibilityLabel={t('done')}
      >
        <Icon
          as={isDone ? CheckIcon : CircleIcon}
          size={22}
          className={isDone ? 'text-chart-4' : 'text-muted-foreground'}
        />
      </Pressable>

      <Pressable
        onPress={onOpen}
        className="flex-1 flex-row items-center gap-2"
      >
        <Icon as={book.icon} size={16} className="text-muted-foreground" />
        <Text
          className={cn(
            'flex-1',
            isDone && 'text-muted-foreground line-through'
          )}
          numberOfLines={1}
        >
          {book.name} {task.passage}
        </Text>
        <Icon
          as={isTranslate ? MicIcon : MessageCircleIcon}
          size={16}
          className="text-muted-foreground"
        />
      </Pressable>
    </View>
  );
}

export default function MyProjectsDashboardView() {
  const { t } = useLocalization();
  const { currentUser, isAuthenticated } = useAuth();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();

  const [doneTaskIds, setDoneTaskIds] = React.useState(
    () => new Set(MOCK_TASKS.filter((t) => t.done).map((t) => t.id))
  );

  const toggleDone = (taskId: string) => {
    setDoneTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
        showsVerticalScrollIndicator={false}
      >
        {!isAuthenticated || !currentUser ? (
        <Card className="items-center gap-4 p-6">
          <Text className="text-center text-muted-foreground">
            {t('signInToSaveOrContribute')}
          </Text>
          <Button
            variant="action"
            onPress={() => router.push('/(auth)/sign-in')}
            className="w-full"
          >
            <Text className="font-semibold text-action-foreground">
              {t('signIn')}
            </Text>
          </Button>
        </Card>
      ) : (
        <>
          <View className="gap-3">
            {MOCK_PROJECTS.map((project) => (
              <ProjectProgressCard
                key={project.id}
                project={project}
                onOpen={() => router.push(`/(app)/project/${project.id}`)}
              />
            ))}
          </View>

          <View className="rounded-2xl bg-muted/70 px-3">
            {MOCK_TASKS.map((task, i) => (
              <TodoRow
                key={task.id}
                task={task}
                isDone={doneTaskIds.has(task.id)}
                onToggleDone={() => toggleDone(task.id)}
                onOpen={() => router.push(`/(app)/quest-preview/${task.id}`)}
                isLast={i === MOCK_TASKS.length - 1}
              />
            ))}
          </View>
        </>
        )}
      </ScrollView>

      {isAuthenticated && currentUser && (
        <Button
          variant="action"
          size="icon-xl"
          onPress={() => router.push('/(app)/all-projects')}
          accessibilityLabel={t('newProject')}
          className="absolute right-4 rounded-full shadow-lg shadow-foreground/20"
          style={{ bottom: bottom + 16 }}
        >
          <Icon as={PlusIcon} className="text-action-foreground" size={26} />
        </Button>
      )}
    </View>
  );
}
