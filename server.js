import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { db, SUPABASE_SCHEMA_SQL } from './lib/db.js';

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

const PORT = process.env.PORT || 3000;
const ADMIN_CODE = process.env.ADMIN_CODE || 'FELLMASTER123';

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
  let user = await db.findUserByToken(token);
  if (!user && (token === 'admin-token-fellmaster123-perm' || token === ADMIN_CODE)) {
    user = await db.findUserByCode(ADMIN_CODE);
  }
  return user || null;
}

// Routes

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.get("/api/version", (req, res) => {
  let version = '1.0.5';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
    version = pkg.version || version;
  } catch (e) {}

  res.status(200).json({
    name: "Concord",
    version: version,
    build: `stable-${version}`,
    timestamp: Date.now(),
    database: {
      provider: db.isSupabaseConfigured() ? 'Supabase (PostgreSQL)' : 'Local Persistent Storage (Supabase Ready)',
      isSupabaseConnected: db.isSupabaseConfigured()
    },
    features: {
      voiceChannels: true,
      textChat: true,
      systemAudio: true,
      webrtcMesh: true,
      autoUpdate: true
    }
  });
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// --- REST Auth APIs ---

// 1. Validate Code
app.post('/api/auth/validate-code', async (req, res) => {
  const rawCode = req.body.code;
  if (!rawCode || typeof rawCode !== 'string') {
    return res.status(400).json({ error: 'Código é obrigatório.' });
  }

  const code = rawCode.trim().toUpperCase();

  // Check if admin
  if (code === ADMIN_CODE) {
    let adminUser = await db.findUserByCode(ADMIN_CODE);
    if (!adminUser) {
      adminUser = await db.createUser({
        code: ADMIN_CODE,
        nickname: 'Fellipe (Admin)',
        role: 'admin',
        token: 'admin-token-fellmaster123-perm',
        createdAt: Date.now()
      });
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
  const existingUser = await db.findUserByCode(code);
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

  // Check if code exists in codes list
  const codeEntry = await db.findCode(code);
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
app.post('/api/auth/register', async (req, res) => {
  const { code: rawCode, nickname: rawNickname } = req.body;
  if (!rawCode || !rawNickname) {
    return res.status(400).json({ error: 'Código e Nickname são obrigatórios.' });
  }

  const code = rawCode.trim().toUpperCase();
  const nickname = rawNickname.trim();

  if (nickname.length < 2 || nickname.length > 25) {
    return res.status(400).json({ error: 'O Nickname deve ter entre 2 e 25 caracteres.' });
  }

  // Check if nickname is already taken by another user
  const nickExists = await db.findUserByNickname(nickname);
  if (nickExists) {
    return res.status(400).json({ error: 'Este Nickname já está em uso por outro membro. Escolha outro.' });
  }

  // Check if already registered
  const existingUser = await db.findUserByCode(code);
  if (existingUser) {
    return res.status(400).json({ error: 'Este código já está registrado com outro nickname permanente.' });
  }

  // Check code
  const codeEntry = await db.findCode(code);
  if (!codeEntry) {
    return res.status(404).json({ error: 'Código inválido.' });
  }

  if (codeEntry.used) {
    return res.status(400).json({ error: 'Este código já foi usado.' });
  }

  // Generate permanent session token
  const token = `tb_${crypto.randomBytes(24).toString('hex')}`;
  const newUser = {
    code,
    nickname,
    role: codeEntry.role || 'user',
    token,
    createdAt: Date.now()
  };

  // Mark code as used
  await db.updateCode(code, {
    used: true,
    usedBy: nickname,
    usedAt: Date.now()
  });

  // Save user
  await db.createUser(newUser);

  // Set cookie for auto-login
  res.cookie('tribonera_token', token, {
    maxAge: 365 * 24 * 60 * 60 * 1000,
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
app.get('/api/auth/verify', async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autorizado ou sessão expirada / revogada.' });
  }

  const channels = await db.getChannels();
  const activeStreams = getActiveStreamsList();

  return res.json({
    valid: true,
    user: {
      code: user.code,
      nickname: user.nickname,
      role: user.role
    },
    channels,
    activeStreams
  });
});

// 4. Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('tribonera_token', { path: '/' });
  return res.json({ success: true });
});

// --- Channels & Chat APIs ---

// List channels
app.get('/api/channels', async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado.' });
  const channels = await db.getChannels();
  return res.json({ channels });
});

// Create channel (Admin or permitted users)
app.post('/api/channels', async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado.' });

  const { name, type, category, topic } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome do canal é obrigatório.' });

  const newChannel = await db.createChannel({
    name,
    type: type === 'voice' ? 'voice' : 'text',
    category: category || (type === 'voice' ? 'SALAS DE VOZ' : 'CANAIS DE TEXTO'),
    topic: topic || ''
  });

  // Broadcast to all connected clients
  io.emit('channel:created', newChannel);

  return res.json({ success: true, channel: newChannel });
});

// Delete channel
app.delete('/api/channels/:id', async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores podem deletar canais.' });

  const { id } = req.params;
  await db.deleteChannel(id);

  io.emit('channel:deleted', { channelId: id });
  return res.json({ success: true });
});

// Get messages for a channel
app.get('/api/channels/:id/messages', async (req, res) => {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado.' });

  const { id } = req.params;
  const messages = await db.getMessages(id, 100);
  return res.json({ messages });
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

// Get admin dashboard data
app.get('/api/admin/data', requireAdmin, async (req, res) => {
  const codes = await db.getCodes();
  const users = await db.getUsers();
  const activeStreams = getActiveStreamsList();
  const onlineSockets = Array.from(onlineUsers.values());

  const usersWithStatus = users.map(u => {
    const onlineSession = onlineSockets.find(s => s.code === u.code);
    return {
      code: u.code,
      nickname: u.nickname,
      role: u.role,
      createdAt: u.created_at || u.createdAt,
      isOnline: !!onlineSession,
      status: onlineSession ? onlineSession.status : '⚫ Offline',
      watching: onlineSession?.watchingStreamerName || null,
      voiceChannel: onlineSession?.voiceChannelName || null,
      isStreaming: activeStreams.some(s => s.streamerCode === u.code)
    };
  });

  return res.json({
    codes,
    users: usersWithStatus,
    activeStreams,
    totalOnline: onlineSockets.length,
    database: {
      provider: db.isSupabaseConfigured() ? 'Supabase' : 'Local Persistence',
      isSupabaseConnected: db.isSupabaseConfigured()
    }
  });
});

// Generate new random 6-character code
app.post('/api/admin/generate-code', requireAdmin, async (req, res) => {
  const codes = await db.getCodes();
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

  await db.createCode(newEntry);

  return res.json({
    success: true,
    code: newEntry
  });
});

// Revoke unused code
app.post('/api/admin/revoke-code', requireAdmin, async (req, res) => {
  const { code } = req.body;
  if (!code || code === ADMIN_CODE) {
    return res.status(400).json({ error: 'Não é possível revogar este código.' });
  }

  await db.deleteCode(code);
  return res.json({ success: true, message: `Código ${code} revogado com sucesso.` });
});

// Remove user
app.post('/api/admin/remove-user', requireAdmin, async (req, res) => {
  const { code } = req.body;
  if (!code || code === ADMIN_CODE) {
    return res.status(400).json({ error: 'Não é possível remover o administrador principal.' });
  }

  const userToRemove = await db.findUserByCode(code);
  if (!userToRemove) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  await db.deleteUser(code);
  await db.deleteCode(code);

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

  cleanupUserStream(code);
  broadcastPresence();

  return res.json({
    success: true,
    message: `Usuário ${userToRemove.nickname} (${code}) foi removido permanentemente.`
  });
});

// Supabase Schema definition for manual export
app.get('/api/admin/supabase-schema', requireAdmin, (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(SUPABASE_SCHEMA_SQL);
});

// --- In-Memory State & Real-Time Socket.IO Handlers ---
// socket.id => { socketId, code, nickname, role, token, status, voiceChannelId, voiceChannelName, isMuted, isDeafened, isSpeaking, watchingStreamerCode, watchingStreamerName }
const onlineUsers = new Map();

// Active streams in memory: Map of streamerSocketId => { streamerSocketId, streamerCode, streamerName, title, resolution, fps, hasAudio, viewers: Map, startedAt }
const memoryStreams = new Map();

// Voice channels active participant maps: channelId => Map(socketId => { socketId, code, nickname, isMuted, isDeafened, isSpeaking })
const voiceRooms = new Map();

function getActiveStreamsList() {
  const list = [];
  for (const [, stream] of memoryStreams.entries()) {
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

function getVoiceRoomsSummary() {
  const summary = {};
  for (const [channelId, participants] of voiceRooms.entries()) {
    summary[channelId] = Array.from(participants.values());
  }
  return summary;
}

async function broadcastPresence() {
  const allUsers = await db.getUsers();
  const activeStreamsList = getActiveStreamsList();
  const voiceSummary = getVoiceRoomsSummary();

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
        voiceChannelId: user.voiceChannelId || null,
        voiceChannelName: user.voiceChannelName || null,
        isMuted: !!user.isMuted,
        isDeafened: !!user.isDeafened,
        isSpeaking: !!user.isSpeaking,
        isStreaming: isStreaming
      });
    } else {
      const existing = userMap.get(user.code);
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
    voiceRooms: voiceSummary,
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
    
    for (const [viewerSocketId] of stream.viewers.entries()) {
      const viewerSocket = io.sockets.sockets.get(viewerSocketId);
      if (viewerSocket) {
        viewerSocket.emit('stream:ended', {
          streamerSocketId: targetSocketId,
          streamerName: stream.streamerName
        });
      }
      const viewerUser = onlineUsers.get(viewerSocketId);
      if (viewerUser) {
        viewerUser.status = '🟢 Online';
        viewerUser.watchingStreamerCode = null;
        viewerUser.watchingStreamerName = null;
      }
    }

    memoryStreams.delete(targetSocketId);
    
    io.emit('stream:stopped', {
      streamerSocketId: targetSocketId,
      streamerName: stream.streamerName
    });
  }
}

function removeUserFromVoiceChannel(socketId) {
  const user = onlineUsers.get(socketId);
  if (!user || !user.voiceChannelId) return;

  const channelId = user.voiceChannelId;
  if (voiceRooms.has(channelId)) {
    const room = voiceRooms.get(channelId);
    room.delete(socketId);
    if (room.size === 0) {
      voiceRooms.delete(channelId);
    }
  }

  // Notify other members in voice room
  io.to(`voice:${channelId}`).emit('voice:user-left', {
    socketId,
    code: user.code,
    nickname: user.nickname,
    channelId
  });

  user.voiceChannelId = null;
  user.voiceChannelName = null;
  user.isSpeaking = false;
}

// Socket.IO Middleware: Authenticate connection token
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error('Autenticação necessária.'));
  }

  let user = await db.findUserByToken(token);
  if (!user && (token === 'admin-token-fellmaster123-perm' || token === ADMIN_CODE)) {
    user = await db.findUserByCode(ADMIN_CODE);
  }

  if (!user) {
    return next(new Error('Token inválido ou revogado.'));
  }

  socket.user = user;
  next();
});

io.on('connection', async (socket) => {
  const user = socket.user;

  let wasAlreadyOnline = false;
  for (const [, existing] of onlineUsers.entries()) {
    if (existing.code === user.code) {
      wasAlreadyOnline = true;
      break;
    }
  }

  onlineUsers.set(socket.id, {
    socketId: socket.id,
    code: user.code,
    nickname: user.nickname,
    role: user.role,
    token: user.token,
    status: '🟢 Online',
    voiceChannelId: null,
    voiceChannelName: null,
    isMuted: false,
    isDeafened: false,
    isSpeaking: false,
    watchingStreamerCode: null,
    watchingStreamerName: null,
    joinedAt: Date.now()
  });

  // Send initial data to this socket
  const channels = await db.getChannels();
  socket.emit('init:state', {
    currentUser: {
      code: user.code,
      nickname: user.nickname,
      role: user.role
    },
    channels,
    activeStreams: getActiveStreamsList(),
    voiceRooms: getVoiceRoomsSummary()
  });

  broadcastPresence();

  if (!wasAlreadyOnline) {
    socket.broadcast.emit('user:joined', {
      nickname: user.nickname,
      code: user.code,
      role: user.role
    });
  }

  // --- Voice Channel Room Signaling & Audio Mesh Handlers ---

  // 1. Join Voice Channel
  socket.on('voice:join', async ({ channelId, channelName }) => {
    const onlineUser = onlineUsers.get(socket.id);
    if (!onlineUser) return;

    // Leave any existing voice room first
    if (onlineUser.voiceChannelId) {
      socket.leave(`voice:${onlineUser.voiceChannelId}`);
      removeUserFromVoiceChannel(socket.id);
    }

    onlineUser.voiceChannelId = channelId;
    onlineUser.voiceChannelName = channelName || 'Sala de Voz';
    onlineUser.isMuted = false;
    onlineUser.isDeafened = false;
    onlineUser.isSpeaking = false;

    if (!voiceRooms.has(channelId)) {
      voiceRooms.set(channelId, new Map());
    }

    const room = voiceRooms.get(channelId);
    const existingParticipants = Array.from(room.values());

    room.set(socket.id, {
      socketId: socket.id,
      code: onlineUser.code,
      nickname: onlineUser.nickname,
      isMuted: onlineUser.isMuted,
      isDeafened: onlineUser.isDeafened,
      isSpeaking: onlineUser.isSpeaking
    });

    socket.join(`voice:${channelId}`);

    // Inform the joined user of all peers currently in the channel (to initiate WebRTC audio mesh)
    socket.emit('voice:joined-success', {
      channelId,
      channelName: onlineUser.voiceChannelName,
      peers: existingParticipants
    });

    // Notify peers that a new user joined
    socket.to(`voice:${channelId}`).emit('voice:user-joined', {
      socketId: socket.id,
      code: onlineUser.code,
      nickname: onlineUser.nickname,
      isMuted: onlineUser.isMuted,
      isDeafened: onlineUser.isDeafened
    });

    broadcastPresence();
  });

  // 2. Leave Voice Channel
  socket.on('voice:leave', () => {
    const onlineUser = onlineUsers.get(socket.id);
    if (onlineUser && onlineUser.voiceChannelId) {
      socket.leave(`voice:${onlineUser.voiceChannelId}`);
      removeUserFromVoiceChannel(socket.id);
      socket.emit('voice:left-success');
      broadcastPresence();
    }
  });

  // 3. Toggle Mute / Deafen
  socket.on('voice:state-change', ({ isMuted, isDeafened }) => {
    const onlineUser = onlineUsers.get(socket.id);
    if (!onlineUser || !onlineUser.voiceChannelId) return;

    onlineUser.isMuted = !!isMuted;
    onlineUser.isDeafened = !!isDeafened;

    const room = voiceRooms.get(onlineUser.voiceChannelId);
    if (room && room.has(socket.id)) {
      const p = room.get(socket.id);
      p.isMuted = onlineUser.isMuted;
      p.isDeafened = onlineUser.isDeafened;
    }

    io.to(`voice:${onlineUser.voiceChannelId}`).emit('voice:user-state-updated', {
      socketId: socket.id,
      code: onlineUser.code,
      isMuted: onlineUser.isMuted,
      isDeafened: onlineUser.isDeafened
    });

    broadcastPresence();
  });

  // 4. User Speaking Activity (Green glowing ring around avatar)
  socket.on('voice:speaking', ({ isSpeaking }) => {
    const onlineUser = onlineUsers.get(socket.id);
    if (!onlineUser || !onlineUser.voiceChannelId) return;

    onlineUser.isSpeaking = !!isSpeaking;
    const room = voiceRooms.get(onlineUser.voiceChannelId);
    if (room && room.has(socket.id)) {
      room.get(socket.id).isSpeaking = !!isSpeaking;
    }

    socket.to(`voice:${onlineUser.voiceChannelId}`).emit('voice:user-speaking', {
      socketId: socket.id,
      code: onlineUser.code,
      isSpeaking: !!isSpeaking
    });
  });

  // 5. Voice WebRTC Peer-to-Peer Mesh Relay Signaling
  socket.on('voice:peer-offer', ({ targetSocketId, offer }) => {
    io.to(targetSocketId).emit('voice:peer-offer', {
      fromSocketId: socket.id,
      fromNickname: socket.user.nickname,
      fromCode: socket.user.code,
      offer
    });
  });

  socket.on('voice:peer-answer', ({ targetSocketId, answer }) => {
    io.to(targetSocketId).emit('voice:peer-answer', {
      fromSocketId: socket.id,
      fromNickname: socket.user.nickname,
      answer
    });
  });

  socket.on('voice:peer-ice-candidate', ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit('voice:peer-ice-candidate', {
      fromSocketId: socket.id,
      candidate
    });
  });

  // --- Real-Time Text Chat Handlers (Supabase / DB Synced) ---

  socket.on('chat:join-channel', ({ channelId }) => {
    socket.join(`chat:${channelId}`);
  });

  socket.on('chat:leave-channel', ({ channelId }) => {
    socket.leave(`chat:${channelId}`);
  });

  socket.on('chat:send-message', async (data) => {
    const { channelId, content, attachments } = data;
    if (!channelId || !content || !content.trim()) return;

    const newMsg = await db.createMessage({
      channelId,
      serverId: 'concord-main',
      userCode: socket.user.code,
      userNickname: socket.user.nickname,
      userAvatar: socket.user.avatar || null,
      content: content.trim(),
      attachments: attachments || []
    });

    io.to(`chat:${channelId}`).emit('chat:new-message', newMsg);
  });

  socket.on('chat:typing', ({ channelId, isTyping }) => {
    socket.to(`chat:${channelId}`).emit('chat:user-typing', {
      channelId,
      nickname: socket.user.nickname,
      code: socket.user.code,
      isTyping
    });
  });

  // --- Screen Sharing Handlers ---

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

  socket.on('stream:stop', () => {
    const streamer = onlineUsers.get(socket.id);
    if (streamer) {
      streamer.status = '🟢 Online';
    }
    cleanupUserStream(socket.id);
    broadcastPresence();
  });

  const handleWatchStream = ({ streamerSocketId }) => {
    const viewer = onlineUsers.get(socket.id);
    if (!viewer) return;

    const stream = memoryStreams.get(streamerSocketId);
    if (!stream) {
      return socket.emit('stream:error', { message: 'Transmissão não encontrada ou já encerrada.' });
    }

    viewer.status = `👀 Assistindo`;
    viewer.watchingStreamerCode = stream.streamerCode;
    viewer.watchingStreamerName = stream.streamerName;

    stream.viewers.set(socket.id, {
      code: viewer.code,
      nickname: viewer.nickname
    });
    broadcastPresence();

    io.to(streamerSocketId).emit('webrtc:new-viewer', {
      viewerSocketId: socket.id,
      viewerNickname: viewer.nickname,
      viewerCode: viewer.code
    });
  };

  socket.on('stream:watch', handleWatchStream);
  socket.on('stream:join-viewer', handleWatchStream);

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

    broadcastPresence();
  };

  socket.on('stream:unwatch', handleUnwatchStream);
  socket.on('stream:leave-viewer', handleUnwatchStream);

  socket.on('webrtc:offer', ({ targetSocketId, offer }) => {
    io.to(targetSocketId).emit('webrtc:offer', {
      fromSocketId: socket.id,
      fromNickname: socket.user.nickname,
      offer
    });
  });

  socket.on('webrtc:answer', ({ targetSocketId, answer }) => {
    io.to(targetSocketId).emit('webrtc:answer', {
      fromSocketId: socket.id,
      fromNickname: socket.user.nickname,
      answer
    });
  });

  socket.on('webrtc:ice-candidate', ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit('webrtc:ice-candidate', {
      fromSocketId: socket.id,
      candidate
    });
  });

  // Handle Disconnect
  socket.on('disconnect', () => {
    removeUserFromVoiceChannel(socket.id);

    if (memoryStreams.has(socket.id)) {
      cleanupUserStream(socket.id);
    }

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
    }

    onlineUsers.delete(socket.id);
    broadcastPresence();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=============================================`);
  console.log(`  Concord Platform rodando na porta ${PORT}`);
  console.log(`  Painel Admin Code: ${ADMIN_CODE}`);
  console.log(`  Database: ${db.isSupabaseConfigured() ? 'Supabase' : 'Local Persistence (Supabase Compatible)'}`);
  console.log(`  Acesse: http://localhost:${PORT}`);
  console.log(`=============================================`);
});
