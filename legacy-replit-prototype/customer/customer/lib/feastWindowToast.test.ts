import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildFeastWindowToast,
  isFeastWindowAlert,
  createFeastWindowAlertListener,
  type FeastWindowAlertDeps,
} from './feastWindowToast';
import type { FeastWindowWsMessage } from '@/context/FeastWindowContext';

/**
 * Mimics the single shared connection in FeastWindowContext: it keeps a set of
 * listeners, fans every parsed message out to all of them, and hands back an
 * unsubscribe — exactly the surface NotificationContext consumes via subscribe().
 */
function makeSharedConnection() {
  const listeners = new Set<(msg: FeastWindowWsMessage) => void>();
  return {
    subscribe(listener: (msg: FeastWindowWsMessage) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Simulate a raw WS frame arriving on the wire. */
    emit(raw: string) {
      const msg = JSON.parse(raw);
      for (const listener of listeners) listener(msg);
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

describe('buildFeastWindowToast', () => {
  it('maps feast_window_full to a warning toast with the people icon', () => {
    const toast = buildFeastWindowToast(
      { type: 'feast_window_full', id: 'w1' },
      { restaurantId: 'r1', restaurantName: 'Pho House' },
    );
    expect(toast).not.toBeNull();
    expect(toast!.kind).toBe('warning');
    expect(toast!.icon).toBe('people');
    expect(toast!.message).toBe(
      "Pho House's Feast Window just filled up — tap to see what's still on.",
    );
    expect(toast!.navigateTo).toBe('/restaurant/r1');
  });

  it('maps feast_window_expired to a warning toast with the time icon', () => {
    const toast = buildFeastWindowToast(
      { type: 'feast_window_expired', id: 'w1' },
      { restaurantId: 'r1', restaurantName: 'Pho House' },
    );
    expect(toast).not.toBeNull();
    expect(toast!.kind).toBe('warning');
    expect(toast!.icon).toBe('time');
    expect(toast!.message).toBe(
      "Pho House's Feast Window just closed — tap to find another deal.",
    );
    expect(toast!.navigateTo).toBe('/restaurant/r1');
  });

  it('maps feast_window_discount_unlocked to a success toast with savings copy', () => {
    const toast = buildFeastWindowToast(
      { type: 'feast_window_discount_unlocked', id: 'w1', discount: '5' },
      { restaurantId: 'r1', restaurantName: 'Pho House' },
    );
    expect(toast).not.toBeNull();
    expect(toast!.kind).toBe('success');
    expect(toast!.icon).toBe('sparkles');
    expect(toast!.message).toBe('Group deal unlocked at Pho House — save $5.00!');
  });

  it('uses a personalized, longer-lived trophy toast when the user joined', () => {
    const toast = buildFeastWindowToast(
      { type: 'feast_window_discount_unlocked', id: 'w1', discount: 5 },
      { restaurantId: 'r1', restaurantName: 'Pho House', hasJoined: true },
    );
    expect(toast).not.toBeNull();
    expect(toast!.icon).toBe('trophy');
    expect(toast!.kind).toBe('success');
    expect(toast!.durationMs).toBe(6000);
    expect(toast!.message).toBe(
      'You did it — your group deal at Pho House is unlocked — save $5.00!',
    );
  });

  it('omits the savings suffix when no positive discount is present', () => {
    const toast = buildFeastWindowToast(
      { type: 'feast_window_discount_unlocked', id: 'w1' },
      { restaurantName: 'Pho House' },
    );
    expect(toast!.message).toBe('Group deal unlocked at Pho House!');
  });

  it('falls back to generic copy and the home feed when the restaurant is unknown', () => {
    const full = buildFeastWindowToast({ type: 'feast_window_full', id: 'w1' });
    expect(full!.message).toBe(
      "That Feast Window just filled up — tap to see what's still open.",
    );
    expect(full!.navigateTo).toBe('/(tabs)');

    const expired = buildFeastWindowToast({ type: 'feast_window_expired', id: 'w1' });
    expect(expired!.message).toBe('A Feast Window just closed — tap to find another deal.');
    expect(expired!.navigateTo).toBe('/(tabs)');
  });

  it('returns null for non-alert message types', () => {
    expect(buildFeastWindowToast({ type: 'feast_window_update' })).toBeNull();
    expect(buildFeastWindowToast({ type: 'order_status' })).toBeNull();
    expect(buildFeastWindowToast({ type: 'whatever_else' })).toBeNull();
    expect(isFeastWindowAlert('feast_window_update')).toBe(false);
    expect(isFeastWindowAlert('feast_window_full')).toBe(true);
  });
});

describe('createFeastWindowAlertListener over the shared connection', () => {
  function setup(overrides: Partial<FeastWindowAlertDeps> = {}) {
    const notify = vi.fn();
    const navigate = vi.fn();
    const deps: FeastWindowAlertDeps = {
      notify,
      navigate,
      resolveRestaurant: (windowId) =>
        windowId === 'w1' ? { id: 'r1', name: 'Pho House' } : {},
      isJoined: () => false,
      ...overrides,
    };
    const conn = makeSharedConnection();
    const unsubscribe = conn.subscribe(createFeastWindowAlertListener(deps));
    return { conn, notify, navigate, unsubscribe };
  }

  it('fires a toast with the expected copy/icon/kind when the connection emits feast_window_full', () => {
    const { conn, notify } = setup();
    conn.emit(JSON.stringify({ type: 'feast_window_full', id: 'w1' }));

    expect(notify).toHaveBeenCalledTimes(1);
    const [message, options] = notify.mock.calls[0];
    expect(message).toBe(
      "Pho House's Feast Window just filled up — tap to see what's still on.",
    );
    expect(options.icon).toBe('people');
    expect(options.kind).toBe('warning');
  });

  it('navigates to the restaurant when the toast is tapped', () => {
    const { conn, notify, navigate } = setup();
    conn.emit(JSON.stringify({ type: 'feast_window_discount_unlocked', id: 'w1', discount: '5' }));

    expect(notify).toHaveBeenCalledTimes(1);
    const [, options] = notify.mock.calls[0];
    expect(navigate).not.toHaveBeenCalled();
    options.onPress();
    expect(navigate).toHaveBeenCalledWith('/restaurant/r1');
  });

  it('navigates to the home feed when the restaurant cannot be resolved', () => {
    const { conn, notify, navigate } = setup({ resolveRestaurant: () => ({}) });
    conn.emit(JSON.stringify({ type: 'feast_window_full', id: 'unknown' }));

    const [, options] = notify.mock.calls[0];
    options.onPress();
    expect(navigate).toHaveBeenCalledWith('/(tabs)');
  });

  it('uses the personalized trophy toast for a window the user joined', () => {
    const { conn, notify } = setup({ isJoined: (id) => id === 'w1' });
    conn.emit(JSON.stringify({ type: 'feast_window_discount_unlocked', id: 'w1', discount: '5' }));

    const [message, options] = notify.mock.calls[0];
    expect(options.icon).toBe('trophy');
    expect(options.durationMs).toBe(6000);
    expect(message).toBe(
      'You did it — your group deal at Pho House is unlocked — save $5.00!',
    );
  });

  it('ignores unrelated message types emitted on the same connection', () => {
    const { conn, notify } = setup();
    conn.emit(JSON.stringify({ type: 'feast_window_update', id: 'w1', data: {} }));
    conn.emit(JSON.stringify({ type: 'order_status', id: 'w1' }));
    conn.emit(JSON.stringify({ type: 'ping' }));

    expect(notify).not.toHaveBeenCalled();
  });

  it('stops receiving messages after unsubscribing', () => {
    const { conn, notify, unsubscribe } = setup();
    unsubscribe();
    conn.emit(JSON.stringify({ type: 'feast_window_full', id: 'w1' }));
    expect(notify).not.toHaveBeenCalled();
    expect(conn.listenerCount()).toBe(0);
  });
});

describe('single shared WebSocket ownership', () => {
  const contextDir = path.resolve(__dirname, '..', 'context');
  const read = (file: string) =>
    readFileSync(path.join(contextDir, file), 'utf8');

  it('NotificationContext never opens its own WebSocket', () => {
    const src = read('NotificationContext.tsx');
    expect(src).not.toMatch(/new WebSocket/);
    expect(src).not.toMatch(/getWsUrl/);
    // It must consume the shared connection through subscribe() instead.
    expect(src).toMatch(/subscribe\(/);
  });

  it('FeastWindowContext is the single owner of the shared WebSocket', () => {
    const src = read('FeastWindowContext.tsx');
    const matches = src.match(/new WebSocket/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(src).toMatch(/getWsUrl/);
  });
});
