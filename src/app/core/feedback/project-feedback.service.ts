import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ConcernLevel, FeedbackStatus, ProjectFeedback } from '../models/feedback.models';

export interface FeedbackDraftInput {
  feedback_id: string | null;
  project_id: string | number;
  feedback_text: string;
  concern_level: ConcernLevel | null;
  likelihood_score: number | null;
  impact_score: number | null;
  suggestions: string;
}

/** feedback ล่าสุดของแต่ละโครงการ จาก list ที่โหลดมาแล้ว (ใหม่สุดตาม updated_at) */
export function latestOf(
  records: ProjectFeedback[],
  projectId: string | number,
): ProjectFeedback | null {
  const id = String(projectId);
  return (
    records
      .filter((record) => record.project_id === id)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null
  );
}

/** ฉบับที่ auditor คนนี้กำลังทำอยู่สำหรับโครงการนี้ (ยังไม่ resolved) */
export function activeOf(
  records: ProjectFeedback[],
  projectId: string | number,
  username: string,
): ProjectFeedback | null {
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

@Injectable({ providedIn: 'root' })
export class ProjectFeedbackService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** feedback ทั้งหมดที่ผู้ใช้เห็นได้ (scope ตามตำบล) — ใช้แสดงสถานะบนรายการโครงการ */
  all(): Observable<ProjectFeedback[]> {
    return this.http.get<ProjectFeedback[]>(`${this.baseUrl}/audit/feedback`);
  }

  historyFor(projectId: string | number): Observable<ProjectFeedback[]> {
    return this.http.get<ProjectFeedback[]>(`${this.baseUrl}/audit/feedback/${projectId}`);
  }

  saveDraft(input: FeedbackDraftInput): Observable<ProjectFeedback> {
    return this.upsert(input, 'draft');
  }

  submit(input: FeedbackDraftInput): Observable<ProjectFeedback> {
    return this.upsert(input, 'submitted');
  }

  delete(feedbackId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/audit/feedback/${feedbackId}`);
  }

  resolve(feedbackId: string): Observable<ProjectFeedback> {
    return this.http.patch<ProjectFeedback>(
      `${this.baseUrl}/audit/feedback/${feedbackId}/resolve`,
      {},
    );
  }

  private upsert(input: FeedbackDraftInput, status: FeedbackStatus): Observable<ProjectFeedback> {
    const body = {
      project_id: String(input.project_id),
      feedback_text: input.feedback_text,
      concern_level: input.concern_level,
      likelihood_score: input.likelihood_score,
      impact_score: input.impact_score,
      suggestions: input.suggestions.trim() || null,
      status,
    };
    return input.feedback_id
      ? this.http.patch<ProjectFeedback>(
          `${this.baseUrl}/audit/feedback/${input.feedback_id}`,
          body,
        )
      : this.http.post<ProjectFeedback>(`${this.baseUrl}/audit/feedback`, body);
  }
}
