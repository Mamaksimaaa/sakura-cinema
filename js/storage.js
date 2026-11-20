/**
 * Sakura Cinema Browser - Persistent Storage & Sync Manager
 * Manages local storage, history, favorites, custom sites and JSON export/import
 */

const STORAGE_KEYS = {
  SITES: 'sakura_cinema_sites',
  HISTORY: 'sakura_cinema_history',
  FAVORITES: 'sakura_cinema_favorites',
  MIRRORS_CONFIG: 'sakura_cinema_mirrors_config',
  ACTIVE_MIRROR: 'sakura_cinema_active_mirror',
  BACKGROUND_CONFIG: 'sakura_cinema_background',
  SETTINGS: 'sakura_cinema_settings'
};

const DEFAULT_SETTINGS = {
  adblockEnabled: true,
  cinemaModeAmbient: true,
  tvModeEnabled: false,
  mascotEnabled: true,
  soundEffects: true,
  particleEffect: 'sakura', // 'sakura' | 'rain' | 'fireflies' | 'off'
  autoCheckMirrors: true,
  bgPreset: 'dream-chaser' // 'dream-chaser' | 'cyberpunk-dark' | 'midnight-sakura' | 'sakura-sunset' | 'custom'
};

const StorageManager = {
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.warn('Storage read failed', e);
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  },

  getActiveMirror(fallback = 'https://rezka.si') {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_MIRROR) || fallback;
  },

  setActiveMirror(url) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_MIRROR, url);
  },

  getMirrorsConfig() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MIRRORS_CONFIG);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  saveMirrorsConfig(config) {
    try {
      localStorage.setItem(STORAGE_KEYS.MIRRORS_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save mirrors config', e);
    }
  },

  getSites() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SITES);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  saveSites(sites) {
    try {
      localStorage.setItem(STORAGE_KEYS.SITES, JSON.stringify(sites));
    } catch (e) {
      console.error('Failed to save sites', e);
    }
  },

  getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (data) return JSON.parse(data);
      // Default demo history items so the "Continue Watching" UI looks alive from the start
      return [
        {
          id: 'hist-1',
          title: 'Клинок, рассекающий демонов',
          episode: 'Сезон 4, Серия 8',
          timestamp: '18:24 / 23:40',
          progressPercent: 78,
          sourceName: 'HDrezka',
          siteUrl: 'https://rezka.si',
          cover: 'demon_slayer',
          category: 'anime'
        },
        {
          id: 'hist-2',
          title: 'Атака титанов: Финал',
          episode: 'Спецэпизод 2',
          timestamp: '42:15 / 85:00',
          progressPercent: 50,
          sourceName: 'AniLibria',
          siteUrl: 'https://www.anilibria.tv',
          cover: 'titan',
          category: 'anime'
        },
        {
          id: 'hist-3',
          title: 'Киберпанк: Бегущие по краю',
          episode: 'Серия 10 (Финал)',
          timestamp: '21:10 / 25:12',
          progressPercent: 85,
          sourceName: 'HDrezka',
          siteUrl: 'https://rezka.si',
          cover: 'cyberpunk',
          category: 'anime'
        },
        {
          id: 'hist-4',
          title: 'Дюна: Часть вторая',
          episode: 'Фильм (4K HDR)',
          timestamp: '01:45:20 / 02:46:00',
          progressPercent: 63,
          sourceName: 'HDrezka',
          siteUrl: 'https://rezka.si',
          cover: 'dune',
          category: 'cinema'
        }
      ];
    } catch (e) {
      return [];
    }
  },

  saveHistory(history) {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save history', e);
    }
  },

  addHistoryItem(item) {
    const list = this.getHistory();
    const filtered = list.filter(h => h.title !== item.title);
    filtered.unshift({
      id: 'hist-' + Date.now(),
      progressPercent: 10,
      timestamp: '02:30 / --:--',
      ...item
    });
    this.saveHistory(filtered.slice(0, 12));
  },

  removeHistoryItem(id) {
    const list = this.getHistory();
    const filtered = list.filter(h => h.id !== id);
    this.saveHistory(filtered);
    return filtered;
  },

  getCustomBackground() {
    return localStorage.getItem(STORAGE_KEYS.BACKGROUND_CONFIG) || null;
  },

  setCustomBackground(dataUrl) {
    try {
      localStorage.setItem(STORAGE_KEYS.BACKGROUND_CONFIG, dataUrl);
    } catch (e) {
      alert('Файл слишком большой для локального хранилища. Рекомендуется использовать файлы до 8 МБ.');
    }
  },

  // Export full profile for synchronization between PC and Phone
  exportProfile() {
    const bundle = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      appName: 'Sakura Cinema Browser',
      settings: this.getSettings(),
      activeMirror: this.getActiveMirror(),
      mirrorsConfig: this.getMirrorsConfig(),
      sites: this.getSites(),
      history: this.getHistory()
    };
    return JSON.stringify(bundle, null, 2);
  },

  // Import profile from PC / Mobile backup file
  importProfile(jsonString) {
    try {
      const bundle = JSON.parse(jsonString);
      if (bundle.settings) this.saveSettings(bundle.settings);
      if (bundle.activeMirror) this.setActiveMirror(bundle.activeMirror);
      if (bundle.mirrorsConfig) this.saveMirrorsConfig(bundle.mirrorsConfig);
      if (bundle.sites) this.saveSites(bundle.sites);
      if (bundle.history) this.saveHistory(bundle.history);
      return { success: true, message: 'Профиль успешно импортирован!' };
    } catch (e) {
      return { success: false, message: 'Некорректный формат файла резервной копии.' };
    }
  }
};

window.StorageManager = StorageManager;
