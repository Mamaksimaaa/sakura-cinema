# Sakura Anime — AniLibria 🌸

Каталог аниме и HLS-плеер AniLibria. Папка работает как отдельный сайт и используется при сборке Windows-приложения.

На шкале перемотки отображаются таймкод и превью серии; при перетаскивании превью обновляется кадром выбранной позиции. Во время воспроизведения панели и курсор скрываются вместе после 2,6 секунды бездействия.

Вкладка «Досмотреть» локально сохраняет серию и позицию воспроизведения в браузере. Вкладка «Онгоинги» собирает текущие релизы из каталога, а выбор жанра дополнительно проверяется по данным релиза.

Поиск использует каталог API: подсказки с постерами появляются при вводе, а дополнительные результаты подгружаются автоматически при прокрутке.

## Структура

```
anilibria-host/
├── index.html          ← каталог и встроенный видеоплеер
├── sw.js               ← Service Worker (PWA)
├── manifest.json       ← PWA манифест
├── vercel.json         ← конфиг для Vercel
├── netlify.toml        ← конфиг для Netlify
├── css/
│   └── anilibria.css
├── js/
│   ├── anilibria.js    ← логика каталога + плеер
│   ├── hls.min.js      ← HLS воспроизведение
│   └── sakura-engine.js← частицы сакуры
├── assets/
│   ├── logo-dark.png
│   ├── mascot-dark.png
│   ├── mascot.svg
│   ├── bg-cyberpunk-dark.png
│   ├── bg-midnight-sakura.png
│   └── dream-chaser.mp4
└── data/
    └── anilibria_cache.json
```

## Деплой за 1 минуту

### Vercel (рекомендуется)
```bash
npm i -g vercel
cd anilibria-host
vercel --prod
```

### Netlify
Перетащи папку `anilibria-host` на https://app.netlify.com/drop

### GitHub Pages
```bash
cd anilibria-host
git init
git add .
git commit -m "Sakura Anime deploy"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/sakura-anime.git
git push -u origin main
# Включить Pages в Settings → Pages → Branch: main
```

### Локальный запуск
Просто открыть `index.html` в браузере, или:
```bash
npx serve .
# → http://localhost:3000
```

## Windows-приложение

Запусти `build_exe.bat` из корневой папки проекта. Скрипт скачает официальный
автономный установщик WebView2 Runtime, встроит главную страницу Sakura Cinema,
плеер AniLibria, все ресурсы и видеообои из корневой папки `assets`, а также .NET в один
`SakuraAnime.exe` и положит его сюда. Для сборки нужны .NET 10 SDK и интернет.
Пользователю достаточно одного `.exe`: при первом запуске он автоматически
установит WebView2 Runtime, если его ещё нет в Windows.

### Загрузчик для большого EXE

Готовый `SakuraCinemaDownloader.exe` скачивает полный `SakuraAnime.exe` из Google Drive,
проверяет PE-сигнатуру и SHA-256, сохраняет приложение в `%LOCALAPPDATA%\SakuraCinema`
и создаёт ярлык на рабочем столе. Из-за предупреждения Google Drive о том, что файл
не прошёл антивирусную проверку, загрузка начинается только после нажатия кнопки.
Загрузчик не запускает скачанное приложение автоматически.

Чтобы пересобрать загрузчик, запусти `build_downloader.ps1` из корня проекта
(требуется .NET 10 SDK). Результат появится рядом с плеером как
`SakuraCinemaDownloader.exe`.
