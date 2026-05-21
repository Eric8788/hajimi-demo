function normalizeInviteCode(code: unknown) {
    return String(code || '').trim();
}

function configuredCodes() {
    const unifiedCode = normalizeInviteCode(process.env.HAJIMI_INVITE_CODE);
    const studentCode = normalizeInviteCode(process.env.HAJIMI_STUDENT_INVITE_CODE);
    const teacherCode = normalizeInviteCode(process.env.HAJIMI_TEACHER_INVITE_CODE);
    const codes = [unifiedCode, studentCode, teacherCode].filter(Boolean);

    return {
        codes,
        hasAnyCode: codes.length > 0,
    };
}

export function validateInviteCode(inviteCode: unknown) {
    const submittedCode = normalizeInviteCode(inviteCode);
    const { codes, hasAnyCode } = configuredCodes();

    if (!hasAnyCode || !submittedCode) {
        return false;
    }

    return codes.includes(submittedCode);
}

export function isRegistrationConfigured() {
    return configuredCodes().hasAnyCode;
}
