import { describe, it, expect, vi } from 'vitest';
import {
  buildCelebrationEntry,
  mergeCelebration,
  createCelebrationRecorder,
  CELEBRATION_HISTORY_LIMIT,
  type CelebrationEntry,
} from './celebrationHistory';

const NOW = new Date('2026-07-07T12:00:00.000Z');

function entry(windowId: string, unlockedAt = NOW.toISOString()): CelebrationEntry {
  return { windowId, message: 'You did it!', unlockedAt };
}

describe('buildCelebrationEntry', () => {
  it('records a joined discount unlock with restaurant and savings', () => {
    const e = buildCelebrationEntry(
      { type: 'feast_window_discount_unlocked', id: 'w1', discount: '4.50' },
      { restaurantId: 'r1', restaurantName: 'Pho House', hasJoined: true },
      NOW,
    );
    expect(e).not.toBeNull();
    expect(e!.windowId).toBe('w1');
    expect(e!.restaurantId).toBe('r1');
    expect(e!.discount).toBe(4.5);
    expect(e!.message).toBe(
      'You did it — your group deal at Pho House unlocked — you saved $4.50!',
    );
    expect(e!.unlockedAt).toBe(NOW.toISOString());
  });

  it('omits savings copy when the discount is missing or unparseable', () => {
    const e = buildCelebrationEntry(
      { type: 'feast_window_discount_unlocked', id: 'w1' },
      { hasJoined: true },
      NOW,
    );
    expect(e!.discount).toBeUndefined();
    expect(e!.message).toBe('You did it — your group deal unlocked!');
  });

  it('returns null for non-joiners', () => {
    expect(
      buildCelebrationEntry(
        { type: 'feast_window_discount_unlocked', id: 'w1', discount: 3 },
        { hasJoined: false },
        NOW,
      ),
    ).toBeNull();
  });

  it('returns null for other alert types even when joined', () => {
    for (const type of ['feast_window_full', 'feast_window_expired', 'feast_window_update']) {
      expect(buildCelebrationEntry({ type, id: 'w1' }, { hasJoined: true }, NOW)).toBeNull();
    }
  });

  it('returns null when the message has no window id', () => {
    expect(
      buildCelebrationEntry(
        { type: 'feast_window_discount_unlocked' },
        { hasJoined: true },
        NOW,
      ),
    ).toBeNull();
  });
});

describe('mergeCelebration', () => {
  it('prepends new entries (newest first)', () => {
    const list = mergeCelebration([entry('w1')], entry('w2'));
    expect(list.map((e) => e.windowId)).toEqual(['w2', 'w1']);
  });

  it('replaces an older entry for the same window instead of duplicating', () => {
    const list = mergeCelebration(
      [entry('w1', '2026-07-06T10:00:00.000Z'), entry('w2')],
      entry('w1'),
    );
    expect(list.map((e) => e.windowId)).toEqual(['w1', 'w2']);
    expect(list[0].unlockedAt).toBe(NOW.toISOString());
  });

  it('caps the list length', () => {
    let list: CelebrationEntry[] = [];
    for (let i = 0; i < CELEBRATION_HISTORY_LIMIT + 10; i++) {
      list = mergeCelebration(list, entry(`w${i}`));
    }
    expect(list).toHaveLength(CELEBRATION_HISTORY_LIMIT);
    expect(list[0].windowId).toBe(`w${CELEBRATION_HISTORY_LIMIT + 9}`);
  });
});

describe('createCelebrationRecorder', () => {
  it('records joined unlocks with the resolved restaurant', () => {
    const record = vi.fn();
    const recorder = createCelebrationRecorder({
      resolveRestaurant: () => ({ id: 'r1', name: 'Pho House' }),
      isJoined: () => true,
      record,
      now: () => NOW,
    });

    recorder({ type: 'feast_window_discount_unlocked', id: 'w1', discount: '2.00' });

    expect(record).toHaveBeenCalledTimes(1);
    const saved = record.mock.calls[0][0] as CelebrationEntry;
    expect(saved.windowId).toBe('w1');
    expect(saved.restaurantId).toBe('r1');
    expect(saved.restaurantName).toBe('Pho House');
    expect(saved.discount).toBe(2);
  });

  it('ignores unlocks for windows the user did not join', () => {
    const record = vi.fn();
    const recorder = createCelebrationRecorder({
      resolveRestaurant: () => ({}),
      isJoined: () => false,
      record,
    });
    recorder({ type: 'feast_window_discount_unlocked', id: 'w1', discount: 5 });
    expect(record).not.toHaveBeenCalled();
  });

  it('ignores non-unlock messages', () => {
    const record = vi.fn();
    const recorder = createCelebrationRecorder({
      resolveRestaurant: () => ({ id: 'r1' }),
      isJoined: () => true,
      record,
    });
    recorder({ type: 'feast_window_full', id: 'w1' });
    recorder({ type: 'feast_window_expired', id: 'w1' });
    expect(record).not.toHaveBeenCalled();
  });

  it('swallows persistence failures so the WS pipeline never breaks', () => {
    const recorder = createCelebrationRecorder({
      resolveRestaurant: () => ({}),
      isJoined: () => true,
      record: () => Promise.reject(new Error('disk full')),
    });
    expect(() =>
      recorder({ type: 'feast_window_discount_unlocked', id: 'w1' }),
    ).not.toThrow();
  });
});
