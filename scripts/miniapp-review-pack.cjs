#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8').trim();
}

function section(title, body) {
  console.log(`\n========== ${title} ==========\n`);
  console.log(body.trim());
}

const review = read('docs/MINIAPP-REVIEW-COPY-PASTE.md');
let appid = 'touristappid';
try {
  const privateConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'miniprogram/project.private.config.json'), 'utf8'));
  appid = privateConfig.appid || appid;
} catch (_) {
  try {
    const projectConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'miniprogram/project.config.json'), 'utf8'));
    appid = projectConfig.appid || appid;
  } catch (_) {}
}

section('先确认', [
  `当前 AppID: ${appid}`,
  appid === 'touristappid'
    ? 'AppID 仍是游客值。拿到真实 AppID 后运行：npm run miniapp:appid -- wx你的AppID'
    : 'AppID 已有本地配置。可以用微信开发者工具导入 miniprogram/。',
  'request 合法域名: https://yuandianzhixue.com',
  'uploadFile/downloadFile 合法域名: 首版不配置',
].join('\n'));

section('微信后台版本描述', [
  '本版本为家庭晚间作业场景的学习效率工具。用户可手动录入今晚作业、错题描述和卡住点，系统会先排今晚第一步，并提供 AI 辅助思路提示、轻回访和家长复盘。本版本不含支付、不含课程售卖、不含自动图片识别、不提供作业代写服务。'
].join('\n'));

section('微信后台测试说明', [
  '审核人员可直接进入小程序体验，无需开通额外服务。推荐路径：作业点拨 -> 输入今晚作业或卡住点 -> 先说自己的第一步 -> 修卡点完成一个小动作 -> 轻回访 -> 我的 -> 查看家长 5 秒复盘。',
  '',
  '测试输入：',
  '数学方程基础题 8 道',
  '应用题 4 道，写完整过程',
  '整理今天错题并说出错因',
  '英语单词抄写 3 遍'
].join('\n'));

section('隐私保护指引用途', [
  '用户主动填写的学习信息：用于生成今晚第一步安排、学习建议和轻回访记录。',
  '相册/摄像头：用于用户主动选择照片留档；图片不上传用于识别。',
  '手机号/联系方式：仅用于用户主动提交咨询后的服务回访和沟通。',
  '网络请求：用于连接原点智学服务端，生成 AI 辅助学习建议。'
].join('\n'));

section('完整复制材料', review);
