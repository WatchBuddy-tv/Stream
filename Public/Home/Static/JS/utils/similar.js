// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import { fetchJSON } from './fetch.min.js';
import { createElement, escapeHtml, t } from './dom.min.js';

const MAX_RESULTS = 12;

function _normalize(str) {
    if (!str) return '';
    let s = String(str);
    for (const [k, v] of Object.entries({ 'ı':'i','İ':'i','ş':'s','Ş':'s','ğ':'g','Ğ':'g','ü':'u','Ü':'u','ö':'o','Ö':'o','ç':'c','Ç':'c' })) {
        s = s.split(k).join(v);
    }
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * İlgili eklentinin kategorisinden rastgele içerikler gösterir.
 *
 * 1. get_plugin → plugin'in main_page kategorilerini al
 * 2. İçeriğin tags'ini kategorilerle eşleştir
 * 3. get_main_page → eşleşen kategoriden içerik çek
 * 4. Mevcut içeriği filtrele, karıştır, göster
 */
export async function renderSimilarContent(containerEl, opts = {}) {
    if (!containerEl) return;

    const {
        apiBase          = '',
        plugin           = '',
        queryTitle       = '',
        tags             = '',
        currentUrl       = '',
        providerQueryAmp = '',
    } = opts;

    if (!plugin) return;

    // ── Skeleton ──
    containerEl.innerHTML = '';

    const titleEl = createElement('h2', { className: 'section-title' });
    titleEl.innerHTML = `<i class="fas fa-film" style="color:var(--primary-color);margin-right:var(--spacing-sm)"></i>${escapeHtml(t('similar_content_title'))}`;
    containerEl.appendChild(titleEl);

    const skeleton = createElement('div', { className: 'similar-loading' });
    for (let i = 0; i < 6; i++) {
        skeleton.appendChild(createElement('div', { className: 'similar-skeleton-card' }));
    }
    containerEl.appendChild(skeleton);

    try {
        // 1. Plugin bilgilerini al (kategoriler)
        const pluginData = await fetchJSON(`${apiBase}/api/v1/get_plugin?plugin=${encodeURIComponent(plugin)}`);
        const pluginInfo = pluginData?.result ?? pluginData ?? {};
        const mainPage   = pluginInfo.main_page || {};

        const categoryEntries = Object.entries(mainPage);
        if (!categoryEntries.length) { containerEl.remove(); return; }

        // 2. İçeriğin tag'lerini kategori isimleriyle eşleştir
        const contentTags = (tags || '').split(',').map(t => _normalize(t.trim())).filter(Boolean);
        let matchedEntry  = null;

        if (contentTags.length) {
            for (const [encodedUrl, encodedCat] of categoryEntries) {
                const catName = _normalize(decodeURIComponent(encodedCat));
                if (contentTags.some(tag => catName.includes(tag) || tag.includes(catName))) {
                    matchedEntry = [encodedUrl, encodedCat];
                    break;
                }
            }
        }

        // Eşleşme yoksa rastgele bir kategori seç
        if (!matchedEntry) {
            const idx = Math.floor(Math.random() * categoryEntries.length);
            matchedEntry = categoryEntries[idx];
        }

        const [encodedUrl, encodedCategory] = matchedEntry;

        // 3. Kategoriden içerik çek (rastgele sayfa 1-3)
        const page = Math.floor(Math.random() * 3) + 1;
        const mainPageUrl = `${apiBase}/api/v1/get_main_page?plugin=${encodeURIComponent(plugin)}&page=${page}&encoded_url=${encodedUrl}&encoded_category=${encodedCategory}`;
        const mainPageData = await fetchJSON(mainPageUrl);
        let results = mainPageData?.result ?? mainPageData ?? [];

        // 4. Mevcut içeriği filtrele
        const normCurrent = _normalize(currentUrl);
        results = results.filter(item => _normalize(item.url || '') !== normCurrent);

        // Karıştır (Fisher-Yates shuffle)
        for (let i = results.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [results[i], results[j]] = [results[j], results[i]];
        }

        results = results.slice(0, MAX_RESULTS);

        skeleton.remove();

        if (!results.length) { containerEl.remove(); return; }

        // 5. Grid render
        const grid = createElement('div', { className: 'grid' });

        for (const item of results) {
            const itemUrl    = item.url    || '';
            const itemTitle  = item.title  || '';
            const itemPoster = item.poster || '';
            const category   = decodeURIComponent(encodedCategory.replace(/\+/g, ' '));

            const href = `/icerik/${encodeURIComponent(plugin)}?url=${itemUrl}${providerQueryAmp}`;

            const card = createElement('a', { className: 'poster-card', href, title: itemTitle });

            // Kategori badge
            const badge = createElement('span', { className: 'poster-card-badge' }, category);
            card.appendChild(badge);

            const imgWrap = createElement('div', {
                className: `poster-card-img${itemPoster ? '' : ' has-error'}`,
                '--no-poster-text': `"${t('no_poster')}"`,
            });

            if (itemPoster) {
                const img = createElement('img', { src: itemPoster, alt: itemTitle, loading: 'lazy' });
                img.onerror = () => imgWrap.classList.add('has-error');
                imgWrap.appendChild(img);
            }

            const overlay = createElement('div', { className: 'poster-card-overlay' });
            overlay.appendChild(createElement('p', { className: 'poster-card-title' }, itemTitle));

            card.appendChild(imgWrap);
            card.appendChild(overlay);
            grid.appendChild(card);
        }

        containerEl.appendChild(grid);

    } catch (err) {
        console.warn('[SimilarContent]', err);
        containerEl.remove();
    }
}
