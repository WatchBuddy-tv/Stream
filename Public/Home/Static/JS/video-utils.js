// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import { isProxyAvailable, buildProxyUrl, invalidateProxy } from './service-detector.min.js';
import BuddyLogger from './utils/BuddyLogger.min.js';

// Proxy Mode Enum (matching Flutter)
export const ProxyMode = {
    NONE: 'none',              // Direct CDN access
    MANIFEST_ONLY: 'manifest', // Only manifest through proxy
    FULL: 'full'               // All requests through proxy
};

export const detectFormat = (url, format = null) => {
    const lowerUrl = url.toLowerCase();
    
    // HLS detection (including non-standard extensions)
    if (lowerUrl.includes('.m3u8') || 
        lowerUrl.includes('.m3u') ||
        lowerUrl.includes('/hls/') || 
        lowerUrl.includes('/m3u8/') || 
        lowerUrl.includes('master.txt') || 
        lowerUrl.includes('/manifests/') ||
        lowerUrl.includes('playlist.m3u8') ||
        lowerUrl.includes('.ts') ||
        lowerUrl.includes('.m4s') ||
        lowerUrl.includes('seg-') ||
        lowerUrl.includes('segment-') ||
        lowerUrl.includes('chunk-') ||
        lowerUrl.includes('fragment') ||
        format === 'hls') {
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
    if (lowerUrl.includes('.avi') || format === 'avi') {
        return 'avi';
    }
    if (lowerUrl.includes('.mov') || format === 'mov') {
        return 'mov';
    }
    if (lowerUrl.includes('.flv') || format === 'flv') {
        return 'flv';
    }
    if (lowerUrl.includes('.wmv') || format === 'wmv') {
        return 'wmv';
    }
    
    return format || 'native';
};

// Suggest initial proxy mode based on URL patterns
export const suggestInitialMode = (url) => {
    const lower = url.toLowerCase();
    
    // Known protection parameters - start with manifest proxy
    const protectionParams = [
        'md5=', 'expires=', 'expire=', 'token=', 'hmac=', 'hash=', 
        'auth=', 'sign=', 'key=', 'st=', 'e=', 't=', 'h=', 's='
    ];
    const matched = protectionParams.filter(p => lower.includes(p));

    if (matched.length > 0) {
        BuddyLogger.info(
            '🛡️',
            'PROXY SYSTEM', 
            'Protected Content Detected', 
            {
                'Params': matched.join(', '),
                'Mode': 'MANIFEST_ONLY'
            }
        );
        return ProxyMode.MANIFEST_ONLY;
    }
    
    BuddyLogger.info(
        '🛡️',
        'PROXY SYSTEM',
        'Direct Access Available',
        {
            'Status': 'No Protection Only',
            'Mode': 'NONE (Direct)'
        }
    );
    return ProxyMode.NONE;
};

// Get next fallback mode
export const getNextMode = (current) => {
    switch (current) {
        case ProxyMode.NONE:
            return ProxyMode.MANIFEST_ONLY;
        case ProxyMode.MANIFEST_ONLY:
            return ProxyMode.FULL;
        case ProxyMode.FULL:
            return null; // No more fallback
        default:
            return ProxyMode.MANIFEST_ONLY;
    }
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

// Resolve most suitable proxy base URL from provided options
export const resolveProxyBase = (context) => {
    // Stream'de context muhtemelen global window.PROXY_URL vb. olur veya parametre olarak gelmeli
    // Şimdilik window.PROXY_URL ve window.PROXY_FALLBACK_URL değişkenlerine bakıyoruz (template'den gelen)
    
    // Context içinde proxyUrl varsa onu kullan (eğer sağlanmışsa)
    if (context && context.proxyUrl && isProxyAvailable(context.proxyUrl)) {
        return context.proxyUrl;
    }
    
    // Yoksa global değişkenlere bak (Stream player.html.j2 içinde set ediliyor olabilir)
    if (window.PROXY_URL && isProxyAvailable(window.PROXY_URL)) {
        return window.PROXY_URL;
    }
    if (window.PROXY_FALLBACK_URL && isProxyAvailable(window.PROXY_FALLBACK_URL)) {
        return window.PROXY_FALLBACK_URL;
    }
    
    return null; // Direct connection
};

// Build proxy URL with mode support
export const buildProxyUrlWithMode = (url, userAgent, referer, mode, context = null) => {
    if (mode === ProxyMode.NONE) {
        return url;
    }
    
    const proxyBase = resolveProxyBase(context || {});
    if (!proxyBase) return url;

    let proxyUrl = buildProxyUrl(url, userAgent, referer, 'video', proxyBase);
    
    // Add force_proxy for FULL mode
    if (mode === ProxyMode.FULL) {
        proxyUrl += (proxyUrl.includes('?') ? '&' : '?') + 'force_proxy=1';
    }
    
    return proxyUrl;
};

export const createHlsXhrSetup = (userAgent, referer, context, initialMode = ProxyMode.MANIFEST_ONLY) => {
    return (xhr, requestUrl) => {
        const isManifest = requestUrl.includes('.m3u8') || requestUrl.includes('.m3u') || requestUrl.includes('master.txt');
        const isKey = requestUrl.includes('.key') || requestUrl.includes('key=') || requestUrl.includes('encryption');
        const isSegment = !isManifest && !isKey;
        
        // Use dynamic mode from context (updated by fallback)
        const currentMode = context.currentProxyMode || initialMode;

        // 1. Already a proxy URL - skip
        if (requestUrl.includes('/proxy/video?url=')) {
            return;
        }

        // 2. NONE mode - everything direct
        if (currentMode === ProxyMode.NONE) {
            return;
        }

        const proxyBase = resolveProxyBase(context);
        if (!proxyBase) return; // Cannot proxy if no base URL available

        // 3. FULL mode - proxy everything including segments
        if (currentMode === ProxyMode.FULL && isSegment) {
            const finalUrl = buildProxyUrlWithMode(requestUrl, userAgent, referer, ProxyMode.FULL, context);
            BuddyLogger.debug('🔌', 'HLS INTERCEPTOR', 'Segment Proxy (FULL)', { 'Original': requestUrl, 'Proxy': finalUrl });
            xhr.open('GET', finalUrl, true);
            return;
        }

        // 4. MANIFEST_ONLY mode - segments direct
        if (currentMode === ProxyMode.MANIFEST_ONLY && requestUrl.startsWith('http') && isSegment) {
            return; 
        }
        
        // 5. Fix wrongly resolved paths (relative to proxy instead of source origin)
        if (proxyBase && requestUrl.startsWith(proxyBase) && !requestUrl.includes('/proxy/')) {
            const path = requestUrl.substring(proxyBase.length);
            if (context.lastLoadedOrigin) {
                const correctUrl = context.lastLoadedOrigin.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
                BuddyLogger.debug('🔧', 'HLS INTERCEPTOR', 'Path Fix Applied', { 'Original': requestUrl, 'Corrected': correctUrl });
                xhr.open('GET', buildProxyUrl(correctUrl, userAgent, referer, 'video', proxyBase), true);
                return;
            }
        }

        // 6. Manifests and Keys always through proxy
        try {
            if (isManifest || isKey) {
                const finalUrl = buildProxyUrl(requestUrl, userAgent, referer, 'video', proxyBase);
                BuddyLogger.debug('🔑', 'HLS INTERCEPTOR', isManifest ? 'Manifest Intercepted' : 'Key Intercepted', { 'Url': requestUrl });
                xhr.open('GET', finalUrl, true);
                
                if (requestUrl.startsWith('http')) {
                    context.lastLoadedBaseUrl = requestUrl.substring(0, requestUrl.lastIndexOf('/') + 1);
                    context.lastLoadedOrigin = new URL(requestUrl).origin;
                }
            }
        } catch (e) {
            BuddyLogger.error('❌', 'HLS INTERCEPTOR', 'Proxy Error', { 'Details': e.message });
        }
    };
};

export const createHlsConfig = (userAgent, referer, context, mode = null) => {
    // Determine initial mode
    const initialMode = mode ?? (window.PROXY_ENABLED !== false ? ProxyMode.MANIFEST_ONLY : ProxyMode.NONE);
    
    // Track current mode for fallback (stored in context for persistence)
    context.currentProxyMode = context.currentProxyMode ?? initialMode;
    
    // Smart Fallback Fragment Loader
    class SmartFallbackLoader extends Hls.DefaultConfig.loader {
        constructor(config) {
            super(config);
            this._retryCount = 0;
            this._hasLoaded = false;
        }

        load(ctx, cfg, callbacks) {
            // If already loaded, create fresh state
            if (this._hasLoaded) {
                this._hasLoaded = false;
            }
            
            const originalOnError = callbacks.onError;
            const self = this;
            
            callbacks.onError = async (response, loaderContext, loader, stats) => {
                const { proxyUrl, proxyFallbackUrl } = context;
                
                BuddyLogger.warn('🛡️', 'PROXY SYSTEM', 'Request Failed', { 
                    'Url': loaderContext.url,
                    'Code': response.code,
                    'Mode': context.currentProxyMode
                });

                const isFailureToProxy = (status) => status === 0 || status === 403 || status === 401 || status >= 500;

                const attemptRetry = (lastUrl, lastMode, currentStatus) => {
                    if (self._retryCount >= 6) return; // Safety

                    if (currentStatus === 404) {
                        BuddyLogger.error('🚫', 'PROXY SYSTEM', 'Resource Not Found (404)');
                        if (originalOnError) originalOnError({ code: 404, text: 'Not Found' }, loaderContext, loader, stats);
                        return;
                    }

                    const wasProxy = lastUrl.includes('/proxy/video');
                    const wasPrimary = wasProxy && proxyUrl && lastUrl.includes(proxyUrl);
                    const wasFallback = wasProxy && proxyFallbackUrl && lastUrl.includes(proxyFallbackUrl);
                    
                    let nextMode = null;
                    let nextProxy = null;

                    // 1 - Direct Fail -> Karar Ver: Primary mi Fallback mi?
                    if (!wasProxy) {
                        if (lastMode === ProxyMode.MANIFEST_ONLY) {
                            // Zaten bir proxy devresindeyiz (Manifest inmiş ama segment inememiş). FULL moda yükselt.
                            if (proxyUrl && isProxyAvailable(proxyUrl)) {
                                nextMode = ProxyMode.FULL;
                                nextProxy = proxyUrl;
                                BuddyLogger.info('⚡', 'PROXY SYSTEM', 'Segment failed in MANIFEST mode. Escalating to Primary FULL.');
                            } else {
                                nextMode = ProxyMode.FULL;
                                nextProxy = proxyFallbackUrl;
                                BuddyLogger.info('⚡', 'PROXY SYSTEM', 'Segment failed in MANIFEST mode. Escalating to Fallback FULL.');
                            }
                        } else {
                            // Tamamen en baştayız (Direct patladı)
                            if (proxyUrl && isProxyAvailable(proxyUrl)) {
                                BuddyLogger.info('⚡', 'PROXY SYSTEM', 'Primary ONLINE. Only Primary cycle will be executed.');
                                nextMode = ProxyMode.MANIFEST_ONLY;
                                nextProxy = proxyUrl;
                            } else if (proxyFallbackUrl && isProxyAvailable(proxyFallbackUrl)) {
                                BuddyLogger.info('⚡', 'PROXY SYSTEM', 'Primary OFFLINE. Executing Fallback cycle.');
                                nextMode = ProxyMode.MANIFEST_ONLY;
                                nextProxy = proxyFallbackUrl;
                            } else {
                                BuddyLogger.error('🚫', 'PROXY SYSTEM', 'No proxies available. Stopping.');
                            }
                        }
                    } 
                    // 2 - Primary Cycle (Daha önce Primary denendiyse artık Fallback'e geçiş YOK)
                    else if (wasPrimary) {
                        if (lastMode === ProxyMode.MANIFEST_ONLY) {
                            nextMode = ProxyMode.FULL;
                            nextProxy = proxyUrl;
                        } else {
                            BuddyLogger.error('🛑', 'PROXY SYSTEM', 'Primary Cycle Finished (Full failed). Stopping.');
                        }
                    }
                    // 3 - Fallback Cycle
                    else if (wasFallback) {
                        if (lastMode === ProxyMode.MANIFEST_ONLY) {
                            nextMode = ProxyMode.FULL;
                            nextProxy = proxyFallbackUrl;
                        } else {
                            BuddyLogger.error('🛑', 'PROXY SYSTEM', 'Fallback Cycle Finished (Full failed). Stopping.');
                        }
                    }

                    // Bir sonraki adım yoksa pes et
                    if (!nextMode) {
                        if (originalOnError) originalOnError(response, loaderContext, loader, stats);
                        return;
                    }

                    self._retryCount++;
                    BuddyLogger.info('🔄', 'PROXY SYSTEM', 'Executing Retry', { 
                        'Mode': nextMode,
                        'Proxy': nextProxy,
                        'Attempt': self._retryCount
                    });

                    context.currentProxyMode = nextMode;
                    if (context.onModeEscalated) context.onModeEscalated(nextMode);

                    const originalUrl = wasProxy 
                        ? decodeURIComponent(lastUrl.match(/url=([^&]+)/)?.[1] || lastUrl) 
                        : lastUrl;
                    
                    const buildUrl = (mode, pUrl) => {
                        let final = buildProxyUrl(originalUrl, userAgent, referer, 'video', pUrl);
                        if (mode === ProxyMode.FULL) final += '&force_proxy=1';
                        return final;
                    };
                    const newUrl = buildUrl(nextMode, nextProxy);
                    
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', newUrl, true);
                    xhr.responseType = loaderContext.responseType || '';
                    
                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            BuddyLogger.info('✅', 'PROXY SYSTEM', 'Recovery Success!', { 'Mode': nextMode });
                            callbacks.onSuccess({ data: xhr.response, url: newUrl }, { ...stats, loaded: xhr.response.length || 0 }, loaderContext, null);
                        } else {
                            if (isFailureToProxy(xhr.status)) {
                                attemptRetry(newUrl, nextMode, xhr.status);
                            } else {
                                if (originalOnError) originalOnError({ code: xhr.status, text: xhr.statusText }, loaderContext, loader, stats);
                            }
                        }
                    };
                    
                    xhr.onerror = () => attemptRetry(newUrl, nextMode, 0);
                    xhr.send();
                };

                if (isFailureToProxy(response.code)) {
                    attemptRetry(loaderContext.url, context.currentProxyMode, response.code);
                } else {
                    if (originalOnError) originalOnError(response, loaderContext, loader, stats);
                }
            };

            this._hasLoaded = true;
            super.load(ctx, cfg, callbacks);
        }
    }
    
    const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && !window.MSStream;

    return {
        debug: false,
        enableWorker: !isApple, // Apple cihazlarda worker bazen sorun çıkarabiliyor
        capLevelToPlayerSize: true,
        maxLoadingDelay: 4,
        minAutoBitrate: 0,
        maxBufferLength: isApple ? 15 : 30, // Apple cihazlarda daha düşük buffer
        maxMaxBufferLength: isApple ? 30 : 600,
        startLevel: -1,
        xhrSetup: createHlsXhrSetup(userAgent, referer, context, context.currentProxyMode),
        pLoader: SmartFallbackLoader,  // Playlist (manifest) loader - CORS fallback
        fLoader: SmartFallbackLoader   // Fragment loader
    };
};
