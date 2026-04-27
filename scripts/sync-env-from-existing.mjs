#!/usr/bin/env node
/**
 * 从用户既有项目（moriwork / studypal / yuandian-remotion / 自身）同步必要 env
 * 到 ai-edu-platform/.env.local，做字段名 mapping。
 *
 * 用法：
 *   node scripts/sync-env-from-existing.mjs [--dry-run]
 *
 * 不会暴露 key 值到 stdout，只输出字段命中状态。
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const ROOT = 'C:/Users/86136/Desktop/claude';

const SOURCES = [
    path.join(ROOT, 'ai-edu-platform/.env.local'),       // 自身既有
    path.join(ROOT, 'moriwork/.env.local'),              // SUPABASE_*
    path.join(ROOT, 'studypal/.env.local'),              // SUPABASE_ANON
    path.join(ROOT, 'yuandian-remotion/.env.local'),     // DASHSCOPE
    path.join(ROOT, 'miralife/.env.local'),
    path.join(ROOT, 'wenai/.env.local'),
];

const TARGET_FILE = path.join(ROOT, 'ai-edu-platform/.env.local');

const dryRun = process.argv.includes('--dry-run');

function parseEnv(file) {
    if (!fs.existsSync(file)) return {};
    const txt = fs.readFileSync(file, 'utf-8');
    const obj = {};
    txt.split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (m) obj[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
    return obj;
}

// 收集所有源
const merged = {};
for (const src of SOURCES) {
    const e = parseEnv(src);
    for (const [k, v] of Object.entries(e)) {
        if (v && !merged[k]) merged[k] = v;       // 第一次出现的优先
    }
}

// 字段映射：ai-edu-platform 端点期望名 ← 用户既有命名
const MAPPING = {
    DEEPSEEK_KEY:              merged.DEEPSEEK_KEY              || merged.DEEPSEEK_API_KEY,
    QWEN_KEY:                  merged.QWEN_KEY                  || merged.DASHSCOPE_API_KEY,
    SUPABASE_URL:              merged.SUPABASE_URL              || merged.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY:         merged.SUPABASE_ANON_KEY         || merged.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: merged.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_TOKEN:               merged.ADMIN_TOKEN || crypto.randomBytes(16).toString('hex'),
    NCDM_HOST:                 merged.NCDM_HOST || '',
    CONFUCIUS_HOST:            merged.CONFUCIUS_HOST || '',
    FEISHU_WEBHOOK_URL:        merged.FEISHU_WEBHOOK_URL || '',
};

// 状态报告（不暴露值）
console.log('=== 源扫描 ===');
for (const src of SOURCES) {
    const e = parseEnv(src);
    const found = Object.keys(e).filter(k => /API_KEY|_KEY|_URL|_TOKEN|_HOST/.test(k));
    if (found.length) console.log(`  ${src.replace(ROOT, '.')}  →  ${found.join(', ')}`);
}

console.log('\n=== 同步结果 ===');
const summary = [];
for (const [k, v] of Object.entries(MAPPING)) {
    const status = v ? '✓ 命中' : '✗ 缺失';
    summary.push(`  ${k.padEnd(28)} ${status}`);
}
console.log(summary.join('\n'));

const missing = Object.entries(MAPPING).filter(([k, v]) => !v).map(([k]) => k);
if (missing.length) {
    console.log(`\n⚠️  以下 ${missing.length} 个 key 未在任何 .env.local 找到：`);
    missing.forEach(k => console.log(`   · ${k}`));
}

if (dryRun) {
    console.log('\n[dry-run] 不写文件。实际跑：node scripts/sync-env-from-existing.mjs');
    process.exit(0);
}

// 写 .env.local（合并：保留原有非冲突字段 + 新增映射）
const existing = parseEnv(TARGET_FILE);
const finalEnv = { ...existing, ...Object.fromEntries(Object.entries(MAPPING).filter(([k, v]) => v)) };

const lines = [
    '# ai-edu-platform · .env.local',
    `# 由 sync-env-from-existing.mjs 自动生成于 ${new Date().toISOString()}`,
    '# 不要 push 到 git',
    '',
];
for (const [k, v] of Object.entries(finalEnv)) {
    lines.push(`${k}=${v}`);
}

fs.writeFileSync(TARGET_FILE, lines.join('\n') + '\n');

const fileStat = fs.statSync(TARGET_FILE);
console.log(`\n✓ 写入 ${TARGET_FILE}（${fileStat.size} bytes，${Object.keys(finalEnv).length} 字段）`);
console.log('\n下一步：');
console.log('  · vercel env pull        把 Vercel 上既有 env 拉下来对比');
console.log('  · 或手动登 Vercel Dashboard 把这些字段复制过去（生产环境）');
