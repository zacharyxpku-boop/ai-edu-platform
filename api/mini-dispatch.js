import session from '../lib/mini-handlers/session.js';
import contentCheck from '../lib/mini-handlers/content-check.js';
import priority from '../lib/mini-handlers/priority.js';
import weekly from '../lib/mini-handlers/weekly.js';
import materialImage from '../lib/mini-handlers/material-image.js';
import quizGenerate from '../lib/mini-handlers/quiz-generate.js';
import reviewToday from '../lib/mini-handlers/review-today.js';
import contentEngine from '../lib/mini-handlers/content-engine.js';
import sync from '../lib/mini-handlers/sync.js';
import me from '../lib/mini-handlers/me.js';
import profileChildren from '../lib/mini-handlers/profile-children.js';
import roleSwitch from '../lib/mini-handlers/role-switch.js';
import event from '../lib/mini-handlers/event.js';
import studentTimeline from '../lib/mini-handlers/student-timeline.js';
import studentPortrait from '../lib/mini-handlers/student-portrait.js';
import knowledgeMap from '../lib/mini-handlers/knowledge-map.js';
import subscriptionReminder from '../lib/mini-handlers/subscription-reminder.js';
import { plans as billingPlans, order as billingOrder, quota as billingQuota } from '../lib/mini-handlers/billing.js';
import payWechatNotify from '../lib/mini-handlers/pay-wechat-notify.js';
import { privacy, deleteRequest, dataExport } from '../lib/mini-handlers/legal.js';
import { users as adminUsers, reports as adminReports, conversations as adminConversations, featureFlags, qbankItems, aiTraces } from '../lib/mini-handlers/admin.js';
import reviewGrade from '../lib/mini-handlers/review-grade.js';
import quizSubmit from '../lib/mini-handlers/quiz-submit.js';
import report from '../lib/mini-handlers/report.js';
import learningReportRecognize from '../lib/mini-handlers/learning-report-recognize.js';
import lead from '../lib/mini-handlers/lead.js';

export const config = { runtime: 'edge' };

const handlers = {
  session,
  'content-check': contentCheck,
  priority,
  weekly,
  'material-image': materialImage,
  'quiz-generate': quizGenerate,
  'review-today': reviewToday,
  'content-engine': contentEngine,
  sync,
  me,
  'profile-children': profileChildren,
  'role-switch': roleSwitch,
  event,
  'student-timeline': studentTimeline,
  'student-portrait': studentPortrait,
  'knowledge-map': knowledgeMap,
  'subscription-reminder': subscriptionReminder,
  'billing-plans': billingPlans,
  'billing-order': billingOrder,
  'billing-quota': billingQuota,
  'pay-wechat-notify': payWechatNotify,
  privacy,
  'account-delete-request': deleteRequest,
  'data-export': dataExport,
  'admin-users': adminUsers,
  'admin-reports': adminReports,
  'admin-conversations': adminConversations,
  'admin-ai-traces': aiTraces,
  'admin-feature-flags': featureFlags,
  'admin-qbank-items': qbankItems,
  'review-grade': reviewGrade,
  'quiz-submit': quizSubmit,
  report,
  'learning-report-recognize': learningReportRecognize,
  lead
};

function endpointFromPath(pathname = '') {
  if (pathname === '/api/mini/session') return 'session';
  if (pathname === '/api/mini/priority') return 'priority';
  if (pathname === '/api/mini/content-check') return 'content-check';
  if (pathname === '/api/mini/weekly') return 'weekly';
  if (pathname === '/api/mini/material-image') return 'material-image';
  if (pathname === '/api/mini/quiz-generate') return 'quiz-generate';
  if (pathname === '/api/mini/review-today') return 'review-today';
  if (pathname === '/api/mini/content-engine') return 'content-engine';
  if (pathname === '/api/mini/sync') return 'sync';
  if (pathname === '/api/mini/me') return 'me';
  if (pathname === '/api/mini/profile/children') return 'profile-children';
  if (pathname === '/api/mini/role/switch') return 'role-switch';
  if (pathname === '/api/mini/event') return 'event';
  if (/^\/api\/mini\/student\/[^/]+\/timeline$/.test(pathname)) return 'student-timeline';
  if (/^\/api\/mini\/student\/[^/]+\/portrait$/.test(pathname)) return 'student-portrait';
  if (pathname === '/api/mini/knowledge-map') return 'knowledge-map';
  if (pathname === '/api/mini/subscription/reminder') return 'subscription-reminder';
  if (pathname === '/api/mini/billing/plans') return 'billing-plans';
  if (pathname === '/api/mini/billing/order') return 'billing-order';
  if (pathname === '/api/mini/billing/quota') return 'billing-quota';
  if (pathname === '/api/pay/wechat/notify') return 'pay-wechat-notify';
  if (pathname === '/api/mini/legal/privacy') return 'privacy';
  if (pathname === '/api/mini/account/delete-request') return 'account-delete-request';
  if (pathname === '/api/mini/data/export') return 'data-export';
  if (pathname === '/api/admin/users') return 'admin-users';
  if (pathname === '/api/admin/reports') return 'admin-reports';
  if (pathname === '/api/admin/conversations') return 'admin-conversations';
  if (pathname === '/api/admin/ai-traces') return 'admin-ai-traces';
  if (pathname === '/api/admin/feature-flags') return 'admin-feature-flags';
  if (pathname === '/api/admin/qbank/items') return 'admin-qbank-items';
  if (pathname === '/api/mini/review-grade') return 'review-grade';
  if (pathname === '/api/mini/quiz-submit') return 'quiz-submit';
  if (pathname === '/api/mini/report') return 'report';
  if (pathname === '/api/mini/learning-report-recognize') return 'learning-report-recognize';
  if (pathname === '/api/lead') return 'lead';
  return '';
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type,x-mini-session,x-mini-client'
    }
  });
}

export default async function handler(req) {
  const url = new URL(req.url || 'https://yuandianzhixue.com/api/mini-dispatch');
  const endpoint = decodeURIComponent(url.searchParams.get('endpoint') || endpointFromPath(url.pathname));
  const route = handlers[endpoint];
  if (!route) {
    return json(404, {
      ok: false,
      error: 'mini_endpoint_not_found',
      endpoint
    });
  }
  return route(req);
}
