#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const miniRoot = path.join(root, 'miniprogram');

const wxState = {
  storage: {},
  navigatedUrl: '',
  switchedUrl: '',
  toasts: []
};

const wxMock = {
  getStorageSync(key) {
    return wxState.storage[key];
  },
  setStorageSync(key, value) {
    wxState.storage[key] = value;
  },
  removeStorageSync(key) {
    delete wxState.storage[key];
  },
  navigateTo({ url }) {
    wxState.navigatedUrl = url;
  },
  switchTab({ url }) {
    wxState.switchedUrl = url;
  },
  showToast(payload) {
    wxState.toasts.push(payload || {});
  },
  setClipboardData() {}
};

function resolveMiniRequire(fromFile, request) {
  if (!request.startsWith('.')) return require.resolve(request);
  const base = path.resolve(path.dirname(fromFile), request);
  const candidates = [base, `${base}.js`, path.join(base, 'index.js')];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function loadMiniModule(entryFile, options = {}) {
  const cache = {};
  let pageConfig = null;

  function load(file) {
    const full = path.resolve(file);
    if (cache[full]) return cache[full].exports;
    const code = fs.readFileSync(full, 'utf8');
    const module = { exports: {} };
    cache[full] = module;
    const sandbox = {
      module,
      exports: module.exports,
      console,
      Date,
      Math,
      Number,
      String,
      Object,
      Array,
      RegExp,
      JSON,
      Promise,
      encodeURIComponent,
      decodeURIComponent,
      setTimeout,
      clearTimeout,
      wx: options.wx || wxMock,
      getApp() {
        return {};
      },
      getCurrentPages() {
        return [{ route: 'pages/tutor/tutor' }];
      },
      Page(definition) {
        pageConfig = definition;
      },
      App() {},
      Component() {},
      require(request) {
        const resolved = resolveMiniRequire(full, request);
        assert(resolved, `${path.relative(miniRoot, full)} resolves ${request}`);
        return request.startsWith('.') ? load(resolved) : require(resolved);
      }
    };
    vm.runInNewContext(code, sandbox, { filename: full });
    return module.exports;
  }

  load(entryFile);
  return pageConfig;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function createPage(config, extraData = {}) {
  const page = Object.assign({}, config, {
    data: Object.assign({}, clone(config.data), extraData),
    setData(update, callback) {
      Object.keys(update || {}).forEach((key) => {
        if (!key.includes('.')) {
          this.data[key] = update[key];
          return;
        }
        const parts = key.split('.');
        let cursor = this.data;
        parts.slice(0, -1).forEach((part) => {
          if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
          cursor = cursor[part];
        });
        cursor[parts[parts.length - 1]] = update[key];
      });
      if (typeof callback === 'function') callback.call(this);
    },
    getTabBar() {
      return { setData() {} };
    }
  });
  return page;
}

const tutorConfig = loadMiniModule(path.join(miniRoot, 'pages', 'tutor', 'tutor.js'), { wx: wxMock });
const reviewConfig = loadMiniModule(path.join(miniRoot, 'pages', 'review', 'review.js'), { wx: wxMock });
const profileConfig = loadMiniModule(path.join(miniRoot, 'pages', 'profile', 'profile.js'), { wx: wxMock });

assert(tutorConfig && typeof tutorConfig.openTutorScene === 'function', 'tutor page exposes openTutorScene');
assert(tutorConfig && typeof tutorConfig.launchFirstStep === 'function', 'tutor page exposes launchFirstStep');
assert(reviewConfig && typeof reviewConfig.buildEntryReviewContext === 'function', 'review page exposes buildEntryReviewContext');
assert(profileConfig && typeof profileConfig.openEntryDetail === 'function', 'profile page exposes openEntryDetail');

const typedMaterial = '数学应用题：甲比乙多24，卡在等量关系';
const tutorPage = createPage(tutorConfig, {
  input: typedMaterial,
  activeStep: 'read_problem',
  selected: null
});
let sentTutorInput = '';
tutorPage.send = function sendSpy() {
  sentTutorInput = this.data.input;
};
tutorConfig.openTutorScene.call(tutorPage, {
  currentTarget: { dataset: { step: 'find_direction' } }
});
assert.strictEqual(sentTutorInput, '', 'tutor openTutorScene does not auto-submit the learner material');
assert.strictEqual(tutorPage.data.activeTutorScene, 'pointing', 'tutor openTutorScene opens the selected AI workspace');
assert.strictEqual(tutorPage.data.input, typedMaterial, 'tutor openTutorScene preserves typed homework material');
tutorConfig.launchFirstStep.call(tutorPage, {
  currentTarget: { dataset: { step: 'write_first_step' } }
});
assert(sentTutorInput.includes(typedMaterial), 'tutor launchFirstStep preserves typed homework material');
assert(sentTutorInput.includes('下一步') || sentTutorInput.includes('第一步'), 'tutor launchFirstStep appends the selected Socratic intent');

const stuckTutorPage = createPage(tutorConfig, {
  thinkingReceipt: {
    fallbackId: 'fallback_runtime_1',
    turnId: 'turn_runtime_1',
    subject: '数学',
    taskType: 'math_word_problem',
    evidenceThread: {
      flowTraceId: 'flow_still_blocked_runtime_1',
      topicCardId: 'topic_runtime_1',
      subject: '数学',
      taskType: 'math_word_problem'
    },
    miniLessonAudit: { ok: true },
    miniLesson: {
      trigger: {
        shouldTrigger: true,
        reason: 'still_blocked_after_socratic_turn',
        triggerEvidence: { status: 'still_blocked' }
      },
      modeRouter: {
        nextMode: 'parent_handoff',
        reason: 'mini_lesson_blocked_by_router'
      },
      renderGate: { canRender: false },
      topicCard: { id: 'topic_runtime_1', label: '等量关系', conceptGap: '等量关系入口不清' },
      blackboard: {
        firstStep: '先找题目里的等量关系',
        boardMove: '圈出两个数量之间的关系',
        frames: [{ id: 'frame_1', text: '圈关系' }]
      },
      nextDayReview: '明天换一题，只复测等量关系第一步。'
    }
  },
  tutorTurnState: {
    hintLevel: 4,
    activeStep: 'micro_choice',
    nextQuestion: 'A 圈条件，B 说问题'
  }
});
tutorConfig.recordSocraticEffectivenessFeedback.call(stuckTutorPage, {
  currentTarget: { dataset: { status: 'still_blocked' } }
});
assert(stuckTutorPage.data.miniLessonFeedbackBridge, 'still-blocked tutor feedback creates a bridge');
assert.strictEqual(stuckTutorPage.data.miniLessonFeedbackBridge.type, 'evidence_review_required', 'blocked mini-lesson route becomes evidence review instead of parent handoff');
assert(stuckTutorPage.data.miniLessonFeedbackBridge.reviewCardId, 'evidence review bridge creates a concrete review card');
assert(stuckTutorPage.data.miniLessonFeedbackBridge.route.includes('cardId='), 'evidence review bridge route carries review card id');
assert(stuckTutorPage.data.miniLessonFeedbackBridge.route.includes('flowTraceId='), 'evidence review bridge route carries flow trace id');

const reviewContext = reviewConfig.buildEntryReviewContext.call(createPage(reviewConfig), {
  from: 'entry_review',
  mode: 'recall_return',
  reportId: 'report_runtime_1',
  cardId: 'card_runtime_1',
  sourceSchemaId: 'schema_runtime_1',
  flowTraceId: 'flow_runtime_1'
});
assert.strictEqual(reviewContext.reportId, 'report_runtime_1', 'review context preserves report id');
assert.strictEqual(reviewContext.cardId, 'card_runtime_1', 'review context preserves review card id');
assert.strictEqual(reviewContext.sourceSchemaId, 'schema_runtime_1', 'review context preserves uploaded source schema id');
assert.strictEqual(reviewContext.flowTraceId, 'flow_runtime_1', 'review context preserves flow trace id');

const tutorEvidenceReviewContext = reviewConfig.buildEntryReviewContext.call(createPage(reviewConfig), {
  from: 'tutor_still_blocked_evidence',
  cardId: stuckTutorPage.data.miniLessonFeedbackBridge.reviewCardId,
  flowTraceId: 'flow_still_blocked_runtime_1'
});
assert.strictEqual(tutorEvidenceReviewContext.cardId, stuckTutorPage.data.miniLessonFeedbackBridge.reviewCardId, 'review context preserves tutor-created evidence card id');
assert.strictEqual(tutorEvidenceReviewContext.flowTraceId, 'flow_still_blocked_runtime_1', 'review context preserves tutor still-blocked flow trace id');
assert(tutorEvidenceReviewContext.title.includes('AI私教'), 'review context labels tutor still-blocked evidence return');

const learningReportSummary = {
  uploadedMaterialDecisionDossierHandoffReportId: 'report_runtime_1',
  uploadedMaterialDecisionDossierHandoffSourceSchemaId: 'schema_runtime_1',
  reportRevisitValidationStage: 'next_day_revisit',
  reportRevisitEvidence: {
    reportId: 'report_runtime_1',
    sourceSchemaId: 'schema_runtime_1',
    validationStage: 'next_day_revisit',
    flowTraceId: 'flow_runtime_1'
  }
};
const profilePage = createPage(profileConfig, { learningReportSummary });
wxState.navigatedUrl = '';
profileConfig.openEntryDetail.call(profilePage, {
  currentTarget: {
    dataset: {
      scene: 'parent',
      source: 'parent_loop_evidence'
    }
  }
});
assert(!wxState.navigatedUrl, 'profile parent evidence click must not navigateTo a tab page (it silently fails); it switches tab instead');
assert(String(wxState.switchedUrl || '').includes('/pages/profile/profile'), 'profile parent evidence click switches to the profile tab when report context exists');
const pendingParentEvidenceRoute = String((wxState.storage['navigation.pendingTabRoute.v1'] || {}).route || '');
assert(pendingParentEvidenceRoute.includes('/pages/profile/profile?'), 'pending tab route context keeps the in-tab report panel target');
assert(pendingParentEvidenceRoute.includes('panel=report'), 'profile parent evidence route opens report panel');
assert(pendingParentEvidenceRoute.includes('from=parent_loop_evidence'), 'profile parent evidence route keeps clicked source');
assert(pendingParentEvidenceRoute.includes('reportId=report_runtime_1'), 'profile parent evidence route carries report id');
assert(pendingParentEvidenceRoute.includes('sourceSchemaId=schema_runtime_1'), 'profile parent evidence route carries source schema id');
assert(pendingParentEvidenceRoute.includes('validationStage=next_day_revisit'), 'profile parent evidence route carries validation stage');
assert(pendingParentEvidenceRoute.includes('flowTraceId=flow_runtime_1'), 'profile parent evidence route carries flow trace id');

wxState.navigatedUrl = '';
const emptyProfilePage = createPage(profileConfig, { learningReportSummary: {} });
profileConfig.openEntryDetail.call(emptyProfilePage, {
  currentTarget: {
    dataset: {
      scene: 'parent',
      source: 'parent_empty_state'
    }
  }
});
assert(wxState.navigatedUrl.includes('/pages/entry-detail/entry-detail?scene=parent'), 'profile parent evidence click keeps entry-detail fallback when report context is empty');
assert(wxState.navigatedUrl.includes('from=parent_empty_state'), 'empty parent fallback keeps clicked source');

function seedPendingTabRoute(route, query) {
  wxState.storage['navigation.pendingTabRoute.v1'] = {
    route: `${route}?${query}`,
    base: route,
    query,
    createdAt: Date.now()
  };
}

['dialogue', 'knowledge', 'pointing', 'stuck'].forEach((scene) => {
  const page = createPage(tutorConfig);
  seedPendingTabRoute('/pages/tutor/tutor', `from=reference_html&scene=${scene}&open=flow`);
  tutorConfig.onShow.call(page);
  assert.strictEqual(page.data.activeTutorScene, scene, `tutor deep link opens reference scene: ${scene}`);
  assert(page.data.tutorReferenceScene && page.data.tutorReferenceScene.title, `tutor reference scene has visible content: ${scene}`);
});

['topic', 'tool', 'live', 'finished'].forEach((stage) => {
  const page = createPage(reviewConfig);
  reviewConfig.onLoad.call(page, { from: 'reference_html', stage });
  assert.strictEqual(page.data.reviewFlowStage, stage, `review deep link opens reference stage: ${stage}`);
  if (stage !== 'topic') {
    assert(Array.isArray(page.data.playableReviewTools) && page.data.playableReviewTools.length, `review stage has playable tools: ${stage}`);
  }
  if (stage === 'live' || stage === 'finished') {
    assert(page.data.activeReviewTool && page.data.activeReviewTool.id, `review stage has active game state: ${stage}`);
  }
  if (stage === 'finished') {
    assert(page.data.activeReviewTool.attemptSummary, 'review finished deep link has a result summary');
  }
});

['questionnaire', 'upload', 'preview', 'action'].forEach((panel) => {
  const page = createPage(profileConfig);
  profileConfig.onLoad.call(page, { from: 'reference_html', panel });
  assert.strictEqual(page.data.growthActiveScene, panel, `profile deep link opens growth panel: ${panel}`);
});

console.log('Miniapp deep-link runtime harness passed.');
