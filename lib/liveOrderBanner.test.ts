import { describe, it, expect } from 'vitest';
import {
  getActiveOrders,
  deriveBannerDisplay,
  buildTrackParams,
  FINISHED_ORDER_STATUSES,
  STATUS_LABELS,
} from './liveOrderBanner';
import type { ApiOrder } from '@/lib/api';

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

function order(overrides: Partial<ApiOrder> = {}): ApiOrder {
  return {
    id: 1,
    userId: 1,
    restaurantId: 'r1',
    restaurantName: 'Pho House',
    deliveryType: 'delivery',
    items: [],
    subtotal: '15.00',
    status: 'on_the_way',
    createdAt: '2026-07-01T12:00:00.000Z',
    driverProgress: 0.5,
    etaMinutes: 8,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// FINISHED_ORDER_STATUSES
// ---------------------------------------------------------------------------

describe('FINISHED_ORDER_STATUSES', () => {
  it('contains delivered and cancelled', () => {
    expect(FINISHED_ORDER_STATUSES.has('delivered')).toBe(true);
    expect(FINISHED_ORDER_STATUSES.has('cancelled')).toBe(true);
  });

  it('does not contain active statuses', () => {
    for (const s of ['placed', 'confirmed', 'preparing', 'driver_assigned', 'ready', 'on_the_way']) {
      expect(FINISHED_ORDER_STATUSES.has(s)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// STATUS_LABELS
// ---------------------------------------------------------------------------

describe('STATUS_LABELS', () => {
  it('maps every tracked status to a non-empty string', () => {
    const tracked = ['placed', 'confirmed', 'preparing', 'driver_assigned', 'ready', 'on_the_way'];
    for (const s of tracked) {
      expect(STATUS_LABELS[s]).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// getActiveOrders
// ---------------------------------------------------------------------------

describe('getActiveOrders', () => {
  it('returns an empty list when there are no orders', () => {
    expect(getActiveOrders([])).toEqual([]);
  });

  it('hides delivered orders', () => {
    const result = getActiveOrders([order({ status: 'delivered' })]);
    expect(result).toHaveLength(0);
  });

  it('hides cancelled orders', () => {
    const result = getActiveOrders([order({ status: 'cancelled' })]);
    expect(result).toHaveLength(0);
  });

  it('shows orders with active statuses', () => {
    const active = ['placed', 'confirmed', 'preparing', 'driver_assigned', 'ready', 'on_the_way'];
    for (const status of active) {
      const result = getActiveOrders([order({ status })]);
      expect(result).toHaveLength(1);
    }
  });

  it('excludes terminal orders while keeping active ones', () => {
    const orders = [
      order({ id: 1, status: 'on_the_way' }),
      order({ id: 2, status: 'delivered' }),
      order({ id: 3, status: 'preparing' }),
      order({ id: 4, status: 'cancelled' }),
    ];
    const result = getActiveOrders(orders);
    expect(result.map((o) => o.id)).toEqual(expect.arrayContaining([1, 3]));
    expect(result.map((o) => o.id)).not.toContain(2);
    expect(result.map((o) => o.id)).not.toContain(4);
  });

  it('sorts newest order first', () => {
    const orders = [
      order({ id: 10, status: 'on_the_way', createdAt: '2026-07-01T10:00:00.000Z' }),
      order({ id: 20, status: 'preparing',  createdAt: '2026-07-01T12:00:00.000Z' }),
      order({ id: 30, status: 'confirmed',  createdAt: '2026-07-01T11:00:00.000Z' }),
    ];
    const result = getActiveOrders(orders);
    expect(result.map((o) => o.id)).toEqual([20, 30, 10]);
  });

  it('returns a single active order unchanged', () => {
    const o = order({ status: 'preparing' });
    expect(getActiveOrders([o])).toEqual([o]);
  });

  it('returns all orders when all are active', () => {
    const orders = [
      order({ id: 1, status: 'placed',    createdAt: '2026-07-01T09:00:00.000Z' }),
      order({ id: 2, status: 'confirmed', createdAt: '2026-07-01T10:00:00.000Z' }),
    ];
    expect(getActiveOrders(orders)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// deriveBannerDisplay — polled-only baseline
// ---------------------------------------------------------------------------

describe('deriveBannerDisplay — polled values', () => {
  it('uses STATUS_LABELS for a known status', () => {
    const { statusLabel } = deriveBannerDisplay(order({ status: 'preparing' }));
    expect(statusLabel).toBe('Preparing');
  });

  it('falls back to "In progress" for an unknown status', () => {
    const { statusLabel } = deriveBannerDisplay(order({ status: 'mystery_status' }));
    expect(statusLabel).toBe('In progress');
  });

  it('formats eta as "~N min" when etaMinutes is set', () => {
    const { eta } = deriveBannerDisplay(order({ etaMinutes: 10 }));
    expect(eta).toBe('~10 min');
  });

  it('returns null for eta when etaMinutes is null', () => {
    const { eta } = deriveBannerDisplay(order({ etaMinutes: null }));
    expect(eta).toBeNull();
  });

  it('returns null for eta when etaMinutes is undefined', () => {
    const { eta } = deriveBannerDisplay(order({ etaMinutes: undefined }));
    expect(eta).toBeNull();
  });

  it('clamps etaMinutes below 1 to 1 min', () => {
    const { eta } = deriveBannerDisplay(order({ etaMinutes: 0 }));
    expect(eta).toBe('~1 min');
  });

  it('passes through progress within [0, 1]', () => {
    const { progress } = deriveBannerDisplay(order({ driverProgress: 0.6 }));
    expect(progress).toBeCloseTo(0.6);
  });

  it('clamps progress below 0 to 0', () => {
    const { progress } = deriveBannerDisplay(order({ driverProgress: -0.5 }));
    expect(progress).toBe(0);
  });

  it('clamps progress above 1 to 1', () => {
    const { progress } = deriveBannerDisplay(order({ driverProgress: 1.5 }));
    expect(progress).toBe(1);
  });

  it('defaults progress to 0 when driverProgress is undefined', () => {
    const { progress } = deriveBannerDisplay(order({ driverProgress: undefined }));
    expect(progress).toBe(0);
  });

  it('returns correct display for on_the_way with progress and eta', () => {
    const display = deriveBannerDisplay(order({ status: 'on_the_way', driverProgress: 0.75, etaMinutes: 5 }));
    expect(display).toEqual({ statusLabel: 'On the way', eta: '~5 min', progress: 0.75 });
  });
});

// ---------------------------------------------------------------------------
// deriveBannerDisplay — WS override
// ---------------------------------------------------------------------------

describe('deriveBannerDisplay — WS values override polled values', () => {
  it('WS status overrides polled status', () => {
    const o = order({ status: 'preparing' });
    const ws = { status: 'on_the_way', driverProgress: 0.4, etaMinutes: 6 };
    const { statusLabel } = deriveBannerDisplay(o, ws);
    expect(statusLabel).toBe('On the way');
  });

  it('WS driverProgress overrides polled driverProgress', () => {
    const o = order({ driverProgress: 0.1 });
    const ws = { status: 'on_the_way', driverProgress: 0.8, etaMinutes: 3 };
    const { progress } = deriveBannerDisplay(o, ws);
    expect(progress).toBeCloseTo(0.8);
  });

  it('WS etaMinutes overrides polled etaMinutes', () => {
    const o = order({ etaMinutes: 20 });
    const ws = { status: 'on_the_way', driverProgress: 0.5, etaMinutes: 4 };
    const { eta } = deriveBannerDisplay(o, ws);
    expect(eta).toBe('~4 min');
  });

  it('still clamps WS progress above 1', () => {
    const ws = { status: 'on_the_way', driverProgress: 2.0, etaMinutes: 1 };
    const { progress } = deriveBannerDisplay(order(), ws);
    expect(progress).toBe(1);
  });

  it('still clamps WS etaMinutes below 1 to 1', () => {
    const ws = { status: 'on_the_way', driverProgress: 0.99, etaMinutes: 0 };
    const { eta } = deriveBannerDisplay(order(), ws);
    expect(eta).toBe('~1 min');
  });

  it('falls back to polled values when wsTracking is null', () => {
    const o = order({ status: 'confirmed', driverProgress: 0.2, etaMinutes: 15 });
    const display = deriveBannerDisplay(o, null);
    expect(display).toEqual({ statusLabel: 'Confirmed', eta: '~15 min', progress: 0.2 });
  });

  it('falls back to polled values when wsTracking is undefined', () => {
    const o = order({ status: 'confirmed', driverProgress: 0.2, etaMinutes: 15 });
    const display = deriveBannerDisplay(o, undefined);
    expect(display).toEqual({ statusLabel: 'Confirmed', eta: '~15 min', progress: 0.2 });
  });
});

// ---------------------------------------------------------------------------
// buildTrackParams
// ---------------------------------------------------------------------------

describe('buildTrackParams', () => {
  it('always includes orderId and track=1', () => {
    const params = buildTrackParams(order({ id: 42 }));
    expect(params.orderId).toBe('42');
    expect(params.track).toBe('1');
  });

  it('includes address when deliveryAddress is set', () => {
    const params = buildTrackParams(order({ deliveryAddress: '123 Main St' }));
    expect(params.address).toBe('123 Main St');
  });

  it('omits address when deliveryAddress is null', () => {
    const params = buildTrackParams(order({ deliveryAddress: null }));
    expect(params).not.toHaveProperty('address');
  });

  it('omits address when deliveryAddress is undefined', () => {
    const params = buildTrackParams(order({ deliveryAddress: undefined }));
    expect(params).not.toHaveProperty('address');
  });

  it('includes destLat and destLng when coordinates are set', () => {
    const params = buildTrackParams(order({ deliveryLat: '37.7749', deliveryLng: '-122.4194' }));
    expect(params.destLat).toBe('37.7749');
    expect(params.destLng).toBe('-122.4194');
  });

  it('omits destLat and destLng when coordinates are null', () => {
    const params = buildTrackParams(order({ deliveryLat: null, deliveryLng: null }));
    expect(params).not.toHaveProperty('destLat');
    expect(params).not.toHaveProperty('destLng');
  });

  it('omits destLat and destLng when coordinates are undefined', () => {
    const params = buildTrackParams(order({ deliveryLat: undefined, deliveryLng: undefined }));
    expect(params).not.toHaveProperty('destLat');
    expect(params).not.toHaveProperty('destLng');
  });

  it('includes all fields when all delivery fields are present', () => {
    const params = buildTrackParams(
      order({
        id: 7,
        deliveryAddress: '1 Apple Park Way',
        deliveryLat: '37.3346',
        deliveryLng: '-122.0090',
      }),
    );
    expect(params).toEqual({
      orderId: '7',
      track: '1',
      address: '1 Apple Park Way',
      destLat: '37.3346',
      destLng: '-122.0090',
    });
  });

  it('produces only orderId and track for a pickup order with no coordinates', () => {
    const params = buildTrackParams(order({ id: 3, deliveryType: 'pickup' }));
    expect(Object.keys(params)).toEqual(['orderId', 'track']);
  });
});
