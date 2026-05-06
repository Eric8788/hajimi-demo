type InviteRole = 'student' | 'teacher';

function normalizeInviteCode(code: unknown) {
    return String(code || '').trim();
}

function configuredCodes() {
    const studentCode = normalizeInviteCode(process.env.HAJIMI_STUDENT_INVITE_CODE);
    const teacherCode = normalizeInviteCode(process.env.HAJIMI_TEACHER_INVITE_CODE);

    return {
        studentCode,
        teacherCode,
        hasAnyCode: Boolean(studentCode || teacherCode),
    };
}

export function resolveInviteRole(inviteCode: unknown): InviteRole | null {
    const submittedCode = normalizeInviteCode(inviteCode);
    const { studentCode, teacherCode, hasAnyCode } = configuredCodes();

    if (!hasAnyCode || !submittedCode) {
        return null;
    }

    if (teacherCode && submittedCode === teacherCode) {
        return 'teacher';
    }

    if (studentCode && submittedCode === studentCode) {
        return 'student';
    }

    return null;
}

export function isRegistrationConfigured() {
    return configuredCodes().hasAnyCode;
}
