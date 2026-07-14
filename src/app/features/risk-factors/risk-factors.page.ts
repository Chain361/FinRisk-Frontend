import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import {
  Project,
  ProjectDetail,
  ProjectFilters,
  ProjectRiskFactor,
  RiskFactorCatalog,
  Subdistrict,
} from '../../core/models/domain.models';
import { FilterBarComponent } from '../../shared/filters/filter-bar.component';
import { ConfirmModalComponent } from '../../shared/ui/confirm-modal.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { InfoTooltipComponent } from '../../shared/ui/info-tooltip.component';
import { RiskBadgeComponent } from '../../shared/ui/risk-badge.component';
import { StepperComponent, StepperStep } from '../../shared/ui/stepper.component';
import {
  formatMoney,
  formatNumber,
  sortProjectsByRisk,
  toBool,
  toNumber,
} from '../../shared/utils/risk-utils';

@Component({
  selector: 'app-risk-factors-page',
  standalone: true,
  imports: [
    ConfirmModalComponent,
    EmptyStateComponent,
    FilterBarComponent,
    InfoTooltipComponent,
    RiskBadgeComponent,
    StepperComponent,
  ],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F3</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">Risk Factor Analysis</h1>
        <p class="m-0 mt-1.5 text-sm text-muted">เปิดดูรายละเอียดโครงการ ปัจจัยเสี่ยงที่ trigger และสูตรการคำนวณ</p>
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
        <p class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">{{ error() }}</p>
      }

      @if (loadingProjects()) {
        <div class="panel p-6 text-sm text-muted">กำลังโหลดโครงการ...</div>
      } @else {
        @if (!selectedProjectId()) {
          <section class="panel overflow-hidden">
            <div class="border-b-[1.5px] border-line px-4 py-3.5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 class="m-0 text-[15px] font-bold text-ink">รายการโครงการเรียงตาม Risk Score</h2>
                  <p class="m-0 mt-1 text-[12.5px] text-muted">คลิกโครงการเพื่อดูรายละเอียดและปัจจัยที่ทำให้เสี่ยง</p>
                </div>
                <label class="block w-full max-w-md">
                  <span class="sr-only">ค้นหาโครงการ</span>
                  <input
                    type="search"
                    class="gov-input"
                    placeholder="ค้นหาชื่อโครงการ หรือ Project ID"
                    [value]="searchQuery()"
                    (input)="setSearch($any($event.target).value)"
                  />
                </label>
              </div>
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
                  @if (!filteredProjects().length) {
                    <tr>
                      <td colspan="7" class="px-4 py-12">
                        <app-empty-state title="ไม่พบโครงการ" message="ลองเปลี่ยนคำค้น ปี ตำบล หรือระดับความเสี่ยง" />
                      </td>
                    </tr>
                  } @else {
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
                  }
                </tbody>
              </table>
            </div>
          </section>
        } @else {
        <div class="grid items-start gap-4 xl:grid-cols-[340px_1fr]">
          <section class="panel overflow-hidden">
            <div class="border-b-[1.5px] border-line px-4 py-3.5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 class="m-0 text-[15px] font-bold text-ink">รายการโครงการ</h2>
                  <p class="m-0 mt-1 text-[12.5px] text-muted">เลือกโครงการเพื่อดูรายละเอียด</p>
                </div>
                <div class="flex w-full max-w-[260px] flex-col gap-2">
                  <button
                    type="button"
                    class="inline-flex h-10 items-center justify-center rounded-[3px] border-[1.5px] border-line bg-white px-3 text-[13.5px] font-bold text-slate-700 hover:bg-zebra"
                    (click)="clearSelection()"
                  >
                    กลับไปรายการ
                  </button>
                  <label class="block">
                    <span class="sr-only">ค้นหาโครงการ</span>
                    <input
                      type="search"
                      class="gov-input"
                      placeholder="ค้นหาชื่อโครงการ หรือ Project ID"
                      [value]="searchQuery()"
                      (input)="setSearch($any($event.target).value)"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div class="max-h-[620px] overflow-y-auto">
              @for (project of filteredProjects(); track project.project_id) {
                <button
                  type="button"
                  class="block w-full cursor-pointer border-b border-row-active px-4 py-3 text-left"
                  [class]="String(project.project_id) === selectedProjectId() ? 'bg-row-active' : 'bg-white hover:bg-zebra'"
                  (click)="selectProject(project.project_id)"
                >
                  <div class="flex items-start justify-between gap-2">
                    <p class="m-0 line-clamp-2 text-[13.5px] font-bold text-ink">{{ project.project_name }}</p>
                    <app-risk-badge [level]="project.risk_level" />
                  </div>
                  <p class="m-0 mt-1.5 text-xs text-muted">
                    ปี {{ project.budget_year }} · Score {{ number(project.risk_score, 2) }} · {{ money(project.budget_amount) }} บาท
                  </p>
                </button>
              }
            </div>
          </section>

          <section class="grid gap-4">
            @if (savedAt()) {
              <div class="rounded-[4px] border-[1.5px] border-risk-low bg-[#eafaf0] px-4 py-3 text-[13px] font-bold text-[#0f5132]">
                ✓ ระบบได้ทำการบันทึกผลการตรวจสอบเรียบร้อยแล้ว เมื่อเวลา {{ savedAt() }} น.
              </div>
            }

            @if (loadingDetail()) {
              <div class="panel p-6 text-sm text-muted">กำลังโหลดรายละเอียดโครงการ...</div>
            } @else if (projectDetail()) {
              <article class="panel p-[18px]">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="m-0 text-[12.5px] font-bold text-muted">Project ID {{ projectDetail()?.project_id }}</p>
                    <h2 class="m-0 mt-1 text-[19px] font-extrabold text-ink">{{ projectDetail()?.project_name }}</h2>
                    <p class="m-0 mt-1.5 text-[13px] text-muted">
                      ปี {{ projectDetail()?.budget_year }} ·
                      {{ projectDetail()?.project_type || projectDetail()?.purchase_method_group || '-' }}
                    </p>
                  </div>
                  <app-risk-badge [level]="projectDetail()?.risk_level" />
                </div>

                <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">งบประมาณ</p>
                    <p class="m-0 mt-1 text-[15px] font-extrabold text-ink">{{ money(projectDetail()?.budget_amount) }}</p>
                  </div>
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">ราคากลาง</p>
                    <p class="m-0 mt-1 text-[15px] font-extrabold text-ink">{{ money(projectDetail()?.reference_price) }}</p>
                  </div>
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">ราคาสัญญา</p>
                    <p class="m-0 mt-1 text-[15px] font-extrabold text-ink">{{ money(contractValue()) }}</p>
                  </div>
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">Risk Score</p>
                    <p class="m-0 mt-1 text-[15px] font-extrabold text-ink">{{ number(projectDetail()?.risk_score, 2) }}</p>
                  </div>
                </div>

                <div class="mt-2.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">หน่วยงาน</p>
                    <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ projectDeptName() }}</p>
                  </div>
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">สถานะโครงการ</p>
                    <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ projectStatus() }}</p>
                  </div>
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">เลขที่สัญญา</p>
                    <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ contractNo() }}</p>
                  </div>
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">สถานะสัญญา</p>
                    <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ contractStatus() }}</p>
                  </div>
                </div>

                <div class="mt-2.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">ผู้ขาย/ผู้รับจ้าง</p>
                    <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ vendorLabel() }}</p>
                  </div>
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">ประเภทจัดซื้อจัดจ้าง</p>
                    <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ purchaseMethodLabel() }}</p>
                  </div>
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">สัญญาเทียบราคากลาง</p>
                    <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">
                      {{ comparisonLabel(contractValue(), projectDetail()?.reference_price) }}
                    </p>
                    <p class="m-0 mt-1 text-xs text-muted">{{ percentageLabel(contractValue(), projectDetail()?.reference_price) }}</p>
                  </div>
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">สัญญาเทียบงบประมาณ</p>
                    <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">
                      {{ comparisonLabel(contractValue(), projectDetail()?.budget_amount) }}
                    </p>
                    <p class="m-0 mt-1 text-xs text-muted">{{ percentageLabel(contractValue(), projectDetail()?.budget_amount) }}</p>
                  </div>
                </div>

                <div class="mt-3.5 rounded-[3px] border border-line-soft bg-[#fbfcfd] p-3.5">
                  <div class="flex items-center gap-2">
                    <h3 class="m-0 text-sm font-bold text-ink">สูตรที่ใช้คำนวณ</h3>
                    <app-info-tooltip
                      text="อ้างอิงตามหนังสือซักซ้อมแนวทางการคำนวณราคากลางและการเปรียบเทียบราคาสัญญา กรมส่งเสริมการปกครองท้องถิ่น"
                      [width]="280"
                    />
                  </div>
                  <p class="m-0 mt-2 text-[13px] text-slate-700">ราคาสัญญาเทียบราคากลาง = (ราคาสัญญา − ราคากลาง) ÷ ราคากลาง × 100</p>
                  <p class="m-0 mt-1 text-[13px] text-slate-700">ราคาสัญญาเทียบงบประมาณ = (ราคาสัญญา − งบประมาณ) ÷ งบประมาณ × 100</p>
                </div>

                <div class="mt-4 flex justify-end">
                  <button type="button" class="gov-btn-primary h-11" (click)="modalOpen.set(true)">
                    ยืนยันและบันทึกผลการตรวจสอบ
                  </button>
                </div>
              </article>

              <section class="panel p-[18px]">
                <h2 class="m-0 mb-3.5 text-[16px] font-bold text-ink">ปัจจัยที่ทำให้เสี่ยง</h2>

                @if (!triggeredFactors().length) {
                  <app-empty-state title="ไม่พบ factor ที่ trigger" message="โครงการนี้อาจไม่มีสัญญาณตามเกณฑ์ที่กำหนดไว้" />
                } @else {
                  <div class="grid gap-3">
                    @for (factor of triggeredFactors(); track factor.factor_code) {
                      <article class="rounded-[4px] border-[1.5px] border-line p-3.5">
                        <p class="m-0 text-sm font-bold text-ink">{{ factor.name_th }}</p>
                        <p class="m-0 mt-0.5 text-[11.5px] text-muted">{{ factor.factor_code }} · severity {{ factor.severity || '-' }}</p>

                        <div class="mt-2.5 rounded-[3px] border border-line-soft bg-zebra p-2.5">
                          <p class="m-0 text-[11.5px] font-bold text-muted">ค่าที่สังเกตได้</p>
                          <p class="m-0 mt-1 text-[15px] font-extrabold" [class]="isComputable(factor) ? 'text-ink' : 'text-[#8a2a1f]'">
                            {{ isComputable(factor) ? value(factor.observed_value) : 'ประเมินไม่ได้' }}
                          </p>
                        </div>

                        @if (factor.evidence_text) {
                          <p class="m-0 mt-2.5 text-[12.5px] leading-relaxed text-muted">{{ factor.evidence_text }}</p>
                        }
                        @if (catalogDescription(factor.factor_code)) {
                          <p class="m-0 mt-1.5 text-[12.5px] leading-relaxed text-muted">{{ catalogDescription(factor.factor_code) }}</p>
                        }
                      </article>
                    }
                  </div>
                }
              </section>

              <section class="panel px-6 py-5">
                <h2 class="m-0 mb-5 text-[16px] font-bold text-ink">ขั้นตอนการตรวจสอบโครงการนี้</h2>
                <app-stepper [steps]="reviewSteps()" />
              </section>

              <section class="panel p-[18px]">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 class="m-0 text-[16px] font-bold text-ink">Risk Factor Catalog</h2>
                    <p class="m-0 mt-1 text-[13px] text-muted">รายการ factor ทั้งหมดในระบบ เพื่อใช้อ้างอิงประกอบการตรวจสอบ</p>
                  </div>
                  <span class="rounded-[20px] border border-line bg-zebra px-3 py-1 text-xs font-bold text-slate-700">
                    trigger {{ selectedProjectCatalog().length }} รายการ
                  </span>
                </div>

                @if (!selectedProjectCatalog().length) {
                  <div class="mt-3">
                    <app-empty-state title="ยังไม่มีข้อมูล catalog" message="รอให้ backend ส่งรายการ risk factor" />
                  </div>
                } @else {
                  <div class="mt-3.5 grid gap-2.5 md:grid-cols-2">
                    @for (factor of selectedProjectCatalog(); track factor.factor_code) {
                      <div class="rounded-[3px] border border-line px-3 py-2.5">
                        <div class="flex items-start justify-between gap-1.5">
                          <p class="m-0 text-[13px] font-bold text-ink">{{ factor.factor_code }} · {{ factor.name_th }}</p>
                          @if (factor.severity) {
                            <span class="shrink-0 rounded-[20px] bg-row-active px-2 py-0.5 text-[11px] font-bold text-slate-700">
                              {{ factor.severity }}
                            </span>
                          }
                        </div>
                        <p class="m-0 mt-1 text-xs leading-relaxed text-muted">
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
      }

      <app-confirm-modal
        [open]="modalOpen()"
        title="ยืนยันการบันทึกข้อมูล"
        message="ท่านตรวจสอบข้อมูลครบถ้วนแล้ว และต้องการยืนยันการบันทึกผลการตรวจสอบโครงการนี้ใช่หรือไม่?"
        (confirmed)="confirmSave()"
        (cancelled)="modalOpen.set(false)"
      />
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

  readonly modalOpen = signal(false);
  readonly savedAt = signal<string | null>(null);

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
      .map(
        (factor) =>
          catalog.find((item) => item.factor_code === factor.factor_code) ?? {
            factor_code: factor.factor_code,
            name_th: factor.name_th,
            severity: factor.severity ?? null,
            description_th: factor.evidence_text ?? null,
          },
      )
      .filter((factor) => {
        if (seen.has(factor.factor_code)) {
          return false;
        }
        seen.add(factor.factor_code);
        return true;
      });
  });

  readonly reviewSteps = computed<StepperStep[]>(() => {
    const saved = Boolean(this.savedAt());
    return [
      { label: 'รับเรื่อง', state: 'done' },
      { label: 'ตรวจสอบเอกสาร', state: 'done' },
      { label: 'วิเคราะห์ปัจจัยเสี่ยง', state: saved ? 'done' : 'current' },
      { label: 'สรุปผลและแจ้งเตือน', state: saved ? 'current' : 'upcoming' },
    ];
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
    this.savedAt.set(null);
    this.modalOpen.set(false);
    this.loadProjectDetail(projectId);
  }

  clearSelection(): void {
    this.selectedProjectId.set(null);
    this.projectDetail.set(null);
    this.loadingDetail.set(false);
    this.modalOpen.set(false);
  }

  confirmSave(): void {
    // Mock save flow: backend is read-only, so the confirmation only records
    // a local timestamp for the success banner and stepper state.
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    this.modalOpen.set(false);
    this.savedAt.set(`${hh}:${mm}`);
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
    return (
      detail.vendor_name ||
      detail.contractor_name ||
      detail.supplier_name ||
      detail.bidder_name ||
      (detail.vendor_id !== null && detail.vendor_id !== undefined ? `Vendor #${detail.vendor_id}` : '-')
    );
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
    return `(${sign}${diff.toFixed(2)}%) เทียบจากค่าฐาน`;
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
    this.selectedProjectId.set(null);
    this.projectDetail.set(null);

    this.api.projects(this.filters()).subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loadingProjects.set(false);
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

