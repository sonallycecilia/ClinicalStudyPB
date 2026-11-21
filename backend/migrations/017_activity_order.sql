ALTER TABLE atividades_visita
  ADD COLUMN ordem INTEGER;

WITH activity_order AS (
  SELECT
    id_atividade,
    ROW_NUMBER() OVER (
      PARTITION BY id_visita_prevista
      ORDER BY nome, id_atividade
    ) AS ordem
  FROM atividades_visita
)
UPDATE atividades_visita a
SET ordem = activity_order.ordem
FROM activity_order
WHERE a.id_atividade = activity_order.id_atividade;

ALTER TABLE atividades_visita
  ALTER COLUMN ordem SET NOT NULL,
  ADD CONSTRAINT atividades_visita_ordem_positiva CHECK (ordem > 0),
  ADD CONSTRAINT atividades_visita_ordem_unica UNIQUE (id_visita_prevista, ordem);
