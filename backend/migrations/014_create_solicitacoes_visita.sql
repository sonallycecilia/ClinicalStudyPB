CREATE TABLE solicitacoes_visita (
  id_solicitacao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_visita UUID NOT NULL REFERENCES visitas(id_visita) ON DELETE CASCADE,
  id_usuario UUID NOT NULL REFERENCES usuarios(id_usuario),
  tipo VARCHAR(25) NOT NULL CHECK (tipo IN ('Confirmação', 'Reagendamento')),
  status VARCHAR(20) NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente', 'Aceita', 'Recusada', 'Cancelada')),
  solicitada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  justificativa TEXT,
  observacao_resposta TEXT
);
 
CREATE INDEX solicitacoes_status_idx ON solicitacoes_visita(status, solicitada_em);