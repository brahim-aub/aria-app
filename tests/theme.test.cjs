const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/theme.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleData = { exports: {} };
vm.runInNewContext('(function(module,exports){' + compiled + '\n})')(moduleData, moduleData.exports);
const { colors, readableOn } = moduleData.exports;
function luminance(hex) {
  const c = hex.slice(1).match(/../g).map((n) => parseInt(n, 16) / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
function contrast(a, b) { const [hi, lo] = [luminance(a), luminance(b)].sort((a, b) => b - a); return (hi + 0.05) / (lo + 0.05); }
test('les textes et actions de la palette sombre gardent un contraste lisible', () => {
  for (const [fg, bg] of [[colors.text, colors.bg], [colors.text, colors.card], [colors.muted, colors.card], [colors.muted, colors.bg], [colors.onAccent, colors.accent], [colors.accentInk, colors.card], [colors.violet, colors.bg], [colors.danger, colors.bg]]) {
    assert.ok(contrast(fg, bg) >= 4.5, fg + ' sur ' + bg);
  }
});
test('le texte des boutons personnalisés reste lisible sur fond clair comme sombre', () => {
  for (const bg of ['#FFFFFF', '#000000', colors.accent, colors.violet, colors.card]) {
    assert.ok(contrast(readableOn(bg), bg) >= 4.5, bg);
  }
});
