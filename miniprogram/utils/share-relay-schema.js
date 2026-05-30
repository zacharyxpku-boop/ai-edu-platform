'use strict';

const DEFAULT_ALLOWLIST = [
  'share_intent',
  'share',
  'from',
  'mode',
  'challenge',
  'share_code',
  'invite_code',
  'identity_tag',
  'tonight_action',
  'parent_question',
  'tomorrow_check',
  'report_daily_action',
  'unified_next_action',
  'unified_next_action_route',
  'parent_next_action',
  'next_challenge',
  'share_challenge_goal',
  'share_challenge_rule',
  'share_challenge_route',
  'share_privacy_boundary',
  'share_return_contract',
  'safe_relay_allowed_fields',
  'safe_relay_blocked_fields',
  'relay_first_step',
  'relay_receiver_action',
  'relay_parent_check',
  'relay_next_revisit',
  'relay_allowed_fields',
  'relay_blocked_fields',
  'relay_completion_signal',
  'relay_return_path',
  'tonight_parent_question',
  'tonight_tomorrow_revisit',
  'tonight_release_gate',
  'tonight_share_boundary',
  'tonight_allowed_fields',
  'tonight_blocked_fields',
  'question_bank_relay_first_step',
  'question_bank_relay_wrong_cause',
  'question_bank_relay_next_action',
  'course_unit_parent_decision',
  'course_unit_share_contract',
  'course_unit_recall_route',
  'course_unit_game_route',
  'relay_review',
  'relay_spread_status',
  'relay_season_status',
  'wrong_cause_label',
  'wrong_cause_first_step',
  'wrong_cause_parent_check',
  'wrong_cause_receiver_action',
  'wrong_cause_next_revisit',
  'wrong_cause_allowed_fields',
  'wrong_cause_blocked_fields',
  'source_challenge_route',
  'openmaic_bridge_status',
  'openmaic_next_action',
  'openmaic_share_boundary',
  'openmaic_game_gate',
  'openmaic_blocked_fields',
  'openmaic_evidence',
  'openmaic_return_path'
];

const RECEIVER_CONTEXT_ALLOWLIST = [
  'code',
  'action',
  'action_label',
  'action_detail',
  'parent_next_action',
  'capability_gap',
  'capability_label',
  'capability_next_action',
  'capability_route',
  'challenge_goal',
  'challenge_rule',
  'challenge_route',
  'relay_id',
  'relay_privacy',
  'relay_review',
  'relay_invite_line',
  'relay_receiver_prompt',
  'relay_parent_reassurance',
  'relay_day7_return',
  'relay_proof_signal',
  'relay_guardrail',
  'relay_ladder',
  'relay_attraction_hook',
  'relay_local_gate',
  'relay_spread_score',
  'relay_spread_line',
  'relay_spread_fallback',
  'relay_spread_reason',
  'relay_spread_required',
  'relay_season',
  'relay_season_days',
  'relay_season_gate',
  'relay_season_line',
  'question_bank_relay_label',
  'question_bank_relay_boundary',
  'question_bank_relay_parent_check',
  'question_bank_relay_route',
  'visual_board_relay_title',
  'visual_board_relay_layer',
  'visual_board_relay_student_line',
  'visual_board_relay_parent_line',
  'visual_board_relay_exit',
  'visual_board_relay_boundary',
  'visual_board_relay_route',
  'source_challenge_prompt',
  'source_challenge_route',
  'source_challenge_blocked',
  'source_challenge_count',
  'source_challenge_decision',
  'source_challenge_first',
  'source_challenge_license',
  'source_challenge_local_rule',
  'course_unit_label',
  'course_unit_subject',
  'course_unit_tier',
  'course_unit_blackboard',
  'course_unit_report_contract',
  'wrong_cause_gate',
  'wrong_cause_pack',
  'wrong_cause_return_path',
  'receiver_material_required',
  'receiver_first_step_required',
  'receiver_wrong_cause_required',
  'receiver_revisit_required',
  'receiver_evidence_contract',
  'socratic_report_status',
  'socratic_report_decision',
  'socratic_report_action',
  'socratic_report_parent_proof',
  'socratic_report_boundary',
  'socratic_report_no_increase',
  'tonight_decision',
  'tonight_tomorrow',
  'source',
  'day',
  'split',
  'created_at'
];

const DEFAULT_DENYLIST = [
  'original_question',
  'original_answer',
  'photo',
  'raw_text',
  'full_answer',
  'full_solution',
  'full_dialogue',
  'score',
  'ranking',
  'private_comment',
  'classmate_comparison',
  'teacher_private_comment',
  'complete_transcript'
];

const COMPACT_QUERY_LIMIT = 900;

const COMPACT_PRIMARY_KEYS = [
  'share_intent',
  'share',
  'from',
  'mode',
  'challenge',
  'share_code',
  'invite_code',
  'identity_tag',
  'tonight_action',
  'parent_question',
  'tomorrow_check',
  'relay_first_step',
  'relay_receiver_action',
  'relay_parent_check',
  'relay_next_revisit',
  'relay_blocked_fields',
  'wrong_cause_label',
  'openmaic_bridge_status',
  'openmaic_next_action',
  'openmaic_game_gate',
  'openmaic_blocked_fields'
];

const COMPACT_SKIP_KEYS = [
  'allowed_fields',
  'blocked_fields',
  'sanitized',
  'local_rule'
];

const RELAY_META_KEYS = [
  'relay_pack_schema',
  'relay_pack_fields',
  'relay_pack',
  'relay_query_mode',
  'relay_query_gate'
];

function safeKeySet(extra = []) {
  return new Set(DEFAULT_ALLOWLIST.concat(RECEIVER_CONTEXT_ALLOWLIST).concat(RELAY_META_KEYS).concat(extra));
}

function toText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeQueryValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(',');
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (_) {
      return '';
    }
  }
  return toText(value);
}

function parseJsonMaybe(value) {
  const text = toText(value);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    try {
      return JSON.parse(decodeURIComponent(text));
    } catch (__) {
      return null;
    }
  }
}

function mergeAllowedFields(source = {}, allowlist = DEFAULT_ALLOWLIST, denylist = DEFAULT_DENYLIST) {
  const safe = {};
  const extra = {};
  allowlist.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key) && !denylist.includes(key)) {
      safe[key] = source[key];
    }
  });
  Object.keys(source || {}).forEach((key) => {
    if (!allowlist.includes(key) && !denylist.includes(key)) {
      extra[key] = source[key];
    }
  });
  return { safe, extra };
}

function buildSafeSharePayload(card = {}, intent = 'peer_challenge', extra = {}, options = {}) {
  const source = Object.assign({}, card.payload || {}, extra || {});
  const allowlist = Array.isArray(options.allowlist) && options.allowlist.length ? options.allowlist : DEFAULT_ALLOWLIST;
  const denylist = Array.isArray(options.denylist) && options.denylist.length ? options.denylist : DEFAULT_DENYLIST;
  const { safe } = mergeAllowedFields(source, allowlist, denylist);
  const shareCode = card.code || source.share || source.share_code || source.invite_code || 'LOCAL';
  const payload = Object.assign({
    share_intent: intent,
    share: shareCode,
    share_code: shareCode,
    allowed_fields: ['share_code', 'tonight_action', 'parent_question', 'tomorrow_check', 'safe_relay_allowed_fields'],
    blocked_fields: denylist.slice(0)
  }, safe);
  payload.sanitized = true;
  payload.local_rule = '分享出口只走白名单，本地代码先剔除原题、答案、照片、完整对话、分数、排名和私密评论。';
  return payload;
}

function buildQueryString(payload = {}) {
  return Object.keys(payload || {})
    .filter((key) => payload[key] !== undefined && payload[key] !== null && payload[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(normalizeQueryValue(payload[key]))}`)
    .join('&');
}

function buildCompactRelayPayload(payload = {}, options = {}) {
  const denylist = Array.isArray(options.denylist) && options.denylist.length ? options.denylist : DEFAULT_DENYLIST;
  const primaryKeys = Array.isArray(options.primaryKeys) && options.primaryKeys.length ? options.primaryKeys : COMPACT_PRIMARY_KEYS;
  const allowedKeys = safeKeySet(Array.isArray(options.allowlist) ? options.allowlist : []);
  const compact = {};
  const pack = {};

  primaryKeys.forEach((key) => {
    const value = normalizeQueryValue(payload[key]);
    if (value && !denylist.includes(key)) compact[key] = value.slice(0, 96);
  });

  Object.keys(payload || {}).forEach((key) => {
    if (denylist.includes(key) || primaryKeys.includes(key) || COMPACT_SKIP_KEYS.includes(key)) return;
    if (!allowedKeys.has(key)) return;
    const value = normalizeQueryValue(payload[key]);
    if (!value) return;
    pack[key] = value.slice(0, 96);
  });

  const packKeys = Object.keys(pack).slice(0, 18);
  if (packKeys.length) {
    compact.relay_pack_schema = 'safe_relay_compact_v1';
    compact.relay_pack_fields = packKeys.join(',');
    compact.relay_pack = JSON.stringify(packKeys.reduce((acc, key) => {
      acc[key] = pack[key];
      return acc;
    }, {}));
  }
  compact.relay_query_mode = 'compact';
  compact.relay_query_gate = 'denylist_then_pack';
  return compact;
}

function buildShareRelayQuery(path = '', payload = {}, options = {}) {
  const base = toText(path);
  const fullQuery = buildQueryString(payload);
  const fullPath = fullQuery ? `${base}${base.indexOf('?') >= 0 ? '&' : '?'}${fullQuery}` : base;
  const forceCompact = options.forceCompact === true;
  if (!forceCompact && fullPath.length <= (options.limit || COMPACT_QUERY_LIMIT)) return fullPath;
  const query = buildQueryString(buildCompactRelayPayload(payload, options));
  if (!query) return base;
  return `${base}${base.indexOf('?') >= 0 ? '&' : '?'}${query}`;
}

function parseShareRelayQuery(query = {}) {
  const safe = {};
  const allowedKeys = safeKeySet();
  const relayPack = parseJsonMaybe(query.relay_pack);
  if (relayPack && typeof relayPack === 'object') {
    Object.keys(relayPack).forEach((key) => {
      if (allowedKeys.has(key) && !DEFAULT_DENYLIST.includes(key)) safe[key] = toText(relayPack[key]);
    });
  }
  Object.keys(query || {}).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(query, key) && allowedKeys.has(key) && !DEFAULT_DENYLIST.includes(key)) {
      safe[key] = toText(query[key]);
    }
  });
  return safe;
}

module.exports = {
  DEFAULT_ALLOWLIST,
  RECEIVER_CONTEXT_ALLOWLIST,
  DEFAULT_DENYLIST,
  COMPACT_PRIMARY_KEYS,
  mergeAllowedFields,
  buildSafeSharePayload,
  buildCompactRelayPayload,
  buildShareRelayQuery,
  parseShareRelayQuery
};
