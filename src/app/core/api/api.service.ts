import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AnnualRisk,
  AuditorFeedback,
  AuditorFeedbackCreate,
  FinancialStatement,
  LoginRequest,
  LoginResponse,
  Project,
  ProjectDetail,
  ProjectDetailResponse,
  ProjectFilters,
  RiskFactorCatalog,
  RiskSummary,
  Subdistrict,
  SystemMeta,
} from '../models/domain.models';

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

  subdistricts(): Observable<Subdistrict[]> {
    return this.http.get<{ value?: Subdistrict[] } | Subdistrict[]>(`${this.baseUrl}/subdistricts`).pipe(
      map((response) => this.unwrapList(response)),
    );
  }

  projects(filters: ProjectFilters = {}): Observable<Project[]> {
    return this.http.get<{ value?: Project[] } | Project[]>(`${this.baseUrl}/projects`, { params: this.toParams(filters) }).pipe(
      map((response) => this.unwrapList(response)),
    );
  }

  project(projectId: string | number): Observable<ProjectDetail> {
    return this.http.get<ProjectDetailResponse>(`${this.baseUrl}/projects/${projectId}`).pipe(
      map((response) => this.unwrapProjectDetail(response)),
    );
  }

  riskFactors(): Observable<RiskFactorCatalog[]> {
    return this.http.get<{ value?: RiskFactorCatalog[] } | RiskFactorCatalog[]>(`${this.baseUrl}/risk/factors`).pipe(
      map((response) => this.unwrapList(response)),
    );
  }

  annualRisk(): Observable<AnnualRisk[]> {
    return this.http.get<{ value?: AnnualRisk[] } | AnnualRisk[]>(`${this.baseUrl}/risk/annual`).pipe(
      map((response) => this.unwrapList(response)),
    );
  }

  financialStatements(): Observable<FinancialStatement[]> {
    return this.http.get<FinancialStatement[]>(`${this.baseUrl}/financials`);
  }

  riskSummary(filters: ProjectFilters = {}): Observable<RiskSummary> {
    return this.http.get<RiskSummary>(`${this.baseUrl}/risk/summary`, {
      params: this.toParams(filters),
    });
  }

  /** ความเห็นผู้ตรวจสอบทั้งหมดในขอบเขตของผู้ใช้ (backend scope ตามตำบล, เรียง updated_at ล่าสุดก่อน) */
  feedbackList(): Observable<AuditorFeedback[]> {
    return this.http.get<AuditorFeedback[]>(`${this.baseUrl}/audit/feedback`);
  }

  /** ความเห็นของโครงการเดียว — คืน [] เมื่อยังไม่มี (ไม่ 404) */
  projectFeedback(projectId: string | number): Observable<AuditorFeedback[]> {
    return this.http.get<AuditorFeedback[]>(`${this.baseUrl}/audit/feedback/${projectId}`);
  }

  createFeedback(body: AuditorFeedbackCreate): Observable<AuditorFeedback> {
    return this.http.post<AuditorFeedback>(`${this.baseUrl}/audit/feedback`, body);
  }

  /** แก้ไขได้เฉพาะสถานะ draft (backend คืน 409 ถ้าไม่ใช่) */
  updateFeedback(feedbackId: number, body: AuditorFeedbackCreate): Observable<AuditorFeedback> {
    return this.http.patch<AuditorFeedback>(`${this.baseUrl}/audit/feedback/${feedbackId}`, body);
  }

  deleteFeedback(feedbackId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/audit/feedback/${feedbackId}`);
  }

  /** ปิดเรื่อง — เฉพาะ admin/project_auditor (RESOLVE_ROLES ฝั่ง backend) */
  resolveFeedback(feedbackId: number): Observable<AuditorFeedback> {
    return this.http.patch<AuditorFeedback>(`${this.baseUrl}/audit/feedback/${feedbackId}/resolve`, {});
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
