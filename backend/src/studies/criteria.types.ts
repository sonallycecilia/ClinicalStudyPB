export type CriterionType = 'Inclusão' | 'Exclusão';

export interface EligibilityCriterion {
  id: string;
  studyId: string;
  type: CriterionType;
  description: string;
  active: boolean;
}

export interface CreateCriterionInput {
  type: CriterionType;
  description: string;
  active?: boolean;
}

export type UpdateCriterionInput = Partial<CreateCriterionInput>;
