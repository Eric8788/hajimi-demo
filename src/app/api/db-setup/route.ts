import { NextResponse } from 'next/server';
import { initDB } from '@/lib/db';

export async function GET() {
    console.log('Checking POSTGRES_URL...', !!process.env.POSTGRES_URL);
    try {
        await initDB();
        return NextResponse.json({ success: true, message: 'Database initialized successfully' });
    } catch (err) {
        console.error('Database initialization failed:', err);
        return NextResponse.json({ error: 'Database initialization failed', details: String(err) }, { status: 500 });
    }
}
