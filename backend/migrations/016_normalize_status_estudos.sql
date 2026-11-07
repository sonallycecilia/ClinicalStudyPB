ALTER TABLE estudos DROP CONSTRAINT IF EXISTS estudos_status_check;

UPDATE estudos
SET status = CASE status
  WHEN 'Planejamento' THEN 'planejamento'
  WHEN 'Recrutamento' THEN 'recrutamento'
  WHEN 'Execução' THEN 'execução'
  WHEN 'Encerrado' THEN 'encerrado'
  ELSE status
END;

ALTER TABLE estudos
  ALTER COLUMN status SET DEFAULT 'planejamento',
  ADD CONSTRAINT estudos_status_check
    CHECK (status IN ('planejamento', 'recrutamento', 'execução', 'encerrado'));
