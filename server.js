import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

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

const PORT = 3000;
const ADMIN_CODE = process.env.ADMIN_CODE || 'FELLMASTER123';

const USERS_FILE = path.join(__dirname, 'users.json');
const CODES_FILE = path.join(__dirname, 'codes.json');
const STREAMS_FILE = path.join(__dirname, 'streams.json');

// --- JSON Helpers ---
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
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Initial check / setup
function initDatabase() {
  const codes = readJSON(CODES_FILE, []);
  if (!codes.find(c => c.code === ADMIN_CODE)) {
    codes.push({ code: ADMIN_CODE, used: true, role: 'admin', createdAt: Date.now() });
    writeJSON(CODES_FILE, codes);
  }

  const users = readJSON(USERS_FILE, []);
  if (!users.find(u => u.code === ADMIN_CODE)) {
    users.push({
      code: ADMIN_CODE,
      nickname: 'Fellipe (Admin)',
      role: 'admin',
      token: 'admin-token-fellmaster123-perm',
      createdAt: Date.now()
    });
    writeJSON(USERS_FILE, users);
  }

  writeJSON(STREAMS_FILE, { activeStreams: [] });
}

initDatabase();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to authenticate request
function authenticateRequest(req) {
  let token = req.cookies?.tribonera_token;
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.replace(/^[Bb]earer\s+/i, '').trim();
  }
  if (!token && req.query?.token) {
    token = req.query.token;
  }
  
  if (!token) return null;
  const users = readJSON(USERS_FILE, []);
  let user = users.find(u => u.token === token);
  if (!user && (token === 'admin-token-fellmaster123-perm' || token === ADMIN_CODE)) {
    user = users.find(u => u.code === ADMIN_CODE);
  }
  return user || null;
}

// Routes
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// --- REST Auth APIs ---

// 1. Validate Code
app.post('/api/auth/validate-code', (req, res) => {
  const rawCode = req.body.code;
  if (!rawCode || typeof rawCode !== 'string') {
    return res.status(400).json({ error: 'Código é obrigatório.' });
  }

  const code = rawCode.trim().toUpperCase();
  const codes = readJSON(CODES_FILE, []);
  const users = readJSON(USERS_FILE, []);

  // Check if admin
  if (code === ADMIN_CODE) {
    let adminUser = users.find(u => u.code === ADMIN_CODE);
    if (!adminUser) {
      adminUser = {
        code: ADMIN_CODE,
        nickname: 'Fellipe (Admin)',
        role: 'admin',
        token: 'admin-token-fellmaster123-perm',
        createdAt: Date.now()
      };
      users.push(adminUser);
      writeJSON(USERS_FILE, users);
    }
    
    // Set cookie for session persistence
    res.cookie('tribonera_token', adminUser.token, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    });

    return res.json({
      status: 'existing_user',
      user: {
        code: adminUser.code,
        nickname: adminUser.nickname,
        role: adminUser.role
      },
      token: adminUser.token
    });
  }

  // Check in users first (already registered)
  const existingUser = users.find(u => u.code === code);
  if (existingUser) {
    res.cookie('tribonera_token', existingUser.token, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    });

    return res.json({
      status: 'existing_user',
      user: {
        code: existingUser.code,
        nickname: existingUser.nickname,
        role: existingUser.role
      },
      token: existingUser.token
    });
  }

  // Check if code exists in codes.json and is unused
  const codeEntry = codes.find(c => c.code === code);
  if (!codeEntry) {
    return res.status(404).json({ error: 'Código inválido ou inexistente. Peça um código ao Administrador.' });
  }

  if (codeEntry.used) {
    return res.status(400).json({ error: 'Este código já foi utilizado e não pode ser reutilizado.' });
  }

  return res.json({
    status: 'new_user_required',
    code: code
  });
});

// 2. Register New User with Code & Nickname
app.post('/api/auth/register', (req, res) => {
  const { code: rawCode, nickname: rawNickname } = req.body;
  if (!rawCode || !rawNickname) {
    return res.status(400).json({ error: 'Código e Nickname são obrigatórios.' });
  }

  const code = rawCode.trim().toUpperCase();
  const nickname = rawNickname.trim();

  if (nickname.length < 2 || nickname.length > 25) {
    return res.status(400).json({ error: 'O Nickname deve ter entre 2 e 25 caracteres.' });
  }

  const codes = readJSON(CODES_FILE, []);
  const users = readJSON(USERS_FILE, []);

  // Check if nickname is already taken by another user
  const nickExists = users.find(u => u.nickname.toLowerCase() === nickname.toLowerCase());
  if (nickExists) {
    return res.status(400).json({ error: 'Este Nickname já está em uso por outro membro. Escolha outro.' });
  }

  // Check if already registered
  const existingUser = users.find(u => u.code === code);
  if (existingUser) {
    return res.status(400).json({ error: 'Este código já está registrado com outro nickname permanente.' });
  }

  // Check code in codes.json
  const codeIndex = codes.findIndex(c => c.code === code);
  if (codeIndex === -1) {
    return res.status(404).json({ error: 'Código inválido.' });
  }

  if (codes[codeIndex].used) {
    return res.status(400).json({ error: 'Este código já foi usado.' });
  }

  // Generate permanent session token
  const token = `tb_${crypto.randomBytes(24).toString('hex')}`;
  const newUser = {
    code,
    nickname,
    role: codes[codeIndex].role || 'user',
    token,
    createdAt: Date.now()
  };

  // Mark code as used
  codes[codeIndex].used = true;
  codes[codeIndex].usedBy = nickname;
  codes[codeIndex].usedAt = Date.now();
  writeJSON(CODES_FILE, codes);

  // Save user
  users.push(newUser);
  writeJSON(USERS_FILE, users);

  // Set cookie for auto-login
  res.cookie('tribonera_token', token, {
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
      role: newUser.role
    },
    token
  });
});

// 3. Verify Session / Auto-login
app.get('/api/auth/verify', (req, res) => {
  const user = authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autorizado ou sessão expirada / revogada.' });
  }

  const streams = readJSON(STREAMS_FILE, { activeStreams: [] });

  return res.json({
    valid: true,
    user: {
      code: user.code,
      nickname: user.nickname,
      role: user.role
    },
    activeStreams: streams.activeStreams || []
  });
});

// 4. Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('tribonera_token', { path: '/' });
  return res.json({ success: true });
});

// --- Admin APIs ---

function requireAdmin(req, res, next) {
  const user = authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Sessão expirada ou não autenticada. Faça login novamente.' });
  }
  if (user.role !== 'admin' && user.code !== ADMIN_CODE) {
    return res.status(403).json({ error: 'Acesso negado. Apenas o Administrador pode executar esta ação.' });
  }
  req.adminUser = user;
  next();
}

// Get admin dashboard data
app.get('/api/admin/data', requireAdmin, (req, res) => {
  const codes = readJSON(CODES_FILE, []);
  const users = readJSON(USERS_FILE, []);
  const streams = readJSON(STREAMS_FILE, { activeStreams: [] });

  const onlineSockets = Array.from(onlineUsers.values());

  const usersWithStatus = users.map(u => {
    const onlineSession = onlineSockets.find(s => s.code === u.code);
    return {
      code: u.code,
      nickname: u.nickname,
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
    activeStreams: streams.activeStreams || [],
    totalOnline: onlineSockets.length
  });
});

// Generate new random 6-character code
app.post('/api/admin/generate-code', requireAdmin, (req, res) => {
  const codes = readJSON(CODES_FILE, []);
  
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

  const newEntry = {
    code: newCode,
    used: false,
    role: 'user',
    createdAt: Date.now()
  };

  codes.push(newEntry);
  writeJSON(CODES_FILE, codes);

  return res.json({
    success: true,
    code: newEntry
  });
});

// Revoke unused code
app.post('/api/admin/revoke-code', requireAdmin, (req, res) => {
  const { code } = req.body;
  if (!code || code === ADMIN_CODE) {
    return res.status(400).json({ error: 'Não é possível revogar este código.' });
  }

  let codes = readJSON(CODES_FILE, []);
  const targetCode = codes.find(c => c.code === code);
  if (!targetCode) {
    return res.status(404).json({ error: 'Código não encontrado.' });
  }

  codes = codes.filter(c => c.code !== code);
  writeJSON(CODES_FILE, codes);

  return res.json({ success: true, message: `Código ${code} revogado com sucesso.` });
});

// Remove user (permanently revokes access and disconnects)
app.post('/api/admin/remove-user', requireAdmin, (req, res) => {
  const { code } = req.body;
  if (!code || code === ADMIN_CODE) {
    return res.status(400).json({ error: 'Não é possível remover o administrador principal.' });
  }

  let users = readJSON(USERS_FILE, []);
  let codes = readJSON(CODES_FILE, []);
  const userToRemove = users.find(u => u.code === code);

  if (!userToRemove) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  // Remove from users.json
  users = users.filter(u => u.code !== code);
  writeJSON(USERS_FILE, users);

  // Remove or revoke from codes.json
  codes = codes.filter(c => c.code !== code);
  writeJSON(CODES_FILE, codes);

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

function broadcastPresence() {
  const allUsers = readJSON(USERS_FILE, []);
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

  const offlineList = allUsers
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
    totalRegistered: allUsers.length
  };

  io.emit('presence:sync', payload);
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
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error('Autenticação necessária.'));
  }

  const users = readJSON(USERS_FILE, []);
  const user = users.find(u => u.token === token);
  if (!user) {
    return next(new Error('Token inválido ou revogado.'));
  }

  socket.user = user;
  next();
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
