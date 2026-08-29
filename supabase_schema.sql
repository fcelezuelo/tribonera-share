-- ============================================================================
-- CONCORD - SUPABASE DATABASE SCHEMA
-- Sistema de Autenticação com Senha e Código de Convite Gerado por Admin
-- ============================================================================

-- 1. Tabela de Códigos de Convite (Gerados exclusivamente pelo Administrador)
CREATE TABLE IF NOT EXISTS public.invite_codes (
    code VARCHAR(32) PRIMARY KEY,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    role VARCHAR(32) NOT NULL DEFAULT 'user',
    used_by VARCHAR(64),
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Tabela de Usuários Registrados
CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) NOT NULL REFERENCES public.invite_codes(code) ON DELETE CASCADE,
    nickname VARCHAR(64) NOT NULL UNIQUE,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'user',
    token TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Índices para Otimização de Consultas Rápidas
CREATE INDEX IF NOT EXISTS idx_invite_codes_used ON public.invite_codes(used);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_code ON public.users(code);
CREATE INDEX IF NOT EXISTS idx_users_token ON public.users(token);

-- 4. Habilitar Segurança por Linha (Row Level Security - RLS)
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Acesso
-- Permitir leitura e escrita autenticada ou via Service Role
CREATE POLICY "Allow public read of invite codes status" 
ON public.invite_codes FOR SELECT USING (true);

CREATE POLICY "Allow service role full access on invite_codes" 
ON public.invite_codes FOR ALL USING (true);

CREATE POLICY "Allow service role full access on users" 
ON public.users FOR ALL USING (true);

-- 6. Inserção do Código Master Inicial do Administrador (se não existir)
INSERT INTO public.invite_codes (code, used, role, created_at)
VALUES ('FELLMASTER123', true, 'admin', NOW())
ON CONFLICT (code) DO NOTHING;
