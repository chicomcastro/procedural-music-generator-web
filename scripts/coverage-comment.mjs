// Builds a Markdown summary of the latest vitest coverage report and writes
// it to GITHUB_OUTPUT so a sticky-pull-request-comment step can pick it up.
//
// Reads coverage/coverage-summary.json (produced by vitest --coverage with
// the json-summary reporter). Emits a small badge-style header + a per-file
// table so reviewers can see the largest gaps at a glance.
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SUMMARY_PATH = join(ROOT, 'coverage', 'coverage-summary.json');

if (!existsSync(SUMMARY_PATH)) {
  console.warn('No coverage-summary.json — nothing to post.');
  setOutput('body', '');
  process.exit(0);
}

const summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf8'));
const total = summary.total;
if (!total) {
  console.warn('Coverage summary has no "total" key.');
  setOutput('body', '');
  process.exit(0);
}

const pct = (m) => Number(m?.pct ?? 0).toFixed(2);
const emoji = (p) => (p >= 90 ? '✅' : p >= 75 ? '🟡' : p >= 50 ? '🟠' : '🔴');

// File-level rows: drop "total" and sort by lowest statements pct first.
const files = Object.entries(summary)
  .filter(([k]) => k !== 'total')
  .map(([file, m]) => ({
    file: file.replace(ROOT + '/', '').replace(/^.*\/src\//, 'src/'),
    statements: Number(m.statements?.pct ?? 0),
    branches: Number(m.branches?.pct ?? 0),
    functions: Number(m.functions?.pct ?? 0),
    lines: Number(m.lines?.pct ?? 0),
  }))
  .sort((a, b) => a.statements - b.statements);

const topGaps = files.slice(0, 10);

const body = [
  '## 🧪 Test Coverage',
  '',
  '| Metric | % |',
  '| --- | --- |',
  `| Statements ${emoji(total.statements.pct)} | **${pct(total.statements)}%** (${total.statements.covered}/${total.statements.total}) |`,
  `| Branches ${emoji(total.branches.pct)} | **${pct(total.branches)}%** (${total.branches.covered}/${total.branches.total}) |`,
  `| Functions ${emoji(total.functions.pct)} | **${pct(total.functions)}%** (${total.functions.covered}/${total.functions.total}) |`,
  `| Lines ${emoji(total.lines.pct)} | **${pct(total.lines)}%** (${total.lines.covered}/${total.lines.total}) |`,
  '',
  '<details><summary>Top 10 files with the lowest coverage</summary>',
  '',
  '| File | Statements | Branches | Functions | Lines |',
  '| --- | ---: | ---: | ---: | ---: |',
  ...topGaps.map(f => `| \`${f.file}\` | ${f.statements.toFixed(1)}% | ${f.branches.toFixed(1)}% | ${f.functions.toFixed(1)}% | ${f.lines.toFixed(1)}% |`),
  '',
  '</details>',
  '',
  `<sub>Target: ≥ 90% statements. The full HTML report is downloadable from the run artifacts as <code>coverage-html</code>.</sub>`,
].join('\n');

setOutput('body', body);

function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) {
    console.log(`${name}=\n${value}`);
    return;
  }
  // Multi-line outputs use the EOF heredoc form.
  const delimiter = `EOF_${Date.now()}`;
  appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}
