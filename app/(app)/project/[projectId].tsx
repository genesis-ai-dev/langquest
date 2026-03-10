import ProjectDirectoryView from '@/views/new/ProjectDirectoryView';
import { Stack } from 'expo-router';

export default function ProjectRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Project' }} />
      <ProjectDirectoryView />
    </>
  );
}
