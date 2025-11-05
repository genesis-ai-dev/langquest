import ExpoModulesCore
import AVFoundation

public class MicrophoneEnergyModule: Module {
  private var audioEngine = AVAudioEngine()
  private var isActive = false
  
  // Ring buffer for capturing speech onset (1000ms for better onset capture)
  private var ringBuffer: [[Float]] = []
  private var ringBufferMaxSize = 32 // ~1000ms at 1024 samples/buffer, 16kHz (~64ms per buffer)
  private let ringBufferQueue = DispatchQueue(label: "com.microphoneenergy.ringbuffer")
  
  private var isRecordingSegment = false
  private var segmentFile: URL?
  private var segmentStartTime: Date?
  
  // Segment audio data collected in memory (like Android)
  private var segmentBuffers: [[Float]] = []
  private let segmentBuffersQueue = DispatchQueue(label: "com.microphoneenergy.segmentbuffers")
  
  // Native VAD state
  private var vadEnabled = false
  private var vadThreshold: Float = 0.5
  private var vadOnsetMultiplier: Float = 0.25
  private var vadConfirmMultiplier: Float = 0.5
  private var vadSilenceDuration: Int = 300 // ms
  private var vadMinSegmentDuration: Int = 500 // ms
  
  // EMA smoothing
  private var emaAlpha: Float = 0.3
  private var smoothedEnergy: Float = 0.0
  
  // Schmitt trigger state
  private var onsetDetected = false
  private var onsetTime: Date?
  private var lastSpeechTime: Date?
  private var recordingStartTime: Date?
  private var lastSegmentEndTime: Date? // Track when last segment ended
  private let cooldownPeriodMs: Int = 500 // Cooldown after segment ends before detecting new onset
  
  public func definition() -> ModuleDefinition {
    Name("MicrophoneEnergy")
    
    Events("onEnergyResult", "onError", "onSegmentComplete", "onSegmentStart")
    
    AsyncFunction("startEnergyDetection") {
      await self.startEnergyDetection()
    }
    
    AsyncFunction("stopEnergyDetection") {
      await self.stopEnergyDetection()
    }
    
    AsyncFunction("configureVAD") { (config: [String: Any]) in
      self.configureVAD(config: config)
    }
    
    AsyncFunction("enableVAD") {
      self.enableVAD()
    }
    
    AsyncFunction("disableVAD") {
      self.disableVAD()
    }
    
    AsyncFunction("startSegment") { (options: [String: Any]?) in
      return try await self.startSegment(options: options)
    }
    
    AsyncFunction("stopSegment") {
      return try await self.stopSegment()
    }
  }
  
  private func startEnergyDetection() async {
    if isActive {
      // Restart: stop current detection first
      await stopEnergyDetection()
    }
    
    do {
      // Simple audio session setup
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(.record, mode: .measurement, options: [])
      try audioSession.setPreferredSampleRate(16000.0) // Fixed sample rate for simplicity
      try audioSession.setActive(true)
      
      let inputNode = audioEngine.inputNode
      let format = inputNode.outputFormat(forBus: 0)
      
      inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] (buffer, time) in
        self?.processAudio(buffer: buffer)
      }
      
      try audioEngine.start()
      isActive = true
      
    } catch {
      DispatchQueue.main.async { [weak self] in
        self?.sendEvent("onError", ["message": "Failed to start energy detection: \(error.localizedDescription)"])
      }
    }
  }
  
  private func stopEnergyDetection() async {
    guard isActive else { return }
    
    // Stop any active segment
    if isRecordingSegment {
      try? await stopSegment()
    }
    
    audioEngine.inputNode.removeTap(onBus: 0)
    audioEngine.stop()
    
    do {
      try AVAudioSession.sharedInstance().setActive(false)
    } catch {
      print("Error deactivating audio session: \(error)")
    }
    
    isActive = false
    vadEnabled = false
    onsetDetected = false
    lastSegmentEndTime = nil // Reset cooldown when stopping detection
    
    // Clean up buffers
    ringBufferQueue.sync {
      ringBuffer.removeAll()
    }
    segmentBuffersQueue.sync {
      segmentBuffers.removeAll()
    }
  }
  
  private func configureVAD(config: [String: Any]) {
    if let threshold = config["threshold"] as? Double {
      vadThreshold = Float(threshold)
    }
    if let silenceDuration = config["silenceDuration"] as? Int {
      vadSilenceDuration = silenceDuration
    }
    if let onsetMult = config["onsetMultiplier"] as? Double {
      vadOnsetMultiplier = Float(onsetMult)
    }
    if let confirmMult = config["confirmMultiplier"] as? Double {
      vadConfirmMultiplier = Float(confirmMult)
    }
    if let minDuration = config["minSegmentDuration"] as? Int {
      vadMinSegmentDuration = minDuration
    }
    
    print("🎯 VAD configured: threshold=\(vadThreshold), silence=\(vadSilenceDuration)ms")
  }
  
  private func enableVAD() {
    vadEnabled = true
    onsetDetected = false
    smoothedEnergy = 0.0
    lastSegmentEndTime = nil // Reset cooldown when VAD enabled
    print("🎯 Native VAD enabled")
  }
  
  private func disableVAD() {
    vadEnabled = false
    onsetDetected = false
    
    // Stop any active segment
    if isRecordingSegment {
      Task {
        try? await stopSegment()
      }
    }
    
    print("🎯 Native VAD disabled")
  }
  
  private func processAudio(buffer: AVAudioPCMBuffer) {
    guard let channelData = buffer.floatChannelData else { return }
    
    let frameLength = Int(buffer.frameLength)
    let samples = channelData[0]
    
    // Simple energy calculation (RMS - Root Mean Square)
    var energy: Float = 0.0
    for i in 0..<frameLength {
      energy += samples[i] * samples[i]
    }
    energy = sqrt(energy / Float(frameLength))
    
    // Apply EMA smoothing
    smoothedEnergy = emaAlpha * energy + (1.0 - emaAlpha) * smoothedEnergy
    
    // Copy samples to array for ring buffer
    var samplesArray = [Float](repeating: 0, count: frameLength)
    for i in 0..<frameLength {
      samplesArray[i] = samples[i]
    }
    
    // Manage ring buffer (always buffer when not recording segment) - thread-safe
    if !isRecordingSegment {
      ringBufferQueue.sync {
        ringBuffer.append(samplesArray)
        if ringBuffer.count > ringBufferMaxSize {
          ringBuffer.removeFirst()
        }
      }
    }
    
    // If recording a segment, collect buffers in memory (like Android)
    if isRecordingSegment {
      segmentBuffersQueue.sync {
        segmentBuffers.append(samplesArray)
      }
    }
    
    // Native VAD logic (if enabled)
    if vadEnabled {
      handleNativeVAD()
    }
    
    // Send energy level to JavaScript (for UI visualization) - on main thread
    let timestamp = Date().timeIntervalSince1970 * 1000
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      self.sendEvent("onEnergyResult", [
        "energy": Double(self.smoothedEnergy),
        "timestamp": timestamp
      ])
    }
  }
  
  private func handleNativeVAD() {
    let now = Date()
    let nowMs = now.timeIntervalSince1970 * 1000
    let onsetThreshold = vadThreshold * vadOnsetMultiplier
    let confirmThreshold = vadThreshold * vadConfirmMultiplier
    
    // Update last speech time if above confirm threshold
    if smoothedEnergy > confirmThreshold {
      lastSpeechTime = now
    }
    
    // State machine
    if !isRecordingSegment && !onsetDetected {
      // IDLE: Check for onset (with cooldown to prevent rapid re-triggers)
      let timeSinceLastSegment: Double
      if let lastSegmentEnd = lastSegmentEndTime {
        timeSinceLastSegment = nowMs - (lastSegmentEnd.timeIntervalSince1970 * 1000)
      } else {
        timeSinceLastSegment = Double(cooldownPeriodMs) // No previous segment, allow onset
      }
      
      if smoothedEnergy > onsetThreshold {
        if timeSinceLastSegment >= Double(cooldownPeriodMs) || lastSegmentEndTime == nil {
          print("🎯 Native VAD: Onset detected (\(smoothedEnergy) > \(onsetThreshold))")
          onsetDetected = true
          onsetTime = now
        } else {
          // Still in cooldown period - ignore onset
          print("⏳ Native VAD: Onset ignored (cooldown: \(Int(timeSinceLastSegment))ms/\(cooldownPeriodMs)ms)")
        }
      }
    } else if !isRecordingSegment && onsetDetected {
      // ONSET: Wait for confirmation or timeout
      let timeSinceOnset = now.timeIntervalSince(onsetTime ?? now) * 1000
      
      if smoothedEnergy > confirmThreshold {
        print("🎤 Native VAD: Speech CONFIRMED (\(smoothedEnergy) > \(confirmThreshold)) - auto-starting segment")
        
        // Start recording segment
        onsetDetected = false
        lastSpeechTime = now
        recordingStartTime = now
        
        // Emit event to JS (for UI update - create pending card) - on main thread
        DispatchQueue.main.async { [weak self] in
          self?.sendEvent("onSegmentStart", [:])
        }
        
        // Start segment with preroll
        Task { [weak self] in
          guard let self = self else { return }
          do {
            try await self.startSegment(options: ["prerollMs": 1000])
          } catch {
            print("⚠️ Native VAD: Failed to start segment: \(error.localizedDescription)")
          }
        }
      } else if timeSinceOnset > 300 {
        // Timeout - false alarm
        print("⚠️ Native VAD: Onset timeout - false alarm")
        onsetDetected = false
      }
    } else if isRecordingSegment {
      // RECORDING: Monitor for silence
      guard let lastSpeech = lastSpeechTime,
            let recordingStart = recordingStartTime else { return }
      
      let silenceMs = now.timeIntervalSince(lastSpeech) * 1000
      let durationMs = now.timeIntervalSince(recordingStart) * 1000
      
      if silenceMs >= Double(vadSilenceDuration) && durationMs >= Double(vadMinSegmentDuration) {
        print("💤 Native VAD: \(Int(silenceMs))ms silence - auto-stopping segment")
        
        // Stop segment (will emit onSegmentComplete) - on main thread
        Task { [weak self] in
          guard let self = self else { return }
          do {
            try await self.stopSegment()
          } catch {
            print("⚠️ Native VAD: Failed to stop segment: \(error.localizedDescription)")
          }
        }
      }
    }
  }
  
  private func createPCMBuffer(from samples: [Float], format: AVAudioFormat) -> AVAudioPCMBuffer? {
    guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(samples.count)) else {
      return nil
    }
    
    buffer.frameLength = AVAudioFrameCount(samples.count)
    guard let channelData = buffer.floatChannelData else { return nil }
    
    for i in 0..<samples.count {
      channelData[0][i] = samples[i]
    }
    
    return buffer
  }
  
  private func startSegment(options: [String: Any]?) async throws {
    guard isActive else {
      throw NSError(domain: "MicrophoneEnergy", code: 1, userInfo: [NSLocalizedDescriptionKey: "Energy detection not active"])
    }
    
    guard !isRecordingSegment else {
      print("⚠️ Segment already recording, ignoring duplicate start")
      return
    }
    
    // Get preroll duration (default 500ms)
    let prerollMs = options?["prerollMs"] as? Int ?? 500
    
    // Create temp file path for segment (WAV format for consistency with Android)
    let tempDir = FileManager.default.temporaryDirectory
    let fileName = "segment_\(UUID().uuidString).wav"
    let fileURL = tempDir.appendingPathComponent(fileName)
    
    segmentFile = fileURL
    segmentStartTime = Date()
    
    // Get audio format from engine
    let inputNode = audioEngine.inputNode
    let format = inputNode.outputFormat(forBus: 0)
    
    // Copy preroll from ring buffer to segmentBuffers (like Android)
    ringBufferQueue.sync {
      let bufferSampleRate = format.sampleRate
      let samplesPerMs = bufferSampleRate / 1000.0
      let maxPrerollBuffers = Int(ceil(Double(prerollMs) / (1024.0 / samplesPerMs)))
      let buffersToWrite = min(ringBuffer.count, maxPrerollBuffers)
      
      segmentBuffersQueue.sync {
        segmentBuffers.removeAll()
        if buffersToWrite > 0 {
          let startIndex = ringBuffer.count - buffersToWrite
          segmentBuffers.append(contentsOf: ringBuffer[startIndex..<ringBuffer.count])
        }
      }
      
      print("📼 Preroll: \(buffersToWrite) chunks (~\(prerollMs)ms)")
    }
    
    // Start recording new audio (buffers will be collected in memory)
    isRecordingSegment = true
    print("🎬 Segment recording started with preroll")
  }
  
  private func stopSegment() async throws -> String? {
    guard isRecordingSegment else {
      print("⚠️ No segment recording active")
      return nil
    }
    
    isRecordingSegment = false
    
    // Record when segment ended for cooldown logic
    let endTime = Date()
    lastSegmentEndTime = endTime
    
    guard let fileURL = segmentFile else {
      segmentBuffersQueue.sync {
        segmentBuffers.removeAll()
      }
      return nil
    }
    
    let startTime = segmentStartTime ?? endTime
    let startTimeMs = startTime.timeIntervalSince1970 * 1000
    let endTimeMs = endTime.timeIntervalSince1970 * 1000
    let durationMs = endTimeMs - startTimeMs
    
    // Get audio format from engine
    let inputNode = audioEngine.inputNode
    let format = inputNode.outputFormat(forBus: 0)
    let sampleRate = Int(format.sampleRate)
    
    // Collect all buffers and calculate total samples
    var allBuffers: [[Float]] = []
    var totalSamples = 0
    
    segmentBuffersQueue.sync {
      allBuffers = segmentBuffers
      for buffer in segmentBuffers {
        totalSamples += buffer.count
      }
    }
    
    print("🎬 Writing WAV file: \(totalSamples) samples, \(Int(durationMs))ms")
    
    // Write WAV file synchronously (like Android)
    do {
      // Create file if it doesn't exist
      FileManager.default.createFile(atPath: fileURL.path, contents: nil, attributes: nil)
      let fileHandle = try FileHandle(forWritingTo: fileURL)
      defer {
        fileHandle.closeFile()
      }
      
      // Calculate data size (16-bit PCM = 2 bytes per sample)
      let dataSize = totalSamples * 2
      
      // Write WAV header
      writeWAVHeader(to: fileHandle, dataSize: UInt32(dataSize), sampleRate: sampleRate, channels: 1, bitsPerSample: 16)
      
      // Write all audio data (convert Float to Int16)
      for buffer in allBuffers {
        var pcmData = Data(capacity: buffer.count * 2)
        for sample in buffer {
          // Clamp sample to [-1.0, 1.0] and convert to Int16
          let clampedSample = max(-1.0, min(1.0, Double(sample)))
          let int16Sample = Int16(clampedSample * 32767.0)
          withUnsafeBytes(of: int16Sample.littleEndian) {
            pcmData.append(contentsOf: $0)
          }
        }
        fileHandle.write(pcmData)
      }
      
      fileHandle.synchronizeFile()
      
      print("✅ WAV file written: \(fileURL.path)")
      print("⏳ Cooldown active: \(cooldownPeriodMs)ms before next onset detection")
      
      // Clear buffers
      segmentBuffersQueue.sync {
        segmentBuffers.removeAll()
      }
      
      // Send completion event with file URI - on main thread
      let uri = fileURL.absoluteString
      DispatchQueue.main.async { [weak self] in
        guard let self = self else { return }
        self.sendEvent("onSegmentComplete", [
          "uri": uri,
          "startTime": startTimeMs,
          "endTime": endTimeMs,
          "duration": durationMs
        ])
      }
      
      segmentFile = nil
      segmentStartTime = nil
      
      return uri
    } catch {
      print("❌ Failed to write WAV file: \(error.localizedDescription)")
      segmentBuffersQueue.sync {
        segmentBuffers.removeAll()
      }
      segmentFile = nil
      segmentStartTime = nil
      throw NSError(domain: "MicrophoneEnergy", code: 3, userInfo: [NSLocalizedDescriptionKey: "Failed to write WAV file: \(error.localizedDescription)"])
    }
  }
  
  private func writeWAVHeader(to fileHandle: FileHandle, dataSize: UInt32, sampleRate: Int, channels: Int, bitsPerSample: Int) {
    var header = Data()
    
    // RIFF header
    header.append("RIFF".data(using: .ascii)!)
    header.append(contentsOf: withUnsafeBytes(of: UInt32(36 + dataSize).littleEndian) { Data($0) })
    header.append("WAVE".data(using: .ascii)!)
    
    // fmt chunk
    header.append("fmt ".data(using: .ascii)!)
    header.append(contentsOf: withUnsafeBytes(of: UInt32(16).littleEndian) { Data($0) }) // fmt chunk size
    header.append(contentsOf: withUnsafeBytes(of: UInt16(1).littleEndian) { Data($0) }) // Audio format (1 = PCM)
    header.append(contentsOf: withUnsafeBytes(of: UInt16(channels).littleEndian) { Data($0) })
    header.append(contentsOf: withUnsafeBytes(of: UInt32(sampleRate).littleEndian) { Data($0) })
    header.append(contentsOf: withUnsafeBytes(of: UInt32(sampleRate * channels * bitsPerSample / 8).littleEndian) { Data($0) }) // Byte rate
    header.append(contentsOf: withUnsafeBytes(of: UInt16(channels * bitsPerSample / 8).littleEndian) { Data($0) }) // Block align
    header.append(contentsOf: withUnsafeBytes(of: UInt16(bitsPerSample).littleEndian) { Data($0) })
    
    // data chunk
    header.append("data".data(using: .ascii)!)
    header.append(contentsOf: withUnsafeBytes(of: dataSize.littleEndian) { Data($0) })
    
    fileHandle.write(header)
  }