import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface StepperStep {
  label: string;
  state: 'done' | 'current' | 'upcoming';
}

@Component({
  selector: 'app-stepper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-start overflow-x-auto">
      @for (step of steps(); track step.label; let index = $index; let last = $last) {
        <div class="flex flex-1 items-center">
          <div class="flex w-[120px] flex-col items-center gap-2">
            <div
              class="flex size-9 items-center justify-center rounded-full border-2 text-sm font-extrabold"
              [class]="circleClasses(step)"
            >
              {{ step.state === 'done' ? '✓' : index + 1 }}
            </div>
            <span class="text-center text-[12.5px] font-bold text-ink">{{ step.label }}</span>
          </div>
          @if (!last) {
            <div
              class="mb-[26px] -mx-2 h-[3px] flex-1"
              [style.background]="step.state === 'done' ? '#15803d' : '#c7cfd8'"
            ></div>
          }
        </div>
      }
    </div>
  `,
})
export class StepperComponent {
  readonly steps = input.required<StepperStep[]>();

  circleClasses(step: StepperStep): string {
    switch (step.state) {
      case 'done':
        return 'border-risk-low bg-risk-low text-white';
      case 'current':
        return 'border-navy bg-navy text-white';
      default:
        return 'border-[#c7cfd8] bg-white text-slate-400';
    }
  }
}
