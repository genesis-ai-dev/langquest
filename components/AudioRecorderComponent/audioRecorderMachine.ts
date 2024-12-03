import { createMachine } from 'xstate';
import { AudioManager } from './AudioManager';

// Define types for the machine
type AudioMachineContext = {
  audioManager: AudioManager;
  lastPlaybackPosition: number; 
};

type AudioMachineEvents = 
  | { type: 'PRESS_MIC' }
  | { type: 'PRESS_PAUSE' }
  | { type: 'PRESS_CHECK' }
  | { type: 'PRESS_PLAY' }
  | { type: 'PLAYBACK_COMPLETE'};

export const audioRecorderMachine = createMachine({
  id: 'audioRecorder',
  initial: 'idle',
  types: {} as {
    context: AudioMachineContext;
    events: AudioMachineEvents;
  },
  context: ({ input }: { input: { audioManager: AudioManager } }) => ({
    audioManager: input.audioManager,
    lastPlaybackPosition: 0,
  }),
  states: {
    idle: {
      entry: () => {
        console.log('Entered idle state');
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
          },
        },
      },
    },
    recording: {
      entry: () => {
        console.log('Entered recording state');
      },
      on: {
        PRESS_PAUSE: {
          target: 'recordingPaused',
          actions: async ({ context }) => {
            console.log('Pausing recording');
            await context.audioManager.pauseRecording();
          },
        },
        PRESS_CHECK: {
          target: 'recordingStopped',
          guard: ({ context, event }) => {
            console.log('Checking if recording is long enough...');
            return true; // Will be replaced with actual duration check
          },
          actions: async ({ context }) => {
            console.log('Finalizing recording');
            await context.audioManager.stopRecording();
          },
        },
      },
    },
    recordingPaused: {
      entry: () => {
        console.log('Entered paused state');
      },
      on: {
        PRESS_MIC: {
          target: 'recording',
          actions: async ({ context }) => {
            console.log('Resuming recording');
            await context.audioManager.resumeRecording();
          },
        },
        PRESS_CHECK: {
          target: 'recordingStopped',
          guard: ({ context, event }) => {
            console.log('Checking if recording is long enough...');
            return true; // Will be replaced with actual duration check
          },
          actions: async ({ context }) => {
            console.log('Finalizing recording');
            await context.audioManager.stopRecording();
          },
        },
      },
    },
    recordingStopped: {
      entry: () => {
        console.log('Entered stopped state');
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
            await context.audioManager.discardRecording();
            await context.audioManager.startRecording();
          },
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
          },
        },
      },
    },
    playing: {
      entry: () => {
        console.log('Entered playing state');
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
          },
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
          },
        },
        PLAYBACK_COMPLETE: {
          target: 'playbackEnded',
          actions: ({ context }) => {
            console.log('Playback finished');
            context.lastPlaybackPosition = 0; // Reset position
          },
        },
      },
    },
    playbackPaused: {
      entry: () => {
        console.log('Entered playback paused state');
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
          },
        },
        PRESS_PLAY: {
          target: 'playing',
          actions: async ({ context }) => {
            console.log('Resuming playback from position:', context.lastPlaybackPosition);
            await context.audioManager.playFromPosition(context.lastPlaybackPosition);
          },
        },
      },
    },
    playbackEnded: {
      entry: () => {
        console.log('Entered playback ended state');
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
          },
        },
        PRESS_PLAY: {
          target: 'playing',
          actions: async ({ context }) => {
            console.log('Starting playback from beginning');
            await context.audioManager.playFromPosition(0);
          },
        },
      },
    },
  },
});