import { ChangeDetectionStrategy, Component, HostListener, ElementRef, inject, input, signal } from '@angular/core';

@Component({
  selector: 'app-info-tooltip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="relative inline-block">
      <button
        type="button"
        class="size-5 cursor-pointer rounded-full border-[1.5px] border-navy bg-white text-xs font-extrabold leading-none text-navy"
        (click)="open.set(!open())"
        aria-label="ข้อมูลเพิ่มเติม"
      >
        ?
      </button>
      @if (open()) {
        <div
          class="absolute left-0 top-[26px] z-20 rounded-[4px] bg-ink px-3 py-2.5 text-xs leading-relaxed text-white"
          [style.width.px]="width()"
        >
          {{ text() }}
        </div>
      }
    </span>
  `,
})
export class InfoTooltipComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly text = input.required<string>();
  readonly width = input<number>(260);

  readonly open = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }
}
