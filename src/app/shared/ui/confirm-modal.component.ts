import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

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
          <h3 class="m-0 mb-3 text-lg font-extrabold text-navy">{{ title() }}</h3>
          <p class="m-0 mb-[22px] text-sm leading-7 text-slate-700">{{ message() }}</p>
          <div class="flex justify-end gap-2.5">
            <button type="button" class="gov-btn-outline" (click)="cancelled.emit()">{{ cancelLabel() }}</button>
            <button type="button" class="gov-btn-primary" (click)="confirmed.emit()">{{ confirmLabel() }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmModalComponent {
  readonly open = input.required<boolean>();
  readonly title = input<string>('ยืนยันการบันทึกข้อมูล');
  readonly message = input<string>('ท่านต้องการยืนยันการดำเนินการนี้ใช่หรือไม่?');
  readonly confirmLabel = input<string>('ยืนยันการบันทึก');
  readonly cancelLabel = input<string>('ยกเลิก');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
