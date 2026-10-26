CREATE TABLE atividades_visita (
  id_atividade UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_visita_prevista UUID NOT NULL
    REFERENCES visitas_previstas(id_visita_prevista) ON DELETE CASCADE,
  nome VARCHAR(150) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) NOT NULL
);