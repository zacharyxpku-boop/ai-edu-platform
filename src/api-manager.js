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
            defaultModel: 'qwen-turbo',
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

        var providerKey = options.provider || sGet('ydzx_provider') || 'deepseek';
        var config = PROVIDERS[providerKey];
        if (!config) {
            if (options.onError) options.onError('不支持的AI服务: ' + providerKey);
            return;
        }

        // Get API key
        var apiKey = '';
        var encKey = sGet('ydzx_apikey_' + providerKey);
        if (encKey) {
            apiKey = deobfuscate(encKey);
        }
        // Fallback to platform key (free tier) — replace with actual key for production
        if (!apiKey) {
            // Platform shared key placeholder — you need to set this
            var platformKeys = sGet('ydzx_platform_keys');
            if (platformKeys) {
                try {
                    var keys = JSON.parse(platformKeys);
                    apiKey = keys[providerKey] || '';
                } catch (e) { /* */ }
            }
        }

        if (!apiKey) {
            if (options.onError) {
                options.onError('未设置API Key。请前往设置页面配置你的' + config.name + ' API Key。');
            }
            return;
        }

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

        var fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify(body)
        };

        if (options.onChunk) {
            // Streaming mode
            fetch(config.baseUrl, fetchOptions).then(function (response) {
                if (!response.ok) {
                    return response.text().then(function (text) {
                        throw new Error('API错误 (' + response.status + '): ' + text.substring(0, 200));
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
            fetch(config.baseUrl, fetchOptions).then(function (response) {
                if (!response.ok) {
                    return response.text().then(function (text) {
                        throw new Error('API错误 (' + response.status + '): ' + text.substring(0, 200));
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
