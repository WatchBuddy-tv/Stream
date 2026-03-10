# <img src="https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/bb/1d/47/bb1d4757-5384-a7d1-83ac-eb0d8f1b45a8/Placeholder.mill/64x64bb.png" height="32" align="center"> WatchBuddy Stream (KekikStreamAPI Forku)

[![stream.watchbuddy.tv'yi WatchBuddy'ye Ekle](https://img.shields.io/badge/Ekle-stream.watchbuddy.tv-blue?style=flat-square)](https://keyiflerolsun.tr/http-protocol-redirector/?r=watchbuddy://provider?url=https://stream.watchbuddy.tv)

WatchBuddy’nin ihtiyacı olan streaming katmanını bu repo sağlar.
Bu bir geliştirme ortamı değildir; WatchBuddy için **üretim odaklı entegrasyon forkudur**.

[🇺🇸 English](./ReadMe.md) • [🇫🇷 Français](./ReadMe_FR.md) • [🇷🇺 Русский](./ReadMe_RU.md) • [🇺🇦 Українська](./ReadMe_UK.md)

---

## 🚦 Ne Sunar?

KekikStreamAPI, **KekikStream engine** ile Web arayüzü ve REST API’yi birleştirerek uçtan uca bir streaming deneyimi sağlar.
Bu fork, çekirdek motoru değiştirmeden **WatchBuddy uyumunu** sağlar.

- 🎥 Çoklu kaynak desteği: içerik arama ve izleme
- 🌐 Web arayüzü: responsive, kullanıcı dostu deneyim, cookie tabanlı dil kalıcılığı (TR/EN/FR/RU/UK)
- 🔌 REST API: WatchBuddy istemcileriyle uyumlu, uzak provider desteği
- 🔗 Uzak Provider Mimarisi: schema keşfi ile diğer WatchBuddy provider'larına bağlanabilir
- 🎬 yt‑dlp entegrasyonu: YouTube + 1000+ site desteği
- 🌍 Çoklu dil: sayfa yenilemelerinde kalıcı dil seçimi

---

## 🎯 Neden Bu Fork Var?

**KekikStreamAPI**’yi, WatchBuddy içinde **sorunsuz çalışan bir streaming servisi** sunmak için fork ettik.
Amaç: temiz entegrasyon, öngörülebilir API çıktıları ve çok dilli public arayüz.

---

## ✨ Bu Fork Ne Ekler?

- ✅ WatchBuddy uyumlu API çıktı formatları
- ✅ Public arayüzde cookie tabanlı dil kalıcılığı (TR/EN/FR/RU/UK)
- ✅ Schema keşfi ile uzak provider mimarisi
- ✅ Direkt uzak provider istek yönlendirmesi
- ✅ WatchBuddy istemcileri için uygun varsayılanlar
- ✅ Az konfigürasyonla kolay entegrasyon

---

## ✅ Neleri Değiştirmiyoruz?

- 🔒 Medya barındırma veya dağıtım yok
- 🧠 KekikStream çekirdek motor mantığına dokunulmaz
- 🌍 Üçüncü taraf içerik kaynakları kontrol edilmez

---

## 🔗 Kaynak & Fork Temeli

Asıl engine: [KekikStream](https://github.com/keyiflerolsun/KekikStream)

Fork temeli: [KekikStreamAPI](https://github.com/keyiflerolsun/KekikStreamAPI)

---

## 🚀 Hızlı Başlangıç

> Gereksinimler: Python 3.11+, `yt-dlp` ve tarayıcı.

```bash
pip install -r requirements.txt
python basla.py
```

👉 Tarayıcıdan erişim: **http://127.0.0.1:3310**

👉 [http://localhost:3310'u WatchBuddy'ye Ekle](https://keyiflerolsun.tr/http-protocol-redirector/?r=watchbuddy://provider?url=http://localhost:3310)

### 📱 Ekosisteme Göz Atın

WatchBuddy **Android** ve **iOS**'ta kullanılabilir.

Daha fazla içerik keşfetmek ve bir film ya da diziyi odaya aktarmak için şu servisleri de kullanabilirsiniz:
- 🌐 **Stream Web:** stream.watchbuddy.tv
- 🤖 **Telegram Bot:** t.me/WatchBuddyRobot

---

## 🔌 API Endpoints (Özet)

| Endpoint                     | Açıklama                                      |
|------------------------------|-----------------------------------------------|
| `/api/v1/health`             | API sağlık kontrolü                           |
| `/api/v1/schema`             | Provider şeması, proxy URL'leri ve adı        |
| `/api/v1/get_plugin_names`   | Tüm eklentiler                                |
| `/api/v1/get_plugin`         | Eklenti detayları                             |
| `/api/v1/search`             | İçerik arama (uzak provider desteği)          |
| `/api/v1/get_main_page`      | Kategori içerikleri                           |
| `/api/v1/load_item`          | İçerik detayları                              |
| `/api/v1/load_links`         | Video bağlantıları                            |
| `/api/v1/extract`            | Link extraction                               |
| `/api/v1/ytdlp-extract`      | yt-dlp video bilgisi                          |

---

## 🛠️ Yeni Kaynak Eklemek mi İstiyorsunuz?

Bu repo provider geliştirme için değildir.
Kendi provider’ınızı oluşturmak için resmi rehber ve şablonları kullanın: [WatchBuddy ExampleProvider](https://github.com/WatchBuddy-tv/ExampleProvider)

---

## ⚖️ Yasal Bilgilendirme

- WatchBuddy Stream **medya barındırmaz, saklamaz veya dağıtmaz**.
- İçerik kaynakları **üçüncü taraf** servislerdir ve kullanıcı tarafından seçilir.
- İçerik, yasallık ve uyumluluk sorumluluğu **kullanıcıya aittir**.
- Erişilebilirlik ve yasallık bölgeye göre değişebilir.

---

## 🌐 Lisans

WatchBuddy repo lisans politikasını takip eder.
