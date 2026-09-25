/// <reference types="jest" />

import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseQuestMetadata } from '../questMetadata';
import {
  allocateQuestVersionLabel,
  formatQuestDisplayLabel,
  getQuestVersionLabel,
  withQuestVersionLabel
} from '../questVersionLabel';

describe('parseQuestMetadata', () => {
  it('returns an empty object for missing or invalid input', () => {
    expect(parseQuestMetadata(null)).toEqual({});
    expect(parseQuestMetadata(undefined)).toEqual({});
    expect(parseQuestMetadata('not-json')).toEqual({});
    expect(parseQuestMetadata(12)).toEqual({});
  });

  it('parses a JSON string or object', () => {
    expect(parseQuestMetadata('{"versionLabel":"#1"}')).toEqual({
      versionLabel: '#1'
    });
    expect(parseQuestMetadata({ versionLabel: '#2' })).toEqual({
      versionLabel: '#2'
    });
  });
});

describe('getQuestVersionLabel', () => {
  it('returns a trimmed label or null', () => {
    expect(getQuestVersionLabel({ versionLabel: ' #3 ' })).toBe('#3');
    expect(getQuestVersionLabel({ versionLabel: '   ' })).toBeNull();
    expect(getQuestVersionLabel({})).toBeNull();
  });
});

describe('formatQuestDisplayLabel', () => {
  it('appends a version label when present', () => {
    expect(formatQuestDisplayLabel('Genesis 1', { versionLabel: '#1' })).toBe(
      'Genesis 1 · #1'
    );
  });

  it('falls back to Quest when the name is empty', () => {
    expect(formatQuestDisplayLabel(null, {})).toBe('Quest');
    expect(formatQuestDisplayLabel('  ', { versionLabel: '#2' })).toBe(
      'Quest · #2'
    );
  });
});

describe('withQuestVersionLabel', () => {
  it('sets versionLabel without dropping other metadata', () => {
    expect(withQuestVersionLabel({ allowImportAssets: true }, '#4')).toEqual({
      allowImportAssets: true,
      versionLabel: '#4'
    });
  });
});

describe('allocateQuestVersionLabel', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts at #1 and increments per project/book/segment', async () => {
    await expect(allocateQuestVersionLabel('p1', 'gen', 1)).resolves.toBe('#1');
    await expect(allocateQuestVersionLabel('p1', 'gen', 1)).resolves.toBe('#2');
    await expect(allocateQuestVersionLabel('p1', 'gen', 2)).resolves.toBe('#1');
  });

  it('treats a non-numeric stored counter as #1', async () => {
    await AsyncStorage.setItem('@quest_version_counter:p1:gen:1', 'nope');
    await expect(allocateQuestVersionLabel('p1', 'gen', 1)).resolves.toBe('#1');
  });

  it('falls back to #1 when AsyncStorage throws', async () => {
    const getItem = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('disk full'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(allocateQuestVersionLabel('p1', 'gen', 1)).resolves.toBe('#1');
    expect(error).toHaveBeenCalled();
    getItem.mockRestore();
    error.mockRestore();
  });
});
