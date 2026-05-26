#!/usr/bin/env node
'use strict';

const DEFAULT_HOST = 'https://yuandianzhixue.com';

const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || '';
const zoneId = process.env.CLOUDFLARE_ZONE_ID || process.env.CF_ZONE_ID || '';
const host = (process.env.WEB_LIVE_ORIGIN || DEFAULT_HOST).replace(/\/$/, '');

const defaultPaths = [
  '/',
  '/app',
  '/app/',
  '/apps/web/src/styles.css',
  '/apps/web/src/app.js',
  '/apps/web/src/routes.js',
  '/apps/web/src/view-model.js',
  '/apps/web/assets/brand/gudian-mascot.png',
  '/apps/web/assets/brand/review-sprout.png'
];

function usage() {
  console.error('Cloudflare cache purge requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID.');
  console.error('Example:');
  console.error('  set CLOUDFLARE_API_TOKEN=...');
  console.error('  set CLOUDFLARE_ZONE_ID=...');
  console.error('  npm.cmd run web:cache:purge');
}

function requestedFiles() {
  const rawFiles = process.argv.slice(2).filter(Boolean);
  const paths = rawFiles.length ? rawFiles : defaultPaths;
  return paths.map((item) => {
    if (/^https?:\/\//i.test(item)) return item;
    return `${host}${item.startsWith('/') ? item : `/${item}`}`;
  });
}

async function main() {
  if (!token || !zoneId) {
    usage();
    process.exit(1);
  }

  const files = requestedFiles();
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ files })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success !== true) {
    console.error('Cloudflare cache purge failed.');
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  console.log(`Cloudflare cache purge accepted for ${files.length} files.`);
  for (const file of files) console.log(`- ${file}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
