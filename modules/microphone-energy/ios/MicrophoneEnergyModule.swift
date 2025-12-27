import ExpoModulesCore
import AVFoundation
import Foundation

public class MicrophoneEnergyModule: Module {
    private var audioEngine: AVAudioEngine?
    private var inputNode: AVAudioInputNode?
    private var isActive = false
    private var audioConverter: AVAudioConverter?
    private var desiredFormat: AVAudioFormat?
    
    // Ring buffer for capturing speech onset (200ms preroll)
    // Store tuples of (buffer, timestamp) to enable time-based clearing
    private struct RingBufferEntry {
        let buffer: AVAudioPCMBuffer
        let timestamp: TimeInterval
    }
    private var ringBuffer: [RingBufferEntry] = []
    private let ringBufferMaxSize = 7 // ~200ms at typical buffer sizes
    private var isRecordingSegment = false
    private var segmentFile: URL?
    private var segmentStartTime: TimeInterval = 0
    
    // Segment audio data collected in memory
    private var segmentBuffers: [AVAudioPCMBuffer] = []
    
    // Native VAD state
    private var vadEnabled = false
    private var vadThreshold: Float = 0.5
    private var vadOnsetMultiplier: Float = 0.25
    private var vadConfirmMultiplier: Float = 0.5
    private var vadSilenceDuration: Int = 300 // ms
    private var vadMinSegmentDuration: Int = 500 // ms
    
    // EMA smoothing
    private let emaAlpha: Float = 0.3
    private var smoothedEnergy: Float = 0.0
    
    // Schmitt trigger state
    private var onsetDetected = false
    private var onsetTime: TimeInterval = 0
    private var lastSpeechTime: TimeInterval = 0
    private var recordingStartTime: TimeInterval = 0
    private var lastSegmentEndTime: TimeInterval = 0 // Track when last segment ended
    private let cooldownPeriodMs: TimeInterval = 500 // Cooldown after segment ends before detecting new onset
    
    private let sampleRate: Double = 44100
    
    public func definition() -> ModuleDefinition {
        Name("MicrophoneEnergy")
        
        Events("onEnergyResult", "onError", "onSegmentComplete", "onSegmentStart")
        
        AsyncFunction("startEnergyDetection") { () -> Void in
            try await self.startEnergyDetection()
        }
        
        AsyncFunction("stopEnergyDetection") { () -> Void in
            try await self.stopEnergyDetection()
        }
        
        AsyncFunction("configureVAD") { (config: [String: Any?]) -> Void in
            self.configureVAD(config: config)
        }
        
        AsyncFunction("enableVAD") { () -> Void in
            self.enableVAD()
        }
        
        AsyncFunction("disableVAD") { () -> Void in
            self.disableVAD()
        }
        
        AsyncFunction("startSegment") { (options: [String: Any?]?) -> Void in
            try await self.startSegment(options: options)
        }
        
        AsyncFunction("stopSegment") { () -> String? in
            return try await self.stopSegment()
        }
    }
    
    private func startEnergyDetection() async throws {
        if isActive {
            // Restart: stop current detection first
            await stopEnergyDetectionInternal()
        }
        
        // Request microphone permission
        let audioSession = AVAudioSession.sharedInstance()
        
        // Check and request permission
        let permissionGranted = await withCheckedContinuation { continuation in
            audioSession.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
        guard permissionGranted else {
            let error = NSError(domain: "MicrophoneEnergy", code: 1, userInfo: [NSLocalizedDescriptionKey: "Microphone permission not granted"])
            sendEvent("onError", ["message": "Microphone permission not granted"])
            throw error
        }
        
        do {
            // Configure audio session with optimized settings for recording
            // Use .playAndRecord to allow both recording and playback if needed
            // Allow Bluetooth devices for better microphone selection
            // Use .defaultToSpeaker to route audio to speaker when not using headphones
            try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP])
            try audioSession.setActive(true)
            
            // Create audio engine
            audioEngine = AVAudioEngine()
            guard let engine = audioEngine else {
                throw NSError(domain: "MicrophoneEnergy", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to create audio engine"])
            }
            
            inputNode = engine.inputNode
            guard let input = inputNode else {
                throw NSError(domain: "MicrophoneEnergy", code: 3, userInfo: [NSLocalizedDescriptionKey: "Failed to get input node"])
            }
            
            let inputFormat = input.inputFormat(forBus: 0)
            
            // Convert to desired sample rate if needed
            desiredFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: sampleRate, channels: 1, interleaved: false)
            
            // Only create converter if formats differ
            if inputFormat.sampleRate != sampleRate || inputFormat.channelCount != 1 {
                guard let desired = desiredFormat else {
                    throw NSError(domain: "MicrophoneEnergy", code: 4, userInfo: [NSLocalizedDescriptionKey: "Failed to create desired audio format"])
                }
                guard let converter = AVAudioConverter(from: inputFormat, to: desired) else {
                    throw NSError(domain: "MicrophoneEnergy", code: 5, userInfo: [NSLocalizedDescriptionKey: "Failed to create audio converter"])
                }
                audioConverter = converter
            }
            
            // Optimize buffer size for 44100 Hz sample rate
            // At 44100 Hz, 2048 frames = ~46ms, which is good for low latency
            // Keeping 2048 frames maintains good balance between latency and efficiency
            let bufferSize: AVAudioFrameCount = 2048
            
            // Install tap on input node
            input.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) { [weak self] (buffer, time) in
                guard let self = self else { return }
                
                let timestamp = Date().timeIntervalSince1970 * 1000 // milliseconds
                
                // Convert buffer if needed
                if let converter = self.audioConverter, let desired = self.desiredFormat {
                    // Convert to desired format
                    guard let convertedBuffer = AVAudioPCMBuffer(pcmFormat: desired, frameCapacity: buffer.frameLength) else { return }
                    
                    var error: NSError?
                    var inputProvided = false
                    let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
                        if !inputProvided {
                            outStatus.pointee = .haveData
                            inputProvided = true
                            return buffer
                        } else {
                            outStatus.pointee = .noDataNow
                            return nil
                        }
                    }
                    
                    converter.convert(to: convertedBuffer, error: &error, withInputFrom: inputBlock)
                    
                    if error == nil && convertedBuffer.frameLength > 0 {
                        self.processAudioData(buffer: convertedBuffer, timestamp: timestamp)
                    }
                } else {
                    // Use buffer directly if no conversion needed
                    self.processAudioData(buffer: buffer, timestamp: timestamp)
                }
            }
            
            // Start audio engine
            try engine.start()
            isActive = true
            
        } catch {
            sendEvent("onError", ["message": "Failed to start energy detection: \(error.localizedDescription)"])
            throw error
        }
    }
    
    private func stopEnergyDetection() async throws {
        if !isActive {
            return
        }
        
        await stopEnergyDetectionInternal()
    }
    
    private func stopEnergyDetectionInternal() async {
        isActive = false
        vadEnabled = false
        onsetDetected = false
        
        // Stop any active segment
        if isRecordingSegment {
            do {
                _ = try await stopSegment()
            } catch {
                // Ignore errors when stopping segment during shutdown
            }
        }
        
        // Remove tap and stop engine
        inputNode?.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        inputNode = nil
        audioConverter = nil
        desiredFormat = nil
        
        // Deactivate audio session
        do {
            try AVAudioSession.sharedInstance().setActive(false)
        } catch {
            // Ignore errors when deactivating session
        }
    }
    
    private func configureVAD(config: [String: Any?]) {
        if let threshold = config["threshold"] as? NSNumber {
            vadThreshold = threshold.floatValue
        }
        if let silenceDuration = config["silenceDuration"] as? NSNumber {
            vadSilenceDuration = silenceDuration.intValue
        }
        if let onsetMultiplier = config["onsetMultiplier"] as? NSNumber {
            vadOnsetMultiplier = onsetMultiplier.floatValue
        }
        if let confirmMultiplier = config["confirmMultiplier"] as? NSNumber {
            vadConfirmMultiplier = confirmMultiplier.floatValue
        }
        if let minSegmentDuration = config["minSegmentDuration"] as? NSNumber {
            vadMinSegmentDuration = minSegmentDuration.intValue
        }
        
        print("🎯 VAD configured: threshold=\(vadThreshold), silence=\(vadSilenceDuration)ms")
    }
    
    private func enableVAD() {
        vadEnabled = true
        onsetDetected = false
        smoothedEnergy = 0.0
        lastSegmentEndTime = 0 // Reset cooldown when VAD enabled
        print("🎯 Native VAD enabled")
    }
    
    private func disableVAD() {
        vadEnabled = false
        onsetDetected = false
        
        // Stop any active segment
        if isRecordingSegment {
            Task {
                do {
                    _ = try await stopSegment()
                } catch {
                    // Ignore errors
                }
            }
        }
        
        print("🎯 Native VAD disabled")
    }
    
    private func processAudioData(buffer: AVAudioPCMBuffer, timestamp: TimeInterval) {
        let now = timestamp
        
        // Calculate peak amplitude (max absolute value) - matching expo-av's approach
        // expo-av uses getMaxAmplitude() which returns peak, not RMS
        // Handle both Int16 and Float32 formats
        var peakAmplitude: Double = 0.0
        let frameLength = Int(buffer.frameLength)
        
        if let int16Data = buffer.int16ChannelData {
            let channelDataPointer = int16Data.pointee
            for i in 0..<frameLength {
                let sample = abs(Double(channelDataPointer[i]) / 32768.0) // Normalize to 0-1.0, take absolute
                peakAmplitude = max(peakAmplitude, sample)
            }
        } else if let float32Data = buffer.floatChannelData {
            let channelDataPointer = float32Data.pointee
            for i in 0..<frameLength {
                let sample = abs(Double(channelDataPointer[i])) // Take absolute value
                peakAmplitude = max(peakAmplitude, sample)
            }
        } else {
            return // Unsupported format
        }
        
        // Convert peak amplitude to dB using expo-av's formula
        // expo-av: dB = 20 * log10(amplitude / 32767) for Android
        // For normalized amplitude (0-1), we use reference of 1.0
        // dB = 20 * log10(peakAmplitude / 1.0) = 20 * log10(peakAmplitude)
        let minDb: Double = -60.0  // Match expo-av's minimum dB
        let maxDb: Double = 0.0    // Match expo-av's maximum dB
        
        // Convert peak amplitude to dB
        // Add small epsilon to avoid log(0)
        let epsilon: Double = 1e-10
        let db = 20.0 * log10(max(peakAmplitude, epsilon))
        
        // Clamp dB to expo-av's range (-60 to 0)
        let clampedDb = max(minDb, min(maxDb, db))
        
        // Convert dB back to amplitude (matching expo-av's conversion)
        // amplitude = 10^(dB/20)
        let amplitude = pow(10.0, clampedDb / 20.0)
        
        // Apply EMA smoothing on the amplitude (to match expo-av's output range)
        smoothedEnergy = emaAlpha * Float(amplitude) + (1.0 - emaAlpha) * smoothedEnergy
        
        // Create a copy of the buffer for ring buffer
        guard let bufferCopy = AVAudioPCMBuffer(pcmFormat: buffer.format, frameCapacity: buffer.frameCapacity) else { return }
        bufferCopy.frameLength = buffer.frameLength
        
        // Copy audio data
        if let srcInt16 = buffer.int16ChannelData, let dstInt16 = bufferCopy.int16ChannelData {
            memcpy(dstInt16.pointee, srcInt16.pointee, frameLength * MemoryLayout<Int16>.size)
        } else if let srcFloat32 = buffer.floatChannelData, let dstFloat32 = bufferCopy.floatChannelData {
            memcpy(dstFloat32.pointee, srcFloat32.pointee, frameLength * MemoryLayout<Float32>.size)
        }
        
        // Manage ring buffer (always buffer when not recording segment)
        if !isRecordingSegment {
            ringBuffer.append(RingBufferEntry(buffer: bufferCopy, timestamp: now))
            if ringBuffer.count > ringBufferMaxSize {
                ringBuffer.removeFirst()
            }
        }
        
        // If recording a segment, collect in memory
        if isRecordingSegment {
            segmentBuffers.append(bufferCopy)
        }
        
        // Native VAD logic (if enabled)
        if vadEnabled {
            handleNativeVAD(now: now)
        }
        
        // Send energy level to JavaScript (for UI visualization)
        sendEvent("onEnergyResult", [
            "energy": smoothedEnergy,
            "timestamp": now
        ])
    }
    
    private func handleNativeVAD(now: TimeInterval) {
        let onsetThreshold = vadThreshold * vadOnsetMultiplier
        let confirmThreshold = vadThreshold * vadConfirmMultiplier
        
        // Update last speech time if above confirm threshold
        if smoothedEnergy > confirmThreshold {
            lastSpeechTime = now
        }
        
        // State machine
        if !isRecordingSegment && !onsetDetected {
            // IDLE: Check for onset (with cooldown to prevent rapid re-triggers)
            let timeSinceLastSegment = now - lastSegmentEndTime
            if smoothedEnergy > onsetThreshold {
                if timeSinceLastSegment >= cooldownPeriodMs || lastSegmentEndTime == 0 {
                    print("🎯 Native VAD: Onset detected (\(smoothedEnergy) > \(onsetThreshold))")
                    onsetDetected = true
                    onsetTime = now
                } else {
                    // Still in cooldown period - ignore onset
                    print("⏳ Native VAD: Onset ignored (cooldown: \(Int(timeSinceLastSegment))ms/\(Int(cooldownPeriodMs))ms)")
                }
            }
        } else if !isRecordingSegment && onsetDetected {
            // ONSET: Wait for confirmation or timeout
            let timeSinceOnset = now - onsetTime
            
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
                    do {
                        try await startSegment(options: ["prerollMs": 200])
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
            let silenceMs = now - lastSpeechTime
            let durationMs = now - recordingStartTime
            
            if silenceMs >= Double(vadSilenceDuration) && durationMs >= Double(vadMinSegmentDuration) {
                print("💤 Native VAD: \(Int(silenceMs))ms silence - auto-stopping segment")
                
                // Stop segment (will emit onSegmentComplete)
                Task {
                    do {
                        _ = try await stopSegment()
                    } catch {
                        print("⚠️ Native VAD: Failed to stop segment: \(error.localizedDescription)")
                    }
                }
            }
        }
    }
    
    private func startSegment(options: [String: Any?]?) async throws {
        guard isActive else {
            throw NSError(domain: "MicrophoneEnergy", code: 4, userInfo: [NSLocalizedDescriptionKey: "Energy detection not active"])
        }
        
        if isRecordingSegment {
            print("⚠️ Segment already recording, ignoring duplicate start")
            return
        }
        
        // Get preroll duration (default 200ms)
        let prerollMs = (options?["prerollMs"] as? NSNumber)?.intValue ?? 200
        
        // Create temp file for segment (WAV format for compatibility)
        let tempDir = FileManager.default.temporaryDirectory
        let fileName = "segment_\(UUID().uuidString).wav"
        let fileURL = tempDir.appendingPathComponent(fileName)
        
        segmentFile = fileURL
        segmentStartTime = Date().timeIntervalSince1970 * 1000 // milliseconds
        
        // Copy preroll from ring buffer
        let samplesPerMs = sampleRate / 1000.0
        let typicalBufferSize = 2048.0
        let maxPrerollBuffers = Int(Double(prerollMs) / (typicalBufferSize / samplesPerMs))
        let buffersToWrite = min(ringBuffer.count, maxPrerollBuffers)
        
        segmentBuffers.removeAll()
        // Copy buffers (not entries) from ring buffer
        for entry in ringBuffer.suffix(buffersToWrite) {
            segmentBuffers.append(entry.buffer)
        }
        
        // Don't clear ring buffer here - it will be cleared on segment end up to that point
        print("📼 Preroll: \(buffersToWrite) chunks (~\(prerollMs)ms)")
        
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
        lastSegmentEndTime = Date().timeIntervalSince1970 * 1000 // milliseconds
        
        guard let fileURL = segmentFile else {
            segmentBuffers.removeAll()
            // Clear ring buffer up to segment end time
            let clearUpToTime = lastSegmentEndTime + 50 // Clear up to 50ms after segment end
            ringBuffer.removeAll { entry in
                entry.timestamp <= clearUpToTime
            }
            return nil
        }
        
        let startTime = segmentStartTime
        let endTime = lastSegmentEndTime
        let duration = endTime - startTime
        
        // Calculate total samples
        var totalSamples = 0
        for buffer in segmentBuffers {
            totalSamples += Int(buffer.frameLength)
        }
        
        let dataSize = totalSamples * 2 // 16-bit = 2 bytes per sample
        
        print("🎬 Writing WAV file: \(totalSamples) samples, \(Int(duration))ms")
        
        // Create file if it doesn't exist
        if !FileManager.default.fileExists(atPath: fileURL.path) {
            FileManager.default.createFile(atPath: fileURL.path, contents: nil, attributes: nil)
        }
        
        // Write WAV file
        let fileHandle = try FileHandle(forWritingTo: fileURL)
        defer { try? fileHandle.close() }
        
        // Truncate file to start fresh
        try fileHandle.truncate(atOffset: 0)
        
        // Write WAV header
        try writeWAVHeader(fileHandle: fileHandle, dataSize: Int64(dataSize), sampleRate: Int(sampleRate), channels: 1, bitsPerSample: 16)
        
        // Write all audio data
        for buffer in segmentBuffers {
            let frameLength = Int(buffer.frameLength)
            
            if let int16Data = buffer.int16ChannelData {
                let channelDataPointer = int16Data.pointee
                let audioData = Data(bytes: channelDataPointer, count: frameLength * MemoryLayout<Int16>.size)
                try fileHandle.write(contentsOf: audioData)
            } else if let float32Data = buffer.floatChannelData {
                // Convert Float32 to Int16
                let channelDataPointer = float32Data.pointee
                var int16Samples = [Int16](repeating: 0, count: frameLength)
                for i in 0..<frameLength {
                    let floatSample = channelDataPointer[i]
                    let clampedSample = max(-1.0, min(1.0, Double(floatSample)))
                    int16Samples[i] = Int16(clampedSample * 32767.0)
                }
                let audioData = Data(bytes: int16Samples, count: frameLength * MemoryLayout<Int16>.size)
                try fileHandle.write(contentsOf: audioData)
            }
        }
        
        try fileHandle.synchronize()
        
        print("✅ WAV file written: \(fileURL.path)")
        print("⏳ Cooldown active: \(Int(cooldownPeriodMs))ms before next onset detection")
        
        // Send completion event with file URI
        // fileURL.path returns absolute path like "/Users/.../tmp/segment.wav"
        // We need "file:///Users/..." (3 slashes total: file:// + /Users/...)
        let pathString = fileURL.path
        // Ensure path starts with / for absolute paths
        let normalizedPath = pathString.hasPrefix("/") ? pathString : "/\(pathString)"
        // Create file:// URI with exactly 3 slashes total
        let uri = "file://\(normalizedPath)"
        
        sendEvent("onSegmentComplete", [
            "uri": uri,
            "startTime": startTime,
            "endTime": endTime,
            "duration": duration
        ])
        
        segmentFile = nil
        segmentBuffers.removeAll()
        
        // Clear ring buffer only up to segment end time (+ small margin)
        // This preserves audio that came after segment end (start of next segment)
        let clearUpToTime = endTime + 50 // Clear up to 50ms after segment end
        let initialCount = ringBuffer.count
        ringBuffer.removeAll { entry in
            entry.timestamp <= clearUpToTime
        }
        let clearedCount = initialCount - ringBuffer.count
        print("🗑️ Ring buffer: cleared \(clearedCount) entries up to segment end, preserved \(ringBuffer.count) entries")
        
        return uri
    }
    
    private func writeWAVHeader(fileHandle: FileHandle, dataSize: Int64, sampleRate: Int, channels: Int, bitsPerSample: Int) throws {
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
        header.append(contentsOf: withUnsafeBytes(of: UInt32(dataSize).littleEndian) { Data($0) })
        
        try fileHandle.write(contentsOf: header)
    }
}
