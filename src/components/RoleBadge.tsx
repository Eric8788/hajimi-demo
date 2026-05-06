import { isStaffRole } from '@/lib/roles';

const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    teacher: 'Teacher',
    student: 'Student',
};

export default function RoleBadge({ role, showStudent = false, compact = false }: { role?: string | null; showStudent?: boolean; compact?: boolean }) {
    const normalizedRole = (role || 'student').toLowerCase();
    const isStaff = isStaffRole(normalizedRole);

    if (!isStaff && !showStudent) {
        return null;
    }

    return (
        <span
            title={`Role: ${ROLE_LABELS[normalizedRole] || normalizedRole}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                width: 'fit-content',
                padding: compact ? '2px 7px' : '4px 10px',
                borderRadius: '999px',
                border: isStaff ? '1px solid rgba(253, 203, 110, 0.6)' : '1px solid rgba(178, 190, 195, 0.35)',
                background: isStaff ? 'rgba(253, 203, 110, 0.22)' : 'rgba(178, 190, 195, 0.14)',
                color: isStaff ? '#9a6716' : '#636e72',
                fontSize: compact ? '0.68rem' : '0.78rem',
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: 0,
            }}
        >
            {isStaff ? '✦ ' : ''}{ROLE_LABELS[normalizedRole] || normalizedRole}
        </span>
    );
}
