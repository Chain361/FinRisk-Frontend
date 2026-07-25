import { Injectable, isDevMode, signal } from '@angular/core';

import { RiskBand, RiskLevel } from '../models/domain.models';
import { normalizeRiskLevel } from '../../shared/utils/risk-utils';
import { assertKeyParity, DICT, Lang } from './dictionaries';

const STORAGE_KEY = 'finrisk.lang';

/** map ค่า risk band ภาษาไทย (internal key จาก bandFromScore) → key ใน dictionary */
const BAND_KEY: Record<string, string> = {
  ต่ำ: 'low',
  ปานกลาง: 'medium',
  สูง: 'high',
  สูงมาก: 'veryHigh',
};

/**
 * บริการแปลภาษา (ไทย/อังกฤษ) แบบ signal — สลับได้ runtime
 *
 * `t()` อ่าน signal `lang` ทุกครั้ง → เทมเพลต/computed ที่เรียก `t()` จะ reactive เอง
 * เมื่อเปลี่ยนภาษา Angular re-render ให้อัตโนมัติ
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>(readInitialLang());

  constructor() {
    if (isDevMode()) {
      assertKeyParity();
    }
    this.applyDocumentLang(this.lang());
  }

  /** แปลข้อความตามภาษาปัจจุบัน; รองรับ interpolate {name} ผ่าน params */
  readonly t = (key: string, params?: Record<string, string | number>): string => {
    const value = DICT[this.lang()][key];
    if (value === undefined) {
      if (isDevMode()) {
        console.warn(`[i18n] missing key: ${key}`);
      }
      return key;
    }
    if (!params) {
      return value;
    }
    return Object.entries(params).reduce(
      (acc, [name, val]) => acc.split(`{${name}}`).join(String(val)),
      value,
    );
  };

  setLang(lang: Lang): void {
    this.lang.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage ใช้ไม่ได้ (private mode ฯลฯ) — ข้าม best-effort
    }
    this.applyDocumentLang(lang);
  }

  toggle(): void {
    this.setLang(this.lang() === 'th' ? 'en' : 'th');
  }

  /** locale สำหรับ Intl (number/date) ตามภาษาปัจจุบัน */
  locale(): string {
    return this.lang() === 'th' ? 'th-TH' : 'en-US';
  }

  // ---- domain label helpers (reactive) — แทน pure fn เดิมที่ return ไทยตรง ๆ ----

  /** ป้ายระดับความเสี่ยงโครงการ (high/medium/low) */
  riskLabel(level: RiskLevel | null | undefined): string {
    return this.t(`risk.level.${normalizeRiskLevel(level)}`);
  }

  /** ป้ายระดับ 5×5 จากค่า band ภาษาไทย (internal) */
  bandLabel(band: RiskBand | null | undefined): string {
    return this.t(`risk.band.${BAND_KEY[band ?? ''] ?? 'unknown'}`);
  }

  /** ชื่อบทบาทผู้ใช้จาก role code */
  roleLabel(code: string | null | undefined): string {
    return code ? this.t(`role.${code}`) : this.t('role.unknown');
  }

  private applyDocumentLang(lang: Lang): void {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }
}

function readInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'th' || saved === 'en') {
      return saved;
    }
  } catch {
    // ข้าม
  }
  return 'th';
}
