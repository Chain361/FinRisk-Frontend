import { AuditorFeedback } from '../../core/models/domain.models';
import { toNumber } from './risk-utils';

/** ป้ายสถานะความเห็นผู้ตรวจสอบ (F5/F6) */
export function feedbackStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'draft':
      return 'ฉบับร่าง';
    case 'submitted':
      return 'ส่งแล้ว';
    case 'resolved':
      return 'ปิดเรื่องแล้ว';
    default:
      return 'ไม่ระบุ';
  }
}

/** Tailwind classes ของ chip สถานะ — เทา/น้ำเงิน/เขียว ตาม workflow draft → submitted → resolved */
export function feedbackStatusChipClass(status: string | null | undefined): string {
  switch (status) {
    case 'draft':
      return 'bg-slate-100 text-slate-600 border border-slate-300';
    case 'submitted':
      return 'bg-navy text-white';
    case 'resolved':
      return 'bg-risk-low text-white';
    default:
      return 'bg-slate-100 text-slate-600 border border-slate-300';
  }
}

/** ระดับความกังวลภาษาไทย */
export function concernLabel(level: string | null | undefined): string {
  switch (level) {
    case 'low':
      return 'ต่ำ';
    case 'medium':
      return 'ปานกลาง';
    case 'high':
      return 'สูง';
    default:
      return '-';
  }
}

/** สีของระดับความกังวล — โทนเดียวกับ risk band (เขียว/เหลือง/ส้มแดง) */
export function concernColor(level: string | null | undefined): string {
  switch (level) {
    case 'low':
      return '#15803d';
    case 'medium':
      return '#b45309';
    case 'high':
      return '#c2410c';
    default:
      return '#64748b';
  }
}

/** คะแนนความเสี่ยง = โอกาส × ผลกระทบ (เหมือน backend — null ถ้าขาดค่าใดค่าหนึ่ง) */
export function computeRiskScore(
  likelihood: number | string | null | undefined,
  impact: number | string | null | undefined,
): number | null {
  const l = toNumber(likelihood);
  const i = toNumber(impact);
  return l !== null && i !== null ? l * i : null;
}

/** แปลง timestamp จาก backend ('YYYY-MM-DD HH:MM:SS' UTC) เป็นวันที่ไทยอ่านง่าย */
export function formatFeedbackDate(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** feedback ล่าสุดของแต่ละโครงการ จาก list ที่โหลดมาแล้ว (ใหม่สุดตาม updated_at) */
export function latestOf(
  records: AuditorFeedback[],
  projectId: string | number,
): AuditorFeedback | null {
  const id = String(projectId);
  return (
    records
      .filter((record) => record.project_id === id)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null
  );
}

/** ฉบับที่ auditor คนนี้กำลังทำอยู่สำหรับโครงการนี้ (ยังไม่ resolved) */
export function activeOf(
  records: AuditorFeedback[],
  projectId: string | number,
  username: string,
): AuditorFeedback | null {
  const id = String(projectId);
  return (
    records
      .filter(
        (record) =>
          record.project_id === id &&
          record.auditor_username === username &&
          record.status !== 'resolved',
      )
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null
  );
}
