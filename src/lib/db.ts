import { db, sql, type VercelPoolClient } from '@vercel/postgres';
import { hashStudentId, STUDENT_GRADES, type VerificationStatus, type VerificationType, type VerificationDraft } from './verification';
import { isAvatarThemeId, normalizeAvatarEmoji, pickRandomAvatarThemeId } from './avatarThemes';
import { normalizeUsernameInput, validateUsername } from './accountValidation';
import { normalizePostContentFormat, type PostContentFormat } from './forumContent';

const AUTO_ENSURE_READ_SCHEMA = process.env.HAJIMI_AUTO_ENSURE_ON_READ === '1' || process.env.NODE_ENV !== 'production';

function shouldAutoEnsureReadSchema() {
    return AUTO_ENSURE_READ_SCHEMA;
}

// --- Interfaces ---

export interface User {
    id: number;
    username: string;
    points: number;
    level: number;
    role: string;
    password_hash?: string;
    bio?: string;
    avatar?: string;
    avatar_emoji?: string;
    avatar_theme?: string;
    profile_image?: string;
    grade?: string;
    age?: number;
    ethnicity?: string;
    is_creator?: boolean;
    badge_preferences?: string[] | null;
    verification_status?: VerificationStatus;
    verification_type?: VerificationType | null;
    streak_count: number;
    last_checkin_at?: string;
    daily_likes_count: number;
    last_like_at?: string;
    account_status?: AccountStatus;
    disabled_at?: string | null;
    disabled_by?: number | null;
    disabled_reason?: string | null;
    created_at: string;
}

export type LeaderboardWindow = 'all' | 'day' | 'week' | 'month';
export type LeaderboardCategory = 'all' | 'community' | 'project';
export type AccountStatus = 'active' | 'disabled';

export interface ProfileAnalyticsDay {
    key: string;
    label: string;
    xp: number;
    projectOpens: number;
    postInteractions: number;
    value: number;
}

export interface ProfileAnalytics {
    visibleXp: number;
    rawXp: number;
    displayLevel: number;
    xpToNext: number;
    progressPercent: number;
    projectOpenTotal: number;
    projectOpenWeek: number;
    postInteractionTotal: number;
    postCount: number;
    projectCount: number;
    creatorScore: number;
    weeklyGrowth: number;
    trend7Days: ProfileAnalyticsDay[];
    todayHours: ProfileAnalyticsDay[];
    heatmap28Days: ProfileAnalyticsDay[];
    heatmapMonthDays: ProfileAnalyticsDay[];
    contributionBreakdown: Array<{ label: string; value: number }>;
}

export interface AdminAuditEvent {
    id: number;
    actor_id: number | null;
    actor_name?: string | null;
    target_user_id: number | null;
    target_username?: string | null;
    target_type: 'verification' | 'project_submission' | 'user' | 'coin';
    target_id: number | null;
    event_type: string;
    summary: string;
    details: Record<string, unknown> | null;
    created_at: Date | string;
}

export interface AdminUserSummary {
    id: number;
    username: string;
    points: number;
    level: number;
    role: string;
    avatar?: string | null;
    avatar_emoji?: string | null;
    avatar_theme?: string | null;
    verification_status?: VerificationStatus;
    verification_type?: VerificationType | null;
    account_status: AccountStatus;
    disabled_at?: string | null;
    created_at: string;
    is_creator?: boolean;
}

export type CoinTransactionType =
    | 'grant'
    | 'admin_adjustment'
    | 'tip_sent'
    | 'tip_received'
    | 'redemption_hold'
    | 'redemption_refund';

export type CoinRedemptionStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface CoinWallet {
    user_id: number;
    balance: number;
    earned_total: number;
    spent_total: number;
    created_at: Date | string;
    updated_at: Date | string;
}

export interface CoinTransaction {
    id: number;
    user_id: number;
    username?: string | null;
    amount: number;
    balance_after: number;
    type: CoinTransactionType;
    source_type: string;
    source_id: number | null;
    counterparty_user_id: number | null;
    counterparty_username?: string | null;
    note: string | null;
    created_by: number | null;
    created_by_username?: string | null;
    created_at: Date | string;
}

export interface CoinRedemptionRequest {
    id: number;
    user_id: number;
    username?: string | null;
    amount: number;
    status: CoinRedemptionStatus;
    requested_note: string | null;
    review_note: string | null;
    reviewed_by: number | null;
    reviewer_name?: string | null;
    reviewed_at: Date | string | null;
    completed_at: Date | string | null;
    created_at: Date | string;
}

export interface CoinWalletOverview {
    wallet: CoinWallet;
    transactions: CoinTransaction[];
    redemptions: CoinRedemptionRequest[];
}

export interface AdminUserDetail extends AdminUserSummary {
    bio?: string | null;
    profile_image?: string | null;
    grade?: string | null;
    age?: number | null;
    ethnicity?: string | null;
    verified_name: string | null;
    verified_grade: string | null;
    verified_subject: string | null;
    student_id_last4: string | null;
    verification_submitted_at?: string | null;
    verified_at?: string | null;
    verification_reviewed_by?: number | null;
    verification_reviewer_name?: string | null;
    verification_note?: string | null;
    disabled_by?: number | null;
    disabled_by_name?: string | null;
    disabled_reason?: string | null;
    recent_audit_events: AdminAuditEvent[];
}

export interface VerificationRequest {
    id: number;
    username: string;
    role: string;
    avatar?: string;
    avatar_emoji?: string | null;
    avatar_theme?: string | null;
    verification_status: VerificationStatus;
    verification_type: VerificationType | null;
    verified_name: string | null;
    verified_grade: string | null;
    verified_subject: string | null;
    student_id_last4: string | null;
    has_verified_student_id_conflict: boolean;
    has_name_identity_conflict: boolean;
    verification_submitted_at?: string;
    verified_at?: string;
    verification_note?: string;
}

export interface Project {
    id: number;
    author_id: number;
    author_name?: string;
    title: string;
    description: string;
    emoji: string;
    url: string | null;
    tags: string[];
    accent_color: string;
    status: 'live' | 'coming_soon';
    likes: number; // Keeping for backward compatibility temporarily if needed
    rating: number;
    rating_count: number;
    commentCount?: number;
    comment_count?: number;
    cover_url?: string | null;
    user_score?: number; // Score given by the current user, fetched dynamically
    open_count_today?: number;
    open_count_week?: number;
    open_count_month?: number;
    open_count_total?: number;
    unique_open_count_today?: number;
    unique_open_count_week?: number;
    unique_open_count_month?: number;
    unique_open_count_total?: number;
    effective_open_count_today?: number;
    effective_open_count_week?: number;
    effective_open_count_month?: number;
    effective_open_count_total?: number;
    hub_score?: number;
    created_at: string;
}

export interface ProjectComment {
    id: number;
    project_id: number;
    author_id: number;
    author_name?: string;
    author_avatar?: string;
    author_avatar_emoji?: string | null;
    author_avatar_theme?: string | null;
    author_score?: number | null;
    content: string;
    created_at: string;
}

export interface ProjectUserFeedback {
    comment_id: number | null;
    content: string | null;
    score: number | null;
}

export type ProjectSubmissionType = 'new_project' | 'new_version';
export type ProjectSubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface ProjectSubmission {
    id: number;
    author_id: number;
    author_name?: string;
    submission_type: ProjectSubmissionType;
    project_id: number | null;
    project_title?: string | null;
    title: string;
    description: string;
    emoji: string;
    url: string | null;
    tags: string[];
    accent_color: string;
    version_notes: string | null;
    cover_url: string | null;
    status: ProjectSubmissionStatus;
    reviewed_by: number | null;
    reviewed_at: string | null;
    review_note: string | null;
    created_at: string;
}

export type ProjectSubmissionInput = {
    author_id: number;
    submission_type: ProjectSubmissionType;
    project_id?: number | null;
    title: string;
    description: string;
    emoji: string;
    url?: string | null;
    tags: string[];
    accent_color?: string | null;
    version_notes?: string | null;
    cover_url?: string | null;
};

export interface Post {
    id: number;
    author_id: number;
    article_id?: number | null;
    title: string;
    content: string;
    content_format?: PostContentFormat;
    type: string;
    tag: string;
    attachment_url?: string;
    attachment_urls?: string[] | null;
    likes: number;
    created_at: Date;
    updated_at?: Date;
    author_name?: string;
    author_avatar?: string;
    author_avatar_emoji?: string | null;
    author_avatar_theme?: string | null;
    author_role?: string;
    author_is_creator?: boolean;
    author_badge_preferences?: string[] | null;
    author_verification_status?: VerificationStatus | null;
    comment_count?: number;
    is_bookmarked?: boolean;
    has_liked?: boolean;
    featured_comment?: FeaturedComment | null;
}

export interface PostPage {
    posts: Post[];
    hasMore: boolean;
    nextOffset: number;
}

export interface Article {
    id: number;
    author_id: number;
    title: string;
    excerpt: string | null;
    content: string;
    tag: string;
    forum_post_id?: number | null;
    created_at: Date;
    updated_at?: Date | null;
    author_name?: string;
    author_avatar?: string | null;
    author_avatar_emoji?: string | null;
    author_avatar_theme?: string | null;
    author_role?: string | null;
    author_badge_preferences?: string[] | null;
    author_verification_status?: VerificationStatus | null;
}

export interface Comment {
    id: number;
    post_id: number;
    author_id: number;
    content: string;
    attachment_url?: string | null;
    likes: number;
    created_at: Date;
    parent_comment_id?: number | null;
    reply_author_name?: string | null;
    reply_content?: string | null;
    author_name?: string;
    author_avatar?: string;
    author_avatar_emoji?: string | null;
    author_avatar_theme?: string | null;
    author_role?: string;
    author_is_creator?: boolean;
    author_badge_preferences?: string[] | null;
    author_verification_status?: VerificationStatus | null;
    has_liked?: boolean;
}

export interface FeaturedComment {
    id: number;
    author_id: number;
    content: string;
    attachment_url?: string | null;
    likes: number;
    created_at: Date;
    reply_author_name?: string | null;
    reply_content?: string | null;
    author_name?: string;
    author_avatar?: string;
    author_avatar_emoji?: string | null;
    author_avatar_theme?: string | null;
    author_role?: string;
    author_is_creator?: boolean;
    author_badge_preferences?: string[] | null;
    author_verification_status?: VerificationStatus | null;
    has_liked?: boolean;
}

export interface Notification {
    id: number;
    recipient_id: number;
    actor_id: number;
    type: 'post_like' | 'post_bookmark' | 'comment_like' | 'post_comment' | 'comment_reply';
    post_id?: number | null;
    comment_id?: number | null;
    read_at?: Date | null;
    created_at: Date;
    actor_name?: string;
    actor_avatar?: string;
    actor_avatar_emoji?: string | null;
    actor_avatar_theme?: string | null;
    post_title?: string;
    comment_content?: string | null;
    target_comment_content?: string | null;
}

export interface AdminReviewTask {
    id: string;
    kind: 'verification' | 'project_submission';
    title: string;
    description: string;
    href: string;
    created_at: Date | string | null;
}

export interface PublicAvatar {
    id: number;
    avatar?: string | null;
    avatar_emoji?: string | null;
    avatar_theme?: string | null;
}

export interface AdminReviewSummary {
    totalCount: number;
    verificationCount: number;
    projectSubmissionCount: number;
    tasks: AdminReviewTask[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ADMIN_VISIBLE_XP_CAP = 680;
const ADMIN_WINDOW_XP_CAP = 120;
const ADMIN_DAILY_ACTIVITY_XP_CAP = 24;
const MEMBER_DAILY_ACTIVITY_XP_CAP = 120;

export function applyVisibleXpDisplayCap(points: number, role?: string | null) {
    const safePoints = Math.max(0, Math.round(points));
    return String(role || '').toLowerCase() === 'admin'
        ? Math.min(safePoints, ADMIN_VISIBLE_XP_CAP)
        : safePoints;
}

function normalizeDailyActivityXp(points: number, role?: string | null) {
    const cap = String(role || '').toLowerCase() === 'admin'
        ? ADMIN_DAILY_ACTIVITY_XP_CAP
        : MEMBER_DAILY_ACTIVITY_XP_CAP;
    return Math.min(Math.max(0, Math.round(points)), cap);
}

function getVisibleLevel(points: number) {
    return Math.max(1, Math.floor(Math.sqrt(Math.max(0, points) / 50.0)) + 1);
}

function getLevelProgress(points: number) {
    const safePoints = Math.max(0, Math.round(points));
    const level = getVisibleLevel(safePoints);
    const currentLevelStart = 50 * Math.pow(level - 1, 2);
    const nextLevelStart = 50 * Math.pow(level, 2);
    const required = Math.max(1, nextLevelStart - currentLevelStart);
    const progress = Math.max(0, safePoints - currentLevelStart);

    return {
        displayLevel: level,
        xpToNext: Math.max(0, nextLevelStart - safePoints),
        progressPercent: Math.min(100, Math.round((progress / required) * 100)),
    };
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

function formatAnalyticsDayLabel(key: string, mode: 'weekday' | 'date') {
    const date = new Date(`${key}T00:00:00+08:00`);
    return date.toLocaleDateString('en-US', mode === 'weekday'
        ? { weekday: 'short', timeZone: 'Asia/Shanghai' }
        : { month: 'short', day: 'numeric', timeZone: 'Asia/Shanghai' });
}

// --- User Helpers ---

function normalizeAccountStatus(value?: string | null): AccountStatus {
    return value === 'disabled' ? 'disabled' : 'active';
}

function normalizeAuditDetails(value: unknown): Record<string, unknown> | null {
    if (!value) return null;
    if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;

    try {
        const parsed = JSON.parse(String(value));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : null;
    } catch {
        return null;
    }
}

let userProfileEnhancementsReady: Promise<void> | null = null;

async function ensureUserProfileEnhancements() {
    if (!userProfileEnhancementsReady) {
        userProfileEnhancementsReady = (async () => {
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_preferences JSONB DEFAULT '[]'::jsonb`;
            await sql`ALTER TABLE users ALTER COLUMN badge_preferences TYPE JSONB USING COALESCE(to_jsonb(badge_preferences), '[]'::jsonb)`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_emoji TEXT DEFAULT '😊'`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_theme TEXT DEFAULT 'lavender'`;
            await sql`UPDATE users SET bio = 'New member at Hajimi High!' WHERE bio = 'New student at Hajimi High!'`;
            await ensureVerificationColumns();
            await ensureAdminAccountEnhancements();
        })().catch(error => {
            userProfileEnhancementsReady = null;
            throw error;
        });
    }

    return userProfileEnhancementsReady;
}

async function ensureVerificationColumns() {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_type TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_name TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_grade TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_subject TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_hash TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_last4 TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMP WITH TIME ZONE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_reviewed_by INTEGER`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_note TEXT`;
    await sql`UPDATE users SET verification_status = 'verified', verification_type = COALESCE(verification_type, CASE WHEN role = 'teacher' THEN 'teacher' ELSE 'student' END), verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP) WHERE lower(username) = 'eric' AND verification_status IS DISTINCT FROM 'verified'`;
    await sql`UPDATE users SET verification_status = 'unverified' WHERE verification_status IS NULL`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users(verification_status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_student_id_hash ON users(student_id_hash) WHERE student_id_hash IS NOT NULL`;
}

let adminAccountEnhancementsReady: Promise<void> | null = null;

async function ensureAdminAccountEnhancements() {
    if (!adminAccountEnhancementsReady) {
        adminAccountEnhancementsReady = (async () => {
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active'`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP WITH TIME ZONE`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_by INTEGER`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_reason TEXT`;
            await sql`UPDATE users SET account_status = 'active' WHERE account_status IS NULL`;
            await sql`CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status)`;
        })().catch(error => {
            adminAccountEnhancementsReady = null;
            throw error;
        });
    }

    return adminAccountEnhancementsReady;
}

let adminAuditTableReady: Promise<void> | null = null;

async function ensureAdminAuditTable() {
    if (!adminAuditTableReady) {
        adminAuditTableReady = (async () => {
            await sql`
              CREATE TABLE IF NOT EXISTS admin_audit_events (
                id SERIAL PRIMARY KEY,
                actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                target_type TEXT NOT NULL,
                target_id INTEGER,
                event_type TEXT NOT NULL,
                summary TEXT NOT NULL,
                details JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`
              CREATE INDEX IF NOT EXISTS idx_admin_audit_created
              ON admin_audit_events(created_at DESC);
            `;
            await sql`
              CREATE INDEX IF NOT EXISTS idx_admin_audit_target_user
              ON admin_audit_events(target_user_id, created_at DESC);
            `;
            await sql`
              CREATE INDEX IF NOT EXISTS idx_admin_audit_target_type
              ON admin_audit_events(target_type, created_at DESC);
            `;
        })().catch(error => {
            adminAuditTableReady = null;
            throw error;
        });
    }

    return adminAuditTableReady;
}

async function createAdminAuditEvent(input: {
    actorId: number | null;
    targetUserId?: number | null;
    targetType: AdminAuditEvent['target_type'];
    targetId?: number | null;
    eventType: string;
    summary: string;
    details?: Record<string, unknown> | null;
}) {
    await ensureAdminAuditTable();

    await sql`
      INSERT INTO admin_audit_events (
        actor_id, target_user_id, target_type, target_id, event_type, summary, details
      )
      VALUES (
        ${input.actorId},
        ${input.targetUserId ?? null},
        ${input.targetType},
        ${input.targetId ?? null},
        ${input.eventType},
        ${input.summary.trim().slice(0, 280) || input.eventType},
        ${JSON.stringify(input.details || {})}::jsonb
      )
    `;
}

let coinTablesReady: Promise<void> | null = null;

export async function ensureCoinTables() {
    if (!coinTablesReady) {
        coinTablesReady = (async () => {
            await sql`
              CREATE TABLE IF NOT EXISTS coin_wallets (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
                earned_total INTEGER NOT NULL DEFAULT 0 CHECK (earned_total >= 0),
                spent_total INTEGER NOT NULL DEFAULT 0 CHECK (spent_total >= 0),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`
              CREATE TABLE IF NOT EXISTS coin_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount INTEGER NOT NULL,
                balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
                type TEXT NOT NULL,
                source_type TEXT NOT NULL,
                source_id INTEGER,
                counterparty_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                note TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`
              CREATE TABLE IF NOT EXISTS coin_project_tips (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount INTEGER NOT NULL CHECK (amount > 0),
                sender_transaction_id INTEGER NOT NULL REFERENCES coin_transactions(id),
                recipient_transaction_id INTEGER NOT NULL REFERENCES coin_transactions(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`
              CREATE TABLE IF NOT EXISTS coin_redemption_requests (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount INTEGER NOT NULL CHECK (amount >= 50),
                status TEXT NOT NULL DEFAULT 'pending',
                requested_note TEXT,
                review_note TEXT,
                reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                reviewed_at TIMESTAMP WITH TIME ZONE,
                completed_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_created ON coin_transactions(user_id, created_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_coin_transactions_source ON coin_transactions(source_type, source_id)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_coin_project_tips_project_created ON coin_project_tips(project_id, created_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_coin_project_tips_sender_created ON coin_project_tips(sender_id, created_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_coin_project_tips_recipient_created ON coin_project_tips(recipient_id, created_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_coin_redemptions_status_created ON coin_redemption_requests(status, created_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_coin_redemptions_user_created ON coin_redemption_requests(user_id, created_at DESC)`;
        })().catch(error => {
            coinTablesReady = null;
            throw error;
        });
    }

    return coinTablesReady;
}

function normalizeCoinTransaction(row: CoinTransaction): CoinTransaction {
    return {
        ...row,
        amount: Number(row.amount || 0),
        balance_after: Number(row.balance_after || 0),
        source_id: row.source_id === null || row.source_id === undefined ? null : Number(row.source_id),
        counterparty_user_id: row.counterparty_user_id === null || row.counterparty_user_id === undefined ? null : Number(row.counterparty_user_id),
        created_by: row.created_by === null || row.created_by === undefined ? null : Number(row.created_by),
    };
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

function normalizeCoinRedemption(row: CoinRedemptionRequest): CoinRedemptionRequest {
    return {
        ...row,
        id: Number(row.id),
        user_id: Number(row.user_id),
        amount: Number(row.amount || 0),
    };
}

async function ensureCoinWalletForClient(client: VercelPoolClient, userId: number) {
    const { rows } = await client.sql<CoinWallet>`
      INSERT INTO coin_wallets (user_id)
      VALUES (${userId})
      ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
      RETURNING *
    `;

    return normalizeCoinWallet(rows[0]);
}

async function writeCoinTransactionForClient(
    client: VercelPoolClient,
    input: {
        userId: number;
        amount: number;
        type: CoinTransactionType;
        sourceType: string;
        sourceId?: number | null;
        counterpartyUserId?: number | null;
        note?: string | null;
        createdBy?: number | null;
    },
) {
    const { rows } = await client.sql<CoinWallet>`
      UPDATE coin_wallets
      SET
        balance = balance + ${input.amount},
        earned_total = earned_total + CASE WHEN ${input.amount} > 0 THEN ${input.amount} ELSE 0 END,
        spent_total = spent_total + CASE WHEN ${input.amount} < 0 THEN ABS(${input.amount}) ELSE 0 END,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${input.userId}
        AND balance + ${input.amount} >= 0
      RETURNING *
    `;

    const wallet = rows[0];
    if (!wallet) throw new Error('Insufficient coins');

    const normalizedWallet = normalizeCoinWallet(wallet);
    const { rows: transactionRows } = await client.sql<CoinTransaction>`
      INSERT INTO coin_transactions (
        user_id, amount, balance_after, type, source_type, source_id,
        counterparty_user_id, note, created_by
      )
      VALUES (
        ${input.userId},
        ${input.amount},
        ${normalizedWallet.balance},
        ${input.type},
        ${input.sourceType},
        ${input.sourceId ?? null},
        ${input.counterpartyUserId ?? null},
        ${String(input.note || '').trim().slice(0, 500) || null},
        ${input.createdBy ?? null}
      )
      RETURNING *
    `;

    return {
        wallet: normalizedWallet,
        transaction: normalizeCoinTransaction(transactionRows[0]),
    };
}

export async function getCoinWallet(userId: number): Promise<CoinWallet> {
    await ensureCoinTables();

    const client = await db.connect();
    try {
        await client.sql`BEGIN`;
        const wallet = await ensureCoinWalletForClient(client, userId);
        await client.sql`COMMIT`;
        return wallet;
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

export async function getCoinWalletBalance(userId: number): Promise<CoinWallet> {
    if (shouldAutoEnsureReadSchema()) {
        await ensureCoinTables();
    }

    const { rows } = await sql<CoinWallet>`
      SELECT
        users.id as user_id,
        COALESCE(coin_wallets.balance, 0)::int as balance,
        COALESCE(coin_wallets.earned_total, 0)::int as earned_total,
        COALESCE(coin_wallets.spent_total, 0)::int as spent_total,
        COALESCE(coin_wallets.created_at, users.created_at) as created_at,
        COALESCE(coin_wallets.updated_at, users.created_at) as updated_at
      FROM users
      LEFT JOIN coin_wallets ON coin_wallets.user_id = users.id
      WHERE users.id = ${userId}
      LIMIT 1
    `;

    if (!rows[0]) {
        throw new Error('User not found');
    }

    return normalizeCoinWallet(rows[0]);
}

export async function getCoinWalletOverview(userId: number): Promise<CoinWalletOverview> {
    await ensureCoinTables();

    const wallet = await getCoinWallet(userId);
    const { rows: transactionRows } = await sql<CoinTransaction>`
      SELECT
        coin_transactions.*,
        users.username,
        counterparties.username as counterparty_username,
        creators.username as created_by_username
      FROM coin_transactions
      JOIN users ON users.id = coin_transactions.user_id
      LEFT JOIN users counterparties ON counterparties.id = coin_transactions.counterparty_user_id
      LEFT JOIN users creators ON creators.id = coin_transactions.created_by
      WHERE coin_transactions.user_id = ${userId}
      ORDER BY coin_transactions.created_at DESC
      LIMIT 40
    `;
    const { rows: redemptionRows } = await sql<CoinRedemptionRequest>`
      SELECT
        coin_redemption_requests.*,
        users.username,
        reviewers.username as reviewer_name
      FROM coin_redemption_requests
      JOIN users ON users.id = coin_redemption_requests.user_id
      LEFT JOIN users reviewers ON reviewers.id = coin_redemption_requests.reviewed_by
      WHERE coin_redemption_requests.user_id = ${userId}
      ORDER BY coin_redemption_requests.created_at DESC
      LIMIT 20
    `;

    return {
        wallet,
        transactions: transactionRows.map(normalizeCoinTransaction),
        redemptions: redemptionRows.map(normalizeCoinRedemption),
    };
}

export async function getAdminCoinOverview(options: { query?: string; limit?: number } = {}) {
    await ensureCoinTables();

    const query = String(options.query || '').trim().toLowerCase().slice(0, 60);
    const safeLimit = Math.min(Math.max(Number(options.limit) || 80, 1), 120);

    const { rows: userRows } = await sql<Array<CoinWallet & { username: string; role: string; verification_status: VerificationStatus }>[number]>`
      SELECT
        users.id as user_id,
        users.username,
        users.role,
        users.verification_status,
        COALESCE(coin_wallets.balance, 0)::int as balance,
        COALESCE(coin_wallets.earned_total, 0)::int as earned_total,
        COALESCE(coin_wallets.spent_total, 0)::int as spent_total,
        COALESCE(coin_wallets.created_at, users.created_at) as created_at,
        COALESCE(coin_wallets.updated_at, users.created_at) as updated_at
      FROM users
      LEFT JOIN coin_wallets ON coin_wallets.user_id = users.id
      WHERE (
        ${query} = ''
        OR lower(users.username) LIKE ${`%${query}%`}
        OR CAST(users.id AS TEXT) = ${query}
        OR lower(COALESCE(users.verified_name, '')) LIKE ${`%${query}%`}
      )
      ORDER BY COALESCE(coin_wallets.balance, 0) DESC, users.created_at DESC
      LIMIT ${safeLimit}
    `;

    const { rows: redemptionRows } = await sql<CoinRedemptionRequest>`
      SELECT
        coin_redemption_requests.*,
        users.username,
        reviewers.username as reviewer_name
      FROM coin_redemption_requests
      JOIN users ON users.id = coin_redemption_requests.user_id
      LEFT JOIN users reviewers ON reviewers.id = coin_redemption_requests.reviewed_by
      WHERE coin_redemption_requests.status IN ('pending', 'approved')
      ORDER BY coin_redemption_requests.created_at ASC
      LIMIT 80
    `;

    return {
        users: userRows.map(row => ({
            ...row,
            user_id: Number(row.user_id),
            balance: Number(row.balance || 0),
            earned_total: Number(row.earned_total || 0),
            spent_total: Number(row.spent_total || 0),
        })),
        redemptions: redemptionRows.map(normalizeCoinRedemption),
    };
}

export async function grantCoinsByAdmin(input: {
    adminId: number;
    targetUserId: number;
    amount: number;
    sourceType: string;
    note: string;
}) {
    await ensureCoinTables();
    await ensureAdminAuditTable();

    const amount = Math.floor(Number(input.amount));
    const note = String(input.note || '').trim();
    const sourceType = String(input.sourceType || 'manual').trim().slice(0, 80) || 'manual';
    if (!Number.isInteger(amount) || amount < 1 || amount > 10000) throw new Error('Invalid coin amount');
    if (note.length < 2) throw new Error('Coin grant note required');

    const target = await getUserById(input.targetUserId);
    if (!target) throw new Error('Target user not found');

    const client = await db.connect();
    try {
        await client.sql`BEGIN`;
        await ensureCoinWalletForClient(client, input.targetUserId);
        const result = await writeCoinTransactionForClient(client, {
            userId: input.targetUserId,
            amount,
            type: 'grant',
            sourceType,
            note,
            createdBy: input.adminId,
        });
        await client.sql`COMMIT`;

        await createAdminAuditEvent({
            actorId: input.adminId,
            targetUserId: input.targetUserId,
            targetType: 'coin',
            targetId: result.transaction.id,
            eventType: 'coin_granted',
            summary: `向 ${target.username} 发放 ${amount} H币`,
            details: {
                amount,
                source_type: sourceType,
                note,
                balance_after: result.wallet.balance,
            },
        });

        return result;
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

export async function transferProjectCoinTip(senderId: number, projectId: number, amount: number) {
    await ensureCoinTables();

    const safeAmount = Math.floor(Number(amount));
    if (!Number.isInteger(safeAmount) || safeAmount < 1 || safeAmount > 100) {
        throw new Error('Invalid tip amount');
    }

    const client = await db.connect();
    try {
        await client.sql`BEGIN`;

        const { rows: projectRows } = await client.sql<{ author_id: number; status: string | null }>`
          SELECT author_id, status
          FROM projects
          WHERE id = ${projectId}
          LIMIT 1
        `;
        const project = projectRows[0];
        if (!project) throw new Error('Project not found');
        if (project.status !== 'live') throw new Error('Project is not live');

        const recipientId = Number(project.author_id);
        if (recipientId === senderId) throw new Error('Cannot tip your own project');

        await ensureCoinWalletForClient(client, senderId);
        await ensureCoinWalletForClient(client, recipientId);

        const senderResult = await writeCoinTransactionForClient(client, {
            userId: senderId,
            amount: -safeAmount,
            type: 'tip_sent',
            sourceType: 'project_tip',
            sourceId: projectId,
            counterpartyUserId: recipientId,
            note: 'Function Hall 项目打赏',
        });
        const recipientResult = await writeCoinTransactionForClient(client, {
            userId: recipientId,
            amount: safeAmount,
            type: 'tip_received',
            sourceType: 'project_tip',
            sourceId: projectId,
            counterpartyUserId: senderId,
            note: 'Function Hall 项目打赏',
        });

        const { rows: tipRows } = await client.sql<{ id: number }>`
          INSERT INTO coin_project_tips (
            project_id, sender_id, recipient_id, amount,
            sender_transaction_id, recipient_transaction_id
          )
          VALUES (
            ${projectId},
            ${senderId},
            ${recipientId},
            ${safeAmount},
            ${senderResult.transaction.id},
            ${recipientResult.transaction.id}
          )
          RETURNING id
        `;

        await client.sql`COMMIT`;

        return {
            id: Number(tipRows[0]?.id || 0),
            amount: safeAmount,
            recipientId,
            senderCoinBalance: senderResult.wallet.balance,
            recipientCoinBalance: recipientResult.wallet.balance,
        };
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

export async function createCoinRedemptionRequest(userId: number, amount: number, requestedNote = '') {
    await ensureCoinTables();

    const safeAmount = Math.floor(Number(amount));
    const note = String(requestedNote || '').trim().slice(0, 500);
    if (!Number.isInteger(safeAmount) || safeAmount < 50 || safeAmount > 10000) {
        throw new Error('Invalid redemption amount');
    }

    const client = await db.connect();
    try {
        await client.sql`BEGIN`;
        await ensureCoinWalletForClient(client, userId);
        const holdResult = await writeCoinTransactionForClient(client, {
            userId,
            amount: -safeAmount,
            type: 'redemption_hold',
            sourceType: 'token_redemption',
            note: note || '申请兑换 token 额度',
        });
        const { rows } = await client.sql<CoinRedemptionRequest>`
          INSERT INTO coin_redemption_requests (user_id, amount, requested_note)
          VALUES (${userId}, ${safeAmount}, ${note || null})
          RETURNING *
        `;
        const redemptionId = Number(rows[0]?.id || 0);
        await client.sql`
          UPDATE coin_transactions
          SET source_id = ${redemptionId}
          WHERE id = ${holdResult.transaction.id}
        `;
        await client.sql`COMMIT`;

        return {
            request: normalizeCoinRedemption(rows[0]),
            wallet: holdResult.wallet,
        };
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

export async function reviewCoinRedemptionRequest(adminId: number, requestId: number, action: 'approve' | 'reject' | 'complete', reviewNote = '') {
    await ensureCoinTables();
    await ensureAdminAuditTable();

    const note = String(reviewNote || '').trim().slice(0, 500);
    const client = await db.connect();
    try {
        await client.sql`BEGIN`;

        const { rows } = await client.sql<CoinRedemptionRequest & { username?: string | null }>`
          SELECT coin_redemption_requests.*, users.username
          FROM coin_redemption_requests
          JOIN users ON users.id = coin_redemption_requests.user_id
          WHERE coin_redemption_requests.id = ${requestId}
          FOR UPDATE
        `;
        const request = rows[0];
        if (!request) throw new Error('Redemption request not found');

        let nextStatus: CoinRedemptionStatus;
        let eventType = 'coin_redemption_updated';
        let wallet: CoinWallet | null = null;

        if (action === 'approve') {
            if (request.status !== 'pending') throw new Error('Redemption request is not pending');
            nextStatus = 'approved';
            eventType = 'coin_redemption_approved';
        } else if (action === 'reject') {
            if (request.status !== 'pending' && request.status !== 'approved') throw new Error('Redemption request cannot be rejected');
            nextStatus = 'rejected';
            await ensureCoinWalletForClient(client, Number(request.user_id));
            const refundResult = await writeCoinTransactionForClient(client, {
                userId: Number(request.user_id),
                amount: Number(request.amount),
                type: 'redemption_refund',
                sourceType: 'token_redemption',
                sourceId: requestId,
                note: note || '兑换申请未通过，退回 H币',
                createdBy: adminId,
            });
            wallet = refundResult.wallet;
            eventType = 'coin_redemption_rejected';
        } else {
            if (request.status !== 'approved') throw new Error('Redemption request is not approved');
            nextStatus = 'completed';
            eventType = 'coin_redemption_completed';
        }

        const { rows: updatedRows } = await client.sql<CoinRedemptionRequest>`
          UPDATE coin_redemption_requests
          SET
            status = ${nextStatus},
            review_note = ${note || request.review_note || null},
            reviewed_by = ${adminId},
            reviewed_at = CURRENT_TIMESTAMP,
            completed_at = CASE WHEN ${nextStatus} = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
          WHERE id = ${requestId}
          RETURNING *
        `;

        await client.sql`COMMIT`;

        await createAdminAuditEvent({
            actorId: adminId,
            targetUserId: Number(request.user_id),
            targetType: 'coin',
            targetId: requestId,
            eventType,
            summary: `${request.username || `用户 ${request.user_id}`} 的 ${request.amount} H币兑换申请已${nextStatus === 'approved' ? '通过' : nextStatus === 'rejected' ? '拒绝' : '完成'}`,
            details: {
                amount: Number(request.amount),
                status: nextStatus,
                note,
                balance_after: wallet?.balance,
            },
        });

        return normalizeCoinRedemption(updatedRows[0]);
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

export async function getUser(username: string) {
    await ensureUserProfileEnhancements();

    const { rows } = await sql<User>`
      SELECT
        id, username, password_hash, points, level, role, bio, avatar, avatar_emoji, avatar_theme, profile_image,
        grade, age, ethnicity, badge_preferences, verification_status, verification_type,
        streak_count, last_checkin_at, daily_likes_count, last_like_at,
        COALESCE(account_status, 'active') as account_status,
        disabled_at, disabled_by, disabled_reason, created_at
      FROM users
      WHERE username = ${username}
      LIMIT 1
    `;
    return rows[0];
}

export async function getUserById(id: number): Promise<User | null> {
    if (shouldAutoEnsureReadSchema()) {
        await ensureUserProfileEnhancements();
    }

    const { rows } = await sql<User>`
      SELECT
        users.id,
        users.username,
        CASE WHEN users.role = 'admin' THEN LEAST(users.points, ${ADMIN_VISIBLE_XP_CAP}) ELSE users.points END as points,
        GREATEST(
          1,
          FLOOR(SQRT((CASE WHEN users.role = 'admin' THEN LEAST(users.points, ${ADMIN_VISIBLE_XP_CAP}) ELSE users.points END) / 50.0))::int + 1
        ) as level,
        users.role,
        users.bio,
        users.avatar,
        users.avatar_emoji,
        users.avatar_theme,
        users.profile_image,
        users.grade,
        users.age,
        users.ethnicity,
        users.badge_preferences,
        users.verification_status,
        users.verification_type,
        users.streak_count,
        users.last_checkin_at,
        users.daily_likes_count,
        users.last_like_at,
        COALESCE(users.account_status, 'active') as account_status,
        users.disabled_at,
        users.disabled_by,
        users.disabled_reason,
        users.created_at,
        (SELECT COUNT(*) > 0 FROM projects WHERE author_id = users.id) as is_creator
      FROM users 
      WHERE id = ${id} 
      LIMIT 1
    `;
    return rows[0] || null;
}

export async function getUserAccountRole(userId: number): Promise<{ role: string; account_status: AccountStatus } | null> {
    if (shouldAutoEnsureReadSchema()) {
        await ensureAdminAccountEnhancements();
    }

    const { rows } = await sql<{ role: string; account_status: AccountStatus }>`
      SELECT role, COALESCE(account_status, 'active') as account_status
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    return rows[0] || null;
}

export async function getPublicAvatars(userIds: number[]): Promise<PublicAvatar[]> {
    const ids = Array.from(new Set(userIds.map(id => Math.floor(Number(id))).filter(id => Number.isFinite(id) && id > 0))).slice(0, 80);
    if (ids.length === 0) return [];

    const { rows } = await db.query<PublicAvatar>(
        `
          SELECT id, avatar, avatar_emoji, avatar_theme
          FROM users
          WHERE id = ANY($1::int[])
        `,
        [ids],
    );

    return rows;
}

export async function createUser(
    username: string,
    passwordHash: string,
    role = 'student',
    verification?: VerificationDraft | null,
    avatar?: { emoji?: string | null; theme?: string | null } | null,
    profile?: { bio?: string | null } | null
) {
    await ensureUserProfileEnhancements();
    const avatarEmoji = normalizeAvatarEmoji(avatar?.emoji || undefined);
    const avatarTheme = avatar?.theme && isAvatarThemeId(avatar.theme) ? avatar.theme : pickRandomAvatarThemeId();
    const bio = String(profile?.bio || '').trim().slice(0, 180) || 'New member at Hajimi High!';

    // Use RETURNING id to get the ID immediately
    const { rows } = await sql`
    INSERT INTO users (
      username,
      password_hash,
      points,
      role,
      bio,
      avatar,
      avatar_emoji,
      avatar_theme,
      verification_status,
        verification_type,
        verified_name,
        verified_grade,
        verified_subject,
        student_id_hash,
        student_id_last4,
        verification_submitted_at,
        account_status
    )
    VALUES (
      ${username},
      ${passwordHash},
      0,
      ${role},
      ${bio},
      ${avatarEmoji},
      ${avatarEmoji},
      ${avatarTheme},
      ${verification ? 'pending' : 'unverified'},
      ${verification?.verification_type ?? null},
      ${verification?.verified_name ?? null},
      ${verification?.verified_grade ?? null},
      ${verification?.verified_subject ?? null},
      ${verification?.student_id_hash ?? null},
      ${verification?.student_id_last4 ?? null},
      ${verification ? new Date().toISOString() : null},
      'active'
    )
    RETURNING id
  `;
    return rows[0].id;
}

export async function submitUserVerification(userId: number, verification: VerificationDraft) {
    await ensureUserProfileEnhancements();

    await sql`
      UPDATE users
      SET
        verification_status = 'pending',
        verification_type = ${verification.verification_type},
        verified_name = ${verification.verified_name},
        verified_grade = ${verification.verified_grade},
        verified_subject = ${verification.verified_subject},
        student_id_hash = ${verification.student_id_hash},
        student_id_last4 = ${verification.student_id_last4},
        verification_submitted_at = CURRENT_TIMESTAMP,
        verified_at = NULL,
        verification_reviewed_by = NULL,
        verification_note = NULL
      WHERE id = ${userId}
    `;
}

export async function getPendingVerificationRequests(): Promise<VerificationRequest[]> {
    await ensureUserProfileEnhancements();

    const { rows } = await sql<VerificationRequest>`
      SELECT
        users.id,
        users.username,
        users.role,
        users.avatar,
        users.verification_status,
        users.verification_type,
        users.verified_name,
        users.verified_grade,
        users.verified_subject,
        users.student_id_last4,
        users.verification_submitted_at,
        users.verified_at,
        users.verification_note,
        CASE
          WHEN users.student_id_hash IS NULL THEN false
          ELSE EXISTS (
            SELECT 1
            FROM users verified_users
            WHERE verified_users.student_id_hash = users.student_id_hash
              AND verified_users.verification_status = 'verified'
              AND verified_users.id != users.id
            )
        END as has_verified_student_id_conflict
        ,
        CASE
          WHEN users.verified_name IS NULL OR btrim(users.verified_name) = '' THEN false
          WHEN users.verification_type = 'student' THEN EXISTS (
            SELECT 1
            FROM users possible_matches
            WHERE possible_matches.id != users.id
              AND possible_matches.verification_type = 'student'
              AND possible_matches.verification_status IN ('pending', 'verified')
              AND lower(btrim(possible_matches.verified_name)) = lower(btrim(users.verified_name))
              AND possible_matches.verified_grade IS NOT DISTINCT FROM users.verified_grade
          )
          WHEN users.verification_type = 'teacher' THEN EXISTS (
            SELECT 1
            FROM users possible_matches
            WHERE possible_matches.id != users.id
              AND possible_matches.verification_type = 'teacher'
              AND possible_matches.verification_status IN ('pending', 'verified')
              AND lower(btrim(possible_matches.verified_name)) = lower(btrim(users.verified_name))
              AND lower(btrim(COALESCE(possible_matches.verified_subject, ''))) = lower(btrim(COALESCE(users.verified_subject, '')))
          )
          ELSE false
        END as has_name_identity_conflict
      FROM users
      WHERE users.verification_status = 'pending'
      ORDER BY users.verification_submitted_at ASC NULLS LAST, users.id ASC
    `;

    return rows;
}

export async function reviewUserVerification(targetUserId: number, reviewerId: number, status: 'verified' | 'rejected', note = '') {
    await ensureUserProfileEnhancements();
    await ensureAdminAuditTable();

    if (status === 'verified') {
        const { rows: conflictRows } = await sql<{ has_conflict: boolean }>`
          SELECT CASE
            WHEN target.student_id_hash IS NULL THEN false
            ELSE EXISTS (
              SELECT 1
              FROM users verified_users
              WHERE verified_users.student_id_hash = target.student_id_hash
                AND verified_users.verification_status = 'verified'
                AND verified_users.id != target.id
            )
          END as has_conflict
          FROM users target
          WHERE target.id = ${targetUserId}
          LIMIT 1
        `;

        if (conflictRows[0]?.has_conflict) {
            throw new Error('Student ID already verified');
        }
    }

    const { rows } = await sql<{ username: string; verification_type: VerificationType | null; verified_name: string | null; verified_grade: string | null; verified_subject: string | null }>`
      UPDATE users
      SET
        verification_status = ${status},
        role = CASE
          WHEN ${status} = 'verified' AND role != 'admin' AND verification_type = 'teacher' THEN 'teacher'
          WHEN ${status} = 'verified' AND role != 'admin' AND verification_type = 'student' THEN 'student'
          ELSE role
        END,
        verified_at = CASE WHEN ${status} = 'verified' THEN CURRENT_TIMESTAMP ELSE NULL END,
        verification_reviewed_by = ${reviewerId},
        verification_note = ${note.trim() || null}
      WHERE id = ${targetUserId}
        AND verification_status = 'pending'
      RETURNING username, verification_type, verified_name, verified_grade, verified_subject
    `;

    const reviewedUser = rows[0];
    if (reviewedUser) {
        const statusLabel = status === 'verified' ? '通过' : '拒绝';
        const identity = reviewedUser.verified_name || reviewedUser.username;
        const meta = reviewedUser.verification_type === 'teacher'
            ? reviewedUser.verified_subject
            : reviewedUser.verified_grade;

        await createAdminAuditEvent({
            actorId: reviewerId,
            targetUserId,
            targetType: 'verification',
            targetId: targetUserId,
            eventType: `verification_${status}`,
            summary: `${identity} 的认证已${statusLabel}`,
            details: {
                username: reviewedUser.username,
                verification_type: reviewedUser.verification_type,
                identity_meta: meta,
                note: note.trim() || null,
            },
        });
    }
}

export async function updateUserProfile(id: number, updates: { bio?: string; avatar?: string; avatar_emoji?: string; avatar_theme?: string; profile_image?: string; badge_preferences?: string[] }) {
    await ensureUserProfileEnhancements();

    const badgePreferencesJson = Array.isArray(updates.badge_preferences) ? JSON.stringify(updates.badge_preferences) : null;

    // Construct dynamic query carefully or just update all fields?
    // Updating individually is safer with COALESCE but sql template tag needs careful handling for dynamic columns.
    // Easiest verified way: use separate updates or smart COALESCE with all params passed.
    await sql`
    UPDATE users 
    SET 
      bio = COALESCE(${updates.bio ?? null}, bio), 
      avatar = COALESCE(${updates.avatar ?? null}, avatar), 
      avatar_emoji = COALESCE(${updates.avatar_emoji ?? updates.avatar ?? null}, avatar_emoji),
      avatar_theme = COALESCE(${updates.avatar_theme ?? null}, avatar_theme),
      profile_image = COALESCE(${updates.profile_image ?? null}, profile_image),
      badge_preferences = COALESCE(${badgePreferencesJson}::jsonb, badge_preferences)
    WHERE id = ${id}
  `;
}

export async function updateUserAuth(id: number, updates: { username?: string; passwordHash?: string }) {
    if (updates.username) {
        // Check if username already exists
        const { rows } = await sql`SELECT id FROM users WHERE username = ${updates.username} AND id != ${id} LIMIT 1`;
        if (rows[0]) throw new Error('Username already taken');
    }

    await sql`
    UPDATE users 
    SET 
      username = COALESCE(${updates.username ?? null}, username), 
      password_hash = COALESCE(${updates.passwordHash ?? null}, password_hash)
    WHERE id = ${id}
  `;
}

export async function deleteUser(id: number) {
    await ensureUserProfileEnhancements();
    await ensureAdminAuditTable();
    await ensurePointAwardsTable();
    await ensureProjectEnhancements();
    await ensureProjectSubmissionsTable();
    await ensureProjectOpenEventsTable();
    await ensureProjectBookmarksTable();
    await ensureProjectTipsTable();
    await ensureCoinTables();
    await ensureNotificationsTable();

    const client = await db.connect();

    try {
        await client.sql`BEGIN`;

        // Clear self-references and optional admin audit links first.
        await client.sql`UPDATE users SET verification_reviewed_by = NULL WHERE verification_reviewed_by = ${id}`;
        await client.sql`UPDATE users SET disabled_by = NULL WHERE disabled_by = ${id}`;
        await client.sql`UPDATE admin_audit_events SET actor_id = NULL WHERE actor_id = ${id}`;
        await client.sql`UPDATE admin_audit_events SET target_user_id = NULL WHERE target_user_id = ${id}`;
        await client.sql`UPDATE project_submissions SET reviewed_by = NULL WHERE reviewed_by = ${id}`;
        await client.sql`UPDATE coin_transactions SET counterparty_user_id = NULL WHERE counterparty_user_id = ${id}`;
        await client.sql`UPDATE coin_transactions SET created_by = NULL WHERE created_by = ${id}`;
        await client.sql`UPDATE coin_redemption_requests SET reviewed_by = NULL WHERE reviewed_by = ${id}`;

        await client.sql`DELETE FROM notifications WHERE recipient_id = ${id} OR actor_id = ${id}`;

        // Forum cleanup: remove interactions on both the user's content and their own interactions.
        await client.sql`
          DELETE FROM comment_likes
          WHERE user_id = ${id}
             OR comment_id IN (
               SELECT comments.id
               FROM comments
               LEFT JOIN posts ON posts.id = comments.post_id
               WHERE comments.author_id = ${id}
                  OR posts.author_id = ${id}
             )
        `;
        await client.sql`
          DELETE FROM comments
          WHERE author_id = ${id}
             OR post_id IN (SELECT posts.id FROM posts WHERE posts.author_id = ${id})
        `;
        await client.sql`
          DELETE FROM post_likes
          WHERE user_id = ${id}
             OR post_id IN (SELECT posts.id FROM posts WHERE posts.author_id = ${id})
        `;
        await client.sql`
          DELETE FROM bookmarks
          WHERE user_id = ${id}
             OR post_id IN (SELECT posts.id FROM posts WHERE posts.author_id = ${id})
        `;
        await client.sql`DELETE FROM posts WHERE author_id = ${id}`;

        // Hub cleanup: test accounts may have project ratings/comments/submissions/projects.
        await client.sql`
          DELETE FROM project_tips
          WHERE sender_id = ${id}
             OR recipient_id = ${id}
             OR project_id IN (SELECT projects.id FROM projects WHERE projects.author_id = ${id})
        `;
        await client.sql`
          DELETE FROM coin_project_tips
          WHERE sender_id = ${id}
             OR recipient_id = ${id}
             OR project_id IN (SELECT projects.id FROM projects WHERE projects.author_id = ${id})
        `;
        await client.sql`
          DELETE FROM project_bookmarks
          WHERE user_id = ${id}
             OR project_id IN (SELECT projects.id FROM projects WHERE projects.author_id = ${id})
        `;
        await client.sql`
          DELETE FROM project_comments
          WHERE author_id = ${id}
             OR project_id IN (SELECT projects.id FROM projects WHERE projects.author_id = ${id})
        `;
        await client.sql`
          DELETE FROM project_likes
          WHERE user_id = ${id}
             OR project_id IN (SELECT projects.id FROM projects WHERE projects.author_id = ${id})
        `;
        await client.sql`
          DELETE FROM project_opens
          WHERE user_id = ${id}
             OR project_id IN (SELECT projects.id FROM projects WHERE projects.author_id = ${id})
        `;
        await client.sql`DELETE FROM project_submissions WHERE author_id = ${id}`;
        await client.sql`DELETE FROM projects WHERE author_id = ${id}`;

        await client.sql`DELETE FROM coin_transactions WHERE user_id = ${id}`;
        await client.sql`DELETE FROM coin_redemption_requests WHERE user_id = ${id}`;
        await client.sql`DELETE FROM coin_wallets WHERE user_id = ${id}`;
        await client.sql`DELETE FROM point_awards WHERE user_id = ${id}`;
        await client.sql`DELETE FROM checkins WHERE user_id = ${id}`;
        await client.sql`DELETE FROM users WHERE id = ${id}`;

        await client.sql`COMMIT`;
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

export async function isUserSessionActive(userId: number) {
    if (shouldAutoEnsureReadSchema()) {
        await ensureUserProfileEnhancements();
    }

    const { rows } = await sql<{ account_status: string | null }>`
      SELECT COALESCE(account_status, 'active') as account_status
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    return rows[0]?.account_status !== 'disabled';
}

export async function getAdminAuditHistory(
    type: 'all' | 'verification' | 'project' | 'user' | 'coin' = 'all',
    limit = 20,
): Promise<AdminAuditEvent[]> {
    await ensureUserProfileEnhancements();
    await ensureProjectSubmissionsTable();
    await ensureAdminAuditTable();

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 80);

    const { rows } = await sql<AdminAuditEvent>`
      SELECT
        admin_audit_events.*,
        actors.username as actor_name,
        targets.username as target_username
      FROM admin_audit_events
      LEFT JOIN users actors ON actors.id = admin_audit_events.actor_id
      LEFT JOIN users targets ON targets.id = admin_audit_events.target_user_id
      WHERE (
        ${type} = 'all'
        OR (${type} = 'project' AND admin_audit_events.target_type = 'project_submission')
        OR (${type} = 'verification' AND admin_audit_events.target_type = 'verification')
        OR (${type} = 'user' AND admin_audit_events.target_type = 'user')
        OR (${type} = 'coin' AND admin_audit_events.target_type = 'coin')
      )
      ORDER BY admin_audit_events.created_at DESC
      LIMIT ${safeLimit}
    `;

    const auditRows = rows.map(row => ({
        ...row,
        details: normalizeAuditDetails(row.details),
    }));

    if (type === 'user') return auditRows;

    const legacyEvents: AdminAuditEvent[] = [];

    if (type === 'all' || type === 'verification') {
        const { rows: verificationRows } = await sql<{
            id: number;
            username: string;
            verification_status: VerificationStatus;
            verification_type: VerificationType | null;
            verified_name: string | null;
            verified_grade: string | null;
            verified_subject: string | null;
            verification_reviewed_by: number | null;
            verification_reviewer_name: string | null;
            verification_note: string | null;
            reviewed_at: Date | string | null;
        }>`
          SELECT
            users.id,
            users.username,
            users.verification_status,
            users.verification_type,
            users.verified_name,
            users.verified_grade,
            users.verified_subject,
            users.verification_reviewed_by,
            reviewers.username as verification_reviewer_name,
            users.verification_note,
            COALESCE(users.verified_at, users.verification_submitted_at) as reviewed_at
          FROM users
          LEFT JOIN users reviewers ON reviewers.id = users.verification_reviewed_by
          WHERE users.verification_status IN ('verified', 'rejected')
            AND NOT EXISTS (
              SELECT 1
              FROM admin_audit_events existing_events
              WHERE existing_events.target_type = 'verification'
                AND existing_events.target_id = users.id
            )
          ORDER BY reviewed_at DESC NULLS LAST
          LIMIT ${safeLimit}
        `;

        verificationRows.forEach((row, index) => {
            const statusLabel = row.verification_status === 'verified' ? '已通过' : '已拒绝';
            const identity = row.verified_name || row.username;
            legacyEvents.push({
                id: -100000 - index,
                actor_id: row.verification_reviewed_by,
                actor_name: row.verification_reviewer_name,
                target_user_id: row.id,
                target_username: row.username,
                target_type: 'verification',
                target_id: row.id,
                event_type: `legacy_verification_${row.verification_status}`,
                summary: `${identity} 的认证${statusLabel}`,
                details: {
                    legacy: true,
                    verification_type: row.verification_type,
                    identity_meta: row.verification_type === 'teacher' ? row.verified_subject : row.verified_grade,
                    note: row.verification_note,
                },
                created_at: row.reviewed_at || new Date(0).toISOString(),
            });
        });
    }

    if (type === 'all' || type === 'project') {
        const { rows: projectRows } = await sql<{
            id: number;
            author_id: number;
            author_name: string;
            reviewed_by: number | null;
            reviewer_name: string | null;
            status: ProjectSubmissionStatus;
            submission_type: ProjectSubmissionType;
            title: string;
            review_note: string | null;
            reviewed_at: Date | string | null;
        }>`
          SELECT
            project_submissions.id,
            project_submissions.author_id,
            authors.username as author_name,
            project_submissions.reviewed_by,
            reviewers.username as reviewer_name,
            project_submissions.status,
            project_submissions.submission_type,
            project_submissions.title,
            project_submissions.review_note,
            project_submissions.reviewed_at
          FROM project_submissions
          JOIN users authors ON authors.id = project_submissions.author_id
          LEFT JOIN users reviewers ON reviewers.id = project_submissions.reviewed_by
          WHERE project_submissions.status IN ('approved', 'rejected')
            AND NOT EXISTS (
              SELECT 1
              FROM admin_audit_events existing_events
              WHERE existing_events.target_type = 'project_submission'
                AND existing_events.target_id = project_submissions.id
            )
          ORDER BY project_submissions.reviewed_at DESC NULLS LAST
          LIMIT ${safeLimit}
        `;

        projectRows.forEach((row, index) => {
            legacyEvents.push({
                id: -200000 - index,
                actor_id: row.reviewed_by,
                actor_name: row.reviewer_name,
                target_user_id: row.author_id,
                target_username: row.author_name,
                target_type: 'project_submission',
                target_id: row.id,
                event_type: `legacy_project_submission_${row.status}`,
                summary: `${row.title} 项目申请已${row.status === 'approved' ? '通过' : '拒绝'}`,
                details: {
                    legacy: true,
                    submission_type: row.submission_type,
                    note: row.review_note,
                },
                created_at: row.reviewed_at || new Date(0).toISOString(),
            });
        });
    }

    return [...auditRows, ...legacyEvents]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, safeLimit);
}

export async function getAdminUsers(options: {
    query?: string;
    verification?: VerificationStatus | 'all';
    accountStatus?: AccountStatus | 'all';
    limit?: number;
} = {}): Promise<AdminUserSummary[]> {
    await ensureUserProfileEnhancements();

    const query = String(options.query || '').trim().toLowerCase().slice(0, 60);
    const verification = options.verification === 'pending'
        || options.verification === 'verified'
        || options.verification === 'rejected'
        || options.verification === 'unverified'
        ? options.verification
        : 'all';
    const accountStatus = options.accountStatus === 'disabled' || options.accountStatus === 'active'
        ? options.accountStatus
        : 'all';
    const safeLimit = Math.min(Math.max(Number(options.limit) || 80, 1), 120);

    const { rows } = await sql<AdminUserSummary>`
      SELECT
        users.id,
        users.username,
        users.points,
        users.level,
        users.role,
        users.avatar,
        users.avatar_emoji,
        users.avatar_theme,
        users.verification_status,
        users.verification_type,
        COALESCE(users.account_status, 'active') as account_status,
        users.disabled_at,
        users.created_at,
        (SELECT COUNT(*) > 0 FROM projects WHERE projects.author_id = users.id) as is_creator
      FROM users
      WHERE (
        ${query} = ''
        OR lower(users.username) LIKE ${`%${query}%`}
        OR CAST(users.id AS TEXT) = ${query}
        OR lower(COALESCE(users.verified_name, '')) LIKE ${`%${query}%`}
      )
        AND (${verification} = 'all' OR users.verification_status = ${verification})
        AND (${accountStatus} = 'all' OR COALESCE(users.account_status, 'active') = ${accountStatus})
      ORDER BY
        CASE WHEN COALESCE(users.account_status, 'active') = 'disabled' THEN 1 ELSE 0 END,
        users.created_at DESC
      LIMIT ${safeLimit}
    `;

    return rows.map(row => ({
        ...row,
        account_status: normalizeAccountStatus(row.account_status),
    }));
}

export async function getAdminUserDetail(userId: number): Promise<AdminUserDetail | null> {
    await ensureUserProfileEnhancements();
    await ensureAdminAuditTable();

    const { rows } = await sql<Omit<AdminUserDetail, 'recent_audit_events'>>`
      SELECT
        users.id,
        users.username,
        users.points,
        users.level,
        users.role,
        users.bio,
        users.avatar,
        users.avatar_emoji,
        users.avatar_theme,
        users.profile_image,
        users.grade,
        users.age,
        users.ethnicity,
        users.verification_status,
        users.verification_type,
        users.verified_name,
        users.verified_grade,
        users.verified_subject,
        users.student_id_last4,
        users.verification_submitted_at,
        users.verified_at,
        users.verification_reviewed_by,
        reviewers.username as verification_reviewer_name,
        users.verification_note,
        COALESCE(users.account_status, 'active') as account_status,
        users.disabled_at,
        users.disabled_by,
        disablers.username as disabled_by_name,
        users.disabled_reason,
        users.created_at,
        (SELECT COUNT(*) > 0 FROM projects WHERE projects.author_id = users.id) as is_creator
      FROM users
      LEFT JOIN users reviewers ON reviewers.id = users.verification_reviewed_by
      LEFT JOIN users disablers ON disablers.id = users.disabled_by
      WHERE users.id = ${userId}
      LIMIT 1
    `;

    const user = rows[0];
    if (!user) return null;

    const { rows: auditRows } = await sql<AdminAuditEvent>`
      SELECT
        admin_audit_events.*,
        actors.username as actor_name,
        targets.username as target_username
      FROM admin_audit_events
      LEFT JOIN users actors ON actors.id = admin_audit_events.actor_id
      LEFT JOIN users targets ON targets.id = admin_audit_events.target_user_id
      WHERE admin_audit_events.target_user_id = ${userId}
      ORDER BY admin_audit_events.created_at DESC
      LIMIT 12
    `;

    return {
        ...user,
        account_status: normalizeAccountStatus(user.account_status),
        recent_audit_events: auditRows.map(row => ({
            ...row,
            details: normalizeAuditDetails(row.details),
        })),
    };
}

export async function updateAdminUserIdentity(adminId: number, targetUserId: number, input: {
    username?: unknown;
    verification_status?: unknown;
    verification_type?: unknown;
    verified_name?: unknown;
    verified_grade?: unknown;
    verified_subject?: unknown;
    student_id?: unknown;
    verification_note?: unknown;
}) {
    await ensureUserProfileEnhancements();
    await ensureAdminAuditTable();

    const existing = await getAdminUserDetail(targetUserId);
    if (!existing) throw new Error('User not found');

    const username = normalizeUsernameInput(input.username || existing.username);
    if (!validateUsername(username)) throw new Error('Invalid username');

    if (username !== existing.username) {
        const { rows } = await sql<{ id: number }>`
          SELECT id
          FROM users
          WHERE lower(username) = lower(${username})
            AND id != ${targetUserId}
          LIMIT 1
        `;
        if (rows[0]) throw new Error('Username already taken');
    }

    const verificationStatus = input.verification_status === 'pending'
        || input.verification_status === 'verified'
        || input.verification_status === 'rejected'
        || input.verification_status === 'unverified'
        ? input.verification_status
        : existing.verification_status || 'unverified';

    const verificationType = input.verification_type === 'teacher' ? 'teacher' : input.verification_type === 'student' ? 'student' : existing.verification_type || 'student';
    const verifiedName = String(input.verified_name ?? existing.verified_name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) || null;
    const verifiedGradeInput = String(input.verified_grade ?? existing.verified_grade ?? '').trim().toUpperCase();
    const verifiedGrade = verificationType === 'student' && STUDENT_GRADES.includes(verifiedGradeInput as (typeof STUDENT_GRADES)[number])
        ? verifiedGradeInput
        : verificationType === 'student'
            ? 'G10'
            : null;
    const verifiedSubject = verificationType === 'teacher'
        ? String(input.verified_subject ?? existing.verified_subject ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) || null
        : null;
    const note = String(input.verification_note ?? existing.verification_note ?? '').trim().slice(0, 240) || null;
    const rawStudentId = String(input.student_id || '').replace(/[\s-]+/g, '').trim().toUpperCase();

    if (verificationType === 'teacher' && !verifiedSubject) throw new Error('Missing subject');
    if (verificationType === 'student' && !verifiedName) throw new Error('Missing name');
    if (rawStudentId && !/^[A-Z0-9]{4,32}$/.test(rawStudentId)) throw new Error('Invalid student ID');

    const nextStudentHash = rawStudentId ? await hashStudentId(rawStudentId) : null;
    const nextStudentLast4 = rawStudentId ? rawStudentId.slice(-4) : existing.student_id_last4;

    if (nextStudentHash) {
        const { rows } = await sql<{ id: number }>`
          SELECT id
          FROM users
          WHERE student_id_hash = ${nextStudentHash}
            AND id != ${targetUserId}
            AND verification_status = 'verified'
          LIMIT 1
        `;
        if (rows[0]) throw new Error('Student ID already verified');
    }

    await sql`
      UPDATE users
      SET
        username = ${username},
        verification_status = ${verificationStatus},
        verification_type = ${verificationType},
        verified_name = ${verifiedName},
        verified_grade = ${verifiedGrade},
        verified_subject = ${verifiedSubject},
        student_id_hash = CASE WHEN ${Boolean(rawStudentId)} THEN ${nextStudentHash} ELSE student_id_hash END,
        student_id_last4 = ${nextStudentLast4},
        verified_at = CASE
          WHEN ${verificationStatus} = 'verified' THEN COALESCE(verified_at, CURRENT_TIMESTAMP)
          ELSE verified_at
        END,
        verification_reviewed_by = ${adminId},
        verification_note = ${note}
      WHERE id = ${targetUserId}
    `;

    await createAdminAuditEvent({
        actorId: adminId,
        targetUserId,
        targetType: 'user',
        targetId: targetUserId,
        eventType: 'user_identity_updated',
        summary: `${username} 的认证资料已维护`,
        details: {
            previous_username: existing.username,
            verification_status: verificationStatus,
            verification_type: verificationType,
            student_id_updated: Boolean(rawStudentId),
            note,
        },
    });
}

export async function setAdminUserAccountStatus(adminId: number, targetUserId: number, status: AccountStatus, reason = '') {
    await ensureUserProfileEnhancements();
    await ensureAdminAuditTable();

    if (adminId === targetUserId && status === 'disabled') {
        throw new Error('Cannot disable yourself');
    }

    const target = await getAdminUserDetail(targetUserId);
    if (!target) throw new Error('User not found');

    if (target.role === 'admin' && status === 'disabled') {
        const { rows } = await sql<{ count: number }>`
          SELECT COUNT(*)::int as count
          FROM users
          WHERE role = 'admin'
            AND id != ${targetUserId}
            AND COALESCE(account_status, 'active') = 'active'
        `;
        if ((rows[0]?.count ?? 0) <= 0) {
            throw new Error('Cannot disable last admin');
        }
    }

    const cleanReason = reason.trim().slice(0, 240) || (status === 'disabled' ? '管理员停用账号' : '管理员恢复账号');

    await sql`
      UPDATE users
      SET
        account_status = ${status},
        disabled_at = CASE WHEN ${status} = 'disabled' THEN CURRENT_TIMESTAMP ELSE NULL END,
        disabled_by = CASE WHEN ${status} = 'disabled' THEN ${adminId} ELSE NULL END,
        disabled_reason = CASE WHEN ${status} = 'disabled' THEN ${cleanReason} ELSE NULL END
      WHERE id = ${targetUserId}
    `;

    await createAdminAuditEvent({
        actorId: adminId,
        targetUserId,
        targetType: 'user',
        targetId: targetUserId,
        eventType: status === 'disabled' ? 'user_disabled' : 'user_enabled',
        summary: `${target.username} 已${status === 'disabled' ? '停用' : '恢复'}`,
        details: {
            reason: cleanReason,
            previous_status: target.account_status,
        },
    });
}

export async function addPoints(userId: number, amount: number) {
    // New Quadratic Leveling: Level = floor(sqrt(points / 50)) + 1
    // L1: 0, L2: 50, L3: 200, L4: 450, L5: 800, L10: 4050
    await sql`
    UPDATE users
    SET
      points = CASE
        WHEN role = 'admin' THEN LEAST(${ADMIN_VISIBLE_XP_CAP}, LEAST(points, ${ADMIN_VISIBLE_XP_CAP}) + ${amount})
        ELSE points + ${amount}
      END,
      level = GREATEST(
        level,
        FLOOR(SQRT((
          CASE
            WHEN role = 'admin' THEN LEAST(${ADMIN_VISIBLE_XP_CAP}, LEAST(points, ${ADMIN_VISIBLE_XP_CAP}) + ${amount})
            ELSE points + ${amount}
          END
        ) / 50.0))::int + 1
      )
    WHERE id = ${userId}
  `;
}

let pointAwardsTableReady: Promise<void> | null = null;

async function ensurePointAwardsTable() {
    if (!pointAwardsTableReady) {
        pointAwardsTableReady = sql`
          CREATE TABLE IF NOT EXISTS point_awards (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            award_key TEXT NOT NULL,
            amount INTEGER NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, award_key)
          );
        `.then(() => undefined).catch(error => {
            pointAwardsTableReady = null;
            throw error;
        });
    }

    return pointAwardsTableReady;
}

async function addAwardPointsOnce(userId: number, awardKey: string, amount: number) {
    await ensurePointAwardsTable();

    const { rows } = await sql<{ id: number }>`
      INSERT INTO point_awards (user_id, award_key, amount)
      VALUES (${userId}, ${awardKey}, ${amount})
      ON CONFLICT (user_id, award_key) DO NOTHING
      RETURNING id
    `;

    if (rows[0]) {
        await addPoints(userId, amount);
        return true;
    }

    return false;
}

// --- Check-in Helpers ---

export async function hasCheckedInToday(userId: number) {
    // Postgres date comparison
    const { rows } = await sql`
    SELECT id FROM checkins 
    WHERE user_id = ${userId} 
    AND checkin_date = CURRENT_DATE
  `;
    return !!rows[0];
}

export async function doCheckIn(userId: number) {
    try {
        // Get current streak and last checkin
        const { rows: userRows } = await sql`SELECT streak_count, last_checkin_at FROM users WHERE id = ${userId}`;
        const user = userRows[0];
        
        let newStreak = 1;
        if (user && user.last_checkin_at) {
            const lastCheckin = new Date(user.last_checkin_at);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            // Check if last checkin was yesterday (ignoring time)
            const isYesterday = lastCheckin.toDateString() === yesterday.toDateString();
            if (isYesterday) {
                newStreak = (user.streak_count || 0) + 1;
            }
        }

        await sql`
          INSERT INTO checkins (user_id, checkin_date) 
          VALUES (${userId}, CURRENT_DATE)
        `;
        
        // Update user streak and points
        // Rewards: 1-2 days: 10XP, 3-6 days: 15XP, 7+ days: 25XP
        let bonusXp = 10;
        if (newStreak >= 7) bonusXp = 25;
        else if (newStreak >= 3) bonusXp = 15;

        await sql`
          UPDATE users 
          SET streak_count = ${newStreak}, last_checkin_at = CURRENT_TIMESTAMP
          WHERE id = ${userId}
        `;
        
        await addPoints(userId, bonusXp);
        return { success: true, pointsAdded: bonusXp, streak: newStreak };
    } catch (error) {
        console.error("Checkin Error:", error);
        return { success: false };
    }
}

// --- Forum Helpers ---

let forumEnhancementsReady: Promise<void> | null = null;
let bookmarksTableReady: Promise<void> | null = null;
let articlesTableReady: Promise<void> | null = null;

async function ensureForumEnhancements() {
    if (!forumEnhancementsReady) {
        forumEnhancementsReady = (async () => {
            await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE`;
            await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS attachment_urls JSONB DEFAULT '[]'::jsonb`;
            await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_format TEXT DEFAULT 'plain'`;
            await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS article_id INTEGER`;
            await sql`UPDATE posts SET content_format = 'plain' WHERE content_format IS NULL OR content_format NOT IN ('plain', 'markdown')`;
            await sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL`;
            await sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS attachment_url TEXT`;
            await sql`ALTER TABLE IF EXISTS post_likes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
            await sql`CREATE INDEX IF NOT EXISTS idx_posts_tag_created ON posts(tag, created_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_posts_likes_created ON posts(likes DESC, created_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at ASC, id ASC)`;
            await ensureBookmarksTable();
        })().catch(error => {
            forumEnhancementsReady = null;
            throw error;
        });
    }

    return forumEnhancementsReady;
}

async function ensureArticlesTable() {
    if (!articlesTableReady) {
        articlesTableReady = (async () => {
            await sql`
              CREATE TABLE IF NOT EXISTS articles (
                id SERIAL PRIMARY KEY,
                author_id INTEGER NOT NULL REFERENCES users(id),
                title TEXT NOT NULL,
                excerpt TEXT,
                content TEXT NOT NULL,
                tag TEXT DEFAULT 'general',
                forum_post_id INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE
              );
            `;
            await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS excerpt TEXT`;
            await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT 'general'`;
            await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS forum_post_id INTEGER`;
            await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE`;
            await ensureForumEnhancements();
        })().catch(error => {
            articlesTableReady = null;
            throw error;
        });
    }

    return articlesTableReady;
}

async function ensureBookmarksTable() {
    if (!bookmarksTableReady) {
        bookmarksTableReady = (async () => {
            await sql`
              CREATE TABLE IF NOT EXISTS bookmarks (
                user_id INTEGER NOT NULL REFERENCES users(id),
                post_id INTEGER NOT NULL REFERENCES posts(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, post_id)
              );
            `;
            await sql`ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
        })().catch(error => {
            bookmarksTableReady = null;
            throw error;
        });
    }

    return bookmarksTableReady;
}

export async function getPosts(sort: 'time' | 'heat' | 'likes' = 'time', userId?: number, filter: 'all' | 'saved' = 'all', tag?: string) {
    if (shouldAutoEnsureReadSchema()) {
        await ensureUserProfileEnhancements();
        await ensureForumEnhancements();
    }

    const { rows } = await sql`
      SELECT posts.id, posts.author_id, posts.article_id, posts.title, posts.content, COALESCE(posts.content_format, 'plain') as content_format, posts.type, posts.tag, posts.attachment_url,
      CASE
        WHEN jsonb_array_length(COALESCE(posts.attachment_urls, '[]'::jsonb)) > 0 THEN posts.attachment_urls
        WHEN posts.attachment_url IS NOT NULL AND posts.attachment_url != '' THEN jsonb_build_array(posts.attachment_url)
        ELSE '[]'::jsonb
      END as attachment_urls,
      posts.likes, posts.created_at, posts.updated_at,
      users.username as author_name,
      CASE WHEN users.avatar LIKE 'data:image/%' THEN NULL ELSE users.avatar END as author_avatar,
      users.avatar_emoji as author_avatar_emoji,
      users.role as author_role,
      users.avatar_theme as author_avatar_theme,
      users.badge_preferences as author_badge_preferences,
      users.verification_status as author_verification_status,
      (SELECT COUNT(*) > 0 FROM projects WHERE author_id = users.id) as author_is_creator,
      (SELECT COUNT(*)::int FROM comments WHERE post_id = posts.id) as comment_count,
      featured.featured_comment,
      CASE WHEN ${userId ?? null}::int IS NOT NULL THEN 
        EXISTS(SELECT 1 FROM bookmarks WHERE user_id = ${userId ?? null}::int AND post_id = posts.id)
      ELSE false END as is_bookmarked,
      CASE WHEN ${userId ?? null}::int IS NOT NULL THEN 
        EXISTS(SELECT 1 FROM post_likes WHERE user_id = ${userId ?? null}::int AND post_id = posts.id)
      ELSE false END as has_liked
      FROM posts 
      JOIN users ON posts.author_id = users.id 
      LEFT JOIN LATERAL (
        SELECT json_build_object(
          'id', featured_comments.id,
          'author_id', featured_comments.author_id,
          'content', featured_comments.content,
          'attachment_url', featured_comments.attachment_url,
          'likes', featured_comments.likes,
          'created_at', featured_comments.created_at,
          'reply_author_name', parent_users.username,
          'reply_content', parent_comments.content,
          'author_name', comment_authors.username,
          'author_avatar', CASE WHEN comment_authors.avatar LIKE 'data:image/%' THEN NULL ELSE comment_authors.avatar END,
          'author_avatar_emoji', comment_authors.avatar_emoji,
          'author_avatar_theme', comment_authors.avatar_theme,
          'author_role', comment_authors.role,
          'author_is_creator', (SELECT COUNT(*) > 0 FROM projects WHERE author_id = comment_authors.id),
          'author_badge_preferences', comment_authors.badge_preferences,
          'author_verification_status', comment_authors.verification_status,
          'has_liked', CASE WHEN ${userId ?? null}::int IS NOT NULL THEN
            EXISTS(SELECT 1 FROM comment_likes WHERE user_id = ${userId ?? null}::int AND comment_id = featured_comments.id)
          ELSE false END
        ) as featured_comment
        FROM comments featured_comments
        JOIN users comment_authors ON featured_comments.author_id = comment_authors.id
        LEFT JOIN comments parent_comments ON featured_comments.parent_comment_id = parent_comments.id
        LEFT JOIN users parent_users ON parent_comments.author_id = parent_users.id
        WHERE featured_comments.post_id = posts.id
        ORDER BY
          featured_comments.likes DESC,
          (SELECT COUNT(*) FROM comments replies WHERE replies.parent_comment_id = featured_comments.id) DESC,
          featured_comments.created_at DESC
        LIMIT 1
      ) featured ON true
      WHERE 
        (${filter} != 'saved' OR EXISTS(SELECT 1 FROM bookmarks WHERE user_id = ${userId ?? null}::int AND post_id = posts.id))
        AND (${tag ?? 'all'} = 'all' OR posts.tag = ${tag ?? ''})
      ORDER BY 
        CASE WHEN ${tag ?? 'all'} = 'all' AND posts.tag = 'announcement' THEN 0 ELSE 1 END ASC,
        CASE WHEN ${sort} = 'likes' THEN posts.likes END DESC,
        CASE WHEN ${sort} = 'heat' THEN (
          (
            posts.likes * 2
            + (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) * 3
            + (SELECT COUNT(*) FROM bookmarks WHERE post_id = posts.id) * 2
          ) / POWER(GREATEST(EXTRACT(EPOCH FROM (NOW() - posts.created_at)) / 3600 + 2, 2), 0.35)
        ) END DESC,
        posts.created_at DESC
      LIMIT 50
  `;

    return rows as Post[];
}

export async function getPostsPage(
    sort: 'time' | 'heat' | 'likes' = 'time',
    userId?: number,
    filter: 'all' | 'saved' = 'all',
    tag?: string,
    options: { limit?: number; offset?: number } = {},
): Promise<PostPage> {
    if (shouldAutoEnsureReadSchema()) {
        await ensureUserProfileEnhancements();
        await ensureForumEnhancements();
    }

    const safeLimit = Math.min(Math.max(Math.floor(Number(options.limit) || 15), 1), 30);
    const safeOffset = Math.max(Math.floor(Number(options.offset) || 0), 0);
    const { rows } = await sql<Post>`
      SELECT posts.id, posts.author_id, posts.article_id, posts.title, posts.content, COALESCE(posts.content_format, 'plain') as content_format, posts.type, posts.tag, posts.attachment_url,
      CASE
        WHEN jsonb_array_length(COALESCE(posts.attachment_urls, '[]'::jsonb)) > 0 THEN posts.attachment_urls
        WHEN posts.attachment_url IS NOT NULL AND posts.attachment_url != '' THEN jsonb_build_array(posts.attachment_url)
        ELSE '[]'::jsonb
      END as attachment_urls,
      posts.likes, posts.created_at, posts.updated_at,
      users.username as author_name,
      CASE WHEN users.avatar LIKE 'data:image/%' THEN NULL ELSE users.avatar END as author_avatar,
      users.avatar_emoji as author_avatar_emoji,
      users.role as author_role,
      users.avatar_theme as author_avatar_theme,
      users.badge_preferences as author_badge_preferences,
      users.verification_status as author_verification_status,
      (SELECT COUNT(*) > 0 FROM projects WHERE author_id = users.id) as author_is_creator,
      (SELECT COUNT(*)::int FROM comments WHERE post_id = posts.id) as comment_count,
      NULL::json as featured_comment,
      CASE WHEN ${userId ?? null}::int IS NOT NULL THEN
        EXISTS(SELECT 1 FROM bookmarks WHERE user_id = ${userId ?? null}::int AND post_id = posts.id)
      ELSE false END as is_bookmarked,
      CASE WHEN ${userId ?? null}::int IS NOT NULL THEN
        EXISTS(SELECT 1 FROM post_likes WHERE user_id = ${userId ?? null}::int AND post_id = posts.id)
      ELSE false END as has_liked
      FROM posts
      JOIN users ON posts.author_id = users.id
      WHERE
        (${filter} != 'saved' OR EXISTS(SELECT 1 FROM bookmarks WHERE user_id = ${userId ?? null}::int AND post_id = posts.id))
        AND (${tag ?? 'all'} = 'all' OR posts.tag = ${tag ?? ''})
      ORDER BY
        CASE WHEN ${tag ?? 'all'} = 'all' AND posts.tag = 'announcement' THEN 0 ELSE 1 END ASC,
        CASE WHEN ${sort} = 'likes' THEN posts.likes END DESC,
        CASE WHEN ${sort} = 'heat' THEN (
          (
            posts.likes * 2
            + (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) * 3
            + (SELECT COUNT(*) FROM bookmarks WHERE post_id = posts.id) * 2
          ) / POWER(GREATEST(EXTRACT(EPOCH FROM (NOW() - posts.created_at)) / 3600 + 2, 2), 0.35)
        ) END DESC,
        posts.created_at DESC
      LIMIT ${safeLimit + 1}
      OFFSET ${safeOffset}
    `;

    const posts = rows.slice(0, safeLimit) as Post[];
    return {
        posts,
        hasMore: rows.length > safeLimit,
        nextOffset: safeOffset + posts.length,
    };
}

export async function getRecentPostHighlights(limit = 2) {
    if (shouldAutoEnsureReadSchema()) {
        await ensureUserProfileEnhancements();
        await ensureForumEnhancements();
    }

    const { rows } = await sql<Post>`
      SELECT
        posts.id,
        posts.author_id,
        posts.title,
        posts.type,
        posts.tag,
        posts.likes,
        posts.created_at,
        users.username as author_name,
        users.role as author_role,
        users.verification_status as author_verification_status,
        (SELECT COUNT(*)::int FROM comments WHERE post_id = posts.id) as comment_count
      FROM posts
      JOIN users ON posts.author_id = users.id
      ORDER BY
        CASE WHEN posts.tag = 'announcement' THEN 0 ELSE 1 END ASC,
        posts.created_at DESC
      LIMIT ${limit}
    `;

    return rows;
}

export async function getPostsByAuthor(authorId: number, viewerId?: number, limit = 12) {
    if (shouldAutoEnsureReadSchema()) {
        await ensureUserProfileEnhancements();
    }
    await ensureForumEnhancements();

    const { rows } = await sql`
      SELECT posts.id, posts.author_id, posts.article_id, posts.title, posts.content, COALESCE(posts.content_format, 'plain') as content_format, posts.type, posts.tag, posts.attachment_url,
      CASE
        WHEN jsonb_array_length(COALESCE(posts.attachment_urls, '[]'::jsonb)) > 0 THEN posts.attachment_urls
        WHEN posts.attachment_url IS NOT NULL AND posts.attachment_url != '' THEN jsonb_build_array(posts.attachment_url)
        ELSE '[]'::jsonb
      END as attachment_urls,
      posts.likes, posts.created_at, posts.updated_at,
      users.username as author_name,
      CASE WHEN users.avatar LIKE 'data:image/%' THEN NULL ELSE users.avatar END as author_avatar,
      users.avatar_emoji as author_avatar_emoji,
      users.role as author_role,
      users.avatar_theme as author_avatar_theme,
      users.badge_preferences as author_badge_preferences,
      users.verification_status as author_verification_status,
      (SELECT COUNT(*) > 0 FROM projects WHERE author_id = users.id) as author_is_creator,
      (SELECT COUNT(*)::int FROM comments WHERE post_id = posts.id) as comment_count,
      CASE WHEN ${viewerId ?? null}::int IS NOT NULL THEN
        EXISTS(SELECT 1 FROM bookmarks WHERE user_id = ${viewerId ?? null}::int AND post_id = posts.id)
      ELSE false END as is_bookmarked,
      CASE WHEN ${viewerId ?? null}::int IS NOT NULL THEN
        EXISTS(SELECT 1 FROM post_likes WHERE user_id = ${viewerId ?? null}::int AND post_id = posts.id)
      ELSE false END as has_liked
      FROM posts
      JOIN users ON posts.author_id = users.id
      WHERE posts.author_id = ${authorId}
      ORDER BY posts.created_at DESC
      LIMIT ${limit}
    `;

    return rows as Post[];
}

export async function getComments(postId: number, userId?: number) {
    if (shouldAutoEnsureReadSchema()) {
        await ensureUserProfileEnhancements();
    }
    await ensureForumEnhancements();

    const { rows } = await sql`
      SELECT comments.*, users.username as author_name,
      CASE WHEN users.avatar LIKE 'data:image/%' THEN NULL ELSE users.avatar END as author_avatar,
      users.avatar_emoji as author_avatar_emoji,
      users.role as author_role,
      users.avatar_theme as author_avatar_theme,
      users.badge_preferences as author_badge_preferences,
      users.verification_status as author_verification_status,
      parent_users.username as reply_author_name,
      parent_comments.content as reply_content,
      (SELECT COUNT(*) > 0 FROM projects WHERE author_id = users.id) as author_is_creator,
      CASE WHEN ${userId ?? null}::int IS NOT NULL THEN
        EXISTS(SELECT 1 FROM comment_likes WHERE user_id = ${userId ?? null}::int AND comment_id = comments.id)
      ELSE false END as has_liked
      FROM comments
      JOIN users ON comments.author_id = users.id
      LEFT JOIN comments parent_comments ON comments.parent_comment_id = parent_comments.id
      LEFT JOIN users parent_users ON parent_comments.author_id = parent_users.id
      WHERE comments.post_id = ${postId}
      ORDER BY
        comments.created_at ASC,
        comments.id ASC
  `;
    return rows as Comment[];
}

export async function createPost(authorId: number, title: string, content: string, type: string = 'text', attachmentUrl: string = '', tag: string = 'general', contentFormat: PostContentFormat = 'plain') {
    await ensureForumEnhancements();
    const attachmentUrls = attachmentUrl ? [attachmentUrl] : [];
    const normalizedContentFormat = normalizePostContentFormat(contentFormat);
    const { rows } = await sql`
    INSERT INTO posts (author_id, title, content, content_format, type, attachment_url, attachment_urls, tag)
    VALUES (${authorId}, ${title}, ${content}, ${normalizedContentFormat}, ${type}, ${attachmentUrl}, ${JSON.stringify(attachmentUrls)}::jsonb, ${tag})
    RETURNING id
  `;
    const { rows: postCountRows } = await sql<{ post_count: number }>`
      SELECT COUNT(*)::int as post_count
      FROM posts
      WHERE author_id = ${authorId}
    `;
    const isFirstPost = (postCountRows[0]?.post_count ?? 0) === 1;

    if (isFirstPost) {
        await addAwardPointsOnce(authorId, 'first_post_bonus', 100);
    } else {
        await addPoints(authorId, 10);
    }

    return rows[0]?.id;
}

export async function createPostWithAttachments(authorId: number, title: string, content: string, type: string = 'text', attachmentUrls: string[] = [], tag: string = 'general', contentFormat: PostContentFormat = 'plain') {
    await ensureForumEnhancements();
    const cleanAttachmentUrls = attachmentUrls.map(url => String(url || '').trim()).filter(Boolean);
    const firstAttachmentUrl = cleanAttachmentUrls[0] || '';
    const normalizedContentFormat = normalizePostContentFormat(contentFormat);
    const { rows } = await sql`
    INSERT INTO posts (author_id, title, content, content_format, type, attachment_url, attachment_urls, tag)
    VALUES (${authorId}, ${title}, ${content}, ${normalizedContentFormat}, ${type}, ${firstAttachmentUrl}, ${JSON.stringify(cleanAttachmentUrls)}::jsonb, ${tag})
    RETURNING id
  `;
    const { rows: postCountRows } = await sql<{ post_count: number }>`
      SELECT COUNT(*)::int as post_count
      FROM posts
      WHERE author_id = ${authorId}
    `;
    const isFirstPost = (postCountRows[0]?.post_count ?? 0) === 1;

    if (isFirstPost) {
        await addAwardPointsOnce(authorId, 'first_post_bonus', 100);
    } else {
        await addPoints(authorId, 10);
    }

    return rows[0]?.id;
}

function createArticleExcerpt(content: string, fallback = '') {
    const compact = String(content || fallback || '').replace(/\s+/g, ' ').trim();
    return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact;
}

export async function getArticlesByAuthor(authorId: number, limit = 12) {
    if (shouldAutoEnsureReadSchema()) {
        await ensureUserProfileEnhancements();
    }
    await ensureArticlesTable();

    const { rows } = await sql<Article>`
      SELECT
        articles.id,
        articles.author_id,
        articles.title,
        articles.excerpt,
        articles.content,
        articles.tag,
        articles.forum_post_id,
        articles.created_at,
        articles.updated_at,
        users.username as author_name,
        CASE WHEN users.avatar LIKE 'data:image/%' THEN NULL ELSE users.avatar END as author_avatar,
        users.avatar_emoji as author_avatar_emoji,
        users.avatar_theme as author_avatar_theme,
        users.role as author_role,
        users.badge_preferences as author_badge_preferences,
        users.verification_status as author_verification_status
      FROM articles
      JOIN users ON articles.author_id = users.id
      WHERE articles.author_id = ${authorId}
      ORDER BY articles.created_at DESC
      LIMIT ${limit}
    `;

    return rows;
}

export async function getArticleById(articleId: number) {
    if (shouldAutoEnsureReadSchema()) {
        await ensureUserProfileEnhancements();
    }
    await ensureArticlesTable();

    const { rows } = await sql<Article>`
      SELECT
        articles.id,
        articles.author_id,
        articles.title,
        articles.excerpt,
        articles.content,
        articles.tag,
        articles.forum_post_id,
        articles.created_at,
        articles.updated_at,
        users.username as author_name,
        CASE WHEN users.avatar LIKE 'data:image/%' THEN NULL ELSE users.avatar END as author_avatar,
        users.avatar_emoji as author_avatar_emoji,
        users.avatar_theme as author_avatar_theme,
        users.role as author_role,
        users.badge_preferences as author_badge_preferences,
        users.verification_status as author_verification_status
      FROM articles
      JOIN users ON articles.author_id = users.id
      WHERE articles.id = ${articleId}
      LIMIT 1
    `;

    return rows[0] || null;
}

export async function createArticle(authorId: number, title: string, content: string, tag = 'general', shareToForum = false) {
    await ensureArticlesTable();
    const excerpt = createArticleExcerpt(content, title);
    const { rows } = await sql<{ id: number }>`
      INSERT INTO articles (author_id, title, excerpt, content, tag)
      VALUES (${authorId}, ${title}, ${excerpt}, ${content}, ${tag})
      RETURNING id
    `;
    const articleId = rows[0]?.id;

    if (!articleId) return null;

    let forumPostId: number | null = null;
    if (shareToForum) {
        const forumContent = `${excerpt}\n\n${'\u9605\u8bfb\u5168\u6587'}\uff1a/articles/${articleId}`;
        const { rows: postRows } = await sql<{ id: number }>`
          INSERT INTO posts (author_id, article_id, title, content, content_format, type, tag, attachment_url, attachment_urls)
          VALUES (${authorId}, ${articleId}, ${title}, ${forumContent}, 'plain', 'article', ${tag}, '', '[]'::jsonb)
          RETURNING id
        `;
        forumPostId = postRows[0]?.id ?? null;

        if (forumPostId) {
            await sql`
              UPDATE articles
              SET forum_post_id = ${forumPostId}, updated_at = CURRENT_TIMESTAMP
              WHERE id = ${articleId}
            `;
        }
    }

    await addPoints(authorId, 10);

    return { articleId, forumPostId };
}

export async function updatePost(userId: number, postId: number, title: string, content: string, tag: string, contentFormat: PostContentFormat = 'plain', canModerate = false): Promise<boolean> {
    await ensureForumEnhancements();
    const normalizedContentFormat = normalizePostContentFormat(contentFormat);

    const { rows } = await sql<{ author_id: number }>`
      SELECT author_id
      FROM posts
      WHERE id = ${postId}
      LIMIT 1
    `;

    if (!rows[0] || (!canModerate && rows[0].author_id !== userId)) return false;

    await sql`
      UPDATE posts
      SET title = ${title}, content = ${content}, content_format = ${normalizedContentFormat}, tag = ${tag}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${postId}
    `;

    return true;
}

export async function countRecentAttachmentsByUser(userId: number) {
    await ensureForumEnhancements();

    const { rows } = await sql<{ upload_count: number }>`
      SELECT COALESCE(SUM(upload_count), 0)::int as upload_count
      FROM (
        SELECT
          CASE
            WHEN jsonb_array_length(COALESCE(attachment_urls, '[]'::jsonb)) > 0 THEN jsonb_array_length(COALESCE(attachment_urls, '[]'::jsonb))
            WHEN attachment_url IS NOT NULL AND attachment_url != '' THEN 1
            ELSE 0
          END as upload_count
        FROM posts
        WHERE author_id = ${userId}
          AND created_at >= NOW() - INTERVAL '24 hours'
        UNION ALL
        SELECT
          CASE WHEN attachment_url IS NOT NULL AND attachment_url != '' THEN 1 ELSE 0 END as upload_count
        FROM comments
        WHERE author_id = ${userId}
          AND created_at >= NOW() - INTERVAL '24 hours'
      ) attachment_counts
  `;

    return rows[0]?.upload_count ?? 0;
}

export async function countAttachmentsByUser(userId: number) {
    await ensureForumEnhancements();

    const { rows } = await sql<{ upload_count: number }>`
      SELECT COALESCE(SUM(upload_count), 0)::int as upload_count
      FROM (
        SELECT
          CASE
            WHEN jsonb_array_length(COALESCE(attachment_urls, '[]'::jsonb)) > 0 THEN jsonb_array_length(COALESCE(attachment_urls, '[]'::jsonb))
            WHEN attachment_url IS NOT NULL AND attachment_url != '' THEN 1
            ELSE 0
          END as upload_count
        FROM posts
        WHERE author_id = ${userId}
        UNION ALL
        SELECT
          CASE WHEN attachment_url IS NOT NULL AND attachment_url != '' THEN 1 ELSE 0 END as upload_count
        FROM comments
        WHERE author_id = ${userId}
      ) attachment_counts
  `;

    return rows[0]?.upload_count ?? 0;
}

export async function createComment(authorId: number, postId: number, content: string, parentCommentId?: number | null, attachmentUrl = '') {
    await ensureForumEnhancements();

    let replyToId: number | null = null;
    if (parentCommentId) {
        const { rows } = await sql<{ id: number }>`
          SELECT id
          FROM comments
          WHERE id = ${parentCommentId} AND post_id = ${postId}
          LIMIT 1
        `;
        replyToId = rows[0]?.id ?? null;
    }

    const { rows } = await sql<{ id: number }>`
    INSERT INTO comments (author_id, post_id, content, parent_comment_id, attachment_url)
    VALUES (${authorId}, ${postId}, ${content}, ${replyToId}, ${attachmentUrl || ''})
    RETURNING id
  `;
    await addPoints(authorId, 5);
    return rows[0]?.id;
}

export async function togglePostLike(userId: number, postId: number): Promise<boolean> {
    // Transaction implicit or check-then-act?
    // Upsert is tricky for toggle.
    const { rows } = await sql`SELECT 1 FROM post_likes WHERE user_id = ${userId} AND post_id = ${postId} LIMIT 1`;
    const exists = !!rows[0];

    if (exists) {
        await sql`DELETE FROM post_likes WHERE user_id = ${userId} AND post_id = ${postId}`;
        await sql`UPDATE posts SET likes = likes - 1 WHERE id = ${postId}`;
        return false;
    } else {
        await sql`INSERT INTO post_likes (user_id, post_id) VALUES (${userId}, ${postId})`;
        await sql`UPDATE posts SET likes = likes + 1 WHERE id = ${postId}`;

        // XP to author
        const { rows: postRows } = await sql`SELECT author_id FROM posts WHERE id = ${postId}`;
        if (postRows[0] && postRows[0].author_id !== userId) {
            await addPoints(postRows[0].author_id, 1);
        }

        // XP to liker (Daily limit: 5)
        const { rows: userRows } = await sql`SELECT daily_likes_count, last_like_at FROM users WHERE id = ${userId}`;
        const user = userRows[0];
        const now = new Date();
        const lastLikeDate = user?.last_like_at ? new Date(user.last_like_at).toDateString() : '';
        const isToday = lastLikeDate === now.toDateString();

        const dailyCount = isToday ? (user?.daily_likes_count || 0) : 0;
        if (dailyCount < 5) {
            await addPoints(userId, 1);
            await sql`UPDATE users SET daily_likes_count = ${dailyCount + 1}, last_like_at = CURRENT_TIMESTAMP WHERE id = ${userId}`;
        }

        return true;
    }
}

export async function toggleCommentLike(userId: number, commentId: number): Promise<boolean> {
    const { rows } = await sql`SELECT 1 FROM comment_likes WHERE user_id = ${userId} AND comment_id = ${commentId} LIMIT 1`;
    const exists = !!rows[0];

    if (exists) {
        await sql`DELETE FROM comment_likes WHERE user_id = ${userId} AND comment_id = ${commentId}`;
        await sql`UPDATE comments SET likes = likes - 1 WHERE id = ${commentId}`;
        return false;
    } else {
        await sql`INSERT INTO comment_likes (user_id, comment_id) VALUES (${userId}, ${commentId})`;
        await sql`UPDATE comments SET likes = likes + 1 WHERE id = ${commentId}`;
        return true;
    }
}

export async function toggleBookmark(userId: number, postId: number) {
    const { rows } = await sql`SELECT 1 FROM bookmarks WHERE user_id = ${userId} AND post_id = ${postId} LIMIT 1`;
    const exists = !!rows[0];

    if (exists) {
        await sql`DELETE FROM bookmarks WHERE user_id = ${userId} AND post_id = ${postId}`;
        return false;
    } else {
        await sql`INSERT INTO bookmarks (user_id, post_id) VALUES (${userId}, ${postId})`;
        
        // XP to author for bookmark (Saved) - more valuable than like
        const { rows: postRows } = await sql`SELECT author_id FROM posts WHERE id = ${postId}`;
        if (postRows[0] && postRows[0].author_id !== userId) {
            await addPoints(postRows[0].author_id, 3);
        }
        
        return true;
    }
}

export async function getLeaderboard(limit = 10, window: LeaderboardWindow = 'all', category: LeaderboardCategory = 'all'): Promise<User[]> {
    await ensureProjectTipsTable();

    if (shouldAutoEnsureReadSchema()) {
        await ensureUserProfileEnhancements();
        await ensureForumEnhancements();
        await ensureProjectEnhancements();
        await ensurePointAwardsTable();
    }

    if (window === 'all' && category === 'all') {
        const { rows } = await sql<User>`
          SELECT
            id,
            username,
            CASE WHEN avatar LIKE 'data:image/%' THEN NULL ELSE avatar END as avatar,
            avatar_emoji,
            avatar_theme,
            CASE WHEN role = 'admin' THEN LEAST(points, ${ADMIN_VISIBLE_XP_CAP}) ELSE points END as points,
            GREATEST(1, users.level) as level,
            role,
            badge_preferences,
            verification_status,
            (SELECT COUNT(*) > 0 FROM projects WHERE author_id = users.id) as is_creator
          FROM users
          WHERE verification_status = 'verified'
          ORDER BY
            CASE WHEN role = 'admin' THEN LEAST(points, ${ADMIN_VISIBLE_XP_CAP}) ELSE points END DESC,
            points DESC
          LIMIT ${limit}
        `;
        return rows;
    }

    const sinceInterval = window === 'month' ? '30 days' : window === 'week' ? '7 days' : window === 'day' ? '1 day' : '36500 days';
    const { rows } = await sql<User>`
      WITH first_posts AS (
        SELECT
          posts.id,
          posts.author_id,
          posts.created_at,
          ROW_NUMBER() OVER (PARTITION BY posts.author_id ORDER BY posts.created_at ASC, posts.id ASC) as post_rank
        FROM posts
      ),
      legacy_project_firsts AS (
        SELECT
          projects.id,
          projects.author_id,
          projects.created_at,
          ROW_NUMBER() OVER (PARTITION BY projects.author_id ORDER BY projects.created_at ASC, projects.id ASC) as project_rank
        FROM projects
      ),
      award_events AS (
        SELECT
          point_awards.user_id,
          point_awards.amount as points,
          CASE
            WHEN point_awards.award_key LIKE 'hub_%' THEN 'project'
            ELSE 'community'
          END as category,
          point_awards.created_at
        FROM point_awards
        WHERE point_awards.award_key IN ('first_post_bonus', 'hub_project_bonus')
           OR point_awards.award_key LIKE 'hub_version_bonus:%'
      ),
      post_events AS (
        SELECT
          first_posts.author_id as user_id,
          CASE WHEN first_posts.post_rank = 1 THEN 100 ELSE 10 END as points,
          'community' as category,
          first_posts.created_at
        FROM first_posts
        WHERE NOT (
          first_posts.post_rank = 1
          AND EXISTS (
            SELECT 1 FROM point_awards
            WHERE point_awards.user_id = first_posts.author_id
              AND point_awards.award_key = 'first_post_bonus'
          )
        )
      ),
      legacy_project_events AS (
        SELECT
          legacy_project_firsts.author_id as user_id,
          100 as points,
          'project' as category,
          legacy_project_firsts.created_at
        FROM legacy_project_firsts
        WHERE legacy_project_firsts.project_rank = 1
          AND NOT EXISTS (
            SELECT 1 FROM point_awards
            WHERE point_awards.user_id = legacy_project_firsts.author_id
              AND point_awards.award_key = 'hub_project_bonus'
          )
      ),
      score_events AS (
        SELECT user_id, points, category, created_at FROM award_events
        UNION ALL
        SELECT user_id, points, category, created_at FROM post_events
        UNION ALL
        SELECT user_id, points, category, created_at FROM legacy_project_events
        UNION ALL
        SELECT comments.author_id as user_id, 5 as points, 'community' as category, comments.created_at
        FROM comments
        UNION ALL
        SELECT post_likes.user_id as user_id, 1 as points, 'community' as category, post_likes.created_at
        FROM post_likes
        UNION ALL
        SELECT posts.author_id as user_id, 1 as points, 'community' as category, post_likes.created_at
        FROM post_likes
        JOIN posts ON posts.id = post_likes.post_id
        WHERE posts.author_id != post_likes.user_id
        UNION ALL
        SELECT posts.author_id as user_id, 3 as points, 'community' as category, bookmarks.created_at
        FROM bookmarks
        JOIN posts ON posts.id = bookmarks.post_id
        WHERE posts.author_id != bookmarks.user_id
        UNION ALL
        SELECT project_tips.recipient_id as user_id, project_tips.amount as points, 'project' as category, project_tips.created_at
        FROM project_tips
        UNION ALL
        SELECT checkins.user_id as user_id, 10 as points, 'community' as category, checkins.created_at
        FROM checkins
        UNION ALL
        SELECT projects.author_id as user_id, 5 as points, 'project' as category, project_likes.created_at
        FROM project_likes
        JOIN projects ON projects.id = project_likes.project_id
        WHERE projects.author_id != project_likes.user_id
        UNION ALL
        SELECT project_comments.author_id as user_id, 2 as points, 'project' as category, project_comments.created_at
        FROM project_comments
        UNION ALL
        SELECT projects.author_id as user_id, 3 as points, 'project' as category, project_comments.created_at
        FROM project_comments
        JOIN projects ON projects.id = project_comments.project_id
        WHERE projects.author_id != project_comments.author_id
      ),
      ranked AS (
        SELECT user_id, SUM(points)::int as points
        FROM score_events
        WHERE created_at >= NOW() - (${sinceInterval}::interval)
          AND (${category} = 'all' OR category = ${category})
        GROUP BY user_id
      )
      SELECT users.id, users.username,
        CASE WHEN users.avatar LIKE 'data:image/%' THEN NULL ELSE users.avatar END as avatar,
        users.avatar_emoji,
        users.avatar_theme,
        CASE WHEN users.role = 'admin' THEN LEAST(ranked.points, ${ADMIN_WINDOW_XP_CAP}) ELSE ranked.points END as points,
        GREATEST(1, users.level) as level,
        users.role, users.badge_preferences, users.verification_status,
        (SELECT COUNT(*) > 0 FROM projects WHERE author_id = users.id) as is_creator
      FROM ranked
      JOIN users ON users.id = ranked.user_id
      WHERE users.verification_status = 'verified'
      ORDER BY
        CASE WHEN users.role = 'admin' THEN LEAST(ranked.points, ${ADMIN_WINDOW_XP_CAP}) ELSE ranked.points END DESC,
        users.points DESC
      LIMIT ${limit}
    `;

    return rows;
}

// --- Project Functions ---

let projectEnhancementsReady: Promise<void> | null = null;
let projectSubmissionsTableReady: Promise<void> | null = null;
let projectOpenEventsReady: Promise<void> | null = null;
let projectBookmarksReady: Promise<void> | null = null;
let projectTipsReady: Promise<void> | null = null;

async function ensureProjectEnhancements() {
    if (!projectEnhancementsReady) {
        projectEnhancementsReady = (async () => {
            await sql`ALTER TABLE IF EXISTS projects ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0`;
            await sql`ALTER TABLE IF EXISTS projects ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0`;
            await sql`ALTER TABLE IF EXISTS projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'live'`;
            await sql`ALTER TABLE IF EXISTS projects ADD COLUMN IF NOT EXISTS cover_url TEXT`;
            await sql`ALTER TABLE IF EXISTS project_likes ADD COLUMN IF NOT EXISTS score NUMERIC DEFAULT 5`;
            await sql`ALTER TABLE IF EXISTS project_likes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
            await sql`ALTER TABLE IF EXISTS project_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
            await ensureProjectOpenEventsTable();
            await ensureProjectBookmarksTable();
            await ensureProjectTipsTable();
            await applyProjectAttributionCorrections();
        })().catch(error => {
            projectEnhancementsReady = null;
            throw error;
        });
    }

    return projectEnhancementsReady;
}

async function ensureProjectOpenEventsTable() {
    if (!projectOpenEventsReady) {
        projectOpenEventsReady = (async () => {
            await sql`
              CREATE TABLE IF NOT EXISTS project_opens (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`CREATE INDEX IF NOT EXISTS idx_project_opens_project_opened ON project_opens(project_id, opened_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_project_opens_project_user_opened ON project_opens(project_id, user_id, opened_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_project_opens_opened ON project_opens(opened_at DESC)`;
        })().catch(error => {
            projectOpenEventsReady = null;
            throw error;
        });
    }

    return projectOpenEventsReady;
}

async function ensureProjectBookmarksTable() {
    if (!projectBookmarksReady) {
        projectBookmarksReady = (async () => {
            await sql`
              CREATE TABLE IF NOT EXISTS project_bookmarks (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, project_id)
              );
            `;
            await sql`CREATE INDEX IF NOT EXISTS idx_project_bookmarks_user_created ON project_bookmarks(user_id, created_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_project_bookmarks_project_created ON project_bookmarks(project_id, created_at DESC)`;
        })().catch(error => {
            projectBookmarksReady = null;
            throw error;
        });
    }

    return projectBookmarksReady;
}

async function ensureProjectTipsTable() {
    if (!projectTipsReady) {
        projectTipsReady = (async () => {
            await sql`
              CREATE TABLE IF NOT EXISTS project_tips (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount INTEGER NOT NULL CHECK (amount > 0),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`CREATE INDEX IF NOT EXISTS idx_project_tips_project_created ON project_tips(project_id, created_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_project_tips_sender_created ON project_tips(sender_id, created_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_project_tips_recipient_created ON project_tips(recipient_id, created_at DESC)`;
        })().catch(error => {
            projectTipsReady = null;
            throw error;
        });
    }

    return projectTipsReady;
}

async function applyProjectAttributionCorrections() {
    await sql`
      WITH teacher AS (
        SELECT id
        FROM users
        WHERE lower(username) = lower('jinyuhong@vma.edu.cn')
        LIMIT 1
      )
      INSERT INTO projects (
        author_id, title, description, emoji, url, tags, accent_color, cover_url, status
      )
      SELECT
        teacher.id,
        'Vocab Runner · Sprint Lab',
        'A classroom vocabulary runner game for ESL review, combining unit levels, timed questions, combo feedback, and a playful sprint track.',
        '🏃',
        'https://hajimi.ericproject.xyz/projects/vocab-runner-game/index.html',
        '["Tool","Classroom"]'::jsonb,
        'rgba(14, 165, 233, 0.18)',
        'https://hajimi.ericproject.xyz/projects/vocab-runner-game/cover.svg',
        'live'
      FROM teacher
      WHERE NOT EXISTS (
        SELECT 1
        FROM projects
        WHERE title = 'Vocab Runner · Sprint Lab'
      )
    `;
    await sql`
      UPDATE projects
      SET
        author_id = users.id,
        description = 'A classroom vocabulary runner game for ESL review, combining unit levels, timed questions, combo feedback, and a playful sprint track.',
        emoji = '🏃',
        url = 'https://hajimi.ericproject.xyz/projects/vocab-runner-game/index.html',
        tags = '["Tool","Classroom"]'::jsonb,
        accent_color = 'rgba(14, 165, 233, 0.18)',
        cover_url = 'https://hajimi.ericproject.xyz/projects/vocab-runner-game/cover.svg',
        status = 'live'
      FROM users
      WHERE projects.title = 'Vocab Runner · Sprint Lab'
        AND lower(users.username) = lower('jinyuhong@vma.edu.cn')
        AND (
          projects.author_id IS DISTINCT FROM users.id
          OR projects.description IS DISTINCT FROM 'A classroom vocabulary runner game for ESL review, combining unit levels, timed questions, combo feedback, and a playful sprint track.'
          OR projects.emoji IS DISTINCT FROM '🏃'
          OR projects.url IS DISTINCT FROM 'https://hajimi.ericproject.xyz/projects/vocab-runner-game/index.html'
          OR projects.tags IS DISTINCT FROM '["Tool","Classroom"]'::jsonb
          OR projects.accent_color IS DISTINCT FROM 'rgba(14, 165, 233, 0.18)'
          OR projects.cover_url IS DISTINCT FROM 'https://hajimi.ericproject.xyz/projects/vocab-runner-game/cover.svg'
          OR projects.status IS DISTINCT FROM 'live'
        )
    `;
    await sql`
      UPDATE projects
      SET author_id = users.id
      FROM users
      WHERE projects.title = 'Boxhead'
        AND lower(users.username) = 'eric'
        AND projects.author_id IS DISTINCT FROM users.id
    `;
    await sql`
      UPDATE projects
      SET author_id = users.id
      FROM users
      WHERE projects.title = 'Sail Dodge'
        AND lower(users.username) = 'jessi'
        AND projects.author_id IS DISTINCT FROM users.id
    `;
    await sql`
      UPDATE projects
      SET author_id = users.id
      FROM users
      WHERE projects.title = '草原梦境'
        AND lower(users.username) = 'luna1919810'
        AND projects.author_id IS DISTINCT FROM users.id
    `;
    await sql`
      UPDATE projects
      SET url = 'https://hub.ericproject.xyz/projects/sailer-2d/index.html',
          status = 'live'
      WHERE projects.title = 'Sailer 2D'
        AND (
          projects.url IS DISTINCT FROM 'https://hub.ericproject.xyz/projects/sailer-2d/index.html'
          OR projects.status IS DISTINCT FROM 'live'
        )
    `;
}

async function ensureProjectSubmissionsTable() {
    if (!projectSubmissionsTableReady) {
        projectSubmissionsTableReady = (async () => {
            await sql`
              CREATE TABLE IF NOT EXISTS project_submissions (
                id SERIAL PRIMARY KEY,
                author_id INTEGER NOT NULL REFERENCES users(id),
                submission_type TEXT NOT NULL DEFAULT 'new_project',
                project_id INTEGER REFERENCES projects(id),
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                emoji TEXT NOT NULL DEFAULT '🚀',
                url TEXT,
                tags JSONB DEFAULT '[]'::jsonb,
                accent_color TEXT,
                version_notes TEXT,
                cover_url TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                reviewed_by INTEGER REFERENCES users(id),
                reviewed_at TIMESTAMP WITH TIME ZONE,
                review_note TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`CREATE INDEX IF NOT EXISTS idx_project_submissions_status_created ON project_submissions(status, created_at DESC)`;
            await sql`CREATE INDEX IF NOT EXISTS idx_project_submissions_author_created ON project_submissions(author_id, created_at DESC)`;
        })().catch(error => {
            projectSubmissionsTableReady = null;
            throw error;
        });
    }

    return projectSubmissionsTableReady;
}

export async function getProjects(): Promise<Project[]> {
    if (shouldAutoEnsureReadSchema()) {
        await ensureProjectEnhancements();
    }

    const { rows } = await sql<Project>`
      WITH comment_stats AS (
        SELECT project_id, COUNT(*)::int as comment_count
        FROM project_comments
        GROUP BY project_id
      )
      SELECT
        projects.id,
        projects.author_id,
        projects.title,
        projects.description,
        projects.emoji,
        projects.url,
        projects.tags,
        projects.accent_color,
        projects.cover_url,
        projects.status,
        projects.likes,
        projects.created_at,
        users.username as author_name,
        COALESCE(projects.rating, 0.0) as rating,
        COALESCE(projects.rating_count, 0) as rating_count,
        COALESCE(comment_stats.comment_count, 0)::int as "commentCount",
        0::int as open_count_today,
        0::int as open_count_week,
        0::int as open_count_month,
        0::int as open_count_total,
        0::int as unique_open_count_today,
        0::int as unique_open_count_week,
        0::int as unique_open_count_month,
        0::int as unique_open_count_total,
        0::int as effective_open_count_today,
        0::int as effective_open_count_week,
        0::int as effective_open_count_month,
        0::int as effective_open_count_total,
        ROUND((
          CASE
              WHEN COALESCE(projects.rating_count, 0) > 0
              THEN (((COALESCE(projects.rating, 0) * COALESCE(projects.rating_count, 0)) + 4.2 * 3) / (COALESCE(projects.rating_count, 0) + 3)) * 8
              ELSE 0
            END
          + COALESCE(projects.rating_count, 0) * 1.5
        )::numeric, 1) as hub_score
      FROM projects
      JOIN users ON projects.author_id = users.id
      LEFT JOIN comment_stats ON comment_stats.project_id = projects.id
      ORDER BY created_at DESC
    `;
    return rows;
}

export async function getProjectOpenStats(): Promise<Partial<Project>[]> {
    if (shouldAutoEnsureReadSchema()) {
        await ensureProjectEnhancements();
    }

    const { rows } = await sql<Partial<Project>>`
      WITH boundaries AS (
        SELECT
          (NOW() AT TIME ZONE 'Asia/Shanghai')::date as today,
          ((NOW() AT TIME ZONE 'Asia/Shanghai')::date - 6) as week_start,
          ((NOW() AT TIME ZONE 'Asia/Shanghai')::date - 29) as month_start
      ),
      verified_opens AS (
        SELECT
          project_opens.project_id,
          project_opens.user_id,
          project_opens.opened_at,
          (project_opens.opened_at AT TIME ZONE 'Asia/Shanghai')::date as local_day
        FROM project_opens
        JOIN users open_users ON open_users.id = project_opens.user_id
        WHERE project_opens.user_id IS NOT NULL
          AND open_users.verification_status = 'verified'
      ),
      ordered_opens AS (
        SELECT
          project_id,
          user_id,
          opened_at,
          local_day,
          LAG(opened_at) OVER (PARTITION BY project_id, user_id, local_day ORDER BY opened_at) as previous_opened_at
        FROM verified_opens
      ),
      session_opens AS (
        SELECT project_id, user_id, opened_at, local_day
        FROM ordered_opens
        WHERE previous_opened_at IS NULL OR opened_at - previous_opened_at >= INTERVAL '30 minutes'
      ),
      daily_effective AS (
        SELECT
          project_id,
          user_id,
          local_day,
          LEAST(COUNT(*)::int, 3) as effective_sessions
        FROM session_opens
        GROUP BY project_id, user_id, local_day
      ),
      unique_stats AS (
        SELECT
          verified_opens.project_id,
          COUNT(DISTINCT verified_opens.user_id) FILTER (WHERE verified_opens.local_day = boundaries.today)::int as unique_open_count_today,
          COUNT(DISTINCT verified_opens.user_id) FILTER (WHERE verified_opens.local_day >= boundaries.week_start)::int as unique_open_count_week,
          COUNT(DISTINCT verified_opens.user_id) FILTER (WHERE verified_opens.local_day >= boundaries.month_start)::int as unique_open_count_month,
          COUNT(DISTINCT verified_opens.user_id)::int as unique_open_count_total
        FROM verified_opens
        CROSS JOIN boundaries
        GROUP BY verified_opens.project_id
      ),
      effective_stats AS (
        SELECT
          daily_effective.project_id,
          COALESCE(SUM(daily_effective.effective_sessions) FILTER (WHERE daily_effective.local_day = boundaries.today), 0)::int as effective_open_count_today,
          COALESCE(SUM(daily_effective.effective_sessions) FILTER (WHERE daily_effective.local_day >= boundaries.week_start), 0)::int as effective_open_count_week,
          COALESCE(SUM(daily_effective.effective_sessions) FILTER (WHERE daily_effective.local_day >= boundaries.month_start), 0)::int as effective_open_count_month,
          COALESCE(SUM(daily_effective.effective_sessions), 0)::int as effective_open_count_total
        FROM daily_effective
        CROSS JOIN boundaries
        GROUP BY daily_effective.project_id
      )
      SELECT
        projects.id,
        COALESCE(effective_stats.effective_open_count_today, 0)::int as open_count_today,
        COALESCE(effective_stats.effective_open_count_week, 0)::int as open_count_week,
        COALESCE(effective_stats.effective_open_count_month, 0)::int as open_count_month,
        COALESCE(effective_stats.effective_open_count_total, 0)::int as open_count_total,
        COALESCE(unique_stats.unique_open_count_today, 0)::int as unique_open_count_today,
        COALESCE(unique_stats.unique_open_count_week, 0)::int as unique_open_count_week,
        COALESCE(unique_stats.unique_open_count_month, 0)::int as unique_open_count_month,
        COALESCE(unique_stats.unique_open_count_total, 0)::int as unique_open_count_total,
        COALESCE(effective_stats.effective_open_count_today, 0)::int as effective_open_count_today,
        COALESCE(effective_stats.effective_open_count_week, 0)::int as effective_open_count_week,
        COALESCE(effective_stats.effective_open_count_month, 0)::int as effective_open_count_month,
        COALESCE(effective_stats.effective_open_count_total, 0)::int as effective_open_count_total,
        ROUND((
          COALESCE(unique_stats.unique_open_count_today, 0) * 10
          + COALESCE(effective_stats.effective_open_count_today, 0) * 2
          + CASE
              WHEN COALESCE(projects.rating_count, 0) > 0
              THEN (((COALESCE(projects.rating, 0) * COALESCE(projects.rating_count, 0)) + 4.2 * 3) / (COALESCE(projects.rating_count, 0) + 3)) * 8
              ELSE 0
            END
          + COALESCE(projects.rating_count, 0) * 1.5
        )::numeric, 1) as hub_score
      FROM projects
      LEFT JOIN unique_stats ON unique_stats.project_id = projects.id
      LEFT JOIN effective_stats ON effective_stats.project_id = projects.id
    `;

    return rows;
}

export async function getProjectsByAuthor(authorId: number): Promise<Project[]> {
    if (shouldAutoEnsureReadSchema()) {
        await ensureProjectEnhancements();
    }

    const { rows } = await sql<Project>`
      SELECT projects.*, users.username as author_name,
        COALESCE(projects.rating, 0.0) as rating,
        COALESCE(projects.rating_count, 0) as rating_count,
        (SELECT COUNT(*)::int FROM project_comments WHERE project_id = projects.id) as "commentCount",
        COALESCE(opens.effective_open_count_today, 0)::int as open_count_today,
        COALESCE(opens.effective_open_count_week, 0)::int as open_count_week,
        COALESCE(opens.effective_open_count_month, 0)::int as open_count_month,
        COALESCE(opens.effective_open_count_total, 0)::int as open_count_total,
        COALESCE(opens.unique_open_count_today, 0)::int as unique_open_count_today,
        COALESCE(opens.unique_open_count_week, 0)::int as unique_open_count_week,
        COALESCE(opens.unique_open_count_month, 0)::int as unique_open_count_month,
        COALESCE(opens.unique_open_count_total, 0)::int as unique_open_count_total,
        COALESCE(opens.effective_open_count_today, 0)::int as effective_open_count_today,
        COALESCE(opens.effective_open_count_week, 0)::int as effective_open_count_week,
        COALESCE(opens.effective_open_count_month, 0)::int as effective_open_count_month,
        COALESCE(opens.effective_open_count_total, 0)::int as effective_open_count_total,
        ROUND((
          COALESCE(opens.unique_open_count_week, 0) * 10
          + COALESCE(opens.effective_open_count_week, 0) * 2
          + CASE
              WHEN COALESCE(projects.rating_count, 0) > 0
              THEN (((COALESCE(projects.rating, 0) * COALESCE(projects.rating_count, 0)) + 4.2 * 3) / (COALESCE(projects.rating_count, 0) + 3)) * 8
              ELSE 0
            END
          + COALESCE(projects.rating_count, 0) * 1.5
        )::numeric, 1) as hub_score
      FROM projects
      JOIN users ON projects.author_id = users.id
      LEFT JOIN LATERAL (
        WITH verified_opens AS (
          SELECT
            project_opens.user_id,
            project_opens.opened_at,
            (project_opens.opened_at AT TIME ZONE 'Asia/Shanghai')::date as local_day
          FROM project_opens
          JOIN users open_users ON open_users.id = project_opens.user_id
          WHERE project_opens.project_id = projects.id
            AND project_opens.user_id IS NOT NULL
            AND open_users.verification_status = 'verified'
        ),
        ordered_opens AS (
          SELECT
            user_id,
            opened_at,
            local_day,
            LAG(opened_at) OVER (PARTITION BY user_id, local_day ORDER BY opened_at) as previous_opened_at
          FROM verified_opens
        ),
        session_opens AS (
          SELECT user_id, opened_at, local_day
          FROM ordered_opens
          WHERE previous_opened_at IS NULL OR opened_at - previous_opened_at >= INTERVAL '30 minutes'
        ),
        daily_effective AS (
          SELECT
            user_id,
            local_day,
            LEAST(COUNT(*)::int, 3) as effective_sessions
          FROM session_opens
          GROUP BY user_id, local_day
        ),
        boundaries AS (
          SELECT
            (NOW() AT TIME ZONE 'Asia/Shanghai')::date as today,
            ((NOW() AT TIME ZONE 'Asia/Shanghai')::date - 6) as week_start,
            ((NOW() AT TIME ZONE 'Asia/Shanghai')::date - 29) as month_start
        )
        SELECT
          (SELECT COUNT(DISTINCT user_id)::int FROM verified_opens, boundaries WHERE local_day = today) as unique_open_count_today,
          (SELECT COUNT(DISTINCT user_id)::int FROM verified_opens, boundaries WHERE local_day >= week_start) as unique_open_count_week,
          (SELECT COUNT(DISTINCT user_id)::int FROM verified_opens, boundaries WHERE local_day >= month_start) as unique_open_count_month,
          (SELECT COUNT(DISTINCT user_id)::int FROM verified_opens) as unique_open_count_total,
          (SELECT COALESCE(SUM(effective_sessions), 0)::int FROM daily_effective, boundaries WHERE local_day = today) as effective_open_count_today,
          (SELECT COALESCE(SUM(effective_sessions), 0)::int FROM daily_effective, boundaries WHERE local_day >= week_start) as effective_open_count_week,
          (SELECT COALESCE(SUM(effective_sessions), 0)::int FROM daily_effective, boundaries WHERE local_day >= month_start) as effective_open_count_month,
          (SELECT COALESCE(SUM(effective_sessions), 0)::int FROM daily_effective) as effective_open_count_total
      ) opens ON true
      WHERE projects.author_id = ${authorId}
      ORDER BY created_at DESC
    `;

    return rows;
}

export async function getProfileAnalytics(userId: number): Promise<ProfileAnalytics> {
    await ensureProjectTipsTable();

    if (shouldAutoEnsureReadSchema()) {
        await ensureUserProfileEnhancements();
        await ensureForumEnhancements();
        await ensureProjectEnhancements();
        await ensureProjectOpenEventsTable();
        await ensurePointAwardsTable();
    }

    const { rows: userRows } = await sql<{ points: number; role: string }>`
      SELECT points, role
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;
    const rawXp = Number(userRows[0]?.points || 0);
    const userRole = userRows[0]?.role || '';

    const { rows: eventRows } = await sql<{ local_day: string; local_hour: number; category: LeaderboardCategory; points: number }>`
      WITH first_posts AS (
        SELECT
          posts.id,
          posts.author_id,
          posts.created_at,
          ROW_NUMBER() OVER (PARTITION BY posts.author_id ORDER BY posts.created_at ASC, posts.id ASC) as post_rank
        FROM posts
      ),
      legacy_project_firsts AS (
        SELECT
          projects.id,
          projects.author_id,
          projects.created_at,
          ROW_NUMBER() OVER (PARTITION BY projects.author_id ORDER BY projects.created_at ASC, projects.id ASC) as project_rank
        FROM projects
      ),
      award_events AS (
        SELECT
          point_awards.user_id,
          point_awards.amount as points,
          CASE
            WHEN point_awards.award_key LIKE 'hub_%' THEN 'project'
            ELSE 'community'
          END as category,
          point_awards.created_at
        FROM point_awards
        WHERE point_awards.award_key IN ('first_post_bonus', 'hub_project_bonus')
           OR point_awards.award_key LIKE 'hub_version_bonus:%'
      ),
      post_events AS (
        SELECT
          first_posts.author_id as user_id,
          CASE WHEN first_posts.post_rank = 1 THEN 100 ELSE 10 END as points,
          'community' as category,
          first_posts.created_at
        FROM first_posts
        WHERE NOT (
          first_posts.post_rank = 1
          AND EXISTS (
            SELECT 1 FROM point_awards
            WHERE point_awards.user_id = first_posts.author_id
              AND point_awards.award_key = 'first_post_bonus'
          )
        )
      ),
      legacy_project_events AS (
        SELECT
          legacy_project_firsts.author_id as user_id,
          100 as points,
          'project' as category,
          legacy_project_firsts.created_at
        FROM legacy_project_firsts
        WHERE legacy_project_firsts.project_rank = 1
          AND NOT EXISTS (
            SELECT 1 FROM point_awards
            WHERE point_awards.user_id = legacy_project_firsts.author_id
              AND point_awards.award_key = 'hub_project_bonus'
          )
      ),
      score_events AS (
        SELECT user_id, points, category, created_at FROM award_events
        UNION ALL
        SELECT user_id, points, category, created_at FROM post_events
        UNION ALL
        SELECT user_id, points, category, created_at FROM legacy_project_events
        UNION ALL
        SELECT comments.author_id as user_id, 5 as points, 'community' as category, comments.created_at
        FROM comments
        UNION ALL
        SELECT post_likes.user_id as user_id, 1 as points, 'community' as category, post_likes.created_at
        FROM post_likes
        UNION ALL
        SELECT posts.author_id as user_id, 1 as points, 'community' as category, post_likes.created_at
        FROM post_likes
        JOIN posts ON posts.id = post_likes.post_id
        WHERE posts.author_id != post_likes.user_id
        UNION ALL
        SELECT posts.author_id as user_id, 3 as points, 'community' as category, bookmarks.created_at
        FROM bookmarks
        JOIN posts ON posts.id = bookmarks.post_id
        WHERE posts.author_id != bookmarks.user_id
        UNION ALL
        SELECT project_tips.recipient_id as user_id, project_tips.amount as points, 'project' as category, project_tips.created_at
        FROM project_tips
        UNION ALL
        SELECT checkins.user_id as user_id, 10 as points, 'community' as category, checkins.created_at
        FROM checkins
        UNION ALL
        SELECT projects.author_id as user_id, 5 as points, 'project' as category, project_likes.created_at
        FROM project_likes
        JOIN projects ON projects.id = project_likes.project_id
        WHERE projects.author_id != project_likes.user_id
        UNION ALL
        SELECT project_comments.author_id as user_id, 2 as points, 'project' as category, project_comments.created_at
        FROM project_comments
        UNION ALL
        SELECT projects.author_id as user_id, 3 as points, 'project' as category, project_comments.created_at
        FROM project_comments
        JOIN projects ON projects.id = project_comments.project_id
        WHERE projects.author_id != project_comments.author_id
      )
      SELECT
        (created_at AT TIME ZONE 'Asia/Shanghai')::date::text as local_day,
        EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Shanghai')::int as local_hour,
        category,
        SUM(points)::int as points
      FROM score_events
      WHERE user_id = ${userId}
      GROUP BY local_day, local_hour, category
      ORDER BY local_day ASC
    `;

    const { rows: projectOpenRows } = await sql<{ local_day: string; local_hour: number; opens: number }>`
      WITH verified_opens AS (
        SELECT
          project_opens.user_id,
          project_opens.opened_at,
          (project_opens.opened_at AT TIME ZONE 'Asia/Shanghai')::date as local_day
        FROM project_opens
        JOIN projects ON projects.id = project_opens.project_id
        JOIN users open_users ON open_users.id = project_opens.user_id
        WHERE projects.author_id = ${userId}
          AND project_opens.user_id IS NOT NULL
          AND open_users.verification_status = 'verified'
      ),
      ordered_opens AS (
        SELECT
          user_id,
          opened_at,
          local_day,
          LAG(opened_at) OVER (PARTITION BY user_id, local_day ORDER BY opened_at) as previous_opened_at
        FROM verified_opens
      ),
      session_opens AS (
        SELECT user_id, local_day, opened_at
        FROM ordered_opens
        WHERE previous_opened_at IS NULL OR opened_at - previous_opened_at >= INTERVAL '30 minutes'
      ),
      ranked_sessions AS (
        SELECT
          user_id,
          local_day,
          opened_at,
          ROW_NUMBER() OVER (PARTITION BY user_id, local_day ORDER BY opened_at ASC) as session_rank
        FROM session_opens
      )
      SELECT
        local_day::text,
        EXTRACT(HOUR FROM opened_at AT TIME ZONE 'Asia/Shanghai')::int as local_hour,
        COUNT(*)::int as opens
      FROM ranked_sessions
      WHERE session_rank <= 3
      GROUP BY local_day, local_hour
      ORDER BY local_day ASC
    `;

    const { rows: interactionRows } = await sql<{ local_day: string; local_hour: number; interactions: number }>`
      WITH post_interactions AS (
        SELECT post_likes.created_at
        FROM post_likes
        JOIN posts ON posts.id = post_likes.post_id
        WHERE posts.author_id = ${userId}
        UNION ALL
        SELECT comments.created_at
        FROM comments
        JOIN posts ON posts.id = comments.post_id
        WHERE posts.author_id = ${userId}
      )
      SELECT
        (created_at AT TIME ZONE 'Asia/Shanghai')::date::text as local_day,
        EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Shanghai')::int as local_hour,
        COUNT(*)::int as interactions
      FROM post_interactions
      GROUP BY local_day, local_hour
      ORDER BY local_day ASC
    `;

    const { rows: countRows } = await sql<{ post_count: number; project_count: number }>`
      SELECT
        (SELECT COUNT(*)::int FROM posts WHERE author_id = ${userId}) as post_count,
        (SELECT COUNT(*)::int FROM projects WHERE author_id = ${userId}) as project_count
    `;

    const xpByDay = new Map<string, number>();
    const xpByHour = new Map<string, number>();
    const categoryTotals = new Map<string, number>();
    eventRows.forEach(row => {
        xpByDay.set(row.local_day, (xpByDay.get(row.local_day) || 0) + Number(row.points || 0));
        xpByHour.set(`${row.local_day}:${row.local_hour}`, (xpByHour.get(`${row.local_day}:${row.local_hour}`) || 0) + Number(row.points || 0));
        categoryTotals.set(row.category, (categoryTotals.get(row.category) || 0) + Number(row.points || 0));
    });

    const opensByDay = new Map<string, number>();
    const opensByHour = new Map<string, number>();
    projectOpenRows.forEach(row => {
        opensByDay.set(row.local_day, (opensByDay.get(row.local_day) || 0) + Number(row.opens || 0));
        opensByHour.set(`${row.local_day}:${row.local_hour}`, (opensByHour.get(`${row.local_day}:${row.local_hour}`) || 0) + Number(row.opens || 0));
    });
    const interactionsByDay = new Map<string, number>();
    const interactionsByHour = new Map<string, number>();
    interactionRows.forEach(row => {
        interactionsByDay.set(row.local_day, (interactionsByDay.get(row.local_day) || 0) + Number(row.interactions || 0));
        interactionsByHour.set(`${row.local_day}:${row.local_hour}`, (interactionsByHour.get(`${row.local_day}:${row.local_hour}`) || 0) + Number(row.interactions || 0));
    });
    const visibleXp = applyVisibleXpDisplayCap(rawXp, userRole);
    const projectOpenTotal = projectOpenRows.reduce((sum, row) => sum + Number(row.opens || 0), 0);
    const postInteractionTotal = interactionRows.reduce((sum, row) => sum + Number(row.interactions || 0), 0);
    const projectOpenWeek = Array.from({ length: 7 }, (_, index) => {
        const key = getShanghaiDateKeyFromOffset(index - 6);
        return opensByDay.get(key) || 0;
    }).reduce((sum, opens) => sum + opens, 0);

    const buildDayFromKey = (key: string, mode: 'weekday' | 'date'): ProfileAnalyticsDay => {
        const xp = normalizeDailyActivityXp(xpByDay.get(key) || 0, userRole);
        const projectOpens = opensByDay.get(key) || 0;
        const postInteractions = interactionsByDay.get(key) || 0;
        return {
            key,
            label: formatAnalyticsDayLabel(key, mode),
            xp,
            projectOpens,
            postInteractions,
            value: xp + projectOpens + postInteractions,
        };
    };
    const buildDay = (offset: number, mode: 'weekday' | 'date'): ProfileAnalyticsDay => {
        const key = getShanghaiDateKeyFromOffset(offset);
        return buildDayFromKey(key, mode);
    };

    const trend7Days = Array.from({ length: 7 }, (_, index) => buildDay(index - 6, 'weekday'));
    const heatmap28Days = Array.from({ length: 28 }, (_, index) => buildDay(index - 27, 'date'));
    const todayKey = getShanghaiDateKey(new Date());
    const rawTodayHourlyXp = Array.from({ length: 24 }, (_, hour) => xpByHour.get(`${todayKey}:${hour}`) || 0);
    const rawTodayXp = rawTodayHourlyXp.reduce((sum, xp) => sum + xp, 0);
    const cappedTodayXp = normalizeDailyActivityXp(rawTodayXp, userRole);
    const hourlyXpFloors = rawTodayHourlyXp.map(xp => rawTodayXp > 0 ? Math.floor((xp / rawTodayXp) * cappedTodayXp) : 0);
    let hourlyXpRemainder = cappedTodayXp - hourlyXpFloors.reduce((sum, xp) => sum + xp, 0);
    rawTodayHourlyXp
        .map((xp, hour) => ({
            hour,
            fraction: rawTodayXp > 0 ? ((xp / rawTodayXp) * cappedTodayXp) % 1 : 0,
        }))
        .sort((a, b) => b.fraction - a.fraction)
        .forEach(item => {
            if (hourlyXpRemainder <= 0) return;
            hourlyXpFloors[item.hour] += 1;
            hourlyXpRemainder -= 1;
        });
    const todayHours = Array.from({ length: 24 }, (_, hour) => {
        const hourKey = `${todayKey}:${hour}`;
        const xp = hourlyXpFloors[hour] || 0;
        const projectOpens = opensByHour.get(hourKey) || 0;
        const postInteractions = interactionsByHour.get(hourKey) || 0;
        const label = `${String(hour).padStart(2, '0')}:00`;
        return {
            key: `${todayKey}T${String(hour).padStart(2, '0')}`,
            label,
            xp,
            projectOpens,
            postInteractions,
            value: xp + projectOpens + postInteractions,
        };
    });
    const [currentYear, currentMonth] = getShanghaiDateKey(new Date()).split('-').map(Number);
    const monthDayCount = new Date(currentYear, currentMonth, 0).getDate();
    const heatmapMonthDays = Array.from({ length: monthDayCount }, (_, index) => {
        const day = String(index + 1).padStart(2, '0');
        const month = String(currentMonth).padStart(2, '0');
        return buildDayFromKey(`${currentYear}-${month}-${day}`, 'date');
    });
    const weeklyGrowth = trend7Days.reduce((sum, day) => sum + day.value, 0);
    const levelProgress = getLevelProgress(visibleXp);
    const postCount = Number(countRows[0]?.post_count || 0);
    const projectCount = Number(countRows[0]?.project_count || 0);
    const creatorScore = Math.min(99, Math.round(
        projectCount * 10
        + postCount * 3
        + postInteractionTotal * 1.2
        + projectOpenTotal * 0.08
        + visibleXp * 0.04,
    ));
    const contributionBase = Math.max(1, visibleXp + projectOpenTotal + postInteractionTotal);
    const contributionBreakdown = [
        { label: 'XP', value: Math.min(100, Math.max(8, Math.round(visibleXp / contributionBase * 100))) },
        { label: '项目打开量', value: Math.min(100, Math.max(8, Math.round(projectOpenTotal / contributionBase * 100))) },
        { label: '帖子互动', value: Math.min(100, Math.max(8, Math.round(postInteractionTotal / contributionBase * 100))) },
        { label: '项目创作', value: Math.min(100, Math.max(8, Math.round((categoryTotals.get('project') || 0) / Math.max(1, visibleXp) * 100))) },
    ];

    return {
        visibleXp,
        rawXp,
        ...levelProgress,
        projectOpenTotal,
        projectOpenWeek,
        postInteractionTotal,
        postCount,
        projectCount,
        creatorScore,
        weeklyGrowth,
        trend7Days,
        todayHours,
        heatmap28Days,
        heatmapMonthDays,
        contributionBreakdown,
    };
}

export async function createProject(data: Omit<Project, 'id' | 'likes' | 'created_at'>) {
    await ensureProjectEnhancements();

    const { rows } = await sql`
      INSERT INTO projects (author_id, title, description, emoji, url, tags, accent_color, status)
      VALUES (${data.author_id}, ${data.title}, ${data.description}, ${data.emoji}, ${data.url}, ${JSON.stringify(data.tags)}, ${data.accent_color}, ${data.status})
      RETURNING id
    `;

    await addAwardPointsOnce(data.author_id, 'hub_project_bonus', 100);

    return rows[0].id;
}

export async function trackProjectOpen(projectId: number, userId?: number | null) {
    await ensureProjectEnhancements();

    const { rowCount } = await sql`
      INSERT INTO project_opens (project_id, user_id)
      SELECT projects.id, ${userId || null}
      FROM projects
      WHERE projects.id = ${projectId}
    `;

    return (rowCount ?? 0) > 0;
}

export async function getProjectBookmarkIds(userId: number): Promise<number[]> {
    await ensureProjectBookmarksTable();

    const { rows } = await sql<{ project_id: number }>`
      SELECT project_id
      FROM project_bookmarks
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return rows.map(row => Number(row.project_id)).filter(id => Number.isFinite(id) && id > 0);
}

export async function toggleProjectBookmark(userId: number, projectId: number): Promise<boolean> {
    await ensureProjectBookmarksTable();

    const { rows } = await sql`
      SELECT 1
      FROM project_bookmarks
      WHERE user_id = ${userId} AND project_id = ${projectId}
      LIMIT 1
    `;

    if (rows[0]) {
        await sql`
          DELETE FROM project_bookmarks
          WHERE user_id = ${userId} AND project_id = ${projectId}
        `;
        return false;
    }

    const { rowCount } = await sql`
      INSERT INTO project_bookmarks (user_id, project_id)
      SELECT ${userId}, projects.id
      FROM projects
      WHERE projects.id = ${projectId}
        AND projects.status = 'live'
      ON CONFLICT (user_id, project_id) DO NOTHING
    `;

    if ((rowCount ?? 0) <= 0) {
        const { rows: projectRows } = await sql<{ status: string | null }>`SELECT status FROM projects WHERE id = ${projectId} LIMIT 1`;
        if (!projectRows[0]) throw new Error('Project not found');
        if (projectRows[0].status !== 'live') throw new Error('Project is not live');
    }

    return true;
}

// Legacy XP transfer helper. New Function Hall tips must use transferProjectCoinTip().
export async function tipProject(senderId: number, projectId: number, amount: number) {
    await ensureProjectTipsTable();

    const safeAmount = Math.floor(Number(amount));
    if (!Number.isInteger(safeAmount) || safeAmount < 1 || safeAmount > 100) {
        throw new Error('Invalid tip amount');
    }

    const client = await db.connect();

    try {
        await client.sql`BEGIN`;

        const { rows: projectRows } = await client.sql<{ author_id: number; status: string | null }>`
          SELECT author_id, status
          FROM projects
          WHERE id = ${projectId}
          LIMIT 1
        `;
        const project = projectRows[0];
        if (!project) throw new Error('Project not found');
        if (project.status !== 'live') throw new Error('Project is not live');

        const recipientId = Number(project.author_id);
        if (recipientId === senderId) throw new Error('Cannot tip your own project');

        const { rows: senderRows } = await client.sql<{ points: number; role: string | null }>`
          SELECT points, role
          FROM users
          WHERE id = ${senderId}
          FOR UPDATE
        `;
        const senderPoints = Number(senderRows[0]?.points || 0);
        const senderVisiblePoints = applyVisibleXpDisplayCap(senderPoints, senderRows[0]?.role);
        if (senderVisiblePoints < safeAmount) throw new Error('Insufficient points');

        const { rows: debitedRows } = await client.sql<{ points: number; level: number; role: string | null }>`
          UPDATE users
          SET
            points = CASE
              WHEN role = 'admin' THEN GREATEST(LEAST(points, ${ADMIN_VISIBLE_XP_CAP}) - ${safeAmount}, 0)
              ELSE points - ${safeAmount}
            END,
            level = GREATEST(
              1,
              FLOOR(SQRT(GREATEST(
                CASE
                  WHEN role = 'admin' THEN LEAST(points, ${ADMIN_VISIBLE_XP_CAP}) - ${safeAmount}
                  ELSE points - ${safeAmount}
                END,
                0
              ) / 50.0))::int + 1
            )
          WHERE id = ${senderId}
          RETURNING points, level, role
        `;

        const { rows: creditedRows } = await client.sql<{ points: number; level: number; role: string | null }>`
          UPDATE users
          SET
            points = CASE
              WHEN role = 'admin' THEN LEAST(${ADMIN_VISIBLE_XP_CAP}, LEAST(points, ${ADMIN_VISIBLE_XP_CAP}) + ${safeAmount})
              ELSE points + ${safeAmount}
            END,
            level = GREATEST(
              level,
              FLOOR(SQRT((
                CASE
                  WHEN role = 'admin' THEN LEAST(${ADMIN_VISIBLE_XP_CAP}, LEAST(points, ${ADMIN_VISIBLE_XP_CAP}) + ${safeAmount})
                  ELSE points + ${safeAmount}
                END
              ) / 50.0))::int + 1
            )
          WHERE id = ${recipientId}
          RETURNING points, level, role
        `;

        const { rows: tipRows } = await client.sql<{ id: number }>`
          INSERT INTO project_tips (project_id, sender_id, recipient_id, amount)
          VALUES (${projectId}, ${senderId}, ${recipientId}, ${safeAmount})
          RETURNING id
        `;

        await client.sql`COMMIT`;

        return {
            id: Number(tipRows[0]?.id || 0),
            amount: safeAmount,
            recipientId,
            senderPoints: applyVisibleXpDisplayCap(Number(debitedRows[0]?.points || 0), debitedRows[0]?.role),
            senderLevel: Number(debitedRows[0]?.level || 1),
            recipientPoints: applyVisibleXpDisplayCap(Number(creditedRows[0]?.points || 0), creditedRows[0]?.role),
            recipientLevel: Number(creditedRows[0]?.level || 1),
        };
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

export async function rateProject(userId: number, projectId: number, score: number) {
    await ensureProjectEnhancements();

    const { rows: existing } = await sql`
      SELECT score FROM project_likes WHERE user_id = ${userId} AND project_id = ${projectId}
    `;

    if (existing[0]) {
        const oldScore = existing[0].score || 5.0;
        await sql`UPDATE project_likes SET score = ${score} WHERE user_id = ${userId} AND project_id = ${projectId}`;
        const { rows: updatedProj } = await sql`
          UPDATE projects 
          SET rating = ROUND((rating * rating_count - ${oldScore} + ${score}) / rating_count, 1)
          WHERE id = ${projectId}
          RETURNING rating, rating_count
        `;
        return { isNew: false, rating: updatedProj[0].rating, rating_count: updatedProj[0].rating_count };
    } else {
        await sql`INSERT INTO project_likes (user_id, project_id, score) VALUES (${userId}, ${projectId}, ${score})`;
        const { rows: updatedProj } = await sql`
          UPDATE projects 
          SET 
            rating = CASE WHEN rating_count = 0 THEN ${score} ELSE ROUND((rating * rating_count + ${score}) / (rating_count + 1), 1) END,
            rating_count = rating_count + 1
          WHERE id = ${projectId}
          RETURNING rating, rating_count
        `;
        
        // Reward author: 5 XP
        const { rows: proj } = await sql`SELECT author_id FROM projects WHERE id = ${projectId}`;
        if (proj[0] && proj[0].author_id !== userId) await addPoints(proj[0].author_id, 5);
        
        return { isNew: true, rating: updatedProj[0].rating, rating_count: updatedProj[0].rating_count };
    }
}

export async function addProjectComment(userId: number, projectId: number, content: string) {
    await ensureProjectEnhancements();

    const { rows: existing } = await sql`SELECT id FROM project_comments WHERE project_id = ${projectId} AND author_id = ${userId}`;
    
    if (existing.length > 0) {
        await sql`UPDATE project_comments SET content = ${content}, created_at = CURRENT_TIMESTAMP WHERE id = ${existing[0].id}`;
        return existing[0].id;
    } else {
        const { rows } = await sql`
          INSERT INTO project_comments (project_id, author_id, content)
          VALUES (${projectId}, ${userId}, ${content})
          RETURNING id
        `;
        
        // Reward commenter: 2 XP
        await addPoints(userId, 2);
        
        // Reward author: 3 XP
        const { rows: proj } = await sql`SELECT author_id FROM projects WHERE id = ${projectId}`;
        if (proj[0] && proj[0].author_id !== userId) await addPoints(proj[0].author_id, 3);
        
        return rows[0].id;
    }
}

export async function deleteProjectComment(commentId: number, userId: number) {
    await ensureProjectEnhancements();

    const { rows } = await sql`
      SELECT project_id FROM project_comments WHERE id = ${commentId} AND author_id = ${userId}
    `;
    if (rows.length === 0) return;
    const projectId = rows[0].project_id;

    // Delete comment
    await sql`
      DELETE FROM project_comments 
      WHERE id = ${commentId} AND author_id = ${userId}
    `;
    
    // Delete corresponding rating
    await sql`
      DELETE FROM project_likes
      WHERE project_id = ${projectId} AND user_id = ${userId}
    `;
    
    // Recalculate average rating
    const { rows: stats } = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(score), 0) as total 
      FROM project_likes 
      WHERE project_id = ${projectId} AND score > 0
    `;
    const count = Number(stats[0].count);
    const newRating = count > 0 ? Number(stats[0].total) / count : 0;
    
    await sql`
      UPDATE projects 
      SET rating = ${newRating}, rating_count = ${count}
      WHERE id = ${projectId}
    `;
}

export async function getProjectComments(projectId: number): Promise<ProjectComment[]> {
    await ensureProjectEnhancements();

    const { rows } = await sql<ProjectComment>`
      SELECT 
        project_comments.*, 
        users.username as author_name, 
        CASE WHEN users.avatar LIKE 'data:image/%' THEN NULL ELSE users.avatar END as author_avatar,
        users.avatar_emoji as author_avatar_emoji,
        users.avatar_theme as author_avatar_theme,
        (SELECT score FROM project_likes WHERE project_likes.user_id = project_comments.author_id AND project_likes.project_id = ${projectId} LIMIT 1) as author_score
      FROM project_comments
      JOIN users ON project_comments.author_id = users.id
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `;
    return rows;
}

export async function getProjectUserFeedback(projectId: number, userId: number): Promise<ProjectUserFeedback> {
    await ensureProjectEnhancements();

    const [commentResult, ratingResult] = await Promise.all([
        sql<{ id: number; content: string }>`
          SELECT id, content
          FROM project_comments
          WHERE project_id = ${projectId}
            AND author_id = ${userId}
          LIMIT 1
        `,
        sql<{ score: number }>`
          SELECT score
          FROM project_likes
          WHERE project_id = ${projectId}
            AND user_id = ${userId}
          LIMIT 1
        `,
    ]);

    return {
        comment_id: commentResult.rows[0]?.id ?? null,
        content: commentResult.rows[0]?.content ?? null,
        score: ratingResult.rows[0]?.score ? Number(ratingResult.rows[0].score) : null,
    };
}

function normalizeProjectSubmission(input: ProjectSubmissionInput) {
    const submissionType: ProjectSubmissionType = input.submission_type === 'new_version' ? 'new_version' : 'new_project';
    const tags = Array.isArray(input.tags)
        ? input.tags.map(tag => String(tag || '').trim()).filter(Boolean).slice(0, 5)
        : [];

    return {
        author_id: input.author_id,
        submission_type: submissionType,
        project_id: submissionType === 'new_version' && input.project_id ? Number(input.project_id) : null,
        title: String(input.title || '').trim().slice(0, 80),
        description: String(input.description || '').trim().slice(0, 520),
        emoji: String(input.emoji || '🚀').trim().slice(0, 8) || '🚀',
        url: String(input.url || '').trim().slice(0, 500) || null,
        tags: tags.length > 0 ? tags : ['Game'],
        accent_color: String(input.accent_color || 'rgba(162, 155, 254, 0.22)').trim().slice(0, 80) || 'rgba(162, 155, 254, 0.22)',
        version_notes: String(input.version_notes || '').trim().slice(0, 800) || null,
        cover_url: String(input.cover_url || '').trim().slice(0, 500) || null,
    };
}

export async function createProjectSubmission(input: ProjectSubmissionInput) {
    await ensureProjectEnhancements();
    await ensureProjectSubmissionsTable();
    const data = normalizeProjectSubmission(input);

    if (!data.title || data.title.length < 2) {
        throw new Error('Invalid project title');
    }

    if (!data.description || data.description.length < 8) {
        throw new Error('Invalid project description');
    }

    if (data.url) {
        try {
            const parsed = new URL(data.url);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Invalid URL');
        } catch {
            throw new Error('Invalid project URL');
        }
    }

    if (data.cover_url) {
        try {
            const parsed = new URL(data.cover_url);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Invalid URL');
        } catch {
            throw new Error('Invalid project cover URL');
        }
    }

    if (data.submission_type === 'new_version' && !data.project_id) {
        throw new Error('Missing project for version submission');
    }

    if (data.submission_type === 'new_version' && data.project_id) {
        const { rows } = await sql<{ author_id: number }>`
          SELECT author_id
          FROM projects
          WHERE id = ${data.project_id}
          LIMIT 1
        `;
        const targetProject = rows[0];

        if (!targetProject) {
            throw new Error('Target project not found');
        }

        if (Number(targetProject.author_id) !== Number(data.author_id)) {
            throw new Error('Project version forbidden');
        }
    }

    const { rows } = await sql<{ id: number }>`
      INSERT INTO project_submissions (
        author_id, submission_type, project_id, title, description, emoji, url, tags,
        accent_color, version_notes, cover_url
      )
      VALUES (
        ${data.author_id},
        ${data.submission_type},
        ${data.project_id},
        ${data.title},
        ${data.description},
        ${data.emoji},
        ${data.url},
        ${JSON.stringify(data.tags)}::jsonb,
        ${data.accent_color},
        ${data.version_notes},
        ${data.cover_url}
      )
      RETURNING id
    `;

    return rows[0].id;
}

export async function getProjectSubmissions(status: ProjectSubmissionStatus | 'all' = 'pending'): Promise<ProjectSubmission[]> {
    await ensureProjectEnhancements();
    await ensureProjectSubmissionsTable();

    const { rows } = await sql<ProjectSubmission>`
      SELECT project_submissions.*, users.username as author_name, projects.title as project_title
      FROM project_submissions
      JOIN users ON project_submissions.author_id = users.id
      LEFT JOIN projects ON project_submissions.project_id = projects.id
      WHERE (${status} = 'all' OR project_submissions.status = ${status})
      ORDER BY project_submissions.created_at DESC
      LIMIT 80
    `;

    return rows;
}

export async function getAdminReviewSummary(): Promise<AdminReviewSummary> {
    await ensureUserProfileEnhancements();
    await ensureProjectSubmissionsTable();

    const [
        verificationCountResult,
        projectSubmissionCountResult,
        verificationTasksResult,
        projectSubmissionTasksResult,
    ] = await Promise.all([
        sql<{ count: number }>`
          SELECT COUNT(*)::int as count
          FROM users
          WHERE verification_status = 'pending'
        `,
        sql<{ count: number }>`
          SELECT COUNT(*)::int as count
          FROM project_submissions
          WHERE status = 'pending'
        `,
        sql<{
            id: number;
            username: string;
            verification_type: VerificationType | null;
            verified_name: string | null;
            verified_grade: string | null;
            verified_subject: string | null;
            verification_submitted_at: Date | null;
        }>`
          SELECT id, username, verification_type, verified_name, verified_grade, verified_subject, verification_submitted_at
          FROM users
          WHERE verification_status = 'pending'
          ORDER BY verification_submitted_at ASC NULLS LAST, id ASC
          LIMIT 5
        `,
        sql<{
            id: number;
            author_name: string;
            submission_type: ProjectSubmissionType;
            title: string;
            project_title: string | null;
            created_at: Date;
        }>`
          SELECT
            project_submissions.id,
            users.username as author_name,
            project_submissions.submission_type,
            project_submissions.title,
            projects.title as project_title,
            project_submissions.created_at
          FROM project_submissions
          JOIN users ON project_submissions.author_id = users.id
          LEFT JOIN projects ON project_submissions.project_id = projects.id
          WHERE project_submissions.status = 'pending'
          ORDER BY project_submissions.created_at DESC
          LIMIT 5
        `,
    ]);

    const verificationCount = verificationCountResult.rows[0]?.count ?? 0;
    const projectSubmissionCount = projectSubmissionCountResult.rows[0]?.count ?? 0;

    const verificationTasks: AdminReviewTask[] = verificationTasksResult.rows.map((request) => {
        const identity = request.verified_name || request.username;
        const detail = request.verification_type === 'teacher'
            ? `Teacher · ${request.verified_subject || 'subject not set'}`
            : `${request.verified_grade || 'grade not set'} · ${request.username}`;

        return {
            id: `verification-${request.id}`,
            kind: 'verification',
            title: `${identity} 的认证申请`,
            description: detail,
            href: '/admin/verifications',
            created_at: request.verification_submitted_at,
        };
    });

    const projectSubmissionTasks: AdminReviewTask[] = projectSubmissionTasksResult.rows.map((submission) => {
        const typeLabel = submission.submission_type === 'new_version' ? '新版本申请' : '新项目申请';
        const target = submission.project_title ? ` · 更新 ${submission.project_title}` : '';

        return {
            id: `project-${submission.id}`,
            kind: 'project_submission',
            title: `${submission.title} · ${typeLabel}`,
            description: `${submission.author_name}${target}`,
            href: '/admin/project-submissions',
            created_at: submission.created_at,
        };
    });

    const tasks = [...verificationTasks, ...projectSubmissionTasks]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 8);

    return {
        totalCount: verificationCount + projectSubmissionCount,
        verificationCount,
        projectSubmissionCount,
        tasks,
    };
}

export async function reviewProjectSubmission(submissionId: number, reviewerId: number, status: 'approved' | 'rejected', note = '') {
    await ensureProjectEnhancements();
    await ensureProjectSubmissionsTable();
    await ensurePointAwardsTable();
    await ensureAdminAuditTable();

    const client = await db.connect();
    try {
        await client.sql`BEGIN`;

        const { rows } = await client.sql<ProjectSubmission>`
          SELECT *
          FROM project_submissions
          WHERE id = ${submissionId}
            AND status = 'pending'
          FOR UPDATE
        `;
        const submission = rows[0];
        if (!submission) {
            throw new Error('Submission not found');
        }

        if (status === 'approved') {
            if (submission.submission_type === 'new_version' && submission.project_id) {
                const { rowCount } = await client.sql`
                  UPDATE projects
                  SET
                    title = ${submission.title},
                    description = ${submission.description},
                    emoji = ${submission.emoji},
                    url = ${submission.url},
                    tags = ${JSON.stringify(submission.tags)}::jsonb,
                    accent_color = ${submission.accent_color},
                    cover_url = COALESCE(NULLIF(${submission.cover_url}, ''), cover_url),
                    status = 'live'
                  WHERE id = ${submission.project_id}
                `;
                if (rowCount === 0) {
                    throw new Error('Target project not found');
                }

                const { rows: awardRows } = await client.sql<{ id: number }>`
                  INSERT INTO point_awards (user_id, award_key, amount)
                  VALUES (${submission.author_id}, ${`hub_version_bonus:${submission.id}`}, 50)
                  ON CONFLICT (user_id, award_key) DO NOTHING
                  RETURNING id
                `;
                if (awardRows[0]) {
                    await client.sql`
                      UPDATE users
                      SET
                        points = CASE
                          WHEN role = 'admin' THEN LEAST(${ADMIN_VISIBLE_XP_CAP}, LEAST(points, ${ADMIN_VISIBLE_XP_CAP}) + 50)
                          ELSE points + 50
                        END,
                        level = GREATEST(
                          level,
                          FLOOR(SQRT((
                            CASE
                              WHEN role = 'admin' THEN LEAST(${ADMIN_VISIBLE_XP_CAP}, LEAST(points, ${ADMIN_VISIBLE_XP_CAP}) + 50)
                              ELSE points + 50
                            END
                          ) / 50.0))::int + 1
                        )
                      WHERE id = ${submission.author_id}
                    `;
                }
            } else {
                await client.sql`
                  INSERT INTO projects (author_id, title, description, emoji, url, tags, accent_color, cover_url, status)
                  VALUES (
                    ${submission.author_id},
                    ${submission.title},
                    ${submission.description},
                    ${submission.emoji},
                    ${submission.url},
                    ${JSON.stringify(submission.tags)}::jsonb,
                    ${submission.accent_color},
                    ${submission.cover_url},
                    'live'
                  )
                `;

                const { rows: awardRows } = await client.sql<{ id: number }>`
                  INSERT INTO point_awards (user_id, award_key, amount)
                  VALUES (${submission.author_id}, 'hub_project_bonus', 100)
                  ON CONFLICT (user_id, award_key) DO NOTHING
                  RETURNING id
                `;
                if (awardRows[0]) {
                    await client.sql`
                      UPDATE users
                      SET
                        points = CASE
                          WHEN role = 'admin' THEN LEAST(${ADMIN_VISIBLE_XP_CAP}, LEAST(points, ${ADMIN_VISIBLE_XP_CAP}) + 100)
                          ELSE points + 100
                        END,
                        level = GREATEST(
                          level,
                          FLOOR(SQRT((
                            CASE
                              WHEN role = 'admin' THEN LEAST(${ADMIN_VISIBLE_XP_CAP}, LEAST(points, ${ADMIN_VISIBLE_XP_CAP}) + 100)
                              ELSE points + 100
                            END
                          ) / 50.0))::int + 1
                        )
                      WHERE id = ${submission.author_id}
                    `;
                }
            }
        }

        await client.sql`
          UPDATE project_submissions
          SET
            status = ${status},
            reviewed_by = ${reviewerId},
            reviewed_at = CURRENT_TIMESTAMP,
            review_note = ${note.trim() || null}
          WHERE id = ${submissionId}
            AND status = 'pending'
        `;

        await client.sql`
          INSERT INTO admin_audit_events (
            actor_id, target_user_id, target_type, target_id, event_type, summary, details
          )
          VALUES (
            ${reviewerId},
            ${submission.author_id},
            'project_submission',
            ${submissionId},
            ${`project_submission_${status}`},
            ${`${submission.title} 项目申请已${status === 'approved' ? '通过' : '拒绝'}`},
            ${JSON.stringify({
                submission_type: submission.submission_type,
                project_id: submission.project_id,
                title: submission.title,
                note: note.trim() || null,
            })}::jsonb
          )
        `;

        await client.sql`COMMIT`;
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

let notificationsTableReady: Promise<void> | null = null;

async function ensureNotificationsTable() {
    if (!notificationsTableReady) {
        notificationsTableReady = (async () => {
            await sql`
              CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type TEXT NOT NULL,
                post_id INTEGER,
                comment_id INTEGER,
                read_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;

            await sql`
              CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
              ON notifications (recipient_id, created_at DESC);
            `;

            await sql`
              CREATE INDEX IF NOT EXISTS notifications_unread_recipient_idx
              ON notifications (recipient_id)
              WHERE read_at IS NULL;
            `;
        })().catch(error => {
            notificationsTableReady = null;
            throw error;
        });
    }

    return notificationsTableReady;
}

async function createNotification(input: {
    recipientId: number;
    actorId: number;
    type: Notification['type'];
    postId?: number | null;
    commentId?: number | null;
}) {
    if (!input.recipientId || input.recipientId === input.actorId) return;

    try {
        await ensureNotificationsTable();

        const { rows } = await sql`
          SELECT id
          FROM notifications
          WHERE recipient_id = ${input.recipientId}
            AND actor_id = ${input.actorId}
            AND type = ${input.type}
            AND post_id IS NOT DISTINCT FROM ${input.postId ?? null}
            AND comment_id IS NOT DISTINCT FROM ${input.commentId ?? null}
            AND created_at >= NOW() - INTERVAL '6 hours'
          LIMIT 1
        `;

        if (rows[0]) return;

        await sql`
          INSERT INTO notifications (recipient_id, actor_id, type, post_id, comment_id)
          VALUES (${input.recipientId}, ${input.actorId}, ${input.type}, ${input.postId ?? null}, ${input.commentId ?? null})
        `;
    } catch (error) {
        console.warn('Notification write skipped:', error);
    }
}

export async function createPostInteractionNotification(actorId: number, postId: number, type: 'post_like' | 'post_bookmark') {
    const { rows } = await sql<{ author_id: number }>`
      SELECT author_id
      FROM posts
      WHERE id = ${postId}
      LIMIT 1
    `;

    const recipientId = rows[0]?.author_id;
    if (!recipientId) return;

    await createNotification({
        recipientId,
        actorId,
        type,
        postId,
    });
}

export async function createCommentLikeNotification(actorId: number, commentId: number) {
    const { rows } = await sql<{ author_id: number; post_id: number }>`
      SELECT author_id, post_id
      FROM comments
      WHERE id = ${commentId}
      LIMIT 1
    `;

    const comment = rows[0];
    if (!comment) return;

    await createNotification({
        recipientId: comment.author_id,
        actorId,
        type: 'comment_like',
        postId: comment.post_id,
        commentId,
    });
}

export async function createCommentNotification(actorId: number, newCommentId: number) {
    const { rows } = await sql<{ post_id: number; post_author_id: number; parent_comment_id: number | null; parent_author_id: number | null }>`
      SELECT
        comments.post_id,
        posts.author_id as post_author_id,
        comments.parent_comment_id,
        parent_comments.author_id as parent_author_id
      FROM comments
      JOIN posts ON posts.id = comments.post_id
      LEFT JOIN comments parent_comments ON parent_comments.id = comments.parent_comment_id
      WHERE comments.id = ${newCommentId}
      LIMIT 1
    `;

    const comment = rows[0];
    if (!comment) return;

    if (comment.parent_comment_id && comment.parent_author_id) {
        await createNotification({
            recipientId: comment.parent_author_id,
            actorId,
            type: 'comment_reply',
            postId: comment.post_id,
            commentId: newCommentId,
        });

        if (comment.post_author_id === comment.parent_author_id) {
            return;
        }
    }

    await createNotification({
        recipientId: comment.post_author_id,
        actorId,
        type: 'post_comment',
        postId: comment.post_id,
        commentId: newCommentId,
    });
}

export async function getNotifications(userId: number) {
    if (shouldAutoEnsureReadSchema()) {
        await ensureNotificationsTable();
    }

    const { rows } = await sql<Notification>`
      SELECT notifications.*, users.username as actor_name,
        CASE WHEN users.avatar LIKE 'data:image/%' THEN NULL ELSE users.avatar END as actor_avatar,
        users.avatar_emoji as actor_avatar_emoji,
        users.avatar_theme as actor_avatar_theme,
        posts.title as post_title,
        comments.content as comment_content,
        parent_comments.content as target_comment_content
      FROM notifications
      JOIN users ON notifications.actor_id = users.id
      LEFT JOIN posts ON notifications.post_id = posts.id
      LEFT JOIN comments ON notifications.comment_id = comments.id
      LEFT JOIN comments parent_comments ON comments.parent_comment_id = parent_comments.id
      WHERE notifications.recipient_id = ${userId}
      ORDER BY notifications.created_at DESC
      LIMIT 20
    `;

    return rows;
}

export async function getUnreadNotificationCount(userId: number) {
    if (shouldAutoEnsureReadSchema()) {
        await ensureNotificationsTable();
    }

    const { rows } = await sql<{ unread_count: number }>`
      SELECT COUNT(*)::int as unread_count
      FROM notifications
      WHERE recipient_id = ${userId}
        AND read_at IS NULL
    `;

    return rows[0]?.unread_count ?? 0;
}

export async function markNotificationsRead(userId: number) {
    await ensureNotificationsTable();

    await sql`
      UPDATE notifications
      SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
      WHERE recipient_id = ${userId}
        AND read_at IS NULL
    `;
}

export async function getPostAttachmentsForDelete(userId: number, postId: number, canModerate = false): Promise<string[]> {
    await ensureForumEnhancements();

    const { rows } = await sql<{ attachment_urls: string[] | null }>`
      SELECT ARRAY(
        SELECT DISTINCT url
        FROM (
          SELECT jsonb_array_elements_text(COALESCE(posts.attachment_urls, '[]'::jsonb)) as url
          UNION ALL
          SELECT posts.attachment_url as url
          WHERE posts.attachment_url IS NOT NULL AND posts.attachment_url != ''
          UNION ALL
          SELECT comments.attachment_url as url
          FROM comments
          WHERE comments.post_id = posts.id
            AND comments.attachment_url IS NOT NULL
            AND comments.attachment_url != ''
        ) attachment_values
        WHERE url IS NOT NULL AND url != ''
      ) as attachment_urls
      FROM posts
      WHERE id = ${postId} AND (${canModerate}::boolean OR author_id = ${userId})
      LIMIT 1
  `;

    return rows[0]?.attachment_urls || [];
}

export async function getCommentAttachmentForDelete(userId: number, commentId: number, canModerate = false): Promise<string> {
    await ensureForumEnhancements();

    const { rows } = await sql<{ attachment_url: string | null }>`
      SELECT attachment_url
      FROM comments
      WHERE id = ${commentId} AND (${canModerate}::boolean OR author_id = ${userId})
      LIMIT 1
  `;

    return rows[0]?.attachment_url || '';
}

export async function deletePost(userId: number, postId: number, canModerate = false): Promise<boolean> {
    const { rows } = await sql`SELECT author_id FROM posts WHERE id = ${postId}`;
    if (!rows[0] || (!canModerate && rows[0].author_id !== userId)) return false;

    // Cleanup
    await sql`DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ${postId})`;
    await sql`DELETE FROM post_likes WHERE post_id = ${postId}`;
    await sql`DELETE FROM bookmarks WHERE post_id = ${postId}`;
    await sql`DELETE FROM comments WHERE post_id = ${postId}`;
    await sql`DELETE FROM posts WHERE id = ${postId}`;
    return true;
}

export async function deleteComment(userId: number, commentId: number, canModerate = false): Promise<boolean> {
    const { rows } = await sql`SELECT author_id FROM comments WHERE id = ${commentId}`;
    if (!rows[0] || (!canModerate && rows[0].author_id !== userId)) return false;

    await sql`DELETE FROM comment_likes WHERE comment_id = ${commentId}`;
    await sql`DELETE FROM comments WHERE id = ${commentId}`;
    return true;
}

export async function initDB() {
    await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      role TEXT DEFAULT 'student',
      bio TEXT DEFAULT 'New member at Hajimi High!',
      avatar TEXT DEFAULT '😊',
      avatar_emoji TEXT DEFAULT '😊',
      avatar_theme TEXT DEFAULT 'lavender',
      profile_image TEXT,
      grade TEXT,
      age INTEGER,
      ethnicity TEXT,
      verification_status TEXT DEFAULT 'unverified',
      verification_type TEXT,
      verified_name TEXT,
      verified_grade TEXT,
      verified_subject TEXT,
      student_id_hash TEXT,
      student_id_last4 TEXT,
      verification_submitted_at TIMESTAMP WITH TIME ZONE,
      verified_at TIMESTAMP WITH TIME ZONE,
      verification_reviewed_by INTEGER,
      verification_note TEXT,
      streak_count INTEGER DEFAULT 0,
      last_checkin_at TIMESTAMP WITH TIME ZONE,
      daily_likes_count INTEGER DEFAULT 0,
      last_like_at TIMESTAMP WITH TIME ZONE,
      account_status TEXT DEFAULT 'active',
      disabled_at TIMESTAMP WITH TIME ZONE,
      disabled_by INTEGER,
      disabled_reason TEXT,
      badge_preferences JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  // Migration for existing tables
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_checkin_at TIMESTAMP WITH TIME ZONE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_likes_count INTEGER DEFAULT 0`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_like_at TIMESTAMP WITH TIME ZONE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_preferences JSONB DEFAULT '[]'::jsonb`;
    await sql`ALTER TABLE users ALTER COLUMN badge_preferences TYPE JSONB USING COALESCE(to_jsonb(badge_preferences), '[]'::jsonb)`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_emoji TEXT DEFAULT '😊'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_theme TEXT DEFAULT 'lavender'`;
    await sql`UPDATE users SET bio = 'New member at Hajimi High!' WHERE bio = 'New student at Hajimi High!'`;
    await ensureVerificationColumns();
    await ensureAdminAccountEnhancements();
  } catch (e) {
    console.log("Migration columns already exist or failed:", e);
  }

    await sql`
    CREATE TABLE IF NOT EXISTS checkins (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      checkin_date DATE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, checkin_date)
    );
  `;

    await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      content_format TEXT DEFAULT 'plain',
      type TEXT DEFAULT 'text',
      article_id INTEGER,
      tag TEXT DEFAULT 'general',
      attachment_url TEXT,
      attachment_urls JSONB DEFAULT '[]'::jsonb,
      likes INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

    await sql`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      attachment_url TEXT,
      likes INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

    await ensureForumEnhancements();
    await ensureArticlesTable();

    await sql`
    CREATE TABLE IF NOT EXISTS post_likes (
      user_id INTEGER NOT NULL REFERENCES users(id),
      post_id INTEGER NOT NULL REFERENCES posts(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );
  `;
    await ensureBookmarksTable();

    await sql`
    CREATE TABLE IF NOT EXISTS comment_likes (
      user_id INTEGER NOT NULL REFERENCES users(id),
      comment_id INTEGER NOT NULL REFERENCES comments(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, comment_id)
    );
  `;

    await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      emoji TEXT NOT NULL,
      url TEXT,
      tags JSONB DEFAULT '[]',
      accent_color TEXT,
      status TEXT DEFAULT 'live',
      likes INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

    await sql`
    CREATE TABLE IF NOT EXISTS project_comments (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

    await sql`
    CREATE TABLE IF NOT EXISTS project_likes (
      user_id INTEGER NOT NULL REFERENCES users(id),
      project_id INTEGER NOT NULL REFERENCES projects(id),
      score NUMERIC DEFAULT 5,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, project_id)
    );
  `;
    await ensureProjectEnhancements();
    await ensureProjectSubmissionsTable();
    await ensureProjectOpenEventsTable();
    await ensureProjectBookmarksTable();
    await ensureProjectTipsTable();
    await ensureCoinTables();

    await ensurePointAwardsTable();
    await sql`CREATE INDEX IF NOT EXISTS idx_point_awards_user_key ON point_awards(user_id, award_key)`;
    await ensureVerificationColumns();
    await ensureNotificationsTable();
    await ensureAdminAuditTable();

    // Seeding logic (optional, but keep for now if needed)
    // In a real app, we'd run a separate seed script.
}
