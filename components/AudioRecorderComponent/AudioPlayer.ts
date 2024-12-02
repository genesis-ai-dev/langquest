import { Audio } from 'expo-av';

export class AudioPlayer {
  private sound: Audio.Sound | null = null;
  
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