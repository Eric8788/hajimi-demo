export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type VerificationType = 'student' | 'teacher';

export const STUDENT_GRADES = ['G10', 'G11', 'G12', 'G13'] as const;

export type StudentGrade = (typeof STUDENT_GRADES)[number];

export type VerificationInput = {
    type?: VerificationType;
    name?: unknown;
    grade?: unknown;
    subject?: unknown;
    studentId?: unknown;
};

export type VerificationDraft = {
    verification_type: VerificationType;
    verified_name: string;
    verified_grade: string | null;
    verified_subject: string | null;
    student_id_hash: string | null;
    student_id_last4: string | null;
};

type DraftResult = { ok: true; draft: VerificationDraft } | { ok: false; error: string };

function normalizeText(value: unknown, max = 40) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeStudentId(value: unknown) {
    return String(value || '').replace(/[\s-]+/g, '').trim().toUpperCase();
}

function getVerificationPepper() {
    return process.env.HAJIMI_VERIFICATION_PEPPER
        || process.env.POSTGRES_URL
        || 'hajimi-local-verification-pepper';
}

export async function hashStudentId(studentId: string) {
    const crypto = await import('crypto');
    return crypto
        .createHash('sha256')
        .update(`${getVerificationPepper()}:${normalizeStudentId(studentId)}`)
        .digest('hex');
}

export async function buildVerificationDraft(role: string, payload: VerificationInput): Promise<DraftResult> {
    const roleType: VerificationType = role === 'student' ? 'student' : 'teacher';
    const requestedType = payload.type === 'teacher' ? 'teacher' : payload.type === 'student' ? 'student' : roleType;

    if (requestedType !== roleType) {
        return { ok: false, error: roleType === 'student' ? '学生邀请码请提交学生认证信息。' : '老师邀请码请提交老师认证信息。' };
    }

    const verifiedName = normalizeText(payload.name);
    if (verifiedName.length < 2) {
        return { ok: false, error: '请填写真实姓名，至少 2 个字符。' };
    }

    if (roleType === 'student') {
        const grade = normalizeText(payload.grade, 4).toUpperCase();
        if (!STUDENT_GRADES.includes(grade as StudentGrade)) {
            return { ok: false, error: '学生年级请选择 G10-G13。' };
        }

        const studentId = normalizeStudentId(payload.studentId);
        if (studentId && !/^[A-Z0-9]{4,32}$/.test(studentId)) {
            return { ok: false, error: '学号只能包含字母和数字，长度 4-32 位。' };
        }

        return {
            ok: true,
            draft: {
                verification_type: 'student',
                verified_name: verifiedName,
                verified_grade: grade,
                verified_subject: null,
                student_id_hash: studentId ? await hashStudentId(studentId) : null,
                student_id_last4: studentId ? studentId.slice(-4) : null,
            },
        };
    }

    const subject = normalizeText(payload.subject);
    if (subject.length < 2) {
        return { ok: false, error: '老师认证请填写任教学科。' };
    }

    return {
        ok: true,
        draft: {
            verification_type: 'teacher',
            verified_name: verifiedName,
            verified_grade: null,
            verified_subject: subject,
            student_id_hash: null,
            student_id_last4: null,
        },
    };
}

export function isVerifiedAccount(user?: { verification_status?: string | null } | null) {
    return user?.verification_status === 'verified';
}
