import { db, sql, type VercelPoolClient } from '@vercel/postgres';
import {
    createAdminAuditEvent,
    createNotification,
    ensureCoinTables,
    ensureCoinWalletForClient,
    ensureAdminAuditTable,
    writeCoinTransactionForClient,
    type CoinTransactionType,
    type CoinWallet,
    type Project,
} from './db';

const DAY_MS = 24 * 60 * 60 * 1000;
export type HasdaqCompanyStatus = 'draft' | 'pending_review' | 'ipo' | 'listed' | 'paused' | 'rejected';
export type HasdaqCompanyType = 'student' | 'official_demo';
export type HasdaqListingApplicationStatus = 'pending' | 'approved' | 'rejected';
export type HasdaqTradeType = 'ipo_buy' | 'buy' | 'sell';

export interface HasdaqCompany {
    id: number;
    founder_id: number | null;
    founder_name?: string | null;
    name: string;
    ticker: string;
    company_type: HasdaqCompanyType;
    summary: string;
    pitch?: string | null;
    slogan?: string | null;
    value_pitch?: string | null;
    listing_pitch?: string | null;
    investment_thesis?: string | null;
    future_plan: string | null;
    risk_statement: string | null;
    status: HasdaqCompanyStatus;
    total_shares: number;
    founder_shares: number;
    public_shares_total: number;
    public_shares_remaining: number;
    ipo_price_milli: number;
    current_price_milli: number;
    previous_close_price_milli: number;
    h_coin_pool: number;
    pool_shares?: number;
    pool_coin_balance?: number;
    trading_paused_reason: string | null;
    listed_at: Date | string | null;
    lockup_until: Date | string | null;
    created_at: Date | string;
    updated_at: Date | string;
    holder_count?: number;
    volume_today?: number;
    volume_total?: number;
    change_percent_today?: number;
    market_cap_milli?: number;
    user_public_shares?: number;
    user_locked_shares?: number;
    product_count?: number;
    ipo_subscription_count?: number;
    ipo_subscribed_shares?: number;
}

export interface HasdaqCompanyMember {
    id: number;
    company_id: number;
    user_id: number;
    username?: string | null;
    role: 'founder' | 'member';
    status: 'invited' | 'accepted' | 'declined';
    equity_percent: number;
    founder_shares: number;
    accepted_at: Date | string | null;
    created_at: Date | string;
}

export interface HasdaqCompanyProduct {
    id: number;
    company_id: number;
    project_id: number | null;
    project_title?: string | null;
    name: string;
    url: string | null;
    description: string | null;
    proof_url: string | null;
    status: string;
    created_at: Date | string;
}

export interface HasdaqListingApplication {
    id: number;
    company_id: number;
    company_name?: string | null;
    ticker?: string | null;
    applicant_id: number | null;
    applicant_name?: string | null;
    status: HasdaqListingApplicationStatus;
    listing_reason: string | null;
    risk_statement: string | null;
    review_note: string | null;
    reviewed_by: number | null;
    reviewer_name?: string | null;
    reviewed_at: Date | string | null;
    created_at: Date | string;
}

export interface HasdaqPosition {
    user_id: number;
    company_id: number;
    public_shares: number;
    locked_shares: number;
    average_cost_milli: number;
    updated_at: Date | string;
}

export interface HasdaqTrade {
    id: number;
    company_id: number;
    user_id: number | null;
    username?: string | null;
    type: HasdaqTradeType;
    shares: number;
    locked_shares_sold?: number;
    price_milli: number;
    gross_amount: number;
    coin_transaction_id: number | null;
    status: string;
    created_at: Date | string;
}

export interface HasdaqAnnouncement {
    id: number;
    company_id: number;
    author_id: number | null;
    author_name?: string | null;
    title: string;
    body: string;
    category: string;
    created_at: Date | string;
}

export interface HasdaqOverview {
    companies: HasdaqCompany[];
    officialDemoCompanies: HasdaqCompany[];
    ipoCompanies: HasdaqCompany[];
    listedCompanies: HasdaqCompany[];
    myPositions: Array<HasdaqPosition & { company_name: string; ticker: string; current_price_milli: number; status: HasdaqCompanyStatus; company_type?: HasdaqCompanyType }>;
    latestAnnouncements: Array<HasdaqAnnouncement & { company_name: string; ticker: string }>;
}

export interface HasdaqCompanyDetail {
    company: HasdaqCompany;
    members: HasdaqCompanyMember[];
    products: HasdaqCompanyProduct[];
    announcements: HasdaqAnnouncement[];
    trades: HasdaqTrade[];
    applications: HasdaqListingApplication[];
    myPosition: HasdaqPosition | null;
}
const LOCAL_DEV_USER_ID = 1;

function isHasdaqLocalDemoEnabled() {
    return process.env.NODE_ENV !== 'production'
        && !process.env.POSTGRES_URL
        && !process.env.POSTGRES_URL_NON_POOLING
        && !process.env.DATABASE_URL;
}

function getShanghaiDateKey(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const year = parts.find(part => part.type === 'year')?.value || '1970';
    const month = parts.find(part => part.type === 'month')?.value || '01';
    const day = parts.find(part => part.type === 'day')?.value || '01';
    return `${year}-${month}-${day}`;
}

function getShanghaiDateKeyFromOffset(offsetFromToday: number) {
    return getShanghaiDateKey(new Date(Date.now() + offsetFromToday * DAY_MS));
}

function normalizeCoinWallet(row: CoinWallet): CoinWallet {
    return {
        ...row,
        user_id: Number(row.user_id),
        balance: Number(row.balance || 0),
        earned_total: Number(row.earned_total || 0),
        spent_total: Number(row.spent_total || 0),
    };
}

function getLocalDevProjects(): Project[] {
    return [
        {
            id: 301,
            author_id: LOCAL_DEV_USER_ID,
            author_name: LOCAL_DEV_HASDAQ_ADMIN_NAME,
            title: 'Campus Study Kit',
            description: 'A complete simulated study-tool portal used as a mature Hasdaq proof.',
            emoji: 'H',
            url: 'https://example.com/nova-learning-demo',
            tags: ['AI', 'Tool'],
            accent_color: '#6c5ce7',
            status: 'live',
            likes: 0,
            rating: 4.8,
            rating_count: 18,
            created_at: new Date().toISOString(),
        },
        {
            id: 302,
            author_id: LOCAL_DEV_USER_ID,
            author_name: 'demo_founder_quiz',
            title: 'QuizForge Arena',
            description: 'A playable classroom quiz battle demo.',
            emoji: 'Q',
            url: 'https://hub.ericproject.xyz/projects/quiz-forge/index.html',
            tags: ['Game', 'AI'],
            accent_color: '#00b894',
            status: 'live',
            likes: 0,
            rating: 4.5,
            rating_count: 12,
            created_at: new Date().toISOString(),
        },
        {
            id: 303,
            author_id: LOCAL_DEV_USER_ID,
            author_name: 'demo_founder_harbor',
            title: 'Harbor Physics Demo',
            description: 'A physics simulator used as a mature project proof.',
            emoji: 'S',
            url: 'https://example.com/harbor-physics-demo',
            tags: ['Game'],
            accent_color: '#0984e3',
            status: 'live',
            likes: 0,
            rating: 4.1,
            rating_count: 9,
            created_at: new Date().toISOString(),
        },
    ];
}
const HASDAQ_TOTAL_SHARES = 1000;
const HASDAQ_FOUNDER_SHARES = 700;
const HASDAQ_PUBLIC_SHARES = 300;
const HASDAQ_IPO_PRICE_MILLI = 1000;
const HASDAQ_MIN_PRICE_MILLI = 200;
const HASDAQ_PRICE_STEP_MILLI = 20;
const HASDAQ_SHARES_PER_PRICE_STEP = 10;
const HASDAQ_MAX_IPO_SHARES_PER_ORDER = 20;
const HASDAQ_MAX_IPO_SHARES_PER_USER = 20;
const HASDAQ_MAX_BUY_SHARES = 10;
const HASDAQ_MAX_SELL_SHARES = 30;
const HASDAQ_MAX_PUBLIC_SHARES_PER_USER = 50;
const HASDAQ_MAX_DAILY_TRADES = 5;
const HASDAQ_DAILY_LIMIT_PERCENT = 20;
const HASDAQ_MIN_BELL_SUBSCRIBERS = 5;
const HASDAQ_MIN_BELL_SUBSCRIBED_SHARES = 50;
const HASDAQ_OFFICIAL_DEMO_TICKER = 'HJM';
const HASDAQ_OFFICIAL_DEMO_NAME = 'Hajimi Platform';
const HASDAQ_OFFICIAL_DEMO_SEEDED_SHARES = 40;

let hasdaqTablesReady: Promise<void> | null = null;

export async function ensureHasdaqTables() {
    if (!hasdaqTablesReady) {
        hasdaqTablesReady = (async () => {
            await ensureCoinTables();
            await sql`
              CREATE TABLE IF NOT EXISTS hasdaq_companies (
                id SERIAL PRIMARY KEY,
                founder_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                ticker TEXT UNIQUE NOT NULL,
                company_type TEXT NOT NULL DEFAULT 'student',
                summary TEXT NOT NULL DEFAULT '',
                future_plan TEXT,
                risk_statement TEXT,
                status TEXT NOT NULL DEFAULT 'draft',
                total_shares INTEGER NOT NULL DEFAULT 1000,
                founder_shares INTEGER NOT NULL DEFAULT 700,
                public_shares_total INTEGER NOT NULL DEFAULT 300,
                public_shares_remaining INTEGER NOT NULL DEFAULT 300,
                ipo_price_milli INTEGER NOT NULL DEFAULT 1000,
                current_price_milli INTEGER NOT NULL DEFAULT 1000,
                previous_close_price_milli INTEGER NOT NULL DEFAULT 1000,
                h_coin_pool INTEGER NOT NULL DEFAULT 0,
                trading_paused_reason TEXT,
                listed_at TIMESTAMP WITH TIME ZONE,
                lockup_until TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS founder_id INTEGER REFERENCES users(id) ON DELETE SET NULL`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS ticker TEXT NOT NULL DEFAULT ''`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS company_type TEXT NOT NULL DEFAULT 'student'`;
            await sql`ALTER TABLE hasdaq_companies ALTER COLUMN company_type SET DEFAULT 'student'`;
            await sql`
              UPDATE hasdaq_companies
              SET company_type = 'student'
              WHERE company_type IS NULL
                 OR company_type = ''
                 OR company_type IN ('solo', 'team')
                 OR company_type NOT IN ('student', 'official_demo')
            `;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT ''`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS future_plan TEXT`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS risk_statement TEXT`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS total_shares INTEGER NOT NULL DEFAULT 1000`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS founder_shares INTEGER NOT NULL DEFAULT 700`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS public_shares_total INTEGER NOT NULL DEFAULT 300`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS public_shares_remaining INTEGER NOT NULL DEFAULT 300`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS ipo_price_milli INTEGER NOT NULL DEFAULT 1000`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS current_price_milli INTEGER NOT NULL DEFAULT 1000`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS previous_close_price_milli INTEGER NOT NULL DEFAULT 1000`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS h_coin_pool INTEGER NOT NULL DEFAULT 0`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS trading_paused_reason TEXT`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS listed_at TIMESTAMP WITH TIME ZONE`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS lockup_until TIMESTAMP WITH TIME ZONE`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
            await sql`ALTER TABLE hasdaq_companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
            await sql`
              CREATE TABLE IF NOT EXISTS hasdaq_company_members (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES hasdaq_companies(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role TEXT NOT NULL DEFAULT 'member',
                status TEXT NOT NULL DEFAULT 'invited',
                equity_percent INTEGER NOT NULL DEFAULT 0,
                founder_shares INTEGER NOT NULL DEFAULT 0,
                accepted_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_id, user_id)
              );
            `;
            await sql`ALTER TABLE hasdaq_company_members ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES hasdaq_companies(id) ON DELETE CASCADE`;
            await sql`ALTER TABLE hasdaq_company_members ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`;
            await sql`ALTER TABLE hasdaq_company_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'`;
            await sql`ALTER TABLE hasdaq_company_members ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'invited'`;
            await sql`ALTER TABLE hasdaq_company_members ADD COLUMN IF NOT EXISTS equity_percent INTEGER NOT NULL DEFAULT 0`;
            await sql`ALTER TABLE hasdaq_company_members ADD COLUMN IF NOT EXISTS founder_shares INTEGER NOT NULL DEFAULT 0`;
            await sql`ALTER TABLE hasdaq_company_members ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE`;
            await sql`ALTER TABLE hasdaq_company_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
            await sql`
              CREATE TABLE IF NOT EXISTS hasdaq_company_products (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES hasdaq_companies(id) ON DELETE CASCADE,
                project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                url TEXT,
                description TEXT,
                proof_url TEXT,
                status TEXT NOT NULL DEFAULT 'mature',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`ALTER TABLE hasdaq_company_products ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES hasdaq_companies(id) ON DELETE CASCADE`;
            await sql`ALTER TABLE hasdaq_company_products ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL`;
            await sql`ALTER TABLE hasdaq_company_products ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''`;
            await sql`ALTER TABLE hasdaq_company_products ADD COLUMN IF NOT EXISTS url TEXT`;
            await sql`ALTER TABLE hasdaq_company_products ADD COLUMN IF NOT EXISTS description TEXT`;
            await sql`ALTER TABLE hasdaq_company_products ADD COLUMN IF NOT EXISTS proof_url TEXT`;
            await sql`ALTER TABLE hasdaq_company_products ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'mature'`;
            await sql`ALTER TABLE hasdaq_company_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
            await sql`
              CREATE TABLE IF NOT EXISTS hasdaq_listing_applications (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES hasdaq_companies(id) ON DELETE CASCADE,
                applicant_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                listing_reason TEXT,
                risk_statement TEXT,
                review_note TEXT,
                reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                reviewed_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`ALTER TABLE hasdaq_listing_applications ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES hasdaq_companies(id) ON DELETE CASCADE`;
            await sql`ALTER TABLE hasdaq_listing_applications ADD COLUMN IF NOT EXISTS applicant_id INTEGER REFERENCES users(id) ON DELETE SET NULL`;
            await sql`ALTER TABLE hasdaq_listing_applications ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`;
            await sql`ALTER TABLE hasdaq_listing_applications ADD COLUMN IF NOT EXISTS listing_reason TEXT`;
            await sql`ALTER TABLE hasdaq_listing_applications ADD COLUMN IF NOT EXISTS risk_statement TEXT`;
            await sql`ALTER TABLE hasdaq_listing_applications ADD COLUMN IF NOT EXISTS review_note TEXT`;
            await sql`ALTER TABLE hasdaq_listing_applications ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL`;
            await sql`ALTER TABLE hasdaq_listing_applications ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE`;
            await sql`ALTER TABLE hasdaq_listing_applications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
            await sql`
              CREATE TABLE IF NOT EXISTS hasdaq_positions (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                company_id INTEGER NOT NULL REFERENCES hasdaq_companies(id) ON DELETE CASCADE,
                public_shares INTEGER NOT NULL DEFAULT 0,
                locked_shares INTEGER NOT NULL DEFAULT 0,
                average_cost_milli INTEGER NOT NULL DEFAULT 0,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(user_id, company_id)
              );
            `;
            await sql`ALTER TABLE hasdaq_positions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`;
            await sql`ALTER TABLE hasdaq_positions ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES hasdaq_companies(id) ON DELETE CASCADE`;
            await sql`ALTER TABLE hasdaq_positions ADD COLUMN IF NOT EXISTS public_shares INTEGER NOT NULL DEFAULT 0`;
            await sql`ALTER TABLE hasdaq_positions ADD COLUMN IF NOT EXISTS locked_shares INTEGER NOT NULL DEFAULT 0`;
            await sql`ALTER TABLE hasdaq_positions ADD COLUMN IF NOT EXISTS average_cost_milli INTEGER NOT NULL DEFAULT 0`;
            await sql`ALTER TABLE hasdaq_positions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
            await sql`
              CREATE TABLE IF NOT EXISTS hasdaq_trades (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES hasdaq_companies(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                type TEXT NOT NULL,
                shares INTEGER NOT NULL CHECK (shares > 0),
                locked_shares_sold INTEGER NOT NULL DEFAULT 0,
                price_milli INTEGER NOT NULL CHECK (price_milli >= 0),
                gross_amount INTEGER NOT NULL CHECK (gross_amount >= 0),
                coin_transaction_id INTEGER REFERENCES coin_transactions(id) ON DELETE SET NULL,
                status TEXT NOT NULL DEFAULT 'filled',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`ALTER TABLE hasdaq_trades ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES hasdaq_companies(id) ON DELETE CASCADE`;
            await sql`ALTER TABLE hasdaq_trades ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`;
            await sql`ALTER TABLE hasdaq_trades ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'buy'`;
            await sql`ALTER TABLE hasdaq_trades ADD COLUMN IF NOT EXISTS shares INTEGER NOT NULL DEFAULT 1`;
            await sql`ALTER TABLE hasdaq_trades ADD COLUMN IF NOT EXISTS locked_shares_sold INTEGER NOT NULL DEFAULT 0`;
            await sql`ALTER TABLE hasdaq_trades ADD COLUMN IF NOT EXISTS price_milli INTEGER NOT NULL DEFAULT 1000`;
            await sql`ALTER TABLE hasdaq_trades ADD COLUMN IF NOT EXISTS gross_amount INTEGER NOT NULL DEFAULT 0`;
            await sql`ALTER TABLE hasdaq_trades ADD COLUMN IF NOT EXISTS coin_transaction_id INTEGER REFERENCES coin_transactions(id) ON DELETE SET NULL`;
            await sql`ALTER TABLE hasdaq_trades ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'filled'`;
            await sql`ALTER TABLE hasdaq_trades ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
            await sql`
              CREATE TABLE IF NOT EXISTS hasdaq_announcements (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES hasdaq_companies(id) ON DELETE CASCADE,
                author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'update',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`ALTER TABLE hasdaq_announcements ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES hasdaq_companies(id) ON DELETE CASCADE`;
            await sql`ALTER TABLE hasdaq_announcements ADD COLUMN IF NOT EXISTS author_id INTEGER REFERENCES users(id) ON DELETE SET NULL`;
            await sql`ALTER TABLE hasdaq_announcements ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''`;
            await sql`ALTER TABLE hasdaq_announcements ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT ''`;
            await sql`ALTER TABLE hasdaq_announcements ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'update'`;
            await sql`ALTER TABLE hasdaq_announcements ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
            await sql`
              CREATE TABLE IF NOT EXISTS hasdaq_daily_limits (
                company_id INTEGER NOT NULL REFERENCES hasdaq_companies(id) ON DELETE CASCADE,
                trade_date DATE NOT NULL DEFAULT CURRENT_DATE,
                open_price_milli INTEGER NOT NULL,
                high_price_milli INTEGER NOT NULL,
                low_price_milli INTEGER NOT NULL,
                trade_count INTEGER NOT NULL DEFAULT 0,
                volume INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(company_id, trade_date)
              );
            `;
            await sql`ALTER TABLE hasdaq_daily_limits ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES hasdaq_companies(id) ON DELETE CASCADE`;
            await sql`ALTER TABLE hasdaq_daily_limits ADD COLUMN IF NOT EXISTS trade_date DATE NOT NULL DEFAULT CURRENT_DATE`;
            await sql`ALTER TABLE hasdaq_daily_limits ADD COLUMN IF NOT EXISTS open_price_milli INTEGER NOT NULL DEFAULT 1000`;
            await sql`ALTER TABLE hasdaq_daily_limits ADD COLUMN IF NOT EXISTS high_price_milli INTEGER NOT NULL DEFAULT 1000`;
            await sql`ALTER TABLE hasdaq_daily_limits ADD COLUMN IF NOT EXISTS low_price_milli INTEGER NOT NULL DEFAULT 1000`;
            await sql`ALTER TABLE hasdaq_daily_limits ADD COLUMN IF NOT EXISTS trade_count INTEGER NOT NULL DEFAULT 0`;
            await sql`ALTER TABLE hasdaq_daily_limits ADD COLUMN IF NOT EXISTS volume INTEGER NOT NULL DEFAULT 0`;
            await sql`ALTER TABLE hasdaq_daily_limits ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
            await sql`ALTER TABLE hasdaq_daily_limits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
            await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_hasdaq_companies_ticker_unique ON hasdaq_companies(ticker) WHERE ticker != ''`;
            await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_hasdaq_members_company_user_unique ON hasdaq_company_members(company_id, user_id)`;
            await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_hasdaq_positions_user_company_unique ON hasdaq_positions(user_id, company_id)`;
            await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_hasdaq_daily_company_date_unique ON hasdaq_daily_limits(company_id, trade_date)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_hasdaq_companies_status_created ON hasdaq_companies(status, created_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_hasdaq_members_user_status ON hasdaq_company_members(user_id, status)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_hasdaq_applications_status_created ON hasdaq_listing_applications(status, created_at DESC)`;
            await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_hasdaq_applications_one_pending ON hasdaq_listing_applications(company_id) WHERE status = 'pending'`;
            await sql`CREATE INDEX IF NOT EXISTS idx_hasdaq_trades_company_created ON hasdaq_trades(company_id, created_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_hasdaq_trades_user_created ON hasdaq_trades(user_id, created_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_hasdaq_announcements_company_created ON hasdaq_announcements(company_id, created_at DESC)`;
            await seedHasdaqDemoMarketIfEmpty();
        })().catch(error => {
            hasdaqTablesReady = null;
            throw error;
        });
    }

    return hasdaqTablesReady;
}

const HASDAQ_DEMO_SEED_PASSWORD_HASH = '$2b$10$eQWf7Um4mjHlhDTBwFgPI.Hxp5WKrvjQe9sHo.mYzyB26szdWOvmq';

function hasdaqSeedDate(offsetDays: number, hour = 10) {
    const date = new Date(Date.now() + offsetDays * DAY_MS);
    const normalizedHour = Math.max(0, Math.min(23, Math.floor(hour)));
    date.setUTCHours((normalizedHour + 16) % 24, 0, 0, 0);
    return date.toISOString();
}

async function ensureHasdaqDemoUserForSeed(client: VercelPoolClient, username: string) {
    const { rows } = await client.sql<{ id: number }>`
      INSERT INTO users (
        username,
        password_hash,
        points,
        level,
        role,
        bio,
        avatar,
        avatar_emoji,
        avatar_theme,
        verification_status,
        verification_type,
        verified_grade,
        verified_at,
        account_status,
        disabled_at,
        disabled_reason
      )
      VALUES (
        ${username},
        ${HASDAQ_DEMO_SEED_PASSWORD_HASH},
        0,
        1,
        'student',
        'Hasdaq neutral demo account.',
        '📈',
        '📈',
        'mint',
        'verified',
        'student',
        'Demo',
        CURRENT_TIMESTAMP,
        'disabled',
        CURRENT_TIMESTAMP,
        'Hasdaq neutral demo seed account'
      )
      ON CONFLICT (username)
      DO UPDATE SET username = EXCLUDED.username
      RETURNING id
    `;

    return Number(rows[0]?.id || 0);
}

async function seedHasdaqDemoMarketIfEmpty() {
    if (process.env.HAJIMI_HASDAQ_DEMO_SEED === '0') return;

    const client = await db.connect();
    try {
        await client.sql`BEGIN`;
        await client.sql`LOCK TABLE hasdaq_companies IN SHARE ROW EXCLUSIVE MODE`;

        const demoUsernames = [
            'hasdaq_demo_reviewer',
            'hasdaq_demo_official_founder',
            'hasdaq_demo_trader_a',
            'hasdaq_demo_trader_b',
            'hasdaq_demo_trader_c',
            'hasdaq_demo_trader_d',
            'hasdaq_demo_trader_e',
        ];
        const userIds: Record<string, number> = {};
        for (const username of demoUsernames) {
            userIds[username] = await ensureHasdaqDemoUserForSeed(client, username);
        }

        await client.sql`
          UPDATE hasdaq_companies
          SET
            status = 'rejected',
            trading_paused_reason = COALESCE(trading_paused_reason, 'Replaced by Hajimi Platform / HJM official demo stock.'),
            updated_at = CURRENT_TIMESTAMP
          WHERE ticker IN ('NOVA', 'QFORGE', 'HARBOR', 'PROMPT', 'ATLAS')
            AND ticker != ${HASDAQ_OFFICIAL_DEMO_TICKER}
            AND founder_id IN (SELECT id FROM users WHERE username LIKE 'hasdaq_demo_%')
        `;

        const seededRemaining = HASDAQ_PUBLIC_SHARES - HASDAQ_OFFICIAL_DEMO_SEEDED_SHARES;
        const { rows: companyRows } = await client.sql<{ id: number }>`
          INSERT INTO hasdaq_companies (
            founder_id,
            name,
            ticker,
            company_type,
            summary,
            future_plan,
            risk_statement,
            status,
            total_shares,
            founder_shares,
            public_shares_total,
            public_shares_remaining,
            ipo_price_milli,
            current_price_milli,
            previous_close_price_milli,
            h_coin_pool,
            trading_paused_reason,
            listed_at,
            lockup_until,
            created_at,
            updated_at
          )
          VALUES (
            ${userIds.hasdaq_demo_official_founder},
            ${HASDAQ_OFFICIAL_DEMO_NAME},
            ${HASDAQ_OFFICIAL_DEMO_TICKER},
            'official_demo',
            'Hajimi Platform 是 Hasdaq 的官方示范股，用来演示 IPO 认购、敲钟上市和公开股交易机制，不代表任何个人收益。',
            '持续作为 Hasdaq 课堂演示样板，帮助同学理解学生模拟公司如何申请 IPO、认购、敲钟和交易。',
            '官方示范股不参与学生公司榜单或月度奖励；创始股永久锁仓；股价仍由公开股买卖决定。',
            'ipo',
            ${HASDAQ_TOTAL_SHARES},
            ${HASDAQ_FOUNDER_SHARES},
            ${HASDAQ_PUBLIC_SHARES},
            ${seededRemaining},
            ${HASDAQ_IPO_PRICE_MILLI},
            ${HASDAQ_IPO_PRICE_MILLI},
            ${HASDAQ_IPO_PRICE_MILLI},
            ${HASDAQ_OFFICIAL_DEMO_SEEDED_SHARES},
            ${null},
            ${null},
            ${null},
            ${hasdaqSeedDate(-7, 10)},
            ${hasdaqSeedDate(0, 9)}
          )
          ON CONFLICT (ticker)
          DO UPDATE SET
            founder_id = EXCLUDED.founder_id,
            name = EXCLUDED.name,
            company_type = 'official_demo',
            summary = EXCLUDED.summary,
            future_plan = EXCLUDED.future_plan,
            risk_statement = EXCLUDED.risk_statement,
            status = CASE
              WHEN hasdaq_companies.status IN ('ipo', 'listed', 'paused') THEN hasdaq_companies.status
              ELSE 'ipo'
            END,
            total_shares = EXCLUDED.total_shares,
            founder_shares = EXCLUDED.founder_shares,
            public_shares_total = EXCLUDED.public_shares_total,
            public_shares_remaining = CASE
              WHEN hasdaq_companies.status IN ('listed', 'paused') THEN hasdaq_companies.public_shares_remaining
              ELSE LEAST(COALESCE(hasdaq_companies.public_shares_remaining, EXCLUDED.public_shares_remaining), EXCLUDED.public_shares_remaining)
            END,
            ipo_price_milli = EXCLUDED.ipo_price_milli,
            current_price_milli = CASE
              WHEN hasdaq_companies.status IN ('listed', 'paused') THEN hasdaq_companies.current_price_milli
              ELSE EXCLUDED.current_price_milli
            END,
            previous_close_price_milli = CASE
              WHEN hasdaq_companies.status IN ('listed', 'paused') THEN hasdaq_companies.previous_close_price_milli
              ELSE EXCLUDED.previous_close_price_milli
            END,
            h_coin_pool = CASE
              WHEN hasdaq_companies.status IN ('listed', 'paused') THEN hasdaq_companies.h_coin_pool
              ELSE GREATEST(COALESCE(hasdaq_companies.h_coin_pool, 0), EXCLUDED.h_coin_pool)
            END,
            trading_paused_reason = CASE
              WHEN hasdaq_companies.status = 'paused' THEN hasdaq_companies.trading_paused_reason
              ELSE NULL
            END,
            lockup_until = NULL,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `;
        const companyId = Number(companyRows[0]?.id || 0);
        if (!companyId) throw new Error('Hasdaq official demo seed failed');

        await client.sql`
          INSERT INTO hasdaq_company_members (company_id, user_id, role, status, equity_percent, founder_shares, accepted_at, created_at)
          VALUES (${companyId}, ${userIds.hasdaq_demo_official_founder}, 'founder', 'accepted', 100, ${HASDAQ_FOUNDER_SHARES}, ${hasdaqSeedDate(-7, 10)}, ${hasdaqSeedDate(-7, 10)})
          ON CONFLICT (company_id, user_id)
          DO UPDATE SET role = 'founder', status = 'accepted', equity_percent = 100, founder_shares = ${HASDAQ_FOUNDER_SHARES}, accepted_at = COALESCE(hasdaq_company_members.accepted_at, EXCLUDED.accepted_at)
        `;

        await client.sql`DELETE FROM hasdaq_company_products WHERE company_id = ${companyId}`;
        await client.sql`
          INSERT INTO hasdaq_company_products (company_id, project_id, name, url, description, proof_url, status, created_at)
          VALUES (
            ${companyId},
            ${null},
            'Hasdaq Official Demo Flow',
            'https://hajimi.ericproject.xyz/hasdaq',
            '官方示范流程：IPO 认购、管理员敲钟、公开股买卖和行情变化。',
            'https://hajimi.ericproject.xyz/hasdaq',
            'mature',
            ${hasdaqSeedDate(-7, 10)}
          )
        `;

        await client.sql`
          DELETE FROM hasdaq_listing_applications
          WHERE company_id = ${companyId}
            AND (
              applicant_id IN (SELECT id FROM users WHERE username LIKE 'hasdaq_demo_%')
              OR reviewed_by IN (SELECT id FROM users WHERE username LIKE 'hasdaq_demo_%')
            )
        `;
        await client.sql`
          INSERT INTO hasdaq_listing_applications (company_id, applicant_id, status, listing_reason, risk_statement, review_note, reviewed_by, reviewed_at, created_at)
          VALUES (
            ${companyId},
            ${userIds.hasdaq_demo_official_founder},
            'approved',
            'Hajimi Platform is the official demo stock for teaching the Hasdaq IPO and bell-listing workflow.',
            'Official demo stock: no personal return promise, no student ranking, no monthly award, founder shares permanently locked.',
            'Approved as Hasdaq official demo stock.',
            ${userIds.hasdaq_demo_reviewer},
            ${hasdaqSeedDate(-6, 12)},
            ${hasdaqSeedDate(-7, 11)}
          )
        `;

        await client.sql`
          DELETE FROM hasdaq_trades
          WHERE company_id = ${companyId}
            AND user_id IN (SELECT id FROM users WHERE username LIKE 'hasdaq_demo_%')
        `;

        const ipoRows = [
            { username: 'hasdaq_demo_trader_a', shares: 12, createdAt: hasdaqSeedDate(-5, 12) },
            { username: 'hasdaq_demo_trader_b', shares: 10, createdAt: hasdaqSeedDate(-4, 16) },
            { username: 'hasdaq_demo_trader_c', shares: 8, createdAt: hasdaqSeedDate(-3, 12) },
            { username: 'hasdaq_demo_trader_d', shares: 6, createdAt: hasdaqSeedDate(-2, 14) },
            { username: 'hasdaq_demo_trader_e', shares: 4, createdAt: hasdaqSeedDate(-1, 15) },
        ];
        for (const row of ipoRows) {
            await client.sql`
              INSERT INTO hasdaq_positions (user_id, company_id, public_shares, locked_shares, average_cost_milli, updated_at)
              VALUES (${userIds[row.username]}, ${companyId}, ${row.shares}, 0, ${HASDAQ_IPO_PRICE_MILLI}, ${row.createdAt})
              ON CONFLICT (user_id, company_id)
              DO UPDATE SET
                public_shares = GREATEST(hasdaq_positions.public_shares, EXCLUDED.public_shares),
                average_cost_milli = CASE WHEN hasdaq_positions.average_cost_milli > 0 THEN hasdaq_positions.average_cost_milli ELSE EXCLUDED.average_cost_milli END,
                updated_at = GREATEST(hasdaq_positions.updated_at, EXCLUDED.updated_at)
            `;
            await client.sql`
              INSERT INTO hasdaq_trades (company_id, user_id, type, shares, locked_shares_sold, price_milli, gross_amount, coin_transaction_id, status, created_at)
              VALUES (${companyId}, ${userIds[row.username]}, 'ipo_buy', ${row.shares}, 0, ${HASDAQ_IPO_PRICE_MILLI}, ${row.shares}, ${null}, 'filled', ${row.createdAt})
            `;
        }

        await client.sql`
          UPDATE hasdaq_companies
          SET
            public_shares_remaining = CASE
              WHEN status = 'ipo' THEN LEAST(public_shares_remaining, ${seededRemaining})
              ELSE public_shares_remaining
            END,
            h_coin_pool = CASE
              WHEN status = 'ipo' THEN GREATEST(h_coin_pool, ${HASDAQ_OFFICIAL_DEMO_SEEDED_SHARES})
              ELSE h_coin_pool
            END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${companyId}
        `;

        await client.sql`
          DELETE FROM hasdaq_announcements
          WHERE company_id = ${companyId}
            AND author_id IN (SELECT id FROM users WHERE username LIKE 'hasdaq_demo_%')
        `;
        await client.sql`
          INSERT INTO hasdaq_announcements (company_id, author_id, title, body, category, created_at)
          VALUES (
            ${companyId},
            ${userIds.hasdaq_demo_official_founder},
            '官方示范股说明',
            'Hajimi Platform / HJM 只用于演示 Hasdaq 的 IPO、敲钟和交易机制；它不代表个人收益，不参与学生公司榜单或月度奖励，创始股永久锁仓。',
            'official_demo',
            ${hasdaqSeedDate(-1, 10)}
          )
        `;

        await client.sql`COMMIT`;
    } catch (error) {
        await client.sql`ROLLBACK`;
        console.warn('Hasdaq demo seed skipped:', error);
    } finally {
        client.release();
    }
}

function normalizeHasdaqTicker(value: unknown) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function normalizeHasdaqCompanyType(value: unknown): HasdaqCompanyType {
    return value === 'official_demo' ? 'official_demo' : 'student';
}

function normalizeHasdaqCompany(row: HasdaqCompany): HasdaqCompany {
    const current = Number(row.current_price_milli || HASDAQ_IPO_PRICE_MILLI);
    const previous = Number(row.previous_close_price_milli || HASDAQ_IPO_PRICE_MILLI);
    const publicSharesRemaining = Number(row.public_shares_remaining || 0);
    const coinPool = Number(row.h_coin_pool || 0);
    return {
        ...row,
        id: Number(row.id),
        founder_id: row.founder_id === null || row.founder_id === undefined ? null : Number(row.founder_id),
        company_type: normalizeHasdaqCompanyType(row.company_type),
        total_shares: Number(row.total_shares || HASDAQ_TOTAL_SHARES),
        founder_shares: Number(row.founder_shares || HASDAQ_FOUNDER_SHARES),
        public_shares_total: Number(row.public_shares_total || HASDAQ_PUBLIC_SHARES),
        public_shares_remaining: publicSharesRemaining,
        ipo_price_milli: Number(row.ipo_price_milli || HASDAQ_IPO_PRICE_MILLI),
        current_price_milli: current,
        previous_close_price_milli: previous,
        h_coin_pool: coinPool,
        pool_shares: publicSharesRemaining,
        pool_coin_balance: coinPool,
        holder_count: Number(row.holder_count || 0),
        volume_today: Number(row.volume_today || 0),
        volume_total: Number(row.volume_total || 0),
        market_cap_milli: current * Number(row.total_shares || HASDAQ_TOTAL_SHARES),
        change_percent_today: previous > 0 ? Math.round(((current - previous) / previous) * 10000) / 100 : 0,
        user_public_shares: Number(row.user_public_shares || 0),
        user_locked_shares: Number(row.user_locked_shares || 0),
        product_count: Number(row.product_count || 0),
        ipo_subscription_count: Number(row.ipo_subscription_count || 0),
        ipo_subscribed_shares: Number(row.ipo_subscribed_shares || 0),
    };
}

function normalizeHasdaqPosition(row: HasdaqPosition): HasdaqPosition {
    return {
        ...row,
        user_id: Number(row.user_id),
        company_id: Number(row.company_id),
        public_shares: Number(row.public_shares || 0),
        locked_shares: Number(row.locked_shares || 0),
        average_cost_milli: Number(row.average_cost_milli || 0),
    };
}

function normalizeHasdaqTrade(row: HasdaqTrade): HasdaqTrade {
    return {
        ...row,
        id: Number(row.id),
        company_id: Number(row.company_id),
        user_id: row.user_id === null || row.user_id === undefined ? null : Number(row.user_id),
        shares: Number(row.shares || 0),
        locked_shares_sold: Number(row.locked_shares_sold || 0),
        price_milli: Number(row.price_milli || 0),
        gross_amount: Number(row.gross_amount || 0),
        coin_transaction_id: row.coin_transaction_id === null || row.coin_transaction_id === undefined ? null : Number(row.coin_transaction_id),
    };
}

function normalizeHasdaqMember(row: HasdaqCompanyMember): HasdaqCompanyMember {
    return {
        ...row,
        id: Number(row.id),
        company_id: Number(row.company_id),
        user_id: Number(row.user_id),
        equity_percent: Number(row.equity_percent || 0),
        founder_shares: Number(row.founder_shares || 0),
    };
}

function normalizeHasdaqProduct(row: HasdaqCompanyProduct): HasdaqCompanyProduct {
    return {
        ...row,
        id: Number(row.id),
        company_id: Number(row.company_id),
        project_id: row.project_id === null || row.project_id === undefined ? null : Number(row.project_id),
    };
}

function normalizeHasdaqApplication(row: HasdaqListingApplication): HasdaqListingApplication {
    return {
        ...row,
        id: Number(row.id),
        company_id: Number(row.company_id),
        applicant_id: row.applicant_id === null || row.applicant_id === undefined ? null : Number(row.applicant_id),
        reviewed_by: row.reviewed_by === null || row.reviewed_by === undefined ? null : Number(row.reviewed_by),
    };
}

function normalizeHasdaqAnnouncement(row: HasdaqAnnouncement): HasdaqAnnouncement {
    return {
        ...row,
        id: Number(row.id),
        company_id: Number(row.company_id),
        author_id: row.author_id === null || row.author_id === undefined ? null : Number(row.author_id),
    };
}

function parseHasdaqPositiveInt(value: unknown, fallback = 0) {
    const parsed = Math.floor(Number(value));
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeHasdaqText(value: unknown, maxLength: number) {
    return String(value || '').trim().slice(0, maxLength);
}

function assertHasdaqCompanyEditable(company: HasdaqCompany | undefined, userId: number) {
    if (!company) throw new Error('Company not found');
    if (Number(company.founder_id) !== userId) throw new Error('Company forbidden');
    if (company.status !== 'draft' && company.status !== 'rejected') throw new Error('Company is not editable');
}

const HASDAQ_DEMO_NOW = new Date('2026-06-30T10:00:00+08:00');
const LOCAL_DEV_HASDAQ_ADMIN_NAME = 'demo_market_admin';
const LOCAL_DEV_HASDAQ_VIEWER_NAME = 'demo_investor_main';

function hasdaqDemoDate(offsetDays: number, hour = 10) {
    return new Date(HASDAQ_DEMO_NOW.getTime() + offsetDays * DAY_MS + (hour - 10) * 60 * 60 * 1000).toISOString();
}

function createHasdaqDemoCompany(input: Partial<HasdaqCompany> & Pick<HasdaqCompany, 'id' | 'name' | 'ticker' | 'status'>): HasdaqCompany {
    const current = Number(input.current_price_milli || HASDAQ_IPO_PRICE_MILLI);
    const previous = Number(input.previous_close_price_milli || HASDAQ_IPO_PRICE_MILLI);
    return normalizeHasdaqCompany({
        founder_id: LOCAL_DEV_USER_ID,
        founder_name: LOCAL_DEV_HASDAQ_ADMIN_NAME,
        company_type: 'student',
        summary: '',
        future_plan: null,
        risk_statement: null,
        total_shares: HASDAQ_TOTAL_SHARES,
        founder_shares: HASDAQ_FOUNDER_SHARES,
        public_shares_total: HASDAQ_PUBLIC_SHARES,
        public_shares_remaining: 180,
        ipo_price_milli: HASDAQ_IPO_PRICE_MILLI,
        current_price_milli: current,
        previous_close_price_milli: previous,
        h_coin_pool: 180,
        trading_paused_reason: null,
        listed_at: input.status === 'ipo' ? null : hasdaqDemoDate(-10),
        lockup_until: input.status === 'ipo' ? null : hasdaqDemoDate(-3),
        created_at: hasdaqDemoDate(-32),
        updated_at: hasdaqDemoDate(0, 9),
        holder_count: 0,
        volume_today: 0,
        volume_total: 0,
        user_public_shares: 0,
        user_locked_shares: 0,
        ...input,
    } as HasdaqCompany);
}

type LocalDevHasdaqState = {
    companyOverrides: Record<number, Partial<HasdaqCompany>>;
    companiesExtra: HasdaqCompany[];
    memberOverrides: Record<number, Partial<HasdaqCompanyMember>>;
    membersExtra: HasdaqCompanyMember[];
    productsExtra: HasdaqCompanyProduct[];
    announcementsExtra: HasdaqAnnouncement[];
    tradesExtra: HasdaqTrade[];
    positionOverrides: Record<string, HasdaqPosition>;
    applicationOverrides: Record<number, Partial<HasdaqListingApplication>>;
    applicationsExtra: HasdaqListingApplication[];
    walletBalances: Record<number, number>;
    nextCompanyId: number;
    nextMemberId: number;
    nextProductId: number;
    nextApplicationId: number;
    nextTradeId: number;
    nextAnnouncementId: number;
};

function getLocalDevHasdaqState(): LocalDevHasdaqState {
    const globalStore = globalThis as typeof globalThis & { __hajimiHasdaqDemoState?: LocalDevHasdaqState };
    if (!globalStore.__hajimiHasdaqDemoState) {
        globalStore.__hajimiHasdaqDemoState = {
            companyOverrides: {},
            companiesExtra: [],
            memberOverrides: {},
            membersExtra: [],
            productsExtra: [],
            announcementsExtra: [],
            tradesExtra: [],
            positionOverrides: {},
            applicationOverrides: {},
            applicationsExtra: [],
            walletBalances: { [LOCAL_DEV_USER_ID]: 76 },
            nextCompanyId: 9100,
            nextMemberId: 9100,
            nextProductId: 9100,
            nextApplicationId: 9100,
            nextTradeId: 9100,
            nextAnnouncementId: 9100,
        };
    }
    return globalStore.__hajimiHasdaqDemoState;
}

function getLocalDevHasdaqPositionKey(userId: number, companyId: number) {
    return `${userId}:${companyId}`;
}

function applyLocalDevHasdaqCompanyOverrides(company: HasdaqCompany): HasdaqCompany {
    const state = getLocalDevHasdaqState();
    return normalizeHasdaqCompany({
        ...company,
        ...(state.companyOverrides[Number(company.id)] || {}),
    });
}

function getLocalDevHasdaqCompanies(): HasdaqCompany[] {
    const baseCompanies = [
        createHasdaqDemoCompany({
            id: 9001,
            name: HASDAQ_OFFICIAL_DEMO_NAME,
            ticker: HASDAQ_OFFICIAL_DEMO_TICKER,
            status: 'ipo',
            company_type: 'official_demo',
            founder_id: 44,
            founder_name: 'hasdaq_demo_official_founder',
            summary: 'Hajimi Platform 是 Hasdaq 的官方示范股，用来演示 IPO 认购、敲钟上市和公开股交易机制，不代表任何个人收益。',
            pitch: '官方示范股：看懂 IPO、敲钟和公开股交易，不参与学生榜单或月度奖励。',
            slogan: '用一支示范股跑通 Hasdaq',
            future_plan: '持续作为课堂和社团演示样板，帮助同学理解学生模拟公司上市流程。',
            risk_statement: '官方示范股不代表个人收益；创始股永久锁仓；股价仍由买卖决定。',
            current_price_milli: 1000,
            previous_close_price_milli: 1000,
            public_shares_remaining: HASDAQ_PUBLIC_SHARES - HASDAQ_OFFICIAL_DEMO_SEEDED_SHARES,
            h_coin_pool: HASDAQ_OFFICIAL_DEMO_SEEDED_SHARES,
            holder_count: 5,
            volume_today: HASDAQ_OFFICIAL_DEMO_SEEDED_SHARES,
            volume_total: HASDAQ_OFFICIAL_DEMO_SEEDED_SHARES,
            product_count: 1,
            ipo_subscription_count: 5,
            ipo_subscribed_shares: HASDAQ_OFFICIAL_DEMO_SEEDED_SHARES,
            user_public_shares: 6,
            listed_at: null,
            lockup_until: null,
        }),
    ];
    const state = getLocalDevHasdaqState();
    return [...baseCompanies, ...state.companiesExtra].map(applyLocalDevHasdaqCompanyOverrides);
}

function getLocalDevHasdaqMembers(companyId: number): HasdaqCompanyMember[] {
    const map: Record<number, HasdaqCompanyMember[]> = {
        9001: [
            { id: 1, company_id: companyId, user_id: 44, username: 'hasdaq_demo_official_founder', role: 'founder', status: 'accepted', equity_percent: 100, founder_shares: HASDAQ_FOUNDER_SHARES, accepted_at: hasdaqDemoDate(-7), created_at: hasdaqDemoDate(-7) },
        ],
    };
    const state = getLocalDevHasdaqState();
    const extras = state.membersExtra.filter(member => Number(member.company_id) === Number(companyId));
    const fallback = !map[companyId] && extras.length === 0 ? [
        { id: companyId, company_id: companyId, user_id: 22, username: 'demo_member_fallback', role: 'founder', status: 'accepted', equity_percent: 100, founder_shares: 700, accepted_at: hasdaqDemoDate(-14), created_at: hasdaqDemoDate(-24) },
    ] satisfies HasdaqCompanyMember[] : [];
    return [...(map[companyId] || []), ...extras, ...fallback]
        .map(member => normalizeHasdaqMember({
            ...member,
            ...(state.memberOverrides[Number(member.id)] || {}),
        }));
}

function getLocalDevHasdaqProducts(companyId: number): HasdaqCompanyProduct[] {
    const rows: HasdaqCompanyProduct[] = [
        { id: 1, company_id: 9001, project_id: null, project_title: null, name: 'Hasdaq Official Demo Flow', url: '/hasdaq', description: '官方示范流程：IPO 认购、管理员敲钟、公开股买卖和行情变化。', proof_url: '/hasdaq', status: 'mature', created_at: hasdaqDemoDate(-7) },
    ];
    const state = getLocalDevHasdaqState();
    return [...rows, ...state.productsExtra]
        .filter(row => Number(row.company_id) === Number(companyId))
        .map(normalizeHasdaqProduct);
}

function getLocalDevHasdaqAnnouncements(companyId?: number): Array<HasdaqAnnouncement & { company_name: string; ticker: string }> {
    const companyById = new Map(getLocalDevHasdaqCompanies().map(company => [company.id, company]));
    const rows: HasdaqAnnouncement[] = [
        { id: 1, company_id: 9001, author_id: 44, author_name: 'hasdaq_demo_official_founder', title: '官方示范股说明', body: 'Hajimi Platform / HJM 只用于演示 Hasdaq 的 IPO、敲钟和交易机制；不代表个人收益，不参与学生公司榜单或月度奖励，创始股永久锁仓。', category: 'official_demo', created_at: hasdaqDemoDate(-1, 10) },
    ];
    const state = getLocalDevHasdaqState();
    return [...rows, ...state.announcementsExtra]
        .filter(row => !companyId || row.company_id === companyId)
        .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
        .map(row => {
            const company = companyById.get(row.company_id);
            return {
                ...normalizeHasdaqAnnouncement(row),
                company_name: company?.name || '',
                ticker: company?.ticker || '',
            };
        });
}

const LOCAL_DEV_HASDAQ_TRADERS = [
    { id: 41, username: 'demo_trader_a' },
    { id: 42, username: 'demo_trader_b' },
    { id: LOCAL_DEV_USER_ID, username: LOCAL_DEV_HASDAQ_VIEWER_NAME },
    { id: 43, username: 'demo_trader_c' },
    { id: 45, username: 'demo_trader_d' },
    { id: 46, username: 'demo_trader_e' },
];

function getLocalDevHasdaqStartPrice(companyId: number, currentMilli: number) {
    const starts: Record<number, number> = {
        9001: 1000,
        9002: 1050,
        9003: 960,
        9004: 1000,
    };
    return starts[companyId] || Math.max(HASDAQ_MIN_PRICE_MILLI, currentMilli - 160);
}

function generateLocalDevHasdaqMonthTrades(companyId: number): HasdaqTrade[] {
    const company = getLocalDevHasdaqCompanyById(companyId);
    const currentMilli = Number(company?.current_price_milli || HASDAQ_IPO_PRICE_MILLI);
    const startMilli = getLocalDevHasdaqStartPrice(companyId, currentMilli);
    const volatility = companyId === 9003 ? 22 : companyId === 9002 ? 18 : companyId === 9004 ? 10 : 20;
    const rows: HasdaqTrade[] = [];
    const slots = [16.1, 20.4];
    const total = 30 * slots.length;
    let previousPrice = startMilli;

    for (let day = -29; day <= 0; day += 1) {
        for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
            const index = rows.length;
            const progress = total <= 1 ? 1 : index / (total - 1);
            const trend = startMilli + (currentMilli - startMilli) * progress;
            const wave = Math.sin(progress * Math.PI * 7 + companyId * 0.13) * volatility
                + Math.cos(progress * Math.PI * 17 + slotIndex) * volatility * 0.38;
            const latePull = progress > 0.82 ? (currentMilli - trend) * (progress - 0.82) * 2.4 : 0;
            const rawPrice = index === total - 1 ? currentMilli : trend + wave + latePull;
            const priceMilli = Math.max(HASDAQ_MIN_PRICE_MILLI, Math.round(rawPrice / 10) * 10);
            const shares = 2 + Math.abs((companyId + index * 7 + slotIndex * 5) % 9);
            const trader = LOCAL_DEV_HASDAQ_TRADERS[index % LOCAL_DEV_HASDAQ_TRADERS.length];
            const type = priceMilli >= previousPrice ? 'buy' : 'sell';
            previousPrice = priceMilli;
            rows.push(normalizeHasdaqTrade({
                id: companyId * 1000 + index + 1,
                company_id: companyId,
                user_id: trader.id,
                username: trader.username,
                type,
                shares,
                locked_shares_sold: 0,
                price_milli: priceMilli,
                gross_amount: Math.max(1, Math.round((priceMilli / 1000) * shares)),
                coin_transaction_id: null,
                status: 'filled',
                created_at: hasdaqDemoDate(day, slots[slotIndex]),
            }));
        }
    }

    return rows;
}

function getLocalDevHasdaqTrades(companyId: number): HasdaqTrade[] {
    const company = getLocalDevHasdaqCompanyById(companyId);
    const rows = company?.status === 'ipo' ? [
        { username: 'demo_trader_a', userId: 41, shares: 12, createdAt: hasdaqDemoDate(-5, 12) },
        { username: 'demo_trader_b', userId: 42, shares: 10, createdAt: hasdaqDemoDate(-4, 16) },
        { username: LOCAL_DEV_HASDAQ_VIEWER_NAME, userId: LOCAL_DEV_USER_ID, shares: 8, createdAt: hasdaqDemoDate(-3, 12) },
        { username: 'demo_trader_c', userId: 43, shares: 6, createdAt: hasdaqDemoDate(-2, 14) },
        { username: 'demo_trader_d', userId: 45, shares: 4, createdAt: hasdaqDemoDate(-1, 15) },
    ].map((row, index) => normalizeHasdaqTrade({
        id: companyId * 1000 + index + 1,
        company_id: companyId,
        user_id: row.userId,
        username: row.username,
        type: 'ipo_buy',
        shares: row.shares,
        locked_shares_sold: 0,
        price_milli: HASDAQ_IPO_PRICE_MILLI,
        gross_amount: row.shares,
        coin_transaction_id: null,
        status: 'filled',
        created_at: row.createdAt,
    })) : generateLocalDevHasdaqMonthTrades(companyId);
    const state = getLocalDevHasdaqState();
    return [...rows, ...state.tradesExtra.filter(trade => Number(trade.company_id) === Number(companyId))]
        .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
        .map(normalizeHasdaqTrade);
}

function getLocalDevHasdaqPosition(companyId: number, userId = LOCAL_DEV_USER_ID): HasdaqPosition | null {
    const state = getLocalDevHasdaqState();
    const override = state.positionOverrides[getLocalDevHasdaqPositionKey(userId, companyId)];
    if (override) return normalizeHasdaqPosition(override);
    const positions: Record<number, HasdaqPosition> = {
        9001: { user_id: LOCAL_DEV_USER_ID, company_id: 9001, public_shares: 8, locked_shares: 0, average_cost_milli: 1000, updated_at: hasdaqDemoDate(-3) },
        9002: { user_id: LOCAL_DEV_USER_ID, company_id: 9002, public_shares: 8, locked_shares: 0, average_cost_milli: 990, updated_at: hasdaqDemoDate(-2) },
        9004: { user_id: LOCAL_DEV_USER_ID, company_id: 9004, public_shares: 6, locked_shares: 0, average_cost_milli: 1000, updated_at: hasdaqDemoDate(-3) },
    };
    if (userId !== LOCAL_DEV_USER_ID) return null;
    return positions[companyId] ? normalizeHasdaqPosition(positions[companyId]) : null;
}

function getLocalDevHasdaqOverview(userId?: number | null): HasdaqOverview {
    const viewerId = Number(userId || 0);
    const companies = getLocalDevHasdaqCompanies().map(company => {
        const position = viewerId ? getLocalDevHasdaqPosition(company.id, viewerId) : null;
        return {
            ...company,
            user_public_shares: position?.public_shares || 0,
            user_locked_shares: position?.locked_shares || 0,
        };
    });
    const studentCompanies = companies.filter(company => company.company_type !== 'official_demo');
    return {
        companies,
        officialDemoCompanies: companies.filter(company => company.company_type === 'official_demo'),
        ipoCompanies: studentCompanies.filter(company => company.status === 'ipo'),
        listedCompanies: studentCompanies.filter(company => company.status === 'listed' || company.status === 'paused'),
        myPositions: viewerId ? companies
            .map(company => getLocalDevHasdaqPosition(company.id, viewerId))
            .filter((position): position is HasdaqPosition => Boolean(position))
            .map(position => {
                const company = companies.find(item => item.id === position.company_id);
                return {
                    ...position,
                    company_name: company?.name || '',
                    ticker: company?.ticker || '',
                    current_price_milli: company?.current_price_milli || 0,
                    status: company?.status || 'listed',
                    company_type: company?.company_type,
                };
            }) : [],
        latestAnnouncements: getLocalDevHasdaqAnnouncements().slice(0, 10),
    };
}

function getLocalDevHasdaqCompanyById(companyId: number) {
    return getLocalDevHasdaqCompanies().find(company => Number(company.id) === Number(companyId)) || null;
}

function getLocalDevHasdaqCompanyDetail(identifier: string | number, userId?: number | null): HasdaqCompanyDetail | null {
    const ticker = typeof identifier === 'string' ? normalizeHasdaqTicker(identifier) : '';
    const id = typeof identifier === 'number' ? Math.floor(identifier) : parseHasdaqPositiveInt(identifier, 0);
    const company = getLocalDevHasdaqCompanies().find(item => (id > 0 && item.id === id) || (ticker && item.ticker === ticker));
    if (!company) return null;
    const viewerId = Number(userId || 0);
    const canSeePrivate = viewerId === company.founder_id || getLocalDevHasdaqMembers(company.id).some(member => member.user_id === viewerId);
    return {
        company,
        members: getLocalDevHasdaqMembers(company.id).filter(member => canSeePrivate || member.status === 'accepted'),
        products: getLocalDevHasdaqProducts(company.id),
        announcements: getLocalDevHasdaqAnnouncements(company.id),
        trades: getLocalDevHasdaqTrades(company.id),
        applications: canSeePrivate ? getLocalDevHasdaqApplications('all').filter(application => Number(application.company_id) === Number(company.id)) : [],
        myPosition: viewerId ? getLocalDevHasdaqPosition(company.id, viewerId) : null,
    };
}

function getLocalDevHasdaqWallet(userId: number, balanceDelta = 0): CoinWallet {
    const state = getLocalDevHasdaqState();
    const balance = (state.walletBalances[userId] ?? 76) + balanceDelta;
    return normalizeCoinWallet({
        user_id: userId,
        balance: Math.max(0, balance),
        earned_total: 118 + Math.max(0, balanceDelta),
        spent_total: 42 + Math.max(0, -balanceDelta),
        created_at: getShanghaiDateKeyFromOffset(-30),
        updated_at: hasdaqDemoDate(0),
    });
}

function getLocalDevHasdaqApplications(status: HasdaqListingApplicationStatus | 'all' = 'pending'): HasdaqListingApplication[] {
    const companyById = new Map(getLocalDevHasdaqCompanies().map(company => [company.id, company]));
    const rows: HasdaqListingApplication[] = [
        {
            id: 9901,
            company_id: 9001,
            company_name: companyById.get(9001)?.name || HASDAQ_OFFICIAL_DEMO_NAME,
            ticker: companyById.get(9001)?.ticker || HASDAQ_OFFICIAL_DEMO_TICKER,
            applicant_id: 44,
            applicant_name: 'hasdaq_demo_official_founder',
            status: 'approved',
            listing_reason: companyById.get(9001)?.summary || 'Hajimi Platform is the official demo stock for Hasdaq.',
            risk_statement: companyById.get(9001)?.risk_statement || 'Official demo stock; no personal return promise.',
            review_note: 'Approved as Hasdaq official demo stock.',
            reviewed_by: LOCAL_DEV_USER_ID,
            reviewer_name: LOCAL_DEV_HASDAQ_ADMIN_NAME,
            reviewed_at: hasdaqDemoDate(-6, 12),
            created_at: hasdaqDemoDate(-7, 11),
        },
    ];
    const state = getLocalDevHasdaqState();
    return [...rows, ...state.applicationsExtra]
        .map(row => normalizeHasdaqApplication({
            ...row,
            ...(state.applicationOverrides[Number(row.id)] || {}),
            company_name: companyById.get(Number(row.company_id))?.name || row.company_name,
            ticker: companyById.get(Number(row.company_id))?.ticker || row.ticker,
        }))
        .filter(row => status === 'all' || row.status === status)
        .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime());
}

function createLocalDevHasdaqDraftDetail(userId: number, input: Record<string, unknown>): HasdaqCompanyDetail {
    const state = getLocalDevHasdaqState();
    const requestedCompanyId = parseHasdaqPositiveInt(input.companyId || input.id, 0);
    const existing = requestedCompanyId ? getLocalDevHasdaqCompanyById(requestedCompanyId) : null;
    const companyId = existing?.id || state.nextCompanyId++;
    const ticker = normalizeHasdaqTicker(input.ticker || 'DEMO');
    const name = normalizeHasdaqText(input.name || 'Local Demo Studio', 120);
    const summary = normalizeHasdaqText(input.summary || input.description || 'Local Hasdaq application preview company.', 1200);
    const futurePlan = normalizeHasdaqText(input.futurePlan || input.future_plan || 'Continue shipping student products and report progress in Hasdaq announcements.', 1200);
    const riskStatement = normalizeHasdaqText(input.riskStatement || input.risk_statement || input.riskNote || 'Schedule and maintenance capacity may change during exam weeks.', 1200);
    const company = createHasdaqDemoCompany({
        id: companyId,
        founder_id: userId,
        founder_name: userId === LOCAL_DEV_USER_ID ? LOCAL_DEV_HASDAQ_VIEWER_NAME : 'demo_local_user',
        name,
        ticker,
        company_type: 'student',
        summary,
        future_plan: futurePlan,
        risk_statement: riskStatement,
        status: 'draft',
        public_shares_remaining: HASDAQ_PUBLIC_SHARES,
        h_coin_pool: 0,
        holder_count: 1,
        volume_today: 0,
        volume_total: 0,
        listed_at: null,
        lockup_until: null,
        created_at: hasdaqDemoDate(0),
        updated_at: hasdaqDemoDate(0),
    });
    const products = Array.isArray(input.products) ? input.products.slice(0, 3).map((item) => {
        const product = item as Record<string, unknown>;
        const projectId = parseHasdaqPositiveInt(product.projectId || product.project_id, 0) || null;
        const linkedProject = projectId ? getLocalDevProjects().find(project => Number(project.id) === projectId) : null;
        return normalizeHasdaqProduct({
            id: state.nextProductId++,
            company_id: company.id,
            project_id: projectId,
            project_title: linkedProject?.title || null,
            name: normalizeHasdaqText(product.name || product.title || linkedProject?.title || 'Local mature product proof', 120),
            url: normalizeHasdaqText(product.url || linkedProject?.url, 500) || null,
            description: normalizeHasdaqText(product.description || product.proofNote || product.proof_note || linkedProject?.description || 'Local mature product proof.', 1000),
            proof_url: normalizeHasdaqText(product.proofUrl || product.proof_url, 500) || null,
            status: normalizeHasdaqText(product.status, 40) || 'mature',
            created_at: hasdaqDemoDate(0),
        });
    }) : [];
    if (existing) {
        state.companyOverrides[company.id] = company;
    } else if (!state.companiesExtra.some(item => Number(item.id) === Number(company.id))) {
        state.companiesExtra.push(company);
    }
    const invitedMembers = Array.isArray(input.members) ? input.members.slice(0, 12)
        .map((item, index) => {
            const member = item as Record<string, unknown>;
            const username = normalizeHasdaqText(member.username || `member-${index + 1}`, 80);
            const equity = Math.min(Math.max(parseHasdaqPositiveInt(member.equityPercent || member.equity_percent, 0), 0), 100);
            if (!username || equity <= 0) return null;
            return normalizeHasdaqMember({
                id: state.nextMemberId++,
                company_id: company.id,
                user_id: 9200 + index,
                username,
                role: 'member',
                status: 'invited',
                equity_percent: equity,
                founder_shares: 0,
                accepted_at: null,
                created_at: hasdaqDemoDate(0),
            });
        })
        .filter((member): member is HasdaqCompanyMember => Boolean(member)) : [];
    const founderEquity = Math.max(0, 100 - invitedMembers.reduce((sum, member) => sum + Number(member.equity_percent || 0), 0));
    const founderMember = normalizeHasdaqMember({ id: state.nextMemberId++, company_id: company.id, user_id: userId, username: company.founder_name, role: 'founder', status: 'accepted', equity_percent: founderEquity, founder_shares: HASDAQ_FOUNDER_SHARES, accepted_at: hasdaqDemoDate(0), created_at: hasdaqDemoDate(0) });
    state.membersExtra = state.membersExtra.filter(member => Number(member.company_id) !== Number(company.id));
    state.membersExtra.push(founderMember, ...invitedMembers);
    state.productsExtra = state.productsExtra.filter(product => Number(product.company_id) !== Number(company.id));
    state.productsExtra.push(...products);

    return {
        company,
        members: [founderMember, ...invitedMembers],
        products,
        announcements: [],
        trades: [],
        applications: [],
        myPosition: null,
    };
}

async function getHasdaqCompanyForUpdate(client: VercelPoolClient, companyId: number) {
    const { rows } = await client.sql<HasdaqCompany>`
      SELECT *
      FROM hasdaq_companies
      WHERE id = ${companyId}
      FOR UPDATE
    `;
    return rows[0] ? normalizeHasdaqCompany(rows[0]) : null;
}

async function isHasdaqAcceptedMemberForClient(client: VercelPoolClient, userId: number, companyId: number) {
    const { rows } = await client.sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1
        FROM hasdaq_company_members
        WHERE user_id = ${userId}
          AND company_id = ${companyId}
          AND status = 'accepted'
      ) as exists
    `;
    return Boolean(rows[0]?.exists);
}

async function writeHasdaqProductsForClient(client: VercelPoolClient, companyId: number, products: unknown) {
    if (!Array.isArray(products)) return;

    await client.sql`DELETE FROM hasdaq_company_products WHERE company_id = ${companyId}`;
    for (const product of products.slice(0, 12)) {
        const item = product as Record<string, unknown>;
        const projectId = parseHasdaqPositiveInt(item.projectId, 0) || null;
        let projectTitle = '';
        let projectUrl = '';
        let projectDescription = '';
        if (projectId) {
            const { rows } = await client.sql<{ title: string; url: string | null; description: string | null }>`
              SELECT title, url, description
              FROM projects
              WHERE id = ${projectId}
              LIMIT 1
            `;
            projectTitle = rows[0]?.title || '';
            projectUrl = rows[0]?.url || '';
            projectDescription = rows[0]?.description || '';
        }
        const name = normalizeHasdaqText(item.name || item.title || projectTitle, 120);
        if (!name) continue;
        await client.sql`
          INSERT INTO hasdaq_company_products (
            company_id, project_id, name, url, description, proof_url, status
          )
          VALUES (
            ${companyId},
            ${projectId},
            ${name},
            ${normalizeHasdaqText(item.url || projectUrl, 500) || null},
            ${normalizeHasdaqText(item.description || item.proofNote || item.proof_note || projectDescription, 1000) || null},
            ${normalizeHasdaqText(item.proofUrl || item.proof_url, 500) || null},
            ${normalizeHasdaqText(item.status, 40) || 'mature'}
          )
        `;
    }
}

async function writeHasdaqMembersForClient(client: VercelPoolClient, companyId: number, founderId: number, members: unknown) {
    const preparedMembers = new Map<number, number>();

    if (Array.isArray(members)) {
        for (const member of members.slice(0, 12)) {
            const item = member as Record<string, unknown>;
            let userId = parseHasdaqPositiveInt(item.userId || item.user_id, 0);
            const username = normalizeHasdaqText(item.username, 80);
            if (!userId && username) {
                const { rows } = await client.sql<{ id: number }>`
                  SELECT id
                  FROM users
                  WHERE lower(username) = lower(${username})
                  LIMIT 1
                `;
                userId = Number(rows[0]?.id || 0);
            }
            if (!userId || userId === founderId) continue;
            const equity = Math.min(Math.max(parseHasdaqPositiveInt(item.equityPercent || item.equity_percent, 0), 0), 100);
            preparedMembers.set(userId, equity);
        }
    }

    const memberEquityTotal = Array.from(preparedMembers.values()).reduce((sum, equity) => sum + equity, 0);
    const founderEquity = Math.max(0, 100 - memberEquityTotal);

    await client.sql`
      INSERT INTO hasdaq_company_members (company_id, user_id, role, status, equity_percent, accepted_at)
      VALUES (${companyId}, ${founderId}, 'founder', 'accepted', ${founderEquity}, CURRENT_TIMESTAMP)
      ON CONFLICT (company_id, user_id)
      DO UPDATE SET role = 'founder', status = 'accepted', equity_percent = ${founderEquity}, accepted_at = CURRENT_TIMESTAMP
    `;

    for (const [userId, equity] of preparedMembers) {
        await client.sql`
          INSERT INTO hasdaq_company_members (company_id, user_id, role, status, equity_percent)
          VALUES (${companyId}, ${userId}, 'member', 'invited', ${equity})
          ON CONFLICT (company_id, user_id)
          DO UPDATE SET
            role = 'member',
            equity_percent = ${equity},
            status = CASE
              WHEN hasdaq_company_members.status = 'accepted' THEN 'accepted'
              ELSE 'invited'
            END
        `;
    }
}

export async function getHasdaqOverview(userId?: number | null): Promise<HasdaqOverview> {
    if (isHasdaqLocalDemoEnabled()) {
        return getLocalDevHasdaqOverview(userId);
    }

    await ensureHasdaqTables();
    const viewerId = Number(userId || 0);
    const { rows: companyRows } = await sql<HasdaqCompany>`
      WITH today_volume AS (
        SELECT company_id, COALESCE(SUM(volume), 0)::int as volume_today
        FROM hasdaq_daily_limits
        WHERE trade_date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date
        GROUP BY company_id
      ),
      total_volume AS (
        SELECT company_id, COALESCE(SUM(shares), 0)::int as volume_total
        FROM hasdaq_trades
        WHERE status = 'filled'
        GROUP BY company_id
      ),
      holder_stats AS (
        SELECT company_id, COUNT(*)::int as holder_count
        FROM hasdaq_positions
        WHERE public_shares + locked_shares > 0
        GROUP BY company_id
      ),
      ipo_stats AS (
        SELECT
          company_id,
          COUNT(DISTINCT user_id)::int as ipo_subscription_count,
          COALESCE(SUM(shares), 0)::int as ipo_subscribed_shares
        FROM hasdaq_trades
        WHERE type = 'ipo_buy'
          AND status = 'filled'
        GROUP BY company_id
      ),
      viewer_positions AS (
        SELECT company_id, public_shares as user_public_shares, locked_shares as user_locked_shares
        FROM hasdaq_positions
        WHERE user_id = ${viewerId}
      )
      SELECT
        hasdaq_companies.*,
        users.username as founder_name,
        COALESCE(today_volume.volume_today, 0)::int as volume_today,
        COALESCE(total_volume.volume_total, 0)::int as volume_total,
        COALESCE(holder_stats.holder_count, 0)::int as holder_count,
        COALESCE(ipo_stats.ipo_subscription_count, 0)::int as ipo_subscription_count,
        COALESCE(ipo_stats.ipo_subscribed_shares, 0)::int as ipo_subscribed_shares,
        COALESCE(viewer_positions.user_public_shares, 0)::int as user_public_shares,
        COALESCE(viewer_positions.user_locked_shares, 0)::int as user_locked_shares
      FROM hasdaq_companies
      LEFT JOIN users ON users.id = hasdaq_companies.founder_id
      LEFT JOIN today_volume ON today_volume.company_id = hasdaq_companies.id
      LEFT JOIN total_volume ON total_volume.company_id = hasdaq_companies.id
      LEFT JOIN holder_stats ON holder_stats.company_id = hasdaq_companies.id
      LEFT JOIN ipo_stats ON ipo_stats.company_id = hasdaq_companies.id
      LEFT JOIN viewer_positions ON viewer_positions.company_id = hasdaq_companies.id
      WHERE hasdaq_companies.status IN ('ipo', 'listed', 'paused')
      ORDER BY
        CASE hasdaq_companies.status WHEN 'listed' THEN 1 WHEN 'paused' THEN 2 WHEN 'ipo' THEN 3 ELSE 4 END,
        hasdaq_companies.created_at DESC
      LIMIT 120
    `;

    const companies = companyRows.map(normalizeHasdaqCompany);
    const { rows: positionRows } = viewerId ? await sql<Array<HasdaqPosition & { company_name: string; ticker: string; current_price_milli: number; status: HasdaqCompanyStatus; company_type: HasdaqCompanyType }>[number]>`
      SELECT
        hasdaq_positions.*,
        hasdaq_companies.name as company_name,
        hasdaq_companies.ticker,
        hasdaq_companies.current_price_milli,
        hasdaq_companies.status,
        hasdaq_companies.company_type
      FROM hasdaq_positions
      JOIN hasdaq_companies ON hasdaq_companies.id = hasdaq_positions.company_id
      WHERE hasdaq_positions.user_id = ${viewerId}
        AND hasdaq_positions.public_shares + hasdaq_positions.locked_shares > 0
      ORDER BY hasdaq_positions.updated_at DESC
      LIMIT 80
    ` : { rows: [] };

    const { rows: announcementRows } = await sql<Array<HasdaqAnnouncement & { company_name: string; ticker: string }>[number]>`
      SELECT
        hasdaq_announcements.*,
        hasdaq_companies.name as company_name,
        hasdaq_companies.ticker
      FROM hasdaq_announcements
      JOIN hasdaq_companies ON hasdaq_companies.id = hasdaq_announcements.company_id
      WHERE hasdaq_companies.status IN ('ipo', 'listed', 'paused')
      ORDER BY hasdaq_announcements.created_at DESC
      LIMIT 20
    `;

    const studentCompanies = companies.filter(company => company.company_type !== 'official_demo');
    return {
        companies,
        officialDemoCompanies: companies.filter(company => company.company_type === 'official_demo'),
        ipoCompanies: studentCompanies.filter(company => company.status === 'ipo'),
        listedCompanies: studentCompanies.filter(company => company.status === 'listed' || company.status === 'paused'),
        myPositions: positionRows.map(row => ({
            ...normalizeHasdaqPosition(row),
            company_name: row.company_name,
            ticker: row.ticker,
            current_price_milli: Number(row.current_price_milli || 0),
            status: row.status,
            company_type: normalizeHasdaqCompanyType(row.company_type),
        })),
        latestAnnouncements: announcementRows.map(row => ({
            ...normalizeHasdaqAnnouncement(row),
            company_name: row.company_name,
            ticker: row.ticker,
        })),
    };
}

export async function getHasdaqCompanyDetail(identifier: string | number, userId?: number | null): Promise<HasdaqCompanyDetail | null> {
    if (isHasdaqLocalDemoEnabled()) {
        return getLocalDevHasdaqCompanyDetail(identifier, userId);
    }

    await ensureHasdaqTables();
    const ticker = typeof identifier === 'string' ? normalizeHasdaqTicker(identifier) : '';
    const id = typeof identifier === 'number' ? Math.floor(identifier) : parseHasdaqPositiveInt(identifier, 0);
    const viewerId = Number(userId || 0);

    const { rows: companyRows } = await sql<HasdaqCompany>`
      WITH holder_stats AS (
        SELECT company_id, COUNT(*)::int as holder_count
        FROM hasdaq_positions
        WHERE public_shares + locked_shares > 0
        GROUP BY company_id
      ),
      today_volume AS (
        SELECT company_id, COALESCE(SUM(volume), 0)::int as volume_today
        FROM hasdaq_daily_limits
        WHERE trade_date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date
        GROUP BY company_id
      ),
      total_volume AS (
        SELECT company_id, COALESCE(SUM(shares), 0)::int as volume_total
        FROM hasdaq_trades
        WHERE status = 'filled'
        GROUP BY company_id
      ),
      ipo_stats AS (
        SELECT
          company_id,
          COUNT(DISTINCT user_id)::int as ipo_subscription_count,
          COALESCE(SUM(shares), 0)::int as ipo_subscribed_shares
        FROM hasdaq_trades
        WHERE type = 'ipo_buy'
          AND status = 'filled'
        GROUP BY company_id
      ),
      viewer_positions AS (
        SELECT company_id, public_shares as user_public_shares, locked_shares as user_locked_shares
        FROM hasdaq_positions
        WHERE user_id = ${viewerId}
      )
      SELECT
        hasdaq_companies.*,
        users.username as founder_name,
        COALESCE(holder_stats.holder_count, 0)::int as holder_count,
        COALESCE(today_volume.volume_today, 0)::int as volume_today,
        COALESCE(total_volume.volume_total, 0)::int as volume_total,
        COALESCE(ipo_stats.ipo_subscription_count, 0)::int as ipo_subscription_count,
        COALESCE(ipo_stats.ipo_subscribed_shares, 0)::int as ipo_subscribed_shares,
        COALESCE(viewer_positions.user_public_shares, 0)::int as user_public_shares,
        COALESCE(viewer_positions.user_locked_shares, 0)::int as user_locked_shares
      FROM hasdaq_companies
      LEFT JOIN users ON users.id = hasdaq_companies.founder_id
      LEFT JOIN holder_stats ON holder_stats.company_id = hasdaq_companies.id
      LEFT JOIN today_volume ON today_volume.company_id = hasdaq_companies.id
      LEFT JOIN total_volume ON total_volume.company_id = hasdaq_companies.id
      LEFT JOIN ipo_stats ON ipo_stats.company_id = hasdaq_companies.id
      LEFT JOIN viewer_positions ON viewer_positions.company_id = hasdaq_companies.id
      WHERE (${id} > 0 AND hasdaq_companies.id = ${id})
         OR (${ticker} != '' AND hasdaq_companies.ticker = ${ticker})
      LIMIT 1
    `;
    const company = companyRows[0] ? normalizeHasdaqCompany(companyRows[0]) : null;
    if (!company) return null;

    let canSeePrivate = viewerId > 0 && company.founder_id === viewerId;
    if (!canSeePrivate && viewerId > 0) {
        const membershipResult = await sql<{ exists: boolean }>`
          SELECT EXISTS (
            SELECT 1 FROM hasdaq_company_members
            WHERE company_id = ${company.id}
              AND user_id = ${viewerId}
          ) as exists
        `;
        canSeePrivate = Boolean(membershipResult.rows[0]?.exists);
    }
    if (company.status === 'draft' && !canSeePrivate) return null;

    const [
        memberRows,
        productRows,
        announcementRows,
        tradeRows,
        applicationRows,
        positionRows,
    ] = await Promise.all([
        sql<HasdaqCompanyMember>`
          SELECT hasdaq_company_members.*, users.username
          FROM hasdaq_company_members
          JOIN users ON users.id = hasdaq_company_members.user_id
          WHERE company_id = ${company.id}
          ORDER BY role DESC, status ASC, created_at ASC
        `,
        sql<HasdaqCompanyProduct>`
          SELECT hasdaq_company_products.*, projects.title as project_title
          FROM hasdaq_company_products
          LEFT JOIN projects ON projects.id = hasdaq_company_products.project_id
          WHERE hasdaq_company_products.company_id = ${company.id}
          ORDER BY hasdaq_company_products.created_at ASC
        `,
        sql<HasdaqAnnouncement>`
          SELECT hasdaq_announcements.*, users.username as author_name
          FROM hasdaq_announcements
          LEFT JOIN users ON users.id = hasdaq_announcements.author_id
          WHERE company_id = ${company.id}
          ORDER BY hasdaq_announcements.created_at DESC
          LIMIT 20
        `,
        sql<HasdaqTrade>`
          SELECT hasdaq_trades.*, users.username
          FROM hasdaq_trades
          LEFT JOIN users ON users.id = hasdaq_trades.user_id
          WHERE company_id = ${company.id}
          ORDER BY hasdaq_trades.created_at DESC
          LIMIT 180
        `,
        canSeePrivate ? sql<HasdaqListingApplication>`
          SELECT hasdaq_listing_applications.*, users.username as applicant_name, reviewers.username as reviewer_name
          FROM hasdaq_listing_applications
          LEFT JOIN users ON users.id = hasdaq_listing_applications.applicant_id
          LEFT JOIN users reviewers ON reviewers.id = hasdaq_listing_applications.reviewed_by
          WHERE company_id = ${company.id}
          ORDER BY created_at DESC
          LIMIT 10
        ` : Promise.resolve({ rows: [] as HasdaqListingApplication[] }),
        viewerId ? sql<HasdaqPosition>`
          SELECT *
          FROM hasdaq_positions
          WHERE user_id = ${viewerId}
            AND company_id = ${company.id}
          LIMIT 1
        ` : Promise.resolve({ rows: [] as HasdaqPosition[] }),
    ]);

    return {
        company,
        members: memberRows.rows
            .filter(member => canSeePrivate || member.status === 'accepted')
            .map(normalizeHasdaqMember),
        products: productRows.rows.map(normalizeHasdaqProduct),
        announcements: announcementRows.rows.map(normalizeHasdaqAnnouncement),
        trades: tradeRows.rows.map(normalizeHasdaqTrade),
        applications: applicationRows.rows.map(normalizeHasdaqApplication),
        myPosition: positionRows.rows[0] ? normalizeHasdaqPosition(positionRows.rows[0]) : null,
    };
}

export async function createOrUpdateHasdaqCompanyDraft(userId: number, input: Record<string, unknown>) {
    if (isHasdaqLocalDemoEnabled()) {
        return createLocalDevHasdaqDraftDetail(userId, input);
    }

    await ensureHasdaqTables();

    const companyId = parseHasdaqPositiveInt(input.companyId || input.id, 0);
    const name = normalizeHasdaqText(input.name, 120);
    const ticker = normalizeHasdaqTicker(input.ticker);
    const summary = normalizeHasdaqText(input.summary || input.description, 1200);
    const companyType: HasdaqCompanyType = 'student';
    const futurePlan = normalizeHasdaqText(input.futurePlan || input.future_plan, 1200);
    const riskStatement = normalizeHasdaqText(input.riskStatement || input.risk_statement, 1200);

    if (name.length < 2) throw new Error('Invalid company name');
    if (!/^[A-Z0-9]{3,8}$/.test(ticker)) throw new Error('Invalid ticker');
    if (summary.length < 8) throw new Error('Invalid company summary');

    const client = await db.connect();
    try {
        await client.sql`BEGIN`;

        let id = companyId;
        if (id) {
            const company = await getHasdaqCompanyForUpdate(client, id);
            assertHasdaqCompanyEditable(company || undefined, userId);
            const { rows: tickerRows } = await client.sql<{ id: number }>`
              SELECT id FROM hasdaq_companies WHERE ticker = ${ticker} AND id != ${id} LIMIT 1
            `;
            if (tickerRows[0]) throw new Error('Ticker already exists');
            await client.sql`
              UPDATE hasdaq_companies
              SET
                name = ${name},
                ticker = ${ticker},
                company_type = ${companyType},
                summary = ${summary},
                future_plan = ${futurePlan || null},
                risk_statement = ${riskStatement || null},
                status = 'draft',
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ${id}
            `;
        } else {
            const { rows: founderRows } = await client.sql<{ id: number }>`
              SELECT id
              FROM hasdaq_companies
              WHERE founder_id = ${userId}
                AND status != 'rejected'
              LIMIT 1
            `;
            if (founderRows[0]) throw new Error('Founder company limit reached');

            const { rows } = await client.sql<HasdaqCompany>`
              INSERT INTO hasdaq_companies (
                founder_id, name, ticker, company_type, summary, future_plan, risk_statement,
                total_shares, founder_shares, public_shares_total, public_shares_remaining,
                ipo_price_milli, current_price_milli, previous_close_price_milli
              )
              VALUES (
                ${userId}, ${name}, ${ticker}, ${companyType}, ${summary}, ${futurePlan || null}, ${riskStatement || null},
                ${HASDAQ_TOTAL_SHARES}, ${HASDAQ_FOUNDER_SHARES}, ${HASDAQ_PUBLIC_SHARES}, ${HASDAQ_PUBLIC_SHARES},
                ${HASDAQ_IPO_PRICE_MILLI}, ${HASDAQ_IPO_PRICE_MILLI}, ${HASDAQ_IPO_PRICE_MILLI}
              )
              RETURNING *
            `;
            id = Number(rows[0].id);
        }

        await writeHasdaqMembersForClient(client, id, userId, input.members);
        await writeHasdaqProductsForClient(client, id, input.products);

        await client.sql`COMMIT`;
        const { rows: invitedRows } = await sql<{ user_id: number }>`
          SELECT user_id
          FROM hasdaq_company_members
          WHERE company_id = ${id}
            AND user_id != ${userId}
            AND status = 'invited'
          LIMIT 20
        `;
        await Promise.all(invitedRows.map(row => createNotification({
            recipientId: Number(row.user_id),
            actorId: userId,
            type: 'hasdaq_member_invite',
            companyId: id,
        })));
        return getHasdaqCompanyDetail(id, userId);
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

export async function respondToHasdaqMembership(userId: number, companyId: number, action: 'accept' | 'decline') {
    if (isHasdaqLocalDemoEnabled()) {
        const state = getLocalDevHasdaqState();
        const invite = getLocalDevHasdaqMembers(companyId).find(member => member.user_id === userId || member.status === 'invited');
        const updated = normalizeHasdaqMember({
            ...(invite || {
                id: 9991,
                company_id: companyId,
                user_id: userId,
                username: userId === LOCAL_DEV_USER_ID ? LOCAL_DEV_HASDAQ_VIEWER_NAME : 'demo_local_user',
                role: 'member',
                equity_percent: 20,
                founder_shares: 0,
                created_at: hasdaqDemoDate(-1),
            }),
            status: action === 'accept' ? 'accepted' : 'declined',
            accepted_at: action === 'accept' ? hasdaqDemoDate(0) : invite?.accepted_at || null,
        } as HasdaqCompanyMember);
        state.memberOverrides[Number(updated.id)] = updated;
        return updated;
    }

    await ensureHasdaqTables();
    const status = action === 'accept' ? 'accepted' : 'declined';
    const { rows } = await sql<HasdaqCompanyMember>`
      UPDATE hasdaq_company_members
      SET status = ${status}, accepted_at = CASE WHEN ${status} = 'accepted' THEN CURRENT_TIMESTAMP ELSE accepted_at END
      WHERE company_id = ${companyId}
        AND user_id = ${userId}
        AND status = 'invited'
      RETURNING *
    `;
    if (!rows[0]) throw new Error('Membership invite not found');
    return normalizeHasdaqMember(rows[0]);
}

export async function submitHasdaqListingApplication(userId: number, companyId: number, input: Record<string, unknown>) {
    if (isHasdaqLocalDemoEnabled()) {
        const state = getLocalDevHasdaqState();
        const detail = getLocalDevHasdaqCompanyDetail(companyId, userId);
        if (!detail) throw new Error('Company not found');
        if ((detail.products || []).length < 1) throw new Error('Listing requires a mature product');
        const listingReason = normalizeHasdaqText(input.listingReason || input.listing_reason || detail.company.summary, 1500);
        const riskStatement = normalizeHasdaqText(input.riskStatement || input.risk_statement || detail.company.risk_statement, 1500);
        if (listingReason.length < 8) throw new Error('Invalid listing reason');
        if (riskStatement.length < 8) throw new Error('Invalid risk statement');
        const application = normalizeHasdaqApplication({
            id: state.nextApplicationId++,
            company_id: companyId,
            company_name: detail.company.name,
            ticker: detail.company.ticker,
            applicant_id: userId,
            applicant_name: userId === LOCAL_DEV_USER_ID ? LOCAL_DEV_HASDAQ_VIEWER_NAME : 'demo_local_user',
            status: 'pending',
            listing_reason: listingReason,
            risk_statement: riskStatement,
            review_note: null,
            reviewed_by: null,
            reviewer_name: null,
            reviewed_at: null,
            created_at: hasdaqDemoDate(0),
        });
        state.applicationsExtra.push(application);
        state.companyOverrides[companyId] = {
            ...(state.companyOverrides[companyId] || {}),
            status: 'pending_review',
            updated_at: hasdaqDemoDate(0),
        };
        return application;
    }

    await ensureHasdaqTables();
    const listingReason = normalizeHasdaqText(input.listingReason || input.listing_reason, 1500);
    const riskStatement = normalizeHasdaqText(input.riskStatement || input.risk_statement, 1500);
    if (listingReason.length < 8) throw new Error('Invalid listing reason');
    if (riskStatement.length < 8) throw new Error('Invalid risk statement');

    const client = await db.connect();
    try {
        await client.sql`BEGIN`;
        const company = await getHasdaqCompanyForUpdate(client, companyId);
        assertHasdaqCompanyEditable(company || undefined, userId);

        const { rows: productRows } = await client.sql<{ count: number }>`
          SELECT COUNT(*)::int as count
          FROM hasdaq_company_products
          WHERE company_id = ${companyId}
        `;
        if (Number(productRows[0]?.count || 0) < 1) throw new Error('Listing requires a mature product');
        const { rows: pendingMemberRows } = await client.sql<{ count: number }>`
          SELECT COUNT(*)::int as count
          FROM hasdaq_company_members
          WHERE company_id = ${companyId}
            AND role != 'founder'
            AND status = 'invited'
        `;
        if (Number(pendingMemberRows[0]?.count || 0) > 0) throw new Error('Members not accepted');

        const { rows } = await client.sql<HasdaqListingApplication>`
          INSERT INTO hasdaq_listing_applications (company_id, applicant_id, listing_reason, risk_statement)
          VALUES (${companyId}, ${userId}, ${listingReason}, ${riskStatement})
          RETURNING *
        `;
        await client.sql`
          UPDATE hasdaq_companies
          SET status = 'pending_review', updated_at = CURRENT_TIMESTAMP
          WHERE id = ${companyId}
        `;
        await client.sql`COMMIT`;
        return normalizeHasdaqApplication(rows[0]);
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

export async function getAdminHasdaqOverview(status: HasdaqListingApplicationStatus | 'all' = 'pending') {
    if (isHasdaqLocalDemoEnabled()) {
        return {
            applications: getLocalDevHasdaqApplications(status),
            companies: getLocalDevHasdaqCompanies(),
        };
    }

    await ensureHasdaqTables();
    const { rows } = await sql<HasdaqListingApplication>`
      SELECT
        hasdaq_listing_applications.*,
        hasdaq_companies.name as company_name,
        hasdaq_companies.ticker,
        users.username as applicant_name,
        reviewers.username as reviewer_name
      FROM hasdaq_listing_applications
      JOIN hasdaq_companies ON hasdaq_companies.id = hasdaq_listing_applications.company_id
      LEFT JOIN users ON users.id = hasdaq_listing_applications.applicant_id
      LEFT JOIN users reviewers ON reviewers.id = hasdaq_listing_applications.reviewed_by
      WHERE (${status} = 'all' OR hasdaq_listing_applications.status = ${status})
      ORDER BY hasdaq_listing_applications.created_at DESC
      LIMIT 100
    `;

    const { rows: companyRows } = await sql<HasdaqCompany>`
      WITH product_stats AS (
        SELECT company_id, COUNT(*)::int as product_count
        FROM hasdaq_company_products
        GROUP BY company_id
      ),
      ipo_stats AS (
        SELECT
          company_id,
          COUNT(DISTINCT user_id)::int as ipo_subscription_count,
          COALESCE(SUM(shares), 0)::int as ipo_subscribed_shares
        FROM hasdaq_trades
        WHERE type = 'ipo_buy'
          AND status = 'filled'
        GROUP BY company_id
      )
      SELECT
        hasdaq_companies.*,
        users.username as founder_name,
        COALESCE(product_stats.product_count, 0)::int as product_count,
        COALESCE(ipo_stats.ipo_subscription_count, 0)::int as ipo_subscription_count,
        COALESCE(ipo_stats.ipo_subscribed_shares, 0)::int as ipo_subscribed_shares
      FROM hasdaq_companies
      LEFT JOIN users ON users.id = hasdaq_companies.founder_id
      LEFT JOIN product_stats ON product_stats.company_id = hasdaq_companies.id
      LEFT JOIN ipo_stats ON ipo_stats.company_id = hasdaq_companies.id
      ORDER BY hasdaq_companies.updated_at DESC
      LIMIT 120
    `;

    return {
        applications: rows.map(normalizeHasdaqApplication),
        companies: companyRows.map(normalizeHasdaqCompany),
    };
}

export async function reviewHasdaqListingApplication(adminId: number, applicationId: number, action: 'approve' | 'reject', note = '') {
    if (isHasdaqLocalDemoEnabled()) {
        const state = getLocalDevHasdaqState();
        const application = getLocalDevHasdaqApplications('all').find(item => Number(item.id) === Number(applicationId));
        if (!application) throw new Error('Listing application not found');
        const nextStatus = action === 'approve' ? 'approved' : 'rejected';
        state.applicationOverrides[Number(applicationId)] = {
            status: nextStatus,
            review_note: normalizeHasdaqText(note, 500) || null,
            reviewed_by: adminId,
            reviewer_name: LOCAL_DEV_HASDAQ_ADMIN_NAME,
            reviewed_at: hasdaqDemoDate(0),
        };
        state.companyOverrides[Number(application.company_id)] = {
            ...(state.companyOverrides[Number(application.company_id)] || {}),
            status: action === 'approve' ? 'ipo' : 'rejected',
            current_price_milli: HASDAQ_IPO_PRICE_MILLI,
            previous_close_price_milli: HASDAQ_IPO_PRICE_MILLI,
            updated_at: hasdaqDemoDate(0),
        };
        return { success: true };
    }

    await ensureHasdaqTables();
    await ensureAdminAuditTable();

    const reviewNote = normalizeHasdaqText(note, 500);
    const client = await db.connect();
    try {
        await client.sql`BEGIN`;
        const { rows } = await client.sql<HasdaqListingApplication & { founder_id: number | null; company_name: string; ticker: string }>`
          SELECT
            hasdaq_listing_applications.*,
            hasdaq_companies.founder_id,
            hasdaq_companies.name as company_name,
            hasdaq_companies.ticker
          FROM hasdaq_listing_applications
          JOIN hasdaq_companies ON hasdaq_companies.id = hasdaq_listing_applications.company_id
          WHERE hasdaq_listing_applications.id = ${applicationId}
            AND hasdaq_listing_applications.status = 'pending'
          FOR UPDATE
        `;
        const application = rows[0];
        if (!application) throw new Error('Listing application not found');

        const nextStatus = action === 'approve' ? 'approved' : 'rejected';
        const nextCompanyStatus = action === 'approve' ? 'ipo' : 'rejected';
        await client.sql`
          UPDATE hasdaq_listing_applications
          SET status = ${nextStatus}, review_note = ${reviewNote || null}, reviewed_by = ${adminId}, reviewed_at = CURRENT_TIMESTAMP
          WHERE id = ${applicationId}
        `;
        await client.sql`
          UPDATE hasdaq_companies
          SET
            status = ${nextCompanyStatus},
            current_price_milli = ${HASDAQ_IPO_PRICE_MILLI},
            previous_close_price_milli = ${HASDAQ_IPO_PRICE_MILLI},
            public_shares_remaining = CASE WHEN ${nextCompanyStatus} = 'ipo' THEN public_shares_remaining ELSE public_shares_total END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${application.company_id}
        `;
        await client.sql`COMMIT`;

        if (application.founder_id) {
            await createNotification({
                recipientId: Number(application.founder_id),
                actorId: adminId,
                type: action === 'approve' ? 'hasdaq_application_approved' : 'hasdaq_application_rejected',
                companyId: Number(application.company_id),
            });
        }
        await createAdminAuditEvent({
            actorId: adminId,
            targetUserId: application.founder_id ? Number(application.founder_id) : null,
            targetType: 'hasdaq',
            targetId: Number(application.company_id),
            eventType: `hasdaq_listing_${nextStatus}`,
            summary: `${application.ticker} listing application ${nextStatus}`,
            details: { application_id: applicationId, note: reviewNote },
        });

        return { success: true };
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

export async function bellHasdaqListing(adminId: number, companyId: number) {
    if (isHasdaqLocalDemoEnabled()) {
        const state = getLocalDevHasdaqState();
        const company = getLocalDevHasdaqCompanyById(companyId);
        if (!company) throw new Error('Company not found');
        if (company.status !== 'ipo') throw new Error('Company is not in IPO');
        const ipoTrades = getLocalDevHasdaqTrades(companyId).filter(trade => trade.type === 'ipo_buy' && (!trade.status || trade.status === 'filled'));
        const subscriberCount = new Set(ipoTrades.map(trade => Number(trade.user_id || 0)).filter(Boolean)).size;
        const subscribedShares = ipoTrades.reduce((sum, trade) => sum + Number(trade.shares || 0), 0);
        if (company.company_type !== 'official_demo' && subscriberCount < HASDAQ_MIN_BELL_SUBSCRIBERS) {
            throw new Error('Company has insufficient IPO subscribers');
        }
        if (company.company_type !== 'official_demo' && subscribedShares < HASDAQ_MIN_BELL_SUBSCRIBED_SHARES) {
            throw new Error('Company has insufficient IPO shares');
        }
        const updated = normalizeHasdaqCompany({
            ...company,
            status: 'listed',
            listed_at: hasdaqDemoDate(0),
            lockup_until: company.company_type === 'official_demo' ? null : hasdaqDemoDate(7),
            trading_paused_reason: null,
            updated_at: hasdaqDemoDate(0),
        });
        state.companyOverrides[companyId] = updated;
        state.announcementsExtra.push(normalizeHasdaqAnnouncement({
            id: state.nextAnnouncementId++,
            company_id: companyId,
            author_id: adminId,
            author_name: LOCAL_DEV_HASDAQ_ADMIN_NAME,
            title: '敲钟上市',
            body: updated.company_type === 'official_demo'
                ? `${updated.name} 已完成 Hasdaq 敲钟，公开股交易开放；官方示范股创始股仍永久锁仓。`
                : `${updated.name} 已完成 Hasdaq 敲钟，二级市场交易开放。`,
            category: 'bell',
            created_at: hasdaqDemoDate(0),
        }));
        return updated;
    }

    await ensureHasdaqTables();
    await ensureAdminAuditTable();

    const client = await db.connect();
    try {
        await client.sql`BEGIN`;
        const company = await getHasdaqCompanyForUpdate(client, companyId);
        if (!company) throw new Error('Company not found');
        if (company.status !== 'ipo') throw new Error('Company is not in IPO');

        const { rows: subscriptionRows } = await client.sql<{ subscriber_count: number; subscribed_shares: number }>`
          SELECT
            COUNT(DISTINCT user_id)::int as subscriber_count,
            COALESCE(SUM(shares), 0)::int as subscribed_shares
          FROM hasdaq_trades
          WHERE company_id = ${companyId}
            AND type = 'ipo_buy'
            AND status = 'filled'
        `;
        const subscriberCount = Number(subscriptionRows[0]?.subscriber_count || 0);
        const subscribedShares = Number(subscriptionRows[0]?.subscribed_shares || 0);
        if (company.company_type !== 'official_demo' && subscriberCount < HASDAQ_MIN_BELL_SUBSCRIBERS) {
            throw new Error('Company has insufficient IPO subscribers');
        }
        if (company.company_type !== 'official_demo' && subscribedShares < HASDAQ_MIN_BELL_SUBSCRIBED_SHARES) {
            throw new Error('Company has insufficient IPO shares');
        }

        const { rows: memberRows } = await client.sql<HasdaqCompanyMember>`
          SELECT *
          FROM hasdaq_company_members
          WHERE company_id = ${companyId}
            AND status = 'accepted'
          ORDER BY role DESC, created_at ASC
          FOR UPDATE
        `;
        if (memberRows.length === 0 && !company.founder_id) throw new Error('Company has no founder');

        const members = memberRows.map(normalizeHasdaqMember);
        const founderUserId = Number(company.founder_id || members[0]?.user_id || 0);
        const explicitTotal = members.reduce((sum, member) => sum + Math.max(0, Number(member.equity_percent || 0)), 0);
        let allocated = 0;
        for (const member of members) {
            const isFounder = member.role === 'founder' || member.user_id === founderUserId;
            const percent = explicitTotal > 0
                ? Math.max(0, Number(member.equity_percent || 0)) / explicitTotal
                : isFounder ? 1 : 0;
            let shares = Math.floor(HASDAQ_FOUNDER_SHARES * percent);
            if (isFounder) {
                shares += HASDAQ_FOUNDER_SHARES - members.reduce((sum, current) => {
                    if (current.user_id === member.user_id) return sum;
                    const currentPercent = explicitTotal > 0 ? Math.max(0, Number(current.equity_percent || 0)) / explicitTotal : 0;
                    return sum + Math.floor(HASDAQ_FOUNDER_SHARES * currentPercent);
                }, 0) - shares;
            }
            shares = Math.max(0, shares);
            allocated += shares;
            await client.sql`
              INSERT INTO hasdaq_positions (user_id, company_id, locked_shares, average_cost_milli)
              VALUES (${member.user_id}, ${companyId}, ${shares}, ${HASDAQ_IPO_PRICE_MILLI})
              ON CONFLICT (user_id, company_id)
              DO UPDATE SET
                locked_shares = hasdaq_positions.locked_shares + ${shares},
                updated_at = CURRENT_TIMESTAMP
            `;
            await client.sql`
              UPDATE hasdaq_company_members
              SET founder_shares = ${shares}
              WHERE id = ${member.id}
            `;
        }
        if (allocated <= 0 && founderUserId) {
            await client.sql`
              INSERT INTO hasdaq_positions (user_id, company_id, locked_shares, average_cost_milli)
              VALUES (${founderUserId}, ${companyId}, ${HASDAQ_FOUNDER_SHARES}, ${HASDAQ_IPO_PRICE_MILLI})
              ON CONFLICT (user_id, company_id)
              DO UPDATE SET locked_shares = hasdaq_positions.locked_shares + ${HASDAQ_FOUNDER_SHARES}, updated_at = CURRENT_TIMESTAMP
            `;
        }

        const { rows: updatedRows } = await client.sql<HasdaqCompany>`
          UPDATE hasdaq_companies
          SET
            status = 'listed',
            listed_at = CURRENT_TIMESTAMP,
            lockup_until = CASE
              WHEN ${company.company_type === 'official_demo'} THEN NULL
              ELSE CURRENT_TIMESTAMP + INTERVAL '7 days'
            END,
            current_price_milli = ${HASDAQ_IPO_PRICE_MILLI},
            previous_close_price_milli = ${HASDAQ_IPO_PRICE_MILLI},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${companyId}
          RETURNING *
        `;
        await client.sql`
          INSERT INTO hasdaq_announcements (company_id, author_id, title, body, category)
          VALUES (
            ${companyId},
            ${adminId},
            '敲钟上市',
            ${company.company_type === 'official_demo'
                ? 'Hajimi Platform / HJM 已完成 Hasdaq 敲钟，公开股交易开放；官方示范股创始股仍永久锁仓。'
                : 'This company has rung the Hasdaq bell and is open for trading.'},
            'bell'
          )
        `;
        await client.sql`COMMIT`;

        const updated = normalizeHasdaqCompany(updatedRows[0]);
        if (updated.founder_id) {
            await createNotification({
                recipientId: Number(updated.founder_id),
                actorId: adminId,
                type: 'hasdaq_bell',
                companyId,
            });
        }
        await createAdminAuditEvent({
            actorId: adminId,
            targetUserId: updated.founder_id,
            targetType: 'hasdaq',
            targetId: companyId,
            eventType: 'hasdaq_bell',
            summary: `${updated.ticker} rang the Hasdaq bell`,
            details: { ticker: updated.ticker },
        });
        return updated;
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

export async function setHasdaqTradingStatus(adminId: number, companyId: number, action: 'pause' | 'resume', note = '') {
    if (isHasdaqLocalDemoEnabled()) {
        const state = getLocalDevHasdaqState();
        const company = getLocalDevHasdaqCompanyById(companyId);
        if (!company) throw new Error('Company status cannot be changed');
        if (action === 'pause' && company.status !== 'listed') throw new Error('Company status cannot be changed');
        if (action === 'resume' && company.status !== 'paused') throw new Error('Company status cannot be changed');
        const updated = normalizeHasdaqCompany({
            ...company,
            status: action === 'pause' ? 'paused' : 'listed',
            trading_paused_reason: action === 'pause' ? normalizeHasdaqText(note, 500) || '管理员暂停：本地演示风控。' : null,
            updated_at: hasdaqDemoDate(0),
        });
        state.companyOverrides[companyId] = updated;
        state.announcementsExtra.push(normalizeHasdaqAnnouncement({
            id: state.nextAnnouncementId++,
            company_id: companyId,
            author_id: adminId,
            author_name: LOCAL_DEV_HASDAQ_ADMIN_NAME,
            title: action === 'pause' ? '交易暂停' : '交易恢复',
            body: action === 'pause' ? (updated.trading_paused_reason || '管理员暂停交易。') : '管理员已恢复交易。',
            category: action === 'pause' ? 'risk' : 'update',
            created_at: hasdaqDemoDate(0),
        }));
        return updated;
    }

    await ensureHasdaqTables();
    await ensureAdminAuditTable();
    const reason = normalizeHasdaqText(note, 500);
    const nextStatus = action === 'pause' ? 'paused' : 'listed';
    const currentStatus = action === 'pause' ? 'listed' : 'paused';
    const { rows } = await sql<HasdaqCompany>`
      UPDATE hasdaq_companies
      SET status = ${nextStatus}, trading_paused_reason = ${action === 'pause' ? reason || 'Paused by admin' : null}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${companyId}
        AND status = ${currentStatus}
      RETURNING *
    `;
    const company = rows[0] ? normalizeHasdaqCompany(rows[0]) : null;
    if (!company) throw new Error('Company status cannot be changed');
    if (company.founder_id && action === 'pause') {
        await createNotification({
            recipientId: Number(company.founder_id),
            actorId: adminId,
            type: 'hasdaq_paused',
            companyId,
        });
    }
    await createAdminAuditEvent({
        actorId: adminId,
        targetUserId: company.founder_id,
        targetType: 'hasdaq',
        targetId: companyId,
        eventType: `hasdaq_${action}`,
        summary: `${company.ticker} trading ${action === 'pause' ? 'paused' : 'resumed'}`,
        details: { note: reason },
    });
    return company;
}

function computeHasdaqTradeCost(priceMilli: number, shares: number) {
    return Math.max(1, Math.ceil((priceMilli * shares) / 1000));
}

function computeHasdaqTradeProceeds(priceMilli: number, shares: number) {
    return Math.floor((priceMilli * shares) / 1000);
}

async function ensureHasdaqDailyLimitForClient(client: VercelPoolClient, company: HasdaqCompany) {
    const openPrice = Number(company.current_price_milli || company.previous_close_price_milli || HASDAQ_IPO_PRICE_MILLI);
    const { rows } = await client.sql<{
        company_id: number;
        trade_date: string;
        open_price_milli: number;
        high_price_milli: number;
        low_price_milli: number;
        trade_count: number;
        volume: number;
    }>`
      INSERT INTO hasdaq_daily_limits (
        company_id, trade_date, open_price_milli, high_price_milli, low_price_milli
      )
      VALUES (${company.id}, (NOW() AT TIME ZONE 'Asia/Shanghai')::date, ${openPrice}, ${openPrice}, ${openPrice})
      ON CONFLICT (company_id, trade_date) DO UPDATE SET company_id = EXCLUDED.company_id
      RETURNING *
    `;
    return {
        ...rows[0],
        open_price_milli: Number(rows[0].open_price_milli || openPrice),
        high_price_milli: Number(rows[0].high_price_milli || openPrice),
        low_price_milli: Number(rows[0].low_price_milli || openPrice),
        trade_count: Number(rows[0].trade_count || 0),
        volume: Number(rows[0].volume || 0),
    };
}

async function assertHasdaqDailyUserTradeLimitForClient(client: VercelPoolClient, userId: number) {
    const { rows } = await client.sql<{ count: number }>`
      SELECT COUNT(*)::int as count
      FROM hasdaq_trades
      WHERE user_id = ${userId}
        AND (created_at AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date
    `;
    if (Number(rows[0]?.count || 0) >= HASDAQ_MAX_DAILY_TRADES) {
        throw new Error('Daily trade limit reached');
    }
}

export async function subscribeHasdaqIpo(userId: number, companyId: number, shares: number) {
    const safeShares = parseHasdaqPositiveInt(shares, 0);
    if (!safeShares || safeShares > HASDAQ_MAX_IPO_SHARES_PER_ORDER) throw new Error('Invalid IPO shares');
    if (isHasdaqLocalDemoEnabled()) {
        const state = getLocalDevHasdaqState();
        const company = getLocalDevHasdaqCompanyById(companyId);
        if (!company) throw new Error('Company not found');
        if (company.status !== 'ipo') throw new Error('Company is not in IPO');
        if (company.public_shares_remaining < safeShares) throw new Error('Not enough public shares');
        const currentPosition = getLocalDevHasdaqPosition(companyId, userId);
        if ((currentPosition?.public_shares || 0) + safeShares > HASDAQ_MAX_IPO_SHARES_PER_USER) {
            throw new Error('IPO position limit reached');
        }
        const currentBalance = state.walletBalances[userId] ?? 76;
        if (currentBalance < safeShares) throw new Error('Insufficient coins');
        const trade = normalizeHasdaqTrade({
            id: state.nextTradeId++,
            company_id: companyId,
            user_id: userId,
            username: userId === LOCAL_DEV_USER_ID ? LOCAL_DEV_HASDAQ_VIEWER_NAME : 'demo_local_user',
            type: 'ipo_buy',
            shares: safeShares,
            locked_shares_sold: 0,
            price_milli: HASDAQ_IPO_PRICE_MILLI,
            gross_amount: safeShares,
            coin_transaction_id: null,
            status: 'filled',
            created_at: hasdaqDemoDate(0),
        });
        state.tradesExtra.push(trade);
        state.walletBalances[userId] = currentBalance - safeShares;
        state.positionOverrides[getLocalDevHasdaqPositionKey(userId, companyId)] = normalizeHasdaqPosition({
            user_id: userId,
            company_id: companyId,
            public_shares: (currentPosition?.public_shares || 0) + safeShares,
            locked_shares: currentPosition?.locked_shares || 0,
            average_cost_milli: HASDAQ_IPO_PRICE_MILLI,
            updated_at: hasdaqDemoDate(0),
        });
        state.companyOverrides[companyId] = normalizeHasdaqCompany({
            ...company,
            public_shares_remaining: company.public_shares_remaining - safeShares,
            h_coin_pool: Number(company.h_coin_pool || 0) + safeShares,
            volume_today: Number(company.volume_today || 0) + safeShares,
            volume_total: Number(company.volume_total || 0) + safeShares,
            holder_count: Number(company.holder_count || 0) + (currentPosition ? 0 : 1),
            updated_at: hasdaqDemoDate(0),
        });
        return {
            trade,
            wallet: getLocalDevHasdaqWallet(userId),
        };
    }

    await ensureHasdaqTables();

    const client = await db.connect();
    try {
        await client.sql`BEGIN`;
        const company = await getHasdaqCompanyForUpdate(client, companyId);
        if (!company) throw new Error('Company not found');
        if (company.status !== 'ipo') throw new Error('Company is not in IPO');
        if (company.public_shares_remaining < safeShares) throw new Error('Not enough public shares');

        const { rows: positionRows } = await client.sql<HasdaqPosition>`
          SELECT *
          FROM hasdaq_positions
          WHERE user_id = ${userId}
            AND company_id = ${companyId}
          FOR UPDATE
        `;
        const currentPublicShares = Number(positionRows[0]?.public_shares || 0);
        if (currentPublicShares + safeShares > HASDAQ_MAX_IPO_SHARES_PER_USER) {
            throw new Error('IPO position limit reached');
        }

        await ensureCoinWalletForClient(client, userId);
        const coinResult = await writeCoinTransactionForClient(client, {
            userId,
            amount: -safeShares,
            type: 'hasdaq_ipo_buy',
            sourceType: 'hasdaq_ipo',
            sourceId: companyId,
            note: `IPO subscribe ${company.ticker}`,
        });
        const nextAverage = currentPublicShares > 0
            ? Math.round(((Number(positionRows[0]?.average_cost_milli || 0) * currentPublicShares) + (HASDAQ_IPO_PRICE_MILLI * safeShares)) / (currentPublicShares + safeShares))
            : HASDAQ_IPO_PRICE_MILLI;
        await client.sql`
          INSERT INTO hasdaq_positions (user_id, company_id, public_shares, average_cost_milli)
          VALUES (${userId}, ${companyId}, ${safeShares}, ${nextAverage})
          ON CONFLICT (user_id, company_id)
          DO UPDATE SET
            public_shares = hasdaq_positions.public_shares + ${safeShares},
            average_cost_milli = ${nextAverage},
            updated_at = CURRENT_TIMESTAMP
        `;
        const { rows: tradeRows } = await client.sql<HasdaqTrade>`
          INSERT INTO hasdaq_trades (company_id, user_id, type, shares, price_milli, gross_amount, coin_transaction_id)
          VALUES (${companyId}, ${userId}, 'ipo_buy', ${safeShares}, ${HASDAQ_IPO_PRICE_MILLI}, ${safeShares}, ${coinResult.transaction.id})
          RETURNING *
        `;
        await client.sql`
          UPDATE coin_transactions
          SET source_id = ${tradeRows[0].id}
          WHERE id = ${coinResult.transaction.id}
        `;
        await client.sql`
          UPDATE hasdaq_companies
          SET public_shares_remaining = public_shares_remaining - ${safeShares},
              h_coin_pool = h_coin_pool + ${safeShares},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${companyId}
        `;
        await client.sql`COMMIT`;

        return {
            trade: normalizeHasdaqTrade(tradeRows[0]),
            wallet: coinResult.wallet,
        };
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

export async function executeHasdaqTrade(userId: number, companyId: number, side: 'buy' | 'sell', value: number) {
    if (isHasdaqLocalDemoEnabled()) {
        const state = getLocalDevHasdaqState();
        const company = getLocalDevHasdaqCompanyById(companyId);
        if (!company) throw new Error('Company not found');
        if (company.status === 'paused') throw new Error('Trading is paused');
        if (company.status !== 'listed') throw new Error('Company is not listed');
        const currentPrice = Number(company.current_price_milli || HASDAQ_IPO_PRICE_MILLI);
        const safeValue = parseHasdaqPositiveInt(value, 0);
        if (!safeValue) throw new Error(side === 'buy' ? 'Invalid buy shares' : 'Invalid sell shares');
        const currentPosition = getLocalDevHasdaqPosition(companyId, userId);
        const currentBalance = state.walletBalances[userId] ?? 76;
        let shares = safeValue;
        let grossAmount = safeValue;
        let nextPrice = currentPrice;
        if (side === 'buy') {
            if (safeValue > HASDAQ_MAX_BUY_SHARES) throw new Error('Invalid buy shares');
            if (company.public_shares_remaining < shares) throw new Error('Not enough public shares');
            if ((currentPosition?.public_shares || 0) + shares > HASDAQ_MAX_PUBLIC_SHARES_PER_USER) throw new Error('Position limit reached');
            grossAmount = computeHasdaqTradeCost(currentPrice, shares);
            if (currentBalance < grossAmount) throw new Error('Insufficient coins');
            nextPrice = currentPrice + Math.max(1, Math.ceil(shares / HASDAQ_SHARES_PER_PRICE_STEP)) * HASDAQ_PRICE_STEP_MILLI;
        } else {
            if (safeValue > HASDAQ_MAX_SELL_SHARES) throw new Error('Invalid sell shares');
            if (!currentPosition || currentPosition.public_shares + currentPosition.locked_shares < safeValue) throw new Error('Not enough shares');
            if (company.company_type === 'official_demo' && safeValue > (currentPosition?.public_shares || 0)) {
                throw new Error('Official demo founder shares are permanently locked');
            }
            grossAmount = computeHasdaqTradeProceeds(currentPrice, safeValue);
            if (grossAmount < 1) throw new Error('Sell proceeds too small');
            if (company.h_coin_pool < grossAmount) throw new Error('Company pool has insufficient liquidity');
            shares = safeValue;
            nextPrice = Math.max(HASDAQ_MIN_PRICE_MILLI, currentPrice - Math.max(1, Math.ceil(shares / HASDAQ_SHARES_PER_PRICE_STEP)) * HASDAQ_PRICE_STEP_MILLI);
        }
        const lockedSharesSold = side === 'sell' ? Math.max(0, shares - (currentPosition?.public_shares || 0)) : 0;
        const trade = normalizeHasdaqTrade({
            id: state.nextTradeId++,
            company_id: companyId,
            user_id: userId,
            username: userId === LOCAL_DEV_USER_ID ? LOCAL_DEV_HASDAQ_VIEWER_NAME : 'demo_local_user',
            type: side,
            shares,
            locked_shares_sold: lockedSharesSold,
            price_milli: currentPrice,
            gross_amount: grossAmount,
            coin_transaction_id: null,
            status: 'filled',
            created_at: hasdaqDemoDate(0),
        });
        state.tradesExtra.push(trade);
        const nextPublicShares = side === 'buy'
            ? (currentPosition?.public_shares || 0) + shares
            : Math.max((currentPosition?.public_shares || 0) - shares, 0);
        const nextLockedShares = side === 'sell'
            ? Math.max((currentPosition?.locked_shares || 0) - lockedSharesSold, 0)
            : currentPosition?.locked_shares || 0;
        state.positionOverrides[getLocalDevHasdaqPositionKey(userId, companyId)] = normalizeHasdaqPosition({
            user_id: userId,
            company_id: companyId,
            public_shares: nextPublicShares,
            locked_shares: nextLockedShares,
            average_cost_milli: side === 'buy' ? currentPrice : currentPosition?.average_cost_milli || currentPrice,
            updated_at: hasdaqDemoDate(0),
        });
        state.walletBalances[userId] = currentBalance + (side === 'buy' ? -grossAmount : grossAmount);
        state.companyOverrides[companyId] = normalizeHasdaqCompany({
            ...company,
            current_price_milli: nextPrice,
            public_shares_remaining: company.public_shares_remaining + (side === 'buy' ? -shares : shares),
            h_coin_pool: company.h_coin_pool + (side === 'buy' ? grossAmount : -grossAmount),
            volume_today: Number(company.volume_today || 0) + shares,
            volume_total: Number(company.volume_total || 0) + shares,
            holder_count: Number(company.holder_count || 0) + (side === 'buy' && !currentPosition ? 1 : 0),
            updated_at: hasdaqDemoDate(0),
        });
        return {
            trade,
            wallet: getLocalDevHasdaqWallet(userId),
            position: getLocalDevHasdaqPosition(companyId, userId),
            nextPriceMilli: nextPrice,
        };
    }

    await ensureHasdaqTables();

    const client = await db.connect();
    try {
        await client.sql`BEGIN`;
        await assertHasdaqDailyUserTradeLimitForClient(client, userId);
        const company = await getHasdaqCompanyForUpdate(client, companyId);
        if (!company) throw new Error('Company not found');
        if (company.status === 'paused') throw new Error('Trading is paused');
        if (company.status !== 'listed') throw new Error('Company is not listed');

        const { rows: positionRows } = await client.sql<HasdaqPosition>`
          SELECT *
          FROM hasdaq_positions
          WHERE user_id = ${userId}
            AND company_id = ${companyId}
          FOR UPDATE
        `;
        const position = positionRows[0] ? normalizeHasdaqPosition(positionRows[0]) : null;
        const daily = await ensureHasdaqDailyLimitForClient(client, company);
        const lowerLimit = Math.max(HASDAQ_MIN_PRICE_MILLI, Math.floor(daily.open_price_milli * (100 - HASDAQ_DAILY_LIMIT_PERCENT) / 100));
        const upperLimit = Math.floor(daily.open_price_milli * (100 + HASDAQ_DAILY_LIMIT_PERCENT) / 100);
        const currentPrice = Number(company.current_price_milli || HASDAQ_IPO_PRICE_MILLI);
        const stepCount = (shares: number) => Math.max(1, Math.ceil(shares / HASDAQ_SHARES_PER_PRICE_STEP));

        let shares: number;
        let grossAmount: number;
        let nextPrice: number;
        let transactionType: CoinTransactionType;
        let lockedSharesToSell = 0;

        if (side === 'buy') {
            shares = parseHasdaqPositiveInt(value, 0);
            if (!shares || shares > HASDAQ_MAX_BUY_SHARES) throw new Error('Invalid buy shares');
            if (company.public_shares_remaining < shares) throw new Error('Not enough public shares');
            if ((position?.public_shares || 0) + shares > HASDAQ_MAX_PUBLIC_SHARES_PER_USER) throw new Error('Position limit reached');
            grossAmount = computeHasdaqTradeCost(currentPrice, shares);
            nextPrice = currentPrice + stepCount(shares) * HASDAQ_PRICE_STEP_MILLI;
            if (nextPrice > upperLimit) throw new Error('Daily price limit reached');
            transactionType = 'hasdaq_buy';
        } else {
            shares = parseHasdaqPositiveInt(value, 0);
            if (!shares || shares > HASDAQ_MAX_SELL_SHARES) throw new Error('Invalid sell shares');
            if (!position || position.public_shares + position.locked_shares < shares) throw new Error('Not enough shares');
            if (position.public_shares < shares) {
                if (company.company_type === 'official_demo') {
                    throw new Error('Official demo founder shares are permanently locked');
                }
                if (!company.lockup_until || new Date(company.lockup_until).getTime() > Date.now()) {
                    throw new Error('Founder shares are locked');
                }
                lockedSharesToSell = shares - position.public_shares;
                const founderDailyLimit = Math.max(1, Math.floor(position.locked_shares * 0.1));
                const { rows: founderSellRows } = await client.sql<{ sold: number }>`
                  SELECT COALESCE(SUM(locked_shares_sold), 0)::int as sold
                  FROM hasdaq_trades
                  WHERE company_id = ${companyId}
                    AND user_id = ${userId}
                    AND type = 'sell'
                    AND (created_at AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date
                `;
                if (Number(founderSellRows[0]?.sold || 0) + lockedSharesToSell > founderDailyLimit) {
                    throw new Error('Founder sell limit reached');
                }
            }
            grossAmount = computeHasdaqTradeProceeds(currentPrice, shares);
            if (grossAmount < 1) throw new Error('Sell proceeds too small');
            if (company.h_coin_pool < grossAmount) throw new Error('Company pool has insufficient liquidity');
            nextPrice = Math.max(HASDAQ_MIN_PRICE_MILLI, currentPrice - stepCount(shares) * HASDAQ_PRICE_STEP_MILLI);
            if (nextPrice < lowerLimit) throw new Error('Daily price limit reached');
            transactionType = 'hasdaq_sell';
        }

        await ensureCoinWalletForClient(client, userId);
        const coinResult = await writeCoinTransactionForClient(client, {
            userId,
            amount: side === 'buy' ? -grossAmount : grossAmount,
            type: transactionType,
            sourceType: 'hasdaq_trade',
            sourceId: companyId,
            note: `${side.toUpperCase()} ${shares} ${company.ticker}`,
        });
        const averageCost = side === 'buy'
            ? Math.round((((position?.average_cost_milli || 0) * (position?.public_shares || 0)) + currentPrice * shares) / ((position?.public_shares || 0) + shares))
            : position && position.public_shares - shares > 0 ? position.average_cost_milli : 0;

        if (side === 'buy') {
            await client.sql`
              INSERT INTO hasdaq_positions (user_id, company_id, public_shares, average_cost_milli)
              VALUES (${userId}, ${companyId}, ${shares}, ${averageCost})
              ON CONFLICT (user_id, company_id)
              DO UPDATE SET
                public_shares = hasdaq_positions.public_shares + ${shares},
                average_cost_milli = ${averageCost},
                updated_at = CURRENT_TIMESTAMP
            `;
        } else {
            await client.sql`
              UPDATE hasdaq_positions
              SET public_shares = GREATEST(public_shares - ${shares}, 0),
                  locked_shares = locked_shares - ${lockedSharesToSell},
                  average_cost_milli = ${averageCost},
                  updated_at = CURRENT_TIMESTAMP
              WHERE user_id = ${userId}
                AND company_id = ${companyId}
            `;
        }

        const { rows: tradeRows } = await client.sql<HasdaqTrade>`
          INSERT INTO hasdaq_trades (company_id, user_id, type, shares, locked_shares_sold, price_milli, gross_amount, coin_transaction_id)
          VALUES (${companyId}, ${userId}, ${side}, ${shares}, ${lockedSharesToSell}, ${currentPrice}, ${grossAmount}, ${coinResult.transaction.id})
          RETURNING *
        `;
        await client.sql`
          UPDATE coin_transactions
          SET source_id = ${tradeRows[0].id}
          WHERE id = ${coinResult.transaction.id}
        `;
        await client.sql`
          UPDATE hasdaq_companies
          SET current_price_milli = ${nextPrice},
              public_shares_remaining = public_shares_remaining + CASE WHEN ${side} = 'buy' THEN -${shares} ELSE ${shares} END,
              h_coin_pool = h_coin_pool + CASE WHEN ${side} = 'buy' THEN ${grossAmount} ELSE -${grossAmount} END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${companyId}
        `;
        await client.sql`
          UPDATE hasdaq_daily_limits
          SET
            high_price_milli = GREATEST(high_price_milli, ${nextPrice}),
            low_price_milli = LEAST(low_price_milli, ${nextPrice}),
            trade_count = trade_count + 1,
            volume = volume + ${shares},
            updated_at = CURRENT_TIMESTAMP
          WHERE company_id = ${companyId}
            AND trade_date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date
        `;
        const { rows: updatedPositionRows } = await client.sql<HasdaqPosition>`
          SELECT *
          FROM hasdaq_positions
          WHERE user_id = ${userId}
            AND company_id = ${companyId}
        `;
        await client.sql`COMMIT`;

        return {
            trade: normalizeHasdaqTrade(tradeRows[0]),
            wallet: coinResult.wallet,
            position: updatedPositionRows[0] ? normalizeHasdaqPosition(updatedPositionRows[0]) : null,
            nextPriceMilli: nextPrice,
        };
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

export async function createHasdaqAnnouncement(userId: number, companyId: number, input: Record<string, unknown>) {
    const title = normalizeHasdaqText(input.title, 160);
    const body = normalizeHasdaqText(input.body || input.content, 3000);
    const category = normalizeHasdaqText(input.category, 40) || 'update';
    if (title.length < 2) throw new Error('Invalid announcement title');
    if (body.length < 4) throw new Error('Invalid announcement body');
    if (isHasdaqLocalDemoEnabled()) {
        const state = getLocalDevHasdaqState();
        const company = getLocalDevHasdaqCompanyById(companyId);
        if (!company) throw new Error('Company not found');
        const allowed = Number(company.founder_id) === Number(userId)
            || getLocalDevHasdaqMembers(companyId).some(member => member.user_id === userId && member.status === 'accepted');
        if (!allowed) throw new Error('Company forbidden');
        const announcement = normalizeHasdaqAnnouncement({
            id: state.nextAnnouncementId++,
            company_id: companyId,
            author_id: userId,
            author_name: userId === LOCAL_DEV_USER_ID ? LOCAL_DEV_HASDAQ_VIEWER_NAME : 'demo_local_user',
            title,
            body,
            category,
            created_at: hasdaqDemoDate(0),
        });
        state.announcementsExtra.push(announcement);
        return announcement;
    }

    await ensureHasdaqTables();

    const client = await db.connect();
    try {
        await client.sql`BEGIN`;
        const allowed = await isHasdaqAcceptedMemberForClient(client, userId, companyId);
        if (!allowed) throw new Error('Company forbidden');
        const { rows } = await client.sql<HasdaqAnnouncement>`
          INSERT INTO hasdaq_announcements (company_id, author_id, title, body, category)
          VALUES (${companyId}, ${userId}, ${title}, ${body}, ${category})
          RETURNING *
        `;
        const announcement = normalizeHasdaqAnnouncement(rows[0]);
        const { rows: holderRows } = await client.sql<{ user_id: number }>`
          SELECT DISTINCT user_id
          FROM hasdaq_positions
          WHERE company_id = ${companyId}
            AND user_id != ${userId}
            AND public_shares + locked_shares > 0
          LIMIT 120
        `;
        await client.sql`COMMIT`;

        await Promise.all(holderRows.map(row => createNotification({
            recipientId: Number(row.user_id),
            actorId: userId,
            type: 'hasdaq_announcement',
            companyId,
        })));

        return announcement;
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}
