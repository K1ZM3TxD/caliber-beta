import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/calibration', { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

// Check 1: CALIBER text present
const caliberText = await page.locator('span.font-semibold').textContent();
console.log('CALIBER text:', JSON.stringify(caliberText));

// Check 2: Blinking cursor present
const cursorEl = await page.locator('.cb-blink-cursor').count();
console.log('Blinking cursor elements:', cursorEl);

// Check 3: Tagline text
const taglineEl = await page.locator('p').first();
const taglineText = await taglineEl.textContent();
const taglineStyle = await taglineEl.getAttribute('style');
console.log('Tagline text:', JSON.stringify(taglineText));
console.log('Tagline style:', taglineStyle);

// Check 4: Full-bleed gradient overlay (fixed positioning)
const gradientDiv = await page.locator('.fixed.top-0.left-0.right-0.pointer-events-none');
const gradientCount = await gradientDiv.count();
console.log('Full-bleed gradient overlay:', gradientCount > 0 ? 'PRESENT' : 'MISSING');

// Check 5: No px-6 pt-10 gutters — check the min-h-screen wrapper
const wrapper = await page.locator('.min-h-screen');
const wrapperClasses = await wrapper.getAttribute('class');
console.log('Wrapper classes:', wrapperClasses);
const hasPt10 = wrapperClasses?.includes('pt-10');
console.log('Has pt-10 gutter:', hasPt10 ? 'YES (BUG)' : 'NO (GOOD)');

// Check 6: scrollbar-gutter
const sgValue = await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter);
console.log('scrollbar-gutter:', sgValue);

// Check 7: overflow-x
const oxValue = await page.evaluate(() => getComputedStyle(document.documentElement).overflowX);
console.log('overflow-x:', oxValue);

console.log('\n--- VERIFICATION SUMMARY ---');
const checks = [
  ['CALIBER typed', caliberText?.includes('CALIBER') || caliberText?.includes('Caliber')],
  ['Blinking cursor', cursorEl > 0],
  ['Tagline is Career Decision Engine', taglineText?.includes('Career Decision Engine')],
  ['Tagline has wide tracking (0.08em)', taglineStyle?.includes('0.08em')],
  ['Full-bleed gradient', gradientCount > 0],
  ['No pt-10 gutter', !hasPt10],
  ['scrollbar-gutter auto', sgValue === 'auto'],
  ['overflow-x hidden', oxValue === 'hidden'],
];
for (const [name, pass] of checks) {
  console.log(`  ${pass ? '✓' : '✗'} ${name}`);
}
const allPass = checks.every(c => c[1]);
console.log(allPass ? '\nALL CHECKS PASSED ✓' : '\nSOME CHECKS FAILED ✗');

await browser.close();
process.exit(allPass ? 0 : 1);
