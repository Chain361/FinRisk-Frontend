import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AnnualRisk, Project, Subdistrict } from '../../core/models/domain.models';
import { BarChartComponent, BarChartSeries } from '../../shared/charts/bar-chart.component';
import { FilterBarComponent } from '../../shared/filters/filter-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { RiskBadgeComponent } from '../../shared/ui/risk-badge.component';
import { CHART_SERIES_COLORS, RISK_SERIES } from '../../shared/utils/design-tokens';
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
  imports: [BarChartComponent, EmptyStateComponent, FilterBarComponent, RiskBadgeComponent],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F4</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">Time Series & Trend Analysis</h1>
        <p class="m-0 mt-1.5 text-sm text-muted">เปรียบเทียบข้อมูลข้ามปีและข้ามตำบล เพื่อดูแนวโน้มและความผิดปกติ</p>
      </div>

      <app-filter-bar
        [subdistricts]="subdistricts()"
        [selectedSubdistrictId]="selectedSubdistrictId()"
        [selectedYear]="null"
        [showYearFilter]="false"
        [showRiskFilter]="false"
        (selectedSubdistrictIdChange)="setSubdistrict($event)"
        (reset)="resetFilters()"
      />

      @if (error()) {
        <p class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">{{ error() }}</p>
      }

      <div class="grid gap-4 xl:grid-cols-2">
        <app-bar-chart
          [title]="'งบเฉลี่ยตามประเภทโครงการ (ปี ' + FISCAL_YEARS[0] + '-' + FISCAL_YEARS[FISCAL_YEARS.length - 1] + ')'"
          subtitle="ปีที่ไม่มีโครงการประเภทนั้นจะเว้นช่อง ไม่แทนค่า 0"
          [categories]="fiscalYearLabels"
          [series]="averageBudgetBarSeries()"
          unitSuffix="บาท"
          rowHeader="ประเภทโครงการ"
          [compactValueLabels]="true"
        />

        <app-bar-chart
          [title]="selectedSubdistrictId() ? 'ความเสี่ยงข้ามปี (ตำบลที่เลือก)' : 'ความเสี่ยงข้ามปี (ทุกตำบล)'"
          [subtitle]="
            selectedSubdistrictId()
              ? 'จำนวนโครงการตามระดับความเสี่ยงรายปี'
              : 'จำนวนโครงการเสี่ยงสูงรายปี แยกตามตำบล'
          "
          [categories]="fiscalYearLabels"
          [series]="riskTrendBarSeries()"
          unitSuffix="โครงการ"
          [rowHeader]="selectedSubdistrictId() ? 'ระดับความเสี่ยง' : 'ตำบล'"
        />
      </div>

      <section class="panel overflow-hidden">
        <div class="border-b-[1.5px] border-line px-[18px] py-4">
          <h2 class="m-0 text-[16px] font-bold text-ink">โครงการ/ผู้รับจ้าง/วิธีจัดซื้อที่ซ้ำข้ามปี</h2>
          <p class="m-0 mt-1 text-[13px] text-muted">นับจากผู้รับจ้างที่ปรากฏตั้งแต่ 2 ปีงบประมาณขึ้นไป</p>
        </div>

        @if (!repeatedEntities().length) {
          <div class="p-4">
            <app-empty-state title="ยังไม่พบรายการซ้ำ ≥ 2 ปี" message="ข้อมูลใน scope ปัจจุบันอาจมีปีเดียวหรือไม่มี vendor field" />
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="gov-table">
              <thead>
                <tr>
                  <th>รายการ</th>
                  <th>ปีที่พบ</th>
                  <th class="text-right!">จำนวน</th>
                  <th class="text-right!">งบรวม (บาท)</th>
                </tr>
              </thead>
              <tbody>
                @for (entity of repeatedEntities(); track entity.label) {
                  <tr>
                    <td class="font-bold">{{ entity.label }}</td>
                    <td>{{ entity.years.join(', ') }}</td>
                    <td class="text-right">{{ entity.count }}</td>
                    <td class="text-right">{{ money(entity.totalBudget) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <section class="panel p-[18px]">
        <h2 class="m-0 mb-0.5 text-[16px] font-bold text-ink">Financial Risk Coverage</h2>
        <p class="m-0 mb-3.5 text-[13px] text-muted">สรุปจำนวนปัจจัยที่ตรวจสอบได้และประเมินไม่ได้รายปี</p>
        <div class="grid gap-3.5 md:grid-cols-3">
          @for (year of FISCAL_YEARS; track year) {
            <div class="rounded-[4px] border-[1.5px] border-line p-3.5">
              <div class="flex items-center justify-between">
                <p class="m-0 text-sm font-extrabold text-ink">ปี {{ year }}</p>
                <p class="m-0 text-xs text-muted">{{ annualRowsForYear(year).length }} factors</p>
              </div>
              <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div class="rounded-[3px] border border-[#e2b3ac] bg-[#fdeceb] px-1 py-2 text-[#8a2a1f]">
                  <p class="m-0 text-[16px] font-extrabold">{{ annualHighCount(year) }}</p>
                  <p class="m-0 mt-0.5">High</p>
                </div>
                <div class="rounded-[3px] border border-[#a9d9bb] bg-[#e9f6ee] px-1 py-2 text-[#0f5132]">
                  <p class="m-0 text-[16px] font-extrabold">{{ annualComputableCount(year) }}</p>
                  <p class="m-0 mt-0.5">คำนวณได้</p>
                </div>
                <div class="rounded-[3px] border border-[#c7cfd8] bg-page px-1 py-2 text-slate-700">
                  <p class="m-0 text-[16px] font-extrabold">{{ annualNotComputableCount(year) }}</p>
                  <p class="m-0 mt-0.5">ประเมินไม่ได้</p>
                </div>
              </div>
            </div>
          }
        </div>
      </section>

      <section class="panel overflow-hidden">
        <div class="border-b-[1.5px] border-line px-[18px] py-4">
          <h2 class="m-0 text-[16px] font-bold text-ink">Anomaly ที่ควรตรวจต่อ</h2>
          <p class="m-0 mt-1 text-[13px] text-muted">คัดจาก risk score สูง และ price ratio ที่ห่างจากราคากลางมาก</p>
        </div>

        @if (!anomalies().length) {
          <div class="p-4">
            <app-empty-state title="ไม่พบ anomaly ตาม rule รอบนี้" message="ลองเลือกทุกตำบลหรือเพิ่มช่วงข้อมูลจาก backend" />
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="gov-table min-w-[900px]">
              <thead>
                <tr>
                  <th>โครงการ</th>
                  <th>ปี</th>
                  <th>ระดับ</th>
                  <th class="text-right!">Risk Score</th>
                  <th class="text-right!">Price Ratio</th>
                  <th>เหตุผล</th>
                </tr>
              </thead>
              <tbody>
                @for (item of anomalies(); track item.project.project_id) {
                  <tr>
                    <td class="max-w-lg font-bold">{{ item.project.project_name }}</td>
                    <td>{{ item.project.budget_year }}</td>
                    <td><app-risk-badge [level]="item.project.risk_level" /></td>
                    <td class="text-right font-bold">{{ number(item.project.risk_score) }}</td>
                    <td class="text-right">{{ number(item.project.price_ratio, 3) }}</td>
                    <td class="text-muted">{{ item.reason }}</td>
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
  readonly fiscalYearLabels = FISCAL_YEARS.map(String);
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

  readonly averageBudgetBarSeries = computed<BarChartSeries[]>(() => {
    const topTypes = this.topProjectTypes();

    return topTypes.map((type, index) => ({
      name: type,
      color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
      values: FISCAL_YEARS.map((year) => {
        const projects = this.scopedProjects().filter(
          (project) => project.budget_year === year && this.projectType(project) === type,
        );
        const values = projects
          .map((project) => toNumber(project.budget_amount))
          .filter((value): value is number => value !== null);
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      }),
    }));
  });

  readonly riskTrendBarSeries = computed<BarChartSeries[]>(() => {
    if (this.selectedSubdistrictId()) {
      return RISK_SERIES.map((item) => ({
        name: item.name,
        color: item.color,
        values: FISCAL_YEARS.map(
          (year) =>
            this.scopedProjects().filter(
              (project) =>
                project.budget_year === year && normalizeRiskLevel(project.risk_level) === item.level,
            ).length,
        ),
      }));
    }

    const ids = [...new Set(this.scopedProjects().map((project) => project.subdistrict_id))];
    return ids.map((id, index) => ({
      name: this.subdistrictName(id),
      color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
      values: FISCAL_YEARS.map(
        (year) =>
          this.scopedProjects().filter(
            (project) =>
              project.budget_year === year &&
              project.subdistrict_id === id &&
              normalizeRiskLevel(project.risk_level) === 'high',
          ).length,
      ),
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
