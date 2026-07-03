export const COIN_REDEMPTION_MONTHLY_POOL = 300;
export const COIN_REDEMPTION_MIN_AMOUNT = 10;
export const COIN_REDEMPTION_BASE_MONTHLY_LIMIT = 20;
export const COIN_REDEMPTION_MAX_AMOUNT = 300;

export type CoinRedemptionValidation =
    | {
        ok: true;
        amount: number;
        note: string;
        isAdditional: boolean;
    }
    | {
        ok: false;
        reason: 'invalid_amount' | 'missing_additional_note';
        amount: number | null;
        note: string;
        isAdditional: boolean;
    };

export function normalizeCoinRedemptionAmount(value: unknown) {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(parsed) ? parsed : null;
}

export function normalizeCoinRedemptionNote(value: unknown) {
    return String(value || '').trim().slice(0, 500);
}

export function isAdditionalCoinRedemption(amount: number | null | undefined) {
    return Number(amount || 0) > COIN_REDEMPTION_BASE_MONTHLY_LIMIT;
}

export function validateCoinRedemptionRequest(amountInput: unknown, requestedNoteInput: unknown): CoinRedemptionValidation {
    const amount = normalizeCoinRedemptionAmount(amountInput);
    const note = normalizeCoinRedemptionNote(requestedNoteInput);
    const isAdditional = isAdditionalCoinRedemption(amount);

    if (amount === null || amount < COIN_REDEMPTION_MIN_AMOUNT || amount > COIN_REDEMPTION_MAX_AMOUNT) {
        return { ok: false, reason: 'invalid_amount', amount, note, isAdditional };
    }

    if (isAdditional && note.length === 0) {
        return { ok: false, reason: 'missing_additional_note', amount, note, isAdditional };
    }

    return { ok: true, amount, note, isAdditional };
}
