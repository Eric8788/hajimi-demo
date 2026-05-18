import { isStaffRole } from '@/lib/roles';

const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    teacher: 'Teacher',
    student: 'Student',
};

const ROLE_EMOJIS: Record<string, string> = {
    admin: '🛡️',
    teacher: '🎓',
    student: '🙂',
};

const ROLE_STYLES: Record<string, { bg: string, border: string, color: string }> = {
    admin: { bg: 'rgba(253, 203, 110, 0.22)', border: '1px solid rgba(253, 203, 110, 0.6)', color: '#9a6716' },
    teacher: { bg: 'rgba(9, 132, 227, 0.15)', border: '1px solid rgba(9, 132, 227, 0.4)', color: '#0984e3' },
    student: { bg: 'rgba(0, 184, 148, 0.15)', border: '1px solid rgba(0, 184, 148, 0.4)', color: '#00b894' },
};

export default function RoleBadge({ role, showStudent = false, compact = false, iconOnly = false }: { role?: string | null; showStudent?: boolean; compact?: boolean; iconOnly?: boolean }) {
    const normalizedRole = (role || 'student').toLowerCase();
    const isStaff = isStaffRole(normalizedRole);

    if (!isStaff && !showStudent) {
        return null;
    }

    const style = ROLE_STYLES[normalizedRole] || ROLE_STYLES.student;

    return (
        <span
            title={`Role: ${ROLE_LABELS[normalizedRole] || normalizedRole}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 'fit-content',
                minWidth: iconOnly ? (compact ? '22px' : '28px') : undefined,
                minHeight: iconOnly ? (compact ? '22px' : '28px') : undefined,
                padding: iconOnly ? (compact ? '2px 5px' : '4px 7px') : compact ? '2px 7px' : '4px 10px',
                borderRadius: '999px',
                border: style.border,
                background: style.bg,
                color: style.color,
                fontSize: iconOnly ? (compact ? '0.82rem' : '0.95rem') : compact ? '0.68rem' : '0.78rem',
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: 0,
            }}
        >
            {iconOnly ? ROLE_EMOJIS[normalizedRole] || '🙂' : ROLE_LABELS[normalizedRole] || normalizedRole}
        </span>
    );
}
