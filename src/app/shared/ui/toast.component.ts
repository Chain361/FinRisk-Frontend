import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-center gap-2.5 rounded-[4px] border-[1.5px] bg-white px-4 py-2.5 text-[13px] font-bold shadow-lg"
          [class]="
            toast.kind === 'success'
              ? 'border-risk-low bg-green-50 text-risk-low'
              : 'border-risk-high bg-red-50 text-risk-high'
          "
          role="status"
        >
          {{ toast.text }}
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  protected readonly toastService = inject(ToastService);
}
