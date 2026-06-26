import ExpoModulesCore
import CoreMotion

public class SeismographModule: Module {
  private let motionManager = CMMotionManager()

  public func definition() -> ModuleDefinition {
    Name("SeismographModule")

    Events("onReading")

    Function("startMonitoring") { (intervalMs: Double) in
      guard self.motionManager.isAccelerometerAvailable else { return }
      self.motionManager.accelerometerUpdateInterval = intervalMs / 1000.0
      self.motionManager.startAccelerometerUpdates(to: .main) { [weak self] data, error in
        guard let data = data, error == nil else { return }
        self?.sendEvent("onReading", [
          "x": data.acceleration.x * 9.81,
          "y": data.acceleration.y * 9.81,
          "z": data.acceleration.z * 9.81,
          "timestamp": Date().timeIntervalSince1970 * 1000,
        ])
      }
    }

    Function("stopMonitoring") {
      self.motionManager.stopAccelerometerUpdates()
    }
  }
}
