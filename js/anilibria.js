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
  CONTINUE_WATCHING_KEY: 'sakura-anime-continue-watching-v1',

  // State
  state: {
    releases: [],
    page: 1,
    total: 0,
    loading: false,
    catalogRequestId: 0,
    mode: 'latest',      // 'latest' | 'ongoing' | 'genre' | 'search' | 'continue' | 'recommendations' | 'watching'
    activeGenre: null,
    activeGenreId: null,
    activeGenreIds: [],
    activeYear: null,
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
    currentQuality: '1080',
    hls: null,
    playerRequestId: 0,
  },

  // ─── Init ────────────────────────────────────────────────────
  init() {
    this.bindHeaderUI();
    this.bindPlayerUI();
    this.updateContinueWatchingCount();
    this.initCatalogFilters();
    this.loadGenres();
    this.loadLatest(true);
    this.startParticles();
  },

  initCatalogFilters() {
    const yearSelect = document.getElementById('yearFilter');
    if (!yearSelect) return;
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 1960; year--) {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = String(year);
      yearSelect.appendChild(option);
    }
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

  queueSearchPreview(query) {
    clearTimeout(this._searchPreviewTimer);
    this._searchPreviewRequestId = (this._searchPreviewRequestId || 0) + 1;
    const requestId = this._searchPreviewRequestId;
    if (query.length < 2) {
      this.hideSearchPreview();
      return;
    }

    this.renderSearchPreviewMessage('Ищем аниме…');
    this._searchPreviewTimer = setTimeout(() => this.loadSearchPreview(query, requestId), 250);
  },

  async loadSearchPreview(query, requestId) {
    try {
      const data = await this.apiFetch('/anime/catalog/releases', {
        'f[search]': query,
        limit: 6,
        page: 1,
      });
      if (requestId !== this._searchPreviewRequestId) return;
      const releases = Array.isArray(data) ? data : (data.data || data.items || []);
      this.renderSearchPreview(releases);
    } catch (error) {
      if (requestId !== this._searchPreviewRequestId) return;
      this.renderSearchPreviewMessage('Не удалось выполнить поиск. Попробуйте ещё раз.');
      console.warn('Search preview failed:', error);
    }
  },

  renderSearchPreviewMessage(message) {
    const preview = document.getElementById('aniSearchPreview');
    const input = document.getElementById('aniSearchInput');
    if (!preview) return;
    preview.replaceChildren();
    const status = document.createElement('div');
    status.className = 'ani-search-preview-state';
    status.setAttribute('role', 'status');
    status.textContent = message;
    preview.appendChild(status);
    preview.hidden = false;
    input?.setAttribute('aria-expanded', 'true');
  },

  renderSearchPreview(releases) {
    const preview = document.getElementById('aniSearchPreview');
    const input = document.getElementById('aniSearchInput');
    if (!preview) return;
    preview.replaceChildren();
    if (releases.length === 0) {
      this.renderSearchPreviewMessage('Ничего не найдено');
      return;
    }

    releases.forEach(release => {
      const title = release.name?.main || 'Без названия';
      const posterPath = release.poster?.optimized?.preview
        || release.poster?.preview
        || release.poster?.optimized?.src
        || release.poster?.src;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'ani-search-preview-item';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-label', `Открыть ${title}`);

      if (posterPath) {
        const poster = document.createElement('img');
        poster.src = this.IMG + posterPath;
        poster.alt = '';
        poster.loading = 'lazy';
        poster.onerror = () => poster.remove();
        item.appendChild(poster);
      }

      const info = document.createElement('span');
      info.className = 'ani-search-preview-info';
      const mainTitle = document.createElement('span');
      mainTitle.className = 'ani-search-preview-title';
      mainTitle.textContent = title;
      info.appendChild(mainTitle);

      const details = [release.name?.english, release.year, release.type?.description]
        .filter(Boolean)
        .join(' · ');
      if (details) {
        const subtitle = document.createElement('span');
        subtitle.className = 'ani-search-preview-details';
        subtitle.textContent = details;
        info.appendChild(subtitle);
      }
      item.appendChild(info);
      item.addEventListener('click', () => {
        this.hideSearchPreview();
        this.openPlayer(release);
      });
      preview.appendChild(item);
    });

    preview.hidden = false;
    input?.setAttribute('aria-expanded', 'true');
  },

  hideSearchPreview() {
    clearTimeout(this._searchPreviewTimer);
    this._searchPreviewRequestId = (this._searchPreviewRequestId || 0) + 1;
    const preview = document.getElementById('aniSearchPreview');
    if (preview) {
      preview.replaceChildren();
      preview.hidden = true;
    }
    document.getElementById('aniSearchInput')?.setAttribute('aria-expanded', 'false');
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
    this.syncGenreSelection();
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
    this.syncGenreSelection();
  },

  selectGenre(id, name, el) {
    const numericId = Number(id);
    const isSelected = this.state.activeGenreIds.includes(numericId);
    this.state.activeGenreIds = isSelected
      ? this.state.activeGenreIds.filter(genreId => genreId !== numericId)
      : [...this.state.activeGenreIds, numericId];
    this.state.activeGenreId = this.state.activeGenreIds[0] || null;
    this.state.activeGenre = this.state.activeGenreIds.length
      ? this.state.activeGenreIds
          .map(genreId => this.state.genres.find(genre => Number(genre.id) === genreId)?.name)
          .filter(Boolean)
          .join(', ')
      : null;
    this.syncGenreSelection(this.state.activeGenreId);
    document.querySelectorAll('.sidebar-nav-item').forEach(item => item.classList.remove('active'));
    if (this.state.activeGenreIds.length > 0) {
      this.switchMode('genre');
    } else {
      document.getElementById('navLatest')?.classList.add('active');
      this.switchMode('latest');
    }
  },

  syncGenreSelection(activeId = this.state.activeGenreId) {
    if (activeId == null) {
      this.state.activeGenreIds = [];
      this.state.activeGenreId = null;
      this.state.activeGenre = null;
    }
    const selectedIds = this.state.activeGenreIds;
    document.querySelectorAll('.gf-pill[data-genre-id], .genre-pill-btn[data-genre-id]').forEach(button => {
      button.classList.toggle(
        'active',
        selectedIds.includes(Number(button.dataset.genreId))
      );
    });
    document.querySelectorAll('[data-all]').forEach(button => {
      button.classList.toggle('active', selectedIds.length === 0);
    });
  },

  // ─── Mode switching ───────────────────────────────────────────
  switchMode(mode) {
    this.hideSearchPreview();
    this.state.catalogRequestId++;
    this.state.loading = false;
    this._genreFallbackResults = null;
    this.updateLoadMore(false);
    this.state.mode = mode;
    this.state.page = 1;
    this.state.releases = [];
    this.clearGrid();
    this.updateSectionTitle();
    if (mode === 'latest') this.loadLatest(true);
    else if (mode === 'ongoing') this.loadOngoing(true);
    else if (mode === 'genre') this.loadByGenre(true);
    else if (mode === 'search') this.loadSearch(true);
    else if (mode === 'continue') this.renderContinueWatching();
    else if (mode === 'recommendations') this.loadRecommendations(true);
    else if (mode === 'watching') this.loadWatching(true);
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
      title.textContent = this.state.activeGenre
        ? `🎭 ${this.state.activeGenre}`
        : '🎬 Каталог';
      if (subtitle) subtitle.textContent = this.state.activeYear
        ? `Фильтр: ${this.state.activeYear}`
        : 'Аниме по выбранным фильтрам';
    } else if (this.state.mode === 'search') {
      title.textContent = `🔍 "${this.state.searchQuery}"`;
      if (subtitle) subtitle.textContent = 'Результаты поиска';
    } else if (this.state.mode === 'continue') {
      title.textContent = '🍿 Досмотреть';
      if (subtitle) subtitle.textContent = 'Продолжите просмотр с сохранённого места';
    } else if (this.state.mode === 'recommendations') {
      title.textContent = '⭐ Рекомендации';
      if (subtitle) subtitle.textContent = 'Популярное по рейтингу и избранному';
    } else if (this.state.mode === 'watching') {
      title.textContent = '▶ Смотрят сейчас';
      if (subtitle) subtitle.textContent = 'Аниме с наибольшим количеством зрителей';
    }
  },

  readContinueWatching() {
    try {
      const saved = localStorage.getItem(this.CONTINUE_WATCHING_KEY);
      if (!saved) return [];
      const records = JSON.parse(saved);
      if (!Array.isArray(records)) throw new TypeError('Список продолжения должен быть массивом.');
      return records.filter(record =>
        record?.release?.id != null
        && Number.isFinite(Number(record.currentTime))
        && Number.isFinite(Number(record.duration))
        && Number(record.duration) > 0
      ).sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
    } catch (error) {
      this.reportContinueWatchingError(error);
      return [];
    }
  },

  writeContinueWatching(records) {
    try {
      localStorage.setItem(this.CONTINUE_WATCHING_KEY, JSON.stringify(records));
      this._continueWatchingStorageWarningShown = false;
      this.updateContinueWatchingCount(records.length);
    } catch (error) {
      this.reportContinueWatchingError(error);
    }
  },

  reportContinueWatchingError(error) {
    console.error('Could not access continue-watching storage:', error);
    if (this._continueWatchingStorageWarningShown) return;
    this._continueWatchingStorageWarningShown = true;
    this.showToast('Не удалось сохранить список «Досмотреть».', 'error');
  },

  updateContinueWatchingCount(count = this.readContinueWatching().length) {
    const badge = document.getElementById('continueWatchCount');
    if (!badge) return;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('visible', count > 0);
  },

  renderContinueWatching() {
    const records = this.readContinueWatching();
    this.updateContinueWatchingCount(records.length);
    this.updateLoadMore(false);
    if (records.length === 0) {
      this.showEmpty('Пока нечего досматривать', 'Начните смотреть серию — прогресс появится здесь.');
      const icon = document.querySelector('#cardsGrid .state-icon');
      if (icon) icon.textContent = '🍿';
      this.state.releases = [];
      return;
    }

    const releases = records.map(record => ({
      ...record.release,
      continueInfo: record,
    }));
    this.state.releases = releases;
    this.renderCards(releases, true);
  },

  saveCurrentWatchProgress(video) {
    const release = this.state.currentRelease;
    const episodes = this._sortedEpisodes || release?.episodes || [];
    const episode = episodes[this.state.currentEpIndex];
    if (!video || !release || !episode) return;
    this.saveContinueProgress(release, episode, video.currentTime, video.duration);
  },

  saveContinueProgress(release, episode, currentTime, duration) {
    if (release?.id == null || !episode || !Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return;

    const episodeOrdinal = episode.ordinal ?? this.state.currentEpIndex + 1;
    const sameEpisode = record =>
      String(record.release?.id) === String(release.id)
      && String(record.episodeOrdinal) === String(episodeOrdinal);
    const records = this.readContinueWatching();

    if (currentTime / duration >= 0.95) {
      this.writeContinueWatching(records.filter(record => !sameEpisode(record)));
      return;
    }
    if (currentTime < 5) return;

    const savedRelease = {
      id: release.id,
      name: {
        main: release.name?.main || '',
        english: release.name?.english || '',
      },
      poster: release.poster || null,
      type: release.type || null,
      year: release.year || null,
      episodes_total: release.episodes_total || null,
      is_ongoing: Boolean(release.is_ongoing),
      genres: (release.genres || []).map(genre => ({ id: genre.id, name: genre.name })),
      shikimori: release.shikimori || null,
      mal: release.mal || null,
    };
    const nextRecords = records.filter(record => !sameEpisode(record));
    nextRecords.unshift({
      release: savedRelease,
      episodeOrdinal,
      currentTime,
      duration,
      updatedAt: Date.now(),
    });
    this.writeContinueWatching(nextRecords.slice(0, 40));
  },

  // ─── Data loading ─────────────────────────────────────────────
  async loadLatest(reset = false) {
    if (this.state.loading) return;
    const requestId = this.state.catalogRequestId;
    if (reset) { this.state.page = 1; this.state.releases = []; this.clearGrid(); }
    this.state.loading = true;
    this.showSkeletons();
    try {
      const data = await this.apiFetch('/anime/releases/latest', {
        limit: this.PAGE_SIZE,
        page: this.state.page,
      });
      if (requestId !== this.state.catalogRequestId) return;
      const list = Array.isArray(data) ? data : (data.data || data.items || []);
      this.state.releases.push(...list);
      this.hideSkeletons();
      this.renderCards(list, reset);
      // Setup hero on first load
      if (reset && list.length > 0) this.setupHero(list.slice(0, 5));
      this.state.page++;
      this.updateLoadMore(list.length >= this.PAGE_SIZE);
    } catch (e) {
      if (requestId !== this.state.catalogRequestId) return;
      this.hideSkeletons();
      this.showError('Не удалось загрузить список аниме. Проверьте подключение.');
      this.updateLoadMore(false);
      console.error(e);
    }
    this.state.loading = false;
  },

  async loadOngoing(reset = false) {
    if (this.state.loading) return;
    const requestId = this.state.catalogRequestId;
    if (reset) {
      this._ongoingNextPage = 1;
      this._ongoingHasMore = true;
      this.state.releases = [];
      this.clearGrid();
    }
    this.state.loading = true;
    this.showSkeletons();
    try {
      const list = [];
      let pagesScanned = 0;
      while (this._ongoingHasMore && list.length < this.PAGE_SIZE && pagesScanned < 10) {
        const batchSize = Math.min(4, 10 - pagesScanned);
        const pages = Array.from({ length: batchSize }, (_, index) => this._ongoingNextPage + index);
        const responses = await Promise.all(pages.map(page =>
          this.apiFetch('/anime/releases/latest', { limit: this.PAGE_SIZE, page })
        ));
        if (requestId !== this.state.catalogRequestId) return;
        for (const data of responses) {
          this._ongoingNextPage++;
          pagesScanned++;
          const pageItems = Array.isArray(data) ? data : (data.data || data.items || []);
          list.push(...pageItems.filter(release => release.is_ongoing === true));
          if (pageItems.length < this.PAGE_SIZE) {
            this._ongoingHasMore = false;
            break;
          }
        }
      }
      if (list.length === 0) this._ongoingHasMore = false;
      this.state.releases.push(...list);
      this.hideSkeletons();
      if (list.length === 0 && reset) this.showEmpty('Онгоингов пока нет', 'Попробуйте обновить список позже');
      else if (list.length > 0) this.renderCards(list, reset);
      this.updateLoadMore(this._ongoingHasMore);
    } catch (e) {
      if (requestId !== this.state.catalogRequestId) return;
      this.hideSkeletons();
      this.showError('Не удалось загрузить онгоинги. Проверьте подключение.');
      this.updateLoadMore(false);
      console.error(e);
    }
    this.state.loading = false;
  },

  async loadByGenre(reset = false) {
    if (this.state.loading || (this.state.activeGenreIds.length === 0 && !this.state.activeYear)) return;
    const requestId = this.state.catalogRequestId;
    if (reset) {
      this.state.page = 1;
      this.state.releases = [];
      this.clearGrid();
    }
    this.state.loading = true;
    this.showSkeletons();
    try {
      const params = {
        limit: this.PAGE_SIZE,
        page: reset ? 1 : this.state.page,
      };
      if (this.state.activeGenreIds.length) params['f[genres]'] = this.state.activeGenreIds.join(',');
      if (this.state.activeYear) {
        params['f[years][from_year]'] = this.state.activeYear;
        params['f[years][to_year]'] = this.state.activeYear;
      }
      const data = await this.apiFetch('/anime/catalog/releases', params);
      if (requestId !== this.state.catalogRequestId) return;
      const pageItems = Array.isArray(data) ? data : (data.data || data.items || []);
      const pagination = data.meta?.pagination;
      const list = pageItems.filter(release =>
        this.state.activeGenreIds.every(genreId =>
          (release.genres || []).some(genre => Number(genre.id) === genreId)
        )
        && (!this.state.activeYear || Number(release.year) === Number(this.state.activeYear))
      );
      const currentPage = Number(pagination?.current_page);
      const totalPages = Number(pagination?.total_pages);
      const hasMore = Number.isFinite(currentPage) && Number.isFinite(totalPages)
        ? currentPage < totalPages
        : list.length >= this.PAGE_SIZE;
      this.state.releases.push(...list);
      this.hideSkeletons();
      if (list.length === 0 && reset) this.showEmpty('В этом жанре ничего не найдено', 'Попробуйте другой жанр');
      else if (list.length > 0) this.renderCards(list, reset);
      this.state.page++;
      this.updateLoadMore(hasMore);
    } catch (e) {
      if (requestId !== this.state.catalogRequestId) return;
      this.hideSkeletons();
      this.showError('Не удалось загрузить аниме по жанру.');
      this.updateLoadMore(false);
      console.error(e);
    }
    this.state.loading = false;
  },

  async loadSearch(reset = false) {
    if (this.state.loading || !this.state.searchQuery.trim()) return;
    const requestId = this.state.catalogRequestId;
    if (reset) { this.state.page = 1; this.state.releases = []; this.clearGrid(); }
    const page = reset ? 1 : this.state.page;
    this.state.loading = true;
    this.showSkeletons();
    try {
      const data = await this.apiFetch('/anime/catalog/releases', {
        'f[search]': this.state.searchQuery.trim(),
        limit: this.PAGE_SIZE,
        page,
      });
      if (requestId !== this.state.catalogRequestId) return;
      const list = Array.isArray(data) ? data : (data.data || data.items || []);
      const pagination = data.meta?.pagination;
      const currentPage = Number(pagination?.current_page);
      const totalPages = Number(pagination?.total_pages);
      const hasMore = Number.isFinite(currentPage) && Number.isFinite(totalPages)
        ? currentPage < totalPages
        : list.length >= this.PAGE_SIZE;
      this.state.releases.push(...list);
      this.hideSkeletons();
      if (list.length === 0 && reset) this.showEmpty('По запросу ничего не найдено', 'Попробуйте другой запрос');
      else if (list.length > 0) this.renderCards(list, reset);
      this.state.page = page + 1;
      this.updateLoadMore(hasMore);
    } catch (e) {
      if (requestId !== this.state.catalogRequestId) return;
      this.hideSkeletons();
      this.showError('Ошибка поиска. Попробуйте ещё раз.');
      this.updateLoadMore(false);
      console.error(e);
    }
    this.state.loading = false;
  },

  async loadRecommendations(reset = false) {
    await this.loadCatalogRanking(reset, '-added_in_users_favorites');
  },

  async loadWatching(reset = false) {
    await this.loadCatalogRanking(reset, '-added_in_watching_collection');
  },

  async loadCatalogRanking(reset = false, sortingPrimary, sortingFallback = null) {
    if (this.state.loading) return;
    const requestId = this.state.catalogRequestId;
    if (reset) {
      this.state.page = 1;
      this.state.releases = [];
      this._rankingResults = null;
      this.clearGrid();
    }
    this.state.loading = true;
    this.showSkeletons();
    try {
      if (!this._rankingResults) {
        const releases = await this.loadCatalogPages(30);
        if (requestId !== this.state.catalogRequestId) return;
        if (sortingPrimary === '-added_in_watching_collection') {
          this._rankingResults = [...releases].sort((a, b) =>
            Number(b.added_in_watching_collection || 0) -
            Number(a.added_in_watching_collection || 0)
          );
        } else {
          this._rankingResults = [...releases].sort((a, b) => {
            const ratingA = Number(a.shikimori?.rating || a.rating?.average || 0);
            const ratingB = Number(b.shikimori?.rating || b.rating?.average || 0);
            const favoritesA = Number(a.added_in_users_favorites || 0);
            const favoritesB = Number(b.added_in_users_favorites || 0);
            const scoreA = favoritesA * 0.35 + ratingA * 100;
            const scoreB = favoritesB * 0.35 + ratingB * 100;
            return scoreB - scoreA;
          });
        }
      }
      const page = reset ? 1 : this.state.page;
      const list = this._rankingResults.slice((page - 1) * this.PAGE_SIZE, page * this.PAGE_SIZE);
      const hasMore = page * this.PAGE_SIZE < this._rankingResults.length;
      this.state.releases.push(...list);
      this.hideSkeletons();
      if (list.length === 0 && reset) this.showEmpty('Список пока пуст', 'Попробуйте обновить позже');
      else if (list.length > 0) this.renderCards(list, reset);
      this.state.page++;
      this.updateLoadMore(hasMore);
    } catch (e) {
      if (requestId !== this.state.catalogRequestId) return;
      this.hideSkeletons();
      this.showError('Не удалось загрузить подборку.');
      this.updateLoadMore(false);
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
    const posterPath = r.poster?.src || r.poster?.optimized?.src
      || r.poster?.optimized?.preview || r.poster?.preview
      || r.poster?.optimized?.thumbnail || r.poster?.thumbnail || '';
    const posterUrl = posterPath ? (this.IMG + posterPath) : '';
    const rating = r.shikimori?.rating || r.mal?.rating || null;
    const genres = r.genres || [];
    const isOngoing = r.is_ongoing;
    const type = r.type?.description || r.type?.value || '';
    const year = r.year || '';
    const epCount = r.episodes_total;
    const continueInfo = r.continueInfo;
    const continuePercent = continueInfo
      ? Math.max(0, Math.min(100, Math.round((continueInfo.currentTime / continueInfo.duration) * 100)))
      : 0;

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
            ${continueInfo ? 'Продолжить' : 'Смотреть'}
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
        <div class="card-meta${continueInfo ? ' card-meta-continue' : ''}">
          ${year ? `<span>${year}</span>` : ''}
          ${year && type ? '<span class="card-meta-sep">·</span>' : ''}
          ${type ? `<span>${type}</span>` : ''}
          ${epCount ? `<span class="card-eps-badge">${epCount} эп.</span>` : ''}
        </div>
        ${continueInfo ? `
          <div class="card-continue-info">
            <span>Серия ${this.esc(String(continueInfo.episodeOrdinal))} · ${this.fmtDuration(continueInfo.currentTime)} / ${this.fmtDuration(continueInfo.duration)}</span>
            <div class="card-continue-progress"><span style="width:${continuePercent}%"></span></div>
          </div>
        ` : ''}
      </div>
    `;

    card.addEventListener('click', () => this.openPlayer(r, continueInfo));
    card.querySelector('.card-play-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openPlayer(r, continueInfo);
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
  loadMore() {
    const button = document.getElementById('loadMoreBtn');
    if (!button || button.style.display === 'none' || button.disabled || this.state.loading) return;
    button.disabled = true;
    button.classList.add('loading');
    if (this.state.mode === 'latest') this.loadLatest();
    else if (this.state.mode === 'ongoing') this.loadOngoing();
    else if (this.state.mode === 'genre') this.loadByGenre();
    else if (this.state.mode === 'search') this.loadSearch();
    else if (this.state.mode === 'recommendations') this.loadRecommendations();
    else if (this.state.mode === 'watching') this.loadWatching();
    else this.updateLoadMore(false);
  },

  updateLoadMore(hasMore) {
    const btn = document.getElementById('loadMoreBtn');
    if (!btn) return;
    btn.style.display = hasMore ? 'flex' : 'none';
    btn.disabled = false;
    btn.classList.remove('loading');
    if (hasMore && this._loadMoreObserver) {
      this._loadMoreObserver.unobserve(btn);
      this._loadMoreObserver.observe(btn);
    }
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

    const posterPath = r.poster?.src || r.poster?.optimized?.src
      || r.poster?.preview || r.poster?.optimized?.preview
      || r.poster?.optimized?.thumbnail || '';
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
      this.hideSearchPreview();
      const q = searchInput?.value.trim();
      if (q) {
        this.state.searchQuery = q;
        // Clear genre selection
        this.state.activeGenreId = null;
        document.querySelectorAll('[data-genre-id]').forEach(b => b.classList.remove('active'));
        this.syncGenreSelection(null);
        this.switchMode('search');
      }
    });

    searchInput?.addEventListener('input', () => {
      if (searchClear) searchClear.classList.toggle('visible', searchInput.value.length > 0);
      const query = searchInput.value.trim();
      if (query.length >= 2) this.queueSearchPreview(query);
      else this.hideSearchPreview();
      if (searchInput.value.length === 0 && this.state.mode === 'search') {
        this.state.searchQuery = '';
        this.switchMode('latest');
      }
    });
    searchInput?.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.hideSearchPreview();
    });

    searchClear?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      this.state.searchQuery = '';
      this.hideSearchPreview();
      searchClear.classList.remove('visible');
      if (this.state.mode === 'search') this.switchMode('latest');
    });
    document.addEventListener('click', event => {
      const searchWrap = document.querySelector('.ani-search-wrap');
      if (searchWrap && !searchWrap.contains(event.target)) this.hideSearchPreview();
    });

    // View toggle
    document.getElementById('viewGrid')?.addEventListener('click', () => this.setView('grid'));
    document.getElementById('viewList')?.addEventListener('click', () => this.setView('list'));

    // "Все" pill
    document.querySelector('[data-all]')?.addEventListener('click', () => {
      this.syncGenreSelection(null);
      this.state.activeYear = null;
      const yearSelect = document.getElementById('yearFilter');
      if (yearSelect) yearSelect.value = '';
      if (searchInput) searchInput.value = '';
      this.state.searchQuery = '';
      this.hideSearchPreview();
      if (searchClear) searchClear.classList.remove('visible');
      document.querySelectorAll('.sidebar-nav-item').forEach(item => item.classList.remove('active'));
      document.getElementById('navLatest')?.classList.add('active');
      this.switchMode('latest');
    });

    // Load more
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    loadMoreBtn?.addEventListener('click', () => this.loadMore());
    if (loadMoreBtn && 'IntersectionObserver' in window) {
      this._loadMoreObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) this.loadMore();
      }, { rootMargin: '500px 0px' });
      this._loadMoreObserver.observe(loadMoreBtn);
    }

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
      this.syncGenreSelection(null);
      this.state.activeYear = null;
      const yearSelect = document.getElementById('yearFilter');
      if (yearSelect) yearSelect.value = '';
      document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
      document.getElementById('navLatest')?.classList.add('active');
      this.switchMode('latest');
    });

    document.getElementById('navOngoing')?.addEventListener('click', () => {
      this.syncGenreSelection(null);
      document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
      document.getElementById('navOngoing')?.classList.add('active');
      this.switchMode('ongoing');
    });

    document.getElementById('navContinue')?.addEventListener('click', () => {
      this.syncGenreSelection(null);
      document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
      document.getElementById('navContinue')?.classList.add('active');
      this.switchMode('continue');
    });

    document.getElementById('navRecommendations')?.addEventListener('click', () => {
      this.syncGenreSelection(null);
      document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
      document.getElementById('navRecommendations')?.classList.add('active');
      this.switchMode('recommendations');
    });

    document.getElementById('navWatching')?.addEventListener('click', () => {
      this.syncGenreSelection(null);
      document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
      document.getElementById('navWatching')?.classList.add('active');
      this.switchMode('watching');
    });

    document.getElementById('applyCatalogFilters')?.addEventListener('click', () => {
      const year = document.getElementById('yearFilter')?.value || '';
      this.state.activeYear = year ? Number(year) : null;
      document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
      if (this.state.activeGenreIds.length === 0 && !this.state.activeYear) {
        document.getElementById('navLatest')?.classList.add('active');
        this.switchMode('latest');
      } else {
        this.switchMode('genre');
      }
    });

    document.getElementById('clearCatalogFilters')?.addEventListener('click', () => {
      this.syncGenreSelection(null);
      const yearSelect = document.getElementById('yearFilter');
      if (yearSelect) yearSelect.value = '';
      this.state.activeYear = null;
      document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
      document.getElementById('navLatest')?.classList.add('active');
      this.switchMode('latest');
    });
  },

  setView(mode) {
    this.state.viewMode = mode;
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    grid.classList.toggle('list-view', mode === 'list');
    document.getElementById('viewGrid')?.classList.toggle('active', mode === 'grid');
    document.getElementById('viewList')?.classList.toggle('active', mode === 'list');
    if (this.state.mode === 'continue') {
      this.renderContinueWatching();
      return;
    }
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
    const headerFullscreenBtn = document.getElementById('playerHeaderFullscreenBtn');
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
    const videoWrap = document.getElementById('playerVideoWrap');
    const seekPreview = document.getElementById('customPlayerSeekPreview');
    const previewCanvas = document.getElementById('customPlayerPreviewCanvas');
    const previewImage = document.getElementById('customPlayerPreviewImage');
    const previewTime = document.getElementById('customPlayerPreviewTime');
    let controlsTimer;
    let previewHideTimer;
    let isProgressScrubbing = false;
    let lastWatchProgressSave = 0;

    const saveWatchProgressIfDue = (force = false) => {
      const now = Date.now();
      if (!force && now - lastWatchProgressSave < 10000) return;
      this.saveCurrentWatchProgress(video);
      lastWatchProgressSave = now;
    };

    const updateSeekPreview = (ratio, clientX) => {
      if (!seekPreview || !progress || !video?.duration || !Number.isFinite(video.duration)) return;
      const progressRect = progress.getBoundingClientRect();
      const controlsRect = controls?.getBoundingClientRect();
      const clampedRatio = Math.max(0, Math.min(1, ratio));
      const previewWidth = seekPreview.offsetWidth || 160;
      const pointerX = Number.isFinite(clientX)
        ? clientX
        : progressRect.left + clampedRatio * progressRect.width;
      if (!isProgressScrubbing) previewCanvas?.classList.remove('visible');

      seekPreview.style.left = `${Math.max(
        previewWidth / 2,
        Math.min((controlsRect?.width || progressRect.width) - previewWidth / 2, pointerX - (controlsRect?.left || progressRect.left))
      )}px`;
      if (previewTime) previewTime.textContent = this.fmtDuration(clampedRatio * video.duration);
      seekPreview.classList.add('visible');

      if (!previewCanvas?.classList.contains('visible')) {
        const episodes = this._sortedEpisodes || this.state.currentRelease?.episodes || [];
        const episode = episodes[this.state.currentEpIndex];
        const previewPath = episode?.preview?.optimized?.src
          || episode?.preview?.src
          || episode?.preview?.optimized?.preview
          || episode?.preview?.preview
          || episode?.preview?.optimized?.thumbnail
          || episode?.preview?.thumbnail;
        if (previewImage) {
          const previewUrl = previewPath ? this.IMG + previewPath : '';
          if (previewUrl) {
            if (previewImage.getAttribute('src') !== previewUrl) previewImage.src = previewUrl;
          } else {
            previewImage.removeAttribute('src');
          }
          previewImage.classList.toggle('visible', Boolean(previewPath));
        }
      }

      clearTimeout(previewHideTimer);
      if (!isProgressScrubbing) {
        previewHideTimer = setTimeout(() => seekPreview.classList.remove('visible'), 900);
      }
    };

    const updateSeekPreviewFromPointer = event => {
      if (!progress) return;
      const rect = progress.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = (event.clientX - rect.left) / rect.width;
      updateSeekPreview(ratio, event.clientX);
    };

    const drawSeekPreviewFrame = () => {
      if (!seekPreview?.classList.contains('visible') || !previewCanvas || !video?.videoWidth || video.readyState < 2) return;
      try {
        const context = previewCanvas.getContext('2d');
        if (!context) return;
        const width = previewCanvas.width;
        const height = previewCanvas.height;
        const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
        const frameWidth = video.videoWidth * scale;
        const frameHeight = video.videoHeight * scale;
        context.clearRect(0, 0, width, height);
        context.fillStyle = '#000';
        context.fillRect(0, 0, width, height);
        context.drawImage(
          video,
          (width - frameWidth) / 2,
          (height - frameHeight) / 2,
          frameWidth,
          frameHeight
        );
        previewCanvas.classList.add('visible');
        previewImage?.classList.remove('visible');
      } catch (error) {
        console.warn('Seek frame preview is unavailable:', error);
      }
    };

    const showPlayerControls = () => {
      controls?.classList.remove('hidden');
      topbar?.classList.remove('hidden');
      videoWrap?.classList.remove('cursor-hidden');
      clearTimeout(controlsTimer);
      if (!video?.paused) {
        controlsTimer = setTimeout(() => {
          controls?.classList.add('hidden');
          topbar?.classList.add('hidden');
          videoWrap?.classList.add('cursor-hidden');
        }, 2600);
      }
    };

    playBtn?.addEventListener('click', () => {
      if (!video) return;
      if (video.paused) this.requestPlay(video);
      else {
        saveWatchProgressIfDue(true);
        video.pause();
      }
    });
    video?.addEventListener('click', () => playBtn?.click());
    video?.addEventListener('play', () => {
      if (playBtn) playBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    });
    video?.addEventListener('pause', () => {
      if (playBtn) playBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
      showPlayerControls();
    });
    video?.addEventListener('waiting', () => document.getElementById('playerSpinner')?.classList.add('visible'));
    video?.addEventListener('playing', () => document.getElementById('playerSpinner')?.classList.remove('visible'));
    video?.addEventListener('timeupdate', () => {
      if (!video.duration) return;
      if (progress) progress.value = String(Math.round((video.currentTime / video.duration) * 1000));
      if (time) time.textContent = `${this.fmtDuration(video.currentTime)} / ${this.fmtDuration(video.duration)}`;
      saveWatchProgressIfDue();
    });
    video?.addEventListener('seeked', drawSeekPreviewFrame);
    video?.addEventListener('ended', () => {
      saveWatchProgressIfDue(true);
      this.navigateEpisode(1);
    });
    progress?.addEventListener('input', () => {
      if (video?.duration) {
        const ratio = Number(progress.value) / 1000;
        video.currentTime = ratio * video.duration;
        previewCanvas?.classList.remove('visible');
        updateSeekPreview(ratio);
      }
    });
    progress?.addEventListener('pointerenter', updateSeekPreviewFromPointer);
    progress?.addEventListener('pointermove', updateSeekPreviewFromPointer);
    progress?.addEventListener('pointerleave', () => {
      if (!isProgressScrubbing) {
        clearTimeout(previewHideTimer);
        previewHideTimer = setTimeout(() => seekPreview?.classList.remove('visible'), 250);
      }
    });
    progress?.addEventListener('pointerdown', event => {
      isProgressScrubbing = true;
      clearTimeout(previewHideTimer);
      previewCanvas?.classList.remove('visible');
      updateSeekPreviewFromPointer(event);
    });
    document.addEventListener('pointerup', () => {
      if (!isProgressScrubbing) return;
      isProgressScrubbing = false;
      clearTimeout(previewHideTimer);
      previewHideTimer = setTimeout(() => seekPreview?.classList.remove('visible'), 700);
    });
    progress?.addEventListener('change', () => {
      if (isProgressScrubbing) return;
      clearTimeout(previewHideTimer);
      previewHideTimer = setTimeout(() => seekPreview?.classList.remove('visible'), 700);
    });
    volume?.addEventListener('input', () => {
      if (video) {
        video.volume = Number(volume.value);
        video.muted = video.volume === 0;
      }
    });
    muteBtn?.addEventListener('click', () => {
      if (video) video.muted = !video.muted;
      if (muteBtn) {
        muteBtn.classList.toggle('muted', video?.muted);
        muteBtn.setAttribute('aria-label', video?.muted ? 'Включить звук' : 'Выключить звук');
      }
    });
    const toggleFullscreen = () => {
      const wrap = document.getElementById('playerVideoWrap');
      if (!document.fullscreenElement) wrap?.requestFullscreen?.();
      else document.exitFullscreen?.();
    };
    fullscreenBtn?.addEventListener('click', toggleFullscreen);
    headerFullscreenBtn?.addEventListener('click', toggleFullscreen);

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
    videoWrap?.addEventListener('mousemove', showPlayerControls);
    videoWrap?.addEventListener('touchstart', showPlayerControls);
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
      if (e.key === 'Escape') {
        this.closePlayer();
        return;
      }
      if (e.target instanceof HTMLElement &&
          (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName))) return;
      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (video?.paused) this.requestPlay(video);
        else {
          saveWatchProgressIfDue(true);
          video?.pause();
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (video && Number.isFinite(video.duration)) {
          video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + (e.key === 'ArrowRight' ? 10 : -10)));
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (video) {
          video.volume = Math.max(0, Math.min(1, video.volume + (e.key === 'ArrowUp' ? 0.05 : -0.05)));
          video.muted = video.volume === 0;
          if (volume) volume.value = String(video.volume);
          muteBtn?.classList.toggle('muted', video.muted);
          muteBtn?.setAttribute('aria-label', video.muted ? 'Включить звук' : 'Выключить звук');
        }
      } else if (e.key.toLowerCase() === 'm') {
        if (video) video.muted = !video.muted;
        muteBtn?.classList.toggle('muted', video?.muted);
        muteBtn?.setAttribute('aria-label', video?.muted ? 'Включить звук' : 'Выключить звук');
      } else if (e.key.toLowerCase() === 'f') {
        const wrap = document.getElementById('playerVideoWrap');
        if (!document.fullscreenElement) wrap?.requestFullscreen?.();
        else document.exitFullscreen?.();
      }
    });
  },

  async openPlayer(release, resumeInfo = null) {
    this.saveCurrentWatchProgress(document.getElementById('animeVideoPlayer'));
    const requestId = ++this.state.playerRequestId;
    this._sortedEpisodes = [];
    if (this.state.hls) {
      this.state.hls.destroy();
      this.state.hls = null;
    }
    const video = document.getElementById('animeVideoPlayer');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
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
    if (requestId !== this.state.playerRequestId) return;

    this.state.currentRelease = fullRelease;
    this.state.currentEpIndex = 0;

    // Render detail panel
    this.renderDetailPanel(fullRelease);
    this.loadSimilar(fullRelease);
    // Render episodes
    this.renderEpisodesList(fullRelease.episodes || []);
    // Update modal title
    const modalTitle = document.getElementById('playerModalTitle');
    if (modalTitle) modalTitle.textContent = fullRelease.name?.main || 'Просмотр';

    // Hide spinner
    if (spinner) spinner.classList.remove('visible');

    // Auto-play first episode
    const episodes = this._sortedEpisodes || fullRelease.episodes || [];
    if (episodes.length > 0) {
      const resumeIndex = resumeInfo
        ? episodes.findIndex(episode => String(episode.ordinal) === String(resumeInfo.episodeOrdinal))
        : 0;
      if (resumeIndex < 0) {
        this.showToast('Сохранённая серия недоступна. Открыта первая серия.', 'info');
        this.playEpisode(0);
      } else {
        const resumeTime = resumeInfo ? Number(resumeInfo.currentTime) : 0;
        this.playEpisode(resumeIndex, Number.isFinite(resumeTime) ? resumeTime : 0);
      }
    } else {
      this.showPlayerMessage(release.latest_episode
        ? 'Список серий пока недоступен. Попробуйте открыть аниме позже.'
        : 'У этого аниме пока нет доступных серий');
    }
  },

  closePlayer() {
    this.saveCurrentWatchProgress(document.getElementById('animeVideoPlayer'));
    this.state.playerRequestId++;
    const modal = document.getElementById('playerBackdrop');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';

    // Destroy HLS
    if (this.state.hls) {
      this.state.hls.destroy();
      this.state.hls = null;
    }
    const video = document.getElementById('animeVideoPlayer');
    document.getElementById('playerVideoWrap')?.classList.remove('cursor-hidden');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    this._sortedEpisodes = [];
    const progress = document.getElementById('customPlayerProgress');
    const time = document.getElementById('customPlayerTime');
    if (progress) progress.value = '0';
    if (time) time.textContent = '0:00 / 0:00';
    const similarList = document.getElementById('similarList');
    if (similarList) similarList.innerHTML = '';
    if (this.state.mode === 'continue') this.renderContinueWatching();
  },

  async loadSimilar(release) {
    const list = document.getElementById('similarList');
    if (!list) return;
    const releaseId = String(release.id);
    list.innerHTML = '<div class="similar-state">Подбор похожих...</div>';
    const genreIds = (release.genres || []).map(genre => Number(genre.id)).filter(Boolean).slice(0, 3);
    try {
      let candidates = [];
      if (genreIds.length) {
        const data = await this.apiFetch('/anime/catalog/releases', {
          limit: 12,
          page: 1,
          'f[genres]': genreIds.join(','),
        });
        candidates = Array.isArray(data) ? data : (data.data || data.items || []);
      }
      if (String(this.state.currentRelease?.id) !== releaseId) return;
      if (candidates.length < 6) {
        const data = await this.apiFetch('/anime/catalog/releases', {
          limit: 12,
          page: 1,
          'f[sorting]': '-added_in_users_favorites',
        });
        const popular = Array.isArray(data) ? data : (data.data || data.items || []);
        candidates = [...candidates, ...popular];
      }

      const releaseGenreSet = new Set((release.genres || []).map(genre => Number(genre.id)));
      const unique = [];
      const seen = new Set([releaseId]);
      candidates.forEach(candidate => {
        const candidateId = String(candidate.id);
        if (seen.has(candidateId)) return;
        seen.add(candidateId);
        const score = (candidate.genres || []).reduce(
          (total, genre) => total + (releaseGenreSet.has(Number(genre.id)) ? 1 : 0),
          0
        );
        unique.push({ candidate, score });
      });
      unique.sort((a, b) => b.score - a.score);

      list.innerHTML = '';
      const items = unique.slice(0, 8);
      if (items.length === 0) {
        list.innerHTML = '<div class="similar-state">Похожие релизы не найдены</div>';
        return;
      }
      items.forEach(({ candidate }) => {
        const title = candidate.name?.main || 'Без названия';
        const posterPath = candidate.poster?.optimized?.thumbnail
          || candidate.poster?.thumbnail
          || candidate.poster?.optimized?.preview
          || candidate.poster?.preview
          || candidate.poster?.src;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'similar-item';
        item.title = title;
        item.innerHTML = `
          ${posterPath ? `<img src="${this.IMG + posterPath}" alt="${this.esc(title)}" loading="lazy">` : '<span class="similar-placeholder">▶</span>'}
          <span>${this.esc(title)}</span>
        `;
        item.addEventListener('click', () => this.openPlayer(candidate));
        list.appendChild(item);
      });
    } catch (error) {
      list.innerHTML = '<div class="similar-state">Не удалось загрузить подборку</div>';
      console.warn('Similar releases failed:', error);
    }
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

      const thumbPath = ep.preview?.src || ep.preview?.optimized?.src
        || ep.preview?.preview || ep.preview?.optimized?.preview
        || ep.preview?.optimized?.thumbnail || ep.preview?.thumbnail || '';
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

  playEpisode(idx, startTime = 0) {
    const episodes = this._sortedEpisodes || this.state.currentRelease?.episodes || [];
    const ep = episodes[idx];
    if (!ep) return;

    this.saveCurrentWatchProgress(document.getElementById('animeVideoPlayer'));
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
    const previewImage = document.getElementById('customPlayerPreviewImage');
    const previewCanvas = document.getElementById('customPlayerPreviewCanvas');
    const previewPath = ep.preview?.optimized?.src
      || ep.preview?.src
      || ep.preview?.optimized?.preview
      || ep.preview?.preview
      || ep.preview?.optimized?.thumbnail
      || ep.preview?.thumbnail;
    if (previewImage) {
      const previewUrl = previewPath ? this.IMG + previewPath : '';
      if (previewUrl) {
        if (previewImage.getAttribute('src') !== previewUrl) previewImage.src = previewUrl;
      } else {
        previewImage.removeAttribute('src');
      }
      previewImage.classList.toggle('visible', Boolean(previewPath));
    }
    previewCanvas?.classList.remove('visible');

    // Load HLS
    this.loadHLS(ep, startTime);
  },

  navigateEpisode(delta) {
    const episodes = this._sortedEpisodes || this.state.currentRelease?.episodes || [];
    const newIdx = this.state.currentEpIndex + delta;
    if (newIdx >= 0 && newIdx < episodes.length) {
      this.playEpisode(newIdx);
    }
  },

  loadHLS(ep, startTime = 0) {
    const video = document.getElementById('animeVideoPlayer');
    const spinner = document.getElementById('playerSpinner');
    if (!video) return;

    const availableQualities = ['480', '720', '1080'].filter(q => ep[`hls_${q}`]);
    const quality = availableQualities.includes(this.state.currentQuality)
      ? this.state.currentQuality
      : availableQualities.filter(q => Number(q) <= Number(this.state.currentQuality)).pop()
        || availableQualities[availableQualities.length - 1];
    this.state.currentQuality = quality || this.state.currentQuality;
    this.updateQualityButtons(ep);
    this.clearPlayerMessage();
    if (spinner) spinner.classList.add('visible');

    // Destroy previous HLS
    if (this.state.hls) {
      this.state.hls.destroy();
      this.state.hls = null;
    }
    video.pause();
    video.removeAttribute('src');
    video.load();
    const progress = document.getElementById('customPlayerProgress');
    const time = document.getElementById('customPlayerTime');
    if (progress) progress.value = '0';
    if (time) time.textContent = '0:00 / 0:00';

    const url = quality ? ep[`hls_${quality}`] : null;
    if (!url) {
      spinner?.classList.remove('visible');
      this.showPlayerMessage('Видео для этой серии недоступно');
      return;
    }

    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 128 * 1024 * 1024,
        backBufferLength: 30,
      });
      let recoveredMediaError = false;
      this.state.hls = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (this.state.hls !== hls) return;
        if (spinner) spinner.classList.remove('visible');
        const startPlayback = () => {
          if (this.state.hls !== hls) return;
          if (startTime > 0 && Number.isFinite(video.duration) && video.duration > 0) {
            video.currentTime = Math.min(startTime, video.duration);
          }
          this.requestPlay(video);
        };
        if (startTime > 0 && video.readyState < 1) {
          video.addEventListener('loadedmetadata', startPlayback, { once: true });
        } else {
          startPlayback();
        }
        this.updateQualityButtons(ep);
      });
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (!data.fatal || this.state.hls !== hls) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recoveredMediaError) {
          recoveredMediaError = true;
          hls.recoverMediaError();
          return;
        }
        spinner?.classList.remove('visible');
        const fallback = ['1080', '720', '480'].find(q =>
          Number(q) < Number(quality) && ep[`hls_${q}`]
        );
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && fallback) {
          this.showToast(`Не удалось загрузить ${quality}p. Переключаем на ${fallback}p.`, 'error');
          this.state.currentQuality = fallback;
          this.loadHLS(ep, startTime);
        } else {
          this.showPlayerMessage('Не удалось загрузить видео. Проверьте подключение и попробуйте ещё раз.');
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        if (spinner) spinner.classList.remove('visible');
        if (startTime > 0 && Number.isFinite(video.duration) && video.duration > 0) {
          video.currentTime = Math.min(startTime, video.duration);
        }
        this.requestPlay(video);
      }, { once: true });
    } else {
      if (spinner) spinner.classList.remove('visible');
      this.showPlayerMessage('Ваш браузер не поддерживает HLS воспроизведение');
    }
  },

  updateQualityButtons(ep) {
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

  requestPlay(video) {
    video.play().catch(() => {
      if (document.getElementById('playerBackdrop')?.classList.contains('open')) {
        this.showToast('Нажмите ▶, чтобы начать воспроизведение.', 'info');
      }
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
      msgEl.setAttribute('role', 'alert');
      msgEl.setAttribute('aria-live', 'assertive');
      wrap.appendChild(msgEl);
    }
    msgEl.textContent = msg;
  },

  clearPlayerMessage() {
    document.querySelector('#playerVideoWrap .player-message')?.remove();
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
