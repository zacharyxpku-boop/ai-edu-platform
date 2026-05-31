#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const pages = {
  homeJs: read('miniprogram/pages/home/home.js'),
  homeWxml: read('miniprogram/pages/home/home.wxml'),
  tutorWxml: read('miniprogram/pages/tutor/tutor.wxml'),
  uploadJs: read('miniprogram/pages/upload/upload.js'),
  uploadWxml: read('miniprogram/pages/upload/upload.wxml'),
  reviewWxml: read('miniprogram/pages/review/review.wxml'),
  arcadeWxml: read('miniprogram/pages/arcade/arcade.wxml'),
  profileWxml: read('miniprogram/pages/profile/profile.wxml'),
  homeViewModelJs: read('miniprogram/view-models/home-view-model.js'),
  reportJs: read('miniprogram/utils/learning-report.js'),
  reportRecognitionJs: read('miniprogram/utils/learning-report-recognition.js')
};

assert(pages.homeJs.includes('learningLoopCards'), 'Home defines the product capability map in code');
assert(pages.homeWxml.includes('yd-home-screen') && pages.homeWxml.includes('mini-entry-grid') && pages.homeWxml.includes('mini-route-card'), 'Home converges on the new reference shell and route');
assert(pages.homeWxml.includes('homeViewModel.primaryCta') && pages.homeWxml.includes('homeViewModel.nextStep'), 'Home keeps route actions through homeViewModel');
assert(pages.homeJs.includes('openEntryDetail') && !pages.homeJs.includes('/pages/daily-math/daily-math') && !pages.homeJs.includes('/pages/dictation/dictation'), 'Home uses active jump shell instead of retired lightweight routes');
assert(pages.homeViewModelJs.includes('buildPrimaryHomeNextAction') && pages.homeViewModelJs.includes("type: 'first_step'"), 'Home view model owns unified next-step priority');

assert(pages.tutorWxml.includes('yd-tutor-screen') && pages.tutorWxml.includes('tutor-entry-grid'), 'Tutor uses a clear new-shell entry structure');
assert(pages.uploadWxml.includes('yd-upload-screen') && pages.uploadWxml.includes('upload-material-card') && pages.uploadJs.includes('buildUploadIntakePacket'), 'Upload connects material intake to structured evidence through compact cards');
assert(pages.reviewWxml.includes('yd-review-screen') && !pages.reviewWxml.includes('reviewViewModel.blackboard.intro'), 'Review keeps repair evidence without rendering dense blackboard guidance');
assert(pages.arcadeWxml.includes('yd-review-redirect-screen') && pages.arcadeWxml.includes('ux-kit-jump-grid'), 'Arcade connects memory revisit to one compact loop');
assert(pages.arcadeWxml.includes('yd-review-redirect-screen') && pages.arcadeWxml.includes('data-scene="review"'), 'Arcade keeps migration practice and return-route context through jump cards');
assert(pages.profileWxml.includes('yd-parent-screen') && pages.profileWxml.includes('yd-parent-sources') && pages.profileWxml.includes('yd-parent-loop'), 'Profile closes the loop with parent evidence and next step');

assert(pages.reportJs.includes('talent') || pages.reportRecognitionJs.includes('talent'), 'Report layer preserves talent/material recognition capability');

const visibleWxml = [pages.homeWxml, pages.tutorWxml, pages.uploadWxml, pages.reviewWxml, pages.arcadeWxml, pages.profileWxml].join('\n');
[
  ['show','Leg','acyEntryContent'].join(''),
  ['page','positioning'].join('-'),
  ['rc','14-'].join(''),
  ['v','1-topbar'].join(''),
  ['composer','shell'].join('-'),
  ['family','summary-card'].join('-'),
  'PK',
  '排行榜',
  '免费体验',
  '课程售卖'
].forEach((term) => {
  assert(!visibleWxml.includes(term), `Product convergence avoids retired wording or UI marker: ${term}`);
});

console.log('All product convergence tests pass.');
