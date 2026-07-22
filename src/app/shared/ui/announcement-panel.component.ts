import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LucideFileText } from '@lucide/angular';

import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-announcement-panel',
  standalone: true,
  imports: [LucideFileText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-hidden rounded-[4px] border-[1.5px] border-navy bg-white">
      <div class="bg-navy px-[18px] py-2.5 text-sm font-bold text-white">
        {{ t('announce.header') }}
      </div>
      <div class="flex flex-col gap-2.5 px-[18px] py-4">
        @for (notice of displayNotices(); track notice) {
          <p class="m-0 text-[13.5px] text-slate-700">▪ {{ notice }}</p>
        }
        <div class="mt-1.5">
          <button
            type="button"
            class="inline-flex h-[38px] cursor-pointer items-center gap-2 rounded-[3px] border-[1.5px] border-navy bg-white px-4 text-[13px] font-bold text-navy hover:bg-page"
          >
            <svg lucideFileText class="size-4"></svg>
            {{ t('announce.downloadManual') }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AnnouncementPanelComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  /** notices ที่ caller ส่งมา; ถ้าไม่ส่ง ใช้ประกาศตัวอย่างเริ่มต้น (ตามภาษาปัจจุบัน) */
  readonly notices = input<string[]>([]);
  readonly displayNotices = computed(() => {
    const provided = this.notices();
    return provided.length ? provided : [this.t('announce.notice1'), this.t('announce.notice2')];
  });
}
