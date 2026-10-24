CREATE TABLE usuarios (
  id_usuario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(200) NOT NULL CHECK (char_length(btrim(nome)) >= 3),
  email VARCHAR(254) NOT NULL CHECK (email = lower(btrim(email)) AND email <> ''),
  telefone VARCHAR(30),
  senha_hash TEXT NOT NULL CHECK (senha_hash <> ''),
  senha_salt TEXT NOT NULL CHECK (senha_salt <> ''),
  perfil VARCHAR(30) NOT NULL CHECK (
    perfil IN ('Administrador', 'Pesquisador', 'Coordenador', 'Participante')
  ),
  status VARCHAR(10) NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_email_unico UNIQUE (email)
);
