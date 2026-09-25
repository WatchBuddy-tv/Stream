// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import { buildProxyUrl } from '../service-detector.min.js';

/**
 * URL'nin oynatılabilirliğini client-side fetch ile kontrol eder (CORS ve proxy desteği ile).
 * @param {string} url - Kontrol edilecek video URL'si
 * @param {string} userAgent - HTTP User-Agent header değeri
 * @param {string} referer - HTTP Referer header değeri
 * @param {string} proxyBase - Proxy base URL'si (varsayılan: this.proxyUrl || this.proxyFallbackUrl)
 * @returns {Promise<{playable: boolean, reason: string}>}
 */
export async function isUrlPlayable(url, userAgent = '', referer = '', proxyBase = '', extraHeaders = null) {
    if (!url) {
        return { playable: false, reason: "URL boş veya geçersiz" };
    }

    // YouTube / Fragman vb. direkt oynatılabilir kabul edilir
    if (url.includes("youtube.com") || url.includes("youtu.be") || url.includes("youtube-nocookie.com")) {
        return { playable: true, reason: "YouTube Embed / Fragman" };
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return { playable: false, reason: `Geçersiz URL şeması: ${url.slice(0, 50)}` };
    }

    // CORS bypass ve doğru header ayarları için proxy url oluştur
    const proxiedUrl = buildProxyUrl(url, userAgent, referer, 'video', proxyBase, extraHeaders);

    try {
        // 1. HEAD İsteği Gönder (Verimli ve hızlı)
        const response = await fetch(proxiedUrl, {
            method: 'HEAD',
            headers: {
                'Range': 'bytes=0-1024'
            }
        });

        if (response.ok) {
            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            // HTML olmayan herhangi bir geçerli medya/octet stream oynatılabilir
            if (contentType && !contentType.includes('html')) {
                return { playable: true, reason: `HEAD Başarılı (${response.status}, ${contentType})` };
            }
        }

        // 2. HEAD İsteği başarısız olduysa veya HTML döndüyse GET isteği ile doğrulama yap (Range ile)
        const getResponse = await fetch(proxiedUrl, {
            method: 'GET',
            headers: {
                'Range': 'bytes=0-1024'
            }
        });

        let finalResponse = getResponse;
        if (getResponse.status === 416) {
            // Range desteklenmiyorsa normal GET isteği at
            finalResponse = await fetch(proxiedUrl, { method: 'GET' });
        }

        if (!finalResponse.ok) {
            return { playable: false, reason: `HTTP Hata Kodu: ${finalResponse.status}` };
        }

        const contentType = (finalResponse.headers.get('content-type') || '').toLowerCase();
        
        // Hata sayfalarını veya HLS m3u8 dosyalarını anlamak için metni oku
        const text = await finalResponse.text();
        const textPreview = text.slice(0, 1024).toLowerCase();

        // HLS playlist kontrolü (#EXTM3U)
        if (textPreview.includes('#extm3u') || contentType.includes('mpegurl') || contentType.includes('apple.mpegurl')) {
            return { playable: true, reason: "HLS Stream (m3u8) Aktif" };
        }

        // HTML hata sayfaları kontrolü
        if (contentType.includes('html')) {
            const errorKeywords = ["forbidden", "unauthorized", "cloudflare", "error", "dns", "yasak", "hata", "bulunamadı", "geçersiz"];
            if (errorKeywords.some(keyword => textPreview.includes(keyword))) {
                return { playable: false, reason: `Hata Sayfası (HTML): ${textPreview.slice(0, 100).trim()}` };
            }
            return { playable: false, reason: "Video beklenirken HTML sayfası döndü" };
        }

        if (contentType.includes('video') || contentType.includes('octet-stream') || text.length > 0) {
            return { playable: true, reason: `Video Stream (${contentType || 'Bilinmiyor'}) Aktif` };
        }

        return { playable: false, reason: `Belirsiz İçerik Tipi: ${contentType}` };

    } catch (error) {
        return { playable: false, reason: `Ağ Bağlantı Hatası: ${error.message}` };
    }
}
