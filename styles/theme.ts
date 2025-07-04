import { adjustColor } from '@/utils/colorUtils';
import { StyleSheet } from 'react-native';

const themeColor = 'purple'; // Change this to 'green', 'yellow', or any other color

const getColorHex = (color: string) => {
  const colorMap: Record<string, string> = {
    purpleDark: '#6545B6',
    purple: '#8B5CF6',
    green: '#4CAF50',
    yellow: '#FFEB3B',
    red: '#F44336',
    blue: '#2196F3',
    orange: '#FF9800',
    pink: '#E91E63',
    teal: '#009688',
    cyan: '#00BCD4',
    lime: '#CDDC39',
    indigo: '#3F51B5',
    brown: '#795548',
    grey: '#9E9E9E',
    black: '#000000',
    white: '#FFFFFF'
  };
  return colorMap[color.toLowerCase()] || '#8B5CF6'; // Default to purple if color not found
};

export const colors = {
  primary: getColorHex(themeColor),
  primaryDark: getColorHex(`${themeColor}Dark`),
  primaryLight: adjustColor(getColorHex(themeColor), 30),
  background: '#1E1E1E', // Dark background
  text: '#FFFFFF',
  textSecondary: '#CCCCCC', // Light gray
  inputBackground: 'rgba(255, 255, 255, 0.1)', // Slightly transparent white
  inputText: '#FFFFFF',
  buttonBackground: getColorHex(themeColor),
  buttonText: '#FFFFFF',
  inputBorder: getColorHex(themeColor),
  gradientStart: '#000000',
  gradientEnd: adjustColor(getColorHex(themeColor), -70), // Darken by 50%
  appTitle: adjustColor(getColorHex(themeColor), 130), // Lighten by 30%
  backgroundSecondary: 'rgba(255, 255, 255, 0.05)', // Slightly lighter than background
  accent: adjustColor(getColorHex(themeColor), 30),
  error: '#FF0000',
  disabled: '#999999',
  success: '#16BFC6', // Green color for success state
  alert: '#CA59E5', // purple color for alert state
  downVoted: '#7f6138' // a light brown
};

export const fontSizes = {
  xsmall: 10,
  small: 12,
  medium: 14,
  large: 16,
  xlarge: 20,
  xxlarge: 28,
  xxxlarge: 48
};

export const spacing = {
  xsmall: 4,
  small: 8,
  medium: 16,
  large: 24,
  xlarge: 32,
  xxlarge: 48,
  xxxlarge: 54
};

export const borderRadius = {
  small: 4,
  medium: 16,
  large: 25 // Increased for rounded corners
};

export const sharedStyles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: colors.background,
    padding: spacing.large,
    gap: spacing.medium
  },
  appTitle: {
    fontSize: fontSizes.xxxlarge,
    fontWeight: 'bold',
    color: colors.appTitle,
    marginBottom: spacing.medium,
    textAlign: 'center'
  },
  title: {
    fontSize: fontSizes.xxlarge,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: fontSizes.large,
    color: colors.text,
    marginBottom: spacing.xlarge,
    textAlign: 'center'
  },
  input: {
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.large,
    width: '100%',
    minHeight: 48,
    fontSize: fontSizes.medium
  },
  backButton: {
    position: 'absolute',
    top: spacing.medium,
    left: spacing.medium,
    zIndex: 1
  },
  button: {
    backgroundColor: colors.buttonBackground,
    borderRadius: borderRadius.large,
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.large,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.large,
    minHeight: 48
  },
  buttonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  },
  link: {
    color: colors.primary,
    fontSize: fontSizes.medium
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.small,
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.medium
  },
  cardTitle: {
    color: colors.text,
    fontSize: fontSizes.large,
    fontWeight: 'bold'
  },
  cardDescription: {
    color: colors.text,
    fontSize: fontSizes.medium,
    marginBottom: spacing.small
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  cardInfoText: {
    color: colors.text,
    marginLeft: spacing.small,
    marginRight: spacing.medium
  },
  cardLanguageText: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  },
  iconBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.medium
  },
  iconButton: {
    padding: spacing.small,
    borderRadius: borderRadius.medium
  },
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
  selectedIconButton: {
    borderWidth: 2,
    borderColor: colors.primary
  },
  list: {
    width: '100%'
  },
  filtersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.medium,
    zIndex: 2
  },
  dropdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    width: '80%',
    maxHeight: '80%'
  },
  modalTitle: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.medium
  },
  modalContent: {
    flexGrow: 1,
    marginBottom: spacing.medium
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    alignItems: 'center',
    marginTop: spacing.large
  },
  modalButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  badgeText: {
    color: colors.buttonText,
    fontSize: fontSizes.xsmall,
    fontWeight: 'bold'
  },

  checkboxContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.medium,
    marginBottom: spacing.small
  },
  cardProperty: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.xsmall,
    borderRadius: borderRadius.small,
    overflow: 'hidden'
  }
});
