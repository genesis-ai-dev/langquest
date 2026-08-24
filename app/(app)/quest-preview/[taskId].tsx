import QuestWorkView from '@/views/new/QuestWorkView';
import { findTask } from '@/views/new/questMockData';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/text';
import { View } from 'react-native';

export default function QuestPreviewRoute() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const task = findTask(taskId);

  if (!task) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-muted-foreground">Quest not found</Text>
      </View>
    );
  }

  return <QuestWorkView task={task} />;
}
