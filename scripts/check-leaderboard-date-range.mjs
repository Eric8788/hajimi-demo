import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const checks = [
  {
    file: 'src/lib/hubRankings.ts',
    patterns: [
      /HubLeaderboardWindow[\s\S]*\| 'custom'/,
      /windowType === 'custom'/,
      /unique_open_count_custom/,
      /effective_open_count_custom/,
    ],
  },
  {
    file: 'src/app/api/projects/stats/route.ts',
    patterns: [
      /searchParams\.get\('start'\)/,
      /searchParams\.get\('end'\)/,
      /getProjectOpenStats\(range\)/,
    ],
  },
  {
    file: 'src/lib/db.ts',
    patterns: [
      /getProjectOpenStats\(range\?: \{ startDate: string; endDate: string \}\)/,
      /custom_start/,
      /custom_end/,
      /unique_open_count_custom/,
      /effective_open_count_custom/,
    ],
  },
  {
    file: 'src/components/HubLeaderboardWidget.tsx',
    patterns: [
      /defaultRangeStart/,
      /setWindowType\('custom'\)/,
      /Hub ranking custom date range/,
      /\/api\/projects\/stats\$\{statsQuery\}/,
    ],
  },
  {
    file: 'src/app/leaderboard/page.tsx',
    patterns: [
      /params\.window === 'custom'/,
      /defaultHubRangeStart/,
      /defaultHubRangeEnd/,
    ],
  },
  {
    file: 'src/app/globals.css',
    patterns: [
      /\.hub-rank-date-range/,
    ],
  },
];

const failures = [];

for (const check of checks) {
  const source = readFileSync(join(root, check.file), 'utf8');
  for (const pattern of check.patterns) {
    if (!pattern.test(source)) {
      failures.push(`${check.file} missing ${pattern}`);
    }
  }
}

if (failures.length) {
  console.error('Leaderboard custom date range guard failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Leaderboard custom date range guard passed.');
