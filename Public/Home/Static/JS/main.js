// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import { ready, throttle } from './utils/dom.min.js';
import { initUnquote } from './components/unquote.min.js';
import { showBranding } from './branding.min.js';

// ── Bootstrap i18n (safety net — globals already set by inline script) ──
const bootstrapI18n = () => {
    if (!window.t) {
        window.t = (key, vars) => {
            const dict = window.TRANSLATIONS || {};
            let template = dict[key] || key;
            if (vars && typeof vars === 'object') {
                Object.keys(vars).forEach((k) => {
                    template = template.split(`{${k}}`).join(String(vars[k]));
                });
            }
            return template;
        };
    }
};

// ── Apply translations to DOM ──
const applyTranslations = () => {
    document.querySelectorAll('[data-i18n]').forEach((node) => {
        const key = node.getAttribute('data-i18n');
        if (!key) return;

        let vars = {};
        const varsRaw = node.getAttribute('data-i18n-vars');
        if (varsRaw) {
            try { vars = JSON.parse(varsRaw); } catch {}
        }

        const value = window.t ? window.t(key, vars) : key;
        const attr = node.getAttribute('data-i18n-attr');
        if (attr) {
            node.setAttribute(attr, value);
        } else {
            node.textContent = value;
        }
    });

    // Update title and meta
    const body = document.body;
    if (body) {
        const titleKey  = body.getAttribute('data-title-key');
        const descKey   = body.getAttribute('data-desc-key');
        try {
            const titleVars = JSON.parse(body.getAttribute('data-title-vars') || '{}');
            const descVars  = JSON.parse(body.getAttribute('data-desc-vars') || '{}');
            if (titleKey && window.t) {
                document.title = window.t(titleKey, titleVars);
            }
            if (descKey && window.t) {
                const meta = document.getElementById('meta-description');
                if (meta) meta.setAttribute('content', window.t(descKey, descVars));
            }
        } catch {}
    }

    // Update html lang & og:locale
    if (window.LANG) {
        document.documentElement.setAttribute('lang', window.LANG);
        const og = document.getElementById('meta-og-locale');
        if (og) {
            const ogMap = { tr: 'tr_TR', en: 'en_US', fr: 'fr_FR', ru: 'ru_RU', uk: 'uk_UA', hi: 'hi_IN', zh: 'zh_CN' };
            og.setAttribute('content', ogMap[window.LANG] || 'en_US');
        }
    }
};

// ── Language switching ──
const setLanguage = (lang) => {
    if (!lang || !window.TRANSLATIONS_ALL) return;
    window.LANG = lang;
    window.TRANSLATIONS = window.TRANSLATIONS_ALL[lang] || window.TRANSLATIONS;

    try { localStorage.setItem('lang', lang); } catch {}
    try { document.cookie = `lang=${lang}; path=/; max-age=31536000; SameSite=Lax`; } catch {}

    applyTranslations();

    // Update CSS custom property for no-poster placeholder text
    const noPosterText = (window.TRANSLATIONS || {}).no_poster || 'No Poster';
    document.documentElement.style.setProperty('--no-poster-text', `"${noPosterText}"`);

    window.dispatchEvent(new CustomEvent('lang:changed', { detail: { lang } }));
};

const setupLanguageSwitch = () => {
    document.querySelectorAll('.lang-btn[data-lang]').forEach((button) => {
        button.addEventListener('click', () => {
            const lang = button.getAttribute('data-lang');
            if (!lang) return;

            document.querySelectorAll('.lang-btn[data-lang]').forEach((btn) => {
                const active = btn.getAttribute('data-lang') === lang;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            });

            setLanguage(lang);
        });
    });
};

// ── Header scroll ──
const setupHeaderScroll = () => {
    const header = document.querySelector('.header');
    if (!header) return;

    const cls = 'header-scrolled';
    const check = () => header.classList.toggle(cls, window.scrollY > 40);
    window.addEventListener('scroll', throttle(check, 100), { passive: true });
    check();
};

// ── Poster image error fallback ──
const setupImageFallback = () => {
    document.addEventListener('error', (e) => {
        const img = e.target;
        if (img.tagName !== 'IMG') return;
        const wrap = img.closest('.poster-card-img');
        if (wrap && !wrap.classList.contains('has-error')) {
            wrap.classList.add('has-error');
        }
    }, true);
};

// ── Init ──
ready(() => {
    bootstrapI18n();
    showBranding();
    initUnquote();
    setupHeaderScroll();
    setupLanguageSwitch();
    setupImageFallback();

    // Apply stored lang or default translations
    try {
        const storedLang = localStorage.getItem('lang');
        if (storedLang && window.TRANSLATIONS_ALL && window.TRANSLATIONS_ALL[storedLang]) {
            setLanguage(storedLang);
        } else {
            applyTranslations();
            const noPosterText = (window.TRANSLATIONS || {}).no_poster || 'No Poster';
            document.documentElement.style.setProperty('--no-poster-text', `"${noPosterText}"`);
        }
    } catch {
        applyTranslations();
        const noPosterText = (window.TRANSLATIONS || {}).no_poster || 'No Poster';
        document.documentElement.style.setProperty('--no-poster-text', `"${noPosterText}"`);
    }
});
