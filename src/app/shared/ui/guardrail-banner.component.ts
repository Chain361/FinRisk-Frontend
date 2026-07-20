import { Component } from '@angular/core';
import { LucideTriangleAlert } from '@lucide/angular';

@Component({
  selector: 'app-guardrail-banner',
  standalone: true,
  imports: [LucideTriangleAlert],
  template: `
    <div class="flex items-start gap-3 rounded-[4px] border-[1.5px] border-gold-border bg-gold-bg px-[18px] py-3.5">
      <svg lucideTriangleAlert class="mt-1 size-[18px] shrink-0 text-gold-ink"></svg>
      <p class="m-0 text-[13.5px] leading-7 text-[#5c4a12]">
        สีและคะแนนที่ปรากฏในระบบเป็น "สัญญาณ" ให้เจ้าหน้าที่ตรวจสอบเพิ่มเติมเท่านั้น ไม่ใช่คำตัดสินความผิด
        กรุณาใช้ร่วมกับหลักฐาน เอกสารโครงการ และดุลยพินิจของหน่วยงานก่อนสรุปผลทุกครั้ง
      </p>
    </div>
  `,
})
export class GuardrailBannerComponent {}
