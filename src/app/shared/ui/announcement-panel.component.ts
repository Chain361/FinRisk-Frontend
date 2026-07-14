import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideFileText } from '@lucide/angular';

const DEFAULT_NOTICES = [
  'แจ้งปิดปรับปรุงระบบชั่วคราว วันที่ 20 ก.ค. 2568 เวลา 18:00-22:00 น. เพื่อปรับปรุงฐานข้อมูลปีงบประมาณ 2569',
  'แจ้งเวียนหนังสือซักซ้อมแนวทางบันทึกโครงการจัดซื้อจัดจ้างประจำปีงบประมาณ 2568',
];

@Component({
  selector: 'app-announcement-panel',
  standalone: true,
  imports: [LucideFileText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-hidden rounded-[4px] border-[1.5px] border-navy bg-white">
      <div class="bg-navy px-[18px] py-2.5 text-sm font-bold text-white">ประกาศข่าวสารและคู่มือการใช้งานระบบ</div>
      <div class="flex flex-col gap-2.5 px-[18px] py-4">
        @for (notice of notices(); track notice) {
          <p class="m-0 text-[13.5px] text-slate-700">▪ {{ notice }}</p>
        }
        <div class="mt-1.5">
          <button
            type="button"
            class="inline-flex h-[38px] cursor-pointer items-center gap-2 rounded-[3px] border-[1.5px] border-navy bg-white px-4 text-[13px] font-bold text-navy hover:bg-page"
          >
            <svg lucideFileText class="size-4"></svg>
            ดาวน์โหลดคู่มือการใช้งานระบบ (PDF)
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AnnouncementPanelComponent {
  readonly notices = input<string[]>(DEFAULT_NOTICES);
}
