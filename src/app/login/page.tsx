/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, type FormEvent } from 'react';
import ParticleBackground from '@/components/ParticleBackground';

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
            <ParticleBackground />
            <div className="glass-panel auth-card">
                <div className="auth-brand-row">
                    <span className="auth-logo-mark"><img className="auth-logo-image" src="/hajimi-logo.png" alt="" /></span>
                    <span>Hajimi</span>
                </div>
                <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>
                    {isRegister ? 'Join Hajimi' : 'Welcome Back'}
                </h1>
                <p style={{ textAlign: 'center', marginBottom: '30px', color: '#888' }}>
                    {isRegister ? 'Start your high school adventure' : 'Login to your account'}
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

                    <button type="submit" className="btn btn-primary auth-submit" style={{ justifyContent: 'center' }}>
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
                            className="auth-switch-btn"
                        >
                            {isRegister ? 'Log in' : 'Create account'}
                        </button>
                    </p>
                </div>

                <style jsx>{`
	        .auth-container {
	          position: relative;
	          display: flex;
	          justify-content: center;
	          align-items: center;
	          min-height: 100vh;
	          padding: 28px;
	          overflow: hidden;
	          background:
	            radial-gradient(circle at 50% 18%, rgba(162,155,254,0.08), transparent 32%),
	            linear-gradient(135deg, rgba(255,255,255,0.9), rgba(245,247,255,0.72));
	        }
	        .auth-card {
	           position: relative;
	           z-index: 2;
	           width: 100%;
	           max-width: 420px;
	           padding: 42px;
	           background: rgba(255, 255, 255, 0.64);
	           border: 1px solid rgba(255,255,255,0.78);
	           box-shadow: 0 24px 70px rgba(108, 92, 231, 0.16);
	           transition: transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease;
	        }
	        .auth-brand-row {
	          display: flex;
	          align-items: center;
	          justify-content: center;
	          gap: 10px;
	          margin-bottom: 22px;
	          color: #6c5ce7;
	          font-weight: 900;
	          letter-spacing: 0;
	        }
	        .auth-logo-mark {
	          width: 34px;
	          height: 34px;
	          display: inline-flex;
	          align-items: center;
	          justify-content: center;
	          border-radius: 12px;
	          color: white;
	          background: linear-gradient(135deg, #a29bfe, #6c5ce7);
	          box-shadow: 0 12px 26px rgba(108,92,231,0.22);
	        }
	        .auth-logo-image {
	          width: 30px;
	          height: 30px;
	          display: block;
	        }
	        .auth-submit {
	          transition: transform 0.22s ease, box-shadow 0.22s ease;
	        }
	        .auth-submit:hover {
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 18px 42px rgba(108,92,231,0.34);
	        }
	        .glass-input {
	          width: 100%;
	          padding: 16px;
	          border: 1px solid rgba(255,255,255,0.74);
	          background: rgba(255,255,255,0.58);
	          backdrop-filter: blur(14px);
	          border-radius: 12px;
	          font-size: 1.15rem;
	          font-weight: 600;
	          outline: none;
          transition: all 0.3s;
        }
	        .glass-input[type="password"] {
	          letter-spacing: 0.15em;
	        }
	        .glass-input:focus {
	          background: #fff;
	          box-shadow: 0 0 0 4px rgba(162,155,254,0.18), 0 10px 26px rgba(108,92,231,0.08);
	          border-color: var(--primary);
	        }
          .auth-switch-btn {
            color: var(--primary);
            cursor: pointer;
            font-weight: 600;
            background: none;
            border: none;
            padding: 0;
            font: inherit;
            transition: color 0.2s ease, transform 0.2s ease;
          }
          .auth-switch-btn:hover {
            color: #6c5ce7;
            transform: translateY(-1px);
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
