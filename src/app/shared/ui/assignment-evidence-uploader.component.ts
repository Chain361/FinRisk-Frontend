import { Component, effect, inject, input, signal } from '@angular/core';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AssignmentAttachment } from '../../core/models/domain.models';
import { formatFileSize, triggerBlobDownload } from '../utils/file-download-utils';

/**
 * กล่องแนบไฟล์เอกสารประกอบ (Drag & Drop) — ผูกกับ assignment_id เดียวกับ "หลักฐานประกอบ"
 * ในหน้ารายละเอียดงาน (risk-analyst-task-detail.page.ts) เพราะ backend ยังไม่มี endpoint
 * แนบไฟล์ระดับ feedback แยกต่างหาก — reuse endpoint เดิม (/audit/assignments/:id/attachments)
 */
@Component({
  selector: 'app-assignment-evidence-uploader',
  standalone: true,
  template: `
    <div class="grid gap-1.5">
      <span class="text-[12.5px] font-bold text-muted">เอกสารประกอบ (ถ้ามี)</span>

      @if (attachmentError()) {
        <p class="m-0 text-sm text-risk-high">{{ attachmentError() }}</p>
      }

      @if (!assignmentId()) {
        <p class="m-0 text-sm text-muted">
          ยังไม่มีงานตรวจสอบ (assignment) ผูกกับโครงการนี้ — ต้องมีการมอบหมายงานก่อนจึงจะแนบไฟล์ได้
        </p>
      }

      <label
        class="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[4px] border-[1.5px] border-dashed px-4 py-6 text-center transition-colors"
        [class]="dragOver() ? 'border-navy bg-[#edf4fb]' : 'border-line bg-zebra'"
        [class.cursor-not-allowed]="!assignmentId()"
        [class.opacity-50]="!assignmentId()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
      >
        <input
          type="file"
          class="sr-only"
          accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
          [disabled]="!assignmentId()"
          (change)="onFileChange($event)"
        />
        <span class="text-sm font-bold text-slate-700">
          {{ selectedFile() ? selectedFile()!.name : 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์' }}
        </span>
        <span class="text-xs text-muted"
          >แนบไฟล์เอกสารประกอบ (ถ้ามี) — PDF, รูปภาพ, Word, Excel ไม่เกิน 10MB</span
        >
      </label>

      <div class="flex justify-end">
        <button
          type="button"
          class="gov-btn-outline text-[12.5px] disabled:cursor-not-allowed disabled:opacity-40"
          [disabled]="!assignmentId() || !selectedFile() || uploading()"
          (click)="upload()"
        >
          {{ uploading() ? 'กำลังแนบ...' : 'แนบไฟล์' }}
        </button>
      </div>

      @if (attachments().length) {
        <ul class="m-0 mt-1 list-none space-y-2 p-0">
          @for (file of attachments(); track file.attachment_id) {
            <li
              class="flex items-center justify-between rounded-[4px] border border-line-soft bg-white px-3 py-2 text-sm"
            >
              <div>
                <p class="m-0 font-bold text-ink">{{ file.file_name }}</p>
                <p class="m-0 text-xs text-muted">
                  {{ formatSize(file.file_size) }} · แนบโดย
                  {{ file.uploaded_by_display_name || 'ไม่ระบุ' }} ·
                  {{ formatAssignedAt(file.created_at) }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  class="gov-btn-outline px-2.5 py-1 text-xs"
                  (click)="download(file)"
                >
                  ดาวน์โหลด
                </button>
                @if (file.uploaded_by === currentUserId()) {
                  <button
                    type="button"
                    class="px-2.5 py-1 text-xs font-bold text-risk-high"
                    (click)="deleteFile(file.attachment_id)"
                  >
                    ลบ
                  </button>
                }
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class AssignmentEvidenceUploaderComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly assignmentId = input<number | null>(null);

  readonly attachments = signal<AssignmentAttachment[]>([]);
  readonly attachmentError = signal('');
  readonly uploading = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly dragOver = signal(false);

  readonly currentUserId = () => this.auth.user()?.user_id ?? -1;

  constructor() {
    effect(() => {
      const id = this.assignmentId();

      this.selectedFile.set(null);
      this.attachmentError.set('');
      if (id) {
        this.reload(id);
      } else {
        this.attachments.set([]);
      }
    });
  }

  formatSize(bytes: number): string {
    return formatFileSize(bytes);
  }

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

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    if (!this.assignmentId()) {
      return;
    }
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) {
      this.selectedFile.set(file);
    }
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.selectedFile.set(file);
  }

  upload(): void {
    const id = this.assignmentId();
    const file = this.selectedFile();
    if (!id || !file || this.uploading()) {
      return;
    }
    this.uploading.set(true);
    this.attachmentError.set('');
    this.api.uploadAssignmentAttachment(id, file).subscribe({
      next: () => {
        this.selectedFile.set(null);
        this.uploading.set(false);
        this.reload(id);
      },
      error: () => {
        this.attachmentError.set('แนบไฟล์ไม่สำเร็จ ตรวจสอบนามสกุล/ขนาดไฟล์ (ไม่เกิน 10MB)');
        this.uploading.set(false);
      },
    });
  }

  download(file: AssignmentAttachment): void {
    const id = this.assignmentId();
    if (!id) {
      return;
    }
    this.api.downloadAssignmentAttachment(id, file.attachment_id).subscribe({
      next: (blob) => triggerBlobDownload(blob, file.file_name),
      error: () => this.attachmentError.set('ดาวน์โหลดไฟล์ไม่สำเร็จ'),
    });
  }

  deleteFile(attachmentId: number): void {
    const id = this.assignmentId();
    if (!id) {
      return;
    }
    this.api.deleteAssignmentAttachment(id, attachmentId).subscribe({
      next: () =>
        this.attachments.update((list) => list.filter((f) => f.attachment_id !== attachmentId)),
      error: () => this.attachmentError.set('ลบไฟล์ไม่สำเร็จ'),
    });
  }

  private reload(assignmentId: number): void {
    this.api.assignmentAttachments(assignmentId).subscribe({
      next: (list) => this.attachments.set(list),
      error: () => this.attachmentError.set('โหลดรายการไฟล์แนบไม่สำเร็จ'),
    });
  }
}
