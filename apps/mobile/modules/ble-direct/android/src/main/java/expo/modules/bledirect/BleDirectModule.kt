package expo.modules.bledirect

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.ParcelUuid
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

private val QL_SERVICE: UUID = UUID.fromString("E1F2A3B4-0001-4C5D-8E9F-A1B2C3D4E5F6")
private val QL_TX: UUID = UUID.fromString("E1F2A3B4-0002-4C5D-8E9F-A1B2C3D4E5F6") // peripheral -> central (notify)
private val QL_RX: UUID = UUID.fromString("E1F2A3B4-0003-4C5D-8E9F-A1B2C3D4E5F6") // central -> peripheral (write)
private val CCCD: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

@SuppressLint("MissingPermission")
class BleDirectModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val bluetoothManager: BluetoothManager?
    get() = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
  private val adapter: BluetoothAdapter?
    get() = bluetoothManager?.adapter

  private var advertiser: BluetoothLeAdvertiser? = null
  private var scanner: BluetoothLeScanner? = null
  private var gattServer: BluetoothGattServer? = null
  private var txCharacteristic: BluetoothGattCharacteristic? = null

  // Central role: peripherals we connected to + their writable RX char.
  private val clientGatts = HashMap<String, BluetoothGatt>()
  private val clientRx = HashMap<String, BluetoothGattCharacteristic>()
  // Peripheral role: centrals subscribed to our TX notifications.
  private val subscribed = HashMap<String, BluetoothDevice>()

  private var displayName = "QuakeLink"
  private var running = false

  override fun definition() = ModuleDefinition {
    Name("BleDirect")

    Events("onMessage", "onPeersChanged")

    AsyncFunction("start") { name: String ->
      displayName = name
      running = true
      startForegroundService()
      startServer()
      startAdvertising()
      startScanning()
    }

    AsyncFunction("stop") {
      stopAll()
    }

    AsyncFunction("send") { text: String ->
      sendToAll(text)
    }

    Function("isSupported") {
      adapter?.isMultipleAdvertisementSupported ?: false
    }

    OnDestroy {
      stopAll()
    }
  }

  // ── Peripheral: GATT server + advertising ─────────────────────────────────

  private fun startServer() {
    val mgr = bluetoothManager ?: return
    if (gattServer != null) return

    val server = mgr.openGattServer(context, gattServerCallback) ?: return
    gattServer = server

    val tx = BluetoothGattCharacteristic(
      QL_TX,
      BluetoothGattCharacteristic.PROPERTY_NOTIFY,
      BluetoothGattCharacteristic.PERMISSION_READ,
    )
    tx.addDescriptor(
      BluetoothGattDescriptor(
        CCCD,
        BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE,
      ),
    )
    val rx = BluetoothGattCharacteristic(
      QL_RX,
      BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
      BluetoothGattCharacteristic.PERMISSION_WRITE,
    )
    txCharacteristic = tx

    val service = BluetoothGattService(QL_SERVICE, BluetoothGattService.SERVICE_TYPE_PRIMARY)
    service.addCharacteristic(tx)
    service.addCharacteristic(rx)
    server.addService(service)
  }

  private fun startAdvertising() {
    val adv = adapter?.bluetoothLeAdvertiser ?: return
    advertiser = adv

    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
      .setConnectable(true)
      .build()

    val data = AdvertiseData.Builder()
      .setIncludeDeviceName(false)
      .addServiceUuid(ParcelUuid(QL_SERVICE))
      .build()

    adv.startAdvertising(settings, data, advertiseCallback)
  }

  // ── Central: scan + connect ───────────────────────────────────────────────

  private fun startScanning() {
    val s = adapter?.bluetoothLeScanner ?: return
    scanner = s

    val filters = listOf(
      ScanFilter.Builder().setServiceUuid(ParcelUuid(QL_SERVICE)).build(),
    )
    val settings = ScanSettings.Builder()
      .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
      .build()

    s.startScan(filters, settings, scanCallback)
  }

  private fun startForegroundService() {
    val intent = Intent(context, BleForegroundService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent)
    } else {
      context.startService(intent)
    }
  }

  private fun stopForegroundService() {
    runCatching { context.stopService(Intent(context, BleForegroundService::class.java)) }
  }

  private fun stopAll() {
    running = false
    stopForegroundService()
    runCatching { scanner?.stopScan(scanCallback) }
    runCatching { advertiser?.stopAdvertising(advertiseCallback) }
    for ((_, g) in clientGatts) runCatching { g.close() }
    clientGatts.clear()
    clientRx.clear()
    subscribed.clear()
    runCatching { gattServer?.close() }
    gattServer = null
    txCharacteristic = null
    emitPeers()
  }

  // ── Send ──────────────────────────────────────────────────────────────────

  @Suppress("DEPRECATION")
  private fun sendToAll(text: String) {
    val bytes = text.toByteArray(Charsets.UTF_8)

    // As central: write to each connected peripheral's RX.
    for ((id, rx) in clientRx) {
      val gatt = clientGatts[id] ?: continue
      rx.value = bytes
      rx.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
      runCatching { gatt.writeCharacteristic(rx) }
    }

    // As peripheral: notify all subscribed centrals via TX.
    val tx = txCharacteristic
    val server = gattServer
    if (tx != null && server != null && subscribed.isNotEmpty()) {
      tx.value = bytes
      for ((_, device) in subscribed) {
        runCatching { server.notifyCharacteristicChanged(device, tx, false) }
      }
    }
  }

  private fun emitPeers() {
    val ids = HashSet<String>()
    ids.addAll(clientGatts.keys)
    ids.addAll(subscribed.keys)
    sendEvent("onPeersChanged", mapOf("count" to ids.size))
  }

  private fun emitMessage(text: String, fromId: String) {
    sendEvent("onMessage", mapOf("text" to text, "fromId" to fromId))
  }

  // ── Callbacks ─────────────────────────────────────────────────────────────

  private val advertiseCallback = object : AdvertiseCallback() {
    override fun onStartFailure(errorCode: Int) {}
  }

  private val scanCallback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) {
      val device = result.device ?: return
      val id = device.address
      if (clientGatts.containsKey(id)) return
      val gatt = device.connectGatt(context, false, gattClientCallback) ?: return
      clientGatts[id] = gatt
    }
  }

  private val gattClientCallback = object : BluetoothGattCallback() {
    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
      val id = gatt.device.address
      if (newState == BluetoothProfile.STATE_CONNECTED) {
        // Negotiate a larger MTU so identity/chat packets (>20 bytes) fit.
        if (!gatt.requestMtu(517)) gatt.discoverServices()
      } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
        clientGatts.remove(id)
        clientRx.remove(id)
        runCatching { gatt.close() }
        emitPeers()
        if (running) startScanning()
      }
    }

    override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
      gatt.discoverServices()
    }

    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
      val service = gatt.getService(QL_SERVICE) ?: return
      val tx = service.getCharacteristic(QL_TX)
      val rx = service.getCharacteristic(QL_RX)
      if (rx != null) clientRx[gatt.device.address] = rx
      if (tx != null) {
        gatt.setCharacteristicNotification(tx, true)
        val cccd = tx.getDescriptor(CCCD)
        if (cccd != null) {
          @Suppress("DEPRECATION")
          run {
            cccd.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            gatt.writeDescriptor(cccd)
          }
        }
      }
      emitPeers()
    }

    @Suppress("DEPRECATION")
    @Deprecated("Deprecated for API 33+, retained for minSdk 26 support")
    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
      if (characteristic.uuid == QL_TX) {
        val text = characteristic.value?.toString(Charsets.UTF_8) ?: return
        emitMessage(text, gatt.device.address)
      }
    }
  }

  private val gattServerCallback = object : BluetoothGattServerCallback() {
    @Suppress("DEPRECATION")
    override fun onCharacteristicWriteRequest(
      device: BluetoothDevice,
      requestId: Int,
      characteristic: BluetoothGattCharacteristic,
      preparedWrite: Boolean,
      responseNeeded: Boolean,
      offset: Int,
      value: ByteArray?,
    ) {
      if (characteristic.uuid == QL_RX && value != null) {
        emitMessage(value.toString(Charsets.UTF_8), device.address)
      }
      if (responseNeeded) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null)
      }
    }

    override fun onDescriptorWriteRequest(
      device: BluetoothDevice,
      requestId: Int,
      descriptor: BluetoothGattDescriptor,
      preparedWrite: Boolean,
      responseNeeded: Boolean,
      offset: Int,
      value: ByteArray?,
    ) {
      if (descriptor.uuid == CCCD) {
        val enabled = value != null && value.isNotEmpty() && value[0].toInt() != 0
        if (enabled) subscribed[device.address] = device else subscribed.remove(device.address)
        emitPeers()
      }
      if (responseNeeded) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null)
      }
    }

    override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
      if (newState == BluetoothProfile.STATE_DISCONNECTED) {
        subscribed.remove(device.address)
        emitPeers()
      }
    }
  }
}
