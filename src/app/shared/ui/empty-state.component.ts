import { Component, inject, input } from '@angular/core';
import { LucideCircleAlert } from '@lucide/angular';

import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [LucideCircleAlert],
  template: `
    <div class="rounded-[4px] border-[1.5px] border-dashed border-line bg-zebra px-5 py-8 text-center">
      <svg lucideCircleAlert class="mx-auto size-6 text-muted"></svg>
      <p class="mt-3 text-sm font-bold text-ink">{{ title() || t('emptyState.title') }}</p>
      <p class="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted">
        {{ message() || t('emptyState.message') }}
      </p>
    </div>
  `,
})
export class EmptyStateComponent {
  protected readonly t = inject(I18nService).t;
  readonly title = input('');
  readonly message = input('');
}
