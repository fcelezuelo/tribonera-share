import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.CONCORD_DATA_DIR || path.join(__dirname, '..');
const DB_FILE = path.join(DATA_DIR, 'concord_db.json');

// Supabase client instance (lazy / conditional initialization)
let supabase = null;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    console.log('[Database] Conectado ao Supabase com sucesso:', supabaseUrl);
  } catch (err) {
    console.warn('[Database] Falha ao inicializar Supabase Client, utilizando armazenamento local:', err.message);
  }
} else {
  console.log('[Database] Supabase URL/Key não configurados no ambiente. Utilizando armazenamento persistente local com sincronização.');
}

// SQL Schema for Supabase SQL Editor
export const SUPABASE_SCHEMA_SQL = `
-- TABELA DE CÓDIGOS DE CONVITE
CREATE TABLE IF NOT EXISTS public.codes (
  code TEXT PRIMARY KEY,
  used BOOLEAN DEFAULT false,
  role TEXT DEFAULT 'user',
  used_by TEXT,
  created_at BIGINT
);

-- TABELA DE USUÁRIOS
CREATE TABLE IF NOT EXISTS public.users (
  code TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  token TEXT NOT NULL UNIQUE,
  avatar TEXT,
  status TEXT DEFAULT '🟢 Online',
  custom_status TEXT,
  created_at BIGINT
);

-- TABELA DE SERVIDORES (GUILDS)
CREATE TABLE IF NOT EXISTS public.servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  owner_code TEXT REFERENCES public.users(code) ON DELETE CASCADE,
  created_at BIGINT
);

-- TABELA DE CANAIS (TEXTO E VOZ)
CREATE TABLE IF NOT EXISTS public.channels (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'text' ou 'voice'
  category TEXT DEFAULT 'Canais Gerais',
  topic TEXT,
  position INT DEFAULT 0,
  created_at BIGINT
);

-- TABELA DE MENSAGENS DE CHAT
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  user_code TEXT NOT NULL,
  user_nickname TEXT NOT NULL,
  user_avatar TEXT,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at BIGINT
);
`;

// Initial default seed structure for a rich Discord experience
function getDefaultSeed() {
  const adminCode = process.env.ADMIN_CODE || 'FELLMASTER123';
  return {
    codes: [
      { code: adminCode, used: true, role: 'admin', usedBy: 'Fellipe (Admin)', createdAt: Date.now() },
      { code: 'VIP2026', used: false, role: 'user', usedBy: null, createdAt: Date.now() },
      { code: 'GUEST7', used: false, role: 'user', usedBy: null, createdAt: Date.now() }
    ],
    users: [
      {
        code: adminCode,
        nickname: 'Fellipe (Admin)',
        role: 'admin',
        token: 'admin-token-fellmaster123-perm',
        avatar: null,
        status: '🟢 Online',
        custom_status: 'Criador do Concord',
        createdAt: Date.now()
      }
    ],
    servers: [
      {
        id: 'concord-main',
        name: 'Comunidade Concord',
        icon: '/img/concord_icon.png',
        ownerCode: adminCode,
        createdAt: Date.now()
      }
    ],
    channels: [
      // Text Channels
      { id: 'c-geral', serverId: 'concord-main', name: 'geral', type: 'text', category: 'CANAIS DE TEXTO', topic: 'Bate-papo principal da comunidade', position: 0, createdAt: Date.now() },
      { id: 'c-jogos', serverId: 'concord-main', name: 'jogos-e-gameplay', type: 'text', category: 'CANAIS DE TEXTO', topic: 'Discussões de jogos, clipes e novidades', position: 1, createdAt: Date.now() },
      { id: 'c-midia', serverId: 'concord-main', name: 'fotos-e-clips', type: 'text', category: 'CANAIS DE TEXTO', topic: 'Compartilhe screenshots e memes', position: 2, createdAt: Date.now() },
      { id: 'c-avisos', serverId: 'concord-main', name: 'avisos-e-regras', type: 'text', category: 'CANAIS DE TEXTO', topic: 'Anúncios importantes da comunidade', position: 3, createdAt: Date.now() },
      
      // Voice Channels
      { id: 'v-geral', serverId: 'concord-main', name: '🔊 Geral - Conversa', type: 'voice', category: 'SALAS DE VOZ', topic: 'Sala de voz principal para bater papo', position: 0, createdAt: Date.now() },
      { id: 'v-jogos1', serverId: 'concord-main', name: '🎮 Sala de Jogos #1', type: 'voice', category: 'SALAS DE VOZ', topic: 'Call para partidas em squad', position: 1, createdAt: Date.now() },
      { id: 'v-stream', serverId: 'concord-main', name: '📺 Sala de Transmissão / Cinema', type: 'voice', category: 'SALAS DE VOZ', topic: 'Transmita gameplay e assista junto', position: 2, createdAt: Date.now() },
      { id: 'v-chill', serverId: 'concord-main', name: '☕ Lounge / Chill', type: 'voice', category: 'SALAS DE VOZ', topic: 'Música e conversa relaxante', position: 3, createdAt: Date.now() }
    ],
    messages: [
      {
        id: 'msg-welcome-1',
        channelId: 'c-geral',
        serverId: 'concord-main',
        userCode: adminCode,
        userNickname: 'Fellipe (Admin)',
        userAvatar: null,
        content: '👋 Bem-vindos ao **Concord**! Agora com salas completas de voz, canais de texto, transmissão de tela de alta qualidade e persistência via banco de dados.',
        attachments: [],
        createdAt: Date.now() - 3600000
      }
    ]
  };
}

// Local Storage Manager with safe file reading/writing
class LocalDB {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.users && parsed.channels) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('[Database] Erro ao ler concord_db.json:', e);
    }
    const seed = getDefaultSeed();
    this.save(seed);
    return seed;
  }

  save(dataToSave = this.data) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
    } catch (e) {
      console.error('[Database] Erro ao gravar concord_db.json:', e);
    }
  }
}

const localDB = new LocalDB();

// Unified DB Service Repository (Supabase with instant Local Fallback)
export const db = {
  isSupabaseConfigured() {
    return !!(supabaseUrl && supabaseKey && supabase);
  },

  getSupabaseClient() {
    return supabase;
  },

  // --- CODES ---
  async getCodes() {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('codes').select('*');
        if (!error && data && data.length > 0) return data;
      } catch (err) {
        console.warn('[Supabase getCodes fallback]:', err.message);
      }
    }
    return localDB.data.codes;
  },

  async findCode(codeStr) {
    const norm = (codeStr || '').trim().toUpperCase();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('codes').select('*').eq('code', norm).single();
        if (!error && data) return data;
      } catch (err) {
        // Fallback
      }
    }
    return localDB.data.codes.find(c => c.code === norm) || null;
  },

  async createCode(codeObj) {
    localDB.data.codes.push(codeObj);
    localDB.save();
    if (supabase) {
      try {
        await supabase.from('codes').insert([{
          code: codeObj.code,
          used: codeObj.used,
          role: codeObj.role,
          used_by: codeObj.usedBy,
          created_at: codeObj.createdAt
        }]);
      } catch (err) {
        console.warn('[Supabase insert code error]:', err.message);
      }
    }
    return codeObj;
  },

  async updateCode(codeStr, updates) {
    const norm = (codeStr || '').trim().toUpperCase();
    const idx = localDB.data.codes.findIndex(c => c.code === norm);
    if (idx !== -1) {
      localDB.data.codes[idx] = { ...localDB.data.codes[idx], ...updates };
      localDB.save();
    }
    if (supabase) {
      try {
        await supabase.from('codes').update(updates).eq('code', norm);
      } catch (err) {
        console.warn('[Supabase update code error]:', err.message);
      }
    }
  },

  async deleteCode(codeStr) {
    const norm = (codeStr || '').trim().toUpperCase();
    localDB.data.codes = localDB.data.codes.filter(c => c.code !== norm);
    localDB.save();
    if (supabase) {
      try {
        await supabase.from('codes').delete().eq('code', norm);
      } catch (err) {}
    }
  },

  // --- USERS ---
  async getUsers() {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('users').select('*');
        if (!error && data && data.length > 0) return data;
      } catch (err) {}
    }
    return localDB.data.users;
  },

  async findUserByToken(token) {
    if (!token) return null;
    if (supabase) {
      try {
        const { data, error } = await supabase.from('users').select('*').eq('token', token).single();
        if (!error && data) return data;
      } catch (err) {}
    }
    return localDB.data.users.find(u => u.token === token) || null;
  },

  async findUserByCode(codeStr) {
    const norm = (codeStr || '').trim().toUpperCase();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('users').select('*').eq('code', norm).single();
        if (!error && data) return data;
      } catch (err) {}
    }
    return localDB.data.users.find(u => u.code === norm) || null;
  },

  async findUserByNickname(nickname) {
    const norm = (nickname || '').trim().toLowerCase();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('users').select('*').ilike('nickname', norm).single();
        if (!error && data) return data;
      } catch (err) {}
    }
    return localDB.data.users.find(u => u.nickname.toLowerCase() === norm) || null;
  },

  async createUser(userObj) {
    localDB.data.users.push(userObj);
    localDB.save();
    if (supabase) {
      try {
        await supabase.from('users').insert([{
          code: userObj.code,
          nickname: userObj.nickname,
          role: userObj.role,
          token: userObj.token,
          avatar: userObj.avatar || null,
          status: userObj.status || '🟢 Online',
          custom_status: userObj.custom_status || '',
          created_at: userObj.createdAt
        }]);
      } catch (err) {
        console.warn('[Supabase create user error]:', err.message);
      }
    }
    return userObj;
  },

  async deleteUser(codeStr) {
    const norm = (codeStr || '').trim().toUpperCase();
    localDB.data.users = localDB.data.users.filter(u => u.code !== norm);
    localDB.save();
    if (supabase) {
      try {
        await supabase.from('users').delete().eq('code', norm);
      } catch (err) {}
    }
  },

  // --- SERVERS & CHANNELS ---
  async getServers() {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('servers').select('*');
        if (!error && data && data.length > 0) return data;
      } catch (err) {}
    }
    return localDB.data.servers;
  },

  async getChannels(serverId = 'concord-main') {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('channels').select('*').eq('server_id', serverId).order('position');
        if (!error && data && data.length > 0) return data;
      } catch (err) {}
    }
    return localDB.data.channels.filter(c => !serverId || c.serverId === serverId);
  },

  async createChannel({ serverId = 'concord-main', name, type = 'text', category = 'CANAIS DE TEXTO', topic = '' }) {
    const id = `c-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const cleanName = type === 'text' ? name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '') : name.trim();
    const newChan = {
      id,
      serverId,
      name: cleanName,
      type,
      category: category || (type === 'voice' ? 'SALAS DE VOZ' : 'CANAIS DE TEXTO'),
      topic: topic || '',
      position: localDB.data.channels.length,
      createdAt: Date.now()
    };
    localDB.data.channels.push(newChan);
    localDB.save();

    if (supabase) {
      try {
        await supabase.from('channels').insert([{
          id: newChan.id,
          server_id: newChan.serverId,
          name: newChan.name,
          type: newChan.type,
          category: newChan.category,
          topic: newChan.topic,
          position: newChan.position,
          created_at: newChan.createdAt
        }]);
      } catch (err) {
        console.warn('[Supabase create channel error]:', err.message);
      }
    }
    return newChan;
  },

  async deleteChannel(channelId) {
    localDB.data.channels = localDB.data.channels.filter(c => c.id !== channelId);
    localDB.data.messages = localDB.data.messages.filter(m => m.channelId !== channelId);
    localDB.save();

    if (supabase) {
      try {
        await supabase.from('channels').delete().eq('id', channelId);
        await supabase.from('messages').delete().eq('channel_id', channelId);
      } catch (err) {}
    }
  },

  // --- MESSAGES ---
  async getMessages(channelId, limit = 50) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('channel_id', channelId)
          .order('created_at', { ascending: true })
          .limit(limit);
        if (!error && data) {
          return data.map(m => ({
            id: m.id,
            channelId: m.channel_id,
            serverId: m.server_id,
            userCode: m.user_code,
            userNickname: m.user_nickname,
            userAvatar: m.user_avatar,
            content: m.content,
            attachments: m.attachments || [],
            createdAt: m.created_at
          }));
        }
      } catch (err) {}
    }
    return localDB.data.messages
      .filter(m => m.channelId === channelId)
      .slice(-limit);
  },

  async createMessage({ channelId, serverId = 'concord-main', userCode, userNickname, userAvatar, content, attachments = [] }) {
    const id = `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const newMsg = {
      id,
      channelId,
      serverId,
      userCode,
      userNickname,
      userAvatar: userAvatar || null,
      content: content.trim(),
      attachments,
      createdAt: Date.now()
    };

    localDB.data.messages.push(newMsg);
    // Keep max 2000 messages in local storage to prevent bloating
    if (localDB.data.messages.length > 2000) {
      localDB.data.messages = localDB.data.messages.slice(-1500);
    }
    localDB.save();

    if (supabase) {
      try {
        await supabase.from('messages').insert([{
          id: newMsg.id,
          channel_id: newMsg.channelId,
          server_id: newMsg.serverId,
          user_code: newMsg.userCode,
          user_nickname: newMsg.userNickname,
          user_avatar: newMsg.userAvatar,
          content: newMsg.content,
          attachments: newMsg.attachments,
          created_at: newMsg.createdAt
        }]);
      } catch (err) {
        console.warn('[Supabase create message error]:', err.message);
      }
    }
    return newMsg;
  }
};
