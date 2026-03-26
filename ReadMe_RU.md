# <img src="https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/bb/1d/47/bb1d4757-5384-a7d1-83ac-eb0d8f1b45a8/Placeholder.mill/64x64bb.png" height="32" align="center"> WatchBuddy Stream (форк KekikStreamAPI)

[![Добавить stream.watchbuddy.tv в WatchBuddy](https://img.shields.io/badge/Add-stream.watchbuddy.tv-blue?style=flat-square)](https://keyiflerolsun.tr/http-protocol-redirector/?r=watchbuddy://provider?url=https://stream.watchbuddy.tv)

WatchBuddy нужен надежный и чистый streaming-слой. Этот репозиторий дает именно его.
Это **не** песочница для разработки — это **production-ready интеграционный форк**, используемый WatchBuddy.

[🇺🇸 English](./ReadMe.md) • [🇹🇷 Türkçe](./ReadMe_TR.md) • [🇫🇷 Français](./ReadMe_FR.md) • [🇺🇦 Українська](./ReadMe_UK.md) • [🇮🇳 हिन्दी](./ReadMe_HI.md) • [🇨🇳 简体中文](./ReadMe_ZH.md)

---

## 🚦 Что дает этот форк

KekikStreamAPI объединяет **движок KekikStream** с Web UI и REST API, формируя сквозной streaming-поток.
Этот форк делает его **готовым для WatchBuddy**, не меняя логику ядра.

- 🎥 Мульти-источники: поиск и просмотр из множества источников
- 🌐 Web UI: адаптивный и удобный интерфейс с cookie-персистентностью языка (TR/EN/FR/RU/UK)
- 🔌 REST API: выровнен под клиенты WatchBuddy, включая удаленные providers
- 🔗 Архитектура удаленных провайдеров: подключение через schema discovery
- 🎬 Интеграция yt-dlp: YouTube + 1000+ сайтов
- 🌍 Multilingual: выбранный язык сохраняется между перезагрузками

---

## 🎯 Зачем существует этот форк

Мы форкнули **KekikStreamAPI**, чтобы предоставить для WatchBuddy **drop-in streaming service** с минимальной настройкой.
Цель: чистая поверхность интеграции, предсказуемые API-ответы и публичный многоязычный UI.

---

## ✨ Что добавляет этот форк

- ✅ API-ответы и метаданные, выровненные под WatchBuddy
- ✅ Публичный UI с cookie-персистентностью языка (TR/EN/FR/RU/UK)
- ✅ Архитектура удаленных провайдеров с endpoint schema discovery
- ✅ Прямая маршрутизация запросов к удаленным провайдерам
- ✅ Дефолты, настроенные под клиентов WatchBuddy
- ✅ Простая интеграция с минимальной конфигурацией

---

## ✅ Что этот форк НЕ делает

- 🔒 Не хостит и не распространяет медиа
- 🧠 Не изменяет логику core-движка KekikStream
- 🌍 Не контролирует сторонние источники контента

---

## 🔗 Upstream и база

Upstream-движок: [KekikStream](https://github.com/keyiflerolsun/KekikStream)

База форка: [KekikStreamAPI](https://github.com/keyiflerolsun/KekikStreamAPI)

---

## 🚀 Быстрый старт

> Требования: Python 3.11+, `yt-dlp` и браузер.

```bash
pip install .
python basla.py
```

👉 Открыть: **http://127.0.0.1:3310**

👉 [Добавить http://localhost:3310 в WatchBuddy](https://keyiflerolsun.tr/http-protocol-redirector/?r=watchbuddy://provider?url=http://localhost:3310)

---

## 📱 Откройте экосистему

WatchBuddy доступен на **Android** и **iOS**.

Чтобы находить больше тайтлов и быстро отправлять фильм или сериал в room, вы также можете использовать один из сервисов:
- 🌐 **Stream Web:** https://stream.watchbuddy.tv
- 🤖 **Telegram-бот:** https://t.me/WatchBuddyRobot

---

## 🔌 API Endpoints (кратко)

| Endpoint                     | Описание                                   |
|-----------------------------|---------------------------------------------|
| `/api/v1/health`            | Проверка здоровья                           |
| `/api/v1/schema`            | Schema провайдера с proxy URLs и именем     |
| `/api/v1/get_plugin_names`  | Все плагины                                 |
| `/api/v1/get_plugin`        | Детали плагина                              |
| `/api/v1/search`            | Поиск контента (поддержка удаленного provider) |
| `/api/v1/get_main_page`     | Контент по категориям                       |
| `/api/v1/load_item`         | Детали контента                             |
| `/api/v1/load_links`        | Видео-ссылки                                |
| `/api/v1/extract`           | Извлечение ссылки                           |
| `/api/v1/ytdlp-extract`     | Детали видео через yt-dlp                   |

---

## 🛠️ Хотите добавить новые источники?

Этот репозиторий **не** предназначен для разработки providers.
Если хотите сделать своего провайдера, используйте официальный гайд и шаблоны: [WatchBuddy ExampleProvider](https://github.com/WatchBuddy-tv/ExampleProvider)

---

## ⚖️ Право и ответственность

- WatchBuddy Stream **не хостит, не хранит и не распространяет** медиа.
- Источники контента — **сторонние** сервисы, выбранные пользователем или провайдерами.
- Ответственность за контент, законность и соответствие требованиям **лежит на пользователе**.
- Доступность и законность могут отличаться по регионам.

---

## 🌐 Лицензия

Соблюдайте политику лицензирования на уровне репозитория WatchBuddy.
