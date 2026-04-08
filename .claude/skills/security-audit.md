# Security Audit Skill

## When to trigger
- After any code edit to HTML/JS files
- When user asks about security
- Before deployment

## Checklist (scan ALL .html and .js files)

### 1. XSS Prevention
- [ ] All user inputs sanitized before DOM insertion (use textContent, never innerHTML with user data)
- [ ] No `eval()`, `new Function()`, `document.write()` with user-controlled data
- [ ] Form values stripped of `<>{}()\/` and script-like patterns before processing
- [ ] URL parameters (utm_source etc.) sanitized before use

### 2. Injection Prevention
- [ ] No user input directly concatenated into URLs, API payloads, or markdown
- [ ] All string interpolation uses sanitize() wrapper
- [ ] Phone numbers validated by strict regex `/^1[3-9]\d{9}$/`
- [ ] Name fields reject `<script>`, `javascript:`, HTML tags

### 3. API/Webhook Security
- [ ] Webhook URLs not in plaintext (at minimum base64 obfuscated)
- [ ] RECOMMENDATION: Use backend proxy (Cloudflare Worker / Vercel Edge) for production
- [ ] Rate limiting on form submissions (max 3 per 10 min client-side)
- [ ] No API keys or secrets in frontend code

### 4. Content Security Policy
- [ ] CSP meta tag present in all pages
- [ ] `script-src` restricts to 'self' (and 'unsafe-inline' only if needed)
- [ ] `frame-ancestors 'none'` prevents clickjacking
- [ ] `connect-src` whitelist only necessary domains

### 5. Headers & Meta
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `referrer-policy: strict-origin-when-cross-origin`
- [ ] NOTE: For static hosting, use meta tags. For server hosting, set HTTP headers.

### 6. External Resources
- [ ] Google Fonts loaded via `<link>` not `@import` (non-blocking)
- [ ] Consider SRI (Subresource Integrity) for CDN resources when available
- [ ] No third-party scripts loaded without review

### 7. Data Storage
- [ ] localStorage data is non-sensitive (no passwords, tokens, PII beyond leads)
- [ ] Lead data in localStorage is temporary backup, not primary storage
- [ ] No sensitive data in URL parameters

### 8. Form Security
- [ ] Client-side rate limiting active
- [ ] Double-submit prevention (button disabled during request)
- [ ] Input length limits (sanitize truncates at 200 chars)
- [ ] Phone input uses `inputmode="tel"` and `autocomplete="tel"`

## How to run
```bash
# Scan for common vulnerabilities
grep -rn "innerHTML\|eval(\|document.write\|new Function" src/ *.html
grep -rn "YOUR_WEBHOOK\|YOUR_API_KEY\|password\|secret" src/ *.html
grep -rn "http://" src/ *.html  # check for non-HTTPS
```

## Severity levels
- P0 CRITICAL: XSS, exposed secrets, no input validation
- P1 HIGH: Missing CSP, no rate limiting, plaintext webhook
- P2 MEDIUM: Missing SRI, no referrer policy
- P3 LOW: Non-blocking font loading, minor meta tags
