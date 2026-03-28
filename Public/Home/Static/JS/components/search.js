// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import { $, $$, escapeHtml, scrollTo, addClass, removeClass, t } from '../utils/dom.min.js';
import { AbortableFetch } from '../utils/fetch.min.js';
const PLUGIN_PREFERENCES_STORAGE_KEY = 'wb_stream_disabled_plugins_v1';

class GlobalSearch {
    constructor() {
        this.searchInput        = $('#global-search-input');
        this.searchButton       = $('#global-search-button');
        this.searchStatus       = $('#search-status');
        this.searchResults      = $('#search-results');
        this.resultsGrid        = $('#results-grid');
        this.searchQueryDisplay = $('#search-query-display');
        this.clearSearchButton  = $('#clear-search');
        this.pluginsList        = $('#plugins-list');
        this.pluginsGrid        = $('#plugins-list .grid');
        this.pluginFilters      = $('#plugin-filters');
        this.filtersContainer   = $('#filters-container');
        this.clearFiltersButton = $('#clear-filters');

        this.currentSearch = null;
        this.fetchHelper   = new AbortableFetch();
        this.allPlugins    = this.loadPluginsData();
        this.providerUrl   = this.getProviderUrl();
        this.pluginPreferenceScope      = this.providerUrl || window.location.origin || 'local';
        this.pluginPreferenceStorageKey  = `${PLUGIN_PREFERENCES_STORAGE_KEY}:${this.pluginPreferenceScope}`;
        this.disabledPlugins = this.loadDisabledPlugins();
        this.plugins = [];

        // Filter state
        this.searchResultsByPlugin = new Map();
        this.activeFilters  = new Set();
        this.pendingPlugins = new Set();
    }

    loadPluginsData() {
        try {
            const el = document.getElementById('plugins-data');
            if (!el) return [];
            const parsed = JSON.parse(el.textContent);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    getProviderUrl() {
        const urlParams   = new URLSearchParams(window.location.search);
        const urlProvider = urlParams.get('provider');
        if (urlProvider) return urlProvider;

        for (const cookie of document.cookie.split(';')) {
            const idx  = cookie.indexOf('=');
            if (idx < 0) continue;
            const name = cookie.slice(0, idx).trim();
            let   val  = cookie.slice(idx + 1).trim();
            if (name === 'provider_url') {
                if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                return decodeURIComponent(val);
            }
        }
        return null;
    }

    init() {
        if (!this.searchInput) return;

        this.syncPlugins();

        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });

        this.searchButton.addEventListener('click', () => this.performSearch());
        this.clearSearchButton.addEventListener('click', () => this.clearSearch());

        if (this.clearFiltersButton) {
            this.clearFiltersButton.addEventListener('click', () => this.clearFilters());
        }
    }

    // ──────────────────── Plugin Preferences ────────────────────

    loadDisabledPlugins() {
        try {
            const raw    = localStorage.getItem(this.pluginPreferenceStorageKey);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return new Set();
            return new Set(parsed.map((v) => String(v || '').trim()).filter(Boolean));
        } catch (_) {
            return new Set();
        }
    }

    isPluginEnabled(name = '') {
        return !this.disabledPlugins.has(String(name || '').trim());
    }

    getEnabledPlugins() {
        return this.allPlugins.filter((p) => this.isPluginEnabled(p.name));
    }

    syncPlugins() {
        this.disabledPlugins = this.loadDisabledPlugins();
        this.plugins = this.getEnabledPlugins();
        this.syncPluginCardVisibility();
    }

    syncPluginCardVisibility() {
        const cards = $$('#plugins-list .card[data-plugin-name]');
        let visible = 0;

        cards.forEach((card) => {
            const name    = card.dataset.pluginName || '';
            const enabled = this.isPluginEnabled(name);
            card.classList.toggle('is-plugin-hidden', !enabled);
            card.setAttribute('aria-hidden', String(!enabled));
            if (enabled) visible += 1;
        });

        if (!this.pluginsGrid) return;

        let empty = this.pluginsGrid.querySelector('.plugin-grid-empty');
        if (visible === 0) {
            if (!empty) {
                empty = document.createElement('div');
                empty.className = 'empty-state plugin-grid-empty';
                this.pluginsGrid.appendChild(empty);
            }
            empty.innerHTML = `
                <i class="fas fa-plug-circle-xmark" aria-hidden="true"></i>
                <h3>${t('plugin_no_enabled_title')}</h3>
                <p>${t('plugin_no_enabled_message')}</p>
            `;
        } else if (empty) {
            empty.remove();
        }
    }

    // ──────────────────── Search ────────────────────

    async performSearch() {
        this.syncPlugins();

        const query = this.searchInput.value.trim();
        if (!query || query.length < 2) {
            this.showStatus(t('search_min_chars', { count: 2 }), 'error');
            return;
        }

        this.fetchHelper.abort();
        this.currentSearch = query;

        // Reset filter state
        this.searchResultsByPlugin.clear();
        this.activeFilters.clear();
        this.pendingPlugins.clear();

        // UI setup
        this.searchQueryDisplay.textContent = `"${query}"`;
        this.searchResults.classList.remove('is-hidden');
        this.pluginsList.classList.add('is-hidden');
        this.resultsGrid.innerHTML = '';
        this.pluginFilters.classList.add('is-hidden');
        this.filtersContainer.innerHTML = '';

        scrollTo(this.searchResults);

        let completedSearches = 0;
        let totalResults      = 0;

        this.showStatus(t('searching_plugins', { count: this.plugins.length }), 'searching');

        if (!this.plugins.length) {
            this.resultsGrid.innerHTML = `
                <div class="no-results no-results-wide">
                    <i class="fas fa-plug-circle-xmark"></i>
                    <h3>${t('plugin_no_enabled_title')}</h3>
                    <p>${t('plugin_no_enabled_message')}</p>
                </div>
            `;
            this.showStatus(t('plugin_no_enabled_status'), 'error');
            return;
        }

        this.plugins.forEach(p => this.pendingPlugins.add(p.name));
        this.renderRankedResults(query, { showPending: true });

        const searchPromises = this.plugins.map(plugin =>
            this.searchInPlugin(plugin.name, query, this.fetchHelper, { abortPrevious: false })
                .then(results => {
                    completedSearches++;

                    if (results && results.length > 0) {
                        const ranked = this.sortResultsByRelevance(results, query);
                        totalResults += ranked.length;
                        this.searchResultsByPlugin.set(plugin.name, ranked);
                    } else {
                        this.searchResultsByPlugin.delete(plugin.name);
                    }

                    this.pendingPlugins.delete(plugin.name);
                    this.renderRankedResults(query, { showPending: completedSearches < this.plugins.length });
                    this.updateSearchStatus(completedSearches, this.plugins.length, totalResults);
                })
                .catch(error => {
                    if (error.name !== 'AbortError') {
                        console.error(`Error searching in ${plugin.name}:`, error);
                    }
                    completedSearches++;
                    this.searchResultsByPlugin.delete(plugin.name);
                    this.pendingPlugins.delete(plugin.name);
                    this.renderRankedResults(query, { showPending: completedSearches < this.plugins.length });
                    this.updateSearchStatus(completedSearches, this.plugins.length, totalResults);
                })
        );

        await Promise.all(searchPromises);

        if (this.currentSearch === query && totalResults > 0) {
            this.renderFilters();
            this.applyFilters(query);
        }
    }

    async searchInPlugin(pluginName, query, fetchHelper = null, fetchConfig = {}) {
        try {
            let url;
            const providerUrl = this.getProviderUrl();
            if (providerUrl) {
                const base = providerUrl.endsWith('/') ? providerUrl.slice(0, -1) : providerUrl;
                url = `${base}/api/v1/search?plugin=${encodeURIComponent(pluginName)}&query=${encodeURIComponent(query)}`;
            } else {
                url = `/api/v1/search?plugin=${encodeURIComponent(pluginName)}&query=${encodeURIComponent(query)}`;
            }

            const helper   = fetchHelper || this.fetchHelper;
            const response = await helper.fetch(url, {}, fetchConfig);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            return data.result || [];
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            console.warn(`Failed to search in ${pluginName}:`, error.message);
            return [];
        }
    }

    // ──────────────────── Relevance Scoring ────────────────────

    normalizeText(value) {
        if (!value) return '';
        return String(value)
            .toLocaleLowerCase('tr')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[ıİ]/g, 'i')
            .replace(/[şŞ]/g, 's')
            .replace(/[ğĞ]/g, 'g')
            .replace(/[üÜ]/g, 'u')
            .replace(/[öÖ]/g, 'o')
            .replace(/[çÇ]/g, 'c')
            .replace(/\s+/g, ' ')
            .trim();
    }

    tokenize(value) {
        if (!value) return [];
        return this.normalizeText(value).split(/[^a-z0-9]+/).filter(Boolean);
    }

    calculateRelevanceScore(title, query) {
        const ti = this.normalizeText(title);
        const q  = this.normalizeText(query);

        if (!ti || !q) return 0;
        if (ti === q) return 1000;

        let score = 0;

        if (ti.startsWith(q)) {
            score = Math.max(score, 850 - Math.min(200, ti.length - q.length));
        }

        const idx = ti.indexOf(q);
        if (idx !== -1) {
            score = Math.max(
                score,
                700 - Math.min(250, idx * 4) - Math.min(100, Math.max(0, ti.length - q.length))
            );
        }

        const qTokens = this.tokenize(q);
        const tTokens = this.tokenize(ti);
        if (qTokens.length > 0 && tTokens.length > 0) {
            let common = 0;
            qTokens.forEach((tok) => { if (tTokens.includes(tok)) common++; });

            let tokenScore = Math.floor((common / qTokens.length) * 520);
            if (ti.startsWith(qTokens[0])) tokenScore += 80;
            score = Math.max(score, tokenScore);
        }

        return score;
    }

    sortResultsByRelevance(results, query) {
        if (!Array.isArray(results)) return [];

        return [...results].sort((a, b) => {
            const sa = this.calculateRelevanceScore(a?.title || '', query);
            const sb = this.calculateRelevanceScore(b?.title || '', query);
            if (sa !== sb) return sb - sa;

            const ta = this.normalizeText(a?.title || '');
            const tb = this.normalizeText(b?.title || '');
            return ta.localeCompare(tb);
        });
    }

    // ──────────────────── Result Rendering ────────────────────

    buildRankedRows(query = this.currentSearch || '') {
        const rows = [];
        let order  = 0;

        this.searchResultsByPlugin.forEach((results, pluginName) => {
            const visible = this.activeFilters.size === 0 || this.activeFilters.has(pluginName);
            if (visible) {
                results.forEach((result, i) => {
                    rows.push({
                        pluginName,
                        result,
                        pluginOrder: order,
                        resultIndex: i,
                        score: this.calculateRelevanceScore(result?.title || '', query),
                    });
                });
            }
            order++;
        });

        rows.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;

            const ta = this.normalizeText(a.result?.title || '');
            const tb = this.normalizeText(b.result?.title || '');
            const cmp = ta.localeCompare(tb);
            if (cmp !== 0) return cmp;

            if (a.pluginOrder !== b.pluginOrder) return a.pluginOrder - b.pluginOrder;
            return a.resultIndex - b.resultIndex;
        });

        return rows;
    }

    renderRankedResults(query = this.currentSearch || '', options = {}) {
        const { showPending = false } = options;
        this.resultsGrid.innerHTML = '';

        const rows = this.buildRankedRows(query);
        rows.forEach(({ pluginName, result }) => {
            this.resultsGrid.appendChild(this.createResultCard(pluginName, result));
        });

        if (!showPending || this.pendingPlugins.size === 0) return;

        this.pendingPlugins.forEach((pluginName) => {
            if (this.activeFilters.size > 0 && !this.activeFilters.has(pluginName)) return;
            this.addLoadingCard(pluginName);
        });
    }

    addLoadingCard(pluginName) {
        const card = document.createElement('div');
        card.className = 'loading-card';
        card.id = `loading-${pluginName}`;
        card.innerHTML = `
            <div class="wp-spinner"></div>
            <p class="loading-card-title">${escapeHtml(pluginName)}</p>
            <span class="loading-card-meta">${escapeHtml(t('connected'))}</span>
        `;
        this.resultsGrid.appendChild(card);
    }

    createResultCard(pluginName, result) {
        const card = document.createElement('a');
        const providerParam = this.getProviderUrl() ? `&provider=${encodeURIComponent(this.getProviderUrl())}` : '';
        card.href = `/icerik/${encodeURIComponent(pluginName)}?url=${result.url}${providerParam}`;
        card.className = 'card';

        const meta = [];
        if (result.year)     meta.push(String(result.year));
        if (result.rating)   meta.push(`IMDB ${result.rating}`);
        if (result.duration) meta.push(String(result.duration));

        let html = `<div class="plugin-badge">${escapeHtml(pluginName)}</div>`;

        if (result.poster) {
            html += `<img src="${escapeHtml(result.poster)}" alt="${escapeHtml(result.title)}" class="card-image" loading="lazy" decoding="async" fetchpriority="low" referrerpolicy="no-referrer" onerror="var d=document.createElement('div');d.className='card-no-poster';this.parentNode.replaceChild(d,this)">`;
        } else {
            html += `<div class="card-no-poster"></div>`;
        }

        html += `<div class="card-content">`;
        html += `<h3 class="card-title">${escapeHtml(result.title)}</h3>`;
        if (meta.length > 0) {
            html += `<p class="card-meta-line">${escapeHtml(meta.join(' • '))}</p>`;
        }
        html += `</div>`;

        card.innerHTML = html;
        return card;
    }

    // ──────────────────── Status ────────────────────

    showStatus(message, type = '') {
        this.searchStatus.textContent = message;
        this.searchStatus.className = 'search-status';

        if (type) {
            addClass(this.searchStatus, type);
            if (type === 'searching') {
                const spinner = document.createElement('div');
                spinner.className = 'wp-spinner wp-spinner-sm';
                this.searchStatus.prepend(spinner);
            }
        }
    }

    updateSearchStatus(completed, total, resultsCount) {
        if (completed === total) {
            if (resultsCount === 0) {
                this.showNoResults();
            } else {
                this.showStatus(t('search_results_count', { count: resultsCount }), 'success');
            }
        } else {
            this.showStatus(t('search_progress', { done: completed, total, count: resultsCount }), 'searching');
        }
    }

    showNoResults() {
        this.resultsGrid.innerHTML = `
            <div class="no-results no-results-wide">
                <i class="fas fa-search"></i>
                <h3>${t('search_no_results_title')}</h3>
                <p>${t('search_no_results_message')}</p>
            </div>
        `;
        this.showStatus(t('search_no_results_status'), 'error');
    }

    clearSearch() {
        this.searchInput.value = '';
        this.searchResults.classList.add('is-hidden');
        this.pluginsList.classList.remove('is-hidden');
        this.resultsGrid.innerHTML = '';
        this.showStatus('');

        this.searchResultsByPlugin.clear();
        this.activeFilters.clear();
        this.pendingPlugins.clear();
        this.pluginFilters.classList.add('is-hidden');
        this.filtersContainer.innerHTML = '';

        this.fetchHelper.abort();
    }

    // ──────────────────── Filters ────────────────────

    renderFilters() {
        if (this.searchResultsByPlugin.size === 0) {
            this.pluginFilters.classList.add('is-hidden');
            return;
        }

        this.filtersContainer.innerHTML = '';

        this.searchResultsByPlugin.forEach((results, pluginName) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'filter-button';
            btn.dataset.plugin = pluginName;
            btn.setAttribute('aria-pressed', 'false');
            btn.setAttribute('aria-label', t('filter_aria_label', { plugin: pluginName, count: results.length }));

            btn.innerHTML = `
                <span>${escapeHtml(pluginName)}</span>
                <span class="filter-count">${results.length}</span>
            `;

            btn.addEventListener('click', () => this.toggleFilter(pluginName));
            this.filtersContainer.appendChild(btn);
        });

        this.pluginFilters.classList.remove('is-hidden');
    }

    toggleFilter(pluginName) {
        if (this.activeFilters.has(pluginName)) {
            this.activeFilters.delete(pluginName);
        } else {
            this.activeFilters.add(pluginName);
        }

        this.updateFilterButtons();
        this.applyFilters();
    }

    clearFilters() {
        this.activeFilters.clear();
        this.updateFilterButtons();
        this.applyFilters();
    }

    updateFilterButtons() {
        const buttons = $$('.filter-button', this.filtersContainer);
        buttons.forEach(btn => {
            const name = btn.dataset.plugin;
            if (this.activeFilters.has(name)) {
                addClass(btn, 'active');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                removeClass(btn, 'active');
                btn.setAttribute('aria-pressed', 'false');
            }
        });
    }

    applyFilters(query = this.currentSearch || '') {
        this.renderRankedResults(query, { showPending: this.pendingPlugins.size > 0 });

        const visibleResults = this.buildRankedRows(query).length;
        const totalResults   = Array.from(this.searchResultsByPlugin.values())
            .reduce((sum, r) => sum + r.length, 0);

        if (this.activeFilters.size > 0) {
            this.showStatus(
                t('filter_results_status', { visible: visibleResults, total: totalResults, filters: this.activeFilters.size }),
                'success'
            );
        } else {
            this.showStatus(t('search_results_count', { count: totalResults }), 'success');
        }
    }
}

export function initGlobalSearch() {
    const search = new GlobalSearch();
    search.init();
    return search;
}

export { GlobalSearch };
