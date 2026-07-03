import { decode, encode } from '../codec';
import { getThemeProfiles } from '../profiles.data';

describe('codec', () => {
  it('round-trips ascii text', () => {
    const samples = ['', 'a', 'Widget', 'Sample', '12345', 'A quick line.'];
    for (const s of samples) {
      expect(decode(encode(s))).toBe(s);
    }
  });

  it('round-trips json payloads', () => {
    const payload = JSON.stringify([{ id: 'a01', n: 1 }, { id: 'b05', n: 5 }]);
    expect(decode(encode(payload))).toBe(payload);
  });

  it('does not leak plaintext in the encoded form', () => {
    const secret = 'SensitiveWord';
    expect(encode(secret)).not.toContain(secret);
  });
});

describe('profiles manifest', () => {
  it('decodes to ten profiles across two families', () => {
    const profiles = getThemeProfiles();
    expect(profiles).toHaveLength(10);
    expect(profiles.filter((p) => p.family === 'A')).toHaveLength(5);
    expect(profiles.filter((p) => p.family === 'B')).toHaveLength(5);
  });

  it('maps ids to alias names consistently', () => {
    const profiles = getThemeProfiles();
    expect(profiles.map((p) => p.id)).toEqual([
      'a01',
      'a02',
      'a03',
      'a04',
      'a05',
      'b01',
      'b02',
      'b03',
      'b04',
      'b05'
    ]);
    expect(profiles.find((p) => p.id === 'a01')?.aliasName).toBe('ThemeA01');
    expect(profiles.find((p) => p.id === 'b05')?.aliasName).toBe('ThemeB05');
  });

  it('carries a decoded, human-readable label per family', () => {
    const profiles = getThemeProfiles();
    const a = profiles.find((p) => p.family === 'A');
    const b = profiles.find((p) => p.family === 'B');
    expect(a?.label && a.label.length).toBeGreaterThan(0);
    expect(b?.label && b.label.length).toBeGreaterThan(0);
  });
});
