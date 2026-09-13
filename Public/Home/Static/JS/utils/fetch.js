// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.
import BuddyLogger from './BuddyLogger.min.js';
import { t } from './dom.min.js';

const APP_LINKS = {
    android: 'https://play.google.com/store/apps/details?id=com.keyiflerolsun.watchbuddy',
    ios: 'https://apps.apple.com/us/app/watchbuddy-watch-together/id6758553756'
};

export const showProviderRecoveryModal = (providerError) => {
    const existing = document.getElementById('provider-recovery-modal');
    if (existing) existing.remove();

    const isRateLimit = providerError?.status_code === 429;

    const overlay = document.createElement('div');
    overlay.id = 'provider-recovery-modal';
    overlay.className = 'modal-overlay is-active provider-recovery-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
        <div class="modal-content">
            <h2 class="modal-title"><i class="fas fa-mobile-screen-button"></i> ${t('provider_recovery_title')}</h2>
            <p class="modal-body">${t(isRateLimit ? 'provider_recovery_rate_limit' : 'provider_recovery_message')}</p>
            <div class="modal-actions">
                <a class="button button-primary" href="${APP_LINKS.ios}" target="_blank" rel="noopener noreferrer"><i class="fab fa-apple"></i> ${t('download_apple')}</a>
                <a class="button button-secondary" href="${APP_LINKS.android}" target="_blank" rel="noopener noreferrer"><i class="fab fa-google-play"></i> ${t('download_google')}</a>
            </div>
        </div>`;
    document.body.appendChild(overlay);
};

export async function fetchJSON(url, options = {}) {
    try {
        const response = await fetch(url, options);

        const payload = await response.json();
        if (payload?.provider_error) {
            if ([403, 429].includes(payload.provider_error.status_code)) {
                showProviderRecoveryModal(payload.provider_error);
            }
            const error = new Error(`Provider HTTP ${payload.provider_error.status_code}`);
            error.providerError = payload.provider_error;
            throw error;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return payload;
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

            // fetchJSON ile aynı sözleşme: provider_error varsa recovery modal göster (403 / 429).
            // clone() kullanıyoruz çünkü orijinal response body'sini caller (ör. search.js) .json() ile okuyacak.
            response.clone().json().then(payload => {
                if (payload?.provider_error && [403, 429].includes(payload.provider_error.status_code)) {
                    showProviderRecoveryModal(payload.provider_error);
                }
            }).catch(() => { /* JSON değilse veya boşsa yoksay */ });

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
