#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCommonJs(file) {
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require,
    console,
    Date,
    Math
  }, { filename: file });
  return module.exports;
}

function loadStorage() {
  const file = path.join(__dirname, '..', 'miniprogram', 'utils', 'storage.js');
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  const shareRelaySchema = loadCommonJs(path.join(__dirname, '..', 'miniprogram', 'utils', 'share-relay-schema.js'));
  const localRequire = (id) => {
    if (id === './learning-priority') return {};
    if (id === './share-relay-schema') return shareRelaySchema;
    if (
      id === './learning-report'
      || id === './game-logic'
      || id === './product-readiness'
      || id === './real-homework-coverage'
    ) {
      throw new Error(`mocked optional dependency: ${id}`);
    }
    return require(id);
  };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: localRequire,
    console,
    Date,
    Math
  }, { filename: file });
  return module.exports;
}

const storage = loadStorage();

const unsafeInput = {
  share_code: 'share_unit_safe_relay',
  from: 'profile',
  mode: 'safe_relay',
  action: 'wrong_cause_revisit',
  relay_id: 'relay_unit_001',
  relay_first_step: '先用自己的材料说出第一步',
  relay_receiver_action: '接收者打开自己的作业，只复刻第一步',
  relay_parent_check: '家长只问第一步，不看完整答案',
  relay_next_revisit: '明天回访同一错因',
  relay_allowed_fields: 'relay_id,first_step,receiver_action,parent_check,next_day_revisit',
  relay_blocked_fields: 'original_question,full_answer,photo,score,ranking,full_dialogue',
  relay_completion_signal: 'active_recall_next_revisit',
  relay_return_path: '/pages/review/review?from=share_relay',
  openmaic_bridge_status: 'openmaic_inspired_revisit_gate',
  openmaic_next_action: 'say first step then repair wrong cause',
  openmaic_share_boundary: 'share action and revisit only; never raw question or answer',
  openmaic_game_gate: 'first_step_and_wrong_cause_before_xp_or_share',
  openmaic_blocked_fields: 'original_question,full_answer,full_dialogue,ranking,score',
  openmaic_evidence: 'task_plan,quality_gate,revisit',
  openmaic_return_path: '/pages/profile/profile?from=openmaic_bridge',
  original_question: '这段不应该进入接收记录',
  full_answer: '这段不应该进入接收记录',
  photo: 'private-photo-token',
  score: '100',
  ranking: '1',
  full_dialogue: 'private-dialogue'
};

const incoming = storage.saveIncomingShare(unsafeInput);
assert(incoming, 'incoming share is saved');
assert.equal(incoming.share_code, unsafeInput.share_code, 'incoming share keeps share code');
assert.equal(incoming.relay_receiver_action, unsafeInput.relay_receiver_action, 'incoming share keeps receiver action');
assert.equal(incoming.relay_return_path, unsafeInput.relay_return_path, 'incoming share keeps return path');
assert.equal(incoming.receiver_own_challenge_status, 'ready', 'incoming share creates receiver own-material challenge');
assert(incoming.receiver_own_challenge_route.includes('/pages/tutor/tutor') && incoming.receiver_own_challenge_route.includes('receiver_own_material'), 'receiver own-material challenge routes to tutor first');
assert(incoming.receiver_own_challenge_boundary.includes('自己的作业材料'), 'receiver own-material challenge requires receiver material');
assert.equal(incoming.openmaic_bridge_status, unsafeInput.openmaic_bridge_status, 'incoming share keeps OpenMAIC-inspired bridge status');
assert.equal(incoming.openmaic_game_gate, unsafeInput.openmaic_game_gate, 'incoming share keeps OpenMAIC-inspired game gate');
assert(String(incoming.openmaic_blocked_fields).includes('full_dialogue'), 'incoming share keeps OpenMAIC blocked fields as field names');
assert(!Object.prototype.hasOwnProperty.call(incoming, 'original_question'), 'incoming share does not persist original question');
assert(!Object.prototype.hasOwnProperty.call(incoming, 'full_answer'), 'incoming share does not persist full answer');
assert(!Object.prototype.hasOwnProperty.call(incoming, 'photo'), 'incoming share does not persist photo');
assert(!Object.prototype.hasOwnProperty.call(incoming, 'score'), 'incoming share does not persist score');
assert(!Object.prototype.hasOwnProperty.call(incoming, 'ranking'), 'incoming share does not persist ranking');
assert(!Object.prototype.hasOwnProperty.call(incoming, 'full_dialogue'), 'incoming share does not persist full dialogue');

const completion = storage.recordShareRelayCompletion({
  incomingShare: incoming,
  childFirstStep: '我先找题里要求我比较的量',
  wrongCause: '没有先找基准量',
  receiverMaterial: '自己的应用题作业',
  receiverAction: '用自己的作业复刻第一步',
  parentCheck: '家长只听孩子说第一步',
  nextRevisit: '明天遮住答案再说一次'
});

assert(completion, 'share relay completion is recorded');
assert.equal(completion.type, 'share_relay_receiver_completion', 'completion writes receiver completion type');
assert.equal(completion.share_intent, 'receiver_own_material_first_step', 'completion requires receiver own material');
assert.equal(completion.path, unsafeInput.relay_return_path, 'completion preserves safe return route');
assert.equal(completion.payload.first_step, '我先找题里要求我比较的量', 'completion stores receiver first step');
assert.equal(completion.payload.wrong_cause, '没有先找基准量', 'completion stores wrong-cause evidence');
assert.equal(completion.payload.receiver_action, '用自己的作业复刻第一步', 'completion stores receiver action');
assert.equal(completion.payload.parent_check, '家长只听孩子说第一步', 'completion stores parent check');
assert.equal(completion.payload.next_revisit, '明天遮住答案再说一次', 'completion stores next revisit');
assert(String(completion.payload.blocked_fields).includes('original_question'), 'completion carries blocked original-question field');
assert(String(completion.payload.blocked_fields).includes('full_answer'), 'completion carries blocked full-answer field');
assert(String(completion.payload.blocked_fields).includes('ranking'), 'completion carries blocked ranking field');
assert.equal(completion.payload.evidence_contract.openmaic_bridge_status, unsafeInput.openmaic_bridge_status, 'completion carries OpenMAIC-inspired bridge status into evidence contract');
assert.equal(completion.payload.evidence_contract.openmaic_game_gate, unsafeInput.openmaic_game_gate, 'completion carries OpenMAIC-inspired game gate into evidence contract');

const completionText = JSON.stringify(completion);
assert(!completionText.includes(unsafeInput.original_question), 'completion does not leak original question content');
assert(!completionText.includes(unsafeInput.full_answer), 'completion does not leak full answer content');
assert(!completionText.includes(unsafeInput.photo), 'completion does not leak photo token');
assert(!completionText.includes(unsafeInput.full_dialogue), 'completion does not leak full dialogue');

const reviewEvents = storage.loadReviewEvents();
assert(reviewEvents.some((event) => event.event === 'share_relay_receiver_completion' && event.firstStep === '我先找题里要求我比较的量'), 'completion writes review evidence');

const syncQueue = storage.loadSyncQueue();
assert(syncQueue.some((item) => item.type === 'share_run' && item.payload && item.payload.share_intent === 'receiver_own_material_first_step'), 'completion queues share-run sync evidence');
assert(syncQueue.some((item) => item.type === 'share_follow_up' && item.payload && item.payload.share_code === unsafeInput.share_code), 'share relay creates a family follow-up queue item');
assert(syncQueue.some((item) => item.type === 'review_event' && item.payload && item.payload.event === 'share_relay_receiver_completion'), 'completion queues review-event sync evidence');
const followUps = storage.loadShareFollowUpQueue();
assert(followUps.some((item) => item.share_code === unsafeInput.share_code && item.route.includes('share_follow_up')), 'share follow-up queue routes tomorrow back to review');

const homeJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', 'home.js'), 'utf8');
const homeWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', 'home.wxml'), 'utf8');
const reviewJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'review', 'review.js'), 'utf8');
const reviewWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'review', 'review.wxml'), 'utf8');
const profileJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'profile', 'profile.js'), 'utf8');
assert(homeJs.includes('incomingShareCode') && homeJs.includes('query.share_code') && homeJs.includes('query.invite_code'), 'home accepts safe schema share aliases, not only retired share query');
assert(profileJs.includes('parent_invite') && profileJs.includes('buildSchemaSharePath(safePayload)') && !profileJs.includes('/pages/home/home?ref=${localUserId}'), 'parent invite uses safe share payload instead of a bare ref link');
assert(fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'utils', 'storage.js'), 'utf8').includes('shareFollowUpQueue'), 'storage has a share-code follow-up queue beyond raw share logs');
assert(reviewJs.includes('storage.loadIncomingShare') && reviewJs.includes('receiverShareRelayPanel') && reviewJs.includes('share_relay_receiver_completion'), 'review builds a receiver own-material share relay panel in logic');
assert(!reviewWxml.includes('memoryPrescriptionPanel.receiverShareRelayPanel') && reviewWxml.includes('review-challenge-card'), 'review no longer renders receiver own-material detail panels on the compact first screen');
assert(homeJs.includes('relayPackCards'), 'home builds compact relay pack cards');
assert(homeJs.includes('buildReceiverOwnMaterialChallenge') && homeJs.includes("id: 'receiver_own_material'"), 'home builds a receiver own-material action before generic challenges');
assert(homeJs.includes('receiverOwnMaterialChallengeLine') && homeWxml.includes('incomingShareRelay.receiverOwnMaterialChallengeLine'), 'home renders receiver own-material challenge evidence');
assert(homeJs.includes("id: 'tonight_action'"), 'relay pack includes tonight action card');
assert(homeJs.includes("id: 'first_step'"), 'relay pack includes first-step/wrong-cause card');
assert(homeJs.includes("id: 'tomorrow_revisit'"), 'relay pack includes tomorrow revisit card');
assert(homeJs.includes('relayPackReady: relayPackCards.length === 3'), 'relay pack is gated as exactly three cards');
assert(homeWxml.includes('incomingShareRelay.relayPackCards'), 'home renders compact relay pack cards before the long evidence list');
assert(homeWxml.indexOf('incomingShareRelay.relayPackCards') < homeWxml.indexOf('incomingShareRelay.firstStepLine'), 'relay pack appears before secondary evidence lines');

console.log('All share relay behavior tests pass.');
