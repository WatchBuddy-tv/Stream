// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import { $, ready, escapeHtml, t } from '../utils/dom.min.js';
const STORAGE_KEY = 'wb_stream_disabled_plugins_v1';

class SettingsManager {
    constructor() {
        this.plugins  = [];
        this.scope    = window.location.origin || 'local';
        this.storeKey = `${STORAGE_KEY}:${this.scope}`;
        this.currentLangFilter = null;
        this._listEl   = null;
        this._summaryEl = null;
        this._built    = false;
    }

    init() {
        this.loadPlugins();
        this.bindPanelToggles();
        this.bindProvider();
        this._buildPreferences();
    }

    /* ── Collapsible panel toggles ── */
    bindPanelToggles() {
        const providerBtn   = $('#toggle-provider-settings');
        const pluginBtn     = $('#toggle-plugin-settings');
        const providerPanel = $('#provider-settings-panel');
        const pluginPanel   = $('#plugin-settings-panel');

        const syncPanel = (button, panel, isVisible) => {
            if (!button || !panel) return;
            panel.classList.toggle('is-hidden', !isVisible);
            const chevron = button.querySelector('.toggle-chevron');
            if (chevron) chevron.className = isVisible ? 'fas fa-chevron-up toggle-chevron' : 'fas fa-chevron-down toggle-chevron';
            button.setAttribute('aria-expanded', String(isVisible));
        };

        if (providerBtn && providerPanel) {
            providerBtn.addEventListener('click', () => {
                const willOpen = providerPanel.classList.contains('is-hidden');
                syncPanel(providerBtn, providerPanel, willOpen);
                if (willOpen) syncPanel(pluginBtn, pluginPanel, false);
            });
        }

        if (pluginBtn && pluginPanel) {
            pluginBtn.addEventListener('click', () => {
                const willOpen = pluginPanel.classList.contains('is-hidden');
                syncPanel(pluginBtn, pluginPanel, willOpen);
                if (willOpen) syncPanel(providerBtn, providerPanel, false);
            });
        }
    }

    loadPlugins() {
        try {
            const el = document.getElementById('plugins-data');
            this.plugins = el ? JSON.parse(el.textContent) : [];
        } catch (_) {
            this.plugins = [];
        }

        const urlParams = new URLSearchParams(window.location.search);
        this.scope = urlParams.get('provider') || this.getCookie('provider_url') || window.location.origin || 'local';
        this.storeKey = `${STORAGE_KEY}:${this.scope}`;
    }

    getCookie(name) {
        for (const c of document.cookie.split(';')) {
            const idx = c.indexOf('=');
            if (idx < 0) continue;
            const k = c.slice(0, idx).trim();
            let   v = c.slice(idx + 1).trim();
            if (k === name) {
                if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
                return decodeURIComponent(v);
            }
        }
        return null;
    }

    getDisabled() {
        try {
            const raw = localStorage.getItem(this.storeKey);
            return new Set(raw ? JSON.parse(raw).filter(Boolean) : []);
        } catch (_) {
            return new Set();
        }
    }

    saveDisabled(disabled) {
        try { localStorage.setItem(this.storeKey, JSON.stringify([...disabled])); } catch (_) { /* noop */ }
    }

    bindProvider() {
        const applyBtn   = $('#set-provider-button');
        const resetBtn   = $('#reset-provider-button');
        const exampleBtn = $('#try-example-button');
        const input      = $('#provider-url-input');

        if (applyBtn && input) {
            applyBtn.addEventListener('click', () => {
                const url = input.value.trim();
                if (!url) return;
                localStorage.setItem('watchbuddy_provider', url);
                window.location.href = `/?provider=${encodeURIComponent(url)}`;
            });
        }

        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && applyBtn) applyBtn.click();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                localStorage.removeItem('watchbuddy_provider');
                document.cookie = 'provider_url=; max-age=0; path=/; samesite=lax';
                window.location.href = '/';
            });
        }

        if (exampleBtn) {
            exampleBtn.addEventListener('click', () => {
                if (input) {
                    input.value = 'https://example.watchbuddy.tv';
                    input.focus();
                    input.select();
                }
            });
        }

        // Auto-redirect if saved provider exists
        const isRemote        = !!$('.status-badge-success');
        const savedProvider   = localStorage.getItem('watchbuddy_provider');
        const currentProvider = new URLSearchParams(window.location.search).get('provider');
        if (!isRemote && savedProvider && !currentProvider) {
            window.location.href = `/?provider=${encodeURIComponent(savedProvider)}`;
        }
    }

    _buildPreferences() {
        this._listEl = $('#plugin-preferences-list');
        if (!this._listEl || !this.plugins.length) return;

        const disabled  = this.getDisabled();
        const languages = [...new Set(this.plugins.map(p => (p.language || '').toUpperCase()).filter(Boolean))].sort();

        // ── Toolbar ──
        const toolbar = document.createElement('div');
        toolbar.className = 'plugin-mgmt-toolbar';

        const filtersWrap = document.createElement('div');
        filtersWrap.className = 'plugin-lang-filters';

        const allPill = document.createElement('button');
        allPill.type = 'button';
        allPill.className = 'filter-pill active';
        allPill.dataset.lang = '';
        allPill.textContent = t('plugin_language_filter_all');
        filtersWrap.appendChild(allPill);

        languages.forEach(lang => {
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = 'filter-pill';
            pill.dataset.lang = lang;
            pill.textContent = lang;
            filtersWrap.appendChild(pill);
        });
        toolbar.appendChild(filtersWrap);

        const bulkWrap = document.createElement('div');
        bulkWrap.className = 'plugin-bulk-actions';

        const enableAllBtn = document.createElement('button');
        enableAllBtn.type = 'button';
        enableAllBtn.className = 'button button-small button-primary';
        enableAllBtn.innerHTML = `<i class="fas fa-eye"></i> ${escapeHtml(t('plugin_show_visible'))}`;

        const disableAllBtn = document.createElement('button');
        disableAllBtn.type = 'button';
        disableAllBtn.className = 'button button-small button-secondary';
        disableAllBtn.innerHTML = `<i class="fas fa-eye-slash"></i> ${escapeHtml(t('plugin_hide_visible'))}`;

        bulkWrap.appendChild(enableAllBtn);
        bulkWrap.appendChild(disableAllBtn);

        const summaryEl = document.createElement('span');
        summaryEl.className = 'plugin-status-summary';
        this._summaryEl = summaryEl;

        const toolbarFoot = document.createElement('div');
        toolbarFoot.className = 'plugin-toolbar-foot';
        toolbarFoot.appendChild(bulkWrap);
        toolbarFoot.appendChild(summaryEl);
        toolbar.appendChild(toolbarFoot);

        this._listEl.innerHTML = '';
        this._listEl.appendChild(toolbar);

        // ── Plugin items ──
        this._pluginEls = [];
        this.plugins.forEach(plugin => {
            const isEnabled = !disabled.has(plugin.name);
            const lang = String(plugin.language || '').toUpperCase() || '?';
            const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(plugin.name)}&background=1f1d1a&color=ef7f1a`;

            const article = document.createElement('article');
            article.className = `plugin-preference-item${isEnabled ? '' : ' is-disabled'}`;
            article.dataset.pluginName = plugin.name;
            article.dataset.pluginLang = lang;

            const iconSpan = document.createElement('span');
            iconSpan.className = 'plugin-preference-icon';
            const img = document.createElement('img');
            img.src = plugin.favicon || fallback;
            img.alt = plugin.name;
            img.loading = 'lazy';
            img.onerror = function() { this.onerror = null; this.src = fallback; };
            iconSpan.appendChild(img);
            article.appendChild(iconSpan);

            const body = document.createElement('div');
            body.className = 'plugin-preference-body';

            const nameStrong = document.createElement('strong');
            nameStrong.className = 'plugin-preference-name';
            nameStrong.textContent = plugin.name;
            body.appendChild(nameStrong);

            const foot = document.createElement('div');
            foot.className = 'plugin-preference-foot';

            const badge = document.createElement('span');
            badge.className = 'badge badge-xs';
            badge.textContent = lang;
            foot.appendChild(badge);

            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'button button-secondary button-small plugin-preference-toggle';
            toggleBtn.dataset.pluginName = plugin.name;
            this._setToggleState(toggleBtn, isEnabled);
            foot.appendChild(toggleBtn);

            body.appendChild(foot);
            article.appendChild(body);

            this._listEl.appendChild(article);
            this._pluginEls.push({ article, toggleBtn, name: plugin.name, lang });
        });

        // ── Event delegation ──
        filtersWrap.addEventListener('click', (e) => {
            const pill = e.target.closest('.filter-pill');
            if (!pill) return;
            this.currentLangFilter = pill.dataset.lang || null;
            filtersWrap.querySelectorAll('.filter-pill').forEach(p => p.classList.toggle('active', p === pill));
            this._applyLangFilter();
        });

        enableAllBtn.addEventListener('click', () => {
            const dis = this.getDisabled();
            this._getVisiblePluginNames().forEach(n => dis.delete(n));
            this.saveDisabled(dis);
            this._refreshStates(dis);
        });

        disableAllBtn.addEventListener('click', () => {
            const dis = this.getDisabled();
            this._getVisiblePluginNames().forEach(n => dis.add(n));
            const stillEnabled = this.plugins.filter(p => !dis.has(p.name));
            if (stillEnabled.length === 0 && this.plugins.length > 0) dis.delete(this.plugins[0].name);
            this.saveDisabled(dis);
            this._refreshStates(dis);
        });

        this._listEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.plugin-preference-toggle');
            if (!btn) return;
            const name = btn.dataset.pluginName;
            const dis = this.getDisabled();
            if (dis.has(name)) {
                dis.delete(name);
            } else {
                const enabled = this.plugins.filter(p => !dis.has(p.name));
                if (enabled.length <= 1) return;
                dis.add(name);
            }
            this.saveDisabled(dis);
            this._refreshStates(dis);
        });

        this._built = true;
        this._updateSummary();
    }

    _updateSummary() {
        if (!this._summaryEl) return;
        const disabled = this.getDisabled();
        const total  = this.plugins.length;
        const hidden = this.plugins.filter(p => disabled.has(p.name)).length;
        const active = total - hidden;
        this._summaryEl.textContent = t('plugin_preferences_summary', { active, hidden });
        this._summaryEl.classList.toggle('has-hidden', hidden > 0);
    }

    _setToggleState(btn, isEnabled) {
        btn.setAttribute('aria-pressed', String(!isEnabled));
        if (isEnabled) {
            btn.className = 'button button-secondary button-small plugin-preference-toggle';
            btn.innerHTML = `<i class="fas fa-eye-slash"></i> <span>${escapeHtml(t('plugin_hide'))}</span>`;
        } else {
            btn.className = 'button button-primary button-small plugin-preference-toggle';
            btn.innerHTML = `<i class="fas fa-eye"></i> <span>${escapeHtml(t('plugin_show'))}</span>`;
        }
    }

    _applyLangFilter() {
        this._pluginEls.forEach(({ article, lang }) => {
            article.style.display = (!this.currentLangFilter || lang === this.currentLangFilter) ? '' : 'none';
        });
    }

    _getVisiblePluginNames() {
        return this._pluginEls
            .filter(({ article }) => article.style.display !== 'none')
            .map(({ name }) => name);
    }

    _refreshStates(disabled) {
        if (!disabled) disabled = this.getDisabled();
        this._pluginEls.forEach(({ article, toggleBtn, name }) => {
            const isEnabled = !disabled.has(name);
            article.classList.toggle('is-disabled', !isEnabled);
            this._setToggleState(toggleBtn, isEnabled);
        });
        this.syncCardVisibility(disabled);
        this._updateSummary();
    }

    syncCardVisibility(disabled) {
        if (!disabled) disabled = this.getDisabled();
        document.querySelectorAll('#plugins-list .card[data-plugin-name]').forEach((card) => {
            const name = card.dataset.pluginName || '';
            const hidden = disabled.has(name);
            card.classList.toggle('is-plugin-hidden', hidden);
            card.setAttribute('aria-hidden', String(hidden));
        });
    }
}

ready(() => {
    const mgr = new SettingsManager();
    mgr.init();
    window.__settingsManager = mgr;
});

export default SettingsManager;
