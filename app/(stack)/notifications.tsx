import { useAuth } from '@/contexts/AuthContext';
import { AuthGuard } from '@/guards/AuthGuard';
import { borderRadius, colors, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type DeepPartial<Thing> = Thing extends Function
  ? Thing
  : Thing extends Array<infer InferrerArrayMember>
    ? DeepPartialArray<InferrerArrayMember>
    : Thing extends object
      ? DeepPartialObject<Thing>
      : Thing | undefined;

interface DeepPartialArray<Thing> extends Array<DeepPartial<Thing>> {}

type DeepPartialObject<Thing> = {
  [Key in keyof Thing]?: DeepPartial<Thing[Key]>;
};

// type InviteRequestNotification = Awaited<
//   ReturnType<typeof notificationService.getAllInviteRequestNotifications>
// >[number];

type InviteRequestNotification = {
  id: string;
  invite_request: {
    sender: {
      id: string;
      username: string;
      avatar: string;
    };
    receiver: {
      id: string;
      username: string;
      avatar: string;
    };
    project: {
      name: string;
      source_language: string;
      target_language: string;
    };
  };
};

export default function Notifications() {
  const { currentUser } = useAuth();
  // const [inviteRequestNotifications, setInviteRequestNotifications] = useState<
  //   Awaited<
  //     ReturnType<typeof notificationService.getAllInviteRequestNotifications>
  //   >
  // >([]);

  const notifications: (
    | (DeepPartial<Omit<InviteRequestNotification, 'id'>> & {
        id: string;
      })
    | string
  )[] = [
    'Invite Requests',
    {
      id: '1',
      invite_request: {
        sender: {
          username: 'sithLordJarJar',
          avatar: 'https://picsum.photos/200/300'
        },
        receiver: {
          id: currentUser?.id!,
          username: currentUser?.username!
        },
        project: {
          name: 'Vocabulario Génesis - Popoluca',
          source_language: 'English',
          target_language: 'French'
        }
      }
    },
    {
      id: '2',
      invite_request: {
        sender: {
          username: 'RayPalp'
        },
        receiver: {
          id: currentUser?.id!,
          username: currentUser?.username!
        },
        project: {
          name: 'Lucas - Zapteco de Santiago',
          source_language: 'French',
          target_language: 'English'
        }
      }
    }
  ];

  // const notifications = useMemo(() => {
  //   return [
  //     'Invite Requests',
  //     ...inviteRequestNotifications.filter(
  //       // Only show notifications that are received
  //       (notification) =>
  //         notification.invite_request?.sender_profile_id === currentUser?.id
  //     )
  //   ];
  // }, [inviteRequestNotifications]);

  const stickyHeaderIndices = notifications
    .map((item, index) => {
      if (typeof item === 'string') {
        return index;
      } else {
        return null;
      }
    })
    .filter((item) => item !== null) as number[];

  // useEffect(() => {
  //   if (!currentUser) return;
  //   const loadNotifications = async () => {
  //     const notifications =
  //       await notificationService.getAllInviteRequestNotifications(
  //         currentUser.id
  //       );
  //     setInviteRequestNotifications(notifications);
  //   };
  //   loadNotifications();
  // }, [currentUser]);

  return (
    <AuthGuard>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1, paddingHorizontal: spacing.medium }}>
          <Text style={sharedStyles.title}>Notifications</Text>
          <FlashList
            data={notifications}
            stickyHeaderIndices={stickyHeaderIndices}
            getItemType={(item) => {
              // To achieve better performance, specify the type based on the item
              return typeof item === 'string' ? 'sectionHeader' : 'row';
            }}
            renderItem={({ item }) => {
              if (typeof item === 'string') {
                // Rendering header
                return <Text style={sharedStyles.cardTitle}>{item}</Text>;
              } else {
                // Render item
                return <InviteRequestNotification inviteRequest={item} />;
              }
            }}
            keyExtractor={(item) => (typeof item === 'string' ? item : item.id)}
            estimatedItemSize={200}
          />
        </SafeAreaView>
      </LinearGradient>
    </AuthGuard>
  );
}

function InviteRequestNotification({
  inviteRequest
}: {
  inviteRequest: DeepPartial<InviteRequestNotification>;
}) {
  return (
    <View style={styles.notificationContainer}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.small
        }}
      >
        <View style={styles.avatar} />
        <Text style={{ color: colors.text }}>
          {inviteRequest.invite_request?.sender?.username}{' '}
          <Text style={{ color: colors.textSecondary }}>
            wants you to join project
          </Text>
        </Text>
      </View>
      <View style={styles.callout}>
        <Text style={{ color: colors.text }}>
          {inviteRequest.invite_request?.project?.name}
        </Text>
        <Text
          style={{
            color: colors.textSecondary
          }}
        >
          {inviteRequest.invite_request?.project?.source_language}{' '}
          <Ionicons name="arrow-forward" />{' '}
          {inviteRequest.invite_request?.project?.target_language}
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row-reverse',
          gap: spacing.small
        }}
      >
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          <Text style={{ color: colors.text }}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.inputBackground }]}
        >
          <Text style={{ color: colors.text }}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notificationContainer: {
    backgroundColor: colors.inputBackground,
    padding: spacing.medium,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.small,
    gap: spacing.small
  },
  avatar: {
    width: spacing.large,
    height: spacing.large,
    borderRadius: spacing.large,
    backgroundColor: colors.text
  },
  callout: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.medium,
    color: colors.text,
    padding: spacing.medium,
    gap: spacing.small
  },
  button: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.small,
    color: colors.text,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small
  }
});
