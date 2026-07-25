import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { SystemMeta } from '../../core/models/domain.models';
import { LucideDatabase } from '@lucide/angular';

interface DataSourceEntry {
  name: string;
  owner: string;
  coverage: string;
  frequency: string;
  lastUpdated: string;
  verifiedBy: string;
}

/**
 * รายการที่มาข้อมูลระดับระบบ — mock (ยังไม่มี registry จริงฝั่ง backend)
 * แก้ไข/เพิ่มรายการเมื่อมีการเชื่อมต่อแหล่งข้อมูลจริงเพิ่มเติม
 */
const DATA_SOURCES: DataSourceEntry[] = [
  {
    name: 'ระบบจัดซื้อจัดจ้างภาครัฐ (e-GP)',
    owner: 'กรมบัญชีกลาง',
    coverage: 'ปีงบประมาณ 2563–2568',
    frequency: 'รายเดือน',
    lastUpdated: '2568-07-01',
    verifiedBy: 'ทีมวิเคราะห์ข้อมูล FinRisk',
  },
  {
    name: 'ฐานข้อมูลงบประมาณองค์กรปกครองส่วนท้องถิ่น (อปท.)',
    owner: 'กรมส่งเสริมการปกครองท้องถิ่น (สถ.)',
    coverage: 'ปีงบประมาณ 2564–2568',
    frequency: 'รายไตรมาส',
    lastUpdated: '2568-06-15',
    verifiedBy: 'ทีมวิเคราะห์ข้อมูล FinRisk',
  },
  {
    name: 'ทะเบียนโครงการและงบประมาณตำบล (FinRisk Internal)',
    owner: 'ทีมพัฒนาระบบ FinRisk',
    coverage: 'ปีงบประมาณ 2563–2568',
    frequency: 'รายวัน (batch sync)',
    lastUpdated: '2568-07-20',
    verifiedBy: 'ผู้ดูแลระบบ FinRisk',
  },
];

@Component({
  selector: 'app-data-sources-page',
  standalone: true,
  imports: [RouterLink, LucideDatabase],
  template: `
    <section class="page-shell">
      <div>
        <h1 class="m-0 text-[26px] font-extrabold text-ink">ที่มาของข้อมูล (Data Sources)</h1>
        <p class="m-0 mt-1.5 text-sm text-muted">
          สรุปแหล่งข้อมูลทั้งหมดที่ระบบใช้ในการวิเคราะห์ความเสี่ยง เพื่อความโปร่งใสและตรวจสอบได้
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2.5 rounded-[4px] border-[1.5px] border-line bg-white px-4 py-3">
        <svg lucideDatabase class="size-4 text-navy" aria-hidden="true"></svg>
        <span class="text-[13px] text-slate-700">
          ข้อมูลรวมของระบบ ณ วันที่ <span class="font-bold text-navy">{{ dataAsOf() }}</span>
          @if (fiscalYearRange()) {
            · ครอบคลุมปีงบประมาณ <span class="font-bold text-navy">{{ fiscalYearRange() }}</span>
          }
        </span>
      </div>

      <section class="panel overflow-hidden">
        <div class="overflow-x-auto">
          <table class="gov-table w-full">
            <thead>
              <tr>
                <th scope="col">แหล่งข้อมูล</th>
                <th scope="col">หน่วยงานเจ้าของข้อมูล</th>
                <th scope="col">ช่วงเวลาที่ครอบคลุม</th>
                <th scope="col">ความถี่การอัปเดต</th>
                <th scope="col">ปรับปรุงล่าสุด</th>
                <th scope="col">ผู้รับรองความถูกต้อง</th>
              </tr>
            </thead>
            <tbody>
              @for (source of sources; track source.name) {
                <tr>
                  <td class="font-bold text-ink">{{ source.name }}</td>
                  <td>{{ source.owner }}</td>
                  <td>{{ source.coverage }}</td>
                  <td>{{ source.frequency }}</td>
                  <td>{{ source.lastUpdated }}</td>
                  <td>{{ source.verifiedBy }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel p-[18px]">
        <h2 class="m-0 text-[15px] font-bold text-ink">เอกสารและช่องทางที่เกี่ยวข้อง</h2>
        <ul class="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0 text-[13px] text-slate-700">
          <li>เอกสารวิธีการประเมินความเสี่ยง (RISK_ASSESSMENT_METHODOLOGY.md) — จะเผยแพร่เร็วๆ นี้</li>
          <li>
            พบข้อมูลไม่ถูกต้องหรือต้องการสอบถามที่มาของข้อมูล ติดต่อได้ที่
            <a routerLink="/contact" class="text-navy no-underline hover:underline">หน้าติดต่อ / แจ้งข้อมูลไม่ถูกต้อง</a>
          </li>
        </ul>
      </section>
    </section>
  `,
})
export class DataSourcesPageComponent {
  private readonly api = inject(ApiService);

  readonly sources = DATA_SOURCES;

  private readonly meta = toSignal<SystemMeta | null>(
    this.api.meta().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  readonly dataAsOf = computed(() => {
    const raw = this.meta()?.data_seeded_at;
    if (!raw) {
      return '—';
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime())
      ? '—'
      : new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' }).format(parsed);
  });

  readonly fiscalYearRange = computed(() => {
    const m = this.meta();
    return m?.fiscal_year_min && m?.fiscal_year_max ? `${m.fiscal_year_min}–${m.fiscal_year_max}` : '';
  });
}
