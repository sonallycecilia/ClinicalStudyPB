-- O modelo prevê o andamento do estudo; a 003 já foi aplicada e não pode ser editada
-- (o migrate.js compara o checksum), então a coluna entra em uma migration própria.
-- Estudos já existentes ficam como 'Planejamento'.
ALTER TABLE estudos
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Planejamento'
    CHECK (status IN ('Planejamento', 'Recrutamento', 'Execução', 'Encerrado'));
 