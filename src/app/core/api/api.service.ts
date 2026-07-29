import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { resolveAllowedFeatures } from '../auth/features';
import { RoleCode } from '../auth/roles';
import {
  AccessLogFilters,
  AccessLogPage,
  AssignmentAssignee,
  AssignmentAttachment,
  AssignmentClarification,
  AssignmentDetailResponse,
  AssignmentStatus,
  AnnualRisk,
  AuditAssignment,
  AuditorFeedback,
  AuditorFeedbackCreate,
  ChatResponse,
  ChatTurn,
  CreateAssignmentRequest,
  DataUploadResult,
  DocumentType,
  FinancialStatement,
  LoginRequest,
  LoginResponse,
  NotificationListResponse,
  NotificationReadAllResponse,
  NotificationReadResponse,
  ManagedUser,
  ManagedUserCreate,
  ManagedUserPatch,
  Project,
  ProjectDetail,
  ProjectDetailResponse,
  ProjectDocumentsView,
  ProjectFilters,
  ProjectLegalFactor,
  RiskEngineRunResult,
  RiskFactorCatalog,
  RiskSummary,
  Subdistrict,
  SystemMeta,
  UserStatus,
} from '../models/domain.models';

/** shape จริงที่ GET/PUT /users ส่งมา — backend ใช้ snake_case (allowed_features) ต่างจาก ManagedUser ฝั่ง frontend */
interface ManagedUserWire {
  user_id: number;
  username: string;
  display_name: string | null;
  role: string;
  subdistrict_id: number | null;
  status: UserStatus;
  allowed_features: string[];
}

interface ManagedUserWirePatch {
  display_name: string;
  role: string;
  subdistrict_id: number | null;
  status: UserStatus;
  allowed_features: string[];
}

interface ManagedUserWireCreate extends ManagedUserWirePatch {
  username: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  login(body: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, body);
  }

  /** เมทาดาทาระดับระบบ — วันที่ข้อมูลจริง (data-as-of) + ช่วงปีงบ (public, ไม่ต้อง auth) */
  meta(): Observable<SystemMeta> {
    return this.http.get<SystemMeta>(`${this.baseUrl}/meta`);
  }

  me(): Observable<{ user?: LoginResponse['user'] } & LoginResponse['user']> {
    return this.http.get<{ user?: LoginResponse['user'] } & LoginResponse['user']>(
      `${this.baseUrl}/auth/me`,
    );
  }

  /** รายชื่อผู้ใช้ + สิทธิ์เข้าถึงฟีเจอร์ (allowedFeatures) — admin เท่านั้น (หน้าจัดการผู้ใช้งาน) */
  getUsers(): Observable<ManagedUser[]> {
    return this.http
      .get<{ value?: ManagedUserWire[] } | ManagedUserWire[]>(`${this.baseUrl}/users`)
      .pipe(map((response) => this.unwrapList(response).map((row) => this.fromWire(row))));
  }

  /** สร้างผู้ใช้ใหม่ (ตั้ง username/password ครั้งเดียวตอนสร้าง) — admin เท่านั้น */
  createUser(body: ManagedUserCreate): Observable<ManagedUser> {
    const wire: ManagedUserWireCreate = {
      ...this.toWire(body),
      username: body.username,
      password: body.password,
    };
    return this.http
      .post<ManagedUserWire>(`${this.baseUrl}/users`, wire)
      .pipe(map((row) => this.fromWire(row)));
  }

  /** แก้ไขข้อมูล + สิทธิ์เข้าถึงฟีเจอร์ของผู้ใช้รายคน — admin เท่านั้น */
  updateUser(userId: number, body: ManagedUserPatch): Observable<ManagedUser> {
    return this.http
      .put<ManagedUserWire>(`${this.baseUrl}/users/${userId}`, this.toWire(body))
      .pipe(map((row) => this.fromWire(row)));
  }

  /** ลบผู้ใช้ (hard delete) — admin เท่านั้น, ลบบัญชีของตัวเองไม่ได้ (backend คืน 422) */
  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/users/${userId}`);
  }

  subdistricts(): Observable<Subdistrict[]> {
    return this.http
      .get<{ value?: Subdistrict[] } | Subdistrict[]>(`${this.baseUrl}/subdistricts`)
      .pipe(map((response) => this.unwrapList(response)));
  }

  projects(filters: ProjectFilters = {}): Observable<Project[]> {
    return this.http
      .get<{ value?: Project[] } | Project[]>(`${this.baseUrl}/projects`, {
        params: this.toParams(filters),
      })
      .pipe(map((response) => this.unwrapList(response)));
  }

  /** ชุดข้อมูลเปิดโครงการตามสิทธิ์ที่ backend กำหนด (ไม่รวมข้อมูลตรวจสอบ /audit) */
  downloadPublicProjects(format: 'csv' | 'json'): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.baseUrl}/public/projects/export`, {
      params: new HttpParams().set('format', format),
      observe: 'response',
      responseType: 'blob',
    });
  }

  project(projectId: string | number): Observable<ProjectDetail> {
    return this.http
      .get<ProjectDetailResponse>(`${this.baseUrl}/projects/${projectId}`)
      .pipe(map((response) => this.unwrapProjectDetail(response)));
  }

  /** ผล risk factor ล่าสุด + legal_refs (มาตรา/ระเบียบที่เกี่ยวข้อง) ของโครงการ */
  projectLegal(projectId: string | number): Observable<ProjectLegalFactor[]> {
    return this.http.get<ProjectLegalFactor[]>(`${this.baseUrl}/risk/projects/${projectId}/legal`);
  }

  /** ประเภทเอกสารอ้างอิง (ปร.4/5/6) + provides (เอกสารนั้นระบุอะไร) */
  documentTypes(): Observable<DocumentType[]> {
    return this.http.get<DocumentType[]>(`${this.baseUrl}/documents/types`);
  }

  /** เอกสารของโครงการ + สถานะ + รายการที่ยังขาด + findings พร้อม legal refs */
  projectDocuments(projectId: string | number): Observable<ProjectDocumentsView> {
    return this.http.get<ProjectDocumentsView>(`${this.baseUrl}/projects/${projectId}/documents`);
  }

  riskFactors(): Observable<RiskFactorCatalog[]> {
    return this.http
      .get<{ value?: RiskFactorCatalog[] } | RiskFactorCatalog[]>(`${this.baseUrl}/risk/factors`)
      .pipe(map((response) => this.unwrapList(response)));
  }

  annualRisk(): Observable<AnnualRisk[]> {
    return this.http
      .get<{ value?: AnnualRisk[] } | AnnualRisk[]>(`${this.baseUrl}/risk/annual`)
      .pipe(map((response) => this.unwrapList(response)));
  }

  financialStatements(): Observable<FinancialStatement[]> {
    return this.http.get<FinancialStatement[]>(`${this.baseUrl}/financials`);
  }

  riskSummary(filters: ProjectFilters = {}): Observable<RiskSummary> {
    return this.http.get<RiskSummary>(`${this.baseUrl}/risk/summary`, {
      params: this.toParams(filters),
    });
  }

  /** บันทึกการเข้าถึงของผู้ใช้ — admin เท่านั้น (backend บังคับสิทธิ์ซ้ำด้วย require_roles) */
  accessLog(filters: AccessLogFilters = {}): Observable<AccessLogPage> {
    let params = new HttpParams();
    const entries: Array<[string, string | number | null | undefined]> = [
      ['username', filters.username],
      ['action', filters.action],
      ['resource_type', filters.resource_type],
      ['date_from', filters.date_from],
      ['date_to', filters.date_to],
      ['limit', filters.limit],
      ['offset', filters.offset],
    ];
    entries.forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<AccessLogPage>(`${this.baseUrl}/audit/access-log`, { params });
  }

  /** admin เท่านั้น — คำนวณ risk score ใหม่จากข้อมูลปัจจุบันในฐานข้อมูล (ไม่อ่าน CSV ใหม่) */
  runRiskEngine(): Observable<RiskEngineRunResult> {
    return this.http.post<RiskEngineRunResult>(`${this.baseUrl}/admin/risk-engine/run`, {});
  }

  /** admin เท่านั้น — นำเข้าโครงการ/งบการเงินรอบใหม่ของตำบลที่มีอยู่แล้ว (ต้องแนบไฟล์อย่างน้อย 1 ไฟล์) */
  uploadAdminData(
    subdistrictId: number,
    projectsCsv: File | null,
    financialCsv: File | null,
  ): Observable<DataUploadResult> {
    const form = new FormData();
    form.set('subdistrict_id', String(subdistrictId));
    if (projectsCsv) {
      form.set('projects_csv', projectsCsv);
    }
    if (financialCsv) {
      form.set('financial_csv', financialCsv);
    }
    return this.http.post<DataUploadResult>(`${this.baseUrl}/admin/data/upload`, form);
  }

  assignmentAssignees(): Observable<AssignmentAssignee[]> {
    return this.http.get<AssignmentAssignee[]>(`${this.baseUrl}/audit/assignments/assignees`);
  }

  assignments(): Observable<AuditAssignment[]> {
    return this.http.get<AuditAssignment[]>(`${this.baseUrl}/audit/assignments`);
  }

  createAssignment(body: CreateAssignmentRequest): Observable<AuditAssignment> {
    return this.http.post<AuditAssignment>(`${this.baseUrl}/audit/assignments`, body);
  }

  /** รายละเอียดงานตรวจสอบ + ประวัติการเปลี่ยนสถานะทั้งหมด (ใหม่สุดก่อน) */
  assignmentDetail(assignmentId: number): Observable<AssignmentDetailResponse> {
    return this.http.get<AssignmentDetailResponse>(
      `${this.baseUrl}/audit/assignments/${assignmentId}`,
    );
  }

  deleteAssignment(assignmentId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/audit/assignments/${assignmentId}`);
  }

  notifications(filters: { unread?: boolean } = {}): Observable<NotificationListResponse> {
    let params = new HttpParams();
    if (filters.unread !== undefined) {
      params = params.set('unread', String(filters.unread));
    }
    return this.http.get<NotificationListResponse>(`${this.baseUrl}/notifications`, { params });
  }

  markNotificationRead(notificationId: number): Observable<NotificationReadResponse> {
    return this.http.patch<NotificationReadResponse>(
      `${this.baseUrl}/notifications/${notificationId}/read`,
      {},
    );
  }

  markAllNotificationsRead(): Observable<NotificationReadAllResponse> {
    return this.http.post<NotificationReadAllResponse>(
      `${this.baseUrl}/notifications/read-all`,
      {},
   );
  }
  /** เปลี่ยนสถานะงานตรวจสอบ (accept/submit/approve/reject ฯลฯ) — backend บังคับ transition ที่อนุญาตตาม role อยู่แล้ว */
  updateAssignmentStatus(
    assignmentId: number,
    status: AssignmentStatus,
    note?: string,
  ): Observable<AuditAssignment> {
    return this.http.patch<AuditAssignment>(`${this.baseUrl}/audit/assignments/${assignmentId}/status`, {
      status,
      note,
    });
  }

  /** ไฟล์หลักฐาน (evidence) แนบกับงานตรวจสอบ — backend เก็บเป็น BYTEA ใน Postgres, จำกัด 10MB/ไฟล์ */
  assignmentAttachments(assignmentId: number): Observable<AssignmentAttachment[]> {
    return this.http.get<AssignmentAttachment[]>(
      `${this.baseUrl}/audit/assignments/${assignmentId}/attachments`,
    );
  }

  uploadAssignmentAttachment(assignmentId: number, file: File): Observable<AssignmentAttachment> {
    const form = new FormData();
    form.set('file', file);
    return this.http.post<AssignmentAttachment>(
      `${this.baseUrl}/audit/assignments/${assignmentId}/attachments`,
      form,
    );
  }

  deleteAssignmentAttachment(assignmentId: number, attachmentId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/audit/assignments/${assignmentId}/attachments/${attachmentId}`,
    );
  }

  /** ดาวน์โหลดเป็น blob ผ่าน HttpClient (ไม่ใช้ <a href> ตรงๆ เพราะ browser navigation ไม่แนบ
   * Authorization header — ต้องผ่าน authInterceptor เหมือน request อื่น) เรียกแล้วสร้าง object URL
   * เอง (ดู FileSaver util) */
  downloadAssignmentAttachment(assignmentId: number, attachmentId: number): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/audit/assignments/${assignmentId}/attachments/${attachmentId}/download`,
      { responseType: 'blob' },
    );
  }

  assignmentClarifications(assignmentId: number): Observable<AssignmentClarification[]> {
    return this.http.get<AssignmentClarification[]>(
      `${this.baseUrl}/audit/assignments/${assignmentId}/clarifications`,
    );
  }

  postAssignmentClarification(
    assignmentId: number,
    messageText: string,
  ): Observable<AssignmentClarification> {
    return this.http.post<AssignmentClarification>(
      `${this.baseUrl}/audit/assignments/${assignmentId}/clarifications`,
      { message_text: messageText },
    );
  }

  feedbackList(): Observable<AuditorFeedback[]> {
    return this.http.get<AuditorFeedback[]>(`${this.baseUrl}/audit/feedback`);
  }

  projectFeedback(projectId: string | number): Observable<AuditorFeedback[]> {
    return this.http.get<AuditorFeedback[]>(`${this.baseUrl}/audit/feedback/${projectId}`);
  }

  createFeedback(body: AuditorFeedbackCreate): Observable<AuditorFeedback> {
    return this.http.post<AuditorFeedback>(`${this.baseUrl}/audit/feedback`, body);
  }

  updateFeedback(feedbackId: number, body: AuditorFeedbackCreate): Observable<AuditorFeedback> {
    return this.http.patch<AuditorFeedback>(`${this.baseUrl}/audit/feedback/${feedbackId}`, body);
  }

  deleteFeedback(feedbackId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/audit/feedback/${feedbackId}`);
  }

  resolveFeedback(feedbackId: number): Observable<AuditorFeedback> {
    return this.http.patch<AuditorFeedback>(
      `${this.baseUrl}/audit/feedback/${feedbackId}/resolve`,
      {},
    );
  }

  /** ส่งข้อความไปยัง chatbot — history เป็น turn ก่อนหน้าที่ client ถืออยู่เอง (backend ไม่เก็บ state) */
  chatbotMessage(message: string, history: ChatTurn[]): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.baseUrl}/chatbot`, { message, history });
  }

  private toParams(filters: ProjectFilters): HttpParams {
    let params = new HttpParams();
    const entries: Array<[string, string | number | null | undefined]> = [
      ['budget_year', filters.budget_year],
      ['subdistrict_id', filters.subdistrict_id],
      ['risk_level', filters.risk_level],
    ];

    entries.forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return params;
  }

  private unwrapList<T>(response: { value?: T[] } | T[]): T[] {
    if (Array.isArray(response)) {
      return response;
    }
    return response.value ?? [];
  }

  /** GET/PUT /users คืน field เป็น snake_case (allowed_features) → แปลงเป็น ManagedUser (camelCase) ที่ frontend ใช้ */
  private fromWire(row: ManagedUserWire): ManagedUser {
    return {
      user_id: row.user_id,
      username: row.username,
      display_name: row.display_name ?? row.username,
      role: row.role as RoleCode,
      subdistrict_id: row.subdistrict_id,
      status: row.status,
      allowed_features: resolveAllowedFeatures(row.allowed_features, row.role),
    };
  }

  private toWire(body: ManagedUserPatch): ManagedUserWirePatch {
    return {
      display_name: body.display_name,
      role: body.role,
      subdistrict_id: body.subdistrict_id,
      status: body.status,
      allowed_features: body.allowed_features,
    };
  }

  private unwrapProjectDetail(response: ProjectDetailResponse): ProjectDetail {
    const project = response.project ?? {};
    const score = response.risk_score ?? {};
    return {
      ...project,
      risk_score: score.risk_score ?? project.risk_score ?? null,
      risk_level: score.risk_level ?? project.risk_level ?? null,
      matrix_level: score.matrix_level ?? project.matrix_level ?? null,
      matrix_likelihood: score.matrix_likelihood ?? null,
      matrix_impact: score.matrix_impact ?? null,
      matrix_score: score.matrix_score ?? null,
      factors_triggered: score.factors_triggered ?? project.factors_triggered ?? null,
      factors_not_computable: score.factors_not_computable ?? null,
      summary_text: score.summary_text ?? null,
      risk_factors: response.risk_factors ?? [],
    };
  }
}
