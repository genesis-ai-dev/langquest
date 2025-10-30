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
  
  // Ring buffer for capturing speech onset (1000ms for better onset capture)
  private val ringBuffer = ArrayDeque<ShortArray>()
  private val ringBufferMaxSize = 32 // ~1000ms at typical buffer sizes
  private var isRecordingSegment = false
  private var segmentFile: java.io.File? = null
  private var segmentStartTime: Long = 0
  private val sampleRate = 16000
  
  // Segment audio data collected in memory
  private var segmentBuffers = ArrayList<ShortArray>()
  
  // Native VAD state
  private var vadEnabled = false
  private var vadThreshold = 0.5f
  private var vadOnsetMultiplier = 0.25f
  private var vadConfirmMultiplier = 0.5f
  private var vadSilenceDuration = 300 // ms
  private var vadMinSegmentDuration = 500 // ms
  
  // EMA smoothing
  private val emaAlpha = 0.3f
  private var smoothedEnergy = 0.0f
  
  // Schmitt trigger state
  private var onsetDetected = false
  private var onsetTime: Long = 0
  private var lastSpeechTime: Long = 0
  private var recordingStartTime: Long = 0
  private var lastSegmentEndTime: Long = 0 // Track when last segment ended
  private val cooldownPeriodMs = 500 // Cooldown after segment ends before detecting new onset

  override fun definition() = ModuleDefinition {
    Name("MicrophoneEnergy")

    Events("onEnergyResult", "onError", "onSegmentComplete", "onSegmentStart")
    
    AsyncFunction("startEnergyDetection") { promise: Promise ->
      startEnergyDetection(promise)
    }

    AsyncFunction("stopEnergyDetection") { promise: Promise ->
      stopEnergyDetection(promise)
    }
    
    AsyncFunction("configureVAD") { config: Map<String, Any?>, promise: Promise ->
      configureVAD(config)
      promise.resolve(null)
    }
    
    AsyncFunction("enableVAD") { promise: Promise ->
      enableVAD()
      promise.resolve(null)
    }
    
    AsyncFunction("disableVAD") { promise: Promise ->
      disableVAD()
      promise.resolve(null)
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
    vadEnabled = false
    onsetDetected = false
    recordingScope?.cancel()
    recordingScope = null

    // Stop any active segment
    if (isRecordingSegment) {
      val promise = object : Promise {
        override fun resolve(value: Any?) {}
        override fun reject(code: String, message: String?, cause: Throwable?) {}
      }
      stopSegment(promise)
    }

    audioRecord?.stop()
    audioRecord?.release()
    audioRecord = null
  }
  
  private fun configureVAD(config: Map<String, Any?>) {
    (config["threshold"] as? Number)?.let { vadThreshold = it.toFloat() }
    (config["silenceDuration"] as? Number)?.let { vadSilenceDuration = it.toInt() }
    (config["onsetMultiplier"] as? Number)?.let { vadOnsetMultiplier = it.toFloat() }
    (config["confirmMultiplier"] as? Number)?.let { vadConfirmMultiplier = it.toFloat() }
    (config["minSegmentDuration"] as? Number)?.let { vadMinSegmentDuration = it.toInt() }
    
    println("🎯 VAD configured: threshold=$vadThreshold, silence=${vadSilenceDuration}ms")
  }
  
  private fun enableVAD() {
    vadEnabled = true
    onsetDetected = false
    smoothedEnergy = 0.0f
    lastSegmentEndTime = 0L // Reset cooldown when VAD enabled
    println("🎯 Native VAD enabled")
  }
  
  private fun disableVAD() {
    vadEnabled = false
    onsetDetected = false
    
    // Stop any active segment
    if (isRecordingSegment) {
      val promise = object : Promise {
        override fun resolve(value: Any?) {}
        override fun reject(code: String, message: String?, cause: Throwable?) {}
      }
      stopSegment(promise)
    }
    
    println("🎯 Native VAD disabled")
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
    
    // Apply EMA smoothing
    smoothedEnergy = emaAlpha * energy.toFloat() + (1.0f - emaAlpha) * smoothedEnergy

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
    
    // Native VAD logic (if enabled)
    if (vadEnabled) {
      handleNativeVAD()
    }

    // Send energy level to JavaScript (for UI visualization)
    withContext(Dispatchers.Main) {
      sendEvent("onEnergyResult", mapOf(
        "energy" to smoothedEnergy.toDouble(),
        "timestamp" to timestamp
      ))
    }
  }
  
  private fun handleNativeVAD() {
    val now = System.currentTimeMillis()
    val onsetThreshold = vadThreshold * vadOnsetMultiplier
    val confirmThreshold = vadThreshold * vadConfirmMultiplier
    
    // Update last speech time if above confirm threshold
    if (smoothedEnergy > confirmThreshold) {
      lastSpeechTime = now
    }
    
    // State machine
    if (!isRecordingSegment && !onsetDetected) {
      // IDLE: Check for onset (with cooldown to prevent rapid re-triggers)
      val timeSinceLastSegment = now - lastSegmentEndTime
      if (smoothedEnergy > onsetThreshold) {
        if (timeSinceLastSegment >= cooldownPeriodMs || lastSegmentEndTime == 0L) {
          println("🎯 Native VAD: Onset detected ($smoothedEnergy > $onsetThreshold)")
          onsetDetected = true
          onsetTime = now
        } else {
          // Still in cooldown period - ignore onset
          println("⏳ Native VAD: Onset ignored (cooldown: ${timeSinceLastSegment}ms/${cooldownPeriodMs}ms)")
        }
      }
    } else if (!isRecordingSegment && onsetDetected) {
      // ONSET: Wait for confirmation or timeout
      val timeSinceOnset = now - onsetTime
      
      if (smoothedEnergy > confirmThreshold) {
        println("🎤 Native VAD: Speech CONFIRMED ($smoothedEnergy > $confirmThreshold) - auto-starting segment")
        
        // Start recording segment
        onsetDetected = false
        lastSpeechTime = now
        recordingStartTime = now
        
        // Emit event to JS (for UI update - create pending card)
        sendEvent("onSegmentStart", emptyMap<String, Any>())
        
        // Start segment with preroll
        val promise = object : Promise {
          override fun resolve(value: Any?) {}
          override fun reject(code: String, message: String?, cause: Throwable?) {
            println("⚠️ Native VAD: Failed to start segment: $message")
          }
        }
        startSegment(mapOf("prerollMs" to 1000), promise)
      } else if (timeSinceOnset > 300) {
        // Timeout - false alarm
        println("⚠️ Native VAD: Onset timeout - false alarm")
        onsetDetected = false
      }
    } else if (isRecordingSegment) {
      // RECORDING: Monitor for silence
      val silenceMs = now - lastSpeechTime
      val durationMs = now - recordingStartTime
      
      if (silenceMs >= vadSilenceDuration && durationMs >= vadMinSegmentDuration) {
        println("💤 Native VAD: ${silenceMs}ms silence - auto-stopping segment")
        
        // Stop segment (will emit onSegmentComplete)
        val promise = object : Promise {
          override fun resolve(value: Any?) {}
          override fun reject(code: String, message: String?, cause: Throwable?) {
            println("⚠️ Native VAD: Failed to stop segment: $message")
          }
        }
        stopSegment(promise)
      }
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
      
      // Record when segment ended for cooldown logic
      lastSegmentEndTime = System.currentTimeMillis()

      val file = segmentFile
      val startTime = segmentStartTime
      val endTime = lastSegmentEndTime
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
        
        // Write WAV file synchronously (simple approach that worked before)
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
        
        // Flush to ensure data is written (but don't sync - it can be slow/problematic)
        out.flush()
        out.close()
        
        println("✅ WAV file written: ${file.absolutePath}")
        println("⏳ Cooldown active: ${cooldownPeriodMs}ms before next onset detection")

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