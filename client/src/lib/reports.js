// Printing and exporting share one rule: the document that leaves the browser contains the
// report rows and nothing else — no sidebar, no nav, no buttons. The page's own layout is
// never handed to the print dialog.

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cell = (col, row) => {
  const raw = typeof col.value === 'function' ? col.value(row) : row[col.value];
  return raw === null || raw === undefined || raw === '' ? '—' : String(raw);
};

const today = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// The identity a report signs itself with; /auth/me carries the linked teacher or student name.
export const reporterName = (user) => user?.teacher?.name || user?.student?.name || user?.email || '—';

export const slug = (text) => String(text || 'report')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'report';

export const stamp = () => new Date().toISOString().slice(0, 10);

// 'Attendance-2026-11-03' style names, so a download says what it holds.
export const reportFileName = (title, suffix = '') => `${slug(title)}${suffix ? `-${slug(suffix)}` : ''}-${stamp()}`;

function buildHtml({ title, subtitle, meta = [], columns, rows, footer }) {
  const head = columns.map((c) => `<th class="${c.align === 'right' ? 'num' : ''}">${esc(c.header)}</th>`).join('');
  const body = rows.map((row) => `<tr>${columns
    .map((c) => `<td class="${c.align === 'right' ? 'num' : ''}">${esc(cell(c, row))}</td>`)
    .join('')}</tr>`).join('');
  const metaList = meta.filter(Boolean).map((m) => `<div><span>${esc(m.label)}</span><strong>${esc(m.value)}</strong></div>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @page { size: A4 ${meta.length > 1 ? 'landscape' : 'portrait'}; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: #0f172a; background: #fff;
    font: 12px/1.45 "Segoe UI", Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  header { border-bottom: 2px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 10px; }
  h1 { margin: 0; font-size: 18px; letter-spacing: .2px; }
  .sub { margin-top: 2px; color: #475569; font-size: 12px; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 22px; margin: 8px 0 14px; font-size: 11px; }
  .meta div { display: flex; gap: 6px; }
  .meta span { color: #64748b; text-transform: uppercase; letter-spacing: .4px; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th { background: #eff6ff; color: #1e3a8a; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
  td.num, th.num { text-align: right; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tfoot { margin-top: 14px; }
  .note { margin-top: 12px; color: #475569; font-size: 11px; }
  .totals { margin-top: 10px; font-size: 12px; font-weight: 600; }
</style>
</head>
<body>
<header>
  <h1>${esc(title)}</h1>
  ${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ''}
</header>
${metaList ? `<div class="meta">${metaList}</div>` : ''}
<table>
  <thead><tr>${head}</tr></thead>
  <tbody>${body || `<tr><td colspan="${columns.length}">No records for this filter.</td></tr>`}</tbody>
</table>
${footer ? `<div class="totals">${esc(footer)}</div>` : ''}
<div class="note">Generated on ${esc(today())} · ${rows.length} record${rows.length === 1 ? '' : 's'}</div>
</body>
</html>`;
}

// The report is written into a throwaway iframe: the browser prints that document, so the
// application shell can never appear in the preview or the PDF.
export function printReport({ title, subtitle, meta, columns, rows, footer }) {
  const doc = buildHtml({ title, subtitle, meta, columns, rows, footer });
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  frame.onload = () => {
    const win = frame.contentWindow;
    // A tick lets the iframe lay the table out before the dialog snapshots it.
    setTimeout(() => {
      win.focus();
      win.print();
      setTimeout(() => frame.remove(), 1500);
    }, 120);
  };
  document.body.appendChild(frame);
  frame.srcdoc = doc;
}

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function toCsv(rows, columns) {
  const head = columns.map((c) => csvCell(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => csvCell(cell(c, row))).join(','));
  // The BOM is what makes Excel open UTF-8 names correctly.
  return `﻿${[head, ...body].join('\r\n')}\r\n`;
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') || filename.includes('.') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv({ title, subtitle, rows, columns, suffix }) {
  const firstLine = subtitle ? `${csvCell(subtitle)}\r\n` : '';
  saveBlob(new Blob([firstLine + toCsv(rows, columns)], { type: 'text/csv;charset=utf-8;' }),
    `${reportFileName(title, suffix)}.csv`);
}

// Authenticated binary downloads (receipt PDFs): a plain <a href> carries no bearer token and
// the API answers 401, so the file is fetched through the API client and saved locally.
export async function downloadAuthedFile(api, path, filename) {
  const { data } = await api.get(path, { responseType: 'blob' });
  saveBlob(data, filename);
}
