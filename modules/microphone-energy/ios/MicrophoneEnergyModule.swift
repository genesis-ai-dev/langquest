import ExpoModulesCore
import AVFoundation

public class MicrophoneEnergyModule: Module {
  private var audioEngine = AVAudioEngine()
  private var isActive = false
  
  // Ring buffer for capturing speech onset (1000ms for better onset capture)
  private var ringBuffer: [[Float]] = []
  private var ringBufferMaxSize = 32 // ~1000ms at 1024 samples/buffer, 16kHz (~64ms per buffer)
  private var isRecordingSegment = false
  private var segmentFile: AVAudioFile?
  private var segmentStartTime: Date?
  
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
      sendEvent("onError", ["message": "Failed to start energy detection: \(error.localizedDescription)"])
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
    
    // Manage ring buffer (always buffer when not recording segment)
    if !isRecordingSegment {
      ringBuffer.append(samplesArray)
      if ringBuffer.count > ringBufferMaxSize {
        ringBuffer.removeFirst()
      }
    }
    
    // If recording a segment, write buffer to file
    if isRecordingSegment, let audioFile = segmentFile {
      // Write current buffer to file
      if let pcmBuffer = createPCMBuffer(from: samplesArray, format: buffer.format) {
        try? audioFile.write(from: pcmBuffer)
      }
    }
    
    // Native VAD logic (if enabled)
    if vadEnabled {
      handleNativeVAD()
    }
    
    // Send energy level to JavaScript (for UI visualization)
    sendEvent("onEnergyResult", [
      "energy": Double(smoothedEnergy),
      "timestamp": Date().timeIntervalSince1970 * 1000
    ])
  }
  
  private func handleNativeVAD() {
    let now = Date()
    let onsetThreshold = vadThreshold * vadOnsetMultiplier
    let confirmThreshold = vadThreshold * vadConfirmMultiplier
    
    // Update last speech time if above confirm threshold
    if smoothedEnergy > confirmThreshold {
      lastSpeechTime = now
    }
    
    // State machine
    if !isRecordingSegment && !onsetDetected {
      // IDLE: Check for onset
      if smoothedEnergy > onsetThreshold {
        print("🎯 Native VAD: Onset detected (\(smoothedEnergy) > \(onsetThreshold))")
        onsetDetected = true
        onsetTime = now
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
        
        // Emit event to JS (for UI update - create pending card)
        sendEvent("onSegmentStart", [:])
        
        // Start segment with preroll
        Task {
          try? await startSegment(options: ["prerollMs": 1000])
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
        
        // Stop segment (will emit onSegmentComplete)
        Task {
          try? await stopSegment()
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
    
    // Create temp file for segment (use .m4a for compatibility)
    let tempDir = FileManager.default.temporaryDirectory
    let fileName = "segment_\(UUID().uuidString).m4a"
    let fileURL = tempDir.appendingPathComponent(fileName)
    
    // Get audio format from engine
    let inputNode = audioEngine.inputNode
    let format = inputNode.outputFormat(forBus: 0)
    
    // Create audio file
    let settings: [String: Any] = [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVSampleRateKey: format.sampleRate,
      AVNumberOfChannelsKey: format.channelCount,
      AVLinearPCMBitDepthKey: 32,
      AVLinearPCMIsFloatKey: true
    ]
    
    guard let outputFormat = AVAudioFormat(settings: settings) else {
      throw NSError(domain: "MicrophoneEnergy", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to create output format"])
    }
    
    segmentFile = try AVAudioFile(forWriting: fileURL, settings: outputFormat.settings)
    segmentStartTime = Date()
    
    // Write buffered audio to file (preroll)
    let bufferSampleRate = format.sampleRate
    let samplesPerMs = bufferSampleRate / 1000.0
    let maxPrerollBuffers = Int(ceil(Double(prerollMs) / (1024.0 / samplesPerMs)))
    let buffersToWrite = min(ringBuffer.count, maxPrerollBuffers)
    
    print("📼 Writing \(buffersToWrite) buffered chunks (~\(prerollMs)ms preroll)")
    
    for i in (ringBuffer.count - buffersToWrite)..<ringBuffer.count {
      if let pcmBuffer = createPCMBuffer(from: ringBuffer[i], format: format) {
        try? segmentFile?.write(from: pcmBuffer)
      }
    }
    
    // Start recording new audio
    isRecordingSegment = true
    print("🎬 Segment recording started with \(buffersToWrite) preroll buffers")
  }
  
  private func stopSegment() async throws -> String? {
    guard isRecordingSegment else {
      print("⚠️ No segment recording active")
      return nil
    }
    
    isRecordingSegment = false
    
    guard let audioFile = segmentFile else {
      return nil
    }
    
    let fileURL = audioFile.url
    let startTime = segmentStartTime?.timeIntervalSince1970 ?? 0
    let endTime = Date().timeIntervalSince1970
    let duration = endTime - startTime
    
    // Close file
    segmentFile = nil
    segmentStartTime = nil
    
    print("🎬 Segment recording stopped, duration: \(duration)s")
    
    // Send completion event with file URI
    sendEvent("onSegmentComplete", [
      "uri": fileURL.absoluteString,
      "startTime": startTime * 1000,
      "endTime": endTime * 1000,
      "duration": duration * 1000
    ])
    
    return fileURL.absoluteString
  }
}