import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

const DATA_DIR = process.env.CONCORD_DATA_DIR || ROOT_DIR;
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CODES_FILE = path.join(DATA_DIR, 'codes.json');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase = null;
let isSupabaseConfigured = false;
let supabaseTablesExist = false;

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
    isSupabaseConfigured = true;
    console.log('[Supabase] Cliente inicializado com sucesso para:', SUPABASE_URL);
  } catch (err) {
    console.error('[Supabase] Erro ao inicializar cliente Supabase:', err.message);
  }
} else {
  console.log('[Supabase] Operando com persistência JSON local e espelhamento Supabase pronto.');
}

// Verifica se as tabelas remotas realmente existem no Supabase
async function verifySupabaseTables() {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    const { error: err1 } = await supabase.from('invite_codes').select('code').limit(1);
    const { error: err2 } = await supabase.from('users').select('id').limit(1);
    
    if (!err1 && !err2) {
      supabaseTablesExist = true;
      return true;
    }
    supabaseTablesExist = false;
    return false;
  } catch (e) {
    supabaseTablesExist = false;
    return false;
  }
}

// Helpers para hashing de senha seguro
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, storedHash, salt) {
  if (!storedHash || !salt) return false;
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

// Helpers de arquivo JSON local (fallback e sincronização offline)
function readJSON(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      writeJSON(filePath, defaultValue);
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data || JSON.stringify(defaultValue));
  } catch (err) {
    console.error(`Erro ao ler ${filePath}:`, err);
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
    console.error(`Erro ao escrever em ${filePath}:`, err);
  }
}

export const db = {
  isSupabase: () => isSupabaseConfigured && supabaseTablesExist,
  getSupabaseStatus: async () => {
    const hasTables = await verifySupabaseTables();
    return {
      configured: isSupabaseConfigured,
      tablesExist: hasTables,
      url: SUPABASE_URL ? SUPABASE_URL.replace(/^(https?:\/\/[^/]+).*/, '$1') : null,
      mode: hasTables ? 'supabase_cloud' : 'local_with_supabase_fallback'
    };
  },

  // Inicializar dados padrão
  async init(adminCode, adminPassword = 'admin') {
    const defaultCodes = readJSON(CODES_FILE, []);
    const defaultUsers = readJSON(USERS_FILE, []);

    // Criar código do admin se não existir
    if (!defaultCodes.some(c => c.code === adminCode)) {
      defaultCodes.push({
        code: adminCode,
        used: true,
        role: 'admin',
        createdAt: Date.now()
      });
      writeJSON(CODES_FILE, defaultCodes);
    }

    // Criar usuário do admin com senha padrão criptografada
    let adminUser = defaultUsers.find(u => u.code === adminCode);
    if (!adminUser) {
      const { hash, salt } = hashPassword(adminPassword);
      adminUser = {
        id: 'admin-' + crypto.randomBytes(6).toString('hex'),
        code: adminCode,
        nickname: 'Fellipe (Admin)',
        username: 'admin',
        password_hash: hash,
        salt: salt,
        role: 'admin',
        token: 'admin-token-fellmaster123-perm',
        createdAt: Date.now()
      };
      defaultUsers.push(adminUser);
      writeJSON(USERS_FILE, defaultUsers);
    }

    // Verificar se tabelas do Supabase existem e sincronizar
    const tablesReady = await verifySupabaseTables();
    if (tablesReady && supabase) {
      try {
        const { data: remoteCode } = await supabase
          .from('invite_codes')
          .select('code')
          .eq('code', adminCode)
          .maybeSingle();

        if (!remoteCode) {
          await supabase.from('invite_codes').insert({
            code: adminCode,
            used: true,
            role: 'admin',
            created_at: new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn('[Supabase Sync Warn]:', err.message);
      }
    }
  },

  // Obter todos os códigos
  async getCodes() {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('invite_codes')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map(item => ({
            code: item.code,
            used: item.used,
            role: item.role || 'user',
            usedBy: item.used_by || null,
            createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now()
          }));
        }
      } catch (err) {
        console.warn('[Supabase getCodes fallback to local]:', err.message);
      }
    }
    return readJSON(CODES_FILE, []);
  },

  // Buscar um código específico
  async findCode(code) {
    const normalized = code.trim().toUpperCase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('invite_codes')
          .select('*')
          .eq('code', normalized)
          .maybeSingle();

        if (!error && data) {
          return {
            code: data.code,
            used: data.used,
            role: data.role || 'user',
            usedBy: data.used_by || null,
            createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now()
          };
        }
      } catch (err) {
        console.warn('[Supabase findCode fallback]:', err.message);
      }
    }
    const codes = readJSON(CODES_FILE, []);
    return codes.find(c => c.code === normalized) || null;
  },

  // Inserir novo código
  async createCode(newCode, role = 'user') {
    const entry = {
      code: newCode,
      used: false,
      role: role,
      createdAt: Date.now()
    };

    // Salvar no JSON local
    const codes = readJSON(CODES_FILE, []);
    codes.push(entry);
    writeJSON(CODES_FILE, codes);

    // Salvar no Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('invite_codes').insert({
          code: newCode,
          used: false,
          role: role,
          created_at: new Date().toISOString()
        });
      } catch (err) {
        console.warn('[Supabase createCode error]:', err.message);
      }
    }

    return entry;
  },

  // Revogar código
  async revokeCode(code) {
    const normalized = code.trim().toUpperCase();
    
    // Remover do JSON local
    let codes = readJSON(CODES_FILE, []);
    codes = codes.filter(c => c.code !== normalized);
    writeJSON(CODES_FILE, codes);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('invite_codes').delete().eq('code', normalized);
      } catch (err) {
        console.warn('[Supabase revokeCode error]:', err.message);
      }
    }
  },

  // Marcar código como usado
  async markCodeUsed(code, nickname) {
    const normalized = code.trim().toUpperCase();
    
    const codes = readJSON(CODES_FILE, []);
    const idx = codes.findIndex(c => c.code === normalized);
    if (idx !== -1) {
      codes[idx].used = true;
      codes[idx].usedBy = nickname;
      codes[idx].usedAt = Date.now();
      writeJSON(CODES_FILE, codes);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('invite_codes')
          .update({
            used: true,
            used_by: nickname,
            used_at: new Date().toISOString()
          })
          .eq('code', normalized);
      } catch (err) {
        console.warn('[Supabase markCodeUsed error]:', err.message);
      }
    }
  },

  // Obter todos os usuários
  async getUsers() {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data.map(u => ({
            id: u.id,
            code: u.code,
            nickname: u.nickname || u.username,
            username: u.username || u.nickname,
            password_hash: u.password_hash,
            salt: u.salt,
            role: u.role || 'user',
            token: u.token,
            createdAt: u.created_at ? new Date(u.created_at).getTime() : Date.now()
          }));
        }
      } catch (err) {
        console.warn('[Supabase getUsers fallback to local]:', err.message);
      }
    }
    return readJSON(USERS_FILE, []);
  },

  // Buscar usuário por token
  async findUserByToken(token) {
    if (!token) return null;
    const users = await this.getUsers();
    return users.find(u => u.token === token) || null;
  },

  // Buscar todos os usuários compatíveis com um identificador
  async findUsersByIdentifier(identifier) {
    if (!identifier) return [];
    const cleaned = identifier.trim();
    const cleanedLower = cleaned.toLowerCase();
    const users = await this.getUsers();
    return users.filter(u => 
      (u.nickname && u.nickname.toLowerCase() === cleanedLower) ||
      (u.username && u.username.toLowerCase() === cleanedLower) ||
      (u.code && u.code.toUpperCase() === cleaned.toUpperCase()) ||
      (cleaned.toUpperCase() === 'FELLMASTER123' && u.role === 'admin')
    );
  },

  // Buscar usuário por username ou nickname ou code (prioriza contas com senha)
  async findUserByIdentifier(identifier) {
    if (!identifier) return null;
    const candidates = await this.findUsersByIdentifier(identifier);
    if (!candidates || candidates.length === 0) return null;
    // Prioritize candidates with configured password_hash
    const withPassword = candidates.find(u => u.password_hash && u.salt);
    return withPassword || candidates[0];
  },

  // Criar novo usuário com senha
  async createUser({ code, nickname, username, password, role = 'user' }) {
    const users = readJSON(USERS_FILE, []);
    const { hash, salt } = hashPassword(password);
    const token = `tb_${crypto.randomBytes(24).toString('hex')}`;
    const id = 'usr_' + crypto.randomBytes(8).toString('hex');

    const newUser = {
      id,
      code: code.trim().toUpperCase(),
      nickname: nickname.trim(),
      username: (username || nickname).trim().toLowerCase(),
      password_hash: hash,
      salt: salt,
      role,
      token,
      createdAt: Date.now()
    };

    users.push(newUser);
    writeJSON(USERS_FILE, users);

    // Marcar código como usado
    await this.markCodeUsed(code, nickname);

    // Salvar no Supabase se ativo
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('users').insert({
          id,
          code: newUser.code,
          nickname: newUser.nickname,
          username: newUser.username,
          password_hash: hash,
          salt: salt,
          role: newUser.role,
          token: newUser.token,
          created_at: new Date().toISOString()
        });
      } catch (err) {
        console.warn('[Supabase createUser error]:', err.message);
      }
    }

    return newUser;
  },

  // Remover usuário permanentemente
  async removeUser(code) {
    const normalized = code.trim().toUpperCase();

    // Local JSON
    let users = readJSON(USERS_FILE, []);
    users = users.filter(u => u.code !== normalized);
    writeJSON(USERS_FILE, users);

    let codes = readJSON(CODES_FILE, []);
    codes = codes.filter(c => c.code !== normalized);
    writeJSON(CODES_FILE, codes);

    // Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('users').delete().eq('code', normalized);
        await supabase.from('invite_codes').delete().eq('code', normalized);
      } catch (err) {
        console.warn('[Supabase removeUser error]:', err.message);
      }
    }
  }
};
