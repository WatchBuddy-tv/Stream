// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import { $, $$, ready, t } from '../utils/dom.min.js';

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
});
