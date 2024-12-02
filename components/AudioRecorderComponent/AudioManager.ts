import { AudioRecorder } from './AudioRecorder';
import { AudioPlayer } from './AudioPlayer';

export class AudioManager {
  private recorder: AudioRecorder;
  private player: AudioPlayer;
  private currentAudioUri: string | null = null;

  constructor() {
    this.recorder = new AudioRecorder();
    this.player = new AudioPlayer();
  }

  async startRecording() {
    await this.player.unloadAudio(); // Stop any playback
    return this.recorder.startRecording();
  }

  async pauseRecording() {
    return this.recorder.pauseRecording();
  }

  async resumeRecording() {
    return this.recorder.resumeRecording();
  }

  async stopRecording() {
    const uri = await this.recorder.stopRecording();
    if (uri) {
      this.currentAudioUri = uri;
    }
    return uri;
  }

  getIsRecording(): boolean {
    return this.recorder.getIsRecording();
  }

  async saveRecording(filename: string) {
    const uri = await this.recorder.saveRecording(filename);
    if (uri) {
      this.currentAudioUri = uri;
    }
    return uri;
  }

  // Wipe segments and concatenated recording in temp memory
  async discardRecording() {
    await this.recorder.discardRecording();
    this.currentAudioUri = null;
  }

  async playRecording() {
    if (this.currentAudioUri) {
      await this.player.loadAudio(this.currentAudioUri);
      return this.player.play();
    }
    return false;
  }

  async pausePlayback() {
    return this.player.pause();
  }

  async cleanup() {
    await this.player.unloadAudio();
    await this.recorder.discardRecording();
    this.currentAudioUri = null;
  }
}