'use strict';

const WEB_SURFACE_CONTRACT_VERSION = '2026-05-26.web-preview-v1';

const WEB_SURFACE_REQUIRED_ENTRIES = [
  'home',
  'upload',
  'report',
  'tutor',
  'review',
  'parent',
  'map'
];

const WEB_MINIAPP_CHILD_SCENES = [
  'upload',
  'report',
  'tutor',
  'review',
  'parent',
  'today'
];

const WEB_SURFACE_LOOP = [
  {
    id: 'upload',
    input: 'talent report, grades, wrong questions, school feedback, parent notes',
    output: 'classified evidence ledger'
  },
  {
    id: 'report',
    input: 'evidence ledger and confidence boundary',
    output: 'parent-readable method-fit report'
  },
  {
    id: 'tutor',
    input: 'first action and stuck point',
    output: 'Socratic first-step dialogue'
  },
  {
    id: 'review',
    input: 'wrong-cause and recall target',
    output: 'memory, transfer, and variation evidence'
  },
  {
    id: 'parent',
    input: 'child evidence and next action',
    output: 'one parent question and next checkpoint'
  },
  {
    id: 'map',
    input: 'current evidence loop and next checkpoints',
    output: 'tonight route and 7-day continuation path'
  }
];

const WEB_SURFACE_VIEW_MODEL_KEYS = [
  'student',
  'progress',
  'uploads',
  'entries',
  'reportEvidence',
  'methodMatches',
  'tutorSession',
  'reviewChallenges',
  'parentSummary'
];

module.exports = {
  WEB_SURFACE_CONTRACT_VERSION,
  WEB_SURFACE_REQUIRED_ENTRIES,
  WEB_MINIAPP_CHILD_SCENES,
  WEB_SURFACE_LOOP,
  WEB_SURFACE_VIEW_MODEL_KEYS
};
