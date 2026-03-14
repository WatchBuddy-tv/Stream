# <img src="https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/bb/1d/47/bb1d4757-5384-a7d1-83ac-eb0d8f1b45a8/Placeholder.mill/64x64bb.png" height="32" align="center"> WatchBuddy Stream（KekikStreamAPI 分支）

[![Add stream.watchbuddy.tv to WatchBuddy](https://img.shields.io/badge/Add-stream.watchbuddy.tv-blue?style=flat-square)](https://keyiflerolsun.tr/http-protocol-redirector/?r=watchbuddy://provider?url=https://stream.watchbuddy.tv)

WatchBuddy 需要一个可靠且整洁的流媒体层，这个仓库正是为此而存在。
它**不是**开发沙盒，而是 WatchBuddy 正在使用的**生产级集成分支**。

[🇺🇸 English](./ReadMe.md) • [🇹🇷 Türkçe](./ReadMe_TR.md) • [🇫🇷 Français](./ReadMe_FR.md) • [🇷🇺 Русский](./ReadMe_RU.md) • [🇺🇦 Українська](./ReadMe_UK.md) • [🇮🇳 हिन्दी](./ReadMe_HI.md)

---

## 它提供什么

KekikStreamAPI 将 **KekikStream 引擎** 与 Web UI、REST API 结合在一起，提供端到端流媒体体验。这个分支在不修改核心引擎的前提下，让它可以直接服务于 WatchBuddy。

- 多来源发现：从多个来源搜索并观看
- 网页界面：响应式、易用，并支持基于 Cookie 的语言持久化（TR/EN/FR/RU/UK/HI/ZH）
- REST 接口：对齐 WatchBuddy 客户端，并支持远程提供方
- 远程提供方架构：可通过 schema 发现并连接其他 WatchBuddy 提供方
- yt-dlp 集成：支持 YouTube 与 1000+ 站点
- 多语言：页面刷新后依然保留语言选择

## 为什么要有这个分支

我们分叉 **KekikStreamAPI**，是为了给 WatchBuddy 提供一个**即插即用的流媒体服务**，几乎无需复杂配置。目标是提供整洁的集成界面、可预测的 API 响应以及多语言公共界面。

## 这个分支额外提供什么

- WatchBuddy 对齐的 API 响应和元数据
- 带 Cookie 语言持久化的公共 UI（TR/EN/FR/RU/UK/HI/ZH）
- 带 schema 发现端点的远程 provider 架构
- 直接远程 provider 请求转发
- 为 WatchBuddy 客户端调好的默认配置
- 低配置、快速集成
