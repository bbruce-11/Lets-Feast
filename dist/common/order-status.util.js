"use strict";
// Pure order-status functions — no external deps, safe to import anywhere.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OFFSETS_MS = exports.ORDER_STATUS_FLOW = void 0;
exports.isTerminal = isTerminal;
exports.isValidStatus = isValidStatus;
exports.nextStatus = nextStatus;
exports.progressForStatus = progressForStatus;
exports.etaForStatus = etaForStatus;
exports.deriveOrderStatus = deriveOrderStatus;
exports.deriveDriverProgress = deriveDriverProgress;
exports.deriveEtaMinutes = deriveEtaMinutes;
exports.statusTimestampPatch = statusTimestampPatch;
exports.ORDER_STATUS_FLOW = [
    'confirmed',
    'preparing',
    'driver_assigned',
    'on_the_way',
    'delivered',
];
/** Elapsed-time offsets (ms from createdAt) at which each status becomes active. */
exports.OFFSETS_MS = {
    confirmed: 0,
    preparing: 6_000,
    driver_assigned: 14_000,
    on_the_way: 24_000,
    delivered: 48_000,
};
const NOMINAL_TOTAL_MINUTES = 40;
function isTerminal(status) {
    return status === 'delivered' || status === 'cancelled';
}
function isValidStatus(status) {
    return exports.ORDER_STATUS_FLOW.includes(status);
}
function nextStatus(current) {
    const idx = exports.ORDER_STATUS_FLOW.indexOf(current);
    if (idx < 0 || idx >= exports.ORDER_STATUS_FLOW.length - 1)
        return null;
    return exports.ORDER_STATUS_FLOW[idx + 1];
}
const STATUS_PROGRESS = {
    confirmed: 0,
    preparing: 0,
    driver_assigned: 0,
    on_the_way: 0.5,
    delivered: 1,
};
const STATUS_ETA_MINUTES = {
    confirmed: NOMINAL_TOTAL_MINUTES,
    preparing: 30,
    driver_assigned: 20,
    on_the_way: 10,
    delivered: 0,
};
function progressForStatus(status) {
    return isValidStatus(status) ? STATUS_PROGRESS[status] : 0;
}
function etaForStatus(status) {
    return isValidStatus(status) ? STATUS_ETA_MINUTES[status] : NOMINAL_TOTAL_MINUTES;
}
function deriveOrderStatus(createdAt, now = Date.now()) {
    const elapsed = now - createdAt.getTime();
    let current = 'confirmed';
    for (const status of exports.ORDER_STATUS_FLOW) {
        if (elapsed >= exports.OFFSETS_MS[status])
            current = status;
    }
    return current;
}
function deriveDriverProgress(createdAt, now = Date.now()) {
    const elapsed = now - createdAt.getTime();
    const start = exports.OFFSETS_MS.on_the_way;
    const end = exports.OFFSETS_MS.delivered;
    if (elapsed <= start)
        return 0;
    if (elapsed >= end)
        return 1;
    return (elapsed - start) / (end - start);
}
function deriveEtaMinutes(createdAt, now = Date.now()) {
    const elapsed = now - createdAt.getTime();
    const remaining = Math.max(0, Math.min(1, 1 - elapsed / exports.OFFSETS_MS.delivered));
    return Math.ceil(remaining * NOMINAL_TOTAL_MINUTES);
}
/** Maps a status to the partial update that stamps its wall-clock timestamp column. */
function statusTimestampPatch(status) {
    const now = new Date();
    switch (status) {
        case 'confirmed': return { confirmedAt: now };
        case 'preparing': return { preparingAt: now };
        case 'driver_assigned': return { driverAssignedAt: now };
        case 'on_the_way': return { onTheWayAt: now };
        case 'delivered': return { deliveredAt: now };
        case 'cancelled': return { cancelledAt: now };
        default: return {};
    }
}
