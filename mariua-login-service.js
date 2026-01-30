const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;
  
  if (!usuario || !senha) {
    return res.status(400).json({ success: false, error: 'Campos obrigatórios' });
  }
  
  let browser;
  try {
    console.log('Iniciando browser...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    console.log('Acessando site...');
    await page.goto('https://mariua.gpm.srv.br/', { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    
    console.log('Preenchendo...');
    await page.type('input[type="text"]', usuario);
    await page.type('input[type="password"]', senha);
    
    console.log('Enviando...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('input[type="submit"]')
    ]);
    
    const cookies = await page.cookies();
    const cookieObj = {};
    cookies.forEach(c => { cookieObj[c.name] = c.value; });
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    await browser.close();
    
    console.log('✅ Login OK');
    
    res.json({
      success: true,
      authenticated: true,
      cookies: cookieObj,
      cookieString: cookieString,
      PHPSESSID: cookieObj.PHPSESSID,
      homeUrl: page.url(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erro:', error.message);
    if (browser) await browser.close();
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: error.message });
  }
});

app.listen(PORT, () => console.log(`Porta ${PORT}`));