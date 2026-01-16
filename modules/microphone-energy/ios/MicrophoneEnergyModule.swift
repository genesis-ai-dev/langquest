import ExpoModulesCore
import AVFoundation
import Foundation

/**
 * New VAD Algorithm - Simple Threshold with Pre-Onset Buffer
 * 
 * Key differences from old module (MicrophoneEnergyModule.old.swift):
 * - No EMA smoothing - uses raw peak amplitude for immediate response
 * - Pre-onset buffer tracking - continuously tracks a safe cut point
 * - Three-state machine: IDLE -> ONSET_PENDING -> RECORDING
 * - Async file writing - no blocking, no cooldown needed
 * - Ring buffer always fills (not paused during recording)
 */
public class MicrophoneEnergyModule: Module {
    private var audioEngine: AVAudioEngine?
    private var inputNode: AVAudioInputNode?
    private var isActive = false
    private var audioConverter: AVAudioConverter?
    private var desiredFormat: AVAudioFormat?
    
    private struct RingBufferEntry {
        let buffer: AVAudioPCMBuffer
        let timestamp: TimeInterval
    }
    private var ringBuffer: [RingBufferEntry] = []
    private let ringBufferMaxSize = 10
    
    private var isRecordingSegment = false
    private var segmentFile: URL?
    private var segmentStartTime: TimeInterval = 0
    private var segmentBuffers: [AVAudioPCMBuffer] = []
    
    private let sampleRate: Double = 44100
    
    // VAD configuration
    private var vadEnabled = false
    private var vadThreshold: Float = 0.05
    private var vadOnsetMultiplier: Float = 0.1
    private var vadMaxOnsetDuration: Int = 250
    private var vadSilenceDuration: Int = 300
    private var vadMinSegmentDuration: Int = 500
    private var vadRewindHalfPause = true
    private var vadMinActiveAudioDuration: Int = 250  // Discard clips with less active audio than this
    
    // VAD state machine
    private var vadState = "IDLE"
    private var preOnsetCutPoint: TimeInterval = 0
    private var lockedOnsetTime: TimeInterval = 0
    private var lastAboveThresholdTime: TimeInterval = 0
    private var recordingStartTime: TimeInterval = 0
    private var activeAudioTime: TimeInterval = 0  // Cumulative time above threshold during recording
    private var lastFrameTime: TimeInterval = 0    // For calculating delta time
    
    public func definition() -> ModuleDefinition {
        Name("MicrophoneEnergy")
        Events("onEnergyResult", "onError", "onSegmentComplete", "onSegmentStart")
        
        AsyncFunction("startEnergyDetection") { () -> Void in try await self.startEnergyDetection() }
        AsyncFunction("stopEnergyDetection") { () -> Void in try await self.stopEnergyDetection() }
        AsyncFunction("configureVAD") { (config: [String: Any?]) -> Void in self.configureVAD(config: config) }
        AsyncFunction("enableVAD") { () -> Void in self.enableVAD() }
        AsyncFunction("disableVAD") { () -> Void in self.disableVAD() }
        AsyncFunction("startSegment") { (options: [String: Any?]?) -> Void in try await self.startSegment(options: options) }
        AsyncFunction("stopSegment") { () -> String? in return try await self.stopSegment() }
    }
    
    private func startEnergyDetection() async throws {
        if isActive { await stopEnergyDetectionInternal() }
        
        let audioSession = AVAudioSession.sharedInstance()
        let permissionGranted = await withCheckedContinuation { continuation in
            audioSession.requestRecordPermission { granted in continuation.resume(returning: granted) }
        }
        guard permissionGranted else {
            sendEvent("onError", ["message": "Microphone permission not granted"])
            throw NSError(domain: "MicrophoneEnergy", code: 1, userInfo: [NSLocalizedDescriptionKey: "Microphone permission not granted"])
        }
        
        do {
            try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP])
            try audioSession.setActive(true)
            
            audioEngine = AVAudioEngine()
            guard let engine = audioEngine else { throw NSError(domain: "MicrophoneEnergy", code: 2, userInfo: nil) }
            
            inputNode = engine.inputNode
            guard let input = inputNode else { throw NSError(domain: "MicrophoneEnergy", code: 3, userInfo: nil) }
            
            let inputFormat = input.inputFormat(forBus: 0)
            desiredFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: sampleRate, channels: 1, interleaved: false)
            
            if inputFormat.sampleRate != sampleRate || inputFormat.channelCount != 1 {
                if let desired = desiredFormat {
                    audioConverter = AVAudioConverter(from: inputFormat, to: desired)
                }
            }
            
            let bufferSize: AVAudioFrameCount = 2048
            input.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) { [weak self] (buffer, time) in
                guard let self = self else { return }
                let timestamp = Date().timeIntervalSince1970 * 1000
                
                if let converter = self.audioConverter, let desired = self.desiredFormat {
                    guard let convertedBuffer = AVAudioPCMBuffer(pcmFormat: desired, frameCapacity: buffer.frameLength) else { return }
                    var inputProvided = false
                    let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
                        if !inputProvided { outStatus.pointee = .haveData; inputProvided = true; return buffer }
                        else { outStatus.pointee = .noDataNow; return nil }
                    }
                    var error: NSError?
                    converter.convert(to: convertedBuffer, error: &error, withInputFrom: inputBlock)
                    if error == nil && convertedBuffer.frameLength > 0 { self.processAudioData(buffer: convertedBuffer, timestamp: timestamp) }
                } else {
                    self.processAudioData(buffer: buffer, timestamp: timestamp)
                }
            }
            
            try engine.start()
            isActive = true
        } catch {
            sendEvent("onError", ["message": "Failed to start: \(error.localizedDescription)"])
            throw error
        }
    }
    
    private func stopEnergyDetection() async throws {
        if !isActive { return }
        await stopEnergyDetectionInternal()
    }
    
    private func stopEnergyDetectionInternal() async {
        isActive = false
        vadEnabled = false
        vadState = "IDLE"
        
        if isRecordingSegment {
            do { _ = try await stopSegment() } catch {}
        }
        
        inputNode?.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        inputNode = nil
        audioConverter = nil
        desiredFormat = nil
        
        do { try AVAudioSession.sharedInstance().setActive(false) } catch {}
    }
    
    private func configureVAD(config: [String: Any?]) {
        if let threshold = config["threshold"] as? NSNumber { vadThreshold = threshold.floatValue }
        if let silenceDuration = config["silenceDuration"] as? NSNumber { vadSilenceDuration = silenceDuration.intValue }
        if let minSegmentDuration = config["minSegmentDuration"] as? NSNumber { vadMinSegmentDuration = minSegmentDuration.intValue }
        if let onsetMultiplier = config["onsetMultiplier"] as? NSNumber { vadOnsetMultiplier = onsetMultiplier.floatValue }
        if let maxOnsetDuration = config["maxOnsetDuration"] as? NSNumber { vadMaxOnsetDuration = maxOnsetDuration.intValue }
        if let rewindHalfPause = config["rewindHalfPause"] as? Bool { vadRewindHalfPause = rewindHalfPause }
        if let minActiveAudioDuration = config["minActiveAudioDuration"] as? NSNumber { vadMinActiveAudioDuration = minActiveAudioDuration.intValue }
    }
    
    private func enableVAD() {
        vadEnabled = true
        vadState = "IDLE"
        preOnsetCutPoint = 0
        lockedOnsetTime = 0
        lastAboveThresholdTime = 0
    }
    
    private func disableVAD() {
        vadEnabled = false
        vadState = "IDLE"
        if isRecordingSegment {
            Task { do { _ = try await stopSegment() } catch {} }
        }
    }
    
    private func processAudioData(buffer: AVAudioPCMBuffer, timestamp: TimeInterval) {
        let now = timestamp
        let frameLength = Int(buffer.frameLength)
        
        var peakAmplitude: Double = 0.0
        if let int16Data = buffer.int16ChannelData {
            let channelDataPointer = int16Data.pointee
            for i in 0..<frameLength {
                let sample = abs(Double(channelDataPointer[i]) / 32768.0)
                peakAmplitude = max(peakAmplitude, sample)
            }
        } else if let float32Data = buffer.floatChannelData {
            let channelDataPointer = float32Data.pointee
            for i in 0..<frameLength {
                peakAmplitude = max(peakAmplitude, abs(Double(channelDataPointer[i])))
            }
        } else { return }
        
        let db = 20.0 * log10(max(peakAmplitude, 1e-10))
        let clampedDb = max(-60.0, min(0.0, db))
        let normalizedAmplitude = Float(pow(10.0, clampedDb / 20.0))
        
        guard let bufferCopy = AVAudioPCMBuffer(pcmFormat: buffer.format, frameCapacity: buffer.frameCapacity) else { return }
        bufferCopy.frameLength = buffer.frameLength
        if let srcInt16 = buffer.int16ChannelData, let dstInt16 = bufferCopy.int16ChannelData {
            memcpy(dstInt16.pointee, srcInt16.pointee, frameLength * MemoryLayout<Int16>.size)
        } else if let srcFloat32 = buffer.floatChannelData, let dstFloat32 = bufferCopy.floatChannelData {
            memcpy(dstFloat32.pointee, srcFloat32.pointee, frameLength * MemoryLayout<Float32>.size)
        }
        
        ringBuffer.append(RingBufferEntry(buffer: bufferCopy, timestamp: now))
        if ringBuffer.count > ringBufferMaxSize { ringBuffer.removeFirst() }
        
        if isRecordingSegment { segmentBuffers.append(bufferCopy) }
        if vadEnabled { handleVAD(rawPeak: normalizedAmplitude, now: now) }
        
        sendEvent("onEnergyResult", ["energy": normalizedAmplitude, "timestamp": now])
    }
    
    private func handleVAD(rawPeak: Float, now: TimeInterval) {
        let onsetThreshold = vadThreshold * vadOnsetMultiplier
        
        if rawPeak > vadThreshold { lastAboveThresholdTime = now }
        
        switch vadState {
        case "IDLE":
            preOnsetCutPoint = max(0, now - TimeInterval(vadMaxOnsetDuration))
            if rawPeak > onsetThreshold {
                vadState = "ONSET_PENDING"
                lockedOnsetTime = preOnsetCutPoint
                if rawPeak > vadThreshold { confirmAndStartRecording(now: now) }
            }
        case "ONSET_PENDING":
            if now - lockedOnsetTime > TimeInterval(vadMaxOnsetDuration) { lockedOnsetTime = now - TimeInterval(vadMaxOnsetDuration) }
            if rawPeak > vadThreshold { confirmAndStartRecording(now: now) }
            else if rawPeak <= onsetThreshold { vadState = "IDLE" }
        case "RECORDING":
            // Track cumulative time above threshold
            let deltaMs = now - lastFrameTime
            if rawPeak > vadThreshold {
                activeAudioTime += deltaMs
            }
            lastFrameTime = now
            
            let silenceMs = now - lastAboveThresholdTime
            let durationMs = now - recordingStartTime
            if silenceMs >= TimeInterval(vadSilenceDuration) && durationMs >= TimeInterval(vadMinSegmentDuration) {
                stopRecordingAsync()
            }
        default: break
        }
    }
    
    private func confirmAndStartRecording(now: TimeInterval) {
        vadState = "RECORDING"
        lastAboveThresholdTime = now
        recordingStartTime = now
        activeAudioTime = 0  // Reset active audio tracking
        lastFrameTime = now
        sendEvent("onSegmentStart", [:])
        let prerollMs = Int(now - lockedOnsetTime)
        Task { do { try await startSegment(options: ["prerollMs": prerollMs]) } catch {} }
    }
    
    private func stopRecordingAsync() {
        guard isRecordingSegment else { return }
        isRecordingSegment = false
        vadState = "IDLE"
        
        // Check if enough active audio - discard transients/short sounds
        if activeAudioTime < TimeInterval(vadMinActiveAudioDuration) {
            print("VAD: Discarding segment - only \(Int(activeAudioTime))ms of active audio (min: \(vadMinActiveAudioDuration)ms)")
            segmentBuffers.removeAll()
            if let fileURL = segmentFile {
                try? FileManager.default.removeItem(at: fileURL)  // Clean up temp file
            }
            segmentFile = nil
            
            // Emit empty URI to notify JS that recording stopped but was discarded
            self.sendEvent("onSegmentComplete", ["uri": "", "duration": 0])
            return
        }
        
        let buffersToWrite = segmentBuffers
        let fileToWrite = segmentFile
        let startTime = segmentStartTime
        let endTime = Date().timeIntervalSince1970 * 1000
        let rewindMs = vadRewindHalfPause ? vadSilenceDuration / 2 : 0
        
        segmentBuffers.removeAll()
        segmentFile = nil
        
        DispatchQueue.global(qos: .background).async { [weak self] in
            guard let self = self, let fileURL = fileToWrite else { return }
            do {
                try self.writeWavFileAsync(fileURL: fileURL, buffers: buffersToWrite, rewindMs: rewindMs)
                let pathString = fileURL.path
                let normalizedPath = pathString.hasPrefix("/") ? pathString : "/\(pathString)"
                let uri = "file://\(normalizedPath)"
                let duration = endTime - startTime - Double(rewindMs)
                DispatchQueue.main.async {
                    self.sendEvent("onSegmentComplete", ["uri": uri, "startTime": startTime, "endTime": endTime - Double(rewindMs), "duration": duration])
                }
            } catch {}
        }
    }
    
    private func writeWavFileAsync(fileURL: URL, buffers: [AVAudioPCMBuffer], rewindMs: Int) throws {
        let samplesToTrim = Int(sampleRate) * rewindMs / 1000
        var totalSamples = 0
        for buffer in buffers { totalSamples += Int(buffer.frameLength) }
        let finalSamples = max(0, totalSamples - samplesToTrim)
        let dataSize = finalSamples * 2
        
        if !FileManager.default.fileExists(atPath: fileURL.path) {
            FileManager.default.createFile(atPath: fileURL.path, contents: nil, attributes: nil)
        }
        
        let fileHandle = try FileHandle(forWritingTo: fileURL)
        defer { try? fileHandle.close() }
        try fileHandle.truncate(atOffset: 0)
        try writeWAVHeader(fileHandle: fileHandle, dataSize: Int64(dataSize), sampleRate: Int(sampleRate), channels: 1, bitsPerSample: 16)
        
        var samplesWritten = 0
        for buffer in buffers {
            let frameLength = Int(buffer.frameLength)
            let samplesToWrite = min(frameLength, finalSamples - samplesWritten)
            if samplesToWrite <= 0 { break }
            
            if let int16Data = buffer.int16ChannelData {
                let audioData = Data(bytes: int16Data.pointee, count: samplesToWrite * MemoryLayout<Int16>.size)
                try fileHandle.write(contentsOf: audioData)
            } else if let float32Data = buffer.floatChannelData {
                var int16Samples = [Int16](repeating: 0, count: samplesToWrite)
                for i in 0..<samplesToWrite {
                    let clampedSample = max(-1.0, min(1.0, Double(float32Data.pointee[i])))
                    int16Samples[i] = Int16(clampedSample * 32767.0)
                }
                let audioData = Data(bytes: int16Samples, count: samplesToWrite * MemoryLayout<Int16>.size)
                try fileHandle.write(contentsOf: audioData)
            }
            samplesWritten += samplesToWrite
        }
        try fileHandle.synchronize()
    }
    
    private func startSegment(options: [String: Any?]?) async throws {
        guard isActive else { throw NSError(domain: "MicrophoneEnergy", code: 4, userInfo: nil) }
        if isRecordingSegment { return }
        
        let prerollMs = (options?["prerollMs"] as? NSNumber)?.intValue ?? 200
        let tempDir = FileManager.default.temporaryDirectory
        let fileName = "segment_\(UUID().uuidString).wav"
        let fileURL = tempDir.appendingPathComponent(fileName)
        
        segmentFile = fileURL
        segmentStartTime = Date().timeIntervalSince1970 * 1000
        
        let maxPrerollBuffers = Int(Double(prerollMs) / (2048.0 / (sampleRate / 1000.0)))
        let buffersToWrite = min(ringBuffer.count, maxPrerollBuffers)
        
        segmentBuffers.removeAll()
        for entry in ringBuffer.suffix(buffersToWrite) { segmentBuffers.append(entry.buffer) }
        
        isRecordingSegment = true
    }
    
    private func stopSegment() async throws -> String? {
        guard isRecordingSegment else { return nil }
        isRecordingSegment = false
        vadState = "IDLE"
        
        guard let fileURL = segmentFile else {
            segmentBuffers.removeAll()
            return nil
        }
        
        let startTime = segmentStartTime
        let endTime = Date().timeIntervalSince1970 * 1000
        let duration = endTime - startTime
        
        var totalSamples = 0
        for buffer in segmentBuffers { totalSamples += Int(buffer.frameLength) }
        let dataSize = totalSamples * 2
        
        if !FileManager.default.fileExists(atPath: fileURL.path) {
            FileManager.default.createFile(atPath: fileURL.path, contents: nil, attributes: nil)
        }
        
        let fileHandle = try FileHandle(forWritingTo: fileURL)
        defer { try? fileHandle.close() }
        try fileHandle.truncate(atOffset: 0)
        try writeWAVHeader(fileHandle: fileHandle, dataSize: Int64(dataSize), sampleRate: Int(sampleRate), channels: 1, bitsPerSample: 16)
        
        for buffer in segmentBuffers {
            let frameLength = Int(buffer.frameLength)
            if let int16Data = buffer.int16ChannelData {
                let audioData = Data(bytes: int16Data.pointee, count: frameLength * MemoryLayout<Int16>.size)
                try fileHandle.write(contentsOf: audioData)
            } else if let float32Data = buffer.floatChannelData {
                var int16Samples = [Int16](repeating: 0, count: frameLength)
                for i in 0..<frameLength {
                    let clampedSample = max(-1.0, min(1.0, Double(float32Data.pointee[i])))
                    int16Samples[i] = Int16(clampedSample * 32767.0)
                }
                let audioData = Data(bytes: int16Samples, count: frameLength * MemoryLayout<Int16>.size)
                try fileHandle.write(contentsOf: audioData)
            }
        }
        try fileHandle.synchronize()
        
        let pathString = fileURL.path
        let normalizedPath = pathString.hasPrefix("/") ? pathString : "/\(pathString)"
        let uri = "file://\(normalizedPath)"
        
        sendEvent("onSegmentComplete", ["uri": uri, "startTime": startTime, "endTime": endTime, "duration": duration])
        
        segmentFile = nil
        segmentBuffers.removeAll()
        return uri
    }
    
    private func writeWAVHeader(fileHandle: FileHandle, dataSize: Int64, sampleRate: Int, channels: Int, bitsPerSample: Int) throws {
        var header = Data()
        header.append("RIFF".data(using: .ascii)!)
        header.append(contentsOf: withUnsafeBytes(of: UInt32(36 + dataSize).littleEndian) { Data($0) })
        header.append("WAVE".data(using: .ascii)!)
        header.append("fmt ".data(using: .ascii)!)
        header.append(contentsOf: withUnsafeBytes(of: UInt32(16).littleEndian) { Data($0) })
        header.append(contentsOf: withUnsafeBytes(of: UInt16(1).littleEndian) { Data($0) })
        header.append(contentsOf: withUnsafeBytes(of: UInt16(channels).littleEndian) { Data($0) })
        header.append(contentsOf: withUnsafeBytes(of: UInt32(sampleRate).littleEndian) { Data($0) })
        header.append(contentsOf: withUnsafeBytes(of: UInt32(sampleRate * channels * bitsPerSample / 8).littleEndian) { Data($0) })
        header.append(contentsOf: withUnsafeBytes(of: UInt16(channels * bitsPerSample / 8).littleEndian) { Data($0) })
        header.append(contentsOf: withUnsafeBytes(of: UInt16(bitsPerSample).littleEndian) { Data($0) })
        header.append("data".data(using: .ascii)!)
        header.append(contentsOf: withUnsafeBytes(of: UInt32(dataSize).littleEndian) { Data($0) })
        try fileHandle.write(contentsOf: header)
    }
}
