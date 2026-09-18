import { collectAudioValues } from '@/utils/collectAudioValues';

describe('collectAudioValues', () => {
  it('reads string arrays', () => {
    expect(
      collectAudioValues([{ audio: ['a.m4a', 'b.m4a'] }, { audio: [] }])
    ).toEqual(['a.m4a', 'b.m4a']);
  });

  it('parses JSON audio strings from the cloud', () => {
    expect(
      collectAudioValues([{ audio: '["clip.m4a"]' }, { audio: 'not-json' }])
    ).toEqual(['clip.m4a', 'not-json']);
  });

  it('skips empty values', () => {
    expect(collectAudioValues([{ audio: null }, { audio: [''] }])).toEqual([]);
  });
});
