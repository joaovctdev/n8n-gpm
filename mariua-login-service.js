// mariua-service-COMPLETO.js
// Tem AMBOS os endpoints: /login e /download-fotos

const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mariua-complete' });
});

// ENDPOINT 1: Apenas Login (rápido)
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
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    await page.goto('https://mariua.gpm.srv.br/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const usuarioInput = await page.$('input[type="text"]');
    const senhaInput = await page.$('input[type="password"]');
    
    if (!usuarioInput || !senhaInput) {
      throw new Error('Campos de login não encontrados');
    }
    
    await usuarioInput.type(usuario, { delay: 100 });
    await senhaInput.type(senha, { delay: 100 });
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('input[type="submit"], button[type="submit"]')
    ]);
    
    const cookies = await page.cookies();
    const cookieObj = {};
    cookies.forEach(c => { cookieObj[c.name] = c.value; });
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    await browser.close();
    
    console.log('[LOGIN] Sucesso!');
    
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
    console.error('[LOGIN] Erro:', error.message);
    if (browser) await browser.close();
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: error.message });
  }
});

// ENDPOINT 2: Download Completo (login + busca + download)
app.post('/download-fotos', async (req, res) => {
  const { usuario, senha, diasAtras = 5 } = req.body;
  
  if (!usuario || !senha) {
    return res.status(400).json({ 
      success: false, 
      error: 'Campos usuario e senha obrigatórios' 
    });
  }
  
  let browser;
  try {
    console.log('[DOWNLOAD] Iniciando processo completo...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 1. LOGIN
    console.log('[DOWNLOAD] 1/6 - Login...');
    await page.goto('https://mariua.gpm.srv.br/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    
    const usuarioInput = await page.$('input[type="text"]');
    const senhaInput = await page.$('input[type="password"]');
    
    await usuarioInput.type(usuario, { delay: 100 });
    await senhaInput.type(senha, { delay: 100 });
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('input[type="submit"]')
    ]);
    
    console.log('[DOWNLOAD] ✓ Login OK');
    
    // 2. IR PARA CONSULTA FOTO
    console.log('[DOWNLOAD] 2/6 - Acessando ConsultaFoto...');
    await page.goto('https://mariua.gpm.srv.br/ci/Servico/ConsultaFoto', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    console.log('[DOWNLOAD] ✓ Página carregada');
    
    // 3. PREENCHER DATAS
    console.log('[DOWNLOAD] 3/6 - Preenchendo datas...');
    const hoje = new Date();
    const dataFim = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
    const inicioDate = new Date();
    inicioDate.setDate(hoje.getDate() - diasAtras);
    const dataInicio = `${String(inicioDate.getDate()).padStart(2, '0')}/${String(inicioDate.getMonth() + 1).padStart(2, '0')}/${inicioDate.getFullYear()}`;
    
    console.log('[DOWNLOAD]   De:', dataInicio, 'Até:', dataFim);
    
    await page.evaluate((di, df) => {
      const inputs = document.querySelectorAll('input[type="text"], input[type="date"]');
      inputs.forEach(input => {
        if (input.name && input.name.includes('inicio')) {
          input.value = di;
        }
        if (input.name && input.name.includes('fim')) {
          input.value = df;
        }
      });
    }, dataInicio, dataFim);
    
    // 4. PESQUISAR
    console.log('[DOWNLOAD] 4/6 - Pesquisando...');
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button, input[type="submit"]');
      for (const btn of btns) {
        if (btn.textContent.includes('Pesquisar') || btn.value === 'Pesquisar') {
          btn.click();
          break;
        }
      }
    });
    
    await new Promise(r => setTimeout(r, 5000));
    console.log('[DOWNLOAD] ✓ Pesquisa realizada');
    
    // 5. SELECIONAR TODOS
    console.log('[DOWNLOAD] 5/6 - Selecionando todos...');
    await page.click('#selecionarCheckbox');
    await new Promise(r => setTimeout(r, 2000));
    console.log('[DOWNLOAD] ✓ Todos selecionados');
    
    // 6. BAIXAR MARCADOS
    console.log('[DOWNLOAD] 6/6 - Processando download...');
    await page.evaluate(() => {
      if (typeof processarFotos === 'function') {
        processarFotos();
      }
    });
    
    await new Promise(r => setTimeout(r, 5000));
    
    // 7. EXTRAIR LINK DO ZIP
    const content = await page.content();
    const zipMatch = content.match(/downloadZip\/([^'"<>\s]+\.zip)/i) || content.match(/([a-zA-Z0-9_\-]+\.zip)/i);
    
    if (!zipMatch) {
      throw new Error('Link do ZIP não encontrado');
    }
    
    const zipFilename = zipMatch[1];
    const downloadUrl = `https://mariua.gpm.srv.br/ci/Servico/ConsultaFoto/downloadZip/${zipFilename}`;
    
    const cookies = await page.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    await browser.close();
    
    console.log('[DOWNLOAD] ✅ Concluído! ZIP:', zipFilename);
    
    res.json({
      success: true,
      zipFilename: zipFilename,
      downloadUrl: downloadUrl,
      cookieString: cookieString,
      dataInicio: dataInicio,
      dataFim: dataFim
    });
    
  } catch (error) {
    console.error('[DOWNLOAD] Erro:', error.message);
    if (browser) await browser.close();
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serviço rodando na porta ${PORT}`);
  console.log(`   /login - Login rápido`);
  console.log(`   /download-fotos - Download completo`);
});