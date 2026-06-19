import { json, readJson, clientRateKey, rateLimit } from '../../lib/mini-shared.js';

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env)
    ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
    : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env)
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : '';
const BUCKET = 'materials';
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const ALLOWED_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function safeExt(value) {
    const ext = String(value || 'jpg').toLowerCase().replace(/[^a-z]/g, '');
    return ALLOWED_EXT[ext] ? ext : 'jpg';
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') {
        return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST' }, 405);
    }

    const limited = rateLimit(clientRateKey(req, 'mini:material-image'), 40);
    if (!limited.ok) {
        return json({ ok: false, error: 'rate_limited', message: '今天上传次数较多，先休息一下。' }, 429);
    }

    let body = {};
    try {
        body = await readJson(req, 2 * 1024 * 1024);
    } catch (error) {
        return json({
            ok: false,
            error: error.message === 'payload_too_large' ? 'payload_too_large' : 'bad_json',
            message: error.message === 'payload_too_large' ? '图片过大，请压缩后再传' : '请求体不是合法 JSON'
        }, error.status || 400);
    }

    const base64 = String(body.image_base64 || '').replace(/^data:[^,]+,/, '');
    if (!base64 || base64.length < 64) {
        return json({ ok: false, error: 'missing_image', message: 'image_base64 必填' }, 400);
    }

    let bytes;
    try {
        bytes = Buffer.from(base64, 'base64');
    } catch (error) {
        return json({ ok: false, error: 'bad_base64', message: '图片编码不合法' }, 400);
    }
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
        return json({ ok: false, error: 'image_too_large', message: '图片超过 1.5MB，请压缩后再传' }, 413);
    }

    const ext = safeExt(body.ext);
    const materialType = String(body.material_type || 'material').replace(/[^a-z_]/g, '').slice(0, 24) || 'material';
    const day = new Date().toISOString().slice(0, 10);
    const objectPath = `mini/${day}/${materialType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return json({
            ok: true,
            stored: 'local_only',
            path: '',
            message: '后端存储未配置，材料已在本机留档，待配置后可补传。'
        });
    }

    try {
        const upstream = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                'content-type': ALLOWED_EXT[ext],
                'x-upsert': 'false'
            },
            body: bytes
        });
        if (!upstream.ok) {
            const detail = await upstream.text().catch(() => '');
            return json({
                ok: false,
                error: 'storage_upstream_error',
                upstream_status: upstream.status,
                message: detail.indexOf('Bucket not found') >= 0
                    ? `存储桶 ${BUCKET} 不存在，请在 Supabase 控制台创建`
                    : '后端存储暂时不可用，材料已在本机留档'
            }, 502);
        }
        return json({ ok: true, stored: 'supabase', bucket: BUCKET, path: objectPath });
    } catch (error) {
        return json({ ok: false, error: 'storage_unreachable', message: '后端存储连接失败，材料已在本机留档' }, 502);
    }
}
