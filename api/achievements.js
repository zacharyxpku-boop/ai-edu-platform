export const config = { runtime: 'edge' };

export default function handler() {
    return new Response(JSON.stringify({
        ok: false,
        error: 'legacy_endpoint_retired',
        inventory_status: 'retired_by_default',
        inventory_decision: 'retire_do_not_expose',
        replacement_endpoint: '/api/mini/achievements',
        message: '该旧阶段荣誉端点已退役；当前产品只保留本地阶段学习记录。'
    }), {
        status: 410,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}
