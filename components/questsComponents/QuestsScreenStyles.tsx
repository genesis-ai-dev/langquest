import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { StyleSheet } from 'react-native';

export const QuestsScreenStyles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.medium
  },
  searchIcon: {
    marginRight: spacing.small
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.medium,
    paddingVertical: spacing.medium
  },
  filterIcon: {
    marginLeft: spacing.small,
    padding: spacing.small,
    position: 'relative'
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: colors.primary,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  badgeText: {
    color: colors.buttonText,
    fontSize: fontSizes.small,
    fontWeight: 'bold'
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: spacing.medium,
    width: '100%'
  },
  floatingButtonsContainer: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    gap: spacing.small
  },
  settingsButton: {
    padding: spacing.small
  },
  membersButton: {
    padding: spacing.small
  },
  title: {
    fontSize: fontSizes.xxlarge,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    textAlign: 'center'
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.medium,
    gap: spacing.small
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium,
    borderRadius: borderRadius.medium
  },
  retryButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  },
  questCountContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.medium
  },
  questCountText: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  },
  filterButton: {
    marginLeft: spacing.small,
    padding: spacing.small,
    position: 'relative'
  },
  filterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: colors.primary,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  filterBadgeText: {
    color: colors.buttonText,
    fontSize: fontSizes.small,
    fontWeight: 'bold'
  },
  floatingButton: {
    padding: spacing.small
  }
});
