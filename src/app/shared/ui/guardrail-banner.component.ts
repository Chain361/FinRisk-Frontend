import { Component } from '@angular/core';
import { LucideTriangleAlert } from '@lucide/angular';

@Component({
  selector: 'app-guardrail-banner',
  standalone: true,
  imports: [LucideTriangleAlert],
  template: `
    <div class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <svg lucideTriangleAlert class="mt-0.5 size-4 shrink-0"></svg>
      <p class="leading-6">
        สีและคะแนนเป็นสัญญาณให้ตรวจสอบต่อ ไม่ใช่คำตัดสินความผิด ให้ใช้ร่วมกับหลักฐาน รายละเอียดโครงการ
        และบริบทของตำบลก่อนสรุปผล
      </p>
    </div>
  `,
})
export class GuardrailBannerComponent {}
