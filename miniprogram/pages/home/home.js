const storage = require('../../utils/storage');
const navigation = require('../../utils/navigation');
const reviewCards = require('../../utils/review-cards');
const gameLogic = require('../../utils/game-logic');
const learningModules = require('../../utils/learning-modules');
const arcadeEngine = require('../../utils/arcade-engine');
const api = require('../../utils/api');
const tutorLadder = require('../../utils/tutor-ladder');
const importIntake = require('../../utils/import-intake');
const shareRelaySchema = require('../../utils/share-relay-schema');
const { buildHomeViewModel } = require('../../view-models/home-view-model');

function safeDecodeShareParam(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return String(value || '');
  }
}

function parseIncomingShareQuery(query = {}) {
  const parsed = shareRelaySchema && shareRelaySchema.parseShareRelayQuery
    ? shareRelaySchema.parseShareRelayQuery(query || {})
    : {};
  return Object.assign({}, query || {}, parsed || {});
}

Page({
  data: {
    state: null,
    weakPoints: [],
    topMust: null,
    stats: { must: 0, flexible: 0, skip: 0 },
    proofStats: [
      { label: '必须做时间', value: '0 分钟' },
      { label: '预计少做', value: '0 分钟' },
      { label: '卡点命中', value: '0' }
    ],
    topMustProof: null,
    reviewSummary: null,
    loopSummary: null,
    syncSummary: null,
    todayActions: [],
    cockpit: null,
    executiveBrief: null,
    pathRouter: [],
    returnLoop: null,
    tonightSprint: null,
    parentHandoff: null,
    quickDock: [],
    gameHero: {
      title: '今晚从哪一步开始？',
      subtitle: '学校作业多，先排顺序；卡住时，先说第一步。',
      primaryLabel: '帮我安排今晚学习',
      primaryAction: 'planTonight',
      secondaryLabel: '生成轻练习',
      secondaryAction: 'goLearningMap',
      nextGate: '下一关：先生成学习卡'
    },
    missionCards: [],
    contentEntry: null,
    parentSnapshot: null,
    weaknessVerdict: null,
    arcadeEntry: {
      body: '没有材料时先生成第一关，有真实卡片后再进入游戏。',
      cta: '去轻回访',
      action: 'goLearningMap'
    },
    wrongbookEntry: {
      body: '把题目、原想法和卡住的一步放进来，整理成可回访的小卡。',
      label: '放一题',
      action: 'goReviewInput'
    },
    firstRunGuide: null,
    dashboardHeader: null,
    aiDraft: '',
    packTab: 'text',
    promptChips: [],
    categoryFilters: [],
    activeToolCategory: 'featured',
    toolCards: [],
    visibleToolCards: [],
    progressStrip: null,
    parentSupportCards: [],
    suggestedNextStep: null,
    learningStages: [],
    focusFeedback: '',
    todayFocus: null,
    tonightPlan: null,
    routeStrip: null,
    routeDisplayText: '今晚路线 · 第 1 步：排顺序',
    companionPreference: { selectedCompanion: 'gudian', selectedLabel: '咕点' },
    companionCopy: { home: '咕点陪你先找今晚第一步。' },
    companionLine: '咕点：我懂你卡住了，我陪你先迈出第一步。',
    growthMemory: { home: '' },
    companionOptions: [],
    homeViewModel: buildHomeViewModel(),
    showCompanionPicker: false,
    showWeakVerdict: false,
    planSummaryText: '',
    incomingShare: null,
    incomingShareRelay: null,
    updatedText: '',
    showFirstRunOverlay: false,
    showLightTools: false,
    yesterdayReviewCard: null,
    focusEntryReady: false,
    localScenarioCases: [],
    activeScenarioResult: null,
    learningQuestArc: null,
    moduleFlowCompass: null,
    surfaceDepthPack: null,
    capabilityMaturityQueue: null,
    unifiedNextAction: null,
    dailyMemoryTask: null,
    sevenSubjectMasterySprint: null,
    learningLoopCards: [
      {
        id: 'socratic',
        title: '今晚作业没思路',
        body: '先不急着给答案，咕点陪你问三步。',
        action: 'goTutor',
        cta: '找咕点追问'
      },
      {
        id: 'focus',
        title: '坐不住，想分心',
        body: '只围绕一个小目标，安静坐一段。静音模式可用。',
        action: 'goFocus',
        cta: '进专注舱'
      },
      {
        id: 'repair',
        title: '之前错题又卡了',
        body: '昨天那一步，今天轻轻接一下。',
        action: 'goReview',
        cta: '修卡点'
      },
      {
        id: 'practice',
        title: '想练一小会',
        body: '用 3 分钟，把第一步练熟。',
        action: 'goArcade',
        cta: '玩一小局'
      }
    ],
    parentClassroom: [
      { title: '为什么不要直接给答案', body: '先问第一步，孩子才会开始整理自己的思路。' },
      { title: '每晚只问这一句', body: '刚才你第一步先看了什么？这句足够轻。' },
      { title: '卡住时先稳住', body: '先坐下来一小段，比立刻讲完整过程更重要。' }
    ]
  },

  onLoad(query = {}) {
    query = parseIncomingShareQuery(query);
    if (storage.isFirstTime && storage.isFirstTime()) {
      this.setData({ showFirstRunOverlay: true });
      setTimeout(() => {
        this.setData({ showFirstRunOverlay: false });
      }, 3000);
    }
    const incomingShareCode = query && (query.share || query.share_code || query.invite_code);
    if (incomingShareCode) {
      const incoming = storage.saveIncomingShare ? storage.saveIncomingShare({
        code: incomingShareCode,
        from: query.from || '',
        challenge: query.challenge || '',
        mode: query.mode || '',
        identity_tag: query.identity || '',
        parent_next_action: query.action || '',
        action_label: safeDecodeShareParam(query.action_label),
        action_detail: safeDecodeShareParam(query.action_detail),
        capability_gap: safeDecodeShareParam(query.capability_gap),
        capability_label: safeDecodeShareParam(query.capability_label),
        capability_next_action: safeDecodeShareParam(query.capability_next_action),
        capability_route: safeDecodeShareParam(query.capability_route),
        challenge_goal: safeDecodeShareParam(query.challenge_goal),
        challenge_rule: safeDecodeShareParam(query.challenge_rule),
        challenge_route: safeDecodeShareParam(query.challenge_route),
        relay_privacy: safeDecodeShareParam(query.relay_privacy),
        relay_review: safeDecodeShareParam(query.relay_review),
        relay_first_step: safeDecodeShareParam(query.relay_first_step),
        relay_id: safeDecodeShareParam(query.relay_id),
        relay_receiver_action: safeDecodeShareParam(query.relay_receiver_action),
        relay_parent_check: safeDecodeShareParam(query.relay_parent_check),
        relay_next_revisit: safeDecodeShareParam(query.relay_next_revisit),
        relay_allowed_fields: safeDecodeShareParam(query.relay_allowed_fields),
        relay_blocked_fields: safeDecodeShareParam(query.relay_blocked_fields),
        relay_completion_signal: safeDecodeShareParam(query.relay_completion_signal),
        relay_return_path: safeDecodeShareParam(query.relay_return_path),
        relay_ladder: safeDecodeShareParam(query.relay_ladder),
        relay_attraction_hook: safeDecodeShareParam(query.relay_attraction_hook),
        relay_local_gate: safeDecodeShareParam(query.relay_local_gate),
        course_unit_label: safeDecodeShareParam(query.course_unit_label),
        course_unit_subject: safeDecodeShareParam(query.course_unit_subject),
        course_unit_tier: safeDecodeShareParam(query.course_unit_tier),
        course_unit_parent_decision: safeDecodeShareParam(query.course_unit_parent_decision),
        course_unit_report_contract: safeDecodeShareParam(query.course_unit_report_contract),
        course_unit_share_contract: safeDecodeShareParam(query.course_unit_share_contract),
        course_unit_blackboard: safeDecodeShareParam(query.course_unit_blackboard),
        course_unit_recall_route: safeDecodeShareParam(query.course_unit_recall_route),
        course_unit_game_route: safeDecodeShareParam(query.course_unit_game_route),
        question_bank_relay_label: safeDecodeShareParam(query.question_bank_relay_label),
        question_bank_relay_first_step: safeDecodeShareParam(query.question_bank_relay_first_step),
        question_bank_relay_parent_check: safeDecodeShareParam(query.question_bank_relay_parent_check),
        question_bank_relay_route: safeDecodeShareParam(query.question_bank_relay_route),
        question_bank_relay_boundary: safeDecodeShareParam(query.question_bank_relay_boundary),
        visual_board_relay_title: safeDecodeShareParam(query.visual_board_relay_title),
        visual_board_relay_layer: safeDecodeShareParam(query.visual_board_relay_layer),
        visual_board_relay_student_line: safeDecodeShareParam(query.visual_board_relay_student_line),
        visual_board_relay_parent_line: safeDecodeShareParam(query.visual_board_relay_parent_line),
        visual_board_relay_exit: safeDecodeShareParam(query.visual_board_relay_exit),
        visual_board_relay_route: safeDecodeShareParam(query.visual_board_relay_route),
        visual_board_relay_boundary: safeDecodeShareParam(query.visual_board_relay_boundary),
        socratic_report_status: safeDecodeShareParam(query.socratic_report_status),
        socratic_report_action: safeDecodeShareParam(query.socratic_report_action),
        socratic_report_decision: safeDecodeShareParam(query.socratic_report_decision),
        socratic_report_no_increase: safeDecodeShareParam(query.socratic_report_no_increase),
        socratic_report_parent_proof: safeDecodeShareParam(query.socratic_report_parent_proof),
        socratic_report_boundary: safeDecodeShareParam(query.socratic_report_boundary),
        tonight_decision: safeDecodeShareParam(query.tonight_decision),
        tonight_parent_question: safeDecodeShareParam(query.tonight_parent_question),
        tonight_tomorrow: safeDecodeShareParam(query.tonight_tomorrow),
        tonight_release_gate: safeDecodeShareParam(query.tonight_release_gate),
        tonight_share_boundary: safeDecodeShareParam(query.tonight_share_boundary),
        source_challenge_count: safeDecodeShareParam(query.source_challenge_count),
        source_challenge_first: safeDecodeShareParam(query.source_challenge_first),
        source_challenge_prompt: safeDecodeShareParam(query.source_challenge_prompt),
        source_challenge_license: safeDecodeShareParam(query.source_challenge_license),
        source_challenge_decision: safeDecodeShareParam(query.source_challenge_decision),
        source_challenge_local_rule: safeDecodeShareParam(query.source_challenge_local_rule),
        source_challenge_blocked: safeDecodeShareParam(query.source_challenge_blocked),
        source_challenge_route: safeDecodeShareParam(query.source_challenge_route),
        wrong_cause_pack: safeDecodeShareParam(query.wrong_cause_pack),
        wrong_cause_label: safeDecodeShareParam(query.wrong_cause_label),
        wrong_cause_first_step: safeDecodeShareParam(query.wrong_cause_first_step),
        wrong_cause_parent_check: safeDecodeShareParam(query.wrong_cause_parent_check),
        wrong_cause_receiver_action: safeDecodeShareParam(query.wrong_cause_receiver_action),
        wrong_cause_next_revisit: safeDecodeShareParam(query.wrong_cause_next_revisit),
        wrong_cause_allowed_fields: safeDecodeShareParam(query.wrong_cause_allowed_fields),
        wrong_cause_blocked_fields: safeDecodeShareParam(query.wrong_cause_blocked_fields),
        wrong_cause_return_path: safeDecodeShareParam(query.wrong_cause_return_path),
        wrong_cause_gate: safeDecodeShareParam(query.wrong_cause_gate),
        openmaic_bridge_status: safeDecodeShareParam(query.openmaic_bridge_status),
        openmaic_next_action: safeDecodeShareParam(query.openmaic_next_action),
        openmaic_share_boundary: safeDecodeShareParam(query.openmaic_share_boundary),
        openmaic_game_gate: safeDecodeShareParam(query.openmaic_game_gate),
        openmaic_blocked_fields: safeDecodeShareParam(query.openmaic_blocked_fields),
        openmaic_evidence: safeDecodeShareParam(query.openmaic_evidence),
        openmaic_return_path: safeDecodeShareParam(query.openmaic_return_path)
      }) : {
        code: incomingShareCode,
        share_code: incomingShareCode,
        challenge: query.challenge || '',
        from: query.from || '',
        mode: query.mode || '',
        identity_tag: query.identity || '',
        parent_next_action: query.action || '',
        capability_gap: safeDecodeShareParam(query.capability_gap),
        capability_label: safeDecodeShareParam(query.capability_label),
        capability_next_action: safeDecodeShareParam(query.capability_next_action),
        capability_route: safeDecodeShareParam(query.capability_route),
        challenge_goal: safeDecodeShareParam(query.challenge_goal),
        challenge_rule: safeDecodeShareParam(query.challenge_rule),
        challenge_route: safeDecodeShareParam(query.challenge_route),
        relay_privacy: safeDecodeShareParam(query.relay_privacy),
        relay_review: safeDecodeShareParam(query.relay_review),
        relay_first_step: safeDecodeShareParam(query.relay_first_step),
        relay_id: safeDecodeShareParam(query.relay_id),
        relay_receiver_action: safeDecodeShareParam(query.relay_receiver_action),
        relay_parent_check: safeDecodeShareParam(query.relay_parent_check),
        relay_next_revisit: safeDecodeShareParam(query.relay_next_revisit),
        relay_allowed_fields: safeDecodeShareParam(query.relay_allowed_fields),
        relay_blocked_fields: safeDecodeShareParam(query.relay_blocked_fields),
        relay_completion_signal: safeDecodeShareParam(query.relay_completion_signal),
        relay_return_path: safeDecodeShareParam(query.relay_return_path),
        relay_ladder: safeDecodeShareParam(query.relay_ladder),
        openmaic_bridge_status: safeDecodeShareParam(query.openmaic_bridge_status),
        openmaic_next_action: safeDecodeShareParam(query.openmaic_next_action),
        openmaic_share_boundary: safeDecodeShareParam(query.openmaic_share_boundary),
        openmaic_game_gate: safeDecodeShareParam(query.openmaic_game_gate),
        openmaic_blocked_fields: safeDecodeShareParam(query.openmaic_blocked_fields),
        openmaic_evidence: safeDecodeShareParam(query.openmaic_evidence),
        openmaic_return_path: safeDecodeShareParam(query.openmaic_return_path),
        relay_attraction_hook: safeDecodeShareParam(query.relay_attraction_hook),
        relay_local_gate: safeDecodeShareParam(query.relay_local_gate),
        course_unit_label: safeDecodeShareParam(query.course_unit_label),
        course_unit_subject: safeDecodeShareParam(query.course_unit_subject),
        course_unit_tier: safeDecodeShareParam(query.course_unit_tier),
        course_unit_parent_decision: safeDecodeShareParam(query.course_unit_parent_decision),
        course_unit_report_contract: safeDecodeShareParam(query.course_unit_report_contract),
        course_unit_share_contract: safeDecodeShareParam(query.course_unit_share_contract),
        course_unit_blackboard: safeDecodeShareParam(query.course_unit_blackboard),
        course_unit_recall_route: safeDecodeShareParam(query.course_unit_recall_route),
        course_unit_game_route: safeDecodeShareParam(query.course_unit_game_route),
        question_bank_relay_label: safeDecodeShareParam(query.question_bank_relay_label),
        question_bank_relay_first_step: safeDecodeShareParam(query.question_bank_relay_first_step),
        question_bank_relay_parent_check: safeDecodeShareParam(query.question_bank_relay_parent_check),
        question_bank_relay_route: safeDecodeShareParam(query.question_bank_relay_route),
        question_bank_relay_boundary: safeDecodeShareParam(query.question_bank_relay_boundary),
        visual_board_relay_title: safeDecodeShareParam(query.visual_board_relay_title),
        visual_board_relay_layer: safeDecodeShareParam(query.visual_board_relay_layer),
        visual_board_relay_student_line: safeDecodeShareParam(query.visual_board_relay_student_line),
        visual_board_relay_parent_line: safeDecodeShareParam(query.visual_board_relay_parent_line),
        visual_board_relay_exit: safeDecodeShareParam(query.visual_board_relay_exit),
        visual_board_relay_route: safeDecodeShareParam(query.visual_board_relay_route),
        visual_board_relay_boundary: safeDecodeShareParam(query.visual_board_relay_boundary),
        socratic_report_status: safeDecodeShareParam(query.socratic_report_status),
        socratic_report_action: safeDecodeShareParam(query.socratic_report_action),
        socratic_report_decision: safeDecodeShareParam(query.socratic_report_decision),
        socratic_report_no_increase: safeDecodeShareParam(query.socratic_report_no_increase),
        socratic_report_parent_proof: safeDecodeShareParam(query.socratic_report_parent_proof),
        socratic_report_boundary: safeDecodeShareParam(query.socratic_report_boundary),
        tonight_decision: safeDecodeShareParam(query.tonight_decision),
        tonight_parent_question: safeDecodeShareParam(query.tonight_parent_question),
        tonight_tomorrow: safeDecodeShareParam(query.tonight_tomorrow),
        tonight_release_gate: safeDecodeShareParam(query.tonight_release_gate),
        tonight_share_boundary: safeDecodeShareParam(query.tonight_share_boundary),
        source_challenge_count: safeDecodeShareParam(query.source_challenge_count),
        source_challenge_first: safeDecodeShareParam(query.source_challenge_first),
        source_challenge_prompt: safeDecodeShareParam(query.source_challenge_prompt),
        source_challenge_license: safeDecodeShareParam(query.source_challenge_license),
        source_challenge_decision: safeDecodeShareParam(query.source_challenge_decision),
        source_challenge_local_rule: safeDecodeShareParam(query.source_challenge_local_rule),
        source_challenge_blocked: safeDecodeShareParam(query.source_challenge_blocked),
        source_challenge_route: safeDecodeShareParam(query.source_challenge_route),
        wrong_cause_pack: safeDecodeShareParam(query.wrong_cause_pack),
        wrong_cause_label: safeDecodeShareParam(query.wrong_cause_label),
        wrong_cause_first_step: safeDecodeShareParam(query.wrong_cause_first_step),
        wrong_cause_parent_check: safeDecodeShareParam(query.wrong_cause_parent_check),
        wrong_cause_receiver_action: safeDecodeShareParam(query.wrong_cause_receiver_action),
        wrong_cause_next_revisit: safeDecodeShareParam(query.wrong_cause_next_revisit),
        wrong_cause_allowed_fields: safeDecodeShareParam(query.wrong_cause_allowed_fields),
        wrong_cause_blocked_fields: safeDecodeShareParam(query.wrong_cause_blocked_fields),
        wrong_cause_return_path: safeDecodeShareParam(query.wrong_cause_return_path),
        wrong_cause_gate: safeDecodeShareParam(query.wrong_cause_gate),
        action_label: query.action === 'wrong_cause_revisit'
          ? '明天先回看这张错因卡'
          : query.action === 'due_card_revisit'
            ? '明天先清一张待回访卡'
            : query.action === 'first_step_revisit'
              ? '明天继续说出第一步'
              : '先用自己的材料完成一组轻回访',
        action_detail: query.action === 'wrong_cause_revisit'
          ? '先让孩子说出这张错因卡的第一步，再做一道同类小题。'
          : query.action === 'due_card_revisit'
            ? '先回忆再核对，忘了就回到第一步提示卡。'
            : query.action === 'first_step_revisit'
              ? '家长只问一句，不接管答案：你第一步先看哪里？'
              : '用自己的作业或错题生成一张卡，再完成一次 5 分钟轻回访。'
      };
      if (storage.appendShareRun) {
        storage.appendShareRun({
          share_code: incomingShareCode,
          type: 'share_clicked',
          path: '/pages/home/home',
          title: 'incoming_share',
          payload: {
            share_code: incomingShareCode,
            from: query.from || '',
            challenge: query.challenge || '',
            mode: query.mode || '',
            identity_tag: query.identity || '',
            parent_next_action: query.action || '',
            capability_gap: safeDecodeShareParam(query.capability_gap),
            capability_label: safeDecodeShareParam(query.capability_label),
            challenge_goal: safeDecodeShareParam(query.challenge_goal),
            challenge_rule: safeDecodeShareParam(query.challenge_rule),
            challenge_route: safeDecodeShareParam(query.challenge_route),
            relay_privacy: safeDecodeShareParam(query.relay_privacy),
            relay_review: safeDecodeShareParam(query.relay_review),
            relay_first_step: safeDecodeShareParam(query.relay_first_step),
            course_unit_label: safeDecodeShareParam(query.course_unit_label),
            course_unit_subject: safeDecodeShareParam(query.course_unit_subject),
            course_unit_parent_decision: safeDecodeShareParam(query.course_unit_parent_decision),
            course_unit_report_contract: safeDecodeShareParam(query.course_unit_report_contract),
            course_unit_share_contract: safeDecodeShareParam(query.course_unit_share_contract),
            socratic_report_status: safeDecodeShareParam(query.socratic_report_status),
            socratic_report_action: safeDecodeShareParam(query.socratic_report_action),
            socratic_report_decision: safeDecodeShareParam(query.socratic_report_decision),
            socratic_report_no_increase: safeDecodeShareParam(query.socratic_report_no_increase),
            socratic_report_parent_proof: safeDecodeShareParam(query.socratic_report_parent_proof),
            socratic_report_boundary: safeDecodeShareParam(query.socratic_report_boundary),
            source_challenge_first: safeDecodeShareParam(query.source_challenge_first),
            source_challenge_prompt: safeDecodeShareParam(query.source_challenge_prompt),
            source_challenge_decision: safeDecodeShareParam(query.source_challenge_decision),
            wrong_cause_pack: safeDecodeShareParam(query.wrong_cause_pack),
            wrong_cause_label: safeDecodeShareParam(query.wrong_cause_label),
            wrong_cause_first_step: safeDecodeShareParam(query.wrong_cause_first_step),
            wrong_cause_parent_check: safeDecodeShareParam(query.wrong_cause_parent_check),
            wrong_cause_receiver_action: safeDecodeShareParam(query.wrong_cause_receiver_action),
            wrong_cause_next_revisit: safeDecodeShareParam(query.wrong_cause_next_revisit),
            wrong_cause_blocked_fields: safeDecodeShareParam(query.wrong_cause_blocked_fields)
          }
        });
      }
      api.submitEvent({
        event: 'share_clicked',
        source: query.from || 'share',
        entity_id: incomingShareCode,
        page: 'home',
        payload: {
          code: incomingShareCode,
          share_code: incomingShareCode,
          challenge: query.challenge || '',
          mode: query.mode || '',
          identity_tag: query.identity || '',
          parent_next_action: query.action || '',
          capability_gap: safeDecodeShareParam(query.capability_gap),
          capability_label: safeDecodeShareParam(query.capability_label),
          challenge_goal: safeDecodeShareParam(query.challenge_goal),
          challenge_rule: safeDecodeShareParam(query.challenge_rule),
          challenge_route: safeDecodeShareParam(query.challenge_route),
          relay_privacy: safeDecodeShareParam(query.relay_privacy),
          relay_review: safeDecodeShareParam(query.relay_review),
          relay_first_step: safeDecodeShareParam(query.relay_first_step),
          course_unit_label: safeDecodeShareParam(query.course_unit_label),
          course_unit_subject: safeDecodeShareParam(query.course_unit_subject),
          course_unit_parent_decision: safeDecodeShareParam(query.course_unit_parent_decision),
          course_unit_report_contract: safeDecodeShareParam(query.course_unit_report_contract),
          course_unit_share_contract: safeDecodeShareParam(query.course_unit_share_contract),
          socratic_report_status: safeDecodeShareParam(query.socratic_report_status),
          socratic_report_action: safeDecodeShareParam(query.socratic_report_action),
          socratic_report_decision: safeDecodeShareParam(query.socratic_report_decision),
          socratic_report_no_increase: safeDecodeShareParam(query.socratic_report_no_increase),
          socratic_report_parent_proof: safeDecodeShareParam(query.socratic_report_parent_proof),
          socratic_report_boundary: safeDecodeShareParam(query.socratic_report_boundary),
          source_challenge_first: safeDecodeShareParam(query.source_challenge_first),
          source_challenge_prompt: safeDecodeShareParam(query.source_challenge_prompt),
          source_challenge_decision: safeDecodeShareParam(query.source_challenge_decision),
          wrong_cause_pack: safeDecodeShareParam(query.wrong_cause_pack),
          wrong_cause_label: safeDecodeShareParam(query.wrong_cause_label),
          wrong_cause_first_step: safeDecodeShareParam(query.wrong_cause_first_step),
          wrong_cause_parent_check: safeDecodeShareParam(query.wrong_cause_parent_check),
          wrong_cause_receiver_action: safeDecodeShareParam(query.wrong_cause_receiver_action),
          wrong_cause_next_revisit: safeDecodeShareParam(query.wrong_cause_next_revisit),
          wrong_cause_blocked_fields: safeDecodeShareParam(query.wrong_cause_blocked_fields)
        }
      }).catch(() => {});
      this.setData({
        incomingShare: incoming,
        incomingShareRelay: this.buildIncomingShareRelay(incoming)
      });
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    if (navigation.consumePendingTabRouteContext) {
      navigation.consumePendingTabRouteContext('/pages/home/home');
    }
    setTimeout(() => {
      this.refresh();
    }, 0);
  },

  closeFirstRunOverlay() {
    storage.markFirstRunGuideSeen && storage.markFirstRunGuideSeen();
    this.setData({ showFirstRunOverlay: false });
  },

  toggleLightTools() {
    this.setData({ showLightTools: !this.data.showLightTools });
  },

  contactSupport() {
    wx.showModal({
      title: '反馈建议',
      editable: true,
      placeholderText: '哪里卡住了？写一句就行。',
      success: (res) => {
        if (res.confirm && storage.saveLocalFeedback) {
          storage.saveLocalFeedback({
            page: 'home',
            text: res.content || '',
            source: 'friend_safe_shell'
          });
          wx.showToast({ title: '已收到反馈', icon: 'none' });
        }
      }
    });
  },

  copySupportWechat() {
    if (wx.setClipboardData) {
      wx.setClipboardData({ data: 'yuandian-support' });
    } else {
      wx.showToast({ title: '请联系 yuandian-support', icon: 'none' });
    }
  },

  onShareAppMessage() {
    const profile = storage.loadProfile ? storage.loadProfile() : {};
    const name = profile.name || '我家孩子';
    return {
      title: `${name} 今晚确认了第一步`,
      path: `/pages/home/home?ref=${storage.getLocalUserId ? storage.getLocalUserId() : ''}`
    };
  },

  buildDailyMemoryTaskCard(reviewSummary = {}, todayFocus = null) {
    const cards = reviewCards.sessionCards ? reviewCards.sessionCards('smart', 3) : [];
    const profile = storage.loadGameProfile ? storage.loadGameProfile() : {};
    const events = storage.loadReviewEvents ? storage.loadReviewEvents() : [];
    const weakKey = (todayFocus && (todayFocus.issueType || todayFocus.title || todayFocus.systemSuggestedStep))
      || (cards[0] && (cards[0].wrongCauseLabel || cards[0].weakPoint || cards[0].subject))
      || '第一步';
    const questSet = gameLogic.buildDailyQuestSet
      ? gameLogic.buildDailyQuestSet(profile, cards, events, { now: new Date() })
      : {};
    const retentionLoop = gameLogic.buildGameRetentionLoop
      ? gameLogic.buildGameRetentionLoop(profile, {}, { targetAccuracy: 80 }, questSet, { weakKey })
      : {};
    const loop = gameLogic.buildHighFrequencyPracticeLoop
      ? gameLogic.buildHighFrequencyPracticeLoop(profile, cards, events, {}, { targetAccuracy: 80 }, questSet, {
        weakKey,
        retentionLoop
      })
      : {};
    const primary = loop.dailyPrimaryRecallAction || {};
    const prescription = loop.dailyMemoryPrescription || {};
    const contract = loop.dailyReturnContract || {};
    const season = loop.dailyMemorySeasonPlan || {};
    const sprint = loop.dailyMemorySprintDeck || {};
    const taskCards = (cards.length ? cards : (loop.recallCards || [])).slice(0, 3).map((card, index) => ({
      id: card.id || `daily_memory_${index + 1}`,
      label: `第 ${index + 1} 张`,
      title: card.question || card.front || card.prompt || `${weakKey} 的第一步`,
      action: card.checkpoint || card.nextAction || card.firstStep || '遮住答案，先说出第一步。'
    }));
    while (taskCards.length < 3) {
      const order = taskCards.length + 1;
      taskCards.push({
        id: `daily_memory_fallback_${order}`,
        label: `第 ${order} 张`,
        title: `${weakKey} 的主动回忆`,
        action: '遮住答案，先说第一步和最容易错的检查点。'
      });
    }
    const nextEvidence = contract.nextDayReturnEvidence || {};
    const xpRule = (prescription.releaseQueue || []).find((item) => item.id === 'xp_release');
    return {
      id: 'home_daily_90s_memory_task',
      title: '今日 90 秒记忆任务',
      subtitle: primary.action || `只做 3 张主动回忆卡，围绕「${weakKey}」说第一步，不刷题量。`,
      cardCount: taskCards.length,
      dueCount: Number((reviewSummary && reviewSummary.due) || 0),
      route: primary.route || '/pages/review/review?from=home_daily_memory_task',
      arcadeRoute: '/pages/arcade/arcade?from=home_daily_memory_task',
      reviewRoute: '/pages/review/review?from=home_daily_memory_task',
      taskCards,
      tomorrowLine: nextEvidence.dueAt
        ? `明天已锁定回访：${String(nextEvidence.dueAt).slice(5, 10)}`
        : '明天回访已进入规则：没有次日回访，不更新长期画像。',
      xpRule: xpRule && xpRule.rule ? xpRule.rule : 'XP 只奖励主动回忆、错因修复和次日回访，不奖励速度、分数或排名。',
      shareLine: season.sharePayload && season.sharePayload.receiverRule
        ? season.sharePayload.receiverRule
        : '可分享 90 秒回忆接力，只带动作和回访时间，不带原题、答案、分数或排名。',
      continuityLine: sprint.summary || '每天回来只接一件事：3 张卡、90 秒、明天回访。'
    };
  },

  buildMiniLessonResumeCard(cards = []) {
    const list = Array.isArray(cards) ? cards : [];
    const card = list.find((item) => item && item.type === 'three_minute_mini_lesson_return' && !item.isRevisited);
    if (!card) return null;
    return {
      id: card.id,
      title: card.title || '3 分钟小讲堂回访卡',
      topicLabel: card.topicLabel || card.weakPoint || card.wrongCause || '',
      conceptGap: card.wrongCause || card.wrongCauseBucket || '',
      firstStep: card.prompt || card.front || '',
      blackboardLine: card.blackboardLine || card.prompt || '',
      parentLine: card.backPrompt || (card.nextPracticePlan && card.nextPracticePlan.parentPrompt) || '',
      nextDayReview: card.revisit || (card.nextPracticePlan && card.nextPracticePlan.nextPracticeText) || '',
      route: '/pages/review/review?from=home_mini_lesson_resume',
      blockedFields: card.blockedFields || ['original_question', 'full_answer', 'score', 'ranking', 'talent_label']
    };
  },

  refresh() {
    const loadedState = storage.loadState();
    const state = loadedState;
    const plan = state.homework_plan || {};
    const mustDo = plan.must_do || [];
    const summary = plan.summary || {};
    const topMust = mustDo[0] || null;
    const evidence = (topMust && topMust.evidence) || {};
    const weakPoint = evidence.weak_point || null;
    const tags = (evidence.tags || []).slice(0, 3);
    const reviewSummary = reviewCards.reviewSummary();
    const thinkingSummary = storage.thinkingReceiptSummary ? storage.thinkingReceiptSummary() : null;
    const tonightPlan = storage.loadTonightPlan ? storage.loadTonightPlan() : null;
    const todayFocus = storage.loadTodayFocus ? storage.loadTodayFocus() : null;
    const miniLessonResume = this.buildMiniLessonResumeCard(storage.loadReviewCards ? storage.loadReviewCards() : []);
    const learningReportState = storage.loadLearningReportState ? storage.loadLearningReportState() : null;
    const uploadReportHandoff = storage.get ? storage.get('upload.report.handoff.v1', null) : null;
    const todaySession = storage.getTodaySession ? storage.getTodaySession() : null;
    const focusEntryReady = storage.canStartFocusFromTodaySession
      ? storage.canStartFocusFromTodaySession(todaySession)
      : !!(todaySession && todaySession.childArticulatedStep);
    const yesterdayReviewCard = storage.getYesterdayReview ? storage.getYesterdayReview() : null;
    const companionPreference = storage.loadCompanionPreference ? storage.loadCompanionPreference() : null;
    const growthMemoryLine = storage.getGrowthMemoryLine ? storage.getGrowthMemoryLine(null, companionPreference) : null;
    const modulePath = learningModules.buildAdaptivePath(
      state,
      storage.moduleFeedbackMap ? storage.moduleFeedbackMap() : {},
      storage.loadModuleEvents ? storage.loadModuleEvents() : [],
      3,
      storage.loadReviewCards ? storage.loadReviewCards() : []
    );
    const todayActions = this.buildTodayActions(topMust, reviewSummary, modulePath);
    const incomingShare = (storage.loadIncomingShare && storage.loadIncomingShare()) || this.data.incomingShare || null;
    const incomingShareRelay = this.buildIncomingShareRelay(incomingShare);
    this.setData({
      state,
      weakPoints: (state.weak_points || []).slice(0, 2),
      topMust,
      stats: {
        must: mustDo.length,
        flexible: (plan.flexible || []).length,
        skip: (plan.can_skip || []).length
      },
      proofStats: [
        { label: '必须做时间', value: `${summary.must_minutes || 0} 分钟` },
        { label: '预计少做', value: `${summary.saved_minutes || 0} 分钟` },
        { label: '卡点命中', value: `${summary.misconception_count || 0}` }
      ],
      topMustProof: topMust ? {
        weak: weakPoint ? `${weakPoint.name} ${weakPoint.score}` : '当前卡点',
        tags,
        decision: evidence.decision || topMust.reason || '先做它，因为它对今晚最有学习价值。',
        calibration: evidence.calibration_key || 'general:task'
      } : null,
      reviewSummary,
      loopSummary: reviewSummary.loop,
      syncSummary: reviewSummary.sync,
      todayActions,
      cockpit: {
        title: modulePath.current ? modulePath.current.title : '打开轻练习',
        reason: modulePath.reason || '选一个最聚焦的方法，把它变成点拨提示和复习卡。',
        score: modulePath.current ? modulePath.current.score : 0,
        maturity: reviewSummary.maturity ? reviewSummary.maturity.overall : 0,
        readiness: reviewSummary.commercialReadiness ? reviewSummary.commercialReadiness.average : 0
      },
      executiveBrief: this.buildExecutiveBrief(state, topMust, reviewSummary, thinkingSummary, modulePath),
      pathRouter: this.buildPathRouter(),
      returnLoop: this.buildReturnLoop(reviewSummary),
      tonightSprint: this.buildTonightSprint(topMust, reviewSummary, modulePath),
      parentHandoff: this.buildParentHandoff(topMust, reviewSummary, state),
      quickDock: this.buildQuickDock(topMust, reviewSummary, modulePath),
      incomingShare,
      incomingShareRelay,
      todaySession,
      focusEntryReady,
      yesterdayReviewCard: yesterdayReviewCard ? Object.assign({}, yesterdayReviewCard, {
        noticeText: yesterdayReviewCard.focusCompletionType === 'interrupted'
          ? `昨晚我们停在“${yesterdayReviewCard.childArticulatedStep || '第一步'}”这一步，今天轻轻接一下？`
          : '昨晚这一步你已经坐过一段，今晚有新卡住的题吗？'
      }) : null,
      gameHero: this.buildGameHero(topMust, reviewSummary, modulePath),
      missionCards: this.buildMissionCards(topMust, reviewSummary, modulePath),
      contentEntry: this.buildContentEntry(modulePath, reviewSummary),
      parentSnapshot: this.buildParentSnapshot(state, topMust, reviewSummary, thinkingSummary),
      weaknessVerdict: this.buildWeaknessVerdict(state, topMust, reviewSummary, thinkingSummary, modulePath),
      arcadeEntry: this.buildArcadeEntry(reviewSummary),
      wrongbookEntry: this.buildWrongbookEntry(reviewSummary),
      firstRunGuide: this.buildFirstRunGuide(topMust, reviewSummary, state),
      dashboardHeader: this.buildDashboardHeader(topMust, reviewSummary, modulePath, state),
      promptChips: this.buildPromptChips(),
      categoryFilters: this.buildCategoryFilters(),
      toolCards: this.buildToolCards(topMust, reviewSummary, modulePath, state),
      visibleToolCards: this.filterToolCards(this.buildToolCards(topMust, reviewSummary, modulePath, state), 'featured'),
      progressStrip: this.buildProgressStrip(topMust, reviewSummary, modulePath),
      parentSupportCards: this.buildParentSupportCards(topMust, reviewSummary, state),
      suggestedNextStep: this.buildSuggestedNextStep(topMust, reviewSummary),
      learningStages: this.buildLearningStages(reviewSummary, topMust),
      localScenarioCases: storage.buildLocalScenarioLoopCases
        ? storage.buildLocalScenarioLoopCases().slice(0, 4)
        : [],
      learningQuestArc: storage.buildLearningQuestArc ? storage.buildLearningQuestArc() : null,
      moduleFlowCompass: storage.buildModuleFlowCompass ? storage.buildModuleFlowCompass() : null,
      surfaceDepthPack: storage.buildSurfaceDepthPack ? storage.buildSurfaceDepthPack('home') : null,
      capabilityMaturityQueue: storage.buildCapabilityMaturityQueue ? storage.buildCapabilityMaturityQueue() : null,
      unifiedNextAction: storage.buildUnifiedNextActionController ? storage.buildUnifiedNextActionController({ surface: 'home' }) : null,
      dailyMemoryTask: this.buildDailyMemoryTaskCard(reviewSummary, todayFocus),
      sevenSubjectMasterySprint: storage.buildSevenSubjectMasterySprint ? storage.buildSevenSubjectMasterySprint() : null,
      todayFocus,
      tonightPlan,
      routeStrip: this.buildRouteStrip('plan', tonightPlan),
      routeDisplayText: '今晚路线 · 第 1 步：排顺序',
      companionPreference,
      companionCopy: {
        home: storage.getCompanionStageCopy ? storage.getCompanionStageCopy('home_plan', companionPreference) : '咕点陪你先找今晚第一步。'
      },
      companionLine: storage.formatCompanionLine ? storage.formatCompanionLine(companionPreference) : '咕点：我懂你卡住了，我陪你先迈出第一步。',
      homeViewModel: buildHomeViewModel({
        companionPreference,
        tonightPlan,
        todayFocus,
        miniLessonResume,
        learningReportState,
        uploadReportHandoff,
        yesterdayReviewCard,
        incomingShareRelay,
        growthMemory: growthMemoryLine
      }),
      growthMemory: {
        home: growthMemoryLine && !growthMemoryLine.empty
          ? growthMemoryLine.oneLine
          : (storage.growthMemoryCopyFor ? storage.growthMemoryCopyFor('home', companionPreference) : '')
      },
      companionOptions: storage.COMPANION_OPTIONS || [],
      showWeakVerdict: !!(tonightPlan || todayFocus || this.data.focusFeedback),
      planSummaryText: tonightPlan && tonightPlan.summaryLine
        ? tonightPlan.summaryLine
        : (growthMemoryLine && !growthMemoryLine.empty
          ? growthMemoryLine.oneLine
          : (storage.growthMemoryCopyFor ? storage.growthMemoryCopyFor('home', companionPreference) : '')),
      updatedText: state.updated_at ? state.updated_at.slice(5, 16).replace('T', ' ') : '刚刚'
    });
  },

  buildRouteStrip(active, tonightPlan) {
    const plan = tonightPlan || {};
    return {
      text: plan.summaryLine || '今晚路线：排顺序 → 说第一步 → 修卡点 → 轻回访 → 家长看',
      shortText: '今晚路线 · 第 1 步：排顺序',
      steps: (plan.routeSteps || [
        { id: 'plan', label: '排顺序' },
        { id: 'first_step', label: '说第一步' },
        { id: 'repair', label: '修卡点' },
        { id: 'review', label: '轻回访' },
        { id: 'parent', label: '家长看' }
      ]).map((step) => Object.assign({}, step, { active: step.id === active || step.active && step.id === active }))
    };
  },

  buildDashboardHeader(topMust, reviewSummary, modulePath, state) {
    const weak = ((state && state.weak_points) || [])[0] || {};
    const currentModule = modulePath && modulePath.current ? modulePath.current : null;
    const due = Number((reviewSummary && reviewSummary.due) || 0);
    const quiz = Number((reviewSummary && reviewSummary.quiz && reviewSummary.quiz.count) || 0);
    return {
      brand: '原点智学',
      subtitle: '作业点拨',
      status: topMust ? '已找到下一步' : '等待学习上下文',
      weak: weak.name || '先找到卡点',
      pack: currentModule ? currentModule.title : '可生成轻练习',
      review: `${due} 张复习 · ${quiz} 道小测`,
      actions: [
        { id: 'arcade', label: '轻回访', action: 'goLearningMap' },
        { id: 'profile', label: '我的', action: 'goProfile' }
      ]
    };
  },

  buildPromptChips() {
    const keep = ['read_question', 'write_equation', 'review_this'];
    return importIntake.IMPORT_CHIPS
      .filter((item) => keep.includes(item.id))
      .slice(0, 3)
      .map((item, index) => Object.assign({}, item, {
        displayLabel: item.label || item.text || '',
        warmClass: index === 1 ? 'warm' : ''
      }));
  },

  buildWeaknessVerdict(state, topMust, reviewSummary, thinkingSummary, modulePath) {
    const weak = ((state && state.weak_points) || [])[0] || {};
    const evidence = (topMust && topMust.evidence) || {};
    const tag = ((evidence.misconception_tags || [])[0]) || {};
    const due = Number((reviewSummary && reviewSummary.due) || 0);
    const thinking = thinkingSummary || {};
    const module = modulePath && modulePath.current ? modulePath.current : null;
    const name = weak.name || tag.name || tag.label || '先说第一步';
    const why = topMust
      ? (evidence.decision || topMust.reason || '它最可能影响今晚作业是否做得下去。')
      : due
        ? `有 ${due} 张内容该回忆，先看有没有真的记住。`
        : '还没有足够记录，先用一道真实题开始判断。';
    const tonight = topMust
      ? `先做「${topMust.text}」，只做第一步和卡住点。`
      : module
        ? `先把材料做成「${module.title}」。`
        : '先发题目和你想到的一步，点拨会继续追问。';
    const helper = topMust
      ? '先用作业点拨拆下一步，做错了再去修卡点。'
      : due
        ? '先去复习；错了再回作业点拨拆卡点。'
        : '先问一个小问题，不急着讲最终结果。';
    const confidence = Math.min(96, 48
      + (weak.score ? Math.round(Number(weak.score || 0) / 5) : 0)
      + Math.min(16, due * 3)
      + Math.min(12, Number(thinking.total || 0) * 3)
      + (topMust ? 12 : 0));
    return {
      title: '今晚先修这一处',
      name,
      why,
      tonight,
      helper,
      confidence,
      primaryLabel: topMust ? '去作业点拨' : due ? '先复习一轮' : '先发一道题',
      primaryAction: topMust ? 'startTopMust' : due ? 'goReview' : 'goTutor',
      secondaryLabel: '去修卡点',
      secondaryAction: 'goReview'
    };
  },

  buildLearningStages(reviewSummary, topMust) {
    const due = Number((reviewSummary && reviewSummary.due) || 0);
    const repair = Number((reviewSummary && reviewSummary.qualityQueue && reviewSummary.qualityQueue.length) || 0);
    return [
      {
        id: 'preview',
        label: '预习',
        title: '先猜主线，再看要点',
        body: '把课本标题或课堂要点发来，先说你觉得会讲什么，再生成一组轻练习。',
        action: 'goLearningMap',
        meta: '先想'
      },
      {
        id: 'learn',
        label: '学习',
        title: '先讲思路，再给提示',
        body: topMust ? topMust.text : '题目、作业、知识点都可以问；先说你想到哪一步，再一起往下走。',
        action: topMust ? 'startTopMust' : 'goTutor',
        meta: '只提示'
      },
      {
        id: 'review',
        label: '复习',
        title: due ? `${due} 张今天该回忆` : '没有到期卡也能保持手感',
        body: '先主动回忆，再看提示；会进入回访记录、连续天和间隔复习。',
        action: 'goReview',
        meta: '5 分钟'
      },
      {
        id: 'wrong',
        label: '错题',
        title: repair ? `${repair} 张需要修卡点` : '把错题变成复习线索',
        body: '写下题目、原想法和卡住的一步，整理成卡点卡和变式卡。',
        action: 'goReviewInput',
        meta: '闭环'
      }
    ];
  },

  buildCategoryFilters() {
    return [
      { id: 'featured', label: '常用' },
      { id: 'generate', label: '轻练习' },
      { id: 'review', label: '复习' },
      { id: 'profile', label: '我的' },
      { id: 'all', label: '全部' }
    ];
  },

  buildToolCards(topMust, reviewSummary, modulePath, state) {
    const currentModule = modulePath && modulePath.current ? modulePath.current : null;
    const weak = ((state && state.weak_points) || [])[0] || {};
    const due = Number((reviewSummary && reviewSummary.due) || 0);
    return [
      {
        id: 'pack',
        category: 'generate',
        tone: 'sky',
        title: '生成轻练习',
        desc: currentModule ? currentModule.title : '把作业、笔记或材料变成卡片、小测和回访提示。',
        status: currentModule ? `已推荐 ${currentModule.score}` : '材料入口',
        cta: '打开',
        action: 'goLearningMap',
        featured: true
      },
      {
        id: 'review',
        category: 'review',
        tone: 'violet',
        title: '5 分钟轻回访',
        desc: `今天 ${due} 张到期，先回忆再核对思路。`,
        status: '5 分钟一关',
        cta: '开始',
        action: 'goReview',
        featured: true
      },
      {
        id: 'tutor',
        category: 'today',
        tone: 'mint',
        title: '作业点拨',
        desc: '不会直接代写结果，只陪你说清题目和第一步。',
        status: '思路引导',
        cta: '提问',
        action: 'goTutor',
        featured: false
      },
      {
        id: 'upload',
        category: 'generate',
        tone: 'cream',
        title: '今晚作业',
        desc: '题型、数量、卡住哪里，写三行也能开始。',
        status: '手动录入',
        cta: '录入作业',
        action: 'goUpload',
        featured: false
      },
      {
        id: 'learningProfile',
        category: 'profile',
        tone: 'deep',
        title: '我的学习档案',
        desc: weak.name ? `当前先看 ${weak.name}。` : '只看今晚优先做什么。',
        status: weak.score ? `卡点 ${weak.score}` : '成长记录',
        cta: '查看',
        action: 'goProfile',
        featured: true
      },
      {
        id: 'weeklyReport',
        category: 'profile',
        tone: 'paper',
        title: '本周进展',
        desc: '看回访、小卡和今天修过的卡点。',
        status: `${reviewSummary.total || 0} 张复习卡`,
        cta: '查看',
        action: 'goProfile',
        featured: false
      }
    ];
  },

  filterToolCards(cards, category) {
    if (category === 'all') return cards;
    if (category === 'featured') return (cards || []).filter((item) => item.featured);
    return (cards || []).filter((item) => item.category === category);
  },

  buildProgressStrip(topMust, reviewSummary, modulePath) {
    const goal = reviewSummary.goal || {};
    const progress = Number((reviewSummary.progress && reviewSummary.progress.progress) || 0);
    const currentModule = modulePath && modulePath.current ? modulePath.current : null;
    return {
      percent: Math.max(8, Math.min(100, progress || (topMust ? 42 : 18))),
      label: topMust ? '建议先做这个' : '等待你的作业清单',
      time: topMust ? `${topMust.minutes || 10} 分钟` : '约 3 分钟规划',
      lives: goal.completed >= goal.target ? '已完成' : '今晚',
      pack: currentModule ? '可生成轻练习' : '先做作业点拨'
    };
  },

  buildSuggestedNextStep(topMust, reviewSummary) {
    if (topMust) {
      return {
        title: '建议先做这个',
        body: topMust.text || '先完成今晚最关键的一小步。',
        meta: `${topMust.minutes || 10} 分钟`,
        primaryLabel: '开始这一小步',
        primaryAction: 'startTopMust',
        secondaryLabel: '换一个建议',
        secondaryAction: 'goReportPreview'
      };
    }
    return {
      title: '建议先做这个',
      body: '先把任务拆成 3 步，再从最容易开始的一步做起。',
      meta: `${reviewSummary.due || 0} 张复习待回访`,
      primaryLabel: '开始这一小步',
      primaryAction: 'submitAiDraft',
      secondaryLabel: '换一个建议',
      secondaryAction: 'goUpload'
    };
  },

  buildParentSupportCards(topMust, reviewSummary, state) {
    const weak = ((state && state.weak_points) || [])[0] || {};
    return [
      {
        id: 'decision',
        title: '看今晚优先做什么',
        body: topMust ? `先看：${topMust.text}` : '先生成作业三分类，再看为什么先做它。',
        cta: '看我的决策',
        action: 'goReportPreview'
      },
      {
        id: 'weekly',
        title: '看本周一句话进展',
        body: weak.name ? `本周重点：${weak.name}。复习记录 ${reviewSummary.total || 0} 张。` : '用复习和卡点记录生成自己的进展。',
        cta: '看我的进展',
        action: 'goProfile'
      }
    ];
  },

  buildFirstRunGuide(topMust, reviewSummary, state) {
    const hasRealHomework = !!(state && state.homework_text);
    const totalCards = Number((reviewSummary && reviewSummary.total) || 0);
    return {
      title: hasRealHomework ? '今晚按这个顺序走' : '第一次打开，先做这 3 步',
      label: hasRealHomework
        ? '先做最高价值任务，再把卡点沉淀成复习卡。'
        : '直接填今晚作业，我会分出必交先做、灵活安排、可以后置。',
      steps: [
        {
          id: 'upload',
          value: '1',
          title: '填作业',
          body: hasRealHomework ? '已拿到今晚作业。' : '粘贴题号、数量和孩子卡住的位置。',
          action: 'goUpload',
          cta: hasRealHomework ? '更新作业' : '开始填写'
        },
        {
          id: 'tutor',
          value: '2',
          title: '只辅导必须做',
          body: topMust ? topMust.text : '我会挑出最值得今晚先做的任务。',
          action: topMust ? 'startTopMust' : 'goUpload',
          cta: topMust ? '去点拨' : '先分类'
        },
        {
          id: 'review',
          value: '3',
          title: '卡点进复习',
          body: totalCards ? `${totalCards} 张复习卡已在长期队列。` : '做完后生成复习卡，明天自动回访。',
          action: 'goReview',
          cta: '看复习'
        }
      ]
    };
  },

  buildArcadeEntry(reviewSummary) {
    const cards = reviewCards.sessionCards('smart', 8);
    const fallback = cards.length ? cards : reviewCards.cardBrowser({ status: 'all', limit: 8 });
    return arcadeEngine.buildHomeArcadeEntry(reviewSummary || {}, fallback);
  },

  buildIncomingShareRelay(incoming = null) {
    if (!incoming || !incoming.share_code) return null;
    const actionLabel = incoming.action_label || '先接住这张学习复盘卡';
    const actionDetail = incoming.action_detail || incoming.capability_next_action || '用自己的材料走一遍：第一步、轻练、回访。';
    const challengeRoute = navigation.normalizeRoute(incoming.challenge_route || incoming.capability_route || '/pages/arcade/arcade');
    const unitRoute = navigation.normalizeRoute(incoming.course_unit_game_route || incoming.course_unit_recall_route || challengeRoute);
    const firstStep = incoming.relay_first_step || incoming.challenge_goal || actionLabel;
    const privacyLine = incoming.relay_privacy || '分享只带学习动作和回访证据，不带孩子完整对话、分数、原题照片。';
    const reviewLine = incoming.relay_review || '第 7 天用 1 道小变式确认能不能迁移。';
    const naturalSpread = {
      inviteLine: incoming.relay_invite_line || '',
      receiverPrompt: incoming.relay_receiver_prompt || '',
      parentReassuranceLine: incoming.relay_parent_reassurance || '',
      day7ReturnLine: incoming.relay_day7_return || '',
      proofOfLifeSignal: incoming.relay_proof_signal || '',
      guardrailLine: incoming.relay_guardrail || ''
    };
    const spreadReadinessGate = incoming.relay_spread_status ? {
      status: incoming.relay_spread_status,
      score: incoming.relay_spread_score || '',
      shareModeLine: incoming.relay_spread_line || '',
      fallbackLine: incoming.relay_spread_fallback || '',
      reasonLine: incoming.relay_spread_reason || '',
      requiredEvidence: incoming.relay_spread_required || ''
    } : null;
    const peerRelayLadder = incoming.relay_ladder ? {
      stageLine: incoming.relay_ladder,
      attractionHook: incoming.relay_attraction_hook || '',
      localGate: incoming.relay_local_gate || ''
    } : null;
    const peerRelaySeasonArc = incoming.relay_season ? {
      id: incoming.relay_season,
      status: incoming.relay_season_status || '',
      seasonLine: incoming.relay_season_line || '',
      days: incoming.relay_season_days || '',
      localGate: incoming.relay_season_gate || ''
    } : null;
    const sourceChallengeRoute = navigation.normalizeRoute(incoming.source_challenge_route || challengeRoute);
    const sourceChallengeDeck = incoming.source_challenge_prompt ? {
      count: incoming.source_challenge_count || '',
      sourceLabel: incoming.source_challenge_first || '公开/OER资料',
      prompt: incoming.source_challenge_prompt,
      licenseSignal: incoming.source_challenge_license || '',
      commercialDecision: incoming.source_challenge_decision || '',
      localRule: incoming.source_challenge_local_rule || '',
      blockedFields: incoming.source_challenge_blocked || '',
      route: sourceChallengeRoute
    } : null;
    const wrongCauseRoute = navigation.normalizeRoute(incoming.wrong_cause_return_path || challengeRoute);
    const wrongCauseViralPack = incoming.wrong_cause_pack || incoming.wrong_cause_label ? {
      label: incoming.wrong_cause_label || '同类错因',
      firstStep: incoming.wrong_cause_first_step || firstStep,
      parentCheck: incoming.wrong_cause_parent_check || '',
      receiverAction: incoming.wrong_cause_receiver_action || `用自己的材料复刻：${incoming.wrong_cause_first_step || firstStep}`,
      nextRevisit: incoming.wrong_cause_next_revisit || '明天回访同一错因',
      allowedFields: incoming.wrong_cause_allowed_fields || 'wrong_cause_label,first_step,parent_check,receiver_action,next_day_revisit',
      blockedFields: incoming.wrong_cause_blocked_fields || 'original_question,original_answer,original_photo,full_dialogue,score,ranking,private_comment',
      localGate: incoming.wrong_cause_gate || 'wrong_cause_relay_ready',
      route: wrongCauseRoute
    } : null;
    const safeRelayPacket = incoming.relay_id ? {
      relayId: incoming.relay_id,
      receiverAction: incoming.relay_receiver_action || actionDetail,
      parentCheck: incoming.relay_parent_check || '家长只看行动证据，不看完整对话。',
      nextDayRevisit: incoming.relay_next_revisit || reviewLine,
      allowedFields: incoming.relay_allowed_fields || 'relay_id,first_step,receiver_action,parent_check,next_day_revisit',
      blockedFields: incoming.relay_blocked_fields || 'original_photo,full_dialogue,score,ranking,private_comment,original_answer',
      completionSignal: incoming.relay_completion_signal || 'active_recall_next_revisit',
      returnPath: incoming.relay_return_path || challengeRoute
    } : null;
    const receiverOwnMaterialChallenge = storage.buildReceiverOwnMaterialChallenge
      ? storage.buildReceiverOwnMaterialChallenge(incoming)
      : null;
    const shareRuns = storage.loadShareRuns ? storage.loadShareRuns() : [];
    const reviewEvents = storage.loadReviewEvents ? storage.loadReviewEvents() : [];
    const receiverCompletion = shareRuns.find((item) => item && item.share_code === incoming.share_code && item.type === 'share_relay_receiver_completion')
      || reviewEvents.find((item) => item && item.share_code === incoming.share_code && item.type === 'share_relay_receiver_completion')
      || null;
    const unitLine = incoming.course_unit_label
      ? `${incoming.course_unit_subject || '当前学科'} · ${incoming.course_unit_label}`
      : '';
    const questionBankRelayRoute = navigation.normalizeRoute(incoming.question_bank_relay_route || unitRoute);
    const questionBankRelayLine = incoming.question_bank_relay_label
      ? `题型接力：${incoming.question_bank_relay_label}。先说第一步，不看原题答案。`
      : '';
    const visualBoardRelayRoute = navigation.normalizeRoute(incoming.visual_board_relay_route || questionBankRelayRoute);
    const visualBoardRelayLine = incoming.visual_board_relay_title
      ? `小黑板接力：${incoming.visual_board_relay_title}。只复用第一步图解，不看原题答案。`
      : '';
    const hasSocraticReport = !!(
      incoming.socratic_report_status ||
      incoming.socratic_report_action ||
      incoming.socratic_report_decision ||
      incoming.socratic_report_no_increase ||
      incoming.socratic_report_parent_proof ||
      incoming.socratic_report_boundary
    );
    const socraticReportSummary = hasSocraticReport
      ? `这张卡带回点拨质量证据：${incoming.socratic_report_status || '待复核'}。先执行报告里的最小动作，不加题、不看排名。`
      : '';
    const hasTonightDecision = !!(
      incoming.tonight_decision ||
      incoming.tonight_parent_question ||
      incoming.tonight_tomorrow ||
      incoming.tonight_release_gate ||
      incoming.tonight_share_boundary
    );
    const tonightDecisionSummary = hasTonightDecision
      ? `这张卡带回一份今晚决策书：${incoming.tonight_decision || '先做一个最小动作'}`
      : '';
    const socraticReportEvidence = incoming.tonight_decision || incoming.socratic_report_decision || incoming.socratic_report_action || '';
    const primaryReceiverAction = (safeRelayPacket && safeRelayPacket.receiverAction) || (wrongCauseViralPack && wrongCauseViralPack.receiverAction) || actionDetail;
    const primaryParentCheck = (safeRelayPacket && safeRelayPacket.parentCheck) || incoming.question_bank_relay_parent_check || incoming.visual_board_relay_parent_line || incoming.tonight_parent_question || '家长只问孩子第一步怎么想，不看完整答案。';
    const primaryNextRevisit = (safeRelayPacket && safeRelayPacket.nextDayRevisit) || incoming.tonight_tomorrow || (wrongCauseViralPack && wrongCauseViralPack.nextRevisit) || reviewLine;
    const relayPackBlockedFields = (safeRelayPacket && safeRelayPacket.blockedFields) || (wrongCauseViralPack && wrongCauseViralPack.blockedFields) || 'original_question,full_answer,photo,score,ranking,full_dialogue';
    const defaultReceiverAction = {
      id: 'receiver_own_material',
      label: '用我自己的作业做同类第一步',
      displayLabel: '用我自己的作业做同类第一步',
      route: receiverOwnMaterialChallenge ? receiverOwnMaterialChallenge.route : questionBankRelayRoute,
      reason: receiverOwnMaterialChallenge
        ? receiverOwnMaterialChallenge.receiverAction
        : '不用看对方原题；打开自己的作业或错题，只复刻同类第一步。',
      evidence: 'receiver_own_first_step',
      parentCheck: primaryParentCheck,
      tomorrow: primaryNextRevisit,
      safetyLine: `默认接力不带：${relayPackBlockedFields}`
    };
    const relayPackCards = [
      {
        id: 'tonight_action',
        title: '今晚动作',
        line: incoming.tonight_decision || primaryReceiverAction || '用自己的材料完成一个 5 分钟第一步动作。',
        evidence: incoming.tonight_release_gate || '完成后留下自己的第一步和错因证据。',
        route: challengeRoute
      },
      {
        id: 'first_step',
        title: '第一步/错因',
        line: incoming.question_bank_relay_first_step || incoming.wrong_cause_first_step || firstStep,
        evidence: incoming.wrong_cause_label ? `错因：${incoming.wrong_cause_label}` : '只复用思路，不复制原题和答案。',
        route: wrongCauseRoute
      },
      {
        id: 'tomorrow_revisit',
        title: '明天回访',
        line: primaryNextRevisit,
        evidence: primaryParentCheck,
        route: '/pages/profile/profile?from=share_relay_pack'
      }
    ];
    return {
      title: '回流接力板',
      summary: tonightDecisionSummary || socraticReportSummary || (unitLine ? `这张卡带回一个单元动作：${unitLine}。先复用第一步，不看排名。` : '朋友分享的不是排名，是一个可复用的小动作。先选一条路，按点会留下接力证据。'),
      evidenceLine: socraticReportEvidence || incoming.course_unit_share_contract || incoming.capability_label || incoming.challenge_goal || actionLabel,
      relayPackTitle: '先接这三件事',
      relayPackSummary: '接收页先给行动，不堆信息：今晚做什么、第一步怎么想、明天怎么回访。',
      relayPackReady: relayPackCards.length === 3,
      relayPackBlockedFields,
      relayPackBlockedLine: `三卡不带：${relayPackBlockedFields}`,
      relayPackCards,
      defaultReceiverAction,
      defaultReceiverActionTitle: defaultReceiverAction.label,
      defaultReceiverActionLine: defaultReceiverAction.reason,
      defaultReceiverActionParentCheck: defaultReceiverAction.parentCheck,
      defaultReceiverActionTomorrow: defaultReceiverAction.tomorrow,
      defaultReceiverActionSafetyLine: defaultReceiverAction.safetyLine,
      receiverOwnMaterialChallenge,
      receiverOwnMaterialChallengeLine: receiverOwnMaterialChallenge ? `接收者自己的材料挑战：${receiverOwnMaterialChallenge.label}｜${receiverOwnMaterialChallenge.receiverAction}` : '',
      receiverOwnMaterialChallengeRoute: receiverOwnMaterialChallenge ? receiverOwnMaterialChallenge.route : '',
      receiverOwnMaterialChallengeParentCheckLine: receiverOwnMaterialChallenge ? receiverOwnMaterialChallenge.parentCheck : '',
      receiverOwnMaterialChallengeNextRevisitLine: receiverOwnMaterialChallenge ? receiverOwnMaterialChallenge.nextRevisit : '',
      receiverOwnMaterialChallengeBoundaryLine: receiverOwnMaterialChallenge ? receiverOwnMaterialChallenge.shareBoundary : '',
      receiverOwnMaterialChallengeEvidenceLine: receiverOwnMaterialChallenge
        ? `接力证据：${receiverOwnMaterialChallenge.evidenceContract.required.join(' / ')}`
        : '',
      firstStepLine: `先做第一步：${firstStep}`,
      privacyLine,
      reviewLine,
      naturalSpreadInviteLine: naturalSpread.inviteLine ? `朋友发来的是动作：${naturalSpread.inviteLine}` : '',
      naturalSpreadReceiverLine: naturalSpread.receiverPrompt ? `你要做的：${naturalSpread.receiverPrompt}` : '',
      naturalSpreadParentLine: naturalSpread.parentReassuranceLine ? `家长放心：${naturalSpread.parentReassuranceLine}` : '',
      naturalSpreadDay7Line: naturalSpread.day7ReturnLine ? `第 7 天：${naturalSpread.day7ReturnLine}` : '',
      naturalSpreadProofLine: naturalSpread.proofOfLifeSignal ? `完成信号：${naturalSpread.proofOfLifeSignal}` : '',
      naturalSpreadGuardrailLine: naturalSpread.guardrailLine ? `裂变护栏：${naturalSpread.guardrailLine}` : '',
      spreadReadinessGate,
      spreadReadinessLine: spreadReadinessGate ? `传播门槛：${spreadReadinessGate.shareModeLine || spreadReadinessGate.status}` : '',
      spreadFallbackLine: spreadReadinessGate ? `不足时：${spreadReadinessGate.fallbackLine}` : '',
      spreadEvidenceLine: spreadReadinessGate ? `需要证据：${spreadReadinessGate.requiredEvidence}` : '',
      peerRelayLadder,
      peerRelayLadderLine: peerRelayLadder ? `同伴接力阶梯：${peerRelayLadder.stageLine}` : '',
      peerRelayAttractionLine: peerRelayLadder && peerRelayLadder.attractionHook ? `可复制挑战：${peerRelayLadder.attractionHook}` : '',
      peerRelayLocalGateLine: peerRelayLadder && peerRelayLadder.localGate ? `本地放行门禁：${peerRelayLadder.localGate}` : '',
      peerRelaySeasonArc,
      peerRelaySeasonLine: peerRelaySeasonArc ? `7天接力赛季：${peerRelaySeasonArc.seasonLine || peerRelaySeasonArc.status}` : '',
      peerRelaySeasonDayLine: peerRelaySeasonArc ? `赛季节点：${peerRelaySeasonArc.days}` : '',
      peerRelaySeasonGateLine: peerRelaySeasonArc ? `赛季门禁：${peerRelaySeasonArc.localGate}` : '',
      sourceChallengeDeck,
      sourceChallengeLine: sourceChallengeDeck ? `来源挑战：${sourceChallengeDeck.sourceLabel} · ${sourceChallengeDeck.count || 1} 组可借鉴结构。` : '',
      sourceChallengePromptLine: sourceChallengeDeck ? sourceChallengeDeck.prompt : '',
      sourceChallengeDecisionLine: sourceChallengeDeck && sourceChallengeDeck.commercialDecision ? `使用判断：${sourceChallengeDeck.commercialDecision}` : '',
      sourceChallengeLocalRuleLine: sourceChallengeDeck && sourceChallengeDeck.localRule ? sourceChallengeDeck.localRule : '',
      sourceChallengeBlockedLine: sourceChallengeDeck && sourceChallengeDeck.blockedFields ? `禁带字段：${sourceChallengeDeck.blockedFields}` : '',
      sourceChallengeLicenseLine: sourceChallengeDeck && sourceChallengeDeck.licenseSignal ? `许可提醒：${sourceChallengeDeck.licenseSignal}` : '',
      wrongCauseViralPack,
      wrongCauseViralLine: wrongCauseViralPack ? `错因接力：${wrongCauseViralPack.label}` : '',
      wrongCauseFirstStepLine: wrongCauseViralPack ? `错因第一步：${wrongCauseViralPack.firstStep}` : '',
      wrongCauseReceiverActionLine: wrongCauseViralPack ? `接收者动作：${wrongCauseViralPack.receiverAction}` : '',
      wrongCauseParentCheckLine: wrongCauseViralPack && wrongCauseViralPack.parentCheck ? `家长检查：${wrongCauseViralPack.parentCheck}` : '',
      wrongCauseNextRevisitLine: wrongCauseViralPack ? `回访：${wrongCauseViralPack.nextRevisit}` : '',
      wrongCauseBlockedFieldLine: wrongCauseViralPack ? `错因接力不带：${wrongCauseViralPack.blockedFields}` : '',
      wrongCauseLocalGateLine: wrongCauseViralPack ? `本地门禁：${wrongCauseViralPack.localGate}` : '',
      safeRelayPacket,
      receiverActionLine: safeRelayPacket && safeRelayPacket.receiverAction,
      parentCheckLine: safeRelayPacket && safeRelayPacket.parentCheck,
      nextDayRevisitLine: safeRelayPacket && safeRelayPacket.nextDayRevisit,
      safeFieldLine: safeRelayPacket ? `只带：${safeRelayPacket.allowedFields}` : '',
      blockedFieldLine: safeRelayPacket ? `不带：${safeRelayPacket.blockedFields}` : '',
      completionSignalLine: safeRelayPacket ? `完成信号：${safeRelayPacket.completionSignal}` : '',
      receiverCompletionLine: receiverCompletion
        ? `receiver evidence: ${(receiverCompletion.payload && receiverCompletion.payload.first_step) || receiverCompletion.firstStep || 'receiver_own_first_step_required'} / ${(receiverCompletion.payload && receiverCompletion.payload.wrong_cause) || receiverCompletion.wrongCause || 'receiver_own_wrong_cause_required'} / ${(receiverCompletion.payload && receiverCompletion.payload.next_revisit) || receiverCompletion.nextRevisit || 'receiver_next_revisit_required'}`
        : 'receiver evidence required: first step / wrong cause / revisit',
      unitLine,
      unitDecisionLine: incoming.course_unit_parent_decision || '',
      unitReportLine: incoming.course_unit_report_contract || '',
      unitBlackboardLine: incoming.course_unit_blackboard || '',
      questionBankRelayLine,
      visualBoardRelayLine,
      visualBoardRelayLayerLine: incoming.visual_board_relay_layer ? `小黑板第一层：${incoming.visual_board_relay_layer}` : '',
      visualBoardRelayStudentLine: incoming.visual_board_relay_student_line ? `孩子复述：${incoming.visual_board_relay_student_line}` : '',
      visualBoardRelayParentLine: incoming.visual_board_relay_parent_line ? `家长检查：${incoming.visual_board_relay_parent_line}` : '',
      visualBoardRelayExitLine: incoming.visual_board_relay_exit ? `退出标准：${incoming.visual_board_relay_exit}` : '',
      visualBoardRelayBoundaryLine: incoming.visual_board_relay_boundary ? `小黑板边界：${incoming.visual_board_relay_boundary}` : '',
      questionBankRelayFirstStepLine: incoming.question_bank_relay_first_step ? `题型第一步：${incoming.question_bank_relay_first_step}` : '',
      questionBankRelayParentCheckLine: incoming.question_bank_relay_parent_check ? `家长检查：${incoming.question_bank_relay_parent_check}` : '',
      questionBankRelayBoundaryLine: incoming.question_bank_relay_boundary ? `题型分享边界：${incoming.question_bank_relay_boundary}` : '',
      socraticReportStatus: incoming.socratic_report_status || '',
      socraticReportActionLine: incoming.socratic_report_action ? `点拨行动：${incoming.socratic_report_action}` : '',
      socraticReportDecisionLine: incoming.socratic_report_decision ? `家长判断：${incoming.socratic_report_decision}` : '',
      socraticReportNoIncreaseLine: incoming.socratic_report_no_increase ? `不加题规则：${incoming.socratic_report_no_increase}` : '',
      socraticReportParentProofLine: incoming.socratic_report_parent_proof ? `家长证据：${incoming.socratic_report_parent_proof}` : '',
      socraticReportBoundaryLine: incoming.socratic_report_boundary ? `分享边界：${incoming.socratic_report_boundary}` : '',
      tonightDecisionLine: hasTonightDecision && incoming.tonight_decision ? `今晚决策：${incoming.tonight_decision}` : '',
      tonightParentQuestionLine: hasTonightDecision && incoming.tonight_parent_question ? `家长只问：${incoming.tonight_parent_question}` : '',
      tonightTomorrowLine: hasTonightDecision && incoming.tonight_tomorrow ? `明天回访：${incoming.tonight_tomorrow}` : '',
      tonightReleaseGateLine: hasTonightDecision && incoming.tonight_release_gate ? `放行门槛：${incoming.tonight_release_gate}` : '',
      tonightShareBoundaryLine: hasTonightDecision && incoming.tonight_share_boundary ? `分享边界：${incoming.tonight_share_boundary}` : '',
      returnContractLine: safeRelayPacket
        ? '接力成立条件：自己的第一步、错因回退、明天回访预约都要留下证据。'
        : '接力成立条件：主动回忆、错因回退、明天回访三件事至少完成一件并留下记录。',
      actions: [
        defaultReceiverAction,
        {
          id: 'repair',
          label: '先修卡点',
          route: '/pages/review/review?from=share_relay&mode=wrong_cause',
          reason: incoming.socratic_report_action || (incoming.capability_gap ? `先补 ${incoming.capability_gap} 这条能力缺口。` : actionDetail),
          evidence: '错因接力'
        },
        {
          id: 'challenge',
          label: incoming.course_unit_label ? '练这个单元' : '轻挑战',
          route: questionBankRelayRoute,
          reason: naturalSpread.receiverPrompt || incoming.question_bank_relay_parent_check || incoming.course_unit_parent_decision || incoming.challenge_goal || actionLabel,
          evidence: incoming.challenge_rule || '5分钟轻回访'
        },
        {
          id: 'parent',
          label: '给家长看',
          route: '/pages/profile/profile?from=share_relay',
          reason: incoming.socratic_report_decision || '只看今晚动作、证据和明天复核，不做排行。',
          evidence: '家庭复盘'
        },
        {
          id: 'wrong_cause_viral',
          label: '接这个错因',
          route: wrongCauseRoute,
          reason: wrongCauseViralPack ? wrongCauseViralPack.receiverAction : '用自己的材料复刻同类错因第一步。',
          evidence: wrongCauseViralPack ? wrongCauseViralPack.label : '错因接力'
        },
        {
          id: 'source_challenge',
          label: '来源挑战',
          route: sourceChallengeRoute,
          reason: sourceChallengeDeck ? sourceChallengeDeck.prompt : '用公开资料结构，换成自己的作业材料做一次第一步挑战。',
          evidence: '公开结构本地化'
        },
        {
          id: 'visual_board_relay',
          label: '小黑板接力',
          route: visualBoardRelayRoute,
          reason: incoming.visual_board_relay_parent_line || incoming.question_bank_relay_parent_check || actionLabel,
          evidence: incoming.visual_board_relay_student_line || incoming.visual_board_relay_exit || ''
        }
      ]
    };
  },

  buildWrongbookEntry(reviewSummary) {
    const types = (reviewSummary && reviewSummary.types) || [];
    const typeCount = (type) => {
      const item = types.find((entry) => entry.type === type);
      return Number((item && item.total) || 0);
    };
    const total = Number((reviewSummary && reviewSummary.total) || 0);
    const repair = Number((reviewSummary && reviewSummary.qualityQueue && reviewSummary.qualityQueue.length) || 0);
    const transfer = typeCount('transfer');
    return {
      title: '错题本整理',
      body: total
        ? `复习卡 ${total} 张，待修卡点 ${repair} 张，举一反三 ${transfer} 张。`
        : '把题目、原想法和卡住的一步放进来，先追问一步，再安排回访。',
      label: total ? '修卡点' : '放一题',
      action: total ? 'goReview' : 'goReviewInput'
    };
  },

  buildGameHero(topMust, reviewSummary, modulePath) {
    const goal = reviewSummary.goal || {};
    const quiz = reviewSummary.quiz || {};
    const challenge = reviewSummary.challenge || {};
    const currentModule = modulePath && modulePath.current ? modulePath.current : null;
    const hasTask = !!topMust;
    return {
      title: '今晚从哪一步开始？',
      subtitle: '学校作业很多时，先排顺序；遇到卡点时，我陪你先说出第一步。',
      primaryLabel: '帮我安排今晚学习',
      primaryAction: 'planTonight',
      secondaryLabel: '生成轻练习',
      secondaryAction: 'goLearningMap',
      taskStatus: hasTask ? '今晚任务' : '材料入口',
      packStatus: currentModule ? '可练' : (reviewSummary.total ? '已沉淀' : '待生成'),
      due: Number(reviewSummary.due || 0),
      quiz: Number(quiz.count || 0),
      xp: Number((reviewSummary.progress && reviewSummary.progress.xp) || 0),
      level: Number((reviewSummary.progress && reviewSummary.progress.level) || 1),
      streak: Number((reviewSummary.loop && reviewSummary.loop.currentStreak) || (reviewSummary.progress && reviewSummary.progress.streak) || 0),
      lives: Number((reviewSummary.loop && reviewSummary.loop.lives) || 0),
      maxLives: Number((reviewSummary.loop && reviewSummary.loop.maxLives) || 5),
      rewardsReady: (reviewSummary.rewards || []).filter((item) => item.canClaim).length,
      goalText: goal.completed >= goal.target
        ? '今日目标已完成'
        : `今日进度 ${goal.completed || 0}/${goal.target || 5}`,
      challengeText: challenge.title || (currentModule ? currentModule.title : '完成一轮：想法 -> 提示 -> 轻练习 -> 修卡点'),
      nextMeta: hasTask ? `${topMust.minutes || 10} 分钟` : '先说第一步',
      nextGate: reviewSummary.due
        ? '下一关：5 分钟回忆'
        : reviewSummary.total
          ? '下一关：保持手感'
          : '下一关：先生成学习卡'
    };
  },

  buildMissionCards(topMust, reviewSummary, modulePath) {
    const quiz = reviewSummary.quiz || {};
    return [
      {
        id: 'input',
        label: '先说想法',
        title: '把第一步写出来',
        body: topMust ? '已找到今晚关键任务，先说你会怎么开始。' : '作业、错题、知识点都可以，重点是写下你的想法。',
        value: '1',
        action: topMust ? 'startTopMust' : 'submitAiDraft',
        tone: 'hot'
      },
      {
        id: 'first_step',
        label: '只给提示',
        title: '作业点拨问下一步',
        body: topMust ? topMust.text : '不会直接讲最终结果，只帮你检查思路和下一步。',
        value: '2',
        action: topMust ? 'startTopMust' : 'submitAiDraft',
        tone: 'calm'
      },
      {
        id: 'finish',
        label: '进入练习',
        title: '做完再去轻练习',
        body: topMust ? '做完这一小步，再把卡住点送进轻练习。' : '把提示后的内容变成可回访的小练习。',
        value: '3',
        action: topMust ? 'startTopMust' : 'submitAiDraft',
        tone: 'calm'
      },
      {
        id: 'review',
        label: '复习闭环',
        title: '5 分钟回忆一下',
        body: `${reviewSummary.due || 0} 张到期，${quiz.count || 0} 道小测。`,
        value: '4',
        action: 'goReview',
        tone: 'dark'
      },
      {
        id: 'profile',
        label: '我的进展',
        title: '收尾问自己一句',
        body: '我能不能说清自己的想法、卡点和下一步。',
        value: '5',
        action: 'goProfile',
        tone: 'calm'
      }
    ];
  },

  buildContentEntry(modulePath, reviewSummary) {
    const currentModule = modulePath && modulePath.current ? modulePath.current : null;
    return {
      title: '轻练习工坊',
      label: '粘贴学习材料，先变成学习卡、小测和 7 天回访。',
      cards: [
        { id: 'input', value: '1', label: '粘贴材料', body: '作业、笔记、PPT 要点、错题说明' },
        { id: 'pack', value: currentModule ? currentModule.score : '卡', label: '生成轻练习', body: currentModule ? currentModule.title : '知识卡 + 测验 + 点拨提示' },
        { id: 'loop', value: reviewSummary.maturity ? reviewSummary.maturity.overall : 0, label: '进入复习', body: '每天自动回访最该复习的内容' }
      ]
    };
  },

  buildParentSnapshot(state, topMust, reviewSummary, thinkingSummary) {
    const weak = ((state && state.weak_points) || [])[0] || {};
    const thinking = thinkingSummary || {};
    return {
      title: '看得见为什么这样安排',
      body: topMust
        ? `今晚优先看：${topMust.text}`
        : '先完成第一步，再看卡点和复习记录。',
      metrics: [
        { label: '当前卡点', value: weak.name || '待观察' },
        { label: '复习资产', value: reviewSummary.total || 0 },
        { label: '思路记录', value: thinking.total || 0 }
      ]
    };
  },

  buildPathRouter() {
    return [
      {
        id: 'parent',
        role: '我的',
        promise: '看见回访记录和今晚修过哪一步。',
        action: 'goReportPreview',
        label: '看留痕'
      },
      {
        id: 'kid',
        role: '孩子',
        promise: '3分钟开始第一个有用步骤。',
        action: 'startTopMust',
        label: '开始辅导'
      },
      {
        id: 'pack',
        role: '轻练习',
        promise: '把真实材料变成可复习内容。',
        action: 'goLearningMap',
        label: '去生成'
      }
    ];
  },

  buildQuickDock(topMust, reviewSummary, modulePath) {
    return [
      {
        id: 'must',
        label: '今晚',
        meta: topMust ? `${topMust.minutes || 10} 分钟` : '规划',
        action: topMust ? 'startTopMust' : 'submitAiDraft'
      },
      {
        id: 'learningMap',
        label: '轻回访',
        meta: modulePath.current ? '已推荐' : '材料',
        action: 'goLearningMap'
      },
      {
        id: 'parent',
        label: '我的',
        meta: '进展',
        action: 'goReportPreview'
      }
    ];
  },

  buildExecutiveBrief(state, topMust, reviewSummary, thinkingSummary, modulePath) {
    const weak = ((state && state.weak_points) || [])[0] || {};
    const thinking = thinkingSummary || {};
    const module = modulePath && modulePath.current ? modulePath.current : null;
    const proofRecords = Number(reviewSummary.total || 0) + Number(thinking.total || 0) + (topMust ? 1 : 0);
    return {
      title: '产品闭环成熟度',
      label: '一屏看清产品主线：减少陪写冲突，保护孩子思考，把卡点沉淀成长期复习记录。',
      northStar: Math.min(100, 74 + Math.min(10, proofRecords) + Math.min(8, reviewSummary.due || 0) + Math.min(8, thinking.proofSentence || 0)),
      cards: [
        {
          id: 'tonight',
          label: '今晚决策',
          value: topMust ? '已锁定' : '待输入',
          body: topMust ? topMust.text : '先填作业，再拆成必交先做、灵活安排、可以后置。'
        },
        {
          id: 'weak',
          label: '卡点信号',
          value: weak.score || '--',
          body: weak.name || '先说今晚卡在哪。'
        },
        {
          id: 'records',
          label: '学习记录',
          value: proofRecords,
          body: `${reviewSummary.total || 0} 张记忆卡 + ${thinking.total || 0} 条思路记录。`
        },
        {
          id: 'next',
          label: '下一步引擎',
          value: module ? module.score : 0,
          body: module ? module.title : '打开轻练习生成器。'
        }
      ]
    };
  },

  buildReturnLoop(reviewSummary) {
    const due = reviewSummary.due || 0;
    const quiz = reviewSummary.quiz ? reviewSummary.quiz.count : 0;
    const repair = reviewSummary.qualityQueue ? reviewSummary.qualityQueue.length : 0;
    return {
      title: '7天回访节奏',
      label: '每天只做一小步：复习少量卡、修一个卡点、保持本周回访不断档。',
      days: [
        { day: '第1天', task: '锁定必须做和第一个卡点', value: '今晚' },
        { day: '第2天', task: '不看笔记回忆昨天方法', value: `${due} 张` },
        { day: '第3天', task: '做一次闭卷小测', value: `${quiz} 题` },
        { day: '第5天', task: '修复一张顽固卡', value: `${repair} 项` },
        { day: '第7天', task: '复盘本周进展并开启下轮冲刺', value: '进展' }
      ]
    };
  },

  buildTonightSprint(topMust, reviewSummary, modulePath) {
    const currentModule = modulePath.current || null;
    return {
      title: '今晚15分钟冲刺',
      label: '一个家庭今晚就能跑完一次有用闭环：选对任务、陪孩子说第一步、把卡点沉淀到复习。',
      steps: [
        {
          id: 'task',
          kicker: '1 / 优先级',
          title: topMust ? '先做今晚最关键的一题' : '填作业，让咕点选择',
          desc: topMust
            ? topMust.text
            : '先粘贴今晚作业，我会拆成必交先做、灵活安排、可以后置。',
          proof: topMust ? `${topMust.minutes || 10} 分钟 / 必须做` : '3分钟设置',
          action: topMust ? 'startTopMust' : 'goUpload',
          cta: topMust ? '去点拨' : '填作业'
        },
        {
          id: 'coach',
          kicker: '2 / 辅导',
          title: currentModule ? currentModule.title : '用作业点拨迈出第一步',
          desc: currentModule
            ? currentModule.scene
            : '先听你想到哪一步，再问一个能帮你继续想的问题。',
          proof: currentModule ? `${currentModule.minutes} 分钟模块` : '3-5分钟',
          action: currentModule ? 'goLearningMap' : 'goTutor',
          cta: currentModule ? '打开轻练习' : '打开作业点拨'
        },
        {
          id: 'memory',
          kicker: '3 / 记忆',
          title: '用复习和测验闭环',
          desc: `把今晚卡点变成间隔复习、测验和修复，不再靠临时记住。`,
          proof: `${reviewSummary.due || 0} 张到期 / ${reviewSummary.quiz ? reviewSummary.quiz.count : 0} 题测验`,
          action: 'goReview',
          cta: '开始复习'
        }
      ]
    };
  },

  buildParentHandoff(topMust, reviewSummary, state) {
    const weakPoint = ((state && state.weak_points) || [])[0] || null;
    const firstTag = (((topMust || {}).evidence || {}).misconception_tags || [])[0] || null;
    return {
      title: '学习收尾卡',
      label: '今天只看三件事：盯什么、别怎么学、什么算真的会了。',
      cards: [
        {
          id: 'watch',
          title: '只盯一件事',
          body: weakPoint
            ? `${weakPoint.name}: 孩子能不能不靠提示说出第一步？`
            : '先看孩子能不能独立开始，再决定要不要解释。',
          tone: 'focus'
        },
        {
          id: 'avoid',
          title: '不要过度帮忙',
          body: '不要替孩子思考。先问下一步怎么做，不要直接问最终结果。',
          tone: 'guardrail'
        },
        {
          id: 'evidence',
          title: '说出下次先查什么',
          body: firstTag
            ? `让孩子说清楚：这次如何避开「${firstTag.name}」。`
            : '让孩子把修正后的想法说出来，再送进复习。',
          tone: 'evidence'
        }
      ]
    };
  },

  buildTodayActions(topMust, reviewSummary, modulePath) {
    const actions = [];
    if (topMust) {
      actions.push({
        id: 'must',
        title: '先做必须做',
        desc: topMust.text,
        meta: `${topMust.minutes || 10} 分钟`,
        action: 'startTopMust',
        primary: true
      });
    } else {
      actions.push({
        id: 'upload',
        title: '填今晚作业',
        desc: '粘贴清单，分出必交先做、灵活安排、可以后置。',
        meta: '3 分钟',
        action: 'goUpload',
        primary: true
      });
    }
    actions.push({
      id: 'review',
      title: '轻回访',
      desc: `${reviewSummary.due || 0} 张到期，${reviewSummary.quiz ? reviewSummary.quiz.count : 0} 张测验卡`,
      meta: '5 分钟',
      action: 'goReview'
    });
    actions.push({
      id: 'cockpit',
      title: '打开轻练习',
      desc: modulePath.current ? modulePath.current.title : '选一个练习方法',
      meta: '10-20 分钟',
      action: 'goLearningMap'
    });
    return actions;
  },

  runTodayAction(event) {
    const action = event.currentTarget.dataset.action;
    if (action && typeof this[action] === 'function') this[action]();
  },

  runPath(event) {
    const action = event.currentTarget.dataset.action;
    if (action && typeof this[action] === 'function') this[action]();
  },

  onAiDraftInput(event) {
    this.setData({ aiDraft: event.detail.value });
  },

  setPackTab(event) {
    const tab = event.currentTarget.dataset.tab;
    if (tab) this.setData({ packTab: tab });
  },

  setToolCategory(event) {
    const category = event.currentTarget.dataset.category || 'all';
    this.setData({
      activeToolCategory: category,
      visibleToolCards: this.filterToolCards(this.data.toolCards, category)
    });
  },

  applyPromptChip(event) {
    const id = event.currentTarget.dataset.id;
    const chip = (this.data.promptChips || []).find((item) => item.id === id);
    if (!chip) return;
    this.setData({ aiDraft: chip.text });
  },

  applyLocalScenarioCase(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || !storage.applyLocalScenarioLoopCase) return;
    const result = storage.applyLocalScenarioLoopCase(id);
    if (!result) {
      wx.showToast({ title: '暂时没有可用场景', icon: 'none' });
      return;
    }
    this.setData({
      activeScenarioResult: result,
      aiDraft: result.case ? result.case.inputText : this.data.aiDraft,
      focusFeedback: result.nextAction || '已走完一遍：第一步、回访卡、迁移练习和家长追问。'
    });
    wx.showToast({ title: '已生成一条完整闭环', icon: 'none' });
    this.refresh();
  },

  openScenarioReview() {
    navigation.navigateLearningRoute('/pages/review/review?from=home_scenario');
  },

  openScenarioProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  runQuestArcAction() {
    const action = this.data.learningQuestArc && this.data.learningQuestArc.currentAction;
    if (action && typeof this[action] === 'function') this[action]();
  },

  runModuleFlowCompassAction() {
    const action = this.data.moduleFlowCompass && this.data.moduleFlowCompass.currentAction;
    if (action && typeof this[action] === 'function') this[action]();
  },

  runUnifiedNextAction() {
    const next = this.data.unifiedNextAction || {};
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction(Object.assign({}, next, { surface: 'home' }));
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'home',
        dimensionId: next.source || 'unified_next_action',
        label: next.actionLabel || '',
        route: next.route || '',
        readiness: 'unified_next_action'
      });
    }
    navigation.navigateLearningRoute(next.route || '/pages/tutor/tutor');
  },

  runCapabilityMaturityAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const queue = this.data.capabilityMaturityQueue || {};
    const items = Array.isArray(queue.items) ? queue.items : [];
    const item = items.find((entry) => entry.id === dataset.id) || queue.next || {};
    const route = dataset.route || item.route || '/pages/tutor/tutor';
    const action = Object.assign({
      source: 'capability_maturity_queue',
      sourceLabel: '全局能力厚度队列',
      actionLabel: item.nextAction || '先补这一条能力证据',
      reasonLine: item.competitorLine || '',
      evidenceLine: item.evidenceLine || '',
      route
    }, item.actionPayload || {});
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction(Object.assign({}, action, { surface: 'home' }));
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: item.surface || 'home',
        dimensionId: item.id || 'capability_maturity_queue',
        label: item.label || action.actionLabel,
        route,
        readiness: 'capability_maturity_queue'
      });
    }
    navigation.navigateLearningRoute(route);
  },

  toggleCompanionPicker() {
    this.setData({ showCompanionPicker: !this.data.showCompanionPicker });
  },

  selectCompanion(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || !storage.saveCompanionPreference) return;
    const companionPreference = storage.saveCompanionPreference(id);
    const growthMemoryLine = storage.getGrowthMemoryLine ? storage.getGrowthMemoryLine(null, companionPreference) : null;
    this.setData({
      companionPreference,
      homeViewModel: buildHomeViewModel({
        companionPreference,
        tonightPlan: this.data.tonightPlan,
        todayFocus: this.data.todayFocus,
        reportServiceResume: this.data.homeViewModel && this.data.homeViewModel.reportServiceResume,
        growthMemory: growthMemoryLine
      }),
      companionCopy: {
        home: storage.getCompanionStageCopy ? storage.getCompanionStageCopy('home_plan', companionPreference) : ''
      },
      companionLine: storage.formatCompanionLine ? storage.formatCompanionLine(companionPreference) : '',
      growthMemory: {
        home: growthMemoryLine && !growthMemoryLine.empty
          ? growthMemoryLine.oneLine
          : (storage.growthMemoryCopyFor ? storage.growthMemoryCopyFor('home', companionPreference) : '')
      },
      showCompanionPicker: false
    });
  },

  routeImportDraft(route) {
    if (route === 'review') {
      this.goLearningMap();
      return;
    }
    this.openTutorFromHome('/pages/tutor/tutor?from=home_import');
  },

  startStuck() {
    const text = String(this.data.aiDraft || '').trim();
    if (text) {
      this.submitAiDraft();
      return;
    }
    this.setData({
      aiDraft: '我卡住了。\n题目是：\n我先想到的是：\n我不知道下一步怎么写。'
    }, () => {
      this.submitAiDraft();
    });
  },

  planTonight() {
    const text = String(this.data.aiDraft || '').trim();
    const draft = text || '数学应用题 3 道，明天必交\n英语单词 10 分钟\n整理今天卡住的一步\n数学拓展题 2 道';
    if (/不会|卡住|不知道|不会列式|读不懂|算错|说不清/.test(draft)) {
      this.submitAiDraft();
      return;
    }
    const plan = storage.createTonightPlanFromInput ? storage.createTonightPlanFromInput(draft, {
      source: 'home_route_cta'
    }) : null;
    this.setData({
      aiDraft: draft,
      tonightPlan: plan,
      homeViewModel: buildHomeViewModel({
        companionPreference: this.data.companionPreference,
        tonightPlan: plan,
        todayFocus: this.data.todayFocus
      }),
      routeStrip: this.buildRouteStrip('plan', plan),
      focusFeedback: plan ? '已排好今晚路线，按今晚路线开始就行。' : '先写今晚作业清单，我来帮你排顺序。'
    });
  },

  noop() {},

  submitAiDraft() {
    const text = String(this.data.aiDraft || '').trim();
    if (!text) {
      wx.showToast({ title: '先说一句卡在哪', icon: 'none' });
      return;
    }
    const importRoute = importIntake.classifyImportInput(text);
    this.trackShareActivation('material_started', {
      text_length: text.length,
      next: importRoute.route || 'tutor'
    });
    storage.set(storage.KEYS.taskDraft, {
      text,
      source: 'home_xiaodian_entry',
      created_at: new Date().toISOString()
    });
    storage.set(storage.KEYS.selectedHomework, {
      id: `home_ai_${Date.now()}`,
      text,
      minutes: 5,
      evidence: {
        calibration_key: 'home:xiaodian:first_step',
        tags: ['first_step']
      },
      created_at: new Date().toISOString()
    });
    storage.set(storage.KEYS.selectedHomeworkSource, 'home_xiaodian_entry');
    const todayFocus = storage.saveTodayFocusFromThought && importRoute.shouldCreateFocus ? storage.saveTodayFocusFromThought(text, {
      source: 'home_xiaodian_entry'
    }) : null;
    if (todayFocus && todayFocus.isStuck && storage.updateTonightRouteStatus) {
      storage.updateTonightRouteStatus('focus_created', { focusId: todayFocus.id });
    }
    const hint = tutorLadder.buildTutorReply(text, {
      currentHintLevel: todayFocus && todayFocus.isStuck ? 2 : 1
    });
    if (storage.appendThinkingReceipt) {
      storage.appendThinkingReceipt({
        title: '孩子先说了一步',
        score: todayFocus && todayFocus.isStuck ? 72 : 78,
        status: todayFocus && todayFocus.isStuck ? 'stuck point recorded' : 'first step recorded',
        focus: todayFocus && todayFocus.title ? todayFocus.title : text.slice(0, 48),
        selected_text: text,
        source: 'home_xiaodian_entry',
        coach_step: 'write_first_step',
        mastery_status: todayFocus && todayFocus.isStuck ? 'needs_repair' : 'thinking_started',
        risk: 'low',
        shareLine: todayFocus && todayFocus.isStuck ? '我记下来了，等下我们就修这个卡点。' : '这一步有用，我帮你记到思路里。',
        checks: [
          { id: 'first', label: '先说第一步', done: true, detail: text.slice(0, 80) },
          { id: 'safe', label: '不直接讲结果', done: true, detail: hint.hint_label || '先问一步，再给最小提示' },
          { id: 'cause', label: todayFocus && todayFocus.issueType ? todayFocus.issueType : '卡点待修', done: !!(todayFocus && todayFocus.isStuck), detail: todayFocus && todayFocus.title ? todayFocus.title : '' }
        ]
      });
    }
    storage.set(storage.KEYS.tutorMessages, [
      {
        role: 'assistant',
        hint_label: hint.hint_label,
        text: todayFocus && todayFocus.isStuck
          ? `${hint.reply}`
          : '这一步有用，我帮你记到思路里。接下来我只问一个小问题，帮你继续想。'
      },
      {
        role: 'user',
        text
      }
    ]);
    this.setData({
      todayFocus,
      homeViewModel: buildHomeViewModel({
        companionPreference: this.data.companionPreference,
        tonightPlan: this.data.tonightPlan,
        todayFocus
      }),
      showWeakVerdict: !!(todayFocus && todayFocus.isStuck),
      focusFeedback: todayFocus && todayFocus.isStuck
        ? `${importRoute.feedback} 去修这个卡点。`
        : importRoute.feedback
    });
    this.routeImportDraft(importRoute.route);
  },

  openTutorFromHome(url = '/pages/tutor/tutor?from=home') {
    navigation.navigateLearningRoute(url);
  },

  openEntryDetail(event) {
    const scene = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.scene
      : 'today';
    wx.navigateTo({ url: `/pages/entry-detail/entry-detail?scene=${scene || 'today'}` });
  },

  goUpload() {
    navigation.navigateLearningRoute('/pages/upload/upload');
  },

  goDiagnosis() {
    wx.navigateTo({ url: '/pages/entry-detail/entry-detail?scene=upload&from=diagnosis' });
  },

  goReviewInput() {
    navigation.navigateLearningRoute('/pages/upload/upload?from=home_review_input');
  },

  goTutor() {
    this.openTutorFromHome('/pages/tutor/tutor?from=home');
  },

  goLearningMap() {
    this.trackShareActivation('challenge_started', {
      next: 'entry-detail'
    });
    wx.navigateTo({ url: '/pages/entry-detail/entry-detail?scene=today' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  goReview() {
    navigation.navigateLearningRoute('/pages/review/review');
  },

  runHomeNextStep() {
    const nextStep = this.data.homeViewModel && this.data.homeViewModel.nextStep;
    const action = nextStep && nextStep.action ? nextStep.action : 'review';
    if (action === 'miniLesson') {
      this.goMiniLessonResume();
      return;
    }
    if (action === 'first' || action === 'tutor') {
      this.goTutor();
      return;
    }
    this.goReview();
  },

  runPrimaryNextAction() {
    const next = this.data.homeViewModel && this.data.homeViewModel.primaryNextAction;
    if (!next) return;
    if (next.dispatchCode === 1) {
      this.goReportServiceResume();
      return;
    }
    if (next.dispatchCode === 2) {
      this.goMiniLessonResume();
      return;
    }
    if (next.dispatchCode === 3) {
      this.continueYesterdayReview();
      return;
    }
    if (next.dispatchCode === 4) {
      navigation.navigateLearningRoute('/pages/review/review?from=home_share_return');
      return;
    }
    if (next.dispatchCode === 5) {
      this.goFocus();
      return;
    }
    this.openTutorFromHome(next.route || '/pages/tutor/tutor?from=home_primary_next');
  },

  goMiniLessonResume() {
    const card = this.data.homeViewModel && this.data.homeViewModel.miniLessonResume;
    const route = card && card.route ? card.route : '/pages/review/review?from=home_mini_lesson_resume';
    if (storage.setActiveMiniLessonResumeContext) {
      storage.setActiveMiniLessonResumeContext({
        from: 'home_mini_lesson_resume',
        cardId: card && card.id ? card.id : '',
        flowTraceId: card && card.flowTraceId ? card.flowTraceId : '',
        evidenceThreadId: card && card.evidenceThreadId ? card.evidenceThreadId : '',
        topicCardId: card && card.topicCardId ? card.topicCardId : '',
        sourceSchemaId: card && card.sourceSchemaId ? card.sourceSchemaId : '',
        blockedFields: card && Array.isArray(card.blockedFields) ? card.blockedFields : [],
        route
      });
    }
    if (route.indexOf('/pages/review/review') === 0) {
      navigation.navigateLearningRoute('/pages/review/review?from=home_mini_lesson_resume');
      return;
    }
    navigation.navigateLearningRoute(route);
  },

  goReportServiceResume() {
    const card = this.data.homeViewModel && this.data.homeViewModel.reportServiceResume;
    const route = card && card.route ? card.route : '/pages/upload/upload?from=home_report_service_resume';
    navigation.navigateLearningRoute(route);
  },

  goFocus() {
    const session = storage.getTodaySession ? storage.getTodaySession() : null;
    const canStart = storage.canStartFocusFromTodaySession
      ? storage.canStartFocusFromTodaySession(session)
      : !!(session && session.childArticulatedStep);
    if (!canStart) {
      wx.showToast({ title: '先回咕点确认今晚第一步，才能进入专注。', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/entry-detail/entry-detail?scene=today&from=first_step_focus' });
  },

  continueYesterdayReview() {
    const card = this.data.yesterdayReviewCard || (storage.getYesterdayReview && storage.getYesterdayReview());
    if (card && storage.markReviewCardRevisited) storage.markReviewCardRevisited(card.id);
    navigation.navigateLearningRoute('/pages/review/review?from=yesterday_review');
  },

  goArcade() {
    this.trackShareActivation('challenge_started', {
      next: 'arcade'
    });
    const incoming = this.data.incomingShare || (storage.loadIncomingShare && storage.loadIncomingShare()) || {};
    const socraticReportQuery = incoming.share_code
      ? `&socratic_report_status=${encodeURIComponent(incoming.socratic_report_status || '')}&socratic_report_action=${encodeURIComponent(incoming.socratic_report_action || '')}&socratic_report_decision=${encodeURIComponent(incoming.socratic_report_decision || '')}&socratic_report_no_increase=${encodeURIComponent(incoming.socratic_report_no_increase || '')}&socratic_report_parent_proof=${encodeURIComponent(incoming.socratic_report_parent_proof || '')}&socratic_report_boundary=${encodeURIComponent(incoming.socratic_report_boundary || '')}`
      : '';
    const visualBoardRelayQuery = incoming.share_code
      ? `&visual_board_relay_title=${encodeURIComponent(incoming.visual_board_relay_title || '')}&visual_board_relay_layer=${encodeURIComponent(incoming.visual_board_relay_layer || '')}&visual_board_relay_student_line=${encodeURIComponent(incoming.visual_board_relay_student_line || '')}&visual_board_relay_parent_line=${encodeURIComponent(incoming.visual_board_relay_parent_line || '')}&visual_board_relay_exit=${encodeURIComponent(incoming.visual_board_relay_exit || '')}&visual_board_relay_route=${encodeURIComponent(incoming.visual_board_relay_route || '')}&visual_board_relay_boundary=${encodeURIComponent(incoming.visual_board_relay_boundary || '')}`
      : '';
    const query = incoming.share_code
      ? `?from=share&share=${incoming.share_code}&mode=${incoming.mode || ''}&identity=${encodeURIComponent(incoming.identity_tag || '')}&action=${incoming.parent_next_action || ''}&capability_gap=${encodeURIComponent(incoming.capability_gap || '')}&capability_label=${encodeURIComponent(incoming.capability_label || '')}&challenge_goal=${encodeURIComponent(incoming.challenge_goal || '')}&challenge_rule=${encodeURIComponent(incoming.challenge_rule || '')}${socraticReportQuery}${visualBoardRelayQuery}`
      : '';
    navigation.navigateLearningRoute(`/pages/arcade/arcade${query}`);
  },

  goSharedChallenge() {
    const incoming = this.data.incomingShare || (storage.loadIncomingShare && storage.loadIncomingShare()) || {};
    const route = navigation.normalizeRoute(incoming.challenge_route || incoming.capability_route || '/pages/arcade/arcade');
    const receiverOwnMaterialChallenge = incoming.receiver_own_challenge_route
      ? storage.buildReceiverOwnMaterialChallenge
        ? storage.buildReceiverOwnMaterialChallenge(incoming)
        : null
      : null;
    const socraticReportQuery = incoming.share_code
      ? `&socratic_report_status=${encodeURIComponent(incoming.socratic_report_status || '')}&socratic_report_action=${encodeURIComponent(incoming.socratic_report_action || '')}&socratic_report_decision=${encodeURIComponent(incoming.socratic_report_decision || '')}&socratic_report_no_increase=${encodeURIComponent(incoming.socratic_report_no_increase || '')}&socratic_report_parent_proof=${encodeURIComponent(incoming.socratic_report_parent_proof || '')}&socratic_report_boundary=${encodeURIComponent(incoming.socratic_report_boundary || '')}`
      : '';
    const visualBoardRelayQuery = incoming.share_code
      ? `&visual_board_relay_title=${encodeURIComponent(incoming.visual_board_relay_title || '')}&visual_board_relay_layer=${encodeURIComponent(incoming.visual_board_relay_layer || '')}&visual_board_relay_student_line=${encodeURIComponent(incoming.visual_board_relay_student_line || '')}&visual_board_relay_parent_line=${encodeURIComponent(incoming.visual_board_relay_parent_line || '')}&visual_board_relay_exit=${encodeURIComponent(incoming.visual_board_relay_exit || '')}&visual_board_relay_route=${encodeURIComponent(incoming.visual_board_relay_route || '')}&visual_board_relay_boundary=${encodeURIComponent(incoming.visual_board_relay_boundary || '')}`
      : '';
    const query = incoming.share_code
      ? `from=share&share=${incoming.share_code}&mode=${incoming.mode || ''}&identity=${encodeURIComponent(incoming.identity_tag || '')}&action=${incoming.parent_next_action || ''}&capability_gap=${encodeURIComponent(incoming.capability_gap || '')}&capability_label=${encodeURIComponent(incoming.capability_label || '')}&challenge_goal=${encodeURIComponent(incoming.challenge_goal || '')}&challenge_rule=${encodeURIComponent(incoming.challenge_rule || '')}&relay_privacy=${encodeURIComponent(incoming.relay_privacy || '')}&relay_review=${encodeURIComponent(incoming.relay_review || '')}&relay_first_step=${encodeURIComponent(incoming.relay_first_step || '')}&relay_id=${encodeURIComponent(incoming.relay_id || '')}&relay_receiver_action=${encodeURIComponent(incoming.relay_receiver_action || '')}&relay_parent_check=${encodeURIComponent(incoming.relay_parent_check || '')}&relay_next_revisit=${encodeURIComponent(incoming.relay_next_revisit || '')}&relay_allowed_fields=${encodeURIComponent(incoming.relay_allowed_fields || '')}&relay_blocked_fields=${encodeURIComponent(incoming.relay_blocked_fields || '')}&relay_completion_signal=${encodeURIComponent(incoming.relay_completion_signal || '')}&relay_return_path=${encodeURIComponent(incoming.relay_return_path || '')}${socraticReportQuery}${visualBoardRelayQuery}`
      : '';
    const target = receiverOwnMaterialChallenge && receiverOwnMaterialChallenge.route
      ? receiverOwnMaterialChallenge.route
      : (query && route.indexOf('?') < 0 ? `${route}?${query}` : route);
    this.trackShareActivation('challenge_started', {
      next: 'shared_challenge',
      route: target,
      challenge_goal: incoming.challenge_goal || '',
      challenge_rule: incoming.challenge_rule || '',
      challenge_route: incoming.challenge_route || '',
      receiver_own_challenge_route: receiverOwnMaterialChallenge ? receiverOwnMaterialChallenge.route : '',
      receiver_own_challenge_label: receiverOwnMaterialChallenge ? receiverOwnMaterialChallenge.label : '',
      receiver_own_challenge_action: receiverOwnMaterialChallenge ? receiverOwnMaterialChallenge.receiverAction : '',
      receiver_own_challenge_parent_check: receiverOwnMaterialChallenge ? receiverOwnMaterialChallenge.parentCheck : '',
      receiver_own_challenge_next_revisit: receiverOwnMaterialChallenge ? receiverOwnMaterialChallenge.nextRevisit : '',
      relay_privacy: incoming.relay_privacy || '',
      relay_review: incoming.relay_review || '',
      relay_first_step: incoming.relay_first_step || '',
      socratic_report_status: incoming.socratic_report_status || '',
      socratic_report_action: incoming.socratic_report_action || '',
      socratic_report_decision: incoming.socratic_report_decision || '',
      socratic_report_no_increase: incoming.socratic_report_no_increase || '',
      socratic_report_parent_proof: incoming.socratic_report_parent_proof || '',
      socratic_report_boundary: incoming.socratic_report_boundary || '',
      visual_board_relay_title: incoming.visual_board_relay_title || '',
      visual_board_relay_layer: incoming.visual_board_relay_layer || '',
      visual_board_relay_student_line: incoming.visual_board_relay_student_line || '',
      visual_board_relay_parent_line: incoming.visual_board_relay_parent_line || '',
      visual_board_relay_exit: incoming.visual_board_relay_exit || '',
      visual_board_relay_boundary: incoming.visual_board_relay_boundary || ''
    });
    if (!navigation.navigateLearningRoute(target)) navigation.navigateLearningRoute('/pages/arcade/arcade');
  },

  continueShareRelay() {
    const relay = this.data.incomingShareRelay || {};
    const firstCard = Array.isArray(relay.relayPackCards) && relay.relayPackCards.length
      ? relay.relayPackCards[0]
      : null;
    const route = navigation.normalizeRoute(
      (firstCard && firstCard.route) || relay.receiverOwnMaterialChallengeRoute || relay.challengeRoute || '/pages/arcade/arcade',
      '/pages/arcade/arcade'
    );
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'home',
        dimensionId: (firstCard && firstCard.id) || 'incoming_share_relay_continue',
        label: (firstCard && firstCard.title) || '同伴接力继续',
        route,
        readiness: 'incoming_share_relay'
      });
    }
    if (!navigation.navigateLearningRoute(route)) this.goSharedChallenge();
  },

  runIncomingShareRelayAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const incoming = this.data.incomingShare || (storage.loadIncomingShare && storage.loadIncomingShare()) || {};
    const route = navigation.normalizeRoute(dataset.route || '/pages/arcade/arcade', '/pages/arcade/arcade');
    const socraticReportQuery = incoming.share_code
      ? `&socratic_report_status=${encodeURIComponent(incoming.socratic_report_status || '')}&socratic_report_action=${encodeURIComponent(incoming.socratic_report_action || '')}&socratic_report_decision=${encodeURIComponent(incoming.socratic_report_decision || '')}&socratic_report_no_increase=${encodeURIComponent(incoming.socratic_report_no_increase || '')}&socratic_report_parent_proof=${encodeURIComponent(incoming.socratic_report_parent_proof || '')}&socratic_report_boundary=${encodeURIComponent(incoming.socratic_report_boundary || '')}`
      : '';
    const visualBoardRelayQuery = incoming.share_code
      ? `&visual_board_relay_title=${encodeURIComponent(incoming.visual_board_relay_title || '')}&visual_board_relay_layer=${encodeURIComponent(incoming.visual_board_relay_layer || '')}&visual_board_relay_student_line=${encodeURIComponent(incoming.visual_board_relay_student_line || '')}&visual_board_relay_parent_line=${encodeURIComponent(incoming.visual_board_relay_parent_line || '')}&visual_board_relay_exit=${encodeURIComponent(incoming.visual_board_relay_exit || '')}&visual_board_relay_route=${encodeURIComponent(incoming.visual_board_relay_route || '')}&visual_board_relay_boundary=${encodeURIComponent(incoming.visual_board_relay_boundary || '')}`
      : '';
    const wrongCauseRelayQuery = incoming.share_code
      ? `&wrong_cause_pack=${encodeURIComponent(incoming.wrong_cause_pack || '')}&wrong_cause_label=${encodeURIComponent(incoming.wrong_cause_label || '')}&wrong_cause_first_step=${encodeURIComponent(incoming.wrong_cause_first_step || '')}&wrong_cause_parent_check=${encodeURIComponent(incoming.wrong_cause_parent_check || '')}&wrong_cause_receiver_action=${encodeURIComponent(incoming.wrong_cause_receiver_action || '')}&wrong_cause_next_revisit=${encodeURIComponent(incoming.wrong_cause_next_revisit || '')}&wrong_cause_allowed_fields=${encodeURIComponent(incoming.wrong_cause_allowed_fields || '')}&wrong_cause_blocked_fields=${encodeURIComponent(incoming.wrong_cause_blocked_fields || '')}&wrong_cause_return_path=${encodeURIComponent(incoming.wrong_cause_return_path || '')}&wrong_cause_gate=${encodeURIComponent(incoming.wrong_cause_gate || '')}`
      : '';
    const query = incoming.share_code && route.indexOf('?') < 0
      ? `?from=share_relay&share=${incoming.share_code}&mode=${incoming.mode || ''}&identity=${encodeURIComponent(incoming.identity_tag || '')}&action=${incoming.parent_next_action || ''}&capability_gap=${encodeURIComponent(incoming.capability_gap || '')}&capability_label=${encodeURIComponent(incoming.capability_label || '')}&challenge_goal=${encodeURIComponent(incoming.challenge_goal || '')}&challenge_rule=${encodeURIComponent(incoming.challenge_rule || '')}&relay_privacy=${encodeURIComponent(incoming.relay_privacy || '')}&relay_review=${encodeURIComponent(incoming.relay_review || '')}&relay_first_step=${encodeURIComponent(incoming.relay_first_step || '')}&relay_id=${encodeURIComponent(incoming.relay_id || '')}&relay_receiver_action=${encodeURIComponent(incoming.relay_receiver_action || '')}&relay_parent_check=${encodeURIComponent(incoming.relay_parent_check || '')}&relay_next_revisit=${encodeURIComponent(incoming.relay_next_revisit || '')}&relay_allowed_fields=${encodeURIComponent(incoming.relay_allowed_fields || '')}&relay_blocked_fields=${encodeURIComponent(incoming.relay_blocked_fields || '')}&relay_completion_signal=${encodeURIComponent(incoming.relay_completion_signal || '')}&relay_return_path=${encodeURIComponent(incoming.relay_return_path || '')}&receiver_own_challenge_route=${encodeURIComponent(incoming.receiver_own_challenge_route || '')}&receiver_own_challenge_label=${encodeURIComponent(incoming.receiver_own_challenge_label || '')}&receiver_own_challenge_action=${encodeURIComponent(incoming.receiver_own_challenge_action || '')}&receiver_own_challenge_parent_check=${encodeURIComponent(incoming.receiver_own_challenge_parent_check || '')}&receiver_own_challenge_next_revisit=${encodeURIComponent(incoming.receiver_own_challenge_next_revisit || '')}${socraticReportQuery}${visualBoardRelayQuery}${wrongCauseRelayQuery}`
      : '';
    const target = `${route}${query}`;
    const action = {
      source: 'incoming_share_relay',
      sourceLabel: '分享回流接力',
      actionId: dataset.id || 'challenge',
      actionLabel: dataset.label || '轻挑战',
      route: target,
      reasonLine: dataset.reason || '',
      evidenceLine: dataset.evidence || ''
    };
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction(Object.assign({}, action, { surface: 'home' }));
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'home',
        dimensionId: action.actionId,
        label: action.actionLabel,
        route: target,
        readiness: 'incoming_share_relay',
        capabilityId: action.actionId === 'parent' ? 'parent_action' : action.actionId === 'repair' ? 'socratic' : 'game'
      });
    }
    if (storage.appendShareRun) {
      storage.appendShareRun({
        share_code: incoming.share_code || '',
        type: 'share_relay_action',
        path: target,
        title: action.actionLabel,
        payload: {
          action_id: action.actionId,
          reason: action.reasonLine,
          evidence: action.evidenceLine,
          socratic_report_status: incoming.socratic_report_status || '',
          socratic_report_action: incoming.socratic_report_action || '',
          socratic_report_decision: incoming.socratic_report_decision || '',
          socratic_report_no_increase: incoming.socratic_report_no_increase || '',
          wrong_cause_label: incoming.wrong_cause_label || '',
          wrong_cause_first_step: incoming.wrong_cause_first_step || '',
          wrong_cause_receiver_action: incoming.wrong_cause_receiver_action || '',
          wrong_cause_blocked_fields: incoming.wrong_cause_blocked_fields || ''
        }
      });
    }
    this.trackShareActivation('share_relay_action', {
      action_id: action.actionId,
      route: target,
      reason: action.reasonLine,
      evidence: action.evidenceLine,
      socratic_report_status: incoming.socratic_report_status || '',
      socratic_report_action: incoming.socratic_report_action || '',
      socratic_report_decision: incoming.socratic_report_decision || '',
      socratic_report_no_increase: incoming.socratic_report_no_increase || '',
      wrong_cause_label: incoming.wrong_cause_label || '',
      wrong_cause_first_step: incoming.wrong_cause_first_step || '',
      wrong_cause_receiver_action: incoming.wrong_cause_receiver_action || '',
      wrong_cause_blocked_fields: incoming.wrong_cause_blocked_fields || ''
    });
    if (!navigation.navigateLearningRoute(target)) navigation.navigateLearningRoute('/pages/arcade/arcade');
  },

  startTopMust() {
    if (this.data.topMust) {
      storage.set(storage.KEYS.selectedHomework, this.data.topMust);
      storage.set(storage.KEYS.selectedHomeworkSource, 'home_top_must');
    }
    this.openTutorFromHome('/pages/tutor/tutor?from=home_top_must');
  },

  goReportPreview() {
    wx.navigateTo({ url: '/pages/entry-detail/entry-detail?scene=parent&from=report_preview' });
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  trackShareActivation(event, payload = {}) {
    const incoming = this.data.incomingShare || (storage.loadIncomingShare && storage.loadIncomingShare());
    if (!incoming || !incoming.share_code) return;
    api.submitEvent({
      event,
      source: incoming.from || 'share',
      entity_id: incoming.share_code,
      page: 'home',
      payload: Object.assign({
        share_code: incoming.share_code,
        challenge: incoming.challenge || '',
        mode: incoming.mode || '',
        identity_tag: incoming.identity_tag || '',
        parent_next_action: incoming.parent_next_action || '',
        capability_gap: incoming.capability_gap || '',
        capability_label: incoming.capability_label || '',
        capability_next_action: incoming.capability_next_action || '',
        capability_route: incoming.capability_route || '',
        challenge_goal: incoming.challenge_goal || '',
        challenge_rule: incoming.challenge_rule || '',
        challenge_route: incoming.challenge_route || '',
        socratic_report_status: incoming.socratic_report_status || '',
        socratic_report_action: incoming.socratic_report_action || '',
        socratic_report_decision: incoming.socratic_report_decision || '',
        socratic_report_no_increase: incoming.socratic_report_no_increase || '',
        socratic_report_parent_proof: incoming.socratic_report_parent_proof || '',
        socratic_report_boundary: incoming.socratic_report_boundary || ''
      }, payload || {})
    }).catch(() => {});
  },
  runSurfaceDepthAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const pack = this.data.surfaceDepthPack || {};
    const route = dataset.route || pack.primaryRoute;
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: pack.surface || dataset.surface || '',
        dimensionId: dataset.dimensionId || '',
        label: dataset.label || '',
        route,
        readiness: pack.surfaceReadiness || ''
      });
    }
    navigation.navigateLearningRoute(route);
  },

});
