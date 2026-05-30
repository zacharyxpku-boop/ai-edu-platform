const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const serviceAccessJs = read('miniprogram/utils/service-access.js');
assert(serviceAccessJs.includes('buildWeeklySupportSummary'), 'Service access can build weekly support summary');
assert(serviceAccessJs.includes('local_service_notice'), 'Service access has honest local-service mode');
assert(serviceAccessJs.includes('configured'), 'Service access has configured-service mode');

const profileWxml = read('miniprogram/pages/profile/profile.wxml');
assert(profileWxml.includes('parent-hero-shell') && profileWxml.includes('parent-dash-proof-grid'), 'Profile first screen keeps parent proof recap');
assert(profileWxml.includes('parent-dash-evidence') && profileWxml.includes('parent-dash-route'), 'Profile first screen keeps evidence and next step');
assert(!profileWxml.includes('订阅') && !profileWxml.includes('解锁') && !profileWxml.includes('价格'), 'Profile shell hides payment copy');

console.log('All validation sprint tests pass.');
