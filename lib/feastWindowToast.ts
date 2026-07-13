import type { FeastWindowWsMessage } from '@/context/FeastWindowContext';

export type FeastWindowToastKind = 'info' | 'warning' | 'success';

export interface FeastWindowToast {
  message: string;
  icon: string;
  kind: FeastWindowToastKind;
  durationMs?: number;
  /** Route the toast should navigate to when tapped. */
  navigateTo: string;
}

export interface FeastWindowToastContext {
  /** Resolved restaurant id for the window the message refers to, if known. */
  restaurantId?: string;
  /** Resolved restaurant name, if known. */
  restaurantName?: string;
  /** Whether the current user had joined this window. */
  hasJoined?: boolean;
}

const ALERT_TYPES = new Set([
  'feast_window_full',
  'feast_window_expired',
  'feast_window_discount_unlocked',
]);

/** True when the message type is one that should surface a pop-up alert. */
export function isFeastWindowAlert(type: string): boolean {
  return ALERT_TYPES.has(type);
}

/**
 * Pure mapping from an incoming Feast Window WebSocket message to the toast it
 * should produce. Returns null when the message is not an alert type and must
 * be ignored. Kept free of React / React Native imports so it is unit testable.
 */
export function buildFeastWindowToast(
  msg: FeastWindowWsMessage,
  ctx: FeastWindowToastContext = {},
): FeastWindowToast | null {
  if (!isFeastWindowAlert(msg.type)) return null;

  const { restaurantId, restaurantName, hasJoined } = ctx;
  // Tap navigates to the restaurant if we resolved it, otherwise to the home
  // feed of still-open Feast Windows.
  const navigateTo = restaurantId ? `/restaurant/${restaurantId}` : '/(tabs)';

  if (msg.type === 'feast_window_full') {
    return {
      message: restaurantName
        ? `${restaurantName}'s Feast Window just filled up — tap to see what's still on.`
        : "That Feast Window just filled up — tap to see what's still open.",
      icon: 'people',
      kind: 'warning',
      navigateTo,
    };
  }

  if (msg.type === 'feast_window_expired') {
    return {
      message: restaurantName
        ? `${restaurantName}'s Feast Window just closed — tap to find another deal.`
        : 'A Feast Window just closed — tap to find another deal.',
      icon: 'time',
      kind: 'warning',
      navigateTo,
    };
  }

  // feast_window_discount_unlocked
  const discount = Number.parseFloat(String(msg.discount ?? ''));
  const savings = Number.isFinite(discount) && discount > 0
    ? ` — save $${discount.toFixed(2)}!`
    : '!';

  if (hasJoined) {
    // Personalized, stronger nudge for people who joined and were waiting for
    // the group to fill.
    return {
      message: restaurantName
        ? `You did it — your group deal at ${restaurantName} is unlocked${savings}`
        : `You did it — your group deal is unlocked${savings}`,
      icon: 'trophy',
      kind: 'success',
      durationMs: 6000,
      navigateTo,
    };
  }

  return {
    message: restaurantName
      ? `Group deal unlocked at ${restaurantName}${savings}`
      : `Group deal unlocked${savings}`,
    icon: 'sparkles',
    kind: 'success',
    navigateTo,
  };
}

export interface FeastWindowAlertDeps {
  notify: (
    message: string,
    options: {
      icon: string;
      kind: FeastWindowToastKind;
      durationMs?: number;
      onPress?: () => void;
    },
  ) => void;
  navigate: (route: string) => void;
  /** Resolve the restaurant a window belongs to (id + name), best effort. */
  resolveRestaurant: (windowId: string | undefined) => {
    id?: string;
    name?: string;
  };
  /** Whether the current user joined the given window. */
  isJoined: (windowId: string | undefined) => boolean;
}

/**
 * Builds the listener that NotificationContext registers on the single shared
 * Feast Window connection. Extracted so the exact routing the app uses can be
 * exercised in tests by feeding it simulated messages.
 */
export function createFeastWindowAlertListener(deps: FeastWindowAlertDeps) {
  return (msg: FeastWindowWsMessage) => {
    const { id, name } = deps.resolveRestaurant(msg.id);
    const toast = buildFeastWindowToast(msg, {
      restaurantId: id,
      restaurantName: name,
      hasJoined: deps.isJoined(msg.id),
    });
    if (!toast) return;
    deps.notify(toast.message, {
      icon: toast.icon,
      kind: toast.kind,
      durationMs: toast.durationMs,
      onPress: () => deps.navigate(toast.navigateTo),
    });
  };
}
