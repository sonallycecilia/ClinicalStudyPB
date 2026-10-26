CREATE TABLE consentimentos (
  id_consentimento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_candidato UUID NOT NULL REFERENCES candidatos(id_candidato) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('Registrado', 'Recusado', 'Revogado')),
  versao_termo VARCHAR(50) NOT NULL,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_registrado_por UUID NOT NULL REFERENCES usuarios(id_usuario),
  observacao TEXT
);
 
CREATE INDEX consentimentos_candidato_data_idx ON consentimentos(id_candidato, registrado_em DESC);