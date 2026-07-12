import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AnnualRisk,
  FinancialStatement,
  LoginRequest,
  LoginResponse,
  Project,
  ProjectDetail,
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
    return this.http.get<Subdistrict[]>(`${this.baseUrl}/subdistricts`);
  }

  projects(filters: ProjectFilters = {}): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.baseUrl}/projects`, { params: this.toParams(filters) });
  }

  project(projectId: string | number): Observable<ProjectDetail> {
    return this.http.get<ProjectDetail>(`${this.baseUrl}/projects/${projectId}`);
  }

  riskFactors(): Observable<RiskFactorCatalog[]> {
    return this.http.get<RiskFactorCatalog[]>(`${this.baseUrl}/risk/factors`);
  }

  annualRisk(): Observable<AnnualRisk[]> {
    return this.http.get<AnnualRisk[]>(`${this.baseUrl}/risk/annual`);
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
}
