import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FeastWindowWsMessage } from '@/context/FeastWindowContext';

export const CELEBRATION_HISTORY_STORAGE_KEY = '@feast_celebration_history';

/** Cap so the stored list never grows unbounded. */
export const CELEBRATION_HISTORY_LIMIT = 50;

export interface CelebrationEntry {
  /** Feast Window that unlocked its deal. */
  windowId: string;
  /** Resolved restaurant, when known at the time the alert arrived. */
  restaurantId?: string;
  restaurantName?: string;
  /** Dollar savings, when the message carried a parseable discount. */
  discount?: number;
  /** The celebratory copy shown in the history list. */
  message: string;
  /** ISO timestamp of when the unlock alert was received. */
  unlockedAt: string;
}

export interface CelebrationContext {
  restaurantId?: string;
  restaurantName?: string;
  /** Whether the current user had joined this window. */
  hasJoined?: boolean;
}

/**
 * Pure mapping from an incoming Feast Window WS message to the history entry
 * it should produce. Only joiners' discount-unlock moments are recorded —
 * everything else returns null. Free of React / storage imports for testing.
 */
export function buildCelebrationEntry(
  msg: FeastWindowWsMessage,
  ctx: CelebrationContext = {},
  now: Date = new Date(),
): CelebrationEntry | null {
  if (msg.type !== 'feast_window_discount_unlocked') return null;
  if (!ctx.hasJoined) return null;
  if (!msg.id) return null;

  const discount = Number.parseFloat(String(msg.discount ?? ''));
  const hasDiscount = Number.isFinite(discount) && discount > 0;
  const savings = hasDiscount ? ` — you saved $${discount.toFixed(2)}!` : '!';

  return {
    windowId: msg.id,
    restaurantId: ctx.restaurantId,
    restaurantName: ctx.restaurantName,
    discount: hasDiscount ? discount : undefined,
    message: ctx.restaurantName
      ? `You did it — your group deal at ${ctx.restaurantName} unlocked${savings}`
      : `You did it — your group deal unlocked${savings}`,
    unlockedAt: now.toISOString(),
  };
}

/**
 * Prepends an entry to the list (newest first), replacing any older entry for
 * the same window so reconnect replays don't duplicate, and caps the length.
 */
export function mergeCelebration(
  list: CelebrationEntry[],
  entry: CelebrationEntry,
): CelebrationEntry[] {
  const rest = list.filter((e) => e.windowId !== entry.windowId);
  return [entry, ...rest].slice(0, CELEBRATION_HISTORY_LIMIT);
}

function isValidEntry(value: unknown): value is CelebrationEntry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.windowId === 'string' &&
    typeof e.message === 'string' &&
    typeof e.unlockedAt === 'string'
  );
}

/** Reads saved celebration history, tolerating missing or corrupt data. */
export async function loadCelebrationHistory(): Promise<CelebrationEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(CELEBRATION_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch (_) {
    return [];
  }
}

/** Best-effort persistence; in-memory state stays the session source of truth. */
export async function persistCelebrationHistory(list: CelebrationEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CELEBRATION_HISTORY_STORAGE_KEY, JSON.stringify(list));
  } catch (_) {}
}

/** Loads, merges the new entry, and writes back. */
export async function recordCelebration(entry: CelebrationEntry): Promise<void> {
  const existing = await loadCelebrationHistory();
  await persistCelebrationHistory(mergeCelebration(existing, entry));
}

export interface CelebrationRecorderDeps {
  resolveRestaurant: (windowId: string | undefined) => { id?: string; name?: string };
  isJoined: (windowId: string | undefined) => boolean;
  /** Injectable for tests; defaults to the AsyncStorage-backed recorder. */
  record?: (entry: CelebrationEntry) => void | Promise<void>;
  now?: () => Date;
}

/**
 * Builds the WS listener NotificationContext registers alongside the toast
 * listener: whenever a window the user joined unlocks its deal, an entry is
 * appended to the persistent celebration history.
 */
export function createCelebrationRecorder(deps: CelebrationRecorderDeps) {
  const record = deps.record ?? recordCelebration;
  return (msg: FeastWindowWsMessage) => {
    const { id, name } = deps.resolveRestaurant(msg.id);
    const entry = buildCelebrationEntry(
      msg,
      { restaurantId: id, restaurantName: name, hasJoined: deps.isJoined(msg.id) },
      deps.now ? deps.now() : new Date(),
    );
    if (!entry) return;
    void Promise.resolve(record(entry)).catch(() => {});
  };
}
