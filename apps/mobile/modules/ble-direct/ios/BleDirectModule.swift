import ExpoModulesCore
import CoreBluetooth

// QuakeLink direct-BLE GATT identifiers. Both phones run as peripheral AND
// central so either can initiate. Messages flow:
//   central -> peripheral via RX (write)
//   peripheral -> central via TX (notify)
private let QL_SERVICE = CBUUID(string: "E1F2A3B4-0001-4C5D-8E9F-A1B2C3D4E5F6")
private let QL_TX      = CBUUID(string: "E1F2A3B4-0002-4C5D-8E9F-A1B2C3D4E5F6") // peripheral -> central (notify)
private let QL_RX      = CBUUID(string: "E1F2A3B4-0003-4C5D-8E9F-A1B2C3D4E5F6") // central -> peripheral (write)

public class BleDirectModule: Module {
  private var ble: BleDirectManager?

  public func definition() -> ModuleDefinition {
    Name("BleDirect")

    Events("onMessage", "onPeersChanged")

    OnCreate {
      self.ble = BleDirectManager(
        onMessage: { [weak self] text, fromId in
          self?.sendEvent("onMessage", ["text": text, "fromId": fromId])
        },
        onPeersChanged: { [weak self] count in
          self?.sendEvent("onPeersChanged", ["count": count])
        }
      )
    }

    AsyncFunction("start") { (displayName: String) in
      self.ble?.start(displayName: displayName)
    }

    AsyncFunction("stop") {
      self.ble?.stop()
    }

    AsyncFunction("send") { (text: String) in
      self.ble?.send(text: text)
    }

    Function("isSupported") { () -> Bool in
      return true
    }

    OnDestroy {
      self.ble?.stop()
    }
  }
}

final class BleDirectManager: NSObject {
  private var central: CBCentralManager!
  private var peripheralMgr: CBPeripheralManager!

  private var txCharacteristic: CBMutableCharacteristic?
  private var rxCharacteristic: CBMutableCharacteristic?

  // Central role: peripherals we've connected to and their writable RX char.
  private var peripherals: [UUID: CBPeripheral] = [:]
  private var remoteRX: [UUID: CBCharacteristic] = [:]
  // Peripheral role: centrals currently subscribed to our TX.
  private var subscribedCentrals: Set<UUID> = []

  private var displayName = "QuakeLink"
  private var wantRunning = false
  private var serviceAdded = false

  private let onMessage: (String, String) -> Void
  private let onPeersChanged: (Int) -> Void

  init(onMessage: @escaping (String, String) -> Void,
       onPeersChanged: @escaping (Int) -> Void) {
    self.onMessage = onMessage
    self.onPeersChanged = onPeersChanged
    super.init()
    central = CBCentralManager(delegate: self, queue: nil)
    peripheralMgr = CBPeripheralManager(delegate: self, queue: nil)
  }

  func start(displayName: String) {
    self.displayName = displayName
    wantRunning = true
    startScanIfReady()
    setupServiceAndAdvertise()
  }

  func stop() {
    wantRunning = false
    if central?.state == .poweredOn { central.stopScan() }
    if peripheralMgr?.state == .poweredOn { peripheralMgr.stopAdvertising() }
    for (_, p) in peripherals { central.cancelPeripheralConnection(p) }
    peripherals.removeAll()
    remoteRX.removeAll()
    subscribedCentrals.removeAll()
    emitPeers()
  }

  func send(text: String) {
    guard let data = text.data(using: .utf8) else { return }

    // As central: write to each connected peripheral's RX characteristic.
    for (id, char) in remoteRX {
      if let p = peripherals[id] {
        p.writeValue(data, for: char, type: .withResponse)
      }
    }

    // As peripheral: notify all subscribed centrals via TX.
    if let tx = txCharacteristic,
       peripheralMgr?.state == .poweredOn,
       !subscribedCentrals.isEmpty {
      peripheralMgr.updateValue(data, for: tx, onSubscribedCentrals: nil)
    }
  }

  private func emitPeers() {
    let count = Set(peripherals.keys).union(subscribedCentrals).count
    onPeersChanged(count)
  }

  private func startScanIfReady() {
    guard wantRunning, central?.state == .poweredOn else { return }
    central.scanForPeripherals(
      withServices: [QL_SERVICE],
      options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
    )
  }

  private func setupServiceAndAdvertise() {
    guard peripheralMgr?.state == .poweredOn else { return }

    if !serviceAdded {
      let tx = CBMutableCharacteristic(
        type: QL_TX, properties: [.notify], value: nil, permissions: [.readable])
      let rx = CBMutableCharacteristic(
        type: QL_RX, properties: [.write, .writeWithoutResponse], value: nil, permissions: [.writeable])
      txCharacteristic = tx
      rxCharacteristic = rx

      let service = CBMutableService(type: QL_SERVICE, primary: true)
      service.characteristics = [tx, rx]
      peripheralMgr.add(service)
      serviceAdded = true
    }

    startAdvertiseIfReady()
  }

  private func startAdvertiseIfReady() {
    guard wantRunning, peripheralMgr?.state == .poweredOn, serviceAdded else { return }
    if peripheralMgr.isAdvertising { return }
    peripheralMgr.startAdvertising([
      CBAdvertisementDataServiceUUIDsKey: [QL_SERVICE],
      CBAdvertisementDataLocalNameKey: displayName,
    ])
  }
}

// MARK: - Central role

extension BleDirectManager: CBCentralManagerDelegate {
  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    if central.state == .poweredOn { startScanIfReady() }
  }

  func centralManager(_ central: CBCentralManager,
                      didDiscover peripheral: CBPeripheral,
                      advertisementData: [String: Any],
                      rssi RSSI: NSNumber) {
    guard peripherals[peripheral.identifier] == nil else { return }
    peripherals[peripheral.identifier] = peripheral // retain
    central.connect(peripheral, options: nil)
  }

  func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    peripheral.delegate = self
    peripheral.discoverServices([QL_SERVICE])
  }

  func centralManager(_ central: CBCentralManager,
                      didFailToConnect peripheral: CBPeripheral, error: Error?) {
    peripherals[peripheral.identifier] = nil
    emitPeers()
  }

  func centralManager(_ central: CBCentralManager,
                      didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    peripherals[peripheral.identifier] = nil
    remoteRX[peripheral.identifier] = nil
    emitPeers()
    startScanIfReady() // keep looking for it again
  }
}

// MARK: - Central exploring a remote peripheral

extension BleDirectManager: CBPeripheralDelegate {
  func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    guard let services = peripheral.services else { return }
    for s in services where s.uuid == QL_SERVICE {
      peripheral.discoverCharacteristics([QL_TX, QL_RX], for: s)
    }
  }

  func peripheral(_ peripheral: CBPeripheral,
                  didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    guard let chars = service.characteristics else { return }
    for c in chars {
      if c.uuid == QL_TX {
        peripheral.setNotifyValue(true, for: c) // subscribe to receive
      } else if c.uuid == QL_RX {
        remoteRX[peripheral.identifier] = c      // write here to send
      }
    }
    emitPeers()
  }

  func peripheral(_ peripheral: CBPeripheral,
                  didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
    guard characteristic.uuid == QL_TX,
          let data = characteristic.value,
          let text = String(data: data, encoding: .utf8) else { return }
    onMessage(text, peripheral.identifier.uuidString)
  }
}

// MARK: - Peripheral role (our GATT server)

extension BleDirectManager: CBPeripheralManagerDelegate {
  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    if peripheral.state == .poweredOn { setupServiceAndAdvertise() }
  }

  func peripheralManager(_ peripheral: CBPeripheralManager,
                         didReceiveWrite requests: [CBATTRequest]) {
    for req in requests {
      if req.characteristic.uuid == QL_RX,
         let data = req.value,
         let text = String(data: data, encoding: .utf8) {
        onMessage(text, req.central.identifier.uuidString)
      }
    }
    if let first = requests.first {
      peripheral.respond(to: first, withResult: .success)
    }
  }

  func peripheralManager(_ peripheral: CBPeripheralManager,
                         central: CBCentral,
                         didSubscribeTo characteristic: CBCharacteristic) {
    subscribedCentrals.insert(central.identifier)
    emitPeers()
  }

  func peripheralManager(_ peripheral: CBPeripheralManager,
                         central: CBCentral,
                         didUnsubscribeFrom characteristic: CBCharacteristic) {
    subscribedCentrals.remove(central.identifier)
    emitPeers()
  }
}
