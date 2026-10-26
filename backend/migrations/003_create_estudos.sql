-- Estudos são persistidos no PostgreSQL para manter o cadastro entre sessões e reinícios.
-- A responsabilidade pelo estudo vem do token autenticado, nunca de um campo enviado pelo cliente.
CREATE SEQUENCE estudos_codigo_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE estudos (
  id_estudo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20) NOT NULL UNIQUE,
  titulo VARCHAR(200) NOT NULL CHECK (char_length(btrim(titulo)) >= 3),
  objetivo TEXT NOT NULL CHECK (char_length(btrim(objetivo)) >= 8),
  id_pesquisador UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  limite_participantes INTEGER NOT NULL CHECK (limite_participantes >= 1),
  participantes_vinculados INTEGER NOT NULL DEFAULT 0 CHECK (participantes_vinculados >= 0),
  tipo VARCHAR(40) NOT NULL DEFAULT 'Estudo observacional'
    CHECK (tipo IN ('Estudo observacional', 'Estudo longitudinal')),
  simbolo VARCHAR(20) NOT NULL DEFAULT 'activity'
    CHECK (simbolo IN ('moon', 'heart', 'activity')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT estudos_datas_validas CHECK (data_fim >= data_inicio),
  CONSTRAINT estudos_participantes_no_limite CHECK (participantes_vinculados <= limite_participantes)
);

CREATE INDEX estudos_pesquisador_idx ON estudos(id_pesquisador);
CREATE INDEX estudos_data_inicio_idx ON estudos(data_inicio);
