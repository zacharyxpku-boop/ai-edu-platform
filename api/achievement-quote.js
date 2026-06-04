export const config = { runtime: 'edge' };

const ENGINE_VERSION = 'legacy-learning-quote-retired-v2';
const LEGACY_ACHIEVEMENT_QUOTE_ENABLED = false;

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
        message: 'This legacy quote endpoint is retired. Use the miniapp report endpoint for parent-safe learning evidence.',
        inventory_status: 'retired_by_default',
        inventory_decision: 'retire_do_not_expose',
        replacement_endpoint: '/api/mini/report',
        can_be_reenabled_by_env: LEGACY_ACHIEVEMENT_QUOTE_ENABLED,
        engine_version: ENGINE_VERSION
    });
}
