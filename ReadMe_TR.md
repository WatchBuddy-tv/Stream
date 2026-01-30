# 🎬 WatchBuddy Stream (KekikStreamAPI Forku)

WatchBuddy’nin ihtiyacı olan streaming katmanını bu repo sağlar.  
Bu bir geliştirme ortamı değildir; WatchBuddy için **üretim odaklı entegrasyon forkudur**.

English version: [ReadMe.md](./ReadMe.md)

---

## 🚦 Ne Sunar?

KekikStreamAPI, **KekikStream engine** ile Web arayüzü ve REST API’yi birleştirerek uçtan uca bir streaming deneyimi sağlar.  
Bu fork, çekirdek motoru değiştirmeden **WatchBuddy uyumunu** sağlar.

- 🎥 Çoklu kaynak desteği: içerik arama ve izleme
- 🌐 Web arayüzü: responsive, kullanıcı dostu deneyim
- 🔌 REST API: WatchBuddy istemcileriyle uyumlu
- 🎬 yt‑dlp entegrasyonu: YouTube + 1000+ site desteği
- 🌍 Çoklu dil: public arayüz TR/EN

---

## 🎯 Neden Bu Fork Var?

**KekikStreamAPI**’yi, WatchBuddy içinde **sorunsuz çalışan bir streaming servisi** sunmak için fork ettik.  
Amaç: temiz entegrasyon, öngörülebilir API çıktıları ve çok dilli public arayüz.

---

## ✨ Bu Fork Ne Ekler?

- ✅ WatchBuddy uyumlu API çıktı formatları
- ✅ Public arayüzde TR/EN hazırlığı
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

---

## 🔌 API Endpoints (Özet)

| Endpoint                     | Açıklama            |
|------------------------------|---------------------|
| `/api/v1/health`             | API sağlık kontrolü |
| `/api/v1/get_plugin_names`   | Tüm eklentiler      |
| `/api/v1/get_plugin`         | Eklenti detayları   |
| `/api/v1/search`             | İçerik arama        |
| `/api/v1/get_main_page`      | Kategori içerikleri |
| `/api/v1/load_item`          | İçerik detayları    |
| `/api/v1/load_links`         | Video bağlantıları  |
| `/api/v1/extract`            | Link extraction     |
| `/api/v1/ytdlp-extract`      | yt-dlp video bilgisi |

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
