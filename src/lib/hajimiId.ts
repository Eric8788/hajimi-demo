export function formatHajimiId(userId?: number | null) {
    const numericId = Number(userId || 0);
    return `#${Math.max(0, numericId - 1).toString().padStart(4, '0')}`;
}
