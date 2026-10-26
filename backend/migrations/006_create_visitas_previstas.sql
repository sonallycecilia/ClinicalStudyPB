CREATE TABLE visitas_previstas (
  id_visita_prevista UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_estudo UUID NOT NULL REFERENCES estudos(id_estudo) ON DELETE CASCADE,
  nome VARCHAR(150) NOT NULL,
  ordem INTEGER NOT NULL CHECK (ordem > 0),
  intervalo_dias INTEGER CHECK (intervalo_dias IS NULL OR intervalo_dias >= 0),
  descricao TEXT,
  CONSTRAINT visitas_previstas_ordem_unica UNIQUE (id_estudo, ordem),
  CONSTRAINT visitas_previstas_estudo_id_unico UNIQUE (id_estudo, id_visita_prevista)
);
 
CREATE INDEX visitas_previstas_estudo_idx ON visitas_previstas(id_estudo);