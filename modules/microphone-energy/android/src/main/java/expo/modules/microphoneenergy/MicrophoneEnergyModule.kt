package expo.modules.microphoneenergy

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.*
import kotlin.math.sqrt

class MicrophoneEnergyModule : Module() {
  private var audioRecord: AudioRecord? = null
  private var isActive = false
  private var recordingScope: CoroutineScope? = null

  override fun definition() = ModuleDefinition {
    Name("MicrophoneEnergy")

    Events("onEnergyResult", "onError")
    
    AsyncFunction("startEnergyDetection") { promise: Promise ->
      startEnergyDetection(promise)
    }

    AsyncFunction("stopEnergyDetection") { promise: Promise ->
      stopEnergyDetection(promise)
    }
  }

  private fun startEnergyDetection(promise: Promise) {
    if (isActive) {
      // Restart: stop current detection first
      stopEnergyDetectionInternal()
    }

    try {
      val sampleRate = 16000
      val channelConfig = AudioFormat.CHANNEL_IN_MONO
      val audioFormat = AudioFormat.ENCODING_PCM_16BIT
      val bufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)

      audioRecord = AudioRecord(
        MediaRecorder.AudioSource.MIC,
        sampleRate,
        channelConfig,
        audioFormat,
        bufferSize
      )

      if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
        throw Exception("AudioRecord initialization failed")
      }

      audioRecord?.startRecording()
      isActive = true
      promise.resolve(null)

      recordingScope = CoroutineScope(Dispatchers.IO)
      recordingScope?.launch {
        val audioData = ShortArray(bufferSize / 2) // For 16-bit PCM
        while (isActive && audioRecord != null) {
          val bytesRead = audioRecord!!.read(audioData, 0, audioData.size)
          if (bytesRead > 0) {
            processAudioData(audioData, bytesRead, sampleRate)
          }
        }
      }

    } catch (e: SecurityException) {
      sendEvent("onError", mapOf("message" to "Microphone permission not granted: ${e.message}"))
      promise.reject("PERMISSION_DENIED", "Microphone permission not granted", e)
    } catch (e: Exception) {
      sendEvent("onError", mapOf("message" to "Failed to start energy detection: ${e.message}"))
      promise.reject("ENERGY_DETECTION_ERROR", "Failed to start energy detection", e)
    }
  }

  private fun stopEnergyDetection(promise: Promise) {
    if (!isActive) {
      promise.resolve(null)
      return
    }

    try {
      stopEnergyDetectionInternal()
      promise.resolve(null)
    } catch (e: Exception) {
      sendEvent("onError", mapOf("message" to "Failed to stop energy detection: ${e.message}"))
      promise.reject("STOP_ERROR", "Failed to stop energy detection", e)
    }
  }

  private fun stopEnergyDetectionInternal() {
    isActive = false
    recordingScope?.cancel()
    recordingScope = null

    audioRecord?.stop()
    audioRecord?.release()
    audioRecord = null
  }

  private suspend fun processAudioData(audioData: ShortArray, bytesRead: Int, sampleRate: Int) {
    val timestamp = System.currentTimeMillis().toDouble()

    // Simple energy calculation (RMS - Root Mean Square)
    var energy = 0.0
    for (i in 0 until bytesRead) {
      val sample = audioData[i] / 32768.0 // Normalize to -1.0 to 1.0
      energy += sample * sample
    }
    energy = sqrt(energy / bytesRead)

    // Send pure energy level - let JavaScript decide everything
    withContext(Dispatchers.Main) {
      sendEvent("onEnergyResult", mapOf(
        "energy" to energy,
        "timestamp" to timestamp
      ))
    }
  }
}