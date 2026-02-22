// Screenshot tool for dev-loop: captures game state via Puppeteer + SwiftShader
// Usage: node scripts/screenshot.cjs [output_path] [url]
const puppeteer = require('/home/seiya/.npm-global/lib/node_modules/puppeteer');

const outputPath = process.argv[2] || '/tmp/game-screenshot.png';
const url = process.argv[3] || 'https://office8-inc.github.io/city-builder/?autoplay';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 8000));
  
  const status = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return 'no canvas';
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return gl ? 'WebGL: ' + gl.getParameter(gl.RENDERER) : 'no webgl';
  });
  console.log(status);
  
  await page.screenshot({ path: outputPath });
  console.log('Saved:', outputPath);
  await browser.close();
})();
