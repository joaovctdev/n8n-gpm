# Mariua Login Service

Serviço de login automatizado usando Puppeteer para contornar bloqueios anti-bot.

## 🚀 Como Usar

### Opção 1: Rodar Localmente

```bash
# Instalar dependências
npm install

# Rodar o serviço
npm start
```

O serviço vai rodar em `http://localhost:3000`

### Opção 2: Docker

```bash
# Build
docker build -t mariua-login-service .

# Run
docker run -p 3000:3000 mariua-login-service
```

### Opção 3: Deploy na Nuvem

Recomendado: **Railway.app**, **Render.com** ou **Fly.io** (todos têm plano gratuito)

#### Railway.app (Mais Fácil)
1. Criar conta em https://railway.app
2. "New Project" → "Deploy from GitHub repo"
3. Conectar este repositório
4. Railway detecta automaticamente o Dockerfile
5. Deploy automático! ✅

## 📡 API

### POST /login

Fazer login e retornar cookies de sessão.

**Request:**
```json
{
  "usuario": "JOAO.ALMEIDA",
  "senha": "mariua@2025"
}
```

**Response (Sucesso):**
```json
{
  "success": true,
  "authenticated": true,
  "cookies": {
    "PHPSESSID": "...",
    "AWSALB": "...",
    "AWSALBCORS": "..."
  },
  "cookieString": "PHPSESSID=...; AWSALB=...; AWSALBCORS=...",
  "PHPSESSID": "...",
  "homeUrl": "https://mariua.gpm.srv.br/ci/Geral/Home",
  "timestamp": "2026-01-30T01:52:00.000Z"
}
```

**Response (Erro):**
```json
{
  "success": false,
  "error": "LOGIN_FAILED",
  "message": "Credenciais incorretas"
}
```

## 🔧 Integração com N8N

1. Deploy do serviço (Railway, Render, etc)
2. No N8N, usar node "HTTP Request":

```
Method: POST
URL: https://seu-servico.railway.app/login
Body:
{
  "usuario": "{{$json.usuario}}",
  "senha": "{{$json.senha}}"
}
```

3. Extrair cookies da resposta:
```javascript
const response = $input.item.json;
if (response.success) {
  return {
    cookieString: response.cookieString,
    PHPSESSID: response.PHPSESSID
  };
}
```

## ⚙️ Variáveis de Ambiente

- `PORT`: Porta do serviço (padrão: 3000)

## 📝 Notas

- O serviço usa Puppeteer em modo headless
- Simula navegador Chrome real
- Contorna bloqueios anti-bot
- Retorna cookies válidos por ~3 horas