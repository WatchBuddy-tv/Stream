# <img src="https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/bb/1d/47/bb1d4757-5384-a7d1-83ac-eb0d8f1b45a8/Placeholder.mill/64x64bb.png" height="32" align="center"> WatchBuddy Stream (форк KekikStreamAPI)

[![Додати stream.watchbuddy.tv у WatchBuddy](https://img.shields.io/badge/Add-stream.watchbuddy.tv-blue?style=flat-square)](https://keyiflerolsun.tr/http-protocol-redirector/?r=watchbuddy://provider?url=https://stream.watchbuddy.tv)

WatchBuddy потребує надійного та чистого streaming-шару. Цей репозиторій надає саме його.
Це **не** sandbox для розробки — це **production-ready інтеграційний форк**, який використовує WatchBuddy.

[🇺🇸 English](./ReadMe.md) • [🇹🇷 Türkçe](./ReadMe_TR.md) • [🇫🇷 Français](./ReadMe_FR.md) • [🇷🇺 Русский](./ReadMe_RU.md)

---

## 🚦 Що надає цей форк

KekikStreamAPI поєднує **рушій KekikStream** із Web UI та REST API, формуючи наскрізний streaming-процес.
Цей форк робить його **готовим для WatchBuddy**, не змінюючи логіку ядра.

- 🎥 Мультиджерела: пошук і перегляд із багатьох джерел
- 🌐 Web UI: адаптивний та зручний інтерфейс із cookie-персистентністю мови (TR/EN/FR/RU/UK)
- 🔌 REST API: узгоджений із клієнтами WatchBuddy, включно з підтримкою віддалених providers
- 🔗 Архітектура віддалених провайдерів: підключення через schema discovery
- 🎬 Інтеграція yt-dlp: YouTube + 1000+ сайтів
- 🌍 Multilingual: вибрана мова зберігається між перезавантаженнями

---

## 🎯 Навіщо існує цей форк

Ми форкнули **KekikStreamAPI**, щоб надати для WatchBuddy **drop-in streaming service** з мінімальним налаштуванням.
Мета: чиста поверхня інтеграції, передбачувані API-відповіді та публічний багатомовний UI.

---

## ✨ Що додає цей форк

- ✅ API-відповіді та метадані, узгоджені з WatchBuddy
- ✅ Публічний UI з cookie-персистентністю мови (TR/EN/FR/RU/UK)
- ✅ Архітектура віддалених провайдерів з endpoint schema discovery
- ✅ Пряме маршрутизування запитів до віддалених провайдерів
- ✅ Дефолти, налаштовані під клієнтів WatchBuddy
- ✅ Проста інтеграція з мінімальною конфігурацією

---

## ✅ Що цей форк НЕ робить

- 🔒 Не хостить і не розповсюджує медіа
- 🧠 Не змінює логіку core-рушія KekikStream
- 🌍 Не контролює сторонні джерела контенту

---

## 🔗 Upstream і база

Upstream-рушій: [KekikStream](https://github.com/keyiflerolsun/KekikStream)

База форку: [KekikStreamAPI](https://github.com/keyiflerolsun/KekikStreamAPI)

---

## 🚀 Швидкий старт

> Вимоги: Python 3.11+, `yt-dlp` і браузер.

```bash
pip install -r requirements.txt
python basla.py
```

👉 Відкрити: **http://127.0.0.1:3310**

👉 [Додати http://localhost:3310 у WatchBuddy](https://keyiflerolsun.tr/http-protocol-redirector/?r=watchbuddy://provider?url=http://localhost:3310)

---

## 🔌 API Endpoints (коротко)

| Endpoint                     | Опис                                        |
|-----------------------------|---------------------------------------------|
| `/api/v1/health`            | Перевірка стану                             |
| `/api/v1/schema`            | Схема провайдера з proxy URLs і назвою      |
| `/api/v1/get_plugin_names`  | Усі плагіни                                 |
| `/api/v1/get_plugin`        | Деталі плагіна                              |
| `/api/v1/search`            | Пошук контенту (підтримка віддаленого provider) |
| `/api/v1/get_main_page`     | Контент за категоріями                      |
| `/api/v1/load_item`         | Деталі контенту                             |
| `/api/v1/load_links`        | Відеопосилання                              |
| `/api/v1/extract`           | Витягування посилання                       |
| `/api/v1/ytdlp-extract`     | Деталі відео через yt-dlp                   |

---

## 🛠️ Хочете додати нові джерела?

Цей репозиторій **не** призначений для розробки providers.
Якщо хочете створити власний провайдер, використовуйте офіційний гайд і шаблони: [WatchBuddy ExampleProvider](https://github.com/WatchBuddy-tv/ExampleProvider)

---

## ⚖️ Право і відповідальність

- WatchBuddy Stream **не хостить, не зберігає і не розповсюджує** медіа.
- Джерела контенту — **сторонні** сервіси, які обирають користувачі або провайдери.
- Відповідальність за контент, законність і відповідність вимогам **лежить на користувачі**.
- Доступність і законність можуть відрізнятися за регіонами.

---

## 🌐 Ліцензія

Дотримуйтеся політики ліцензування на рівні репозиторію WatchBuddy.
