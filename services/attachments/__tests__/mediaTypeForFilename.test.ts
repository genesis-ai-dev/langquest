/// <reference types="jest" />

import { mediaTypeForFilename } from '../AudioUploader';

describe('mediaTypeForFilename', () => {
  it('maps known audio extensions', () => {
    expect(mediaTypeForFilename('take.m4a')).toBe('audio/mp4');
    expect(mediaTypeForFilename('take.MP3')).toBe('audio/mpeg');
    expect(mediaTypeForFilename('take.wav')).toBe('audio/wav');
    expect(mediaTypeForFilename('take.webm')).toBe('audio/webm');
  });

  it('falls back for unknown or missing extensions', () => {
    expect(mediaTypeForFilename('take.bin')).toBe('application/octet-stream');
    expect(mediaTypeForFilename('take')).toBe('application/octet-stream');
  });
});
