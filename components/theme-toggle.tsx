import {
  ToggleGroup,
  ToggleGroupIcon,
  ToggleGroupItem
} from '@/components/ui/toggle-group';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Monitor } from '@/lib/icons/Monitor';
import { MoonStar } from '@/lib/icons/MoonStar';
import { Sun } from '@/lib/icons/Sun';

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
        <ToggleGroupIcon icon={Sun} size={20} />
      </ToggleGroupItem>
      <ToggleGroupItem value="system" aria-label="System theme">
        <ToggleGroupIcon icon={Monitor} size={20} />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Dark theme">
        <ToggleGroupIcon icon={MoonStar} size={20} />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
