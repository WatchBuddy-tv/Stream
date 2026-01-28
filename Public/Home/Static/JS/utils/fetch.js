// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.
import BuddyLogger from './BuddyLogger.min.js';

export async function fetchJSON(url, options = {}) {
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        BuddyLogger.error('🌐', 'FETCHER', 'JSON Fetch Error', { 'Url': url, 'Details': error.message });
        throw error;
    }
}

export async function fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout');
        }
        throw error;
    }
}

export class AbortableFetch {
    constructor() {
        // Keep track of all active controllers so we can support concurrent requests
        this.controllers = new Set();
    }
    
    async fetch(url, options = {}, config = {}) {
        const { abortPrevious = true } = config;
        // Abort previous requests if requested
        if (abortPrevious) this.abort();
        
        // Create new controller for this request and track it
        const controller = new AbortController();
        this.controllers.add(controller);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            // Remove controller on successful completion
            this.controllers.delete(controller);
            return response;
        } catch (error) {
            if (error.name === 'AbortError') {
                BuddyLogger.debug('🛑', 'FETCHER', 'Fetch Aborted');
            }
            // Ensure we always remove the controller
            this.controllers.delete(controller);
            throw error;
        }
    }
    
    abort() {
        if (this.controllers && this.controllers.size > 0) {
            this.controllers.forEach(ctrl => {
                try { ctrl.abort(); } catch (e) { /* ignore */ }
            });
            this.controllers.clear();
        }
    }
    
    isActive() {
        return this.controllers && this.controllers.size > 0;
    }
}

export async function post(url, data, options = {}) {
    return fetchJSON(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        body: JSON.stringify(data),
        ...options
    });
}

export async function get(url, params = {}, options = {}) {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    return fetchJSON(fullUrl, options);
}
