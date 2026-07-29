import { Marked, Renderer, Tokens } from 'marked';

/**
 * แปลง markdown จาก chatbot เป็น HTML
 *
 * คำตอบจาก LLM ถือเป็น untrusted content — ผลลัพธ์ของฟังก์ชันนี้ต้อง bind ผ่าน
 * [innerHTML] เท่านั้น (Angular sanitize ให้อัตโนมัติ ตัด script/on* handler/javascript: ทิ้ง)
 * ห้ามใช้ bypassSecurityTrustHtml กับผลลัพธ์นี้เด็ดขาด
 */
const marked = new Marked({
  gfm: true, // ตาราง/strikethrough ตามที่ system prompt ฝั่ง backend สั่งให้ตอบ
  breaks: true, // ขึ้นบรรทัดเดียวใน markdown = <br> (LLM มักเว้นบรรทัดเดียวในย่อหน้า)
});

// ตารางในกล่องแชทกว้างจำกัด — ครอบ wrapper ให้เลื่อนแนวนอนแทนที่จะดันกล่องล้น
// (ต้องลงทะเบียนผ่าน .use() — marked ไม่รับ renderer ที่ส่งทาง constructor options)
marked.use({
  renderer: {
    table(this: Renderer, token: Tokens.Table): string {
      return `<div class="chat-md-table">${Renderer.prototype.table.call(this, token)}</div>`;
    },
  },
});

export function renderMarkdown(text: string): string {
  return marked.parse(text, { async: false });
}
