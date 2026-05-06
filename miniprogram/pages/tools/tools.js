const learningModules = require('../../utils/learning-modules');
const storage = require('../../utils/storage');
const reviewCards = require('../../utils/review-cards');
const api = require('../../utils/api');

const ALL_FILTER = 'All';

Page({
  data: {
    pathSummary: [
      { title: 'Diagnose', desc: 'Turn scores, mistakes and homework into a first weak-point radar.' },
      { title: 'Prioritize', desc: 'Split tasks into must-do, flexible and can-skip work.' },
      { title: 'Tutor', desc: 'Use Yuan Xiao Dian only for must-do work and key wrong causes.' },
      { title: 'Review', desc: 'Convert real mistakes into daily review, quiz and repair cards.' }
    ],
    tools: [
      {
        key: 'diagnosis',
        name: 'Weak-point diagnosis',
        desc: 'Create the first radar from scores, wrong problems and a short description.',
        action: 'Start diagnosis',
        path: '/pages/diagnosis/diagnosis'
      },
      {
        key: 'upload',
        name: 'Homework triage',
        desc: 'Paste tonight work and get must-do, flexible and can-skip buckets.',
        action: 'Enter homework',
        path: '/pages/upload/upload'
      },
      {
        key: 'radar',
        name: 'Parent radar',
        desc: 'Show why each task matters and which weak point it hits.',
        action: 'Open radar',
        tab: true,
        path: '/pages/radar/radar'
      },
      {
        key: 'tutor',
        name: 'Yuan Xiao Dian tutor',
        desc: 'Guide first steps and wrong causes without writing the answer for the child.',
        action: 'Start tutor',
        tab: true,
        path: '/pages/tutor/tutor'
      },
      {
        key: 'review',
        name: 'Spaced review',
        desc: 'Run Anki-like review, Gizmo-like quiz, repair drills and deck library.',
        action: 'Start review',
        path: '/pages/review/review'
      }
    ],
    moduleFilters: [ALL_FILTER, 'Math', 'English', 'Chinese', 'General'],
    activeFilter: ALL_FILTER,
    modules: learningModules.listModules(),
    visibleModules: learningModules.listModules(),
    adaptivePath: null,
    currentModule: null,
    reviewSummary: null,
    reviewStats: null,
    cramPlan: null,
    deckLibrary: [],
    launchPlaybook: null,
    revolutionBoard: null,
    automationBoard: null,
    cockpitMessage: '',
    factoryPacks: [],
    factoryStudioInput: '',
    factoryStudioType: 'class_notes',
    factoryStudioRemotePlan: null,
    factoryStudioPlan: null,
    factoryStudioStatus: 'Paste notes, PPT outline, video transcript, or wrong-cause summary.'
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const state = storage.loadState();
    const moduleEvents = storage.loadModuleEvents ? storage.loadModuleEvents() : [];
    const feedbackMap = storage.moduleFeedbackMap ? storage.moduleFeedbackMap() : {};
    const storedCards = storage.loadReviewCards ? storage.loadReviewCards() : [];
    const adaptivePath = learningModules.buildAdaptivePath(state, feedbackMap, moduleEvents, 5, storedCards);
    const reviewSummary = reviewCards.reviewSummary();
    const factorySummary = storage.factoryEventSummary ? storage.factoryEventSummary() : null;
    const factoryPacks = learningModules.contentFactoryPacks(state, reviewSummary);
    const filter = this.data.activeFilter || ALL_FILTER;
    const all = learningModules.listModules();
    const visibleModules = filter === ALL_FILTER ? all : all.filter((item) => item.subject === filter);
    const basePlan = this.buildFactoryStudioPlan(this.data.factoryStudioInput, this.data.factoryStudioType, state);
    const remotePlan = this.data.factoryStudioRemotePlan;
    const factoryStudioPlan = remotePlan
      && remotePlan.rawText === String(this.data.factoryStudioInput || '').trim()
      && remotePlan.inputType === this.data.factoryStudioType
      ? remotePlan
      : basePlan;
    this.setData({
      modules: all,
      visibleModules,
      adaptivePath,
      currentModule: adaptivePath.current || null,
      reviewSummary,
      reviewStats: {
        due: reviewSummary.due || 0,
        quiz: reviewSummary.quiz ? reviewSummary.quiz.count : 0,
        quizAccuracy: reviewSummary.quizLoop ? reviewSummary.quizLoop.accuracy : 0,
        maturity: reviewSummary.maturity ? reviewSummary.maturity.overall : 0,
        benchmark: reviewSummary.benchmark ? reviewSummary.benchmark.average : 0
      },
      cramPlan: reviewSummary.cramPlan || null,
      deckLibrary: (reviewSummary.deckLibrary || []).slice(0, 3),
      launchPlaybook: this.buildLaunchPlaybook(adaptivePath, reviewSummary, factoryPacks),
      revolutionBoard: this.buildLearningRevolutionBoard(state, reviewSummary, factoryPacks),
      automationBoard: this.buildAutomationBoard(state, reviewSummary, factorySummary),
      cockpitMessage: adaptivePath.reason || 'Pick one focused module and turn it into review cards.',
      factoryPacks,
      factoryStudioPlan
    });
  },

  buildAutomationBoard(state, reviewSummary, factorySummary) {
    const weak = ((state.weak_points || [])[0] || {}).name || 'first weak point';
    const summary = factorySummary || { total: 0, imported: 0, quality: 0, remote: 0, label: 'No content factory runs yet.' };
    return {
      title: 'PRODUCTION AUTOMATION',
      label: 'Route material into the best engine, track quality, then decide the next import action automatically.',
      cards: [
        { id: 'weak', label: 'Current weak point', value: weak, body: 'Factory generation should stay attached to a concrete weakness.' },
        { id: 'runs', label: 'Factory runs', value: summary.total || 0, body: summary.label },
        { id: 'quality', label: 'Average quality', value: summary.quality || 0, body: 'Paid packs should stay above the quality gate.' },
        { id: 'imported', label: 'Imported cards', value: summary.imported || 0, body: 'Only import packs that help tutor and review.' }
      ],
      nextAction: summary.quality >= 85
        ? 'High-quality pack ready: import to review and run a short quiz.'
        : 'Quality is not stable yet: add a sharper wrong cause and one transfer question.'
    };
  },

  buildFactoryStudioPlan(text, type, state) {
    const raw = String(text || '').trim();
    const labels = {
      class_notes: 'Class notes',
      ppt: 'PPT outline',
      video: 'Video transcript',
      wrong_cause: 'Wrong-cause summary'
    };
    if (!raw) {
      return {
        title: 'CONTENT FACTORY STUDIO',
        label: 'Paste any study material, then generate a local-first study pack or use the remote content engine after login/API setup.',
        type: labels[type] || 'Class notes',
        provider: 'local preview',
        score: 0,
        cards: [],
        diagnostics: [],
        studyPack: this.buildStudioStudyPack([], raw, type, 0),
        qualityGate: this.buildContentQualityGate([], [], 0),
        recommendation: 'Paste 3-8 lines of real learning material first.'
      };
    }
    const profile = storage.loadProfile();
    const weakPoint = (((state || {}).weak_points || [])[0] || {}).name || type;
    const plan = reviewCards.contentEnginePlan(raw, {
      subject: profile.subject || '',
      weakPoint,
      calibrationKey: `studio:${type}`,
      source: `factory_studio_${type}`
    });
    return {
      title: 'CONTENT FACTORY STUDIO',
      label: 'Local-first now, remote-ready later. The same surface can call /api/mini/content-engine after you wire real model keys.',
      type: labels[type] || 'Class notes',
      provider: 'local preview',
      score: plan.score || 0,
      cards: (plan.cards || []).slice(0, 6),
      diagnostics: plan.coreCoverage || [],
      qualityBands: plan.qualityBands || [],
      studyPack: this.buildStudioStudyPack(plan.cards || [], raw, type, plan.score || 0),
      qualityGate: this.buildContentQualityGate(plan.cards || [], plan.coreCoverage || [], plan.score || 0),
      recommendation: plan.recommendation || 'Refine the material to get more useful cards.'
    };
  },

  buildContentQualityGate(cards, coverage, score) {
    const list = cards || [];
    const hasQuestion = list.filter((card) => String(card.question || '').length >= 10).length;
    const hasAnswer = list.filter((card) => String(card.answer || '').length >= 8).length;
    const hasTransfer = list.filter((card) => /transfer|变式|迁移|similar|changed/i.test(`${card.question || ''} ${card.answer || ''}`)).length;
    const hasWrongCause = list.filter((card) => /wrong|cause|错因|误区|trap|careless/i.test(`${card.cardType || ''} ${card.question || ''} ${card.answer || ''}`)).length;
    const checks = [
      { id: 'question', label: 'Clear recall prompt', ready: hasQuestion >= 2, value: hasQuestion },
      { id: 'answer', label: 'Usable answer', ready: hasAnswer >= 2, value: hasAnswer },
      { id: 'wrong_cause', label: 'Wrong-cause lens', ready: hasWrongCause >= 1, value: hasWrongCause },
      { id: 'transfer', label: 'Transfer check', ready: hasTransfer >= 1, value: hasTransfer },
      { id: 'coverage', label: 'Core coverage', ready: (coverage || []).length >= 2, value: (coverage || []).length }
    ];
    const ready = checks.filter((item) => item.ready).length;
    return {
      title: 'CONTENT QUALITY GATE',
      score: Math.min(100, Math.round((ready / checks.length) * 70) + Math.round((score || 0) * 0.3)),
      label: ready >= 4
        ? 'This pack is ready for review import and parent-facing proof.'
        : 'Improve the material before treating this as a paid learning pack.',
      checks,
      next: ready >= 4
        ? 'Import to review, then run a short quiz and parent summary.'
        : 'Add the exact wrong step, a worked contrast, and one transfer question.'
    };
  },

  buildStudioStudyPack(cards, raw, type, score) {
    const lines = String(raw || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const first = lines[0] || 'Paste learning material first.';
    const second = lines[1] || first;
    const cardCount = (cards || []).length;
    const quizCount = Math.max(3, Math.min(8, cardCount + 2));
    const typeLabel = {
      class_notes: 'class notes',
      ppt: 'PPT outline',
      video: 'video transcript',
      wrong_cause: 'wrong-cause log'
    }[type] || 'learning material';
    return {
      title: 'STUDY PACK OUTPUT',
      summary: `${typeLabel} -> ${Math.max(1, cardCount)} cards -> ${quizCount} quiz checks -> 7-day review -> parent summary.`,
      outputs: [
        {
          id: 'knowledge',
          title: 'Knowledge cards',
          value: Math.max(1, cardCount),
          body: `Extract the core method from: ${first.slice(0, 42)}`
        },
        {
          id: 'wrong_cause',
          title: 'Wrong-cause cards',
          value: Math.max(1, Math.ceil(cardCount / 2)),
          body: `Ask what exact step breaks, not just "careless": ${second.slice(0, 38)}`
        },
        {
          id: 'quiz',
          title: 'Mini quiz',
          value: quizCount,
          body: 'Mix recall, cloze, transfer and one closed-book explanation.'
        },
        {
          id: 'review',
          title: 'Review plan',
          value: '7d',
          body: 'Today, tomorrow, day 3, day 5 and day 7. Keep workload small.'
        },
        {
          id: 'parent',
          title: 'Parent summary',
          value: score || 0,
          body: 'Show what to watch tonight, what to avoid, and what counts as proof.'
        }
      ],
      parentLine: `Parent summary: this pack should help the child explain one method, name one wrong cause, pass a short quiz, and return for spaced review. Quality ${score || 0}/100.`
    };
  },

  buildLearningRevolutionBoard(state, reviewSummary, factoryPacks) {
    const subject = state.subject || 'Math';
    const weak = ((state.weak_points || [])[0] || {}).name || 'first weak point';
    const due = Number(reviewSummary.due || 0);
    return {
      title: 'AI LEARNING REVOLUTION BOARD',
      label: 'Reference design for a modern family learning system: diagnose fast, convert material into recall, then protect thinking before giving help.',
      promise: 'No score guarantee. The product promise is a tighter learning loop: fewer blind tasks, more active recall, safer tutor guidance.',
      quickDiagnostic: {
        title: '3-QUESTION WEAKNESS SNAP',
        body: `Use three checks for ${subject}: prerequisite, method step, and transfer. Route the result to radar and must-do work.`,
        metric: weak,
        action: 'diagnosis'
      },
      materialEngine: [
        { id: 'youtube', name: 'YouTube / lecture', status: 'API-ready', output: 'summary -> cards -> quiz' },
        { id: 'pdf', name: 'PDF / textbook', status: 'API-ready', output: 'key points -> traps -> review' },
        { id: 'ppt', name: 'PPT / class notes', status: 'API-ready', output: 'exam points -> deck' },
        { id: 'handwriting', name: 'Handwritten note', status: 'manual now', output: 'photo note -> structured cards' }
      ],
      antiDependence: [
        'Ask before explain: the child must produce the first thought.',
        'Wrong-cause first: careless is not accepted as a final diagnosis.',
        'No answer-copy loop: tutor routes answer requests back to checkpoints.',
        'Parent proof: show mastery evidence, not long chat transcripts.'
      ],
      actions: [
        { id: 'snap', label: 'Run 3-question snap', action: 'diagnosis' },
        { id: 'pack', label: 'Import sample pack', action: 'import_revolution_pack' },
        { id: 'review', label: 'Start recall loop', action: 'review' },
        { id: 'tutor', label: 'Use safe tutor', action: 'tutor' }
      ],
      scorecard: [
        { id: 'speed', label: 'diagnosis speed', value: '3 checks' },
        { id: 'material', label: 'material formats', value: '4 routes' },
        { id: 'memory', label: 'review load', value: `${due} due` },
        { id: 'safety', label: 'thinking guard', value: 'on' }
      ],
      samplePack: {
        text: [
          `${subject} three-question diagnosis: what prerequisite does this task need?`,
          `step: write the first checkpoint before asking AI for help.`,
          `trap: if the learner says careless, ask for the exact wrong cause.`,
          `cloze: AI should protect ____ before giving explanations.`,
          `transfer: make one similar problem with a changed condition.`
        ].join('\n'),
        options: {
          subject,
          weakPoint: weak,
          calibrationKey: 'revolution:three_question_snap',
          source: 'ai_learning_revolution_board'
        }
      },
      factoryReady: (factoryPacks || []).length
    };
  },

  buildLaunchPlaybook(adaptivePath, reviewSummary, factoryPacks) {
    const current = adaptivePath.current || null;
    const firstPack = (factoryPacks || [])[0] || null;
    return {
      title: 'CUSTOMER-READY STUDY PACK',
      label: 'A parent can use this as a paid trial: one weak point, one tutor session, one review pack, one weekly proof loop.',
      score: reviewSummary.maturity ? reviewSummary.maturity.overall : 0,
      cards: [
        {
          id: 'method',
          title: 'AI learning method',
          body: current ? current.title : 'Pick a focused module from the library.',
          metric: current ? `${current.score} fit` : 'ready'
        },
        {
          id: 'content',
          title: 'Content engine pack',
          body: firstPack ? firstPack.title : 'Generate cards from radar, exam or parent check-in.',
          metric: firstPack ? `${firstPack.minutes} min` : 'local'
        },
        {
          id: 'memory',
          title: 'Memory schedule',
          body: reviewSummary.cramPlan ? reviewSummary.cramPlan.label : 'Daily due cards, quiz and repair are already connected.',
          metric: `${reviewSummary.due || 0} due`
        },
        {
          id: 'proof',
          title: 'Parent proof',
          body: 'Use completion evidence and quiz accuracy as the weekly parent-facing result.',
          metric: `${reviewSummary.quizLoop ? reviewSummary.quizLoop.accuracy : 0}% quiz`
        }
      ]
    };
  },

  openTool(event) {
    const index = event.currentTarget.dataset.index;
    const item = this.data.tools[index];
    if (!item) return;
    if (item.tab) {
      wx.switchTab({ url: item.path });
    } else {
      wx.navigateTo({ url: item.path });
    }
  },

  setFilter(event) {
    const filter = event.currentTarget.dataset.filter || ALL_FILTER;
    const all = learningModules.listModules();
    this.setData({
      activeFilter: filter,
      visibleModules: filter === ALL_FILTER ? all : all.filter((item) => item.subject === filter)
    });
  },

  openModule(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/module/module?id=${id}&source=tools_library` });
  },

  startCurrentModule() {
    const item = this.data.currentModule;
    const homework = learningModules.toHomework(item);
    if (!item || !homework) {
      wx.showToast({ title: 'No module ready', icon: 'none' });
      return;
    }
    const next = storage.trackModuleEvent('module_started', item, { source: 'tools_cockpit' });
    api.submitEvent(next[0]).catch(() => {});
    storage.set(storage.KEYS.selectedHomework, homework);
    storage.set(storage.KEYS.selectedHomeworkSource, `module:${item.id}`);
    storage.set(storage.KEYS.tutorMessages, [
      {
        role: 'assistant',
        text: `Start module: ${item.title}. ${item.tutorPrompt}`
      }
    ]);
    wx.switchTab({ url: '/pages/tutor/tutor' });
  },

  addCurrentReviewPack() {
    const item = this.data.currentModule;
    const pack = learningModules.toReviewPack(item);
    if (!item || !pack) {
      wx.showToast({ title: 'No review pack', icon: 'none' });
      return;
    }
    const result = reviewCards.importTextToDeck(pack.text, pack.options);
    const next = storage.trackModuleEvent('module_review_pack_imported', item, {
      source: 'tools_cockpit',
      imported: result.imported || 0,
      skipped: result.skipped || 0
    });
    api.submitEvent(next[0]).catch(() => {});
    this.setData({
      cockpitMessage: result.imported
        ? `Imported ${result.imported} review cards.`
        : 'This module already has review cards.'
    });
    this.refresh();
  },

  importFactoryPack(event) {
    const id = event.currentTarget.dataset.id;
    const pack = (this.data.factoryPacks || []).find((item) => item.id === id);
    if (!pack) return;
    const result = reviewCards.importTextToDeck(pack.text, pack.options);
    this.setData({
      cockpitMessage: result.imported
        ? `Imported ${result.imported} cards from ${pack.title}.`
        : `${pack.title} was already in the review deck.`
    });
    this.refresh();
  },

  onFactoryStudioInput(event) {
    const factoryStudioInput = event.detail.value;
    const state = storage.loadState();
    this.setData({
      factoryStudioInput,
      factoryStudioRemotePlan: null,
      factoryStudioPlan: this.buildFactoryStudioPlan(factoryStudioInput, this.data.factoryStudioType, state)
    });
  },

  setFactoryStudioType(event) {
    const factoryStudioType = event.currentTarget.dataset.type || 'class_notes';
    const state = storage.loadState();
    this.setData({
      factoryStudioType,
      factoryStudioRemotePlan: null,
      factoryStudioPlan: this.buildFactoryStudioPlan(this.data.factoryStudioInput, factoryStudioType, state)
    });
  },

  fillFactoryStudioSample() {
    const sample = [
      '应用题步骤：先圈已知和未知，再写等量关系，最后统一单位。',
      '错因：题目问总价，我却先算了单价，说明没看清目标量。',
      '变式：如果把人数改成 3 倍，第一步仍然先写关系。'
    ].join('\n');
    const state = storage.loadState();
    this.setData({
      factoryStudioInput: sample,
      factoryStudioType: 'class_notes',
      factoryStudioRemotePlan: null,
      factoryStudioPlan: this.buildFactoryStudioPlan(sample, 'class_notes', state)
    });
  },

  runFactoryStudioRemote() {
    const text = String(this.data.factoryStudioInput || '').trim();
    if (!text) {
      wx.showToast({ title: 'Paste material first', icon: 'none' });
      return;
    }
    const state = storage.loadState();
    const profile = storage.loadProfile();
    this.setData({ factoryStudioStatus: 'Generating remote-ready study pack...' });
    api.buildContentCards({
      text,
      subject: profile.subject || '',
      weakPoint: (((state || {}).weak_points || [])[0] || {}).name || this.data.factoryStudioType,
      calibrationKey: `studio:${this.data.factoryStudioType}`,
      inputType: this.data.factoryStudioType
    }).then((result) => {
      if (!result || !Array.isArray(result.cards)) throw new Error('content_engine_failed');
      const imported = reviewCards.importGeneratedCards(result.cards, {
        source: `factory_remote_${this.data.factoryStudioType}`,
        subject: profile.subject || '',
        weakPoint: (((state || {}).weak_points || [])[0] || {}).name || this.data.factoryStudioType,
        calibrationKey: `studio:${this.data.factoryStudioType}`
      });
      if (storage.appendFactoryEvent) {
        storage.appendFactoryEvent({
          event: 'factory_generated',
          input_type: this.data.factoryStudioType,
          provider: result.provider || 'remote_ai_content_engine_v1',
          card_count: result.count || result.cards.length || 0,
          quality_score: result.quality_gate ? Number(result.quality_gate.score || 0) : 0,
          imported: imported.imported || 0
        });
      }
      const remotePlan = Object.assign({}, this.data.factoryStudioPlan || {}, {
        rawText: text,
        inputType: this.data.factoryStudioType,
        provider: result.provider || 'remote_ai_content_engine_v1',
        score: result.quality_gate ? Number(result.quality_gate.score || 0) : (this.data.factoryStudioPlan && this.data.factoryStudioPlan.score) || 0,
        cards: (result.cards || []).slice(0, 6),
        diagnostics: (result.coveredTypes || []).map((type) => ({ type, label: type, count: 1 })),
        studyPack: result.study_pack || (this.data.factoryStudioPlan && this.data.factoryStudioPlan.studyPack),
        qualityGate: result.quality_gate || (this.data.factoryStudioPlan && this.data.factoryStudioPlan.qualityGate)
      });
      this.setData({
        factoryStudioStatus: imported.imported
          ? `Remote engine imported ${imported.imported} cards.`
          : 'Remote engine found no new cards.',
        factoryStudioRemotePlan: remotePlan,
        factoryStudioPlan: remotePlan,
        cockpitMessage: imported.imported
          ? `Imported ${imported.imported} cards from remote content engine.`
          : 'Remote content engine returned no fresh cards.'
      });
      this.refresh();
    }).catch(() => {
      const imported = reviewCards.importTextToDeck(text, {
        subject: profile.subject || '',
        weakPoint: (((state || {}).weak_points || [])[0] || {}).name || this.data.factoryStudioType,
        calibrationKey: `studio:${this.data.factoryStudioType}`,
        source: `factory_studio_${this.data.factoryStudioType}`
      });
      if (storage.appendFactoryEvent) {
        storage.appendFactoryEvent({
          event: 'factory_generated',
          input_type: this.data.factoryStudioType,
          provider: 'rule_content_engine_v2',
          card_count: (this.data.factoryStudioPlan && this.data.factoryStudioPlan.cards && this.data.factoryStudioPlan.cards.length) || 0,
          quality_score: (this.data.factoryStudioPlan && this.data.factoryStudioPlan.qualityGate && this.data.factoryStudioPlan.qualityGate.score) || 0,
          imported: imported.imported || 0
        });
      }
      this.setData({
        factoryStudioStatus: imported.imported
          ? `Fallback local engine imported ${imported.imported} cards.`
          : 'Fallback local engine found no new cards.'
      });
      this.refresh();
    });
  },

  importFactoryStudioPreview() {
    const text = String(this.data.factoryStudioInput || '').trim();
    if (!text) {
      wx.showToast({ title: 'Paste material first', icon: 'none' });
      return;
    }
    const state = storage.loadState();
    const profile = storage.loadProfile();
    const plan = this.data.factoryStudioPlan || this.buildFactoryStudioPlan(text, this.data.factoryStudioType, state);
    const imported = reviewCards.importTextToDeck(text, {
      subject: profile.subject || '',
      weakPoint: (((state || {}).weak_points || [])[0] || {}).name || this.data.factoryStudioType,
      calibrationKey: `studio:${this.data.factoryStudioType}`,
      source: `factory_preview_${this.data.factoryStudioType}`
    });
    if (storage.appendFactoryEvent) {
      storage.appendFactoryEvent({
        event: 'factory_generated',
        input_type: this.data.factoryStudioType,
        provider: 'local_preview_import',
        card_count: (plan.cards && plan.cards.length) || 0,
        quality_score: (plan.qualityGate && plan.qualityGate.score) || plan.score || 0,
        imported: imported.imported || 0
      });
    }
    this.setData({
      factoryStudioStatus: imported.imported
        ? `Preview imported ${imported.imported} cards.`
        : 'Preview pack is already in review.',
      cockpitMessage: imported.imported
        ? `Preview imported ${imported.imported} cards into review.`
        : 'Preview pack was already imported.'
    });
    this.refresh();
  },

  runRevolutionAction(event) {
    const action = event.currentTarget.dataset.action;
    if (action === 'diagnosis') {
      wx.navigateTo({ url: '/pages/diagnosis/diagnosis' });
      return;
    }
    if (action === 'review') {
      wx.navigateTo({ url: '/pages/review/review' });
      return;
    }
    if (action === 'tutor') {
      wx.switchTab({ url: '/pages/tutor/tutor' });
      return;
    }
    if (action === 'import_revolution_pack') {
      const pack = this.data.revolutionBoard && this.data.revolutionBoard.samplePack;
      if (!pack) return;
      const result = reviewCards.importTextToDeck(pack.text, pack.options);
      this.setData({
        cockpitMessage: result.imported
          ? `Imported ${result.imported} cards from the AI learning revolution board.`
          : 'The revolution sample pack is already in review.'
      });
      this.refresh();
    }
  },

  goReview() {
    wx.navigateTo({ url: '/pages/review/review' });
  }
});
