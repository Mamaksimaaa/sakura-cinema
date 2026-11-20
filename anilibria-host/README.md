# Sakura Anime — Хостинг AniLibria 🌸

Автономная папка для деплоя страницы `anilibria.html` как отдельного сайта.

## Структура

```
anilibria-host/
├── index.html          ← главная страница (anilibria.html)
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
