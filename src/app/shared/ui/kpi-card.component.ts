import { Component, input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  template: `
    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-medium text-slate-500">{{ label() }}</p>
          <p class="mt-2 text-2xl font-semibold text-slate-950">{{ value() }}</p>
        </div>
        <span class="h-10 w-1.5 rounded-full" [class]="accentClass()"></span>
      </div>
      @if (hint()) {
        <p class="mt-3 text-xs leading-5 text-slate-500">{{ hint() }}</p>
      }
    </section>
  `,
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly hint = input<string>('');
  readonly accentClass = input<string>('bg-slate-300');
}
