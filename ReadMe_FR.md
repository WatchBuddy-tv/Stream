# <img src="https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/bb/1d/47/bb1d4757-5384-a7d1-83ac-eb0d8f1b45a8/Placeholder.mill/64x64bb.png" height="32" align="center"> WatchBuddy Stream (Fork KekikStreamAPI)

[![Ajouter stream.watchbuddy.tv a WatchBuddy](https://img.shields.io/badge/Add-stream.watchbuddy.tv-blue?style=flat-square)](https://keyiflerolsun.tr/http-protocol-redirector/?r=watchbuddy://provider?url=https://stream.watchbuddy.tv)

WatchBuddy a besoin d'une couche de streaming fiable et propre. Ce depot fournit cette couche.  
Ce n'est **pas** un bac a sable de developpement: c'est le **fork d'integration pret pour la production** utilise par WatchBuddy.

Autres langues: [ReadMe.md](./ReadMe.md) • [ReadMe_TR.md](./ReadMe_TR.md) • [ReadMe_RU.md](./ReadMe_RU.md) • [ReadMe_UK.md](./ReadMe_UK.md)

---

## 🚦 Ce que ce fork fournit

KekikStreamAPI combine le **moteur KekikStream** avec une UI Web et une API REST pour offrir une experience streaming de bout en bout.  
Ce fork le rend **pret pour WatchBuddy** sans modifier le moteur coeur.

- 🎥 Decouverte multi-source: rechercher et regarder depuis de nombreuses sources
- 🌐 UI Web: experience responsive et conviviale, avec persistance de langue via cookie (TR/EN/FR/RU/UK)
- 🔌 API REST: alignee sur les clients WatchBuddy, avec support des fournisseurs distants
- 🔗 Architecture Remote Provider: connexion a d'autres fournisseurs WatchBuddy via decouverte de schema
- 🎬 Integration yt-dlp: YouTube + plus de 1000 sites
- 🌍 Multilingue: selection de langue persistante apres rechargement

---

## 🎯 Pourquoi ce fork existe

Nous avons fork **KekikStreamAPI** pour fournir un **service de streaming plug-and-play** a WatchBuddy avec une configuration minimale.  
Objectif: une surface d'integration propre, des reponses API previsibles et une UI publique multilingue.

---

## ✨ Ce que ce fork ajoute

- ✅ Reponses API et metadonnees alignees WatchBuddy
- ✅ UI publique avec persistance de langue via cookie (TR/EN/FR/RU/UK)
- ✅ Architecture provider distant avec endpoint de decouverte schema
- ✅ Routage direct des requetes vers fournisseurs distants
- ✅ Valeurs par defaut optimisees pour les clients WatchBuddy
- ✅ Integration simple avec configuration minimale

---

## ✅ Ce que ce fork ne fait PAS

- 🔒 Aucun hebergement ni distribution de media
- 🧠 Aucune modification de la logique coeur de KekikStream
- 🌍 Aucun controle sur les sources de contenu tierces

---

## 🔗 Upstream et base

Moteur upstream: [KekikStream](https://github.com/keyiflerolsun/KekikStream)

Base du fork: [KekikStreamAPI](https://github.com/keyiflerolsun/KekikStreamAPI)

---

## 🚀 Demarrage rapide

> Prerequis: Python 3.11+, `yt-dlp`, et un navigateur.

```bash
pip install -r requirements.txt
python basla.py
```

👉 Ouvrir: **http://127.0.0.1:3310**

👉 [Ajouter http://localhost:3310 a WatchBuddy](https://keyiflerolsun.tr/http-protocol-redirector/?r=watchbuddy://provider?url=http://localhost:3310)

---

## 🔌 Endpoints API (resume)

| Endpoint                     | Description                                |
|-----------------------------|--------------------------------------------|
| `/api/v1/health`            | Verification de sante                      |
| `/api/v1/schema`            | Schema provider avec URLs proxy et nom     |
| `/api/v1/get_plugin_names`  | Tous les plugins                           |
| `/api/v1/get_plugin`        | Details du plugin                          |
| `/api/v1/search`            | Recherche de contenu (provider distant)    |
| `/api/v1/get_main_page`     | Contenu par categorie                      |
| `/api/v1/load_item`         | Details du contenu                         |
| `/api/v1/load_links`        | Liens video                                |
| `/api/v1/extract`           | Extraction de lien                         |
| `/api/v1/ytdlp-extract`     | Details video via yt-dlp                   |

---

## 🛠️ Ajouter de nouvelles sources?

Ce depot n'est **pas** destine au developpement de providers.  
Pour creer votre provider, utilisez le guide et les templates officiels: [WatchBuddy ExampleProvider](https://github.com/WatchBuddy-tv/ExampleProvider)

---

## ⚖️ Aspects legaux et responsabilite

- WatchBuddy Stream **n'heberge pas, ne stocke pas et ne distribue pas** de media.
- Les sources de contenu sont **tierces** et fournies par les utilisateurs ou providers.
- La responsabilite du contenu, de la legalite et de la conformite **appartient a l'utilisateur**.
- Disponibilite et legalite peuvent varier selon les regions.

---

## 🌐 Licence

Suivez la politique de licence au niveau du depot WatchBuddy.
