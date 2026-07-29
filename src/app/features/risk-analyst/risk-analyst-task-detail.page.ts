/**
 * RiskAnalystTaskDetailPageComponent
 *
 * หน้ารายละเอียดงานสำหรับ Risk Analyst (ผู้รับมอบหมาย) — แสดงข้อมูลจาก backend จริง
 * (GET /audit/assignments) พร้อมแนบหลักฐาน (evidence) และกระทู้ขอความชัดเจน (clarification thread)
 * ฟีเจอร์บันทึกผลตรวจสอบ (Working Paper) และบันทึกเวลาทำงาน ยังไม่มี backend รองรับ — อยู่ระหว่างพัฒนา
 */

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/api/api.service';
import {
  AssignmentAttachment,
  AssignmentClarification,
  AuditAssignment,
  Project,
  Subdistrict,
} from '../../core/models/domain.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { formatFileSize, triggerBlobDownload } from '../../shared/utils/file-download-utils';
import {
  assignmentWorkflowStatusBadgeClass,
  assignmentWorkflowStatusLabel,
} from '../assignment-project-auditor/assignment-project-auditor.models';

@Component({
  selector: 'app-risk-analyst-task-detail-page',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  template: `
    <section class="page-shell">
      <!-- Header -->
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="m-0 text-[26px] font-extrabold text-ink">รายละเอียดงาน</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">ขอบเขตงานและสถานะการตรวจสอบ</p>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="gov-btn-outline inline-flex items-center justify-center"
            (click)="reloadData()"
          >
            รีเฟรชข้อมูล
          </button>
          <a
            routerLink="/risk-analyst-feedback"
            [queryParams]="assignment() ? { projectId: assignment()!.project_id } : {}"
            class="gov-btn-outline inline-flex items-center justify-center text-center no-underline"
          >
            เพิ่มบันทึกความเห็น
          </a>
          <a
            routerLink="/risk-analyst/my-tasks"
            class="gov-btn-outline inline-flex items-center justify-center text-center no-underline"
          >
            กลับหน้างานที่ได้รับมอบหมาย
          </a>
        </div>
      </div>

      @if (error()) {
        <div
          class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high"
        >
          {{ error() }}
        </div>
      }

      @if (loading()) {
        <p class="px-[18px] py-8 text-center text-sm text-muted">กำลังโหลดรายละเอียดงาน...</p>
      } @else if (!assignment()) {
        <div class="p-[18px]">
          <app-empty-state
            title="ไม่พบรายละเอียดงาน"
            message="งานนี้อาจถูกลบหรือคุณไม่มีสิทธิ์เข้าถึง"
          />
        </div>
      } @else {
        <div class="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.6fr)]">
          <!-- Left: Assignment Info -->
          <div class="panel p-[18px]">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="m-0 text-[17px] font-extrabold text-ink">
                  {{ assignment()!.project_name || 'ไม่ระบุชื่อโครงการ' }}
                </h2>
                <p class="m-0 mt-1 text-[13px] text-muted">
                  รหัส {{ assignment()!.project_id }} · มอบหมาย
                  {{ formatAssignedAt(assignment()!.created_at) }}
                </p>
              </div>
              <span class="rounded-full px-3 py-1.5 text-xs font-bold" [class]="statusBadgeClass()">
                {{ statusLabel() }}
              </span>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-3">
              <div class="rounded-[4px] border border-line-soft bg-zebra p-3">
                <p class="m-0 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  ผู้มอบหมาย
                </p>
                <p class="m-0 mt-1 text-sm font-bold text-ink">{{ assignerName() }}</p>
              </div>
              <div class="rounded-[4px] border border-line-soft bg-zebra p-3">
                <p class="m-0 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  Due Date
                </p>
                <p
                  class="m-0 mt-1 text-sm font-bold"
                  [class]="isOverdue() ? 'text-risk-high' : 'text-ink'"
                >
                  {{ dueDateDisplay() }}
                </p>
              </div>
              <div class="rounded-[4px] border border-line-soft bg-zebra p-3">
                <p class="m-0 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  Budget Hours
                </p>
                <p class="m-0 mt-1 text-sm font-bold text-ink">{{ budgetHoursDisplay() }}</p>
              </div>
            </div>

            <div class="mt-4 border-t border-line-soft pt-4">
              <p class="m-0 text-[11px] font-extrabold uppercase tracking-wide text-navy">
                ขอบเขตงานตรวจสอบ
              </p>
              <div class="mt-1 grid gap-3 text-sm leading-6 sm:grid-cols-2">
                <div>
                  <p class="m-0 text-xs font-bold text-navy">กระบวนการงาน</p>
                  @if (assignment()!.work_process) {
                    <p class="m-0 text-ink">{{ assignment()!.work_process }}</p>
                  } @else {
                    <p class="m-0 italic text-muted">ยังไม่มีข้อมูล</p>
                  }
                </div>
                <div
                  class="border-t border-line-soft pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0"
                >
                  <p class="m-0 text-xs font-bold text-navy">วัตถุประสงค์</p>
                  @if (assignment()!.work_objective) {
                    <p class="m-0 text-ink">{{ assignment()!.work_objective }}</p>
                  } @else {
                    <p class="m-0 italic text-muted">ยังไม่มีข้อมูล</p>
                  }
                </div>
              </div>
            </div>

            @if (assignment()!.note) {
              <div class="mt-4 border-t border-line-soft pt-4">
                <p class="m-0 text-[11px] font-extrabold uppercase tracking-wide text-navy">
                  คำแนะนำ
                </p>
                <p class="m-0 mt-1 whitespace-pre-line text-sm leading-6 text-ink">
                  {{ assignment()!.note }}
                </p>
              </div>
            }
          </div>

          <!-- Right: Status Summary -->
          <div class="panel p-[18px]">
            <h2 class="m-0 text-[15px] font-extrabold text-ink">สถานะงาน</h2>
            <div class="mt-3 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted">สถานะปัจจุบัน</span>
                <span
                  class="rounded-full px-2.5 py-1 text-xs font-bold"
                  [class]="statusBadgeClass()"
                >
                  {{ statusLabel() }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted">Due Date</span>
                <span
                  class="text-sm font-bold"
                  [class]="isOverdue() ? 'text-risk-high' : 'text-ink'"
                  >{{ dueDateDisplay() }}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted">Priority</span>
                <span class="text-sm font-bold text-ink">{{ priorityDisplay() }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted">มอบหมายเมื่อ</span>
                <span class="text-sm text-ink">{{
                  formatAssignedAt(assignment()!.created_at)
                }}</span>
              </div>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class RiskAnalystTaskDetailPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly assignmentId = signal<number | null>(null);

  // ── State Signals ──
  readonly loading = signal(true);
  readonly error = signal('');
  readonly assignment = signal<AuditAssignment | null>(null);
  readonly project = signal<Project | null>(null);
  readonly subdistrict = signal<Subdistrict | null>(null);

  // ── Evidence + Clarification State ──
  readonly attachments = signal<AssignmentAttachment[]>([]);
  readonly attachmentError = signal('');
  readonly uploading = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly clarifications = signal<AssignmentClarification[]>([]);
  readonly sendingMessage = signal(false);

  readonly currentUserId = computed(() => this.auth.user()?.user_id ?? -1);

  private readonly projects = signal<Project[]>([]);
  private readonly subdistricts = signal<Subdistrict[]>([]);

  // ── Computed ──

  readonly assignerName = computed(() => {
    const a = this.assignment();
    return a?.assigned_by_display_name || a?.assigned_by_username || 'ไม่ระบุ';
  });

  readonly statusLabel = computed(
    () => assignmentWorkflowStatusLabel(this.assignment()?.status) ?? 'ไม่ระบุสถานะ',
  );

  readonly statusBadgeClass = computed(
    () =>
      assignmentWorkflowStatusBadgeClass(this.assignment()?.status) ??
      'bg-slate-100 text-slate-600',
  );

  readonly dueDateDisplay = computed(() => {
    const due = this.assignment()?.due_date;
    if (!due) return 'ไม่ระบุ';
    const [y, m, d] = due.split('-').map(Number);
    if (!y || !m || !d) return due;
    return new Intl.DateTimeFormat('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(y, m - 1, d));
  });

  readonly isOverdue = computed(() => {
    const due = this.assignment()?.due_date;
    if (!due) return false;
    return new Date(due) < new Date();
  });

  readonly budgetHoursDisplay = computed(() => {
    const hours = this.assignment()?.budget_hours;
    return hours ? `${hours} ชั่วโมง` : 'ไม่ระบุ';
  });

  readonly priorityDisplay = computed(() => {
    const p = this.assignment()?.priority;
    return p === 'high' ? 'สำคัญ' : p === 'normal' ? 'ปกติ' : p === 'low' ? 'ต่ำ' : 'ไม่ระบุ';
  });

  // ── Lifecycle ──

  ngOnInit(): void {
    const assignmentId = this.route.snapshot.paramMap.get('id');
    if (assignmentId) {
      this.assignmentId.set(Number(assignmentId));
      this.loadData(Number(assignmentId));
    } else {
      this.error.set('ไม่พบรหัสงาน');
      this.loading.set(false);
    }
  }

  loadData(assignmentId: number): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      assignments: this.api.assignments().pipe(catchError(() => of<AuditAssignment[]>([]))),
      projects: this.api.projects().pipe(catchError(() => of<Project[]>([]))),
      subdistricts: this.api.subdistricts().pipe(catchError(() => of<Subdistrict[]>([]))),
    }).subscribe({
      next: ({ assignments, projects, subdistricts }) => {
        this.projects.set(projects);
        this.subdistricts.set(subdistricts);
        const found = assignments.find((a) => a.assignment_id === assignmentId);
        this.assignment.set(found ?? null);
        if (found) {
          const project = projects.find((p) => String(p.project_id) === found.project_id);
          this.project.set(project ?? null);
          if (project) {
            const sub = subdistricts.find((s) => s.subdistrict_id === project.subdistrict_id);
            this.subdistrict.set(sub ?? null);
          }
          this.loadEvidenceAndClarifications(assignmentId);
        } else {
          this.error.set('ไม่พบงานที่ระบุ');
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('โหลดข้อมูลไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  reloadData(): void {
    const id = this.assignment()?.assignment_id;
    if (id) this.loadData(id);
  }

  // ── Helpers ──

  formatAssignedAt(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'ยังไม่มีข้อมูล'
      : new Intl.DateTimeFormat('th-TH', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Bangkok',
        }).format(date);
  }

  formatSize(bytes: number): string {
    return formatFileSize(bytes);
  }

  // ── Evidence + Clarification ──

  private loadEvidenceAndClarifications(assignmentId: number): void {
    this.api.assignmentAttachments(assignmentId).subscribe({
      next: (list) => this.attachments.set(list),
      error: () => this.attachmentError.set('โหลดรายการไฟล์แนบไม่สำเร็จ'),
    });
    this.api.assignmentClarifications(assignmentId).subscribe({
      next: (list) => this.clarifications.set(list),
    });
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.selectedFile.set(file);
  }

  uploadEvidence(event: Event): void {
    event.preventDefault();
    const assignmentId = this.assignmentId();
    const file = this.selectedFile();
    if (!assignmentId || !file || this.uploading()) {
      return;
    }
    this.uploading.set(true);
    this.attachmentError.set('');
    this.api.uploadAssignmentAttachment(assignmentId, file).subscribe({
      next: () => {
        this.selectedFile.set(null);
        this.uploading.set(false);
        this.loadEvidenceAndClarifications(assignmentId);
      },
      error: () => {
        this.attachmentError.set('แนบไฟล์ไม่สำเร็จ ตรวจสอบนามสกุล/ขนาดไฟล์ (ไม่เกิน 10MB)');
        this.uploading.set(false);
      },
    });
  }

  deleteEvidence(attachmentId: number): void {
    const assignmentId = this.assignmentId();
    if (!assignmentId) {
      return;
    }
    this.api.deleteAssignmentAttachment(assignmentId, attachmentId).subscribe({
      next: () =>
        this.attachments.update((list) => list.filter((f) => f.attachment_id !== attachmentId)),
      error: () => this.attachmentError.set('ลบไฟล์ไม่สำเร็จ'),
    });
  }

  downloadEvidence(file: AssignmentAttachment): void {
    const assignmentId = this.assignmentId();
    if (!assignmentId) {
      return;
    }
    this.api.downloadAssignmentAttachment(assignmentId, file.attachment_id).subscribe({
      next: (blob) => triggerBlobDownload(blob, file.file_name),
      error: () => this.attachmentError.set('ดาวน์โหลดไฟล์ไม่สำเร็จ'),
    });
  }

  sendClarification(messageText: string): void {
    const assignmentId = this.assignmentId();
    if (!assignmentId || this.sendingMessage()) {
      return;
    }
    this.sendingMessage.set(true);
    this.api.postAssignmentClarification(assignmentId, messageText).subscribe({
      next: (message) => {
        this.clarifications.update((list) => [...list, message]);
        this.sendingMessage.set(false);
      },
      error: () => this.sendingMessage.set(false),
    });
  }
}
