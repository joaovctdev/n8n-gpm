const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mariua-optimized' });
});

// ENDPOINT UNICO: Login
app.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;
  
  if (!usuario || !senha) {
    return res.status(400).json({ 
      success: false, 
      error: 'Campos usuario e senha obrigatórios' 
    });
  }
  
  let browser;
  try {
    console.log('[LOGIN] Iniciando...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--single-process'
      ],
      timeout: 60000
    });
    
    const page = await browser.newPage();
    
    // Configurar timeouts maiores
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });
    
    console.log('[LOGIN] Acessando site...');
    await page.goto('https://mariua.gpm.srv.br/', { 
      waitUntil: 'domcontentloaded',
      timeout: 25000
    });
    
    // Aguardar campos aparecerem
    await page.waitForSelector('input[type="text"], input[type="password"]', { timeout: 10000 });
    
    console.log('[LOGIN] Preenchendo credenciais...');
    
    // Preencher usuário
    const usuarioInput = await page.$('input[type="text"]');
    if (usuarioInput) {
      await usuarioInput.click();
      await usuarioInput.type(usuario, { delay: 50 });
    }
    
    // Preencher senha
    const senhaInput = await page.$('input[type="password"]');
    if (senhaInput) {
      await senhaInput.click();
      await senhaInput.type(senha, { delay: 50 });
    }
    
    console.log('[LOGIN] Fazendo login...');
    
    // Clicar no botão de submit
    await Promise.all([
      page.waitForNavigation({ 
        waitUntil: 'domcontentloaded',
        timeout: 25000
      }),
      page.click('input[type="submit"], button[type="submit"]')
    ]);
    
    // Aguardar página carregar
    await page.waitForTimeout(1000);
    
    const currentUrl = page.url();
    console.log('[LOGIN] URL após login:', currentUrl);
    
    // Verificar se login foi bem-sucedido
    const isLoginSuccess = !currentUrl.includes('index.php') || 
                          currentUrl.includes('/ci/') ||
                          currentUrl.includes('principal') ||
                          currentUrl.includes('home');
    
    if (!isLoginSuccess) {
      await browser.close();
      return res.json({
        success: false,
        error: 'LOGIN_FAILED',
        message: 'Credenciais incorretas ou erro no login'
      });
    }
    
    // Extrair cookies
    const cookies = await page.cookies();
    const cookieObj = {};
    cookies.forEach(cookie => {
      cookieObj[cookie.name] = cookie.value;
    });
    
    const cookieString = cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
    
    await browser.close();
    
    console.log('[LOGIN] ✅ Sucesso! PHPSESSID:', cookieObj.PHPSESSID);
    
    res.json({
      success: true,
      authenticated: true,
      cookies: cookieObj,
      cookieString: cookieString,
      PHPSESSID: cookieObj.PHPSESSID,
      homeUrl: currentUrl,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[LOGIN] ❌ Erro:', error.message);
    
    if (browser) {
      await browser.close();
    }
    
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serviço Mariua otimizado na porta ${PORT}`);
  console.log(`   POST /login - Login com Puppeteer otimizado`);
});