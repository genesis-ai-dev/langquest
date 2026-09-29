/// <reference types="jest" />

jest.mock('nativewind', () => ({
  colorScheme: {
    set: jest.fn(),
    get: jest.fn(() => 'light')
  }
}));

jest.spyOn(console, 'log').mockImplementation(() => {});

import { useSessionStore } from '../localStore';

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({ unlocked: false });
  });

  it('starts locked and unlocks for the current session only', () => {
    expect(useSessionStore.getState().unlocked).toBe(false);
    useSessionStore.getState().unlock();
    expect(useSessionStore.getState().unlocked).toBe(true);
  });
});
