import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/calibration', { waitUntil: 'networkidle' });
// Wait for typewriter to finish (CALIBER at 200ms * 7 chars + tagline)
await page.waitForTimeout(4000);
await page.screenshot({ path: '/workspaces/caliber-beta/screenshot_verify.png', fullPage: false });
console.log('Screenshot saved to /workspaces/caliber-beta/screenshot_verify.png');
await browser.close();
