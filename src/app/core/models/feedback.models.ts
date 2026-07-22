export type FeedbackStatus = 'draft' | 'submitted' | 'resolved';

export type ConcernLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ProjectFeedback {
  feedback_id: string;
  project_id: string;
  auditor_username: string;
  auditor_name: string;
  feedback_text: string;
  concern_level: ConcernLevel | null;
  likelihood_score: number | null;
  impact_score: number | null;
  risk_score: number | null;
  suggestions: string | null;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  resolved_at: string | null;
}

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  draft: 'ฉบับร่าง',
  submitted: 'ส่งแล้ว',
  resolved: 'แก้ไขแล้ว',
};

export const CONCERN_LEVEL_OPTIONS: ReadonlyArray<{ value: ConcernLevel; label: string }> = [
  { value: 'low', label: 'ต่ำ' },
  { value: 'medium', label: 'ปานกลาง' },
  { value: 'high', label: 'สูง' },
];

export const LIKELIHOOD_OPTIONS: ReadonlyArray<{ value: number; label: string; hint: string }> = [
  { value: 1, label: '1 - ต่ำมาก', hint: 'แทบไม่มีโอกาสเกิดขึ้น' },
  { value: 2, label: '2 - ต่ำ', hint: 'มีโอกาสเกิดขึ้นน้อย' },
  { value: 3, label: '3 - ปานกลาง', hint: 'มีโอกาสเกิดขึ้นปานกลาง' },
  { value: 4, label: '4 - สูง', hint: 'มีโอกาสเกิดขึ้นค่อนข้างสูง' },
  { value: 5, label: '5 - สูงมาก', hint: 'มีโอกาสเกิดขึ้นสูงมากหรือเกิดขึ้นแล้ว' },
];

export const IMPACT_OPTIONS: ReadonlyArray<{ value: number; label: string; hint: string }> = [
  { value: 1, label: '1 - Very Low', hint: 'ผลกระทบน้อยมาก ไม่กระทบการดำเนินโครงการ' },
  { value: 2, label: '2 - Low', hint: 'ผลกระทบน้อย แก้ไขได้ในระดับปฏิบัติงาน' },
  { value: 3, label: '3 - Medium', hint: 'ผลกระทบปานกลาง อาจกระทบงบประมาณหรือระยะเวลา' },
  { value: 4, label: '4 - High', hint: 'ผลกระทบสูง กระทบวัตถุประสงค์ของโครงการ' },
  { value: 5, label: '5 - Very High', hint: 'ผลกระทบรุนแรง อาจนำไปสู่ความเสียหายร้ายแรง' },
];
