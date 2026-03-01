# Finance Tracker (PWA UI)

React + Vite версия вашего Finance Tracker без CDN/Babel в рантайме.

## Что сделано
- Перенос из одного HTML в проектную структуру (`src/`, `package.json`, Vite).
- Tailwind подключен через сборку (PostCSS), а не через runtime CDN.
- Firebase конфиг вынесен в `.env` (`VITE_FIREBASE_CONFIG`) вместо редактирования кода.
- Сохранены все основные экраны: главная, аналитика, цели, категории, импорт/экспорт, облачная синхронизация.

## Локальный запуск
```bash
npm install
npm run dev
```

## Сборка
```bash
npm run build
npm run preview
```

## Firebase
1. Создай `.env` на основе `.env.example`.
2. Заполни `VITE_FIREBASE_CONFIG` JSON-строкой.
3. (Опционально) задай `VITE_APP_ID`.

Если `VITE_FIREBASE_CONFIG` не задан, приложение работает только на `localStorage`.

## GitHub Pages
Для репозитория `Melok90/no_money`:
```bash
npm install
npm run deploy
```

`deploy` использует `base=/no_money/` и публикует `dist/` через `gh-pages`.
