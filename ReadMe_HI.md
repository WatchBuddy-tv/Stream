# <img src="https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/bb/1d/47/bb1d4757-5384-a7d1-83ac-eb0d8f1b45a8/Placeholder.mill/64x64bb.png" height="32" align="center"> WatchBuddy Stream (KekikStreamAPI फोर्क)

[![WatchBuddy से stream.watchbuddy.tv जोड़ें](https://img.shields.io/badge/Add-stream.watchbuddy.tv-blue?style=flat-square)](https://keyiflerolsun.tr/http-protocol-redirector/?r=watchbuddy://provider?url=https://stream.watchbuddy.tv)

WatchBuddy को भरोसेमंद और साफ़ स्ट्रीमिंग परत चाहिए। यह रिपॉज़िटरी वही परत उपलब्ध कराती है।
यह विकास अभ्यास-स्थल नहीं है; यह WatchBuddy में उपयोग होने वाला उत्पादन-उपयुक्त एकीकरण फोर्क है।

[🇺🇸 English](./ReadMe.md) • [🇹🇷 Türkçe](./ReadMe_TR.md) • [🇫🇷 Français](./ReadMe_FR.md) • [🇷🇺 Русский](./ReadMe_RU.md) • [🇺🇦 Українська](./ReadMe_UK.md) • [🇮🇳 हिन्दी](./ReadMe_HI.md)

---

## 🚦 यह क्या देता है

KekikStreamAPI, KekikStream इंजन को वेब इंटरफ़ेस और REST API के साथ जोड़कर पूरा स्ट्रीमिंग अनुभव बनाता है।
यह फोर्क मूल इंजन बदले बिना उसे WatchBuddy के लिए तैयार करता है।

- 🎥 बहु-स्रोत खोज और देखने का अनुभव
- 🌐 वेब इंटरफ़ेस जिसमें कुकी-आधारित भाषा स्थिरता है (TR/EN/FR/RU/UK/HI)
- 🔌 REST API जो WatchBuddy क्लाइंट और दूरस्थ प्रदाताओं के साथ मेल खाती है
- 🔗 दूरस्थ प्रदाता संरचना और स्कीमा खोज
- 🎬 yt-dlp इंटीग्रेशन: YouTube और 1000+ साइटें
- 🌍 बहुभाषी सार्वजनिक इंटरफ़ेस

---

## 🎯 यह फोर्क क्यों मौजूद है

WatchBuddy के लिए कम सेटअप में तुरंत चलने वाली स्ट्रीमिंग सेवा उपलब्ध कराने हेतु हमने KekikStreamAPI को फोर्क किया।
लक्ष्य है साफ़ एकीकरण सतह, अनुमानित API प्रतिक्रियाएँ और बहुभाषी सार्वजनिक इंटरफ़ेस।

---

## ✨ यह फोर्क क्या जोड़ता है

- ✅ WatchBuddy-अनुकूल API प्रतिक्रियाएँ और मेटाडेटा
- ✅ सार्वजनिक इंटरफ़ेस में कुकी-आधारित भाषा स्थिरता (TR/EN/FR/RU/UK/HI)
- ✅ स्कीमा खोज endpoint के साथ दूरस्थ प्रदाता संरचना
- ✅ दूरस्थ प्रदाता अनुरोधों की सीधी रूटिंग
- ✅ WatchBuddy क्लाइंट के लिए अनुकूल डिफ़ॉल्ट विन्यास
- ✅ कम विन्यास के साथ सरल एकीकरण

---

## ✅ यह फोर्क क्या नहीं करता

- 🔒 मीडिया होस्ट या वितरित नहीं करता
- 🧠 KekikStream के मूल इंजन तर्क में बदलाव नहीं करता
- 🌍 तृतीय-पक्ष सामग्री स्रोतों को नियंत्रित नहीं करता

---

## 🔗 स्रोत और आधार

Upstream engine: https://github.com/keyiflerolsun/KekikStream

Fork base: https://github.com/keyiflerolsun/KekikStreamAPI

---

## 🚀 त्वरित शुरुआत

> आवश्यकताएँ: Python 3.11+, yt-dlp, और एक ब्राउज़र.

```bash
pip install -r requirements.txt
python basla.py
```

👉 खोलें: http://127.0.0.1:3310

👉 WatchBuddy में जोड़ें: https://keyiflerolsun.tr/http-protocol-redirector/?r=watchbuddy://provider?url=http://localhost:3310

### 📱 इकोसिस्टम देखें

WatchBuddy Android और iOS पर उपलब्ध है।

अधिक शीर्षक खोजने और उन्हें जल्दी से रूम में भेजने के लिए आप इन सेवाओं का उपयोग कर सकते हैं:
- 🌐 Stream वेब: https://stream.watchbuddy.tv
- 🤖 Telegram Bot: https://t.me/WatchBuddyRobot

---

## 🔌 API एंडपॉइंट्स (सारांश)

| एंडपॉइंट | विवरण |
|----------|--------|
| /api/v1/health | सेवा जाँच |
| /api/v1/schema | प्रदाता schema, proxy URLs और नाम |
| /api/v1/get_plugin_names | सभी प्लगइन |
| /api/v1/get_plugin | प्लगइन विवरण |
| /api/v1/search | कंटेंट खोज |
| /api/v1/get_main_page | श्रेणी कंटेंट |
| /api/v1/load_item | कंटेंट विवरण |
| /api/v1/load_links | वीडियो लिंक |
| /api/v1/extract | लिंक निष्कर्षण |
| /api/v1/ytdlp-extract | yt-dlp वीडियो विवरण |

---

## 🛠️ नए स्रोत जोड़ना चाहते हैं?

यह रिपॉज़िटरी प्रदाता विकास के लिए नहीं है।
अपना प्रदाता बनाने के लिए आधिकारिक मार्गदर्शिका और टेम्पलेट उपयोग करें: https://github.com/WatchBuddy-tv/ExampleProvider

---

## ⚖️ कानूनी और ज़िम्मेदारी

- WatchBuddy Stream मीडिया होस्ट, संग्रहित या वितरित नहीं करता।
- सामग्री स्रोत तृतीय-पक्ष सेवाएँ हैं और उपयोगकर्ता या प्रदाताओं द्वारा चुने जाते हैं।
- कंटेंट, वैधता और अनुपालन की ज़िम्मेदारी उपयोगकर्ता की है.
- उपलब्धता और वैधता क्षेत्र के अनुसार बदल सकती है.

---

## 🌐 लाइसेंस

WatchBuddy रिपॉज़िटरी की लाइसेंस नीति लागू होती है।
