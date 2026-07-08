import { Component, input } from '@angular/core';
import { LucideCircleAlert } from '@lucide/angular';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [LucideCircleAlert],
  template: `
    <div class="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
      <svg lucideCircleAlert class="mx-auto size-6 text-slate-400"></svg>
      <p class="mt-3 text-sm font-semibold text-slate-700">{{ title() }}</p>
      <p class="mx-auto mt-1 max-w-xl text-sm leading-6 text-slate-500">{{ message() }}</p>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input('ยังไม่มีข้อมูล');
  readonly message = input('ลองเปลี่ยนตัวกรองหรือเลือกข้อมูลช่วงอื่น');
}
