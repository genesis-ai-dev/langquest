import ExpoModulesCore
import AVFoundation

public class MicrophoneEnergyModule: Module {
  private var audioEngine = AVAudioEngine()
  private var isActive = false
  
  public func definition() -> ModuleDefinition {
    Name("MicrophoneEnergy")
    
    Events("onEnergyResult", "onError")
    
    AsyncFunction("startEnergyDetection") {
      await self.startEnergyDetection()
    }
    
    AsyncFunction("stopEnergyDetection") {
      await self.stopEnergyDetection()
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
    
    // Send pure energy level - let JavaScript decide everything
    sendEvent("onEnergyResult", [
      "energy": Double(energy),
      "timestamp": Date().timeIntervalSince1970 * 1000
    ])
  }
}