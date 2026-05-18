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

    useEffect(() => {
        let isActive = true;

        fetch('/api/checkin')
            .then(res => res.json())
            .then(data => {
                if (!isActive) return;
                if (data.checkedIn) {
                    setCheckedIn(true);
                    setButtonText('Signed In');
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
                setButtonText(alreadyChecked ? 'Signed In' : 'Could not sign in');
            }
        } catch {
            setButtonText('Try again');
        }

        setLoading(false);
    };

    return (
        <button
            onClick={handleCheckIn}
            disabled={checkedIn || loading}
            className={`btn btn-primary checkin-button ${checkedIn ? 'is-complete' : 'is-ready'}`}
            style={{ 
                minWidth: '180px', 
                opacity: loading ? 0.7 : 1,
                fontSize: '0.95rem',
                padding: '0 24px',
                height: '46px'
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
            <span style={{ marginRight: '8px' }}>{checkedIn ? '✅' : '🍄'}</span>
            {loading ? 'Checking...' : buttonText}
        </button>
    );
}
