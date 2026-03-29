import VideoPlayer from './components/VideoPlayer.min.js';
import { fetchJSON } from './utils/fetch.min.js';
import { t, escapeHtml } from './utils/dom.min.js';
import { renderSimilarContent } from './utils/similar.min.js';

// ── Next Episode ──────────────────────────────────────────────
async function initNextEpisode(meta, providerQueryAmp, apiBase) {
    const { pluginName, contentUrl, season, episode } = meta;

    if (!pluginName || !contentUrl || !season || !episode) return;

    const currentSeason  = parseInt(season,  10);
    const currentEpisode = parseInt(episode, 10);
    if (isNaN(currentSeason) || isNaN(currentEpisode)) return;

    try {
        const apiUrl = `${apiBase}/api/v1/load_item?plugin=${encodeURIComponent(pluginName)}&encoded_url=${encodeURIComponent(contentUrl)}`;
        const data   = await fetchJSON(apiUrl);
        const episodes = data?.result?.episodes ?? data?.episodes ?? [];
        if (!episodes.length) return;

        // Sort by (season, episode)
        const sorted = [...episodes].sort((a, b) => {
            const sa = parseInt(a.season  ?? 1, 10);
            const sb = parseInt(b.season  ?? 1, 10);
            const ea = parseInt(a.episode ?? 0, 10);
            const eb = parseInt(b.episode ?? 0, 10);
            return sa !== sb ? sa - sb : ea - eb;
        });

        const idx = sorted.findIndex(ep =>
            parseInt(ep.season  ?? 1, 10) === currentSeason &&
            parseInt(ep.episode ?? 0, 10) === currentEpisode
        );

        if (idx < 0 || idx >= sorted.length - 1) return; // last episode or not found

        const nextEp     = sorted[idx + 1];
        const nextLabel  = `${t('season').replace('{season}', String(nextEp.season ?? currentSeason))} E${nextEp.episode ?? (idx + 2)}`;
        const nextTitle  = nextEp.title || nextLabel;

        // Build URL — poster/year/rating from current page meta
        const container  = document.getElementById('video-links-data');
        const rawTitle   = container?.dataset.contentTitle || '';
        const baslik     = rawTitle ? decodeURIComponent(rawTitle) : '';
        const poster     = container?.dataset.posterUrl  || '';
        const year       = container?.dataset.year       || '';
        const rating     = container?.dataset.rating     || '';

        const parts = [
            `url=${nextEp.url}`,
            `baslik=${encodeURIComponent(baslik)}`,
            `content_url=${encodeURIComponent(contentUrl)}`,
            poster ? `poster_url=${encodeURIComponent(poster)}` : '',
            year   ? `year=${encodeURIComponent(year)}`         : '',
            rating ? `rating=${encodeURIComponent(rating)}`     : '',
            `season=${nextEp.season ?? currentSeason}`,
            `episode=${nextEp.episode ?? (idx + 2)}`,
        ].filter(Boolean).join('&');

        const href = `/izle/${encodeURIComponent(pluginName)}?${parts}${providerQueryAmp}`;

        // Populate #next-episode-panel
        const panel = document.getElementById('next-episode-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="next-ep-label">
                <i class="fas fa-step-forward"></i>
                <span>${t('next_episode')}</span>
            </div>
            <div class="next-ep-body">
                <p class="next-ep-title">${escapeHtml(nextTitle)}</p>
                <a id="next-ep-watch" class="button button-primary" href="${escapeHtml(href)}">
                    <i class="fas fa-play"></i> <span class="next-ep-btn-label">${escapeHtml(t('watch_now'))}</span>
                </a>
            </div>
            <div class="next-ep-countdown-bar">
                <div id="next-ep-fill" class="next-ep-countdown-fill"></div>
            </div>`;

        panel.classList.remove('is-hidden');

        // Auto-advance on video ended (5s countdown)
        const videoEl = document.getElementById('video-player');
        if (videoEl) {
            videoEl.addEventListener('ended', () => {
                let secs = 5;
                const fill    = document.getElementById('next-ep-fill');
                const btnLabel = panel.querySelector('.next-ep-btn-label');
                panel.classList.add('is-counting');

                if (fill) {
                    fill.style.transition = 'none';
                    fill.style.transform  = 'scaleX(1)';
                    requestAnimationFrame(() => {
                        fill.style.transition  = `transform ${secs}s linear`;
                        fill.style.transformOrigin = 'left';
                        fill.style.transform   = 'scaleX(0)';
                    });
                }

                const timer = setInterval(() => {
                    secs--;
                    if (btnLabel) btnLabel.textContent = `${t('next_episode_auto')} (${secs}s)`;
                    if (secs <= 0) {
                        clearInterval(timer);
                        window.location.href = href;
                    }
                }, 1000);

                // Cancel on click or any key
                const cancel = () => {
                    clearInterval(timer);
                    panel.classList.remove('is-counting');
                    if (fill) { fill.style.transition = 'none'; fill.style.transform = 'scaleX(1)'; }
                    if (btnLabel) btnLabel.textContent = t('watch_now');
                    document.removeEventListener('keydown', cancel);
                };
                panel.querySelector('#next-ep-watch')?.addEventListener('click', () => clearInterval(timer), { once: true });
                document.addEventListener('keydown', cancel, { once: true });
            }, { once: true });
        }

    } catch (err) { console.warn('[NextEpisode]', err); }
}

// ── Similar Content ────────────────────────────────────────────
function initSimilarContent(meta, providerQueryAmp, apiBase) {
    const similarSection = document.getElementById('similar-section');
    if (!similarSection || !meta.pluginName || !meta.contentTitle) return;

    renderSimilarContent(similarSection, {
        apiBase,
        plugin           : meta.pluginName,
        queryTitle       : meta.contentTitle,
        currentUrl       : meta.contentUrl || '',
        providerQueryAmp,
    });
}

// ── Share (Player Page) ───────────────────────────────────
function _initPlayerShare() {
    const btn = document.getElementById('share-player-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const title = document.querySelector('meta[property="og:title"]')?.content || document.title;
        const url   = window.location.href;
        const text  = `🍿 ${title} — WatchBuddy`;

        if (navigator.share) {
            try {
                await navigator.share({ title, text, url });
            } catch (e) {
                if (e.name !== 'AbortError') _playerCopyToClipboard(url);
            }
        } else {
            _playerCopyToClipboard(url);
        }
    });
}

function _playerCopyToClipboard(text) {
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

// ── Resume Watching Prompt ─────────────────────────────────
function _showResumePrompt(savedTime, onResume) {
    const minutes = Math.floor(savedTime / 60);
    const seconds = Math.floor(savedTime % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const prompt = document.createElement('div');
    prompt.className = 'resume-prompt';

    const span = document.createElement('span');
    span.textContent = t('resume_watching').replace('{time}', timeStr);
    prompt.appendChild(span);

    const yesBtn = document.createElement('button');
    yesBtn.className = 'resume-btn';
    yesBtn.textContent = t('resume_yes');
    prompt.appendChild(yesBtn);

    const noBtn = document.createElement('button');
    noBtn.className = 'resume-dismiss';
    noBtn.textContent = '✕';
    prompt.appendChild(noBtn);

    document.getElementById('video-player-wrapper')?.appendChild(prompt);

    yesBtn.addEventListener('click', () => {
        onResume();
        prompt.remove();
    });
    noBtn.addEventListener('click', () => prompt.remove());

    setTimeout(() => { if (prompt.parentNode) prompt.remove(); }, 10000);
}

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const player = new VideoPlayer();
    window.__videoPlayer = player;

    const container = document.getElementById('video-links-data');
    if (!container) return;

    const rawTitle = container.dataset.contentTitle || '';

    const meta = {
        pluginName   : container.dataset.pluginName  || '',
        contentUrl   : container.dataset.contentUrl  || '',
        contentTitle : rawTitle ? decodeURIComponent(rawTitle) : '',
        season       : container.dataset.season      || '',
        episode      : container.dataset.episode     || '',
    };

    const params        = new URLSearchParams(window.location.search);
    const provider      = params.get('provider') || window.PROVIDER_URL || null;
    const apiBase       = provider ? provider.replace(/\/$/, '') : '';
    const providerQA    = provider ? `&provider=${encodeURIComponent(provider)}` : '';

    initNextEpisode(meta, providerQA, apiBase);
    initSimilarContent(meta, providerQA, apiBase);

    // Resume watching check
    const contentUrl = container.dataset.contentUrl || window.location.pathname;
    const season     = container.dataset.season  || '';
    const episode    = container.dataset.episode || '';
    const resumeKey  = (season && episode) ? `${contentUrl}::s${season}::e${episode}` : contentUrl;
    try {
        const resumeData = JSON.parse(localStorage.getItem('wb_resume_watching') || '{}');
        const saved = resumeData[resumeKey];
        if (saved && saved.time > 10) {
            _showResumePrompt(saved.time, () => {
                const video = document.getElementById('video-player');
                if (video) video.currentTime = saved.time;
            });
        }
    } catch (e) {
        console.warn('Resume restore failed:', e);
    }

    _initPlayerShare();
});
