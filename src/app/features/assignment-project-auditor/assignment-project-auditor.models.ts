export type AssignmentPriority = 'high' | 'normal' | 'low';
export type AssignmentWorkflowStatus =
  | 'waiting_acceptance'
  | 'accepted'
  | 'in_progress'
  | 'clarification_needed'
  | 'ready_for_review'
  | 'under_review'
  | 'revision_requested'
  | 'completed';

export const DEFAULT_ASSIGNMENT_WORKFLOW_STATUS: AssignmentWorkflowStatus = 'waiting_acceptance';

export const ASSIGNMENT_WORKFLOW_STATUS_LABELS: Record<AssignmentWorkflowStatus, string> = {
  waiting_acceptance: 'รอผู้รับงานตอบรับ',
  accepted: 'รับงานแล้ว',
  in_progress: 'กำลังดำเนินการ',
  clarification_needed: 'ขอคำชี้แจง',
  ready_for_review: 'ส่งงานให้ตรวจทาน',
  under_review: 'อยู่ระหว่างสอบทาน',
  revision_requested: 'ส่งกลับแก้ไข',
  completed: 'เสร็จสิ้น',
};

export const PROJECT_WORKFLOW_STATUS_LABELS: Record<AssignmentWorkflowStatus, string> = {
  waiting_acceptance: 'รอผู้รับงานตอบรับ',
  accepted: 'อยู่ระหว่างตรวจสอบ',
  in_progress: 'อยู่ระหว่างตรวจสอบ',
  clarification_needed: 'รอคำชี้แจง',
  ready_for_review: 'รอสอบทาน',
  under_review: 'รอสอบทาน',
  revision_requested: 'ส่งกลับแก้ไข',
  completed: 'ตรวจสอบเสร็จสิ้น',
};

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
  workflowStatus?: AssignmentWorkflowStatus;
  assignedBy?: string;
  reviewNote?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export const ASSIGNMENT_STORAGE_KEY = 'finrisk_assignment_project_auditor';

export function assignmentWorkflowStatusLabel(status?: AssignmentWorkflowStatus | null): string {
  return ASSIGNMENT_WORKFLOW_STATUS_LABELS[status ?? DEFAULT_ASSIGNMENT_WORKFLOW_STATUS];
}

export function assignmentWorkflowStatusBadgeClass(status?: AssignmentWorkflowStatus | null): string {
  switch (status ?? DEFAULT_ASSIGNMENT_WORKFLOW_STATUS) {
    case 'waiting_acceptance':
      return 'bg-orange-100 text-risk-medium';
    case 'accepted':
    case 'in_progress':
      return 'bg-blue-100 text-navy';
    case 'clarification_needed':
    case 'revision_requested':
      return 'bg-red-100 text-risk-high';
    case 'ready_for_review':
    case 'under_review':
      return 'bg-purple-100 text-purple-700';
    case 'completed':
      return 'bg-green-100 text-risk-low';
  }
}

export function projectWorkflowStatusLabel(status?: AssignmentWorkflowStatus | null): string {
  return status ? PROJECT_WORKFLOW_STATUS_LABELS[status] : 'รอมอบหมายงาน';
}

export function projectWorkflowStatusBadgeClass(status?: AssignmentWorkflowStatus | null): string {
  if (!status) return 'bg-slate-100 text-slate-600';
  switch (status) {
    case 'waiting_acceptance':
      return 'bg-orange-100 text-risk-medium';
    case 'accepted':
    case 'in_progress':
      return 'bg-blue-100 text-navy';
    case 'clarification_needed':
    case 'revision_requested':
      return 'bg-red-100 text-risk-high';
    case 'ready_for_review':
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
