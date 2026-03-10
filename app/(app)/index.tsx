import NextGenProjectsView from '@/views/new/NextGenProjectsView';
import { Stack } from 'expo-router';

export default function ProjectsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Projects' }} />
      <NextGenProjectsView />
    </>
  );
}
