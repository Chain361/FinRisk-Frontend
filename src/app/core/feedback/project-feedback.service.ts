import { Injectable, signal } from '@angular/core';

import { ConcernLevel, FeedbackStatus, ProjectFeedback } from '../models/feedback.models';

const STORAGE_KEY = 'finrisk_project_feedback';

export interface FeedbackDraftInput {
  feedback_id: string | null;
  project_id: string | number;
  auditor_username: string;
  auditor_name: string;
  feedback_text: string;
  concern_level: ConcernLevel | null;
  likelihood_score: number | null;
  impact_score: number | null;
  suggestions: string;
}

/**
 * ยังไม่มี backend endpoint สำหรับ audit feedback — เก็บลง localStorage ไปก่อน
 * โครงสร้างข้อมูล (ProjectFeedback) ออกแบบให้ย้ายไปเรียก API จริงได้ในภายหลังโดยไม่ต้องแก้ผู้เรียกใช้
 */
@Injectable({ providedIn: 'root' })
export class ProjectFeedbackService {
  private readonly records = signal<ProjectFeedback[]>(this.restore());

  historyFor(projectId: string | number): ProjectFeedback[] {
    const id = String(projectId);
    return this.records()
      .filter((record) => record.project_id === id)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  latestFor(projectId: string | number): ProjectFeedback | null {
    return this.historyFor(projectId)[0] ?? null;
  }

  /** ฉบับที่ auditor คนนี้กำลังทำอยู่สำหรับโครงการนี้ (ยังไม่ resolved) */
  activeFor(projectId: string | number, username: string): ProjectFeedback | null {
    const id = String(projectId);
    return (
      this.records()
        .filter(
          (record) =>
            record.project_id === id &&
            record.auditor_username === username &&
            record.status !== 'resolved',
        )
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null
    );
  }

  saveDraft(input: FeedbackDraftInput): ProjectFeedback {
    return this.upsert(input, 'draft');
  }

  submit(input: FeedbackDraftInput): ProjectFeedback {
    return this.upsert(input, 'submitted');
  }

  delete(feedbackId: string): void {
    this.records.update((list) => list.filter((record) => record.feedback_id !== feedbackId));
    this.persist();
  }

  resolve(feedbackId: string): void {
    const now = new Date().toISOString();
    this.records.update((list) =>
      list.map((record) =>
        record.feedback_id === feedbackId
          ? { ...record, status: 'resolved' as FeedbackStatus, resolved_at: now, updated_at: now }
          : record,
      ),
    );
    this.persist();
  }

  private upsert(input: FeedbackDraftInput, status: FeedbackStatus): ProjectFeedback {
    const now = new Date().toISOString();
    const existing = input.feedback_id
      ? this.records().find((record) => record.feedback_id === input.feedback_id)
      : undefined;

    const record: ProjectFeedback = {
      feedback_id: existing?.feedback_id ?? crypto.randomUUID(),
      project_id: String(input.project_id),
      auditor_username: input.auditor_username,
      auditor_name: input.auditor_name,
      feedback_text: input.feedback_text,
      concern_level: input.concern_level,
      likelihood_score: input.likelihood_score,
      impact_score: input.impact_score,
      risk_score:
        input.likelihood_score !== null && input.impact_score !== null
          ? input.likelihood_score * input.impact_score
          : null,
      suggestions: input.suggestions.trim() || null,
      status,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      submitted_at: status === 'submitted' ? now : (existing?.submitted_at ?? null),
      resolved_at: existing?.resolved_at ?? null,
    };

    this.records.update((list) => {
      const index = list.findIndex((item) => item.feedback_id === record.feedback_id);
      if (index === -1) {
        return [...list, record];
      }
      const next = [...list];
      next[index] = record;
      return next;
    });
    this.persist();
    return record;
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records()));
  }

  private restore(): ProjectFeedback[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ProjectFeedback[]) : [];
    } catch {
      return [];
    }
  }
}
