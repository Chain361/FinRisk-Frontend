export const TOKEN_KEY = 'finrisk_token';
export const USER_KEY = 'finrisk_user';

/** decode JWT payload ฝั่ง client แบบไม่ verify ลายเซ็น (เอาไว้เช็ค exp เพื่อ UX เท่านั้น —
 * backend เป็นคนตรวจลายเซ็น/หมดอายุจริงเสมอ) token รูปแบบผิดถือว่าหมดอายุ/ใช้ไม่ได้ */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    return typeof payload.exp === 'number' ? Date.now() >= payload.exp * 1000 : false;
  } catch {
    return true;
  }
}
