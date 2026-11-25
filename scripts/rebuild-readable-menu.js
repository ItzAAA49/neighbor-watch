#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2] || 'neighbor-watch';
const packagePath = path.join(root, 'package.json');
const indexPath = path.join(root, 'public', 'index.html');
const cssPath = path.join(root, 'public', 'css', 'style.css');
const lockPath = path.join(root, 'package-lock.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function buildMenu() {
  const packageData = readJson(packagePath);
  if (packageData.version === '1.4.0') {
    console.log('Menu already updated: v1.4.0');
    return;
  }
  if (packageData.version !== '1.3.0') {
    throw new Error('Expected source package v1.3.0; found ' + packageData.version);
  }

  let html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes('class="home-aside"')) {
    const titleStart = html.indexOf('    <section class="title-block">');
    const titleClose = html.indexOf('    </section>', titleStart);
    const authStart = html.indexOf('    <section class="auth-panel panel">');
    const authClose = html.indexOf('    </section>', authStart);

    if (titleStart < 0 || titleClose < 0 || authStart < 0 || authClose < 0) {
      throw new Error('Could not locate the title and account panels safely');
    }

    const titleEnd = titleClose + '    </section>'.length;
    const authEnd = authClose + '    </section>'.length;
    if (authStart < titleEnd) {
      throw new Error('Unexpected menu panel order; refusing to rewrite markup');
    }

    const titleBlock = html.slice(titleStart, titleEnd);
    const authBlock = html.slice(authStart, authEnd);
    html = html.slice(0, titleStart)
      + '    <div class="home-aside">\n'
      + titleBlock + '\n'
      + authBlock + '\n'
      + '    </div>\n'
      + html.slice(titleEnd, authStart)
      + html.slice(authEnd);
  }

  const modeGrid = '      <div class="mode-grid">';
  if (!html.includes('class="menu-section-heading"')) {
    if (!html.includes(modeGrid)) {
      throw new Error('The existing mode grid was not found');
    }
    const heading = [
      '      <div class="menu-section-heading">',
      '        <span>SELECT YOUR SHIFT</span>',
      '        <b>勤務モードを選ぶ</b>',
      '        <small>プレイスタイルに合わせて勤務を選択してください。</small>',
      '      </div>',
      modeGrid
    ].join('\n');
    html = html.replace(modeGrid, heading);
  }
  fs.writeFileSync(indexPath, html);

  const menuCss = [
    '',
    '/* Main menu readability pass — version 1.4.0 */',
    '.home-shell{width:100%;max-width:1200px;grid-template-columns:minmax(265px,.78fr) minmax(510px,1.32fr);gap:28px clamp(26px,3vw,40px);align-items:stretch;margin:34px auto 46px}',
    '.home-aside{min-width:0;display:flex;flex-direction:column;gap:20px}',
    '.title-block{min-height:0;flex:1 1 auto;display:flex;flex-direction:column;align-items:flex-start;padding:34px 5px 22px}',
    '.classified{max-width:36ch;font-size:10px;line-height:1.9}',
    '.game-title{font-size:clamp(66px,7.4vw,98px);line-height:.9;margin:30px 0 18px}',
    '.title-sub{margin:0 0 26px;font-size:14px;letter-spacing:.1em;line-height:1.7}',
    '.stamp{width:108px;height:108px;margin:auto 0 0 16px}',
    '.home-panel{min-width:0;padding:0 25px 23px;border-width:2px}',
    '.home-panel>.panel-top{margin:0 -25px;padding:14px 19px;font-size:10px}',
    '.intro{font-size:13px;line-height:1.95;padding:16px 2px 18px;color:#4b4030}',
    '.menu-section-heading{display:grid;gap:4px;margin:15px 0 11px}',
    '.menu-section-heading span{color:#78684d;font:9px var(--mono);letter-spacing:.18em}',
    '.menu-section-heading b{color:#2d281f;font:20px var(--type);letter-spacing:.04em}',
    '.menu-section-heading small{color:#62563f;font-size:11px;line-height:1.6}',
    '.mode-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}',
    '.mode-card{min-width:0;min-height:94px;padding:16px 14px 14px 57px;border:1px solid #98886b;border-radius:3px;background:linear-gradient(145deg,#eee6d2,#d7cbb0);color:#29241d;box-shadow:0 2px 0 rgba(56,45,30,.12);text-align:left;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease,filter .16s ease}',
    '.mode-card:hover:not(:disabled){transform:translateY(-2px);border-color:#5c4d37;box-shadow:0 5px 11px rgba(43,34,23,.16);filter:brightness(1.025)}',
    '.mode-card:focus-visible,.button:focus-visible,.home-links a:focus-visible,.auth-panel input:focus-visible{outline:3px solid #6c8053;outline-offset:3px}',
    '.mode-card.primary{grid-column:1/-1;min-height:96px;border:2px solid #8b7650;background:linear-gradient(115deg,#d6c49d,#c8b68e 65%,#e0d2b5);box-shadow:inset 0 0 0 2px rgba(255,250,230,.35),0 3px 0 rgba(56,45,30,.13)}',
    '.mode-card b{font-size:15px;line-height:1.45;color:#28231c}',
    '.mode-card.primary b{font-size:18px}',
    '.mode-card small{margin-top:5px;color:#514733;font-size:11px;line-height:1.55}',
    '.mode-no{position:absolute;left:14px;top:50%;width:30px;height:30px;display:grid;place-items:center;transform:translateY(-50%);border:1px solid #918064;border-radius:50%;background:#f2ead7;color:#51452f;font-size:10px}',
    '.mode-card i{margin-top:5px;color:#8a3b32;font-size:10px;line-height:1.4}',
    '.continue-row{display:grid;grid-template-columns:minmax(170px,.78fr) minmax(0,1fr);align-items:center;gap:8px 15px;margin-top:18px;padding:14px 15px;border:1px solid #9b8967;border-radius:3px;background:linear-gradient(135deg,#d4c7a7,#c9ba96)}',
    '.continue-row .button{min-height:48px;font-size:12px}',
    '.continue-row span{color:#493f2e;font-size:11px;line-height:1.7}',
    '.home-links{flex-wrap:wrap;gap:9px;margin-top:16px;padding-top:13px}',
    '.home-links a{min-height:40px;display:inline-flex;align-items:center;padding:8px 12px;border:1px solid #b7a887;border-radius:2px;background:#f0e8d5;color:#403725;font-size:11px;line-height:1.5}',
    '.home-links a:hover{border-color:#6e5c3e;background:#f7f0df;text-decoration:none}',
    '.auth-panel{width:100%;min-width:0;grid-column:auto;padding:0 16px 15px}',
    '.auth-panel .panel-top{margin:0 -16px;padding:11px 14px}',
    '.auth-panel .small-note{font-size:10px;line-height:1.8;color:#554a37}',
    '.auth-fields{grid-template-columns:1fr;gap:9px}',
    '.auth-fields input{min-height:43px;font-size:12px}',
    '.auth-actions{flex-wrap:wrap;gap:8px;margin-top:12px}',
    '.auth-actions .button{min-height:41px;font-size:10px}',
    '.status-line{font-size:10px;line-height:1.7}',
    '.home-footer{align-items:flex-start;line-height:1.8}',
    '.content-warning{line-height:1.8;padding:0 8px}',
    '@media(max-width:980px){.home-shell{max-width:820px;grid-template-columns:minmax(0,1fr);grid-template-areas:"title" "menu" "auth" "footer" "warning";gap:15px;margin:22px auto 34px;align-items:start}.home-aside{display:contents}.title-block{grid-area:title;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 100px;align-items:center;padding:20px 8px 10px}.classified{grid-column:1/-1}.game-title{grid-column:1;font-size:clamp(52px,9vw,78px);margin:17px 0 9px}.title-sub{grid-column:1;margin:5px 0 9px;font-size:12px}.stamp{grid-column:2;grid-row:2/span 2;position:static;width:88px;height:88px;margin:0;font-size:9px}.stamp b{font-size:15px}.home-panel{grid-area:menu}.auth-panel{grid-area:auth}.home-footer{grid-area:footer}.content-warning{grid-area:warning}}',
    '@media(max-width:760px){.home-shell{max-width:700px;padding:0 15px;margin:17px auto 28px;gap:13px}.site-header{height:62px;padding:0 16px}.site-header nav{gap:13px;font-size:10px}.title-block{padding:17px 5px 8px}.game-title{font-size:clamp(48px,10.5vw,70px)}.mode-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.mode-card{min-height:88px;padding:13px 9px 12px 48px}.mode-card.primary{min-height:88px}.mode-no{left:10px;width:27px;height:27px}.mode-card b{font-size:13px}.mode-card.primary b{font-size:16px}.mode-card small{font-size:10px}.continue-row{grid-template-columns:1fr;gap:8px}.continue-row .button{width:100%}.home-footer{flex-direction:column;gap:6px}.auth-fields{grid-template-columns:1fr}}',
    '@media(max-width:440px){.home-panel{padding:0 15px 17px}.home-panel>.panel-top{margin:0 -15px;padding:11px 12px;font-size:9px}.intro{font-size:12px;line-height:1.85}.mode-grid{grid-template-columns:minmax(0,1fr)}.mode-card,.mode-card.primary{grid-column:1;min-height:75px;padding-left:54px}.mode-card b{font-size:14px}.mode-card small{font-size:10px}.continue-row{padding:11px}}',
    '@media(prefers-reduced-motion:reduce){.mode-card,.button,.home-links a{transition:none}}',
    ''
  ].join('\n');

  const oldCss = fs.readFileSync(cssPath, 'utf8');
  if (!oldCss.includes('Main menu readability pass — version 1.4.0')) {
    fs.writeFileSync(cssPath, oldCss + menuCss);
  }

  packageData.version = '1.4.0';
  writeJson(packagePath, packageData);

  const lock = readJson(lockPath);
  lock.version = '1.4.0';
  if (lock.packages && lock.packages['']) lock.packages[''].version = '1.4.0';
  writeJson(lockPath, lock);

  const finalHtml = fs.readFileSync(indexPath, 'utf8');
  const finalCss = fs.readFileSync(cssPath, 'utf8');
  if (!finalHtml.includes('class="home-aside"') ||
      !finalHtml.includes('class="menu-section-heading"') ||
      !finalCss.includes('Main menu readability — version 1.4.0')) {
    throw new Error('Menu readability pass did not complete');
  }

  console.log('Readable main menu built successfully: v1.4.0');
}

try {
  buildMenu();
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
}
