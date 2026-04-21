/* ===== 原点智学 API Manager v1 ===== */
/* Unified AI API interface with BYOK + free tier + rate limiting */

(function () {
    'use strict';

    // --- Simple encryption for localStorage key storage ---
    var SALT = 'ydzx2026';
    function obfuscate(str) {
        return btoa(SALT + str).split('').reverse().join('');
    }
    function deobfuscate(str) {
        try {
            var decoded = atob(str.split('').reverse().join(''));
            return decoded.startsWith(SALT) ? decoded.substring(SALT.length) : '';
        } catch (e) { return ''; }
    }

    // --- Safe localStorage ---
    function sGet(key) {
        try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }
    function sSet(key, value) {
        try { window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
    }

    // --- Provider configs ---
    var PROVIDERS = {
        deepseek: {
            name: 'DeepSeek',
            baseUrl: 'https://api.deepseek.com/v1/chat/completions',
            defaultModel: 'deepseek-chat',
            keyPlaceholder: 'sk-...',
            docUrl: 'https://platform.deepseek.com/api_keys'
        },
        doubao: {
            name: '豆包 (火山引擎)',
            baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
            defaultModel: 'doubao-1-5-pro-32k-250115',
            keyPlaceholder: 'ep-...',
            docUrl: 'https://console.volcengine.com/ark'
        },
        qwen: {
            name: '通义千问',
            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
            defaultModel: 'qwen-plus',
            keyPlaceholder: 'sk-...',
            docUrl: 'https://dashscope.console.aliyun.com/apiKey'
        },
        openai: {
            name: 'OpenAI',
            baseUrl: 'https://api.openai.com/v1/chat/completions',
            defaultModel: 'gpt-4o-mini',
            keyPlaceholder: 'sk-...',
            docUrl: 'https://platform.openai.com/api-keys'
        }
    };

    // --- Rate limiting ---
    var LIMITS = {
        free: 3,
        member: 50,
        byok: Infinity
    };

    function getTodayKey() {
        return 'ydzx_usage_' + new Date().toISOString().split('T')[0];
    }

    function getUsageToday() {
        return parseInt(sGet(getTodayKey()) || '0', 10);
    }

    function incrementUsage() {
        sSet(getTodayKey(), String(getUsageToday() + 1));
    }

    function getUserTier() {
        // Check if user has BYOK key set
        var provider = sGet('ydzx_provider') || 'deepseek';
        var encKey = sGet('ydzx_apikey_' + provider);
        if (encKey && deobfuscate(encKey)) return 'byok';
        // Check if member (simplified: check localStorage flag)
        if (sGet('ydzx_member') === 'true') return 'member';
        return 'free';
    }

    function getRemainingCalls() {
        var tier = getUserTier();
        var limit = LIMITS[tier];
        if (limit === Infinity) return Infinity;
        return Math.max(0, limit - getUsageToday());
    }

    // --- Core API call ---
    function callAI(options) {
        /*
         * options: {
         *   messages: [{role: 'user', content: '...'}],
         *   systemPrompt: 'optional system prompt',
         *   provider: 'deepseek' | 'doubao' | 'qwen' | 'openai' (optional, uses saved preference),
         *   model: 'override model name' (optional),
         *   temperature: 0.7 (optional),
         *   maxTokens: 1024 (optional),
         *   onChunk: function(text) {} (for streaming, optional),
         *   onDone: function(fullText) {},
         *   onError: function(errorMsg) {}
         * }
         */
        var tier = getUserTier();
        var remaining = getRemainingCalls();

        if (remaining <= 0) {
            if (options.onError) {
                options.onError('今日免费额度已用完（' + LIMITS[tier] + '次/天）。你可以在设置中填入自己的API Key继续使用，或升级会员。');
            }
            return;
        }

        var providerKey = options.provider || sGet('ydzx_provider') || 'qwen';
        var config = PROVIDERS[providerKey];
        if (!config) {
            if (options.onError) options.onError('不支持的AI服务: ' + providerKey);
            return;
        }

        // Get API key (BYOK only, no hardcoded platform key on client)
        var apiKey = '';
        var encKey = sGet('ydzx_apikey_' + providerKey);
        if (encKey) {
            apiKey = deobfuscate(encKey);
        }

        // Free tier without BYOK → route through server proxy /api/ai-proxy
        // BYOK → direct to provider
        var useProxy = !apiKey;

        // Build messages
        var messages = [];
        if (options.systemPrompt) {
            messages.push({ role: 'system', content: options.systemPrompt });
        }
        messages = messages.concat(options.messages || []);

        var body = {
            model: options.model || config.defaultModel,
            messages: messages,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 1024,
            stream: !!options.onChunk
        };

        var targetUrl, fetchHeaders;
        if (useProxy) {
            targetUrl = '/api/ai-proxy';
            fetchHeaders = { 'Content-Type': 'application/json' };
            body.provider = providerKey;
        } else {
            targetUrl = config.baseUrl;
            fetchHeaders = {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            };
        }

        var fetchOptions = {
            method: 'POST',
            headers: fetchHeaders,
            body: JSON.stringify(body)
        };

        // 把上游错误 payload 翻译成人话
        function friendlyErr(status, raw) {
            var code = '';
            try { var j = JSON.parse(raw); code = j.error || ''; } catch (e) {}
            if (useProxy && status === 500 && code === 'not_configured') {
                return '平台免费额度暂时不可用（服务端尚未配置 Key）。你可以去「API 设置」填入自己的 Key 继续使用，BYOK 无每日限制。';
            }
            if (useProxy && status === 429 && code === 'rate_limited') {
                return '今日平台免费额度已满，明天再试或去「API 设置」填入自己的 Key（无限额）。';
            }
            if (status === 401 || status === 403) {
                return 'API Key 无效或权限不足。请去「API 设置」检查你的 Key。';
            }
            if (status === 429) {
                return '调用过于频繁，稍等 30 秒再试。';
            }
            return 'AI 服务暂时异常（' + status + '）' + (raw ? '：' + raw.substring(0, 120) : '');
        }

        if (options.onChunk) {
            // Streaming mode
            fetch(targetUrl, fetchOptions).then(function (response) {
                if (!response.ok) {
                    return response.text().then(function (text) {
                        throw new Error(friendlyErr(response.status, text));
                    });
                }
                incrementUsage();
                var reader = response.body.getReader();
                var decoder = new TextDecoder();
                var fullText = '';

                function read() {
                    reader.read().then(function (result) {
                        if (result.done) {
                            if (options.onDone) options.onDone(fullText);
                            return;
                        }
                        var chunk = decoder.decode(result.value, { stream: true });
                        var lines = chunk.split('\n');
                        for (var i = 0; i < lines.length; i++) {
                            var line = lines[i].trim();
                            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                                try {
                                    var json = JSON.parse(line.substring(6));
                                    var content = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
                                    if (content) {
                                        fullText += content;
                                        options.onChunk(content);
                                    }
                                } catch (e) { /* skip malformed chunks */ }
                            }
                        }
                        read();
                    }).catch(function (err) {
                        if (options.onError) options.onError('流式读取错误: ' + err.message);
                    });
                }
                read();
            }).catch(function (err) {
                if (options.onError) options.onError('网络错误: ' + err.message);
            });
        } else {
            // Non-streaming mode
            fetch(targetUrl, fetchOptions).then(function (response) {
                if (!response.ok) {
                    return response.text().then(function (text) {
                        throw new Error(friendlyErr(response.status, text));
                    });
                }
                return response.json();
            }).then(function (data) {
                incrementUsage();
                var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '';
                if (options.onDone) options.onDone(text);
            }).catch(function (err) {
                if (options.onError) options.onError(err.message);
            });
        }
    }

    // --- Key management ---
    function saveApiKey(provider, key) {
        if (!PROVIDERS[provider]) return false;
        sSet('ydzx_apikey_' + provider, obfuscate(key));
        sSet('ydzx_provider', provider);
        return true;
    }

    function getApiKey(provider) {
        var enc = sGet('ydzx_apikey_' + (provider || sGet('ydzx_provider') || 'deepseek'));
        return enc ? deobfuscate(enc) : '';
    }

    function clearApiKey(provider) {
        try { window.localStorage.removeItem('ydzx_apikey_' + provider); } catch (e) { /* */ }
    }

    function getProvider() {
        return sGet('ydzx_provider') || 'deepseek';
    }

    function setProvider(provider) {
        if (PROVIDERS[provider]) sSet('ydzx_provider', provider);
    }

    // --- Public API ---
    window.YdzxAI = {
        call: callAI,
        saveKey: saveApiKey,
        getKey: getApiKey,
        clearKey: clearApiKey,
        getProvider: getProvider,
        setProvider: setProvider,
        getUsageToday: getUsageToday,
        getRemainingCalls: getRemainingCalls,
        getUserTier: getUserTier,
        providers: PROVIDERS,
        LIMITS: LIMITS
    };

})();
