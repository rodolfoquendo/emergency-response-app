import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { Platform, Vibration, Linking } from 'react-native';

/**
 * Local alerts: notifications for messages + earthquakes, plus a loud alarm
 * that ignores the iOS mute switch (via the playback audio session) and strong
 * vibration. True system-level mute/DND override (Critical Alerts) needs an
 * Apple-approved entitlement and is not available on a free personal team.
 */

let configured = false;
let alarmSound: Audio.Sound | null = null;

const iosPerms = {
  ios: { allowAlert: true, allowSound: true, allowBadge: true },
} as const;

export async function configureAlerts(): Promise<void> {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('quake', {
      name: 'Earthquake alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      enableVibrate: true,
      bypassDnd: true,
    });
    await Notifications.setNotificationChannelAsync('message', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  await Notifications.requestPermissionsAsync(iosPerms).catch(() => {});
}

export async function requestAlertPermissions() {
  return Notifications.requestPermissionsAsync(iosPerms);
}

export async function getAlertPermissions() {
  return Notifications.getPermissionsAsync();
}

/** Open the OS settings page for this app (to enable notifications / Focus exceptions). */
export function openAppSettings(): void {
  Linking.openSettings().catch(() => {});
}

export async function notifyMessage(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default', ...(Platform.OS === 'android' && { channelId: 'message' }) },
    trigger: null,
  }).catch(() => {});
}

export async function notifyEarthquake(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      // Breaks through Focus/DND when the user allows it; degrades gracefully
      // to a normal alert when the time-sensitive capability isn't present.
      interruptionLevel: 'timeSensitive',
      ...(Platform.OS === 'android' && { channelId: 'quake' }),
    },
    trigger: null,
  }).catch(() => {});

  // Vibration fires even when the phone is on silent.
  Vibration.vibrate([0, 600, 250, 600, 250, 600, 250, 900], false);

  // Loud alarm that ignores the iOS mute switch (playback audio session).
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
    if (alarmSound) {
      await alarmSound.unloadAsync().catch(() => {});
      alarmSound = null;
    }
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/alarm.wav'),
      { shouldPlay: true, volume: 1.0 },
    );
    alarmSound = sound;
  } catch {
    /* audio unavailable — notification + vibration still fired */
  }
}

export async function stopEarthquakeAlarm(): Promise<void> {
  Vibration.cancel();
  if (alarmSound) {
    await alarmSound.stopAsync().catch(() => {});
    await alarmSound.unloadAsync().catch(() => {});
    alarmSound = null;
  }
}
