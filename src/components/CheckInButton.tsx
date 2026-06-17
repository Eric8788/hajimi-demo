'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function CheckInButton() {
    const router = useRouter();
    const [checkedIn, setCheckedIn] = useState(false);
    const [loading, setLoading] = useState(true);
    const [buttonText, setButtonText] = useState('Check In');
    const [xpBurst, setXpBurst] = useState(0);
    const [isReadOnly, setIsReadOnly] = useState(false);

    useEffect(() => {
        let isActive = true;

        fetch('/api/checkin')
            .then(res => res.json())
            .then(data => {
                if (!isActive) return;
                if (data.checkedIn) {
                    setCheckedIn(true);
                    setButtonText('Signed In');
                } else if (data.verified === false) {
                    const readonly = String(data.message || '').includes('账号');
                    setIsReadOnly(readonly);
                    setButtonText(readonly ? '参观账号' : '认证后签到');
                }
            })
            .catch(() => {
                if (!isActive) return;
                setButtonText('Try again');
            })
            .finally(() => {
                if (isActive) setLoading(false);
            });

        return () => { isActive = false; };
    }, []);

    const handleCheckIn = async () => {
        setLoading(true);
        setButtonText('Signing in...');

        try {
            const res = await fetch('/api/checkin', { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                setCheckedIn(true);
                const streakBonus = data.streak > 1 ? ` · 🔥 ${data.streak} Day Streak!` : '';
                setButtonText(`Signed In · +${data.pointsAdded} XP${streakBonus}`);
                setXpBurst(Number(data.pointsAdded || 0));
                window.setTimeout(() => setXpBurst(0), 1000);
                router.refresh();
            } else {
                const alreadyChecked = data.error === 'Already checked in today';
                setCheckedIn(alreadyChecked);
                const needsVerification = res.status === 403;
                const readonly = needsVerification && String(data.error || '').includes('账号');
                setIsReadOnly(readonly);
                setButtonText(alreadyChecked ? 'Signed In' : readonly ? '参观账号' : needsVerification ? '认证后签到' : data.error || 'Could not sign in');
            }
        } catch {
            setButtonText('Try again');
        }

        setLoading(false);
    };

    return (
        <button
            onClick={handleCheckIn}
            disabled={checkedIn || loading || isReadOnly}
            className={`btn btn-primary checkin-button ${checkedIn ? 'is-complete' : 'is-ready'}`}
            style={{ 
                minWidth: '180px',
                justifyContent: 'center',
                textAlign: 'center',
                opacity: loading ? 0.7 : 1,
                fontSize: '0.95rem',
                padding: '0 22px',
                height: '46px',
                background: checkedIn
                  ? 'linear-gradient(135deg, rgba(162, 155, 254, 0.92), rgba(108, 92, 231, 0.92))'
                  : 'linear-gradient(135deg, #a29bfe, #6c5ce7)',
                border: '1px solid rgba(255,255,255,0.28)',
                boxShadow: '0 4px 15px rgba(108, 92, 231, 0.3)',
            }}
        >
            <AnimatePresence>
                {xpBurst > 0 && (
                    <motion.span
                        key={xpBurst}
                        className="checkin-xp-burst"
                        initial={{ opacity: 0, y: 8, scale: 0.78 }}
                        animate={{ opacity: 1, y: -18, scale: 1 }}
                        exit={{ opacity: 0, y: -32, scale: 0.7 }}
                        transition={{ duration: 0.65, ease: 'easeOut' }}
                    >
                        +{xpBurst} XP
                    </motion.span>
                )}
            </AnimatePresence>
            <span style={{ marginRight: '8px', display: 'inline-flex', alignItems: 'center' }}>{checkedIn ? '✅' : '🍄'}</span>
            <span style={{ lineHeight: 1 }}>{loading ? 'Checking...' : buttonText}</span>
        </button>
    );
}
