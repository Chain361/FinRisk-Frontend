import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AnnualRisk, Project, Subdistrict } from '../../core/models/domain.models';
import { TimeSeries, TimeSeriesChartComponent } from '../../shared/charts/time-series-chart.component';
import { FilterBarComponent } from '../../shared/filters/filter-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { RiskBadgeComponent } from '../../shared/ui/risk-badge.component';
import {
  FISCAL_YEARS,
  formatMoney,
  formatNumber,
  normalizeRiskLevel,
  subdistrictLabel,
  toBool,
  toNumber,
} from '../../shared/utils/risk-utils';

interface RepeatedEntity {
  label: string;
  years: number[];
  count: number;
  totalBudget: number;
}

interface Anomaly {
  project: Project;
  reason: string;
}

@Component({
  selector: 'app-trends-page',
  standalone: true,
  imports: [EmptyStateComponent, FilterBarComponent, RiskBadgeComponent, TimeSeriesChartComponent],
  template: `
    <section class="page-shell">
      <div>
        <p class="text-sm font-semibold text-slate-500">F4</p>
        <h1 class="text-2xl font-semibold text-slate-950">Time Series & Trend Analysis</h1>
        <p class="mt-1 text-sm text-slate-500">เทียบข้ามปี/ข้ามตำบลจาก /projects หลายปี และ /risk/annual</p>
      </div>

      <app-filter-bar
        [subdistricts]="subdistricts()"
        [selectedSubdistrictId]="selectedSubdistrictId()"
        [selectedYear]="null"
        [showYearFilter]="false"
        [showRiskFilter]="false"
        (selectedSubdistrictIdChange)="setSubdistrict($event)"
        (selectedYearChange)="noop()"
        (reset)="resetFilters()"
      />

      @if (error()) {
        <p class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</p>
      }

      <div class="grid gap-4 xl:grid-cols-2">
        <section class="panel p-4">
          <div class="mb-3">
            <h2 class="text-base font-semibold">งบเฉลี่ยตามประเภทโครงการ</h2>
            <p class="text-sm text-slate-500">ถ้าปีใดไม่มีโครงการประเภทนั้น กราฟจะเว้น gap ไม่แทนค่า 0</p>
          </div>
          <app-time-series-chart [series]="averageBudgetSeries()" yAxisName="บาท" />
        </section>

        <section class="panel p-4">
          <div class="mb-3">
            <h2 class="text-base font-semibold">ความเสี่ยงข้ามปี/ข้ามตำบล</h2>
            <p class="text-sm text-slate-500">เมื่อเลือกทุกตำบล เส้นจะแยกตามตำบล; เมื่อเลือกตำบลเดียว เส้นจะแยกตามระดับความเสี่ยง</p>
          </div>
          <app-time-series-chart [series]="riskTrendSeries()" yAxisName="จำนวนโครงการ" />
        </section>
      </div>

      <div class="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <section class="panel overflow-hidden">
          <div class="border-b border-slate-200 p-4">
            <h2 class="text-base font-semibold">โครงการ/ผู้รับจ้าง/วิธีจัดซื้อที่ซ้ำข้ามปี</h2>
            <p class="text-sm text-slate-500">ใช้ vendor field ถ้ามีจาก API; ถ้าไม่มีจะ fallback เป็นวิธีจัดซื้อ/ประเภทโครงการ</p>
          </div>

          @if (!repeatedEntities().length) {
            <div class="p-4">
              <app-empty-state title="ยังไม่พบรายการซ้ำ ≥ 2 ปี" message="ข้อมูลใน scope ปัจจุบันอาจมีปีเดียวหรือไม่มี vendor field" />
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th class="px-4 py-3">รายการ</th>
                    <th class="px-4 py-3">ปีที่พบ</th>
                    <th class="px-4 py-3 text-right">จำนวน</th>
                    <th class="px-4 py-3 text-right">งบรวม</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (entity of repeatedEntities(); track entity.label) {
                    <tr>
                      <td class="px-4 py-3 font-semibold text-slate-900">{{ entity.label }}</td>
                      <td class="px-4 py-3 text-slate-600">{{ entity.years.join(', ') }}</td>
                      <td class="px-4 py-3 text-right">{{ entity.count }}</td>
                      <td class="px-4 py-3 text-right">{{ money(entity.totalBudget) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="panel p-4">
          <h2 class="text-base font-semibold">Financial Risk Coverage</h2>
          <p class="mt-1 text-sm text-slate-500">สรุปจาก /risk/annual เพื่อเห็นปีที่ประเมินไม่ได้</p>
          <div class="mt-4 grid gap-2">
            @for (year of FISCAL_YEARS; track year) {
              <div class="rounded-md border border-slate-200 p-3">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-semibold text-slate-900">{{ year }}</p>
                  <p class="text-xs text-slate-500">{{ annualRowsForYear(year).length }} factors</p>
                </div>
                <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div class="rounded-md bg-red-50 px-2 py-2 text-red-700">
                    <p class="font-semibold">{{ annualHighCount(year) }}</p>
                    <p>High</p>
                  </div>
                  <div class="rounded-md bg-emerald-50 px-2 py-2 text-emerald-700">
                    <p class="font-semibold">{{ annualComputableCount(year) }}</p>
                    <p>คำนวณได้</p>
                  </div>
                  <div class="rounded-md bg-slate-100 px-2 py-2 text-slate-600">
                    <p class="font-semibold">{{ annualNotComputableCount(year) }}</p>
                    <p>ประเมินไม่ได้</p>
                  </div>
                </div>
              </div>
            }
          </div>
        </section>
      </div>

      <section class="panel overflow-hidden">
        <div class="border-b border-slate-200 p-4">
          <h2 class="text-base font-semibold">Anomaly ที่ควรตรวจต่อ</h2>
          <p class="text-sm text-slate-500">คัดจาก risk score สูง และ price ratio ที่ห่างจากราคากลางมาก</p>
        </div>

        @if (!anomalies().length) {
          <div class="p-4">
            <app-empty-state title="ไม่พบ anomaly ตาม rule รอบนี้" message="ลองเลือกทุกตำบลหรือเพิ่มช่วงข้อมูลจาก backend" />
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead class="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th class="px-4 py-3">โครงการ</th>
                  <th class="px-4 py-3">ปี</th>
                  <th class="px-4 py-3">ระดับ</th>
                  <th class="px-4 py-3 text-right">Risk Score</th>
                  <th class="px-4 py-3 text-right">Price Ratio</th>
                  <th class="px-4 py-3">เหตุผล</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (item of anomalies(); track item.project.project_id) {
                  <tr class="hover:bg-slate-50">
                    <td class="max-w-lg px-4 py-3 font-semibold text-slate-900">{{ item.project.project_name }}</td>
                    <td class="px-4 py-3">{{ item.project.budget_year }}</td>
                    <td class="px-4 py-3"><app-risk-badge [level]="item.project.risk_level" /></td>
                    <td class="px-4 py-3 text-right">{{ number(item.project.risk_score) }}</td>
                    <td class="px-4 py-3 text-right">{{ number(item.project.price_ratio, 3) }}</td>
                    <td class="px-4 py-3 text-slate-600">{{ item.reason }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </section>
  `,
})
export class TrendsPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly FISCAL_YEARS = FISCAL_YEARS;
  readonly error = signal('');
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly annualRisks = signal<AnnualRisk[]>([]);
  readonly selectedSubdistrictId = signal<number | null>(null);

  readonly scopedProjects = computed(() => {
    const subdistrictId = this.selectedSubdistrictId();
    return this.projects().filter((project) => !subdistrictId || project.subdistrict_id === subdistrictId);
  });

  readonly scopedAnnualRisks = computed(() => {
    const subdistrictId = this.selectedSubdistrictId();
    return this.annualRisks().filter((row) => !subdistrictId || row.subdistrict_id === subdistrictId);
  });

  readonly averageBudgetSeries = computed<TimeSeries[]>(() => {
    const topTypes = this.topProjectTypes();
    const colors = ['#2563eb', '#7c3aed', '#0891b2', '#ea580c', '#475569'];

    return topTypes.map((type, index) => ({
      name: type,
      color: colors[index % colors.length],
      points: FISCAL_YEARS.map((year) => {
        const projects = this.scopedProjects().filter((project) => project.budget_year === year && this.projectType(project) === type);
        const values = projects.map((project) => toNumber(project.budget_amount)).filter((value): value is number => value !== null);
        const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        return {
          year,
          value: average,
          computable: average !== null,
          tooltip: average === null ? 'ไม่มีโครงการประเภทนี้ในปีนี้' : `${projects.length} โครงการ`,
        };
      }),
    }));
  });

  readonly riskTrendSeries = computed<TimeSeries[]>(() => {
    if (this.selectedSubdistrictId()) {
      const levels = [
        { level: 'high', name: 'เสี่ยงสูง', color: '#dc2626' },
        { level: 'medium', name: 'เสี่ยงปานกลาง', color: '#d97706' },
        { level: 'low', name: 'เสี่ยงต่ำ', color: '#16a34a' },
      ];
      return levels.map((item) => ({
        name: item.name,
        color: item.color,
        points: FISCAL_YEARS.map((year) => ({
          year,
          value: this.scopedProjects().filter(
            (project) => project.budget_year === year && normalizeRiskLevel(project.risk_level) === item.level,
          ).length,
          computable: true,
          tooltip: 'นับจาก /projects',
        })),
      }));
    }

    const ids = [...new Set(this.scopedProjects().map((project) => project.subdistrict_id))];
    const colors = ['#dc2626', '#2563eb', '#0891b2', '#7c3aed', '#ea580c'];
    return ids.map((id, index) => ({
      name: this.subdistrictName(id),
      color: colors[index % colors.length],
      points: FISCAL_YEARS.map((year) => ({
        year,
        value: this.scopedProjects().filter(
          (project) => project.budget_year === year && project.subdistrict_id === id && normalizeRiskLevel(project.risk_level) === 'high',
        ).length,
        computable: true,
        tooltip: 'จำนวนโครงการเสี่ยงสูง',
      })),
    }));
  });

  readonly repeatedEntities = computed<RepeatedEntity[]>(() => {
    const groups = new Map<string, { years: Set<number>; count: number; totalBudget: number }>();
    this.scopedProjects().forEach((project) => {
      const label = this.entityLabel(project);
      const current = groups.get(label) ?? { years: new Set<number>(), count: 0, totalBudget: 0 };
      current.years.add(project.budget_year);
      current.count += 1;
      current.totalBudget += toNumber(project.budget_amount) ?? 0;
      groups.set(label, current);
    });

    return [...groups.entries()]
      .map(([label, value]) => ({
        label,
        years: [...value.years].sort((a, b) => a - b),
        count: value.count,
        totalBudget: value.totalBudget,
      }))
      .filter((item) => item.years.length >= 2)
      .sort((a, b) => b.count - a.count || b.totalBudget - a.totalBudget)
      .slice(0, 12);
  });

  readonly anomalies = computed<Anomaly[]>(() =>
    this.scopedProjects()
      .map((project) => ({ project, reason: this.anomalyReason(project) }))
      .filter((item) => Boolean(item.reason))
      .sort((a, b) => (toNumber(b.project.risk_score) ?? 0) - (toNumber(a.project.risk_score) ?? 0))
      .slice(0, 12),
  );

  ngOnInit(): void {
    const projectRequests = FISCAL_YEARS.map((year) => this.api.projects({ budget_year: year }));
    forkJoin({
      subdistricts: this.api.subdistricts(),
      annualRisks: this.api.annualRisk(),
      projectsByYear: forkJoin(projectRequests),
    }).subscribe({
      next: ({ subdistricts, annualRisks, projectsByYear }) => {
        this.subdistricts.set(subdistricts);
        this.annualRisks.set(annualRisks);
        this.projects.set(projectsByYear.flat());
      },
      error: () => this.error.set('โหลดข้อมูลแนวโน้มไม่สำเร็จ'),
    });
  }

  setSubdistrict(value: number | null): void {
    this.selectedSubdistrictId.set(value);
  }

  resetFilters(): void {
    this.selectedSubdistrictId.set(null);
  }

  noop(): void {}

  money(value: number | string | null | undefined): string {
    return formatMoney(value);
  }

  number(value: number | string | null | undefined, fractionDigits = 2): string {
    return formatNumber(value, fractionDigits);
  }

  annualRowsForYear(year: number): AnnualRisk[] {
    return this.scopedAnnualRisks().filter((row) => row.fiscal_year === year);
  }

  annualHighCount(year: number): number {
    return this.annualRowsForYear(year).filter((row) => normalizeRiskLevel(row.risk_level) === 'high').length;
  }

  annualComputableCount(year: number): number {
    return this.annualRowsForYear(year).filter((row) => toBool(row.computable)).length;
  }

  annualNotComputableCount(year: number): number {
    return this.annualRowsForYear(year).filter((row) => !toBool(row.computable)).length;
  }

  private topProjectTypes(): string[] {
    const counts = new Map<string, number>();
    this.scopedProjects().forEach((project) => {
      const type = this.projectType(project);
      counts.set(type, (counts.get(type) ?? 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type]) => type);
  }

  private projectType(project: Project): string {
    return project.project_type || project.purchase_method_group || 'ไม่ระบุประเภท';
  }

  private entityLabel(project: Project): string {
    return (
      project.vendor_name ||
      project.contractor_name ||
      project.supplier_name ||
      project.purchase_method_group ||
      project.project_type ||
      'ไม่ระบุรายการ'
    );
  }

  private anomalyReason(project: Project): string {
    const reasons: string[] = [];
    const ratio = toNumber(project.price_ratio);
    const score = toNumber(project.risk_score);

    if (normalizeRiskLevel(project.risk_level) === 'high') {
      reasons.push('risk_level=high');
    }
    if (score !== null && score >= 70) {
      reasons.push('risk_score สูง');
    }
    if (ratio !== null && (ratio >= 1.15 || ratio <= 0.85)) {
      reasons.push('price_ratio ห่างจากราคากลางมาก');
    }

    return reasons.join(' · ');
  }

  private subdistrictName(id: number): string {
    return subdistrictLabel(this.subdistricts().find((subdistrict) => subdistrict.subdistrict_id === id));
  }
}
