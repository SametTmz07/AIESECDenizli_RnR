/**
 * AIESEC Denizli - Merkezi Yapılandırma
 * Dosya: js/config.js
 */

export const CONFIG = {
  // Canlı Master Sheet ID
  SHEET_ID: '177cjg-qlSjuCH8rxnCNkGAKWNlYAM0a9H5SGTBqOsM0',
  // Current reporting year; an explicit year in publication metadata wins.
  REPORTING_YEAR: 2026,
  // Dönem altyapısı kurulmadan önceki mevcut yayının bilinen dönemi.
  INITIAL_SEASON: '26.27',

  // Sekme İsimleri Sözleşmesi
  TABS: {
    PUBLICATION: 'SITE_CONFIG',
    SEASONS: 'SEASON_INDEX',
    RNR_WEEKLY: 'Haftalık_Public',
    RNR_ALLTIME: 'AllTime_Public',
    NTT_GLOBAL: 'NTT_Global',      // Dünyanın ilk 25'i bu sekmede
    IGV: 'iGV_Clean',
    IGTA: 'iGTa_Clean',
    IGTE: 'iGTe_Clean',
    OGT: 'oGT_Clean',
    OGTA: 'oGTa_Clean',
    OGTE: 'oGTe_Clean',
    B2B: 'B2B_Clean',
    MKT: 'MKT_Clean'
  },

  // Küresel NTT Ürün Renkleri
  NTT_PRODUCTS: {
    TOTAL: { title: 'TOTAL', color: '#2563EB' },
    IGV:   { title: 'iGV',   color: '#F85A40' },
    OGV:   { title: 'oGV',   color: '#7552CC' },
    IGTe:  { title: 'iGTe',  color: '#F48924' },
    OGTe:  { title: 'oGTe',  color: '#8B5CF6' },
    IGTa:  { title: 'iGTa',  color: '#0CB9C1' },
    OGTa:  { title: 'oGTa',  color: '#EC4899' }
  },

  // Haftalık RnR departmanları ve kurumsal renkleri
  DEPARTMENTS: {
    bda: { name: 'BDa', title: 'BDA TOP 3', color: '#0CB9C1' },
    bde: { name: 'BDe', title: 'BDE TOP 3', color: '#F48924' },
    igt: { name: 'iGT', title: 'iGT TOP 3', color: '#0CB9C1' },
    igv: { name: 'iGV', title: 'IGV TOP 3', color: '#F85A40' },
    ocvp: { name: 'OCVP', title: 'OCVP TOP 3', color: '#2563EB' },
    mkt: { name: 'MKT', title: 'MKT TOP 3', color: '#ffc845' },
    ogx: { name: 'oGX', title: 'OGX TOP 3', color: '#7552CC' }
  }
};
