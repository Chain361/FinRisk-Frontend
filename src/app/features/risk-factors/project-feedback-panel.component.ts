import { Component, computed, effect, inject, input, signal } from '@angular/core';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { FEEDBACK_ROLES, RESOLVE_ROLES } from '../../core/auth/roles';
import {
  AuditorFeedback,
  AuditorFeedbackCreate,
  ConcernLevel,
} from '../../core/models/domain.models';
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

type ModalMode = 'submit' | 'delete' | 'resolve' | null;

/**
 * F5 — ความเห็นผู้ตรวจสอบต่อโครงการ (แผงใต้รายละเอียดโครงการในหน้า F3)
 * workflow: draft (แก้/ลบได้) → submitted (แก้ไม่ได้) → resolved (ปิดเรื่องโดย admin/auditor)
 * สิทธิ์ mirror ฝั่ง backend: FEEDBACK_ROLES เห็น/เขียน, RESOLVE_ROLES ปิดเรื่อง+จัดการของคนอื่น
 */
@Component({
  selector: 'app-project-feedback-panel',
  standalone: true,
  imports: [EmptyStateComponent, ConfirmModalComponent],
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
                        · ปิดเรื่องเมื่อ {{ date(item.resolved_at) }}
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
                  <p class="m-0 mt-2 text-[12px] font-bold text-slate-700">
                    โอกาส {{ item.likelihood_score }} × ผลกระทบ {{ item.impact_score }} = คะแนน
                    {{ item.risk_score }}/25
                  </p>
                }

                <p class="m-0 mt-2 text-[15px] leading-relaxed text-slate-800">
                  {{ item.feedback_text }}
                </p>
                @if (item.suggestions) {
                  <p class="m-0 mt-1.5 text-[12.5px] leading-relaxed text-muted">
                    <span class="font-bold text-slate-600">ข้อเสนอแนะ:</span> {{ item.suggestions }}
                  </p>
                }

                @if (canEdit(item) || canResolve(item)) {
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
                        ปิดเรื่อง
                      </button>
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
        return 'ยืนยันการปิดเรื่อง';
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
        return 'ปิดเรื่องเมื่อดำเนินการตามข้อสังเกตครบถ้วนแล้ว ต้องการปิดเรื่องใช่หรือไม่?';
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
        return 'ปิดเรื่อง';
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

  /** ปุ่มปิดเรื่อง — แสดงเฉพาะรายการที่ส่งแล้ว (design choice ฝั่ง UI; backend ไม่บังคับสถานะ) */
  canResolve(item: AuditorFeedback): boolean {
    return item.status === 'submitted' && this.auth.hasRole(...RESOLVE_ROLES);
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
      next: () => this.reload(this.projectId()),
      error: (err) => this.error.set(err?.error?.detail ?? 'ปิดเรื่องไม่สำเร็จ'),
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
  }

  private resetForm(): void {
    this.formText.set('');
    this.formConcern.set(null);
    this.formLikelihood.set(null);
    this.formImpact.set(null);
    this.formSuggestions.set('');
  }
}
