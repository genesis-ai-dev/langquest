import { colors, sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

export function PageHeader({ title }: { title: string }) {
  const navigation = useNavigation();
  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center'
      }}
    >
      <TouchableOpacity
        onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
      >
        <Ionicons
          name="menu-outline"
          size={32}
          style={{
            color: colors.text
          }}
        />
      </TouchableOpacity>
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
    </View>
  );
}
