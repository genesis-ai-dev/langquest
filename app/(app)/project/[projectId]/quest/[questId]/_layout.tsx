import { DEFAULT_STACK_OPTIONS } from '@/app/_layout';
import { Stack } from 'expo-router';

export default function QuestLayout() {
  return <Stack screenOptions={DEFAULT_STACK_OPTIONS} />;
}
