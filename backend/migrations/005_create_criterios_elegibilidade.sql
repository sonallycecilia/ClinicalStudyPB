CREATE TABLE criterios_elegibilidade (
  id_criterio UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_estudo UUID NOT NULL REFERENCES estudos(id_estudo) ON DELETE CASCADE,
  tipo VARCHAR(15) NOT NULL CHECK (tipo IN ('Inclusão', 'Exclusão')),
  descricao TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);
 
CREATE INDEX criterios_estudo_idx ON criterios_elegibilidade(id_estudo);