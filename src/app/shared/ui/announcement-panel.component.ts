import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
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
      <div class="bg-navy px-[18px] py-2.5 text-sm font-bold text-white">
        ประกาศข่าวสารและคู่มือการใช้งานระบบ
      </div>
      <div class="flex flex-col gap-2.5 px-[18px] py-4">
        @for (notice of displayNotices(); track notice) {
          <p class="m-0 text-[13.5px] text-slate-700">▪ {{ notice }}</p>
        }
        <div class="mt-1.5">
          <a
            href="/docs/finrisk-user-manual.pdf"
            download="คู่มือการใช้งานระบบ FinRisk.pdf"
            class="inline-flex h-[38px] cursor-pointer items-center gap-2 rounded-[3px] border-[1.5px] border-navy bg-white px-4 text-[13px] font-bold text-navy no-underline hover:bg-page"
          >
            <svg lucideFileText class="size-4" aria-hidden="true"></svg>
            {{ t('announce.downloadManual') }}
            ดาวน์โหลดคู่มือการใช้งานระบบ (PDF)
          </a>
        </div>
      </div>
    </div>
  `,
})
export class AnnouncementPanelComponent {
  /** notices ที่ caller ส่งมา; ถ้าไม่ส่ง ใช้ประกาศตัวอย่างเริ่มต้น */
  readonly notices = input<string[]>([]);
  readonly displayNotices = computed(() => {
    const provided = this.notices();
    return provided.length ? provided : DEFAULT_NOTICES;
  });
}
