import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLiveTelemetrySvg, loadVectorFonts } from './svg-text-compiler.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const USERNAME = process.env.GITHUB_REPOSITORY_OWNER || 'ManasSoni-2009';
// Works both inside main workspace (writes to github-profile/assets) and standalone profile repo (writes to assets)
const OUTPUT_SVG =
  path.basename(ROOT) === 'github-profile' || process.env.GITHUB_ACTIONS === 'true'
    ? path.join(ROOT, 'assets', '04_telemetry_live.svg')
    : path.join(ROOT, 'github-profile', 'assets', '04_telemetry_live.svg');

async function fetchGitHubJson(endpoint) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'manas-soni-monolith-telemetry',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(`https://api.github.com${endpoint}`, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${endpoint} responded ${res.status}`);
  }
  return res.json();
}

async function main() {
  const fonts = await loadVectorFonts();

  let telemetry = {
    publicRepos: 14,
    totalStars: 8,
    topLanguages: ['TYPESCRIPT', 'RUST', 'PYTHON', 'JAVASCRIPT'],
    updatedDate: new Date().toISOString().slice(0, 10),
    activityBars: [5, 8, 6, 9, 7, 10, 12, 8, 6, 9, 11, 13, 7, 9, 10, 12, 8, 10, 11, 9, 13, 10, 12, 11],
  };

  try {
    const [user, repos, events] = await Promise.all([
      fetchGitHubJson(`/users/${USERNAME}`),
      fetchGitHubJson(`/users/${USERNAME}/repos?per_page=100&type=owner`),
      fetchGitHubJson(`/users/${USERNAME}/events/public?per_page=100`),
    ]);

    const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
    const langCounts = new Map();
    for (const r of repos) {
      if (r.language) {
        langCounts.set(r.language.toUpperCase(), (langCounts.get(r.language.toUpperCase()) || 0) + 1);
      }
    }
    const topLanguages = [...langCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([lang]) => lang);

    // Bucket recent public events across 24 sliding activity slots
    const buckets = new Array(24).fill(1);
    const now = Date.now();
    for (const ev of events) {
      const ageDays = Math.floor((now - new Date(ev.created_at).getTime()) / (1000 * 60 * 60 * 24));
      if (ageDays >= 0 && ageDays < 24) {
        buckets[23 - ageDays] += 2;
      }
    }

    telemetry = {
      publicRepos: user.public_repos ?? repos.length,
      totalStars,
      topLanguages: topLanguages.length > 0 ? topLanguages : telemetry.topLanguages,
      updatedDate: new Date().toISOString().slice(0, 10),
      activityBars: buckets,
    };
    console.log(`[sync] Live GitHub telemetry fetched for @${USERNAME}: ${telemetry.publicRepos} repos, ${telemetry.totalStars} stars.`);
  } catch (err) {
    console.warn(`[sync] Falling back to baseline telemetry (${err.message}).`);
  }

  await fs.mkdir(path.dirname(OUTPUT_SVG), { recursive: true });
  await fs.writeFile(OUTPUT_SVG, buildLiveTelemetrySvg(fonts, telemetry), 'utf8');
  console.log(`[sync] Wrote ${OUTPUT_SVG}`);
}

main().catch((err) => {
  console.error('[sync] Failed:', err);
  process.exit(1);
});
