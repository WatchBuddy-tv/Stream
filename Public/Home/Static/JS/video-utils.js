// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import { getProxyBaseUrl, buildProxyUrl } from './service-detector.min.js';

export const detectFormat = (url, format = null) => {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('.m3u8') || lowerUrl.includes('/hls/') || lowerUrl.includes('/m3u8/') || format === 'hls') {
        return 'hls';
    }
    if (lowerUrl.includes('.mp4') || lowerUrl.includes('/mp4/') || format === 'mp4') {
        return 'mp4';
    }
    if (lowerUrl.includes('.webm') || format === 'webm') {
        return 'webm';
    }
    if (lowerUrl.includes('.mkv') || format === 'mkv') {
        return 'mkv';
    }
    
    return format || 'native';
};

export const parseRemoteUrl = (url) => {
    try {
        let remoteUrl = url;
        
        // Extract real URL from proxy wrapper
        if (url.includes('/proxy/video?url=')) {
            const match = url.match(/url=([^&]+)/);
            if (match) {
                remoteUrl = decodeURIComponent(match[1]);
            }
        }
        
        if (remoteUrl.startsWith('http')) {
            const urlObj = new URL(remoteUrl);
            return {
                origin: urlObj.origin,
                baseUrl: remoteUrl.substring(0, remoteUrl.lastIndexOf('/') + 1)
            };
        }
    } catch (e) {
        // Ignore parsing errors
    }
    
    return { origin: null, baseUrl: null };
};

export const createHlsXhrSetup = (userAgent, referer, context) => {
    return (xhr, requestUrl) => {
        const proxyOrigin = getProxyBaseUrl();
        const isManifest = requestUrl.includes('.m3u8') || requestUrl.includes('.m3u');
        const isKey = requestUrl.includes('.key') || requestUrl.includes('key=') || requestUrl.includes('encryption');

        // 1. Zaten bir proxy URL'i içindeysek (Recursive proxy engelleme)
        if (requestUrl.includes('/proxy/video?url=')) {
            return;
        }

        // 2. Proxy manifest'i rewrite etti ve bize doğrudan bir CDN URL'i verdi
        // Eğer bu bir segment ise (.ts, .m4s vb.) doğrudan gitmeyi dene.
        if (requestUrl.startsWith('http') && !isManifest && !isKey) {
            // goProxy/pyProxy bunu bizim için "doğrudan çekilsin" diye rewrite etmiştir.
            // Bu durumda tekrar proxy'leme!
            return; 
        }
        
        // 3. Yanlış çözümlenmiş path düzeltmeleri (Manifest path'leri)
        if (requestUrl.startsWith(proxyOrigin) && !requestUrl.includes('/proxy/')) {
            const path = requestUrl.substring(proxyOrigin.length);
            if (context.lastLoadedOrigin) {
                const correctUrl = context.lastLoadedOrigin.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
                xhr.open('GET', buildProxyUrl(correctUrl, userAgent, referer, 'video'), true);
                return;
            }
        }

        // 4. Standart durum: Manifest ve Key dosyalarını her zaman proxy'le
        try {
            if (isManifest || isKey) {
                const proxyUrl = buildProxyUrl(requestUrl, userAgent, referer, 'video');
                xhr.open('GET', proxyUrl, true);
                
                if (requestUrl.startsWith('http')) {
                    context.lastLoadedBaseUrl = requestUrl.substring(0, requestUrl.lastIndexOf('/') + 1);
                    context.lastLoadedOrigin = new URL(requestUrl).origin;
                }
            }
        } catch (e) {
            console.error('HLS Proxy Error:', e);
        }
    };
};

export const createHlsConfig = (userAgent, referer, context, useProxy = null) => {
    const isProxyEnabled = useProxy ?? (window.PROXY_ENABLED !== false);
    
    // Fallback Fragment Loader: Önce doğrudan dene, CORS/Ağ hatası (code 0) alırsan proxy'le
    class FallbackFragmentLoader extends Hls.DefaultConfig.loader {
        constructor(config) {
            super(config);
        }

        load(ctx, cfg, callbacks) {
            const originalOnError = callbacks.onError;
            
            // Hata yakalayıcıyı özelleştir
            callbacks.onError = (response, context, loader, stats) => {
                const isDirectUrl = !context.url.includes('/proxy/video');
                const isNetworkError = response.code === 0 || response.code === 403;

                if (isProxyEnabled && isDirectUrl && isNetworkError) {
                    const proxyUrl = buildProxyUrl(context.url, userAgent, referer, 'video');
                    // context.url'i güncelleyip tekrar dene
                    context.url = proxyUrl;
                    super.load(context, cfg, callbacks);
                    return;
                }
                
                // Proxy zaten denenmişse veya başka bir hataysa orijinal handler'ı çağır
                if (originalOnError) originalOnError(response, context, loader, stats);
            };

            super.load(ctx, cfg, callbacks);
        }
    }
    
    return {
        debug: false,
        enableWorker: true,
        capLevelToPlayerSize: true,
        maxLoadingDelay: 4,
        minAutoBitrate: 0,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        startLevel: -1,
        xhrSetup: isProxyEnabled ? createHlsXhrSetup(userAgent, referer, context) : undefined,
        fLoader: isProxyEnabled ? FallbackFragmentLoader : undefined
    };
};
