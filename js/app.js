/**
 * Sakura Cinema Browser 🌸
 * Main Application Orchestrator
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Core Engines
  const sakuraEngine = new SakuraEngine('particleCanvas');
  const mirrorsManager = new HDrezkaMirrorsManager();
  const mascot = new AnimeMascot();

  let sites = [];
  let currentCategory = 'all';
  let activeSettings = StorageManager.getSettings();

  // 2. Initialize Mirrors Manager & listen to changes
  await mirrorsManager.init();

  // 3. Initialize UI & Sites Catalog
  await initSitesCatalog();
  renderHistory();
  applySettings(activeSettings);

  // Subscribe to mirror updates
  mirrorsManager.subscribe((state) => {
    updateHeaderMirrorPill(state);
    updateHDrezkaCard(state.activeMirror);
    renderMirrorsModalList(state);
  });
  updateHeaderMirrorPill(mirrorsManager.getState());

  // 4. Setup Event Listeners
  setupSearch();
  setupCategoryFilters();
  setupHeaderActions();
  setupModals();
  setupTVNavigation();

  // ==========================================================================
  // Sites Catalog Management
  // ==========================================================================
  async function initSitesCatalog() {
    let freshSites = null;
    try {
      const res = await fetch('data/sites.json');
      if (res.ok) freshSites = await res.json();
    } catch (e) {
      console.warn('Failed to load data/sites.json', e);
    }

    const cachedSites = StorageManager.getSites();
    if (freshSites && Array.isArray(freshSites)) {
      if (cachedSites && Array.isArray(cachedSites)) {
        const cachedById = new Map(cachedSites.map(site => [site.id, site]));
        sites = freshSites.map(site => {
          const cached = cachedById.get(site.id);
          return cached ? { ...site, isFavorite: cached.isFavorite } : site;
        });
      } else {
        sites = freshSites;
      }
      StorageManager.saveSites(sites);
    } else if (cachedSites && Array.isArray(cachedSites) && cachedSites.length > 0) {
      sites = cachedSites;
    } else {
      sites = getDefaultFallbackSites();
      StorageManager.saveSites(sites);
    }
    renderSiteCards();
  }

  function getDefaultFallbackSites() {
    return [
      {
        id: "hdrezka",
        title: "HDrezka",
        originalTitle: "映画 & ドラマ",
        category: "cinema",
        description: "Огромная библиотека фильмов, сериалов и аниме в лучшем дубляже.",
        badge: "⭐ Умные зеркала",
        badgeType: "mirror",
        url: mirrorsManager.activeMirror,
        isMirrorDependent: true,
        themeColor: "#e50914",
        bgGradient: "linear-gradient(135deg, #1f0b12 0%, #3d1421 50%, #e50914 100%)",
        rating: "4.9",
        tags: ["Фильмы", "Сериалы", "Мультизвук"],
        isFavorite: true
      },
      {
        id: "anilibria",
        title: "AniLibria",
        originalTitle: "アニメ・アニリブリア",
        category: "anime",
        description: "Легендарный проект озвучивания аниме. Топовые онгоинги без цензуры в 1080p.",
        badge: "🌸 Топ Аниме",
        badgeType: "anime",
        url: "https://www.anilibria.tv",
        isMirrorDependent: false,
        themeColor: "#b82626",
        bgGradient: "linear-gradient(135deg, #18091a 0%, #381232 50%, #b82626 100%)",
        rating: "4.95",
        tags: ["Аниме", "Озвучка", "Онгоинги"],
        isFavorite: true
      },
      {
        id: "animego",
        title: "AnimeGo",
        originalTitle: "アニメオンライン",
        category: "anime",
        description: "Популярный портал аниме с удобным поиском по жанрам и сериям.",
        badge: "🔥 Популярно",
        badgeType: "hot",
        url: "https://animego.org",
        isMirrorDependent: false,
        themeColor: "#ff4d6d",
        bgGradient: "linear-gradient(135deg, #190e24 0%, #3f194d 50%, #ff4d6d 100%)",
        rating: "4.8",
        tags: ["Аниме", "Субтитры", "Каталог"],
        isFavorite: true
      },
      {
        id: "kinopoisk",
        title: "Кинопоиск",
        originalTitle: "キノポイスク",
        category: "cinema",
        description: "Энциклопедия мирового кино, трейлеры, отзывы критиков и онлайн-кинотеатр.",
        badge: "🎬 Каталог & Рейтинги",
        badgeType: "default",
        url: "https://www.kinopoisk.ru",
        isMirrorDependent: false,
        themeColor: "#ff5500",
        bgGradient: "linear-gradient(135deg, #1a0f08 0%, #3b1b0b 50%, #ff5500 100%)",
        rating: "4.7",
        tags: ["Рейтинги", "Рецензии", "Премьеры"],
        isFavorite: false
      },
      {
        id: "youtube",
        title: "YouTube",
        originalTitle: "ユーチューブ",
        category: "streaming",
        description: "Трейлеры, аниме-обзоры, OST, AMV, стримы и авторские видеоролики.",
        badge: "📺 Стриминг",
        badgeType: "stream",
        url: "https://www.youtube.com",
        isMirrorDependent: false,
        themeColor: "#ff0000",
        bgGradient: "linear-gradient(135deg, #1c0a0a 0%, #401010 50%, #ff0033 100%)",
        rating: "4.9",
        tags: ["Видео", "Клипы", "Обзоры"],
        isFavorite: true
      }
    ];
  }

  function renderSiteCards() {
    const grid = document.getElementById('sitesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = sites.filter(s => {
      if (currentCategory === 'all') return true;
      if (currentCategory === 'favorites') return s.isFavorite;
      return s.category === currentCategory;
    });

    filtered.forEach(site => {
      const card = document.createElement('div');
      card.className = 'site-card';
      card.tabIndex = 0;
      card.setAttribute('data-id', site.id);

      // Current effective URL (accounts for HDrezka dynamic mirror)
      const effectiveUrl = currentSiteUrl(site);

      card.innerHTML = `
        <div class="card-artwork" style="background: ${esc(site.bgGradient || 'linear-gradient(135deg, #2b1055, #7597de)')};"></div>
        <div class="card-gradient-overlay"></div>
        
        <div class="card-top-bar">
          <span class="card-badge ${site.isMirrorDependent ? 'badge-mirror' : ''}">
            ${esc(site.badge || '🎬 Кино')}
          </span>
          <button class="card-fav-btn ${site.isFavorite ? 'active' : ''}" title="В избранное" data-id="${site.id}">
            ★
          </button>
        </div>

        <div class="card-details">
          <div class="card-titles">
            <span class="card-japanese-title">${esc(site.originalTitle || '桜シネマ')}</span>
            <h3 class="card-main-title">${esc(site.title)}${site.rating ? `<span class="card-rating">★ ${esc(site.rating)}</span>` : ''}</h3>
          </div>
          <p class="card-desc">${esc(site.description || '')}</p>
          <div class="card-tags">
            ${(site.tags || []).map(t => `<span class="card-tag">${esc(t)}</span>`).join('')}
          </div>

          <div class="card-actions-row">
            <button class="card-open-btn" data-url="${esc(effectiveUrl)}" data-title="${esc(site.title)}">
              <span>▶ Открыть</span>
            </button>
            ${site.isMirrorDependent ? `
              <button class="card-mirror-config-btn" id="cardMirrorQuickBtn" title="Настройки зеркал">
                <span>⚙ Зеркала</span>
              </button>
            ` : ''}
          </div>
        </div>
      `;

      // Favorite toggle handler
      const favBtn = card.querySelector('.card-fav-btn');
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        site.isFavorite = !site.isFavorite;
        favBtn.classList.toggle('active', site.isFavorite);
        StorageManager.saveSites(sites);
        mascot.playChime('happy');
        if (currentCategory === 'favorites') {
          renderSiteCards();
        }
      });

      // Quick mirror config button
      const mirrorBtn = card.querySelector('.card-mirror-config-btn');
      if (mirrorBtn) {
        mirrorBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openModal('mirrorsModal');
        });
      }

      // Open site handler
      const openBtn = card.querySelector('.card-open-btn');
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openTargetSite(currentSiteUrl(site), site.title, site.isInternal === true);
      });

      card.addEventListener('click', () => {
        openTargetSite(currentSiteUrl(site), site.title, site.isInternal === true);
      });

      grid.appendChild(card);
    });

    // Append "Add Site" card
    const addCard = document.createElement('div');
    addCard.className = 'site-card add-new-site-card';
    addCard.tabIndex = 0;
    addCard.style.cssText = 'border: 2px dashed rgba(255, 117, 151, 0.4); background: rgba(22, 15, 38, 0.4); display: flex; align-items: center; justify-content: center; cursor: pointer;';
    addCard.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--sakura-soft);">
        <div style="width: 54px; height: 54px; border-radius: 50%; background: rgba(255,117,151,0.15); display: flex; align-items: center; justify-content: center; font-size: 26px; border: 1px solid var(--sakura-pink);">+</div>
        <span style="font-weight: 700; font-size: 15px;">Добавить сайт</span>
        <span style="font-size: 12px; color: var(--text-dim); text-align: center; max-width: 200px;">Добавьте любой любимый онлайн-кинотеатр или аниме-трекер</span>
      </div>
    `;
    addCard.addEventListener('click', () => openModal('addSiteModal'));
    grid.appendChild(addCard);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function resolveLocalUrl(url) {
    if (!url) return url;
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.hostname === 'app.sakura.cinema') {
        const path = parsed.pathname.replace(/^\//, '') || 'anilibria.html';
        return path + parsed.search + parsed.hash;
      }
    } catch (e) {
      return url;
    }
    return url;
  }

  function isLocalPage(url) {
    return !!url && !/^https?:/i.test(url);
  }

  function currentSiteUrl(site) {
    if (site.isInternal) return resolveLocalUrl(site.url);
    if (site.isMirrorDependent) return mirrorsManager.activeMirror;
    return site.url;
  }

  function updateHDrezkaCard(newMirrorUrl) {
    const rezkaSite = sites.find(s => s.isMirrorDependent);
    if (rezkaSite) {
      rezkaSite.url = newMirrorUrl;
      const card = document.querySelector('.site-card[data-id="hdrezka"]');
      if (card) {
        const openBtn = card.querySelector('.card-open-btn');
        if (openBtn) openBtn.setAttribute('data-url', newMirrorUrl);
      }
    }
  }

  // ==========================================================================
  // Header Mirrors Pill Indicator
  // ==========================================================================
  function updateHeaderMirrorPill(state) {
    const pill = document.getElementById('headerMirrorBtn');
    if (!pill) return;

    const label = state.activeMirrorObj?.label || state.activeMirror.replace(/^https?:\/\//, '');
    const dot = pill.querySelector('.status-dot');
    const textSpan = pill.querySelector('.mirror-name-text');

    if (textSpan) textSpan.textContent = label;

    if (dot) {
      if (state.isTesting) {
        dot.className = 'status-dot testing';
      } else {
        dot.className = 'status-dot';
      }
    }
  }

  // ==========================================================================
  // Site Opening / Browser / Cinema Viewer
  // ==========================================================================
  function openTargetSite(url, title, isInternal = false) {
    const localUrl = resolveLocalUrl(url);
    const internal = isInternal || isLocalPage(localUrl);
    mascot.onSiteOpened(title);

    // Save to history
    StorageManager.addHistoryItem({
      title: title,
      episode: 'Главная страница',
      siteUrl: internal ? localUrl : url,
      sourceName: title,
      isInternal: internal
    });
    renderHistory();

    if (internal) {
      window.location.href = localUrl;
      return;
    }

    if (/SakuraCinemaAndroid/i.test(navigator.userAgent)) {
      window.location.href = url;
      return;
    }

    // In desktop/mobile shell (Tauri / Capacitor), window.location or WebView navigation is triggered.
    // In web browser prototype, we offer viewing in in-app modal or opening in new tab:
    const inAppViewer = document.getElementById('inAppViewerModal');
    const iframe = document.getElementById('inAppIframe');
    const viewerUrlDisplay = document.getElementById('viewerUrlDisplay');
    const viewerTitle = document.getElementById('viewerSiteTitle');
    const directTabBtn = document.getElementById('viewerOpenDirectBtn');

    if (inAppViewer && iframe) {
      viewerTitle.textContent = title;
      viewerUrlDisplay.textContent = url;
      directTabBtn.onclick = () => window.open(url, '_blank', 'noopener,noreferrer');

      // Custom in-app cinema frame
      iframe.src = url;
      const loading = document.getElementById('viewerLoading');
      if (loading) {
        loading.style.display = 'flex';
      }
      iframe.onload = () => {
        if (loading) loading.style.display = 'none';
      };
      const backBtn = document.getElementById('viewerBackBtn');
      const reloadBtn = document.getElementById('viewerReloadBtn');
      if (backBtn) backBtn.onclick = () => {
        try {
          if (iframe.contentWindow && iframe.contentWindow.history.length > 1) {
            iframe.contentWindow.history.back();
          }
        } catch {
          window.history.back();
        }
      };
      if (reloadBtn) reloadBtn.onclick = () => {
        if (loading) loading.style.display = 'flex';
        iframe.src = iframe.src || url;
      };
      openModal('inAppViewerModal');
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  // ==========================================================================
  // "Продолжить просмотр" (History)
  // ==========================================================================
  function renderHistory() {
    const container = document.getElementById('historyContainer');
    const countBadge = document.getElementById('historyCountBadge');
    if (!container) return;

    const list = StorageManager.getHistory();
    if (countBadge) countBadge.textContent = list.length;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="history-empty">
          <span class="history-empty-mark">🌸</span>
          <div>
            <strong>Пока пусто</strong>
            <p>Откройте фильм или серию — прогресс появится в этой ленте.</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-card';
      card.tabIndex = 0;

      // Colorful animated poster gradients based on title
      const bgGradients = [
        'linear-gradient(135deg, #190926 0%, #3e1259 100%)',
        'linear-gradient(135deg, #260909 0%, #591b12 100%)',
        'linear-gradient(135deg, #091c26 0%, #123e59 100%)',
        'linear-gradient(135deg, #1b2609 0%, #465912 100%)'
      ];
      const randomBg = bgGradients[Math.abs(item.title.length) % bgGradients.length];

      card.innerHTML = `
        <div class="history-thumb-wrap" style="background: ${randomBg};">
          <div class="history-thumb-overlay"></div>
          <span class="history-source-badge">${item.sourceName || 'Видео'}</span>
          <div class="history-play-hover">▶</div>
        </div>
        <div class="history-info">
          <div class="history-title" title="${esc(item.title)}">${esc(item.title)}</div>
          <div class="history-episode">
            <span>${item.episode || 'Просмотр'}</span>
            <span>${item.timestamp || ''}</span>
          </div>
          <div class="history-progress-bar">
            <div class="history-progress-fill" style="width: ${item.progressPercent || 25}%;"></div>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        openTargetSite(item.siteUrl, item.title, item.isInternal === true);
      });

      container.appendChild(card);
    });
  }

  // ==========================================================================
  // Multi-Engine Search
  // ==========================================================================
  function setupSearch() {
    const form = document.getElementById('searchForm');
    const input = document.getElementById('searchInput');
    const engineSelect = document.getElementById('searchEngine');

    if (!form || !input) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = input.value.trim();
      if (!query) return;

      const engine = engineSelect ? engineSelect.value : 'hdrezka';
      let targetUrl = '';

      // Direct URL check
      if (/^https?:\/\//i.test(query) || (query.includes('.') && !query.includes(' '))) {
        targetUrl = query.startsWith('http') ? query : 'https://' + query;
        openTargetSite(targetUrl, 'Сайт: ' + query);
        return;
      }

      switch (engine) {
        case 'hdrezka':
          targetUrl = `${mirrorsManager.activeMirror}/search/?do=search&subaction=search&q=${encodeURIComponent(query)}`;
          openTargetSite(targetUrl, `HDrezka: ${query}`);
          break;
        case 'animego':
          targetUrl = `https://animego.org/search/anime?q=${encodeURIComponent(query)}`;
          openTargetSite(targetUrl, `AnimeGo: ${query}`);
          break;
        case 'kinopoisk':
          targetUrl = `https://www.kinopoisk.ru/index.php?kp_query=${encodeURIComponent(query)}`;
          openTargetSite(targetUrl, `Кинопоиск: ${query}`);
          break;
        case 'youtube':
          targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
          openTargetSite(targetUrl, `YouTube: ${query}`);
          break;
        default:
          targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
          openTargetSite(targetUrl, `Поиск: ${query}`);
      }
    });

    // Shortcut: Press "/" to focus search
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== input) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  // ==========================================================================
  // Category Tabs Filter
  // ==========================================================================
  function setupCategoryFilters() {
    const pills = document.querySelectorAll('.cat-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentCategory = pill.getAttribute('data-cat') || 'all';
        renderSiteCards();
        mascot.playChime('happy');
      });
    });
  }

  // ==========================================================================
  // Header Action Buttons
  // ==========================================================================
  function setupHeaderActions() {
    // 1. Mirrors Modal Button
    const mirrorBtn = document.getElementById('headerMirrorBtn');
    if (mirrorBtn) {
      mirrorBtn.addEventListener('click', () => {
        openModal('mirrorsModal');
      });
    }

    // 2. Cinema Mode Button
    const cinemaBtn = document.getElementById('btnCinemaMode');
    if (cinemaBtn) {
      cinemaBtn.addEventListener('click', () => {
        const isNowActive = document.body.classList.toggle('cinema-mode-active');
        mascot.onCinemaModeToggled(isNowActive);
      });
    }

    // Overlay click exits cinema mode
    const cinemaOverlay = document.getElementById('cinemaOverlay');
    if (cinemaOverlay) {
      cinemaOverlay.addEventListener('click', () => {
        document.body.classList.remove('cinema-mode-active');
        mascot.onCinemaModeToggled(false);
      });
    }

    // 3. TV Mode Button
    const tvBtn = document.getElementById('btnTvMode');
    if (tvBtn) {
      tvBtn.addEventListener('click', () => {
        const isTv = document.body.classList.toggle('tv-mode-active');
        activeSettings.tvModeEnabled = isTv;
        StorageManager.saveSettings(activeSettings);
        mascot.say(isTv ? 'ТВ-режим включен! Используй стрелки клавиатуры или пульт 📺' : 'Обычный режим включен 💻', 3500);
      });
    }

    // 4. Background & Theme Selector Button
    const themeBtn = document.getElementById('btnThemeModal');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        openModal('themeModal');
      });
    }

    // 5. Settings Button
    const settingsBtn = document.getElementById('btnSettingsModal');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        openModal('settingsModal');
      });
    }

    // 6. Open Add Site Button from Category bar
    const addSiteBtn = document.getElementById('btnOpenAddSite');
    if (addSiteBtn) {
      addSiteBtn.addEventListener('click', () => {
        openModal('addSiteModal');
      });
    }
  }

  // ==========================================================================
  // Mirrors Management Modal
  // ==========================================================================
  function renderMirrorsModalList(state) {
    const listContainer = document.getElementById('modalMirrorsList');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    state.mirrors.forEach(mirror => {
      const item = document.createElement('div');
      item.className = `mirror-item ${mirror.url === state.activeMirror ? 'active-mirror' : ''}`;

      let pingBadgeClass = 'fast';
      let pingText = `${mirror.ping || 45} ms`;
      if (mirror.status === 'testing') {
        pingBadgeClass = 'medium';
        pingText = 'Тест...';
      } else if (mirror.status === 'offline' || mirror.ping > 200) {
        pingBadgeClass = 'slow';
        pingText = mirror.status === 'offline' ? 'Блок' : `${mirror.ping} ms`;
      } else if (mirror.ping > 80) {
        pingBadgeClass = 'medium';
      }

      item.innerHTML = `
        <div class="mirror-left">
          <span class="status-dot ${mirror.status === 'testing' ? 'testing' : ''}" style="${mirror.status === 'offline' ? 'background: #ef476f; box-shadow: 0 0 8px #ef476f;' : ''}"></span>
          <div>
            <div class="mirror-url-title">${mirror.label || mirror.url}</div>
            <div class="mirror-region">${mirror.url} • ${mirror.region || 'Сервер'}</div>
          </div>
        </div>
        <div class="mirror-right">
          <span class="mirror-ping-badge ${pingBadgeClass}">${pingText}</span>
          <button class="mirror-select-btn" data-url="${mirror.url}">
            ${mirror.url === state.activeMirror ? '✓ Активно' : 'Выбрать'}
          </button>
        </div>
      `;

      const selectBtn = item.querySelector('.mirror-select-btn');
      selectBtn.addEventListener('click', () => {
        mirrorsManager.setActive(mirror.url);
        mascot.onMirrorChanged(mirror.label || mirror.url);
      });

      listContainer.appendChild(item);
    });
  }

  // ==========================================================================
  // Modals Framework & Form Handlers
  // ==========================================================================
  function setupModals() {
    // Close button handlers
    document.querySelectorAll('.modal-close-btn, .modal-close-trigger').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-backdrop');
        if (modal) modal.classList.remove('open');
      });
    });

    // Close on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('open');
        }
      });
    });

    // Mirror Modal buttons
    const btnTestMirrors = document.getElementById('btnTestAllMirrors');
    if (btnTestMirrors) {
      btnTestMirrors.addEventListener('click', async () => {
        btnTestMirrors.disabled = true;
        btnTestMirrors.textContent = 'Тестирование...';
        mascot.say('Проверяю отклик зеркал HDrezka... ⏱️', 3000);
        await mirrorsManager.testAllMirrors();
        btnTestMirrors.disabled = false;
        btnTestMirrors.textContent = '⚡ Проверить все';
      });
    }

    const btnAutoSelect = document.getElementById('btnAutoSelectFastest');
    if (btnAutoSelect) {
      btnAutoSelect.addEventListener('click', async () => {
        btnAutoSelect.disabled = true;
        btnAutoSelect.textContent = 'Поиск лучшего...';
        const fastest = await mirrorsManager.autoSelectFastest();
        btnAutoSelect.disabled = false;
        btnAutoSelect.textContent = '🚀 Самое быстрое';
        if (fastest) {
          mascot.say(`Выбрано самое быстрое зеркало: <b>${fastest.label || fastest.url}</b> (${fastest.ping}ms)! ⚡`, 5000);
        }
      });
    }

    const btnSyncRemote = document.getElementById('btnSyncGitHubMirrors');
    if (btnSyncRemote) {
      btnSyncRemote.addEventListener('click', async () => {
        btnSyncRemote.disabled = true;
        btnSyncRemote.textContent = 'Синхронизация...';
        const res = await mirrorsManager.syncFromRemote();
        btnSyncRemote.disabled = false;
        btnSyncRemote.textContent = '🔄 Обновить с GitHub';
        if (res.success) {
          mascot.say('Список зеркал успешно обновлен! Всегда актуальные адреса 🌸', 4000);
        }
      });
    }

    // Add Custom Mirror Form
    const formAddMirror = document.getElementById('formAddMirror');
    if (formAddMirror) {
      formAddMirror.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputUrl = document.getElementById('inputMirrorUrl').value.trim();
        const inputLabel = document.getElementById('inputMirrorLabel').value.trim();
        if (inputUrl) {
          mirrorsManager.addMirror(inputUrl, inputLabel);
          formAddMirror.reset();
          mascot.say('Новое зеркало добавлено в список! 🌟', 3000);
        }
      });
    }

    // Add Custom Site Form
    const formAddSite = document.getElementById('formAddSite');
    if (formAddSite) {
      formAddSite.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('newSiteTitle').value.trim();
        let url = document.getElementById('newSiteUrl').value.trim();
        const cat = document.getElementById('newSiteCategory').value;
        const desc = document.getElementById('newSiteDesc').value.trim();

        if (!title || !url) return;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }

        const newSite = {
          id: 'custom-' + Date.now(),
          title: title,
          originalTitle: 'ПОЛЬЗОВАТЕЛЬСКИЙ',
          category: cat,
          description: desc || 'Пользовательский онлайн-кинотеатр',
          badge: '⭐ Свой сайт',
          badgeType: 'custom',
          url: url,
          isMirrorDependent: false,
          themeColor: '#ff7597',
          bgGradient: 'linear-gradient(135deg, #180d2b 0%, #3a154c 50%, #ff7597 100%)',
          rating: '5.0',
          tags: ['Мой сайт'],
          isFavorite: true
        };

        sites.push(newSite);
        StorageManager.saveSites(sites);
        renderSiteCards();
        formAddSite.reset();
        document.getElementById('addSiteModal').classList.remove('open');
        mascot.say(`Сайт «<b>${title}</b>» успешно добавлен на главный экран! 🎉`, 4000);
      });
    }

    // Theme & Background selector
    setupBackgroundControls();

    // Settings Profile Export / Import
    setupSettingsControls();
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('open');
      if (id === 'mirrorsModal') {
        renderMirrorsModalList(mirrorsManager.getState());
      }
    }
  }

  // ==========================================================================
  // Background & Particle Controls
  // ==========================================================================
  function setupBackgroundControls() {
    // Preset buttons
    document.querySelectorAll('.bg-preset-card').forEach(card => {
      card.addEventListener('click', () => {
        const preset = card.getAttribute('data-preset');
        applyBackgroundPreset(preset);
        activeSettings.bgPreset = preset;
        StorageManager.saveSettings(activeSettings);
      });
    });

    // Particle Effect Mode Select
    const particleSelect = document.getElementById('particleModeSelect');
    if (particleSelect) {
      particleSelect.value = activeSettings.particleEffect || 'sakura';
      particleSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        sakuraEngine.setMode(mode);
        activeSettings.particleEffect = mode;
        StorageManager.saveSettings(activeSettings);
      });
    }

    // Custom APNG / GIF / Video upload
    const bgFileInput = document.getElementById('bgCustomFileInput');
    if (bgFileInput) {
      bgFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target.result;
          StorageManager.setCustomBackground(dataUrl);
          document.body.style.backgroundImage = `url('${dataUrl}')`;
          activeSettings.bgPreset = 'custom';
          StorageManager.saveSettings(activeSettings);
          mascot.say('Пользовательский анимированный фон установлен! 🌸', 4000);
        };
        reader.readAsDataURL(file);
      });
    }
  }

  function applyBackgroundPreset(preset) {
    document.body.className = '';
    document.body.style.backgroundImage = '';

    const videoContainer = document.getElementById('bgVideoContainer');
    const video = document.getElementById('bgVideoWallpaper');

    if (preset === 'dream-chaser') {
      if (videoContainer) videoContainer.classList.add('active');
      if (video) {
        video.play().catch(() => {});
      }
      document.body.classList.add('bg-dream-chaser');
    } else {
      if (videoContainer) videoContainer.classList.remove('active');
      if (video) {
        video.pause();
      }
      if (preset === 'custom') {
        const customBg = StorageManager.getCustomBackground();
        if (customBg) {
          document.body.style.backgroundImage = `url('${customBg}')`;
        } else {
          document.body.classList.add('bg-dream-chaser');
          if (videoContainer) videoContainer.classList.add('active');
        }
      } else {
        document.body.classList.add(`bg-${preset}`);
      }
    }

    if (activeSettings.tvModeEnabled) {
      document.body.classList.add('tv-mode-active');
    }
    if (document.body.classList.contains('cinema-mode-active')) {
      document.body.classList.add('cinema-mode-active');
    }
  }

  // ==========================================================================
  // Settings & Sync Controls
  // ==========================================================================
  function setupSettingsControls() {
    const btnExport = document.getElementById('btnExportBackup');
    const btnImport = document.getElementById('btnImportBackup');
    const importInput = document.getElementById('importBackupFileInput');

    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const json = StorageManager.exportProfile();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sakura_cinema_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        mascot.say('Резервная копия сохранена! Можно перенести на телефон или другой ПК 📱', 4000);
      });
    }

    if (btnImport && importInput) {
      btnImport.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = StorageManager.importProfile(event.target.result);
          alert(result.message);
          if (result.success) {
            window.location.reload();
          }
        };
        reader.readAsText(file);
      });
    }

    // Toggle Adblock option
    const chkAdblock = document.getElementById('settingAdblockChk');
    if (chkAdblock) {
      chkAdblock.checked = activeSettings.adblockEnabled;
      chkAdblock.addEventListener('change', (e) => {
        activeSettings.adblockEnabled = e.target.checked;
        StorageManager.saveSettings(activeSettings);
        mascot.say(e.target.checked ? 'Встроенный блокировщик рекламы активен! 🛡️' : 'Блокировщик отключен', 3000);
      });
    }
  }

  function applySettings(settings) {
    if (settings.bgPreset) {
      applyBackgroundPreset(settings.bgPreset);
    }
    if (settings.particleEffect) {
      sakuraEngine.setMode(settings.particleEffect);
    }
    if (settings.tvModeEnabled) {
      document.body.classList.add('tv-mode-active');
    }
  }

  // ==========================================================================
  // Android TV & Keyboard D-Pad Navigation
  // ==========================================================================
  function setupTVNavigation() {
    window.addEventListener('keydown', (e) => {
      // Escape closes open modals or cinema mode
      if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal-backdrop.open');
        if (openModal) {
          openModal.classList.remove('open');
          return;
        }
        if (document.body.classList.contains('cinema-mode-active')) {
          document.body.classList.remove('cinema-mode-active');
          mascot.onCinemaModeToggled(false);
          return;
        }
      }

      // Quick shortcut 'c' for cinema mode
      if ((e.key === 'c' || e.key === 'с') && document.activeElement.tagName !== 'INPUT') {
        document.body.classList.toggle('cinema-mode-active');
        mascot.onCinemaModeToggled(document.body.classList.contains('cinema-mode-active'));
      }
    });
  }
});
