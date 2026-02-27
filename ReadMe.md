# <img src="https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/bb/1d/47/bb1d4757-5384-a7d1-83ac-eb0d8f1b45a8/Placeholder.mill/64x64bb.png" height="32" align="center"> WatchBuddy Stream (KekikStreamAPI Fork)

[![Add stream.watchbuddy.tv to WatchBuddy](https://img.shields.io/badge/Add-stream.watchbuddy.tv-blue?style=flat-square)](https://keyiflerolsun.tr/http-protocol-redirector/?r=watchbuddy://provider?url=https://stream.watchbuddy.tv)

WatchBuddy needs a reliable, clean streaming layer. This repo provides that layer.
It is **not** a development sandbox — it is the **production‑ready integration fork** used by WatchBuddy.

[🇹🇷 Türkçe](./ReadMe_TR.md) • [🇫🇷 Français](./ReadMe_FR.md) • [🇷🇺 Русский](./ReadMe_RU.md) • [🇺🇦 Українська](./ReadMe_UK.md)

---

## 🚦 What It Provides

KekikStreamAPI combines the **KekikStream engine** with a Web UI and REST API to deliver an end‑to‑end streaming experience.
This fork makes it **WatchBuddy‑ready** without modifying the core engine.

- 🎥 Multi‑source discovery: search and watch from many sources
- 🌐 Web UI: responsive, user‑friendly experience with cookie‑based language persistence (TR/EN/FR/RU/UK)
- 🔌 REST API: aligned to WatchBuddy clients with remote provider support
- 🔗 Remote Provider Architecture: can connect to other WatchBuddy providers via schema discovery
- 🎬 yt‑dlp integration: YouTube + 1000+ sites
- 🌍 Multilingual: persistent language selection across page reloads

---

## 🎯 Why This Fork Exists

We forked **KekikStreamAPI** to provide a **drop‑in streaming service** for WatchBuddy with minimal setup.
The goal is a clean integration surface, predictable API responses, and a multilingual public UI.

---

## ✨ What This Fork Adds

- ✅ WatchBuddy‑aligned API responses and metadata
- ✅ Public UI with cookie‑based language persistence (TR/EN/FR/RU/UK)
- ✅ Remote provider architecture with schema discovery endpoint
- ✅ Direct remote provider request routing
- ✅ Defaults tuned for WatchBuddy clients
- ✅ Simple integration with minimal configuration

---

## ✅ What This Fork Does NOT Do

- 🔒 No hosting or distribution of media
- 🧠 No changes to the KekikStream core engine logic
- 🌍 No control over third‑party content sources

---

## 🔗 Upstream & Base

Upstream engine: [KekikStream](https://github.com/keyiflerolsun/KekikStream)

Fork base: [KekikStreamAPI](https://github.com/keyiflerolsun/KekikStreamAPI)

---

## 🚀 Quick Start

> Requirements: Python 3.11+, `yt-dlp`, and a browser.

```bash
pip install -r requirements.txt
python basla.py
```

👉 Open: **http://127.0.0.1:3310**

👉 [Add http://localhost:3310 to WatchBuddy](https://keyiflerolsun.tr/http-protocol-redirector/?r=watchbuddy://provider?url=http://localhost:3310)

---

## 🔌 API Endpoints (Summary)

| Endpoint                     | Description                               |
|------------------------------|-------------------------------------------|
| `/api/v1/health`             | Health check                              |
| `/api/v1/schema`             | Provider schema with proxy URLs and name  |
| `/api/v1/get_plugin_names`   | All plugins                               |
| `/api/v1/get_plugin`         | Plugin details                            |
| `/api/v1/search`             | Search content (supports remote provider) |
| `/api/v1/get_main_page`      | Category content                          |
| `/api/v1/load_item`          | Content details                           |
| `/api/v1/load_links`         | Video links                               |
| `/api/v1/extract`            | Link extraction                           |
| `/api/v1/ytdlp-extract`      | yt-dlp video details                      |

---

## 🛠️ Want to Add New Sources?

This repository is **not** for provider development.
If you want to build your own provider, use the official guide and templates: [WatchBuddy ExampleProvider](https://github.com/WatchBuddy-tv/ExampleProvider)

---

## ⚖️ Legal & Responsibility

- WatchBuddy Stream does **not** host, store, or distribute media.
- Content sources are **third‑party** and provided by users or providers.
- Responsibility for content, legality, and compliance **belongs to the user**.
- Availability and legality may vary by region.

---

## 🌐 License

Follow the repository‑level license policy for WatchBuddy.
