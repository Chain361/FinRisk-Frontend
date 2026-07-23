import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { RESOLVE_ROLES } from '../../core/auth/roles';
import {
  AuditorFeedback,
  AuditorFeedbackCreate,
  CONCERN_LEVEL_OPTIONS,
  ConcernLevel,
  FeedbackStatus,
  IMPACT_OPTIONS,
  LIKELIHOOD_OPTIONS,
} from '../../core/models/domain.models';
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
import { FeedbackStatusBadgeComponent } from '../../shared/ui/feedback-status-badge.component';
import { activeOf, latestOf } from '../../shared/utils/feedback-utils';
import {
  bandColor,
  formatMoney,
  formatNumber,
  sortProjectsByRisk,
  toBool,
  toNumber,
} from '../../shared/utils/risk-utils';

@Component({
  selector: 'app-risk-analyst-feedback-page',
  standalone: true,
  imports: [
    ConfirmModalComponent,
    EmptyStateComponent,
    FeedbackStatusBadgeComponent,
    FilterBarComponent,
    FormsModule,
  ],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F5</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">
          แบบฟอร์มบันทึกความคิดเห็นด้านความเสี่ยงของโครงการ
        </h1>
        <p class="m-0 mt-1.5 text-sm text-muted">
          บันทึกผลการประเมินความเสี่ยง ข้อคิดเห็น และข้อเสนอแนะสำหรับโครงการที่ได้รับมอบหมาย
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
        <p
          class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high"
        >
          {{ error() }}
        </p>
      }

      @if (loadingProjects()) {
        <div class="panel p-6 text-sm text-muted">กำลังโหลดโครงการ...</div>
      } @else {
        @if (!selectedProjectId()) {
          <section class="panel overflow-hidden">
            <div class="border-b-[1.5px] border-line px-4 py-3.5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 class="m-0 text-[15px] font-bold text-ink">รายการโครงการทั้งหมด</h2>
                  <p class="m-0 mt-1 text-[12.5px] text-muted">
                    คลิกโครงการเพื่อบันทึกความคิดเห็นด้านความเสี่ยง
                  </p>
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
                    <th class="px-4 py-3 text-right">คะแนนความเสี่ยง</th>
                    <th class="px-4 py-3">สถานะความคิดเห็น</th>
                    <th class="px-4 py-3">วันที่ตรวจล่าสุด</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white">
                  @if (!filteredProjects().length) {
                    <tr>
                      <td colspan="7" class="px-4 py-12">
                        <app-empty-state
                          title="ไม่พบโครงการ"
                          message="ลองเปลี่ยนคำค้น ปี ตำบล หรือระดับความเสี่ยง"
                        />
                      </td>
                    </tr>
                  } @else {
                    @for (project of pagedProjects(); track project.project_id) {
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
                        <td class="px-4 py-3 text-right font-semibold">
                          {{ number(project.risk_score, 2) }}
                        </td>
                        <td class="px-4 py-3">
                          <app-feedback-status-badge
                            [status]="feedbackStatusFor(project.project_id)"
                          />
                        </td>
                        <td class="px-4 py-3">
                          {{ feedbackUpdatedFor(project.project_id) }}
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>

            @if (filteredProjects().length) {
              <div
                class="flex flex-wrap items-center justify-between gap-3 border-t-[1.5px] border-line px-4 py-3"
              >
                <p class="m-0 text-[12.5px] text-muted">
                  หน้า {{ currentPage() }} จาก {{ totalPages() }} · ทั้งหมด
                  {{ filteredProjects().length }} โครงการ
                </p>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex h-9 items-center justify-center rounded-[3px] border-[1.5px] border-line bg-white px-3 text-[13px] font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-zebra"
                    [disabled]="currentPage() <= 1"
                    (click)="prevPage()"
                  >
                    ก่อนหน้า
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-9 items-center justify-center rounded-[3px] border-[1.5px] border-line bg-white px-3 text-[13px] font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-zebra"
                    [disabled]="currentPage() >= totalPages()"
                    (click)="nextPage()"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            }
          </section>
        } @else {
          <div class="grid items-start gap-4 xl:grid-cols-[340px_1fr]">
            <section class="panel overflow-hidden">
              <div class="border-b-[1.5px] border-line px-4 py-3.5">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 class="m-0 text-[15px] font-bold text-ink">รายการโครงการ</h2>
                    <p class="m-0 mt-1 text-[12.5px] text-muted">
                      เลือกโครงการเพื่อบันทึกความคิดเห็นด้านความเสี่ยง
                    </p>
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
                    </div>
                    <p class="m-0 mt-1.5 text-xs text-muted">
                      ปี {{ project.budget_year }} · คะแนน {{ number(project.risk_score, 2) }}
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
                      <p class="m-0 text-[12.5px] font-bold text-muted">
                        Project ID {{ projectDetail()?.project_id }}
                      </p>
                      <h2 class="m-0 mt-1 text-[19px] font-extrabold text-ink">
                        {{ projectDetail()?.project_name }}
                      </h2>
                      <p class="m-0 mt-1.5 text-[13px] text-muted">
                        ปี {{ projectDetail()?.budget_year }} ·
                        {{
                          projectDetail()?.project_type ||
                            projectDetail()?.purchase_method_group ||
                            '-'
                        }}
                      </p>
                    </div>
                    <div class="flex flex-col items-end gap-1.5">
                      <span class="text-[11px] font-bold text-muted"
                        >คะแนนความเสี่ยง {{ number(scoreInfo().risk_score, 0) }}/100</span
                      >
                    </div>
                  </div>

                  @if (projectDetail()?.source_file || projectDetail()?.data_quality_note) {
                    <div
                      class="mt-3 rounded-[3px] border border-line-soft bg-[#fbfcfd] px-3 py-2 text-[11.5px] text-muted"
                    >
                      @if (projectDetail()?.source_file) {
                        <p class="m-0">
                          <span class="font-bold text-slate-600">ที่มาข้อมูล:</span>
                          {{ projectDetail()?.source_file }}
                        </p>
                      }
                      @if (projectDetail()?.data_quality_note) {
                        <p class="m-0 mt-0.5">
                          <span class="font-bold text-[#8a2a1f]">ข้อจำกัดข้อมูล:</span>
                          {{ projectDetail()?.data_quality_note }}
                        </p>
                      }
                    </div>
                  }

                  <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                      <p class="m-0 text-[11.5px] font-bold text-muted">หน่วยงาน</p>
                      <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">
                        {{ projectDeptName() }}
                      </p>
                    </div>
                    <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                      <p class="m-0 text-[11.5px] font-bold text-muted">งบประมาณ</p>
                      <p class="m-0 mt-1 text-[15px] font-extrabold text-ink">
                        {{ money(projectDetail()?.budget_amount) }}
                      </p>
                    </div>
                    <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                      <p class="m-0 text-[11.5px] font-bold text-muted">ประเภทจัดซื้อจัดจ้าง</p>
                      <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">
                        {{ purchaseMethodLabel() }}
                      </p>
                    </div>
                    <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                      <p class="m-0 text-[11.5px] font-bold text-muted">สถานะโครงการ</p>
                      <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ projectStatus() }}</p>
                    </div>
                  </div>
                </article>

                <section class="panel p-[18px]">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 class="m-0 text-[16px] font-bold text-ink">
                        แบบฟอร์มบันทึกความคิดเห็นด้านความเสี่ยง
                      </h2>
                      <p class="m-0 mt-1 text-[13px] text-muted">
                        {{ projectDetail()?.project_name }} · Project ID
                        {{ projectDetail()?.project_id }}
                      </p>
                    </div>
                    <div class="flex flex-col items-start gap-1.5">
                      <app-feedback-status-badge
                        [status]="asFeedbackStatus(currentFeedback()?.status)"
                      />
                      <span class="text-[11.5px] text-muted"
                        >ผู้ตรวจสอบ: {{ auditorDisplayName() }}</span
                      >
                    </div>
                  </div>

                  @if (feedbackSuccessMessage()) {
                    <p
                      class="mt-3 rounded-[3px] border-[1.5px] border-risk-low bg-green-50 px-3 py-2 text-sm font-bold text-risk-low"
                    >
                      {{ feedbackSuccessMessage() }}
                    </p>
                  }
                  @if (feedbackValidationError()) {
                    <p
                      class="mt-3 rounded-[3px] border-[1.5px] border-risk-high bg-red-50 px-3 py-2 text-sm font-bold text-risk-high"
                    >
                      {{ feedbackValidationError() }}
                    </p>
                  }
                  @if (isFeedbackLocked()) {
                    <p
                      class="mt-3 rounded-[3px] border border-line-soft bg-zebra px-3 py-2 text-[12.5px] text-muted"
                    >
                      ความคิดเห็นนี้ถูกส่งแล้ว ไม่สามารถแก้ไขได้
                      แต่คุณสามารถเขียนความคิดเห็นเพิ่มเติมได้
                    </p>
                  }

                  <div class="mt-3.5 grid gap-3.5">
                    <label class="grid gap-1.5">
                      <span class="text-[12.5px] font-bold text-muted"
                        >ความคิดเห็น <span class="text-risk-high">*</span></span
                      >
                      <textarea
                        class="gov-input h-auto min-h-[96px] py-2"
                        [class.cursor-not-allowed]="isFeedbackLocked()"
                        [class.bg-zebra]="isFeedbackLocked()"
                        rows="4"
                        placeholder="บันทึกความคิดเห็นด้านความเสี่ยงของโครงการ"
                        [ngModel]="feedbackText()"
                        (ngModelChange)="feedbackText.set($event)"
                        [disabled]="isFeedbackLocked()"
                      ></textarea>
                    </label>

                    <div class="grid gap-3.5 sm:grid-cols-2">
                      <label class="grid gap-1.5">
                        <span class="text-[12.5px] font-bold text-muted"
                          >ระดับความกังวล <span class="text-risk-high">*</span></span
                        >
                        <select
                          class="gov-select"
                          [class.cursor-not-allowed]="isFeedbackLocked()"
                          [class.bg-zebra]="isFeedbackLocked()"
                          [ngModel]="concernLevel()"
                          (ngModelChange)="concernLevel.set($event)"
                          [disabled]="isFeedbackLocked()"
                        >
                          <option [ngValue]="null">เลือกระดับความกังวล</option>
                          @for (option of concernLevelOptions; track option.value) {
                            <option [ngValue]="option.value">{{ option.label }}</option>
                          }
                        </select>
                      </label>

                      <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                        <p class="m-0 text-[11.5px] font-bold text-muted">
                          คะแนนความเสี่ยง (คำนวณอัตโนมัติ)
                        </p>
                        <p class="m-0 mt-1 text-[19px] font-extrabold text-ink">
                          {{ riskScorePreview() ?? '-' }}
                          @if (riskScorePreview() !== null) {
                            <span class="text-[12px] font-bold text-muted">/25</span>
                          }
                        </p>
                      </div>
                    </div>

                    <div class="grid gap-3.5 sm:grid-cols-2">
                      <label class="grid gap-1.5">
                        <span class="text-[12.5px] font-bold text-muted"
                          >คะแนนโอกาสเกิดของความเสี่ยง <span class="text-risk-high">*</span></span
                        >
                        <select
                          class="gov-select"
                          [class.cursor-not-allowed]="isFeedbackLocked()"
                          [class.bg-zebra]="isFeedbackLocked()"
                          [ngModel]="likelihoodScore()"
                          (ngModelChange)="likelihoodScore.set($event)"
                          [disabled]="isFeedbackLocked()"
                        >
                          <option [ngValue]="null">เลือกโอกาสเกิดขึ้น</option>
                          @for (option of likelihoodOptions; track option.value) {
                            <option [ngValue]="option.value">{{ option.label }}</option>
                          }
                        </select>
                        @if (likelihoodHint()) {
                          <span class="text-[11.5px] text-muted">{{ likelihoodHint() }}</span>
                        }
                      </label>

                      <label class="grid gap-1.5">
                        <span class="text-[12.5px] font-bold text-muted"
                          >คะแนนผลกระทบของความเสี่ยง <span class="text-risk-high">*</span></span
                        >
                        <select
                          class="gov-select"
                          [class.cursor-not-allowed]="isFeedbackLocked()"
                          [class.bg-zebra]="isFeedbackLocked()"
                          [ngModel]="impactScore()"
                          (ngModelChange)="impactScore.set($event)"
                          [disabled]="isFeedbackLocked()"
                        >
                          <option [ngValue]="null">เลือกระดับผลกระทบ</option>
                          @for (option of impactOptions; track option.value) {
                            <option [ngValue]="option.value">{{ option.label }}</option>
                          }
                        </select>
                        @if (impactHint()) {
                          <span class="text-[11.5px] text-muted">{{ impactHint() }}</span>
                        }
                      </label>
                    </div>

                    <label class="grid gap-1.5">
                      <span class="text-[12.5px] font-bold text-muted">ข้อเสนอแนะ</span>
                      <textarea
                        class="gov-input h-auto min-h-[72px] py-2"
                        [class.cursor-not-allowed]="isFeedbackLocked()"
                        [class.bg-zebra]="isFeedbackLocked()"
                        rows="3"
                        placeholder="ข้อเสนอแนะสำหรับผู้รับผิดชอบโครงการ (ถ้ามี)"
                        [ngModel]="suggestions()"
                        (ngModelChange)="suggestions.set($event)"
                        [disabled]="isFeedbackLocked()"
                      ></textarea>
                    </label>
                  </div>

                  <div class="mt-4 flex flex-wrap items-center justify-start gap-2.5">
                    @if (isFeedbackLocked()) {
                      <button type="button" class="gov-btn-primary" (click)="startNewFeedback()">
                        เขียนความคิดเห็นเพิ่มเติม
                      </button>
                    } @else {
                      <div class="flex gap-2.5">
                        <button
                          type="button"
                          class="gov-btn-outline disabled:cursor-not-allowed disabled:opacity-40"
                          [disabled]="isFeedbackLocked() || feedbackSaving()"
                          (click)="saveFeedbackDraft()"
                        >
                          บันทึกฉบับร่าง
                        </button>
                        <button
                          type="button"
                          class="gov-btn-primary disabled:cursor-not-allowed disabled:opacity-40"
                          [disabled]="isFeedbackLocked() || feedbackSaving()"
                          (click)="requestSubmitFeedback()"
                        >
                          ส่ง
                        </button>
                      </div>
                    }
                  </div>
                </section>

                <section class="panel p-[18px]">
                  <h2 class="m-0 mb-3.5 text-[16px] font-bold text-ink">
                    ประวัติความคิดเห็นของโครงการ
                  </h2>

                  @if (!feedbackHistory().length) {
                    <app-empty-state
                      title="ยังไม่มีความคิดเห็น"
                      message="ยังไม่มีการบันทึกความคิดเห็นสำหรับโครงการนี้"
                    />
                  } @else {
                    <div class="overflow-x-auto">
                      <table class="min-w-full divide-y divide-slate-200 text-sm">
                        <thead
                          class="bg-slate-50 text-right text-xs font-semibold uppercase text-slate-500"
                        >
                          <tr>
                            <th class="px-3 py-2.5 text-left">วันที่ตรวจ</th>
                            <th class="px-3 py-2.5">ผู้ตรวจสอบ</th>
                            <th class="px-3 py-2.5">ความคิดเห็น</th>
                            <th class="px-3 py-2.5">ระดับความกังวล</th>
                            <th class="px-3 py-2.5">ข้อเสนอแนะ</th>
                            <th class="px-3 py-2.5">คะแนนความเสี่ยง</th>
                            <th class="px-3 py-2.5">สถานะ</th>
                            <th class="px-3 py-2.5"></th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 bg-white">
                          @for (entry of feedbackHistory(); track entry.feedback_id) {
                            <tr>
                              <td
                                class="whitespace-nowrap px-3 py-2.5 text-[12.5px] text-slate-700"
                              >
                                {{ dateLabel(entry.updated_at) }}
                              </td>
                              <td
                                class="px-3 py-2.5 text-[12.5px] font-semibold text-ink text-right"
                              >
                                {{ entry.auditor_name }}
                              </td>
                              <td
                                class="max-w-xs px-3 py-2.5 text-[12.5px] text-slate-700 text-right"
                              >
                                <p class="m-0 line-clamp-2">{{ entry.feedback_text }}</p>
                              </td>
                              <td class="px-3 py-2.5 text-[12.5px] text-slate-700 text-right">
                                {{ concernLabel(entry.concern_level) }}
                              </td>
                              <td
                                class="max-w-xs px-3 py-2.5 text-[12.5px] text-slate-700 text-right"
                              >
                                <p class="m-0 line-clamp-2">{{ entry.suggestions || '-' }}</p>
                              </td>
                              <td
                                class="px-3 py-2.5 text-right text-[12.5px] font-bold text-ink text-right"
                              >
                                {{ entry.risk_score ?? '-' }}
                              </td>
                              <td class="px-3 py-2.5 text-right">
                                <app-feedback-status-badge
                                  [status]="asFeedbackStatus(entry.status)"
                                />
                              </td>
                              <td class="px-3 py-2.5 text-right">
                                @if (canDeleteFeedback(entry)) {
                                  <div class="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      class="inline-flex h-8 items-center justify-center rounded-[3px] border-[1.5px] border-risk-high px-2.5 text-[12px] font-bold text-risk-high hover:bg-red-50"
                                      (click)="requestDeleteFeedback(String(entry.feedback_id))"
                                    >
                                      ลบ
                                    </button>
                                  </div>
                                }
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                </section>

                <app-confirm-modal
                  [open]="showSubmitConfirm()"
                  title="ยืนยันการส่งความคิดเห็น"
                  message="เมื่อส่งแล้วจะไม่สามารถแก้ไขได้ และระบบจะส่งความคิดเห็นนี้ไปยังผู้ตรวจสอบโครงการ ยืนยันหรือไม่?"
                  confirmLabel="ยืนยันการส่ง"
                  (confirmed)="confirmSubmitFeedback()"
                  (cancelled)="showSubmitConfirm.set(false)"
                />

                <app-confirm-modal
                  [open]="feedbackPendingDeleteId() !== null"
                  title="ยืนยันการลบความคิดเห็น"
                  message="เมื่อลบแล้วจะไม่สามารถกู้คืนได้ ยืนยันการลบความคิดเห็นนี้หรือไม่?"
                  confirmLabel="ยืนยันลบ"
                  (confirmed)="confirmDeleteFeedback()"
                  (cancelled)="feedbackPendingDeleteId.set(null)"
                />
              }
            </section>
          </div>
        }
      }
    </section>
  `,
})
export class RiskAnalystFeedbackPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  protected readonly String = String;
  protected readonly concernLevelOptions = CONCERN_LEVEL_OPTIONS;
  protected readonly likelihoodOptions = LIKELIHOOD_OPTIONS;
  protected readonly impactOptions = IMPACT_OPTIONS;
  readonly error = signal('');
  readonly loadingProjects = signal(false);
  readonly loadingDetail = signal(false);
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly allProjects = signal<Project[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly catalog = signal<RiskFactorCatalog[]>([]);
  readonly allFeedback = signal<AuditorFeedback[]>([]);
  readonly selectedFeedbackHistory = signal<AuditorFeedback[]>([]);
  readonly feedbackLoading = signal(false);
  readonly feedbackSaving = signal(false);
  readonly projectDetail = signal<ProjectDetail | null>(null);
  readonly searchQuery = signal('');

  readonly selectedSubdistrictId = signal<number | null>(null);
  readonly selectedYear = signal<number | null>(2568);
  readonly selectedRiskLevel = signal<string | null>(null);
  readonly selectedProjectType = signal<string | null>(null);
  readonly budgetAmountMin = signal('');
  readonly budgetAmountMax = signal('');
  readonly selectedProjectId = signal<string | null>(null);

  private readonly pageSize = 5;
  readonly currentPage = signal(1);

  readonly activeFeedbackId = signal<string | null>(null);
  readonly feedbackText = signal('');
  readonly concernLevel = signal<ConcernLevel | null>(null);
  readonly likelihoodScore = signal<number | null>(null);
  readonly impactScore = signal<number | null>(null);
  readonly suggestions = signal('');
  readonly feedbackSuccessMessage = signal('');
  readonly feedbackValidationError = signal('');
  readonly showSubmitConfirm = signal(false);
  readonly feedbackPendingDeleteId = signal<string | null>(null);
  readonly isEditingEntry = signal(false);
  readonly isComposingNewFeedback = signal(false);

  readonly riskScorePreview = computed(() => {
    const likelihood = this.likelihoodScore();
    const impact = this.impactScore();
    return likelihood !== null && impact !== null ? likelihood * impact : null;
  });

  readonly likelihoodHint = computed(
    () =>
      this.likelihoodOptions.find((option) => option.value === this.likelihoodScore())?.hint ?? '',
  );

  readonly impactHint = computed(
    () => this.impactOptions.find((option) => option.value === this.impactScore())?.hint ?? '',
  );

  readonly currentFeedback = computed<AuditorFeedback | null>(() => {
    const projectId = this.selectedProjectId();
    const username = this.auth.user()?.username;
    if (!projectId || !username) {
      return null;
    }
    return activeOf(this.selectedFeedbackHistory(), projectId, username);
  });

  readonly feedbackHistory = computed<AuditorFeedback[]>(() => this.selectedFeedbackHistory());

  readonly isFeedbackLocked = computed(() => {
    if (this.isEditingEntry() || this.isComposingNewFeedback()) {
      return false;
    }
    const current = this.currentFeedback();
    return !!current && current.status !== 'draft';
  });

  readonly canResolveFeedback = computed(() => this.auth.hasRole(...RESOLVE_ROLES));

  readonly auditorDisplayName = computed(() => {
    const user = this.auth.user();
    return user?.display_name || user?.full_name || user?.name || user?.username || 'ไม่ระบุ';
  });

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

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredProjects().length / this.pageSize)),
  );

  readonly pagedProjects = computed(() => {
    const page = this.currentPage();
    const start = (page - 1) * this.pageSize;
    return this.filteredProjects().slice(start, start + this.pageSize);
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

  ngOnInit(): void {
    this.loadingProjects.set(true);

    forkJoin({
      subdistricts: this.api.subdistricts(),
      catalog: this.api.riskFactors(),
      allProjects: this.api.projects(),
      feedback: this.api.feedbackList(),
    }).subscribe({
      next: ({ subdistricts, catalog, allProjects, feedback }) => {
        this.subdistricts.set(subdistricts);
        this.catalog.set(catalog);
        this.allProjects.set(allProjects);
        this.allFeedback.set(feedback);
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
    this.currentPage.set(1);
  }

  setBudgetAmountMin(value: string): void {
    this.budgetAmountMin.set(value);
    this.currentPage.set(1);
  }

  setBudgetAmountMax(value: string): void {
    this.budgetAmountMax.set(value);
    this.currentPage.set(1);
  }

  setSearch(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  prevPage(): void {
    this.currentPage.update((page) => Math.max(1, page - 1));
  }

  nextPage(): void {
    this.currentPage.update((page) => Math.min(this.totalPages(), page + 1));
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
    this.loadProjectDetail(projectId);
    this.loadFeedbackForm(String(projectId));
  }

  clearSelection(): void {
    this.selectedProjectId.set(null);
    this.projectDetail.set(null);
    this.loadingDetail.set(false);
    this.selectedFeedbackHistory.set([]);
    this.resetFeedbackForm();
  }

  feedbackStatusFor(projectId: string | number): FeedbackStatus | null {
    return this.asFeedbackStatus(latestOf(this.allFeedback(), projectId)?.status);
  }

  feedbackUpdatedFor(projectId: string | number): string {
    const record = latestOf(this.allFeedback(), projectId);
    return record ? this.dateLabel(record.updated_at) : '-';
  }

  asFeedbackStatus(status: string | null | undefined): FeedbackStatus | null {
    return (status as FeedbackStatus | null | undefined) ?? null;
  }

  concernLabel(level: ConcernLevel | string | null | undefined): string {
    return this.concernLevelOptions.find((option) => option.value === level)?.label ?? '-';
  }

  dateLabel(iso: string | null | undefined): string {
    if (!iso) {
      return '-';
    }
    return new Intl.DateTimeFormat('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  }

  saveFeedbackDraft(): void {
    const payload = this.buildFeedbackPayload('draft');
    if (!payload) {
      return;
    }
    this.feedbackValidationError.set('');
    this.feedbackSaving.set(true);
    this.submitFeedbackPayload(payload).subscribe({
      next: (record) => {
        this.activeFeedbackId.set(String(record.feedback_id));
        this.refreshFeedbackLists(() => {
          this.feedbackSaving.set(false);
          this.feedbackSuccessMessage.set('บันทึกฉบับร่างเรียบร้อยแล้ว');
        });
      },
      error: () => {
        this.feedbackSaving.set(false);
        this.feedbackValidationError.set('บันทึกฉบับร่างไม่สำเร็จ');
      },
    });
  }

  requestSubmitFeedback(): void {
    this.feedbackSuccessMessage.set('');
    if (
      !this.feedbackText().trim() ||
      !this.concernLevel() ||
      !this.likelihoodScore() ||
      !this.impactScore()
    ) {
      this.feedbackValidationError.set(
        'กรุณากรอกข้อมูลให้ครบถ้วนก่อน Submit: Feedback, Concern Level, Likelihood Score, Impact Score',
      );
      return;
    }
    this.feedbackValidationError.set('');
    this.showSubmitConfirm.set(true);
  }

  confirmSubmitFeedback(): void {
    this.showSubmitConfirm.set(false);
    const payload = this.buildFeedbackPayload('submitted');
    if (!payload) {
      return;
    }
    this.feedbackSaving.set(true);
    this.submitFeedbackPayload(payload).subscribe({
      next: () => {
        this.resetFeedbackFields();
        this.refreshFeedbackLists(() => {
          this.feedbackSaving.set(false);
          this.feedbackSuccessMessage.set('ส่งความคิดเห็นเรียบร้อยแล้ว');
        });
      },
      error: () => {
        this.feedbackSaving.set(false);
        this.feedbackValidationError.set('ส่งความคิดเห็นไม่สำเร็จ');
      },
    });
  }

  canDeleteFeedback(entry: AuditorFeedback): boolean {
    const username = this.auth.user()?.username;
    return entry.auditor_username === username || this.auth.hasRole(...RESOLVE_ROLES);
  }

  startNewFeedback(): void {
    this.resetFeedbackFields();
    this.isComposingNewFeedback.set(true);
    this.feedbackSuccessMessage.set('');
    this.feedbackValidationError.set('');
  }

  requestDeleteFeedback(feedbackId: string): void {
    this.feedbackPendingDeleteId.set(feedbackId);
  }

  confirmDeleteFeedback(): void {
    const feedbackId = this.feedbackPendingDeleteId();
    this.feedbackPendingDeleteId.set(null);
    if (!feedbackId) {
      return;
    }
    this.api.deleteFeedback(Number(feedbackId)).subscribe({
      next: () => {
        if (this.activeFeedbackId() === feedbackId) {
          this.resetFeedbackFields();
        }
        this.refreshFeedbackLists(() => {
          this.feedbackSuccessMessage.set('ลบความคิดเห็นเรียบร้อยแล้ว');
        });
      },
      error: () => this.feedbackValidationError.set('ลบความคิดเห็นไม่สำเร็จ'),
    });
  }

  resolveFeedback(): void {
    const current = this.currentFeedback();
    if (!current) {
      return;
    }
    this.api.resolveFeedback(current.feedback_id).subscribe({
      next: () => {
        this.refreshFeedbackLists(() => {
          this.feedbackSuccessMessage.set('เปลี่ยนสถานะเป็น Resolved เรียบร้อยแล้ว');
        });
      },
      error: () => this.feedbackValidationError.set('เปลี่ยนสถานะไม่สำเร็จ'),
    });
  }

  private buildFeedbackPayload(status: 'draft' | 'submitted'): AuditorFeedbackCreate | null {
    const projectId = this.selectedProjectId();
    const user = this.auth.user();
    if (!projectId || !user) {
      return null;
    }
    return {
      project_id: projectId,
      feedback_text: this.feedbackText(),
      concern_level: this.concernLevel(),
      likelihood_score: this.likelihoodScore(),
      impact_score: this.impactScore(),
      suggestions: this.suggestions().trim() || null,
      status,
    };
  }

  private submitFeedbackPayload(payload: AuditorFeedbackCreate) {
    const feedbackId = this.activeFeedbackId();
    return feedbackId
      ? this.api.updateFeedback(Number(feedbackId), payload)
      : this.api.createFeedback(payload);
  }

  private loadFeedbackForm(projectId: string): void {
    this.feedbackSuccessMessage.set('');
    this.feedbackValidationError.set('');
    this.isEditingEntry.set(false);
    this.isComposingNewFeedback.set(false);
    this.feedbackLoading.set(true);
    this.api.projectFeedback(projectId).subscribe({
      next: (records) => {
        this.selectedFeedbackHistory.set(records);
        this.feedbackLoading.set(false);
        const username = this.auth.user()?.username;
        const existing = username ? activeOf(records, projectId, username) : null;
        this.activeFeedbackId.set(existing ? String(existing.feedback_id) : null);
        this.feedbackText.set(existing?.feedback_text ?? '');
        this.concernLevel.set((existing?.concern_level as ConcernLevel | null | undefined) ?? null);
        this.likelihoodScore.set(existing?.likelihood_score ?? null);
        this.impactScore.set(existing?.impact_score ?? null);
        this.suggestions.set(existing?.suggestions ?? '');
      },
      error: () => {
        this.error.set('โหลดความคิดเห็นไม่สำเร็จ');
        this.feedbackLoading.set(false);
      },
    });
  }

  /** โหลด allFeedback + ประวัติของโครงการที่เลือกใหม่หลังบันทึก/ลบ/ส่ง/resolve สำเร็จ */
  private refreshFeedbackLists(onDone?: () => void): void {
    const projectId = this.selectedProjectId();
    forkJoin({
      all: this.api.feedbackList(),
      history: projectId ? this.api.projectFeedback(projectId) : of<AuditorFeedback[]>([]),
    }).subscribe({
      next: ({ all, history }) => {
        this.allFeedback.set(all);
        this.selectedFeedbackHistory.set(history);
        onDone?.();
      },
      error: () => {
        this.error.set('โหลดข้อมูลความคิดเห็นไม่สำเร็จ');
        onDone?.();
      },
    });
  }

  private resetFeedbackForm(): void {
    this.resetFeedbackFields();
    this.feedbackSuccessMessage.set('');
    this.feedbackValidationError.set('');
    this.showSubmitConfirm.set(false);
  }

  private resetFeedbackFields(): void {
    this.activeFeedbackId.set(null);
    this.feedbackText.set('');
    this.concernLevel.set(null);
    this.likelihoodScore.set(null);
    this.impactScore.set(null);
    this.suggestions.set('');
    this.isEditingEntry.set(false);
    this.isComposingNewFeedback.set(false);
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
      return 'เท่ากัน';
    }
    return diff > 0
      ? `สูงกว่า ${Math.abs(diff).toFixed(2)}%`
      : `ต่ำกว่า ${Math.abs(diff).toFixed(2)}%`;
  }

  percentageLabel(
    left: number | string | null | undefined,
    right: number | string | null | undefined,
  ): string {
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
    return `โอกาส ${l} × ผลกระทบ ${i} = ${s}`;
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
    this.currentPage.set(1);

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
}
