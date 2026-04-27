// 原点智学 · env 兼容读取
// 用户既有项目用 DEEPSEEK_API_KEY / DASHSCOPE_API_KEY / NEXT_PUBLIC_SUPABASE_URL 等命名
// 这里集中做 fallback，端点不改业务逻辑就能复用既有 key
//
// 用法：
//   import { env } from './_env.js';
//   const k = env.deepseek();

function pickEnv(...names) {
    if (typeof process === 'undefined' || !process.env) return '';
    for (const n of names) {
        if (process.env[n]) return process.env[n];
    }
    return '';
}

export const env = {
    deepseek: () => pickEnv('DEEPSEEK_KEY', 'DEEPSEEK_API_KEY'),
    qwen:     () => pickEnv('QWEN_KEY', 'DASHSCOPE_API_KEY'),
    qwenBase: () => pickEnv('DASHSCOPE_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1',

    supabaseUrl:      () => pickEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey:  () => pickEnv('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: () => pickEnv('SUPABASE_SERVICE_ROLE_KEY'),

    adminToken:    () => pickEnv('ADMIN_TOKEN'),
    ncdmHost:      () => pickEnv('NCDM_HOST'),
    confuciusHost: () => pickEnv('CONFUCIUS_HOST'),
    feishuWebhook: () => pickEnv('FEISHU_WEBHOOK_URL'),
};
