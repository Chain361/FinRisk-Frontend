import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { Project, ProjectFilters, Subdistrict } from '../../core/models/domain.models';
import { BarChartComponent, BarChartSeries } from '../../shared/charts/bar-chart.component';
import { FilterBarComponent } from '../../shared/filters/filter-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { CHART_SERIES_COLORS, RISK_SERIES } from '../../shared/utils/design-tokens';
import { FISCAL_YEARS, formatMoney, normalizeRiskLevel, subdistrictLabel, toNumber } from '../../shared/utils/risk-utils';

interface VendorRanking { vendorName: string; projectCount: number; winCount: number; totalContractValue: number; sampleProjects: string[]; isRecurring: boolean; isFrequentWinner: boolean; }
interface RepeatedEntity { label: string; years: number[]; count: number; totalBudget: number; }

@Component({
  selector: 'app-project-risk-insights-page',
  standalone: true,
  imports: [BarChartComponent, EmptyStateComponent, FilterBarComponent, RouterLink],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div><p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F1 · วิเคราะห์เชิงลึก</p><h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">ประเด็นที่ควรตรวจสอบต่อ</h1><p class="m-0 mt-1.5 text-sm text-muted">วิเคราะห์ผู้รับจ้าง รายการซ้ำ และแนวโน้มงบประมาณ</p></div>
        <div class="flex flex-wrap gap-2"><a class="gov-button whitespace-nowrap" [routerLink]="['/financial-health-status']">สถานะและสุขภาพการคลัง</a><a class="gov-button whitespace-nowrap" [routerLink]="['/project-risk']">กลับสู่ภาพรวม</a></div>
      </div>

      <app-filter-bar [subdistricts]="subdistricts()" [selectedSubdistrictId]="selectedSubdistrictId()" [selectedYear]="selectedYear()" [selectedRiskLevel]="selectedRiskLevel()" (selectedSubdistrictIdChange)="setSubdistrict($event)" (selectedYearChange)="setYear($event)" (selectedRiskLevelChange)="setRisk($event)" (reset)="resetFilters()" />
      @if (error()) { <p class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">{{ error() }}</p> }

      <section class="panel p-[18px]">
        <div class="mb-4"><h2 class="m-0 text-[16px] font-bold text-ink">ผู้รับจ้างที่ได้รับงานบ่อยที่สุด</h2><p class="m-0 mt-1 text-[13px] text-muted">Top 10 ผู้รับจ้างตามจำนวนโครงการ ภายใต้ตัวกรองที่เลือก</p></div>
        <div class="mb-4 grid gap-3.5 md:grid-cols-[1.2fr_0.8fr]">
          <label class="block"><span class="text-[12.5px] font-bold text-muted">ค้นหาผู้รับจ้าง</span><input type="search" class="gov-input mt-[5px]" placeholder="พิมพ์ชื่อผู้รับจ้าง" [value]="vendorSearchText()" (input)="setVendorSearch($any($event.target).value)" /></label>
          <label class="block"><span class="text-[12.5px] font-bold text-muted">ประเภทโครงการ</span><select class="gov-select mt-[5px]" [value]="selectedProjectType() ?? 'all'" (change)="setProjectType($any($event.target).value)"><option value="all">ทุกประเภท</option>@for (type of projectTypes(); track type) { <option [value]="type">{{ type }}</option> }</select></label>
        </div>
        @if (!vendorRankings().length) {
          <app-empty-state title="ไม่พบข้อมูลผู้รับจ้าง" message="ลองเปลี่ยนตัวกรองหรือคำค้นหาอีกครั้ง" />
        } @else {
          <div class="overflow-x-auto"><table class="gov-table min-w-[900px]"><thead><tr><th>อันดับ</th><th>ผู้รับจ้าง</th><th class="text-right!">จำนวนโครงการ</th><th class="text-right!">จำนวนครั้งที่ชนะ</th><th class="text-right!">มูลค่าสัญญารวม</th><th>รายชื่อโครงการตัวอย่าง</th></tr></thead><tbody>
            @for (vendor of vendorRankings(); track vendor.vendorName) { <tr><td class="font-bold">{{ $index + 1 }}</td><td><div class="flex flex-wrap items-center gap-2"><span class="font-bold text-ink">{{ vendor.vendorName }}</span>@if (vendor.isRecurring) { <span class="rounded-[3px] bg-risk-low px-2 py-0.5 text-[11px] font-bold text-white">Recurring Vendor</span> } @if (vendor.isFrequentWinner) { <span class="rounded-[3px] bg-chart-blue-deep px-2 py-0.5 text-[11px] font-bold text-white">Frequent Winner</span> }</div></td><td class="text-right">{{ vendor.projectCount }}</td><td class="text-right">{{ vendor.winCount }}</td><td class="text-right">{{ money(vendor.totalContractValue) }}</td><td class="text-muted"><div class="flex flex-wrap gap-1">@for (projectName of vendor.sampleProjects; track projectName) { <span class="rounded-[3px] border border-line-soft bg-zebra px-2 py-0.5 text-xs">{{ projectName }}</span> }</div></td></tr> }
          </tbody></table></div>
        }
      </section>

      <div class="grid gap-4 xl:grid-cols-2">
        <app-bar-chart [title]="'งบเฉลี่ยตามประเภทโครงการ (ปี ' + FISCAL_YEARS[0] + '-' + FISCAL_YEARS[FISCAL_YEARS.length - 1] + ')'" subtitle="ปีที่ไม่มีโครงการประเภทนั้นจะเว้นช่อง ไม่แทนด้วย 0" [categories]="fiscalYearLabels" [series]="averageBudgetBarSeries()" unitSuffix="บาท" rowHeader="ประเภทโครงการ" [compactValueLabels]="true" />
        <app-bar-chart [title]="selectedSubdistrictId() ? 'ความเสี่ยงข้ามปี (ตำบลที่เลือก)' : 'ความเสี่ยงข้ามปี (ทุกตำบล)'" [subtitle]="selectedSubdistrictId() ? 'จำนวนโครงการตามระดับความเสี่ยงรายปี' : 'จำนวนโครงการเสี่ยงสูงรายปี แยกตามตำบล'" [categories]="fiscalYearLabels" [series]="riskTrendBarSeries()" unitSuffix="โครงการ" [rowHeader]="selectedSubdistrictId() ? 'ระดับความเสี่ยง' : 'ตำบล'" />
      </div>

      <section class="panel overflow-hidden">
        <div class="border-b-[1.5px] border-line px-[18px] py-4"><h2 class="m-0 text-[16px] font-bold text-ink">รายการที่ซ้ำข้ามปี</h2><p class="m-0 mt-1 text-[13px] text-muted">แสดงผู้รับจ้าง/ประเภท/วิธีจัดซื้อที่พบอย่างน้อย 2 ปีงบประมาณ</p></div>
        @if (!repeatedEntities().length) {
          <div class="p-4"><app-empty-state title="ยังไม่พบรายการซ้ำ 2 ปีขึ้นไป" message="ข้อมูลในขอบเขตปัจจุบันอาจมีเพียงปีเดียว" /></div>
        } @else {
          <div class="overflow-x-auto"><table class="gov-table"><thead><tr><th>รายการ</th><th>ปีที่พบ</th><th class="text-right!">จำนวน</th><th class="text-right!">งบรวม (บาท)</th></tr></thead><tbody>@for (entity of repeatedEntities(); track entity.label) { <tr><td class="font-bold">{{ entity.label }}</td><td>{{ entity.years.join(', ') }}</td><td class="text-right">{{ entity.count }}</td><td class="text-right">{{ money(entity.totalBudget) }}</td></tr> }</tbody></table></div>
        }
      </section>
    </section>
  `,
})
export class ProjectRiskInsightsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly FISCAL_YEARS = FISCAL_YEARS;
  readonly fiscalYearLabels = FISCAL_YEARS.map(String);
  readonly error = signal('');
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly multiYearProjects = signal<Project[]>([]);
  readonly selectedSubdistrictId = signal<number | null>(null);
  readonly selectedYear = signal<number | null>(2568);
  readonly selectedRiskLevel = signal<string | null>(null);
  readonly selectedProjectType = signal<string | null>(null);
  readonly vendorSearchText = signal('');

  readonly projectTypes = computed(() => [...new Set(this.projects().map((project) => this.projectTypeLabel(project)).filter((type) => type !== 'ไม่ระบุประเภท'))].sort((a, b) => a.localeCompare(b, 'th')));
  readonly filteredVendorProjects = computed(() => { const search = this.vendorSearchText().trim().toLowerCase(); return this.projects().filter((project) => (!this.selectedProjectType() || this.projectTypeLabel(project) === this.selectedProjectType()) && (!search || this.vendorDisplayName(project).toLowerCase().includes(search))); });
  readonly vendorRankings = computed<VendorRanking[]>(() => {
    const groups = new Map<string, { years: Set<number>; projectCount: number; total: number; samples: string[] }>();
    this.filteredVendorProjects().forEach((project) => { const name = this.vendorDisplayName(project); const item = groups.get(name) ?? { years: new Set<number>(), projectCount: 0, total: 0, samples: [] }; item.years.add(project.budget_year); item.projectCount += 1; item.total += toNumber(project.contract_value ?? project.contract_price ?? project.contract_amount ?? project.winning_price ?? project.budget_amount) ?? 0; if (project.project_name) item.samples.push(project.project_name); groups.set(name, item); });
    return [...groups.entries()].map(([vendorName, value]) => ({ vendorName, projectCount: value.projectCount, winCount: value.projectCount, totalContractValue: value.total, sampleProjects: value.samples.slice(0, 3), isRecurring: value.years.size > 2, isFrequentWinner: value.projectCount > 5 })).sort((a, b) => b.projectCount - a.projectCount || b.totalContractValue - a.totalContractValue).slice(0, 10);
  });
  readonly averageBudgetBarSeries = computed<BarChartSeries[]>(() => this.topProjectTypes().map((type, index) => ({ name: type, color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length], values: FISCAL_YEARS.map((year) => { const values = this.multiYearProjects().filter((project) => project.budget_year === year && this.projectTypeLabel(project) === type).map((project) => toNumber(project.budget_amount)).filter((value): value is number => value !== null); return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }) })));
  readonly riskTrendBarSeries = computed<BarChartSeries[]>(() => {
    if (this.selectedSubdistrictId()) return RISK_SERIES.map((risk) => ({ name: risk.name, color: risk.color, values: FISCAL_YEARS.map((year) => this.multiYearProjects().filter((project) => project.budget_year === year && normalizeRiskLevel(project.risk_level) === risk.level).length) }));
    const ids = [...new Set(this.multiYearProjects().map((project) => project.subdistrict_id))];
    return ids.map((id, index) => ({ name: this.subdistrictName(id), color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length], values: FISCAL_YEARS.map((year) => this.multiYearProjects().filter((project) => project.budget_year === year && project.subdistrict_id === id && normalizeRiskLevel(project.risk_level) === 'high').length) }));
  });
  readonly repeatedEntities = computed<RepeatedEntity[]>(() => { const groups = new Map<string, { years: Set<number>; count: number; totalBudget: number }>(); this.multiYearProjects().forEach((project) => { const label = this.entityLabel(project); const item = groups.get(label) ?? { years: new Set<number>(), count: 0, totalBudget: 0 }; item.years.add(project.budget_year); item.count += 1; item.totalBudget += toNumber(project.budget_amount) ?? 0; groups.set(label, item); }); return [...groups.entries()].map(([label, value]) => ({ label, years: [...value.years].sort((a, b) => a - b), count: value.count, totalBudget: value.totalBudget })).filter((item) => item.years.length >= 2).sort((a, b) => b.count - a.count || b.totalBudget - a.totalBudget).slice(0, 12); });

  ngOnInit(): void { this.loadSubdistricts(); this.loadDashboard(); this.loadTimeSeries(); }
  setSubdistrict(value: number | null): void { this.selectedSubdistrictId.set(value); this.loadDashboard(); this.loadTimeSeries(); }
  setYear(value: number | null): void { this.selectedYear.set(value); this.loadDashboard(); }
  setRisk(value: string | null): void { this.selectedRiskLevel.set(value); this.loadDashboard(); }
  resetFilters(): void { this.selectedSubdistrictId.set(null); this.selectedYear.set(2568); this.selectedRiskLevel.set(null); this.selectedProjectType.set(null); this.vendorSearchText.set(''); this.loadDashboard(); this.loadTimeSeries(); }
  setProjectType(value: string | null): void { this.selectedProjectType.set(value === 'all' ? null : value); }
  setVendorSearch(value: string): void { this.vendorSearchText.set(value); }
  money(value: number | string | null | undefined): string { return formatMoney(value); }
  private loadSubdistricts(): void { this.api.subdistricts().subscribe({ next: (rows) => this.subdistricts.set(rows), error: () => this.error.set('โหลดรายการตำบลไม่สำเร็จ') }); }
  private loadDashboard(): void { this.error.set(''); this.api.projects(this.filters()).subscribe({ next: (projects) => this.projects.set(projects), error: () => this.error.set('โหลดข้อมูลวิเคราะห์เชิงลึกไม่สำเร็จ') }); }
  private loadTimeSeries(): void { const subdistrictId = this.selectedSubdistrictId(); forkJoin(FISCAL_YEARS.map((year) => this.api.projects({ budget_year: year, subdistrict_id: subdistrictId }))).subscribe({ next: (rows) => this.multiYearProjects.set(rows.flat()), error: () => this.error.set('โหลดข้อมูลโครงการย้อนหลังไม่สำเร็จ') }); }
  private filters(): ProjectFilters { return { budget_year: this.selectedYear(), subdistrict_id: this.selectedSubdistrictId(), risk_level: this.selectedRiskLevel() }; }
  private projectTypeLabel(project: Project): string { return project.project_type || project.purchase_method_group || 'ไม่ระบุประเภท'; }
  private topProjectTypes(): string[] { const counts = new Map<string, number>(); this.multiYearProjects().forEach((project) => { const type = this.projectTypeLabel(project); counts.set(type, (counts.get(type) ?? 0) + 1); }); return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([type]) => type); }
  private entityLabel(project: Project): string { return project.vendor_name || project.contractor_name || project.supplier_name || project.purchase_method_group || project.project_type || 'ไม่ระบุรายการ'; }
  private subdistrictName(id: number): string { return subdistrictLabel(this.subdistricts().find((subdistrict) => subdistrict.subdistrict_id === id)); }
  private vendorDisplayName(project: Project): string { return project.winner_name || project.vendor_name || project.contractor_name || project.supplier_name || project.bidder_name || 'ไม่ระบุผู้รับจ้าง'; }
}
