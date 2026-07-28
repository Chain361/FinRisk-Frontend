import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api/api.service';
import {
  ALL_FEATURE_ITEMS,
  FEATURE_GROUPS,
  defaultFeaturesForRole,
} from '../../core/auth/features';
import { ROLE_LABELS, RoleCode, SCOPED_ROLES } from '../../core/auth/roles';
import {
  ManagedUser,
  UserDirectoryService,
  UserStatus,
} from '../../core/auth/user-directory.service';
import { Subdistrict } from '../../core/models/domain.models';
import { subdistrictLabel } from '../../shared/utils/risk-utils';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ToastService } from '../../shared/ui/toast.service';

const ROLE_OPTIONS = Object.keys(ROLE_LABELS) as RoleCode[];

@Component({
  selector: 'app-user-management-page',
  standalone: true,
  imports: [FormsModule, EmptyStateComponent],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">ผู้ดูแลระบบ</p>
          <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">จัดการผู้ใช้งาน</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">แก้ไขและจัดการบัญชีผู้ใช้งานในระบบ</p>
        </div>
      </div>

      <!-- ตัวกรอง -->
      <div
        class="grid gap-3.5 rounded-[4px] border-[1.5px] border-line bg-white px-[18px] py-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">ค้นหาชื่อ</span>
          <input
            type="search"
            class="gov-input mt-[5px]"
            placeholder="ชื่อ"
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
          />
        </label>
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">บทบาท</span>
          <select
            class="gov-select mt-[5px]"
            [ngModel]="roleFilter()"
            (ngModelChange)="roleFilter.set($event)"
          >
            <option value="">ทั้งหมด</option>
            @for (role of roleOptions; track role) {
              <option [value]="role">{{ roleLabel(role) }}</option>
            }
          </select>
        </label>
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">ตำบล</span>
          <select
            class="gov-select mt-[5px]"
            [ngModel]="subdistrictFilter()"
            (ngModelChange)="subdistrictFilter.set($event)"
          >
            <option value="">ทั้งหมด</option>
            @for (sub of subdistricts(); track sub.subdistrict_id) {
              <option [value]="sub.subdistrict_id">{{ subLabel(sub) }}</option>
            }
          </select>
        </label>
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">สถานะ</span>
          <select
            class="gov-select mt-[5px]"
            [ngModel]="statusFilter()"
            (ngModelChange)="statusFilter.set($event)"
          >
            <option value="">ทั้งหมด</option>
            <option value="active">ใช้งาน</option>
            <option value="disabled">ปิดใช้งาน</option>
          </select>
        </label>
      </div>

      <section class="panel p-[18px]">
        <p class="m-0 mb-3 text-[13px] text-muted">พบ {{ filteredUsers().length }} รายการ</p>

        @if (filteredUsers().length === 0) {
          <app-empty-state
            title="ไม่พบผู้ใช้งาน"
            message="ไม่มีผู้ใช้งานที่ตรงกับตัวกรองที่เลือก ลองปรับตัวกรองแล้วลองใหม่อีกครั้ง"
          />
        } @else {
          <div class="overflow-x-auto">
            <table class="gov-table">
              <thead>
                <tr>
                  <th scope="col">ชื่อ</th>
                  <th scope="col">บทบาท</th>
                  <th scope="col">ตำบล</th>
                  <th scope="col">สถานะ</th>
                  <th scope="col">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                @for (u of filteredUsers(); track u.user_id) {
                  <tr>
                    <td class="font-bold">{{ u.display_name }}</td>
                    <td class="text-[12.5px]">{{ roleLabel(u.role) }}</td>
                    <td class="text-[12.5px]">{{ subdistrictName(u.subdistrict_id) }}</td>
                    <td>
                      <span
                        class="inline-flex items-center rounded-[3px] border px-2.5 py-1 text-xs font-bold"
                        [class]="
                          u.status === 'active'
                            ? 'border-risk-low bg-green-50 text-risk-low'
                            : 'border-risk-high bg-red-50 text-risk-high'
                        "
                      >
                        {{ u.status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน' }}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        class="h-[32px] cursor-pointer rounded-[3px] border-[1.5px] border-line bg-white px-3 text-[12.5px] font-bold text-slate-700 hover:bg-zebra"
                        (click)="openEditModal(u)"
                      >
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </section>

    @if (modalOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        style="background: rgba(11, 49, 100, 0.55);"
        (click)="closeModal()"
      >
        <div
          #dialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-modal-title"
          class="w-[92%] max-w-[480px] rounded-[4px] border-2 border-navy bg-white p-[26px]"
          (click)="$event.stopPropagation()"
        >
          <h2 id="user-modal-title" class="m-0 mb-4 text-lg font-extrabold text-navy">
            แก้ไขผู้ใช้งาน
          </h2>

          <form class="grid gap-3.5" (ngSubmit)="submitModal()">
            <label class="block">
              <span class="text-[12.5px] font-bold text-muted">ชื่อ-นามสกุล</span>
              <input
                #firstField
                class="gov-input mt-[5px]"
                [(ngModel)]="formDisplayName"
                name="displayName"
                required
              />
            </label>

            <label class="block">
              <span class="text-[12.5px] font-bold text-muted">บทบาท</span>
              <select
                class="gov-select mt-[5px]"
                [ngModel]="formRole"
                (ngModelChange)="onFormRoleChange($event)"
                name="role"
                required
              >
                @for (role of roleOptions; track role) {
                  <option [value]="role">{{ roleLabel(role) }}</option>
                }
              </select>
            </label>

            @if (formRoleNeedsSubdistrict()) {
              <label class="block">
                <span class="text-[12.5px] font-bold text-muted">ตำบล</span>
                <select
                  class="gov-select mt-[5px]"
                  [(ngModel)]="formSubdistrictId"
                  name="subdistrictId"
                  required
                >
                  <option [ngValue]="null" disabled>เลือกตำบล</option>
                  @for (sub of subdistricts(); track sub.subdistrict_id) {
                    <option [ngValue]="sub.subdistrict_id">{{ subLabel(sub) }}</option>
                  }
                </select>
              </label>
            }

            <label class="block">
              <span class="text-[12.5px] font-bold text-muted">สถานะ</span>
              <select class="gov-select mt-[5px]" [(ngModel)]="formStatus" name="status">
                <option value="active">ใช้งาน</option>
                <option value="disabled">ปิดใช้งาน</option>
              </select>
            </label>

            <fieldset class="rounded-[3px] border-[1.5px] border-line p-3">
              <legend class="px-1 text-[12.5px] font-bold text-muted">
                หน้า/ฟีเจอร์ที่เข้าถึงได้
              </legend>

              <div class="mb-2 flex gap-3 text-[12px] font-bold text-navy">
                <button
                  type="button"
                  class="cursor-pointer underline"
                  (click)="selectAllFeatures()"
                >
                  เลือกทั้งหมด
                </button>
                <button type="button" class="cursor-pointer underline" (click)="clearAllFeatures()">
                  ไม่เลือกเลย
                </button>
              </div>

              <div class="grid max-h-[240px] gap-4 overflow-y-auto pr-1 sm:grid-cols-1">
                @for (group of featureGroups; track group.id) {
                  <div>
                    <p
                      class="m-0 mb-1 text-[16px] font-bold uppercase tracking-wide text-slate-500"
                    >
                      {{ group.label }}
                    </p>
                    @for (item of group.items; track item.code) {
                      <label class="flex items-center gap-2 py-0.5 text-[15px] text-ink">
                        <input
                          type="checkbox"
                          class="size-[20px] shrink-0 accent-navy"
                          [checked]="isFeatureChecked(item.code)"
                          (change)="toggleFeature(item.code)"
                        />
                        {{ item.label }}
                      </label>
                    }
                  </div>
                }
              </div>
            </fieldset>

            <div class="mt-2 flex justify-end gap-2.5">
              <button
                type="button"
                class="gov-btn-outline"
                [disabled]="saving()"
                (click)="closeModal()"
              >
                ยกเลิก
              </button>
              <button type="submit" class="gov-btn-primary" [disabled]="saving()">
                {{ saving() ? 'กำลังบันทึก...' : 'บันทึก' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class UserManagementPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly userDirectory = inject(UserDirectoryService);
  private readonly toast = inject(ToastService);

  readonly roleOptions = ROLE_OPTIONS;
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly users = this.userDirectory.users;

  readonly search = signal('');
  readonly roleFilter = signal('');
  readonly subdistrictFilter = signal('');
  readonly statusFilter = signal('');

  readonly filteredUsers = computed(() => {
    const search = this.search().trim().toLowerCase();
    const role = this.roleFilter();
    const subdistrictId = this.subdistrictFilter();
    const status = this.statusFilter();

    return this.users().filter((u) => {
      if (search && !u.display_name.toLowerCase().includes(search)) {
        return false;
      }
      if (role && u.role !== role) {
        return false;
      }
      if (subdistrictId && String(u.subdistrict_id ?? '') !== subdistrictId) {
        return false;
      }
      if (status && u.status !== status) {
        return false;
      }
      return true;
    });
  });

  readonly modalOpen = signal(false);
  readonly editingUser = signal<ManagedUser | null>(null);
  readonly saving = signal(false);

  formDisplayName = '';
  formRole: RoleCode = 'risk_analyst';
  formSubdistrictId: number | null = null;
  formStatus: UserStatus = 'active';
  formFeatures: string[] = [];

  readonly featureGroups = FEATURE_GROUPS;

  /**
   * เมธอดธรรมดา (ไม่ใช่ computed) เพราะ formRole เป็น plain property ไม่ใช่ signal —
   * ถ้าใช้ computed() จะไม่มี dependency ให้ track เลยคำนวณครั้งเดียวตอนเปิด modal ครั้งแรก
   * แล้ว cache ค่าตลอดไป ไม่ re-evaluate ตาม user/role ที่เปิดแก้ไขจริงๆ
   */
  formRoleNeedsSubdistrict(): boolean {
    return (SCOPED_ROLES as readonly string[]).includes(this.formRole);
  }

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly firstField = viewChild<ElementRef<HTMLElement>>('firstField');
  private previousFocus: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.modalOpen()) {
        this.previousFocus = document.activeElement as HTMLElement | null;
        queueMicrotask(() => this.firstField()?.nativeElement.focus());
      } else if (this.previousFocus) {
        this.previousFocus.focus();
        this.previousFocus = null;
      }
    });
  }

  ngOnInit(): void {
    this.api.subdistricts().subscribe({
      next: (list) => this.subdistricts.set(list),
      error: () => this.subdistricts.set([]),
    });
  }

  roleLabel(role: string): string {
    return ROLE_LABELS[role] ?? role;
  }

  subLabel(sub: Subdistrict | undefined): string {
    return subdistrictLabel(sub);
  }

  subdistrictName(subdistrictId: number | null): string {
    if (subdistrictId == null) {
      return '—';
    }
    return this.subLabel(this.subdistricts().find((s) => s.subdistrict_id === subdistrictId));
  }

  openEditModal(user: ManagedUser): void {
    this.editingUser.set(user);
    this.formDisplayName = user.display_name;
    this.formRole = user.role;
    this.formSubdistrictId = user.subdistrict_id;
    this.formStatus = user.status;
    this.formFeatures = [...user.allowed_features];
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  /** เปลี่ยน role ในฟอร์ม → รีเซ็ตรายการหน้า/ฟีเจอร์กลับไปเป็นค่าเริ่มต้นของ role นั้น */
  onFormRoleChange(role: RoleCode): void {
    this.formRole = role;
    this.formSubdistrictId = this.subdistricts()[0]?.subdistrict_id ?? null;
    this.formFeatures = defaultFeaturesForRole(role);
  }

  isFeatureChecked(code: string): boolean {
    return this.formFeatures.includes(code);
  }

  toggleFeature(code: string): void {
    this.formFeatures = this.isFeatureChecked(code)
      ? this.formFeatures.filter((c) => c !== code)
      : [...this.formFeatures, code];
  }

  selectAllFeatures(): void {
    this.formFeatures = ALL_FEATURE_ITEMS.map((item) => item.code);
  }

  clearAllFeatures(): void {
    this.formFeatures = [];
  }

  submitModal(): void {
    const editing = this.editingUser();
    if (!editing || !this.formDisplayName.trim() || this.saving()) {
      return;
    }
    const subdistrictId = this.formRoleNeedsSubdistrict() ? this.formSubdistrictId : null;

    this.saving.set(true);
    this.userDirectory
      .updateUser(editing.user_id, {
        display_name: this.formDisplayName.trim(),
        role: this.formRole,
        subdistrict_id: subdistrictId,
        status: this.formStatus,
        allowed_features: this.formFeatures,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeModal();
          this.toast.success('บันทึกสิทธิ์ผู้ใช้งานสำเร็จ');
        },
        error: () => {
          this.saving.set(false);
          this.toast.error('บันทึกสิทธิ์ผู้ใช้งานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        },
      });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modalOpen()) {
      this.closeModal();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onTab(event: KeyboardEvent): void {
    if (!this.modalOpen() || event.key !== 'Tab') {
      return;
    }
    const root = this.dialog()?.nativeElement;
    if (!root) {
      return;
    }
    const focusable = root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
