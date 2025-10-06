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
  
  // Ring buffer for capturing speech onset (500ms default)
  private val ringBuffer = ArrayDeque<ShortArray>()
  private val ringBufferMaxSize = 16 // ~500ms at typical buffer sizes
  private var isRecordingSegment = false
  private var segmentFile: java.io.File? = null
  private var segmentStartTime: Long = 0
  private val sampleRate = 16000
  
  // Segment audio data collected in memory
  private var segmentBuffers = ArrayList<ShortArray>()

  override fun definition() = ModuleDefinition {
    Name("MicrophoneEnergy")

    Events("onEnergyResult", "onError", "onSegmentComplete")
    
    AsyncFunction("startEnergyDetection") { promise: Promise ->
      startEnergyDetection(promise)
    }

    AsyncFunction("stopEnergyDetection") { promise: Promise ->
      stopEnergyDetection(promise)
    }
    
    AsyncFunction("startSegment") { options: Map<String, Any?>?, promise: Promise ->
      startSegment(options, promise)
    }
    
    AsyncFunction("stopSegment") { promise: Promise ->
      stopSegment(promise)
    }
  }

  private fun startEnergyDetection(promise: Promise) {
    if (isActive) {
      // Restart: stop current detection first
      stopEnergyDetectionInternal()
    }

    try {
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

  private suspend fun processAudioData(audioData: ShortArray, bytesRead: Int, _sampleRate: Int) {
    val timestamp = System.currentTimeMillis().toDouble()

    // Copy the data for ring buffer
    val dataCopy = audioData.copyOf(bytesRead)

    // Simple energy calculation (RMS - Root Mean Square)
    var energy = 0.0
    for (i in 0 until bytesRead) {
      val sample = audioData[i] / 32768.0 // Normalize to -1.0 to 1.0
      energy += sample * sample
    }
    energy = sqrt(energy / bytesRead)

    // Manage ring buffer (always buffer when not recording segment)
    if (!isRecordingSegment) {
      synchronized(ringBuffer) {
        ringBuffer.addLast(dataCopy)
        if (ringBuffer.size > ringBufferMaxSize) {
          ringBuffer.removeFirst()
        }
      }
    }

    // If recording a segment, collect in memory
    if (isRecordingSegment) {
      synchronized(segmentBuffers) {
        segmentBuffers.add(dataCopy)
      }
    }

    // Send pure energy level - let JavaScript decide everything
    withContext(Dispatchers.Main) {
      sendEvent("onEnergyResult", mapOf(
        "energy" to energy,
        "timestamp" to timestamp
      ))
    }
  }

  private fun writeWavHeader(out: java.io.FileOutputStream, dataSize: Long, sampleRate: Int, channels: Int, bitsPerSample: Int) {
    val header = java.nio.ByteBuffer.allocate(44)
    header.order(java.nio.ByteOrder.LITTLE_ENDIAN)
    
    // RIFF header
    header.put("RIFF".toByteArray())
    header.putInt((36 + dataSize).toInt()) // File size - 8
    header.put("WAVE".toByteArray())
    
    // fmt chunk
    header.put("fmt ".toByteArray())
    header.putInt(16) // fmt chunk size
    header.putShort(1) // Audio format (1 = PCM)
    header.putShort(channels.toShort())
    header.putInt(sampleRate)
    header.putInt(sampleRate * channels * bitsPerSample / 8) // Byte rate
    header.putShort((channels * bitsPerSample / 8).toShort()) // Block align
    header.putShort(bitsPerSample.toShort())
    
    // data chunk
    header.put("data".toByteArray())
    header.putInt(dataSize.toInt())
    
    out.write(header.array())
  }

  private fun startSegment(options: Map<String, Any?>?, promise: Promise) {
    if (!isActive) {
      promise.reject("NOT_ACTIVE", "Energy detection not active", null)
      return
    }

    if (isRecordingSegment) {
      println("⚠️ Segment already recording, ignoring duplicate start")
      promise.resolve(null)
      return
    }

    try {
      // Get preroll duration (default 500ms)
      val prerollMs = (options?.get("prerollMs") as? Number)?.toInt() ?: 500

      // Create temp file for segment (WAV format for compatibility)
      val context = appContext.reactContext ?: throw Exception("Context not available")
      val tempDir = context.cacheDir
      val fileName = "segment_${java.util.UUID.randomUUID()}.wav"
      val file = java.io.File(tempDir, fileName)
      
      segmentFile = file
      segmentStartTime = System.currentTimeMillis()
      
      // Copy preroll from ring buffer
      synchronized(ringBuffer) {
        val samplesPerMs = sampleRate / 1000.0
        val typicalBufferSize = 2048
        val maxPrerollBuffers = (prerollMs / (typicalBufferSize / samplesPerMs)).toInt()
        val buffersToWrite = minOf(ringBuffer.size, maxPrerollBuffers)
        
        segmentBuffers.clear()
        segmentBuffers.addAll(ringBuffer.takeLast(buffersToWrite))
        
        println("📼 Preroll: $buffersToWrite chunks (~${prerollMs}ms)")
      }

      isRecordingSegment = true
      println("🎬 Segment recording started with preroll")
      promise.resolve(null)

    } catch (e: Exception) {
      promise.reject("START_SEGMENT_ERROR", "Failed to start segment: ${e.message}", e)
      isRecordingSegment = false
      segmentBuffers.clear()
      segmentFile = null
    }
  }

  private fun stopSegment(promise: Promise) {
    if (!isRecordingSegment) {
      println("⚠️ No segment recording active")
      promise.resolve(null)
      return
    }

    try {
      isRecordingSegment = false

      val file = segmentFile
      val startTime = segmentStartTime
      val endTime = System.currentTimeMillis()
      val duration = endTime - startTime

      if (file != null) {
        // Calculate total data size
        var totalSamples = 0
        synchronized(segmentBuffers) {
          for (buffer in segmentBuffers) {
            totalSamples += buffer.size
          }
        }
        
        val dataSize = totalSamples * 2L // 16-bit = 2 bytes per sample
        
        println("🎬 Writing WAV file: $totalSamples samples, ${duration}ms")
        
        // Write WAV file
        val out = java.io.FileOutputStream(file)
        
        // Write WAV header
        writeWavHeader(out, dataSize, sampleRate, 1, 16)
        
        // Write all audio data
        synchronized(segmentBuffers) {
          for (buffer in segmentBuffers) {
            val byteBuffer = java.nio.ByteBuffer.allocate(buffer.size * 2)
            byteBuffer.order(java.nio.ByteOrder.LITTLE_ENDIAN)
            for (sample in buffer) {
              byteBuffer.putShort(sample)
            }
            out.write(byteBuffer.array())
          }
        }
        
        out.close()
        
        println("✅ WAV file written: ${file.absolutePath}")

        // Send completion event with file URI
        val uri = "file://${file.absolutePath}"
        sendEvent("onSegmentComplete", mapOf(
          "uri" to uri,
          "startTime" to startTime.toDouble(),
          "endTime" to endTime.toDouble(),
          "duration" to duration.toDouble()
        ))

        promise.resolve(uri)
      } else {
        promise.resolve(null)
      }

      segmentFile = null
      segmentBuffers.clear()

    } catch (e: Exception) {
      promise.reject("STOP_SEGMENT_ERROR", "Failed to stop segment: ${e.message}", e)
      segmentFile = null
      segmentBuffers.clear()
    }
  }
}