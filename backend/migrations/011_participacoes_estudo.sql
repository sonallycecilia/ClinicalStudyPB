CREATE TABLE participacoes_estudo (
  id_participacao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_candidato UUID NOT NULL UNIQUE REFERENCES candidatos(id_candidato),
  data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'Ativo'
    CHECK (status IN ('Ativo', 'Retirado', 'Concluído')),
  data_retirada DATE,
  motivo_retirada TEXT,
  CONSTRAINT participacoes_retirada_coerente CHECK (
    (status = 'Retirado' AND data_retirada IS NOT NULL)
    OR (status <> 'Retirado' AND data_retirada IS NULL)
  ),
  CONSTRAINT participacoes_datas_validas CHECK (
    data_retirada IS NULL OR data_retirada >= data_inclusao
  )
);
 
CREATE INDEX participacoes_status_idx ON participacoes_estudo(status);