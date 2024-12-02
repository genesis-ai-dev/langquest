import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { FFmpegKit, FFmpegKitConfig } from 'ffmpeg-kit-react-native';

export class AudioRecorder {
    private recording: Audio.Recording | null = null;
    private segments: string[] = []; // URIs of recording segments
    private isRecording: boolean = false;
    private concatenatedUri: string | null = null;

    async startRecording() {
      try {
        if (this.isRecording) return false;
        
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
  
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        
        this.recording = recording;
        this.isRecording = true;
        return true;
      } catch (error) {
        console.error('Failed to start recording:', error);
        return false;
      }
    }
  
    async pauseRecording() {
      try {
        if (!this.recording || !this.isRecording) return false;
  
        await this.recording.stopAndUnloadAsync();
        const uri = this.recording.getURI();
        if (uri) {
          this.segments.push(uri);
        }
        this.recording = null;
        this.isRecording = false;
        return true;
      } catch (error) {
        console.error('Failed to pause recording:', error);
        return false;
      }
    }
  
    async resumeRecording() {
      return this.startRecording();
    }
  
    async stopRecording() {
      try {
        // If currently recording, save the last segment
        if (this.isRecording) {
          await this.pauseRecording();
        }
  
        if (this.segments.length === 0) return null;
  
        // Concatenate all segments
        this.concatenatedUri = await this.concatenateSegments();
        
        // Clear segments after successful concatenation
        await this.clearSegments();
        
        return this.concatenatedUri;
      } catch (error) {
        console.error('Failed to stop recording:', error);
        return null;
      }
    }
  
    private async concatenateSegments(): Promise<string | null> {
      try {
        if (this.segments.length === 0) return null;
        if (this.segments.length === 1) return this.segments[0];
    
        const outputUri = `${FileSystem.cacheDirectory}temp_concatenated_${Date.now()}.m4a`;
        
        // Create a list file for FFmpeg
        const listPath = `${FileSystem.cacheDirectory}list.txt`;
        const listContent = this.segments.map(uri => `file '${uri}'`).join('\n');
        await FileSystem.writeAsStringAsync(listPath, listContent);
    
        // Execute FFmpeg command using FFmpegKit
        await FFmpegKit.execute(
          `-f concat -safe 0 -i ${listPath} -c copy -y ${outputUri}`
        );
    
        // Clean up the list file
        await FileSystem.deleteAsync(listPath);
    
        return outputUri;
      } catch (error) {
        console.error('Failed to concatenate segments:', error);
        return null;
      }
    }
  
    private async clearSegments() {
      try {
        // Delete all segment files
        for (const uri of this.segments) {
          await FileSystem.deleteAsync(uri);
        }
        this.segments = [];
      } catch (error) {
        console.error('Failed to clear segments:', error);
      }
    }
  
    async saveRecording(filename: string) {
      try {
        if (!this.concatenatedUri) return null;
        
        const permanentUri = `${FileSystem.documentDirectory}${filename}.m4a`;
        await FileSystem.moveAsync({
          from: this.concatenatedUri,
          to: permanentUri
        });
        
        this.concatenatedUri = null;
        return permanentUri;
      } catch (error) {
        console.error('Failed to save recording:', error);
        return null;
      }
    }
  
    async discardRecording() {
      try {
        if (this.recording) {
          await this.recording.stopAndUnloadAsync();
          this.recording = null;
        }
        
        await this.clearSegments();
        
        if (this.concatenatedUri) {
          await FileSystem.deleteAsync(this.concatenatedUri);
          this.concatenatedUri = null;
        }
        
        this.isRecording = false;
      } catch (error) {
        console.error('Failed to discard recording:', error);
      }
    }
  
    getIsRecording(): boolean {
      return this.isRecording;
    }
  }