/**
 * FeedbackProjectListPageComponent
 *
 * หน้ารวมโครงการสำหรับบันทึกความคิดเห็น (Risk Analyst) — แสดงเฉพาะโครงการที่ได้รับมอบหมายจริง
 * (GET /audit/assignments) จับคู่กับสถานะความคิดเห็นล่าสุด (GET /audit/feedback) ผ่าน project_id
 * และเสริม budget_year/risk_score จาก GET /projects (assignment ไม่มี field เหล่านี้ติดมาด้วย)
 */

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuditAssignment, AuditorFeedback, FeedbackStatus, Project } from '../../core/models/domain.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { FeedbackStatusBadgeComponent } from '../../shared/ui/feedback-status-badge.component';
import { formatFeedbackDate, latestOf } from '../../shared/utils/feedback-utils';
import { formatNumber } from '../../shared/utils/risk-utils';

interface FeedbackProjectRow {
  assignment_id: number;
  project_id: string;
  project_name: string;
  budget_year: number | null;
  risk_score: number | null;
  status: FeedbackStatus | null;
  updatedAt: string | null;
}

@Component({
  selector: 'app-feedback-project-list-page',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, FeedbackStatusBadgeComponent],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="m-0 text-[26px] font-extrabold text-ink">รายการโครงการสำหรับบันทึกความคิดเห็น</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">
            โครงการที่คุณได้รับมอบหมาย — คลิกชื่อโครงการหรือ &quot;ดูรายละเอียด&quot; เพื่อบันทึกความคิดเห็นด้านความเสี่ยง
          </p>
        </div>
        <button type="button" class="gov-btn-outline" (click)="reload()">รีเฟรชรายการ</button>
      </div>

      @if (error()) {
        <div
          class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high"
        >
          {{ error() }}
        </div>
      }

      <section class="panel mt-4 overflow-hidden">
        @if (loading()) {
          <p class="px-[18px] py-8 text-center text-sm text-muted">กำลังโหลดรายการโครงการ...</p>
        } @else if (!rows().length) {
          <div class="p-[18px]">
            <app-empty-state
              title="ไม่มีโครงการที่ได้รับมอบหมาย"
              message="เมื่อผู้ตรวจสอบโครงการมอบหมายงานให้คุณ รายการจะแสดงที่นี่"
            />
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="gov-table min-w-[900px]">
              <thead>
                <tr>
                  <th scope="col">ชื่อโครงการ</th>
                  <th scope="col">ปีงบประมาณ</th>
                  <th scope="col">Risk Score</th>
                  <th scope="col">สถานะความคิดเห็น</th>
                  <th scope="col">วันที่ตรวจล่าสุด</th>
                  <th scope="col"><span class="sr-only">การดำเนินการ</span></th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.assignment_id) {
                  <tr>
                    <td class="align-top">
                      <a
                        [routerLink]="['/risk-analyst-feedback/task', row.assignment_id]"
                        class="font-extrabold leading-6 text-ink no-underline hover:text-navy hover:underline"
                      >
                        {{ row.project_name }}
                      </a>
                      <p class="m-0 mt-1 text-xs text-muted">รหัส {{ row.project_id }}</p>
                    </td>
                    <td class="align-top">{{ row.budget_year ?? '-' }}</td>
                    <td class="align-top">{{ number(row.risk_score) }}</td>
                    <td class="align-top">
                      @if (row.status) {
                        <app-feedback-status-badge [status]="row.status" />
                      } @else {
                        <span
                          class="inline-flex items-center rounded-[3px] bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600"
                        >
                          ยังไม่ได้บันทึก
                        </span>
                      }
                    </td>
                    <td class="align-top">{{ dateLabel(row.updatedAt) }}</td>
                    <td class="align-top">
                      <a
                        [routerLink]="['/risk-analyst-feedback/task', row.assignment_id]"
                        class="gov-btn-outline inline-flex w-full min-w-[120px] items-center justify-center no-underline"
                      >
                        ดูรายละเอียด
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </section>
  `,
})
export class FeedbackProjectListPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly assignments = signal<AuditAssignment[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly feedbackList = signal<AuditorFeedback[]>([]);

  readonly rows = computed<FeedbackProjectRow[]>(() => {
    const projects = this.projects();
    const feedback = this.feedbackList();
    return this.assignments()
      .map((assignment): FeedbackProjectRow => {
        const project = projects.find((p) => String(p.project_id) === assignment.project_id) ?? null;
        const latest = latestOf(feedback, assignment.project_id);
        return {
          assignment_id: assignment.assignment_id,
          project_id: assignment.project_id,
          project_name: project?.project_name || assignment.project_name || 'ไม่ระบุชื่อโครงการ',
          budget_year: project?.budget_year ?? null,
          risk_score: this.toRiskScore(project),
          status: (latest?.status as FeedbackStatus | undefined) ?? null,
          updatedAt: latest?.updated_at ?? null,
        };
      })
      .sort((a, b) => {
        if (a.updatedAt && b.updatedAt) {
          return b.updatedAt.localeCompare(a.updatedAt);
        }
        if (a.updatedAt) {
          return -1;
        }
        if (b.updatedAt) {
          return 1;
        }
        return 0;
      });
  });

  ngOnInit(): void {
    this.load();
  }

  reload(): void {
    this.load();
  }

  dateLabel(value: string | null): string {
    return formatFeedbackDate(value);
  }

  number(value: number | null): string {
    return value === null ? '-' : formatNumber(value, 0);
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      assignments: this.api.assignments().pipe(catchError(() => of<AuditAssignment[]>([]))),
      projects: this.api.projects().pipe(catchError(() => of<Project[]>([]))),
      feedback: this.api.feedbackList().pipe(catchError(() => of<AuditorFeedback[]>([]))),
    }).subscribe({
      next: ({ assignments, projects, feedback }) => {
        this.assignments.set(assignments);
        this.projects.set(projects);
        this.feedbackList.set(feedback);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('ไม่สามารถโหลดรายการโครงการได้ กรุณาลองใหม่อีกครั้ง');
        this.loading.set(false);
      },
    });
  }

  private toRiskScore(project: Project | null): number | null {
    const raw = project?.risk_score;
    return typeof raw === 'number' ? raw : raw !== undefined && raw !== null ? Number(raw) : null;
  }
}
