'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const res = await fetch('/api/auth', {
            method: 'POST',
            body: JSON.stringify({ username, password, isRegister }),
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

                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="glass-input"
                            placeholder="Password"
                        />
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
                    <span
                        onClick={() => setIsRegister(!isRegister)}
                        style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: '600' }}
                    >
                        {isRegister ? 'Log in' : 'Create account'}
                    </span>
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
      `}</style>
        </div>
    );
}
