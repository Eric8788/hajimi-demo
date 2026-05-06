export const PASSWORD_REQUIREMENT_MESSAGE = 'Password must be at least 8 characters and include uppercase, lowercase, and a number.';

export function isStrongPassword(password: unknown) {
    const value = String(password || '');

    return value.length >= 8
        && /[a-z]/.test(value)
        && /[A-Z]/.test(value)
        && /\d/.test(value);
}
