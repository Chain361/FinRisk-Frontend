import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders headings, gfm tables, and bold from a chatbot reply', () => {
    const html = renderMarkdown(
      [
        '## โครงการ MOCK-CON-002 — ก่อสร้างรางระบายน้ำ คสล.',
        '',
        '| รายการ | รายละเอียด |',
        '|---|---|',
        '| **งบประมาณ** | 498,000 บาท |',
      ].join('\n'),
    );

    expect(html).toContain('<h2>');
    expect(html).toContain('<strong>งบประมาณ</strong>');
    // ตารางต้องมี wrapper ให้เลื่อนแนวนอนได้ในกล่องแชท
    expect(html).toContain('<div class="chat-md-table"><table>');
  });

  it('keeps single newlines as line breaks', () => {
    expect(renderMarkdown('บรรทัดหนึ่ง\nบรรทัดสอง')).toContain('<br>');
  });
});
