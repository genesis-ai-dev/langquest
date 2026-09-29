/// <reference types="jest" />

import { isImportedAsset } from '../assetProvenance';
import { escapeCsvField } from '../backupUtils';
import { adjustColor } from '../colorUtils';
import { normalizeUuid, toDashedUuid } from '../uuidUtils';

describe('normalizeUuid', () => {
  it('strips dashes and stringifies numbers', () => {
    expect(normalizeUuid('33988c3f-b7aa-d765-5395-24f653362c48')).toBe(
      '33988c3fb7aad765539524f653362c48'
    );
    expect(normalizeUuid(12345)).toBe('12345');
  });

  it('returns an empty string for nullish values', () => {
    expect(normalizeUuid(undefined)).toBe('');
    expect(normalizeUuid(null)).toBe('');
  });
});

describe('toDashedUuid', () => {
  it('restores dashed form from a compact hex uuid', () => {
    expect(toDashedUuid('33988c3fb7aad765539524f653362c48')).toBe(
      '33988c3f-b7aa-d765-5395-24f653362c48'
    );
    expect(toDashedUuid('33988c3f-b7aa-d765-5395-24f653362c48')).toBe(
      '33988c3f-b7aa-d765-5395-24f653362c48'
    );
  });

  it('passes through non-uuid values', () => {
    expect(toDashedUuid('abc')).toBe('abc');
    expect(toDashedUuid(12)).toBe('12');
    expect(toDashedUuid(null)).toBe('');
  });
});

describe('adjustColor', () => {
  it('lightens and darkens a hex color and clamps channels', () => {
    expect(adjustColor('#808080', 0)).toBe('#808080');
    expect(adjustColor('808080', 100)).toBe('#ffffff');
    expect(adjustColor('#808080', -100)).toBe('#000000');
  });
});

describe('escapeCsvField', () => {
  it('returns empty for nullish values and leaves plain text alone', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
    expect(escapeCsvField('hello')).toBe('hello');
  });

  it('quotes fields that contain commas, quotes, or newlines', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('line\nbreak')).toBe('"line\nbreak"');
  });
});

describe('isImportedAsset', () => {
  it('detects imported provenance on objects and JSON strings', () => {
    expect(isImportedAsset({ provenance: { type: 'imported' } })).toBe(true);
    expect(
      isImportedAsset(JSON.stringify({ provenance: { type: 'imported' } }))
    ).toBe(true);
  });

  it('rejects other provenance, invalid JSON, and non-objects', () => {
    expect(isImportedAsset({ provenance: { type: 'recorded' } })).toBe(false);
    expect(isImportedAsset('not-json')).toBe(false);
    expect(isImportedAsset(null)).toBe(false);
    expect(isImportedAsset(12)).toBe(false);
  });
});
