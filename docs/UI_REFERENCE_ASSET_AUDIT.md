# 原点智学 UI 参考资产审计

## 资产来源

外部参考库：`C:\Users\86136\Desktop\小程序`

可直接参考的文件：

- `assets/img/home-desktop.png`
- `assets/img/upload-desktop.png`
- `assets/img/report-desktop.png`
- `assets/img/tutor-desktop.png`
- `assets/img/review-desktop.png`
- `assets/img/parent-desktop.png`
- `assets/img/map-desktop.png`
- `assets/img/mobile-home.png`
- `assets/img/mobile-report.png`
- `assets/img/miniapp-home.png`
- `index.html`
- `upload.html`
- `report.html`
- `tutor.html`
- `review.html`
- `parent.html`
- `map.html`
- `mobile-home.html`
- `mobile-report.html`
- `miniapp-home.html`

需要忽略的文件夹：

- `_chrome-profile*`
- `_screenshots` 只作为历史验收截图，不作为最终设计规范

## 已接入项目的资产

当前已同步到：

- `miniprogram/assets/reference/`
- `apps/web/assets/reference/`

已接入资产：

- `brand-house.png`
- `entry-upload.png`
- `entry-report.png`
- `entry-tutor.png`
- `entry-review.png`
- `entry-parent.png`
- `entry-map.png`
- `gudian-sticker.png`
- `hero-mascot.png`

## 当前使用结论

可以直接用：

- 六个入口插画：上传、报告、私教、复习、家长、地图
- 品牌房子图标
- 首页、侧栏、入口卡片、右侧进度栏的布局参考
- `assets/img/*.png` 作为每次 Web / 小程序视觉回归的高保真参考图

可以参考但不直接复用代码：

- 外部 HTML 原型的页面结构、比例、文案层级
- `assets/styles.css` 的色彩和卡片节奏

必须自己实现：

- 小程序 WXML/WXSS 的真实跳转、tabBar、页面状态
- Web App 的 hash 路由、搜索、按钮动作、报告下载/打印
- 上传、报告、私教、复习、家长、地图的产品闭环逻辑

## 还缺的 Image2 资产

为了更接近参考图并避免“贴图感”，建议补以下透明背景 PNG：

1. `gudian-fullbody-transparent.png`
   - 透明背景，全身或 3/4 身，绿色连帽咕点，挥手，适合首页欢迎卡和侧栏。
2. `gudian-parent-helper-transparent.png`
   - 透明背景，家长提醒场景，妈妈/爸爸拿纸张，风格和咕点一致。
3. `report-radar-card-illustration.png`
   - 透明背景或浅底，雷达图 + 文件夹 + 放大镜，可用于报告预览。
4. `review-world-map-transparent.png`
   - 透明背景，复习闯关地图、旗帜、星星、路径节点。
5. `upload-folder-stack-transparent.png`
   - 透明背景，多资料文件夹、云上传、试卷/错题元素。
6. `family-avatar-group-transparent.png`
   - 透明背景，家庭头像组合，用于顶部家庭入口和家长中心。

统一要求：

- PNG，透明背景优先
- 1024x1024 或 1200x900
- 奶白、清新绿色、明亮黄色、天空蓝、珊瑚橙
- 儿童教育产品风格，温暖但不要幼稚
- 不要 logo，不要文字，不要英文
- 同一角色、同一光影、同一材质
