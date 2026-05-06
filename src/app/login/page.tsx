'use client';

import { useState, type FormEvent } from 'react';

export default function LoginPage() {
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, isRegister, inviteCode }),
        });

        const data = await res.json();

        if (res.ok) {
            // Force hard refresh to ensure session state updates
            window.location.href = '/';
        } else {
            setError(data.error);
        }
    };

    return (
        <div className="auth-container">
            <div className="glass-panel auth-card">
                <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>
                    {isRegister ? 'Join Hajimi' : 'Welcome Back'}
                </h1>
                <p style={{ textAlign: 'center', marginBottom: '30px', color: '#888' }}>
                    {isRegister ? 'Start your high school adventure' : 'Login to your student account'}
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="glass-input"
                            placeholder="Username"
                        />
                    </div>

                    {isRegister && (
                        <div>
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                required
                                className="glass-input"
                                placeholder="Invite code"
                                autoComplete="off"
                            />
                        </div>
                    )}

                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={isRegister ? 8 : undefined}
                            className="glass-input"
                            placeholder="Password"
                            autoComplete={isRegister ? 'new-password' : 'current-password'}
                        />
                        {isRegister && (
                            <div style={{ color: '#636e72', fontSize: '0.78rem', marginTop: '8px', lineHeight: 1.4 }}>
                                At least 8 characters with uppercase, lowercase, and a number.
                            </div>
                        )}
                    </div>

                    {error && (
                        <div style={{
                            background: 'rgba(255, 118, 117, 0.2)',
                            color: '#d63031',
                            padding: '10px',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                        {isRegister ? 'Create Account' : 'Sign In'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '30px', fontSize: '0.9rem', color: '#666' }}>
                    {isRegister ? 'Already a student?' : "New here?"}{' '}
                    <button
                        type="button"
                        onClick={() => {
                            setIsRegister(!isRegister);
                            setError('');
                            setInviteCode('');
                        }}
                        style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: '600', background: 'none', border: 'none', padding: 0, font: 'inherit' }}
                    >
                        {isRegister ? 'Log in' : 'Create account'}
                    </button>
                </p>
            </div>

            <style jsx>{`
        .auth-container {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }
        .auth-card {
           width: 100%;
           max-width: 420px;
           padding: 40px;
           background: rgba(255, 255, 255, 0.6);
        }
        .glass-input {
          width: 100%;
          padding: 16px;
          border: 1px solid rgba(255,255,255,0.4);
          background: rgba(255,255,255,0.5);
          border-radius: 12px;
          font-size: 1rem;
          outline: none;
          transition: all 0.3s;
        }
        .glass-input:focus {
          background: #fff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          border-color: var(--primary);
        }
        @media (max-width: 640px) {
          .auth-card {
            padding: 30px 20px;
            margin: 20px;
            border-radius: 20px;
          }
          h1 {
            font-size: 1.8rem;
          }
          .glass-input {
            padding: 14px;
            font-size: 0.95rem;
          }
        }
      `}</style>
        </div>
    );
}
