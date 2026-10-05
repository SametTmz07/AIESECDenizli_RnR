import { fetchLeaderboardData, fetchAlltimeData, fetchNttGlobalData, fetchNationalNttData, fetchPublicationInfo, fetchSeasonCatalog, parseSeasonCatalog } from './storage.js';
import { createPodium } from './podium.js';
import { isConfettiEnabled, setConfettiEnabled, resetPodiumCelebration } from './effects.js';
import { CONFIG } from './config.js';
import { competitionRanks, normalizeSearch, formatPublicationDate, weekDateRange, seasonInfo, currentSeasonCode } from './ranking.js';
import { 
  renderGeneralTable, 
  renderDepartmentTables, 
  renderCumulativeTable, 
  renderMonthsArchive, 
  renderMembersRoster,
  renderNttCards,
  renderAllDepartmentFunnels,
  getDepartmentColor
} from './tables.js';

function replacePhotoAdjacentText() {
  const textSelectors = [
    '.slot-text-tag',
    '.slot-text-badge',
    '.slot-lead-name',
    '.text-slot-line',
    '.dept-tag',
    '.dept-slot-line'
  ];

  document.querySelectorAll(textSelectors.join(', ')).forEach((element, index) => {
    element.textContent = `[${String(index + 1).padStart(3, '0')}]`;
  });
}

replacePhotoAdjacentText();

// ========================================================
// 1. MOBİL ÇEKMECE KONTROLÜ
// ========================================================
const menuToggle = document.getElementById('menuToggle');
const mobileDrawer = document.getElementById('mobileDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const drawerClose = document.getElementById('drawerClose');
const mainContent = document.getElementById('main-content');
const drawerBackground = document.querySelectorAll('.skip-link, .global-navbar, .app-container, .global-bottom-bar');

function toggleDrawer(open) {
  const wasOpen = mobileDrawer?.classList.contains('open');
  drawerBackground.forEach(element => { element.inert = open; });
  if (!open && wasOpen) {
    const returnTarget = menuToggle?.getClientRects().length ? menuToggle : document.getElementById('brandLogo');
    returnTarget?.focus({ preventScroll: true });
  }
  if (mobileDrawer) mobileDrawer.inert = !open;
  mobileDrawer?.setAttribute('aria-hidden', String(!open));
  menuToggle?.setAttribute('aria-expanded', String(open));
  if (open) {
    mobileDrawer?.classList.add('open');
    drawerOverlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
    drawerClose?.focus();
  } else {
    mobileDrawer?.classList.remove('open');
    drawerOverlay?.classList.remove('open');
    document.body.style.overflow = '';
  }
}

menuToggle?.addEventListener('click', () => toggleDrawer(true));
drawerClose?.addEventListener('click', () => toggleDrawer(false));
drawerOverlay?.addEventListener('click', () => toggleDrawer(false));
toggleDrawer(false);
document.addEventListener('keydown', event => {
  if (!mobileDrawer?.classList.contains('open')) return;
  if (event.key === 'Escape') { event.preventDefault(); toggleDrawer(false); }
  if (event.key === 'Tab') {
    const items = [...mobileDrawer.querySelectorAll('button:not([disabled]), a[href]')]
      .filter(element => element.getClientRects().length);
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    else if (!mobileDrawer.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
  }
});
window.matchMedia('(min-width: 769px)').addEventListener('change', event => {
  if (event.matches) toggleDrawer(false);
});

// ========================================================
// 2. SPA GÖRÜNÜM DENETLEYİCİSİ & MERKEZİ AMBİYANS YÖNETİMİ
// ========================================================
const navLinks = document.querySelectorAll('.nav-item, .drawer-item, .footer-btn, .home-shortcut, #brandLogo');
const views = document.querySelectorAll('.page-view');
const ambientBg = document.getElementById('nttAmbientBg');

let currentView = 'home';
let findMemberPending = false;
let currentRnrLeaderColor = '#F85A40';
let currentAlltimeLeaderColor = '#F85A40';

function setShortcutAccent(id, color) {
  const shortcut = document.getElementById(id);
  if (color) shortcut?.style.setProperty('--shortcut-accent', color);
  else shortcut?.style.removeProperty('--shortcut-accent');
}

document.querySelectorAll('.home-shortcut').forEach(shortcut => {
  shortcut.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      shortcut.classList.add('description-dismissed');
      event.preventDefault();
    }
  });
  ['mouseleave', 'blur'].forEach(eventName => {
    shortcut.addEventListener(eventName, () => shortcut.classList.remove('description-dismissed'));
  });
});

document.querySelectorAll('[data-ranking-help]').forEach(help => {
  const trigger = help.querySelector('button');
  trigger.addEventListener('click', () => {
    help.classList.remove('help-dismissed');
    help.classList.toggle('help-open');
  });
  help.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      help.classList.remove('help-open');
      help.classList.add('help-dismissed');
      event.preventDefault();
    }
  });
  const closeHelp = () => help.classList.remove('help-open', 'help-dismissed');
  help.addEventListener('mouseleave', closeHelp);
  trigger.addEventListener('blur', closeHelp);
});

export function setAmbientGlow(color) {
  if (ambientBg) {
    ambientBg.style.background = `radial-gradient(circle at 50% 35%, ${color} 0%, transparent 70%)`;
    ambientBg.classList.add('active');
  }
}

function focusContent() {
  mainContent?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

document.querySelector('.skip-link')?.addEventListener('click', event => {
  event.preventDefault();
  focusContent();
});

function switchView(targetId, moveFocus = false) {
  currentView = targetId;
  const showCityMap = targetId === 'home' || targetId === 'denizli';
  const cityMap = document.getElementById('cityMapBackground');
  if (cityMap) cityMap.hidden = !showCityMap;
  document.body.classList.toggle('has-city-map', showCityMap);

  views.forEach(view => {
    view.classList.remove('active');
    if (view.id === `view-${targetId}`) {
      view.classList.add('active');
    }
  });

  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-target') === targetId) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  if (ambientBg) {
    if (targetId === 'rnr') {
      setAmbientGlow(currentRnrLeaderColor);
    } else if (targetId === 'alltime') {
      setAmbientGlow(currentAlltimeLeaderColor);
    } else if (targetId === 'ntt') {
      ambientBg.classList.add('active');
    } else {
      ambientBg.classList.remove('active');
    }
  }

  toggleDrawer(false);
  mainContent?.setAttribute('aria-label', ({ home: 'Ana Sayfa', rnr: 'RnR — haftalık sıralama', alltime: 'AllTime — aylık sıralama', ntt: 'NTT — şube ligleri', denizli: 'AIESEC Denizli' })[targetId]);
  if (moveFocus) focusContent();
  else window.scrollTo({ top: 0, behavior: 'smooth' });
  updateFooterPublication();
  if (targetId === 'alltime' && findMemberPending) {
    findMemberPending = false;
    document.getElementById('memberDirectory')?.scrollIntoView({ block: 'start' });
    document.getElementById('memberSearchInput')?.focus({ preventScroll: true });
  }
}

navLinks.forEach(link => {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const target = link.getAttribute('data-target');
    if (target) navigate(target);
  });
});
function navigate(target) {
  if (window.location.hash !== `#${target}`) window.location.hash = target;
  else switchView(target, true);
}

function updateRnrLeaderAmbient(leaderboard) {
  const weeklyLeader = leaderboard?.[0];
  currentRnrLeaderColor = weeklyLeader && (Number(weeklyLeader.points) || 0) > 0
    ? getDepartmentColor(weeklyLeader.department)
    : '#F85A40';
  setShortcutAccent('weeklyShortcut', weeklyLeader && (Number(weeklyLeader.points) || 0) > 0 ? currentRnrLeaderColor : null);

  if (currentView === 'rnr') setAmbientGlow(currentRnrLeaderColor);
}
window.addEventListener('hashchange', () => {
  const target = window.location.hash.slice(1);
  switchView(['home', 'rnr', 'alltime', 'ntt', 'denizli'].includes(target) ? target : 'home', true);
});
document.querySelectorAll('[data-denizli-section]').forEach(button => {
  button.addEventListener('click', () => {
    const section = document.getElementById(button.dataset.denizliSection);
    if (!section) return;
    section.focus({ preventScroll: true });
    section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
});

// ========================================================
// 3. ORTAK HAFTALIK / AYLIK PODYUM
// ========================================================
const weeklyPodium = createPodium({ stageId: 'stageContainer', buttonId: 'actionBtn', vectorsId: 'bgVectors' });
const monthlyPodium = createPodium({ stageId: 'alltimeStageContainer', buttonId: 'alltimeActionBtn', vectorsId: 'alltimeBgVectors', prefix: 'alltime', monthly: true });
const confettiButtons = [...document.querySelectorAll('.confetti-toggle')];
const confettiMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
function updateConfettiButtons() {
  const enabled = isConfettiEnabled();
  confettiButtons.forEach(button => {
    const label = confettiMotionPreference.matches ? 'Hareket azaltma tercihi nedeniyle konfeti kapalı' :
      enabled ? 'Konfeti açık; kapat' : 'Konfeti kapalı; aç';
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', label);
    button.title = label;
    button.disabled = confettiMotionPreference.matches;
  });
}
confettiButtons.forEach(button => button.addEventListener('click', () => {
  setConfettiEnabled(!isConfettiEnabled());
  updateConfettiButtons();
}));
confettiMotionPreference.addEventListener?.('change', () => {
  if (confettiMotionPreference.matches) resetPodiumCelebration();
  updateConfettiButtons();
});
updateConfettiButtons();
function toggleFullscreen(element) {
  if (!document.fullscreenElement) element?.requestFullscreen().catch(error => console.warn(error.message));
  else document.exitFullscreen().catch(error => console.warn(error.message));
}
[
  ['actionBtn', () => weeklyPodium.reveal()],
  ['miniResetBtn', () => weeklyPodium.reset()],
  ['rnrFullscreenBtn', () => toggleFullscreen(document.getElementById('rnrPodiumWrapper'))],
  ['alltimeActionBtn', () => monthlyPodium.reveal()],
  ['alltimeResetBtn', () => monthlyPodium.reset()],
  ['alltimeFullscreenBtn', () => toggleFullscreen(document.getElementById('alltimePodiumWrapper'))]
].forEach(([id, action]) => document.getElementById(id)?.addEventListener('click', action));

// ========================================================
// 5. ALLTIME AY GEÇİŞLERİ & DİNAMİK DEPARTMAN AMBİYANSI
// ========================================================
let globalAlltimePayload = null;
let currentSelectedMonth = 'ŞUBAT';
let selectedSeasonCode = currentSeasonCode();
let seasonCatalog = parseSeasonCatalog([]);
let manualSeasonChoice = false;
let seasonRequest = 0;
const seasonSelect = document.getElementById('seasonSelect');

function selectedSeason() { return seasonCatalog.seasons.find(item => item.code === selectedSeasonCode); }
function selectedSeasonPublicationDate() {
  const season = selectedSeason();
  if (season?.status === 'ARCHIVED') return season.publishedAt;
  const info = publicationInfo?.ALLTIME;
  const code = info?.period?.match(/\b\d{2}\.\d{2}\b/)?.[0];
  const matches = code ? code === selectedSeasonCode : selectedSeasonCode === CONFIG.INITIAL_SEASON;
  return matches && info?.status === 'PUBLISHED' ? info.publishedAt : null;
}
function renderSeasonSelector() {
  if (!seasonSelect) return;
  seasonSelect.replaceChildren(...seasonCatalog.seasons.map(season => {
    const option = document.createElement('option');
    option.value = season.code;
    option.textContent = season.code + (season.code === seasonCatalog.currentCode ? ' · Güncel' : '');
    return option;
  }));
  seasonSelect.value = selectedSeasonCode;
  const heading = document.getElementById('seasonArchiveHeading');
  if (heading) heading.textContent = 'DÖNEMSEL İLK 3 KÜRSÜLERİ (' + seasonInfo(selectedSeasonCode).label + ')';
}
function updateAlltimePublication() {
  const date = selectedSeasonPublicationDate();
  document.querySelectorAll('[data-publication="ALLTIME"]').forEach(element => {
    element.textContent = date ? 'Son yayın: ' + formatPublicationDate(date) : 'Yayın tarihi henüz belirtilmedi.';
  });
  updateFooterPublication();
}
function resetSeasonView() {
  globalAlltimePayload = null;
  hasMonthSelection = false;
  currentSelectedMonth = 'ŞUBAT';
  monthlyPodium.reset(); monthlyPodium.setData([]);
  renderCumulativeTable([], currentSelectedMonth); renderMembersRoster([]); filterMembers();
  renderMonthsArchive({}, null, currentSelectedMonth, selectedSeasonCode);
  document.getElementById('alltimeMonthBadge').textContent = currentSelectedMonth;
  document.getElementById('monthlyPeriod').textContent = seasonInfo(selectedSeasonCode).label;
  setShortcutAccent('alltimeShortcut', null);
  currentAlltimeLeaderColor = '#F85A40';
  if (currentView === 'alltime') setAmbientGlow(currentAlltimeLeaderColor);
  document.getElementById('memberRosterScope').textContent = '';
  updateAlltimePublication();
}
async function loadSelectedSeason() {
  const season = selectedSeason();
  if (!season) return;
  const request = ++seasonRequest;
  const status = reportStatus('ALLTIME');
  status('loading', { hasData: globalAlltimePayload?.season === season.code });
  return fetchAlltimeData(payload => {
    if (request !== seasonRequest || payload.season !== selectedSeasonCode) return;
    globalAlltimePayload = payload;
    if (!hasMonthSelection || !payload.availableMonths?.includes(currentSelectedMonth)) {
      currentSelectedMonth = payload.defaultMonth || 'ŞUBAT'; hasMonthSelection = true;
    }
    applySelectedMonth(currentSelectedMonth);
    updateAlltimePublication();
  }, (state, details) => { if (request === seasonRequest) status(state, details); }, season);
}
async function refreshSeasonCatalog() {
  return fetchSeasonCatalog(catalog => {
    seasonCatalog = catalog;
    const oldCode = selectedSeasonCode;
    if (!manualSeasonChoice || !catalog.seasons.some(item => item.code === selectedSeasonCode)) selectedSeasonCode = catalog.currentCode;
    if (oldCode !== selectedSeasonCode) resetSeasonView();
    renderSeasonSelector(); loadSelectedSeason();
  }, state => {
    const note = document.getElementById('seasonCatalogStatus');
    if (note) note.textContent = ['error', 'offline'].includes(state) ? 'Dönem listesi yenilenemedi. Mevcut seçenekler gösteriliyor.' : '';
    const retry = document.getElementById('retrySeasonCatalog');
    if (retry) { retry.hidden = !['error', 'offline'].includes(state); retry.disabled = state === 'loading'; }
  });
}
seasonSelect?.addEventListener('change', () => {
  selectedSeasonCode = seasonSelect.value; manualSeasonChoice = true;
  ++seasonRequest; renderSeasonSelector(); resetSeasonView(); loadSelectedSeason();
});
document.getElementById('retrySeasonCatalog')?.addEventListener('click', refreshSeasonCatalog);
renderSeasonSelector();

function applySelectedMonth(selectedMonth) {
  if (!globalAlltimePayload) return;
  const monthChanged = currentSelectedMonth !== selectedMonth;
  currentSelectedMonth = selectedMonth;

  // Rozetleri ve Başlıkları Güncelle
  const monthBadge = document.getElementById('alltimeMonthBadge');
  if (monthBadge) monthBadge.innerText = selectedMonth;

  const currentList = competitionRanks(globalAlltimePayload.monthlyLeaderboards[selectedMonth] || []);
  const top1 = currentList[0];


  // 4. GÖREV: Ayın 1.'sinin departman rengini arka plan ışığına ata!
  if (top1 && (Number(top1.points) || 0) > 0) {
    currentAlltimeLeaderColor = getDepartmentColor(top1.department);
  } else {
    currentAlltimeLeaderColor = '#F85A40';
  }
  setShortcutAccent('alltimeShortcut', top1 && (Number(top1.points) || 0) > 0 ? currentAlltimeLeaderColor : null);

  if (currentView === 'alltime') {
    setAmbientGlow(currentAlltimeLeaderColor);
  }

  if (monthChanged) monthlyPodium.reset();
  monthlyPodium.setData(currentList);
  const monthlyPeriod = document.getElementById('monthlyPeriod');
  if (monthlyPeriod) monthlyPeriod.textContent = selectedSeasonCode + ' · Seçilen ay: ' + selectedMonth + ' ' + (seasonInfo(selectedSeasonCode).year + (selectedMonth === 'OCAK' ? 1 : 0));

  // 3. GÖREV: Tabloyu seçili ayın Top 10'u ile render et
  renderCumulativeTable(currentList.slice(0, 10), selectedMonth);
  if (globalAlltimePayload.archived && !currentList.length) {
    const cell = document.querySelector('#cumulativeTableBody .status-cell');
    if (cell) cell.textContent = 'Bu ay için arşivlenmiş sonuç bulunmuyor.';
  }

  // 2. GÖREV: 12 aylık arşivi sahte verilerden arındırıp interaktif bağla
  renderMonthsArchive(globalAlltimePayload.monthlyLeaderboards, (clickedMonth) => {
    applySelectedMonth(clickedMonth);
  }, currentSelectedMonth, selectedSeasonCode);
  const roster = globalAlltimePayload.archived ? currentList : globalAlltimePayload.allMembersRoster;
  renderMembersRoster(roster); filterMembers();
  const scope = document.getElementById('memberRosterScope');
  if (scope) scope.textContent = globalAlltimePayload.archived
    ? 'Arşiv: seçilen ayın ilk 10 kişisi ve o ay sonuna kadar kazandıkları rozetler.'
    : 'Bu dönemin yayımlanmış üyeleri ve rozetleri.';
}

// AllTime Üye Arama ve Filtreleme
const memberSearch = document.getElementById('memberSearchInput');
const deptChips = document.querySelectorAll('.dept-chip');
deptChips.forEach(chip => chip.setAttribute('aria-pressed', String(chip.classList.contains('active'))));

function filterMembers() {
  const query = normalizeSearch(memberSearch?.value || '');
  const activeChip = document.querySelector('.dept-chip.active');
  const selectedDept = activeChip ? activeChip.getAttribute('data-dept') : 'all';

  const rows = document.querySelectorAll('.roster-row');
  let matches = 0;
  rows.forEach(row => {
    const name = normalizeSearch(row.getAttribute('data-name') || '');
    const dept = row.getAttribute('data-dept') || '';
    const nameMatch = name.includes(query);
    const deptMatch = selectedDept === 'all' || dept === selectedDept;

    if (nameMatch && deptMatch) {
      matches++;
      row.style.display = 'grid';
    } else {
      row.style.display = 'none';
    }
  });
  const empty = document.getElementById('memberSearchEmpty');
  if (empty) empty.hidden = matches > 0 || rows.length === 0;
  const count = document.getElementById('memberResultCount');
  if (count) count.textContent = rows.length === 0 ? (globalAlltimePayload?.archived ? 'Bu ayın arşivinde kişi bulunmuyor.' : 'Henüz yayımlanmış kişi bulunmuyor.')
    : query || selectedDept !== 'all' ? matches + ' / ' + rows.length + ' kişi bulundu' : matches + ' kişi listeleniyor';
  const clear = document.getElementById('clearMemberFilters');
  if (clear) clear.disabled = !query && selectedDept === 'all';
}

memberSearch?.addEventListener('input', filterMembers);
deptChips.forEach(chip => {
  chip.addEventListener('click', () => {
    deptChips.forEach(c => { c.classList.remove('active'); c.setAttribute('aria-pressed', 'false'); });
    chip.classList.add('active');
    chip.setAttribute('aria-pressed', 'true');
    filterMembers();
  });
});

document.getElementById('clearMemberFilters')?.addEventListener('click', () => {
  if (memberSearch) memberSearch.value = '';
  deptChips.forEach(chip => {
    const active = chip.getAttribute('data-dept') === 'all';
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
  filterMembers();
  memberSearch?.focus({ preventScroll: true });
});
document.getElementById('findMemberLink')?.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  findMemberPending = true;
  navigate('alltime');
});

// ========================================================
// 6. NTT KÜRESEL SEKMELERİ
// ========================================================
let currentNttCategory = 'approved';
let latestGlobalNttData = null;
const nttTabs = document.querySelectorAll('.ntt-tab-btn');
nttTabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab.classList.contains('active'))));

nttTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    nttTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-pressed', 'false'); });
    tab.classList.add('active');
    tab.setAttribute('aria-pressed', 'true');
    currentNttCategory = tab.getAttribute('data-category');
    renderNttCards(currentNttCategory, latestGlobalNttData);
  });
});

// ========================================================
// 7. NTT DİKEY FİLTRELEME & AKILLI MOBİL ODAKLAMA
// ========================================================
const deptPills = document.querySelectorAll('.filter-pill');
const stageBlocks = document.querySelectorAll('.dept-stage-block');
const pillsContainer = document.getElementById('nttDeptPills');
deptPills.forEach(pill => {
  pill.setAttribute('aria-controls', pill.getAttribute('data-dept-target'));
  if (pill.classList.contains('active')) pill.setAttribute('aria-current', 'location');
});

function scrollPillIntoView(pill) {
  if (!pillsContainer || !pill) return;
  if (window.innerWidth < 1024) {
    const containerRect = pillsContainer.getBoundingClientRect();
    const pillRect = pill.getBoundingClientRect();
    const targetScrollLeft = pillsContainer.scrollLeft + (pillRect.left - containerRect.left) - (containerRect.width / 2) + (pillRect.width / 2);
    pillsContainer.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
  }
}

deptPills.forEach(pill => {
  pill.addEventListener('click', () => {
    const targetId = pill.getAttribute('data-dept-target');
    const targetEl = document.getElementById(targetId);

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    deptPills.forEach(p => { p.classList.remove('active'); p.removeAttribute('aria-current'); });
    pill.classList.add('active');
    pill.setAttribute('aria-current', 'location');
    scrollPillIntoView(pill);
  });
});

const observerOptions = {
  root: null,
  rootMargin: '-20% 0px -50% 0px',
  threshold: 0
};

const stageObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const color = entry.target.getAttribute('data-ambient') || '#0CB9C1';
      const targetId = entry.target.id;

      if (currentView === 'ntt') {
        setAmbientGlow(color);
      }

      deptPills.forEach(p => {
        if (p.getAttribute('data-dept-target') === targetId) {
          p.classList.add('active');
          p.setAttribute('aria-current', 'location');
          scrollPillIntoView(p);
        } else {
          p.classList.remove('active');
          p.removeAttribute('aria-current');
        }
      });
    }
  });
}, observerOptions);

stageBlocks.forEach(block => stageObserver.observe(block));

// ========================================================
// 8. ALT BİLGİ EN ÜSTE ÇIKMA BUTONU (SCROLL TO TOP)
// ========================================================
const scrollTopBtn = document.getElementById('scrollTopBtn');
scrollTopBtn?.addEventListener('click', focusContent);

// ========================================================
// 9. VERİ DURUMU, YAYIN TARİHİ VE YENİLEME
// ========================================================
let publicationInfo = null;
let latestWeeklyWeek = '';
let hasMonthSelection = false;

function updateWeeklyPeriod() {
  const info = publicationInfo?.RNR_WEEKLY;
  const explicitYear = info?.period?.match(/(?:^|\D)(20\d{2})(?:\D|$)/)?.[1];
  const range = weekDateRange(latestWeeklyWeek, explicitYear ? Number(explicitYear) : CONFIG.REPORTING_YEAR);
  const label = document.getElementById('weeklyPeriod');
  if (label) label.textContent = latestWeeklyWeek ? 'Hafta ' + latestWeeklyWeek + (range ? ' · ' + range : '') : 'Haftalık dönem henüz belirtilmedi.';
}

function updateFooterPublication() {
  const datasets = currentView === 'rnr' ? ['RNR_WEEKLY'] : currentView === 'alltime' ? ['ALLTIME']
    : currentView === 'ntt' ? ['NTT_GLOBAL', 'NTT_NATIONAL'] : ['RNR_WEEKLY', 'ALLTIME', 'NTT_GLOBAL', 'NTT_NATIONAL'];
  const seasonDate = currentView === 'alltime' ? selectedSeasonPublicationDate() : null;
  const dates = currentView === 'alltime' ? (seasonDate ? [seasonDate] : []) : datasets.map(key => publicationInfo?.[key]).filter(info => info?.publishedAt && info.status === 'PUBLISHED').map(info => info.publishedAt).sort();
  const footer = document.getElementById('footerPublication');
  if (footer) footer.textContent = dates.length ? 'Son yayın: ' + formatPublicationDate(dates.at(-1)) : 'Son yayın tarihi henüz belirtilmedi.';
}

async function refreshPublicationInfo() {
  await fetchPublicationInfo(info => {
    publicationInfo = info;
    document.querySelectorAll('[data-publication]').forEach(element => {
      if (element.getAttribute('data-publication') === 'ALLTIME') return;
      const data = info?.[element.getAttribute('data-publication')];
      element.textContent = data?.publishedAt && data.status === 'PUBLISHED'
        ? 'Son yayın: ' + formatPublicationDate(data.publishedAt)
        : 'Yayın tarihi henüz belirtilmedi.';
    });
    updateWeeklyPeriod();
    updateAlltimePublication();
  });
}

function reportStatus(dataset) {
  return (state, details = {}) => {
    const container = document.querySelector('[data-dataset="' + dataset + '"]');
    if (!container) return;
    container.setAttribute('data-state', state);
    const text = container.querySelector('[role="status"]');
    const button = container.querySelector('[data-retry]');
    if (['error', 'offline'].includes(state) && !details.hasData) {
      if (dataset === 'RNR_WEEKLY') {
        renderGeneralTable([], '');
        const cell = document.querySelector('#generalTableBody .status-cell');
        if (cell) cell.textContent = 'Sıralama şu anda yüklenemiyor.';
        updateWeeklyPeriod();
      } else if (dataset === 'ALLTIME') {
        renderCumulativeTable([], currentSelectedMonth);
        const cell = document.querySelector('#cumulativeTableBody .status-cell');
        if (cell) cell.textContent = 'Sıralama şu anda yüklenemiyor.';
        const period = document.getElementById('monthlyPeriod');
        if (period) period.textContent = 'Seçilen ay: ' + currentSelectedMonth;
        const count = document.getElementById('memberResultCount');
        if (count) count.textContent = 'Kişi listesi yüklenemedi.';
      } else if (dataset === 'NTT_GLOBAL') renderNttCards(currentNttCategory, {});
      else if (dataset === 'NTT_NATIONAL') renderAllDepartmentFunnels({});
    }
    const messages = {
      loading: details.hasData ? 'Son görüntülenen veriler gösteriliyor; güncelliği kontrol ediliyor…' : 'Veriler yükleniyor…',
      error: details.hasData ? 'Güncel veri alınamadı. Son görüntülenen veriler gösteriliyor.' : 'Veri yüklenemedi. Tekrar deneyebilirsin.',
      offline: details.hasData ? 'Çevrimdışı · Son kaydedilen veriler gösteriliyor.' : 'Çevrimdışı · Bu bölüm için kayıt yok. Verileri almak için internete bağlan.',
      partial: details.hasCache ? 'Bazı tablolar yenilenemedi; bu tablolarda önceki veriler gösteriliyor.' : 'Bazı tablolar yüklenemedi; alınabilen tablolar gösteriliyor.',
      empty: 'Henüz yayımlanmış sonuç bulunmuyor.',
      success: ''
    };
    const savedDate = details.savedAt ? new Date(details.savedAt) : null;
    const savedText = savedDate && !Number.isNaN(savedDate.getTime())
      ? ' Son kayıt: ' + savedDate.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' }) + '.'
      : details.hasData ? ' Son kayıt tarihi bilinmiyor.' : '';
    const stale = ['offline', 'error', 'partial', 'loading'].includes(state) && details.hasData;
    if (text) {
      text.textContent = (messages[state] || '') + (stale ? savedText : '') + (state === 'offline' && details.partial ? ' Bazı tablolarda daha eski kayıtlar bulunabilir.' : '');
      text.hidden = state === 'success';
    }
    if (button) {
      if (state !== 'loading') button.hidden = !['error', 'partial'].includes(state);
      button.disabled = state === 'loading';
    }
  };
}

const loaders = {
  RNR_WEEKLY: () => fetchLeaderboardData(data => {
    const leaderboard = competitionRanks(data.leaderboard || []);
    latestWeeklyWeek = data.week || '';
    const weekBadge = document.getElementById('weekBadge');
    if (weekBadge) weekBadge.textContent = 'HAFTA ' + (data.week || '—');
    weeklyPodium.setData(leaderboard);
    renderGeneralTable(leaderboard, data.week);
    renderDepartmentTables(data.departmentTop3, data.week);
    updateRnrLeaderAmbient(leaderboard);
    updateWeeklyPeriod();
  }, reportStatus('RNR_WEEKLY')),
  ALLTIME: loadSelectedSeason,
  NTT_GLOBAL: () => fetchNttGlobalData(data => {
    latestGlobalNttData = data;
    renderNttCards(currentNttCategory, data);
  }, reportStatus('NTT_GLOBAL')),
  NTT_NATIONAL: () => fetchNationalNttData(data => renderAllDepartmentFunnels(data), reportStatus('NTT_NATIONAL'))
};

document.querySelectorAll('[data-retry]').forEach(button => button.addEventListener('click', async () => {
  await loaders[button.getAttribute('data-retry')]?.();
  refreshPublicationInfo();
}));
function refreshData() {
  Object.entries(loaders).forEach(([key, load]) => { if (key !== 'ALLTIME') load(); });
  refreshSeasonCatalog();
  refreshPublicationInfo();
}
window.addEventListener('aiesec:refresh-data', refreshData);
setInterval(() => { if (navigator.onLine && document.visibilityState === 'visible') refreshData(); }, 60000);
window.addEventListener('DOMContentLoaded', () => {
  const target = window.location.hash.slice(1);
  switchView(['home', 'rnr', 'alltime', 'ntt', 'denizli'].includes(target) ? target : 'home');
  renderAllDepartmentFunnels();
  Object.entries(loaders).forEach(([key, load]) => { if (key !== 'ALLTIME') load(); });
  refreshSeasonCatalog();
  refreshPublicationInfo();
});
