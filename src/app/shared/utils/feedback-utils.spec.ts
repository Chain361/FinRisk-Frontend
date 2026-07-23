import {
  computeRiskScore,
  concernColor,
  concernLabel,
  feedbackStatusChipClass,
  feedbackStatusLabel,
  formatFeedbackDate,
} from './feedback-utils';

describe('feedbackStatusLabel', () => {
  it('labels each workflow status in Thai', () => {
    expect(feedbackStatusLabel('draft')).toBe('ฉบับร่าง');
    expect(feedbackStatusLabel('submitted')).toBe('ส่งแล้ว');
    expect(feedbackStatusLabel('resolved')).toBe('ปิดเรื่องแล้ว');
  });

  it('falls back for unknown statuses', () => {
    expect(feedbackStatusLabel(null)).toBe('ไม่ระบุ');
    expect(feedbackStatusLabel('weird')).toBe('ไม่ระบุ');
  });
});

describe('feedbackStatusChipClass', () => {
  it('gives each status a distinct chip style', () => {
    const classes = ['draft', 'submitted', 'resolved'].map(feedbackStatusChipClass);
    expect(new Set(classes).size).toBe(3);
  });

  it('falls back to the draft style for unknown statuses', () => {
    expect(feedbackStatusChipClass(undefined)).toBe(feedbackStatusChipClass('unknown'));
  });
});

describe('concernLabel / concernColor', () => {
  it('maps concern levels to Thai labels', () => {
    expect(concernLabel('low')).toBe('ต่ำ');
    expect(concernLabel('medium')).toBe('ปานกลาง');
    expect(concernLabel('high')).toBe('สูง');
    expect(concernLabel(null)).toBe('-');
  });

  it('uses risk-band tones per level with a neutral fallback', () => {
    expect(concernColor('low')).toBe('#15803d');
    expect(concernColor('medium')).toBe('#b45309');
    expect(concernColor('high')).toBe('#c2410c');
    expect(concernColor(undefined)).toBe('#64748b');
  });
});

describe('computeRiskScore', () => {
  it('multiplies likelihood by impact', () => {
    expect(computeRiskScore(3, 4)).toBe(12);
    expect(computeRiskScore('5', '5')).toBe(25);
  });

  it('returns null when either side is missing (matching backend behavior)', () => {
    expect(computeRiskScore(null, 4)).toBeNull();
    expect(computeRiskScore(3, undefined)).toBeNull();
    expect(computeRiskScore('', '')).toBeNull();
  });
});

describe('formatFeedbackDate', () => {
  it('formats backend UTC timestamps as Thai date-time', () => {
    const formatted = formatFeedbackDate('2026-07-23 04:00:00');
    // ปีพ.ศ. 2569 และมีเวลา — ไม่ตรึงเวลาที่แน่นอนเพราะขึ้นกับ timezone ของเครื่องรันเทส
    expect(formatted).toContain('2569');
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it('returns "-" for empty values and passes through unparseable ones', () => {
    expect(formatFeedbackDate(null)).toBe('-');
    expect(formatFeedbackDate('')).toBe('-');
    expect(formatFeedbackDate('not-a-date')).toBe('not-a-date');
  });
});
