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

const waveformModule = MicrophoneEnergyModule as {
  extractWaveform: (
    uri: string,
    barCount: number,
    normalize?: boolean
  ) => Promise<number[]>;
};

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
  barCount = 128,
  options?: { normalize?: boolean }
): Promise<number[]> {
  const normalize = options?.normalize ?? true;
  // Try to read as WAV first
  try {
    const buffer = await readFile(uri);
    return extractWaveformFromBuffer(buffer, barCount, normalize);
  } catch (error) {
    // If WAV parsing fails, try to extract from M4A/other formats using Expo AV
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('RIFF header') || errorMessage.includes('WAV file')) {
      // Not a WAV file - try M4A/other format extraction
      return await extractWaveformFromAudioFile(uri, barCount, normalize);
    }
    // Re-throw if it's a different error (file not found, etc.)
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Native waveform extraction (M4A/AAC handled via platform decoders)
// ---------------------------------------------------------------------------

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
  barCount: number,
  normalize: boolean
): Promise<number[]> {
  try {
    const extract = waveformModule.extractWaveform;
    // Backward compatible: native module may still accept only 2 args
    if (extract.length >= 3) {
      return await extract(uri, barCount, normalize);
    }
    return await extract(uri, barCount);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Received 3 arguments, but 2 was expected')) {
      try {
        return await waveformModule.extractWaveform(uri, barCount);
      } catch (retryError) {
        const retryMessage =
          retryError instanceof Error ? retryError.message : String(retryError);
        throw new Error(
          `Failed to extract waveform from audio file: ${retryMessage}`
        );
      }
    }
    throw new Error(`Failed to extract waveform from audio file: ${errorMessage}`);
  }
}

/**
 * Extract waveform data from a WAV ArrayBuffer.
 */
export function extractWaveformFromBuffer(
  buffer: ArrayBuffer,
  barCount = 128,
  normalize = true
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

  if (normalize) {
    // Normalise so the peak bar is 1.0
    const maxAmplitude = Math.max(...amplitudes);
    if (maxAmplitude > 0) {
      for (let i = 0; i < amplitudes.length; i++) {
        amplitudes[i] = amplitudes[i]! / maxAmplitude;
      }
    }
  }

  return amplitudes;
}
