import ExpoModulesCore
import AVFoundation

public class MicrophoneEnergyModule: Module {
  private var audioEngine = AVAudioEngine()
  private var isActive = false
  
  // Ring buffer for capturing speech onset (500ms default)
  private var ringBuffer: [[Float]] = []
  private var ringBufferMaxSize = 16 // ~500ms at 1024 samples/buffer, 16kHz
  private var isRecordingSegment = false
  private var segmentFile: AVAudioFile?
  private var segmentStartTime: Date?
  
  public func definition() -> ModuleDefinition {
    Name("MicrophoneEnergy")
    
    Events("onEnergyResult", "onError", "onSegmentComplete")
    
    AsyncFunction("startEnergyDetection") {
      await self.startEnergyDetection()
    }
    
    AsyncFunction("stopEnergyDetection") {
      await self.stopEnergyDetection()
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
    
    audioEngine.inputNode.removeTap(onBus: 0)
    audioEngine.stop()
    
    do {
      try AVAudioSession.sharedInstance().setActive(false)
    } catch {
      print("Error deactivating audio session: \(error)")
    }
    
    isActive = false
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
    
    // Send pure energy level - let JavaScript decide everything
    sendEvent("onEnergyResult", [
      "energy": Double(energy),
      "timestamp": Date().timeIntervalSince1970 * 1000
    ])
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