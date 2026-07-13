import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AnnualRisk,
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
} from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  login(body: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, body);
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
    return {
      ...project,
      risk_score: response.risk_score?.risk_score ?? project.risk_score ?? null,
      risk_level: response.risk_score?.risk_level ?? project.risk_level ?? null,
      factors_triggered: response.risk_score?.factors_triggered ?? project.factors_triggered ?? null,
      risk_factors: response.risk_factors ?? [],
    };
  }
}
