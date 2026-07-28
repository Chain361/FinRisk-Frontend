/**
 * AssignmentProjectAuditorReviewPageComponent
 *
 * หน้าตรวจทาน/อนุมัติงานตรวจสอบ สำหรับ project_auditor (ตรวจทาน → ส่งขออนุมัติ/ตีกลับ) และ
 * regional_supervisor (อนุมัติปิดงาน/ตีกลับขั้นสุดท้าย) — เชื่อม PATCH /audit/assignments/{id}/status
 * ที่มีอยู่แล้วใน backend (approval chain, PR #14) แต่ยังไม่เคยมี UI เรียกใช้มาก่อน
 */

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  AssignmentAttachment,
  AssignmentClarification,
  AssignmentDetailResponse,
  AssignmentStatus,
  AssignmentStatusHistoryEntry,
} from '../../core/models/domain.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { MessageThreadComponent } from '../../shared/ui/message-thread.component';
import { formatFileSize, triggerBlobDownload } from '../../shared/utils/file-download-utils';
import {
  assignmentWorkflowStatusBadgeClass,
  assignmentWorkflowStatusLabel,
} from './assignment-project-auditor.models';

/** mirror ของ REVIEWER_TRANSITIONS/SUPERVISOR_TRANSITIONS ใน src/routers/audit.py — ใช้แค่กำหนดว่า
 * ปุ่มไหนควรแสดง ตัว backend เป็นคนบังคับสิทธิ์จริงอีกชั้นเสมอ */
const REVIEWER_TRANSITIONS: Partial<Record<AssignmentStatus, AssignmentStatus[]>> = {
  ready_for_review: ['under_review'],
  under_review: ['revision_requested', 'pending_approval'],
};
const SUPERVISOR_TRANSITIONS: Partial<Record<AssignmentStatus, AssignmentStatus[]>> = {
  pending_approval: ['completed', 'revision_requested'],
};
const TRANSITION_LABELS: Record<AssignmentStatus, string> = {
  waiting_acceptance: 'รอผู้รับงานตอบรับ',
  accepted: 'รับงานแล้ว',
  in_progress: 'เริ่มดำเนินการ',
  clarification_needed: 'ขอคำชี้แจง',
  ready_for_review: 'ส่งงานให้ตรวจทาน',
  under_review: 'เริ่มสอบทาน',
  pending_approval: 'ส่งขออนุมัติ',
  revision_requested: 'ตีกลับให้แก้ไข',
  completed: 'อนุมัติ/ปิดงาน',
};

@Component({
  selector: 'app-assignment-project-auditor-review-page',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, MessageThreadComponent],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="m-0 text-[26px] font-extrabold text-ink">ตรวจทานงานตรวจสอบ</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">ตรวจหลักฐาน กระทู้ขอความชัดเจน และอนุมัติ/ตีกลับงาน</p>
        </div>
        <div class="flex gap-2">
          <button type="button" class="gov-btn-outline" (click)="reload()">รีเฟรชข้อมูล</button>
          <a
            routerLink="/risk-factors/status"
            class="gov-btn-outline inline-flex items-center justify-center text-center no-underline"
          >
            กลับหน้าสถานะโครงการ
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
          <app-empty-state title="ไม่พบรายละเอียดงาน" message="งานนี้อาจถูกลบหรือคุณไม่มีสิทธิ์เข้าถึง" />
        </div>
      } @else {
        <div class="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.6fr)]">
          <div class="panel p-[18px]">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="m-0 text-[17px] font-extrabold text-ink">
                  {{ assignment()!.project_name || 'ไม่ระบุชื่อโครงการ' }}
                </h2>
                <p class="m-0 mt-1 text-[13px] text-muted">
                  รหัส {{ assignment()!.project_id }} · ผู้รับมอบหมาย
                  {{ assignment()!.assignee_display_name || assignment()!.assignee_username }}
                </p>
              </div>
              <span class="rounded-full px-3 py-1.5 text-xs font-bold" [class]="statusBadgeClass()">
                {{ statusLabel() }}
              </span>
            </div>

            @if (assignment()!.note) {
              <div class="mt-4 rounded-[4px] border-l-4 border-navy bg-[#edf4fb] px-4 py-3">
                <p class="m-0 text-[11px] font-extrabold uppercase tracking-wide text-navy">
                  คำแนะนำเดิมจากตอนมอบหมาย
                </p>
                <p class="m-0 mt-1 text-sm leading-6 text-ink">{{ assignment()!.note }}</p>
              </div>
            }

            <!-- หลักฐานประกอบ (อ่านอย่างเดียว — auditor ตรวจไฟล์ที่ analyst แนบมา) -->
            <div class="mt-4">
              <h3 class="m-0 mb-2 text-[13px] font-extrabold uppercase tracking-wide text-muted">
                หลักฐานประกอบ (Evidence)
              </h3>
              <ul class="m-0 list-none space-y-2 p-0">
                @for (file of attachments(); track file.attachment_id) {
                  <li
                    class="flex items-center justify-between rounded-[4px] border border-line-soft bg-zebra px-3 py-2 text-sm"
                  >
                    <div>
                      <p class="m-0 font-bold text-ink">{{ file.file_name }}</p>
                      <p class="m-0 text-xs text-muted">
                        {{ formatSize(file.file_size) }} · แนบโดย
                        {{ file.uploaded_by_display_name || 'ไม่ระบุ' }}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="gov-btn-outline shrink-0 px-2.5 py-1 text-xs"
                      (click)="downloadEvidence(file)"
                    >
                      ดาวน์โหลด
                    </button>
                  </li>
                } @empty {
                  <li class="text-sm text-muted">ยังไม่มีไฟล์แนบ</li>
                }
              </ul>
            </div>

            <!-- กระทู้ขอความชัดเจน -->
            <div class="mt-4">
              <h3 class="m-0 mb-2 text-[13px] font-extrabold uppercase tracking-wide text-muted">
                กระทู้ขอความชัดเจน
              </h3>
              <app-message-thread
                [messages]="clarifications()"
                [currentUserId]="currentUserId()"
                [sending]="sendingMessage()"
                (send)="sendClarification($event)"
              />
            </div>

            <!-- ปุ่มดำเนินการ -->
            @if (availableTransitions().length) {
              <div class="mt-4 rounded-[4px] border border-line-soft bg-zebra p-[18px]">
                <h3 class="m-0 mb-2 text-[13px] font-extrabold uppercase tracking-wide text-muted">
                  ดำเนินการ
                </h3>
                @if (needsNote()) {
                  <textarea
                    class="gov-input w-full"
                    rows="2"
                    placeholder="ระบุเหตุผลที่ตีกลับงาน (บังคับกรอก)"
                    [value]="actionNote()"
                    (input)="actionNote.set($any($event.target).value)"
                  ></textarea>
                }
                @if (transitionError()) {
                  <p class="m-0 mt-2 text-sm text-risk-high">{{ transitionError() }}</p>
                }
                <div class="mt-3 flex flex-wrap gap-2">
                  @for (next of availableTransitions(); track next) {
                    <button
                      type="button"
                      class="gov-btn-outline disabled:cursor-not-allowed disabled:opacity-60"
                      [class]="next === 'completed' ? 'border-risk-low text-risk-low' : ''"
                      [disabled]="transitioning()"
                      (click)="applyTransition(next)"
                    >
                      {{ transitionLabel(next) }}
                    </button>
                  }
                </div>
              </div>
            }
          </div>

          <div class="panel p-[18px]">
            <h2 class="m-0 text-[15px] font-extrabold text-ink">ประวัติสถานะ</h2>
            <ol class="m-0 mt-3 list-none space-y-3 p-0">
              @for (entry of statusHistory(); track entry.history_id) {
                <li class="border-l-2 border-navy pl-3">
                  <p class="m-0 text-sm font-bold text-ink">
                    {{ statusHistoryLabel(entry.new_status) }}
                  </p>
                  <p class="m-0 text-xs text-muted">
                    {{ entry.changed_by_display_name || entry.changed_by_username }} ·
                    {{ formatDate(entry.created_at) }}
                  </p>
                  @if (entry.note) {
                    <p class="m-0 mt-1 text-xs italic text-ink">{{ entry.note }}</p>
                  }
                </li>
              } @empty {
                <li class="text-sm text-muted">ยังไม่มีประวัติ</li>
              }
            </ol>
          </div>
        </div>
      }
    </section>
  `,
})
export class AssignmentProjectAuditorReviewPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly assignmentId = signal<number | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly assignment = signal<AssignmentDetailResponse['assignment'] | null>(null);
  readonly statusHistory = signal<AssignmentStatusHistoryEntry[]>([]);
  readonly attachments = signal<AssignmentAttachment[]>([]);
  readonly clarifications = signal<AssignmentClarification[]>([]);
  readonly sendingMessage = signal(false);
  readonly transitioning = signal(false);
  readonly transitionError = signal('');
  readonly actionNote = signal('');

  readonly currentUserId = computed(() => this.auth.user()?.user_id ?? -1);

  readonly statusLabel = computed(
    () => assignmentWorkflowStatusLabel(this.assignment()?.status) ?? 'ไม่ระบุสถานะ',
  );
  readonly statusBadgeClass = computed(
    () => assignmentWorkflowStatusBadgeClass(this.assignment()?.status) ?? 'bg-slate-100 text-slate-600',
  );

  readonly availableTransitions = computed<AssignmentStatus[]>(() => {
    const status = this.assignment()?.status;
    if (!status) {
      return [];
    }
    const role = this.auth.role();
    if (role === 'admin') {
      return [
        ...(REVIEWER_TRANSITIONS[status] ?? []),
        ...(SUPERVISOR_TRANSITIONS[status] ?? []),
      ];
    }
    if (role === 'project_auditor') {
      return REVIEWER_TRANSITIONS[status] ?? [];
    }
    if (role === 'regional_supervisor') {
      return SUPERVISOR_TRANSITIONS[status] ?? [];
    }
    return [];
  });

  readonly needsNote = computed(() => this.availableTransitions().includes('revision_requested'));

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.assignmentId.set(Number(id));
      this.loadAll(Number(id));
    } else {
      this.error.set('ไม่พบรหัสงาน');
      this.loading.set(false);
    }
  }

  reload(): void {
    const id = this.assignmentId();
    if (id) {
      this.loadAll(id);
    }
  }

  private loadAll(assignmentId: number): void {
    this.loading.set(true);
    this.error.set('');
    this.api.assignmentDetail(assignmentId).subscribe({
      next: ({ assignment, status_history }) => {
        this.assignment.set(assignment);
        this.statusHistory.set(status_history);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('โหลดรายละเอียดงานไม่สำเร็จ หรือคุณไม่มีสิทธิ์เข้าถึงงานนี้');
        this.loading.set(false);
      },
    });
    this.api
      .assignmentAttachments(assignmentId)
      .pipe(catchError(() => of<AssignmentAttachment[]>([])))
      .subscribe((list) => this.attachments.set(list));
    this.api
      .assignmentClarifications(assignmentId)
      .pipe(catchError(() => of<AssignmentClarification[]>([])))
      .subscribe((list) => this.clarifications.set(list));
  }

  downloadEvidence(file: AssignmentAttachment): void {
    const assignmentId = this.assignmentId();
    if (!assignmentId) {
      return;
    }
    this.api.downloadAssignmentAttachment(assignmentId, file.attachment_id).subscribe({
      next: (blob) => triggerBlobDownload(blob, file.file_name),
      error: () => this.error.set('ดาวน์โหลดไฟล์ไม่สำเร็จ'),
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

  transitionLabel(status: AssignmentStatus): string {
    return TRANSITION_LABELS[status];
  }

  statusHistoryLabel(status: AssignmentStatus): string {
    return assignmentWorkflowStatusLabel(status);
  }

  applyTransition(next: AssignmentStatus): void {
    const assignmentId = this.assignmentId();
    if (!assignmentId || this.transitioning()) {
      return;
    }
    const note = this.actionNote().trim();
    if (next === 'revision_requested' && !note) {
      this.transitionError.set('ต้องระบุเหตุผลเมื่อตีกลับงาน');
      return;
    }
    this.transitioning.set(true);
    this.transitionError.set('');
    this.api.updateAssignmentStatus(assignmentId, next, note || undefined).subscribe({
      next: () => {
        this.actionNote.set('');
        this.transitioning.set(false);
        this.loadAll(assignmentId);
      },
      error: () => {
        this.transitionError.set('เปลี่ยนสถานะไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        this.transitioning.set(false);
      },
    });
  }

  formatDate(value: string): string {
    const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('th-TH', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Bangkok',
        }).format(date);
  }

  formatSize(bytes: number): string {
    return formatFileSize(bytes);
  }
}
