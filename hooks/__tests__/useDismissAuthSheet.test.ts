/// <reference types="jest" />

import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { act, renderHook } from '@testing-library/react-native';
import { useDismissAuthSheet } from '../useDismissAuthSheet';

const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockGetParent = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn()
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn()
}));

const useNavigationMock = useNavigation as jest.MockedFunction<
  typeof useNavigation
>;
const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;

describe('useDismissAuthSheet', () => {
  beforeEach(() => {
    mockGoBack.mockReset();
    mockCanGoBack.mockReset();
    mockGetParent.mockReset();
    mockReplace.mockReset();
    useNavigationMock.mockReturnValue({
      getParent: mockGetParent
    } as ReturnType<typeof useNavigation>);
    useRouterMock.mockReturnValue({
      replace: mockReplace
    } as unknown as ReturnType<typeof useRouter>);
  });

  it('dismisses the parent auth sheet when it can go back', async () => {
    mockCanGoBack.mockReturnValue(true);
    mockGetParent.mockReturnValue({
      canGoBack: mockCanGoBack,
      goBack: mockGoBack
    });

    const { result } = await renderHook(() => useDismissAuthSheet());
    await act(() => {
      result.current.dismissAuthSheet();
    });

    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('replaces to home when the parent sheet cannot go back', async () => {
    mockCanGoBack.mockReturnValue(false);
    mockGetParent.mockReturnValue({
      canGoBack: mockCanGoBack,
      goBack: mockGoBack
    });

    const { result } = await renderHook(() => useDismissAuthSheet());
    await act(() => {
      result.current.dismissAuthSheet();
    });

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('replaces to home when there is no parent navigator', async () => {
    mockGetParent.mockReturnValue(undefined);

    const { result } = await renderHook(() => useDismissAuthSheet());
    await act(() => {
      result.current.dismissAuthSheet();
    });

    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
