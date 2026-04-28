import RecordingView from '@/views/new/RecordingView';
import { useIsFocused } from '@react-navigation/native';

export default function RecordingRoute() {
  const isFocused = useIsFocused();
  if (!isFocused) return null;
  return <RecordingView />;
}
