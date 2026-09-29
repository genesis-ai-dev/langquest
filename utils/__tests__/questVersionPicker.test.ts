/// <reference types="jest" />

import { shouldOpenQuestVersionPicker } from '../questVersionPicker';

describe('shouldOpenQuestVersionPicker', () => {
  it('never opens when there are no versions', () => {
    expect(shouldOpenQuestVersionPicker(true, 0)).toBe(false);
    expect(shouldOpenQuestVersionPicker(false, 0)).toBe(false);
  });

  it('opens for members even with a single version', () => {
    expect(shouldOpenQuestVersionPicker(true, 1)).toBe(true);
  });

  it('skips the picker for non-members with a single version', () => {
    expect(shouldOpenQuestVersionPicker(false, 1)).toBe(false);
  });

  it('opens for anyone when multiple versions exist', () => {
    expect(shouldOpenQuestVersionPicker(false, 2)).toBe(true);
    expect(shouldOpenQuestVersionPicker(true, 2)).toBe(true);
  });
});
