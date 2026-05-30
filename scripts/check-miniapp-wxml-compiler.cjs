const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const miniprogramRoot = path.join(root, 'miniprogram');
const outputDir = path.join(root, 'tmp_report_inspect', 'wcc-compile');

const wccCandidates = [
  'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\code\\package.nw\\node_modules\\wcc-exec\\wcc.exe',
  'C:\\Program Files\\Tencent\\微信web开发者工具\\code\\package.nw\\node_modules\\wcc-exec\\wcc.exe'
];

function walk(dir, out = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git'].includes(entry.name)) walk(full, out);
      return;
    }
    if (entry.isFile() && entry.name.endsWith('.wxml')) out.push(full);
  });
  return out;
}

const wcc = wccCandidates.find((candidate) => fs.existsSync(candidate));
if (!wcc) {
  console.log('WeChat wcc.exe not found; skipping native WXML compiler check.');
  process.exit(0);
}

fs.mkdirSync(outputDir, { recursive: true });

const failures = [];
const files = walk(miniprogramRoot).sort();

files.forEach((file) => {
  const relative = path.relative(miniprogramRoot, file).replace(/\\/g, '/');
  const output = path.join(outputDir, `${relative.replace(/[\\/]/g, '__')}.js`);
  const result = spawnSync(wcc, ['-o', output, file], {
    cwd: miniprogramRoot,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    failures.push({
      file: relative,
      message: `${result.stderr || result.stdout || ''}`.trim()
    });
  }
});

if (failures.length) {
  console.error(`Native WXML compiler failed for ${failures.length}/${files.length} files.`);
  failures.forEach((failure) => {
    console.error(`\n${failure.file}`);
    console.error(failure.message);
  });
  process.exit(1);
}

console.log(`Native WXML compiler check passed for ${files.length} files.`);
