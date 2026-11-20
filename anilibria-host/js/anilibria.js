/**
 * Sakura Anime — anilibria.js
 * Full anime catalog + HLS player engine for Sakura Cinema Browser
 * API: https://anilibria.top/api/v1
 */

'use strict';

const ANI = {
  API: 'https://anilibria.top/api/v1',
  IMG: 'https://anilibria.top',
  PAGE_SIZE: 24,

  // State
  state: {
    releases: [],
    page: 1,
    total: 0,
    loading: false,
    mode: 'latest',      // 'latest' | 'ongoing' | 'genre' | 'search'
    activeGenre: null,
    activeGenreId: null,
    searchQuery: '',
    viewMode: 'grid',    // 'grid' | 'list'
    genres: [],
    genresOffset: 0,
    // Hero slider
    featured: [],
    heroIndex: 0,
    heroTimer: null,
    // Player
    currentRelease: null,
    currentEpIndex: 0,
    currentQuality: '720',
    hls: null,
  },

  // ─── Init ────────────────────────────────────────────────────
  init() {
    this.bindHeaderUI();
    this.bindPlayerUI();
    this.loadGenres();
    this.loadLatest(true);
    this.startParticles();
  },

  // ─── API helpers ─────────────────────────────────────────────
  async apiFetch(endpoint, params = {}) {
    const url = new URL(this.API + endpoint);
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach(val => url.searchParams.append(k + '[]', val));
      else url.searchParams.set(k, v);
    });
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API ${res.status}: ${endpoint}`);
    return res.json();
  },

  // ─── Genre loading ────────────────────────────────────────────
  async loadGenres() {
    try {
      const data = await this.apiFetch('/anime/genres', { limit: 40 });
      const genres = Array.isArray(data) ? data : (data.data || []);
      this.state.genres = genres;
      this.renderGenreFilterBar(genres);
      this.renderSidebarGenres(genres);
    } catch (e) {
      console.warn('Genres load failed:', e.message);
    }
  },

  renderGenreFilterBar(genres) {
    const bar = document.getElementById('genreFilterBar');
    if (!bar) return;
    const allPill = bar.querySelector('[data-all]');
    // Keep "Все" pill, add genres
    const existing = bar.querySelectorAll('[data-genre-id]');
    existing.forEach(el => el.remove());

    genres.slice(0, 20).forEach(g => {
      const btn = document.createElement('button');
      btn.className = 'gf-pill';
      btn.dataset.genreId = g.id;
      btn.dataset.genreName = g.name;
      btn.textContent = g.name;
      btn.addEventListener('click', () => this.selectGenre(g.id, g.name, btn));
      bar.appendChild(btn);
    });
  },

  renderSidebarGenres(genres) {
    const container = document.getElementById('sidebarGenres');
    if (!container) return;
    container.innerHTML = '';
    genres.slice(0, 25).forEach(g => {
      const btn = document.createElement('button');
      btn.className = 'genre-pill-btn';
      btn.dataset.genreId = g.id;
      btn.innerHTML = `
        <span>${g.name}</span>
        <span class="genre-count">${g.total_releases || ''}</span>
      `;
      btn.addEventListener('click', () => this.selectGenre(g.id, g.name, btn));
      container.appendChild(btn);
    });
  },

  selectGenre(id, name, el) {
    if (this.state.activeGenreId === id) {
      // Deselect
      this.state.activeGenreId = null;
      this.state.activeGenre = null;
      document.querySelectorAll('[data-genre-id]').forEach(b => b.classList.remove('active'));
      this.switchMode('latest');
    } else {
      this.state.activeGenreId = id;
      this.state.activeGenre = name;
      document.querySelectorAll('[data-genre-id]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll(`[data-genre-id="${id}"]`).forEach(b => b.classList.add('active'));
      this.switchMode('genre');
    }
  },

  // ─── Mode switching ───────────────────────────────────────────
  switchMode(mode) {
    this.state.mode = mode;
    this.state.page = 1;
    this.state.releases = [];
    this.clearGrid();
    this.updateSectionTitle();
    if (mode === 'latest') this.loadLatest(true);
    else if (mode === 'ongoing') this.loadOngoing(true);
    else if (mode === 'genre') this.loadByGenre(true);
    else if (mode === 'search') this.loadSearch(true);
  },

  updateSectionTitle() {
    const title = document.getElementById('sectionMainTitle');
    const subtitle = document.getElementById('sectionSubtitle');
    if (!title) return;
    if (this.state.mode === 'latest') {
      title.textContent = 'Новинки аниме';
      if (subtitle) subtitle.textContent = 'Последние вышедшие серии';
    } else if (this.state.mode === 'ongoing') {
      title.textContent = '⏰ Онгоинги';
      if (subtitle) subtitle.textContent = 'Аниме, выходящие сейчас';
    } else if (this.state.mode === 'genre') {
      title.textContent = `🎭 ${this.state.activeGenre}`;
      if (subtitle) subtitle.textContent = 'Аниме по жанру';
    } else if (this.state.mode === 'search') {
      title.textContent = `🔍 "${this.state.searchQuery}"`;
      if (subtitle) subtitle.textContent = 'Результаты поиска';
    }
  },

  // ─── Data loading ─────────────────────────────────────────────
  async loadLatest(reset = false) {
    if (this.state.loading) return;
    if (reset) { this.state.page = 1; this.state.releases = []; this.clearGrid(); }
    this.state.loading = true;
    this.showSkeletons();
    try {
      const data = await this.apiFetch('/anime/releases/latest', {
        limit: this.PAGE_SIZE,
        page: this.state.page,
      });
      const list = Array.isArray(data) ? data : (data.data || data.items || []);
      this.state.releases.push(...list);
      this.hideSkeletons();
      this.renderCards(list, reset);
      // Setup hero on first load
      if (reset && list.length > 0) this.setupHero(list.slice(0, 5));
      this.state.page++;
      this.updateLoadMore(list.length >= this.PAGE_SIZE);
    } catch (e) {
      this.hideSkeletons();
      this.showError('Не удалось загрузить список аниме. Проверьте подключение.');
      console.error(e);
    }
    this.state.loading = false;
  },

  async loadOngoing(reset = false) {
    if (this.state.loading) return;
    if (reset) { this.state.releases = []; this.clearGrid(); }
    this.state.loading = true;
    this.showSkeletons();
    try {
      const data = await this.apiFetch('/anime/releases/latest', {
        limit: 100,
        page: 1,
      });
      const list = (Array.isArray(data) ? data : (data.data || data.items || []))
        .filter(release => release.is_ongoing);
      this.state.releases.push(...list);
      this.hideSkeletons();
      if (list.length === 0) this.showEmpty('Онгоингов пока нет', 'Попробуйте обновить список позже');
      else this.renderCards(list, reset);
      this.updateLoadMore(false);
    } catch (e) {
      this.hideSkeletons();
      this.showError('Не удалось загрузить онгоинги. Проверьте подключение.');
      console.error(e);
    }
    this.state.loading = false;
  },

  async loadByGenre(reset = false) {
    if (this.state.loading || !this.state.activeGenreId) return;
    if (reset) { this.state.page = 1; this.state.releases = []; this.clearGrid(); }
    this.state.loading = true;
    this.showSkeletons();
    try {
      const data = await this.apiFetch('/anime/releases/latest', {
        genres: [this.state.activeGenreId],
        limit: this.PAGE_SIZE,
        page: reset ? 1 : this.state.page,
      });
      let list = Array.isArray(data) ? data : (data.data || data.items || []);
      if (list.length === 0 && reset) {
        const releases = await this.loadCatalogPages(20);
        list = releases.filter(release =>
          (release.genres || []).some(genre => Number(genre.id) === Number(this.state.activeGenreId))
        ).slice(0, this.PAGE_SIZE);
      }
      this.state.releases.push(...list);
      this.hideSkeletons();
      if (list.length === 0) this.showEmpty('В этом жанре ничего не найдено', 'Попробуйте другой жанр');
      else this.renderCards(list, reset);
      this.state.page++;
      this.updateLoadMore(list.length >= this.PAGE_SIZE);
    } catch (e) {
      this.hideSkeletons();
      this.showError('Не удалось загрузить аниме по жанру.');
      console.error(e);
    }
    this.state.loading = false;
  },

  async loadSearch(reset = false) {
    if (this.state.loading || !this.state.searchQuery.trim()) return;
    if (reset) { this.state.page = 1; this.state.releases = []; this.clearGrid(); }
    this.state.loading = true;
    this.showSkeletons();
    try {
      const data = await this.apiFetch('/anime/releases/latest', {
        search: this.state.searchQuery,
        limit: this.PAGE_SIZE,
        page: reset ? 1 : this.state.page,
      });
      let list = Array.isArray(data) ? data : (data.data || data.items || []);
      if (list.length === 0 && reset) {
        const releases = await this.loadCatalogPages(20);
        const query = this.state.searchQuery.toLocaleLowerCase('ru');
        list = releases.filter(release => {
          const name = release.name || {};
          return [name.main, name.english, name.alternative, release.alias]
            .filter(Boolean)
            .some(value => String(value).toLocaleLowerCase('ru').includes(query));
        }).slice(0, this.PAGE_SIZE);
      }
      this.state.releases.push(...list);
      this.hideSkeletons();
      if (list.length === 0 && reset) this.showEmpty('По запросу ничего не найдено', 'Попробуйте другой запрос');
      else this.renderCards(list, reset);
      this.state.page++;
      this.updateLoadMore(list.length >= this.PAGE_SIZE);
    } catch (e) {
      this.hideSkeletons();
      this.showError('Ошибка поиска. Попробуйте ещё раз.');
      console.error(e);
    }
    this.state.loading = false;
  },

  async loadCatalogPages(pageCount = 20) {
    if (!this._catalogCache) this._catalogCache = [];
    const loadedPages = this._catalogPageCount || 0;
    if (loadedPages < pageCount) {
      const from = loadedPages + 1;
      const requests = [];
      for (let page = from; page <= pageCount; page++) {
        requests.push(
          this.apiFetch('/anime/releases/latest', { limit: 24, page })
            .then(data => Array.isArray(data) ? data : (data.data || data.items || []))
            .catch(() => [])
        );
      }
      const pages = await Promise.all(requests);
      this._catalogCache.push(...pages.flat());
      this._catalogPageCount = pageCount;
    }
    return this._catalogCache;
  },

  async loadReleaseDetail(id) {
    try {
      const data = await this.apiFetch(`/anime/releases/${id}`);
      return data;
    } catch (e) {
      console.error('Failed to load release detail:', e);
      return null;
    }
  },

  // ─── Grid rendering ───────────────────────────────────────────
  clearGrid() {
    const grid = document.getElementById('cardsGrid');
    if (grid) grid.innerHTML = '';
  },

  renderCards(releases, reset = false) {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    if (reset) grid.innerHTML = '';
    if (releases.length === 0) return;

    releases.forEach(r => {
      const card = this.createCard(r);
      grid.appendChild(card);
    });
  },

  createCard(r) {
    const name = r.name?.main || 'Без названия';
    const nameEn = r.name?.english || '';
    const posterPath = r.poster?.optimized?.thumbnail || r.poster?.thumbnail || r.poster?.src || '';
    const posterUrl = posterPath ? (this.IMG + posterPath) : '';
    const rating = r.shikimori?.rating || r.mal?.rating || null;
    const genres = r.genres || [];
    const isOngoing = r.is_ongoing;
    const type = r.type?.description || r.type?.value || '';
    const year = r.year || '';
    const epCount = r.episodes_total;

    const card = document.createElement('div');
    card.className = 'anime-card';
    card.dataset.id = r.id;

    const isListView = this.state.viewMode === 'list';

    card.innerHTML = `
      <div class="card-poster-wrap">
        ${posterUrl
          ? `<img class="card-poster" src="${posterUrl}" alt="${this.esc(name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <div class="card-poster-placeholder" style="display:${posterUrl ? 'none' : 'flex'}">
          <img src="assets/logo-dark.png" alt="Sakura Cinema">
        </div>
        <div class="card-hover-overlay">
          <button class="card-play-btn" aria-label="Смотреть">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            Смотреть
          </button>
          <div class="card-genres-mini">
            ${genres.slice(0,2).map(g => `<span class="card-genre-mini">${this.esc(g.name)}</span>`).join('')}
          </div>
        </div>
        <div class="card-badges">
          ${isOngoing ? '<span class="card-badge ongoing">●&nbsp;Онгоинг</span>' : ''}
          ${type ? `<span class="card-badge type">${type}</span>` : ''}
        </div>
        ${rating ? `
          <div class="card-rating-badge">
            ★ ${parseFloat(rating).toFixed(1)}
          </div>` : ''}
      </div>
      <div class="card-info">
        <div class="card-title">${this.esc(name)}</div>
        ${nameEn ? `<div class="card-title-en">${this.esc(nameEn)}</div>` : ''}
        ${isListView ? `
          <div class="card-genres-list">
            ${genres.slice(0,4).map(g => `<span class="card-genre-tag">${this.esc(g.name)}</span>`).join('')}
          </div>` : ''}
        <div class="card-meta">
          ${year ? `<span>${year}</span>` : ''}
          ${year && type ? '<span class="card-meta-sep">·</span>' : ''}
          ${type ? `<span>${type}</span>` : ''}
          ${epCount ? `<span class="card-eps-badge">${epCount} эп.</span>` : ''}
        </div>
      </div>
    `;

    card.addEventListener('click', () => this.openPlayer(r));
    card.querySelector('.card-play-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openPlayer(r);
    });

    return card;
  },

  // ─── Skeleton loaders ─────────────────────────────────────────
  showSkeletons(count = 8) {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    for (let i = 0; i < count; i++) {
      const sk = document.createElement('div');
      sk.className = 'anime-card skeleton skeleton-card';
      sk.innerHTML = `
        <div class="skeleton skeleton-poster"></div>
        <div class="skeleton-info">
          <div class="skeleton-line w80"></div>
          <div class="skeleton-line w60"></div>
          <div class="skeleton-line w40"></div>
        </div>
      `;
      grid.appendChild(sk);
    }
  },

  hideSkeletons() {
    document.querySelectorAll('.skeleton-card').forEach(el => el.remove());
  },

  showEmpty(title, desc) {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    grid.innerHTML = `
      <div class="state-empty">
        <span class="state-icon">🔍</span>
        <h3>${title}</h3>
        <p>${desc}</p>
      </div>
    `;
  },

  showError(msg) {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    grid.innerHTML = `
      <div class="state-empty">
        <span class="state-icon">⚠️</span>
        <h3>Ошибка загрузки</h3>
        <p>${msg}</p>
      </div>
    `;
  },

  // ─── Load more ────────────────────────────────────────────────
  updateLoadMore(hasMore) {
    const btn = document.getElementById('loadMoreBtn');
    if (!btn) return;
    btn.style.display = hasMore ? 'flex' : 'none';
    btn.disabled = false;
    btn.classList.remove('loading');
  },

  // ─── Hero slider ──────────────────────────────────────────────
  setupHero(releases) {
    this.state.featured = releases;
    this.state.heroIndex = 0;
    const hero = document.getElementById('aniHero');
    if (!hero) return;
    hero.classList.add('ready');
    this.renderHeroSlide(0);
    this.renderHeroDots();
    this.startHeroTimer();
  },

  renderHeroSlide(index) {
    const r = this.state.featured[index];
    if (!r) return;

    const bg = document.getElementById('heroBg');
    const title = document.getElementById('heroTitle');
    const titleEn = document.getElementById('heroTitleEn');
    const desc = document.getElementById('heroDesc');
    const genres = document.getElementById('heroGenres');
    const badges = document.getElementById('heroBadges');

    const posterPath = r.poster?.optimized?.preview || r.poster?.src || '';
    const posterUrl = posterPath ? (this.IMG + posterPath) : '';

    if (bg && posterUrl) bg.style.backgroundImage = `url('${posterUrl}')`;
    if (title) title.textContent = r.name?.main || '';
    if (titleEn) titleEn.textContent = r.name?.english || '';
    if (desc) desc.textContent = r.description || '';
    if (badges) {
      badges.innerHTML = `
        ${r.is_ongoing ? '<span class="hero-badge ongoing">● Онгоинг</span>' : ''}
        ${r.type?.description ? `<span class="hero-badge type">${r.type.description}</span>` : ''}
        ${r.year ? `<span class="hero-badge year">${r.year}</span>` : ''}
      `;
    }
    if (genres) {
      genres.innerHTML = (r.genres || []).slice(0, 5)
        .map(g => `<span class="hero-genre-tag">${g.name}</span>`)
        .join('');
    }

    // Store current release for play button
    document.getElementById('heroPlayBtn')?.setAttribute('data-id', r.id);
    document.getElementById('heroInfoBtn')?.setAttribute('data-id', r.id);
    this._heroRelease = r;

    // Update dots
    document.querySelectorAll('.hero-dot').forEach((d, i) => {
      d.classList.toggle('active', i === index);
    });
    this.state.heroIndex = index;
  },

  renderHeroDots() {
    const container = document.getElementById('heroDots');
    if (!container) return;
    container.innerHTML = '';
    this.state.featured.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'hero-dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', () => {
        clearInterval(this.state.heroTimer);
        this.renderHeroSlide(i);
        this.startHeroTimer();
      });
      container.appendChild(dot);
    });
  },

  startHeroTimer() {
    clearInterval(this.state.heroTimer);
    this.state.heroTimer = setInterval(() => {
      const next = (this.state.heroIndex + 1) % this.state.featured.length;
      this.renderHeroSlide(next);
    }, 6000);
  },

  // ─── Header UI bindings ───────────────────────────────────────
  bindHeaderUI() {
    // Search
    const searchForm = document.getElementById('aniSearchForm');
    const searchInput = document.getElementById('aniSearchInput');
    const searchClear = document.getElementById('aniSearchClear');

    searchForm?.addEventListener('submit', e => {
      e.preventDefault();
      const q = searchInput?.value.trim();
      if (q) {
        this.state.searchQuery = q;
        // Clear genre selection
        this.state.activeGenreId = null;
        document.querySelectorAll('[data-genre-id]').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-all]')?.classList.add('active');
        this.switchMode('search');
      }
    });

    searchInput?.addEventListener('input', () => {
      if (searchClear) searchClear.classList.toggle('visible', searchInput.value.length > 0);
      if (searchInput.value.length === 0 && this.state.mode === 'search') {
        this.switchMode('latest');
      }
    });

    searchClear?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      searchClear.classList.remove('visible');
      if (this.state.mode === 'search') this.switchMode('latest');
    });

    // View toggle
    document.getElementById('viewGrid')?.addEventListener('click', () => this.setView('grid'));
    document.getElementById('viewList')?.addEventListener('click', () => this.setView('list'));

    // "Все" pill
    document.querySelector('[data-all]')?.addEventListener('click', () => {
      document.querySelectorAll('[data-genre-id]').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-all]')?.classList.add('active');
      this.state.activeGenreId = null;
      this.state.activeGenre = null;
      if (searchInput) searchInput.value = '';
      if (searchClear) searchClear.classList.remove('visible');
      this.switchMode('latest');
    });

    // Load more
    document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
      const btn = document.getElementById('loadMoreBtn');
      if (btn) { btn.disabled = true; btn.classList.add('loading'); }
      if (this.state.mode === 'latest') this.loadLatest();
      else if (this.state.mode === 'ongoing') this.loadOngoing();
      else if (this.state.mode === 'genre') this.loadByGenre();
      else if (this.state.mode === 'search') this.loadSearch();
    });

    // Hero buttons
    document.getElementById('heroPlayBtn')?.addEventListener('click', () => {
      if (this._heroRelease) this.openPlayer(this._heroRelease);
    });
    document.getElementById('heroInfoBtn')?.addEventListener('click', () => {
      if (this._heroRelease) this.openPlayer(this._heroRelease);
    });

    // Hero prev/next
    document.getElementById('heroPrev')?.addEventListener('click', () => {
      clearInterval(this.state.heroTimer);
      const prev = (this.state.heroIndex - 1 + this.state.featured.length) % this.state.featured.length;
      this.renderHeroSlide(prev);
      this.startHeroTimer();
    });
    document.getElementById('heroNext')?.addEventListener('click', () => {
      clearInterval(this.state.heroTimer);
      const next = (this.state.heroIndex + 1) % this.state.featured.length;
      this.renderHeroSlide(next);
      this.startHeroTimer();
    });

    // Sidebar nav
    document.getElementById('navLatest')?.addEventListener('click', () => {
      this.state.activeGenreId = null;
      document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
      document.getElementById('navLatest')?.classList.add('active');
      this.switchMode('latest');
    });

    document.getElementById('navOngoing')?.addEventListener('click', () => {
      this.state.activeGenreId = null;
      document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
      document.getElementById('navOngoing')?.classList.add('active');
      this.switchMode('ongoing');
    });
  },

  setView(mode) {
    this.state.viewMode = mode;
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    grid.classList.toggle('list-view', mode === 'list');
    document.getElementById('viewGrid')?.classList.toggle('active', mode === 'grid');
    document.getElementById('viewList')?.classList.toggle('active', mode === 'list');
    // Re-render existing cards
    const releases = this.state.releases.slice();
    this.state.releases = [];
    this.clearGrid();
    this.state.releases = releases;
    this.renderCards(releases, true);
  },

  // ─── Player ───────────────────────────────────────────────────
  bindPlayerUI() {
    document.getElementById('playerCloseBtn')?.addEventListener('click', () => this.closePlayer());
    document.getElementById('playerBackdrop')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) this.closePlayer();
    });

    // Quality buttons
    document.querySelectorAll('.quality-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.quality;
        this.setQuality(q);
      });
    });

    // Episode nav
    document.getElementById('epPrevBtn')?.addEventListener('click', () => this.navigateEpisode(-1));
    document.getElementById('epNextBtn')?.addEventListener('click', () => this.navigateEpisode(1));

    const video = document.getElementById('animeVideoPlayer');
    const playBtn = document.getElementById('customPlayBtn');
    const muteBtn = document.getElementById('customMuteBtn');
    const progress = document.getElementById('customPlayerProgress');
    const volume = document.getElementById('customPlayerVolume');
    const time = document.getElementById('customPlayerTime');
    const fullscreenBtn = document.getElementById('customFullscreenBtn');
    const speedBtn = document.getElementById('customPlayerSpeed');
    const closeBtn = document.getElementById('customCloseBtn');
    const backBtn = document.getElementById('customBackBtn');
    const forwardBtn = document.getElementById('customForwardBtn');
    const nextBtn = document.getElementById('customNextBtn');
    const qualityBtn = document.getElementById('customQualityBtn');
    const qualityMenu = document.getElementById('customQualityMenu');
    const qualityText = document.getElementById('customQualityText');
    const controls = document.getElementById('customPlayerControls');
    const topbar = document.querySelector('.custom-player-topbar');
    let controlsTimer;

    const showPlayerControls = () => {
      controls?.classList.remove('hidden');
      topbar?.classList.remove('hidden');
      clearTimeout(controlsTimer);
      if (!video?.paused) {
        controlsTimer = setTimeout(() => {
          controls?.classList.add('hidden');
          topbar?.classList.add('hidden');
        }, 2600);
      }
    };

    playBtn?.addEventListener('click', () => {
      if (!video) return;
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    });
    video?.addEventListener('click', () => playBtn?.click());
    video?.addEventListener('play', () => {
      if (playBtn) playBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    });
    video?.addEventListener('pause', () => {
      if (playBtn) playBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
    });
    video?.addEventListener('timeupdate', () => {
      if (!video.duration) return;
      if (progress) progress.value = String(Math.round((video.currentTime / video.duration) * 1000));
      if (time) time.textContent = `${this.fmtDuration(video.currentTime)} / ${this.fmtDuration(video.duration)}`;
    });
    video?.addEventListener('ended', () => this.navigateEpisode(1));
    progress?.addEventListener('input', () => {
      if (video?.duration) video.currentTime = (Number(progress.value) / 1000) * video.duration;
    });
    volume?.addEventListener('input', () => {
      if (video) {
        video.volume = Number(volume.value);
        video.muted = video.volume === 0;
      }
    });
    muteBtn?.addEventListener('click', () => {
      if (video) video.muted = !video.muted;
      if (muteBtn) muteBtn.classList.toggle('muted', video?.muted);
    });
    fullscreenBtn?.addEventListener('click', () => {
      const wrap = document.getElementById('playerVideoWrap');
      if (!document.fullscreenElement) wrap?.requestFullscreen?.();
      else document.exitFullscreen?.();
    });

    // Кнопка масштаба: contain <-> cover
    const fitBtn = document.getElementById('customFitBtn');
    const fitIconContain = document.getElementById('fitIconContain');
    const fitIconCover   = document.getElementById('fitIconCover');
    let isCover = false;
    fitBtn?.addEventListener('click', () => {
      isCover = !isCover;
      const v = document.getElementById('animeVideoPlayer');
      if (v) v.classList.toggle('fit-cover', isCover);
      fitBtn.classList.toggle('active', isCover);
      if (fitIconContain) fitIconContain.style.display = isCover ? 'none'  : '';
      if (fitIconCover)   fitIconCover.style.display   = isCover ? ''      : 'none';
      fitBtn.title = isCover ? 'Масштаб: на весь экран (нажми чтобы вписать)' : 'Масштаб: вписать / на весь экран';
    });
    speedBtn?.addEventListener('click', () => {
      if (!video) return;
      const speeds = [1, 1.25, 1.5, 2, 0.75];
      const next = speeds[(speeds.indexOf(video.playbackRate) + 1) % speeds.length];
      video.playbackRate = next;
      speedBtn.textContent = `${next}x`;
    });
    closeBtn?.addEventListener('click', () => this.closePlayer());
    backBtn?.addEventListener('click', () => {
      if (video) video.currentTime = Math.max(0, video.currentTime - 10);
    });
    forwardBtn?.addEventListener('click', () => {
      if (video) video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
    });
    nextBtn?.addEventListener('click', () => this.navigateEpisode(1));
    qualityBtn?.addEventListener('click', () => {
      const open = qualityMenu?.classList.toggle('open');
      qualityBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    qualityMenu?.querySelectorAll('[data-quality]').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.quality;
        this.setQuality(q);
        qualityMenu.classList.remove('open');
        qualityBtn?.setAttribute('aria-expanded', 'false');
        if (qualityText) qualityText.textContent = `${q}p`;
        qualityMenu.querySelectorAll('[data-quality]').forEach(item =>
          item.classList.toggle('active', item.dataset.quality === q)
        );
      });
    });
    document.getElementById('playerVideoWrap')?.addEventListener('mousemove', showPlayerControls);
    document.getElementById('playerVideoWrap')?.addEventListener('touchstart', showPlayerControls);
    video?.addEventListener('play', showPlayerControls);

    // Description expand
    document.getElementById('detailDescToggle')?.addEventListener('click', () => {
      const desc = document.getElementById('detailDesc');
      const toggle = document.getElementById('detailDescToggle');
      if (desc && toggle) {
        desc.classList.toggle('expanded');
        toggle.textContent = desc.classList.contains('expanded') ? 'Свернуть' : 'Читать ещё';
      }
    });

    // Keyboard
    document.addEventListener('keydown', e => {
      if (!document.getElementById('playerBackdrop')?.classList.contains('open')) return;
      if (e.key === 'Escape') this.closePlayer();
      if (e.key === 'ArrowRight') this.navigateEpisode(1);
      if (e.key === 'ArrowLeft') this.navigateEpisode(-1);
    });
  },

  async openPlayer(release) {
    // Show modal immediately with available data
    const modal = document.getElementById('playerBackdrop');
    if (modal) modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Show spinner
    const spinner = document.getElementById('playerSpinner');
    if (spinner) spinner.classList.add('visible');

    // Try to fetch full release data (with episodes)
    let fullRelease = release;
    if (!release.episodes || release.episodes.length === 0) {
      try {
        const detail = await this.loadReleaseDetail(release.id);
        if (detail && detail.episodes && detail.episodes.length > 0) {
          fullRelease = detail;
        } else if (release.latest_episode) {
          fullRelease = { ...release, episodes: [release.latest_episode] };
        } else if (detail) {
          fullRelease = detail;
        }
      } catch (e) {
        if (release.latest_episode) {
          fullRelease = { ...release, episodes: [release.latest_episode] };
        }
      }
    }

    this.state.currentRelease = fullRelease;
    this.state.currentEpIndex = 0;

    // Render detail panel
    this.renderDetailPanel(fullRelease);
    // Render episodes
    this.renderEpisodesList(fullRelease.episodes || []);
    // Update modal title
    const modalTitle = document.getElementById('playerModalTitle');
    if (modalTitle) modalTitle.textContent = fullRelease.name?.main || 'Просмотр';

    // Hide spinner
    if (spinner) spinner.classList.remove('visible');

    // Auto-play first episode
    const episodes = fullRelease.episodes || [];
    if (episodes.length > 0) {
      this.playEpisode(0);
    } else {
      // No HLS available
      this.showPlayerMessage('У этого аниме пока нет доступных серий');
    }
  },

  closePlayer() {
    const modal = document.getElementById('playerBackdrop');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';

    // Destroy HLS
    if (this.state.hls) {
      this.state.hls.destroy();
      this.state.hls = null;
    }
    const video = document.getElementById('animeVideoPlayer');
    if (video) {
      video.pause();
      video.src = '';
    }
    const progress = document.getElementById('customPlayerProgress');
    const time = document.getElementById('customPlayerTime');
    if (progress) progress.value = '0';
    if (time) time.textContent = '0:00 / 0:00';
  },

  renderDetailPanel(r) {
    const name = r.name?.main || '';
    const nameEn = r.name?.english || '';
    const posterPath = r.poster?.optimized?.src || r.poster?.src || '';
    const posterUrl = posterPath ? (this.IMG + posterPath) : '';
    const rating = r.shikimori?.rating || r.mal?.rating || null;
    const genres = r.genres || [];
    const isOngoing = r.is_ongoing;
    const type = r.type?.description || '';
    const year = r.year || '';
    const favs = r.added_in_users_favorites;

    // Poster
    const posterEl = document.getElementById('detailPoster');
    if (posterEl) {
      posterEl.src = posterUrl || '';
      posterEl.alt = name;
      if (!posterUrl) posterEl.style.display = 'none';
    }

    // Titles
    const titleEl = document.getElementById('detailTitle');
    if (titleEl) titleEl.textContent = name;
    const titleEnEl = document.getElementById('detailTitleEn');
    if (titleEnEl) titleEnEl.textContent = nameEn;

    // Badges
    const metaRow = document.getElementById('detailMeta');
    if (metaRow) {
      metaRow.innerHTML = `
        ${rating ? `<span class="detail-badge rating">★ ${parseFloat(rating).toFixed(1)}</span>` : ''}
        ${type ? `<span class="detail-badge type">${type}</span>` : ''}
        ${year ? `<span class="detail-badge year">${year}</span>` : ''}
        ${isOngoing ? '<span class="detail-badge ongoing">● Онгоинг</span>' : ''}
      `;
    }

    // Genres
    const genresEl = document.getElementById('detailGenres');
    if (genresEl) {
      genresEl.innerHTML = genres.map(g =>
        `<span class="detail-genre" data-genre-id="${g.id}" data-genre-name="${g.name}">${g.name}</span>`
      ).join('');
      genresEl.querySelectorAll('.detail-genre').forEach(el => {
        el.addEventListener('click', () => {
          this.closePlayer();
          this.selectGenre(parseInt(el.dataset.genreId), el.dataset.genreName, el);
        });
      });
    }

    // Description
    const descEl = document.getElementById('detailDesc');
    if (descEl) {
      descEl.textContent = r.description || 'Описание отсутствует.';
      descEl.classList.remove('expanded');
    }
    const descToggle = document.getElementById('detailDescToggle');
    if (descToggle) descToggle.textContent = 'Читать ещё';

    // Stats
    const watchingEl = document.getElementById('statWatching');
    if (watchingEl) watchingEl.textContent = this.fmtNum(r.added_in_watching_collection);
    const favsEl = document.getElementById('statFavs');
    if (favsEl) favsEl.textContent = this.fmtNum(favs);
  },

  renderEpisodesList(episodes) {
    const list = document.getElementById('episodesList');
    const count = document.getElementById('episodesCount');
    if (!list) return;

    if (count) count.textContent = `${episodes.length} серий`;
    list.innerHTML = '';

    if (episodes.length === 0) {
      list.innerHTML = '<div class="state-empty" style="padding:40px 20px"><span class="state-icon" style="font-size:36px">📺</span><h3>Серии не найдены</h3><p>Возможно, они появятся позже</p></div>';
      return;
    }

    // Sort by ordinal
    const sorted = [...episodes].sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));

    sorted.forEach((ep, idx) => {
      const item = document.createElement('div');
      item.className = 'episode-item';
      item.dataset.epIdx = idx;

      const thumbPath = ep.preview?.optimized?.thumbnail || ep.preview?.thumbnail || '';
      const thumbUrl = thumbPath ? (this.IMG + thumbPath) : '';
      const dur = ep.duration ? this.fmtDuration(ep.duration) : '';

      item.innerHTML = `
        <div class="ep-thumbnail">
          ${thumbUrl
            ? `<img src="${thumbUrl}" alt="Серия ${ep.ordinal}" loading="lazy" onerror="this.style.display='none'">`
            : '<div class="ep-thumbnail-placeholder">▶</div>'}
          <div class="ep-play-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
          </div>
        </div>
        <div class="ep-info">
          <div class="ep-number">Серия ${ep.ordinal}</div>
          <div class="ep-name">${ep.name ? this.esc(ep.name) : `Серия ${ep.ordinal}`}</div>
          ${dur ? `<div class="ep-duration">⏱ ${dur}</div>` : ''}
        </div>
      `;

      item.addEventListener('click', () => {
        // Find real index in original sorted array
        this.playEpisode(idx);
      });

      list.appendChild(item);
    });

    // Store sorted episodes reference
    this._sortedEpisodes = sorted;
  },

  playEpisode(idx) {
    const episodes = this._sortedEpisodes || this.state.currentRelease?.episodes || [];
    const ep = episodes[idx];
    if (!ep) return;

    this.state.currentEpIndex = idx;

    // Highlight active episode
    document.querySelectorAll('.episode-item').forEach((el, i) => {
      el.classList.toggle('active', i === idx);
    });

    // Scroll active into view
    const activeEl = document.querySelector(`.episode-item[data-ep-idx="${idx}"]`);
    if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Update nav buttons
    const prevBtn = document.getElementById('epPrevBtn');
    const nextBtn = document.getElementById('epNextBtn');
    const counter = document.getElementById('epCounter');
    if (prevBtn) prevBtn.disabled = idx === 0;
    if (nextBtn) nextBtn.disabled = idx >= episodes.length - 1;
    if (counter) counter.textContent = `${idx + 1} / ${episodes.length}`;
    const now = document.getElementById('customPlayerNow');
    if (now) now.textContent = `${this.state.currentRelease?.name?.main || 'Просмотр'} — Серия ${ep.ordinal || idx + 1}`;

    // Load HLS
    this.loadHLS(ep);
  },

  navigateEpisode(delta) {
    const episodes = this._sortedEpisodes || this.state.currentRelease?.episodes || [];
    const newIdx = this.state.currentEpIndex + delta;
    if (newIdx >= 0 && newIdx < episodes.length) {
      this.playEpisode(newIdx);
    }
  },

  loadHLS(ep) {
    const video = document.getElementById('animeVideoPlayer');
    const spinner = document.getElementById('playerSpinner');
    if (!video) return;

    // Determine URL based on quality
    const quality = this.state.currentQuality;
    const url = ep[`hls_${quality}`] || ep.hls_720 || ep.hls_1080 || ep.hls_480;

    if (!url) {
      this.showPlayerMessage('Видео для этой серии недоступно');
      return;
    }

    if (spinner) spinner.classList.add('visible');

    // Destroy previous HLS
    if (this.state.hls) {
      this.state.hls.destroy();
      this.state.hls = null;
    }

    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });
      this.state.hls = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (spinner) spinner.classList.remove('visible');
        video.play().catch(() => {});
        this.updateQualityButtons(ep);
      });
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          if (spinner) spinner.classList.remove('visible');
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            this.showToast('⚠️ Ошибка сети. Пробуем другое качество...', 'error');
            // Try fallback quality
            const fallback = quality === '1080' ? '720' : quality === '720' ? '480' : null;
            if (fallback && ep[`hls_${fallback}`]) {
              this.state.currentQuality = fallback;
              this.updateQualityBtnsUI(fallback);
              this.loadHLS(ep);
            }
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        if (spinner) spinner.classList.remove('visible');
        video.play().catch(() => {});
      });
    } else {
      if (spinner) spinner.classList.remove('visible');
      this.showPlayerMessage('Ваш браузер не поддерживает HLS воспроизведение');
    }
  },

  updateQualityButtons(ep) {
    const q480 = document.getElementById('q480');
    const q720 = document.getElementById('q720');
    const q1080 = document.getElementById('q1080');
    if (q480) q480.disabled = !ep.hls_480;
    if (q720) q720.disabled = !ep.hls_720;
    if (q1080) q1080.disabled = !ep.hls_1080;
    this.updateQualityBtnsUI(this.state.currentQuality);
    document.getElementById('customQualityText')?.replaceChildren(
      document.createTextNode(`${this.state.currentQuality}p`)
    );
    document.querySelectorAll('.custom-quality-menu [data-quality]').forEach(btn => {
      const available = btn.dataset.quality === '480' ? ep.hls_480
        : btn.dataset.quality === '720' ? ep.hls_720
        : ep.hls_1080;
      btn.disabled = !available;
      btn.classList.toggle('active', btn.dataset.quality === this.state.currentQuality);
    });
  },

  updateQualityBtnsUI(quality) {
    document.querySelectorAll('.quality-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.quality === quality);
    });
  },

  setQuality(q) {
    if (this.state.currentQuality === q) return;
    this.state.currentQuality = q;
    this.updateQualityBtnsUI(q);
    // Reload current episode at new quality
    const episodes = this._sortedEpisodes || this.state.currentRelease?.episodes || [];
    const ep = episodes[this.state.currentEpIndex];
    if (ep) {
      const currentTime = document.getElementById('animeVideoPlayer')?.currentTime || 0;
      this.loadHLS(ep);
      // Restore position after load
      const video = document.getElementById('animeVideoPlayer');
      if (video && currentTime > 0) {
        video.addEventListener('canplay', function seek() {
          video.currentTime = currentTime;
          video.removeEventListener('canplay', seek);
        });
      }
    }
  },

  showPlayerMessage(msg) {
    const wrap = document.getElementById('playerVideoWrap');
    if (!wrap) return;
    let msgEl = wrap.querySelector('.player-message');
    if (!msgEl) {
      msgEl = document.createElement('div');
      msgEl.className = 'player-message';
      msgEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:14px;background:rgba(0,0,0,0.6);text-align:center;padding:20px;';
      wrap.appendChild(msgEl);
    }
    msgEl.textContent = msg;
  },

  // ─── Particles (sakura petals) ───────────────────────────────
  startParticles() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let petals = [];
    let W = window.innerWidth, H = window.innerHeight;

    const resize = () => { canvas.width = W = window.innerWidth; canvas.height = H = window.innerHeight; };
    window.addEventListener('resize', resize);
    resize();

    const spawnPetal = () => ({
      x: Math.random() * W,
      y: -20,
      size: Math.random() * 8 + 4,
      speed: Math.random() * 1.5 + 0.5,
      drift: Math.random() * 1.5 - 0.75,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.05,
      alpha: Math.random() * 0.4 + 0.2,
      hue: Math.random() * 40 - 20, // around pink
    });

    for (let i = 0; i < 25; i++) {
      const p = spawnPetal();
      p.y = Math.random() * H;
      petals.push(p);
    }

    const drawPetal = (p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
      grad.addColorStop(0, `hsla(${340 + p.hue}, 100%, 85%, 1)`);
      grad.addColorStop(1, `hsla(${330 + p.hue}, 80%, 60%, 0)`);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    };

    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      petals.forEach(p => {
        p.y += p.speed;
        p.x += p.drift + Math.sin(p.y * 0.02) * 0.3;
        p.rot += p.rotSpeed;
        drawPetal(p);
        if (p.y > H + 20) Object.assign(p, spawnPetal());
      });
      requestAnimationFrame(tick);
    };
    tick();
  },

  // ─── Toast notifications ──────────────────────────────────────
  showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  },

  // ─── Utilities ────────────────────────────────────────────────
  esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  fmtNum(n) {
    if (!n) return '0';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  },

  fmtDuration(secs) {
    let value = Number(secs);
    if (!Number.isFinite(value) || value < 0) return '0:00';
    if (value >= 1e9) value /= 1e9;
    else if (value >= 1e6) value /= 1e6;
    else if (value > 100000) value /= 1000;
    value = Math.max(0, Math.round(value));
    const h = Math.floor(value / 3600);
    const m = Math.floor((value % 3600) / 60);
    const s = value % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  },
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => ANI.init());
