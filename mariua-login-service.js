// mariua-download-service-v2.js
// Serviço COMPLETO de download de fotos Mariua
// Com os botões e URLs corretos identificados
// npm install express puppeteer

const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mariua-download-v2' });
});

// Endpoint que faz login e download completo
app.post('/download-fotos', async (req, res) => {
  const { usuario, senha, dataInicio, dataFim, diasAtras } = req.body;
  
  if (!usuario || !senha) {
    return res.status(400).json({ 
      success: false, 
      error: 'Campos usuario e senha são obrigatórios' 
    });
  }
  
  let browser;
  try {
    console.log('🚀 Iniciando navegador Puppeteer...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security'
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // ==================== PASSO 1: LOGIN ====================
    console.log('🔐 PASSO 1: Fazendo login...');
    await page.goto('https://mariua.gpm.srv.br/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await page.waitForSelector('input[name="usuario"], input[type="text"]', { timeout: 10000 });
    
    // Limpar e preencher campos
    await page.evaluate(() => {
      const usuario = document.querySelector('input[name="usuario"]') || document.querySelector('input[type="text"]');
      const senha = document.querySelector('input[name="senha"]') || document.querySelector('input[type="password"]');
      if (usuario) usuario.value = '';
      if (senha) senha.value = '';
    });
    
    await page.type('input[name="usuario"], input[type="text"]', usuario, { delay: 50 });
    await page.type('input[name="senha"], input[type="password"]', senha, { delay: 50 });
    
    console.log('   → Credenciais preenchidas');
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('input[type="submit"], button[type="submit"]')
    ]);
    
    const loginUrl = page.url();
    console.log('   ✅ Login OK:', loginUrl);
    
    // Verificar se login foi bem-sucedido
    if (loginUrl.includes('index.php') && !loginUrl.includes('Home')) {
      throw new Error('Login falhou - credenciais incorretas');
    }
    
    // ==================== PASSO 2: ACESSAR CONSULTA FOTO ====================
    console.log('📸 PASSO 2: Acessando Consulta Foto...');
    await page.goto('https://mariua.gpm.srv.br/ci/Servico/ConsultaFoto', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('   ✅ Página de consulta carregada');
    
    // ==================== PASSO 3: PREENCHER DATAS ====================
    console.log('📅 PASSO 3: Preenchendo datas...');
    
    // Calcular datas
    const hoje = new Date();
    const dataInicial = new Date();
    
    if (diasAtras) {
      dataInicial.setDate(hoje.getDate() - diasAtras);
    } else {
      dataInicial.setDate(hoje.getDate() - 5); // padrão 5 dias
    }
    
    const formatDate = (d) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };
    
    const dataIni = dataInicio || formatDate(dataInicial);
    const dataFi = dataFim || formatDate(hoje);
    
    console.log(`   → Período: ${dataIni} até ${dataFi}`);
    
    // Preencher campos de data
    await page.evaluate((inicio, fim) => {
      const inputInicio = document.querySelector('input[name="data_geracao_inicio"]') ||
                         document.querySelector('#data_geracao_inicio');
      const inputFim = document.querySelector('input[name="data_geracao_fim"]') ||
                      document.querySelector('#data_geracao_fim');
      
      if (inputInicio) {
        inputInicio.value = inicio;
        console.log('Data início preenchida:', inicio);
      }
      if (inputFim) {
        inputFim.value = fim;
        console.log('Data fim preenchida:', fim);
      }
    }, dataIni, dataFi);
    
    await page.waitForTimeout(500);
    
    // ==================== PASSO 4: PESQUISAR ====================
    console.log('🔍 PASSO 4: Executando pesquisa...');
    
    // Procurar botão de pesquisar
    const pesquisarBtn = await page.evaluateHandle(() => {
      // Tentar múltiplos seletores
      let btn = document.querySelector('button[type="submit"]') ||
                document.querySelector('input[value*="Pesquisar"]') ||
                document.querySelector('button:contains("Pesquisar")') ||
                Array.from(document.querySelectorAll('button')).find(b => 
                  b.textContent.includes('Pesquisar') || b.textContent.includes('PESQUISAR')
                );
      return btn;
    });
    
    if (pesquisarBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
        pesquisarBtn.click()
      ]);
    } else {
      // Submeter formulário
      await page.evaluate(() => {
        const form = document.querySelector('form');
        if (form) form.submit();
      });
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    }
    
    console.log('   ✅ Pesquisa executada');
    console.log('   → URL atual:', page.url());
    
    await page.waitForTimeout(2000);
    
    // ==================== PASSO 5: SELECIONAR TODOS ====================
    console.log('☑️ PASSO 5: Selecionando todos os registros...');
    
    // Usar o ID correto do botão
    const selecionarTodosBtn = await page.$('#selecionarCheckbox');
    
    if (selecionarTodosBtn) {
      await selecionarTodosBtn.click();
      console.log('   ✅ Botão "Marcar/Desmarcar" clicado');
      await page.waitForTimeout(1000);
    } else {
      console.log('   ⚠️ Botão #selecionarCheckbox não encontrado, tentando alternativas...');
      
      // Tentar clicar manualmente em todos os checkboxes
      await page.evaluate(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        console.log(`   → Encontrados ${checkboxes.length} checkboxes`);
        checkboxes.forEach(cb => cb.checked = true);
      });
      
      console.log('   ✅ Checkboxes marcados manualmente');
    }
    
    await page.waitForTimeout(1000);
    
    // ==================== PASSO 6: BAIXAR ZIP ====================
    console.log('📦 PASSO 6: Localizando botão de download...');
    
    let downloadUrl = '';
    let zipFilename = '';
    
    // Interceptar requisições de download
    page.on('request', request => {
      const url = request.url();
      if (url.includes('downloadZip') || url.includes('.zip')) {
        downloadUrl = url;
        const match = url.match(/downloadZip\/([^\/\?]+)/);
        if (match) {
          zipFilename = match[1];
          console.log('   📥 ZIP detectado na requisição:', zipFilename);
        }
      }
    });
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('downloadZip') || url.includes('.zip')) {
        downloadUrl = url;
        const match = url.match(/downloadZip\/([^\/\?]+)/);
        if (match) {
          zipFilename = match[1];
          console.log('   📥 ZIP detectado na resposta:', zipFilename);
        }
      }
    });
    
    // Procurar botão de download
    const downloadBtn = await page.evaluateHandle(() => {
      // Procurar por múltiplos seletores
      let btn = document.querySelector('button:contains("Download")') ||
                document.querySelector('a:contains("Download")') ||
                document.querySelector('button[onclick*="downloadZip"]') ||
                document.querySelector('a[href*="downloadZip"]') ||
                Array.from(document.querySelectorAll('button, a')).find(el => 
                  el.textContent.includes('Download') || 
                  el.textContent.includes('Baixar') ||
                  el.textContent.includes('ZIP')
                );
      return btn;
    });
    
    if (downloadBtn && (await downloadBtn.asElement())) {
      console.log('   → Botão de download encontrado');
      await downloadBtn.click();
      console.log('   ✅ Botão de download clicado');
      await page.waitForTimeout(3000);
    } else {
      console.log('   ⚠️ Botão de download não encontrado, tentando submeter formulário...');
      
      // Tentar submeter o form ou procurar pelo link direto no HTML
      const htmlContent = await page.content();
      const zipMatch = htmlContent.match(/downloadZip\/([a-zA-Z0-9_\-]+\.zip)/i);
      
      if (zipMatch) {
        zipFilename = zipMatch[1];
        downloadUrl = `https://mariua.gpm.srv.br/ci/Servico/ConsultaFoto/downloadZip/${zipFilename}`;
        console.log('   ✅ ZIP encontrado no HTML:', zipFilename);
      }
    }
    
    // Se ainda não encontrou, tentar método POST direto
    if (!zipFilename) {
      console.log('   → Tentando método POST direto...');
      
      const cookies = await page.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      
      // Fazer POST para pesquisar
      const postResponse = await page.evaluate(async (cookieStr, dataIni, dataFi) => {
        const response = await fetch('https://mariua.gpm.srv.br/ci/Servico/ConsultaFoto/pesquisar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookieStr
          },
          body: `data_geracao_inicio=${dataIni}&data_geracao_fim=${dataFi}`
        });
        return await response.text();
      }, cookieString, dataIni, dataFi);
      
      const zipMatch = postResponse.match(/downloadZip\/([a-zA-Z0-9_\-]+\.zip)/i);
      if (zipMatch) {
        zipFilename = zipMatch[1];
        downloadUrl = `https://mariua.gpm.srv.br/ci/Servico/ConsultaFoto/downloadZip/${zipFilename}`;
        console.log('   ✅ ZIP encontrado via POST:', zipFilename);
      }
    }
    
    // ==================== PASSO 7: EXTRAIR COOKIES ====================
    console.log('🍪 PASSO 7: Extraindo cookies para download...');
    
    const cookies = await page.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const PHPSESSID = cookies.find(c => c.name === 'PHPSESSID')?.value;
    
    console.log('   ✅ Cookies extraídos');
    console.log('   → PHPSESSID:', PHPSESSID);
    
    await browser.close();
    
    // ==================== RESULTADO FINAL ====================
    if (!zipFilename) {
      console.log('❌ FALHA: ZIP não encontrado');
      return res.json({
        success: false,
        error: 'ZIP_NOT_FOUND',
        message: 'Não foi possível localizar o arquivo ZIP. Verifique se há fotos no período selecionado.',
        periodo: { inicio: dataIni, fim: dataFi }
      });
    }
    
    console.log('\n✅ PROCESSO CONCLUÍDO COM SUCESSO!');
    console.log('═══════════════════════════════════════');
    console.log('📦 Arquivo ZIP:', zipFilename);
    console.log('🔗 URL Download:', downloadUrl);
    console.log('📅 Período:', `${dataIni} até ${dataFi}`);
    console.log('═══════════════════════════════════════\n');
    
    res.json({
      success: true,
      zipFilename: zipFilename,
      downloadUrl: downloadUrl,
      cookieString: cookieString,
      PHPSESSID: PHPSESSID,
      periodo: {
        inicio: dataIni,
        fim: dataFi
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error(error.stack);
    
    if (browser) {
      await browser.close();
    }
    
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message,
      stack: error.stack
    });
  }
});

app.listen(PORT, () => {
  console.log('\n🚀 ════════════════════════════════════════');
  console.log('   MARIUA DOWNLOAD SERVICE V2');
  console.log('   ════════════════════════════════════════');
  console.log(`   🌐 Porta: ${PORT}`);
  console.log(`   ✅ Health: http://localhost:${PORT}/health`);
  console.log(`   📥 Download: POST http://localhost:${PORT}/download-fotos`);
  console.log('   ════════════════════════════════════════\n');
});