import { Component, signal } from '@angular/core';
import { LucideFlaskConical, LucideX } from '@lucide/angular';

/**
 * แถบแจ้งสถานะ "ระบบต้นแบบ (Prototype)" ระดับ system-wide — แยกจาก guardrail banner
 * (ที่พูดเรื่องคะแนน/สีไม่ใช่คำตัดสิน) เพื่อกันเข้าใจผิดว่าเป็นระบบ production ที่ใช้ตัดสินใจทางการได้
 * ปิดชั่วคราวได้ แต่กลับมาแสดงเมื่อ reload (สถานะเก็บใน signal เท่านั้น ไม่ persist)
 */
@Component({
  selector: 'app-prototype-banner',
  standalone: true,
  imports: [LucideFlaskConical, LucideX],
  template: `
    @if (visible()) {
      <div
        class="flex items-center gap-2.5 border-b border-white/15 bg-navy px-4 py-2 text-white lg:px-[30px]"
        role="status"
      >
        <svg lucideFlaskConical class="size-4 shrink-0 text-gold"></svg>
        <p class="m-0 flex-1 text-[12.5px] leading-snug">
          <span class="font-bold">ระบบต้นแบบ (Prototype)</span>
          — ข้อมูลบางส่วนเป็นข้อมูลจำลอง ยังไม่ใช้สำหรับการตัดสินใจทางการ
        </p>
        <button
          type="button"
          class="grid size-6 shrink-0 cursor-pointer place-items-center rounded-[3px] text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="ปิดแถบแจ้งเตือน"
          (click)="visible.set(false)"
        >
          <svg lucideX class="size-4"></svg>
        </button>
      </div>
    }
  `,
})
export class PrototypeBannerComponent {
  readonly visible = signal(true);
}
