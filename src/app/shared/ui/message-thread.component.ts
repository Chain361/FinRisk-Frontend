import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideSend } from '@lucide/angular';

import { AssignmentClarification } from '../../core/models/domain.models';

/**
 * กระทู้ขอความชัดเจน (clarification thread) — bubble list ระหว่าง risk_analyst กับ project_auditor
 * ต่องานตรวจสอบหนึ่งงาน สไตล์ bubble mirror จาก chatbot-widget.component.ts แต่เป็น panel ฝังในหน้า
 * ไม่ใช่ floating widget
 */
@Component({
  selector: 'app-message-thread',
  standalone: true,
  imports: [FormsModule, LucideSend],
  template: `
    <div class="rounded-[4px] border border-line-soft bg-white">
      <div #scrollArea class="max-h-80 space-y-3 overflow-y-auto p-3">
        @if (messages().length === 0) {
          <p class="m-0 text-xs text-muted">ยังไม่มีข้อความในกระทู้นี้</p>
        }
        @for (m of messages(); track m.clarification_id) {
          <div class="flex" [class]="m.created_by === currentUserId() ? 'justify-end' : 'justify-start'">
            <div class="max-w-[85%]">
              <p class="m-0 mb-0.5 text-[11px] text-muted">
                {{ m.created_by === currentUserId() ? 'คุณ' : m.created_by_display_name || 'ผู้ใช้' }}
                · {{ formatTime(m.created_at) }}
              </p>
              <div
                class="whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px]"
                [class]="
                  m.created_by === currentUserId() ? 'bg-navy text-white' : 'bg-zebra text-ink'
                "
              >
                {{ m.message_text }}
              </div>
            </div>
          </div>
        }
      </div>

      <form class="flex items-center gap-2 border-t border-line-soft p-2.5" (submit)="onSubmit($event)">
        <input
          type="text"
          name="message"
          [(ngModel)]="draft"
          [disabled]="sending()"
          placeholder="พิมพ์ข้อความขอความชัดเจน…"
          class="gov-input h-9 flex-1 text-[13px]"
          autocomplete="off"
        />
        <button
          type="submit"
          [disabled]="sending() || !draft().trim()"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-navy text-white disabled:opacity-40"
          aria-label="ส่งข้อความ"
        >
          <svg lucideSend class="size-4" aria-hidden="true"></svg>
        </button>
      </form>
    </div>
  `,
})
export class MessageThreadComponent {
  private readonly scrollArea = viewChild<ElementRef<HTMLDivElement>>('scrollArea');

  readonly messages = input.required<AssignmentClarification[]>();
  readonly currentUserId = input.required<number>();
  readonly sending = input(false);
  readonly send = output<string>();

  readonly draft = signal('');

  onSubmit(event: Event): void {
    event.preventDefault();
    const text = this.draft().trim();
    if (!text || this.sending()) {
      return;
    }
    this.send.emit(text);
    this.draft.set('');
    queueMicrotask(() => this.scrollToBottom());
  }

  formatTime(value: string): string {
    const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bangkok',
    }).format(date);
  }

  private scrollToBottom(): void {
    const el = this.scrollArea()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
