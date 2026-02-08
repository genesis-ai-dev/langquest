package expo.modules.microphoneenergy

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaRecorder
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.*
import java.nio.ByteOrder
import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.pow

class MicrophoneEnergyModule : Module() {
  private var audioRecord: AudioRecord? = null
  private var isActive = false
  private var recordingScope: CoroutineScope? = null
  
  private data class RingBufferEntry(val buffer: ShortArray, val timestamp: Long)
  private val ringBuffer = ArrayDeque<RingBufferEntry>()
  private val ringBufferMaxSize = 10
  
  private var isRecordingSegment = false
  private var segmentFile: java.io.File? = null
  private var segmentStartTime: Long = 0
  private val sampleRate = 44100
  private var segmentBuffers = ArrayList<ShortArray>()
  
  private var vadEnabled = false
  private var vadThreshold = 0.05f
  private var vadOnsetMultiplier = 0.1f
  private var vadMaxOnsetDuration = 250
  private var vadSilenceDuration = 300
  private var vadMinSegmentDuration = 500
  private var vadRewindHalfPause = true
  private var vadMinActiveAudioDuration = 250  // Discard clips with less active audio than this
  
  private var vadState = "IDLE"
  private var preOnsetCutPoint: Long = 0
  private var lockedOnsetTime: Long = 0
  private var lastAboveThresholdTime: Long = 0
  private var recordingStartTime: Long = 0
  private var activeAudioTime: Long = 0  // Cumulative time above threshold during recording
  private var lastFrameTime: Long = 0    // For calculating delta time

  override fun definition() = ModuleDefinition {
    Name("MicrophoneEnergy")
    Events("onEnergyResult", "onError", "onSegmentComplete", "onSegmentStart")
    
    AsyncFunction("startEnergyDetection") { promise: Promise -> startEnergyDetection(promise) }
    AsyncFunction("stopEnergyDetection") { promise: Promise -> stopEnergyDetection(promise) }
    AsyncFunction("configureVAD") { config: Map<String, Any?>, promise: Promise ->
      configureVAD(config)
      promise.resolve(null)
    }
    AsyncFunction("enableVAD") { promise: Promise -> enableVAD(); promise.resolve(null) }
    AsyncFunction("disableVAD") { promise: Promise -> disableVAD(); promise.resolve(null) }
    AsyncFunction("startSegment") { options: Map<String, Any?>?, promise: Promise -> startSegment(options, promise) }
    AsyncFunction("stopSegment") { promise: Promise -> stopSegment(promise) }
    AsyncFunction("extractWaveform") { uri: String, barCount: Int, promise: Promise ->
      extractWaveform(uri, barCount, promise)
    }
  }

  private fun startEnergyDetection(promise: Promise) {
    if (isActive) stopEnergyDetectionInternal()
    try {
      val channelConfig = AudioFormat.CHANNEL_IN_MONO
      val audioFormat = AudioFormat.ENCODING_PCM_16BIT
      val bufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
      audioRecord = AudioRecord(MediaRecorder.AudioSource.DEFAULT, sampleRate, channelConfig, audioFormat, bufferSize)
      if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) throw Exception("AudioRecord initialization failed")
      audioRecord?.startRecording()
      isActive = true
      promise.resolve(null)
      recordingScope = CoroutineScope(Dispatchers.IO)
      recordingScope?.launch {
        val audioData = ShortArray(bufferSize / 2)
        while (isActive && audioRecord != null) {
          val bytesRead = audioRecord!!.read(audioData, 0, audioData.size)
          if (bytesRead > 0) processAudioData(audioData, bytesRead)
        }
      }
    } catch (e: SecurityException) {
      sendEvent("onError", mapOf("message" to "Microphone permission not granted"))
      promise.reject("PERMISSION_DENIED", "Microphone permission not granted", e)
    } catch (e: Exception) {
      sendEvent("onError", mapOf("message" to "Failed to start: ${e.message}"))
      promise.reject("ENERGY_DETECTION_ERROR", "Failed to start", e)
    }
  }

  private fun stopEnergyDetection(promise: Promise) {
    if (!isActive) { promise.resolve(null); return }
    try { stopEnergyDetectionInternal(); promise.resolve(null) }
    catch (e: Exception) { promise.reject("STOP_ERROR", "Failed to stop", e) }
  }

  private fun stopEnergyDetectionInternal() {
    isActive = false
    vadEnabled = false
    vadState = "IDLE"
    recordingScope?.cancel()
    recordingScope = null
    if (isRecordingSegment) {
      val p = object : Promise { override fun resolve(value: Any?) {}; override fun reject(code: String, message: String?, cause: Throwable?) {} }
      stopSegment(p)
    }
    audioRecord?.stop()
    audioRecord?.release()
    audioRecord = null
  }
  
  private fun configureVAD(config: Map<String, Any?>) {
    (config["threshold"] as? Number)?.let { vadThreshold = it.toFloat() }
    (config["silenceDuration"] as? Number)?.let { vadSilenceDuration = it.toInt() }
    (config["minSegmentDuration"] as? Number)?.let { vadMinSegmentDuration = it.toInt() }
    (config["onsetMultiplier"] as? Number)?.let { vadOnsetMultiplier = it.toFloat() }
    (config["maxOnsetDuration"] as? Number)?.let { vadMaxOnsetDuration = it.toInt() }
    (config["rewindHalfPause"] as? Boolean)?.let { vadRewindHalfPause = it }
    (config["minActiveAudioDuration"] as? Number)?.let { vadMinActiveAudioDuration = it.toInt() }
  }
  
  private fun enableVAD() {
    vadEnabled = true; vadState = "IDLE"; preOnsetCutPoint = 0; lockedOnsetTime = 0; lastAboveThresholdTime = 0
  }
  
  private fun disableVAD() {
    vadEnabled = false; vadState = "IDLE"
    if (isRecordingSegment) {
      val p = object : Promise { override fun resolve(value: Any?) {}; override fun reject(code: String, message: String?, cause: Throwable?) {} }
      stopSegment(p)
    }
  }

  private suspend fun processAudioData(audioData: ShortArray, bytesRead: Int) {
    val now = System.currentTimeMillis()
    val dataCopy = audioData.copyOf(bytesRead)
    var peakAmplitude = 0.0
    for (i in 0 until bytesRead) { peakAmplitude = max(peakAmplitude, abs(audioData[i] / 32768.0)) }
    val db = 20.0 * log10(max(peakAmplitude, 1e-10))
    val clampedDb = max(-60.0, kotlin.math.min(0.0, db))
    val normalizedAmplitude = 10.0.pow(clampedDb / 20.0).toFloat()

    synchronized(ringBuffer) {
      ringBuffer.addLast(RingBufferEntry(dataCopy, now))
      if (ringBuffer.size > ringBufferMaxSize) ringBuffer.removeFirst()
    }
    if (isRecordingSegment) synchronized(segmentBuffers) { segmentBuffers.add(dataCopy) }
    if (vadEnabled) handleVAD(normalizedAmplitude, now)
    withContext(Dispatchers.Main) { sendEvent("onEnergyResult", mapOf("energy" to normalizedAmplitude.toDouble(), "timestamp" to now.toDouble())) }
  }
  
  private fun handleVAD(rawPeak: Float, now: Long) {
    val onsetThreshold = vadThreshold * vadOnsetMultiplier
    if (rawPeak > vadThreshold) lastAboveThresholdTime = now
    
    when (vadState) {
      "IDLE" -> {
        preOnsetCutPoint = max(0, now - vadMaxOnsetDuration)
        if (rawPeak > onsetThreshold) {
          vadState = "ONSET_PENDING"; lockedOnsetTime = preOnsetCutPoint
          if (rawPeak > vadThreshold) confirmAndStartRecording(now)
        }
      }
      "ONSET_PENDING" -> {
        if (now - lockedOnsetTime > vadMaxOnsetDuration) lockedOnsetTime = now - vadMaxOnsetDuration
        when { rawPeak > vadThreshold -> confirmAndStartRecording(now); rawPeak <= onsetThreshold -> vadState = "IDLE" }
      }
      "RECORDING" -> {
        // Track cumulative time above threshold
        val deltaMs = now - lastFrameTime
        if (rawPeak > vadThreshold) {
          activeAudioTime += deltaMs
        }
        lastFrameTime = now
        
        val silenceMs = now - lastAboveThresholdTime
        val durationMs = now - recordingStartTime
        if (silenceMs >= vadSilenceDuration && durationMs >= vadMinSegmentDuration) stopRecordingAsync()
      }
    }
  }
  
  private fun confirmAndStartRecording(now: Long) {
    vadState = "RECORDING"; lastAboveThresholdTime = now; recordingStartTime = now
    activeAudioTime = 0; lastFrameTime = now  // Reset active audio tracking
    sendEvent("onSegmentStart", emptyMap<String, Any>())
    val prerollMs = (now - lockedOnsetTime).toInt()
    val p = object : Promise { override fun resolve(value: Any?) {}; override fun reject(code: String, message: String?, cause: Throwable?) {} }
    startSegment(mapOf("prerollMs" to prerollMs), p)
  }
  
  private fun stopRecordingAsync() {
    if (!isRecordingSegment) return
    isRecordingSegment = false; vadState = "IDLE"
    
    // Check if enough active audio - discard transients/short sounds
    if (activeAudioTime < vadMinActiveAudioDuration) {
      println("VAD: Discarding segment - only ${activeAudioTime}ms of active audio (min: ${vadMinActiveAudioDuration}ms)")
      segmentBuffers.clear()
      segmentFile?.delete()  // Clean up temp file
      segmentFile = null
      
      // Emit empty URI to notify JS that recording stopped but was discarded
      sendEvent("onSegmentComplete", mapOf("uri" to "", "duration" to 0.0))
      return
    }
    
    val buffersToWrite = ArrayList(segmentBuffers)
    val fileToWrite = segmentFile
    val startTime = segmentStartTime
    val endTime = System.currentTimeMillis()
    val rewindMs = if (vadRewindHalfPause) vadSilenceDuration / 2 else 0
    segmentBuffers.clear(); segmentFile = null
    
    CoroutineScope(Dispatchers.IO).launch {
      try {
        if (fileToWrite != null) {
          writeWavFileAsync(fileToWrite, buffersToWrite, rewindMs)
          val uri = "file://${fileToWrite.absolutePath}"
          withContext(Dispatchers.Main) {
            sendEvent("onSegmentComplete", mapOf("uri" to uri, "startTime" to startTime.toDouble(), "endTime" to (endTime - rewindMs).toDouble(), "duration" to (endTime - startTime - rewindMs).toDouble()))
          }
        }
      } catch (e: Exception) { println("Error writing WAV: ${e.message}") }
    }
  }
  
  private fun writeWavFileAsync(file: java.io.File, buffers: ArrayList<ShortArray>, rewindMs: Int) {
    val samplesToTrim = sampleRate * rewindMs / 1000
    var totalSamples = 0
    for (buffer in buffers) totalSamples += buffer.size
    val finalSamples = max(0, totalSamples - samplesToTrim)
    val dataSize = finalSamples * 2L
    val out = java.io.FileOutputStream(file)
    writeWavHeader(out, dataSize, sampleRate, 1, 16)
    var samplesWritten = 0
    for (buffer in buffers) {
      val samplesToWrite = kotlin.math.min(buffer.size, finalSamples - samplesWritten)
      if (samplesToWrite <= 0) break
      val byteBuffer = java.nio.ByteBuffer.allocate(samplesToWrite * 2)
      byteBuffer.order(java.nio.ByteOrder.LITTLE_ENDIAN)
      for (i in 0 until samplesToWrite) byteBuffer.putShort(buffer[i])
      out.write(byteBuffer.array())
      samplesWritten += samplesToWrite
    }
    out.flush(); out.close()
  }

  private fun writeWavHeader(out: java.io.FileOutputStream, dataSize: Long, sampleRate: Int, channels: Int, bitsPerSample: Int) {
    val header = java.nio.ByteBuffer.allocate(44)
    header.order(java.nio.ByteOrder.LITTLE_ENDIAN)
    header.put("RIFF".toByteArray()); header.putInt((36 + dataSize).toInt()); header.put("WAVE".toByteArray())
    header.put("fmt ".toByteArray()); header.putInt(16); header.putShort(1); header.putShort(channels.toShort())
    header.putInt(sampleRate); header.putInt(sampleRate * channels * bitsPerSample / 8)
    header.putShort((channels * bitsPerSample / 8).toShort()); header.putShort(bitsPerSample.toShort())
    header.put("data".toByteArray()); header.putInt(dataSize.toInt())
    out.write(header.array())
  }

  private fun startSegment(options: Map<String, Any?>?, promise: Promise) {
    if (!isActive) { promise.reject("NOT_ACTIVE", "Energy detection not active", null); return }
    if (isRecordingSegment) { promise.resolve(null); return }
    try {
      val prerollMs = (options?.get("prerollMs") as? Number)?.toInt() ?: 200
      val context = appContext.reactContext ?: throw Exception("Context not available")
      val file = java.io.File(context.cacheDir, "segment_${java.util.UUID.randomUUID()}.wav")
      segmentFile = file; segmentStartTime = System.currentTimeMillis()
      synchronized(ringBuffer) {
        val maxPrerollBuffers = (prerollMs / (2048.0 / (sampleRate / 1000.0))).toInt()
        val buffersToWrite = kotlin.math.min(ringBuffer.size, maxPrerollBuffers)
        segmentBuffers.clear()
        for (entry in ringBuffer.takeLast(buffersToWrite)) segmentBuffers.add(entry.buffer)
      }
      isRecordingSegment = true; promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("START_SEGMENT_ERROR", "Failed to start segment", e)
      isRecordingSegment = false; segmentBuffers.clear(); segmentFile = null
    }
  }

  private fun stopSegment(promise: Promise) {
    if (!isRecordingSegment) { promise.resolve(null); return }
    try {
      isRecordingSegment = false; vadState = "IDLE"
      val file = segmentFile; val startTime = segmentStartTime; val endTime = System.currentTimeMillis()
      if (file != null) {
        var totalSamples = 0
        synchronized(segmentBuffers) { for (buffer in segmentBuffers) totalSamples += buffer.size }
        val dataSize = totalSamples * 2L
        val out = java.io.FileOutputStream(file)
        writeWavHeader(out, dataSize, sampleRate, 1, 16)
        synchronized(segmentBuffers) {
          for (buffer in segmentBuffers) {
            val byteBuffer = java.nio.ByteBuffer.allocate(buffer.size * 2)
            byteBuffer.order(java.nio.ByteOrder.LITTLE_ENDIAN)
            for (sample in buffer) byteBuffer.putShort(sample)
            out.write(byteBuffer.array())
          }
        }
        out.flush(); out.close()
        val uri = "file://${file.absolutePath}"
        sendEvent("onSegmentComplete", mapOf("uri" to uri, "startTime" to startTime.toDouble(), "endTime" to endTime.toDouble(), "duration" to (endTime - startTime).toDouble()))
        promise.resolve(uri)
      } else promise.resolve(null)
      segmentFile = null; segmentBuffers.clear()
    } catch (e: Exception) {
      promise.reject("STOP_SEGMENT_ERROR", "Failed to stop segment", e)
      segmentFile = null; segmentBuffers.clear()
    }
  }

  private fun extractWaveform(uri: String, barCount: Int, promise: Promise) {
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val amplitudes = extractWaveformNative(uri, barCount)
        withContext(Dispatchers.Main) { promise.resolve(amplitudes.toList()) }
      } catch (e: Exception) {
        withContext(Dispatchers.Main) {
          promise.reject("WAVEFORM_ERROR", "Failed to extract waveform: ${e.message}", e)
        }
      }
    }
  }

  private fun extractWaveformNative(uri: String, barCount: Int): DoubleArray {
    val extractor = MediaExtractor()
    val path = if (uri.startsWith("file://")) uri.removePrefix("file://") else uri
    extractor.setDataSource(path)

    var audioTrackIndex = -1
    for (i in 0 until extractor.trackCount) {
      val format = extractor.getTrackFormat(i)
      val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
      if (mime.startsWith("audio/")) { audioTrackIndex = i; break }
    }
    if (audioTrackIndex < 0) throw Exception("No audio track found")

    extractor.selectTrack(audioTrackIndex)
    val format = extractor.getTrackFormat(audioTrackIndex)
    val mime = format.getString(MediaFormat.KEY_MIME) ?: throw Exception("Missing MIME type")
    var sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
    var channelCount = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
    val durationUs = if (format.containsKey(MediaFormat.KEY_DURATION)) format.getLong(MediaFormat.KEY_DURATION) else -1L
    var totalSamples = if (durationUs > 0) (durationUs * sampleRate / 1_000_000L) else -1L

    val sumSquares = DoubleArray(barCount)
    val counts = IntArray(barCount)
    val collectedSamples = if (totalSamples <= 0) ArrayList<Short>() else null

    val codec = MediaCodec.createDecoderByType(mime)
    codec.configure(format, null, null, 0)
    codec.start()

    val bufferInfo = MediaCodec.BufferInfo()
    var inputDone = false
    var outputDone = false
    var sampleIndex = 0L
    var pcmEncoding = AudioFormat.ENCODING_PCM_16BIT

    while (!outputDone) {
      if (!inputDone) {
        val inputIndex = codec.dequeueInputBuffer(10_000)
        if (inputIndex >= 0) {
          val inputBuffer = codec.getInputBuffer(inputIndex)
          if (inputBuffer != null) {
            val sampleSize = extractor.readSampleData(inputBuffer, 0)
            if (sampleSize < 0) {
              codec.queueInputBuffer(
                inputIndex,
                0,
                0,
                0,
                MediaCodec.BUFFER_FLAG_END_OF_STREAM
              )
              inputDone = true
            } else {
              val presentationTimeUs = extractor.sampleTime
              codec.queueInputBuffer(inputIndex, 0, sampleSize, presentationTimeUs, 0)
              extractor.advance()
            }
          }
        }
      }

      val outputIndex = codec.dequeueOutputBuffer(bufferInfo, 10_000)
      when (outputIndex) {
        MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          val outputFormat = codec.outputFormat
          if (outputFormat.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
            sampleRate = outputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
          }
          if (outputFormat.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) {
            channelCount = outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
          }
          if (outputFormat.containsKey(MediaFormat.KEY_PCM_ENCODING)) {
            pcmEncoding = outputFormat.getInteger(MediaFormat.KEY_PCM_ENCODING)
          }
          if (durationUs > 0) {
            totalSamples = (durationUs * sampleRate / 1_000_000L)
          }
        }
        MediaCodec.INFO_TRY_AGAIN_LATER -> {}
        else -> {
          if (outputIndex >= 0) {
            if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
              outputDone = true
            }

            val outputBuffer = codec.getOutputBuffer(outputIndex)
            if (outputBuffer != null && bufferInfo.size > 0) {
              outputBuffer.position(bufferInfo.offset)
              outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
              outputBuffer.order(ByteOrder.LITTLE_ENDIAN)

              if (pcmEncoding == AudioFormat.ENCODING_PCM_FLOAT) {
                val floatBuffer = outputBuffer.asFloatBuffer()
                val samples = FloatArray(floatBuffer.remaining())
                floatBuffer.get(samples)
                sampleIndex = processPcmSamples(
                  samples,
                  channelCount,
                  barCount,
                  totalSamples,
                  sumSquares,
                  counts,
                  collectedSamples,
                  sampleIndex
                )
              } else {
                val shortBuffer = outputBuffer.asShortBuffer()
                val samples = ShortArray(shortBuffer.remaining())
                shortBuffer.get(samples)
                sampleIndex = processPcmSamples(
                  samples,
                  channelCount,
                  barCount,
                  totalSamples,
                  sumSquares,
                  counts,
                  collectedSamples,
                  sampleIndex
                )
              }
            }

            codec.releaseOutputBuffer(outputIndex, false)
          }
        }
      }
    }

    codec.stop()
    codec.release()
    extractor.release()

    val amplitudes = DoubleArray(barCount)
    if (collectedSamples != null) {
      val totalFrames = collectedSamples.size
      for (bar in 0 until barCount) {
        val startFrame = (bar * totalFrames) / barCount
        val endFrame = ((bar + 1) * totalFrames) / barCount
        val frameCount = endFrame - startFrame
        if (frameCount <= 0) continue
        var sum = 0.0
        for (f in startFrame until endFrame) {
          val sample = collectedSamples[f].toDouble() / 32768.0
          sum += sample * sample
        }
        amplitudes[bar] = kotlin.math.sqrt(sum / frameCount.toDouble())
      }
    } else {
      for (bar in 0 until barCount) {
        val count = counts[bar]
        amplitudes[bar] = if (count > 0) kotlin.math.sqrt(sumSquares[bar] / count.toDouble()) else 0.0
      }
    }

    val maxAmp = amplitudes.maxOrNull() ?: 0.0
    if (maxAmp > 0) {
      for (i in amplitudes.indices) amplitudes[i] = amplitudes[i] / maxAmp
    }

    return amplitudes
  }

  private fun processPcmSamples(
    samples: ShortArray,
    channelCount: Int,
    barCount: Int,
    totalSamples: Long,
    sumSquares: DoubleArray,
    counts: IntArray,
    collectedSamples: ArrayList<Short>?,
    startSampleIndex: Long
  ): Long {
    var sampleIndex = startSampleIndex
    var i = 0
    while (i < samples.size) {
      val channels = max(1, channelCount)
      var sum = 0
      var ch = 0
      while (ch < channels && i + ch < samples.size) {
        sum += samples[i + ch].toInt()
        ch++
      }
      val avgSample = (sum / channels).toShort()
      val normalized = avgSample.toDouble() / 32768.0

      if (collectedSamples != null) {
        collectedSamples.add(avgSample)
      } else if (totalSamples > 0) {
        val bin = ((sampleIndex * barCount) / totalSamples)
          .toInt()
          .coerceIn(0, barCount - 1)
        sumSquares[bin] += normalized * normalized
        counts[bin] += 1
      }

      sampleIndex++
      i += channels
    }
    return sampleIndex
  }

  private fun processPcmSamples(
    samples: FloatArray,
    channelCount: Int,
    barCount: Int,
    totalSamples: Long,
    sumSquares: DoubleArray,
    counts: IntArray,
    collectedSamples: ArrayList<Short>?,
    startSampleIndex: Long
  ): Long {
    var sampleIndex = startSampleIndex
    var i = 0
    while (i < samples.size) {
      val channels = max(1, channelCount)
      var sum = 0.0
      var ch = 0
      while (ch < channels && i + ch < samples.size) {
        sum += samples[i + ch].toDouble()
        ch++
      }
      val avgSample = (sum / channels).toFloat()
      val normalized = avgSample.toDouble()

      if (collectedSamples != null) {
        collectedSamples.add((avgSample * 32767.0f).toInt().toShort())
      } else if (totalSamples > 0) {
        val bin = ((sampleIndex * barCount) / totalSamples)
          .toInt()
          .coerceIn(0, barCount - 1)
        sumSquares[bin] += normalized * normalized
        counts[bin] += 1
      }

      sampleIndex++
      i += channels
    }
    return sampleIndex
  }
}
