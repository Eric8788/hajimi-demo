export const PASSWORD_REQUIREMENT_MESSAGE = '密码至少 8 位，并包含大小写字母和数字。';

export function isStrongPassword(password: unknown) {
    const value = String(password || '');

    return value.length >= 8
        && /[a-z]/.test(value)
        && /[A-Z]/.test(value)
        && /\d/.test(value);
}
