package com.quakelink.seismograph

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SeismographModule : Module(), SensorEventListener {
  private var sensorManager: SensorManager? = null
  private var accelerometer: Sensor? = null
  private var intervalUs: Int = 50_000 // 50ms → 20 Hz

  override fun definition() = ModuleDefinition {
    Name("SeismographModule")

    Events("onReading")

    Function("startMonitoring") { intervalMs: Double ->
      intervalUs = (intervalMs * 1000).toInt()
      val ctx = appContext.reactContext ?: return@Function
      sensorManager = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
      accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
      sensorManager?.registerListener(this@SeismographModule, accelerometer, intervalUs)
    }

    Function("stopMonitoring") {
      sensorManager?.unregisterListener(this@SeismographModule)
    }
  }

  override fun onSensorChanged(event: SensorEvent) {
    if (event.sensor.type != Sensor.TYPE_ACCELEROMETER) return
    sendEvent(
      "onReading",
      mapOf(
        "x" to event.values[0].toDouble(),
        "y" to event.values[1].toDouble(),
        "z" to event.values[2].toDouble(),
        "timestamp" to System.currentTimeMillis().toDouble(),
      )
    )
  }

  override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {}
}
