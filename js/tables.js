import { CONFIG } from './config.js';
import { competitionRanks, podiumGroups, departmentLabel, escapeHtml, seasonInfo, currentSeasonCode, SEASON_MONTHS } from './ranking.js';

// ========================================================
// 1. ROZET SÖZLÜĞÜ VE ÇİFT KATMANLI TOKENIZER MOTORU
// ========================================================
const BADGE_MAP = {
  WG1: { icon: '👑', name: 'Haftalık genel 1.' },
  WG2: { icon: '🥈', name: 'Haftalık genel 2.' },
  WG3: { icon: '🥉', name: 'Haftalık genel 3.' },
  DP1: { icon: '🥇', name: 'Haftalık departman 1.' },
  DP2: { icon: '🥈', name: 'Haftalık departman 2.' },
  DP3: { icon: '🥉', name: 'Haftalık departman 3.' },
  MG1: { icon: '🏆', name: 'Aylık genel 1.' },
  MG2: { icon: '🥈', name: 'Aylık genel 2.' },
  MG3: { icon: '🥉', name: 'Aylık genel 3.' },
  QT: { icon: '⭐', name: 'Kota başarımı (haftada 500 üzeri puan)' },
  ST: { icon: '🔥', name: 'Aktif seri (hafta sayısı)' },
  a: { icon: '👑', name: 'Genel Şampiyon (Haftanın MVP\'si)' },
  b: { icon: '🥇', name: 'Departman 1.\'si' },
  c: { icon: '🥈', name: '2.\'lik Başarısı' },
  d: { icon: '🥉', name: '3.\'lük Başarısı' },
  e: { icon: '⭐', name: 'Kota Başarımı (Puan Barajı)' },
  f: { icon: '🔥', name: 'Seri (Streak)' }
};

const EMOJI_TO_CODE = {
  '👑': 'a',
  '🥇': 'b',
  '🥈': 'c',
  '🥉': 'd',
  '⭐': 'e',
  '🔥': 'f'
};

/**
 * Hem harf kodlarını ("3a, 4b, 4e") hem de emoji metinlerini ("👑x3 🥇x4 ⭐x4") çözen zırhlı ayrıştırıcı
 */
export function parseBadges(input) {
  if (!input) return [];
  const s = String(input).trim();
  if (!s || s === '0' || s === '-') return [];

  const parsed = [];
  if (/\b[A-Z0-9]+:\d+/i.test(s)) {
    for (const match of s.matchAll(/\b(WG[1-3]|DP[1-3]|MG[1-3]|QT|ST):(\d+)\b/gi)) {
      const code = match[1].toUpperCase(), count = Number(match[2]);
      if (Number.isSafeInteger(count) && count > 0) parsed.push({ code, count, ...BADGE_MAP[code] });
    }
    return parsed;
  }

  // 1. E-Tablo doğrudan emoji formatında gönderdiyse (Örn: "👑x3 🥇x4 ⭐x4" veya "👑 3 🥇 4")
  const emojiRegex = /([👑🥇🥈🥉⭐🔥])\s*(?:[xX*])?\s*(\d+)?/g;
  let emojiMatch;
  let foundEmoji = false;

  while ((emojiMatch = emojiRegex.exec(s)) !== null) {
    foundEmoji = true;
    const emoji = emojiMatch[1];
    const count = emojiMatch[2] ? parseInt(emojiMatch[2], 10) : 1;
    const code = EMOJI_TO_CODE[emoji];
    if (code && BADGE_MAP[code]) {
      parsed.push({
        code,
        icon: emoji,
        name: BADGE_MAP[code].name,
        count
      });
    }
  }

  if (foundEmoji && parsed.length > 0) {
    return parsed;
  }

  // 2. Harf kodu formatında geldiyse (Örn: "3a, 4b, 4e" veya "1a 4b")
  const letterRegex = /(\d+)?\s*([a-fA-F])/g;
  let letterMatch;
  while ((letterMatch = letterRegex.exec(s)) !== null) {
    const count = letterMatch[1] ? parseInt(letterMatch[1], 10) : 1;
    const code = letterMatch[2].toLowerCase();
    if (BADGE_MAP[code]) {
      parsed.push({
        code,
        icon: BADGE_MAP[code].icon,
        name: BADGE_MAP[code].name,
        count
      });
    }
  }

  return parsed;
}

export function getDepartmentColor(deptName) {
  if (!deptName) return '#0CB9C1';
  const clean = deptName.toLowerCase().trim();
  if (clean.includes('bda')) return '#0CB9C1';
  if (clean.includes('bde')) return '#F48924';
  if (clean.includes('igt')) return '#0CB9C1';
  if (clean.includes('igv') || clean.includes('ocvp') || clean.includes('eb')) return '#F85A40';
  if (clean.includes('mkt')) return '#ffc845';
  if (clean.includes('ogx')) return '#7552CC';
  return '#0CB9C1';
}

// ========================================================
// 2. RnR HAFTALIK SIRALAMA & 7 DEPARTMAN
// ========================================================
export function renderGeneralTable(leaderboard, week) {
  const tbody = document.getElementById('generalTableBody');
  const badge = document.getElementById('tableWeekBadge');
  if (!tbody) return;

  if (badge) badge.innerText = `HAFTA ${week || '-'}`;
  tbody.innerHTML = "";

  if (!leaderboard || leaderboard.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="status-cell">Bu hafta için sıralama verisi bulunamadı.</td></tr>`;
    return;
  }

  competitionRanks(leaderboard).forEach(row => {
    let rankClass = "";
    if (row.rank === 1) rankClass = "rank-top1";
    else if (row.rank === 2) rankClass = "rank-top2";
    else if (row.rank === 3) rankClass = "rank-top3";

    const formattedPoints = (Number(row.points) || 0).toLocaleString('tr-TR');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-rank ${rankClass}">#${row.rank}</td>
      <td class="col-name">${escapeHtml(row.name)}</td>
      <td class="col-dept">${escapeHtml(departmentLabel(row.department))}</td>
      <td>${formattedPoints}</td>
    `;
    tbody.appendChild(tr);
  });
}

export function renderDepartmentTables(departmentTop3, week) {
  const container = document.getElementById('departmentsGrid');
  if (!container) return;
  container.innerHTML = "";

  const deptKeys = ['bda', 'bde', 'igt', 'igv', 'mkt', 'ogx', 'ocvp'];

  deptKeys.forEach(key => {
    const meta = CONFIG.DEPARTMENTS[key] || { name: key.toUpperCase(), title: `${key.toUpperCase()} TOP 3`, color: '#0CB9C1' };
    const rawList = (departmentTop3 && departmentTop3[key]) ? departmentTop3[key] : [];
    if (key === 'ocvp' && rawList.length === 0) return;
    const list = competitionRanks(rawList).slice(0, 3)
      .map((row, index) => row.points > 0 ? row : { ...row, rank: index + 1 });

    let rowsHtml = "";
    if (list.length === 0) {
      rowsHtml = `<tr><td colspan="3" class="status-cell">Bu hafta veri yok.</td></tr>`;
    } else {
      list.forEach(row => {
        let rankClass = "";
        if (row.rank === 1) rankClass = "rank-top1";
        else if (row.rank === 2) rankClass = "rank-top2";
        else if (row.rank === 3) rankClass = "rank-top3";

        const formattedPoints = (Number(row.points) || 0).toLocaleString('tr-TR');

        rowsHtml += `
          <tr>
            <td class="col-rank ${rankClass}">#${row.rank}</td>
            <td class="col-name">${escapeHtml(row.name)}</td>
            <td>${formattedPoints}</td>
          </tr>
        `;
      });
    }

    const panel = document.createElement('div');
    panel.className = 'dept-panel';
    panel.style.setProperty('--panel-accent', meta.color);

    panel.innerHTML = `
      <div class="dept-panel-header">
        <span class="panel-title ${key === 'igt' ? 'case-preserve' : ''}">${meta.title}</span>
        <span class="panel-badge" style="background: ${meta.color}; color: #000;">H-${week || '-'}</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 36px; text-align: center;">#</th>
            <th>AD - SOYAD</th>
            <th style="width: 70px; text-align: right;">PUAN</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    container.appendChild(panel);
  });
}

// ========================================================
// 3. ALLTIME DİNAMİK AYLIK TABLO & 12 AYLIK ARŞİV
// ========================================================
export function renderCumulativeTable(list, activeMonthLabel = 'AY') {
  const tbody = document.getElementById('cumulativeTableBody');
  const badge = document.getElementById('alltimeTableMonthBadge');
  const pointsHeader = document.getElementById('alltimePointsHeader');
  if (!tbody) return;

  if (badge) badge.innerText = `${activeMonthLabel} TOP 10`;
  if (pointsHeader) pointsHeader.innerText = `${activeMonthLabel} PUANI`;
  tbody.innerHTML = "";

  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="status-cell">Bu ay için henüz yayımlanmış sıralama bulunmuyor.</td></tr>`;
    return;
  }

  competitionRanks(list).forEach(row => {
    let rankClass = "";
    if (row.rank === 1) rankClass = "rank-top1";
    else if (row.rank === 2) rankClass = "rank-top2";
    else if (row.rank === 3) rankClass = "rank-top3";

    const parsed = parseBadges(row.badges);
    const badgesHtml = parsed.length > 0 
      ? parsed.map(b => `<span class="badge-tag" data-tooltip="${b.count}${b.code === 'ST' ? ' hafta' : 'x'} ${b.name}" title="${b.count}${b.code === 'ST' ? ' hafta' : 'x'} ${b.name}"><span class="badge-icon">${b.icon}</span>${b.count > 1 ? `<sub class="badge-sub">${b.count}</sub>` : ''}</span>`).join(" ")
      : `<span class="no-badges-label">-</span>`;

    const formattedPoints = (Number(row.points) || 0).toLocaleString('tr-TR');
    const label = departmentLabel(row.department);
    const cleanDept = (label || 'all').toLowerCase().replace(/[^a-z]/g, '');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-rank ${rankClass}">#${row.rank}</td>
      <td class="col-name">${escapeHtml(row.name)}</td>
      <td class="col-dept"><span class="roster-dept tag-${cleanDept}">${escapeHtml(label)}</span></td>
      <td class="col-badges">${badgesHtml}</td>
      <td class="col-points">${formattedPoints}</td>
    `;
    tbody.appendChild(tr);
  });
}

export function renderMonthsArchive(monthlyLeaderboards = {}, onMonthClick = null, currentActiveMonth = 'ŞUBAT', seasonCode = currentSeasonCode()) {
  const container = document.getElementById('monthsArchiveGrid');
  if (!container) return;
  // Clicking a month and the periodic refresh replace these nodes; keep keyboard focus.
  const focusedMonth = container.contains(document.activeElement)
    ? document.activeElement.getAttribute('data-month') : null;
  container.innerHTML = "";

  const termMonths = SEASON_MONTHS;
  const season = seasonInfo(seasonCode) || seasonInfo(currentSeasonCode());

  termMonths.forEach(mName => {
    const calendarMonth = ['OCAK', ...termMonths.slice(0, 11)].indexOf(mName);
    const monthStart = new Date(mName === 'OCAK' ? season.year + 1 : season.year, calendarMonth, 1);
    const monthEnd = new Date(monthStart.getFullYear(), calendarMonth + 1, 1);
    const now = new Date();
    const status = now >= monthEnd ? 'Tamamlandı' : now >= monthStart ? 'Canlı / Devam Ediyor' : 'Planlandı';
    const list = monthlyLeaderboards[mName];
    const hasColumn = !!list;
    const hasAnyScore = hasColumn && list.some(u => (Number(u.points) || 0) > 0);
    const isActive = mName === currentActiveMonth;

    const card = document.createElement('button');
    card.type = 'button';
    card.disabled = !hasColumn || typeof onMonthClick !== 'function';
    card.setAttribute('data-month', mName);
    card.setAttribute('aria-label', `${mName} aylık sıralaması${hasColumn ? '' : ' — veri yok'}`);
    card.setAttribute('aria-pressed', String(isActive));
    card.className = `month-card ${hasColumn ? 'clickable' : 'locked'} ${isActive ? 'active-month' : ''}`;

    if (hasColumn && hasAnyScore) {
      const groups = podiumGroups(list);
      const top1Name = escapeHtml(groups[1].map(person => person.name).join(' / ') || '—');
      const top2Name = escapeHtml(groups[2].map(person => person.name).join(' / ') || '—');
      const top3Name = escapeHtml(groups[3].map(person => person.name).join(' / ') || '—');

      card.innerHTML = `
        <span class="month-header">
          <span class="month-name">${mName}</span>
          <span class="month-status" style="color: var(--ink-ffc845); font-weight: 800;">${status}</span>
        </span>
        <span class="mini-pedestal-row">
          <span class="mini-step step-2 ${groups[2].length ? '' : 'empty-place'}"><span class="mini-user-name" title="${top2Name}">${top2Name}</span><span class="mini-bar">2</span></span>
          <span class="mini-step step-1"><span class="mini-user-name" title="${top1Name}">${top1Name}</span><span class="mini-bar">1</span></span>
          <span class="mini-step step-3 ${groups[3].length ? '' : 'empty-place'}"><span class="mini-user-name" title="${top3Name}">${top3Name}</span><span class="mini-bar">3</span></span>
        </span>
      `;
    } else if (hasColumn && !hasAnyScore) {
      card.innerHTML = `
        <span class="month-header">
          <span class="month-name">${mName}</span>
          <span class="month-status" style="color: var(--ink-38bdf8); font-weight: 800;">${status}</span>
        </span>
        <span class="locked-notice">
          <span>⏳</span>
          <small>Yayımlanmış sonuç yok</small>
        </span>
      `;
    } else {
      card.innerHTML = `
        <span class="month-header">
          <span class="month-name">${mName}</span>
          <span class="month-status">Veri Yok</span>
        </span>
        <span class="locked-notice">
          <span>🔒</span>
          <small>Bekleniyor</small>
        </span>
      `;
    }

    if (hasColumn && typeof onMonthClick === 'function') {
      card.addEventListener('click', () => {
        onMonthClick(mName);
      });
    }

    container.appendChild(card);
    if (focusedMonth === mName && !card.disabled) card.focus({ preventScroll: true });
  });
}

export function renderMembersRoster(membersData) {
  const listContainer = document.getElementById('membersRosterList');
  if (!listContainer) return;
  listContainer.innerHTML = "";

  const members = (membersData && membersData.length > 0) ? [...membersData] : [];
  members.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  members.forEach(m => {
    const row = document.createElement('div');
    row.className = 'roster-row';
    row.setAttribute('data-name', m.name);
    const label = departmentLabel(m.department);
    row.setAttribute('data-dept', label.toLowerCase());

    const parsed = parseBadges(m.badges);
    const badgesHtml = parsed.length > 0 
      ? parsed.map(b => `<span class="badge-tag" data-tooltip="${b.count}${b.code === 'ST' ? ' hafta' : 'x'} ${b.name}" title="${b.count}${b.code === 'ST' ? ' hafta' : 'x'} ${b.name}"><span class="badge-icon">${b.icon}</span>${b.count > 1 ? `<sub class="badge-sub">${b.count}</sub>` : ''}</span>`).join(" ")
      : `<span class="no-badges-label">Henüz rozet yok</span>`;

    row.innerHTML = `
      <span class="roster-name">${escapeHtml(m.name)}</span>
      <span class="roster-dept tag-${(label || 'all').toLowerCase().replace(/[^a-z]/g, '')}">${escapeHtml(label || '-')}</span>
      <div class="roster-badges">${badgesHtml}</div>
    `;

    listContainer.appendChild(row);
  });
}

// ========================================================
// 4. NTT KÜRESEL ŞUBE LİGİ
// ========================================================
// Restore the active scroll region after live data replaces its result cards.
function rememberScrollFocus(container) {
  const active = document.activeElement;
  if (!active || !container?.contains(active)) return () => {};
  const key = active.getAttribute('data-scroll-key');
  const scrollTop = active.scrollTop;
  return () => {
    if (!key) return;
    const replacement = [...container.querySelectorAll('[data-scroll-key]')]
      .find(element => element.getAttribute('data-scroll-key') === key);
    if (replacement) {
      replacement.scrollTop = scrollTop;
      replacement.focus({ preventScroll: true });
    }
  };
}

export function renderNttCards(category = 'approved', globalData = null) {
  const container = document.getElementById('nttCardsGrid');
  if (!container) return;
  const restoreFocus = rememberScrollFocus(container);
  container.innerHTML = "";

  const catKey = category.toLowerCase();
  const categoryData = (globalData && globalData[catKey]) ? globalData[catKey] : null;
  const productKeys = ['TOTAL', 'IGV', 'OGV', 'IGTe', 'OGTe', 'IGTa', 'OGTa'];

  productKeys.forEach(prodKey => {
    const prodMeta = CONFIG.NTT_PRODUCTS[prodKey] || { title: `${prodKey} Rank`, color: '#2563EB' };
    const pData = (categoryData && categoryData[prodKey]) ? categoryData[prodKey] : { items: [], denizli: null };

    let rowsHtml = "";
    if (!pData.items || pData.items.length === 0) {
      rowsHtml = `<div class="ntt-row" style="grid-template-columns: 1fr; text-align: center; color: var(--text-muted); padding: 36px 12px;">Bu aşamada veri kaydı bulunmuyor.</div>`;
    } else {
      pData.items.forEach(item => {
        const isDenizli = item.lc.toUpperCase().includes('DENIZLI');
        const formattedVal = (Number(item.val) || 0).toLocaleString('tr-TR');

        rowsHtml += `
          <div class="ntt-row ${isDenizli ? 'highlight-denizli' : ''}">
            <span class="ntt-col-rank">#${item.rank}</span>
            <span class="ntt-col-lc" title="${item.lc}">${item.lc}</span>
            <span class="ntt-col-val">${formattedVal}</span>
          </div>
        `;
      });
    }

    let footerHtml = "";
    if (pData.denizli) {
      const formattedDenizliVal = (Number(pData.denizli.val) || 0).toLocaleString('tr-TR');
      footerHtml = `
        <div class="ntt-card-footer has-denizli">
          <span class="denizli-standing-text">📍 #${pData.denizli.rank} - Denizli -</span>
          <span class="denizli-standing-val">${formattedDenizliVal}</span>
        </div>
      `;
    } else {
      footerHtml = `
        <div class="ntt-card-footer">
          <span class="nesanlisevgi-tag">#nesanlisevgi</span>
        </div>
      `;
    }

    const card = document.createElement('div');
    card.className = 'ntt-card';
    card.style.setProperty('--card-accent', prodMeta.color);

    card.innerHTML = `
      <div class="ntt-card-header">
        <span class="ntt-card-title">${prodKey} ${category.toUpperCase()} RANK</span>
        <span class="ntt-metric-badge">${category}</span>
      </div>
      <div class="ntt-sub-header">
        <span>Rank</span>
        <span>Local Committee</span>
        <span class="ntt-sub-val">${category === 'approved' ? 'Approvals' : category}</span>
      </div>
      <div class="ntt-list-body" tabindex="0" role="region" aria-label="${prodKey} ${category.toUpperCase()} sıralaması" data-scroll-key="global-${prodKey}">
        ${rowsHtml}
      </div>
      ${footerHtml}
    `;

    container.appendChild(card);
  });

  const summaryCard = document.createElement('div');
  summaryCard.className = 'ntt-card ntt-summary-card';
  summaryCard.style.setProperty('--card-accent', '#10B981');

  let summaryRowsHtml = "";
  productKeys.forEach(prodKey => {
    const pData = (categoryData && categoryData[prodKey]) ? categoryData[prodKey] : { items: [], denizli: null };

    if (pData.denizli) {
      const formattedVal = (Number(pData.denizli.val) || 0).toLocaleString('tr-TR');
      summaryRowsHtml += `
        <div class="ntt-summary-row" style="background: rgba(16, 185, 129, 0.12);">
          <span class="ntt-summary-prod">${prodKey}</span>
          <span class="ntt-summary-status has-rank">#${pData.denizli.rank} Denizli</span>
          <span class="ntt-summary-val">${formattedVal}</span>
        </div>
      `;
    } else {
      summaryRowsHtml += `
        <div class="ntt-summary-row">
          <span class="ntt-summary-prod">${prodKey}</span>
          <span class="ntt-summary-status no-rank">#nesanlisevgi</span>
          <span class="ntt-summary-val" style="color: var(--text-muted);">-</span>
        </div>
      `;
    }
  });

  summaryCard.innerHTML = `
    <div class="ntt-card-header ntt-summary-header">
      <span class="ntt-card-title">DENİZLİ GLOBAL STANDINGS</span>
      <span class="ntt-metric-badge" style="background: rgba(0,0,0,0.3); color: #fff;">${category.toUpperCase()}</span>
    </div>
    <div class="ntt-sub-header">
      <span>Kategori</span>
      <span style="text-align: center;">Şube Derecesi</span>
      <span class="ntt-sub-val">Hacim</span>
    </div>
    <div class="ntt-summary-rows-container">
      ${summaryRowsHtml}
    </div>
    <div class="ntt-summary-divider-bar">
      <span class="nesanlisevgi-tag">AIESEC DENİZLİ / #NESANLİSEVGİ</span>
    </div>
    <div class="photo-slot ntt-summary-photo-slot" data-slot="[FOTO-15]">
      <div class="slot-badge">[FOTO-15]</div>
    </div>
  `;

  container.appendChild(summaryCard);
  restoreFocus();
}

// ========================================================
// 5. NTT ULUSAL DEPARTMAN FUNNEL MOTORU
// ========================================================
const LC_FULL_NAMES = {
  DNZ: "Denizli", ANK: "Ankara", BRS: "Bursa", KOC: "Kocaeli",
  IST: "İstanbul", IAS: "İstanbul Asya", IWS: "İstanbul Batı",
  IZM: "İzmir", ADN: "Adana", ESK: "Eskişehir", ANT: "Antalya",
  GZN: "Gaziantep", TRB: "Trabzon", KUT: "Kütahya", SKY: "Sakarya",
  KON: "Konya", EMD: "Doğu Akdeniz", ISP: "Isparta"
};

export function renderFunnelSixGrid(containerId, matrixData, accentColor, emptyNotice = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const stages = [
    { key: "Applied",   label: "APPLIED" },
    { key: "Accepted",  label: "ACCEPTED" },
    { key: "Approved",  label: "APPROVED" },
    { key: "Realized",  label: "REALIZED" },
    { key: "Finished",  label: "FINISHED" },
    { key: "Completed", label: "COMPLETED" }
  ];

  if (emptyNotice || !matrixData || Object.keys(matrixData).length === 0) {
    stages.forEach(st => {
      const card = document.createElement("div");
      card.className = "funnel-card";
      card.style.setProperty("--card-accent", accentColor);
      card.innerHTML = `
        <div class="funnel-card-header">
          <span class="funnel-card-title">${st.label}</span>
          <span class="funnel-metric-badge">AŞAMA</span>
        </div>
        <div class="funnel-list-scroll" style="height: 180px; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.8rem;">
          ${emptyNotice ? 'Bu departman için henüz yayımlanmış veri yok.' : matrixData ? 'Bu aşamada veri bulunmuyor.' : 'Veriler yükleniyor…'}
        </div>
        <div class="funnel-card-footer">
          <span class="footer-dnz-badge">📍 Denizli: -</span>
          <span class="footer-dnz-val">-</span>
        </div>
      `;
      container.appendChild(card);
    });
    return;
  }

  stages.forEach(st => {
    const sortedList = Object.keys(matrixData).map(lc => ({
      lc: lc,
      val: Number(matrixData[lc][st.key]) || 0
    })).sort((a, b) => b.val - a.val);

    let dnzRank = "-";
    let dnzVal = 0;

    let rowsHtml = "";
    sortedList.forEach((item, index) => {
      const rank = index + 1;
      const isDnz = item.lc === "DNZ";
      if (isDnz) {
        dnzRank = `#${rank}`;
        dnzVal = item.val;
      }

      rowsHtml += `
        <div class="funnel-row ${isDnz ? 'highlight-dnz' : ''}">
          <span class="funnel-col-rank">#${rank}</span>
          <span class="funnel-col-lc" title="${LC_FULL_NAMES[item.lc] || item.lc}">
            ${item.lc} <small style="color: var(--text-muted); font-size: 0.65rem;">${LC_FULL_NAMES[item.lc] || ''}</small>
          </span>
          <span class="funnel-col-val">${item.val.toLocaleString('tr-TR')}</span>
        </div>
      `;
    });

    const card = document.createElement("div");
    card.className = "funnel-card";
    card.style.setProperty("--card-accent", accentColor);

    card.innerHTML = `
      <div class="funnel-card-header">
        <span class="funnel-card-title">${st.label}</span>
        <span class="funnel-metric-badge">${st.key}</span>
      </div>
      <div class="funnel-table-head">
        <span>Sıra</span>
        <span>Şube</span>
        <span style="text-align: right;">Sayı</span>
      </div>
      <div class="funnel-list-scroll" tabindex="0" role="region" aria-label="${containerId.slice(5)} ${st.label} sıralaması" data-scroll-key="${containerId}-${st.key}">
        ${rowsHtml}
      </div>
      <div class="funnel-card-footer">
        <span class="footer-dnz-badge">📍 Denizli: ${dnzRank}</span>
        <span class="footer-dnz-val">${dnzVal.toLocaleString('tr-TR')}</span>
      </div>
    `;

    container.appendChild(card);
  });
}

// ========================================================
// 6. B2B 4 KATMANLI RENDER MOTORU
// ========================================================
export function renderB2bTierGrid(containerId, tierData, accentColor = "#10B981") {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const subStages = [
    { key: "new", label: "NEW OPEN" },
    { key: "re", label: "RE OPEN" },
    { key: "open", label: "TOTAL OPEN" }
  ];

  subStages.forEach(sub => {
    const rawList = (tierData && tierData[sub.key]) ? tierData[sub.key] : [];
    const sortedList = [...rawList].sort((a, b) => (Number(b.val) || 0) - (Number(a.val) || 0));

    let dnzRank = "-";
    let dnzVal = 0;

    let rowsHtml = sortedList.length === 0
      ? `<div class="funnel-row" style="grid-template-columns: 1fr; text-align: center; color: var(--text-muted);">${tierData ? 'Bu aşamada veri bulunmuyor.' : 'Veriler yükleniyor…'}</div>`
      : "";
    sortedList.forEach((item, index) => {
      const rank = index + 1;
      const isDnz = item.lc === "DNZ";
      if (isDnz) {
        dnzRank = `#${rank}`;
        dnzVal = item.val;
      }

      rowsHtml += `
        <div class="funnel-row ${isDnz ? 'highlight-dnz' : ''}">
          <span class="funnel-col-rank">#${rank}</span>
          <span class="funnel-col-lc" title="${LC_FULL_NAMES[item.lc] || item.lc}">
            ${item.lc} <small style="color: var(--text-muted); font-size: 0.65rem;">${LC_FULL_NAMES[item.lc] || ''}</small>
          </span>
          <span class="funnel-col-val">${(Number(item.val) || 0).toLocaleString('tr-TR')}</span>
        </div>
      `;
    });

    const card = document.createElement("div");
    card.className = "funnel-card";
    card.style.setProperty("--card-accent", accentColor);

    card.innerHTML = `
      <div class="funnel-card-header" style="background: #10B981; color: #000;">
        <span class="funnel-card-title">${sub.label}</span>
        <span class="funnel-metric-badge" style="background: rgba(0,0,0,0.25); color: #fff;">OPPORTUNITY</span>
      </div>
      <div class="funnel-table-head">
        <span>Sıra</span>
        <span>Şube</span>
        <span style="text-align: right;">Açılan Fırsat</span>
      </div>
      <div class="funnel-list-scroll" tabindex="0" role="region" aria-label="${containerId.slice(5)} ${sub.label} sıralaması" data-scroll-key="${containerId}-${sub.key}">
        ${rowsHtml}
      </div>
      <div class="funnel-card-footer">
        <span class="footer-dnz-badge" style="color: var(--ink-10b981);">📍 Denizli: ${dnzRank}</span>
        <span class="footer-dnz-val" style="color: var(--ink-10b981);">${sortedList.length ? dnzVal.toLocaleString('tr-TR') : '-'}</span>
      </div>
    `;

    container.appendChild(card);
  });
}

export function renderB2bEwaSection(containerId, ewaData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const list = ewaData || [];
  let dnzRank = "-";
  let dnzIncome = 0;

  let rowsHtml = list.length === 0
    ? `<div class="ewa-row" style="grid-template-columns: 1fr; text-align: center; color: var(--text-muted);">${ewaData ? 'Bu aşamada veri bulunmuyor.' : 'Veriler yükleniyor…'}</div>`
    : "";
  list.forEach(item => {
    const displayName = LC_FULL_NAMES[item.lc] || item.name || item.lc;
    const isDnz = item.lc === "DNZ" || displayName.includes("Denizli");
    if (isDnz) {
      dnzRank = `#${item.rank}`;
      dnzIncome = item.income;
    }

    rowsHtml += `
      <div class="ewa-row ${isDnz ? 'highlight-dnz' : ''}">
        <span class="ewa-col-rank">#${item.rank}</span>
        <span class="ewa-col-lc">${displayName} (${item.lc})</span>
        <span class="ewa-col-money">${(Number(item.income) || 0).toLocaleString('tr-TR')} ₺</span>
      </div>
    `;
  });

  const card = document.createElement("div");
  card.className = "ewa-showcase-card";

  card.innerHTML = `
    <div class="ewa-header">
      <span class="ewa-header-title">👑 EwA ŞUBE GELİR LİGİ (TOP OF THE INCOME)</span>
      <span class="ewa-badge">EwA CİROSU</span>
    </div>
    <div class="ewa-table-head">
      <span>Sıra</span>
      <span>Şube Adı</span>
      <span style="text-align: right;">Toplanan Gelir</span>
    </div>
    <div class="ewa-list-body" tabindex="0" role="region" aria-label="EwA şube gelir sıralaması; ilk 10 sonrası için kaydır">
      ${rowsHtml}
    </div>
    <div class="ewa-footer">
      <span class="footer-dnz-badge" style="color: var(--ink-f59e0b); font-size: 0.9rem;">
        📍 Denizli Sıralaması: <strong>${dnzRank}</strong>
      </span>
      <span class="footer-dnz-val" style="color: var(--ink-f59e0b); font-size: 1.05rem;">
        ${list.length ? `${(Number(dnzIncome) || 0).toLocaleString('tr-TR')} ₺` : '-'}
      </span>
    </div>
  `;

  container.appendChild(card);
}

// ========================================================
// 7. MKT 4 ÜRÜN MOTORU
// ========================================================
export function renderMktGrid(containerId, mktData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const products = [
    { key: "gv",  name: "Global Volunteer", goalKey: "gv_goal", achKey: "gv_ach" },
    { key: "gt",  name: "Global Talent",    goalKey: "gt_goal", achKey: "gt_ach" },
    { key: "gte", name: "Global Teacher",   goalKey: "gte_goal", achKey: "gte_ach" },
    { key: "ov",  name: "Overall oGX",      goalKey: "ov_goal", achKey: "ov_ach" }
  ];

  products.forEach(p => {
    const list = (mktData || []).map(item => ({
      lc: item.lc,
      goal: Number(item[p.goalKey]) || 0,
      ach: Number(item[p.achKey]) || 0
    })).sort((a, b) => b.ach - a.ach);

    let dnzRank = "-";
    let dnzAch = 0;
    let dnzGoal = 0;

    let rowsHtml = list.length === 0
      ? `<div class="funnel-row" style="grid-template-columns: 1fr; text-align: center; color: var(--text-muted);">${mktData ? 'Bu aşamada veri bulunmuyor.' : 'Veriler yükleniyor…'}</div>`
      : "";
    list.forEach((item, index) => {
      const rank = index + 1;
      const isDnz = item.lc === "DNZ";
      if (isDnz) {
        dnzRank = `#${rank}`;
        dnzAch = item.ach;
        dnzGoal = item.goal;
      }

      rowsHtml += `
        <div class="funnel-row ${isDnz ? 'highlight-dnz' : ''}">
          <span class="funnel-col-rank">#${rank}</span>
          <span class="funnel-col-lc">${item.lc} <small style="color: var(--text-muted); font-size: 0.65rem;">${LC_FULL_NAMES[item.lc] || ''}</small></span>
          <span class="funnel-col-val">${item.ach.toLocaleString('tr-TR')} <small style="color: var(--text-muted); font-size: 0.65rem;">/ ${item.goal.toLocaleString('tr-TR')}</small></span>
        </div>
      `;
    });

    const card = document.createElement("div");
    card.className = "funnel-card";
    card.style.setProperty("--card-accent", "#ffc845");

    card.innerHTML = `
      <div class="funnel-card-header" style="background: #e2b16a; color: #000;">
        <span class="funnel-card-title">${p.name}</span>
        <span class="funnel-metric-badge" style="background: rgba(0,0,0,0.2); color: #000;">ACH</span>
      </div>
      <div class="funnel-table-head">
        <span>Sıra</span>
        <span>Şube</span>
        <span style="text-align: right;">Gerçekleşen</span>
      </div>
      <div class="funnel-list-scroll" tabindex="0" role="region" aria-label="MKT ${p.name} sıralaması" data-scroll-key="mkt-${p.key}">
        ${rowsHtml}
      </div>
      <div class="funnel-card-footer">
        <span class="footer-dnz-badge" style="color: var(--ink-ffc845);">📍 Denizli: ${dnzRank}</span>
        <span class="footer-dnz-val">${list.length ? `${dnzAch.toLocaleString('tr-TR')} / ${dnzGoal.toLocaleString('tr-TR')}` : '-'}</span>
      </div>
    `;

    container.appendChild(card);
  });
}

export function renderAllDepartmentFunnels(nationalData = null) {
  const restoreFocus = rememberScrollFocus(document.getElementById('nttDeptsContainer'));
  const funnels = nationalData?.funnels || {};
  const b2b = nationalData?.b2b || null;
  const emptyMatrix = nationalData === null ? undefined : {};
  const emptyList = nationalData === null ? undefined : [];

  renderFunnelSixGrid('grid-igv', funnels.igv ?? emptyMatrix, '#F85A40');
  renderFunnelSixGrid('grid-igta', funnels.igta ?? emptyMatrix, '#0CB9C1');
  renderFunnelSixGrid('grid-igte', funnels.igte ?? emptyMatrix, '#F48924');
  renderFunnelSixGrid('grid-ogv', null, '#F85A40', true);
  renderFunnelSixGrid('grid-ogta', funnels.ogta ?? emptyMatrix, '#EC4899');
  renderFunnelSixGrid('grid-ogte', funnels.ogte ?? emptyMatrix, '#8B5CF6');
  
  renderB2bTierGrid('grid-b2b-total', b2b?.total ?? emptyMatrix, '#10B981');
  renderB2bTierGrid('grid-b2b-gta', b2b?.gta ?? emptyMatrix, '#0CB9C1');
  renderB2bTierGrid('grid-b2b-gte', b2b?.gte ?? emptyMatrix, '#F48924');
  renderB2bEwaSection('grid-b2b-ewa', b2b?.ewa ?? emptyList);

  renderMktGrid('grid-mkt', nationalData?.mkt ?? emptyList);
  restoreFocus();
}
