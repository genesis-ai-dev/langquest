import { useColorScheme } from '@/hooks/useColorScheme';
import { setAndroidNavigationBar } from '@/lib/android-navigation-bar';
import { MoonStar } from '@/lib/icons/MoonStar';
import { Sun } from '@/lib/icons/Sun';
import { cn } from '@/lib/utils';
import { View } from 'react-native';
import { Button } from './ui/button';

export function ThemeToggle() {
  const { isDarkColorScheme, setColorScheme } = useColorScheme();

  function toggleColorScheme() {
    const newTheme = isDarkColorScheme ? 'light' : 'dark';
    setColorScheme(newTheme);
    void setAndroidNavigationBar(newTheme);
  }

  return (
    <Button onPress={toggleColorScheme} variant="outline" size="icon">
      {({ pressed }) => (
        <View
          className={cn(
            'flex-1 justify-center items-start',
            pressed && 'opacity-70'
          )}
        >
          {isDarkColorScheme ? (
            <MoonStar className="text-muted-foreground" size={20} />
          ) : (
            <Sun className="text-muted-foreground" size={20} />
          )}
        </View>
      )}
    </Button>
  );
}
