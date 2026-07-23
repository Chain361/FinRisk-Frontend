import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { FEEDBACK_ROLES } from '../../core/auth/roles';
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
  ProjectRiskFactor,
  RiskFactorCatalog,
  Subdistrict,
} from '../../core/models/domain.models';
import { RiskMatrixComponent } from '../../shared/charts/risk-matrix.component';
import { FilterBarComponent } from '../../shared/filters/filter-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { InfoTooltipComponent } from '../../shared/ui/info-tooltip.component';
import { RiskBadgeComponent } from '../../shared/ui/risk-badge.component';
import {
  bandColor,
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
    EmptyStateComponent,
    FilterBarComponent,
    InfoTooltipComponent,
    RouterLink,
    RiskBadgeComponent,
    RiskMatrixComponent,
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
        <p
          class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high"
        >
          {{ error() }}
        </p>
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
                    <th class="px-4 py-3">ระดับความเสี่ยง</th>
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
                      <tr
                        class="cursor-pointer hover:bg-slate-50"
                        (click)="selectProject(project.project_id)"
                      >
                        <td class="max-w-md px-4 py-3">
                          <p class="line-clamp-2 font-semibold text-slate-900">
                            {{ project.project_name }}
                          </p>
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
                        <td class="px-4 py-3 text-right font-semibold">
                          {{ number(project.risk_score, 2) }}
                        </td>
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
                    [class]="
                      String(project.project_id) === selectedProjectId()
                        ? 'bg-row-active'
                        : 'bg-white hover:bg-zebra'
                    "
                    (click)="selectProject(project.project_id)"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <p class="m-0 line-clamp-2 text-[13.5px] font-bold text-ink">
                        {{ project.project_name }}
                      </p>
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
                      <p class="m-0 text-[12.5px] font-bold text-muted">
                        Project ID {{ projectDetail()?.project_id }}
                      </p>
                      <h2 class="m-0 mt-1 text-[19px] font-extrabold text-ink">
                        {{ projectDetail()?.project_name }}
                      </h2>
                      <p class="m-0 mt-1.5 text-[13px] text-muted">
                        {{ t('common.yearLabel', { year: projectDetail()?.budget_year ?? '' }) }} ·
                        @if (
                          projectDetail()?.project_type || projectDetail()?.purchase_method_group
                        ) {
                          {{
                            projectDetail()?.project_type || projectDetail()?.purchase_method_group
                          }}
                        } @else {
                          <span class="italic text-slate-400">{{ t('common.noData') }}</span>
                        }
                      </p>
                    </div>
                    <div class="flex flex-col items-start gap-1.5">
                      <app-risk-badge [level]="scoreInfo().risk_level" />
                      <span class="text-[11px] font-bold text-muted"
                        >Risk Score {{ number(scoreInfo().risk_score, 0) }}/100</span
                      >
                    </div>
                  </div>

                  @if (projectDetail()?.source_file || projectDetail()?.data_quality_note) {
                    <div
                      class="mt-3 rounded-[3px] border border-line-soft bg-[#fbfcfd] px-3 py-2 text-[11.5px] text-muted"
                    >
                      @if (projectDetail()?.source_file) {
                        <p class="m-0">
                          <span class="font-bold text-slate-600">{{
                            t('rf.detail.sourceLabel')
                          }}</span>
                          {{ projectDetail()?.source_file }}
                        </p>
                      }
                      @if (projectDetail()?.data_quality_note) {
                        <p class="m-0 mt-0.5">
                          <span class="font-bold text-[#8a2a1f]">{{
                            t('rf.detail.limitLabel')
                          }}</span>
                          {{ projectDetail()?.data_quality_note }}
                        </p>
                      }
                    </div>
                  }

                  <div
                    class="mt-4 rounded-[4px] border-[1.5px] border-line-soft bg-[#fbfcfd] px-4 py-3.5"
                  >
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
                            <p class="m-0 mt-0.5 text-[13.5px] font-extrabold text-ink">
                              {{ projectWorkflowStatusText() }}
                            </p>
                          </div>
                        </div>

                        <div class="min-w-[160px] border-l border-line-soft pl-4">
                          <p class="m-0 text-[11.5px] font-bold text-muted">ผู้รับมอบหมาย</p>
                          @if (assignmentAnalyst()) {
                            <p class="m-0 mt-0.5 text-[13.5px] font-extrabold text-ink">
                              {{ assignmentAnalystName() }}
                            </p>
                          } @else {
                            <p class="m-0 mt-0.5 text-[13.5px] italic text-slate-400">รอมอบหมาย</p>
                          }
                        </div>

                        <div class="min-w-[160px] border-l border-line-soft pl-4">
                          <p class="m-0 text-[11.5px] font-bold text-muted">ผู้มอบหมาย</p>
                          @if (latestProjectAssignment()?.assignedBy) {
                            <p class="m-0 mt-0.5 text-[13.5px] font-extrabold text-ink">
                              {{ latestProjectAssignment()?.assignedBy }}
                            </p>
                          } @else {
                            <p class="m-0 mt-0.5 text-[13.5px] italic text-slate-400">
                              ยังไม่มีผู้รับผิดชอบ
                            </p>
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
                      <p class="m-0 text-[11.5px] font-bold text-muted">{{ t('common.budget') }}</p>
                      <p class="m-0 mt-1 text-[15px] font-extrabold text-ink">
                        {{ money(projectDetail()?.budget_amount) }}
                      </p>
                    </div>
                    <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                      <p class="m-0 text-[11.5px] font-bold text-muted">
                        {{ t('rf.detail.refPrice') }}
                      </p>
                      <p class="m-0 mt-1 text-[15px] font-extrabold text-ink">
                        {{ money(projectDetail()?.reference_price) }}
                      </p>
                    </div>
                    <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                      <p class="m-0 text-[11.5px] font-bold text-muted">
                        {{ t('rf.detail.contractPrice') }}
                      </p>
                      <p class="m-0 mt-1 text-[15px] font-extrabold text-ink">
                        {{ money(contractValue()) }}
                      </p>
                    </div>
                    <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                      <p class="m-0 text-[11.5px] font-bold text-muted">Risk Score</p>
                      <p class="m-0 mt-1 text-[15px] font-extrabold text-ink">
                        {{ number(projectDetail()?.risk_score, 2) }}
                      </p>
                    </div>
                  </div>

                  <div class="mt-2.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                      <p class="m-0 text-[11.5px] font-bold text-muted">
                        {{ t('rf.detail.dept') }}
                      </p>
                      <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">
                        {{ projectDeptName() }}
                      </p>
                    </div>
                    <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                      <p class="m-0 text-[11.5px] font-bold text-muted">
                        {{ t('rf.detail.projectStatus') }}
                      </p>
                      <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ projectStatus() }}</p>
                    </div>
                    <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                      <p class="m-0 text-[11.5px] font-bold text-muted">
                        {{ t('rf.detail.contractNo') }}
                      </p>
                      <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ contractNo() }}</p>
                    </div>
                    <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                      <p class="m-0 text-[11.5px] font-bold text-muted">
                        {{ t('rf.detail.contractStatus') }}
                      </p>
                      <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">
                        {{ contractStatus() }}
                      </p>
                    </div>
                  </div>

                  <div class="mt-2.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                      <p class="m-0 text-[11.5px] font-bold text-muted">
                        {{ t('rf.detail.vendor') }}
                      </p>
                      <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ vendorLabel() }}</p>
                    </div>
                    <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                      <p class="m-0 text-[11.5px] font-bold text-muted">
                        {{ t('rf.detail.purchaseMethod') }}
                      </p>
                      <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">
                        {{ purchaseMethodLabel() }}
                      </p>
                    </div>
                    <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                      <p class="m-0 text-[11.5px] font-bold text-muted">
                        {{ t('rf.detail.contractVsRef') }}
                      </p>
                      <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">
                        {{ comparisonLabel(contractValue(), projectDetail()?.reference_price) }}
                      </p>
                      <p class="m-0 mt-1 text-xs text-muted">
                        {{ percentageLabel(contractValue(), projectDetail()?.reference_price) }}
                      </p>
                    </div>
                    <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                      <p class="m-0 text-[11.5px] font-bold text-muted">
                        {{ t('rf.detail.contractVsBudget') }}
                      </p>
                      <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">
                        {{ comparisonLabel(contractValue(), projectDetail()?.budget_amount) }}
                      </p>
                      <p class="m-0 mt-1 text-xs text-muted">
                        {{ percentageLabel(contractValue(), projectDetail()?.budget_amount) }}
                      </p>
                    </div>
                  </div>

                  <div class="mt-3.5 rounded-[3px] border border-line-soft bg-[#fbfcfd] p-3.5">
                    <div class="flex items-center gap-2">
                      <h3 class="m-0 text-sm font-bold text-ink">สูตรที่ใช้คำนวณ</h3>
                      <app-info-tooltip
                        text="แสดงสูตรและการแทนค่าจากตัวเลขของโครงการที่เลือก เพื่อให้ตรวจสอบผลคำนวณย้อนกลับได้"
                        [width]="280"
                      />
                    </div>
                    <p class="m-0 mt-2 text-[12.5px] leading-relaxed text-muted">
                      หลักการคำนวณใช้ค่าฐานเป็นตัวหาร แล้วแปลงผลต่างเป็นเปอร์เซ็นต์:
                      <span class="font-bold text-ink">(ราคาสัญญา − ค่าฐาน) ÷ ค่าฐาน × 100</span>
                    </p>

                    <div class="mt-3 grid gap-2.5 lg:grid-cols-2">
                      <div class="rounded-[3px] border border-line-soft bg-white p-3">
                        <p class="m-0 text-[12px] font-extrabold text-ink">
                          1. ราคาสัญญาเทียบราคากลาง
                        </p>
                        <p class="m-0 mt-1 text-[12.5px] text-muted">
                          ค่าฐาน = ราคากลาง {{ money(projectDetail()?.reference_price) }} บาท
                        </p>
                        <p class="m-0 mt-2 font-mono text-[12px] leading-relaxed text-slate-700">
                          {{ calculationFormulaLine(projectDetail()?.reference_price) }}
                        </p>
                        <p class="m-0 mt-1 font-mono text-[12px] leading-relaxed text-slate-700">
                          {{ calculationDifferenceLine(projectDetail()?.reference_price) }}
                        </p>
                        <p class="m-0 mt-1 text-[13px] font-extrabold text-ink">
                          {{ calculationResultLine(projectDetail()?.reference_price) }}
                        </p>
                      </div>

                      <div class="rounded-[3px] border border-line-soft bg-white p-3">
                        <p class="m-0 text-[12px] font-extrabold text-ink">
                          2. ราคาสัญญาเทียบงบประมาณ
                        </p>
                        <p class="m-0 mt-1 text-[12.5px] text-muted">
                          ค่าฐาน = งบประมาณ {{ money(projectDetail()?.budget_amount) }} บาท
                        </p>
                        <p class="m-0 mt-2 font-mono text-[12px] leading-relaxed text-slate-700">
                          {{ calculationFormulaLine(projectDetail()?.budget_amount) }}
                        </p>
                        <p class="m-0 mt-1 font-mono text-[12px] leading-relaxed text-slate-700">
                          {{ calculationDifferenceLine(projectDetail()?.budget_amount) }}
                        </p>
                        <p class="m-0 mt-1 text-[13px] font-extrabold text-ink">
                          {{ calculationResultLine(projectDetail()?.budget_amount) }}
                        </p>
                      </div>
                    </div>

                    <p class="m-0 mt-2 text-[11.5px] leading-relaxed text-muted">
                      ผลลัพธ์เป็นบวกหมายถึงราคาสัญญาสูงกว่าค่าฐาน
                      ผลลัพธ์เป็นลบหมายถึงราคาสัญญาต่ำกว่าค่าฐาน
                    </p>
                  </div>
                </article>

                <section class="panel p-[18px]">
                  <div class="flex items-center gap-2">
                    <h2 class="m-0 text-[16px] font-bold text-ink">
                      ข้อมูลประกอบการวิเคราะห์ (โอกาส × ผลกระทบ 5×5)
                    </h2>
                    <app-info-tooltip
                      text="ใช้วิเคราะห์ความรุนแรงของปัจจัยตามโอกาส × ผลกระทบ (1–25) ไม่ใช่ป้ายระดับความเสี่ยงของโครงการ"
                      [width]="300"
                    />
                  </div>
                  <p class="m-0 mt-1 text-[12.5px] text-muted">
                    ป้ายระดับความเสี่ยงของโครงการด้านบนอ้างอิง
                    <span class="font-bold">Risk Score</span> และ
                    <span class="font-bold">risk_level</span> จาก backend เท่านั้น
                  </p>
                  <div class="mt-3.5 grid items-start gap-5 lg:grid-cols-[auto_1fr]">
                    <app-risk-matrix
                      [likelihood]="scoreInfo().matrix_likelihood"
                      [impact]="scoreInfo().matrix_impact"
                    />
                    <div class="grid gap-2.5">
                      <div class="grid grid-cols-3 gap-2.5">
                        <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                          <p class="m-0 text-[11.5px] font-bold text-muted">
                            {{ t('rf.matrix.likelihoodSum') }}
                          </p>
                          <p class="m-0 mt-1 text-[19px] font-extrabold text-ink">
                            {{ number(scoreInfo().matrix_likelihood, 0)
                            }}<span class="text-[12px] font-bold text-muted">/5</span>
                          </p>
                        </div>
                        <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                          <p class="m-0 text-[11.5px] font-bold text-muted">
                            {{ t('rf.matrix.impactMax') }}
                          </p>
                          <p class="m-0 mt-1 text-[19px] font-extrabold text-ink">
                            {{ number(scoreInfo().matrix_impact, 0)
                            }}<span class="text-[12px] font-bold text-muted">/5</span>
                          </p>
                        </div>
                        <div
                          class="rounded-[3px] border border-line-soft p-[11px]"
                          [style.background]="bandColor(scoreInfo().matrix_level) + '14'"
                        >
                          <p class="m-0 text-[11.5px] font-bold text-muted">
                            คะแนน 5×5 (ประกอบการวิเคราะห์)
                          </p>
                          <p
                            class="m-0 mt-1 text-[19px] font-extrabold"
                            [style.color]="bandColor(scoreInfo().matrix_level)"
                          >
                            {{ number(scoreInfo().matrix_score, 0) }} ·
                            {{ scoreInfo().matrix_level || '-' }}
                          </p>
                        </div>
                      </div>
                      <div class="rounded-[3px] border border-line-soft bg-[#fbfcfd] p-3">
                        <p class="m-0 text-[12px] font-bold text-slate-700">
                          {{ t('rf.matrix.composition') }}
                        </p>
                        <p class="m-0 mt-1 text-[12.5px] leading-relaxed text-muted">
                          {{ t('rf.matrix.foundSignalsPre') }}
                          <span class="font-bold text-ink">{{
                            number(scoreInfo().factors_triggered, 0)
                          }}</span>
                          {{ t('common.factorsUnit') }}
                          @if (scoreInfo().factors_not_computable) {
                            · {{ t('common.cannotEvaluate') }}
                            <span class="font-bold text-[#8a2a1f]">{{
                              number(scoreInfo().factors_not_computable, 0)
                            }}</span>
                            {{ t('common.factorsUnit') }}
                          }
                          · {{ t('rf.matrix.proportionScore') }}
                          {{ number(scoreInfo().risk_score, 0) }}/100
                        </p>
                        @if (scoreInfo().summary_text) {
                          <p class="m-0 mt-1.5 text-[12.5px] leading-relaxed text-slate-700">
                            {{ scoreInfo().summary_text }}
                          </p>
                        }
                        @if ((scoreInfo().factors_triggered ?? 0) >= 3) {
                          <p class="m-0 mt-1.5 text-[11.5px] text-muted">
                            {{ t('rf.matrix.corroboration') }}
                          </p>
                        }
                      </div>
                    </div>
                  </div>
                </section>

                <section class="panel p-[18px]">
                  <h2 class="m-0 mb-3.5 text-[16px] font-bold text-ink">
                    {{ t('rf.factors.title') }}
                  </h2>

                  @if (!triggeredFactors().length) {
                    <app-empty-state
                      [title]="t('rf.factors.emptyTitle')"
                      [message]="t('rf.factors.emptyMsg')"
                    />
                  } @else {
                    <div class="grid gap-3">
                      @for (factor of triggeredFactors(); track factor.factor_code) {
                        <article class="rounded-[4px] border-[1.5px] border-line p-3.5">
                          <div class="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p class="m-0 text-sm font-bold text-ink">{{ factor.name_th }}</p>
                              <p class="m-0 mt-0.5 text-[11.5px] text-muted">
                                {{ factor.factor_code }}
                              </p>
                            </div>
                            @if (factor.risk_band) {
                              <span
                                class="shrink-0 rounded-[3px] px-2.5 py-1 text-[11.5px] font-extrabold text-white"
                                [style.background]="bandColor(factor.risk_band)"
                                [title]="matrixChip(factor)"
                                >{{ matrixChip(factor) }} · {{ bandText(factor.risk_band) }}</span
                              >
                            }
                          </div>

                          <!-- เทียบค่าที่วัดได้ ↔ เกณฑ์ (audit line) -->
                          <div class="mt-2.5 grid gap-2 sm:grid-cols-2">
                            <div class="rounded-[3px] border border-line-soft bg-zebra p-2.5">
                              <p class="m-0 text-[11.5px] font-bold text-muted">
                                {{ t('rf.factors.observedValue') }}
                              </p>
                              <p
                                class="m-0 mt-1 text-[15px] font-extrabold"
                                [class]="isComputable(factor) ? 'text-ink' : 'text-[#8a2a1f]'"
                              >
                                {{
                                  isComputable(factor)
                                    ? value(factor.observed_value)
                                    : t('common.cannotEvaluate')
                                }}
                              </p>
                            </div>
                            <div class="rounded-[3px] border border-line-soft bg-zebra p-2.5">
                              <p class="m-0 text-[11.5px] font-bold text-muted">
                                {{ t('rf.factors.threshold') }}
                              </p>
                              <p
                                class="m-0 mt-1 text-[12.5px] font-bold text-slate-700 break-words"
                              >
                                {{ thresholdText(factor) }}
                              </p>
                            </div>
                          </div>

                          @if (factor.evidence_text) {
                            <p class="m-0 mt-2.5 text-[12.5px] leading-relaxed text-slate-700">
                              {{ factor.evidence_text }}
                            </p>
                          }
                          @if (catalogDescription(factor.factor_code)) {
                            <p class="m-0 mt-1.5 text-[12.5px] leading-relaxed text-muted">
                              {{ catalogDescription(factor.factor_code) }}
                            </p>
                          }
                          @if (factor.legal_ref) {
                            <p
                              class="m-0 mt-2 border-t border-line-soft pt-2 text-[11.5px] leading-relaxed text-muted"
                            >
                              <span class="font-bold text-slate-600">{{
                                t('rf.factors.legalRef')
                              }}</span>
                              {{ factor.legal_ref }}
                            </p>
                          }
                        </article>
                      }
                    </div>
                  }

                  @if (notComputableFactors().length) {
                    <div class="mt-3.5 rounded-[3px] border border-[#e6cfca] bg-[#fdf6f5] p-3">
                      <p class="m-0 text-[12px] font-bold text-[#8a2a1f]">
                        {{ t('rf.factors.notComputableTitle') }}
                      </p>
                      <div class="mt-1.5 grid gap-1">
                        @for (factor of notComputableFactors(); track factor.factor_code) {
                          <p class="m-0 text-[12px] text-slate-700">
                            <span class="font-bold"
                              >{{ factor.factor_code }} {{ factor.name_th }}</span
                            >
                            @if (factor.evidence_text) {
                              — {{ factor.evidence_text }}
                            }
                          </p>
                        }
                      </div>
                    </div>
                  }
                </section>

                <section class="panel p-[18px]">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 class="m-0 text-[16px] font-bold text-ink">
                        {{ t('rf.catalog.title') }}
                      </h2>
                      <p class="m-0 mt-1 text-[13px] text-muted">{{ t('rf.catalog.subtitle') }}</p>
                    </div>
                    <span
                      class="rounded-[20px] border border-line bg-zebra px-3 py-1 text-xs font-bold text-slate-700"
                    >
                      {{ t('rf.catalog.triggerCount', { count: selectedProjectCatalog().length }) }}
                    </span>
                  </div>

                  @if (!selectedProjectCatalog().length) {
                    <div class="mt-3">
                      <app-empty-state
                        [title]="t('rf.catalog.emptyTitle')"
                        [message]="t('rf.catalog.emptyMsg')"
                      />
                    </div>
                  } @else {
                    <div class="mt-3.5 grid gap-2.5 md:grid-cols-2">
                      @for (factor of selectedProjectCatalog(); track factor.factor_code) {
                        <div class="rounded-[3px] border border-line px-3 py-2.5">
                          <div class="flex items-start justify-between gap-1.5">
                            <p class="m-0 text-[13px] font-bold text-ink">
                              {{ factor.factor_code }} · {{ factor.name_th }}
                            </p>
                            @if (factor.severity) {
                              <span
                                class="shrink-0 rounded-[20px] bg-row-active px-2 py-0.5 text-[11px] font-bold text-slate-700"
                              >
                                {{ factor.severity }}
                              </span>
                            }
                          </div>
                          <p class="m-0 mt-1 text-xs leading-relaxed text-muted">
                            {{
                              factor.description_th ||
                                factor.category ||
                                t('rf.catalog.noDescription')
                            }}
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
    </section>
  `,
})
export class RiskFactorsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly t = this.i18n.t;

  /** แปลงค่า band (ไทย internal) → ป้ายตามภาษาปัจจุบัน */
  bandText(band: string | null | undefined): string {
    return band ? this.i18n.bandLabel(band) : '';
  }

  /** แผงความเห็นผู้ตรวจสอบ (F5) — ซ่อนจาก public_user ตาม FEEDBACK_ROLES ฝั่ง backend */
  readonly canSeeFeedback = computed(() => this.auth.hasRole(...FEEDBACK_ROLES));

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
      return projects.filter((project) =>
        this.projectMatchesFilters(project, selectedType, minBudget, maxBudget),
      );
    }
    return projects.filter((project) => {
      const idText = String(project.project_id).toLowerCase();
      const nameText = String(project.project_name ?? '').toLowerCase();
      const typeText = this.projectType(project).toLowerCase();
      const matchesQuery =
        idText.includes(query) || nameText.includes(query) || typeText.includes(query);
      return (
        matchesQuery && this.projectMatchesFilters(project, selectedType, minBudget, maxBudget)
      );
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
    return assignment
      ? (ANALYSTS.find((analyst) => analyst.id === assignment.analystId) ?? null)
      : null;
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
    this.syncProjectIdQueryParam(String(projectId));
  }

  clearSelection(): void {
    this.selectedProjectId.set(null);
    this.projectDetail.set(null);
    this.loadingDetail.set(false);
    this.syncProjectIdQueryParam(null);
  }

  /** sync ?projectId= ใน URL ให้ share/refresh แล้วเปิดโครงการเดิมได้ (ไม่เพิ่ม history entry) */
  private syncProjectIdQueryParam(projectId: string | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { projectId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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
    return (
      detail?.contract_value ??
      detail?.contract_price ??
      detail?.contract_amount ??
      detail?.winning_price ??
      null
    );
  }

  projectStatus(): string {
    const detail = this.projectDetail();
    return detail?.project_status || detail?.status || this.t('common.unspecified');
  }

  projectDeptName(): string {
    const detail = this.projectDetail();
    return detail?.dept_name || detail?.dept_sub_name || this.t('common.unspecified');
  }

  contractNo(): string {
    return this.projectDetail()?.contract_no || '-';
  }

  contractStatus(): string {
    return this.projectDetail()?.contract_status || '-';
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
      (detail.vendor_id !== null && detail.vendor_id !== undefined
        ? `Vendor #${detail.vendor_id}`
        : '-')
    );
  }

  purchaseMethodLabel(): string {
    const detail = this.projectDetail();
    return detail?.purchase_method || detail?.purchase_method_group || '-';
  }

  comparisonLabel(
    left: number | string | null | undefined,
    right: number | string | null | undefined,
  ): string {
    const diff = this.percentageDifference(left, right);
    if (diff === null) {
      return '-';
    }
    if (diff === 0) {
      return this.t('rf.compare.equal');
    }
    return diff > 0
      ? this.t('rf.compare.higher', { pct: Math.abs(diff).toFixed(2) })
      : this.t('rf.compare.lower', { pct: Math.abs(diff).toFixed(2) });
  }

  percentageLabel(
    left: number | string | null | undefined,
    right: number | string | null | undefined,
  ): string {
    const diff = this.percentageDifference(left, right);
    if (diff === null) {
      return this.t('rf.compare.notCalculable');
    }
    const sign = diff > 0 ? '+' : '';
    return `(${sign}${diff.toFixed(2)}%) เทียบจากค่าฐาน`;
  }

  calculationFormulaLine(base: number | string | null | undefined): string {
    const contract = toNumber(this.contractValue());
    const baseValue = toNumber(base);
    if (contract === null || baseValue === null || baseValue === 0) {
      return 'แทนค่าไม่ได้ เพราะราคาสัญญาหรือค่าฐานไม่ครบ';
    }
    return `(${this.money(contract)} - ${this.money(baseValue)}) / ${this.money(baseValue)} x 100`;
  }

  calculationDifferenceLine(base: number | string | null | undefined): string {
    const contract = toNumber(this.contractValue());
    const baseValue = toNumber(base);
    if (contract === null || baseValue === null || baseValue === 0) {
      return 'ผลต่างและเปอร์เซ็นต์: คำนวณไม่ได้';
    }
    const difference = contract - baseValue;
    return `ผลต่าง = ${this.money(difference)} บาท`;
  }

  calculationResultLine(base: number | string | null | undefined): string {
    const diff = this.percentageDifference(this.contractValue(), base);
    if (diff === null) {
      return 'ผลลัพธ์: คำนวณไม่ได้';
    }
    const sign = diff > 0 ? '+' : '';
    return `ผลลัพธ์ = ${sign}${diff.toFixed(2)}%`;
  }

  isComputable(factor: ProjectRiskFactor): boolean {
    return toBool(factor.computable);
  }

  /** ข้อมูลคะแนนรวม (จาก ProjectDetailResponse.risk_score ที่ api ผสมเข้ามาบน detail) */
  scoreInfo() {
    const d = this.projectDetail() as (ProjectDetail & Record<string, unknown>) | null;
    return {
      matrix_level: (d?.['matrix_level'] as string) ?? null,
      matrix_likelihood: toNumber(d?.['matrix_likelihood'] as number),
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

  /** จำนวนปัจจัยที่ประเมินไม่ได้ (computable=0) */
  notComputableFactors(): ProjectRiskFactor[] {
    const factors = this.projectDetail()?.risk_factors ?? [];
    return factors.filter((f) => !toBool(f.computable));
  }

  /** แปลง threshold_used (JSON string หรือ object) → ข้อความสั้นสำหรับผู้ตรวจ */
  thresholdText(factor: ProjectRiskFactor): string {
    const raw = factor.threshold_used;
    if (raw === null || raw === undefined || raw === '') {
      return '-';
    }
    let obj: Record<string, unknown>;
    try {
      obj = typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown as Record<string, unknown>);
    } catch {
      return String(raw);
    }
    // ตัด likelihood_map / account_map ออก แสดงเฉพาะ threshold ที่อ่านง่าย
    const skip = new Set(['likelihood_map', 'account_map', 'likelihood_by']);
    const parts = Object.entries(obj)
      .filter(([k]) => !skip.has(k))
      .map(([k, v]) => `${k}=${typeof v === 'number' ? v : JSON.stringify(v)}`);
    return parts.length ? parts.join(', ') : '-';
  }

  /** ป้ายกำกับ โอกาส×ผลกระทบ ต่อ factor */
  matrixChip(factor: ProjectRiskFactor): string {
    const l = toNumber(factor.likelihood);
    const i = toNumber(factor.impact);
    const s = toNumber(factor.matrix_score);
    if (l === null || i === null || s === null) {
      return '-';
    }
    return this.t('rf.matrixChip', { l, i, s });
  }

  catalogDescription(code: string): string {
    const factor = this.catalog().find((item) => item.factor_code === code);
    return factor?.description_th ?? factor?.category ?? '';
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
    return (
      project.project_type || project.purchase_method_group || this.t('common.unspecifiedType')
    );
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

  private percentageDifference(
    left: number | string | null | undefined,
    right: number | string | null | undefined,
  ): number | null {
    const leftValue = toNumber(left);
    const rightValue = toNumber(right);
    if (leftValue === null || rightValue === null || rightValue === 0) {
      return null;
    }
    return ((leftValue - rightValue) / rightValue) * 100;
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
