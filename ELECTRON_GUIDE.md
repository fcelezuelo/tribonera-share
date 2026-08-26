# 🚀 Concord Desktop (Electron) & Sistema de Auto-Atualização

Este documento explica como você pode gerar o instalador executável (`.exe` para Windows, `.dmg` para Mac ou `.AppImage` para Linux) do **Concord** com **captura de som do sistema estéreo sem perdas** e **atualizações automáticas silenciosas** para todos os seus usuários.

---

## 🎧 Por que o Electron resolve 100% do Som?
No Electron, o arquivo `electron-main.cjs` utiliza o handler nativo:
```javascript
session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
  callback({
    video: sources[0],
    audio: 'loopback' // Captura o som de qualquer janela/jogo diretamente pelo WASAPI do Windows
  });
});
```
Isso ignora as limitações de navegadores web comuns e envia o áudio estéreo real do sistema operacional diretamente pelo WebRTC.

---

## ⚙️ 1. Como rodar o aplicativo Desktop em modo de desenvolvimento local
No terminal do seu computador (onde o projeto estiver baixado):

```bash
# 1. Instalar dependências (incluindo Electron e electron-builder)
npm install --save-dev electron electron-builder electron-updater

# 2. Iniciar o Concord em modo aplicativo Desktop
npm run electron
```

---

## 📦 2. Como gerar o Instalador Executável (`.exe`) para enviar aos seus amigos

Para gerar o instalador `.exe`:
```bash
npm run dist:win
```
O executável será gerado na pasta:
📁 `dist-electron/Concord Setup 1.0.0.exe`

---

## 🔄 3. Como funciona a Auto-Atualização para Todos os Usuários

Configuramos o **`electron-updater`** integrado ao **GitHub Releases**:

1. No `package.json`, substitua `SEU_USUARIO_GITHUB` e `SEU_REPOSITORIO` pelo seu repositório:
```json
"publish": [
  {
    "provider": "github",
    "owner": "seu-usuario",
    "repo": "concord"
  }
]
```

2. Quando você fizer melhorias ou alterações no código, basta aumentar a versão no `package.json` (ex: de `1.0.0` para `1.0.1`) e executar no terminal com seu token do GitHub configurado:
```bash
# Windows PowerShell
$env:GH_TOKEN="seu_github_personal_token"
npm run publish
```

3. **O que acontece automaticamente para os usuários:**
- Toda vez que alguém abrir o aplicativo Concord no computador (ou a cada 15 minutos de uso), o app detecta a nova versão silenciosamente no GitHub.
- Ele faz o download do patch em segundo plano.
- Assim que o download termina, um aviso amigável pergunta: *"Nova versão pronta. Deseja reiniciar agora?"*.
- Ao reiniciar, o app aplica a atualização automaticamente sem precisar baixar instaladores manuais.

---

## 🌐 4. Como Manter o Servidor Central Conectado

Por padrão, o app Electron consome o servidor web remoto. No `electron-main.cjs`:
```javascript
const SERVER_URL = process.env.CONCORD_SERVER_URL || 'https://seu-servidor-no-render.onrender.com';
```
Basta colocar a URL do seu servidor hospedado (ex: Render.com ou Cloud Run). Assim, todos os usuários do app desktop entram na mesma sala e compartilham tela entre si em tempo real!
