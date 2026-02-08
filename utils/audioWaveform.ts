/**
 * Extract waveform amplitude data from audio files.
 *
 * WAV files:  Reads raw PCM samples, divides into `barCount` windows,
 *             computes RMS amplitude, and returns normalised 0–1 values.
 *
 * M4A files:  Uses the native audio decoder (iOS/Android) to extract real
 *             PCM samples and compute RMS amplitudes. This avoids heuristics
 *             based on compressed frame sizes and produces meaningful waveforms.
 */

import MicrophoneEnergyModule from '@/modules/microphone-energy';
import { readFile } from '@/utils/fileUtils';

// ---------------------------------------------------------------------------
// WAV parser helpers
// ---------------------------------------------------------------------------

interface WavInfo {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
  /** Byte offset where audio sample data starts */
  dataOffset: number;
  /** Length in bytes of the audio sample data */
  dataLength: number;
}

function parseWavHeader(buffer: ArrayBuffer): WavInfo {
  const view = new DataView(buffer);

  // Verify RIFF header
  const riff =
    String.fromCharCode(view.getUint8(0)) +
    String.fromCharCode(view.getUint8(1)) +
    String.fromCharCode(view.getUint8(2)) +
    String.fromCharCode(view.getUint8(3));
  if (riff !== 'RIFF') {
    throw new Error('Not a valid WAV file (missing RIFF header)');
  }

  const wave =
    String.fromCharCode(view.getUint8(8)) +
    String.fromCharCode(view.getUint8(9)) +
    String.fromCharCode(view.getUint8(10)) +
    String.fromCharCode(view.getUint8(11));
  if (wave !== 'WAVE') {
    throw new Error('Not a valid WAV file (missing WAVE identifier)');
  }

  let numChannels = 1;
  let sampleRate = 44100;
  let bitsPerSample = 16;
  let dataOffset = 0;
  let dataLength = 0;

  // Walk through chunks
  let offset = 12;
  while (offset < buffer.byteLength - 8) {
    const chunkId =
      String.fromCharCode(view.getUint8(offset)) +
      String.fromCharCode(view.getUint8(offset + 1)) +
      String.fromCharCode(view.getUint8(offset + 2)) +
      String.fromCharCode(view.getUint8(offset + 3));
    const chunkSize = view.getUint32(offset + 4, true); // little-endian

    if (chunkId === 'fmt ') {
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataLength = chunkSize;
      break; // found what we need
    }

    // Advance to next chunk (chunk header is 8 bytes + chunkSize, padded to even)
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (dataOffset === 0 || dataLength === 0) {
    throw new Error('WAV file missing data chunk');
  }

  return { numChannels, sampleRate, bitsPerSample, dataOffset, dataLength };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract waveform data from a local audio file URI.
 * Supports WAV files (direct parsing) and M4A/other formats (via Expo AV sampling).
 *
 * @param uri  Local file URI (file:// or OPFS path)
 * @param barCount  Number of amplitude bars to return (default 128)
 * @returns Array of normalised amplitudes (0–1), length === barCount
 */
export async function extractWaveformFromFile(
  uri: string,
  barCount = 128
): Promise<number[]> {
  // Try to read as WAV first
  try {
    const buffer = await readFile(uri);
    return extractWaveformFromBuffer(buffer, barCount);
  } catch (error) {
    // If WAV parsing fails, try to extract from M4A/other formats using Expo AV
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('RIFF header') || errorMessage.includes('WAV file')) {
      // Not a WAV file - try M4A/other format extraction
      return await extractWaveformFromAudioFile(uri, barCount);
    }
    // Re-throw if it's a different error (file not found, etc.)
    throw error;
  }
}

// ---------------------------------------------------------------------------
// MPEG-4 / M4A container parser
// ---------------------------------------------------------------------------

/** Read a 4-character box type at the given byte offset. */
function readBoxType(view: DataView, offset: number): string {
  return (
    String.fromCharCode(view.getUint8(offset)) +
    String.fromCharCode(view.getUint8(offset + 1)) +
    String.fromCharCode(view.getUint8(offset + 2)) +
    String.fromCharCode(view.getUint8(offset + 3))
  );
}

/** Describes one MPEG-4 box with resolved offset / size. */
interface Mp4Box {
  type: string;
  headerSize: number;
  /** Byte offset of the box DATA (after header). */
  dataOffset: number;
  /** Size of the box DATA in bytes. */
  dataSize: number;
  /** Total box size (header + data). */
  totalSize: number;
}

/** Iterate all top-level boxes in a byte range and yield each one. */
function* iterateBoxes(
  view: DataView,
  searchOffset: number,
  searchEnd: number
): Generator<Mp4Box> {
  let offset = searchOffset;

  while (offset < searchEnd - 8) {
    const boxSize = view.getUint32(offset, false); // big-endian
    const boxType = readBoxType(view, offset + 4);

    let actualSize = boxSize;
    let headerSize = 8;

    if (boxSize === 0) {
      actualSize = searchEnd - offset; // extends to end
    } else if (boxSize === 1) {
      if (offset + 16 > searchEnd) break;
      actualSize = view.getUint32(offset + 12, false); // lower 32 bits of 64-bit size
      headerSize = 16;
    }

    if (actualSize < headerSize || offset + actualSize > searchEnd) {
      break; // corrupt / invalid box
    }

    yield {
      type: boxType,
      headerSize,
      dataOffset: offset + headerSize,
      dataSize: actualSize - headerSize,
      totalSize: actualSize,
    };

    offset += actualSize;
  }
}

/**
 * Find a single child box of the given type inside a parent range.
 */
function findChildBox(
  view: DataView,
  parentDataOffset: number,
  parentDataSize: number,
  childType: string
): Mp4Box | null {
  for (const box of iterateBoxes(view, parentDataOffset, parentDataOffset + parentDataSize)) {
    if (box.type === childType) return box;
  }
  return null;
}

/**
 * Check if a `trak` box is an audio track by inspecting mdia → hdlr.
 * The handler type at byte offset 8 inside hdlr data should be 'soun'.
 */
function isAudioTrack(view: DataView, trakDataOffset: number, trakDataSize: number): boolean {
  const mdia = findChildBox(view, trakDataOffset, trakDataSize, 'mdia');
  if (!mdia) return false;

  const hdlr = findChildBox(view, mdia.dataOffset, mdia.dataSize, 'hdlr');
  if (!hdlr || hdlr.dataSize < 12) return false;

  // hdlr data: version(1) + flags(3) + pre_defined(4) + handler_type(4)
  // handler_type is at offset 8 from data start
  const handlerType = readBoxType(view, hdlr.dataOffset + 8);
  return handlerType === 'soun';
}

/**
 * Navigate down a path of nested boxes from a starting range.
 * Returns the innermost box, or null if any step fails.
 */
function findBoxPath(
  view: DataView,
  path: string[],
  startOffset: number,
  endOffset: number
): Mp4Box | null {
  let currentOffset = startOffset;
  let currentEnd = endOffset;

  for (let i = 0; i < path.length; i++) {
    const target = path[i]!;
    const box = findChildBox(view, currentOffset, currentEnd - currentOffset, target);
    if (!box) return null;

    if (i < path.length - 1) {
      // Enter this container box
      let childStart = box.dataOffset;
      // 'meta' has a 4-byte version/flags prefix before children
      if (box.type === 'meta') childStart += 4;
      currentOffset = childStart;
      currentEnd = box.dataOffset + box.dataSize;
    } else {
      return box;
    }
  }
  return null;
}

/**
 * Find the `stsz` box for the audio track specifically.
 * Iterates all `trak` boxes inside `moov` and picks the one whose
 * `mdia/hdlr` handler type is 'soun' (sound/audio).
 */
function findAudioStsz(
  view: DataView,
  bufferLength: number
): Mp4Box | null {
  // Find moov box
  const moov = findChildBox(view, 0, bufferLength, 'moov');
  if (!moov) return null;

  // Iterate all trak boxes inside moov
  for (const trak of iterateBoxes(view, moov.dataOffset, moov.dataOffset + moov.dataSize)) {
    if (trak.type !== 'trak') continue;

    // Check if this is the audio track
    if (!isAudioTrack(view, trak.dataOffset, trak.dataSize)) continue;

    // Navigate: mdia → minf → stbl → stsz
    const stsz = findBoxPath(
      view,
      ['mdia', 'minf', 'stbl', 'stsz'],
      trak.dataOffset,
      trak.dataOffset + trak.dataSize
    );

    if (stsz) return stsz;
  }

  return null;
}

/**
 * Parse the `stsz` (Sample Size) box to get individual frame sizes.
 *
 * stsz format:
 *   - 1 byte version + 3 bytes flags
 *   - 4 bytes: uniform sample_size (0 = sizes vary per sample)
 *   - 4 bytes: sample_count
 *   - If sample_size == 0: sample_count × 4-byte entries
 */
function parseStszBox(
  view: DataView,
  dataOffset: number,
  dataSize: number
): number[] {
  if (dataSize < 12) {
    throw new Error('stsz box too small');
  }

  const uniformSize = view.getUint32(dataOffset + 4, false);
  const sampleCount = view.getUint32(dataOffset + 8, false);

  if (sampleCount === 0) return [];

  const sizes: number[] = new Array<number>(sampleCount);

  if (uniformSize !== 0) {
    // CBR — all frames same size → flat waveform (best we can do)
    for (let i = 0; i < sampleCount; i++) sizes[i] = uniformSize;
    return sizes;
  }

  const entriesOffset = dataOffset + 12;
  const maxEntries = Math.min(sampleCount, Math.floor((dataSize - 12) / 4));

  for (let i = 0; i < maxEntries; i++) {
    sizes[i] = view.getUint32(entriesOffset + i * 4, false);
  }
  // Fill any remaining (truncated file)
  for (let i = maxEntries; i < sampleCount; i++) {
    sizes[i] = 0;
  }

  return sizes;
}

/**
 * Extract waveform data from an M4A (MPEG-4) file by reading AAC frame sizes
 * from the sample size table (`stsz` atom) of the audio track.
 *
 * Improvements over naïve stsz parsing:
 *   1. Finds the actual audio track (handler_type 'soun'), skipping metadata tracks.
 *   2. Subtracts the baseline (5th percentile) frame size so silence → 0.
 *   3. Applies a sqrt curve for better visual contrast.
 */
async function extractWaveformFromAudioFile(
  uri: string,
  barCount: number
): Promise<number[]> {
  try {
    return await MicrophoneEnergyModule.extractWaveform(uri, barCount);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to extract waveform from audio file: ${errorMessage}`);
  }
}

/**
 * Extract waveform data from a WAV ArrayBuffer.
 */
export function extractWaveformFromBuffer(
  buffer: ArrayBuffer,
  barCount = 128
): number[] {
  const { numChannels, bitsPerSample, dataOffset, dataLength } =
    parseWavHeader(buffer);

  const bytesPerSample = bitsPerSample / 8;
  const bytesPerFrame = bytesPerSample * numChannels;
  const totalFrames = Math.floor(dataLength / bytesPerFrame);

  if (totalFrames === 0) {
    return Array.from<number>({ length: barCount }).fill(0);
  }

  const view = new DataView(buffer);
  const _framesPerBar = Math.max(1, Math.floor(totalFrames / barCount));
  const amplitudes: number[] = [];

  for (let bar = 0; bar < barCount; bar++) {
    const startFrame = Math.floor((bar / barCount) * totalFrames);
    const endFrame = Math.min(
      totalFrames,
      Math.floor(((bar + 1) / barCount) * totalFrames)
    );
    const frameCount = endFrame - startFrame;

    if (frameCount === 0) {
      amplitudes.push(0);
      continue;
    }

    let sumSquares = 0;

    for (let f = startFrame; f < endFrame; f++) {
      const frameOffset = dataOffset + f * bytesPerFrame;

      // Average across channels
      let frameSample = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        const sampleOffset = frameOffset + ch * bytesPerSample;

        // Bounds check
        if (sampleOffset + bytesPerSample > buffer.byteLength) break;

        let sample: number;
        if (bitsPerSample === 16) {
          sample = view.getInt16(sampleOffset, true) / 32768;
        } else if (bitsPerSample === 8) {
          // 8-bit WAV is unsigned (0–255), centre is 128
          sample = (view.getUint8(sampleOffset) - 128) / 128;
        } else if (bitsPerSample === 24) {
          // 24-bit signed, little-endian
          const lo = view.getUint8(sampleOffset);
          const mid = view.getUint8(sampleOffset + 1);
          const hi = view.getInt8(sampleOffset + 2); // signed for sign extension
          sample = ((hi << 16) | (mid << 8) | lo) / 8388608;
        } else if (bitsPerSample === 32) {
          sample = view.getFloat32(sampleOffset, true);
        } else {
          // Fallback – treat as 16-bit
          sample = view.getInt16(sampleOffset, true) / 32768;
        }

        frameSample += sample;
      }

      frameSample /= numChannels;
      sumSquares += frameSample * frameSample;
    }

    const rms = Math.sqrt(sumSquares / frameCount);
    amplitudes.push(rms);
  }

  // Normalise so the peak bar is 1.0
  const maxAmplitude = Math.max(...amplitudes);
  if (maxAmplitude > 0) {
    for (let i = 0; i < amplitudes.length; i++) {
      amplitudes[i] = amplitudes[i]! / maxAmplitude;
    }
  }

  return amplitudes;
}
