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
            const ogMap = {
                tr: 'tr_TR',
                en: 'en_US',
                fr: 'fr_FR',
                ru: 'ru_RU',
                uk: 'uk_UA'
            };
            og.setAttribute('content', ogMap[window.LANG] || 'en_US');
        }
    }
};

const setLanguage = (lang) => {
    if (!lang || !window.TRANSLATIONS_ALL) return;
    window.LANG = lang;
    window.TRANSLATIONS = window.TRANSLATIONS_ALL[lang] || window.TRANSLATIONS;

    // localStorage'a kaydet
    try { localStorage.setItem('lang', lang); } catch (e) {}

    // Cookie'ye de kaydet (backend için)
    try {
        document.cookie = `lang=${lang}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (e) {}

    applyTranslations();
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
        }
    } catch (e) {
        applyTranslations();
    }
});
