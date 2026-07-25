import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

import { I18nService } from '../../core/i18n/i18n.service';

let dialogSeq = 0;

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        style="background: rgba(11, 49, 100, 0.55);"
        (click)="cancelled.emit()"
      >
        <div
          #dialog
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="titleId"
          [attr.aria-describedby]="messageId"
          class="w-[90%] max-w-[460px] rounded-[4px] border-2 border-navy bg-white p-[26px]"
          (click)="$event.stopPropagation()"
        >
          <h2 [id]="titleId" class="m-0 mb-3 text-lg font-extrabold text-navy">
            {{ title() || t('confirm.title') }}
          </h2>
          <p [id]="messageId" class="m-0 mb-[22px] text-sm leading-7 text-slate-700">
            {{ message() || t('confirm.message') }}
          </p>
          <div class="flex justify-end gap-2.5">
            <button type="button" class="gov-btn-outline" (click)="cancelled.emit()">
              {{ cancelLabel() || t('confirm.cancel') }}
            </button>
            <button #confirmBtn type="button" class="gov-btn-primary" (click)="confirmed.emit()">
              {{ confirmLabel() || t('confirm.confirm') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmModalComponent {
  protected readonly t = inject(I18nService).t;
  readonly open = input.required<boolean>();
  readonly title = input<string>('');
  readonly message = input<string>('');
  readonly confirmLabel = input<string>('');
  readonly cancelLabel = input<string>('');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  private readonly confirmBtn = viewChild<ElementRef<HTMLButtonElement>>('confirmBtn');
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  private readonly id = ++dialogSeq;
  protected readonly titleId = `confirm-title-${this.id}`;
  protected readonly messageId = `confirm-message-${this.id}`;

  /** โฟกัสที่คืนกลับหลังปิด dialog (เพื่อไม่ให้โฟกัสหลุดไป body) */
  private previousFocus: HTMLElement | null = null;

  constructor() {
    // ย้ายโฟกัสเข้า dialog เมื่อเปิด และคืนโฟกัสเดิมเมื่อปิด (2.4.3 Focus Order)
    effect(() => {
      if (this.open()) {
        this.previousFocus = document.activeElement as HTMLElement | null;
        queueMicrotask(() => this.confirmBtn()?.nativeElement.focus());
      } else if (this.previousFocus) {
        this.previousFocus.focus();
        this.previousFocus = null;
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.cancelled.emit();
    }
  }

  /** ขังโฟกัสไว้ภายใน dialog (Tab/Shift+Tab วน) — 2.1.2 No Keyboard Trap (แบบ modal) */
  @HostListener('document:keydown', ['$event'])
  onTab(event: KeyboardEvent): void {
    if (!this.open() || event.key !== 'Tab') {
      return;
    }
    const root = this.dialog()?.nativeElement;
    if (!root) {
      return;
    }
    const focusable = root.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
