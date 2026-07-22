import { Component, computed, input } from '@angular/core';

import { FEEDBACK_STATUS_LABELS, FeedbackStatus } from '../../core/models/feedback.models';

@Component({
  selector: 'app-feedback-status-badge',
  standalone: true,
  template: `
    <span
      class="inline-flex items-center rounded-[3px] px-2.5 py-1 text-xs font-bold"
      [class]="classes()"
    >
      {{ label() }}
    </span>
  `,
})
export class FeedbackStatusBadgeComponent {
  readonly status = input<FeedbackStatus | null | undefined>(null);

  readonly label = computed(() => {
    const status = this.status();
    return status ? FEEDBACK_STATUS_LABELS[status] : 'ยังไม่มีความคิดเห็น';
  });

  readonly classes = computed(() => {
    switch (this.status()) {
      case 'draft':
        return 'bg-slate-500 text-white';
      case 'submitted':
        return 'bg-navy text-white';
      case 'resolved':
        return 'bg-risk-low text-white';
      default:
        return 'bg-slate-200 text-slate-600';
    }
  });
}
