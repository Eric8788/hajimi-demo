export default function CreatorBadge({ compact = false }: { compact?: boolean }) {
    return (
        <span
            title="Project Creator: This member has published projects in the Function Hall."
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                width: 'fit-content',
                padding: compact ? '2px 7px' : '4px 10px',
                borderRadius: '999px',
                border: '1px solid rgba(108, 92, 231, 0.4)',
                background: 'linear-gradient(135deg, rgba(162, 155, 254, 0.25), rgba(108, 92, 231, 0.25))',
                color: '#6c5ce7',
                fontSize: compact ? '0.68rem' : '0.78rem',
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: '0.02em',
                boxShadow: '0 4px 10px rgba(108, 92, 231, 0.1)',
            }}
        >
            🛠️ CREATOR
        </span>
    );
}
