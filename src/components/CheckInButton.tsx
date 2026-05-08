'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CheckInButton() {
    const router = useRouter();
    const [checkedIn, setCheckedIn] = useState(false);
    const [loading, setLoading] = useState(true);
    const [buttonText, setButtonText] = useState('🍄 Check In · +10 XP');

    useEffect(() => {
        let isActive = true;

        fetch('/api/checkin')
            .then(res => res.json())
            .then(data => {
                if (!isActive) return;
                if (data.checkedIn) {
                    setCheckedIn(true);
                    setButtonText('✅ Signed In');
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
                setButtonText(`✅ Signed In · +${data.pointsAdded} XP`);
                router.refresh();
            } else {
                const alreadyChecked = data.error === 'Already checked in today';
                setCheckedIn(alreadyChecked);
                setButtonText(alreadyChecked ? '✅ Signed In' : 'Could not sign in');
            }
        } catch {
            setButtonText('Try again');
        }

        setLoading(false);
    };

    return (
        <button
            className={`checkin-button ${checkedIn ? 'is-complete' : 'is-ready'}`}
            onClick={handleCheckIn}
            disabled={loading || checkedIn}
            aria-live="polite"
        >
            {loading ? 'Checking...' : buttonText}
        </button>
    );
}
