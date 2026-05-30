#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function loadCommonJs(filePath) {
  const full = path.join(root, filePath);
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require,
    console,
    String,
    Number,
    Array,
    Object,
    Set,
    RegExp
  };
  vm.runInNewContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: full });
  return sandbox.module.exports;
}

const workbench = loadCommonJs(path.join('miniprogram', 'utils', 'partner-delivery-workbench.js'));

const emptyWorkbench = workbench.buildPartnerDeliveryWorkbench({
  childProfile: {
    nickname: 'Ming',
    grade: 'G5'
  }
});

assert.strictEqual(emptyWorkbench.materialLedger.length, 0, 'empty partner workbench must not invent a material record');
assert.strictEqual(emptyWorkbench.status, 'needs_real_task_evidence', 'empty partner workbench stays blocked');
assert.strictEqual(emptyWorkbench.pilotReadinessChecklist.rows.find((item) => item.id === 'material_intake').ready, false, 'empty partner workbench requires material intake');
assert.strictEqual(emptyWorkbench.revenueMilestones.find((item) => item.id === 'free_interpretation').allowed, false, 'free interpretation is locked until a real material exists');
assert.strictEqual(emptyWorkbench.revenueMilestones.find((item) => item.id === 'paid_7_day_execution').allowed, false, 'paid execution is locked without material and task evidence');

const assessmentOnly = workbench.buildPartnerDeliveryWorkbench({
  childProfile: {
    nickname: 'Ming',
    grade: 'G5'
  },
  parentConfirmed: false,
  materials: [
    {
      id: 'report_1',
      sourceSchemaId: 'talent_assessment',
      title: 'learning preference report',
      structuredEvidenceSignals: {
        questionType: 'math_word_problem'
      }
    }
  ],
  aiAnalysis: {
    recommendedProductLoop: {
      entry: 'method_validation',
      route: '/pages/tutor/tutor?from=test'
    }
  }
});

assert.strictEqual(assessmentOnly.id, 'partner_delivery_workbench');
assert.strictEqual(assessmentOnly.status, 'needs_real_task_evidence', 'assessment-only workbench must not unlock paid delivery');
assert.strictEqual(assessmentOnly.childRecord.evidenceStage, 'assessment_or_observation_only');
assert.strictEqual(assessmentOnly.childRecord.parentConfirmationStatus, 'required_before_delivery');
assert.notStrictEqual(assessmentOnly.childRecord.displayName, 'Ming', 'partner child record must not expose nickname as display name');
assert(assessmentOnly.childRecord.displayName.startsWith('child_'), 'partner child display name is the de-identified child code');
assert(assessmentOnly.childRecord.displayAlias.startsWith('student_'), 'partner child record exposes only a de-identified display alias');
assert(assessmentOnly.childRecord.privateFieldsKeptLocal.includes('name'), 'real child name stays in local/private fields');
assert(assessmentOnly.childRecord.privateFieldsKeptLocal.includes('wechat') && assessmentOnly.childRecord.privateFieldsKeptLocal.includes('parent_contact'), 'parent contact fields stay local/private');
assert.notStrictEqual(assessmentOnly.materialLedger[0].title, 'learning preference report', 'partner material ledger must not expose raw report title');
assert.strictEqual(assessmentOnly.materialLedger[0].title, assessmentOnly.materialLedger[0].sourceAlias, 'partner material ledger title is a de-identified source alias');
assert(assessmentOnly.materialLedger[0].partnerVisible.includes('source_alias'), 'partner material ledger exposes source alias instead of raw title');
assert(assessmentOnly.materialLedger[0].privateFieldsKeptLocal.includes('raw_report_name'), 'raw report title stays local/private');
assert(assessmentOnly.materialLedger[0].blockedFields.includes('talent_label'), 'partner ledger must block talent labels');
assert(assessmentOnly.materialLedger[0].blockedFields.includes('raw_photo'), 'partner ledger must block raw photos');
assert(assessmentOnly.solutionPipeline.some((item) => item.id === 'family_execution' && item.status === 'locked'), 'family execution stays locked without real task evidence');
assert(assessmentOnly.solutionPipeline.some((item) => item.id === 'service_offer' && item.status === 'offer_locked'), 'service offer stays locked without evidence and confirmation');
assert(assessmentOnly.pilotDeliveryPacket && assessmentOnly.pilotDeliveryPacket.status === 'needs_real_task_evidence', 'assessment-only partner packet stays evidence-gated');
assert(assessmentOnly.pilotDeliveryPacket.offerLine.includes('interpretation') && assessmentOnly.pilotDeliveryPacket.blockedPromises.includes('guaranteed_improvement'), 'assessment-only packet only allows interpretation and blocks result promises');
assert(assessmentOnly.advisorQueue.some((item) => item.id === 'complete_evidence' && item.status === 'todo'), 'advisor queue asks for real homework evidence');
assert(assessmentOnly.crmExport.allowedFields.includes('child_code'), 'CRM export includes only de-identified child code');
assert(!Object.prototype.hasOwnProperty.call(assessmentOnly.crmExport.row, 'name'), 'CRM export must not expose child name');
assert(!Object.prototype.hasOwnProperty.call(assessmentOnly.crmExport.row, 'score'), 'CRM export must not expose scores');
assert(assessmentOnly.crmExport.blockedFields.includes('score_ranking'), 'CRM export blocks score/ranking claims');
assert(assessmentOnly.crmExport.blockedFields.includes('parent_phone') && assessmentOnly.crmExport.blockedFields.includes('parent_wechat'), 'CRM export explicitly blocks parent contact fields');
assert(assessmentOnly.crmExport.blockedFields.includes('child_name') && assessmentOnly.crmExport.blockedFields.includes('contact_info'), 'CRM export explicitly blocks raw child identity and contact info');
assert(!Object.prototype.hasOwnProperty.call(assessmentOnly.crmExport.row, 'phone'), 'CRM export must not expose phone');
assert(!Object.prototype.hasOwnProperty.call(assessmentOnly.crmExport.row, 'wechat'), 'CRM export must not expose WeChat');
assert(!Object.prototype.hasOwnProperty.call(assessmentOnly.crmExport.row, 'contact_info'), 'CRM export must not expose contact info');
assert.strictEqual(assessmentOnly.pilotReadinessChecklist.status, 'pilot_needs_more_evidence', 'assessment-only pilot is not ready');
assert(assessmentOnly.pilotReadinessChecklist.rows.some((item) => item.id === 'real_task_evidence' && item.ready === false), 'pilot readiness requires real task evidence');
assert(assessmentOnly.pilotReadinessChecklist.operatorScript.includes('need one real homework') || assessmentOnly.pilotReadinessChecklist.operatorScript.includes('wrong-question'), 'pilot script asks for real task material before service recommendation');
assert.strictEqual(assessmentOnly.revenueMilestones.find((item) => item.id === 'paid_7_day_execution').allowed, false, 'paid 7-day execution is locked before evidence');
assert.strictEqual(assessmentOnly.privacyGate.serverKeyOnly, true, 'workbench keeps AI key server-side only');

const schoolFeedbackOnly = workbench.buildPartnerDeliveryWorkbench({
  childProfile: {
    nickname: 'Ming',
    grade: 'G5',
    parentConfirmed: true
  },
  materials: [
    {
      id: 'school_1',
      sourceSchemaId: 'school_material',
      title: 'teacher feedback',
      structuredEvidenceSignals: {
        subjectLabel: 'math',
        questionType: 'math_word_problem'
      }
    }
  ]
});

assert.strictEqual(schoolFeedbackOnly.status, 'needs_real_task_evidence', 'school feedback alone must not unlock guarded delivery');
assert.strictEqual(schoolFeedbackOnly.materialLedger[0].status, 'needs_real_task_evidence', 'school feedback needs a child first step or wrong cause before release');
assert(schoolFeedbackOnly.solutionPipeline.some((item) => item.id === 'family_execution' && item.status === 'locked'), 'family execution stays locked for school feedback without task evidence');
assert.strictEqual(schoolFeedbackOnly.revenueMilestones.find((item) => item.id === 'paid_7_day_execution').allowed, false, 'paid 7-day execution stays locked for school feedback only');

const schoolFeedbackWithTask = workbench.buildPartnerDeliveryWorkbench({
  childProfile: {
    nickname: 'Ming',
    grade: 'G5',
    parentConfirmed: true
  },
  materials: [
    {
      id: 'school_2',
      sourceSchemaId: 'school_material',
      title: 'teacher feedback with homework evidence',
      structuredEvidenceSignals: {
        subjectLabel: 'math',
        questionType: 'math_word_problem',
        firstStep: 'repeat the problem in one sentence',
        wrongCause: 'cannot find the equal relationship'
      }
    }
  ]
});

assert.strictEqual(schoolFeedbackWithTask.status, 'ready_for_guarded_delivery', 'school feedback with real task evidence can unlock guarded delivery');
assert.strictEqual(schoolFeedbackWithTask.materialLedger[0].status, 'evidence_ready', 'school feedback becomes ready only after real task evidence is present');

const photoOnlyWorkbench = workbench.buildPartnerDeliveryWorkbench({
  childProfile: {
    nickname: 'Ming',
    grade: 'G5',
    parentConfirmed: true
  },
  materials: [
    {
      id: 'photo_1',
      sourceSchemaId: 'wrong_question_photo',
      title: 'wrong question photo only',
      structuredEvidenceSignals: {}
    }
  ]
});

assert.strictEqual(photoOnlyWorkbench.status, 'needs_real_task_evidence', 'wrong-question photo alone must not unlock guarded delivery');
assert.strictEqual(photoOnlyWorkbench.materialLedger[0].status, 'needs_real_task_evidence', 'photo-only material needs child first step or wrong cause');
assert(photoOnlyWorkbench.solutionPipeline.some((item) => item.id === 'family_execution' && item.status === 'locked'), 'family execution stays locked for photo-only material');
assert.strictEqual(photoOnlyWorkbench.revenueMilestones.find((item) => item.id === 'paid_7_day_execution').allowed, false, 'paid 7-day execution stays locked for photo-only material');

const photoWithEvidenceWorkbench = workbench.buildPartnerDeliveryWorkbench({
  childProfile: {
    nickname: 'Ming',
    grade: 'G5',
    parentConfirmed: true
  },
  materials: [
    {
      id: 'photo_2',
      sourceSchemaId: 'wrong_question_photo',
      title: 'wrong question photo with child evidence',
      structuredEvidenceSignals: {
        firstStep: 'circle the known quantity first',
        wrongCause: 'unit relationship was missed'
      }
    }
  ]
});

assert.strictEqual(photoWithEvidenceWorkbench.status, 'ready_for_guarded_delivery', 'wrong-question photo unlocks delivery only after real child evidence');
assert.strictEqual(photoWithEvidenceWorkbench.materialLedger[0].status, 'evidence_ready', 'photo material becomes ready after first-step or wrong-cause evidence');

const evidenceWithoutParentConfirmation = workbench.buildPartnerDeliveryWorkbench({
  childProfile: {
    nickname: 'Ming',
    grade: 'G5'
  },
  materials: [
    {
      id: 'wrong_no_parent_confirmation',
      sourceSchemaId: 'wrong_question_paper',
      title: 'wrong question with evidence but no parent confirmation',
      structuredEvidenceSignals: {
        firstStep: 'write the known quantity first',
        wrongCause: 'missed the comparison relation'
      }
    }
  ]
});

assert.strictEqual(evidenceWithoutParentConfirmation.status, 'needs_parent_confirmation', 'real evidence still needs parent confirmation before guarded delivery');
assert(evidenceWithoutParentConfirmation.solutionPipeline.some((item) => item.id === 'family_execution' && item.status === 'needs_parent_confirmation'), 'family execution pipeline stays pending until parent confirmation');
assert.strictEqual(evidenceWithoutParentConfirmation.revenueMilestones.find((item) => item.id === 'paid_7_day_execution').allowed, false, 'paid 7-day execution requires both evidence and parent confirmation');
assert.strictEqual(evidenceWithoutParentConfirmation.revenueMilestones.find((item) => item.id === 'course_or_counselor_upgrade').allowed, false, 'course or counselor upgrade requires parent confirmation');
assert(evidenceWithoutParentConfirmation.advisorQueue.find((item) => item.id === 'confirm_parent_consent').status === 'todo', 'advisor queue keeps parent consent as the first todo');
assert(evidenceWithoutParentConfirmation.advisorQueue.find((item) => item.id === 'schedule_day7_review').status === 'locked', 'advisor queue cannot schedule day-7 review before parent confirmation');
assert.strictEqual(evidenceWithoutParentConfirmation.crmExport.row.followup_due_day, 1, 'CRM follow-up stays day-1 consent check before parent confirmation');
assert(evidenceWithoutParentConfirmation.pilotReadinessChecklist.rows.some((item) => item.id === 'executable_family_plan' && item.ready === false), 'pilot checklist does not mark execution plan ready before parent confirmation');

const unsafeNextActionWorkbench = workbench.buildPartnerDeliveryWorkbench({
  childProfile: {
    nickname: 'Ming',
    grade: 'G5',
    parentConfirmed: true
  },
  materials: [
    {
      id: 'wrong_unsafe_action',
      sourceSchemaId: 'wrong_question_paper',
      title: 'raw wrong question',
      structuredEvidenceSignals: {
        firstStep: 'circle the known quantity first',
        wrongCause: 'unit relationship was missed'
      }
    }
  ],
  servicePathway: {
    nextAction: 'Call Ming and mention score 62, class ranking, photo and full answer.'
  }
});

const unsafeActionText = JSON.stringify({
  advisorQueue: unsafeNextActionWorkbench.advisorQueue,
  crmRow: unsafeNextActionWorkbench.crmExport.row
});
assert(!/Ming|score 62|ranking|photo|full answer/i.test(unsafeActionText), 'partner advisor queue and CRM next action sanitize private or sensitive upstream action text');
assert.strictEqual(
  unsafeNextActionWorkbench.advisorQueue.find((item) => item.id === 'complete_evidence').action,
  'Confirm the 7-day plan and start one first-step task.',
  'unsafe service-pathway next action falls back before it reaches the visible advisor queue'
);
assert(unsafeNextActionWorkbench.crmExport.row.next_action.includes('day-7'), 'CRM next action remains a safe operational step');

const unsafeLabelWorkbench = workbench.buildPartnerDeliveryWorkbench({
  childProfile: {
    nickname: 'Ming',
    grade: 'G5',
    parentConfirmed: true
  },
  materials: [
    {
      id: 'wrong_unsafe_label',
      sourceSchemaId: 'wrong_question_paper',
      structuredEvidenceSignals: {
        firstStep: 'write the relation first',
        wrongCause: 'missed the quantity relation'
      }
    }
  ],
  servicePathway: {
    primaryMode: {
      id: 'socratic_private_tutor',
      label: 'Ming score 62 ranking photo full answer mode',
      route: '/pages/tutor/tutor'
    },
    primaryTier: {
      id: 'seven_day_companion',
      label: 'Use raw photo and ranking in package'
    }
  }
});

const unsafeLabelText = JSON.stringify({
  primaryMode: unsafeLabelWorkbench.primaryMode,
  primaryPackage: unsafeLabelWorkbench.primaryPackage,
  solutionPipeline: unsafeLabelWorkbench.solutionPipeline
});
assert(!/Ming|score 62|ranking|photo|full answer|raw photo/i.test(unsafeLabelText), 'partner-visible mode/package labels sanitize sensitive upstream labels');
assert.strictEqual(unsafeLabelWorkbench.primaryMode.label, 'socratic_private_tutor', 'unsafe primary mode label falls back to mode id');
assert.strictEqual(unsafeLabelWorkbench.primaryPackage.label, 'seven_day_companion', 'unsafe primary package label falls back to package id');

const validated = workbench.buildPartnerDeliveryWorkbench({
  childProfile: {
    nickname: 'Ming',
    grade: 'G5',
    parentConfirmed: true
  },
  materials: [
    {
      id: 'wrong_1',
      sourceSchemaId: 'wrong_question_paper',
      title: 'math wrong question',
      structuredEvidenceSignals: {
        subjectLabel: 'math',
        questionType: 'math_word_problem',
        firstStep: 'draw the relation first',
        wrongCause: 'missed the unit relationship'
      }
    }
  ],
  servicePathway: {
    primaryMode: {
      id: 'socratic_private_tutor',
      label: 'Socratic private tutor',
      route: '/pages/tutor/tutor'
    },
    primaryTier: {
      id: 'seven_day_companion',
      label: '7-day companion'
    },
    nextAction: 'Start one first-step task tonight.'
  }
});

assert.strictEqual(validated.status, 'ready_for_guarded_delivery', 'real wrong-question evidence unlocks guarded delivery');
assert.strictEqual(validated.childRecord.evidenceStage, 'real_task_evidence_ready');
assert.strictEqual(validated.childRecord.parentConfirmationStatus, 'confirmed');
assert(validated.solutionPipeline.some((item) => item.id === 'family_execution' && item.status === 'ready'), 'family execution is ready with evidence');
assert(validated.solutionPipeline.some((item) => item.id === 'service_offer' && item.status === 'offer_allowed'), 'service offer requires both evidence and parent confirmation');
assert.strictEqual(validated.crmExport.row.primary_mode, 'socratic_private_tutor');
assert.strictEqual(validated.crmExport.row.primary_package, 'seven_day_companion');
assert.strictEqual(validated.advisorQueue.find((item) => item.id === 'schedule_day7_review').status, 'todo', 'day-7 review opens only after evidence and consent');
assert.strictEqual(validated.crmExport.row.followup_due_day, 7, 'CRM day-7 follow-up opens only after evidence and consent');
assert.strictEqual(validated.pilotReadinessChecklist.status, 'ready_for_partner_pilot', 'validated evidence and consent make pilot ready');
assert.strictEqual(validated.pilotReadinessChecklist.score, 100, 'validated pilot readiness reaches 100');
assert(validated.pilotReadinessChecklist.rows.every((item) => item.ready), 'all pilot readiness gates are ready after evidence and consent');
assert(validated.pilotReadinessChecklist.stopRule.includes('confirmed evidence'), 'pilot stop rule keeps sales tied to confirmed evidence');
assert.strictEqual(validated.pilotDeliveryPacket.status, 'pilot_packet_ready', 'validated partner packet becomes ready after evidence and consent');
assert(validated.pilotDeliveryPacket.deliveryRows.length === 4 && validated.pilotDeliveryPacket.deliveryRows.some((item) => item.id === 'day7_review'), 'partner packet has day-0 to day-7 delivery rows');
assert(validated.pilotDeliveryPacket.partnerTalkTrack.length === 4 && validated.pilotDeliveryPacket.revenueGateLine.includes('Paid pilot allowed'), 'partner packet has sales talk track and revenue gate');
assert(!/score 62|class ranking|Ming|parent_phone|parent_wechat/i.test(JSON.stringify(validated.pilotDeliveryPacket)), 'partner packet does not leak raw private or upstream sales fields');
assert.strictEqual(validated.revenueMilestones.find((item) => item.id === 'paid_7_day_execution').allowed, true);
assert.strictEqual(validated.revenueMilestones.find((item) => item.id === 'course_or_counselor_upgrade').allowed, true);
assert(validated.nextBestAction.includes('day-7') || validated.nextBestAction.includes('Schedule'), 'next action moves to day-7 review');

console.log('All partner delivery workbench tests pass.');
