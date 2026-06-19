export const config = { runtime: 'edge' };

export default function handler() {
    return new Response(JSON.stringify({
        ok: false,
        error: 'legacy_endpoint_retired',
        inventory_status: 'retired_by_default',
        inventory_decision: 'retire_do_not_expose',
        replacement_endpoint: '/api/mini/review-today',
        replacement_flow: 'learning_stage_evidence',
        message: 'This retired endpoint is no longer exposed. Use learning evidence records and parent-safe revisit summaries instead.'
    }), {
        status: 410,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}
