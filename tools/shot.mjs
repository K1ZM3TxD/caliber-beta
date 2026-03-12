import puppeteer from "puppeteer";
const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
await page.goto("http://localhost:3000/calibration", { waitUntil: "networkidle0", timeout: 15000 });
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: "/workspaces/caliber-beta/hero_surface_screenshot.png", fullPage: false });
await browser.close();
console.log("Done");
