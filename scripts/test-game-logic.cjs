#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

const game = require('../src/lib/game-logic.cjs');

let failed = 0;

function pass(label) {
  console.log(`  ok ${label}`);
}

function fail(label, error) {
  failed += 1;
  console.error(`  fail ${label}: ${error && error.message ? error.message : error}`);
}

console.log('case 1: XP and level');
try {
  assert.equal(game.calculateXP('new_card'), 10);
  assert.equal(game.calculateXP('quiz_correct'), 20);
  assert.equal(game.calculateXP('daily_review_complete'), 30);
  assert.equal(game.calculateXP('quiz_correct', 2), 40);
  assert.deepEqual(game.getLevel(0), {
    level: 0,
    title: '新手',
    currentXp: 0,
    nextLevelXp: 100,
    progress: 0
  });
  const level = game.getLevel(900);
  assert.equal(level.level, 3);
  assert.equal(level.title, '学霸');
  assert.equal(level.progress, 0);
  pass('XP rewards and sqrt level formula');
} catch (error) {
  fail('XP and level', error);
}

console.log('case 2: SM-2 scheduling');
try {
  const base = {
    repetitions: 0,
    interval: 0,
    ease_factor: 2.5,
    next_review: '2026-05-01T00:00:00.000Z',
    last_review: ''
  };
  const remembered = game.applySM2(base, 'remembered', new Date('2026-05-01T00:00:00.000Z'));
  assert.equal(remembered.repetitions, 1);
  assert.equal(remembered.interval, 1);
  assert.equal(remembered.ease_factor, 2.6);
  assert.equal(remembered.next_review, '2026-05-02T00:00:00.000Z');

  const fuzzy = game.applySM2({ repetitions: 3, interval: 10, ease_factor: 2.4 }, 'fuzzy', new Date('2026-05-01T00:00:00.000Z'));
  assert.equal(fuzzy.repetitions, 3);
  assert.equal(fuzzy.interval, 5);
  assert.equal(fuzzy.ease_factor, 2.25);

  const forgotten = game.applySM2({ repetitions: 4, interval: 20, ease_factor: 2.1 }, 'forgotten', new Date('2026-05-01T00:00:00.000Z'));
  assert.equal(forgotten.repetitions, 0);
  assert.equal(forgotten.interval, 1);
  assert.equal(forgotten.ease_factor, 2.5);
  pass('SM-2 grades update interval and ease');
} catch (error) {
  fail('SM-2 scheduling', error);
}

console.log('case 3: streak update');
try {
  const today = new Date('2026-05-08T10:00:00.000Z');
  const fresh = game.updateStreak({ streak: 0, best_streak: 0, last_study_date: '' }, { reviewedToday: 10, now: today });
  assert.equal(fresh.streak, 1);
  assert.equal(fresh.best_streak, 1);
  assert.equal(fresh.last_study_date, '2026-05-08');

  const continued = game.updateStreak({ streak: 3, best_streak: 5, last_study_date: '2026-05-07' }, { reviewedToday: 10, now: today });
  assert.equal(continued.streak, 4);
  assert.equal(continued.best_streak, 5);

  const broken = game.updateStreak({ streak: 3, best_streak: 5, last_study_date: '2026-05-05' }, { reviewedToday: 10, now: today });
  assert.equal(broken.streak, 1);

  const protectedGap = game.updateStreak({
    streak: 3,
    best_streak: 5,
    last_study_date: '2026-05-05',
    streak_freezes: 2
  }, { reviewedToday: 10, now: today });
  assert.equal(protectedGap.streak, 4);
  assert.equal(protectedGap.streak_freezes, 0);
  pass('streak requires 10 cards and supports freeze cards');
} catch (error) {
  fail('streak update', error);
}

console.log('case 4: achievements');
try {
  const unlocked = game.checkAndUnlockAchievements({
    achievements: ['first_review'],
    review_count: 120,
    correct_count: 101,
    streak: 7,
    recent_quiz_accuracy: [92, 94, 91],
    completed_books: 1
  });
  const ids = unlocked.newlyUnlocked.map((item) => item.id);
  assert(ids.includes('hundred_correct'));
  assert(ids.includes('seven_day_streak'));
  assert(ids.includes('quiz_master_3'));
  assert(ids.includes('whole_book'));
  assert(!ids.includes('first_review'));
  pass('achievement unlocks are idempotent');
} catch (error) {
  fail('achievements', error);
}

console.log('case 5: decorative catalog');
try {
  const listed = game.listShopItems([
    { item_id: 'theme_green' }
  ]);
  assert(Array.isArray(listed));

  const blocked = game.purchaseShopItem(
    { recordPoints: 120, coins: 120, inventory: [] },
    { id: 'theme_green', recordCost: 80, type: 'theme', title: '森林主题' }
  );
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, 'catalog_only');
  assert.equal(blocked.user.recordPoints, 120);
  pass('catalog is decorative and does not transact');
} catch (error) {
  fail('decorative catalog', error);
}

if (failed) {
  console.error(`\nFAIL ${failed}`);
  process.exit(1);
}

console.log('\nAll game logic tests pass.');
