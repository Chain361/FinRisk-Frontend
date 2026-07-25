import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { I18nService } from '../../core/i18n/i18n.service';

/**
 * ปุ่มสลับภาษา TH | EN แบบ segmented — เรียก I18nService.setLang() (จำค่าใน localStorage)
 * ใช้ได้ทั้งบน header (พื้นขาว) และหน้า login
 */
@Component({
  selector: 'app-language-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="inline-flex overflow-hidden rounded-[3px] border-[1.5px] border-line text-[12px] font-bold"
      role="group"
      [attr.aria-label]="i18n.t('lang.switchAria')"
    >
      <button
        type="button"
        class="cursor-pointer px-2.5 py-1.5 leading-none"
        [class]="i18n.lang() === 'th' ? 'bg-navy text-white' : 'bg-white text-slate-600 hover:bg-zebra'"
        [attr.aria-pressed]="i18n.lang() === 'th'"
        (click)="i18n.setLang('th')"
      >
        {{ i18n.t('lang.th') }}
      </button>
      <button
        type="button"
        class="cursor-pointer border-l-[1.5px] border-line px-2.5 py-1.5 leading-none"
        [class]="i18n.lang() === 'en' ? 'bg-navy text-white' : 'bg-white text-slate-600 hover:bg-zebra'"
        [attr.aria-pressed]="i18n.lang() === 'en'"
        (click)="i18n.setLang('en')"
      >
        {{ i18n.t('lang.en') }}
      </button>
    </div>
  `,
})
export class LanguageToggleComponent {
  protected readonly i18n = inject(I18nService);
}
