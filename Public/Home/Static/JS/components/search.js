// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import { $, $$, escapeHtml, scrollTo, addClass, removeClass } from '../utils/dom.min.js';
import { AbortableFetch } from '../utils/fetch.min.js';

const t = (key, vars = {}) => (window.t ? window.t(key, vars) : key);
const PLUGIN_PREFERENCES_STORAGE_KEY = 'wb_stream_disabled_plugins_v1';

export class GlobalSearch {
    constructor() {
        this.searchInput = $('#global-search-input');
        this.searchButton = $('#global-search-button');
        this.searchStatus = $('#search-status');
        this.searchResults = $('#search-results');
        this.resultsGrid = $('#results-grid');
        this.searchQueryDisplay = $('#search-query-display');
        this.clearSearchButton = $('#clear-search');
        this.pluginsList = $('#plugins-list');
        this.pluginsGrid = $('#plugins-list .grid');
        this.pluginFilters = $('#plugin-filters');
        this.filtersContainer = $('#filters-container');
        this.clearFiltersButton = $('#clear-filters');
        this.pluginPreferencesPanel = $('#plugin-preferences-panel');
        this.pluginPreferencesSummary = $('#plugin-preferences-summary');
        this.pluginPreferencesFilters = $('#plugin-preferences-filters');
        this.pluginPreferencesList = $('#plugin-preferences-list');

        this.currentSearch = null;
        this.fetchHelper = new AbortableFetch();
        this.allPlugins = Array.isArray(window.availablePlugins) ? [...window.availablePlugins] : [];
        this.providerUrl = this.getProviderUrl();
        this.pluginPreferenceScope = this.getPluginPreferenceScope();
        this.pluginPreferenceStorageKey = `${PLUGIN_PREFERENCES_STORAGE_KEY}:${this.pluginPreferenceScope}`;
        this.disabledPlugins = this.loadDisabledPlugins();
        this.activePluginLanguageFilter = 'ALL';
        this.plugins = [];

        // Filter state
        this.searchResultsByPlugin = new Map(); // { pluginName: [results] }
        this.activeFilters = new Set();
        this.pendingPlugins = new Set();

    }

    getProviderUrl() {
        // Check URL parameter first
        const urlParams = new URLSearchParams(window.location.search);
        const urlProvider = urlParams.get('provider');
        if (urlProvider) return urlProvider;

        // Fall back to cookie
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'provider_url') {
                return decodeURIComponent(value);
            }
        }
        return null;
    }

    init() {
        if (!this.searchInput) return;

        this.syncPluginPreferences();

        // Event listeners
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        this.searchButton.addEventListener('click', () => this.performSearch());
        this.clearSearchButton.addEventListener('click', () => this.clearSearch());

        if (this.clearFiltersButton) {
            this.clearFiltersButton.addEventListener('click', () => this.clearFilters());
        }

        this.pluginPreferencesList?.addEventListener('click', (event) => {
            const button = event.target.closest('.js-plugin-preference-toggle');
            if (!button) return;

            const pluginName = button.dataset.pluginName || '';
            this.togglePluginPreference(pluginName);
        });

        this.pluginPreferencesFilters?.addEventListener('click', (event) => {
            const button = event.target.closest('.js-plugin-language-filter');
            if (button) {
                this.activePluginLanguageFilter = button.dataset.languageFilter || 'ALL';
                this.renderPluginPreferences();
                return;
            }

            const showButton = event.target.closest('.js-plugin-show-visible');
            if (showButton && !showButton.disabled) {
                this.showVisiblePlugins();
                return;
            }

            const bulkButton = event.target.closest('.js-plugin-hide-visible');
            if (!bulkButton || bulkButton.disabled) return;

            this.hideVisiblePlugins();
        });
    }

    getPluginPreferenceScope() {
        return this.providerUrl || window.location.origin || 'local';
    }

    loadDisabledPlugins() {
        try {
            const raw = localStorage.getItem(this.pluginPreferenceStorageKey);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return new Set();
            return new Set(parsed.map((value) => String(value || '').trim()).filter(Boolean));
        } catch (_) {
            return new Set();
        }
    }

    saveDisabledPlugins() {
        try {
            localStorage.setItem(this.pluginPreferenceStorageKey, JSON.stringify([...this.disabledPlugins]));
        } catch (_) {
            // storage hatasi sessiz gecilir
        }
    }

    isPluginEnabled(pluginName = '') {
        return !this.disabledPlugins.has(String(pluginName || '').trim());
    }

    getEnabledPlugins() {
        return this.allPlugins.filter((plugin) => this.isPluginEnabled(plugin.name));
    }

    getPluginLanguageKey(plugin = {}) {
        return String(plugin.language || '').trim().toUpperCase() || 'OTHER';
    }

    getPluginLanguageLabel(languageKey = 'ALL') {
        if (languageKey === 'ALL') return t('plugin_language_filter_all');
        if (['TR', 'EN', 'FR', 'RU', 'UK'].includes(languageKey)) return languageKey;
        return languageKey;
    }

    syncPluginPreferences() {
        this.plugins = this.getEnabledPlugins();
        window.availablePlugins = [...this.plugins];
        this.renderPluginPreferences();
        this.syncPluginCardVisibility();
    }

    getVisiblePreferencePlugins() {
        return this.allPlugins.filter((plugin) => (
            this.activePluginLanguageFilter === 'ALL'
                || this.getPluginLanguageKey(plugin) === this.activePluginLanguageFilter
        ));
    }

    syncPluginCardVisibility() {
        const cards = $$('#plugins-list .card[data-plugin-name]');
        let visibleCount = 0;

        cards.forEach((card) => {
            const pluginName = card.dataset.pluginName || '';
            const isEnabled = this.isPluginEnabled(pluginName);
            card.classList.toggle('is-plugin-hidden', !isEnabled);
            card.setAttribute('aria-hidden', String(!isEnabled));
            if (isEnabled) visibleCount += 1;
        });

        if (!this.pluginsGrid) return;

        let emptyState = this.pluginsGrid.querySelector('.plugin-grid-empty');
        if (visibleCount === 0) {
            if (!emptyState) {
                emptyState = document.createElement('div');
                emptyState.className = 'empty-state plugin-grid-empty';
                this.pluginsGrid.appendChild(emptyState);
            }
            emptyState.innerHTML = `
                <i class="fas fa-plug-circle-xmark" aria-hidden="true"></i>
                <h3>${t('plugin_no_enabled_title')}</h3>
                <p>${t('plugin_no_enabled_message')}</p>
            `;
        } else if (emptyState) {
            emptyState.remove();
        }
    }

    renderPluginPreferences() {
        if (!this.pluginPreferencesPanel || !this.pluginPreferencesList || !this.pluginPreferencesSummary) return;

        if (!this.allPlugins.length) {
            this.pluginPreferencesPanel.classList.add('is-hidden');
            return;
        }

        this.pluginPreferencesPanel.classList.remove('is-hidden');

        const enabledCount = this.plugins.length;
        const hiddenCount = this.allPlugins.length - enabledCount;
        this.pluginPreferencesSummary.textContent = t('plugin_preferences_summary', {
            active: enabledCount,
            hidden: hiddenCount
        });

        const languageKeys = [...new Set(this.allPlugins.map((plugin) => this.getPluginLanguageKey(plugin)))].sort();
        const filters = ['ALL', ...languageKeys];
        if (!filters.includes(this.activePluginLanguageFilter)) {
            this.activePluginLanguageFilter = 'ALL';
        }

        const visiblePlugins = this.getVisiblePreferencePlugins();
        const visibleEnabledCount = visiblePlugins.filter((plugin) => this.isPluginEnabled(plugin.name)).length;
        const visibleHiddenCount = visiblePlugins.length - visibleEnabledCount;
        const disableVisibleBlocked = visibleEnabledCount === 0 || visibleEnabledCount >= enabledCount;
        const showVisibleBlocked = visibleHiddenCount === 0;

        if (this.pluginPreferencesFilters) {
            this.pluginPreferencesFilters.innerHTML = `
                <div class="plugin-language-filter-strip">
                    <span class="plugin-language-filter-label">${escapeHtml(t('plugin_language_filter_label'))}</span>
                    <div class="plugin-language-filter-row">
                        ${filters.map((languageKey) => `
                            <button
                                type="button"
                                class="plugin-language-filter js-plugin-language-filter ${this.activePluginLanguageFilter === languageKey ? 'active' : ''}"
                                data-language-filter="${escapeHtml(languageKey)}">
                                ${escapeHtml(this.getPluginLanguageLabel(languageKey))}
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="plugin-language-bulk-actions">
                    <button
                        type="button"
                        class="button button-secondary button-small plugin-language-bulk-action js-plugin-show-visible"
                        ${showVisibleBlocked ? 'disabled' : ''}>
                        <i class="fas fa-eye"></i>
                        <span>${escapeHtml(t('plugin_show_visible'))}</span>
                    </button>
                    <button
                        type="button"
                        class="button button-secondary button-small plugin-language-bulk-action js-plugin-hide-visible"
                        ${disableVisibleBlocked ? 'disabled' : ''}>
                        <i class="fas fa-eye-slash"></i>
                        <span>${escapeHtml(t('plugin_hide_visible'))}</span>
                    </button>
                </div>
            `;
        }

        if (!visiblePlugins.length) {
            this.pluginPreferencesList.innerHTML = `<div class="empty-state">${escapeHtml(t('plugin_preferences_filtered_empty'))}</div>`;
            return;
        }

        this.pluginPreferencesList.innerHTML = visiblePlugins.map((plugin) => {
            const isEnabled = this.isPluginEnabled(plugin.name);
            const language = this.getPluginLanguageKey(plugin);
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(plugin.name)}&background=1f1d1a&color=ef7f1a`;

            return `
                <article class="plugin-preference-item ${isEnabled ? 'is-enabled' : 'is-disabled'}">
                    <div class="plugin-preference-main">
                        <span class="plugin-preference-icon">
                            ${plugin.favicon
                                ? `<img src="${escapeHtml(plugin.favicon)}" alt="${escapeHtml(plugin.name)}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackAvatar}'">`
                                : `<img src="${fallbackAvatar}" alt="${escapeHtml(plugin.name)}" loading="lazy">`}
                        </span>
                        <span class="plugin-preference-copy">
                            <strong>${escapeHtml(plugin.name)}</strong>
                            <span class="plugin-preference-meta">
                                <span class="plugin-meta-pill">
                                    <i class="fas fa-language" aria-hidden="true"></i>
                                    <span>${escapeHtml(this.getPluginLanguageLabel(language))}</span>
                                </span>
                                ${isEnabled ? '' : `
                                    <span class="plugin-preference-state is-hidden">
                                        ${escapeHtml(t('plugin_state_hidden'))}
                                    </span>
                                `}
                            </span>
                        </span>
                    </div>
                    <button
                        type="button"
                        class="button button-secondary button-small plugin-preference-toggle js-plugin-preference-toggle ${isEnabled ? '' : 'is-reveal'}"
                        data-plugin-name="${escapeHtml(plugin.name)}"
                        aria-pressed="${String(!isEnabled)}">
                        <i class="fas ${isEnabled ? 'fa-eye-slash' : 'fa-eye'}"></i>
                        <span>${escapeHtml(isEnabled ? t('plugin_hide') : t('plugin_show'))}</span>
                    </button>
                </article>
            `;
        }).join('');
    }

    togglePluginPreference(pluginName) {
        const normalizedName = String(pluginName || '').trim();
        if (!normalizedName) return;

        const currentlyEnabled = this.isPluginEnabled(normalizedName);
        const enabledCount = this.getEnabledPlugins().length;
        if (currentlyEnabled && enabledCount <= 1) {
            this.showStatus(t('plugin_keep_one_enabled'), 'error');
            return;
        }

        if (currentlyEnabled) {
            this.disabledPlugins.add(normalizedName);
        } else {
            this.disabledPlugins.delete(normalizedName);
        }

        this.saveDisabledPlugins();
        this.syncPluginPreferences();

        if (!this.currentSearch) return;
        if (this.searchResults.classList.contains('is-hidden')) return;

        this.performSearch();
    }

    hideVisiblePlugins() {
        const visiblePlugins = this.getVisiblePreferencePlugins();
        const visibleEnabled = visiblePlugins.filter((plugin) => this.isPluginEnabled(plugin.name));
        if (!visibleEnabled.length) return;

        const enabledCount = this.getEnabledPlugins().length;
        if (visibleEnabled.length >= enabledCount) {
            this.showStatus(t('plugin_keep_one_enabled'), 'error');
            return;
        }

        visibleEnabled.forEach((plugin) => {
            this.disabledPlugins.add(String(plugin.name || '').trim());
        });

        this.saveDisabledPlugins();
        this.syncPluginPreferences();

        if (!this.currentSearch) return;
        if (this.searchResults.classList.contains('is-hidden')) return;

        this.performSearch();
    }

    showVisiblePlugins() {
        const visiblePlugins = this.getVisiblePreferencePlugins();
        const visibleHidden = visiblePlugins.filter((plugin) => !this.isPluginEnabled(plugin.name));
        if (!visibleHidden.length) return;

        visibleHidden.forEach((plugin) => {
            this.disabledPlugins.delete(String(plugin.name || '').trim());
        });

        this.saveDisabledPlugins();
        this.syncPluginPreferences();

        if (!this.currentSearch) return;
        if (this.searchResults.classList.contains('is-hidden')) return;

        this.performSearch();
    }

    async performSearch() {
        const query = this.searchInput.value.trim();

        if (!query || query.length < 2) {
            this.showStatus(t('search_min_chars', { count: 2 }), 'error');
            return;
        }

        // Abort previous search if any
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

        // Scroll to results
        scrollTo(this.searchResults);

        // Search state
        let completedSearches = 0;
        let totalResults = 0;

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

        // Add loading cards (pending plugins)
        this.plugins.forEach(plugin => this.pendingPlugins.add(plugin.name));
        this.renderRankedResults(query, { showPending: true });

        // Progressive search
        const searchPromises = this.plugins.map(plugin =>
            this.searchInPlugin(plugin.name, query, this.fetchHelper, { abortPrevious: false })
                .then(results => {
                    completedSearches++;

                    if (results && results.length > 0) {
                        const rankedResults = this.sortResultsByRelevance(results, query);
                        totalResults += rankedResults.length;
                        this.searchResultsByPlugin.set(plugin.name, rankedResults);
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

        // Show filters only if this search is still the current one and we have results
        if (this.currentSearch === query && totalResults > 0) {
            this.renderFilters();
            this.applyFilters(query);
        }
    }

    async searchInPlugin(pluginName, query, fetchHelper = null, fetchConfig = {}) {
        try {
            let url;

            // Eğer remote provider varsa, doğrudan ona istek at
            if (this.providerUrl) {
                const baseUrl = this.providerUrl.endsWith('/') ? this.providerUrl.slice(0, -1) : this.providerUrl;
                url = `${baseUrl}/api/v1/search?plugin=${encodeURIComponent(pluginName)}&query=${encodeURIComponent(query)}`;
            } else {
                // Local provider kullan
                url = `/api/v1/search?plugin=${encodeURIComponent(pluginName)}&query=${encodeURIComponent(query)}`;
            }

            const usedHelper = fetchHelper || this.fetchHelper;
            const response = await usedHelper.fetch(url, {}, fetchConfig);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.result || [];
        } catch (error) {
            if (error.name === 'AbortError') {
                throw error;
            }
            console.warn(`Failed to search in ${pluginName}:`, error.message);
            return [];
        }
    }

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
        const t = this.normalizeText(title);
        const q = this.normalizeText(query);

        if (!t || !q) return 0;
        if (t === q) return 1000;

        let score = 0;

        if (t.startsWith(q)) {
            score = Math.max(score, 850 - Math.min(200, t.length - q.length));
        }

        const containsIndex = t.indexOf(q);
        if (containsIndex !== -1) {
            score = Math.max(
                score,
                700 - Math.min(250, containsIndex * 4) - Math.min(100, Math.max(0, t.length - q.length))
            );
        }

        const queryTokens = this.tokenize(q);
        const titleTokens = this.tokenize(t);
        if (queryTokens.length > 0 && titleTokens.length > 0) {
            let common = 0;
            queryTokens.forEach((token) => {
                if (titleTokens.includes(token)) common++;
            });

            let tokenScore = Math.floor((common / queryTokens.length) * 520);
            if (t.startsWith(queryTokens[0])) {
                tokenScore += 80;
            }
            score = Math.max(score, tokenScore);
        }

        return score;
    }

    sortResultsByRelevance(results, query) {
        if (!Array.isArray(results)) return [];

        return [...results].sort((a, b) => {
            const scoreA = this.calculateRelevanceScore(a?.title || '', query);
            const scoreB = this.calculateRelevanceScore(b?.title || '', query);
            if (scoreA !== scoreB) return scoreB - scoreA;

            const titleA = this.normalizeText(a?.title || '');
            const titleB = this.normalizeText(b?.title || '');
            return titleA.localeCompare(titleB);
        });
    }

    addLoadingCard(pluginName) {
        const loadingCard = document.createElement('div');
        loadingCard.className = 'loading-card';
        loadingCard.id = `loading-${pluginName}`;
        loadingCard.innerHTML = `
            <div class="wp-spinner"></div>
            <p class="loading-card-title">${escapeHtml(pluginName)}</p>
            <span class="loading-card-meta">${escapeHtml(t('connected'))}</span>
        `;
        this.resultsGrid.appendChild(loadingCard);
    }

    buildRankedRows(query = this.currentSearch || '') {
        const rankedRows = [];
        let pluginOrder = 0;

        this.searchResultsByPlugin.forEach((results, pluginName) => {
            const isVisiblePlugin = this.activeFilters.size === 0 || this.activeFilters.has(pluginName);
            if (isVisiblePlugin) {
                results.forEach((result, resultIndex) => {
                    rankedRows.push({
                        pluginName,
                        result,
                        pluginOrder,
                        resultIndex,
                        score: this.calculateRelevanceScore(result?.title || '', query),
                    });
                });
            }
            pluginOrder++;
        });

        rankedRows.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;

            const titleA = this.normalizeText(a.result?.title || '');
            const titleB = this.normalizeText(b.result?.title || '');
            const titleOrder = titleA.localeCompare(titleB);
            if (titleOrder !== 0) return titleOrder;

            if (a.pluginOrder !== b.pluginOrder) return a.pluginOrder - b.pluginOrder;
            return a.resultIndex - b.resultIndex;
        });

        return rankedRows;
    }

    renderRankedResults(query = this.currentSearch || '', options = {}) {
        const { showPending = false } = options;
        this.resultsGrid.innerHTML = '';

        const rankedRows = this.buildRankedRows(query);
        rankedRows.forEach(({ pluginName, result }) => {
            const card = this.createResultCard(pluginName, result);
            this.resultsGrid.appendChild(card);
        });

        if (!showPending || this.pendingPlugins.size === 0) return;

        this.pendingPlugins.forEach((pluginName) => {
            if (this.activeFilters.size > 0 && !this.activeFilters.has(pluginName)) return;
            this.addLoadingCard(pluginName);
        });
    }

    showStatus(message, type = '') {
        this.searchStatus.textContent = message;
        this.searchStatus.className = 'search-status';

        if (type) {
            addClass(this.searchStatus, type);
            // If searching, add a small spinner
            if (type === 'searching') {
                const spinner = document.createElement('div');
                spinner.className = 'wp-spinner wp-spinner-sm';
                this.searchStatus.prepend(spinner);
            }
        }
    }

    removeLoadingCard(pluginName) {
        const loadingCard = $(`#loading-${pluginName}`);
        if (loadingCard) {
            loadingCard.style.opacity = '0';
            setTimeout(() => loadingCard.remove(), 300);
        }
    }

    replaceLoadingWithResults(pluginName, results) {
        const loadingCard = $(`#loading-${pluginName}`);
        if (!loadingCard) return;

        results.forEach((result, index) => {
            const resultCard = this.createResultCard(pluginName, result);

            // Fade-in animation
            resultCard.style.opacity = '0';
            resultCard.style.transform = 'translateY(20px)';

            if (index === 0) {
                loadingCard.replaceWith(resultCard);
            } else {
                this.resultsGrid.appendChild(resultCard);
            }

            // Animate
            setTimeout(() => {
                resultCard.style.transition = 'all 0.4s ease-out';
                resultCard.style.opacity = '1';
                resultCard.style.transform = 'translateY(0)';
            }, index * 50);
        });
    }

    createResultCard(pluginName, result) {
        const card = document.createElement('a');
        const providerParam = this.providerUrl ? `&provider=${encodeURIComponent(this.providerUrl)}` : '';
        card.href = `/icerik/${encodeURIComponent(pluginName)}?url=${result.url}${providerParam}`;
        card.className = 'card';

        const metaBits = [];
        if (result.year) metaBits.push(String(result.year));
        if (result.rating) metaBits.push(`IMDB ${result.rating}`);
        if (result.duration) metaBits.push(String(result.duration));

        let cardContent = `<div class="plugin-badge">${escapeHtml(pluginName)}</div>`;

        if (result.poster) {
            cardContent += `<img src="${result.poster}" alt="${escapeHtml(result.title)}" class="card-image" loading="lazy" decoding="async" fetchpriority="low" referrerpolicy="no-referrer">`;
        }

        cardContent += `<div class="card-content">`;
        cardContent += `<h3 class="card-title">${escapeHtml(result.title)}</h3>`;
        if (metaBits.length > 0) {
            cardContent += `<p class="card-meta-line">${escapeHtml(metaBits.join(' • '))}</p>`;
        }
        cardContent += `</div>`;

        card.innerHTML = cardContent;
        return card;
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

        // Reset filter state
        this.searchResultsByPlugin.clear();
        this.activeFilters.clear();
        this.pendingPlugins.clear();
        this.pluginFilters.classList.add('is-hidden');
        this.filtersContainer.innerHTML = '';

        // Abort ongoing searches
        this.fetchHelper.abort();
    }

    renderFilters() {
        if (this.searchResultsByPlugin.size === 0) {
            this.pluginFilters.classList.add('is-hidden');
            return;
        }

        this.filtersContainer.innerHTML = '';

        // Create filter buttons for plugins with results
        this.searchResultsByPlugin.forEach((results, pluginName) => {
            const filterButton = document.createElement('button');
            filterButton.type = 'button';
            filterButton.className = 'filter-button';
            filterButton.dataset.plugin = pluginName;
            filterButton.setAttribute('aria-pressed', 'false');
            filterButton.setAttribute('aria-label', t('filter_aria_label', { plugin: pluginName, count: results.length }));

            filterButton.innerHTML = `
                <span>${escapeHtml(pluginName)}</span>
                <span class="filter-count">${results.length}</span>
            `;

            filterButton.addEventListener('click', () => this.toggleFilter(pluginName));

            this.filtersContainer.appendChild(filterButton);
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
        buttons.forEach(button => {
            const pluginName = button.dataset.plugin;
            if (this.activeFilters.has(pluginName)) {
                addClass(button, 'active');
                button.setAttribute('aria-pressed', 'true');
            } else {
                removeClass(button, 'active');
                button.setAttribute('aria-pressed', 'false');
            }
        });
    }

    applyFilters(query = this.currentSearch || '') {
        this.renderRankedResults(query, { showPending: this.pendingPlugins.size > 0 });

        const visibleResults = this.buildRankedRows(query).length;

        // Update status
        const totalResults = Array.from(this.searchResultsByPlugin.values())
            .reduce((sum, results) => sum + results.length, 0);

        if (this.activeFilters.size > 0) {
            this.showStatus(t('filter_results_status', { visible: visibleResults, total: totalResults, filters: this.activeFilters.size }), 'success');
        } else {
            this.showStatus(t('search_results_count', { count: totalResults }), 'success');
        }
    }


}
