/**
 * AIESEC Denizli - Canlı GViz Tüketici & SWR Önbellek Motoru
 * Dosya: js/storage.js
 */

import { CONFIG } from './config.js';
import { competitionRanks, departmentLabel, publicationDate, seasonInfo, currentSeasonCode, SEASON_MONTHS } from './ranking.js';

const CACHE_KEY_RNR = 'aiesec_dnz_rnr_v9';
const CACHE_KEY_ALLTIME = 'aiesec_dnz_alltime_v7';
const CACHE_KEY_NTT_GLOBAL = 'aiesec_dnz_ntt_global_v6';
const CACHE_KEY_NTT_NATIONAL = 'aiesec_dnz_ntt_national_v1';

const inFlight = new Map();
const lastValid = new Map();
const lastMetadata = new Map();
async function loadDataset(key, producer, callback, onStatus) {
  const report = (state, details) => {
    onStatus?.(state, details);
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aiesec:data-status', { detail: { key, state, ...details } }));
    }
  };
  if (inFlight.has(key)) {
    const outcome = await inFlight.get(key);
    if (outcome?.data) callback?.(outcome.data);
    if (outcome) report(outcome.state, outcome.details);
    return;
  }
  let cached = lastValid.get(key) || null;
  if (!cached) {
    try { cached = JSON.parse(localStorage.getItem(key) || 'null'); } catch (error) { /* Ignore unavailable cache. */ }
  }
  let metadata = lastMetadata.get(key) || null;
  if (!metadata) {
    try { metadata = JSON.parse(localStorage.getItem(key + '_meta') || 'null'); } catch { /* Optional timestamp. */ }
  }
  const cachedDetails = { hasData: !!cached, hasCache: !!cached, savedAt: metadata?.savedAt || null, partial: !!metadata?.partial };
  if (cached) callback?.(cached);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    report('offline', cachedDetails);
    return { data: cached, state: 'offline', details: cachedDetails };
  }
  report('loading', cachedDetails);
  const request = (async () => {
    try {
      const result = await producer(cached);
      callback?.(result.data);
      lastValid.set(key, result.data);
      // A partial refresh must not claim that retained tables were freshly checked.
      const newMetadata = { savedAt: result.partial ? metadata?.savedAt || null : Date.now(), partial: !!result.partial };
      lastMetadata.set(key, newMetadata);
      try {
        localStorage.setItem(key, JSON.stringify(result.data));
        localStorage.setItem(key + '_meta', JSON.stringify(newMetadata));
      } catch (error) { /* Storage is optional. */ }
      const state = result.partial ? 'partial' : result.empty ? 'empty' : 'success';
      const details = { hasData: true, hasCache: !!cached, ...newMetadata };
      report(state, details);
      return { data: result.data, state, details };
    } catch (error) {
      console.warn('[Veri yenilenemedi]', error.message);
      const state = typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error';
      report(state, cachedDetails);
      return { data: cached, state, details: cachedDetails };
    } finally { inFlight.delete(key); }
  })();
  inFlight.set(key, request);
  return request;
}


/**
 * Belirtilen sekmeden ve aralıktan GViz protokolüyle veri çeker
 */
export async function fetchGvizSheet(tabName, rangeA1 = '') {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  let url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}`;
  if (rangeA1) {
    url += `&range=${encodeURIComponent(rangeA1)}`;
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status} (${tabName})`);

    const text = await response.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
    if (!match || !match[1]) throw new Error(`Geçersiz format (${tabName})`);

    const json = JSON.parse(match[1]);
    if (json.status === 'error') throw new Error(json.errors?.[0]?.message || `Hata (${tabName})`);

    return parseGvizTable(json.table);
  } catch (err) {
    console.error(`[GViz Hatası - ${tabName}]:`, err.message);
    return null;
  }
}

/**
 * GViz tablosunu temiz nesne dizisine dönüştürür ve sütun sırasını korur
 */
function parseGvizTable(table) {
  if (!table || !table.rows || table.rows.length === 0) return [];
  const headers = table.cols.map((c, i) => (c && c.label && c.label.trim() !== '') ? c.label.trim() : `col_${i}`);
  const result = [];

  table.rows.forEach(row => {
    if (!row || !row.c) return;
    const rowObj = {};
    let hasData = false;

    row.c.forEach((cell, idx) => {
      const val = cell ? (cell.v !== undefined ? cell.v : cell.f) : null;
      const key = headers[idx] || `col_${idx}`;
      rowObj[key] = val;
      rowObj[`col_${idx}`] = val;
      if (val !== null && val !== '') hasData = true;
    });

    if (hasData) {
      rowObj._colHeaders = headers;
      result.push(rowObj);
    }
  });

  return result;
}

/**
 * 2 Milyonluk Tarih Hatasını Engelleyen ve Sayıları Güvenle Ayrıştıran Filtre
 */
export const cleanPoints = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  const str = String(val).trim();

  // GViz Date(...) formatı veya 07.09.2026 gibi zaman damgalarını kesinlikle sıfırla!
  if (str.startsWith('Date(') || /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(str)) {
    return 0;
  }

  // Noktaları kaldır, tüm virgülleri noktaya çevir, sayı dışı karakterleri temizle
  const sanitized = str.replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '');
  const num = parseFloat(sanitized);
  return isNaN(num) ? 0 : num;
};

export function parseSeasonCatalog(rows, now = new Date()) {
  const currentCode = currentSeasonCode(now);
  const seen = new Set();
  const seasons = [];
  for (const row of rows || []) {
    const code = String(row.SEASON ?? row.col_0 ?? '').trim();
    if (code === 'SEASON') continue;
    const info = seasonInfo(code);
    const status = String(row.STATUS ?? row.col_4 ?? '').trim();
    if (!info || !['CURRENT', 'ARCHIVED'].includes(status)) throw new Error('Dönem listesi geçersiz.');
    if (seen.has(code)) throw new Error('Dönem listesinde tekrar var.');
    seen.add(code);
    const publicSheet = String(row.PUBLIC_SHEET ?? row.col_3 ?? '').trim();
    const expected = status === 'CURRENT' ? CONFIG.TABS.RNR_ALLTIME : `AllTime_${code}_Public`;
    if (publicSheet !== expected) throw new Error('Dönem yayın sekmesi geçersiz.');
    if (status === 'CURRENT' && code !== currentCode) continue;
    if (status === 'ARCHIVED' && info.year >= seasonInfo(currentCode).year) continue;
    seasons.push({ ...info, status, publicSheet, registered: true,
      publishedAt: publicationDate(row.PUBLISHED_AT ?? row.col_5), version: Number(row.VERSION ?? row.col_6) || 0 });
  }
  if (!seasons.some(item => item.code === currentCode)) seasons.push({ ...seasonInfo(currentCode),
    status: 'CURRENT', publicSheet: CONFIG.TABS.RNR_ALLTIME, registered: false, publishedAt: null, version: 0 });
  return { currentCode, seasons: seasons.sort((a, b) => b.year - a.year) };
}

export async function fetchSeasonCatalog(callback, onStatus) {
  return loadDataset('aiesec_dnz_seasons_v1', async () => {
    const rows = await fetchGvizSheet(CONFIG.TABS.SEASONS || 'SEASON_INDEX');
    if (rows === null) throw new Error('Dönem listesi alınamadı.');
    parseSeasonCatalog(rows); // Hatalı liste, geçerli önbelleğin üzerine yazılmaz.
    return { data: rows, empty: false };
  }, rows => callback?.(parseSeasonCatalog(rows)), (state, details) => {
    if (['error', 'offline'].includes(state) && !details.hasData) callback?.(parseSeasonCatalog([]));
    onStatus?.(state, details);
  });
}

function emptyAlltimePayload(season) {
  const archived = season.status === 'ARCHIVED';
  return { season: season.code, archived, defaultMonth: 'ŞUBAT', availableMonths: archived ? [...SEASON_MONTHS] : [],
    monthlyLeaderboards: archived ? Object.fromEntries(SEASON_MONTHS.map(month => [month, []])) : {},
    totalLeaderboard: [], allMembersRoster: [] };
}

export function parseArchivedAlltimeRows(rows, season) {
  const data = emptyAlltimePayload({ ...season, status: 'ARCHIVED' });
  for (const row of rows) {
    const code = String(row['DÖNEM'] ?? row.col_0 ?? '').trim();
    if (code === 'DÖNEM') continue;
    const month = String(row.AY ?? row.col_1 ?? '').trim().toLocaleUpperCase('tr-TR');
    const name = String(row['AD-SOYAD'] ?? row.col_3 ?? '').trim();
    const points = row.PUAN ?? row.col_5;
    if (code !== season.code || !SEASON_MONTHS.includes(month) || !name ||
      typeof points !== 'number' || !Number.isFinite(points) || points <= 0) throw new Error('Arşiv satırı geçersiz veya başka döneme ait.');
    const list = data.monthlyLeaderboards[month];
    if (list.length >= 10 || list.some(item => item.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))) {
      throw new Error('Arşivde aylık ilk 10 sınırı veya kişi tekilliği bozulmuş.');
    }
    list.push({ name, department: departmentLabel(row.DEPARTMAN ?? row.col_4), points,
      badges: String(row['ROZET KODLARI'] ?? row.col_6 ?? '') });
  }
  SEASON_MONTHS.forEach(month => { data.monthlyLeaderboards[month] = competitionRanks(data.monthlyLeaderboards[month]); });
  data.defaultMonth = [...SEASON_MONTHS].reverse().find(month => data.monthlyLeaderboards[month].length) || 'ŞUBAT';
  return data;
}

/**
 * 1. RnR Haftalık Liderlik & 7 Departman Verisi
 */
export async function fetchLeaderboardData(callback, onStatus) {
  return loadDataset(CACHE_KEY_RNR + '_' + currentSeasonCode(), async cached => {
    const [leadRows, deptRows, weekRows] = await Promise.all([
      fetchGvizSheet(CONFIG.TABS.RNR_WEEKLY, 'B4:D14'),
      fetchGvizSheet(CONFIG.TABS.RNR_WEEKLY, 'F4:H25'),
      fetchGvizSheet(CONFIG.TABS.RNR_WEEKLY, 'A2:A2')
    ]);

    if ([leadRows, deptRows, weekRows].some(rows => rows === null)) throw new Error('Haftalık sıralama bütünüyle alınamadı.');

    const currentWeek = (weekRows && weekRows[0])
      ? String(weekRows[0]['col_0'] || weekRows[0]['HAFTA'] || '').trim()
      : '';

    const token = currentWeek.match(/^(\d{1,2})\.(\d{2})$/);
    const weekNumber = token ? Number(token[1]) : Number(currentWeek);
    const isoYear = token ? 2000 + Number(token[2]) : (CONFIG.REPORTING_YEAR || 2026);
    const jan4 = new Date(Date.UTC(isoYear, 0, 4));
    const thursday = new Date(jan4);
    thursday.setUTCDate(4 - ((jan4.getUTCDay() + 6) % 7) + (weekNumber - 1) * 7 + 3);
    if (!currentWeek || currentSeasonCode(thursday) !== currentSeasonCode()) {
      return { data: { week: '', leaderboard: [], departmentTop3: {} }, empty: true };
    }
    const leaderboard = [];
    if (leadRows && leadRows.length > 0) {
      leadRows.forEach(r => {
        const name = r['AD-SOYAD'] || r['col_0'] || r['name'];
        const dept = r['DEPARTMAN'] || r['col_1'] || r['department'];
        const rawPoints = r['HAFTALIK PUAN'] ?? r['col_2'] ?? r['points'];

        if (name && String(name).trim() !== '' && !String(name).startsWith('#')) {
          const points = cleanPoints(rawPoints);
          const previous = leaderboard[leaderboard.length - 1];
          leaderboard.push({
            rank: previous && previous.points === points ? previous.rank : leaderboard.length + 1,
            name: String(name).trim(),
            department: departmentLabel(dept),
            points
          });
        }
      });
    }

    const departmentTop3 = {};
    if (deptRows && deptRows.length > 0) {
      deptRows.forEach(r => {
        const col0 = String(r['col_0'] || r['DEPARTMAN'] || Object.values(r)[0] || '').trim();
        const col1 = String(r['col_1'] || r['ŞAMPİYON'] || r['SAMPİYON'] || Object.values(r)[1] || '').trim();
        const col2 = r['col_2'] !== undefined ? r['col_2'] : (r['PUAN'] !== undefined ? r['PUAN'] : Object.values(r)[2]);

        if (!col0 || !col1) return;
        if (col0.toUpperCase().includes('DEPARTMAN') || col1.toUpperCase().includes('ŞAMPİYON')) return;

        const m = col0.match(/^([a-zA-Z&]+)\s*#?\s*(\d+)/);
        if (!m) return;

        const deptKey = m[1].toLowerCase();
        const rank = parseInt(m[2], 10);
        const name = col1.trim();
        const pts = cleanPoints(col2);

        if (!departmentTop3[deptKey]) departmentTop3[deptKey] = [];
        departmentTop3[deptKey].push({ rank, name, points: pts });
      });

      Object.keys(departmentTop3).forEach(k => {
        departmentTop3[k].sort((a, b) => a.rank - b.rank);
      });
    }

    const payload = {
      week: currentWeek,
      leaderboard: competitionRanks(leaderboard).slice(0, 10),
      departmentTop3: departmentTop3
    };

    return { data: payload, empty: leaderboard.length === 0 };
  }, callback, onStatus);
}

/**
 * 2. AllTime Dinamik Aylık Snapshot & Çoklu Ay Veri Havuzu Motoru
 */
export async function fetchAlltimeData(callback, onStatus, selectedSeason = null) {
  const season = selectedSeason || { ...seasonInfo(currentSeasonCode()), publicSheet: CONFIG.TABS.RNR_ALLTIME,
    status: 'CURRENT', registered: false };
  if (!seasonInfo(season.code)) throw new Error('Geçersiz dönem.');
  const key = CACHE_KEY_ALLTIME + '_' + season.code + '_' + season.publicSheet;
  return loadDataset(key, async cached => {
    if (season.status === 'CURRENT' && !season.registered && season.code !== (CONFIG.INITIAL_SEASON || '26.27')) {
      return { data: emptyAlltimePayload(season), empty: true };
    }
    const rawRows = await fetchGvizSheet(season.publicSheet);
    if (season.status === 'ARCHIVED') {
      if (rawRows === null) throw new Error('Seçilen dönem arşivi alınamadı.');
      const data = parseArchivedAlltimeRows(rawRows, season);
      return { data, empty: !data.availableMonths.some(month => data.monthlyLeaderboards[month].length) };
    }
    
    if (rawRows === null) throw new Error('Aylık sıralama alınamadı.');
    if (rawRows.length === 0) {
      const emptyPayload = emptyAlltimePayload(season);
      return { data: emptyPayload, empty: true };
    }

    const headers = rawRows[0]._colHeaders || Object.keys(rawRows[0]).filter(k => !k.startsWith('col_') && !k.startsWith('_'));
    const seasonHeading = headers.find(key => key.trim().toLocaleUpperCase('tr-TR') === 'DÖNEM');
    // Önceki yılın hâlâ yayında olan geniş tablosu yeni dönem gibi gösterilemez.
    if (!seasonHeading && season.code !== (CONFIG.INITIAL_SEASON || '26.27')) {
      return { data: emptyAlltimePayload(season), empty: true };
    }
    if (seasonHeading && rawRows.some(row => row[seasonHeading] !== season.code)) {
      throw new Error('AllTime yayını seçilen döneme ait değil.');
    }

    let deptIndex = -1;
    let totalIndex = -1;
    let nameKey = 'col_1';
    let deptKey = 'col_2';
    let totalKey = 'col_5';
    let badgesKey = '';

    headers.forEach((key, idx) => {
      const upper = key.toUpperCase().trim();
      if (upper.includes('AD-SOYAD') || upper.includes('AD SOYAD')) nameKey = key;
      if (upper.includes('DEPARTMAN')) { deptKey = key; deptIndex = idx; }
      if (upper === 'TOTAL' || upper.includes('TOTAL')) { totalKey = key; if (totalIndex === -1) totalIndex = idx; }
      if (upper === 'ROZET KODLARI' || upper === 'ROZET KODU') badgesKey = key;
    });

    // ROZET KODLARI bulunamadıysa ROZETLER kolonuna bak
    if (!badgesKey) {
      headers.forEach(key => {
        const upper = key.toUpperCase().trim();
        if (upper.includes('ROZET')) badgesKey = key;
      });
    }

    // Yalnızca DEPARTMAN ile TOTAL arasındaki gerçek aylar taranır
    const sheetMonthCols = [];
    if (deptIndex !== -1 && totalIndex !== -1 && totalIndex > deptIndex + 1) {
      for (let i = deptIndex + 1; i < totalIndex; i++) {
        const colTitle = headers[i].trim();
        if (colTitle && !colTitle.startsWith('col_')) {
          sheetMonthCols.push(colTitle);
        }
      }
    }

    const allMembers = [];
    rawRows.forEach(r => {
      const name = String(r[nameKey] || r['col_1'] || '').trim();
      const dept = departmentLabel(r[deptKey] || r['col_2']);
      if (!name || name.toUpperCase() === 'AD-SOYAD' || name.startsWith('#')) return;

      const memberMonthScores = {};
      sheetMonthCols.forEach(mCol => {
        memberMonthScores[mCol.toUpperCase()] = cleanPoints(r[mCol]);
      });

      const totalScore = cleanPoints(r[totalKey] || r['col_5']);
      
      // Hem kod kolonunu hem de emoji kolonunu yedekli kontrol et
      const badgesRaw = String(
        r[badgesKey] || 
        r['ROZET KODLARI'] || 
        r['ROZETLER'] || 
        r['col_7'] || 
        r['col_8'] || 
        ''
      ).trim();

      allMembers.push({
        name: name,
        department: dept,
        monthlyScores: memberMonthScores,
        totalPoints: totalScore,
        badges: badgesRaw
      });
    });

    const monthlyLeaderboards = {};
    sheetMonthCols.forEach(mCol => {
      const mUpper = mCol.toUpperCase();
      const sorted = [...allMembers].sort((a, b) => (b.monthlyScores[mUpper] || 0) - (a.monthlyScores[mUpper] || 0));
      monthlyLeaderboards[mUpper] = competitionRanks(sorted.map(u => ({
        name: u.name,
        department: u.department,
        points: u.monthlyScores[mUpper] || 0,
        totalPoints: u.totalPoints,
        badges: u.badges
      })));
    });

    const sortedByTotal = [...allMembers].sort((a, b) => b.totalPoints - a.totalPoints);
    const totalLeaderboard = competitionRanks(sortedByTotal.map(u => ({
      name: u.name,
      department: u.department,
      points: u.totalPoints,
      totalPoints: u.totalPoints,
      badges: u.badges
    })));

    const defaultMonth = sheetMonthCols.at(-1)?.toLocaleUpperCase('tr-TR') || 'ŞUBAT';

    const payload = {
      season: season.code, archived: false,
      defaultMonth: defaultMonth,
      availableMonths: sheetMonthCols.map(m => m.toUpperCase()),
      monthlyLeaderboards: monthlyLeaderboards,
      totalLeaderboard: totalLeaderboard,
      allMembersRoster: totalLeaderboard
    };

    return { data: payload, empty: allMembers.length === 0 };
  }, callback, onStatus);
}

/**
 * 3. NTT Küresel Verilerini Çeken Motor
 */
export async function fetchNttGlobalData(callback, onStatus) {
  return loadDataset(CACHE_KEY_NTT_GLOBAL, async cached => {
    const rows = await fetchGvizSheet(CONFIG.TABS.NTT_GLOBAL);
    if (rows === null) throw new Error('Küresel şube sıralaması alınamadı.');

    const stages = ['approved', 'realized', 'completed'];
    const products = ['TOTAL', 'IGV', 'OGV', 'IGTe', 'OGTe', 'IGTa', 'OGTa'];

    const structured = {};
    stages.forEach(st => {
      structured[st] = {};
      products.forEach(p => { structured[st][p] = { items: [], denizli: null }; });
    });

    rows.forEach(r => {
      const stageRaw = String(r['Stage'] || r['col_0'] || '').trim().toLowerCase();
      const prodRaw = String(r['Product'] || r['col_1'] || '').trim();
      const rankRaw = parseInt(r['Rank'] || r['col_2'], 10);
      const lcRaw = String(r['Local_Committee'] || r['col_3'] || '').trim();
      const valRaw = cleanPoints(r['Value'] || r['col_4']);

      if (!structured[stageRaw]) return;
      const matchedProd = products.find(p => p.toUpperCase() === prodRaw.toUpperCase());
      if (!matchedProd) return;

      if (!isNaN(rankRaw) && lcRaw !== '') {
        const itemObj = { rank: rankRaw, lc: lcRaw, val: valRaw };
        structured[stageRaw][matchedProd].items.push(itemObj);
        if (lcRaw.toUpperCase().includes('DENIZLI')) {
          structured[stageRaw][matchedProd].denizli = itemObj;
        }
      }
    });

    stages.forEach(st => {
      products.forEach(p => {
        structured[st][p].items.sort((a, b) => a.rank - b.rank);
      });
    });

    return { data: structured, empty: rows.length === 0 };
  }, callback, onStatus);
}

/**
 * NTT ulusal funnel sekmelerindeki ortak kolon düzenini ekran matrisine çevirir.
 */
export function parseNationalFunnelRows(rows) {
  const matrix = {};
  const stages = ['Applied', 'Accepted', 'Approved', 'Realized', 'Finished', 'Completed'];

  (rows || []).forEach(row => {
    const lc = String(readCell(row, 'LC', 0) || '').trim().toUpperCase();
    if (!lc || lc === 'LC') return;

    matrix[lc] = {};
    stages.forEach((stage, index) => {
      matrix[lc][stage] = cleanPoints(readCell(row, stage, index + 1));
    });
  });

  return matrix;
}

/**
 * B2B_Clean sekmesini mevcut B2B kartlarının beklediği veri modeline çevirir.
 */
export function parseB2bRows(rows) {
  const result = {
    total: { new: [], re: [], open: [] },
    gta: { new: [], re: [], open: [] },
    gte: { new: [], re: [], open: [] },
    ewa: []
  };

  (rows || []).forEach(row => {
    const lc = String(readCell(row, 'LC', 0) || '').trim().toUpperCase();
    if (!lc || lc === 'LC') return;

    result.total.new.push({ lc, val: cleanPoints(readCell(row, 'Total_New', 2)) });
    result.total.re.push({ lc, val: cleanPoints(readCell(row, 'Total_Re', 3)) });
    result.total.open.push({ lc, val: cleanPoints(readCell(row, 'Total_Open', 1)) });

    result.gta.new.push({ lc, val: cleanPoints(readCell(row, 'GTa_New', 11)) });
    result.gta.re.push({ lc, val: cleanPoints(readCell(row, 'GTa_Re', 12)) });
    result.gta.open.push({ lc, val: cleanPoints(readCell(row, 'GTa_Open', 5)) });

    result.gte.new.push({ lc, val: cleanPoints(readCell(row, 'GTe_New', 13)) });
    result.gte.re.push({ lc, val: cleanPoints(readCell(row, 'GTe_Re', 14)) });
    result.gte.open.push({ lc, val: cleanPoints(readCell(row, 'GTe_Open', 6)) });

    result.ewa.push({
      lc,
      name: lc,
      income: cleanPoints(readCell(row, 'EwA_Income_TL', 8))
    });
  });

  result.ewa.sort((a, b) => b.income - a.income);
  result.ewa = result.ewa.map((item, index) => ({ ...item, rank: index + 1 }));
  return result;
}

/**
 * MKT_Clean sekmesini dört ürün kartının beklediği veri modeline çevirir.
 */
export function parseMktRows(rows) {
  return (rows || []).reduce((result, row) => {
    const lc = String(readCell(row, 'LC', 0) || '').trim().toUpperCase();
    if (!lc || lc === 'LC') return result;

    result.push({
      lc,
      gv_goal: cleanPoints(readCell(row, 'GV_Goal', 1)),
      gv_ach: cleanPoints(readCell(row, 'GV_Ach', 2)),
      gt_goal: cleanPoints(readCell(row, 'GT_Goal', 3)),
      gt_ach: cleanPoints(readCell(row, 'GT_Ach', 4)),
      gte_goal: cleanPoints(readCell(row, 'GTe_Goal', 5)),
      gte_ach: cleanPoints(readCell(row, 'GTe_Ach', 6)),
      ov_goal: cleanPoints(readCell(row, 'Overall_Goal', 7)),
      ov_ach: cleanPoints(readCell(row, 'Overall_Ach', 8))
    });
    return result;
  }, []);
}

function readCell(row, label, index) {
  if (!row) return null;
  if (Object.prototype.hasOwnProperty.call(row, label)) return row[label];
  return row[`col_${index}`];
}

/**
 * 4. NTT Türkiye departman verilerini yedi ayrı GViz sekmesinden canlı çeker.
 * oGV sekmesi henüz olmadığı için bilinçli olarak bu akışın dışında tutulur.
 */
export async function fetchNationalNttData(callback, onStatus) {
  return loadDataset(CACHE_KEY_NTT_NATIONAL, async cached => {
    const [igvRows, igtaRows, igteRows, ogtaRows, ogteRows, b2bRows, mktRows] = await Promise.all([
      fetchGvizSheet(CONFIG.TABS.IGV),
      fetchGvizSheet(CONFIG.TABS.IGTA),
      fetchGvizSheet(CONFIG.TABS.IGTE),
      fetchGvizSheet(CONFIG.TABS.OGTA),
      fetchGvizSheet(CONFIG.TABS.OGTE),
      fetchGvizSheet(CONFIG.TABS.B2B),
      fetchGvizSheet(CONFIG.TABS.MKT)
    ]);

    const freshSources = [igvRows, igtaRows, igteRows, ogtaRows, ogteRows, b2bRows, mktRows];
    if (freshSources.every(rows => rows === null)) throw new Error('Türkiye şube tabloları alınamadı.');

    const payload = {
      funnels: {
        ...(cached?.funnels || {}),
        ...(igvRows !== null ? { igv: parseNationalFunnelRows(igvRows) } : {}),
        ...(igtaRows !== null ? { igta: parseNationalFunnelRows(igtaRows) } : {}),
        ...(igteRows !== null ? { igte: parseNationalFunnelRows(igteRows) } : {}),
        ...(ogtaRows !== null ? { ogta: parseNationalFunnelRows(ogtaRows) } : {}),
        ...(ogteRows !== null ? { ogte: parseNationalFunnelRows(ogteRows) } : {})
      },
      b2b: b2bRows !== null ? parseB2bRows(b2bRows) : (cached?.b2b || null),
      mkt: mktRows !== null ? parseMktRows(mktRows) : (cached?.mkt || null),
      updatedAt: Date.now()
    };

    return { data: payload, partial: freshSources.some(rows => rows === null), empty: freshSources.every(rows => rows?.length === 0) };
  }, callback, onStatus);
}


export function parsePublicationRows(rows = []) {
  return rows.reduce((result, row) => {
    const dataset = String(readCell(row, 'DATASET', 0) || '').trim();
    if (!['RNR_WEEKLY', 'ALLTIME', 'NTT_GLOBAL', 'NTT_NATIONAL'].includes(dataset)) return result;
    result[dataset] = {
      period: String(readCell(row, 'PERIOD', 2) || '').trim(),
      publishedAt: publicationDate(readCell(row, 'PUBLISHED_AT', 3)),
      status: String(readCell(row, 'STATUS', 4) || '').trim().toUpperCase()
    };
    return result;
  }, {});
}

export async function fetchPublicationInfo(callback) {
  return loadDataset('aiesec_dnz_publication_v1', async () => {
    const rows = await fetchGvizSheet(CONFIG.TABS.PUBLICATION, 'A1:E5');
    if (rows === null) throw new Error('Yayın tarihleri alınamadı.');
    return { data: parsePublicationRows(rows), empty: rows.length === 0 };
  }, callback);
}
