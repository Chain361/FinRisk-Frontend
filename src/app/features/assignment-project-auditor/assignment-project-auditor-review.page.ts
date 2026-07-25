import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { Project, Subdistrict } from '../../core/models/domain.models';
import { ConfirmModalComponent } from '../../shared/ui/confirm-modal.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { normalizeRiskLevel, subdistrictLabel } from '../../shared/utils/risk-utils';
import {
  ANALYSTS,
  ASSIGNMENT_STORAGE_KEY,
  Analyst,
  AssignmentWorkflowStatus,
  SavedAssignment,
  projectWorkflowStatusBadgeClass,
  projectWorkflowStatusLabel,
} from './assignment-project-auditor.models';

type ReviewAction = 'start_review' | 'approve' | 'request_revision';

interface ReviewRow {
  key: string;
  assignment: SavedAssignment;
  project: Project | null;
  analyst: Analyst | null;
  projectName: string;
  subdistrictName: string;
  assignedAtText: string;
  searchText: string;
}

@Component({
  selector: 'app-assignment-project-auditor-review-page',
  standalone: true,
  imports: [FormsModule, RouterLink, ConfirmModalComponent, EmptyStateComponent],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F4.3</p>
          <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">ตรวจทานงานที่ส่งกลับมา</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">
            ตรวจรายการที่ Staff ส่งให้สอบทาน พร้อมอนุมัติปิดงานหรือส่งกลับแก้ไข
          </p>
        </div>
        <button type="button" class="gov-btn-outline" (click)="reloadAssignments()">รีเฟรชรายการ</button>
      </div>

      @if (error()) {
        <div class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">
          {{ error() }}
        </div>
      }

      <div class="grid gap-4 md:grid-cols-3">
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">รอตรวจทาน</p>
          <p class="m-0 mt-1 text-[26px] font-extrabold text-navy">{{ readyForReviewCount() }}</p>
        </div>
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">อยู่ระหว่างสอบทาน</p>
          <p class="m-0 mt-1 text-[26px] font-extrabold text-purple-700">{{ underReviewCount() }}</p>
        </div>
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">แสดงผลตามตัวกรอง</p>
          <p class="m-0 mt-1 text-[26px] font-extrabold text-risk-low">{{ filteredRows().length }}</p>
        </div>
      </div>

      <section class="panel overflow-hidden">
        <div class="border-b border-line-soft px-[18px] py-4">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 class="m-0 text-[17px] font-extrabold text-ink">รายการส่งสอบทาน</h2>
              <p class="m-0 mt-1 text-[13px] text-muted">ค้นหาโครงการ ผู้รับมอบหมาย หรือคำแนะนำการตรวจ</p>
            </div>
            <span class="rounded-full bg-navy px-2.5 py-1 text-xs font-bold text-white">{{ filteredRows().length }} รายการ</span>
          </div>

          <div class="mt-3 grid gap-2 md:grid-cols-[1fr_220px]">
            <label>
              <span class="sr-only">ค้นหารายการส่งสอบทาน</span>
              <input
                class="gov-input"
                type="search"
                placeholder="ค้นหาโครงการ ผู้รับมอบหมาย หรือ Audit steps"
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
              />
            </label>
            <label>
              <span class="sr-only">กรองผู้รับมอบหมาย</span>
              <select class="gov-select" [ngModel]="analystFilter()" (ngModelChange)="analystFilter.set($event)">
                <option value="all">ทุกผู้รับมอบหมาย</option>
                @for (analyst of analysts; track analyst.id) {
                  <option [value]="analyst.id">{{ analyst.name }}</option>
                }
              </select>
            </label>
          </div>
        </div>

        @if (loading()) {
          <p class="px-[18px] py-8 text-center text-sm text-muted">กำลังโหลดรายการส่งสอบทาน...</p>
        } @else if (!filteredRows().length) {
          <div class="p-[18px]">
            <app-empty-state
              title="ยังไม่มีงานที่ส่งให้ตรวจทาน"
              message="เมื่องานถูกเปลี่ยนสถานะเป็น “ส่งงานให้ตรวจทาน” หรือ “อยู่ระหว่างสอบทาน” รายการจะแสดงที่นี่"
            />
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="gov-table min-w-[1120px]">
              <thead>
                <tr>
                  <th>สถานะโครงการโดยรวม</th>
                  <th>โครงการ</th>
                  <th>ผู้รับมอบหมาย</th>
                  <th>ขอบเขตงาน</th>
                  <th>ผลตรวจทานล่าสุด</th>
                  <th>การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredRows(); track row.key) {
                  <tr>
                    <td class="align-top">
                      <span class="rounded-full px-2.5 py-1 text-xs font-bold" [class]="projectWorkflowBadgeClass(row.assignment)">
                        {{ projectWorkflowLabel(row.assignment) }}
                      </span>
                      <p class="m-0 mt-2 text-xs text-muted">มอบหมาย {{ row.assignedAtText }}</p>
                    </td>
                    <td class="align-top">
                      <a
                        routerLink="/risk-factors"
                        [queryParams]="{ projectId: row.assignment.projectId }"
                        class="font-extrabold leading-6 text-ink no-underline hover:text-navy hover:underline"
                      >
                        {{ row.projectName }}
                      </a>
                      <div class="mt-2 flex flex-wrap gap-1.5">
                        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{{ row.subdistrictName }}</span>
                        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">รหัส {{ row.assignment.projectId }}</span>
                        @if (row.project?.budget_year) {
                          <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">ปีงบ {{ row.project?.budget_year }}</span>
                        }
                        @if (row.project?.project_type) {
                          <span class="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-navy">{{ row.project?.project_type }}</span>
                        }
                      </div>
                    </td>
                    <td class="align-top">
                      <p class="m-0 font-bold text-ink">{{ row.analyst?.name || row.assignment.analystId }}</p>
                      @if (row.analyst?.team) {
                        <p class="m-0 mt-1 text-xs text-muted">{{ row.analyst?.team }}</p>
                      } @else {
                        <p class="m-0 mt-1 text-xs italic text-slate-400">ยังไม่มีข้อมูล</p>
                      }
                    </td>
                    <td class="align-top">
                      <div class="max-w-[330px] space-y-1.5 text-xs leading-5 text-muted">
                        @if (row.assignment.dueDate) {
                          <p class="m-0"><span class="font-bold text-ink">Due date:</span> {{ row.assignment.dueDate }}</p>
                        }
                        @if (row.assignment.budgetHours) {
                          <p class="m-0"><span class="font-bold text-ink">Budget:</span> {{ row.assignment.budgetHours }} ชม.</p>
                        }
                        @if (row.assignment.auditSteps) {
                          <p class="m-0"><span class="font-bold text-ink">Audit steps:</span> {{ row.assignment.auditSteps }}</p>
                        } @else {
                          <p class="m-0 italic text-slate-400">ยังไม่มีข้อมูล Audit steps</p>
                        }
                      </div>
                    </td>
                    <td class="align-top">
                      @if (row.assignment.reviewNote || row.assignment.reviewedAt || row.assignment.reviewedBy) {
                        <p class="m-0 text-sm leading-6 text-ink">{{ row.assignment.reviewNote || 'ยังไม่มีหมายเหตุ' }}</p>
                        <p class="m-0 mt-1 text-xs text-muted">
                          โดย {{ row.assignment.reviewedBy || 'ยังไม่มีข้อมูล' }}
                          @if (row.assignment.reviewedAt) {
                            · {{ formatReviewDate(row.assignment.reviewedAt) }}
                          }
                        </p>
                      } @else {
                        <p class="m-0 text-sm italic text-slate-400">รอตรวจทาน</p>
                      }
                    </td>
                    <td class="align-top">
                      <div class="flex min-w-[210px] flex-col gap-2">
                        @if (row.assignment.workflowStatus === 'ready_for_review') {
                          <button type="button" class="gov-btn-outline w-full" (click)="requestReviewAction(row, 'start_review')">
                            รับเข้าตรวจทาน
                          </button>
                        }
                        <button type="button" class="gov-btn-primary w-full" (click)="requestReviewAction(row, 'approve')">
                          อนุมัติปิดงาน
                        </button>
                        <button
                          type="button"
                          class="min-h-[42px] cursor-pointer rounded-[3px] border-[1.5px] border-risk-high bg-white px-4 text-sm font-extrabold text-risk-high hover:bg-red-50"
                          (click)="requestReviewAction(row, 'request_revision')"
                        >
                          ส่งกลับแก้ไข
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </section>

    <app-confirm-modal
      [open]="confirmOpen()"
      [title]="confirmTitle()"
      [message]="confirmMessage()"
      [confirmLabel]="confirmLabel()"
      cancelLabel="ยกเลิก"
      (confirmed)="confirmReviewAction()"
      (cancelled)="cancelReviewAction()"
    />
  `,
})
export class AssignmentProjectAuditorReviewPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly analysts = ANALYSTS;
  readonly loading = signal(true);
  readonly error = signal('');
  readonly assignments = signal<SavedAssignment[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly search = signal('');
  readonly analystFilter = signal('all');
  readonly pendingAction = signal<{ row: ReviewRow; action: ReviewAction } | null>(null);
  readonly confirmOpen = signal(false);

  readonly reviewRows = computed<ReviewRow[]>(() =>
    this.assignments()
      .filter((assignment) => ['ready_for_review', 'under_review'].includes(assignment.workflowStatus ?? ''))
      .map((assignment) => this.toReviewRow(assignment))
      .sort((a, b) => this.dateValue(b.assignment.assignedAt) - this.dateValue(a.assignment.assignedAt)),
  );

  readonly filteredRows = computed(() => {
    const search = this.search().trim().toLocaleLowerCase('th');
    const analystId = this.analystFilter();
    return this.reviewRows().filter(
      (row) =>
        (!search || row.searchText.includes(search)) &&
        (analystId === 'all' || row.assignment.analystId === analystId),
    );
  });

  readonly readyForReviewCount = computed(
    () => this.assignments().filter((item) => item.workflowStatus === 'ready_for_review').length,
  );
  readonly underReviewCount = computed(
    () => this.assignments().filter((item) => item.workflowStatus === 'under_review').length,
  );

  readonly confirmTitle = computed(() => {
    switch (this.pendingAction()?.action) {
      case 'start_review':
        return 'รับงานเข้าตรวจทาน';
      case 'approve':
        return 'อนุมัติปิดงาน';
      case 'request_revision':
        return 'ส่งกลับแก้ไข';
      default:
        return 'ยืนยันการตรวจทาน';
    }
  });

  readonly confirmLabel = computed(() => {
    switch (this.pendingAction()?.action) {
      case 'start_review':
        return 'รับเข้าตรวจทาน';
      case 'approve':
        return 'อนุมัติปิดงาน';
      case 'request_revision':
        return 'ส่งกลับแก้ไข';
      default:
        return 'ยืนยัน';
    }
  });

  readonly confirmMessage = computed(() => {
    const pending = this.pendingAction();
    if (!pending) return 'กรุณาตรวจสอบรายการอีกครั้ง';
    const project = pending.row.projectName;
    switch (pending.action) {
      case 'start_review':
        return `ต้องการรับ “${project}” เข้าสู่ขั้นตอนสอบทานใช่หรือไม่?`;
      case 'approve':
        return `ต้องการอนุมัติและปิดงาน “${project}” ใช่หรือไม่? สถานะโครงการจะเป็นตรวจสอบเสร็จสิ้น`;
      case 'request_revision':
        return `ต้องการส่ง “${project}” กลับให้แก้ไขใช่หรือไม่? สถานะโครงการจะเป็นส่งกลับแก้ไข`;
    }
  });

  ngOnInit(): void {
    this.reloadAssignments();
    forkJoin({
      projects: this.api.projects().pipe(catchError(() => of<Project[]>([]))),
      subdistricts: this.api.subdistricts().pipe(catchError(() => of<Subdistrict[]>([]))),
    }).subscribe({
      next: ({ projects, subdistricts }) => {
        this.projects.set(projects);
        this.subdistricts.set(subdistricts);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('โหลดรายการตรวจทานไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  reloadAssignments(): void {
    this.assignments.set(this.readAssignments());
  }

  requestReviewAction(row: ReviewRow, action: ReviewAction): void {
    this.pendingAction.set({ row, action });
    this.confirmOpen.set(true);
  }

  cancelReviewAction(): void {
    this.pendingAction.set(null);
    this.confirmOpen.set(false);
  }

  confirmReviewAction(): void {
    const pending = this.pendingAction();
    if (!pending) return;

    const nextStatus = this.nextStatusForAction(pending.action);
    const reviewer =
      this.auth.user()?.display_name ??
      this.auth.user()?.full_name ??
      this.auth.user()?.username ??
      this.auth.token() ??
      undefined;

    const updated = this.assignments().map((assignment) => {
      if (this.assignmentKey(assignment) !== pending.row.key) {
        return assignment;
      }
      return {
        ...assignment,
        workflowStatus: nextStatus,
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewer,
        reviewNote: this.reviewNoteForAction(pending.action),
      };
    });

    this.writeAssignments(updated);
    this.assignments.set(updated);
    this.cancelReviewAction();
  }

  projectWorkflowLabel(assignment: SavedAssignment): string {
    return projectWorkflowStatusLabel(assignment.workflowStatus ?? null);
  }

  projectWorkflowBadgeClass(assignment: SavedAssignment): string {
    return projectWorkflowStatusBadgeClass(assignment.workflowStatus ?? null);
  }

  formatReviewDate(value: string): string {
    return this.formatDate(value);
  }

  private toReviewRow(assignment: SavedAssignment): ReviewRow {
    const project = this.projects().find((item) => String(item.project_id) === assignment.projectId) ?? null;
    const analyst = ANALYSTS.find((item) => item.id === assignment.analystId) ?? null;
    const subdistrictName = project
      ? subdistrictLabel(this.subdistricts().find((item) => item.subdistrict_id === project.subdistrict_id))
      : 'ยังไม่มีข้อมูล';
    const projectName = project?.project_name || 'ไม่พบข้อมูลโครงการ';
    const assignedAtText = this.formatDate(assignment.assignedAt);
    const searchText = [
      projectName,
      assignment.projectId,
      subdistrictName,
      analyst?.name,
      analyst?.team,
      assignment.analystId,
      assignment.note,
      assignment.auditSteps,
      assignment.assignedBy,
      assignment.reviewNote,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('th');

    return {
      key: this.assignmentKey(assignment),
      assignment,
      project,
      analyst,
      projectName,
      subdistrictName,
      assignedAtText,
      searchText,
    };
  }

  private nextStatusForAction(action: ReviewAction): AssignmentWorkflowStatus {
    switch (action) {
      case 'start_review':
        return 'under_review';
      case 'approve':
        return 'completed';
      case 'request_revision':
        return 'revision_requested';
    }
  }

  private reviewNoteForAction(action: ReviewAction): string {
    switch (action) {
      case 'start_review':
        return 'รับงานเข้าตรวจทานแล้ว';
      case 'approve':
        return 'อนุมัติผลการตรวจและปิดงานแล้ว';
      case 'request_revision':
        return 'ส่งกลับให้แก้ไขเพิ่มเติม';
    }
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'ยังไม่มีข้อมูล'
      : new Intl.DateTimeFormat('th-TH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(date);
  }

  private dateValue(value: string): number {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private readAssignments(): SavedAssignment[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(ASSIGNMENT_STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? (parsed as SavedAssignment[]) : [];
    } catch {
      return [];
    }
  }

  private writeAssignments(assignments: SavedAssignment[]): void {
    if (!assignments.length) {
      localStorage.removeItem(ASSIGNMENT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ASSIGNMENT_STORAGE_KEY, JSON.stringify(assignments));
  }

  private assignmentKey(assignment: SavedAssignment): string {
    return [
      assignment.assignedAt,
      assignment.projectId,
      assignment.analystId,
      assignment.workflowStatus,
      assignment.note,
    ].join('|');
  }
}
