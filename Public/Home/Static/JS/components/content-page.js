// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import { $, $$, ready, t } from '../utils/dom.min.js';
import { renderSimilarContent } from '../utils/similar.min.js';

// ── Watched Episodes Restore ──────────────────────────────────
function _restoreWatchedEpisodes() {
    try {
        const contentUrl = $('#similar-data')?.dataset?.contentUrl;
        if (!contentUrl) return;

        const watchedData = JSON.parse(localStorage.getItem('wb_watched_episodes') || '{}');
        const watched = watchedData[contentUrl] || [];

        watched.forEach(key => {
            const [season, episode] = key.split('x');
            $$(`.episode-card[data-season="${season}"][data-episode="${episode}"]`).forEach(el => {
                el.classList.add('is-watched');
            });
        });
    } catch (e) {
        console.warn('Episode watched restore failed:', e);
    }
}

// ── Share ──────────────────────────────────────────────────────
function _copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const toast = document.createElement('div');
        toast.className = 'share-toast';
        toast.textContent = t('link_copied');
        document.body.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2000);
    }).catch(() => {
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
    });
}

function _initShareButton() {
    const btn = $('#share-content-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const title = $('meta[property="og:title"]')?.content || document.title;
        const url   = window.location.href;
        const text  = `🍿 ${title} — WatchBuddy`;

        if (navigator.share) {
            try {
                await navigator.share({ title, text, url });
            } catch (e) {
                if (e.name !== 'AbortError') _copyToClipboard(url);
            }
        } else {
            _copyToClipboard(url);
        }
    });
}

ready(() => {
    // Smooth scroll to episodes section
    const scrollBtn = $('#scroll-to-episodes');
    if (scrollBtn) {
        scrollBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const target = $('#episodes-section');
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    const tabs   = $$('#season-tabs .season-tab');
    const panels = $$('.season-panel');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const s = tab.dataset.season;
            tabs.forEach(el => el.classList.toggle('active', el.dataset.season === s));
            panels.forEach(p => p.classList.toggle('active', p.dataset.season === s));
        });
    });

    // ── Benzer İçerikler ──────────────────────────────────────────
    const similarSection = $('#similar-section');
    const similarData    = $('#similar-data');
    if (similarSection && similarData) {
        const params     = new URLSearchParams(window.location.search);
        const provider   = params.get('provider') || window.PROVIDER_URL || null;
        const apiBase    = provider ? provider.replace(/\/$/, '') : '';
        const providerQA = provider ? `&provider=${encodeURIComponent(provider)}` : '';

        renderSimilarContent(similarSection, {
            apiBase,
            plugin          : similarData.dataset.plugin       || '',
            queryTitle      : decodeURIComponent(similarData.dataset.title      || ''),
            tags            : decodeURIComponent(similarData.dataset.tags       || ''),
            currentUrl      : similarData.dataset.currentUrl  || '',
            providerQueryAmp: providerQA,
        });
    }

    _restoreWatchedEpisodes();
    _initShareButton();
});
