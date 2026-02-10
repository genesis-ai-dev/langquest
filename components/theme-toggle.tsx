import {
    ToggleGroup,
    ToggleGroupIcon,
    ToggleGroupItem
} from '@/components/ui/toggle-group';
import { useColorScheme } from '@/hooks/useColorScheme';

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
        <ToggleGroupIcon name="sun" size={20} />
      </ToggleGroupItem>
      <ToggleGroupItem value="system" aria-label="System theme">
        <ToggleGroupIcon name="monitor" size={20} />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Dark theme">
        <ToggleGroupIcon name="moon-star" size={20} />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
