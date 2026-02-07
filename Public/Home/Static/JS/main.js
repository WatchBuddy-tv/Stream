// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import { ready } from './utils/dom.min.js';
import { initUnquote } from './components/unquote.min.js';
import { showBranding } from './branding.min.js';

const applyTranslations = () => {
    const nodes = document.querySelectorAll('[data-i18n]');
    nodes.forEach((node) => {
        const key = node.getAttribute('data-i18n');
        if (!key) return;
        let vars = {};
        const varsRaw = node.getAttribute('data-i18n-vars');
        if (varsRaw) {
            try { vars = JSON.parse(varsRaw); } catch (e) {}
        }
        const value = window.t ? window.t(key, vars) : key;
        const attr = node.getAttribute('data-i18n-attr');
        if (attr) {
            node.setAttribute(attr, value);
        } else {
            node.textContent = value;
        }
    });

    // Update title and meta description
    const body = document.body;
    if (body) {
        const titleKey = body.getAttribute('data-title-key');
        const titleVarsRaw = body.getAttribute('data-title-vars') || '{}';
        const descKey = body.getAttribute('data-desc-key');
        const descVarsRaw = body.getAttribute('data-desc-vars') || '{}';
        try {
            const titleVars = JSON.parse(titleVarsRaw);
            const descVars = JSON.parse(descVarsRaw);
            if (titleKey) {
                document.title = window.t ? window.t(titleKey, titleVars) : document.title;
            }
            if (descKey) {
                const meta = document.getElementById('meta-description');
                if (meta) meta.setAttribute('content', window.t ? window.t(descKey, descVars) : meta.getAttribute('content'));
            }
        } catch (e) {}
    }

    // Update html lang and og:locale
    if (window.LANG) {
        document.documentElement.setAttribute('lang', window.LANG);
        const og = document.getElementById('meta-og-locale');
        if (og) {
            og.setAttribute('content', window.LANG === 'tr' ? 'tr_TR' : 'en_US');
        }
    }
};

const updateLangLinks = (lang) => {
    const anchors = document.querySelectorAll('a[href]');
    anchors.forEach((a) => {
        const href = a.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;
        try {
            const url = new URL(href, window.location.origin);
            if (url.origin !== window.location.origin) return;
            url.searchParams.set('lang', lang);
            a.setAttribute('href', url.pathname + url.search + url.hash);
        } catch (e) {}
    });
    const langInputs = document.querySelectorAll('input[name="lang"]');
    langInputs.forEach((input) => {
        input.value = lang;
    });
};

const setLanguage = (lang) => {
    if (!lang || !window.TRANSLATIONS_ALL) return;
    window.LANG = lang;
    window.TRANSLATIONS = window.TRANSLATIONS_ALL[lang] || window.TRANSLATIONS;
    try { localStorage.setItem('lang', lang); } catch (e) {}
    applyTranslations();
    updateLangLinks(lang);
    window.dispatchEvent(new CustomEvent('lang:changed', { detail: { lang } }));
};

const setupLanguageSwitch = () => {
    const buttons = document.querySelectorAll('[data-lang]');
    if (!buttons.length) return;

    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            const lang = button.getAttribute('data-lang');
            if (!lang) return;
            document.querySelectorAll('[data-lang]').forEach((btn) => {
                const active = btn.getAttribute('data-lang') === lang;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            setLanguage(lang);
        });
    });
};

// Initialize when DOM is ready
ready(() => {
    // Show branding in console
    showBranding();

    // Initialize URL unquote functionality
    initUnquote();

    // Language switcher
    setupLanguageSwitch();

    // Apply stored language without reload
    try {
        const storedLang = localStorage.getItem('lang');
        if (storedLang && window.TRANSLATIONS_ALL && window.TRANSLATIONS_ALL[storedLang]) {
            setLanguage(storedLang);
        } else {
            applyTranslations();
            if (window.LANG) updateLangLinks(window.LANG);
        }
    } catch (e) {
        applyTranslations();
    }
});
