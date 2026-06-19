#!/usr/bin/env node
'use strict';
// One-off audit: find selectors whose base64 background-image gets wiped by a
// later `background:` shorthand rule on the same selector.
const fs = require('fs');

const files = [
  'miniprogram/pages/tutor/tutor.wxss',
  'miniprogram/pages/review/review.wxss',
  'miniprogram/pages/profile/profile.wxss'
];

let found = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const ruleRe = /([^{}]+)\{([^}]*)\}/g;
  const rules = [];
  let m;
  while ((m = ruleRe.exec(src))) {
    rules.push({ sel: m[1].trim(), body: m[2], idx: m.index });
  }
  const imgSelectors = new Set();
  rules.forEach((r) => {
    if (r.body.includes('background-image: url("data:image')) {
      r.sel.split(',').forEach((s) => imgSelectors.add(s.trim()));
    }
  });
  imgSelectors.forEach((sel) => {
    const same = rules.filter((r) => r.sel.split(',').map((s) => s.trim()).includes(sel));
    const lastImg = same.reduce((acc, r, i) => (r.body.includes('background-image') ? i : acc), -1);
    same.forEach((r, i) => {
      if (i > lastImg && /(^|;)\s*background:\s*[^;]+;/.test(r.body)) {
        console.log('WIPE', file, '→', sel);
        found += 1;
      }
    });
  });
}
if (found > 0) {
  console.error(`${found} shorthand background rules wipe earlier inline-SVG icons; use background-color instead.`);
  process.exit(1);
}
console.log('clean: no shorthand wipes after image rules');
