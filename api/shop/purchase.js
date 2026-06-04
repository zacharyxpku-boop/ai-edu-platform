export const config = { runtime: 'edge' };

export default function handler() {
    return new Response(JSON.stringify({
        ok: false,
        error: 'legacy_endpoint_retired',
        inventory_status: 'retired_by_default',
        inventory_decision: 'retire_do_not_expose',
        replacement_endpoint: '/api/mini/shop',
        message: '该旧兑换提交端点已退役；当前产品不提供交易、充值或外部权益。'
    }), {
        status: 410,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}
