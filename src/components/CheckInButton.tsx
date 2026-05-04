'use client';

import { useState, useEffect } from 'react';

export default function CheckInButton() {
    const [checkedIn, setCheckedIn] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/checkin').then(res => res.json()).then(data => {
            if (data.checkedIn) setCheckedIn(true);
            setLoading(false);
        });
    }, []);

    const handleCheckIn = async () => {
        setLoading(true);
        const res = await fetch('/api/checkin', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            setCheckedIn(true);
            alert(`Checked in! +${data.pointsAdded} Points!`);
            window.location.reload(); // Refresh to update points in sidebar
        } else {
            alert(data.error);
        }
        setLoading(false);
    };

    if (loading) return <button className="btn btn-secondary" disabled>...</button>;

    return (
        <button
            className={`btn ${checkedIn ? '' : 'btn-success'}`}
            onClick={handleCheckIn}
            disabled={checkedIn}
            style={{ background: checkedIn ? '#b2bec3' : 'var(--success)', color: 'white', border: 'none' }}
        >
            {checkedIn ? '✅ Signed In' : '📍 Check In (+10 XP)'}
        </button>
    );
}
