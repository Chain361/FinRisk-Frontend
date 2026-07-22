import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import {
  ANALYSTS,
  ASSIGNMENT_STORAGE_KEY,
  SavedAssignment,
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
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">โครงการทั้งหมด</h1>
        <p class="m-0 mt-1.5 text-sm text-muted">เปิดดูรายละเอียดโครงการ ปัจจัยเสี่ยงที่ trigger และสูตรการคำนวณ</p>
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
                    <th class="px-4 py-3">ระดับ 5×5</th>
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
                        <td class="px-4 py-3">
                          @if (project.matrix_level) {
                            <span class="inline-flex items-center rounded-[3px] px-2.5 py-1 text-[12px] font-extrabold text-white" [style.background]="bandColor(project.matrix_level)">{{ project.matrix_level }}</span>
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
                  <h2 class="m-0 text-[15px] font-bold text-ink">รายการโครงการ</h2>
                  <p class="m-0 mt-1 text-[12.5px] text-muted">เลือกโครงการเพื่อดูรายละเอียด</p>
                </div>
                <div class="flex w-full max-w-[305px] flex-col gap-2">
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
                  <div class="flex flex-col items-end gap-1.5">
                    @if (scoreInfo().matrix_level) {
                      <span
                        class="inline-flex items-center rounded-[3px] px-3 py-1 text-[13px] font-extrabold text-white"
                        [style.background]="bandColor(scoreInfo().matrix_level)"
                        title="ระดับความเสี่ยงตามกรอบ โอกาส × ผลกระทบ 5×5"
                      >ระดับ{{ scoreInfo().matrix_level }}</span>
                    }
                    <span class="text-[11px] font-bold text-muted">Risk Score {{ number(scoreInfo().risk_score, 0) }}/100</span>
                  </div>
                </div>

                @if (projectDetail()?.source_file || projectDetail()?.data_quality_note) {
                  <div class="mt-3 rounded-[3px] border border-line-soft bg-[#fbfcfd] px-3 py-2 text-[11.5px] text-muted">
                    @if (projectDetail()?.source_file) {
                      <p class="m-0"><span class="font-bold text-slate-600">ที่มาข้อมูล:</span> {{ projectDetail()?.source_file }}</p>
                    }
                    @if (projectDetail()?.data_quality_note) {
                      <p class="m-0 mt-0.5"><span class="font-bold text-[#8a2a1f]">ข้อจำกัดข้อมูล:</span> {{ projectDetail()?.data_quality_note }}</p>
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
                          {{ latestProjectAssignment() ? '✓' : '!' }}
                        </span>
                        <div>
                          <p class="m-0 text-[11.5px] font-bold text-muted">สถานะโครงการ</p>
                          <p class="m-0 mt-0.5 text-[13.5px] font-extrabold text-ink">{{ latestProjectAssignment() ? 'มอบหมายแล้ว' : 'ยังไม่มอบหมาย' }}</p>
                        </div>
                      </div>

                      <div class="min-w-[160px] border-l border-line-soft pl-4">
                        <p class="m-0 text-[11.5px] font-bold text-muted">ผู้รับมอบหมาย</p>
                        <p class="m-0 mt-0.5 text-[13.5px] font-extrabold text-ink">{{ assignmentAnalystName() }}</p>
                      </div>

                      <div class="min-w-[160px] border-l border-line-soft pl-4">
                        <p class="m-0 text-[11.5px] font-bold text-muted">ผู้มอบหมาย</p>
                        <p class="m-0 mt-0.5 text-[13.5px] font-extrabold text-ink">{{ latestProjectAssignment()?.assignedBy || '-' }}</p>
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

              </article>

              <section class="panel p-[18px]">
                <div class="flex items-center gap-2">
                  <h2 class="m-0 text-[16px] font-bold text-ink">การประเมินความเสี่ยง (โอกาส × ผลกระทบ 5×5)</h2>
                  <app-info-tooltip
                    text="อ้างอิงมาตรฐานการบริหารจัดการความเสี่ยงสำหรับหน่วยงานของรัฐ (กระทรวงการคลัง) และ COSO ERM — ระดับความเสี่ยง = โอกาส × ผลกระทบ (1–25)"
                    [width]="300"
                  />
                </div>
                <div class="mt-3.5 grid items-start gap-5 lg:grid-cols-[auto_1fr]">
                  <app-risk-matrix [likelihood]="scoreInfo().matrix_likelihood" [impact]="scoreInfo().matrix_impact" />
                  <div class="grid gap-2.5">
                    <div class="grid grid-cols-3 gap-2.5">
                      <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                        <p class="m-0 text-[11.5px] font-bold text-muted">โอกาสรวม</p>
                        <p class="m-0 mt-1 text-[19px] font-extrabold text-ink">{{ number(scoreInfo().matrix_likelihood, 0) }}<span class="text-[12px] font-bold text-muted">/5</span></p>
                      </div>
                      <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                        <p class="m-0 text-[11.5px] font-bold text-muted">ผลกระทบสูงสุด</p>
                        <p class="m-0 mt-1 text-[19px] font-extrabold text-ink">{{ number(scoreInfo().matrix_impact, 0) }}<span class="text-[12px] font-bold text-muted">/5</span></p>
                      </div>
                      <div class="rounded-[3px] border border-line-soft p-[11px]" [style.background]="bandColor(scoreInfo().matrix_level) + '14'">
                        <p class="m-0 text-[11.5px] font-bold text-muted">คะแนน = ระดับ</p>
                        <p class="m-0 mt-1 text-[19px] font-extrabold" [style.color]="bandColor(scoreInfo().matrix_level)">{{ number(scoreInfo().matrix_score, 0) }} · {{ scoreInfo().matrix_level || '-' }}</p>
                      </div>
                    </div>
                    <div class="rounded-[3px] border border-line-soft bg-[#fbfcfd] p-3">
                      <p class="m-0 text-[12px] font-bold text-slate-700">การประกอบคะแนน</p>
                      <p class="m-0 mt-1 text-[12.5px] leading-relaxed text-muted">
                        พบสัญญาณเสี่ยง <span class="font-bold text-ink">{{ number(scoreInfo().factors_triggered, 0) }}</span> ปัจจัย
                        @if (scoreInfo().factors_not_computable) {
                          · ประเมินไม่ได้ <span class="font-bold text-[#8a2a1f]">{{ number(scoreInfo().factors_not_computable, 0) }}</span> ปัจจัย
                        }
                        · คะแนนสัดส่วน {{ number(scoreInfo().risk_score, 0) }}/100
                      </p>
                      @if (scoreInfo().summary_text) {
                        <p class="m-0 mt-1.5 text-[12.5px] leading-relaxed text-slate-700">{{ scoreInfo().summary_text }}</p>
                      }
                      @if ((scoreInfo().factors_triggered ?? 0) >= 3) {
                        <p class="m-0 mt-1.5 text-[11.5px] text-muted">* มีสัญญาณยืนยันกัน ≥3 ตัว → เพิ่มโอกาสรวม +1 (corroboration)</p>
                      }
                    </div>
                  </div>
                </div>
              </section>

              <section class="panel p-[18px]">
                <h2 class="m-0 mb-3.5 text-[16px] font-bold text-ink">ปัจจัยที่ทำให้เสี่ยง</h2>

                @if (!triggeredFactors().length) {
                  <app-empty-state title="ไม่พบ factor ที่ trigger" message="โครงการนี้อาจไม่มีสัญญาณตามเกณฑ์ที่กำหนดไว้" />
                } @else {
                  <div class="grid gap-3">
                    @for (factor of triggeredFactors(); track factor.factor_code) {
                      <article class="rounded-[4px] border-[1.5px] border-line p-3.5">
                        <div class="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p class="m-0 text-sm font-bold text-ink">{{ factor.name_th }}</p>
                            <p class="m-0 mt-0.5 text-[11.5px] text-muted">{{ factor.factor_code }}</p>
                          </div>
                          @if (factor.risk_band) {
                            <span
                              class="shrink-0 rounded-[3px] px-2.5 py-1 text-[11.5px] font-extrabold text-white"
                              [style.background]="bandColor(factor.risk_band)"
                              [title]="matrixChip(factor)"
                            >{{ matrixChip(factor) }} · {{ factor.risk_band }}</span>
                          }
                        </div>

                        <!-- เทียบค่าที่วัดได้ ↔ เกณฑ์ (audit line) -->
                        <div class="mt-2.5 grid gap-2 sm:grid-cols-2">
                          <div class="rounded-[3px] border border-line-soft bg-zebra p-2.5">
                            <p class="m-0 text-[11.5px] font-bold text-muted">ค่าที่วัดได้</p>
                            <p class="m-0 mt-1 text-[15px] font-extrabold" [class]="isComputable(factor) ? 'text-ink' : 'text-[#8a2a1f]'">
                              {{ isComputable(factor) ? value(factor.observed_value) : 'ประเมินไม่ได้' }}
                            </p>
                          </div>
                          <div class="rounded-[3px] border border-line-soft bg-zebra p-2.5">
                            <p class="m-0 text-[11.5px] font-bold text-muted">เกณฑ์ที่ใช้เทียบ</p>
                            <p class="m-0 mt-1 text-[12.5px] font-bold text-slate-700 break-words">{{ thresholdText(factor) }}</p>
                          </div>
                        </div>

                        @if (factor.evidence_text) {
                          <p class="m-0 mt-2.5 text-[12.5px] leading-relaxed text-slate-700">{{ factor.evidence_text }}</p>
                        }
                        @if (catalogDescription(factor.factor_code)) {
                          <p class="m-0 mt-1.5 text-[12.5px] leading-relaxed text-muted">{{ catalogDescription(factor.factor_code) }}</p>
                        }
                        @if (factor.legal_ref) {
                          <p class="m-0 mt-2 border-t border-line-soft pt-2 text-[11.5px] leading-relaxed text-muted">
                            <span class="font-bold text-slate-600">ฐานอ้างอิง:</span> {{ factor.legal_ref }}
                          </p>
                        }
                      </article>
                    }
                  </div>
                }

                @if (notComputableFactors().length) {
                  <div class="mt-3.5 rounded-[3px] border border-[#e6cfca] bg-[#fdf6f5] p-3">
                    <p class="m-0 text-[12px] font-bold text-[#8a2a1f]">ปัจจัยที่ประเมินไม่ได้ (ข้อมูลไม่เพียงพอ — ไม่ใช่ "ผ่าน")</p>
                    <div class="mt-1.5 grid gap-1">
                      @for (factor of notComputableFactors(); track factor.factor_code) {
                        <p class="m-0 text-[12px] text-slate-700">
                          <span class="font-bold">{{ factor.factor_code }} {{ factor.name_th }}</span>
                          @if (factor.evidence_text) { — {{ factor.evidence_text }} }
                        </p>
                      }
                    </div>
                  </div>
                }
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

    </section>
  `,
})
export class RiskFactorsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

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

  assignmentAnalystName(): string {
    return this.assignmentAnalyst()?.name || '-';
  }

  assignmentAnalystTeam(): string {
    return this.assignmentAnalyst()?.team || 'ยังไม่มีผู้รับผิดชอบ';
  }

  assignmentAssignedAtText(): string {
    const assignedAt = this.latestProjectAssignment()?.assignedAt;
    return assignedAt ? this.formatAssignmentDate(assignedAt) : '-';
  }

  assignmentPriorityText(): string {
    switch (this.latestProjectAssignment()?.priority) {
      case 'high':
        return 'สูง - เร่งด่วน';
      case 'normal':
        return 'ปกติ';
      case 'low':
        return 'ต่ำ';
      default:
        return '-';
    }
  }

  assignmentStatusCircleClass(): string {
    return this.latestProjectAssignment()
      ? 'bg-risk-low text-white'
      : 'bg-risk-medium text-white';
  }

  assignmentPriorityBadgeClass(): string {
    switch (this.latestProjectAssignment()?.priority) {
      case 'high':
        return 'bg-red-100 text-risk-high';
      case 'normal':
        return 'bg-blue-100 text-navy';
      case 'low':
        return 'bg-green-100 text-risk-low';
      default:
        return 'bg-slate-100 text-slate-600';
    }
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
    return `โอกาส ${l} × ผลกระทบ ${i} = ${s}`;
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
    return project.project_type || project.purchase_method_group || 'ไม่ระบุประเภท';
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

  private percentageDifference(left: number | string | null | undefined, right: number | string | null | undefined): number | null {
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

