import { Component, input } from '@angular/core';
import { LucideCircleAlert } from '@lucide/angular';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [LucideCircleAlert],
  template: `
    <div class="rounded-[4px] border-[1.5px] border-dashed border-line bg-zebra px-5 py-8 text-center">
      <svg lucideCircleAlert class="mx-auto size-6 text-muted"></svg>
      <p class="mt-3 text-sm font-bold text-ink">{{ title() }}</p>
      <p class="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted">{{ message() }}</p>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input('ยังไม่มีข้อมูล');
  readonly message = input('ลองเปลี่ยนตัวกรองหรือเลือกข้อมูลช่วงอื่น');
}
