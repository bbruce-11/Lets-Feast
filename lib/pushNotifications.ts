import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { STORAGE_KEYS } from '@/constants/profile';
import { pushApi } from './api';

// AsyncStorage key for the most recently registered Expo push token. Persisted
// so the "Order updates" settings toggle can unregister this device even though
// it never sees the in-memory token held by AppContext.
const PUSH_TOKEN_KEY = '@feast_push_token';

// Reads the persisted "Order updates" push preference from the shared settings
// blob. Defaults to enabled so customers who never opened Settings still get
// order-status notifications (push tokens are registered automatically today).
export async function getOrderNotificationsEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { pushNotifications?: boolean };
    return parsed.pushNotifications !== false;
  } catch {
    return true;
  }
}

// Turns order notifications off: unregisters this device's stored push token so
// the server stops sending order-status pushes. Best-effort; the caller persists
// the preference itself. No-op when no token has been registered.
export async function disableOrderNotifications(): Promise<void> {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (token) await unregisterPushNotifications(token);
}

// Resolves the EAS project id from the app config. Required by Expo to mint a
// push token in a dev/production build. May be undefined in environments that
// have not been linked to an EAS project (e.g. plain Expo Go / web preview), in
// which case remote push registration is skipped gracefully.
function getProjectId(): string | undefined {
  const fromExpoConfig = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas?.projectId;
  const fromEasConfig = (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return fromExpoConfig ?? fromEasConfig;
}

// Requests notification permission, obtains this device's Expo push token, and
// registers it with the server so order status-change notifications can reach
// the customer even when the app is backgrounded or closed. Returns the token
// on success, or null if push is unavailable (web, denied permission, or no EAS
// project). All failures are swallowed — push is best-effort and must never
// block sign-in or app startup.
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  // Respect the customer's opt-out: skip registration when "Order updates" is
  // turned off in Settings so the server never sends order-status pushes.
  if (!(await getOrderNotificationsEnabled())) return null;

  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Order updates',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
      });
    }

    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    if (!token) return null;

    await pushApi.register(token, Platform.OS);
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    return token;
  } catch (err) {
    console.warn('Push notification registration skipped:', err);
    return null;
  }
}

export async function unregisterPushNotifications(token: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await pushApi.unregister(token);
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {
    // Best-effort cleanup; ignore failures.
  }
}

// Pulls an order id out of an order-status notification's data payload. The
// server sends `data: { type: 'order_status', orderId, status }`; anything else
// (or a missing/invalid id) yields null so unrelated notifications are ignored.
function extractOrderId(response: Notifications.NotificationResponse | null): number | null {
  const data = response?.notification?.request?.content?.data as
    | { type?: string; orderId?: unknown }
    | undefined;
  if (!data || data.type !== 'order_status') return null;
  const raw = data.orderId;
  const id = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(id) ? id : null;
}

// Wires up deep-linking from an order-status push to the live tracking screen.
// Handles both a tap that brings a backgrounded app forward (via the response
// listener) and a tap that cold-starts the app (via the last-response query).
// `onOrder` is invoked with the order id; the caller does the navigation. Each
// response is handled at most once per session (keyed by its identifier) so the
// cold-start query and the live listener can't double-fire for the same tap.
// No-op on web. Returns an unsubscribe function.
export function addNotificationResponseListener(
  onOrder: (orderId: number) => void,
): () => void {
  if (Platform.OS === 'web') return () => {};

  const handled = new Set<string>();

  const handleResponse = (response: Notifications.NotificationResponse | null) => {
    if (!response) return;
    const id = response.notification.request.identifier;
    if (handled.has(id)) return;
    const orderId = extractOrderId(response);
    if (orderId == null) return;
    handled.add(id);
    onOrder(orderId);
  };

  // Cold start: the notification (if any) the app was launched from.
  void Notifications.getLastNotificationResponseAsync()
    .then(handleResponse)
    .catch(() => {
      // Best-effort; ignore.
    });

  // Foreground/background taps while the JS context is alive.
  const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
  return () => sub.remove();
}
