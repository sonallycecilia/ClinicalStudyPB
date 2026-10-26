CREATE TABLE resultados_avaliacao (
  id_resultado UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_visita UUID NOT NULL REFERENCES visitas(id_visita) ON DELETE CASCADE,
  id_atividade UUID NOT NULL REFERENCES atividades_visita(id_atividade),
  id_registrado_por UUID NOT NULL REFERENCES usuarios(id_usuario),
  valor_ficticio TEXT,
  unidade VARCHAR(50),
  observacao TEXT,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT resultados_visita_atividade_unico UNIQUE (id_visita, id_atividade)
);
 
CREATE INDEX resultados_visita_idx ON resultados_avaliacao(id_visita);