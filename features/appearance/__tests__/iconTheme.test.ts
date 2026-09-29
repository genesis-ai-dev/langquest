/// <reference types="jest" />

jest.mock('expo-alternate-app-icons', () => ({
  setAlternateAppIcon: jest.fn(async () => undefined),
  getAppIconName: jest.fn()
}));

import { setAlternateAppIcon } from 'expo-alternate-app-icons';
import { Platform } from 'react-native';

import { applyTheme } from '../iconTheme';

const mockSetAlternateAppIcon = setAlternateAppIcon as jest.MockedFunction<
  typeof setAlternateAppIcon
>;

describe('applyTheme', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    mockSetAlternateAppIcon.mockClear();
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it('maps a theme id to the native alias', async () => {
    await applyTheme('a01');
    expect(mockSetAlternateAppIcon).toHaveBeenCalledWith('ThemeA01');
  });

  it('restores the default icon when theme id is null', async () => {
    await applyTheme(null);
    expect(mockSetAlternateAppIcon).toHaveBeenCalledWith(null);
  });

  it('skips unknown theme ids', async () => {
    await applyTheme('not-a-theme');
    expect(mockSetAlternateAppIcon).not.toHaveBeenCalled();
  });

  it('is a no-op on web', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });
    await applyTheme('a01');
    expect(mockSetAlternateAppIcon).not.toHaveBeenCalled();
  });
});
