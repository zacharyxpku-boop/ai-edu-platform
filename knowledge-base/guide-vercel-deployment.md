# 原点智学官网 · Vercel部署指南
> 5分钟把官网推上线

---

## 前置条件
- GitHub账号（代码已在 Desktop/claude/ai-edu-platform/）
- Vercel账号（https://vercel.com/ 免费注册，支持GitHub登录）
- 域名 yuandianzhixue.com（已有）

---

## Step 1: 推代码到GitHub

```bash
cd /c/Users/86136/Desktop/claude/ai-edu-platform

# 如果还没初始化git
git init
git add -A
git commit -m "原点智学官网 v1.0"

# 创建GitHub仓库（用gh CLI）
gh repo create yuandianzhixue-web --private --source=. --push
```

## Step 2: Vercel导入

1. 登录 https://vercel.com/
2. 点击「Add New Project」
3. 导入刚创建的GitHub仓库
4. Framework Preset: 选「Other」（这是纯静态站）
5. Build Command: 留空（不需要构建）
6. Output Directory: 留空（根目录就是）
7. 点击「Deploy」

## Step 3: 自定义域名

1. 部署成功后进入项目设置 → Domains
2. 添加 `www.yuandianzhixue.com`
3. 添加 `yuandianzhixue.com`（裸域名）
4. Vercel会给你DNS记录：
   - A记录: `76.76.21.21`
   - CNAME: `cname.vercel-dns.com`
5. 去域名注册商（阿里云/腾讯云）配置DNS
6. 等待生效（通常5分钟-2小时）

## Step 4: 上线后必做

- [ ] 访问 https://www.yuandianzhixue.com 确认能打开
- [ ] 检查所有页面链接
- [ ] 注册百度统计，替换 `YOUR_BAIDU_ID`
- [ ] 配置飞书Webhook真实ID
- [ ] 百度搜索资源平台提交sitemap.xml
- [ ] 提交Google Search Console（可选，面向海外）

## 注意事项
- vercel.json已配置（安全头+路由）
- 静态站无需额外配置
- 免费额度：100GB带宽/月（足够用）
- HTTPS自动启用
- CDN全球加速自动启用
