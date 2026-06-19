#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function readJson(rel) {
  return JSON.parse(read(rel));
}

function countJsonlRows(rel) {
  return read(rel).split('\n').filter(Boolean).length;
}

function walkJsonl(dir) {
  const out = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJsonl(abs));
    else if (entry.name.endsWith('.jsonl')) out.push(abs);
  });
  return out;
}

function loadCommonJsModule(rel) {
  const filename = path.join(root, rel);
  const source = fs.readFileSync(filename, 'utf8');
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require,
    console,
    __dirname: path.dirname(filename),
    __filename: filename
  };
  vm.runInNewContext(source, sandbox, { filename });
  return module.exports;
}

function assertNoAnswerLeak(cards) {
  cards.forEach((card) => {
    assert(card.q && card.a && card.hint, 'starter card has q/a/hint');
    assert(card.q.includes('第一步') || card.steps, `card prompts first-step thinking: ${card.q}`);
    const answer = String(card.a || '').trim();
    if (answer && /^\d+(?:\.\d+)?$/.test(answer)) {
      assert(!card.q.includes(`=${answer}`), `question must not expose final numeric answer: ${card.q}`);
    }
  });
}

async function assertQbankApiBehavior() {
  const savedUrl = process.env.SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const apiModule = await import(`file:///${path.join(root, 'api/mini/qbank-topic.js').replace(/\\/g, '/')}`);
    const missingTopic = await apiModule.default(new Request('https://yuandianzhixue.com/api/mini/qbank-topic', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    }));
    assert.strictEqual(missingTopic.status, 400, 'qbank API rejects empty topic before storage fallback');
    const missingTopicBody = await missingTopic.json();
    assert.strictEqual(missingTopicBody.error, 'missing_topic', 'qbank API returns stable missing_topic error');

    const fallback = await apiModule.default(new Request('https://yuandianzhixue.com/api/mini/qbank-topic', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: '小数乘法', limit: 8 })
    }));
    assert.strictEqual(fallback.status, 200, 'qbank API returns 200 fallback when storage is not configured');
    const fallbackBody = await fallback.json();
    assert.strictEqual(fallbackBody.ok, true, 'qbank fallback keeps miniapp usable');
    assert.strictEqual(fallbackBody.fallback, true, 'qbank fallback is explicit');
    assert.strictEqual(fallbackBody.fallback_source, 'qbank_storage_not_configured', 'qbank fallback source is stable');
    assert.deepStrictEqual(fallbackBody.deck, [], 'qbank storage fallback returns an empty remote deck for local deck merge');
  } finally {
    if (savedUrl == null) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = savedUrl;
    if (savedKey == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  }
}

async function assertQbankRemoteBehaviorIfConfigured() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const apiModule = await import(`file:///${path.join(root, 'api/mini/qbank-topic.js').replace(/\\/g, '/')}`);
  const response = await apiModule.default(new Request('https://yuandianzhixue.com/api/mini/qbank-topic', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mini-client': `qbank-contract-${Date.now()}` },
    body: JSON.stringify({ topic: '小数乘法', limit: 8 })
  }));
  assert.strictEqual(response.status, 200, 'qbank remote smoke returns 200');
  const body = await response.json();
  assert.strictEqual(body.ok, true, 'qbank remote smoke ok');
  assert.strictEqual(body.fallback, false, 'qbank remote smoke uses curated remote bank when storage is configured');
  assert.strictEqual(body.requested_topic, '小数乘法', 'qbank API returns requested topic');
  assert.strictEqual(body.topic, '小数运算', 'qbank API maps miniapp topic to real curated topic');
  assert.strictEqual(body.match_type, 'alias', 'qbank API explains alias match type');
  assert(Array.isArray(body.deck) && body.deck.length === 8, 'qbank API returns requested deck size');
  assert(body.deck.every((card) => card.source_topic === '小数运算'), 'qbank deck cards carry source topic metadata');
}

(async () => {
  const curatedIndex = readJson('data/question-bank/curated/index.json');
  assert.strictEqual(curatedIndex.status, 'verified', 'curated index contains verified bank only');
  assert(curatedIndex.total >= 30000, `curated bank should have substantial verified coverage, got ${curatedIndex.total}`);
  assert(curatedIndex.grade_bands && curatedIndex.grade_bands['小学'] && curatedIndex.grade_bands['初中'], 'curated bank covers primary and middle-school bands');
  assert(curatedIndex.grade_bands['小学']['数学'], 'curated bank covers primary math');

  let indexedRows = 0;
  Object.values(curatedIndex.grade_bands).forEach((subjects) => {
    Object.values(subjects).forEach((topics) => {
      Object.values(topics).forEach((meta) => {
        indexedRows += Number(meta.count || 0);
        assert(Array.isArray(meta.files) && meta.files.length, 'every topic maps to jsonl shards');
        meta.files.forEach((item) => {
          assert(fs.existsSync(path.join(root, 'data/question-bank/curated', item.file)), `indexed shard exists: ${item.file}`);
        });
      });
    });
  });
  assert.strictEqual(indexedRows, curatedIndex.total, 'curated index total reconciles with topic counts');

  const curatedFiles = walkJsonl(path.join(root, 'data/question-bank/curated'));
  assert(curatedFiles.length >= 100, `curated bank should have many topic shards, got ${curatedFiles.length}`);
  const sampleFile = path.relative(root, curatedFiles.find((file) => file.includes(`${path.sep}小学${path.sep}数学${path.sep}`)) || curatedFiles[0]);
  assert(countJsonlRows(sampleFile) > 0, 'sample curated shard has rows');

  const starter = loadCommonJsModule('miniprogram/utils/qbank-starter.js');
  const starterBank = starter.STARTER_BANK || {};
  const starterTopics = starter.STARTER_TOPICS || [];
  assert(starterTopics.length >= 12, `starter pack exposes at least 12 playable topics, got ${starterTopics.length}`);
  starterTopics.slice(0, 12).forEach((topic) => {
    const cards = starterBank[topic] || [];
    assert(cards.length >= 8, `starter topic has at least 8 cards: ${topic}`);
    assert(cards.some((card) => card.steps), `starter topic has one steps card: ${topic}`);
    assertNoAnswerLeak(cards);
  });

  const topicBankSource = read('miniprogram/utils/k12-topic-bank.js');
  assert(topicBankSource.includes("require('./qbank-starter.js')") && topicBankSource.includes('Node contract tests'), 'miniapp topic bank merges generated starter pack and survives contract loaders');
  assert(topicBankSource.includes('buildTopicDeck') && topicBankSource.includes('listPlayableTopics') && topicBankSource.includes('listTopicCards') && topicBankSource.includes('TOPIC_PROFILES'), 'miniapp topic bank exposes deck/list/profile APIs');

  const reviewSource = read('miniprogram/pages/review/review.js');
  assert(reviewSource.includes('k12TopicBank.buildTopicDeck'), 'Knowledge Park seeds local per-topic decks');
  assert(reviewSource.includes('api.fetchQbankTopicDeck') && reviewSource.includes('review.qbank.deck.'), 'Knowledge Park fetches and caches remote qbank decks');
  assert(reviewSource.includes("source: 'qbank_remote'"), 'remote qbank cards are marked as qbank_remote evidence');
  assert(reviewSource.includes("selectedKnowledgeTopic: '小数乘法'"), 'Knowledge Park defaults to a qbank-backed concrete topic, not a broad generic label');
  assert(reviewSource.includes('result.requested_topic') && reviewSource.includes('result.match_type'), 'Knowledge Park preserves remote qbank match metadata in local cache');
  assert(reviewSource.includes('topicExistingCount >= 3') && !reviewSource.includes('existing.length >= 3 ? [] : this.buildKnowledgeStarterCards(topic)'), 'Knowledge Park adds starter cards per selected topic instead of blocking new topics with global card count');
  assert(reviewSource.includes('k12TopicBank.listTopicCards') && reviewSource.includes('k12TopicBank.normalizeTopic') && reviewSource.includes('listPlayableTopics(24)'), 'Knowledge Park front-end topic entry list comes from the curated knowledge bank profile');

  const apiSource = read('api/mini/qbank-topic.js');
  assert(apiSource.includes('fallback_source') && apiSource.includes('qbank_storage_not_configured'), 'qbank API returns honest fallback when storage is not configured');
  assert(apiSource.includes('firstStepFromEquation'), 'qbank API converts equations into first-step prompts');
  assert(apiSource.includes('TOPIC_ALIASES') && apiSource.includes("'小数乘法': ['小数运算', '购物消费']") && apiSource.includes("'小数点移动': ['小数运算']"), 'qbank API maps miniapp-friendly topics to curated bank categories');
  assert(apiSource.includes("'面积': ['面积计算']") && apiSource.includes("'平均值': ['平均数']") && apiSource.includes("'相遇追及': ['行程问题']"), 'qbank aliases cover the most common user-language variants');
  assert(apiSource.includes('INDEX_PATHS') && apiSource.includes('xiaoxue_yuwen/index.json') && apiSource.includes('chuzhong_yingyu/index.json'), 'qbank API can search subject indexes beyond primary math');
  const k12Source = read('miniprogram/utils/k12-topic-bank.js');
  assert(k12Source.includes('TOPIC_PROFILES') && k12Source.includes('TOPIC_ALIAS_LOOKUP') && k12Source.includes('listTopicCards'), 'miniapp topic bank exposes profile-aware topic metadata and card generation');
  await assertQbankApiBehavior();
  await assertQbankRemoteBehaviorIfConfigured();

  const uploadSource = read('scripts/qbank/upload-curated.cjs');
  assert(uploadSource.includes('curated/index.json') && uploadSource.includes('storagePrefix') && uploadSource.includes('MIN_ROWS_PER_TOPIC'), 'qbank upload plan derives storage objects from curated verified index');

  console.log('Qbank integration contract passed.');
})();
