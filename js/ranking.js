// Shared rules for tables, podiums and member searches.
export function competitionRanks(rows = []) {
  const sorted = rows.map(row => ({ ...row, points: Number(row.points) || 0 }))
    .sort((a, b) => b.points - a.points);
  let rank = 0;
  return sorted.map((row, index) => {
    if (index === 0 || row.points !== sorted[index - 1].points) rank = index + 1;
    return { ...row, rank };
  });
}

export function podiumGroups(rows = []) {
  const groups = { 1: [], 2: [], 3: [] };
  competitionRanks(rows).forEach(row => {
    if (row.points > 0 && row.rank <= 3) groups[row.rank].push(row);
  });
  return groups;
}

export function normalizeSearch(value) {
  return String(value ?? '').normalize('NFC').toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ').trim();
}

export function departmentLabel(value) {
  const labels = { bda: 'BDa', bde: 'BDe', igt: 'iGT', igv: 'iGV',
    ocvp: 'OCVP', mkt: 'MKT', ogx: 'oGX', tm: 'TM', fnl: 'FnL' };
  const text = String(value ?? '').trim();
  return labels[text.toLowerCase()] || text;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

// Preserve calendar dates without evaluating the GViz Date(...) expression.
export function publicationDate(value) {
  const text = String(value ?? '').trim();
  let parts;
  const gviz = text.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})(?:,.*)?\)$/);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  const local = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s.*)?$/);
  if (gviz) parts = [Number(gviz[1]), Number(gviz[2]) + 1, Number(gviz[3])];
  else if (iso) parts = iso.slice(1).map(Number);
  else if (local) parts = [Number(local[3]), Number(local[2]), Number(local[1])];
  if (!parts) return null;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatPublicationDate(value) {
  if (!value) return '';
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul'
  });
}

export function weekDateRange(week, year) {
  const code = String(week).trim().match(/^(\d{1,2})\.(\d{2})$/);
  if (code) year = 2000 + Number(code[2]);
  const number = code ? Number(code[1]) : Number(String(week).replace(/^H(?:AFTA)?\s*/i, ''));
  if (!Number.isInteger(number) || number < 1 || number > 53 || !Number.isInteger(year)) return '';
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const start = new Date(jan4);
  start.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (number - 1) * 7);
  const thursday = new Date(start);
  thursday.setUTCDate(start.getUTCDate() + 3);
  if (thursday.getUTCFullYear() !== year) return '';
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const formatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export const SEASON_MONTHS = ['ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ',
  'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK', 'OCAK'];

export function seasonInfo(code) {
  const match = String(code ?? '').match(/^(\d{2})\.(\d{2})$/);
  if (!match || Number(match[1]) === 99 || Number(match[2]) !== Number(match[1]) + 1) return null;
  const year = 2000 + Number(match[1]);
  return { code: match[0], year, label: `ŞUBAT ${year} – OCAK ${year + 1}` };
}

export function currentSeasonCode(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'numeric', timeZone: 'Europe/Istanbul' }).formatToParts(now);
  const year = Number(parts.find(part => part.type === 'year').value) -
    (Number(parts.find(part => part.type === 'month').value) === 1 ? 1 : 0);
  return `${String(year % 100).padStart(2, '0')}.${String((year + 1) % 100).padStart(2, '0')}`;
}
