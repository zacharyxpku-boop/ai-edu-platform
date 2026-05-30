#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const storageMap = {};

global.wx = {
  getStorageSync(key) {
    return storageMap[key];
  },
  setStorageSync(key, value) {
    storageMap[key] = value;
  },
  removeStorageSync(key) {
    delete storageMap[key];
  }
};

const unsafeFields = [
  'original_question',
  'full_answer',
  'photo',
  'score',
  'ranking',
  'full_dialogue'
];

const identityContactFields = [
  'child_name',
  'parent_phone',
  'parent_wechat',
  'contact_info'
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function loadCommonJs(filePath, requireMap = {}) {
  const full = path.join(root, filePath);
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require(request) {
      if (Object.prototype.hasOwnProperty.call(requireMap, request)) {
        const mapped = requireMap[request];
        if (mapped && mapped.__throw) throw new Error(mapped.message || `blocked require: ${request}`);
        return mapped;
      }
      return require(request);
    },
    console,
    wx: global.wx,
    Date,
    Math,
    String,
    Number,
    Object,
    Array,
    RegExp,
    JSON,
    Set
  };
  vm.runInNewContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: full });
  return module.exports;
}

function assertNoUnsafeDataFields(label, record) {
  unsafeFields.forEach((field) => {
    assert(!Object.prototype.hasOwnProperty.call(record, field), `${label} must not persist ${field}`);
  });
  identityContactFields.forEach((field) => {
    assert(!Object.prototype.hasOwnProperty.call(record, field), `${label} must not persist ${field}`);
  });
}

const gameLogic = loadCommonJs('miniprogram/utils/game-logic.js');
const shareRelaySchema = loadCommonJs('miniprogram/utils/share-relay-schema.js');
const shareRelaySchemaCjs = require('../miniprogram/utils/share-relay-schema.cjs');
const storage = loadCommonJs('miniprogram/utils/storage.js', {
  './learning-priority': {},
  './share-relay-schema': shareRelaySchema,
  './game-logic': gameLogic,
  './product-readiness': loadCommonJs('miniprogram/utils/product-readiness.js')
});

const fallbackStorage = loadCommonJs('miniprogram/utils/storage.js', {
  './learning-priority': {},
  './share-relay-schema': { __throw: true, message: 'force share schema fallback' },
  './share-relay-schema.cjs': { __throw: true, message: 'force cjs share schema fallback' },
  './game-logic': gameLogic,
  './product-readiness': loadCommonJs('miniprogram/utils/product-readiness.js')
});

const shareCode = `relay_safety_${Date.now()}`;
const schemaPayload = shareRelaySchema.buildSafeSharePayload({
  code: shareCode,
  payload: {
    relay_id: 'relay_schema_round_trip',
    relay_first_step: 'schema first step only',
    relay_receiver_action: 'receiver uses own material',
    relay_next_revisit: 'tomorrow revisit',
    original_question: 'unsafe original question',
    full_answer: 'unsafe full answer',
    photo: 'unsafe photo',
    unsafe_extra_token: 'must not pass through'
  }
}, 'peer_challenge', {
  from: 'peer_challenge',
  mode: 'same_identity',
  challenge: 'arcade'
});
const schemaPath = shareRelaySchema.buildShareRelayQuery('/pages/home/home', schemaPayload);
const schemaQuery = Object.fromEntries(new URLSearchParams(schemaPath.split('?')[1] || ''));
const schemaIncoming = storage.saveIncomingShare(shareRelaySchema.parseShareRelayQuery(schemaQuery));
assert(schemaPath.startsWith('/pages/home/home?'), 'share relay schema builds a home landing path');
assert(schemaPath.includes('share=') && schemaPath.includes('share_code='), 'share relay schema carries both miniapp landing share alias and internal share_code');
assert.strictEqual(schemaIncoming.share_code, shareCode, 'schema-built path round-trips through saveIncomingShare');
assertNoUnsafeDataFields('schema round-trip incoming share', schemaIncoming);
assert(!Object.prototype.hasOwnProperty.call(schemaIncoming, 'unsafe_extra_token'), 'schema round-trip drops unknown non-allowlisted fields');
assert.strictEqual(schemaIncoming.relay_receiver_action, 'receiver uses own material', 'schema round-trip keeps receiver action');

const longRelayPayload = shareRelaySchema.buildSafeSharePayload({
  code: `${shareCode}_compact`,
  payload: Object.assign({}, schemaPayload, {
    share_code: `${shareCode}_compact`,
    relay_receiver_action: 'receiver repeats only the first step on own material',
    relay_parent_check: 'parent asks one question only',
    relay_next_revisit: 'tomorrow revisit after own material attempt',
    source_challenge_prompt: 'x'.repeat(220),
    visual_board_relay_layer: 'y'.repeat(220),
    socratic_report_decision: 'z'.repeat(220),
    report_daily_action: 'review one own-material card tomorrow',
    unified_next_action: 'return to the same wrong-cause card',
    unified_next_action_route: '/pages/review/review?from=compact_share',
    original_question: 'unsafe compact original question',
    full_answer: 'unsafe compact full answer',
    unsafe_extra_token: 'must not enter compact relay pack'
  })
}, 'peer_challenge', {
  from: 'peer_challenge',
  mode: 'same_identity',
  challenge: 'arcade'
});
const compactPath = shareRelaySchema.buildShareRelayQuery('/pages/home/home', longRelayPayload, { forceCompact: true });
const compactQuery = Object.fromEntries(new URLSearchParams(compactPath.split('?')[1] || ''));
const compactIncoming = storage.saveIncomingShare(shareRelaySchema.parseShareRelayQuery(compactQuery));
assert(compactPath.includes('relay_pack_schema=safe_relay_compact_v1'), 'long share relay path uses compact safe relay pack');
assert(compactPath.length < 1200, 'compact relay path stays under miniapp-friendly length');
assert.strictEqual(compactIncoming.share_code, `${shareCode}_compact`, 'compact relay path round-trips share code');
assert.strictEqual(compactIncoming.relay_receiver_action, 'receiver repeats only the first step on own material', 'compact relay keeps primary receiver action');
assert.strictEqual(compactIncoming.relay_parent_check, 'parent asks one question only', 'compact relay restores packed parent check');
assertNoUnsafeDataFields('compact relay incoming share', compactIncoming);
assert(!Object.prototype.hasOwnProperty.call(compactIncoming, 'unsafe_extra_token'), 'compact relay drops unknown non-allowlisted fields');

const cjsDirectCompact = shareRelaySchemaCjs.buildCompactRelayPayload({
  share_code: `${shareCode}_cjs_direct`,
  relay_receiver_action: 'receiver own material only',
  unsafe_extra_token: 'must not enter cjs compact relay pack',
  talent_label: 'fixed talent label must not enter cjs compact relay pack'
});
const cjsDirectPack = cjsDirectCompact.relay_pack ? JSON.parse(cjsDirectCompact.relay_pack) : {};
assert.strictEqual(cjsDirectCompact.share_code, `${shareCode}_cjs_direct`, 'cjs compact keeps safe primary share code');
assert.strictEqual(cjsDirectCompact.relay_receiver_action, 'receiver own material only', 'cjs compact keeps safe primary receiver action');
assert(!Object.prototype.hasOwnProperty.call(cjsDirectPack, 'unsafe_extra_token'), 'cjs compact relay pack drops unknown non-allowlisted fields');
assert(!Object.prototype.hasOwnProperty.call(cjsDirectPack, 'talent_label'), 'cjs compact relay pack drops unsafe talent labels');
const cjsParsed = shareRelaySchemaCjs.parseShareRelayQuery({
  share_code: `${shareCode}_cjs_parse`,
  relay_pack: JSON.stringify({
    relay_parent_check: 'parent asks one question',
    unsafe_extra_token: 'must not parse from cjs relay pack',
    original_question: 'must not parse original question'
  })
});
assert.strictEqual(cjsParsed.share_code, `${shareCode}_cjs_parse`, 'cjs parser keeps safe share code');
assert.strictEqual(cjsParsed.relay_parent_check, 'parent asks one question', 'cjs parser restores allowlisted relay pack field');
assert(!Object.prototype.hasOwnProperty.call(cjsParsed, 'unsafe_extra_token'), 'cjs parser drops unknown relay pack fields');
assert(!Object.prototype.hasOwnProperty.call(cjsParsed, 'original_question'), 'cjs parser drops denylisted relay pack fields');

const fallbackIncoming = fallbackStorage.saveIncomingShare({
  code: `${shareCode}_fallback`,
  relay_id: 'fallback_relay',
  relay_receiver_action: 'receiver uses own material',
  relay_parent_check: 'parent asks one first-step question',
  relay_next_revisit: 'tomorrow revisit',
  talent_label: 'visual learner',
  fixed_learning_style: 'must use pictures',
  guaranteed_result: 'will improve in seven days',
  unsafe_extra_token: 'must not pass fallback',
  original_question: 'unsafe original',
  full_answer: 'unsafe answer',
  child_name: 'unsafe child name',
  parent_phone: 'unsafe phone',
  parent_wechat: 'unsafe wechat',
  contact_info: 'unsafe contact'
});
assert.strictEqual(fallbackIncoming.share_code, `${shareCode}_fallback`, 'storage fallback keeps safe share code');
assert.strictEqual(fallbackIncoming.code, `${shareCode}_fallback`, 'storage fallback keeps safe code alias');
assert.strictEqual(fallbackIncoming.relay_receiver_action, 'receiver uses own material', 'storage fallback keeps allowlisted receiver action');
assert(!Object.prototype.hasOwnProperty.call(fallbackIncoming, 'talent_label'), 'storage fallback drops talent labels');
assert(!Object.prototype.hasOwnProperty.call(fallbackIncoming, 'fixed_learning_style'), 'storage fallback drops fixed learning-style claims');
assert(!Object.prototype.hasOwnProperty.call(fallbackIncoming, 'guaranteed_result'), 'storage fallback drops guaranteed-result claims');
identityContactFields.forEach((field) => {
  assert(!Object.prototype.hasOwnProperty.call(fallbackIncoming, field), `storage fallback drops identity/contact field ${field}`);
});
assert(!Object.prototype.hasOwnProperty.call(fallbackIncoming, 'unsafe_extra_token'), 'storage fallback drops unknown fields');
assertNoUnsafeDataFields('storage fallback incoming share', fallbackIncoming);

const incoming = storage.saveIncomingShare({
  code: shareCode,
  relay_id: 'relay_own_material_case',
  relay_first_step: 'sender first step only',
  wrong_cause_label: 'sender wrong-cause label only',
  relay_receiver_action: 'receiver uses own material',
  relay_parent_check: 'parent checks first step only',
  relay_next_revisit: 'receiver schedules revisit',
  relay_allowed_fields: 'share_code,relay_id,first_step,wrong_cause,next_revisit',
  relay_blocked_fields: 'original_question,full_answer,photo,score,ranking,full_dialogue',
  openmaic_bridge_status: 'openmaic_inspired_revisit_gate',
  openmaic_next_action: 'receiver own first step',
  openmaic_share_boundary: 'safe relay only',
  openmaic_game_gate: 'first_step_and_wrong_cause_before_xp_or_share',
  openmaic_blocked_fields: 'original_question,full_answer,full_dialogue,ranking,score',
  original_question: 'unsafe original question',
  full_answer: 'unsafe full answer',
  photo: 'unsafe photo',
  score: 100,
  ranking: 1,
  full_dialogue: 'unsafe full dialogue',
  child_name: 'unsafe child name',
  parent_phone: 'unsafe phone',
  parent_wechat: 'unsafe wechat',
  contact_info: 'unsafe contact'
});

assert(incoming && incoming.share_code === shareCode, 'saveIncomingShare keeps the share code');
assertNoUnsafeDataFields('incoming share', incoming);
assert(unsafeFields.every((field) => incoming.relay_blocked_fields.includes(field)), 'incoming share keeps unsafe fields only as blocked-field names');
assert(identityContactFields.every((field) => incoming.relay_blocked_fields.includes(field)), 'incoming share keeps identity/contact fields only as blocked-field names');
assert.strictEqual(incoming.openmaic_bridge_status, 'openmaic_inspired_revisit_gate', 'incoming share keeps OpenMAIC bridge status');
assert(incoming.openmaic_blocked_fields.includes('full_dialogue'), 'incoming share keeps OpenMAIC blocked fields as field names');
assert.strictEqual(incoming.receiver_evidence_contract, 'own_material_first_step_wrong_cause_revisit', 'incoming share records the receiver evidence contract');
assert.strictEqual(incoming.receiver_own_challenge_status, 'ready', 'incoming share builds receiver own-material challenge');
assert(incoming.receiver_own_challenge_route.includes('/pages/tutor/tutor') && incoming.receiver_own_challenge_route.includes('receiver_own_material'), 'receiver own-material challenge goes to tutor');
assert(incoming.receiver_own_challenge_boundary.includes('不复用发送者原题'), 'receiver own-material challenge blocks sender material reuse');

const completion = storage.recordShareRelayCompletion({
  receiverMaterial: 'my own condition-check worksheet',
  firstStep: 'circle the known condition in my own worksheet',
  wrongCause: 'missed condition',
  nextRevisit: 'tomorrow revisit the same wrong-cause card',
  evidence: 'receiver_first_step_unit_test'
});

assert(completion && completion.type === 'share_relay_receiver_completion', 'recordShareRelayCompletion writes share-run evidence');
assertNoUnsafeDataFields('receiver completion payload', completion.payload);
assert.strictEqual(completion.payload.receiver_material, 'my own condition-check worksheet', 'receiver completion keeps own material evidence');
assert.strictEqual(completion.payload.first_step, 'circle the known condition in my own worksheet', 'receiver completion keeps receiver first step');
assert.strictEqual(completion.payload.wrong_cause, 'missed condition', 'receiver completion keeps receiver wrong cause');
assert.strictEqual(completion.payload.next_revisit, 'tomorrow revisit the same wrong-cause card', 'receiver completion keeps receiver revisit evidence');
assert(completion.payload.evidence_contract && completion.payload.evidence_contract.review_evidence, 'receiver completion declares review evidence');
assert(completion.payload.evidence_contract && completion.payload.evidence_contract.event_evidence, 'receiver completion declares event evidence');
assert(completion.payload.evidence_contract && completion.payload.evidence_contract.sync_evidence, 'receiver completion declares sync evidence');
assert.strictEqual(completion.payload.evidence_contract.openmaic_game_gate, 'first_step_and_wrong_cause_before_xp_or_share', 'receiver completion keeps OpenMAIC game gate as local evidence');

const copiedSenderStep = storage.recordShareRelayCompletion({
  share_code: shareCode,
  firstStep: 'sender first step only',
  wrongCause: 'missed condition',
  nextRevisit: 'tomorrow revisit the same wrong-cause card'
});
assert.strictEqual(copiedSenderStep.type, 'share_relay_receiver_attempted_needs_receiver_evidence', 'missing receiver material records an attempted relay instead of completed');
assert.strictEqual(copiedSenderStep.payload.first_step, 'receiver_own_first_step_required', 'sender first step cannot satisfy receiver completion');

const reviewEvents = storage.loadReviewEvents();
assert(reviewEvents.some((item) => item.type === 'share_relay_receiver_completion' && item.receiverMaterial && item.nextRevisit), 'receiver completion writes review/event evidence');

const syncQueue = storage.loadSyncQueue();
assert(syncQueue.some((item) => item.type === 'share_run' && item.payload && item.payload.type === 'share_relay_receiver_completion'), 'receiver completion writes share-run sync evidence');
assert(syncQueue.some((item) => item.type === 'review_event' && item.payload && item.payload.type === 'share_relay_receiver_completion'), 'receiver completion writes review-event sync evidence');

const profileJs = read('miniprogram/pages/profile/profile.js');
const homeJs = read('miniprogram/pages/home/home.js');
assert(profileJs.includes('buildSafeSharePayload') && unsafeFields.every((field) => profileJs.includes(field)), 'onShareAppMessage uses a denylisted safe payload');
assert(profileJs.includes('buildShareRelayQuery') && profileJs.includes('buildSchemaSharePath'), 'profile share exit builds its path through the share relay schema');
assert(profileJs.includes('function createShareRelaySchemaFallback') && profileJs.includes('const allowlist = [') && profileJs.includes('function isAllowed(key)'), 'profile share fallback is allowlist-based if the shared schema cannot load');
assert(profileJs.includes("safe.sanitized = true") && profileJs.includes('blocked_fields: denylist.slice()'), 'profile share fallback still emits sanitized and blocked-field evidence');
assert(homeJs.includes('saveIncomingShare') && homeJs.includes('receiverCompletionLine'), 'home share landing receives safe payloads and exposes completion evidence');
assert(homeJs.includes('parseIncomingShareQuery') && homeJs.includes('parseShareRelayQuery(query || {})'), 'home landing parses compact relay_pack before saving incoming shares');
assert(homeJs.includes('receiverOwnMaterialChallengeLine') && homeJs.includes("id: 'receiver_own_material'"), 'home share landing exposes receiver own-material challenge');
assert(homeJs.includes('relayPackBlockedLine'), 'home share landing preserves blocked-field guardrail for relay pack');
assert(homeJs.includes('relayPackReady: relayPackCards.length === 3'), 'home share landing keeps relay pack fixed at three cards');
assert(homeJs.includes('original_question,full_answer,photo,score,ranking,full_dialogue'), 'home relay pack keeps unsafe fields out of the primary cards');

console.log('Share relay safety tests pass.');
