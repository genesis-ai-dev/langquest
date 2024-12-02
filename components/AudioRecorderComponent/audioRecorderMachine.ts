import { createMachine } from 'xstate';

export const audioRecorderMachine = createMachine({
  id: 'audioRecorder',
  initial: 'idle',
  states: {
    idle: {
      entry: () => {
        console.log('Entered idle state');
      },
      on: {
        PRESS_MIC: {
          target: 'recording',
          guard: ({ context, event }) => {
            console.log('Checking if can start recording...');
            return true; // Will be replaced with actual permission/hardware check
          },
          actions: () => {
            console.log('Starting new recording session');
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
          actions: () => {
            console.log('Pausing recording');
          },
        },
        PRESS_CHECK: {
          target: 'recordingStopped',
          guard: ({ context, event }) => {
            console.log('Checking if recording is long enough...');
            return true; // Will be replaced with actual duration check
          },
          actions: () => {
            console.log('Finalizing recording');
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
          actions: () => {
            console.log('Resuming recording');
          },
        },
        PRESS_CHECK: {
          target: 'recordingStopped',
          guard: ({ context, event }) => {
            console.log('Checking if recording is long enough...');
            return true; // Will be replaced with actual duration check
          },
          actions: () => {
            console.log('Finalizing recording');
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
          actions: () => {
            console.log('Starting new recording session');
          },
        },
        PRESS_PLAY: {
          target: 'playing',
          guard: ({ context, event }) => {
            console.log('Checking if audio file exists...');
            return true; // Will be replaced with actual file check
          },
          actions: () => {
            console.log('Starting playback');
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
          actions: () => {
            console.log('Starting new recording session');
          },
        },
        PRESS_PAUSE: {
          target: 'playbackPaused',
          actions: () => {
            console.log('Pausing playback');
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
          actions: () => {
            console.log('Starting new recording session');
          },
        },
        PRESS_PLAY: {
          target: 'playing',
          actions: () => {
            console.log('Resuming playback');
          },
        },
      },
    },
  },
});