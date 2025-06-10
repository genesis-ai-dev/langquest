import { useNotifications } from '@/hooks/useNotifications';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

export function PageHeader({
  title,
  showBackButton = true
}: {
  title: string;
  showBackButton?: boolean;
}) {
  const navigation = useNavigation();
  const { notificationCount } = useNotifications();

  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.small
      }}
    >
      {showBackButton && (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={32} color={colors.text} />
        </TouchableOpacity>
      )}
      <Text
        style={{
          ...sharedStyles.title,
          textAlign: 'left',
          verticalAlign: 'middle',
          flex: 1
        }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {title}
      </Text>
      <TouchableOpacity
        onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
        style={{ position: 'relative' }}
      >
        <Ionicons
          name="menu-outline"
          size={32}
          style={{
            color: colors.text
          }}
        />
        {notificationCount > 0 && (
          <View style={sharedStyles.badge}>
            <Text style={sharedStyles.badgeText}>
              {notificationCount > 99 ? '99+' : notificationCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}
