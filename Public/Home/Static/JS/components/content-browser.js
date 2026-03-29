// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import { fetchJSON } from '../utils/fetch.min.js';
import { $, createElement, ready, escapeHtml, t } from '../utils/dom.min.js';
import BuddyLogger from '../utils/BuddyLogger.min.js';
import { renderSimilarContent } from '../utils/similar.min.js';

class ContentBrowser {
    constructor() {
        this.container   = null;
        this.plugin      = null;
        this.providerQueryAmp = '';
        this.previewOverlay   = null;
        this._activeRequests  = 0;
        this._queue           = [];
        this._MAX_CONCURRENT  = 3;
        this._observer        = null;
        this._prevFocusEl     = null;
        this._keydownHandler  = null;
    }

    // ── Bootstrap ──────────────────────────────────────────────
    init(pluginData) {
        this.container = document.getElementById('dynamic-content');
        if (!this.container) return;

        this.plugin = pluginData;

        const params = new URLSearchParams(window.location.search);
        const provider = params.get('provider') || window.PROVIDER_URL || null;
        if (provider) this.providerQueryAmp = `&provider=${encodeURIComponent(provider)}`;

        this._providerQuery = provider ? `?provider=${encodeURIComponent(provider)}` : '';
        // When a remote provider is active, call its API directly instead of the local server
        this._apiBase = provider ? provider.replace(/\/$/, '') : '';

        this._createPreviewModal();
        this._renderCategories();
    }

    // ── Throttle Queue ─────────────────────────────────────────
    _enqueue(fn) {
        this._queue.push(fn);
        this._drain();
    }

    _drain() {
        while (this._activeRequests < this._MAX_CONCURRENT && this._queue.length) {
            const task = this._queue.shift();
            this._activeRequests++;
            task().finally(() => {
                this._activeRequests--;
                this._drain();
            });
        }
    }

    // ── Category Rows ──────────────────────────────────────────
    _renderCategories() {
        const mainPage = this.plugin.main_page;
        if (!mainPage || typeof mainPage !== 'object') return;

        const entries = Object.entries(mainPage);
        if (entries.length === 0) return;

        this._observer = new IntersectionObserver((items) => {
            items.forEach(entry => {
                if (!entry.isIntersecting) return;

                const row    = entry.target;
                const catUrl  = row.dataset.catUrl;
                const catName = row.dataset.catName;

                this._observer.unobserve(row);
                this._enqueue(() => this._fetchAndRenderRow(row, catUrl, catName));
            });
        }, { rootMargin: '200px 0px' });

        entries.forEach(([encodedUrl, encodedName], idx) => {
            const row = this._createRowShell(encodedName, encodedUrl);
            this.container.appendChild(row);
            this._observer.observe(row);
        });

        this._buildFeaturedHero(entries);
    }

    _createRowShell(catName, catUrl) {
        const decodedName = decodeURIComponent(catName.replace(/\+/g, ' '));

        const seeAllHref = `/kategori/${encodeURIComponent(this.plugin.name)}?kategori_url=${catUrl}&kategori_adi=${catName}${this.providerQueryAmp}`;

        const row = createElement('div', { className: 'carousel-row', dataset: { catUrl, catName } });

        const header = createElement('div', { className: 'carousel-header' });
        header.appendChild(createElement('h2', { className: 'carousel-title' }, decodedName));

        const seeAll = createElement('a', { className: 'carousel-see-all', href: seeAllHref });
        seeAll.innerHTML = `${t('see_all')} <i class="fas fa-chevron-right"></i>`;
        header.appendChild(seeAll);
        row.appendChild(header);

        const wrapper = createElement('div', { className: 'carousel-wrapper' });
        const track   = createElement('div', { className: 'carousel-track' });

        for (let i = 0; i < 8; i++) {
            const skel = createElement('div', { className: 'poster-card skeleton' });
            skel.appendChild(createElement('div', { className: 'poster-card-img' }));
            track.appendChild(skel);
        }

        wrapper.appendChild(track);
        row.appendChild(wrapper);

        return row;
    }

    // ── Fetch & Render Single Row ──────────────────────────────
    async _fetchAndRenderRow(rowEl, catUrl, catName) {
        try {
            const apiUrl = `${this._apiBase}/api/v1/get_main_page?plugin=${encodeURIComponent(this.plugin.name)}&page=1&encoded_url=${catUrl}&encoded_category=${catName}`;
            const data   = await fetchJSON(apiUrl);
            const items  = data?.result || [];

            if (items.length === 0) {
                rowEl.querySelector('.carousel-track').innerHTML = `<p class="carousel-empty">${t('no_results')}</p>`;
                return;
            }

            const track = rowEl.querySelector('.carousel-track');
            track.innerHTML = '';

            items.forEach(item => {
                track.appendChild(this._createPosterCard(item));
            });

            this._setupCarouselArrows(rowEl);

            // Infinite scroll: load next page when scrolled near end
            if (items.length >= 15) {
                this._setupInfiniteScroll(rowEl, catUrl, catName, 1);
            }
        } catch (err) {
            BuddyLogger.error('📋', 'CONTENT-BROWSER', 'Row fetch error', { Error: err?.message || err });
            const track = rowEl.querySelector('.carousel-track');
            if (track) track.innerHTML = `<p class="carousel-empty carousel-error">${t('error_generic')}</p>`;
        }
    }

    // ── Infinite Scroll ────────────────────────────────────────
    _setupInfiniteScroll(rowEl, catUrl, catName, currentPage) {
        const track = rowEl.querySelector('.carousel-track');
        if (!track) return;

        let page       = currentPage;
        let loading    = false;
        let exhausted  = false;

        const loadMore = async () => {
            if (loading || exhausted) return;

            const scrollEnd = track.scrollLeft + track.clientWidth;
            const threshold = track.scrollWidth - 300;
            if (scrollEnd < threshold) return;

            loading = true;  // Set before async work to prevent duplicate requests
            page++;

            // Add loading sentinel
            const sentinel = createElement('div', { className: 'carousel-load-more' });
            sentinel.innerHTML = '<div class="loading-spinner loading-spinner-sm"></div>';
            track.appendChild(sentinel);

            try {
                const apiUrl = `${this._apiBase}/api/v1/get_main_page?plugin=${encodeURIComponent(this.plugin.name)}&page=${page}&encoded_url=${catUrl}&encoded_category=${catName}`;
                const data   = await fetchJSON(apiUrl);
                const items  = data?.result || [];

                sentinel.remove();

                if (items.length === 0) {
                    exhausted = true;
                    return;
                }

                items.forEach(item => {
                    track.appendChild(this._createPosterCard(item));
                });

                // Update arrow visibility
                const arrows = rowEl.querySelectorAll('.carousel-arrow');
                if (arrows.length) {
                    const rightArr = rowEl.querySelector('.carousel-arrow-right');
                    if (rightArr) rightArr.classList.remove('is-hidden');
                }

                if (items.length < 15) {
                    exhausted = true;
                }
            } catch (err) {
                BuddyLogger.warn('📋', 'CONTENT-BROWSER', 'Infinite scroll error', { Error: err?.message || err });
                sentinel.remove();
                exhausted = true;
            } finally {
                loading = false;
            }
        };

        track.addEventListener('scroll', loadMore, { passive: true });
    }

    // ── Featured Hero — random items across all categories ─────
    _buildFeaturedHero(entries) {
        if (!entries.length) return;

        const shuffled = [...entries].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(4, entries.length));

        const pool = [];
        let settled = 0;

        selected.forEach(([catUrl, catName]) => {
            this._enqueue(() => {
                const apiUrl = `${this._apiBase}/api/v1/get_main_page?plugin=${encodeURIComponent(this.plugin.name)}&page=1&encoded_url=${catUrl}&encoded_category=${catName}`;
                return fetchJSON(apiUrl).then(data => {
                    const items = (data?.result || []).filter(i => i?.poster);
                    if (items.length > 0) {
                        const catItems = [...items].sort(() => Math.random() - 0.5);
                        pool.push(...catItems.slice(0, 2));
                    }
                }).catch(() => {}).finally(() => {
                    settled++;
                    if (settled === selected.length && pool.length > 0) {
                        const heroItems = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
                        this._renderFeaturedHero(heroItems);
                    }
                });
            });
        });
    }

    // ── Featured Hero ──────────────────────────────────────────
    _renderFeaturedHero(items) {
        if (this.container.querySelector('.featured-hero')) return;
        if (!items.length) return;

        const hero = createElement('div', { className: 'featured-hero' });
        this._heroItems = items;
        this._heroIndex = 0;
        this._heroSlides = [];
        this._heroTimer = null;

        // Create slides for each item
        items.forEach((item, idx) => {
            const slide = createElement('div', { className: `featured-hero-slide ${idx === 0 ? 'is-active' : ''}` });

            // Blurred backdrop image
            const bg = createElement('div', { className: 'featured-hero-bg' });
            const bgImg = createElement('img', { src: item.poster, alt: '', loading: idx === 0 ? 'eager' : 'lazy' });
            bg.appendChild(bgImg);
            slide.appendChild(bg);

            const gradient = createElement('div', { className: 'featured-hero-gradient' });
            slide.appendChild(gradient);

            // Inner layout: poster (left) + content (right)
            const inner = createElement('div', { className: 'featured-hero-inner' });

            // Poster
            if (item.poster) {
                const posterWrap = createElement('div', { className: 'featured-hero-poster' });
                const posterImg = createElement('img', { src: item.poster, alt: item.title || '', loading: idx === 0 ? 'eager' : 'lazy' });
                posterImg.onerror = () => { posterWrap.classList.add('has-error'); };
                posterWrap.appendChild(posterImg);
                inner.appendChild(posterWrap);
            }

            // Content panel
            const content = createElement('div', { className: 'featured-hero-content' });
            content.appendChild(createElement('h2', { className: 'featured-hero-title' }, item.title || ''));

            if (item.description) {
                const desc = createElement('p', { className: 'featured-hero-desc' });
                desc.textContent = item.description.length > 200 ? item.description.substring(0, 200) + '…' : item.description;
                content.appendChild(desc);
            }

            // Placeholder for enriched meta data
            const metaRow = createElement('div', { className: 'featured-hero-meta' });
            content.appendChild(metaRow);

            const actions = createElement('div', { className: 'featured-hero-actions' });
            const detailBtn = createElement('a', {
                className: 'button button-primary',
                href: `/icerik/${encodeURIComponent(this.plugin.name)}?url=${item.url}${this.providerQueryAmp}`
            });
            detailBtn.innerHTML = `<i class="fas fa-info-circle"></i> ${t('details_button')}`;
            actions.appendChild(detailBtn);

            const previewBtn = createElement('button', {
                className: 'button button-secondary',
                onClick: (e) => { e.preventDefault(); this._showPreview(item); }
            });
            previewBtn.innerHTML = `<i class="fas fa-eye"></i> ${t('quick_look')}`;
            actions.appendChild(previewBtn);

            content.appendChild(actions);
            inner.appendChild(content);
            slide.appendChild(inner);
            hero.appendChild(slide);

            this._heroSlides.push(slide);
        });

        // Indicator dots (only if more than 1 item)
        if (items.length > 1) {
            const dots = createElement('div', { className: 'featured-hero-dots' });
            items.forEach((_, idx) => {
                const dot = createElement('button', {
                    className: `featured-hero-dot ${idx === 0 ? 'is-active' : ''}`,
                    'aria-label': `Slide ${idx + 1}`,
                    onClick: () => this._goToHeroSlide(idx)
                });
                dots.appendChild(dot);
            });
            hero.appendChild(dots);
        }

        this.container.insertBefore(hero, this.container.firstChild);

        // Enrich each slide with API data
        items.forEach((item, idx) => {
            this._enqueue(() => this._enrichHeroSlide(item, idx));
        });

        // Start auto-rotation
        if (items.length > 1) {
            this._startHeroRotation();
        }
    }

    _enrichHeroSlide(item, idx) {
        const apiUrl = `${this._apiBase}/api/v1/load_item?plugin=${encodeURIComponent(this.plugin.name)}&encoded_url=${item.url}`;
        return fetchJSON(apiUrl).then(data => {
            const content = data?.result || data || {};
            const slide = this._heroSlides[idx];
            if (!slide) return;

            // Update backdrop with cover image if available
            if (content.cover) {
                const bgImg = slide.querySelector('.featured-hero-bg img');
                if (bgImg) bgImg.src = content.cover;
            }

            const heroContent = slide.querySelector('.featured-hero-content');

            // Update description if API has better data
            if (content.description) {
                const existingDesc = heroContent.querySelector('.featured-hero-desc');
                const desc = content.description;
                const truncated = desc.length > 200 ? desc.substring(0, 200) + '…' : desc;
                if (existingDesc) {
                    existingDesc.textContent = truncated;
                } else {
                    const descEl = createElement('p', { className: 'featured-hero-desc' });
                    descEl.textContent = truncated;
                    const title = heroContent.querySelector('.featured-hero-title');
                    if (title) title.after(descEl);
                }
            }

            // Fill meta row
            const metaRow = heroContent.querySelector('.featured-hero-meta');
            if (metaRow) {
                const parts = [];
                if (content.year) parts.push(`<span class="featured-hero-meta-item"><i class="fas fa-calendar-alt"></i> ${escapeHtml(String(content.year))}</span>`);
                if (content.rating) parts.push(`<span class="featured-hero-meta-item"><i class="fas fa-star"></i> ${escapeHtml(String(content.rating))}</span>`);
                if (content.duration) parts.push(`<span class="featured-hero-meta-item"><i class="fas fa-clock"></i> ${escapeHtml(String(content.duration))}</span>`);
                if (parts.length) metaRow.innerHTML = parts.join('');

                // Tags
                const tags = Array.isArray(content.tags) ? content.tags : (typeof content.tags === 'string' && content.tags ? content.tags.split(',').map(t => t.trim()) : []);
                if (tags.length) {
                    const tagsDiv = createElement('div', { className: 'featured-hero-tags' });
                    tags.slice(0, 4).forEach(tag => {
                        tagsDiv.appendChild(createElement('span', { className: 'badge badge-outline' }, tag));
                    });
                    metaRow.after(tagsDiv);
                }
            }
        }).catch(err => {
            BuddyLogger.warn('📋', 'CONTENT-BROWSER', 'Hero enrich error', { Error: err?.message || err });
        });
    }

    _goToHeroSlide(idx) {
        if (idx === this._heroIndex) return;

        this._heroSlides.forEach((slide, i) => {
            slide.classList.toggle('is-active', i === idx);
        });

        const dots = this.container.querySelectorAll('.featured-hero-dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('is-active', i === idx);
        });

        this._heroIndex = idx;

        // Reset timer
        if (this._heroTimer) {
            clearInterval(this._heroTimer);
            this._startHeroRotation();
        }
    }

    _startHeroRotation() {
        this._heroTimer = setInterval(() => {
            const next = (this._heroIndex + 1) % this._heroItems.length;
            this._goToHeroSlide(next);
        }, 8000);
    }

    // ── Poster Card ────────────────────────────────────────────
    _createPosterCard(item) {
        const card = createElement('div', { className: 'poster-card card-glow' });

        const link = createElement('a', {
            href: `/icerik/${encodeURIComponent(this.plugin.name)}?url=${item.url}${this.providerQueryAmp}`,
            className: 'poster-card-link',
            onClick: (e) => {
                e.preventDefault();
                this._showPreview(item);
            }
        });

        const imgWrap = createElement('div', { className: 'poster-card-img' });
        if (item.poster) {
            const img = createElement('img', {
                src: item.poster,
                alt: item.title || '',
                loading: 'lazy'
            });
            img.onerror = () => { imgWrap.classList.add('has-error'); };
            imgWrap.appendChild(img);
        } else {
            imgWrap.classList.add('has-error');
        }
        link.appendChild(imgWrap);

        const overlay = createElement('div', { className: 'poster-card-overlay' });
        overlay.appendChild(createElement('span', { className: 'poster-card-title' }, item.title || ''));
        link.appendChild(overlay);

        card.appendChild(link);
        return card;
    }

    // ── Carousel Arrows ────────────────────────────────────────
    _setupCarouselArrows(rowEl) {
        const wrapper = rowEl.querySelector('.carousel-wrapper');
        const track   = rowEl.querySelector('.carousel-track');
        if (!wrapper || !track) return;

        const leftArr  = createElement('button', { className: 'carousel-arrow carousel-arrow-left', 'aria-label': 'Scroll left' });
        leftArr.innerHTML = '<i class="fas fa-chevron-left"></i>';

        const rightArr = createElement('button', { className: 'carousel-arrow carousel-arrow-right', 'aria-label': 'Scroll right' });
        rightArr.innerHTML = '<i class="fas fa-chevron-right"></i>';

        const scrollAmount = () => track.clientWidth * 0.75;

        leftArr.addEventListener('click', () => {
            track.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
        });

        rightArr.addEventListener('click', () => {
            track.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
        });

        const updateArrows = () => {
            const atStart = track.scrollLeft <= 4;
            const atEnd   = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
            leftArr.classList.toggle('is-hidden', atStart);
            rightArr.classList.toggle('is-hidden', atEnd);
        };

        track.addEventListener('scroll', updateArrows, { passive: true });
        updateArrows();

        wrapper.appendChild(leftArr);
        wrapper.appendChild(rightArr);
    }

    // ── Preview Modal ──────────────────────────────────────────
    _createPreviewModal() {
        this.previewOverlay = createElement('div', { className: 'preview-overlay' });

        const backdrop = createElement('div', {
            className: 'preview-backdrop',
            onClick: () => this._closePreview()
        });
        this.previewOverlay.appendChild(backdrop);

        const panel = createElement('div', {
            className: 'preview-panel',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'preview-dialog-title'
        });

        const closeBtn = createElement('button', {
            className: 'preview-close',
            'aria-label': 'Close',
            onClick: () => this._closePreview()
        });
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        panel.appendChild(closeBtn);

        panel.appendChild(createElement('div', { className: 'preview-body' }));
        this.previewOverlay.appendChild(panel);

        document.body.appendChild(this.previewOverlay);

        this._keydownHandler = (e) => {
            if (e.key === 'Escape') this._closePreview();
        };
        document.addEventListener('keydown', this._keydownHandler);
    }

    async _showPreview(item) {
        if (!this.previewOverlay) return;

        const body = this.previewOverlay.querySelector('.preview-body');

        // Skeleton loading — show what we already know instantly
        body.innerHTML = '';
        const skelWrap = createElement('div', { className: 'preview-skeleton' });

        // Hero with poster (already available)
        if (item.poster) {
            const heroSkel = createElement('div', { className: 'preview-hero' });
            const img = createElement('img', { className: 'preview-hero-img', src: item.poster, alt: item.title || '' });
            heroSkel.appendChild(img);
            skelWrap.appendChild(heroSkel);
        }

        const infoSkel = createElement('div', { className: 'preview-info' });

        // Title (already available)
        if (item.title) {
            const title = createElement('h3', { className: 'preview-title' }, item.title);
            infoSkel.appendChild(title);
        }

        // Skeleton lines for meta/description/tags
        const skelLines = createElement('div', { className: 'preview-skeleton-lines' });
        for (let i = 0; i < 4; i++) {
            const line = createElement('div', { className: 'skeleton-line' });
            if (i === 3) line.classList.add('skeleton-line-short');
            skelLines.appendChild(line);
        }
        infoSkel.appendChild(skelLines);
        skelWrap.appendChild(infoSkel);
        body.appendChild(skelWrap);

        this.previewOverlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        this._prevFocusEl = document.activeElement;
        const closeBtn = this.previewOverlay.querySelector('.preview-close');
        if (closeBtn) closeBtn.focus();

        try {
            const apiUrl = `${this._apiBase}/api/v1/load_item?plugin=${encodeURIComponent(this.plugin.name)}&encoded_url=${item.url}`;
            const data   = await fetchJSON(apiUrl);
            const content = data?.result || data || {};

            this._renderPreviewContent(body, content, item);
        } catch (err) {
            BuddyLogger.error('📋', 'CONTENT-BROWSER', 'Preview error', { Error: err?.message || err });
            body.innerHTML = `<div class="preview-error"><p>${t('error_generic')}</p></div>`;
        }
    }

    _renderPreviewContent(body, content, originalItem) {
        body.innerHTML = '';
        body.classList.add('preview-body');

        const poster = content.poster || originalItem.poster;
        const mainRow = createElement('div', { className: 'preview-main-row' });
        if (poster) {
            const heroDiv = createElement('div', { className: 'preview-hero' });
            const img = createElement('img', {
                className: 'preview-hero-img',
                src: poster,
                alt: content.title || originalItem.title || ''
            });
            img.onerror = () => { heroDiv.style.display = 'none'; };
            heroDiv.appendChild(img);
            mainRow.appendChild(heroDiv);
        }

        const info = createElement('div', { className: 'preview-info' });

        const title = content.title || originalItem.title || '';
        info.appendChild(createElement('h2', { className: 'preview-title', id: 'preview-dialog-title' }, title));

        const metaParts = [];
        if (content.year)     metaParts.push(`<span class="preview-meta-item"><i class="fas fa-calendar"></i> ${escapeHtml(String(content.year))}</span>`);
        if (content.rating)   metaParts.push(`<span class="preview-meta-item"><i class="fas fa-star"></i> ${escapeHtml(String(content.rating))}</span>`);
        if (content.duration) metaParts.push(`<span class="preview-meta-item"><i class="fas fa-clock"></i> ${escapeHtml(String(content.duration))}</span>`);

        if (metaParts.length) {
            const meta = createElement('div', { className: 'preview-meta' });
            meta.innerHTML = metaParts.join('');
            info.appendChild(meta);
        }

        if (content.description) {
            info.appendChild(createElement('p', { className: 'preview-desc' }, content.description));
        }

        const tags = Array.isArray(content.tags) ? content.tags : (typeof content.tags === 'string' && content.tags ? content.tags.split(',').map(t => t.trim()) : []);
        if (tags.length) {
            const tagsDiv = createElement('div', { className: 'preview-tags' });
            tags.forEach(tag => {
                tagsDiv.appendChild(createElement('span', { className: 'badge badge-outline' }, tag));
            });
            info.appendChild(tagsDiv);
        }

        const actors = Array.isArray(content.actors) ? content.actors : (typeof content.actors === 'string' && content.actors ? content.actors.split(',').map(a => a.trim()) : []);
        if (actors.length) {
            const actorsDiv = createElement('div', { className: 'preview-actors' });
            const label = createElement('span', { className: 'preview-actors-label' });
            label.textContent = t('actors_label') + ': ';
            actorsDiv.appendChild(label);
            actorsDiv.appendChild(document.createTextNode(actors.join(', ')));
            info.appendChild(actorsDiv);
        }

        const actions = createElement('div', { className: 'preview-actions' });

        // Only show watch button for movies (no episodes)
        const hasEpisodes = Array.isArray(content.episodes) && content.episodes.length > 0;
        if (hasEpisodes) {
            const browseLink = createElement('a', {
                className: 'button button-primary',
                href: `/icerik/${encodeURIComponent(this.plugin.name)}?url=${originalItem.url}${this.providerQueryAmp}`
            });
            browseLink.innerHTML = `<i class="fas fa-list"></i> ${t('browse_episodes')}`;
            actions.appendChild(browseLink);
        } else if (content.url || originalItem.url) {
            const watchUrl  = content.url || originalItem.url;
            const poster    = content.poster || originalItem.poster || '';
            const title     = content.title || originalItem.title || '';
            const metaParts = [
                `url=${watchUrl}`,
                `baslik=${encodeURIComponent(title)}`,
                `content_url=${originalItem.url}`,
                poster ? `poster_url=${encodeURIComponent(poster)}` : '',
                `year=${encodeURIComponent(content.year || '')}`,
                `rating=${encodeURIComponent(content.rating || '')}`,
            ].filter(Boolean).join('&');
            const watchLink = createElement('a', {
                className: 'button button-primary',
                href: `/izle/${encodeURIComponent(this.plugin.name)}?${metaParts}${this.providerQueryAmp}`
            });
            watchLink.innerHTML = `<i class="fas fa-play"></i> ${t('watch_now')}`;
            actions.appendChild(watchLink);
        }

        if (!hasEpisodes) {
            const detailLink = createElement('a', {
                className: 'button button-secondary',
                href: `/icerik/${encodeURIComponent(this.plugin.name)}?url=${originalItem.url}${this.providerQueryAmp}`
            });
            detailLink.innerHTML = `<i class="fas fa-info-circle"></i> ${t('details_button')}`;
            actions.appendChild(detailLink);
        }

        info.appendChild(actions);
        mainRow.appendChild(info);
        body.appendChild(mainRow);

        // ── Benzer İçerikler ──────────────────────────────────────────
        const similarSection = createElement('section', { className: 'similar-section' });
        body.appendChild(similarSection);
        renderSimilarContent(similarSection, {
            apiBase          : this._apiBase,
            plugin           : this.plugin.name,
            queryTitle       : content.title || originalItem.title || '',
            tags             : content.tags  || '',
            currentUrl       : originalItem.url || '',
            providerQueryAmp : this.providerQueryAmp,
        });
    }

    _closePreview() {
        if (!this.previewOverlay) return;
        this.previewOverlay.classList.remove('is-open');
        document.body.style.overflow = '';
        if (this._prevFocusEl) {
            this._prevFocusEl.focus();
            this._prevFocusEl = null;
        }
    }

    destroy() {
        if (this._heroTimer) { clearInterval(this._heroTimer); this._heroTimer = null; }
        if (this._observer)  { this._observer.disconnect();     this._observer  = null; }
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler);
            this._keydownHandler = null;
        }
        if (this.previewOverlay) {
            this.previewOverlay.remove();
            this.previewOverlay = null;
        }
    }
}

// ── Auto-init ──────────────────────────────────────────────────
ready(() => {
    const el = document.getElementById('plugin-data');
    if (!el) return;
    try {
        const data = JSON.parse(el.textContent);
        new ContentBrowser().init(data);
    } catch (e) {
        BuddyLogger.error('📋', 'CONTENT-BROWSER', 'Init error', { Error: e?.message || e });
    }
});
