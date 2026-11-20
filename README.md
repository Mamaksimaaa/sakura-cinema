# Sakura Cinema Browser 🌸 (桜シネマ)

> **Аниме-браузер в стиле онлайн-кинотеатра:** вместо пустой стартовой страницы — живописная главная с постерами сайтов, падающими лепестками сакуры, интерактивным талисманом и умным переключателем зеркал HDrezka.

---

## 🌟 Возможности прототипа

### 1. Главный экран & Атмосфера
- **Анимированный фон и физика частиц:** 
  - Реалистичные падающие лепестки сакуры с реакцией на ветер и движение мыши.
  - Режим «Неоновый Токио» с киберпанк-дождём.
  - Режим «Лоуфай Ночь» со светящимися светлячками.
  - Поддержка загрузки собственных **APNG / GIF / WebM / MP4** фонов прямо в настройках.
- **Стеклянные панели (Glassmorphism):** полупрозрачный интерфейс с размытием `backdrop-filter: blur(16px)`, неоновым свечением и аниме-шрифтами (`M PLUS Rounded 1c`, `Outfit`).
- **Режим кинотеатра (Cinema Mode):** кнопка на панели (или клавиша `C`) плавно затемняет весь интерфейс и гасит свет, оставляя фокус на просмотре.

### 2. Умные зеркала HDrezka
- **Автоматический выбор и тестирование пинга:** проверяет время отклика зеркал в миллисекундах и выделяет самое быстрое.
- **Обновление без релизов:** загрузка свежего списка зеркал с удалённого сервера или **GitHub JSON** (`data/mirrors.json`).
- **Быстрое переключение:** индикатор зеркала прямо в шапке и на карточке HDrezka — при смене зеркала все ссылки автоматически ведут на актуальный домен.
- **Добавление своих адресов:** возможность вручную вписать новое рабочее зеркало.

### 3. Интерактивный маскот (Сакура-тян 🌸)
- Живёт в правом нижнем углу экрана.
- **Приветствует** пользователя в зависимости от времени суток (утро, день, вечер, ночь).
- **Напоминает**, что вы смотрели в прошлый раз («Ты остановился на Клинок, рассекающий демонов...»).
- **Реагирует** звуками и анимацией на клик, переключение зеркал и выбор сайтов.
- Рассказывает шутки и цитаты отаку.

### 4. Постеры сайтов & Мультипоиск
- Каталог топовых ресурсов: **HDrezka, AniLibria, AnimeGo, Кинопоиск, YouTube, Crunchyroll, Shikimori, Lordfilm**.
- Кнопка **«+ Добавить сайт»** для добавления любого своего онлайн-кинотеатра.
- Фильтры по категориям: *Все*, *⭐ Избранное*, *⛩️ Аниме*, *🎬 Фильмы*, *📺 Стриминг*.
- **Мультипоисковая строка (Omnibox):** поиск напрямую по базе HDrezka, AnimeGo, Кинопоиска или YouTube, либо прямой ввод URL.

### 5. «Продолжить просмотр» & Синхронизация
- Лента недавно просмотренных серий/фильмов с индикатором прогресса и быстрым запуском.
- **Экспорт / Импорт профиля (JSON):** перенос списка избранного, истории и зеркал между компьютером, телефоном и ТВ в один клик.

### 6. ТВ-режим (Android TV / Пульт)
- Поддержка навигации стрелками D-Pad с высокой контрастной подсветкой фокуса.
- Крупные элементы, удобные для управления с дивана.

---

## 🚀 Как запустить прямо сейчас

Прототип не требует установки сторонних библиотек и готов к открытию в любом браузере:

1. Откройте файл `index.html` в вашем браузере (**Google Chrome, Microsoft Edge, Firefox, Safari**).
2. Или запустите локальный сервер, если хотите тестировать на телефоне по Wi-Fi.

---

## 🚀 Единый автономный .EXE для Windows

Приложение упаковано в **единый файл `SakuraCinema.exe` без внешних зависимостей и папок**:

* **Основной исполняемый файл:** [SakuraCinema.exe](file:///c:/Users/Soft/Desktop/Проект/SakuraCinema.exe) (38.1 МБ)
* **Ярлык с иконкой:** [Sakura Cinema.lnk](file:///c:/Users/Soft/Desktop/Проект/Sakura%20Cinema.lnk)
* **Быстрый запуск:** [Запустить Sakura Cinema.bat](file:///c:/Users/Soft/Desktop/Проект/Запустить%20Sakura%20Cinema.bat)

> **Всё внутри одного файла:** 
> 4K видео-обои *Dream Chaser*, неоновые фоны из Figma, логотип, текстуры маскота, стили, скрипты, база зеркал и WebView2Loader вшиты прямо в тело исполняемого файла `SakuraCinema.exe`. Рядом с ним не требуется никаких дополнительных файлов или папок — его можно скопировать на рабочий стол или флешку и запускать в один клик.

### Особенности Windows-версии (.NET 10 + WebView2):
- **Сверхбыстрый запуск и минимальное потребление RAM** благодаря системному движку Microsoft Edge WebView2.
- **Тёмная тема заголовка окна** Windows 10/11 (DWM Immersive Dark Mode).
- **Встроенный перехватчик всплывающих окон (Popup & Adblock)**: блокирует кликандеры и рекламу казино/букмекеров, характерную для бесплатных видеоплееров.
- **Автоматический переход в настоящий безрамочный полноэкранный режим** при нажатии на кнопку Fullscreen в плеере видео.
- **Горячие клавиши:**
  - `F11` — Полноэкранный режим
  - `F5` — Обновить страницу
  - `Alt + Стрелка влево` — Назад
  - `Alt + Стрелка вправо` — Вперёд
  - `Alt + Home` — Возврат на домашний экран Sakura Cinema
  - `Esc` — Выход из полноэкранного режима

---

## 🛠️ Как пересобрать .EXE вручную

Если вы отредактировали стили, скрипты или исходный C# код:

```powershell
# Сборка готового дистрибутива в папку dist:
dotnet publish src-pc/SakuraCinema.csproj -c Release -o dist
```

---

## 📱 Сборка для ПК и Android (Tauri 2 / Capacitor)

Интерфейс спроектирован по модели **Single Codebase**:

### Вариант 1: Tauri 2 (Рекомендуется — лёгкий вес, мало RAM)
```bash
# Инициализация Tauri 2 с существующим фронтендом:
npm create tauri-app@latest
# Выберите: Vanilla HTML/JS, укажите каталог "."

# Запуск на ПК:
npm run tauri dev

# Сборка Android APK:
npm run tauri android init
npm run tauri android build
```

### Вариант 2: Capacitor (Максимально простая сборка APK)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Sakura Cinema" "com.sakura.cinema"
npx cap add android
npx cap copy
npx cap open android
```

#### ⚠️ Важно для Android WebView: Полноэкранный плеер
В Android WebView для работы кнопки «На весь экран» в HTML5-видеоплеере необходимо переопределить метод `onShowCustomView` в `WebChromeClient`:

```java
// MainActivity.java / CustomWebChromeClient.java
webView.setWebChromeClient(new WebChromeClient() {
    private View customView;
    private CustomViewCallback customViewCallback;

    @Override
    public void onShowCustomView(View view, CustomViewCallback callback) {
        if (customView != null) {
            onHideCustomView();
            return;
        }
        customView = view;
        customViewCallback = callback;
        // Разворачиваем view на весь экран поверх WebView
        frameLayout.addView(view, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        frameLayout.setVisibility(View.VISIBLE);
        // Скрываем системные панели
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
    }

    @Override
    public void onHideCustomView() {
        if (customView == null) return;
        frameLayout.removeView(customView);
        customView = null;
        frameLayout.setVisibility(View.GONE);
        if (customViewCallback != null) customViewCallback.onCustomViewHidden();
    }
});
```

---

## 📂 Структура проекта

```
Проект/
├── index.html            # Главная разметка и все модальные окна
├── css/
│   └── styles.css        # Glassmorphism, аниме-темы, анимации, адаптив и ТВ-режим
├── js/
│   ├── app.js            # Главная логика, рендеринг постеров, поиск
│   ├── sakura-engine.js  # Canvas-движок частиц (лепестки сакуры, дождь, светлячки)
│   ├── mirrors.js        # Менеджер зеркал HDrezka (проверка пинга, автовыбор, GitHub JSON)
│   ├── mascot.js         # Диалоговый движок маскота Сакура-тян и аудиоэффекты Web Audio
│   └── storage.js        # Хранилище LocalStorage, экспорт/импорт профиля
├── data/
│   ├── mirrors.json      # База зеркал по умолчанию
│   └── sites.json        # Базовый каталог кинотеатров и аниме-порталов
├── assets/
│   └── mascot.svg        # Векторный аватар Сакура-тян 🌸
└── README.md             # Инструкция и руководство по сборке
```
