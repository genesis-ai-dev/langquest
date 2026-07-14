import {
  keypadCandidates,
  noteCandidates,
  normalizeKeypadInput
} from '../matchSequence';

describe('normalizeKeypadInput', () => {
  it('keeps only digits and caps length', () => {
    expect(normalizeKeypadInput('12+34')).toBe('1234');
    expect(normalizeKeypadInput('a1b2c3')).toBe('123');
    expect(normalizeKeypadInput('1234567890123456')).toHaveLength(12);
  });
});

describe('keypadCandidates', () => {
  it('returns trailing windows longest first', () => {
    expect(keypadCandidates('9871234', 4, 6)).toEqual([
      '871234',
      '71234',
      '1234'
    ]);
  });

  it('returns empty when shorter than the minimum', () => {
    expect(keypadCandidates('12', 4, 12)).toEqual([]);
  });

  it('ignores operator characters when forming candidates', () => {
    expect(keypadCandidates('12+34', 4, 4)).toEqual(['1234']);
  });
});

describe('noteCandidates', () => {
  it('splits into trimmed non-empty lines', () => {
    expect(noteCandidates('grocery list\n  1234  \n\nmilk')).toEqual([
      'grocery list',
      '1234',
      'milk'
    ]);
  });

  it('handles crlf newlines', () => {
    expect(noteCandidates('a\r\nb')).toEqual(['a', 'b']);
  });
});
