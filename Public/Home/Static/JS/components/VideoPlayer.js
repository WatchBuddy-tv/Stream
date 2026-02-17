// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import { buildProxyUrl as buildServiceProxyUrl } from '../service-detector.min.js';
import { detectFormat, parseRemoteUrl, createHlsConfig, suggestInitialMode, ProxyMode } from '../video-utils.min.js';
import BuddyLogger from '../utils/BuddyLogger.min.js';

const t = (key, vars = {}) => (window.t ? window.t(key, vars) : key);

export default class VideoPlayer {
    constructor() {
        // BuddyLogger'ı başlat ve ata
        this.logger = new BuddyLogger(true);

        // --- Console Welcome Message ---
        BuddyLogger.info(
            '📺',
            'PROVIDER-READY',
            'Detected Configuration:',
            {
                'Provider Name': document.body.dataset.providerName || 'Unknown',
                'Base URL':      window.location.origin,
                'Proxy URL':     document.body.dataset.proxyUrl || 'N/A',
                'Fallback URL':  document.body.dataset.proxyFallbackUrl || 'N/A'
            }
        );
        // ----------------------------------------

        // Global değişkenler (sınıf özellikleri olarak)
        this.currentHls = null;
        this.loadingTimeout = null;
        this.isLoadingVideo = false;
        this.videoData = [];
        this.retryCount = 0;
        this.maxRetries = 5;
        this.lastLoadedBaseUrl = null; // HLS segment URL'leri için base URL takibi
        this.lastLoadedOrigin = null; // HLS absolute path'leri için origin takibi
        this.userGestureUntil = 0; // Kısa süreli user gesture guard
        this.selectedSubtitleUrl = null; // Seçilen altyazı URL'i
        this.currentVideoIndex = null; // Şu anki video index'i

        // DOM Elementleri
        this.videoPlayer = document.getElementById('video-player');
        this.videoLinksUI = document.getElementById('video-links-ui');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.toggleDiagnosticsBtn = document.getElementById('toggle-diagnostics');
        this.diagnosticsPanel = document.getElementById('diagnostics-panel');
        this.selectionModal = document.getElementById('selection-modal');
        this.selectionList = document.getElementById('selection-list');

        this.init();
        window.addEventListener('lang:changed', () => {
            this.refreshI18n();
        });
    }

    // Proxy URL oluşturucu (yalnızca provider proxy)
    buildProxyUrl(url, userAgent = '', referer = '', endpoint = 'video') {
        const proxyBase = this.proxyUrl || this.proxyFallbackUrl;
        return buildServiceProxyUrl(url, userAgent, referer, endpoint, proxyBase);
    }

    async init() {
        this.setupDiagnostics();
        this.collectVideoLinks();
        this.renderVideoLinks();
        this.loadHlsLibrary();
        this.setupUserGestureGuard();
        this.setupKeyboardControls();
        this.setupCustomControls();
        this.setupGlobalErrorHandling();
        this.setupSelectionModal();
    }

    setAudioTooltip(label) {
        const audioBtn = document.getElementById('custom-audio');
        if (!audioBtn) return;
        audioBtn.title = label ? t('audio_tooltip', { label }) : t('tooltip_audio');
    }

    setSubtitleTooltip(label) {
        const ccBtn = document.getElementById('custom-cc');
        if (!ccBtn) return;
        if (label === t('off')) {
            ccBtn.title = t('subtitle_off_tooltip');
            return;
        }
        ccBtn.title = label ? t('subtitle_tooltip', { label }) : t('tooltip_subtitle');
    }

    refreshI18n() {
        if (this.currentHls && this.currentHls.audioTracks && this.currentHls.audioTracks.length > 1) {
            let currentIndex = typeof this.currentHls.audioTrack === 'number' ? this.currentHls.audioTrack : 0;
            if (currentIndex < 0 || currentIndex >= this.currentHls.audioTracks.length) {
                currentIndex = 0;
            }
            const currentTrack = this.currentHls.audioTracks[currentIndex];
            const currentLabel = currentTrack?.name || currentTrack?.lang || t('audio_track_label', { index: currentIndex + 1 });
            this.setAudioTooltip(currentLabel);
        } else {
            this.setAudioTooltip(null);
        }

        if (this.currentVideoIndex !== null && this.videoData[this.currentVideoIndex]?.subtitles?.length) {
            if (!this.selectedSubtitleUrl) {
                this.setSubtitleTooltip(t('off'));
            } else {
                const currentSub = this.videoData[this.currentVideoIndex].subtitles.find(s => s.url === this.selectedSubtitleUrl);
                if (currentSub?.name) {
                    this.setSubtitleTooltip(currentSub.name);
                } else {
                    this.setSubtitleTooltip(t('tooltip_subtitle'));
                }
            }
        } else {
            this.setSubtitleTooltip(null);
        }

        const subtitleSelectBtn = document.getElementById('subtitle-select-btn');
        if (subtitleSelectBtn && this.currentVideoIndex !== null) {
            const subs = this.videoData[this.currentVideoIndex]?.subtitles || [];
            let label = t('off');
            if (this.selectedSubtitleUrl) {
                label = subs.find(s => s.url === this.selectedSubtitleUrl)?.name || t('selection_selected');
            } else if (subs.length > 0) {
                label = subs[0].name || t('selection_selected');
            }
            subtitleSelectBtn.innerHTML = `<i class="fas fa-closed-captioning"></i> ${label} <i class="fas fa-ellipsis-v"></i>`;
        }
    }

    setupUserGestureGuard() {
        const onGesture = () => { this.userGestureUntil = Date.now() + 1200; };
        if (this.videoPlayer) {
            this.videoPlayer.addEventListener('pointerdown', onGesture);
            this.videoPlayer.addEventListener('mousedown', onGesture);
            this.videoPlayer.addEventListener('touchstart', onGesture, { passive: true });
        }
    }

    setupKeyboardControls() {
        const SEEK_STEP = 2; // 2 saniye ileri/geri

        // Video element'in focus almasını engelle (native keyboard handling devre dışı)
        if (this.videoPlayer) {
            this.videoPlayer.tabIndex = -1;

            // Seek eventlerini yakala ve durdur (native default'ları ezmek için)
            const onSeeking = (e) => {
                if (e.isTrusted || Date.now() < this.userGestureUntil) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            };
            this.videoPlayer.addEventListener('seeking', onSeeking, { capture: true });
            this.videoPlayer.addEventListener('seeked', onSeeking, { capture: true });
        }

        document.addEventListener('keydown', (e) => {
            if (!this.videoPlayer || this.isLoadingVideo) return;

            // Input alanındayken kısayolları devre dışı bırak
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                return;
            }

            switch (e.code) {
                case 'Space':
                case 'KeyK':
                    e.preventDefault();
                    if (this.videoPlayer.paused) {
                        this.videoPlayer.play().catch(() => {});
                    } else {
                        this.videoPlayer.pause();
                    }
                    break;
                case 'ArrowRight':
                case 'KeyL':
                    e.preventDefault();
                    if (Number.isFinite(this.videoPlayer.duration)) {
                        this.videoPlayer.currentTime = Math.min(this.videoPlayer.duration, this.videoPlayer.currentTime + SEEK_STEP);
                    }
                    break;
                case 'ArrowLeft':
                case 'KeyJ':
                    e.preventDefault();
                    this.videoPlayer.currentTime = Math.max(0, this.videoPlayer.currentTime - SEEK_STEP);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.videoPlayer.volume = Math.min(1, this.videoPlayer.volume + 0.1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.videoPlayer.volume = Math.max(0, this.videoPlayer.volume - 0.1);
                    break;
                case 'KeyF':
                    e.preventDefault();
                    if (document.fullscreenElement) {
                        document.exitFullscreen().catch(() => {});
                    } else {
                        const container = document.getElementById('video-player-wrapper') || this.videoPlayer;
                        if (container.requestFullscreen) {
                            container.requestFullscreen().catch(() => {});
                        } else if (container.webkitRequestFullscreen) {
                            container.webkitRequestFullscreen();
                        }
                    }
                    break;
                case 'KeyM':
                    e.preventDefault();
                    this.videoPlayer.muted = !this.videoPlayer.muted;
                    break;
            }

            // Kendi kontrollerimiz çalıştıysa yayılımı durdur
            e.stopPropagation();
        }, { capture: true });
    }

    setupCustomControls() {
        if (!this.videoPlayer) return;

        const wrapper = document.getElementById('video-player-wrapper');

        const bottomPlayBtn = document.getElementById('bottom-play-pause');
        const muteBtn = document.getElementById('custom-mute');
        const volumeSlider = document.getElementById('custom-volume-slider');
        const progressContainer = document.getElementById('custom-progress-container');
        const progressFill = document.getElementById('custom-progress-fill');
        const currentTimeEl = document.getElementById('current-time');
        const durationTimeEl = document.getElementById('duration-time');
        const fullscreenBtn = document.getElementById('custom-fullscreen');
        const backwardBtn = document.getElementById('custom-backward');
        const forwardBtn = document.getElementById('custom-forward');
        const ccBtn = document.getElementById('custom-cc');
        const actionAnimation = document.getElementById('action-animation');

        const htmlEl = document.documentElement;
        if (bottomPlayBtn && progressContainer && fullscreenBtn) {
            htmlEl.classList.add('custom-controls-ready');
            // Firefox güvenliği: native controls'u programatik olarak da kaldır
            // Firefox bazen CSS ::-moz-media-controls gizlemeyi yoksayabilir
            this.videoPlayer.removeAttribute('controls');
        } else {
            htmlEl.classList.remove('custom-controls-ready');
        }

        const formatDuration = (seconds) => {
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            return hours > 0
                ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
                : `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        const togglePlay = () => {
            this.userGestureUntil = Date.now() + 1200;
            if (this.videoPlayer.paused) {
                this.videoPlayer.play().catch(() => {});
            } else {
                this.videoPlayer.pause();
            }
        };

        const updatePlayIcons = () => {
            const iconClass = this.videoPlayer.paused ? 'fa-play' : 'fa-pause';
            if (bottomPlayBtn) bottomPlayBtn.querySelector('i').className = `fas ${iconClass}`;
        };

        const triggerAnimation = (iconClass) => {
            if (!actionAnimation) return;
            actionAnimation.querySelector('i').className = `fas ${iconClass}`;
            actionAnimation.classList.remove('active');
            void actionAnimation.offsetWidth; // trigger reflow
            actionAnimation.classList.add('active');
            // Animasyon bitince class'ı kaldır — sabit kalmasın
            setTimeout(() => actionAnimation.classList.remove('active'), 600);
        };

        // Events


        bottomPlayBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePlay();
        });

        this.videoPlayer.addEventListener('play', updatePlayIcons);
        this.videoPlayer.addEventListener('pause', updatePlayIcons);



        // Volume
        volumeSlider?.addEventListener('input', (e) => {
            this.videoPlayer.volume = e.target.value;
            this.videoPlayer.muted = false;
        });

        muteBtn?.addEventListener('click', () => {
            this.videoPlayer.muted = !this.videoPlayer.muted;
        });

        this.videoPlayer.addEventListener('volumechange', () => {
            const val = this.videoPlayer.muted ? 0 : this.videoPlayer.volume;

            if (volumeSlider) {
                volumeSlider.value = val;
                // Dolu/Boş ayrımı için gradient
                const percent = val * 100;
                // Stream tarafında primary-color kullanılıyor
                volumeSlider.style.background = `linear-gradient(to right, var(--primary-color) ${percent}%, rgba(255, 255, 255, 0.2) ${percent}%)`;
            }

            if (muteBtn) {
                let icon = 'fa-volume-up';
                if (this.videoPlayer.muted || this.videoPlayer.volume === 0) icon = 'fa-volume-mute';
                else if (this.videoPlayer.volume < 0.5) icon = 'fa-volume-down';
                muteBtn.querySelector('i').className = `fas ${icon}`;
            }
        });

        // Başlangıç durumu
        if (volumeSlider) {
            const val = this.videoPlayer.muted ? 0 : this.videoPlayer.volume;
            const percent = val * 100;
            volumeSlider.style.background = `linear-gradient(to right, var(--primary-color) ${percent}%, rgba(255, 255, 255, 0.2) ${percent}%)`;
        }

        // Progress / Seeking
        // Progress / Seeking (Drag Support & Optimistic UI)
        let isDragging = false;
        let seekButtonsTimeout;
        let longPressTimer;

        const setSeekingState = (active) => {
            document.body.classList.toggle('seeking-active', active);
        };

        const showSeekButtonsTemporarily = () => {
            if (window.innerWidth > 480 || !wrapper) return;
            wrapper.classList.add('show-seek-buttons');

            clearTimeout(seekButtonsTimeout);
            seekButtonsTimeout = setTimeout(() => {
                wrapper.classList.remove('show-seek-buttons');
            }, 2500);
        };

        const handleSeekMove = (e) => {
            const rect = progressContainer.getBoundingClientRect();
            let pos = (e.pageX - rect.left) / progressContainer.offsetWidth;
            pos = Math.max(0, Math.min(1, pos)); // Clamp between 0 and 1

            if (progressFill) progressFill.style.width = `${pos * 100}%`;

            // Show preview time if wanted (optional)
            if (Number.isFinite(this.videoPlayer.duration)) {
                 const previewTime = pos * this.videoPlayer.duration;
                 if (currentTimeEl) currentTimeEl.textContent = formatDuration(previewTime);
            }
        };

        const handleSeekEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;
            setSeekingState(false);

            document.removeEventListener('mousemove', handleSeekMove);
            document.removeEventListener('mouseup', handleSeekEnd);

            const rect = progressContainer.getBoundingClientRect();
            let pos = (e.pageX - rect.left) / progressContainer.offsetWidth;
            pos = Math.max(0, Math.min(1, pos));

            if (Number.isFinite(this.videoPlayer.duration)) {
                this.userGestureUntil = Date.now() + 1200;
                this.videoPlayer.currentTime = pos * this.videoPlayer.duration;
            }
        };

        progressContainer?.addEventListener('mousedown', (e) => {
            isDragging = true;
            setSeekingState(true);
            handleSeekMove(e); // Update UI immediately

            document.addEventListener('mousemove', handleSeekMove);
            document.addEventListener('mouseup', handleSeekEnd);
        });

        // Touch support
        progressContainer?.addEventListener('touchstart', (e) => {
            isDragging = true;
            if (e.cancelable) e.preventDefault();
            setSeekingState(true);
            // Use the first touch point
            const touch = e.touches[0];
            const fakeEvent = { pageX: touch.pageX };
            handleSeekMove(fakeEvent);

            const handleTouchMove = (e) => {
                if (e.cancelable) e.preventDefault();
                const touch = e.touches[0];
                handleSeekMove({ pageX: touch.pageX });
            };

            const handleTouchEnd = (e) => {
                isDragging = false;
                setSeekingState(false);
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
                document.removeEventListener('touchcancel', handleTouchEnd);

                // For touch end, we use the last known position or we need changedTouches
                // Ideally handleSeekMove updates a variable we can use, but simply calculating based on last move is tricky without state.
                // Simpler: Just rely on the last visual update? No, we need to set currentTime.
                // Let's re-calculate from changedTouches
                if (e.changedTouches.length > 0) {
                     const touch = e.changedTouches[0];
                     const rect = progressContainer.getBoundingClientRect();
                     let pos = (touch.pageX - rect.left) / progressContainer.offsetWidth;
                     pos = Math.max(0, Math.min(1, pos));

                     if (Number.isFinite(this.videoPlayer.duration)) {
                        this.userGestureUntil = Date.now() + 1200;
                        this.videoPlayer.currentTime = pos * this.videoPlayer.duration;
                    }
                }
            };

            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
            document.addEventListener('touchcancel', handleTouchEnd);
        });

        const updateTimeUI = () => {
            if (Number.isFinite(this.videoPlayer.duration) && this.videoPlayer.duration > 0) {
                // Dragging sırasında ilerleme çubuğunu güncelleme (jitter önleme)
                if (!isDragging) {
                    const percent = (this.videoPlayer.currentTime / this.videoPlayer.duration) * 100;
                    if (progressFill) progressFill.style.width = `${percent}%`;
                    if (currentTimeEl) currentTimeEl.textContent = formatDuration(this.videoPlayer.currentTime);
                }
                if (durationTimeEl) durationTimeEl.textContent = formatDuration(this.videoPlayer.duration);
            }
        };

        this.videoPlayer.addEventListener('timeupdate', updateTimeUI);
        this.videoPlayer.addEventListener('loadedmetadata', updateTimeUI);
        this.videoPlayer.addEventListener('durationchange', updateTimeUI);

        // Backward / Forward
        const SEEK_STEP = 2;
        backwardBtn?.addEventListener('click', () => {
            this.userGestureUntil = Date.now() + 1200;
            this.videoPlayer.currentTime = Math.max(0, this.videoPlayer.currentTime - SEEK_STEP);
            triggerAnimation('fa-undo');
        });

        forwardBtn?.addEventListener('click', () => {
            this.userGestureUntil = Date.now() + 1200;
            this.videoPlayer.currentTime = Math.min(this.videoPlayer.duration, this.videoPlayer.currentTime + SEEK_STEP);
            triggerAnimation('fa-redo');
        });

        // Fullscreen with mobile orientation support
        fullscreenBtn?.addEventListener('click', async () => {
            const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || this.videoPlayer.webkitDisplayingFullscreen);

            if (isFS) {
                // Fullscreen'den çık
                if (document.exitFullscreen) {
                    await document.exitFullscreen().catch(() => {});
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (this.videoPlayer.webkitExitFullscreen) {
                    this.videoPlayer.webkitExitFullscreen();
                }
            } else {
                // Fullscreen'e gir
                try {
                    // Sadece wrapper'ı tam ekran yap (kontrollerin ve overlay'in görünmesi için şart)
                    const fsMethod = wrapper.requestFullscreen ||
                                   wrapper.webkitRequestFullscreen ||
                                   wrapper.mozRequestFullScreen ||
                                   wrapper.msRequestFullscreen;

                    if (fsMethod) {
                        await fsMethod.call(wrapper);
                        // Mobilde yatay moda kilitle
                        if (screen.orientation?.lock) {
                            await screen.orientation.lock('landscape').catch(() => {});
                        }
                    } else if (this.videoPlayer.webkitEnterFullscreen) {
                        // iPhone Fallback - Native iOS player takes over
                        this.videoPlayer.webkitEnterFullscreen();
                    }
                } catch (e) {
                    this.logger.error('🖥️', 'PLAYER', 'Fullscreen Error', { 'Details': e.message });
                    // Son ihtimal video tam ekranı
                    if (this.videoPlayer.webkitEnterFullscreen) {
                        this.videoPlayer.webkitEnterFullscreen();
                    }
                }
            }
        });

        const handleFullscreenChange = () => {
            const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || this.videoPlayer.webkitDisplayingFullscreen);

            // İkonu güncelle
            if (fullscreenBtn) {
                const icon = fullscreenBtn.querySelector('i');
                if (icon) icon.className = `fas ${isFS ? 'fa-compress' : 'fa-expand'}`;
            }

            document.body.classList.toggle('is-fullscreen', isFS);

            // Fullscreen çıkışında orientation kilidini kaldır ve cleanup
            if (!isFS) {
                if (screen.orientation?.unlock) {
                    screen.orientation.unlock().catch(() => {});
                }
                document.body.classList.remove('keyboard-open');
                window.dispatchEvent(new Event('resize'));
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        this.videoPlayer.addEventListener('webkitbeginfullscreen', handleFullscreenChange);
        this.videoPlayer.addEventListener('webkitendfullscreen', handleFullscreenChange);

        // Ekran döndüğünde layout'u tazele (bazı mobil tarayıcılar için)
        window.addEventListener('orientationchange', () => {
            if (document.fullscreenElement) {
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                }, 300);
            }
        });

        // Subtitles (CC)
        ccBtn?.addEventListener('click', () => {
            const tracks = this.videoPlayer.textTracks;
            // Eğer o anki videonun birden fazla altyazısı varsa modalı aç
            if (this.currentVideoIndex !== null &&
                this.videoData[this.currentVideoIndex].subtitles &&
                this.videoData[this.currentVideoIndex].subtitles.length > 1) {

                const subOptions = this.videoData[this.currentVideoIndex].subtitles.map(s => ({
                    label: s.name,
                    value: s.url,
                    action: () => this.changeSubtitle(s)
                }));
                // "Kapalı" seçeneğini ekle
                subOptions.unshift({
                    label: t('off'),
                    value: null,
                    action: () => this.changeSubtitle(null)
                });

                this.showSelectionModal(t('selection_subtitle'), 'fa-closed-captioning', subOptions, ccBtn, this.selectedSubtitleUrl);

            } else if (tracks.length > 0) {
                // Tek altyazı varsa toggle yap
                const isShowing = tracks[0].mode === 'showing';
                tracks[0].mode = isShowing ? 'hidden' : 'showing';
                ccBtn.classList.toggle('active', !isShowing);
            }
        });

        // Auto-hide controls (Robust Logic)
        let hideTimeout;

        const showControls = () => {
            wrapper.classList.add('show-controls');
            wrapper.style.cursor = 'default';

            clearTimeout(hideTimeout);
            if (!this.videoPlayer.paused) {
                const isMobile = window.innerWidth <= 1024;
                const hideDelay = isMobile ? 4500 : 3000;
                hideTimeout = setTimeout(() => {
                    hideControls();
                }, hideDelay);
            }
        };

        const hideControls = (force = false) => {
            if (!force && this.videoPlayer.paused) return; // Paused iken asla gizleme (mobile tap force ile bypass eder)
            wrapper.classList.remove('show-controls');
            if (document.fullscreenElement) {
                wrapper.style.cursor = 'none';
            }
        };

        // ── Mobile Double-Tap Seek ──
        let lastTapTime = 0;
        let lastTapSide = null;
        let singleTapTimeout = null;

        const handleMobileTap = (e) => {
            const now = Date.now();
            const rect = wrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const side = x < rect.width / 2 ? 'left' : 'right';

            if (now - lastTapTime < 300 && lastTapSide === side) {
                // Double-tap → Seek
                clearTimeout(singleTapTimeout);
                lastTapTime = 0;
                lastTapSide = null;

                if (!Number.isFinite(this.videoPlayer.duration) || this.videoPlayer.duration <= 0) return;
                this.userGestureUntil = Date.now() + 1200;

                if (side === 'left') {
                    this.videoPlayer.currentTime = Math.max(0, this.videoPlayer.currentTime - SEEK_STEP);
                    triggerAnimation('fa-undo');
                } else {
                    this.videoPlayer.currentTime = Math.min(this.videoPlayer.duration, this.videoPlayer.currentTime + SEEK_STEP);
                    triggerAnimation('fa-redo');
                }
            } else {
                lastTapTime = now;
                lastTapSide = side;
                singleTapTimeout = setTimeout(() => {
                    // Single-tap → Toggle controls
                    lastTapTime = 0;
                    lastTapSide = null;
                    if (wrapper.classList.contains('show-controls')) {
                        hideControls(true); // Mobile tap: force hide (paused olsa bile)
                    } else {
                        showControls();
                    }
                }, 300);
            }
        };

        const toggleControls = (e) => {
            // Eğer tıklanan eleman interaktif ise sadece süreyi yenile (veya input ise)
            if (e && e.target.closest('.bottom-controls, .player-header, .ctrl-btn, .subtitle-modal, input, .button')) {
                showControls();
                return;
            }

            // Modern Player UX:
            // Masaüstü: Tıkla -> Oynat/Durdur
            // Mobil: Çift dokunma -> Seek, Tek dokunma -> Kontrolleri Aç/Kapa
            const isDesktop = window.innerWidth > 1024;

            if (isDesktop) {
                togglePlay();
                triggerAnimation(this.videoPlayer.paused ? 'fa-pause' : 'fa-play');
                showControls();
            } else {
                handleMobileTap(e);
            }
        };

        // Hareket takibi (Sadece Mouse için - Touch cihazlarda click/tap çalışır)
        wrapper.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'touch') return; // Dokunmatik cihazlarda hover emülasyonunu engelle
            showControls();
        });

        // Click / Tap (Toggle)
        wrapper.addEventListener('click', (e) => {
            toggleControls(e);
        });

        // Long press: show seek buttons on very small screens
        wrapper.addEventListener('touchstart', (e) => {
            const isControlHit = e.target.closest('.bottom-controls, .control-row, .ctrl-btn, .progress-container, .volume-group');
            if (isControlHit || window.innerWidth > 480) return;

            clearTimeout(longPressTimer);
            longPressTimer = setTimeout(() => {
                showControls();
                showSeekButtonsTemporarily();
            }, 450);
        }, { passive: true });

        wrapper.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        }, { passive: true });

        wrapper.addEventListener('touchcancel', () => {
            clearTimeout(longPressTimer);
        }, { passive: true });

        // ── Buffering Spinner Helpers ──
        let bufferSpinnerTimer = null;

        const hideBufferSpinner = () => {
            if (bufferSpinnerTimer) { clearTimeout(bufferSpinnerTimer); bufferSpinnerTimer = null; }
            if (this.loadingOverlay) {
                this.loadingOverlay.style.display = 'none';
                this.loadingOverlay.classList.remove('is-buffering');
            }
        };

        const showBufferSpinner = () => {
            if (this.loadingOverlay) {
                this.loadingOverlay.classList.add('is-buffering');
                this.loadingOverlay.style.display = 'flex';
            }
            // Güvenlik: 8s sonra hâlâ görünüyorsa otomatik gizle
            if (bufferSpinnerTimer) clearTimeout(bufferSpinnerTimer);
            bufferSpinnerTimer = setTimeout(hideBufferSpinner, 8000);
        };

        // Video durumu değişiklikleri
        this.videoPlayer.addEventListener('play', () => {
            showControls();
            hideBufferSpinner();
        });

        // playing: buffering sonrası da spinner'ı temizle (play tetiklenmez)
        this.videoPlayer.addEventListener('playing', () => {
            hideBufferSpinner();
        });

        this.videoPlayer.addEventListener('pause', showControls);

        this.videoPlayer.addEventListener('waiting', () => {
            showControls();
            // Sadece gerçek buffering'de spinner göster
            if (!this.videoPlayer.paused && !this.isLoadingVideo) {
                showBufferSpinner();
            }
        });

        // canplay/canplaythrough: buffer bitince spinner temizle
        this.videoPlayer.addEventListener('canplay', hideBufferSpinner);
        this.videoPlayer.addEventListener('canplaythrough', hideBufferSpinner);

        // Mouse Wheel ile Ses Kontrolü
        wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = Math.sign(e.deltaY) * -1;
            const step = 0.05;
            let newVol = this.videoPlayer.volume + (delta * step);
            newVol = Math.max(0, Math.min(1, newVol));
            this.videoPlayer.volume = newVol;

            // Mute varsa kaldır
            if (newVol > 0 && this.videoPlayer.muted) this.videoPlayer.muted = false;

            // Volume Bar'ı Göster
            if (volumeSlider) {
                const group = volumeSlider.closest('.volume-group');
                if (group) {
                    group.classList.add('show-slider');

                    if (this.volumeTimer) clearTimeout(this.volumeTimer);

                    this.volumeTimer = setTimeout(() => {
                        group.classList.remove('show-slider');
                        this.volumeTimer = null;
                    }, 1500);
                }
            }

            // Kontrolleri de göster
            showControls();
        }, { passive: false });

        // Fullscreen'e girildiğinde kontrolleri zorla göster
        document.addEventListener('fullscreenchange', () => {
            showControls();
        });
        document.addEventListener('webkitfullscreenchange', () => {
            showControls();
        });

        // Özel altyazı sistemi (Native ::cue desteği yetersiz olduğu için her tarayıcıda kullanıyoruz)
        this.setupCustomSubtitles();

        // Başlangıçta kontrolleri göster
        showControls();
    }

    /**
     * Özel altyazı render sistemi
     * Native ::cue CSS'i gelişmiş stilleri desteklemediği için bu overlay'i kullanıyoruz.
     */
    setupCustomSubtitles() {
        const subtitleOverlay = document.getElementById('custom-subtitle-overlay');
        if (!subtitleOverlay) return;

        // TextTrack cue değişikliklerini dinle
        const updateSubtitleOverlay = () => {
            const tracks = this.videoPlayer.textTracks;
            let activeText = '';

            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i];
                if (track.mode === 'showing' && track.activeCues) {
                    for (let j = 0; j < track.activeCues.length; j++) {
                        const cue = track.activeCues[j];
                        if (cue.text) {
                            // HTML tag'lerini temizle (VTT formatting)
                            const cleanText = cue.text.replace(/<[^>]*>/g, '');
                            activeText += (activeText ? '\n' : '') + cleanText;
                        }
                    }
                }
            }

            if (activeText) {
                subtitleOverlay.innerHTML = `<span>${activeText}</span>`;
            } else {
                subtitleOverlay.innerHTML = '';
            }
        };

        // Her textTrack için cuechange event'i dinle
        const bindTrackEvents = () => {
            const tracks = this.videoPlayer.textTracks;
            for (let i = 0; i < tracks.length; i++) {
                tracks[i].removeEventListener('cuechange', updateSubtitleOverlay);
                tracks[i].addEventListener('cuechange', updateSubtitleOverlay);
            }
        };

        // Track'ler eklendiğinde event'leri bağla
        this.videoPlayer.textTracks.addEventListener('addtrack', bindTrackEvents);

        // Video yüklendiğinde track'leri bağla
        this.videoPlayer.addEventListener('loadedmetadata', bindTrackEvents);

        // Başlangıçta bağla
        bindTrackEvents();
    }

    setupDiagnostics() {
        if (this.toggleDiagnosticsBtn) {
            // Panel göster/gizle
            this.toggleDiagnosticsBtn.addEventListener('click', () => {
                if (this.diagnosticsPanel.style.display === 'none' || !this.diagnosticsPanel.style.display) {
                    this.diagnosticsPanel.style.display = 'block';
                    this.logger.updateDiagnosticsPanel();
                } else {
                    this.diagnosticsPanel.style.display = 'none';
                }
            });

            // Logları temizle
            document.getElementById('clear-logs').addEventListener('click', () => {
                this.logger.clear();
                this.logger.info('🧹', 'SYSTEM', 'Logs Cleared');
            });

            // Logları kopyala
            document.getElementById('copy-logs').addEventListener('click', () => {
                const logText = this.logger.getFormattedLogs();

                // Clipboard API kullanılabilir mi kontrol et (HTTPS veya localhost gerektirir)
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(logText)
                        .then(() => {
                            this.logger.info('📋', 'SYSTEM', 'Logs Copied to Clipboard');
                        })
                        .catch(err => {
                            this.logger.error('❌', 'SYSTEM', 'Clipboard Error', { 'Details': err.message });
                        });
                } else {
                    // Fallback: execCommand kullan (HTTP için)
                    try {
                        const textArea = document.createElement('textarea');
                        textArea.value = logText;
                        textArea.style.position = 'fixed';
                        textArea.style.left = '-9999px';
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        this.logger.info('📋', 'SYSTEM', 'Logs Copied to Clipboard');
                    } catch (err) {
                        this.logger.error('❌', 'SYSTEM', 'Clipboard Error', { 'Details': err.message });
                    }
                }
            });

            // Logları indir
            document.getElementById('download-logs').addEventListener('click', () => {
                const logText = this.logger.getFormattedLogs();
                const blob = new Blob([logText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `video-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
                this.logger.info('💾', 'SYSTEM', 'Logs Downloaded');
            });
        }
    }

    collectVideoLinks() {
        this.logger.info('🔍', 'FETCHER', 'Link Extraction Started');
        const container = document.getElementById('video-links-data');
        this.proxyUrl = container?.dataset.proxyUrl;
        this.proxyFallbackUrl = container?.dataset.proxyFallbackUrl;

        const videoLinks = Array.from(document.querySelectorAll('.video-link-item'));
        this.videoData = videoLinks.map(link => {
            // Altyazıları topla
            const subtitles = Array.from(link.querySelectorAll('.subtitle-item')).map(sub => {
                return {
                    name: sub.dataset.name,
                    url: sub.dataset.url
                };
            });

            return {
                name: link.dataset.name,
                url: link.dataset.url,
                referer: link.dataset.referer,
                userAgent: link.dataset.userAgent,
                subtitles: subtitles
            };
        });

        this.logger.info('✅', 'FETCHER', 'Links Found', { 'Count': this.videoData.length });
    }

    renderVideoLinks() {
        if (this.videoData.length > 4) {
            const sourceSelectBtn = document.createElement('button');
            sourceSelectBtn.id = 'source-select-btn';
            sourceSelectBtn.className = 'button button-primary';
            sourceSelectBtn.setAttribute('data-i18n', 'selection_source');
            sourceSelectBtn.innerHTML = `<i class="fas fa-server"></i> ${t('selection_source')} <i class="fas fa-ellipsis-v"></i>`;

            const updateLabel = () => {
                if (this.currentVideoIndex !== null) {
                    const currentSource = this.videoData[this.currentVideoIndex];
                    sourceSelectBtn.innerHTML = `<i class="fas fa-server"></i> ${currentSource.name} <i class="fas fa-ellipsis-v"></i>`;
                }
            };

            sourceSelectBtn.onclick = () => {
                const sourceOptions = this.videoData.map((video, index) => ({
                    label: video.name,
                    value: index,
                    action: () => {
                        this.logger.clear();
                        this.loadVideo(index);
                        updateLabel();
                        this.hideSelectionModal();
                    }
                }));

                this.showSelectionModal(t('selection_source'), 'fa-server', sourceOptions, sourceSelectBtn, this.currentVideoIndex);
            };

            this.videoLinksUI.appendChild(sourceSelectBtn);

            // İlk yüklemede de etiketi güncellemek için bir event dinleyelim veya loadVideo içinde halledelim
            window.addEventListener('video:loaded', updateLabel);
        } else {
            this.videoData.forEach((video, index) => {
                const linkButton = document.createElement('button');
                linkButton.className = 'button';
                linkButton.textContent = video.name;
                linkButton.onclick = () => {
                    this.logger.clear();
                    this.loadVideo(index);
                };
                this.videoLinksUI.appendChild(linkButton);
            });
        }
    }

    cleanup() {
        // HLS instance'ı varsa temizle
        if (this.currentHls) {
            try {
                this.currentHls.destroy();
            } catch (e) {
                this.logger.error('❌', 'HLS', 'Destroy Error', { 'Details': e.message });
            }
            this.currentHls = null;
        }

        // Zaman aşımı varsa temizle
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = null;
        }

        // Mevcut track'leri temizle (safely)
        if (this.videoPlayer) {
            this.videoPlayer.pause();
            this.videoPlayer.removeAttribute('src');
            this.videoPlayer.load();
            while (this.videoPlayer.firstChild) {
                this.videoPlayer.removeChild(this.videoPlayer.firstChild);
            }
        }
    }

    onVideoLoaded() {
        this.logger.info('🎬', 'PLAYER', 'Metadata Loaded');
    }

    onVideoCanPlay() {
        this.logger.info('▶️', 'PLAYER', 'Can Play Now');
        this.loadingOverlay.style.display = 'none';

        // Timeout'u temizle
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = null;
        }

        // Video oynatmayı dene
        if (this.videoPlayer.paused) {
            this.videoPlayer.play().catch(e => {
                this.logger.warn('⚠️', 'PLAYER', 'Autoplay Blocked', { 'Details': e.message });
            });
        }
    }

    onVideoError() {
        const error = this.videoPlayer.error;
        this.loadingOverlay.style.display = 'none';

        // Timeout'u temizle
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = null;
        }

        let errorMessage = t('video_error_message');
        let errorDetails = t('video_error_unknown');

        if (error) {
            this.logger.error('❌', 'PLAYER', `Physical Error: ${error.code}`, { 'Code': error.code });

            switch (error.code) {
                case MediaError.MEDIA_ERR_ABORTED:
                    errorDetails = t('video_error_aborted');
                    break;
                case MediaError.MEDIA_ERR_NETWORK:
                    errorDetails = t('video_error_network');
                    break;
                case MediaError.MEDIA_ERR_DECODE:
                    errorDetails = t('video_error_decode');
                    break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorDetails = t('video_error_not_supported');
                    break;
            }
        }

        // Hata mesajını kullanıcıya göster
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.innerHTML = `<strong>${errorMessage}</strong><br>${errorDetails}<br>${t('video_error_try_another')}`;

        // Önceki hata mesajlarını temizle
        document.querySelectorAll('.error-message').forEach(el => el.remove());

        // Hata mesajını oynatıcı altına ekle
        document.getElementById('video-player-container').insertAdjacentElement('afterend', errorEl);
    }

    loadVideo(index) {
        // Önceki hata mesajlarını temizle
        document.querySelectorAll('.error-message').forEach(el => el.remove());

        // Video yükleniyor
        if (this.isLoadingVideo) {
            this.logger.info('⏳', 'PLAYER', 'Loading Already in Progress');
            return;
        }

        this.isLoadingVideo = true;
        this.currentVideoIndex = index;
        this.selectedSubtitleUrl = null; // Yeni video için altyazı seçimini sıfırla
        this.logger.info('📽️', 'PLAYER', `Loading Video: ${index}`, { 'Name': this.videoData[index].name });

        // Önceki kaynakları temizle
        this.cleanup();

        const selectedVideo = this.videoData[index];

        // Loading overlay'i göster
        this.loadingOverlay.style.display = 'flex';

        // Yükleme zaman aşımı kontrolü ekle (45 saniye)
        this.loadingTimeout = setTimeout(() => {
            if (this.loadingOverlay.style.display === 'flex') {
                this.loadingOverlay.style.display = 'none';
                this.logger.error('❌', 'PLAYER', 'Loading Timeout (45s)');

                const errorEl = document.createElement('div');
                errorEl.className = 'error-message';
                errorEl.innerHTML = `<strong>${t('video_timeout_title')}</strong><br>${t('video_timeout_message')}`;
                document.getElementById('video-player-container').insertAdjacentElement('afterend', errorEl);

                this.isLoadingVideo = false;
            }
        }, 45000);

        // Video ayarları
        this.videoPlayer.muted = false;

        // Cleanup previous listeners if necessary or just use the same element
        // Removing cloneNode because it breaks custom control listeners attached in setupCustomControls
        // Re-attach core listeners to the same element (or better, use persistent ones)
        const onLoadedMetadata = () => this.onVideoLoaded();
        const onCanPlay = () => this.onVideoCanPlay();
        const onError = () => this.onVideoError();
        const onWaiting = () => {
            if (this.loadingOverlay) this.loadingOverlay.style.display = 'flex';
            this.logger.info('⌛', 'PLAYER', 'Buffering...');
        };
        const onPlaying = () => {
            if (this.loadingOverlay) this.loadingOverlay.style.display = 'none';
        };

        // Clear old ones if they were specifically named, but since we replaced the element before,
        // they were gone. Now we keep the same element.
        this.videoPlayer.removeEventListener('loadedmetadata', this._lastOnLoadedMetadata);
        this.videoPlayer.removeEventListener('canplay', this._lastOnCanPlay);
        this.videoPlayer.removeEventListener('error', this._lastOnError);
        this.videoPlayer.removeEventListener('waiting', this._lastOnWaiting);
        this.videoPlayer.removeEventListener('playing', this._lastOnPlaying);

        this._lastOnLoadedMetadata = onLoadedMetadata;
        this._lastOnCanPlay = onCanPlay;
        this._lastOnError = onError;
        this._lastOnWaiting = onWaiting;
        this._lastOnPlaying = onPlaying;

        this.videoPlayer.addEventListener('loadedmetadata', onLoadedMetadata);
        this.videoPlayer.addEventListener('canplay', onCanPlay);
        this.videoPlayer.addEventListener('error', onError);
        this.videoPlayer.addEventListener('waiting', onWaiting);
        this.videoPlayer.addEventListener('playing', onPlaying);

        // Orijinal URL'i al
        const originalUrl = selectedVideo.url;
        // Referer ve userAgent bilgilerini al (boşsa fallback kullanma)
        const referer = selectedVideo.referer || '';
        const userAgent = selectedVideo.userAgent || '';

        // Proxy URL'i oluştur (Go/Python fallback destekli)
        let proxyUrl = this.buildProxyUrl(originalUrl, userAgent, referer, 'video');

        this.logger.info('🔌', 'PROXY', 'Generated URL', { 'Url': proxyUrl });


        // Video formatını proxy'den Content-Type ile belirle
        this.logger.info('🔎', 'FETCHER', 'Detecting Format (HEAD Request)');

        fetch(proxyUrl, { method: 'HEAD' })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

                const contentType = response.headers.get('content-type') || '';
                this.logger.info('📄', 'FETCHER', 'Content-Type Received', { 'Type': contentType });

                // HLS formats
                const isHLS = contentType.includes('mpegurl') || contentType.includes('x-mpegurl');
                // MP4 / Generic
                const isVideo = contentType.includes('video/') || contentType.includes('mp4');

                if (isHLS) {
                    this.loadHLSVideo(originalUrl, referer, userAgent);
                } else if (isVideo) {
                    this.loadNormalVideo(proxyUrl, originalUrl);
                } else {
                    // Octet-stream veya bilinmeyen tip - URL uzantısına bak
                    const urlFormat = detectFormat(originalUrl);
                    if (urlFormat === 'hls') {
                        this.loadHLSVideo(originalUrl, referer, userAgent);
                    } else {
                        this.loadNormalVideo(proxyUrl, originalUrl);
                    }
                }
            })
            .catch(error => {
                this.logger.warn('⚠️', 'FETCHER', 'HEAD Request Failed', { 'Details': error.message });

                // Fallback: URL pattern'den format tespiti
                const urlFormat = detectFormat(originalUrl);
                if (urlFormat === 'hls') {
                    this.loadHLSVideo(originalUrl, referer, userAgent);
                } else {
                    this.loadNormalVideo(proxyUrl, originalUrl);
                }
            });

        // Altyazıları ekle
        const ccBtn = document.getElementById('custom-cc');

        // Varsayılan altyazıyı önceden belirle (Buton metni ve track ayarları için)
        let defaultIndex = 0;
        if (selectedVideo.subtitles && selectedVideo.subtitles.length > 0) {
            const forcedIdx = selectedVideo.subtitles.findIndex(s => s.name === 'FORCED');
            const trIdx = selectedVideo.subtitles.findIndex(s => s.name === 'TR');
            if (forcedIdx !== -1) defaultIndex = forcedIdx;
            else if (trIdx !== -1) defaultIndex = trIdx;
        }

        if (selectedVideo.subtitles && selectedVideo.subtitles.length > 0) {
            this.logger.info('💬', 'SUBTITLE', 'Subtitles Loaded', { 'Count': selectedVideo.subtitles.length });
            if (ccBtn) {
                ccBtn.style.display = 'flex';
                ccBtn.classList.add('active');
            }

            let subtitleSelectBtn = document.getElementById('subtitle-select-btn');
            // Birden fazla altyazı varsa, kaynak listesine altyazı seçim butonu ekle
            if (selectedVideo.subtitles.length > 1) {
                // Mevcut altyazı seçim butonunu kontrol et
                if (!subtitleSelectBtn) {
                    subtitleSelectBtn = document.createElement('button');
                    subtitleSelectBtn.id = 'subtitle-select-btn';
                    subtitleSelectBtn.className = 'button button-secondary';
                    subtitleSelectBtn.style.marginLeft = 'auto'; // Sağa yasla
                    subtitleSelectBtn.style.marginTop = 'var(--spacing-sm)';

                    // Kaynak listesinin yanına ekle
                    const sourceSelection = document.querySelector('.source-selection');
                    if (sourceSelection) {
                        sourceSelection.appendChild(subtitleSelectBtn);
                    }
                }

                // Seçili altyazıyı güncelle (buton etiketinde göster)
                const defaultSubName = selectedVideo.subtitles[defaultIndex]?.name || selectedVideo.subtitles[0].name;
                const currentSubName = this.selectedSubtitleUrl
                    ? selectedVideo.subtitles.find(s => s.url === this.selectedSubtitleUrl)?.name || t('selection_selected')
                    : defaultSubName;
                subtitleSelectBtn.innerHTML = `<i class="fas fa-closed-captioning"></i> ${currentSubName} <i class="fas fa-ellipsis-v"></i>`;

                // Tıklama olayını güncelle
                subtitleSelectBtn.onclick = (e) => {
                    const subOptions = selectedVideo.subtitles.map(s => ({
                        label: s.name,
                        value: s.url,
                        action: () => this.changeSubtitle(s)
                    }));
                    // "Kapalı" seçeneğini ekle
                    subOptions.unshift({
                        label: t('off'),
                        value: null,
                        action: () => this.changeSubtitle(null)
                    });

                    this.showSelectionModal(t('selection_subtitle'), 'fa-closed-captioning', subOptions, subtitleSelectBtn, this.selectedSubtitleUrl);
                };
            } else {
                // Tek altyazı varsa butonu kaldır
                if (subtitleSelectBtn) {
                    subtitleSelectBtn.remove();
                    subtitleSelectBtn = null;
                }
            }

            // Seçili altyazı bilgisini hemen ayarla (modal açılırsa doğru gözüksün)
            this.selectedSubtitleUrl = selectedVideo.subtitles[defaultIndex].url;

            selectedVideo.subtitles.forEach((subtitle, index) => {
                try {
                    // Altyazı proxy URL'ini oluştur (Go/Python fallback destekli)
                    let subtitleProxyUrl = this.buildProxyUrl(subtitle.url, userAgent, referer, 'subtitle');

                    // Altyazı track elementini oluştur
                    const track = document.createElement('track');
                    track.kind = 'subtitles';
                    track.label = subtitle.name;
                    track.srclang = subtitle.name.toLowerCase();
                    track.src = subtitleProxyUrl; // Proxy URL'ini kullan

                    // Belirlenen altyazıyı varsayılan olarak işaretle
                    if (index === defaultIndex) {
                        track.default = true;
                    }

                    // Error handling
                    track.onerror = () => {
                        this.logger.error('❌', 'SUBTITLE', 'Load Failed', { 'Name': subtitle.name });
                        // Eğer başka başarılı track yoksa butonu gizleyelim
                        const activeTracks = Array.from(this.videoPlayer.textTracks).filter(t => t.mode !== 'disabled');
                        if (activeTracks.length === 0 && ccBtn) {
                            ccBtn.style.display = 'none';
                            ccBtn.classList.remove('active');
                        }
                    };

                    this.videoPlayer.appendChild(track);

                    // Tarayıcı bazen default=true olsa da göstermez, zorla açalım
                    if (index === defaultIndex) {
                        setTimeout(() => {
                            if (this.videoPlayer.textTracks && this.videoPlayer.textTracks[index]) {
                                this.videoPlayer.textTracks[index].mode = 'showing';
                                this.logger.info('✅', 'SUBTITLE', 'Auto-activated', { 'Name': subtitle.name });

                                // Buton metnini ve tooltip'i güncelle
                                const ssBtn = document.getElementById('subtitle-select-btn');
                                if (ssBtn) {
                                    ssBtn.innerHTML = `<i class="fas fa-closed-captioning"></i> ${subtitle.name} <i class="fas fa-ellipsis-v"></i>`;
                                }
                                this.setSubtitleTooltip(subtitle.name);
                            }
                        }, 200);
                    }

                    this.logger.info('➕', 'SUBTITLE', 'Added', { 'Name': subtitle.name });
                } catch (error) {
                    this.logger.error('❌', 'SUBTITLE', 'Addition Error', { 'Name': subtitle.name, 'Details': error.message });
                }
            });
        } else if (ccBtn) {
            ccBtn.style.display = 'none';
            ccBtn.classList.remove('active');
            this.setSubtitleTooltip(null);

            // Altyazı butonu yoksa kaldır
            const subtitleSelectBtn = document.getElementById('subtitle-select-btn');
            if (subtitleSelectBtn) {
                subtitleSelectBtn.remove();
            }
        }

        // Aktif buton stilini güncelle
        const allButtons = this.videoLinksUI.querySelectorAll('button');
        allButtons.forEach((btn, i) => {
            if (i === index) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Watch Buddy butonunun linkini güncelle
        this.updateWatchPartyButtons();

        // Video yükleme tamamlandı (asenkron işlemler devam edebilir ama UI hazır)
        this.isLoadingVideo = false;

        // Kaynak seçim butonu varsa etiketini güncellemek için event fırlat
        window.dispatchEvent(new CustomEvent('video:loaded', { detail: { index } }));
    }

    /**
     * WatchBuddy butonlarını güncelle
     */
    updateWatchPartyButtons() {
        if (this.currentVideoIndex === null) return;

        const selectedVideo = this.videoData[this.currentVideoIndex];
        if (!selectedVideo) return;

        const watchPartyButton = document.getElementById('watch-party-button');
        const watchPartyAppButton = document.getElementById('watch-party-app-button');

        if (!watchPartyButton && !watchPartyAppButton) return;

        // Referer ve userAgent bilgilerini al
        const referer = selectedVideo.referer || '';
        const userAgent = selectedVideo.userAgent || '';

        // Generate strictly 8-character uppercase HEX ID
        const newRoomId = (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0')).toUpperCase();
        const wpParams = new URLSearchParams();
        wpParams.set('url', selectedVideo.url);

        // Sayfa başlığını al (player-title elementinden)
        const playerTitleEl = document.querySelector('.player-title');
        const pageTitle = playerTitleEl ? playerTitleEl.textContent.trim() : document.title;
        wpParams.set('title', `${pageTitle} | ${selectedVideo.name}`);
        wpParams.set('user_agent', userAgent || '');
        wpParams.set('referer', referer || '');

        // Seçilen altyazıyı kullan (yoksa ilk altyazıyı kullan)
        const subtitleUrl = this.selectedSubtitleUrl ||
            (selectedVideo.subtitles && selectedVideo.subtitles.length > 0 ? selectedVideo.subtitles[0].url : null);

        if (subtitleUrl) {
            wpParams.set('subtitle', subtitleUrl);
        }

        if (this.proxyUrl) {
            wpParams.set('proxy_url', this.proxyUrl);
        }


        // Web Butonu guncelle
        if (watchPartyButton) {
            watchPartyButton.href = `https://watchbuddy.tv/room/${newRoomId}?${wpParams.toString()}`;
        }

        // Uygulama (Deep Link) Butonu guncelle
        if (watchPartyAppButton) {
            // Sadece mobil cihazlarda göster
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (isMobile) {
                watchPartyAppButton.style.display = 'inline-flex';
                // watchbuddy://room/ROOM_ID?params...
                watchPartyAppButton.href = `watchbuddy://room/${newRoomId}?${wpParams.toString()}`;
            } else {
                watchPartyAppButton.style.display = 'none';
            }
        }

        this.logger.info('🤝', 'UI', 'WatchBuddy Buttons Updated', { 'Subtitle': subtitleUrl ? 'Available' : 'None' });
    }

    /**
     * HLS Ses izlerini kontrol et ve gerekirse UI oluştur
     */
    checkHlsAudioTracks(hls) {
        const audioBtn = document.getElementById('custom-audio');

        if (hls.audioTracks && hls.audioTracks.length > 1) {
            this.logger.info('🔊', 'AUDIO', 'Audio Tracks Found', { 'Count': hls.audioTracks.length });
            let currentIndex = typeof hls.audioTrack === 'number' ? hls.audioTrack : 0;
            if (currentIndex < 0 || currentIndex >= hls.audioTracks.length) {
                currentIndex = 0;
            }
            const currentTrack = hls.audioTracks[currentIndex];
            const currentLabel = currentTrack?.name || currentTrack?.lang || t('audio_track_label', { index: currentIndex + 1 });
            this.setAudioTooltip(currentLabel);

            if (audioBtn) {
                audioBtn.style.display = 'block'; // Butonu göster

                // Tıklama olayı (Tekrar tekrar eklememek için kontrol et veya replace et)
                // En temizi: eski listener'ı kaldırmak zordur, cloneNode ile temizleyelim
                const newBtn = audioBtn.cloneNode(true);
                audioBtn.parentNode.replaceChild(newBtn, audioBtn);
                newBtn.style.display = 'block';

                newBtn.onclick = () => {
                    this.showSelectionModal(
                        t('selection_audio'),
                        'fa-headphones-alt',
                        hls.audioTracks.map((track, index) => ({
                            label: track.name || track.lang || t('audio_track_label', { index: index + 1 }),
                            value: index,
                            action: () => {
                                try {
                                    hls.audioTrack = index;
                                    const label = track.name || track.lang || t('audio_track_label', { index: index + 1 });
                                    this.setAudioTooltip(label);
                                    this.logger.info('🔊', 'AUDIO', 'Track Changed', { 'Target': track.name || index });
                                    this.hideSelectionModal();
                                } catch(e) {
                                    this.logger.error('❌', 'AUDIO', 'Change Error', { 'Details': e.message });
                                }
                            }
                        })),
                        newBtn,
                        hls.audioTrack
                    );
                };
            }

        } else if (audioBtn) {
            audioBtn.style.display = 'none';
            this.setAudioTooltip(null);
        }
    }

    loadHLSVideo(originalUrl, referer, userAgent, useProxy = false) {
        this.logger.info('🚀', 'HLS', 'Starting HLS.js', { 'Mode': useProxy ? 'Forced Proxy' : 'Smart' });
        this.retryCount = 0;

        // Uzak sunucunun origin'ini al (absolute path'leri çözümlemek için)
        const { origin, baseUrl } = parseRemoteUrl(originalUrl);
        this.lastLoadedOrigin = origin;
        this.lastLoadedBaseUrl = baseUrl;

        // HLS video için
        if (Hls.isSupported()) {
            try {
                // HLS.js yapılandırması
                const initialMode = useProxy ? ProxyMode.FULL : (window.PROXY_ENABLED === false ? ProxyMode.NONE : suggestInitialMode(originalUrl));
                this.currentProxyMode = initialMode; // video-utils xhrSetup bunu okuyacak
                this.logger.info('⚙️', 'HLS', 'Initial Proxy Mode', { 'Mode': initialMode });

                const hlsConfig = createHlsConfig(userAgent, referer, this, initialMode);
                const hls = new Hls(hlsConfig);
                this.currentHls = hls;

                // HLS hata olaylarını dinle
                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        this.logger.error('❌', 'HLS', 'Fatal Error', { 'Details': data.details });

                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                this.retryCount++;
                                if (this.retryCount <= 2) {
                                    this.logger.info('🔄', 'HLS', `Retrying Network Error (${this.retryCount}/2)`);
                                    hls.startLoad();
                                } else if (!useProxy && window.PROXY_ENABLED !== false) {
                                    this.logger.warn('🛡️', 'HLS', 'Network Issues, escalating to Proxy Mode...');
                                    this.cleanup();
                                    this.loadHLSVideo(originalUrl, referer, userAgent, true);
                                } else {
                                    this.onVideoError();
                                }
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                this.logger.info('🔧', 'HLS', 'Media Error, attempting recovery...');
                                hls.recoverMediaError();
                                break;
                            default:
                                this.cleanup();
                                this.onVideoError();
                                break;
                        }
                    }
                });

                hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                    this.logger.info('✅', 'HLS', 'Manifest Parsed Successfully');
                    this.retryCount = 0;

                    // Ses izlerini kontrol et
                    this.checkHlsAudioTracks(hls);
                });

                // Ses izleri güncellendiğinde de kontrol et
                hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
                     this.checkHlsAudioTracks(hls);
                });

                // Manifest kaynağını belirle
                const loadUrl = useProxy ? buildServiceProxyUrl(originalUrl, userAgent, referer, 'video') : originalUrl;
                this.logger.info('🔑', 'HLS', 'Final Resource URL', { 'Origin': useProxy ? 'Proxy' : 'Direct', 'Url': loadUrl });

                hls.loadSource(loadUrl);
                hls.attachMedia(this.videoPlayer);
            } catch (error) {
                this.logger.error('❌', 'HLS', 'Startup Error', { 'Details': error.message });
                this.onVideoError();
            }
        } else if (this.videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS desteği (Safari/iOS)
            this.logger.info('🍎', 'HLS', 'Native Engine Used');
            const loadUrl = buildServiceProxyUrl(originalUrl, userAgent, referer, 'video');
            this.videoPlayer.src = loadUrl;
            this.videoPlayer.load();
        } else {
            this.logger.error('❌', 'HLS', 'Engine Not Supported');
            this.onVideoError();
        }
    }

    loadNormalVideo(proxyUrl, originalUrl) {
        this.logger.info('🎬', 'PLAYER', 'Loading MP4/Generic Format');

        try {
            // MKV dosyaları için ek seçenekler
            if (originalUrl.includes('.mkv')) {
                this.videoPlayer.setAttribute('type', 'video/x-matroska');
                this.logger.info('📦', 'PLAYER', 'MKV Format Forced');
            }

            this.videoPlayer.src = proxyUrl;
            this.videoPlayer.load(); // Bazı tarayıcılarda (Safari/Mobile) şart
        } catch (error) {
            this.logger.error('❌', 'PLAYER', 'Load Error', { 'Details': error.message });
            this.onVideoError();
        }
    }

    loadHlsLibrary() {
        this.logger.info('📦', 'SYSTEM', 'Loading HLS.js Library...');
        const hlsScript = document.createElement('script');
        hlsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.12/hls.min.js';
        hlsScript.onload = () => {
            this.logger.info('✅', 'SYSTEM', 'HLS.js Library Loaded');
            // Sayfa yüklendiğinde ilk videoyu yükle (HLS.js yüklendikten sonra)
            if (this.videoData.length > 0) {
                this.loadVideo(0);
            } else {
                this.logger.warn('⚠️', 'SYSTEM', 'No Video Sources Found');
            }
        };
        hlsScript.onerror = () => {
            this.logger.error('❌', 'SYSTEM', 'HLS.js Library Failed to Load');
            // Hata mesajını göster
            const errorEl = document.createElement('div');
            errorEl.className = 'error-message';
            errorEl.innerHTML = `<strong>${t('hls_load_failed_title')}</strong><br>${t('hls_load_failed_message')}`;
            document.getElementById('video-player-container').insertAdjacentElement('afterend', errorEl);
        };
        document.head.appendChild(hlsScript);
    }

    setupGlobalErrorHandling() {
        this.videoPlayer.addEventListener('error', (e) => {
            this.logger.error('❌', 'PLAYER', 'Global Video Error', { 'Details': e.message });
        });
    }

    /**
     * Seçim modalını ayarla (Genel)
     */
    setupSelectionModal() {
        if (!this.selectionModal) return;

        // Pencere boyutu değişince kapat (Responsive güvenliği)
        window.addEventListener('resize', () => {
            if (this.selectionModal.style.display !== 'none') {
                this.hideSelectionModal();
            }
        });

        // ESC tuşu ile kapat
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.selectionModal.style.display !== 'none') {
                this.hideSelectionModal();
            }
        });

        // Dışına tıklayınca kapat
        document.addEventListener('mousedown', (e) => {
            if (this.selectionModal.style.display !== 'none') {
                const isClickInside = this.selectionModal.contains(e.target);
                const isClickOnTrigger = e.target.closest('#custom-cc, #custom-audio, #subtitle-select-btn, #source-select-btn');

                if (!isClickInside && !isClickOnTrigger) {
                    this.hideSelectionModal();
                }
            }
        });
    }

    /**
     * Seçim dropdownını göster (Genel)
     * @param {string} title - Başlık
     * @param {string} iconClass - İkon sınıfı
     * @param {Array} items - { label, value, action } objeleri
     * @param {HTMLElement} trigger - Tetikleyici element (konumlandırma için)
     * @param {any} currentValue - Mevcut seçili değer
     */
    showSelectionModal(title, iconClass, items, trigger, currentValue = undefined) {
        if (!this.selectionModal || !this.selectionList) return;

        // Toggle Mantığı: Eğer zaten açıksa ve aynı trigger tıklandıysa kapat
        if (this.selectionModal.style.display !== 'none' && this.lastSelectionTrigger === trigger) {
            this.hideSelectionModal();
            return;
        }

        // Aktif trigger'ı kaydet
        this.lastSelectionTrigger = trigger;

        // Başlık ve İkonu Güncelle
        const titleEl = document.getElementById('modal-title');
        const iconEl = document.getElementById('modal-icon');

        if (titleEl) titleEl.querySelector('span').textContent = title;
        if (iconEl) iconEl.className = `fas ${iconClass}`;

        // Önceki listeyi temizle
        this.selectionList.innerHTML = '';

        items.forEach((item) => {
            const btn = document.createElement('button');
            btn.className = 'subtitle-item-btn';

            // Aktif öğeyi işaretle
            if (currentValue !== undefined && item.value === currentValue) {
                btn.classList.add('active');
            }

            btn.innerHTML = `
                <i class="fas ${currentValue !== undefined && item.value === currentValue ? 'fa-check-circle' : iconClass}"></i>
                <span>${item.label}</span>
            `;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (item.action) item.action();
                else this.hideSelectionModal();
            });
            this.selectionList.appendChild(btn);
        });

        // Konumlandırma
        if (trigger) {
            const isInsidePlayer = trigger.closest('#video-player-wrapper');
            const wrapper = document.getElementById('video-player-wrapper');

            // Elemanı ilgili kapsayıcıya taşı (Tam ekran ve konumlandırma için)
            if (isInsidePlayer) {
                if (this.selectionModal.parentElement !== wrapper) {
                    wrapper.appendChild(this.selectionModal);
                }
            } else {
                const container = document.querySelector('.detail-container');
                if (this.selectionModal.parentElement !== container) {
                    container.appendChild(this.selectionModal);
                }
            }

            this.selectionModal.style.display = 'flex';
            const rect = trigger.getBoundingClientRect();
            const dropdownRect = this.selectionModal.getBoundingClientRect();

            if (isInsidePlayer) {
                // Player içindeki kontrollerde trigger elementine göre pozisyon al
                // trigger.offsetLeft wrapper'a göre değilse (iç içe divler varsa) getBoundingClientRect kullanmak daha güvenli
                const wrapperRect = wrapper.getBoundingClientRect();
                const triggerLeft = rect.left - wrapperRect.left;
                const triggerBottom = wrapperRect.bottom - rect.top;

                this.selectionModal.style.position = 'absolute';
                this.selectionModal.style.bottom = `${triggerBottom + 10}px`;
                this.selectionModal.style.left = `${triggerLeft + (rect.width / 2) - (dropdownRect.width / 2)}px`;
                this.selectionModal.style.top = 'auto';
            } else {
                // Player dışındaki buton
                const scrollY = window.scrollY || window.pageYOffset;
                this.selectionModal.style.position = 'absolute';
                this.selectionModal.style.top = `${rect.bottom + scrollY + 5}px`;
                this.selectionModal.style.left = `${rect.left + (rect.width / 2) - (dropdownRect.width / 2)}px`;
                this.selectionModal.style.bottom = 'auto';
            }


            // Ekran dışına taşma kontrolü
            const finalRect = this.selectionModal.getBoundingClientRect();
            if (finalRect.left < 10) {
                this.selectionModal.style.left = '10px';
            } else if (finalRect.right > window.innerWidth - 10) {
                this.selectionModal.style.left = `${window.innerWidth - finalRect.width - 10}px`;
            }
        } else {
            this.selectionModal.style.display = 'flex';
        }
    }

    /**
     * Seçim dropdownını gizle
     */
    hideSelectionModal() {
        if (this.selectionModal) {
            this.selectionModal.style.display = 'none';
            this.lastSelectionTrigger = null;
        }
    }

    /**
     * Altyazıyı değiştir (Player ve UI)
     */
    changeSubtitle(subtitle) {
        const tracks = Array.from(this.videoPlayer.textTracks);
        const subtitleSelectBtn = document.getElementById('subtitle-select-btn');

        if (!subtitle) {
            // Altyazı kapat
            this.selectedSubtitleUrl = null;
            this.logger.info('🔇', 'SUBTITLE', 'Closed');
            tracks.forEach(track => track.mode = 'hidden');
            if (subtitleSelectBtn) subtitleSelectBtn.innerHTML = `<i class="fas fa-closed-captioning"></i> ${t('off')} <i class="fas fa-ellipsis-v"></i>`;
            this.setSubtitleTooltip(t('off'));

            const ccBtn = document.getElementById('custom-cc');
            if (ccBtn) ccBtn.classList.remove('active');
        } else {
            // Altyazı aç/değiştir
            this.selectedSubtitleUrl = subtitle.url;
            this.logger.info('💬', 'SUBTITLE', 'Switched', { 'Name': subtitle.name });

            tracks.forEach(track => {
                if (track.label === subtitle.name) {
                    track.mode = 'showing';
                } else {
                    track.mode = 'hidden';
                }
            });

            if (subtitleSelectBtn) subtitleSelectBtn.innerHTML = `<i class="fas fa-closed-captioning"></i> ${subtitle.name} <i class="fas fa-ellipsis-v"></i>`;
            this.setSubtitleTooltip(subtitle.name);

            const ccBtn = document.getElementById('custom-cc');
            if (ccBtn) ccBtn.classList.add('active');
        }

        this.updateWatchPartyButtons();
        this.hideSelectionModal();
    }
}
