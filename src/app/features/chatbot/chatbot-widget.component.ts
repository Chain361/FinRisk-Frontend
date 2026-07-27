import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideMessageCircle, LucideSend, LucideX } from '@lucide/angular';
import { HttpErrorResponse } from '@angular/common/http';

import { ApiService } from '../../core/api/api.service';
import { ChatToolCall, ChatTurn } from '../../core/models/domain.models';

interface DisplayMessage {
  role: 'user' | 'model';
  text: string;
  toolCalls?: ChatToolCall[];
}

/**
 * chatbot widget — ปุ่มลอยมุมขวาล่าง เปิด/ปิดกล่องแชท
 * ประวัติแชทอยู่ใน signal ของ component นี้เท่านั้น (ไม่ persist ข้าม reload)
 * เพราะ backend เป็น stateless เช่นกัน (ดู FinRisk-Backend src/services/chatbot.py)
 */
@Component({
  selector: 'app-chatbot-widget',
  standalone: true,
  imports: [FormsModule, LucideMessageCircle, LucideSend, LucideX],
  template: `
    @if (open()) {
      <div
        class="fixed bottom-24 right-5 z-50 flex h-[520px] w-[360px] flex-col rounded-lg border border-line bg-white shadow-xl"
        role="dialog"
        aria-label="ผู้ช่วยตอบคำถาม FinRisk"
      >
        <div class="flex items-center justify-between rounded-t-lg bg-navy px-4 py-3 text-white">
          <p class="m-0 text-sm font-bold">ผู้ช่วยตอบคำถาม FinRisk</p>
          <button
            type="button"
            class="cursor-pointer rounded p-1 hover:bg-white/10"
            aria-label="ปิดหน้าต่างแชท"
            (click)="open.set(false)"
          >
            <svg lucideX class="size-4" aria-hidden="true"></svg>
          </button>
        </div>

        <div #scrollArea class="flex-1 space-y-3 overflow-y-auto px-3 py-3">
          @if (messages().length === 0) {
            <p class="m-0 text-xs text-muted">
              ถามได้เกี่ยวกับโครงการ เอกสาร ผลวิเคราะห์ความเสี่ยง และข้อกฎหมายที่เกี่ยวข้อง เช่น
              "โครงการ MOCK-CON-002 ขาดเอกสารอะไรบ้าง"
            </p>
          }
          @for (m of messages(); track $index) {
            <div class="flex" [class]="m.role === 'user' ? 'justify-end' : 'justify-start'">
              <div
                class="max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px]"
                [class]="m.role === 'user' ? 'bg-navy text-white' : 'bg-zebra text-ink'"
              >
                {{ m.text }}
                @if (m.toolCalls?.length) {
                  <div class="mt-1.5 flex flex-wrap gap-1 border-t border-black/10 pt-1.5">
                    @for (tc of m.toolCalls; track tc.name) {
                      <span class="rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-muted">
                        อ้างอิง: {{ tc.name }}
                      </span>
                    }
                  </div>
                }
              </div>
            </div>
          }
          @if (loading()) {
            <p class="m-0 text-xs text-muted">กำลังค้นข้อมูล…</p>
          }
          @if (error()) {
            <p class="m-0 text-xs text-red-700">{{ error() }}</p>
          }
        </div>

        <form class="flex items-center gap-2 border-t border-line p-2.5" (submit)="send($event)">
          <input
            type="text"
            name="message"
            [(ngModel)]="draft"
            [disabled]="loading()"
            placeholder="พิมพ์คำถาม…"
            class="h-9 flex-1 rounded border border-line px-2.5 text-[13px]"
            autocomplete="off"
          />
          <button
            type="submit"
            [disabled]="loading() || !draft().trim()"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-navy text-white disabled:opacity-40"
            aria-label="ส่งข้อความ"
          >
            <svg lucideSend class="size-4" aria-hidden="true"></svg>
          </button>
        </form>
      </div>
    }

    <button
      type="button"
      class="fixed bottom-5 right-5 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-navy text-white shadow-lg hover:bg-navy/90"
      [attr.aria-label]="open() ? 'ปิดหน้าต่างแชท' : 'เปิดผู้ช่วยตอบคำถาม'"
      (click)="open.set(!open())"
    >
      <svg lucideMessageCircle class="size-6" aria-hidden="true"></svg>
    </button>
  `,
})
export class ChatbotWidgetComponent {
  private readonly api = inject(ApiService);
  private readonly scrollArea = viewChild<ElementRef<HTMLDivElement>>('scrollArea');

  readonly open = signal(false);
  readonly messages = signal<DisplayMessage[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly draft = signal('');

  send(event: Event): void {
    event.preventDefault();
    const text = this.draft().trim();
    if (!text || this.loading()) {
      return;
    }

    const history: ChatTurn[] = this.messages().map((m) => ({ role: m.role, text: m.text }));
    this.messages.update((list) => [...list, { role: 'user', text }]);
    this.draft.set('');
    this.error.set(null);
    this.loading.set(true);
    this.scrollToBottom();

    this.api.chatbotMessage(text, history).subscribe({
      next: (response) => {
        this.messages.update((list) => [
          ...list,
          { role: 'model', text: response.reply, toolCalls: response.tool_calls },
        ]);
        this.loading.set(false);
        this.scrollToBottom();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(
          err.status === 503
            ? 'ระบบ chatbot ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ'
            : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        );
        this.loading.set(false);
      },
    });
  }

  private scrollToBottom(): void {
    queueMicrotask(() => {
      const el = this.scrollArea()?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }
}
