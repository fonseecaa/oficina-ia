#!/usr/bin/env node
'use strict';
/**
 * Applies Oficina IA customizations on top of a fresh Munder Difflin checkout.
 * Run from the root of the upstream checkout:
 *   OIA_REPO=owner/repo OIA_RUN=12 node ../oia/custom/apply.cjs
 *
 * Customizations are done with targeted text replacements (they survive upstream
 * changes better than line-based patches) plus two optional layers:
 *   custom/overrides/**   files copied over the upstream tree (icons, whole files)
 *   custom/patches/*.patch applied with `git apply --3way`
 */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const APP = process.cwd();
const CUSTOM = __dirname;
const REPO = process.env.OIA_REPO || 'owner/oficina-ia';
const RUN = parseInt(process.env.OIA_RUN || '0', 10);
const [OWNER, REPO_NAME] = REPO.split('/');
const PRODUCT = process.env.OIA_PRODUCT || 'Oficina IA';
const APP_ID = process.env.OIA_APPID || 'com.oficinaia.app';

let warnings = 0;
function edit(file, fn, { required = true } = {}) {
  const p = path.join(APP, file);
  if (!fs.existsSync(p)) {
    if (required) { console.warn(`WARN missing file: ${file}`); warnings++; }
    return;
  }
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after === before) { console.warn(`WARN no change applied to ${file}`); warnings++; }
  fs.writeFileSync(p, after);
  console.log(`edited ${file}`);
}

// 1) version + product name (separate data folder from the official app)
const pkgPath = path.join(APP, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const upstreamVersion = pkg.version;
const [M, m, p] = upstreamVersion.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
pkg.version = `${M}.${m}.${p * 1000 + RUN}`; // always increases: new upstream or new build
pkg.productName = PRODUCT;
pkg.description = `${PRODUCT} (based on Munder Difflin ${upstreamVersion}, MIT)`;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`version ${upstreamVersion} -> ${pkg.version}`);

// 2) updates come from OUR GitHub releases, not the official ones
const repoConst = (s) => s.replace(/const REPO = '[^']+';/, `const REPO = '${REPO}';`);
edit('src/main/updater.ts', repoConst);
edit('src/shared/updateState.ts', repoConst);

// 3) packaging config
// Windows checkouts use CRLF line endings; normalize so the regexes below match.
let y = fs.readFileSync(path.join(APP, 'electron-builder.yml'), 'utf8').replace(/\r\n/g, '\n');
const y0 = y;
y = y.replace(/^appId: .*$/m, `appId: ${APP_ID}`);
y = y.replace(/^productName: .*$/m, `productName: ${PRODUCT}`);
y = y.replace(/^publish:\n(?: {2}.*\n)+/m,
  `publish:\n  provider: github\n  owner: ${OWNER}\n  repo: ${REPO_NAME}\n  releaseType: release\n`);
y = y.replace(/ {4}- target: portable\n {6}arch: \[x64\]\n/, '');
y = y.replace(/^npmRebuild: true$/m, 'npmRebuild: false'); // native modules come prebuilt
y = y.replace(/artifactName: Munder-Difflin-\$\{version\}-win-x64-setup\.exe/, 'artifactName: Oficina-IA-${version}-win-x64-setup.exe');
y = y.replace(/shortcutName: .*/, `shortcutName: ${PRODUCT}`);
if (y === y0) { console.warn('WARN electron-builder.yml unchanged'); warnings++; }
fs.writeFileSync(path.join(APP, 'oficina-builder.yml'), y);
console.log('wrote oficina-builder.yml');

// 3b) branding: our icon (drawn by brand.cjs, or custom/logo.png etc. if you add your own) + our name
require('./brand.cjs')(APP);
for (const [src, dst] of [['logo.png', 'docs/logo.png'], ['icon.png', 'build/icon.png'], ['icon.ico', 'build/icon.ico']]) {
  const s = path.join(CUSTOM, src);
  if (fs.existsSync(s)) fs.copyFileSync(s, path.join(APP, dst));
}
console.log('brand icons written');
let renamed = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { walk(f); continue; }
    if (!/\.(ts|tsx|json|html)$/.test(e.name)) continue;
    const before = fs.readFileSync(f, 'utf8');
    const after = before.split('Munder Difflin').join(PRODUCT).split('MUNDER DIFFLIN').join(PRODUCT.toUpperCase());
    if (after !== before) { fs.writeFileSync(f, after); renamed++; }
  }
})(path.join(APP, 'src'));
console.log(`renamed brand in ${renamed} files`);
if (!renamed) { console.warn('WARN brand name not found in src'); warnings++; }

// 4) release notes shown in the in-app update toast
const notes = path.join(CUSTOM, 'release-notes.md');
if (fs.existsSync(notes)) {
  fs.mkdirSync(path.join(APP, 'build'), { recursive: true });
  fs.copyFileSync(notes, path.join(APP, 'build', 'release-notes.md'));
}

// 5) whole-file overrides
function copyTree(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyTree(s, d); }
    else if (e.name !== '.gitkeep') { fs.copyFileSync(s, d); console.log(`override ${path.relative(APP, d)}`); }
  }
}
const ov = path.join(CUSTOM, 'overrides');
if (fs.existsSync(ov)) copyTree(ov, APP);

// 6) patches
const pd = path.join(CUSTOM, 'patches');
if (fs.existsSync(pd)) {
  for (const f of fs.readdirSync(pd).filter((f) => f.endsWith('.patch')).sort()) {
    execSync(`git apply --3way --whitespace=nowarn "${path.join(pd, f)}"`, { cwd: APP, stdio: 'inherit' });
    console.log(`patched ${f}`);
  }
}

console.log(warnings ? `done with ${warnings} warning(s)` : 'done');
