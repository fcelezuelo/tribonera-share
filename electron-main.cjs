const { app, BrowserWindow, ipcMain, desktopCapturer, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Configuração de linha de comando do Chromium para captura de tela e áudio
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');
app.commandLine.appendSwitch('allow-http-screen-capture');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-background-timer-throttling');

let autoUpdater = null;
try {
  const updaterModule = require('electron-updater');
  autoUpdater = updaterModule.autoUpdater;
} catch (e) {
  console.warn('[AutoUpdater] Módulo electron-updater não carregado no ambiente atual:', e.message);
}

// Configuração do Servidor Remoto ou Local
// Substitua pela sua URL do Render entre aspas simples ou duplas
const REMOTE_SERVER_URL = process.env.CONCORD_SERVER_URL || 'https://tribonera-share.onrender.com';
let serverPort = process.env.PORT || 3000;
let isEmbeddedServerRunning = false;

let mainWindow = null;
let selectedDesktopSourceId = null;

function copyDefaultDataFiles(userDataPath) {
  try {
    const files = ['codes.json', 'users.json', 'streams.json'];
    for (const f of files) {
      const targetPath = path.join(userDataPath, f);
      if (!fs.existsSync(targetPath)) {
        const sourcePath = path.join(__dirname, f);
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, targetPath);
        }
      }
    }
  } catch (err) {
    console.warn('[Concord] Aviso ao copiar dados padrão:', err.message);
  }
}

async function ensureServerRunning() {
  if (REMOTE_SERVER_URL) {
    return REMOTE_SERVER_URL;
  }

  const userDataPath = app.getPath('userData');
  process.env.CONCORD_DATA_DIR = userDataPath;
  process.env.PORT = String(serverPort);

  copyDefaultDataFiles(userDataPath);

  if (!isEmbeddedServerRunning) {
    try {
      const serverFilePath = path.join(__dirname, 'server.js');
      const serverUrl = pathToFileURL(serverFilePath).href;
      await import(serverUrl);
      isEmbeddedServerRunning = true;
      console.log(`[Concord] Servidor interno iniciado na porta ${serverPort}`);
    } catch (err) {
      console.error('[Concord] Erro ao iniciar servidor embutido:', err);
    }
  }

  // Pequeno delay para garantir que o express escutou na porta
  await new Promise(r => setTimeout(r, 800));

  return `http://localhost:${serverPort}`;
}

async function createWindow() {
  const targetURL = await ensureServerRunning();

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#1E1F22',
    icon: path.join(__dirname, 'public/img/concord_icon.png'),
    title: 'Concord',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      backgroundThrottling: false // Impede travamentos de FPS quando o Concord estiver em segundo plano
    }
  });

  // Remove o menu superior padrão do Windows para estilo limpo do Discord
  mainWindow.setMenuBarVisibility(false);

  // Permissões automáticas para WebRTC (Microfone, Captura de Tela, Display Media e Áudio Loopback)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return true;
  });

  // Tratador nativo de getDisplayMedia do Electron com suporte a loopback WASAPI de áudio do sistema
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 160, height: 90 },
        fetchWindowIcons: false
      });

      if (sources && sources.length > 0) {
        let chosenSource = null;
        if (selectedDesktopSourceId) {
          chosenSource = sources.find(s => s.id === selectedDesktopSourceId);
        }
        if (!chosenSource) {
          chosenSource = sources.find(s => s.id.startsWith('screen:')) || sources[0];
        }
        
        callback({
          video: chosenSource,
          audio: request.audioRequested ? 'loopback' : undefined
        });
      } else {
        callback(null);
      }
    } catch (err) {
      console.error('Erro no setDisplayMediaRequestHandler:', err);
      callback(null);
    }
  });

  // Carrega a URL do Concord
  mainWindow.loadURL(targetURL);

  // Teclas de atalho para recarregar (F5 ou Ctrl+R) e Inspecionar (F12 ou Ctrl+Shift+I)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
    if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') {
      mainWindow.reload();
    }
  });

  // Tratamento de queda de conexão / recarregamento automático
  mainWindow.webContents.on('did-fail-load', () => {
    console.log('Tentando reconectar ao Concord em 3 segundos...');
    setTimeout(() => {
      if (mainWindow) mainWindow.loadURL(targetURL);
    }, 3000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// -------------------------------------------------------------------
// 🔄 SISTEMA DE AUTO-UPDATE (Identifica mudanças e atualiza para todos)
// -------------------------------------------------------------------
function setupAutoUpdater() {
  if (!autoUpdater) {
    console.log('[AutoUpdater] autoUpdater não disponível neste build.');
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Verificando se há novas versões...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Nova versão encontrada:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('updater-message', {
        status: 'available',
        version: info.version
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] Aplicativo está na versão mais recente.');
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Download da atualização concluído.');
    if (mainWindow) {
      mainWindow.webContents.send('updater-message', {
        status: 'downloaded',
        version: info.version
      });
    }

    dialog.showMessageBox({
      type: 'info',
      title: 'Concord - Atualização Pronta',
      message: `Uma nova versão (${info.version}) foi baixada!`,
      detail: 'O Concord será reiniciado para aplicar as melhorias.',
      buttons: ['Reiniciar Agora', 'Depois']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Erro ao atualizar:', err);
  });

  // Checa por atualizações a cada 15 minutos
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }, 15 * 60 * 1000);
}

// -------------------------------------------------------------------
// IPC Handlers: Seleção visual de telas, Status de Versão e Atualização
// -------------------------------------------------------------------
ipcMain.handle('select-desktop-source', (_event, sourceId) => {
  selectedDesktopSourceId = sourceId;
  console.log('[Concord] Fonte de captura selecionada pelo usuário:', sourceId);
  return true;
});

ipcMain.handle('get-desktop-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true
    });
    return sources.map(src => ({
      id: src.id,
      name: src.name,
      thumbnail: src.thumbnail.toDataURL(),
      appIcon: src.appIcon ? src.appIcon.toDataURL() : null
    }));
  } catch (err) {
    console.error('Erro ao listar sources do desktop:', err);
    return [];
  }
});

ipcMain.handle('get-app-info', () => {
  return {
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    platform: process.platform,
    remoteServerUrl: REMOTE_SERVER_URL
  };
});

ipcMain.handle('reload-app', () => {
  if (mainWindow) {
    console.log('[Concord] Recarregando aplicação (ignoring cache)...');
    mainWindow.webContents.reloadIgnoringCache();
    return true;
  }
  return false;
});

ipcMain.handle('quit-and-install', () => {
  if (autoUpdater) {
    autoUpdater.quitAndInstall();
    return true;
  }
  return false;
});

ipcMain.handle('check-for-updates', async () => {
  if (!autoUpdater) {
    return {
      success: false,
      isElectron: true,
      message: 'Modo de desenvolvimento ou auto-updater não empacotado.'
    };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      success: true,
      updateInfo: result ? result.updateInfo : null
    };
  } catch (err) {
    console.error('[Concord] Erro ao checar atualizações:', err);
    return {
      success: false,
      error: err.message
    };
  }
});

// Inicialização da Aplicação
app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

  // Checa atualização no início
  setTimeout(() => {
    if (autoUpdater) {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }
  }, 3000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
