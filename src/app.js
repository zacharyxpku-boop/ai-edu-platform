/* ===== 原点智学 — Main JS v2 ===== */
(function () {
    'use strict';

    /* --- Safe localStorage --- */
    function safeGet(key) {
        try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }
    function safeSet(key, value) {
        try { window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
    }

    /* --- Mobile nav --- */
    window.toggleMobileNav = function () {
        var nav = document.getElementById('mobile-nav');
        if (nav) nav.classList.toggle('active');
    };

    // Close mobile nav on outside click
    document.addEventListener('click', function (e) {
        var nav = document.getElementById('mobile-nav');
        var hamburger = document.querySelector('.hamburger');
        if (nav && nav.classList.contains('active') &&
            !nav.contains(e.target) && e.target !== hamburger) {
            nav.classList.remove('active');
        }
    });

    /* --- Navbar scroll effect --- */
    var navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', function () {
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
    }, { passive: true });

    /* --- Scroll reveal --- */
    var revealEls = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && revealEls.length) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
        revealEls.forEach(function (el) { observer.observe(el); });

        // Fallback: reveal all after 3s
        setTimeout(function () {
            revealEls.forEach(function (el) {
                if (!el.classList.contains('visible')) el.classList.add('visible');
            });
        }, 3000);
    } else {
        revealEls.forEach(function (el) { el.classList.add('visible'); });
    }

    /* --- Hero stagger entrance --- */
    var heroContent = document.querySelector('.hero-content');
    if (heroContent) {
        var children = heroContent.children;
        for (var i = 0; i < children.length; i++) {
            children[i].style.opacity = '0';
            children[i].style.transform = 'translateY(16px)';
            children[i].style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
            children[i].style.transitionDelay = (i * 0.1) + 's';
        }
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                for (var j = 0; j < children.length; j++) {
                    children[j].style.opacity = '1';
                    children[j].style.transform = 'translateY(0)';
                }
            });
        });
    }

    /* --- Subscribe form --- */
    function showFieldError(el, msg) {
        el.style.borderColor = '#C94040';
        var errId = el.id + '-err';
        var existing = document.getElementById(errId);
        if (existing) existing.textContent = msg;
        else {
            var span = document.createElement('span');
            span.id = errId;
            span.className = 'field-error';
            span.textContent = msg;
            el.parentNode.insertBefore(span, el.nextSibling);
        }
    }
    function clearFieldError(el) {
        el.style.borderColor = '';
        var errEl = document.getElementById(el.id + '-err');
        if (errEl) errEl.remove();
    }

    // Simple client-side rate limit: max 3 submissions per 10 minutes
    var _submitTimes = [];
    var RATE_LIMIT_MAX = 3;
    var RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 min

    window.handleSubscribe = function () {
        var name = document.getElementById('sub-name');
        var phone = document.getElementById('sub-phone');
        var btn = document.querySelector('.subscribe-form button');
        if (!name || !phone || !btn) return;
        if (btn.disabled) return; // prevent double submit

        // Rate limit check
        var now = Date.now();
        _submitTimes = _submitTimes.filter(function(t) { return now - t < RATE_LIMIT_WINDOW; });
        if (_submitTimes.length >= RATE_LIMIT_MAX) {
            showFieldError(phone, '提交过于频繁，请稍后再试');
            return;
        }

        var nameVal = name.value.trim();
        var phoneVal = phone.value.trim().replace(/\s+/g, '');

        clearFieldError(name);
        clearFieldError(phone);

        var valid = true;
        if (!nameVal) {
            showFieldError(name, '请输入您的姓名');
            if (valid) name.focus();
            valid = false;
        }
        if (!phoneVal || !/^1[3-9]\d{9}$/.test(phoneVal)) {
            showFieldError(phone, '请输入正确的11位手机号');
            if (valid) phone.focus();
            valid = false;
        }
        if (!valid) return;

        // Sanitize input — strip anything that isn't plain text
        function sanitize(str) {
            return String(str || '').replace(/[<>"'&\\`]/g, '').substring(0, 200);
        }

        // Additional name validation — no scripts/URLs
        if (/[<>{}()\\\/]|https?:|javascript:/i.test(nameVal)) {
            showFieldError(name, '姓名包含无效字符');
            name.focus();
            return;
        }

        // Capture context
        var params = new URLSearchParams(window.location.search);
        var leadData = {
            name: sanitize(nameVal),
            phone: phoneVal, // already validated by regex
            age: sanitize((document.getElementById('sub-age') || {}).value),
            time: new Date().toISOString(),
            page: sanitize(window.location.pathname),
            referrer: sanitize(document.referrer),
            utm_source: sanitize(params.get('utm_source')),
            utm_medium: sanitize(params.get('utm_medium')),
            utm_campaign: sanitize(params.get('utm_campaign'))
        };

        // Track submission for rate limiting
        _submitTimes.push(Date.now());

        // Loading state
        var origText = btn.textContent;
        btn.textContent = '提交中...';
        btn.disabled = true;

        // Webhook URL — obfuscated to slow down casual scraping.
        // NOTE: For real production, use a backend proxy (e.g. Cloudflare Worker / Vercel Edge Function)
        // so the webhook URL is never exposed to the client.
        var _wh = ['aHR0cHM6Ly9vcGVuLmZlaXNodS5jbi9vcGVuLWFwaXMvYm90L3Yy', 'L2hvb2svWU9VUl9XRUJIT09LX0lE'];
        var WEBHOOK_URL;
        try { WEBHOOK_URL = atob(_wh[0]) + atob(_wh[1]); } catch(e) { WEBHOOK_URL = ''; }

        var webhookPayload = {
            msg_type: 'text',
            content: {
                text: '新线索 — 原点智学官网\n姓名: ' + leadData.name + '\n手机: ' + leadData.phone + '\n孩子年龄: ' + (leadData.age || '未填') + '\n来源页: ' + leadData.page + '\nUTM: ' + (leadData.utm_source || '直接访问') + '\n时间: ' + leadData.time
            }
        };

        // Try sending to webhook; fall back gracefully
        fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
        }).catch(function () { /* webhook not configured yet, silent fail */ }).finally(function () {
            // Always save locally as backup
            var leads = [];
            try { leads = JSON.parse(safeGet('ydzx_leads') || '[]'); } catch (e) { leads = []; }
            leads.push(leadData);
            safeSet('ydzx_leads', JSON.stringify(leads));

            var convCount = parseInt(safeGet('ydzx_conversions') || '0', 10);
            safeSet('ydzx_conversions', String(convCount + 1));

            // Reset form
            name.value = '';
            phone.value = '';
            var age = document.getElementById('sub-age');
            if (age) age.value = '';

            // Success feedback
            btn.textContent = '已提交，我们会尽快联系您 ✓';
            btn.style.background = '#2D9F6F';
            setTimeout(function () {
                btn.textContent = origText;
                btn.style.background = '';
                btn.disabled = false;
            }, 5000);
        });
    };

    /* --- Smooth scroll for anchor links --- */
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            var href = this.getAttribute('href');
            if (href === '#') return;
            var target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    /* ===== 百度统计 (Baidu Tongji) ===== */
    // 替换 YOUR_BAIDU_ID 为真实的百度统计ID
    (function () {
        var hm = document.createElement('script');
        hm.src = 'https://hm.baidu.com/hm.js?YOUR_BAIDU_ID';
        hm.defer = true;
        var s = document.getElementsByTagName('script')[0];
        if (s && s.parentNode) s.parentNode.insertBefore(hm, s);
    })();

    /* ===== 事件追踪 ===== */
    window._trackEvent = function (category, action, label) {
        // 百度统计事件
        if (window._hmt) window._hmt.push(['_trackEvent', category, action, label || '']);
        // 控制台调试
        if (location.hostname === 'localhost') {
            console.log('[Track]', category, action, label || '');
        }
    };

    // CTA按钮点击追踪
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('button, .nav-cta, a.err-btn');
        if (!btn) return;
        var text = (btn.textContent || '').trim().substring(0, 30);
        var page = location.pathname.split('/').pop() || 'index';
        window._trackEvent('CTA', 'click', page + ':' + text);
    });

    /* ===== 分享组件 ===== */
    (function () {
        // 仅在有分享栏DOM时初始化
        var shareBar = document.getElementById('share-bar');
        if (!shareBar) return;

        var pageTitle = document.title.split('—')[0].trim();
        var pageUrl = location.href;
        var shareTexts = {
            default: pageTitle + ' — 让每个孩子站在更高的出发点',
            wechat: '推荐你看看「原点智学」，教孩子用AI做研究报告，不是搜答案。',
            xiaohongshu: '发现一个宝藏AI教育平台！不教孩子用AI抄答案，教他们用AI做研究报告、写演讲稿 学得快×考得高×思维好×有产出 #AI教育 #原点智学 #K12',
            copy: pageUrl
        };

        window.shareAction = function (type) {
            window._trackEvent('Share', type, location.pathname);

            if (type === 'copy') {
                navigator.clipboard.writeText(shareTexts.copy).then(function () {
                    showShareToast('链接已复制，发给朋友看看吧');
                }).catch(function () {
                    // fallback
                    var ta = document.createElement('textarea');
                    ta.value = shareTexts.copy;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    showShareToast('链接已复制');
                });
            } else if (type === 'wechat') {
                showShareToast('长按复制文案，发给微信好友');
                navigator.clipboard.writeText(shareTexts.wechat + '\n' + pageUrl).catch(function () { });
            } else if (type === 'xiaohongshu') {
                navigator.clipboard.writeText(shareTexts.xiaohongshu + '\n' + pageUrl).then(function () {
                    showShareToast('文案已复制，去小红书发帖吧');
                }).catch(function () { });
            } else if (type === 'weibo') {
                var weiboUrl = 'https://service.weibo.com/share/share.php?title=' +
                    encodeURIComponent(shareTexts.default) + '&url=' + encodeURIComponent(pageUrl);
                window.open(weiboUrl, '_blank', 'width=600,height=400');
            }
        };

        function showShareToast(msg) {
            var existing = document.querySelector('.share-toast');
            if (existing) existing.remove();
            var toast = document.createElement('div');
            toast.className = 'share-toast';
            toast.textContent = msg;
            document.body.appendChild(toast);
            requestAnimationFrame(function () {
                toast.classList.add('show');
            });
            setTimeout(function () {
                toast.classList.remove('show');
                setTimeout(function () { toast.remove(); }, 300);
            }, 2500);
        }
    })();

})();
