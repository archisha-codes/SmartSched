import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`PAGE ERROR: ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    console.log(`PAGE EXCEPTION: ${error.message}`);
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  
  console.log('Filling login...');
  await page.click('text=Admin Login', { timeout: 2000 }).catch(e => {
    return page.click('button:has-text("Admin")').catch(() => {});
  });
  
  await page.click('button:has-text("Sign In")').catch(() => {});
  
  await page.waitForTimeout(2000);
  
  console.log('Clicking Manage Rooms...');
  await page.click('text="Manage Rooms"').catch(() => {});
  
  await page.waitForTimeout(3000);
  
  await browser.close();
})();
