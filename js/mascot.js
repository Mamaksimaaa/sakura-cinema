/**
 * Sakura Cinema Browser - Anime Mascot Companion (Сакура-тян 🌸)
 * Delivers context tips, jokes, watch reminders and audio feedback
 */

class AnimeMascot {
  constructor() {
    this.container = document.getElementById('mascotContainer');
    this.speechEl = document.getElementById('mascotSpeech');
    this.speechTextEl = document.getElementById('mascotSpeechText');
    this.avatarEl = document.getElementById('mascotAvatar');
    
    this.hideTimeout = null;
    this.soundEnabled = true;
    this.audioCtx = null;
    this.isMuted = false;
    this.voiceAudio = null;
    this.sfxAudio = null;

    this.voice = {
      morning: 'assets/voice/greet-morning.mp3',
      day: 'assets/voice/greet-day.mp3',
      evening: 'assets/voice/greet-evening.mp3',
      night: 'assets/voice/greet-night.mp3',
      remind: 'assets/voice/remind.mp3',
      open: 'assets/voice/open-site.mp3',
      mirror: 'assets/voice/mirror-switched.mp3',
      cinemaOn: 'assets/voice/cinema-on.mp3',
      cinemaOff: 'assets/voice/cinema-off.mp3',
      quotes: [
        'assets/voice/quote-01.mp3',
        'assets/voice/quote-02.mp3',
        'assets/voice/quote-03.mp3',
        'assets/voice/quote-04.mp3',
        'assets/voice/quote-05.mp3',
        'assets/voice/quote-06.mp3',
        'assets/voice/quote-07.mp3',
        'assets/voice/quote-08.mp3',
        'assets/voice/quote-09.mp3',
        'assets/voice/quote-10.mp3'
      ],
      sfx: {
        happy: 'assets/voice/sfx-happy.mp3',
        success: 'assets/voice/sfx-success.mp3',
        tap: 'assets/voice/sfx-tap.mp3'
      }
    };

    this.quotes = [
      "Тёмная тема и 4K Dream Chaser видео-обои — это просто космос, семпай! 🎬🖤",
      "Смотри, какие атмосферные арты из Figma: неоновый дождь и лунная сакура! 🌧️⛩️",
      "Как тебе мой новый тёмный киберпанк-образ? Настоящая эстетика кинотеатра! ✨🌸",
      "В Sakura Cinema реклама не пройдет — блокировщик на страже! 🛡️",
      "Если зеркало HDrezka вдруг перестанет отвечать, я мигом подберу рабочее! ⚡",
      "Горячая клавиша 'C' включает режим кинотеатра — идеальное погружение ночью! 🌙",
      "«Если не сдаваться, мечта обязательно станет реальностью!» — Наруто Узумаки 🍥",
      "Завари чай с жасмином, устройство поудобнее — сейчас будет отличный просмотр! 🍵",
      "Я проверила все постеры: сегодня в топе отличные онгоинги! 🌸",
      "Нажми на ТВ-режим, если смотришь с дивана или пульта! 📺"
    ];

    this.init();
  }

  init() {
    if (!this.container) return;

    this.container.addEventListener('click', () => {
      this.playChime('tap');
      this.sayRandomQuote();
      this.bounce();
    });

    // Initial greeting after small delay
    setTimeout(() => {
      this.greetUser();
    }, 1200);
  }

  playVoice(src, { volume = 1 } = {}) {
    if (this.isMuted || !this.soundEnabled || !src) return;
    try {
      if (this.voiceAudio) {
        this.voiceAudio.pause();
        this.voiceAudio = null;
      }
      const audio = new Audio(src);
      audio.volume = volume;
      this.voiceAudio = audio;
      this.container?.classList.add('mascot-speaking');
      audio.addEventListener('ended', () => {
        this.container?.classList.remove('mascot-speaking');
      });
      audio.play().catch(() => {
        this.container?.classList.remove('mascot-speaking');
      });
    } catch (e) {
      this.container?.classList.remove('mascot-speaking');
    }
  }

  playChime(type = 'happy') {
    if (this.isMuted) return;
    const clip = this.voice.sfx[type] || this.voice.sfx.happy;
    if (clip) {
      try {
        if (this.sfxAudio) {
          this.sfxAudio.pause();
          this.sfxAudio = null;
        }
        const audio = new Audio(clip);
        audio.volume = type === 'tap' ? 0.45 : 0.7;
        this.sfxAudio = audio;
        const played = audio.play();
        if (played && typeof played.then === 'function') {
          played.catch(() => this.playSynthChime(type));
          return;
        }
        return;
      } catch (e) {
        // Fall through to the synthesizer if the file cannot play.
      }
    }
    this.playSynthChime(type);
  }

  playSynthChime(type = 'happy') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.audioCtx) this.audioCtx = new AudioContext();

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      gain.gain.setValueAtTime(0.08, now);

      if (type === 'happy') {
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      } else {
        osc.frequency.setValueAtTime(440, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      }

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {
      // Audio autoplay policy or failure ignored
    }
  }

  greetUser() {
    const hour = new Date().getHours();
    let greeting = "";
    if (hour >= 5 && hour < 12) {
      greeting = "Доброе утро, семпай! Чашечка кофе и утреннее аниме? ☕🌸";
    } else if (hour >= 12 && hour < 18) {
      greeting = "Конничива! Готов к просмотру любимого тайтла? 🎬✨";
    } else if (hour >= 18 && hour < 23) {
      greeting = "Добрый вечер! Время включить фильм и отдохнуть от суеты! 🍿";
    } else {
      greeting = "Ого, уже глубокая ночь! Включаю уютную атмосферу кинотеатра 🌙✨";
    }

    const slot = hour >= 5 && hour < 12 ? 'morning'
      : hour >= 12 && hour < 18 ? 'day'
      : hour >= 18 && hour < 23 ? 'evening'
      : 'night';

    const history = StorageManager.getHistory();
    const last = history && history.length > 0 ? history[0] : null;
    if (last && last.title) {
      const safeTitle = String(last.title).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
      greeting += ` <br><span class="mascot-tip">Напоминаю: ты смотрел «<b>${safeTitle}</b>».</span>`;
    }

    this.say(greeting, last ? 9000 : 7000);
    this.playVoice(this.voice[slot]);
    if (last) {
      window.setTimeout(() => this.playVoice(this.voice.remind, { volume: 0.95 }), 2800);
    }
  }

  say(htmlContent, durationMs = 6000) {
    if (!this.speechEl || !this.speechTextEl) return;

    clearTimeout(this.hideTimeout);
    this.speechTextEl.innerHTML = htmlContent;
    this.speechEl.classList.remove('hidden');
    this.speechEl.classList.add('visible');

    if (durationMs > 0) {
      this.hideTimeout = setTimeout(() => {
        this.speechEl.classList.remove('visible');
        setTimeout(() => {
          if (!this.speechEl.classList.contains('visible')) {
            this.speechEl.classList.add('hidden');
          }
        }, 300);
      }, durationMs);
    }
  }

  sayRandomQuote() {
    const randomIndex = Math.floor(Math.random() * this.quotes.length);
    this.say(this.quotes[randomIndex], 7000);
    const clip = this.voice.quotes[randomIndex];
    if (clip) this.playVoice(clip);
  }

  bounce() {
    if (!this.avatarEl) return;
    this.avatarEl.classList.remove('mascot-bounce');
    void this.avatarEl.offsetWidth; // trigger reflow
    this.avatarEl.classList.add('mascot-bounce');
  }

  onMirrorChanged(mirrorName) {
    this.playChime('success');
    this.bounce();
    const safeName = String(mirrorName || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    this.say(`Зеркало переключено на <b>${safeName}</b>! Скорость на максимуме! 🚀`, 5000);
    this.playVoice(this.voice.mirror);
  }

  onSiteOpened(siteName) {
    this.playChime('happy');
    const safeName = String(siteName || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    this.say(`Открываю <b>${safeName}</b>. Приятного просмотра! 🍿`, 4500);
    this.playVoice(this.voice.open);
  }

  onCinemaModeToggled(isActive) {
    if (isActive) {
      this.say(`Режим кинотеатра включен! Лишний свет погас ✨`, 3500);
      this.playVoice(this.voice.cinemaOn);
    } else {
      this.say(`Свет включен обратно! 💡`, 2500);
      this.playVoice(this.voice.cinemaOff);
    }
  }
}

window.AnimeMascot = AnimeMascot;
