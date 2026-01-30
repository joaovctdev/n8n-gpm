// mariua-login-service.js
// Serviço de login usando Puppeteer
// Para instalar: npm install express puppeteer

const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Endpoint de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mariua-login' });
});

// Endpoint de login
app.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;
  
  if (!usuario || !senha) {
    return res.status(400).json({ 
      success: false, 
      error: 'Campos usuario e senha são obrigatórios' 
    });
  }
  
  let browser;
  try {
    console.log('🚀 Iniciando navegador...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Simular navegador real
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('📄 Acessando página de login...');
    await page.goto('https://mariua.gpm.srv.br/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Aguardar página carregar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('🔍 Buscando campos do formulário...');
    
    // Tentar múltiplos seletores para usuário
    const usuarioSelectors = [
      'input[name="usuario"]',
      'input[id="usuario"]',
      'input[type="text"]',
      'input.usuario',
      '#usuario',
      'input[placeholder*="usu" i]',
      'input[placeholder*="login" i]'
    ];
    
    let usuarioInput = null;
    for (const selector of usuarioSelectors) {
      try {
        usuarioInput = await page.$(selector);
        if (usuarioInput) {
          console.log('✓ Campo usuário encontrado:', selector);
          break;
        }
      } catch (e) {}
    }
    
    if (!usuarioInput) {
      // Listar todos os inputs da página
      const allInputs = await page.$$eval('input', inputs => 
        inputs.map(input => ({
          name: input.name,
          id: input.id,
          type: input.type,
          placeholder: input.placeholder,
          class: input.className
        }))
      );
      
      console.log('📋 Todos os inputs encontrados:', JSON.stringify(allInputs, null, 2));
      throw new Error('Campo de usuário não encontrado. Inputs disponíveis: ' + JSON.stringify(allInputs));
    }
    
    // Tentar múltiplos seletores para senha
    const senhaSelectors = [
      'input[name="senha"]',
      'input[id="senha"]',
      'input[type="password"]',
      'input.senha',
      '#senha',
      'input[placeholder*="senha" i]',
      'input[placeholder*="password" i]'
    ];
    
    let senhaInput = null;
    for (const selector of senhaSelectors) {
      try {
        senhaInput = await page.$(selector);
        if (senhaInput) {
          console.log('✓ Campo senha encontrado:', selector);
          break;
        }
      } catch (e) {}
    }
    
    if (!senhaInput) {
      throw new Error('Campo de senha não encontrado');
    }
    
    console.log('✍️ Preenchendo credenciais...');
    await usuarioInput.type(usuario, { delay: 100 });
    await senhaInput.type(senha, { delay: 100 });
    
    console.log('🔐 Fazendo login...');
    
    // Capturar a requisição de login para pegar o PHPSESSID
    let loginUrl = '';
    page.on('request', request => {
      const url = request.url();
      if (url.includes('login.php')) {
        loginUrl = url;
        console.log('🔗 URL de login:', url);
      }
    });
    
    // Clicar no botão de login
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('input[type="submit"], button[type="submit"]')
    ]);
    
    const currentUrl = page.url();
    console.log('📍 URL após login:', currentUrl);
    
    // Verificar se login foi bem-sucedido
    const isLoginSuccess = currentUrl.includes('/ci/Geral/Home') || 
                          currentUrl.includes('principal') ||
                          !currentUrl.includes('index.php');
    
    if (!isLoginSuccess) {
      // Verificar se há mensagem de erro
      const errorElement = await page.$('.error, .alert-danger, .erro');
      let errorMessage = '';
      if (errorElement) {
        errorMessage = await page.evaluate(el => el.textContent, errorElement);
      }
      
      await browser.close();
      return res.json({
        success: false,
        error: 'LOGIN_FAILED',
        message: errorMessage || 'Credenciais incorretas ou erro no login',
        currentUrl
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
    
    console.log('✅ Login bem-sucedido!');
    console.log('🍪 Cookies:', Object.keys(cookieObj));
    
    await browser.close();
    
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
    console.error('❌ Erro:', error.message);
    
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
  console.log(`🚀 Serviço de login rodando na porta ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Login endpoint: POST http://localhost:${PORT}/login`);
});