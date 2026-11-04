export interface PlannedVisit {
  id: string;
  studyId: string;
  name: string;
  order: number;
  intervalDays: number | null;
  description: string | null;
}

export interface VisitActivity {
  id: string;
  visitId: string;
  name: string;
  description: string | null;
  type: string;
}

export interface CreatePlannedVisitInput {
  name: string;
  order: number;
  intervalDays?: number | null;
  description?: string | null;
}

export interface CreateVisitActivityInput {
  name: string;
  description?: string | null;
  type: string;
}
