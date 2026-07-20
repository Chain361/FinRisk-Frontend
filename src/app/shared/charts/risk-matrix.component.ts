import { Component, computed, input } from '@angular/core';

import { RiskBand } from '../../core/models/domain.models';
import { bandColor, bandFromScore } from '../../shared/utils/risk-utils';

interface Cell {
  likelihood: number;
  impact: number;
  score: number;
  band: RiskBand;
  color: string;
  active: boolean;
}

/**
 * ตารางความเสี่ยง 5×5 (โอกาส × ผลกระทบ) ตามมาตรฐานราชการ
 * ไฮไลต์ช่องที่ตรงกับ (likelihood, impact) ที่ส่งเข้ามา — สร้างด้วย div grid (ไม่พึ่ง lib)
 */
@Component({
  selector: 'app-risk-matrix',
  standalone: true,
  template: `
    <div class="inline-flex flex-col gap-1">
      <div class="flex items-stretch gap-1">
        <!-- แกน Y: ผลกระทบ (บนลงล่าง 5→1) -->
        <div class="flex flex-col justify-between pr-1 text-[10px] font-bold text-muted">
          <span class="flex flex-1 items-center">5</span>
          <span class="flex flex-1 items-center">4</span>
          <span class="flex flex-1 items-center">3</span>
          <span class="flex flex-1 items-center">2</span>
          <span class="flex flex-1 items-center">1</span>
        </div>
        <div class="grid grid-cols-5 gap-1">
          @for (cell of cells(); track cell.impact * 10 + cell.likelihood) {
            <div
              class="flex items-center justify-center rounded-[2px] text-[10px] font-bold"
              [style.width.px]="cellSize()"
              [style.height.px]="cellSize()"
              [style.background]="cell.active ? cell.color : cell.color + '26'"
              [style.color]="cell.active ? '#fff' : cell.color"
              [style.outline]="cell.active ? '2px solid #132036' : 'none'"
              [style.outlineOffset.px]="1"
              [title]="'โอกาส ' + cell.likelihood + ' × ผลกระทบ ' + cell.impact + ' = ' + cell.score + ' (' + cell.band + ')'"
            >
              {{ cell.active ? cell.score : '' }}
            </div>
          }
        </div>
      </div>
      <div class="flex items-center gap-1 pl-4 text-[10px] font-bold text-muted">
        <span class="grid grid-cols-5 gap-1">
          <span class="text-center" [style.width.px]="cellSize()">1</span>
          <span class="text-center" [style.width.px]="cellSize()">2</span>
          <span class="text-center" [style.width.px]="cellSize()">3</span>
          <span class="text-center" [style.width.px]="cellSize()">4</span>
          <span class="text-center" [style.width.px]="cellSize()">5</span>
        </span>
      </div>
      <p class="m-0 pl-4 text-[10px] text-muted">← โอกาส · ผลกระทบ ↑</p>
    </div>
  `,
})
export class RiskMatrixComponent {
  readonly likelihood = input<number | null | undefined>(null);
  readonly impact = input<number | null | undefined>(null);
  readonly cellSize = input<number>(30);

  readonly cells = computed<Cell[]>(() => {
    const activeL = this.likelihood();
    const activeI = this.impact();
    const rows: Cell[] = [];
    for (let impact = 5; impact >= 1; impact--) {
      for (let likelihood = 1; likelihood <= 5; likelihood++) {
        const score = likelihood * impact;
        const band = bandFromScore(score) ?? 'ต่ำ';
        rows.push({
          likelihood,
          impact,
          score,
          band,
          color: bandColor(band),
          active: activeL === likelihood && activeI === impact,
        });
      }
    }
    return rows;
  });
}
