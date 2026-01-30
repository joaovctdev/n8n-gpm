const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ENDPOINT 1: Login rápido
app.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    await page.goto('https://mariua.gpm.srv.br/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    
    await page.type('input[type="text"]', usuario);
    await page.type('input[type="password"]', senha);
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('input[type="submit"]')
    ]);
    
    const cookies = await page.cookies();
    const cookieObj = {};
    cookies.forEach(c => { cookieObj[c.name] = c.value; });
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    await browser.close();
    
    res.json({
      success: true,
      authenticated: true,
      cookies: cookieObj,
      cookieString: cookieString,
      PHPSESSID: cookieObj.PHPSESSID,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    if (browser) await browser.close();
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: error.message });
  }
});

// ENDPOINT 2: Download completo
app.post('/download-fotos', async (req, res) => {
  const { usuario, senha, diasAtras = 5 } = req.body;
  
  let browser;
  try {
    console.log('[1/7] Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // LOGIN
    console.log('[2/7] Fazendo login...');
    await page.goto('https://mariua.gpm.srv.br/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    
    await page.type('input[type="text"]', usuario, { delay: 50 });
    await page.type('input[type="password"]', senha, { delay: 50 });
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('input[type="submit"]')
    ]);
    console.log('[2/7] ✓ Login OK');
    
    // NAVEGAR PARA CONSULTA FOTO
    console.log('[3/7] Acessando ConsultaFoto...');
    await page.goto('https://mariua.gpm.srv.br/ci/Servico/ConsultaFoto', { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(r => setTimeout(r, 3000));
    console.log('[3/7] ✓ Página carregada');
    
    // PREENCHER DATAS
    console.log('[4/7] Preenchendo formulário...');
    const hoje = new Date();
    const dataFim = `${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`;
    const inicioDate = new Date();
    inicioDate.setDate(hoje.getDate() - diasAtras);
    const dataInicio = `${String(inicioDate.getDate()).padStart(2,'0')}/${String(inicioDate.getMonth()+1).padStart(2,'0')}/${inicioDate.getFullYear()}`;
    
    console.log('  Período:', dataInicio, 'a', dataFim);
    
    // Preencher campos via JavaScript
    await page.evaluate((di, df) => {
      const inputs = document.querySelectorAll('input');
      inputs.forEach(inp => {
        const name = inp.name || inp.id || '';
        if (name.toLowerCase().includes('inicio') || name.toLowerCase().includes('start')) {
          inp.value = di;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (name.toLowerCase().includes('fim') || name.toLowerCase().includes('end')) {
          inp.value = df;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }, dataInicio, dataFim);
    
    await new Promise(r => setTimeout(r, 1000));
    console.log('[4/7] ✓ Datas preenchidas');
    
    // CLICAR PESQUISAR
    console.log('[5/7] Pesquisando...');
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, input[type="submit"]');
      for (const btn of buttons) {
        const text = (btn.textContent || btn.value || '').toLowerCase();
        if (text.includes('pesquisar') || text.includes('buscar')) {
          btn.click();
          break;
        }
      }
    });
    
    // Aguardar resultados
    await new Promise(r => setTimeout(r, 8000));
    console.log('[5/7] ✓ Resultados carregados');
    
    // SELECIONAR TODOS
    console.log('[6/7] Selecionando todos...');
    try {
      await page.waitForSelector('#selecionarCheckbox', { timeout: 15000 });
      await page.click('#selecionarCheckbox');
      await new Promise(r => setTimeout(r, 2000));
      console.log('[6/7] ✓ Todos selecionados');
    } catch (e) {
      console.log('[6/7] ! Botão não encontrado, tentando alternativa...');
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          if (btn.textContent.includes('Marcar') || btn.textContent.includes('Selecionar')) {
            btn.click();
            break;
          }
        }
      });
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // BAIXAR
    console.log('[7/7] Processando download...');
    try {
      await page.waitForSelector('#btn-baixar-marcados', { timeout: 10000 });
      await page.click('#btn-baixar-marcados');
    } catch (e) {
      // Executar função direta
      await page.evaluate(() => {
        if (typeof processarFotos === 'function') {
          processarFotos();
        }
      });
    }
    
    await new Promise(r => setTimeout(r, 10000));
    
    // EXTRAIR ZIP
    const content = await page.content();
    const zipMatch = content.match(/downloadZip\/([^'"<>\s]+\.zip)/i) || 
                     content.match(/([a-zA-Z0-9_\-]+\.zip)/i);
    
    if (!zipMatch) {
      console.error('HTML Preview:', content.substring(0, 1000));
      throw new Error('ZIP não encontrado após processar');
    }
    
    const zipFilename = zipMatch[1];
    const downloadUrl = `https://mariua.gpm.srv.br/ci/Servico/ConsultaFoto/downloadZip/${zipFilename}`;
    
    const cookies = await page.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    await browser.close();
    
    console.log('[7/7] ✅ Concluído! ZIP:', zipFilename);
    
    res.json({
      success: true,
      zipFilename,
      downloadUrl,
      cookieString,
      dataInicio,
      dataFim
    });
    
  } catch (error) {
    console.error('Erro:', error.message);
    if (browser) await browser.close();
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serviço na porta ${PORT}`);
});