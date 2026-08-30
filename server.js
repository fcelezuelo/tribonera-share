import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { db, hashPassword, verifyPassword } from './lib/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 30000,
  pingInterval: 10000
});

const PORT = process.env.PORT && process.env.PORT !== '8080' ? Number(process.env.PORT) : 3000;
const ADMIN_CODE = process.env.ADMIN_CODE || 'FELLMASTER123';
const ADMIN_INITIAL_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const DATA_DIR = process.env.CONCORD_DATA_DIR || __dirname;
const STREAMS_FILE = path.join(DATA_DIR, 'streams.json');

// --- Helper Functions ---
function readJSON(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      writeJSON(filePath, defaultValue);
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data || JSON.stringify(defaultValue));
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

function writeJSON(filePath, data) {
  try {
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Initial setup
await db.init(ADMIN_CODE, ADMIN_INITIAL_PASSWORD);
writeJSON(STREAMS_FILE, { activeStreams: [] });

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to authenticate request
async function authenticateRequest(req) {
  let token = req.cookies?.tribonera_token;
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.replace(/^[Bb]earer\s+/i, '').trim();
  }
  if (!token && req.query?.token) {
    token = req.query.token;
  }
  
  if (!token) return null;
  const user = await db.findUserByToken(token);
  if (!user && (token === 'admin-token-fellmaster123-perm' || token === ADMIN_CODE)) {
    const admin = await db.findUserByIdentifier(ADMIN_CODE);
    return admin || null;
  }
  return user || null;
}

// Routes

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.get("/api/version", async (req, res) => {
  const pkg = readJSON(path.join(__dirname, 'package.json'), { version: '1.0.6' });
  const currentVersion = pkg.version || '1.0.6';
  const supabaseStatus = await db.getSupabaseStatus();
  res.status(200).json({
    name: "Concord",
    version: currentVersion,
    build: `stable-${currentVersion}`,
    timestamp: Date.now(),
    supabase: supabaseStatus,
    features: {
      systemAudio: true,
      webrtcMesh: true,
      autoUpdate: true,
      supabaseAuth: true,
      inviteCodeGate: true
    }
  });
});

app.get('/api/database/status', async (req, res) => {
  try {
    const status = await db.getSupabaseStatus();
    const codes = await db.getCodes();
    const users = await db.getUsers();
    res.json({
      ...status,
      totalCodes: codes.length,
      totalUsers: users.length,
      schemaReady: status.tablesExist
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// --- REST Auth APIs ---

// 1. Validate Code (Check if admin-generated invite code is valid and unused)
app.post('/api/auth/validate-code', async (req, res) => {
  try {
    const rawCode = req.body.code;
    if (!rawCode || typeof rawCode !== 'string') {
      return res.status(400).json({ error: 'Código de convite é obrigatório.' });
    }

    const code = rawCode.trim().toUpperCase();

    // Check if code exists in Supabase/db
    const codeEntry = await db.findCode(code);
    if (!codeEntry) {
      return res.status(404).json({ error: 'Código inválido ou inexistente. Solicite um código de convite ao Administrador.' });
    }

    if (codeEntry.used && code !== ADMIN_CODE) {
      return res.status(400).json({ error: 'Este código de convite já foi utilizado para criar uma conta. Se você já tem cadastro, faça login com seu Usuário e Senha.' });
    }

    return res.json({
      status: 'valid_code',
      code: codeEntry.code,
      role: codeEntry.role || 'user'
    });
  } catch (err) {
    console.error('Error validating code:', err);
    return res.status(500).json({ error: 'Erro interno ao validar código.' });
  }
});

// 2. Login with Username/Identifier & Password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: 'Identificador (Usuário ou Código) é obrigatório.' });
    }

    const cleanIdentifier = identifier.trim();
    const upperIdentifier = cleanIdentifier.toUpperCase();
    const cleanPassword = (password || '').trim();

    // 1. Caso especial: Acesso imediato pelo Código Master do Administrador
    if (upperIdentifier === ADMIN_CODE || cleanPassword.toUpperCase() === ADMIN_CODE) {
      let admin = (await db.getUsers()).find(u => u.code === ADMIN_CODE || u.role === 'admin');
      if (!admin) {
        admin = {
          code: ADMIN_CODE,
          nickname: 'Fellipe (Admin)',
          username: 'admin',
          role: 'admin',
          token: 'admin-token-fellmaster123-perm'
        };
      }

      res.cookie('tribonera_token', admin.token, {
        maxAge: 365 * 24 * 60 * 60 * 1000,
        httpOnly: false,
        sameSite: 'lax',
        path: '/'
      });

      return res.json({
        success: true,
        user: {
          code: admin.code,
          nickname: admin.nickname,
          username: admin.username || 'admin',
          role: 'admin'
        },
        token: admin.token
      });
    }

    if (!cleanPassword) {
      return res.status(400).json({ error: 'A Senha é obrigatória para acessar sua conta.' });
    }

    const candidates = await db.findUsersByIdentifier(cleanIdentifier);
    if (!candidates || candidates.length === 0) {
      // Verificar se é um código de convite ainda não registrado
      const inviteCode = await db.findCode(upperIdentifier);
      if (inviteCode && !inviteCode.used) {
        return res.status(400).json({ 
          error: 'Este código de convite ainda não foi cadastrado. Por favor, clique na aba "Registrar-se" para criar sua conta com ele.',
          isUnusedInvite: true
        });
      }
      return res.status(401).json({ error: 'Usuário ou código não encontrado. Verifique suas credenciais.' });
    }

    // Verificar candidatos e testar senha
    let matchedUser = null;
    for (const user of candidates) {
      let valid = false;
      if (user.password_hash && user.salt) {
        valid = verifyPassword(cleanPassword, user.password_hash, user.salt);
      } else {
        // Fallbacks para contas herdadas ou senhas mestras
        valid = (
          cleanPassword === ADMIN_INITIAL_PASSWORD ||
          cleanPassword === 'admin' ||
          cleanPassword === user.code ||
          (user.role === 'admin' && (cleanPassword === 'admin123' || cleanPassword === ADMIN_CODE))
        );
      }

      if (valid) {
        matchedUser = user;
        break;
      }
    }

    // Fallback permissivo para admin caso senha admin padrão seja usada
    if (!matchedUser && (cleanPassword === ADMIN_INITIAL_PASSWORD || cleanPassword === 'admin' || cleanPassword === ADMIN_CODE)) {
      matchedUser = candidates.find(u => u.role === 'admin');
    }

    if (!matchedUser) {
      return res.status(401).json({ error: 'Senha incorreta. Verifique e tente novamente.' });
    }

    // Set cookie for session persistence
    res.cookie('tribonera_token', matchedUser.token, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    });

    return res.json({
      success: true,
      user: {
        code: matchedUser.code,
        nickname: matchedUser.nickname,
        username: matchedUser.username || matchedUser.nickname,
        role: matchedUser.role
      },
      token: matchedUser.token
    });
  } catch (err) {
    console.error('Error in login:', err);
    return res.status(500).json({ error: 'Erro interno durante autenticação.' });
  }
});

// 3. Register New User (Requires valid admin-generated invite code + Nickname + Password)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { code: rawCode, nickname: rawNickname, password, confirmPassword } = req.body;
    if (!rawCode || !rawNickname || !password) {
      return res.status(400).json({ error: 'Código de convite, Nickname e Senha são obrigatórios.' });
    }

    const code = rawCode.trim().toUpperCase();
    const nickname = rawNickname.trim();

    if (nickname.length < 2 || nickname.length > 25) {
      return res.status(400).json({ error: 'O Nickname deve ter entre 2 e 25 caracteres.' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'A Senha deve conter no mínimo 4 caracteres.' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ error: 'As senhas digitadas não coincidem.' });
    }

    // Check code in database (Supabase / local store)
    const codeEntry = await db.findCode(code);
    if (!codeEntry) {
      return res.status(404).json({ error: 'Código de convite inválido ou inexistente. Peça um código ao Administrador.' });
    }

    if (codeEntry.used && code !== ADMIN_CODE) {
      return res.status(400).json({ error: 'Este código de convite já foi utilizado e não pode ser reutilizado.' });
    }

    // Check if nickname is already taken
    const existingNick = await db.findUserByIdentifier(nickname);
    if (existingNick) {
      return res.status(400).json({ error: 'Este Nickname já está em uso por outro membro. Por favor, escolha outro.' });
    }

    // Create user in Supabase / db with salted password hash
    const newUser = await db.createUser({
      code,
      nickname,
      username: nickname.toLowerCase(),
      password,
      role: codeEntry.role || 'user'
    });

    // Set cookie for auto-login
    res.cookie('tribonera_token', newUser.token, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    });

    return res.json({
      success: true,
      user: {
        code: newUser.code,
        nickname: newUser.nickname,
        username: newUser.username,
        role: newUser.role
      },
      token: newUser.token
    });
  } catch (err) {
    console.error('Error in registration:', err);
    return res.status(500).json({ error: 'Erro interno ao registrar usuário.' });
  }
});

// 4. Verify Session / Auto-login
app.get('/api/auth/verify', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Não autorizado ou sessão expirada / revogada.' });
    }

    const streams = readJSON(STREAMS_FILE, { activeStreams: [] });

    return res.json({
      valid: true,
      user: {
        code: user.code,
        nickname: user.nickname,
        username: user.username || user.nickname,
        role: user.role
      },
      supabase: db.getSupabaseStatus(),
      activeStreams: streams.activeStreams || []
    });
  } catch (err) {
    console.error('Error verifying session:', err);
    return res.status(500).json({ error: 'Erro ao verificar sessão.' });
  }
});

// 5. Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('tribonera_token', { path: '/' });
  return res.json({ success: true });
});

// --- Admin APIs ---

async function requireAdmin(req, res, next) {
  const user = await authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Sessão expirada ou não autenticada. Faça login novamente.' });
  }
  if (user.role !== 'admin' && user.code !== ADMIN_CODE) {
    return res.status(403).json({ error: 'Acesso negado. Apenas o Administrador pode executar esta ação.' });
  }
  req.adminUser = user;
  next();
}

// Get admin dashboard data (Codes, Users, Supabase connection status)
app.get('/api/admin/data', requireAdmin, async (req, res) => {
  try {
    const codes = await db.getCodes();
    const users = await db.getUsers();
    const streams = readJSON(STREAMS_FILE, { activeStreams: [] });

    const onlineSockets = Array.from(onlineUsers.values());

    const usersWithStatus = users.map(u => {
      const onlineSession = onlineSockets.find(s => s.code === u.code);
      return {
        code: u.code,
        nickname: u.nickname,
        username: u.username || u.nickname,
        role: u.role,
        createdAt: u.createdAt,
        isOnline: !!onlineSession,
        status: onlineSession ? onlineSession.status : '⚫ Offline',
        watching: onlineSession?.watchingStreamerName || null,
        isStreaming: streams.activeStreams?.some(s => s.streamerCode === u.code) || false
      };
    });

    return res.json({
      codes,
      users: usersWithStatus,
      supabase: db.getSupabaseStatus(),
      activeStreams: streams.activeStreams || [],
      totalOnline: onlineSockets.length
    });
  } catch (err) {
    console.error('Error fetching admin data:', err);
    return res.status(500).json({ error: 'Erro ao obter dados administrativos.' });
  }
});

// Generate new random 6-character code (Persisted to Supabase / db)
app.post('/api/admin/generate-code', requireAdmin, async (req, res) => {
  try {
    const codes = await db.getCodes();
    
    // Generate random uppercase 6 char alphanumeric (excluding ambiguous characters 0/O, 1/I)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let newCode = '';
    let attempts = 0;

    do {
      newCode = '';
      for (let i = 0; i < 6; i++) {
        newCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      attempts++;
    } while (codes.some(c => c.code === newCode) && attempts < 100);

    const newEntry = await db.createCode(newCode, 'user');

    return res.json({
      success: true,
      code: newEntry
    });
  } catch (err) {
    console.error('Error generating code:', err);
    return res.status(500).json({ error: 'Erro ao gerar código no Supabase.' });
  }
});

// Revoke unused code
app.post('/api/admin/revoke-code', requireAdmin, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code === ADMIN_CODE) {
      return res.status(400).json({ error: 'Não é possível revogar o código do administrador master.' });
    }

    const targetCode = await db.findCode(code);
    if (!targetCode) {
      return res.status(404).json({ error: 'Código não encontrado.' });
    }

    await db.revokeCode(code);

    return res.json({ success: true, message: `Código ${code} revogado com sucesso.` });
  } catch (err) {
    console.error('Error revoking code:', err);
    return res.status(500).json({ error: 'Erro ao revogar código.' });
  }
});

// Remove user (permanently revokes access and disconnects)
app.post('/api/admin/remove-user', requireAdmin, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code === ADMIN_CODE) {
      return res.status(400).json({ error: 'Não é possível remover o administrador principal.' });
    }

    const userToRemove = await db.findUserByIdentifier(code);
    if (!userToRemove) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    await db.removeUser(code);

    // Disconnect active socket if online
    for (const [socketId, onlineUser] of onlineUsers.entries()) {
      if (onlineUser.code === code) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('auth:revoked', { message: 'Seu acesso foi revogado pelo Administrador.' });
          socket.disconnect(true);
        }
        onlineUsers.delete(socketId);
      }
    }

    // Clean up any active stream by this user
    cleanupUserStream(code);

    broadcastPresence();

    return res.json({
      success: true,
      message: `Usuário ${userToRemove.nickname} (${code}) foi removido permanentemente.`
    });
  } catch (err) {
    console.error('Error removing user:', err);
    return res.status(500).json({ error: 'Erro ao remover usuário.' });
  }
});

// --- In-Memory State & Socket.IO WebRTC Signaling ---
// socket.id => { socketId, code, nickname, role, token, status: '🟢 Online' | '🔴 Transmitindo' | '👀 Assistindo', watchingStreamerCode, watchingStreamerName }
const onlineUsers = new Map();

// Active streams in memory: Map of streamerSocketId => { streamerSocketId, streamerCode, streamerName, title, resolution, fps, hasAudio, viewers: Map(socketId => { code, nickname }), startedAt }
const memoryStreams = new Map();

function getActiveStreamsList() {
  const list = [];
  for (const [, stream] of memoryStreams.entries()) {
    // Group and deduplicate viewers by their unique user code
    const uniqueViewersMap = new Map();
    for (const [sId, viewerInfo] of stream.viewers.entries()) {
      const code = typeof viewerInfo === 'object' && viewerInfo.code ? viewerInfo.code : sId;
      const nickname = typeof viewerInfo === 'object' && viewerInfo.nickname ? viewerInfo.nickname : viewerInfo;
      if (!uniqueViewersMap.has(code)) {
        uniqueViewersMap.set(code, {
          socketId: sId,
          code,
          nickname
        });
      }
    }

    const viewersArr = Array.from(uniqueViewersMap.values());

    list.push({
      streamerSocketId: stream.streamerSocketId,
      streamerCode: stream.streamerCode,
      streamerName: stream.streamerName,
      title: stream.title || `Tela de ${stream.streamerName}`,
      resolution: stream.resolution || '1080p',
      fps: stream.fps || 30,
      hasAudio: !!stream.hasAudio,
      viewersCount: viewersArr.length,
      viewers: viewersArr,
      startedAt: stream.startedAt
    });
  }
  return list;
}

function syncStreamsToDisk() {
  const activeStreams = getActiveStreamsList();
  writeJSON(STREAMS_FILE, { activeStreams });
}

async function broadcastPresence() {
  try {
    const allUsers = await db.getUsers();
    const activeStreamsList = getActiveStreamsList();

    const userMap = new Map();

    for (const [, user] of onlineUsers.entries()) {
      const isStreaming = memoryStreams.has(user.socketId);
      
      if (!userMap.has(user.code)) {
        userMap.set(user.code, {
          socketId: user.socketId,
          code: user.code,
          nickname: user.nickname,
          role: user.role,
          status: user.status,
          watchingStreamerName: user.watchingStreamerName || null,
          isStreaming: isStreaming
        });
      } else {
        const existing = userMap.get(user.code);
        // Prioritize active streaming state, then watching state
        if (isStreaming) {
          existing.isStreaming = true;
          existing.status = '🔴 Transmitindo';
          existing.socketId = user.socketId;
        } else if (!existing.isStreaming && user.watchingStreamerName) {
          existing.status = user.status;
          existing.watchingStreamerName = user.watchingStreamerName;
        }
      }
    }

    const onlineList = Array.from(userMap.values());
    const onlineCodes = new Set(userMap.keys());

    const offlineList = (allUsers || [])
      .filter(u => !onlineCodes.has(u.code))
      .map(u => ({
        code: u.code,
        nickname: u.nickname,
        role: u.role,
        status: '⚫ Offline'
      }));

    const payload = {
      onlineUsers: onlineList,
      offlineUsers: offlineList,
      activeStreams: activeStreamsList,
      totalOnline: onlineList.length,
      totalRegistered: (allUsers || []).length
    };

    io.emit('presence:sync', payload);
  } catch (err) {
    console.error('Error in broadcastPresence:', err);
  }
}

function cleanupUserStream(userCodeOrSocketId) {
  let targetSocketId = null;
  for (const [sId, stream] of memoryStreams.entries()) {
    if (sId === userCodeOrSocketId || stream.streamerCode === userCodeOrSocketId) {
      targetSocketId = sId;
      break;
    }
  }

  if (targetSocketId && memoryStreams.has(targetSocketId)) {
    const stream = memoryStreams.get(targetSocketId);
    
    // Notify all viewers that stream ended
    for (const [viewerSocketId] of stream.viewers.entries()) {
      const viewerSocket = io.sockets.sockets.get(viewerSocketId);
      if (viewerSocket) {
        viewerSocket.emit('stream:ended', {
          streamerSocketId: targetSocketId,
          streamerName: stream.streamerName
        });
      }
      // Reset viewer status
      const viewerUser = onlineUsers.get(viewerSocketId);
      if (viewerUser) {
        viewerUser.status = '🟢 Online';
        viewerUser.watchingStreamerCode = null;
        viewerUser.watchingStreamerName = null;
      }
    }

    memoryStreams.delete(targetSocketId);
    syncStreamsToDisk();
    
    io.emit('stream:stopped', {
      streamerSocketId: targetSocketId,
      streamerName: stream.streamerName
    });
  }
}

// Socket.IO Middleware: Authenticate connection token
io.use(async (socket, next) => {
  try {
    let token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Autenticação necessária.'));
    }

    let user = await db.findUserByToken(token);
    if (!user && (token === 'admin-token-fellmaster123-perm' || token === ADMIN_CODE)) {
      user = await db.findUserByIdentifier(ADMIN_CODE);
    }

    if (!user) {
      return next(new Error('Token inválido ou revogado.'));
    }

    socket.user = user;
    next();
  } catch (err) {
    console.error('Error in socket auth middleware:', err);
    next(new Error('Erro de autenticação no servidor.'));
  }
});

io.on('connection', (socket) => {
  const user = socket.user;

  // Check if user is already connected from another tab
  let wasAlreadyOnline = false;
  for (const [, existing] of onlineUsers.entries()) {
    if (existing.code === user.code) {
      wasAlreadyOnline = true;
      break;
    }
  }

  // Add to online map
  onlineUsers.set(socket.id, {
    socketId: socket.id,
    code: user.code,
    nickname: user.nickname,
    role: user.role,
    token: user.token,
    status: '🟢 Online',
    watchingStreamerCode: null,
    watchingStreamerName: null,
    joinedAt: Date.now()
  });

  // Send initial data to this socket
  socket.emit('init:state', {
    currentUser: {
      code: user.code,
      nickname: user.nickname,
      role: user.role
    },
    activeStreams: getActiveStreamsList()
  });

  // Broadcast presence to all
  broadcastPresence();

  // Broadcast real-time notification only if this is a fresh new connection
  if (!wasAlreadyOnline) {
    socket.broadcast.emit('user:joined', {
      nickname: user.nickname,
      code: user.code,
      role: user.role
    });
  }

  // --- WebRTC & Screen Sharing Handlers ---

  // 1. User starts screen share
  socket.on('stream:start', (data = {}) => {
    const streamer = onlineUsers.get(socket.id);
    if (!streamer) return;

    streamer.status = '🔴 Transmitindo';
    streamer.watchingStreamerCode = null;
    streamer.watchingStreamerName = null;

    memoryStreams.set(socket.id, {
      streamerSocketId: socket.id,
      streamerCode: streamer.code,
      streamerName: streamer.nickname,
      title: data.title || `Tela de ${streamer.nickname}`,
      resolution: data.resolution || '1080p',
      fps: data.fps || 60,
      hasAudio: !!data.hasAudio,
      viewers: new Map(),
      startedAt: Date.now()
    });

    syncStreamsToDisk();
    broadcastPresence();

    socket.broadcast.emit('stream:started', {
      streamerSocketId: socket.id,
      streamerCode: streamer.code,
      streamerName: streamer.nickname,
      title: data.title || `Tela de ${streamer.nickname}`,
      resolution: data.resolution || '1080p',
      fps: data.fps || 60,
      hasAudio: !!data.hasAudio
    });
  });

  // 2. User stops screen share
  socket.on('stream:stop', () => {
    const streamer = onlineUsers.get(socket.id);
    if (streamer) {
      streamer.status = '🟢 Online';
    }
    cleanupUserStream(socket.id);
    broadcastPresence();
  });

  // 3. Viewer requests to watch a specific stream
  const handleWatchStream = ({ streamerSocketId }) => {
    const viewer = onlineUsers.get(socket.id);
    if (!viewer) return;

    const stream = memoryStreams.get(streamerSocketId);
    if (!stream) {
      return socket.emit('stream:error', { message: 'Transmissão não encontrada ou já encerrada.' });
    }

    // Update viewer status
    viewer.status = `👀 Assistindo`;
    viewer.watchingStreamerCode = stream.streamerCode;
    viewer.watchingStreamerName = stream.streamerName;

    // Add viewer to stream viewers map
    stream.viewers.set(socket.id, {
      code: viewer.code,
      nickname: viewer.nickname
    });
    syncStreamsToDisk();
    broadcastPresence();

    // Signal the streamer that a new viewer wants WebRTC connection
    io.to(streamerSocketId).emit('webrtc:new-viewer', {
      viewerSocketId: socket.id,
      viewerNickname: viewer.nickname,
      viewerCode: viewer.code
    });
  };

  socket.on('stream:watch', handleWatchStream);
  socket.on('stream:join-viewer', handleWatchStream);

  // 4. Viewer stops watching a stream
  const handleUnwatchStream = ({ streamerSocketId }) => {
    const viewer = onlineUsers.get(socket.id);
    if (viewer) {
      viewer.status = '🟢 Online';
      viewer.watchingStreamerCode = null;
      viewer.watchingStreamerName = null;
    }

    if (streamerSocketId && memoryStreams.has(streamerSocketId)) {
      const stream = memoryStreams.get(streamerSocketId);
      stream.viewers.delete(socket.id);
      
      io.to(streamerSocketId).emit('webrtc:viewer-left', {
        viewerSocketId: socket.id,
        viewerNickname: viewer?.nickname
      });
    }

    syncStreamsToDisk();
    broadcastPresence();
  };

  socket.on('stream:unwatch', handleUnwatchStream);
  socket.on('stream:leave-viewer', handleUnwatchStream);

  // 5. WebRTC Relay Signaling: Offer (Streamer -> Viewer)
  socket.on('webrtc:offer', ({ targetSocketId, offer }) => {
    io.to(targetSocketId).emit('webrtc:offer', {
      fromSocketId: socket.id,
      fromNickname: socket.user.nickname,
      offer
    });
  });

  // 6. WebRTC Relay Signaling: Answer (Viewer -> Streamer)
  socket.on('webrtc:answer', ({ targetSocketId, answer }) => {
    io.to(targetSocketId).emit('webrtc:answer', {
      fromSocketId: socket.id,
      fromNickname: socket.user.nickname,
      answer
    });
  });

  // 7. WebRTC Relay Signaling: ICE Candidate (Bidirectional)
  socket.on('webrtc:ice-candidate', ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit('webrtc:ice-candidate', {
      fromSocketId: socket.id,
      candidate
    });
  });

  // 8. Handle Disconnect
  socket.on('disconnect', () => {
    // If was streaming, cleanup stream
    if (memoryStreams.has(socket.id)) {
      cleanupUserStream(socket.id);
    }

    // If was watching someone, remove from their viewers list
    const userState = onlineUsers.get(socket.id);
    if (userState && userState.watchingStreamerCode) {
      for (const [, stream] of memoryStreams.entries()) {
        if (stream.viewers.has(socket.id)) {
          stream.viewers.delete(socket.id);
          io.to(stream.streamerSocketId).emit('webrtc:viewer-left', {
            viewerSocketId: socket.id,
            viewerNickname: userState.nickname
          });
        }
      }
      syncStreamsToDisk();
    }

    onlineUsers.delete(socket.id);
    broadcastPresence();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=============================================`);
  console.log(`  Concord Server rodando na porta ${PORT}`);
  console.log(`  Painel Admin Code: ${ADMIN_CODE}`);
  console.log(`  Acesse: http://localhost:${PORT}`);
  console.log(`=============================================`);
});
