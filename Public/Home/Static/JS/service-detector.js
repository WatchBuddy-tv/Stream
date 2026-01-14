// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

// ============== Go Proxy Service Detector ==============
// Detects if Go proxy service is available, provides fallback to Python

const state = {
    goAvailable: null,
    pyAvailable: null,
    checking: false
};

// Check if Proxy service is available
const checkProxyHealth = async (baseUrl) => {
    try {
        const url = `${baseUrl.replace(/\/$/, '')}/health`;
        const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
        return response.ok;
    } catch {
        return false;
    }
};

// Detect proxy services (call on page load)
export const detectGoServices = async () => {
    if (state.checking) return;
    state.checking = true;
    
    try {
        const goOk = await checkProxyHealth('https://goProxy.watchbuddy.tv');
        const pyOk = await checkProxyHealth('https://pyProxy.watchbuddy.tv');
        
        state.goAvailable = goOk;
        state.pyAvailable = pyOk;
        
        const proxyStatus = goOk ? '✅ Go' : (pyOk ? '⚠️ Python' : '❌ None');
        
        console.log(
            `%c[🔌 SERVICE]%c Proxy: ${proxyStatus}`,
            'color: #a855f7; font-weight: bold;',
            ''
        );
    } finally {
        state.checking = false;
    }
};

// Get Proxy base URL (Go or Python, no fallback)
export const getProxyBaseUrl = () => {
    if (state.goAvailable) {
        return 'https://goProxy.watchbuddy.tv';
    } else if (state.pyAvailable) {
        return 'https://pyProxy.watchbuddy.tv';
    }
    return null;  // No proxy available
};

// Build full proxy URL for video/subtitle
export const buildProxyUrl = (url, userAgent = '', referer = '', endpoint = 'video') => {
    const params = new URLSearchParams();
    params.append('url', url);
    if (userAgent) params.append('user_agent', userAgent);
    if (referer) params.append('referer', referer);

    const proxyBase = getProxyBaseUrl();

    // Subtitle için her zaman aynı origin (Python proxy) kullan
    // Video <track> elementleri cross-origin kısıtlamalarına tabidir
    if (endpoint === 'subtitle') {
        return `${proxyBase}/proxy/${endpoint}?${params.toString()}`;
    }
    
    if (proxyBase) {
        return `${proxyBase}/proxy/${endpoint}?${params.toString()}`;
    }
    // No proxy available, return direct URL
    return url;
};


