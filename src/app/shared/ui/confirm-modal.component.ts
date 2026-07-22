import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '../../core/i18n/i18n.service';

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
          class="w-[90%] max-w-[460px] rounded-[4px] border-2 border-navy bg-white p-[26px]"
          (click)="$event.stopPropagation()"
        >
          <h3 class="m-0 mb-3 text-lg font-extrabold text-navy">{{ title() || t('confirm.title') }}</h3>
          <p class="m-0 mb-[22px] text-sm leading-7 text-slate-700">
            {{ message() || t('confirm.message') }}
          </p>
          <div class="flex justify-end gap-2.5">
            <button type="button" class="gov-btn-outline" (click)="cancelled.emit()">
              {{ cancelLabel() || t('confirm.cancel') }}
            </button>
            <button type="button" class="gov-btn-primary" (click)="confirmed.emit()">
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
}
