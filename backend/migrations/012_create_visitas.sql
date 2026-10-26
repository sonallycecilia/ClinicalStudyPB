CREATE TABLE visitas (
  id_visita UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_participacao UUID NOT NULL REFERENCES participacoes_estudo(id_participacao),
  id_visita_prevista UUID NOT NULL REFERENCES visitas_previstas(id_visita_prevista),
  data_agendada TIMESTAMPTZ NOT NULL,
  data_realizacao TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'Agendada'
    CHECK (status IN ('Agendada', 'Realizada', 'Ausente', 'Cancelada')),
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT visitas_realizacao_coerente CHECK (
    status <> 'Realizada' OR data_realizacao IS NOT NULL
  )
);
 
CREATE INDEX visitas_participacao_data_idx ON visitas(id_participacao, data_agendada);
CREATE INDEX visitas_status_data_idx ON visitas(status, data_agendada);