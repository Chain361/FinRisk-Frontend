/**
 * RiskAnalystApiExtensions
 * 
 * ส่วนขยายของ ApiService สำหรับฝั่ง Risk Analyst
 * เพิ่ม Method ที่จำเป็นสำหรับการปฏิบัติงานของ Analyst
 * 
 * เชื่อมโยงกับ:
 * - ApiService เดิม (core/api/api.service.ts)
 * - AuditAssignment model (core/models/domain.models.ts)
 * - AssignmentWorkflowStatus (assignment-project-auditor.models.ts)
 */

import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AuditAssignment, AssignmentPriority } from '../../core/models/domain.models';

// ─────────────────────────────────────────────────────────────────────────────
// Request / Response Interfaces
// ─────────────────────────────────────────────────────────────────────────────

/** Request body สำหรับอัปเดตสถานะงาน */
export interface UpdateAssignmentStatusRequest {
  status: AuditAssignment['status'];
  clarification_message?: string;
  review_note?: string;
  actual_hours?: number;
}

/** Response หลังจากอัปเดตสถานะ */
export interface UpdateAssignmentStatusResponse {
  assignment_id: number;
  status: AuditAssignment['status'];
  updated_at: string;
  updated_by: string;
}

/** Working Paper Payload */
export interface WorkingPaperPayload {
  assignment_id: number;
  sections: WorkingPaperSectionPayload[];
  evidence_files?: string[];
}

export interface WorkingPaperSectionPayload {
  id: string;
  title: string;
  content: string;
}

/** Clarification Message Payload */
export interface ClarificationPayload {
  assignment_id: number;
  sender: 'analyst' | 'auditor';
  message: string;
}

/** Timesheet Log Payload */
export interface TimesheetLogPayload {
  assignment_id: number;
  hours: number;
  description?: string;
  logged_at: string;
}

/** Finding (ข้อค้นพบ) Payload */
export interface FindingPayload {
  assignment_id: number;
  finding_id?: number;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  recommendation?: string;
  evidence_references?: string[];
}

/** Timesheet Summary Response */
export interface TimesheetSummary {
  assignment_id: number;
  budget_hours?: number;
  actual_hours: number;
  entries: Array<{
    logged_at: string;
    hours: number;
    description?: string;
    logged_by: string;
  }>;
  utilization_percentage: number;
}

/** Clarification Thread Response */
export interface ClarificationThread {
  assignment_id: number;
  messages: Array<{
    id: string;
    sender: 'analyst' | 'auditor';
    sender_name: string;
    message: string;
    created_at: string;
  }>;
}

/** Working Paper Response */
export interface WorkingPaperResponse {
  assignment_id: number;
  sections: Array<{
    id: string;
    title: string;
    content: string;
    updated_at: string;
    updated_by: string;
  }>;
  evidence_files: Array<{
    file_id: string;
    file_name: string;
    file_size: number;
    uploaded_at: string;
    uploaded_by: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Injectable Service (Extension)
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class RiskAnalystApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/audit';

  // ── Assignments ──

  /** ดึงรายการงานที่มอบหมายให้ Analyst คนปัจจุบัน */
  getMyAssignments(): Observable<AuditAssignment[]> {
    return this.http.get<AuditAssignment[]>(`${this.baseUrl}/assignments/me`);
  }

  /** ดึงรายละเอียดงานเฉพาะ */
  getAssignment(assignmentId: number): Observable<AuditAssignment> {
    return this.http.get<AuditAssignment>(`${this.baseUrl}/assignments/${assignmentId}`);
  }

  /** อัปเดตสถานะงาน (Accept, Submit for Review, etc.) */
  updateAssignmentStatus(
    assignmentId: number,
    body: UpdateAssignmentStatusRequest,
  ): Observable<UpdateAssignmentStatusResponse> {
    return this.http.patch<UpdateAssignmentStatusResponse>(
      `${this.baseUrl}/assignments/${assignmentId}/status`,
      body,
    );
  }

  // ── Working Paper ──

  /** ดึง Working Paper ของงาน */
  getWorkingPaper(assignmentId: number): Observable<WorkingPaperResponse> {
    return this.http.get<WorkingPaperResponse>(
      `${this.baseUrl}/assignments/${assignmentId}/working-paper`,
    );
  }

  /** บันทึก/อัปเดต Working Paper */
  saveWorkingPaper(body: WorkingPaperPayload): Observable<WorkingPaperResponse> {
    return this.http.put<WorkingPaperResponse>(
      `${this.baseUrl}/assignments/${body.assignment_id}/working-paper`,
      body,
    );
  }

  // ── Evidence ──

  /** อัปโหลดไฟล์หลักฐาน */
  uploadEvidence(assignmentId: number, file: File): Observable<{ file_id: string; file_name: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ file_id: string; file_name: string }>(
      `${this.baseUrl}/assignments/${assignmentId}/evidence`,
      formData,
    );
  }

  /** ลบไฟล์หลักฐาน */
  deleteEvidence(assignmentId: number, fileId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/assignments/${assignmentId}/evidence/${fileId}`,
    );
  }

  // ── Clarification ──

  /** ดึงบทสนทนาขอคำชี้แจง */
  getClarificationThread(assignmentId: number): Observable<ClarificationThread> {
    return this.http.get<ClarificationThread>(
      `${this.baseUrl}/assignments/${assignmentId}/clarification`,
    );
  }

  /** ส่งข้อความขอคำชี้แจง */
  sendClarification(body: ClarificationPayload): Observable<ClarificationThread> {
    return this.http.post<ClarificationThread>(
      `${this.baseUrl}/assignments/${body.assignment_id}/clarification`,
      body,
    );
  }

  // ── Timesheet ──

  /** ดึงสรุปเวลาปฏิบัติงาน */
  getTimesheetSummary(assignmentId: number): Observable<TimesheetSummary> {
    return this.http.get<TimesheetSummary>(
      `${this.baseUrl}/assignments/${assignmentId}/timesheet`,
    );
  }

  /** บันทึกรายการเวลาปฏิบัติงาน */
  logTimesheet(body: TimesheetLogPayload): Observable<TimesheetSummary> {
    return this.http.post<TimesheetSummary>(
      `${this.baseUrl}/assignments/${body.assignment_id}/timesheet`,
      body,
    );
  }

  // ── Findings ──

  /** ดึงข้อค้นพบของงาน */
  getFindings(assignmentId: number): Observable<FindingPayload[]> {
    return this.http.get<FindingPayload[]>(
      `${this.baseUrl}/assignments/${assignmentId}/findings`,
    );
  }

  /** สร้าง/อัปเดตข้อค้นพบ */
  saveFinding(assignmentId: number, body: FindingPayload): Observable<FindingPayload> {
    if (body.finding_id) {
      return this.http.patch<FindingPayload>(
        `${this.baseUrl}/assignments/${assignmentId}/findings/${body.finding_id}`,
        body,
      );
    }
    return this.http.post<FindingPayload>(
      `${this.baseUrl}/assignments/${assignmentId}/findings`,
      body,
    );
  }

  /** ลบข้อค้นพบ */
  deleteFinding(assignmentId: number, findingId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/assignments/${assignmentId}/findings/${findingId}`,
    );
  }

  // ── Notifications ──

  /** ดึงแจ้งเตือนของ Analyst */
  getMyNotifications(): Observable<Array<{
    id: string;
    type: 'assignment_received' | 'clarification_reply' | 'review_result' | 'revision_request';
    title: string;
    message: string;
    assignment_id: number;
    created_at: string;
    read: boolean;
  }>> {
    return this.http.get<any>(`${this.baseUrl}/notifications/me`);
  }

  /** อ่านแจ้งเตือนแล้ว */
  markNotificationRead(notificationId: string): Observable<void> {
    return this.http.patch<void>(
      `${this.baseUrl}/notifications/${notificationId}/read`,
      {},
    );
  }
}
