export const config = { runtime: 'edge' };

export default function handler() {
    return new Response(JSON.stringify({
        ok: false,
        error: 'legacy_endpoint_retired',
        inventory_status: 'retired_by_default',
        inventory_decision: 'retire_do_not_expose',
        replacement_endpoint: '/api/mini/report',
        replacement_flow: 'upload_material_to_parent_report',
        message: 'This legacy mini shop endpoint is retired. The current miniapp keeps learning evidence, parent reports, AI guidance, and short revisit instead of shop or exchange systems.'
    }), {
        status: 410,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}
