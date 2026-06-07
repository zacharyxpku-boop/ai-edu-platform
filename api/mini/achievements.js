export const config = { runtime: 'edge' };

export default function handler() {
    return new Response(JSON.stringify({
        ok: false,
        error: 'legacy_endpoint_retired',
        inventory_status: 'retired_by_default',
        inventory_decision: 'retire_do_not_expose',
        replacement_endpoint: '/api/mini/review-today',
        replacement_flow: 'learning_stage_evidence',
        message: 'This legacy mini achievements endpoint is retired. The current miniapp uses evidence records and parent-safe revisit summaries instead of achievement, badge, or honor systems.'
    }), {
        status: 410,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}
