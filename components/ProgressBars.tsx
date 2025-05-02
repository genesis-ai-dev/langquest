import { GemIcon } from '@/components/GemIcon';
import { PickaxeCount } from '@/components/PickaxeCount';
import { colors, spacing } from '@/styles/theme';
import { StyleSheet, View } from 'react-native';

interface ProgressBarsProps {
  approvedPercentage: number;
  userContributedPercentage: number;
  progressBarHeight?: number;
  pickaxeCount?: number;
}

export const ProgressBars = ({
  approvedPercentage,
  userContributedPercentage,
  progressBarHeight = 30,
  pickaxeCount
}: ProgressBarsProps) => {
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.small }}
    >
      <View
        style={[
          styles.progressContainer,
          {
            height: progressBarHeight,
            flex: 1,
            borderRadius: progressBarHeight / 2
          }
        ]}
      >
        <View
          style={[
            styles.progressBarContainer,
            { borderRadius: progressBarHeight / 2 }
          ]}
        >
          <View
            style={[
              styles.progressBar,
              styles.approvedBar,
              {
                width: `${approvedPercentage}%`,
                alignItems: 'flex-end',
                justifyContent: 'center',
                borderRadius: progressBarHeight / 2,
                zIndex: 2
              }
            ]}
          >
            <GemIcon
              color={colors.textSecondary}
              width={progressBarHeight / 1.5}
              height={progressBarHeight / 1.5}
              style={{ marginRight: 10 }}
            />
          </View>
          {/* User's pending translations progress bar */}
          <View
            style={[
              styles.progressBar,
              styles.userPendingBar,
              {
                width: `${userContributedPercentage}%`,
                borderRadius: progressBarHeight / 2,
                marginLeft: -20,
                alignItems: 'flex-end',
                justifyContent: 'center',
                zIndex: 1
              }
            ]}
          >
            <GemIcon
              color={colors.background}
              width={progressBarHeight / 1.5}
              height={progressBarHeight / 1.5}
              style={{ marginRight: 10 }}
            />
          </View>
        </View>
      </View>
      {typeof pickaxeCount === 'number' && pickaxeCount > 0 && (
        <PickaxeCount count={pickaxeCount} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.small,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.background
  },
  progressBarContainer: {
    flex: 1,
    height: '100%',
    backgroundColor: colors.inputBackground,
    overflow: 'hidden',
    flexDirection: 'row'
  },
  progressBar: {
    height: '100%'
  },
  approvedBar: {
    backgroundColor: colors.success
  },
  userPendingBar: {
    backgroundColor: colors.textSecondary
  }
});
