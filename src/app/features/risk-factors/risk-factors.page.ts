import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  ANALYSTS,
  ASSIGNMENT_STORAGE_KEY,
  SavedAssignment,
  projectWorkflowStatusLabel,
} from '../assignment-project-auditor/assignment-project-auditor.models';
import {
  Project,
  ProjectDetail,
  ProjectFilters,
  RiskFactorCatalog,
  Subdistrict,
} from '../../core/models/domain.models';
import { FilterBarComponent } from '../../shared/filters/filter-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { RiskBadgeComponent } from '../../shared/ui/risk-badge.component';
import {
  bandColor,
  formatMoney,
  formatNumber,
  sortProjectsByRisk,
  toNumber,
} from '../../shared/utils/risk-utils';

@Component({
  selector: 'app-risk-factors-page',
  standalone: true,
  imports: [
    EmptyStateComponent,
    FilterBarComponent,
    RouterLink,
    RiskBadgeComponent,
  ],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F3</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">{{ t('common.allProjects') }}</h1>
        <p class="m-0 mt-1.5 text-sm text-muted">{{ t('rf.subtitle') }}</p>
      </div>

      <app-filter-bar
        [subdistricts]="subdistricts()"
        [selectedSubdistrictId]="selectedSubdistrictId()"
        [selectedYear]="selectedYear()"
        [selectedRiskLevel]="selectedRiskLevel()"
        [selectedProjectType]="selectedProjectType()"
        [budgetAmountMin]="budgetAmountMin()"
        [budgetAmountMax]="budgetAmountMax()"
        [showProjectTypeFilter]="true"
        [showBudgetScopeFilter]="true"
        [projectTypes]="projectTypes()"
        (selectedSubdistrictIdChange)="setSubdistrict($event)"
        (selectedYearChange)="setYear($event)"
        (selectedRiskLevelChange)="setRisk($event)"
        (selectedProjectTypeChange)="setProjectType($event)"
        (budgetAmountMinChange)="setBudgetAmountMin($event)"
        (budgetAmountMaxChange)="setBudgetAmountMax($event)"
        (reset)="resetFilters()"
      />

      @if (error()) {
        <p class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">{{ error() }}</p>
      }

      @if (loadingProjects()) {
        <div class="panel p-6 text-sm text-muted">{{ t('rf.loadingProjects') }}</div>
      } @else {
        @if (!selectedProjectId()) {
          <section class="panel overflow-hidden">
            <div class="border-b-[1.5px] border-line px-4 py-3.5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 class="m-0 text-[15px] font-bold text-ink">{{ t('rf.list.title') }}</h2>
                  <p class="m-0 mt-1 text-[12.5px] text-muted">{{ t('rf.list.subtitle') }}</p>
                </div>
                <label class="block w-full max-w-md">
                  <span class="sr-only">{{ t('filter.searchLabel') }}</span>
                  <input
                    type="search"
                    class="gov-input"
                    [placeholder]="t('filter.searchPlaceholder')"
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
                    <th class="px-4 py-3">{{ t('common.project') }}</th>
                    <th class="px-4 py-3">{{ t('common.year') }}</th>
                    <th class="px-4 py-3">{{ t('common.type') }}</th>
                    <th class="px-4 py-3 text-right">{{ t('common.budget') }}</th>
                    <th class="px-4 py-3 text-right">{{ t('rf.list.colPriceRef') }}</th>
                    <th class="px-4 py-3 text-right">Risk Score</th>
                    <th class="px-4 py-3">{{ t('rf.list.level5') }}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white">
                  @if (!filteredProjects().length) {
                    <tr>
                      <td colspan="7" class="px-4 py-12">
                        <app-empty-state
                          [title]="t('rf.list.emptyTitle')"
                          [message]="t('rf.list.emptyMsg')"
                        />
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
                        <td class="px-4 py-3">
                          @if (project.project_type || project.purchase_method_group) {
                            {{ project.project_type || project.purchase_method_group }}
                          } @else {
                            <span class="italic text-slate-400">ยังไม่มีข้อมูล</span>
                          }
                        </td>
                        <td class="px-4 py-3 text-right">{{ money(project.budget_amount) }}</td>
                        <td class="px-4 py-3 text-right">{{ number(project.price_ratio, 3) }}</td>
                        <td class="px-4 py-3 text-right font-semibold">{{ number(project.risk_score, 2) }}</td>
                        <td class="px-4 py-3">
                          @if (project.matrix_level) {
                            <span class="inline-flex items-center rounded-[3px] px-2.5 py-1 text-[12px] font-extrabold text-white" [style.background]="bandColor(project.matrix_level)">{{ bandText(project.matrix_level) }}</span>
                          } @else {
                            <app-risk-badge [level]="project.risk_level" />
                          }
                        </td>
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
                  <h2 class="m-0 text-[15px] font-bold text-ink">{{ t('rf.side.title') }}</h2>
                  <p class="m-0 mt-1 text-[12.5px] text-muted">{{ t('rf.side.subtitle') }}</p>
                </div>
                <div class="flex w-full max-w-[305px] flex-col gap-2">
                  <button
                    type="button"
                    class="inline-flex h-10 items-center justify-center rounded-[3px] border-[1.5px] border-line bg-white px-3 text-[13.5px] font-bold text-slate-700 hover:bg-zebra"
                    (click)="clearSelection()"
                  >
                    {{ t('rf.side.back') }}
                  </button>
                  <label class="block">
                    <span class="sr-only">{{ t('filter.searchLabel') }}</span>
                    <input
                      type="search"
                      class="gov-input"
                      [placeholder]="t('filter.searchPlaceholder')"
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
                    {{ t('common.yearLabel', { year: project.budget_year }) }} · Score
                    {{ number(project.risk_score, 2) }} · {{ money(project.budget_amount) }}
                    {{ t('common.unit.baht') }}
                  </p>
                </button>
              }
            </div>
          </section>

          <section class="grid gap-4">
            @if (loadingDetail()) {
              <div class="panel p-6 text-sm text-muted">{{ t('rf.loadingDetail') }}</div>
            } @else if (projectDetail()) {
              <article class="panel p-[18px]">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="m-0 text-[12.5px] font-bold text-muted">Project ID {{ projectDetail()?.project_id }}</p>
                    <h2 class="m-0 mt-1 text-[19px] font-extrabold text-ink">{{ projectDetail()?.project_name }}</h2>
                    <p class="m-0 mt-1.5 text-[13px] text-muted">
                      {{ t('common.yearLabel', { year: projectDetail()?.budget_year ?? '' }) }} ·
                      @if (projectDetail()?.project_type || projectDetail()?.purchase_method_group) {
                        {{ projectDetail()?.project_type || projectDetail()?.purchase_method_group }}
                      } @else {
                        <span class="italic text-slate-400">{{ t('common.noData') }}</span>
                      }
                    </p>
                  </div>
                  <div class="flex flex-col items-end gap-1.5">
                    @if (scoreInfo().matrix_level) {
                      <span
                        class="inline-flex items-center rounded-[3px] px-3 py-1 text-[13px] font-extrabold text-white"
                        [style.background]="bandColor(scoreInfo().matrix_level)"
                        [title]="t('rf.detail.matrixTitle')"
                      >{{ t('common.level') }}{{ bandText(scoreInfo().matrix_level) }}</span>
                    }
                    <span class="text-[11px] font-bold text-muted">Risk Score {{ number(scoreInfo().risk_score, 0) }}/100</span>
                  </div>
                </div>

                @if (projectDetail()?.source_file || projectDetail()?.data_quality_note) {
                  <div class="mt-3 rounded-[3px] border border-line-soft bg-[#fbfcfd] px-3 py-2 text-[11.5px] text-muted">
                    @if (projectDetail()?.source_file) {
                      <p class="m-0"><span class="font-bold text-slate-600">{{ t('rf.detail.sourceLabel') }}</span> {{ projectDetail()?.source_file }}</p>
                    }
                    @if (projectDetail()?.data_quality_note) {
                      <p class="m-0 mt-0.5"><span class="font-bold text-[#8a2a1f]">{{ t('rf.detail.limitLabel') }}</span> {{ projectDetail()?.data_quality_note }}</p>
                    }
                  </div>
                }

                <div class="mt-4 rounded-[4px] border-[1.5px] border-line-soft bg-[#fbfcfd] px-4 py-3.5">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="flex min-w-0 flex-wrap items-center gap-4">
                      <div class="flex items-center gap-2.5">
                        <span
                          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                          [class]="assignmentStatusCircleClass()"
                        >
                          {{ projectWorkflowIcon() }}
                        </span>
                        <div>
                          <p class="m-0 text-[11.5px] font-bold text-muted">สถานะโครงการโดยรวม</p>
                          <p class="m-0 mt-0.5 text-[13.5px] font-extrabold text-ink">{{ projectWorkflowStatusText() }}</p>
                        </div>
                      </div>

                      <div class="min-w-[160px] border-l border-line-soft pl-4">
                        <p class="m-0 text-[11.5px] font-bold text-muted">ผู้รับมอบหมาย</p>
                        @if (assignmentAnalyst()) {
                          <p class="m-0 mt-0.5 text-[13.5px] font-extrabold text-ink">{{ assignmentAnalystName() }}</p>
                        } @else {
                          <p class="m-0 mt-0.5 text-[13.5px] italic text-slate-400">รอมอบหมาย</p>
                        }
                      </div>

                      <div class="min-w-[160px] border-l border-line-soft pl-4">
                        <p class="m-0 text-[11.5px] font-bold text-muted">ผู้มอบหมาย</p>
                        @if (latestProjectAssignment()?.assignedBy) {
                          <p class="m-0 mt-0.5 text-[13.5px] font-extrabold text-ink">{{ latestProjectAssignment()?.assignedBy }}</p>
                        } @else {
                          <p class="m-0 mt-0.5 text-[13.5px] italic text-slate-400">ยังไม่มีผู้รับผิดชอบ</p>
                        }
                      </div>
                    </div>

                    <a
                      routerLink="/risk-factors/status"
                      [queryParams]="{ projectId: projectDetail()?.project_id }"
                      class="inline-flex min-h-[38px] items-center justify-center rounded-[3px] border-[1.5px] border-line bg-white px-4 text-[13px] font-bold text-slate-700 no-underline hover:bg-zebra"
                    >
                      ดูสถานะเพิ่มเติม
                    </a>
                  </div>
                </div>

                <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">{{ t('rf.detail.dept') }}</p>
                    <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ projectDeptName() }}</p>
                  </div>
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">{{ t('common.budget') }}</p>
                    <p class="m-0 mt-1 text-[15px] font-extrabold text-ink">{{ money(projectDetail()?.budget_amount) }}</p>
                  </div>
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">{{ t('rf.detail.purchaseMethod') }}</p>
                    <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ purchaseMethodLabel() }}</p>
                  </div>
                  <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                    <p class="m-0 text-[11.5px] font-bold text-muted">{{ t('rf.detail.projectStatus') }}</p>
                    <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ projectStatus() }}</p>
                  </div>
                </div>
              </article>
            }
          </section>
        </div>
        }
      }

    </section>
  `,
})
export class RiskFactorsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  protected readonly t = this.i18n.t;

  /** แปลงค่า band (ไทย internal) → ป้ายตามภาษาปัจจุบัน */
  bandText(band: string | null | undefined): string {
    return band ? this.i18n.bandLabel(band) : '';
  }

  protected readonly String = String;
  readonly error = signal('');
  readonly loadingProjects = signal(false);
  readonly loadingDetail = signal(false);
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly allProjects = signal<Project[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly catalog = signal<RiskFactorCatalog[]>([]);
  readonly projectDetail = signal<ProjectDetail | null>(null);
  readonly assignments = signal<SavedAssignment[]>([]);
  readonly searchQuery = signal('');

  readonly selectedSubdistrictId = signal<number | null>(null);
  readonly selectedYear = signal<number | null>(2568);
  readonly selectedRiskLevel = signal<string | null>(null);
  readonly selectedProjectType = signal<string | null>(null);
  readonly budgetAmountMin = signal('');
  readonly budgetAmountMax = signal('');
  readonly selectedProjectId = signal<string | null>(null);
  readonly routeProjectId = signal<string | null>(null);

  readonly sortedProjects = computed(() => sortProjectsByRisk(this.projects()));
  readonly projectTypes = computed(() => {
    const types = new Set<string>();
    this.allProjects().forEach((project) => {
      const type = this.projectType(project);
      if (type) {
        types.add(type);
      }
    });
    return [...types].sort((a, b) => a.localeCompare(b, 'th'));
  });
  readonly filteredProjects = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const selectedType = this.selectedProjectType();
    const minBudget = toNumber(this.budgetAmountMin());
    const maxBudget = toNumber(this.budgetAmountMax());
    const projects = this.sortedProjects();
    if (!query) {
      return projects.filter((project) => this.projectMatchesFilters(project, selectedType, minBudget, maxBudget));
    }
    return projects.filter((project) => {
      const idText = String(project.project_id).toLowerCase();
      const nameText = String(project.project_name ?? '').toLowerCase();
      const typeText = this.projectType(project).toLowerCase();
      const matchesQuery = idText.includes(query) || nameText.includes(query) || typeText.includes(query);
      return matchesQuery && this.projectMatchesFilters(project, selectedType, minBudget, maxBudget);
    });
  });

  readonly latestProjectAssignment = computed(() => {
    const detail = this.projectDetail();
    if (!detail) {
      return null;
    }
    const projectId = String(detail.project_id);
    return (
      this.assignments()
        .filter((assignment) => assignment.projectId === projectId)
        .sort((a, b) => this.dateValue(b.assignedAt) - this.dateValue(a.assignedAt))[0] ?? null
    );
  });

  readonly assignmentAnalyst = computed(() => {
    const assignment = this.latestProjectAssignment();
    return assignment ? ANALYSTS.find((analyst) => analyst.id === assignment.analystId) ?? null : null;
  });

  ngOnInit(): void {
    this.loadingProjects.set(true);
    this.applyRouteProject();
    this.assignments.set(this.readAssignments());

    forkJoin({
      subdistricts: this.api.subdistricts(),
      catalog: this.api.riskFactors(),
      allProjects: this.api.projects(),
    }).subscribe({
      next: ({ subdistricts, catalog, allProjects }) => {
        this.subdistricts.set(subdistricts);
        this.catalog.set(catalog);
        this.allProjects.set(allProjects);
      },
      error: () => this.error.set(this.t('rf.error.catalog')),
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

  setProjectType(value: string | null): void {
    this.selectedProjectType.set(value === 'all' ? null : value);
  }

  setBudgetAmountMin(value: string): void {
    this.budgetAmountMin.set(value);
  }

  setBudgetAmountMax(value: string): void {
    this.budgetAmountMax.set(value);
  }

  setSearch(value: string): void {
    this.searchQuery.set(value);
  }

  resetFilters(): void {
    this.selectedSubdistrictId.set(null);
    this.selectedYear.set(2568);
    this.selectedRiskLevel.set(null);
    this.selectedProjectType.set(null);
    this.budgetAmountMin.set('');
    this.budgetAmountMax.set('');
    this.searchQuery.set('');
    this.loadProjects();
  }

  selectProject(projectId: string | number): void {
    this.selectedProjectId.set(String(projectId));
    this.assignments.set(this.readAssignments());
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

  projectStatus(): string {
    const detail = this.projectDetail();
    return detail?.project_status || detail?.status || this.t('common.unspecified');
  }

  projectDeptName(): string {
    const detail = this.projectDetail();
    return detail?.dept_name || detail?.dept_sub_name || this.t('common.unspecified');
  }

  assignmentAnalystName(): string {
    return this.assignmentAnalyst()?.name || 'รอมอบหมาย';
  }

  assignmentAnalystTeam(): string {
    return this.assignmentAnalyst()?.team || 'ยังไม่มีผู้รับผิดชอบ';
  }

  assignmentAssignedAtText(): string {
    const assignedAt = this.latestProjectAssignment()?.assignedAt;
    return assignedAt ? this.formatAssignmentDate(assignedAt) : 'รอดำเนินการ';
  }

  projectWorkflowStatusText(): string {
    return projectWorkflowStatusLabel(this.latestProjectAssignment()?.workflowStatus ?? null);
  }

  projectWorkflowIcon(): string {
    const status = this.latestProjectAssignment()?.workflowStatus;
    return status === 'completed' ? '✓' : this.latestProjectAssignment() ? '…' : '!';
  }

  assignmentStatusCircleClass(): string {
    const status = this.latestProjectAssignment()?.workflowStatus;
    if (!status) return 'bg-risk-medium text-white';
    return status === 'completed' ? 'bg-risk-low text-white' : 'bg-navy text-white';
  }

  purchaseMethodLabel(): string {
    const detail = this.projectDetail();
    return detail?.purchase_method || detail?.purchase_method_group || '-';
  }

  /** ข้อมูลคะแนนรวม (จาก ProjectDetailResponse.risk_score ที่ api ผสมเข้ามาบน detail) */
  scoreInfo() {
    const d = this.projectDetail() as (ProjectDetail & Record<string, unknown>) | null;
    return {
      matrix_level: (d?.['matrix_level'] as string) ?? null,
      matrix_likelihood: toNumber(d?.['matrix_likelihood'] as number) ,
      matrix_impact: toNumber(d?.['matrix_impact'] as number),
      matrix_score: toNumber(d?.['matrix_score'] as number),
      risk_score: toNumber(d?.risk_score),
      risk_level: (d?.risk_level as string) ?? null,
      factors_triggered: toNumber(d?.['factors_triggered'] as number),
      factors_not_computable: toNumber(d?.['factors_not_computable'] as number),
      summary_text: (d?.['summary_text'] as string) ?? null,
    };
  }

  /** สีของ band สำหรับ chip/badge ระดับ 5×5 */
  bandColor(band: string | null | undefined): string {
    return bandColor(band);
  }

  private loadProjects(): void {
    this.loadingProjects.set(true);
    this.error.set('');
    if (!this.routeProjectId()) {
      this.selectedProjectId.set(null);
      this.projectDetail.set(null);
    }

    this.api.projects(this.filters()).subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loadingProjects.set(false);
        this.openRouteProjectIfNeeded();
      },
      error: () => {
        this.error.set(this.t('rf.error.projects'));
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
        this.error.set(this.t('rf.error.detail'));
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

  private applyRouteProject(): void {
    const projectId = this.route.snapshot.queryParamMap.get('projectId');
    this.routeProjectId.set(projectId);
    if (projectId) {
      this.searchQuery.set(projectId);
    }
  }

  private openRouteProjectIfNeeded(): void {
    const projectId = this.routeProjectId();
    if (!projectId || this.selectedProjectId() === projectId) {
      return;
    }
    this.selectProject(projectId);
  }

  private projectType(project: Project): string {
    return project.project_type || project.purchase_method_group || this.t('common.unspecifiedType');
  }

  private projectMatchesFilters(
    project: Project,
    selectedType: string | null,
    minBudget: number | null,
    maxBudget: number | null,
  ): boolean {
    const projectBudget = toNumber(project.budget_amount);
    const matchesType = !selectedType || this.projectType(project) === selectedType;
    const matchesMin = minBudget === null || (projectBudget !== null && projectBudget >= minBudget);
    const matchesMax = maxBudget === null || (projectBudget !== null && projectBudget <= maxBudget);
    return matchesType && matchesMin && matchesMax;
  }

  private readAssignments(): SavedAssignment[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(ASSIGNMENT_STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? (parsed as SavedAssignment[]) : [];
    } catch {
      return [];
    }
  }

  private formatAssignmentDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '-'
      : new Intl.DateTimeFormat('th-TH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(date);
  }

  private dateValue(value: string): number {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
}

