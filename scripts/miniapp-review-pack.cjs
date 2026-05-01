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
  '本版本为家庭学习效率工具。用户可手动录入测评成绩、错题描述和作业清单，系统生成能力雷达与作业优先级分类，并提供 AI 辅助的思路引导。本版本不含支付、不含课程售卖、不含自动图片识别、不提供作业代写服务。'
].join('\n'));

section('微信后台测试说明', [
  '审核人员可直接进入小程序体验，无需付费。推荐路径：今日 -> 录入今晚作业 -> 生成家长雷达 -> 点击“必须做”任务 -> 进入原小点执行端。',
  '',
  '测试输入：',
  '数学方程基础题 8 道',
  '应用题 4 道，写完整过程',
  '整理今天错题并说出错因',
  '英语单词抄写 3 遍'
].join('\n'));

section('隐私保护指引用途', [
  '用户主动填写的学习信息：用于生成学习建议、能力雷达和作业优先级分类。',
  '相册/摄像头：用于用户主动选择照片留档；图片不上传用于识别。',
  '手机号/联系方式：仅用于用户主动提交咨询后的内测回访和服务沟通。',
  '网络请求：用于连接原点智学服务端，生成 AI 辅助学习建议。'
].join('\n'));

section('完整复制材料', review);
