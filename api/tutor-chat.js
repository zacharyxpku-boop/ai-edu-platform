export const config = { runtime: 'edge' };

const ENGINE_VERSION = 'legacy-tutor-chat-retired-v2';
const LEGACY_TUTOR_CHAT_ENABLED = false;

function json(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' }
    });
}

export default async function handler() {
    return json(410, {
        ok: false,
        error: 'legacy_endpoint_retired',
        message: 'This legacy tutor chat endpoint is retired. Use the miniapp tutor message endpoint for first-step guidance and answer-safe revisit flow.',
        inventory_status: 'retired_by_default',
        inventory_decision: 'retire_do_not_expose',
        replacement_endpoint: '/api/mini/tutor-message',
        can_be_reenabled_by_env: LEGACY_TUTOR_CHAT_ENABLED,
        engine_version: ENGINE_VERSION
    });
}
