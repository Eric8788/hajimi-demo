import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db, sql } from '@vercel/postgres';

const TARGET_TOTAL_SHARES = 500;
const TARGET_FOUNDER_SHARES = 350;
const TARGET_PUBLIC_SHARES = 100;
const TARGET_RESERVED_PUBLIC_SHARES = 50;
const TARGET_HOLDING_CAP = 30;

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const source = readFileSync(filePath, 'utf8');
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function asInt(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    json: argv.includes('--json'),
  };
}

async function tableExists(name) {
  const result = await sql`
    SELECT to_regclass(${`public.${name}`}) IS NOT NULL as exists
  `;
  return Boolean(result.rows[0]?.exists);
}

async function getCompanyAudits(query = sql) {
  const result = await query`
    WITH position_stats AS (
      SELECT
        company_id,
        COALESCE(SUM(public_shares), 0)::int as public_shares_held,
        COALESCE(SUM(locked_shares), 0)::int as locked_shares_held,
        COUNT(*) FILTER (WHERE public_shares > 0)::int as public_holder_count,
        COALESCE(MAX(public_shares), 0)::int as max_public_holding,
        COALESCE(
          json_agg(
            json_build_object(
              'user_id', user_id,
              'public_shares', public_shares
            )
            ORDER BY public_shares DESC
          ) FILTER (WHERE public_shares > ${TARGET_HOLDING_CAP}),
          '[]'::json
        ) as over_cap_holders
      FROM hasdaq_positions
      GROUP BY company_id
    ),
    trade_stats AS (
      SELECT
        company_id,
        COALESCE(SUM(CASE WHEN type IN ('ipo_buy', 'buy') THEN shares WHEN type = 'sell' THEN -shares ELSE 0 END), 0)::int as net_public_traded_shares,
        COALESCE(SUM(CASE WHEN type IN ('ipo_buy', 'buy') THEN gross_amount WHEN type = 'sell' THEN -gross_amount ELSE 0 END), 0)::int as net_pool_coin_amount
      FROM hasdaq_trades
      WHERE status = 'filled'
      GROUP BY company_id
    )
    SELECT
      hasdaq_companies.id,
      hasdaq_companies.ticker,
      hasdaq_companies.name,
      hasdaq_companies.company_type,
      hasdaq_companies.status,
      hasdaq_companies.total_shares,
      hasdaq_companies.founder_shares,
      hasdaq_companies.public_shares_total,
      hasdaq_companies.public_shares_remaining,
      hasdaq_companies.h_coin_pool,
      COALESCE(position_stats.public_shares_held, 0)::int as public_shares_held,
      COALESCE(position_stats.locked_shares_held, 0)::int as locked_shares_held,
      COALESCE(position_stats.public_holder_count, 0)::int as public_holder_count,
      COALESCE(position_stats.max_public_holding, 0)::int as max_public_holding,
      COALESCE(position_stats.over_cap_holders, '[]'::json) as over_cap_holders,
      COALESCE(trade_stats.net_public_traded_shares, 0)::int as net_public_traded_shares,
      COALESCE(trade_stats.net_pool_coin_amount, 0)::int as net_pool_coin_amount
    FROM hasdaq_companies
    LEFT JOIN position_stats ON position_stats.company_id = hasdaq_companies.id
    LEFT JOIN trade_stats ON trade_stats.company_id = hasdaq_companies.id
    ORDER BY hasdaq_companies.company_type DESC, hasdaq_companies.ticker ASC
  `;

  return result.rows.map(row => {
    const publicSharesHeld = asInt(row.public_shares_held);
    const lockedSharesHeld = asInt(row.locked_shares_held);
    const hCoinPool = asInt(row.h_coin_pool);
    const netPoolCoinAmount = Math.max(0, asInt(row.net_pool_coin_amount));
    const overCapHolders = Array.isArray(row.over_cap_holders) ? row.over_cap_holders : [];
    return {
      id: Number(row.id),
      ticker: row.ticker,
      name: row.name,
      companyType: row.company_type,
      status: row.status,
      current: {
        totalShares: asInt(row.total_shares),
        founderShares: asInt(row.founder_shares),
        publicSharesTotal: asInt(row.public_shares_total),
        publicSharesRemaining: asInt(row.public_shares_remaining),
        hCoinPool,
      },
      actual: {
        publicSharesHeld,
        lockedSharesHeld,
        publicHolderCount: asInt(row.public_holder_count),
        maxPublicHolding: asInt(row.max_public_holding),
        overCapHolders,
      },
      target: {
        totalShares: TARGET_TOTAL_SHARES,
        founderShares: TARGET_FOUNDER_SHARES,
        publicSharesTotal: TARGET_PUBLIC_SHARES,
        reservedPublicSharesNotTradableInV1: TARGET_RESERVED_PUBLIC_SHARES,
        publicSharesRemaining: Math.max(0, TARGET_PUBLIC_SHARES - publicSharesHeld),
        hCoinPool: Math.max(hCoinPool, netPoolCoinAmount),
      },
      flags: {
        negativePoolIfMigrated: publicSharesHeld > TARGET_PUBLIC_SHARES,
        exceedsPerUserCap: overCapHolders.length > 0,
        grandfatheredOverCapHolders: overCapHolders.length,
        founderSharesNeedRebalance: lockedSharesHeld > TARGET_FOUNDER_SHARES,
        officialDemo: row.company_type === 'official_demo',
      },
    };
  });
}

async function rebalanceFounderSharesForCompany(client, companyId) {
  const { rows } = await client.sql`
    SELECT user_id, locked_shares
    FROM hasdaq_positions
    WHERE company_id = ${companyId}
      AND locked_shares > 0
    ORDER BY locked_shares DESC, user_id ASC
    FOR UPDATE
  `;
  if (!rows.length) return;

  const totalLocked = rows.reduce((sum, row) => sum + asInt(row.locked_shares), 0);
  let allocated = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const nextLocked = index === rows.length - 1
      ? Math.max(0, TARGET_FOUNDER_SHARES - allocated)
      : Math.floor(TARGET_FOUNDER_SHARES * asInt(row.locked_shares) / Math.max(1, totalLocked));
    allocated += nextLocked;
    await client.sql`
      UPDATE hasdaq_positions
      SET locked_shares = ${nextLocked},
          updated_at = CURRENT_TIMESTAMP
      WHERE company_id = ${companyId}
        AND user_id = ${row.user_id}
    `;
  }
}

async function rebalanceMemberFounderSharesForCompany(client, companyId) {
  const { rows } = await client.sql`
    SELECT id, founder_shares
    FROM hasdaq_company_members
    WHERE company_id = ${companyId}
      AND founder_shares > 0
    ORDER BY founder_shares DESC, id ASC
    FOR UPDATE
  `;
  if (!rows.length) return;

  const totalMemberShares = rows.reduce((sum, row) => sum + asInt(row.founder_shares), 0);
  let allocated = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const nextShares = index === rows.length - 1
      ? Math.max(0, TARGET_FOUNDER_SHARES - allocated)
      : Math.floor(TARGET_FOUNDER_SHARES * asInt(row.founder_shares) / Math.max(1, totalMemberShares));
    allocated += nextShares;
    await client.sql`
      UPDATE hasdaq_company_members
      SET founder_shares = ${nextShares}
      WHERE id = ${row.id}
    `;
  }
}

async function applyMigration() {
  const client = await db.connect();
  try {
    await client.sql`BEGIN`;
    await client.sql`LOCK TABLE hasdaq_companies, hasdaq_positions, hasdaq_trades, hasdaq_company_members IN SHARE ROW EXCLUSIVE MODE`;
    const audits = await getCompanyAudits((strings, ...values) => client.sql(strings, ...values));

    for (const audit of audits) {
      await client.sql`
        UPDATE hasdaq_companies
        SET
          total_shares = ${TARGET_TOTAL_SHARES},
          founder_shares = ${TARGET_FOUNDER_SHARES},
          public_shares_total = ${TARGET_PUBLIC_SHARES},
          public_shares_remaining = ${audit.target.publicSharesRemaining},
          h_coin_pool = GREATEST(COALESCE(h_coin_pool, 0), ${audit.target.hCoinPool}),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${audit.id}
      `;

      await rebalanceMemberFounderSharesForCompany(client, audit.id);
      await rebalanceFounderSharesForCompany(client, audit.id);
    }

    await client.sql`COMMIT`;
    return audits;
  } catch (error) {
    await client.sql`ROLLBACK`;
    throw error;
  } finally {
    client.release();
  }
}

function summarize(audits, mode) {
  return {
    mode,
    targetRules: {
      totalShares: TARGET_TOTAL_SHARES,
      founderShares: TARGET_FOUNDER_SHARES,
      publicSharesTotal: TARGET_PUBLIC_SHARES,
      reservedPublicSharesNotTradableInV1: TARGET_RESERVED_PUBLIC_SHARES,
      perUserPublicHoldingCap: TARGET_HOLDING_CAP,
    },
    companyCount: audits.length,
    negativePoolCount: audits.filter(item => item.flags.negativePoolIfMigrated).length,
    overCapCompanyCount: audits.filter(item => item.flags.exceedsPerUserCap).length,
    founderRebalanceCompanyCount: audits.filter(item => item.flags.founderSharesNeedRebalance).length,
    officialDemoCount: audits.filter(item => item.flags.officialDemo).length,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadEnvFile(resolve(process.cwd(), '.env.local'));

  if (!process.env.POSTGRES_URL && !process.env.POSTGRES_URL_NON_POOLING && !process.env.DATABASE_URL) {
    throw new Error('Missing POSTGRES_URL/POSTGRES_URL_NON_POOLING/DATABASE_URL. Dry-run audit needs a database connection.');
  }

  const requiredTables = ['hasdaq_companies', 'hasdaq_positions', 'hasdaq_trades', 'hasdaq_company_members'];
  const missing = [];
  for (const table of requiredTables) {
    if (!(await tableExists(table))) missing.push(table);
  }
  if (missing.length) throw new Error(`Missing Hasdaq tables: ${missing.join(', ')}`);

  const audits = options.apply ? await applyMigration() : await getCompanyAudits();
  const payload = {
    ...summarize(audits, options.apply ? 'apply' : 'dry-run'),
    applied: options.apply,
    companies: audits,
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`Hasdaq v1.4 ${payload.mode} audit`);
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
