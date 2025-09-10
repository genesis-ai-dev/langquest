import {
  ToggleGroup,
  ToggleGroupIcon,
  ToggleGroupItem
} from '@/components/ui/toggle-group';
import { useColorScheme } from '@/hooks/useColorScheme';
import { MonitorIcon, MoonStarIcon, SunIcon } from 'lucide-react-native';

export function ThemeToggle() {
  const { stateTheme, setColorScheme } = useColorScheme();
  return (
    <ToggleGroup
      type="single"
      value={stateTheme}
      onValueChange={(value) => {
        if (value) setColorScheme(value as 'light' | 'dark' | 'system');
        else setColorScheme('system');
      }}
      variant="default"
    >
      <ToggleGroupItem value="light" aria-label="Light theme">
        <ToggleGroupIcon as={SunIcon} size={20} />
      </ToggleGroupItem>
      <ToggleGroupItem value="system" aria-label="System theme">
        <ToggleGroupIcon as={MonitorIcon} size={20} />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Dark theme">
        <ToggleGroupIcon as={MoonStarIcon} size={20} />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
