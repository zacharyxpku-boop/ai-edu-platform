#!/usr/bin/env node
'use strict';

const DEFAULT_ORIGIN = 'https://yuandianzhixue.com';
const cacheBust = process.argv.includes('--cache-bust') || process.env.WEB_LIVE_CACHE_BUST === '1';
const originArg = process.argv.slice(2).find((arg) => arg && !arg.startsWith('--'));
const origin = (process.env.WEB_LIVE_ORIGIN || originArg || DEFAULT_ORIGIN).replace(/\/$/, '');

const checks = [
  {
    label: 'official homepage app entry',
    path: '/',
    mustInclude: ['href="/app"', '网页版体验', '查看网页版原型']
  },
  {
    label: 'official app shell',
    path: '/app',
    mustInclude: ['web-app-asset-base', '/apps/web/src/app.js', '/apps/web/src/styles.css']
  },
  {
    label: 'web styles',
    path: '/apps/web/src/styles.css',
    mustInclude: ['.app-shell', '.mobile-launchboard', '.web-toast']
  },
  {
    label: 'web app script',
    path: '/apps/web/src/app.js',
    mustInclude: ['WEB_SURFACE_ROUTES', 'WEB_DEMO_STATE', 'bindSearch', 'bindActions']
  },
  {
    label: 'web routes',
    path: '/apps/web/src/routes.js',
    mustInclude: ['WEB_SURFACE_ROUTES', 'WEB_ENTRY_FLOW']
  },
  {
    label: 'web view model',
    path: '/apps/web/src/view-model.js',
    mustInclude: ['WEB_DEMO_STATE', 'WEB_PAGE_GUIDES', 'WEB_CONFIDENCE_BANDS']
  },
  {
    label: 'brand mascot',
    path: '/apps/web/assets/brand/gudian-mascot.png',
    binary: true
  },
  {
    label: 'review sprout',
    path: '/apps/web/assets/brand/review-sprout.png',
    binary: true
  }
];

async function fetchCheck(check) {
  const url = `${origin}${check.path}${cacheBust ? `${check.path.includes('?') ? '&' : '?'}v=${Date.now()}` : ''}`;
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache'
    }
  });

  if (!response.ok) {
    throw new Error(`${check.label} returned HTTP ${response.status} at ${url}`);
  }

  if (check.binary) {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 100) {
      throw new Error(`${check.label} looked too small (${bytes.byteLength} bytes) at ${url}`);
    }
    return;
  }

  const text = await response.text();
  for (const snippet of check.mustInclude || []) {
    if (!text.includes(snippet)) {
      throw new Error(`${check.label} is missing snippet "${snippet}" at ${url}`);
    }
  }
}

async function main() {
  const failures = [];
  for (const check of checks) {
    try {
      await fetchCheck(check);
      console.log(`OK ${check.label}: ${origin}${check.path}`);
    } catch (error) {
      failures.push(error.message || String(error));
      console.error(`FAIL ${check.label}: ${error.message || error}`);
    }
  }

  if (failures.length) {
    console.error('');
    console.error(`Official live Web app check failed for ${origin}${cacheBust ? ' with cache-busting enabled' : ''}.`);
    process.exit(1);
  }

  console.log('');
  console.log(`Official live Web app check passed for ${origin}${cacheBust ? ' with cache-busting enabled' : ''}.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
