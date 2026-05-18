export const USERNAME_REQUIREMENT_MESSAGE = '用户名需要 2-24 个字符，不能包含空格、/、?、#、%。';

export function normalizeUsernameInput(username: unknown) {
    return String(username || '').trim();
}

export function validateUsername(username: unknown) {
    const value = normalizeUsernameInput(username);

    if (value.length < 2 || value.length > 24) return false;
    if (/[\s/?#%\\]/.test(value)) return false;
    if (/[\u0000-\u001F\u007F]/.test(value)) return false;

    return true;
}
