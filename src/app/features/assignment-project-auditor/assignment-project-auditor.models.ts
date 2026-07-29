export type AssignmentPriority = 'high' | 'normal' | 'low';
export type AssignmentWorkflowStatus =
  | 'in_progress'
  | 'under_review'
  | 'completed';

export const ASSIGNMENT_WORKFLOW_STATUS_LABELS: Record<AssignmentWorkflowStatus, string> = {
  in_progress: 'กำลังดำเนินการ',
  under_review: 'อยู่ระหว่างสอบทาน',
  completed: 'เสร็จสิ้น',
};

export const PROJECT_WORKFLOW_STATUS_LABELS: Record<AssignmentWorkflowStatus, string> = {
  in_progress: 'กำลังดำเนินการ',
  under_review: 'อยู่ระหว่างสอบทาน',
  completed: 'เสร็จสิ้น',
};

export interface Analyst {
  id: string;
  name: string;
  username?: string;
  entityType?: string;
  userLabel?: string;
  team: string;
  activeCases: number;
  specialties: string[];
}

export interface SavedAssignment {
  assignmentId?: number;
  projectId: string;
  analystId: string;
  analystName?: string;
  analystTeam?: string;
  analystUserLabel?: string;
  analystEntityType?: string;
  assignedAt: string;
  priority?: AssignmentPriority;
  note: string;
  dueDate?: string;
  budgetHours?: number;
  auditSteps?: string;
  workProcess?: string;
  workObjective?: string;
  workflowStatus?: AssignmentWorkflowStatus;
  assignedBy?: string;
  reviewNote?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export const ASSIGNMENT_STORAGE_KEY = 'finrisk_assignment_project_auditor';

export function assignmentWorkflowStatusLabel(status?: AssignmentWorkflowStatus | null): string {
  return status ? ASSIGNMENT_WORKFLOW_STATUS_LABELS[status] : 'ไม่ระบุสถานะ';
}

export function assignmentWorkflowStatusBadgeClass(
  status?: AssignmentWorkflowStatus | null,
): string {
  switch (status) {
    case 'in_progress':
      return 'bg-blue-100 text-navy';
    case 'under_review':
      return 'bg-purple-100 text-purple-700';
    case 'completed':
      return 'bg-green-100 text-risk-low';
  }
  return 'bg-slate-100 text-slate-600';
}

export function projectWorkflowStatusLabel(status?: AssignmentWorkflowStatus | null): string {
  return status ? PROJECT_WORKFLOW_STATUS_LABELS[status] : 'รอมอบหมายงาน';
}

export function projectWorkflowStatusBadgeClass(status?: AssignmentWorkflowStatus | null): string {
  if (!status) return 'bg-slate-100 text-slate-600';
  switch (status) {
    case 'in_progress':
      return 'bg-blue-100 text-navy';
    case 'under_review':
      return 'bg-purple-100 text-purple-700';
    case 'completed':
      return 'bg-green-100 text-risk-low';
  }
}

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
