CREATE TABLE avaliacoes_elegibilidade (
  id_avaliacao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_candidato UUID NOT NULL REFERENCES candidatos(id_candidato) ON DELETE CASCADE,
  id_criterio UUID NOT NULL REFERENCES criterios_elegibilidade(id_criterio),
  id_avaliador UUID NOT NULL REFERENCES usuarios(id_usuario),
  resultado VARCHAR(20) NOT NULL CHECK (resultado IN ('Atende', 'Não atende', 'Pendente')),
  observacao TEXT,
  avaliado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT avaliacoes_candidato_criterio_unico UNIQUE (id_candidato, id_criterio)
);
 
CREATE INDEX avaliacoes_candidato_idx ON avaliacoes_elegibilidade(id_candidato);