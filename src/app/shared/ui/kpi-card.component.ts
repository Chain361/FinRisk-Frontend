import { Component, input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  template: `
    <section class="relative rounded-[4px] border-[1.5px] border-line bg-white py-4 pl-[22px] pr-[18px]">
      <span class="absolute bottom-0 left-0 top-0 w-1.5 rounded-l-[3px]" [class]="accentClass()"></span>
      <p class="m-0 text-[13px] font-bold text-muted">{{ label() }}</p>
      <p class="m-0 mt-2 text-[27px] font-extrabold text-ink">{{ value() }}</p>
      @if (hint()) {
        <p class="m-0 mt-1.5 text-xs text-muted">{{ hint() }}</p>
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
