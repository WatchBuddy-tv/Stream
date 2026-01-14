// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import { getProxyBaseUrl, buildProxyUrl } from './service-detector.min.js';

// Proxy Mode Enum (matching Flutter)
export const ProxyMode = {
    NONE: 'none',           // Direct CDN access
    MANIFEST_ONLY: 'manifest', // Only manifest through proxy
    FULL: 'full'            // All requests through proxy
};

export const detectFormat = (url, format = null) => {
    const lowerUrl = url.toLowerCase();
    
    // HLS detection (including non-standard extensions)
    if (lowerUrl.includes('.m3u8') || 
        lowerUrl.includes('/hls/') || 
        lowerUrl.includes('/m3u8/') || 
        lowerUrl.includes('master.txt') || 
        lowerUrl.includes('/manifests/') ||
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
    
    return format || 'native';
};

// Suggest initial proxy mode based on URL patterns
export const suggestInitialMode = (url) => {
    const lower = url.toLowerCase();
    
    // Known protection parameters - start with manifest proxy
    const protectionParams = ['md5=', 'expires=', 'expire=', 'token=', 'hmac=', 'hash=', 'auth=', 'sign='];
    if (protectionParams.some(p => lower.includes(p))) {
        return ProxyMode.MANIFEST_ONLY;
    }
    
    // Everything else - try direct first
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

// Build proxy URL with mode support
export const buildProxyUrlWithMode = (url, userAgent, referer, mode) => {
    if (mode === ProxyMode.NONE) {
        return url;
    }
    
    let proxyUrl = buildProxyUrl(url, userAgent, referer, 'video');
    
    // Add force_proxy for FULL mode
    if (mode === ProxyMode.FULL) {
        proxyUrl += (proxyUrl.includes('?') ? '&' : '?') + 'force_proxy=1';
    }
    
    return proxyUrl;
};

export const createHlsXhrSetup = (userAgent, referer, context, initialMode = ProxyMode.MANIFEST_ONLY) => {
    return (xhr, requestUrl) => {
        const proxyOrigin = getProxyBaseUrl();
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

        // 3. FULL mode - proxy everything including segments
        if (currentMode === ProxyMode.FULL && isSegment) {
            const proxyUrl = buildProxyUrlWithMode(requestUrl, userAgent, referer, ProxyMode.FULL);
            xhr.open('GET', proxyUrl, true);
            return;
        }

        // 4. MANIFEST_ONLY mode - segments direct
        if (currentMode === ProxyMode.MANIFEST_ONLY && requestUrl.startsWith('http') && isSegment) {
            return; 
        }
        
        // 5. Fix wrongly resolved paths
        if (requestUrl.startsWith(proxyOrigin) && !requestUrl.includes('/proxy/')) {
            const path = requestUrl.substring(proxyOrigin.length);
            if (context.lastLoadedOrigin) {
                const correctUrl = context.lastLoadedOrigin.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
                xhr.open('GET', buildProxyUrl(correctUrl, userAgent, referer, 'video'), true);
                return;
            }
        }

        // 6. Manifests and Keys always through proxy
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
            
            callbacks.onError = (response, loaderContext, loader, stats) => {
                const isDirectUrl = !loaderContext.url.includes('/proxy/video');
                const isNetworkError = response.code === 0 || response.code === 403;
                const isProxyUrl = loaderContext.url.includes('/proxy/video');
                const isFullProxy = loaderContext.url.includes('force_proxy=1');

                // Determine next mode based on current state
                let nextMode = null;
                if (isNetworkError) {
                    if (isDirectUrl) {
                        nextMode = ProxyMode.MANIFEST_ONLY;
                    } else if (isProxyUrl && !isFullProxy) {
                        nextMode = ProxyMode.FULL;
                    }
                }

                if (nextMode && self._retryCount < 2) {
                    self._retryCount++;
                    console.warn(`[HLS Fallback] Error (code ${response.code}), escalating to ${nextMode.toUpperCase()}...`);
                    
                    // Update context mode for future requests
                    context.currentProxyMode = nextMode;
                    
                    // Extract original URL
                    const originalUrl = isProxyUrl 
                        ? decodeURIComponent(loaderContext.url.match(/url=([^&]+)/)?.[1] || loaderContext.url) 
                        : loaderContext.url;
                    
                    // Build new URL with escalated mode
                    const newUrl = buildProxyUrlWithMode(originalUrl, userAgent, referer, nextMode);
                    
                    // Create a fresh XHR request manually (avoid loader reuse)
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', newUrl, true);
                    xhr.responseType = loaderContext.responseType || '';
                    
                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            const data = xhr.response;
                            callbacks.onSuccess(
                                { data, url: newUrl },
                                { ...stats, loaded: xhr.response.length || 0 },
                                loaderContext,
                                null
                            );
                        } else {
                            if (originalOnError) originalOnError(
                                { code: xhr.status, text: xhr.statusText },
                                loaderContext, loader, stats
                            );
                        }
                    };
                    
                    xhr.onerror = () => {
                        // Try next escalation or give up
                        if (self._retryCount < 2 && nextMode === ProxyMode.MANIFEST_ONLY) {
                            context.currentProxyMode = ProxyMode.FULL;
                            const fullUrl = buildProxyUrlWithMode(originalUrl, userAgent, referer, ProxyMode.FULL);
                            console.warn(`[HLS Fallback] Retry failed, escalating to FULL...`);
                            
                            const xhr2 = new XMLHttpRequest();
                            xhr2.open('GET', fullUrl, true);
                            xhr2.responseType = loaderContext.responseType || '';
                            xhr2.onload = () => {
                                if (xhr2.status >= 200 && xhr2.status < 300) {
                                    callbacks.onSuccess(
                                        { data: xhr2.response, url: fullUrl },
                                        { ...stats, loaded: xhr2.response.length || 0 },
                                        loaderContext, null
                                    );
                                } else {
                                    if (originalOnError) originalOnError(
                                        { code: xhr2.status, text: xhr2.statusText },
                                        loaderContext, loader, stats
                                    );
                                }
                            };
                            xhr2.onerror = () => {
                                if (originalOnError) originalOnError(
                                    { code: 0, text: 'Network error' },
                                    loaderContext, loader, stats
                                );
                            };
                            xhr2.send();
                        } else {
                            if (originalOnError) originalOnError(
                                { code: 0, text: 'Network error' },
                                loaderContext, loader, stats
                            );
                        }
                    };
                    
                    xhr.send();
                    return;
                }
                
                // All modes exhausted or non-recoverable error
                if (originalOnError) originalOnError(response, loaderContext, loader, stats);
            };

            this._hasLoaded = true;
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
        xhrSetup: createHlsXhrSetup(userAgent, referer, context, context.currentProxyMode),
        fLoader: SmartFallbackLoader
    };
};
