// Smoke test: open every page in a real browser and fail on what a visitor
// would hit: uncaught JavaScript errors and missing files from this site.
// Runs in .github/workflows/check.yml after every push to main.
//
//   python3 -m http.server 8099 &   then   node tools/smoke.mjs http://127.0.0.1:8099
//
// Ignored on purpose: /api/* (only the local dev proxy in serve.py has it)
// and requests to other hosts such as ESI, whose outages are not our bug.
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://127.0.0.1:8099').replace(/\/$/, '');
const PAGES = ['/', '/warzones/', '/map/', '/history/', '/lp/', '/leaderboards/', '/campaigns/', '/faq/', '/legal/'];
const own = new URL(base).host;
const problems = [];

const browser = await chromium.launch();
for (const path of PAGES) {
  for (const scheme of ['dark', 'light']) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme })).newPage();
    page.on('pageerror', (e) => problems.push(`${path} [${scheme}] JS error: ${e.message}`));
    page.on('response', (r) => {
      const u = new URL(r.url());
      if (u.host === own && r.status() >= 400 && !u.pathname.startsWith('/api/'))
        problems.push(`${path} [${scheme}] ${r.status()} ${u.pathname}`);
    });
    const res = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
    if (!res || res.status() !== 200) problems.push(`${path} [${scheme}] page answered ${res && res.status()}`);
    await page.waitForTimeout(1500);
    await page.close();
  }
  console.log(`checked ${path}`);
}
await browser.close();

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log(`${PAGES.length} pages x 2 colour schemes: no errors`);
