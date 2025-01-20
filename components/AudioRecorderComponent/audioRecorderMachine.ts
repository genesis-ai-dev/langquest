import { createMachine } from 'xstate';
import { AudioManager } from './AudioManager';

// Define types for the machine
type AudioMachineContext = {
  audioManager: AudioManager;
  lastPlaybackPosition: number;
  recordingDuration: number;
  playbackPosition: number;
  isFlashing: boolean;
  onRecordingComplete: (uri: string) => void;
};

type AudioMachineEvents =
  | { type: 'PRESS_MIC' }
  | { type: 'PRESS_PAUSE' }
  | { type: 'PRESS_CHECK' }
  | { type: 'PRESS_PLAY' }
  | { type: 'PLAYBACK_COMPLETE' };

export const audioRecorderMachine = createMachine({
  id: 'audioRecorder',
  initial: 'idle',
  types: {} as {
    context: AudioMachineContext;
    events: AudioMachineEvents;
  },
  context: ({
    input
  }: {
    input: {
      audioManager: AudioManager;
      onRecordingComplete: (uri: string) => void;
    };
  }) => ({
    audioManager: input.audioManager,
    onRecordingComplete: input.onRecordingComplete,
    lastPlaybackPosition: 0,
    recordingDuration: 0,
    playbackPosition: 0,
    isFlashing: false
  }),
  states: {
    idle: {
      entry: ({ context }) => {
        context.recordingDuration = 0;
        context.playbackPosition = 0;
        context.isFlashing = false;
      },
      on: {
        PRESS_MIC: {
          target: 'recording',
          guard: ({ context }) => {
            console.log('Checking if can start recording...');
            return true; // Will be replaced with actual permission/hardware check
          },
          actions: ({ context }) => {
            console.log('Starting new recording session');
            context.audioManager.startRecording();
          }
        }
      }
    },
    recording: {
      entry: ({ context }) => {
        context.playbackPosition = 0;
        context.isFlashing = false;
        context.onRecordingComplete('');
      },
      on: {
        PRESS_PAUSE: {
          target: 'recordingPaused',
          actions: async ({ context }) => {
            console.log('Pausing recording');
            await context.audioManager.pauseRecording();
          }
        },
        PRESS_CHECK: {
          target: 'recordingStopped',
          guard: ({ context, event }) => {
            console.log('Checking if recording is long enough...');
            return true; // Will be replaced with actual duration check
          }
          // actions: async ({ context }) => {
          //   console.log('Finalizing recording');
          //   await context.audioManager.stopRecording();
          // },
        }
      }
    },
    recordingPaused: {
      entry: ({ context }) => {
        context.isFlashing = true;
      },
      on: {
        PRESS_MIC: {
          target: 'recording',
          actions: async ({ context }) => {
            console.log('Resuming recording');
            await context.audioManager.resumeRecording();
          }
        },
        PRESS_CHECK: {
          target: 'recordingStopped',
          guard: ({ context, event }) => {
            console.log('Checking if recording is long enough...');
            return true; // Will be replaced with actual duration check
          }
          // actions: async ({ context }) => {
          //   console.log('Finalizing recording');
          //   await context.audioManager.stopRecording();
          // },
        }
      }
    },
    recordingStopped: {
      entry: [
        ({ context }) => {
          context.isFlashing = false;
        },
        async ({ context }) => {
          const uri = await context.audioManager.stopRecording();
          if (uri) {
            context.onRecordingComplete(uri);
          }
        }
      ],
      on: {
        PRESS_MIC: {
          target: 'recording',
          guard: ({ context, event }) => {
            console.log('Checking if can start new recording...');
            return true; // Will be replaced with actual check
          },
          actions: async ({ context }) => {
            console.log('Starting new recording session');
            await context.audioManager.discardRecording();
            await context.audioManager.startRecording();
          }
        },
        PRESS_PLAY: {
          target: 'playing',
          guard: ({ context, event }) => {
            console.log('Checking if audio file exists...');
            return true; // Will be replaced with actual file check
          },
          actions: async ({ context }) => {
            console.log('Starting playback');
            await context.audioManager.playRecording();
          }
        }
      }
    },
    playing: {
      entry: ({ context }) => {
        context.isFlashing = false;
      },
      on: {
        PRESS_MIC: {
          target: 'recording',
          guard: ({ context, event }) => {
            console.log('Checking if can start new recording...');
            return true; // Will be replaced with actual check
          },
          actions: async ({ context }) => {
            console.log('Starting new recording session');
            await context.audioManager.pausePlayback();
            await context.audioManager.discardRecording();
            await context.audioManager.startRecording();
          }
        },
        PRESS_PAUSE: {
          target: 'playbackPaused',
          actions: async ({ context }) => {
            console.log('Pausing playback');
            // Get current position before pausing
            const status = await context.audioManager.getPlaybackStatus();
            if (status?.isLoaded) {
              context.lastPlaybackPosition = status.positionMillis;
            }
            await context.audioManager.pausePlayback();
          }
        },
        PLAYBACK_COMPLETE: {
          target: 'playbackEnded',
          actions: ({ context }) => {
            console.log('Playback finished');
            context.lastPlaybackPosition = 0; // Reset position
          }
        }
      }
    },
    playbackPaused: {
      entry: ({ context }) => {
        context.isFlashing = false;
      },
      on: {
        PRESS_MIC: {
          target: 'recording',
          guard: ({ context, event }) => {
            console.log('Checking if can start new recording...');
            return true; // Will be replaced with actual check
          },
          actions: async ({ context }) => {
            console.log('Starting new recording session');
            await context.audioManager.pausePlayback();
            await context.audioManager.discardRecording();
            await context.audioManager.startRecording();
          }
        },
        PRESS_PLAY: {
          target: 'playing',
          actions: async ({ context }) => {
            console.log(
              'Resuming playback from position:',
              context.lastPlaybackPosition
            );
            await context.audioManager.playFromPosition(
              context.lastPlaybackPosition
            );
          }
        }
      }
    },
    playbackEnded: {
      entry: ({ context }) => {
        context.isFlashing = false;
        context.playbackPosition = 0;
      },
      on: {
        PRESS_MIC: {
          target: 'recording',
          guard: ({ context }) => {
            console.log('Checking if can start new recording...');
            return true;
          },
          actions: async ({ context }) => {
            console.log('Starting new recording session');
            await context.audioManager.discardRecording();
            await context.audioManager.startRecording();
          }
        },
        PRESS_PLAY: {
          target: 'playing',
          actions: async ({ context }) => {
            console.log('Starting playback from beginning');
            await context.audioManager.playFromPosition(0);
          }
        }
      }
    }
  }
});
