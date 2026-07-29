import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { FEEDBACK_ROLES, RESOLVE_ROLES } from '../../core/auth/roles';
import {
  AssignmentAttachment,
  AuditAssignment,
  AuditorFeedback,
  AuditorFeedbackCreate,
  ConcernLevel,
} from '../../core/models/domain.models';
import { RiskMatrixComponent } from '../../shared/charts/risk-matrix.component';
import { ConfirmModalComponent } from '../../shared/ui/confirm-modal.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import {
  computeRiskScore,
  concernColor,
  concernLabel,
  feedbackStatusChipClass,
  feedbackStatusLabel,
  formatFeedbackDate,
} from '../../shared/utils/feedback-utils';
import { triggerBlobDownload } from '../../shared/utils/file-download-utils';

type ModalMode = 'submit' | 'delete' | 'resolve' | null;

/**
 * F5 — ความเห็นผู้ตรวจสอบต่อโครงการ (แผงใต้รายละเอียดโครงการในหน้า F3)
 * workflow: draft (แก้/ลบได้) → submitted (แก้ไม่ได้) → resolved (อนุมัติโดย admin/auditor)
 * สิทธิ์ mirror ฝั่ง backend: FEEDBACK_ROLES เห็น/เขียน, RESOLVE_ROLES อนุมัติ+จัดการของคนอื่น
 */
@Component({
  selector: 'app-project-feedback-panel',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, ConfirmModalComponent,  RiskMatrixComponent],
  template: `
    <section class="panel p-[18px]">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="m-0 text-[16px] font-bold text-ink">ความเห็นผู้ตรวจสอบ</h2>
          <p class="m-0 mt-1 text-[13px] text-muted">
            บันทึกข้อสังเกตและข้อเสนอแนะต่อโครงการนี้ — ฉบับร่างแก้ไขได้ ส่งแล้วแก้ไขไม่ได้
          </p>
        </div>
        <span
          class="rounded-[20px] border border-line bg-zebra px-3 py-1 text-xs font-bold text-slate-700"
        >
          {{ items().length }} รายการ
        </span>
      </div>

      @if (error()) {
        <p
          class="mt-3 rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high"
        >
          {{ error() }}
        </p>
      }

      @if (loading()) {
        <p class="mt-3 text-sm text-muted">กำลังโหลดความเห็น...</p>
      } @else {
        @if (!items().length) {
          <div class="mt-3">
            <app-empty-state
              title="ยังไม่มีความเห็นสำหรับโครงการนี้"
              message="เป็นคนแรกที่บันทึกข้อสังเกตหรือข้อเสนอแนะด้านล่าง"
            />
          </div>
        } @else {
          <div class="mt-3.5 grid gap-3">
            @for (item of items(); track item.feedback_id) {
              <article class="rounded-[4px] border-[1.5px] border-line p-3.5">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p class="m-0 text-sm font-bold text-ink">
                      {{ item.auditor_name || item.auditor_username }}
                    </p>
                    <p class="m-0 mt-0.5 text-[11.5px] text-muted">
                      อัปเดตล่าสุด {{ date(item.updated_at) }}
                      @if (item.resolved_at) {
                        · อนุมัติเมื่อ {{ date(item.resolved_at) }}
                      }
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-1.5">
                    @if (item.concern_level) {
                      <span
                        class="rounded-[3px] px-2 py-1 text-[11.5px] font-extrabold text-white"
                        [style.background]="concernColor(item.concern_level)"
                        >กังวล{{ concernLabel(item.concern_level) }}</span
                      >
                    }
                    <span
                      class="rounded-[3px] px-2 py-1 text-[11.5px] font-extrabold"
                      [class]="statusChipClass(item.status)"
                      >{{ statusLabel(item.status) }}</span
                    >
                  </div>
                </div>

                @if (item.risk_score !== null && item.risk_score !== undefined) {
                  <div
                    class="mt-2.5 grid items-start gap-3 rounded-[3px] border border-line-soft bg-zebra p-2.5 sm:grid-cols-[auto_1fr]"
                  >
                    <app-risk-matrix
                      [likelihood]="item.likelihood_score"
                      [impact]="item.impact_score"
                      [cellSize]="20"
                    />
                    <div class="grid gap-1">
                      <p class="m-0 text-[12px] font-bold text-slate-700">
                        โอกาส {{ item.likelihood_score }} × ผลกระทบ {{ item.impact_score }} = คะแนน
                        {{ item.risk_score }}/25
                      </p>
                      <p class="m-0 text-[11px] text-muted">
                        ข้อมูลจากแบบฟอร์มความคิดเห็นที่ผู้วิเคราะห์ส่ง — ไม่ใช่คะแนนที่คำนวณอัตโนมัติจากปัจจัยเสี่ยง
                      </p>
                      @if (item.concern_level) {
                        <p class="m-0 text-[11.5px] text-muted">
                          ระดับความกังวลจากผู้วิเคราะห์:
                          <span class="font-bold text-slate-700">{{
                            concernLabel(item.concern_level)
                          }}</span>
                        </p>
                      }
                    </div>
                  </div>
                }

                <p class="m-0 mt-2 text-[15px] leading-relaxed text-slate-800">
                  <span class="font-bold text-slate-600">ความคิดเห็น:</span> {{ item.feedback_text }}
                </p>
                @if (item.suggestions) {
                  <p class="m-0 mt-1.5 text-[12.5px] leading-relaxed text-muted">
                    <span class="font-bold text-slate-600">ข้อเสนอแนะ:</span> {{ item.suggestions }}
                  </p>
                }

                @if (attachmentsFor(item).length) {
                  <div class="mt-2.5 grid gap-1.5 border-t border-line-soft pt-2.5">
                    <span class="text-[11px] font-bold uppercase tracking-wide text-muted"
                      >เอกสารประกอบ</span
                    >
                    @for (file of attachmentsFor(item); track file.attachment_id) {
                      <div
                        class="flex items-center justify-between rounded-[3px] border border-line-soft bg-zebra px-2.5 py-1.5 text-xs"
                      >
                        <span class="truncate font-bold text-ink">{{ file.file_name }}</span>
                        <button
                          type="button"
                          class="shrink-0 px-2 py-0.5 text-[11.5px] font-bold text-navy hover:underline"
                          (click)="downloadAttachment(file)"
                        >
                          ดาวน์โหลด
                        </button>
                      </div>
                    }
                  </div>
                }

                @if (canEdit(item) || canResolve(item) || canCreateAuditReport(item)) {
                  <div class="mt-2.5 flex gap-2 border-t border-line-soft pt-2.5">
                    @if (canEdit(item)) {
                      <button
                        type="button"
                        class="gov-btn-outline text-[12.5px]"
                        (click)="startEdit(item)"
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        class="rounded-[3px] border-[1.5px] border-risk-high bg-white px-3 py-1.5 text-[12.5px] font-bold text-risk-high hover:bg-red-50"
                        (click)="askDelete(item)"
                      >
                        ลบ
                      </button>
                    }
                    @if (canResolve(item)) {
                      <button
                        type="button"
                        class="gov-btn-primary text-[12.5px]"
                        (click)="askResolve(item)"
                      >
                        อนุมัติ
                      </button>
                    }
                    @if (canCreateAuditReport(item)) {
                      <a
                        [routerLink]="['/audit-reports', item.feedback_id]"
                        class="gov-btn-primary inline-flex items-center justify-center text-[12.5px] no-underline"
                      >
                        บันทึกผลตรวจโครงการ
                      </a>
                    }
                  </div>
                }
              </article>
            }
          </div>
        }
      }

      <app-confirm-modal
        [open]="modalMode() !== null"
        [title]="modalTitle()"
        [message]="modalMessage()"
        [confirmLabel]="modalConfirmLabel()"
        (confirmed)="confirmModal()"
        (cancelled)="closeModal()"
      />
    </section>
  `,
})
export class ProjectFeedbackPanelComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly projectId = input.required<string>();

  readonly SCORE_OPTIONS = [1, 2, 3, 4, 5];

  readonly items = signal<AuditorFeedback[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly saving = signal(false);

  /** ไฟล์แนบของความเห็นแต่ละรายการ — ผูกผ่าน assignment ของโครงการนี้ที่มอบหมายให้ auditor_username
   * ของความเห็นนั้น (backend ยังไม่มี field เชื่อม attachment ↔ feedback_id ตรงๆ) */
  private readonly assignmentIdByUsername = signal<Map<string, number>>(new Map());
  private readonly attachmentsByAssignment = signal<Map<number, AssignmentAttachment[]>>(new Map());

  readonly formText = signal('');
  readonly formConcern = signal<ConcernLevel | null>(null);
  readonly formLikelihood = signal<number | null>(null);
  readonly formImpact = signal<number | null>(null);
  readonly formSuggestions = signal('');
  readonly editingId = signal<number | null>(null);

  readonly modalMode = signal<ModalMode>(null);
  private readonly modalTargetId = signal<number | null>(null);

  readonly previewScore = computed(() =>
    computeRiskScore(this.formLikelihood(), this.formImpact()),
  );
  readonly formValid = computed(() => this.formText().trim().length > 0);

  readonly concernColor = concernColor;
  readonly concernLabel = concernLabel;
  readonly statusLabel = feedbackStatusLabel;
  readonly statusChipClass = feedbackStatusChipClass;
  readonly date = formatFeedbackDate;

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      if (projectId) {
        this.reload(projectId);
      }
    });
  }

  readonly modalTitle = computed(() => {
    switch (this.modalMode()) {
      case 'submit':
        return 'ยืนยันการส่งความเห็น';
      case 'delete':
        return 'ยืนยันการลบความเห็น';
      case 'resolve':
        return 'ยืนยันการอนุมัติ';
      default:
        return '';
    }
  });

  readonly modalMessage = computed(() => {
    switch (this.modalMode()) {
      case 'submit':
        return 'เมื่อส่งแล้วจะไม่สามารถแก้ไขความเห็นนี้ได้อีก ต้องการส่งใช่หรือไม่?';
      case 'delete':
        return 'ความเห็นที่ลบจะหายไปถาวร ต้องการลบใช่หรือไม่?';
      case 'resolve':
        return 'อนุมัติเมื่อดำเนินการตามข้อสังเกตครบถ้วนแล้ว ต้องการอนุมัติใช่หรือไม่?';
      default:
        return '';
    }
  });

  readonly modalConfirmLabel = computed(() => {
    switch (this.modalMode()) {
      case 'submit':
        return 'ส่งความเห็น';
      case 'delete':
        return 'ลบ';
      case 'resolve':
        return 'อนุมัติ';
      default:
        return 'ยืนยัน';
    }
  });

  /** แก้/ลบได้เมื่อเป็น draft และ (เจ้าของ หรือ role ใน RESOLVE_ROLES) — ตรงกับเงื่อนไข backend */
  canEdit(item: AuditorFeedback): boolean {
    if (item.status !== 'draft') {
      return false;
    }
    const username = this.auth.user()?.username;
    return item.auditor_username === username || this.auth.hasRole(...RESOLVE_ROLES);
  }

  /** ปุ่มอนุมัติ — แสดงเฉพาะรายการที่ส่งแล้ว (design choice ฝั่ง UI; backend ไม่บังคับสถานะ) */
  canResolve(item: AuditorFeedback): boolean {
    return item.status === 'submitted' && this.auth.hasRole(...RESOLVE_ROLES);
  }

  /** ผู้ตรวจสอบโครงการเท่านั้นที่สร้างรายงานจากความเห็นที่อนุมัติแล้วได้ */
  canCreateAuditReport(item: AuditorFeedback): boolean {
    return item.status === 'resolved' && this.auth.hasRole('project_auditor');
  }

  /** ไฟล์แนบของ assignment ที่มอบหมายให้ auditor_username ของความเห็นนี้ในโครงการนี้ */
  attachmentsFor(item: AuditorFeedback): AssignmentAttachment[] {
    const assignmentId = this.assignmentIdByUsername().get(item.auditor_username);
    if (assignmentId === undefined) {
      return [];
    }
    return this.attachmentsByAssignment().get(assignmentId) ?? [];
  }

  downloadAttachment(file: AssignmentAttachment): void {
    this.api.downloadAssignmentAttachment(file.assignment_id, file.attachment_id).subscribe({
      next: (blob) => triggerBlobDownload(blob, file.file_name),
      error: () => this.error.set('ดาวน์โหลดไฟล์ไม่สำเร็จ'),
    });
  }

  setConcern(value: string): void {
    this.formConcern.set((value || null) as ConcernLevel | null);
  }

  setLikelihood(value: string): void {
    this.formLikelihood.set(value ? Number(value) : null);
  }

  setImpact(value: string): void {
    this.formImpact.set(value ? Number(value) : null);
  }

  startEdit(item: AuditorFeedback): void {
    this.editingId.set(item.feedback_id);
    this.formText.set(item.feedback_text);
    this.formConcern.set((item.concern_level as ConcernLevel) ?? null);
    this.formLikelihood.set(item.likelihood_score ?? null);
    this.formImpact.set(item.impact_score ?? null);
    this.formSuggestions.set(item.suggestions ?? '');
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.resetForm();
  }

  saveDraft(): void {
    this.persist('draft');
  }

  askSubmit(): void {
    this.modalMode.set('submit');
  }

  askDelete(item: AuditorFeedback): void {
    this.modalTargetId.set(item.feedback_id);
    this.modalMode.set('delete');
  }

  askResolve(item: AuditorFeedback): void {
    this.modalTargetId.set(item.feedback_id);
    this.modalMode.set('resolve');
  }

  closeModal(): void {
    this.modalMode.set(null);
    this.modalTargetId.set(null);
  }

  confirmModal(): void {
    const mode = this.modalMode();
    const targetId = this.modalTargetId();
    this.closeModal();
    if (mode === 'submit') {
      this.persist('submitted');
    } else if (mode === 'delete' && targetId !== null) {
      this.remove(targetId);
    } else if (mode === 'resolve' && targetId !== null) {
      this.resolve(targetId);
    }
  }

  private persist(status: 'draft' | 'submitted'): void {
    const body: AuditorFeedbackCreate = {
      project_id: this.projectId(),
      feedback_text: this.formText().trim(),
      concern_level: this.formConcern(),
      likelihood_score: this.formLikelihood(),
      impact_score: this.formImpact(),
      suggestions: this.formSuggestions().trim() || null,
      status,
    };

    this.saving.set(true);
    this.error.set('');
    const editingId = this.editingId();
    const request$ =
      editingId === null ? this.api.createFeedback(body) : this.api.updateFeedback(editingId, body);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.editingId.set(null);
        this.resetForm();
        this.reload(this.projectId());
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.detail ?? 'บันทึกความเห็นไม่สำเร็จ');
      },
    });
  }

  private remove(feedbackId: number): void {
    this.error.set('');
    this.api.deleteFeedback(feedbackId).subscribe({
      next: () => {
        if (this.editingId() === feedbackId) {
          this.cancelEdit();
        }
        this.reload(this.projectId());
      },
      error: (err) => this.error.set(err?.error?.detail ?? 'ลบความเห็นไม่สำเร็จ'),
    });
  }

  private resolve(feedbackId: number): void {
    this.error.set('');
    this.api.resolveFeedback(feedbackId).subscribe({
      next: () => {
        this.reload(this.projectId());
      },
      error: (err) => this.error.set(err?.error?.detail ?? 'อนุมัติไม่สำเร็จ'),
    });
  }

  private reload(projectId: string): void {
    this.loading.set(true);
    this.error.set('');
    this.api.projectFeedback(projectId).subscribe({
      next: (rows) => {
        this.items.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('โหลดความเห็นผู้ตรวจสอบไม่สำเร็จ');
        this.loading.set(false);
      },
    });
    this.loadAttachments(projectId);
  }

  /** หา assignment ของโครงการนี้ที่มอบหมายให้แต่ละ auditor_username แล้วโหลดไฟล์แนบของ assignment นั้นๆ */
  private loadAttachments(projectId: string): void {
    this.api
      .assignments()
      .pipe(catchError(() => of<AuditAssignment[]>([])))
      .subscribe((assignments) => {
        const matching = assignments.filter((a) => String(a.project_id) === projectId);
        this.assignmentIdByUsername.set(
          new Map(
            matching
              .filter((a): a is AuditAssignment & { assignee_username: string } =>
                Boolean(a.assignee_username),
              )
              .map((a) => [a.assignee_username, a.assignment_id]),
          ),
        );
        if (!matching.length) {
          this.attachmentsByAssignment.set(new Map());
          return;
        }
        forkJoin(
          matching.map((a) =>
            this.api
              .assignmentAttachments(a.assignment_id)
              .pipe(catchError(() => of<AssignmentAttachment[]>([]))),
          ),
        ).subscribe((lists) => {
          const map = new Map<number, AssignmentAttachment[]>();
          matching.forEach((a, index) => map.set(a.assignment_id, lists[index]));
          this.attachmentsByAssignment.set(map);
        });
      });
  }

  private resetForm(): void {
    this.formText.set('');
    this.formConcern.set(null);
    this.formLikelihood.set(null);
    this.formImpact.set(null);
    this.formSuggestions.set('');
  }
}
