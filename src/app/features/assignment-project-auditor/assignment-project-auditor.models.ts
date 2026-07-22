export type AssignmentPriority = 'high' | 'normal' | 'low';

export interface Analyst {
  id: string;
  name: string;
  team: string;
  activeCases: number;
  specialties: string[];
}

export interface SavedAssignment {
  projectId: string;
  analystId: string;
  assignedAt: string;
  priority?: AssignmentPriority;
  note: string;
  dueDate?: string;
  budgetHours?: number;
  auditSteps?: string;
  assignedBy?: string;
}

export const ASSIGNMENT_STORAGE_KEY = 'finrisk_assignment_project_auditor';

export const ANALYSTS: Analyst[] = [
  {
    id: 'analyst-01',
    name: 'risk_analyst_01',
    team: 'ทีมวิเคราะห์ความเสี่ยงการจัดซื้อจัดจ้าง',
    activeCases: 4,
    specialties: ['จัดซื้อจัดจ้าง', 'ราคากลาง'],
  },
  {
    id: 'analyst-02',
    name: 'risk_analyst_02',
    team: 'ทีมตรวจสอบงบประมาณ',
    activeCases: 2,
    specialties: ['งบประมาณ', 'สัญญา'],
  },
  {
    id: 'analyst-03',
    name: 'risk_analyst_03',
    team: 'ทีมวิเคราะห์ความเสี่ยงการเงิน',
    activeCases: 5,
    specialties: ['การเงิน', 'ความคุ้มค่า'],
  },
];
