-- entidade_id é UUID (no modelo era BIGINT) porque todas as chaves do banco são UUID.
CREATE TABLE auditoria (
  id_auditoria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  acao VARCHAR(100) NOT NULL,
  entidade VARCHAR(100) NOT NULL,
  entidade_id UUID,
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  detalhes TEXT
);
 
CREATE INDEX auditoria_usuario_data_idx ON auditoria(id_usuario, data_hora DESC);