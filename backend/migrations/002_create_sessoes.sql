CREATE TABLE sessoes (
  id_sessao UUID PRIMARY KEY,
  id_usuario UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  expira_em TIMESTAMPTZ NOT NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessoes_usuario_idx ON sessoes(id_usuario);
CREATE INDEX sessoes_expiracao_idx ON sessoes(expira_em);
