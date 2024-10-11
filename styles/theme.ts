import { StyleSheet } from 'react-native';
import { adjustColor } from '@/utils/colorUtils';

const themeColor = 'green'; // Change this to 'green', 'yellow', or any other color

const getColorHex = (color: string) => {
  const colorMap: { [key: string]: string } = {
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
    white: '#FFFFFF',
  };
  return colorMap[color.toLowerCase()] || '#8B5CF6'; // Default to purple if color not found
};

export const colors = {
    primary: getColorHex(themeColor),
    background: '#1E1E1E', // Dark background
    text: '#FFFFFF',
    inputBackground: 'rgba(255, 255, 255, 0.1)', // Slightly transparent white
    inputText: '#FFFFFF',
    buttonBackground: getColorHex(themeColor),
    buttonText: '#FFFFFF',
    inputBorder: getColorHex(themeColor),
    gradientStart: '#000000',
    gradientEnd: adjustColor(getColorHex(themeColor), -70), // Darken by 50%
    appTitle: adjustColor(getColorHex(themeColor), 130), // Lighten by 30%
  };
  

export const fontSizes = {
  small: 12,
  medium: 14,
  large: 16,
  xlarge: 20,
  xxlarge: 28,
  xxxlarge: 48,
};

export const spacing = {
  xsmall: 4,
  small: 8,
  medium: 16,
  large: 24,
  xlarge: 32,
  xxlarge: 48,
};

export const borderRadius = {
  small: 4,
  medium: 16,
  large: 25, // Increased for rounded corners
};

export const sharedStyles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: colors.background,
    padding: spacing.large,
  },
  appTitle: {
    fontSize: fontSizes.xxxlarge,
    fontWeight: 'bold',
    color: colors.appTitle,
    marginBottom: spacing.medium,
    textAlign: 'center',
  },
  title: {
    fontSize: fontSizes.xxlarge,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.medium,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSizes.large,
    color: colors.text,
    marginBottom: spacing.xlarge,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.large,
    marginBottom: spacing.medium,
    width: '100%',
    minHeight: 48,
    fontSize: fontSizes.medium,
  },
  button: {
    backgroundColor: colors.buttonBackground,
    borderRadius: borderRadius.large,
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.large,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.large,
    minHeight: 48,
  },
  buttonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
  },
  link: {
    color: colors.primary,
    fontSize: fontSizes.medium,
  },
  card: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.medium,
  },
  cardTitle: {
    color: colors.text,
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    marginBottom: spacing.small,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfoText: {
    color: colors.text,
    marginLeft: spacing.small,
    marginRight: spacing.medium,
  },
  cardLanguageText: {
    color: colors.text,
    fontSize: fontSizes.small,
    marginTop: spacing.small,
  },
  iconBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.medium,
  },
  iconButton: {
    padding: spacing.small,
    borderRadius: borderRadius.medium,
  },
  selectedIconButton: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  list: {
    width: '100%',
  },
  // Filter styles
//   filtersContainer: {
//     marginBottom: spacing.medium,
//     backgroundColor: colors.background,
//     borderRadius: borderRadius.medium,
//     padding: spacing.medium,
//   },
filtersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.medium,
    zIndex: 2,
  },
  dropdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
  },
  dropdownContainer: {
    flex: 1,
    marginRight: spacing.small,
    zIndex: 1,
  },
  dropdownLabel: {
    color: colors.text,
    marginBottom: spacing.xsmall,
  },
  dropdown: {
    backgroundColor: colors.background,
    color: colors.inputText,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.small,
    width: '100%',
    minHeight: 40,
    fontSize: fontSizes.medium,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    color: colors.text,
    fontSize: fontSizes.medium,
  },
  optionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderRadius: borderRadius.medium,
    marginTop: spacing.xsmall,
    zIndex: 3,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    elevation: 5, // Add elevation for Android
    shadowColor: '#000', // Add shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  option: {
    padding: spacing.small,
    borderBottomWidth: 1,
    // borderBottomColor: colors.inputBorder,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.background, // Add solid background color
  },
  optionText: {
    color: colors.text,
    fontSize: fontSizes.medium,
  },
});