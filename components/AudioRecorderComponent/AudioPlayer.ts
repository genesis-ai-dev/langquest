import { Audio, AVPlaybackStatus } from 'expo-av';

export class AudioPlayer {
  private sound: Audio.Sound | null = null;
  private onPlaybackStatusUpdate: ((status: AVPlaybackStatus) => void) | null = null;
  
  async loadAudio(uri: string) {
    try {
      await this.unloadAudio();
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false }
      );
      
      if (this.onPlaybackStatusUpdate) {
        sound.setOnPlaybackStatusUpdate(this.onPlaybackStatusUpdate);
      }
      
      this.sound = sound;
      return true;
    } catch (error) {
      console.error('Failed to load audio:', error);
      return false;
    }
  }

  async play() {
    try {
      if (this.sound) {
        await this.sound.playAsync();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to play audio:', error);
      return false;
    }
  }

  async playFromPosition(positionMillis: number) {
    try {
      if (this.sound) {
        await this.sound.playFromPositionAsync(positionMillis);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to play from position:', error);
      return false;
    }
  }

  async getStatusAsync(): Promise<AVPlaybackStatus | null> {
    try {
      if (this.sound) {
        return await this.sound.getStatusAsync();
      }
      return null;
    } catch (error) {
      console.error('Failed to get status:', error);
      return null;
    }
  }

  setOnPlaybackStatusUpdate(callback: (status: AVPlaybackStatus) => void) {
    this.onPlaybackStatusUpdate = callback;
    if (this.sound) {
      this.sound.setOnPlaybackStatusUpdate(callback);
    }
  }

  async pause() {
    try {
      if (this.sound) {
        await this.sound.pauseAsync();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to pause audio:', error);
      return false;
    }
  }

  async unloadAudio() {
    try {
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }
    } catch (error) {
      console.error('Failed to unload audio:', error);
    }
  }
}