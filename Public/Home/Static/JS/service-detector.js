// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

// ============== Provider Proxy Service Detector ==============
// Detects if a provider's proxy service is available

const state = {
    knownProxies: new Map(), // url -> { available: bool, lastChecked: number }
};

// Check if any URL is available
export const isProxyAvailable = (baseUrl) => {
    if (!baseUrl) return false;
    const cleanBaseUrl = baseUrl.trim().replace(/\/+$/, '');
    if (!cleanBaseUrl) return false;
    const entry = state.knownProxies.get(cleanBaseUrl);
    if (!entry) {
        // Optimistic: Return true and trigger background check
        checkProxyHealth(cleanBaseUrl).then(available => {
            state.knownProxies.set(cleanBaseUrl, { 
                available, 
                lastChecked: Date.now() 
            });
        });
        return true; 
    }
    
    // Refresh if older than 5 minutes
    if (Date.now() - entry.lastChecked > 300000) {
        checkProxyHealth(cleanBaseUrl).then(available => {
            entry.available = available;
            entry.lastChecked = Date.now();
        });
    }
    
    return entry.available;
};

// Invalidate proxy cache (trigger re-check or failover)
export const invalidateProxy = (baseUrl) => {
    if (!baseUrl) return;
    const cleanBaseUrl = baseUrl.trim().replace(/\/+$/, '');
    if (!cleanBaseUrl) return;
    const entry = state.knownProxies.get(cleanBaseUrl);
    if (entry) {
        entry.available = false;
        entry.lastChecked = 0; // Force re-check next time (or keep it marked bad)
    }
};

// Check if Proxy service is available (internal)
const checkProxyHealth = async (baseUrl) => {
    try {
        const url = `${baseUrl.replace(/\/$/, '')}/health`;
        const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
        return response.ok;
    } catch {
        return false;
    }
};

// Build full proxy URL for video/subtitle
export const buildProxyUrl = (url, userAgent = '', referer = '', endpoint = 'video', proxyBase = null) => {
    const params = new URLSearchParams();
    params.append('url', url);
    if (userAgent) params.append('user_agent', userAgent);
    if (referer) params.append('referer', referer);

    // Subtitle için her zaman aynı origin (Python proxy) kullan
    // Video <track> elementleri cross-origin kısıtlamalarına tabidir
    if (endpoint === 'subtitle') {
        return `${window.location.origin}/proxy/${endpoint}?${params.toString()}`;
    }

    const cleanBase = proxyBase ? proxyBase.trim().replace(/\/+$/, '') : '';
    if (cleanBase && isProxyAvailable(cleanBase)) {
        return `${cleanBase}/proxy/${endpoint}?${params.toString()}`;
    }
    return url;
};


