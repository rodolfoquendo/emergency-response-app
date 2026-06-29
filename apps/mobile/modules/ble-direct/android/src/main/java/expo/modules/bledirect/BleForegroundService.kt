package expo.modules.bledirect

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Keeps the process alive (and BLE scanning/advertising running) while the app
 * is backgrounded. Android requires a foreground service with an ongoing
 * notification for sustained BLE in the background.
 */
class BleForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = getSystemService(NotificationManager::class.java)
      if (nm.getNotificationChannel(CHANNEL_ID) == null) {
        nm.createNotificationChannel(
          NotificationChannel(CHANNEL_ID, "Mesh networking", NotificationManager.IMPORTANCE_LOW),
        )
      }
    }

    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("QuakeLink active")
      .setContentText("Listening for nearby devices and earthquakes")
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
    } else {
      startForeground(NOTIF_ID, notification)
    }
    return START_STICKY
  }

  companion object {
    const val CHANNEL_ID = "quakelink-mesh"
    const val NOTIF_ID = 4242
  }
}
