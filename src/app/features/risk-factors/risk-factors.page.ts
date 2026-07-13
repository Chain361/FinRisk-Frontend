import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { Project, ProjectDetail, ProjectFilters, ProjectRiskFactor, RiskFactorCatalog, Subdistrict } from '../../core/models/domain.models';
import { FilterBarComponent } from '../../shared/filters/filter-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { RiskBadgeComponent } from '../../shared/ui/risk-badge.component';
import { formatMoney, formatNumber, sortProjectsByRisk, toBool, toNumber } from '../../shared/utils/risk-utils';

@Component({
  selector: 'app-risk-factors-page',
  standalone: true,
  imports: [EmptyStateComponent, FilterBarComponent, RiskBadgeComponent],
  template: `
    <section class="page-shell">
      <div>
        <p class="text-sm font-semibold text-slate-500">F3</p>
        <h1 class="text-2xl font-semibold text-slate-950">Risk Factor Analysis</h1>
        <p class="mt-1 text-sm text-slate-500">
          เปิดดูรายละเอียดโครงการ รายการ risk factor ที่ trigger และคำอธิบายสูตรที่ใช้คำนวณ
        </p>
      </div>

      <app-filter-bar
        [subdistricts]="subdistricts()"
        [selectedSubdistrictId]="selectedSubdistrictId()"
        [selectedYear]="selectedYear()"
        [selectedRiskLevel]="selectedRiskLevel()"
        (selectedSubdistrictIdChange)="setSubdistrict($event)"
        (selectedYearChange)="setYear($event)"
        (selectedRiskLevelChange)="setRisk($event)"
        (reset)="resetFilters()"
      />

      @if (error()) {
        <p class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</p>
      }

      @if (loadingProjects()) {
        <div class="panel p-6 text-sm text-slate-500">กำลังโหลดโครงการ...</div>
      } @else if (!filteredProjects().length) {
        <div class="panel p-4">
          <app-empty-state title="ไม่พบโครงการ" message="ลองเปลี่ยนคำค้น ปี ตำบล หรือระดับความเสี่ยง" />
        </div>
      } @else if (!projectDetail()) {
        <section class="panel overflow-hidden">
          <div class="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <h2 class="text-base font-semibold">รายการโครงการเรียงตาม Risk Score</h2>
              <p class="text-sm text-slate-500">คลิกโครงการเพื่อเปลี่ยนเป็นหน้า Risk Factors</p>
            </div>
            <label class="relative w-full max-w-md">
              <span class="sr-only">ค้นหาโครงการ</span>
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">⌕</span>
              <input
                type="search"
                class="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-slate-900"
                placeholder="ค้นหาชื่อโครงการ หรือ Project ID"
                [value]="searchQuery()"
                (input)="setSearch($any($event.target).value)"
              />
            </label>
          </div>

          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead class="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th class="px-4 py-3">โครงการ</th>
                  <th class="px-4 py-3">ปี</th>
                  <th class="px-4 py-3">ประเภท</th>
                  <th class="px-4 py-3 text-right">งบประมาณ</th>
                  <th class="px-4 py-3 text-right">ราคา/อ้างอิง</th>
                  <th class="px-4 py-3 text-right">Risk Score</th>
                  <th class="px-4 py-3">ระดับ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                @for (project of filteredProjects(); track project.project_id) {
                  <tr class="cursor-pointer hover:bg-slate-50" (click)="selectProject(project.project_id)">
                    <td class="max-w-md px-4 py-3">
                      <p class="line-clamp-2 font-semibold text-slate-900">{{ project.project_name }}</p>
                      <p class="text-xs text-slate-500">ID {{ project.project_id }}</p>
                    </td>
                    <td class="px-4 py-3">{{ project.budget_year }}</td>
                    <td class="px-4 py-3">{{ project.project_type || project.purchase_method_group || '-' }}</td>
                    <td class="px-4 py-3 text-right">{{ money(project.budget_amount) }}</td>
                    <td class="px-4 py-3 text-right">{{ number(project.price_ratio, 3) }}</td>
                    <td class="px-4 py-3 text-right font-semibold">{{ number(project.risk_score, 2) }}</td>
                    <td class="px-4 py-3"><app-risk-badge [level]="project.risk_level" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      } @else {
        <div class="grid gap-4 xl:grid-cols-[390px_1fr]">
          <section class="panel overflow-hidden">
            <div class="border-b border-slate-200 p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h2 class="text-base font-semibold">รายการโครงการ</h2>
                  <p class="text-sm text-slate-500">เลือกโครงการด้านซ้ายเพื่อดูรายละเอียด</p>
                </div>
                <button
                  type="button"
                  class="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  (click)="clearSelection()"
                >
                  กลับไปรายการ
                </button>
              </div>
            </div>

            <div class="max-h-[680px] overflow-y-auto">
              @for (project of filteredProjects(); track project.project_id) {
                <button
                  type="button"
                  class="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                  [class.bg-slate-100]="String(project.project_id) === selectedProjectId()"
                  (click)="selectProject(project.project_id)"
                >
                  <div class="flex items-start justify-between gap-3">
                    <p class="line-clamp-2 text-sm font-semibold text-slate-900">{{ project.project_name }}</p>
                    <app-risk-badge [level]="project.risk_level" />
                  </div>
                  <div class="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>ปี {{ project.budget_year }}</span>
                    <span>Score {{ number(project.risk_score, 2) }}</span>
                    <span>{{ money(project.budget_amount) }}</span>
                  </div>
                </button>
              }
            </div>
          </section>

          <section class="grid gap-4">
            @if (loadingDetail()) {
              <div class="panel p-6 text-sm text-slate-500">กำลังโหลดรายละเอียดโครงการ...</div>
            } @else {
            <article class="panel p-4">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-semibold text-slate-500">Project ID {{ projectDetail()?.project_id }}</p>
                  <h2 class="mt-1 text-xl font-semibold text-slate-950">{{ projectDetail()?.project_name }}</h2>
                  <p class="mt-2 text-sm text-slate-500">
                    ปี {{ projectDetail()?.budget_year }} · {{ projectDetail()?.project_type || projectDetail()?.purchase_method_group || '-' }}
                  </p>
                </div>
                <app-risk-badge [level]="projectDetail()?.risk_level" />
              </div>

              <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div class="rounded-md bg-slate-50 p-3">
                  <p class="text-xs font-semibold text-slate-500">งบประมาณ</p>
                  <p class="mt-1 text-lg font-semibold">{{ money(projectDetail()?.budget_amount) }}</p>
                </div>
                <div class="rounded-md bg-slate-50 p-3">
                  <p class="text-xs font-semibold text-slate-500">ราคากลาง</p>
                  <p class="mt-1 text-lg font-semibold">{{ money(projectDetail()?.reference_price) }}</p>
                </div>
                <div class="rounded-md bg-slate-50 p-3">
                  <p class="text-xs font-semibold text-slate-500">ราคาสัญญา</p>
                  <p class="mt-1 text-lg font-semibold">{{ money(contractValue()) }}</p>
                </div>
                <div class="rounded-md bg-slate-50 p-3">
                  <p class="text-xs font-semibold text-slate-500">Risk Score</p>
                  <p class="mt-1 text-lg font-semibold">{{ number(projectDetail()?.risk_score, 2) }}</p>
                </div>
              </div>

              <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div class="rounded-md bg-slate-50 p-3">
                  <p class="text-xs font-semibold text-slate-500">หน่วยงาน</p>
                  <p class="mt-1 text-sm font-semibold text-slate-900">{{ projectDeptName() }}</p>
                </div>
                <div class="rounded-md bg-slate-50 p-3">
                  <p class="text-xs font-semibold text-slate-500">สถานะโครงการ</p>
                  <p class="mt-1 text-sm font-semibold text-slate-900">{{ projectStatus() }}</p>
                </div>
                <div class="rounded-md bg-slate-50 p-3">
                  <p class="text-xs font-semibold text-slate-500">เลขที่สัญญา</p>
                  <p class="mt-1 text-sm font-semibold text-slate-900">{{ contractNo() }}</p>
                </div>
                <div class="rounded-md bg-slate-50 p-3">
                  <p class="text-xs font-semibold text-slate-500">สถานะสัญญา</p>
                  <p class="mt-1 text-sm font-semibold text-slate-900">{{ contractStatus() }}</p>
                </div>
              </div>

              <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div class="rounded-md bg-slate-50 p-3">
                  <p class="text-xs font-semibold text-slate-500">ผู้ขาย/ผู้รับจ้าง</p>
                  <p class="mt-1 text-sm font-semibold text-slate-900">{{ vendorLabel() }}</p>
                </div>
                <div class="rounded-md bg-slate-50 p-3">
                  <p class="text-xs font-semibold text-slate-500">ประเภทจัดซื้อจัดจ้าง</p>
                  <p class="mt-1 text-sm font-semibold text-slate-900">{{ purchaseMethodLabel() }}</p>
                </div>
                <div class="rounded-md bg-slate-50 p-3">
                  <p class="text-xs font-semibold text-slate-500">สัญญาเทียบราคากลาง</p>
                  <p class="mt-1 text-sm font-semibold text-slate-900">{{ comparisonLabel(contractValue(), projectDetail()?.reference_price) }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ percentageLabel(contractValue(), projectDetail()?.reference_price) }}</p>
                </div>
                <div class="rounded-md bg-slate-50 p-3">
                  <p class="text-xs font-semibold text-slate-500">สัญญาเทียบงบประมาณ</p>
                  <p class="mt-1 text-sm font-semibold text-slate-900">{{ comparisonLabel(contractValue(), projectDetail()?.budget_amount) }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ percentageLabel(contractValue(), projectDetail()?.budget_amount) }}</p>
                </div>
              </div>

              <div class="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                <h3 class="text-sm font-semibold text-slate-950">สูตรที่ใช้คำนวณ</h3>
                <div class="mt-2 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                  <p>ราคาสัญญาเทียบราคากลาง = (ราคาสัญญา - ราคากลาง) / ราคากลาง × 100</p>
                  <p>ราคาสัญญาเทียบงบประมาณ = (ราคาสัญญา - งบประมาณ) / งบประมาณ × 100</p>
                </div>
              </div>
            </article>

            <section class="panel p-4">
              <div class="mb-3">
                <h2 class="text-base font-semibold">ปัจจัยที่ทำให้เสี่ยง</h2>
              </div>

              @if (!triggeredFactors().length) {
                <app-empty-state title="ไม่พบ factor ที่ trigger" message="โครงการนี้อาจไม่ไม่มีสัญญาณตามเกณฑ์ที่กำหนดไว้" />
              } @else {
                <div class="grid gap-3">
                  @for (factor of triggeredFactors(); track factor.factor_code) {
                    <article class="rounded-lg border border-slate-200 p-4">
                      <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p class="text-sm font-semibold text-slate-950">{{ factor.name_th }}</p>
                          <p class="text-xs text-slate-500">{{ factor.factor_code }} · severity {{ factor.severity || '-' }}</p>
                        </div>
                      </div>

                      <div class="mt-4 grid gap-3 sm:grid-cols-2">
                        <div class="rounded-md bg-slate-50 p-3">
                          <p class="text-xs font-semibold text-slate-500">ค่าที่สังเกตได้</p>
                          <p class="mt-1 text-lg font-semibold text-slate-900">
                            {{ isComputable(factor) ? value(factor.observed_value) : 'ประเมินไม่ได้' }}
                          </p>
                        </div>
                      </div>

                      <div class="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <p class="font-semibold text-slate-700 mt-1">คำอธิบาย</p>
                        @if (factor.evidence_text) {
                        <p class="mt-1">{{ factor.evidence_text }}</p>
                        }
                      </div>

                      @if (catalogDescription(factor.factor_code)) {
                        <p class="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                          {{ catalogDescription(factor.factor_code) }}
                        </p>
                      }
                    </article>
                  }
                </div>
              }
            </section>

            <section class="panel p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 class="text-base font-semibold">Risk Factor Catalog</h2>
                  <p class="text-sm text-slate-500">catalog ของ factor ที่ trigger ในโครงการที่เลือก</p>
                </div>
                <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  {{ selectedProjectCatalog().length }} รายการ
                </span>
              </div>

              @if (!selectedProjectCatalog().length) {
                <div class="mt-3">
                  <app-empty-state title="ยังไม่มี factor ที่ trigger" message="ลองเลือกโครงการอื่น หรือรอให้ backend ส่ง risk_factors ของโครงการที่เลือก" />
                </div>
              } @else {
                <div class="mt-3 grid gap-2 md:grid-cols-2">
                  @for (factor of selectedProjectCatalog(); track factor.factor_code) {
                    <div class="rounded-md border border-slate-200 p-3">
                      <div class="flex items-start justify-between gap-2">
                        <p class="text-sm font-semibold text-slate-900">{{ factor.factor_code }} · {{ factor.name_th }}</p>
                        @if (factor.severity) {
                          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{{ factor.severity }}</span>
                        }
                      </div>
                      <p class="mt-1 text-xs leading-5 text-slate-500">
                        {{ factor.description_th || factor.category || 'ไม่มีคำอธิบายเพิ่มเติม' }}
                      </p>
                    </div>
                  }
                </div>
              }
            </section>
          }
        </section>
      </div>
      }
    </section>
  `,
})
export class RiskFactorsPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly String = String;
  readonly error = signal('');
  readonly loadingProjects = signal(false);
  readonly loadingDetail = signal(false);
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly catalog = signal<RiskFactorCatalog[]>([]);
  readonly projectDetail = signal<ProjectDetail | null>(null);
  readonly searchQuery = signal('');

  readonly selectedSubdistrictId = signal<number | null>(null);
  readonly selectedYear = signal<number | null>(2568);
  readonly selectedRiskLevel = signal<string | null>(null);
  readonly selectedProjectId = signal<string | null>(null);

  readonly sortedProjects = computed(() => sortProjectsByRisk(this.projects()));
  readonly filteredProjects = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const projects = this.sortedProjects();
    if (!query) {
      return projects;
    }
    return projects.filter((project) => {
      const idText = String(project.project_id).toLowerCase();
      const nameText = String(project.project_name ?? '').toLowerCase();
      return idText.includes(query) || nameText.includes(query);
    });
  });
  readonly triggeredFactors = computed(() => {
    const factors = this.projectDetail()?.risk_factors ?? [];
    return factors.filter((factor) => toBool(factor.triggered));
  });
  readonly selectedProjectCatalog = computed(() => {
    const factors = this.triggeredFactors();
    const catalog = this.catalog();
    const seen = new Set<string>();
    return factors
      .map((factor) => catalog.find((item) => item.factor_code === factor.factor_code) ?? {
        factor_code: factor.factor_code,
        name_th: factor.name_th,
        severity: factor.severity ?? null,
        description_th: factor.evidence_text ?? null,
      })
      .filter((factor) => {
        if (seen.has(factor.factor_code)) {
          return false;
        }
        seen.add(factor.factor_code);
        return true;
      });
  });

  ngOnInit(): void {
    this.loadingProjects.set(true);

    forkJoin({
      subdistricts: this.api.subdistricts(),
      catalog: this.api.riskFactors(),
    }).subscribe({
      next: ({ subdistricts, catalog }) => {
        this.subdistricts.set(subdistricts);
        this.catalog.set(catalog);
      },
      error: () => this.error.set('โหลด catalog หรือรายชื่อตำบลไม่สำเร็จ'),
    });

    this.loadProjects();
  }

  setSubdistrict(value: number | null): void {
    this.selectedSubdistrictId.set(value);
    this.loadProjects();
  }

  setYear(value: number | null): void {
    this.selectedYear.set(value);
    this.loadProjects();
  }

  setRisk(value: string | null): void {
    this.selectedRiskLevel.set(value);
    this.loadProjects();
  }

  setSearch(value: string): void {
    this.searchQuery.set(value);
  }

  resetFilters(): void {
    this.selectedSubdistrictId.set(null);
    this.selectedYear.set(2568);
    this.selectedRiskLevel.set(null);
    this.searchQuery.set('');
    this.loadProjects();
  }

  selectProject(projectId: string | number): void {
    this.selectedProjectId.set(String(projectId));
    this.loadProjectDetail(projectId);
  }

  clearSelection(): void {
    this.selectedProjectId.set(null);
    this.projectDetail.set(null);
    this.loadingDetail.set(false);
  }

  money(value: number | string | null | undefined): string {
    return formatMoney(value);
  }

  number(value: number | string | null | undefined, fractionDigits = 2): string {
    return formatNumber(value, fractionDigits);
  }

  value(value: number | string | null | undefined): string {
    return formatNumber(value, 3);
  }

  contractValue(): number | string | null | undefined {
    const detail = this.projectDetail();
    return detail?.contract_value ?? detail?.contract_price ?? detail?.contract_amount ?? detail?.winning_price ?? null;
  }

  winnerName(): string {
    const detail = this.projectDetail();
    return detail?.vendor_name || detail?.contractor_name || detail?.supplier_name || detail?.bidder_name || this.vendorLabel();
  }

  projectStatus(): string {
    const detail = this.projectDetail();
    return detail?.project_status || detail?.status || 'ไม่ระบุ';
  }

  projectDeptName(): string {
    const detail = this.projectDetail();
    return detail?.dept_name || detail?.dept_sub_name || 'ไม่ระบุ';
  }

  contractNo(): string {
    return this.projectDetail()?.contract_no || '-';
  }

  contractStatus(): string {
    return this.projectDetail()?.contract_status || '-';
  }

  vendorLabel(): string {
    const detail = this.projectDetail();
    if (!detail) {
      return '-';
    }
    return detail.vendor_id !== null && detail.vendor_id !== undefined ? `Vendor #${detail.vendor_id}` : '-';
  }

  purchaseMethodLabel(): string {
    const detail = this.projectDetail();
    return detail?.purchase_method || detail?.purchase_method_group || '-';
  }

  comparisonLabel(left: number | string | null | undefined, right: number | string | null | undefined): string {
    const diff = this.percentageDifference(left, right);
    if (diff === null) {
      return '-';
    }
    if (diff === 0) {
      return 'เท่ากัน';
    }
    return diff > 0 ? `สูงกว่า ${Math.abs(diff).toFixed(2)}%` : `ต่ำกว่า ${Math.abs(diff).toFixed(2)}%`;
  }

  percentageLabel(left: number | string | null | undefined, right: number | string | null | undefined): string {
    const diff = this.percentageDifference(left, right);
    if (diff === null) {
      return 'คำนวณไม่ได้';
    }
    const sign = diff > 0 ? '+' : '';
    return `(${sign}${diff.toFixed(2)}%) เทียบจากค่าฐานด้านขวา`;
  }

  isComputable(factor: ProjectRiskFactor): boolean {
    return toBool(factor.computable);
  }

  catalogDescription(code: string): string {
    const factor = this.catalog().find((item) => item.factor_code === code);
    return factor?.description_th ?? factor?.category ?? '';
  }

  private loadProjects(): void {
    this.loadingProjects.set(true);
    this.error.set('');
    this.projectDetail.set(null);

    this.api.projects(this.filters()).subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loadingProjects.set(false);
        this.selectedProjectId.set(null);
        this.projectDetail.set(null);
      },
      error: () => {
        this.error.set('โหลดรายชื่อโครงการไม่สำเร็จ');
        this.loadingProjects.set(false);
      },
    });
  }

  private loadProjectDetail(projectId: string | number): void {
    this.loadingDetail.set(true);
    this.api.project(projectId).subscribe({
      next: (detail) => {
        this.projectDetail.set(detail);
        this.loadingDetail.set(false);
      },
      error: () => {
        this.error.set('โหลดรายละเอียดโครงการไม่สำเร็จ');
        this.loadingDetail.set(false);
      },
    });
  }

  private filters(): ProjectFilters {
    return {
      budget_year: this.selectedYear(),
      subdistrict_id: this.selectedSubdistrictId(),
      risk_level: this.selectedRiskLevel(),
    };
  }

  private percentageDifference(left: number | string | null | undefined, right: number | string | null | undefined): number | null {
    const leftValue = toNumber(left);
    const rightValue = toNumber(right);
    if (leftValue === null || rightValue === null || rightValue === 0) {
      return null;
    }
    return ((leftValue - rightValue) / rightValue) * 100;
  }
}
