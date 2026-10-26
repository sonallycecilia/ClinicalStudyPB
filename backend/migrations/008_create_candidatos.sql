CREATE TABLE candidatos (
  id_candidato UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_estudo UUID NOT NULL REFERENCES estudos(id_estudo),
  id_usuario UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(254),
  status_recrutamento VARCHAR(25) NOT NULL DEFAULT 'Em avaliação'
    CHECK (status_recrutamento IN
      ('Novo', 'Em avaliação', 'Elegível', 'Inelegível', 'Incluído', 'Desistiu')),
  cadastrado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Diverge do modelo (UNIQUE só em usuario_id): um usuário pode ser candidato em
  -- vários estudos, mas não duas vezes no mesmo. Candidatos sem conta (id_usuario nulo)
  -- não são restringidos.
  CONSTRAINT candidatos_estudo_usuario_unico UNIQUE (id_estudo, id_usuario),
  CONSTRAINT candidatos_estudo_id_unico UNIQUE (id_estudo, id_candidato)
);
 
CREATE INDEX candidatos_estudo_status_idx ON candidatos(id_estudo, status_recrutamento);