// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import VideoLogger from './VideoLogger.min.js';
import { detectFormat } from '../video-utils.min.js';

export default class VideoPlayer {
    constructor() {
        // Logger oluştur (debug modu açık)
        this.logger = new VideoLogger(true);

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
    }

    async init() {
        // Servis tespiti kaldırıldı
        
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
            handleSeekMove(e); // Update UI immediately

            document.addEventListener('mousemove', handleSeekMove);
            document.addEventListener('mouseup', handleSeekEnd);
        });

        // Touch support
        progressContainer?.addEventListener('touchstart', (e) => {
            isDragging = true;
            // Use the first touch point
            const touch = e.touches[0];
            const fakeEvent = { pageX: touch.pageX }; 
            handleSeekMove(fakeEvent);

            const handleTouchMove = (e) => {
                const touch = e.touches[0];
                handleSeekMove({ pageX: touch.pageX });
            };

            const handleTouchEnd = (e) => {
                isDragging = false;
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
                
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
            if (document.fullscreenElement) {
                // Fullscreen'den çık
                await document.exitFullscreen().catch(() => {});
                // Orientation kilidini kaldır
                if (screen.orientation?.unlock) {
                    screen.orientation.unlock();
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
                    }
                } catch (e) {
                    this.logger.error("Tam ekran hatası", e.message);
                }
            }
        });

        // Fullscreen ve orientation yönetimi
        const handleFullscreenChange = () => {
            const isFS = !!document.fullscreenElement;
            
            // İkonu güncelle
            if (fullscreenBtn) {
                const icon = fullscreenBtn.querySelector('i');
                if (icon) icon.className = `fas ${isFS ? 'fa-compress' : 'fa-expand'}`;
            }

            // Fullscreen'den çıkınca orientation kilidini kaldır
            if (!isFS && screen.orientation?.unlock) {
                screen.orientation.unlock().catch(() => {});
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

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
                
                this.showSelectionModal(
                    'Altyazı Seç', 
                    'fa-closed-captioning', 
                    this.videoData[this.currentVideoIndex].subtitles.map(s => ({
                        label: s.name,
                        value: s,
                        action: () => this.changeSubtitle(s)
                    }))
                );

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
                hideTimeout = setTimeout(() => {
                    hideControls();
                }, 3000);
            }
        };

        const hideControls = () => {
            if (this.videoPlayer.paused) return; // Paused iken asla gizleme
            wrapper.classList.remove('show-controls');
            if (document.fullscreenElement) {
                wrapper.style.cursor = 'none';
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
            // Mobil: Tıkla -> Kontrolleri Aç/Kapa
            const isDesktop = window.innerWidth > 1024;

            if (isDesktop) {
                togglePlay();
                triggerAnimation(this.videoPlayer.paused ? 'fa-pause' : 'fa-play');
                showControls();
            } else {
                if (wrapper.classList.contains('show-controls')) {
                    hideControls();
                } else {
                    showControls();
                }
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

        // Video durumu değişiklikleri
        this.videoPlayer.addEventListener('play', () => {
            showControls();
            if (this.loadingOverlay) {
                this.loadingOverlay.style.display = 'none';
                this.loadingOverlay.classList.remove('is-buffering');
            }
        });
        
        this.videoPlayer.addEventListener('pause', showControls);
        
        this.videoPlayer.addEventListener('waiting', () => {
            showControls();
            if (this.loadingOverlay && !this.videoPlayer.paused) {
                this.loadingOverlay.classList.add('is-buffering');
                this.loadingOverlay.style.display = 'flex';
            }
        });

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
                this.logger.info('Loglar temizlendi');
            });

            // Logları kopyala
            document.getElementById('copy-logs').addEventListener('click', () => {
                const logText = this.logger.getFormattedLogs();
                
                // Clipboard API kullanılabilir mi kontrol et (HTTPS veya localhost gerektirir)
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(logText)
                        .then(() => {
                            this.logger.info('Loglar panoya kopyalandı');
                        })
                        .catch(err => {
                            this.logger.error('Kopyalama hatası', err.message);
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
                        this.logger.info('Loglar panoya kopyalandı');
                    } catch (err) {
                        this.logger.error('Kopyalama hatası', err.message);
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
                this.logger.info('Loglar indirildi');
            });
        }
    }

    collectVideoLinks() {
        this.logger.info('Video linkleri toplanıyor');
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

        this.logger.info(`${this.videoData.length} video kaynağı bulundu`);
    }

    renderVideoLinks() {
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

    cleanup() {
        // HLS instance'ı varsa temizle
        if (this.currentHls) {
            try {
                this.currentHls.destroy();
            } catch (e) {
                this.logger.error('HLS destroy hatası', e.message);
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
        this.logger.info('Video metadata yüklendi');
    }

    onVideoCanPlay() {
        this.logger.info('Video oynatılabilir');
        this.loadingOverlay.style.display = 'none';

        // Timeout'u temizle
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = null;
        }

        // Video oynatmayı dene
        if (this.videoPlayer.paused) {
            this.videoPlayer.play().catch(e => {
                this.logger.warn('Video otomatik başlatılamadı', e.message);
                // Kullanıcıya bilgi ver
                const playHint = document.createElement('div');
                playHint.className = 'play-hint';
                playHint.innerHTML = '<i class="fas fa-play"></i><br>Oynatmak için tıklayın';
                playHint.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: white;
                    font-size: 1.2rem;
                    text-align: center;
                    pointer-events: none;
                    z-index: 10;
                    text-shadow: 0 0 10px rgba(0,0,0,0.8);
                `;
                this.videoPlayer.parentElement.appendChild(playHint);
                
                // 3 saniye sonra gizle
                setTimeout(() => {
                    if (playHint.parentElement) {
                        playHint.remove();
                    }
                }, 3000);
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

        let errorMessage = 'Video yüklenirken bir hata oluştu.';
        let errorDetails = 'Bilinmeyen hata';

        if (error) {
            this.logger.error(`Video hatası: ${error.code}`, error);

            switch (error.code) {
                case MediaError.MEDIA_ERR_ABORTED:
                    errorDetails = 'Yükleme kullanıcı tarafından iptal edildi.';
                    break;
                case MediaError.MEDIA_ERR_NETWORK:
                    errorDetails = 'Ağ hatası nedeniyle yükleme başarısız oldu. Bu genellikle CORS kısıtlamaları veya güvenlik politikaları nedeniyle oluşur.';
                    break;
                case MediaError.MEDIA_ERR_DECODE:
                    errorDetails = 'Video dosyası bozuk veya desteklenmeyen formatta.';
                    break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorDetails = 'Video formatı desteklenmiyor veya kaynak erişilemez.';
                    break;
            }
        }

        // Hata mesajını kullanıcıya göster
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.innerHTML = `<strong>${errorMessage}</strong><br>${errorDetails}<br>Lütfen başka bir kaynak deneyin.`;

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
            this.logger.info('Zaten bir video yükleniyor, lütfen bekleyin');
            return;
        }

        this.isLoadingVideo = true;
        this.currentVideoIndex = index;
        this.selectedSubtitleUrl = null; // Yeni video için altyazı seçimini sıfırla
        this.logger.info(`Video yükleniyor: ${index}`, this.videoData[index]);

        // Önceki kaynakları temizle
        this.cleanup();

        const selectedVideo = this.videoData[index];

        // Loading overlay'i göster
        this.loadingOverlay.style.display = 'flex';

        // Yükleme zaman aşımı kontrolü ekle (45 saniye)
        this.loadingTimeout = setTimeout(() => {
            if (this.loadingOverlay.style.display === 'flex') {
                this.loadingOverlay.style.display = 'none';
                this.logger.error('Video yükleme zaman aşımı');

                const errorEl = document.createElement('div');
                errorEl.className = 'error-message';
                errorEl.innerHTML = '<strong>Video yükleme zaman aşımı</strong><br>Video yüklenirken zaman aşımı oluştu. Lütfen başka bir kaynak deneyin veya sayfayı yenileyin.';
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
            this.logger.info('Video tamponlanıyor...');
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

        // Video formatını URL pattern ile belirle
        this.logger.info('Video formatı tespit ediliyor...');
        
        const urlFormat = detectFormat(originalUrl);
        if (urlFormat === 'hls') {
            this.loadHLSVideo(originalUrl, referer, userAgent);
        } else {
            this.loadNormalVideo(originalUrl);
        }

        // Altyazıları ekle
        const ccBtn = document.getElementById('custom-cc');
        if (selectedVideo.subtitles && selectedVideo.subtitles.length > 0) {
            this.logger.info(`${selectedVideo.subtitles.length} altyazı bulundu`);
            if (ccBtn) {
                ccBtn.style.display = 'flex';
                ccBtn.classList.add('active');
            }

            // Birden fazla altyazı varsa, kaynak listesine altyazı seçim butonu ekle
            if (selectedVideo.subtitles.length > 1) {
                // Mevcut altyazı seçim butonunu kontrol et
                let subtitleSelectBtn = document.getElementById('subtitle-select-btn');
                if (!subtitleSelectBtn) {
                    subtitleSelectBtn = document.createElement('button');
                    subtitleSelectBtn.id = 'subtitle-select-btn';
                    subtitleSelectBtn.className = 'button button-secondary';
                    subtitleSelectBtn.style.marginLeft = 'auto'; // Sağa yasla
                    
                    // Kaynak listesinin yanına ekle
                    const sourceSelection = document.querySelector('.source-selection');
                    if (sourceSelection) {
                        sourceSelection.appendChild(subtitleSelectBtn);
                    }
                }

                // Seçili altyazıyı güncelle (buton etiketinde göster)
                const currentSubName = this.selectedSubtitleUrl 
                    ? selectedVideo.subtitles.find(s => s.url === this.selectedSubtitleUrl)?.name || 'Seçili'
                    : selectedVideo.subtitles[0].name;
                subtitleSelectBtn.innerHTML = `<i class="fas fa-closed-captioning"></i> ${currentSubName}`;

                // Tıklama olayını güncelle
                subtitleSelectBtn.onclick = () => {
                    this.showSelectionModal(
                        'Altyazı Seç',
                        'fa-closed-captioning',
                        selectedVideo.subtitles.map(s => ({
                            label: s.name,
                            value: s,
                            action: () => this.changeSubtitle(s)
                        }))
                    );
                };
            } else {
                // Tek altyazı varsa butonu kaldır
                const subtitleSelectBtn = document.getElementById('subtitle-select-btn');
                if (subtitleSelectBtn) {
                    subtitleSelectBtn.remove();
                }
            }

            // Varsayılan altyazıyı belirle (FORCED > TR > İlk)
            let defaultIndex = 0;
            const forcedIdx = selectedVideo.subtitles.findIndex(s => s.name === 'FORCED');
            const trIdx = selectedVideo.subtitles.findIndex(s => s.name === 'TR');
            if (forcedIdx !== -1) defaultIndex = forcedIdx;
            else if (trIdx !== -1) defaultIndex = trIdx;

            selectedVideo.subtitles.forEach((subtitle, index) => {
                try {
                    // Altyazı track elementini oluştur
                    const track = document.createElement('track');
                    track.kind = 'subtitles';
                    track.label = subtitle.name;
                    track.srclang = subtitle.name.toLowerCase();
                    track.src = subtitle.url;

                    // Belirlenen altyazıyı varsayılan olarak işaretle
                    if (index === defaultIndex) {
                        track.default = true;
                    }

                    // Error handling
                    track.onerror = () => {
                        this.logger.error(`Altyazı yüklenemedi: ${subtitle.name}`);
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
                                this.logger.info(`Altyazı otomatik açıldı: ${subtitle.name}`);
                            }
                        }, 200);
                    }

                    this.logger.info(`Altyazı eklendi: ${subtitle.name}`);
                } catch (error) {
                    this.logger.error(`Altyazı eklenirken hata: ${subtitle.name}`, error.message);
                }
            });
        } else if (ccBtn) {
            ccBtn.style.display = 'none';
            ccBtn.classList.remove('active');
            
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

        // Video yükleme tamamlandı (asenkron işlemler devam edebilir ama UI hazır)
        this.isLoadingVideo = false;
    }

    /**
     * Altyazı seçim modalını ayarla
     */
    setupSubtitleModal() {
        if (!this.subtitleModal) return;

        const closeBtn = document.getElementById('subtitle-modal-close');
        const backdrop = this.subtitleModal.querySelector('.subtitle-modal-backdrop');

        // Kapat butonu
        closeBtn?.addEventListener('click', () => this.hideSubtitleModal());

        // Backdrop'a tıklayınca kapat
        backdrop?.addEventListener('click', () => this.hideSubtitleModal());

        // ESC tuşu ile kapat
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.subtitleModal.style.display !== 'none') {
                this.hideSubtitleModal();
            }
        });
    }

    /**
     * Altyazı seçim modalını göster
     */
    showSubtitleModal(subtitles) {
        if (!this.subtitleModal || !this.subtitleList) return;

        // Listeyi temizle
        this.subtitleList.innerHTML = '';

        // Altyazıları listele
        subtitles.forEach((sub, index) => {
            const btn = document.createElement('button');
            btn.className = 'subtitle-item-btn';
            btn.innerHTML = `
                <i class="fas fa-closed-captioning"></i>
                <span>${sub.name}</span>
                <i class="fas fa-chevron-right" style="color: var(--text-muted); font-size: 0.875rem;"></i>
            `;
            btn.addEventListener('click', () => {
                this.changeSubtitle(sub);
            });
            this.subtitleList.appendChild(btn);
        });

        // Modalı göster
        this.subtitleModal.style.display = 'flex';
    }

    /**
     * Altyazıyı değiştir (Player ve UI)
     */
    changeSubtitle(subtitle) {
        this.selectedSubtitleUrl = subtitle.url;
        this.logger.info(`Altyazı değiştiriliyor: ${subtitle.name}`);

        // 1. Player'daki track'i değiştir
        const tracks = Array.from(this.videoPlayer.textTracks);
        let found = false;
        
        tracks.forEach(track => {
            // Track label'ı veya srclang üzerinden eşleştirme
            if (track.label === subtitle.name) {
                track.mode = 'showing';
                found = true;
            } else {
                // Diğerlerini gizle
                track.mode = 'hidden';
            }
        });
        
        if (!found) {
             this.logger.warn(`Track bulunamadı: ${subtitle.name}`);
        }

        // 2. Buton metnini güncelle
        const subtitleSelectBtn = document.getElementById('subtitle-select-btn');
        if (subtitleSelectBtn) {
            subtitleSelectBtn.innerHTML = `<i class="fas fa-closed-captioning"></i> ${subtitle.name}`;
        }

        // 3. Modalı kapat
        this.hideSubtitleModal();
    }

    /**
     * Altyazı seçim modalını gizle
     */
    hideSubtitleModal() {
        if (this.subtitleModal) {
            this.subtitleModal.style.display = 'none';
        }
    }

    /**
     * HLS Ses izlerini kontrol et ve gerekirse UI oluştur
     */
    checkHlsAudioTracks(hls) {
        const audioBtn = document.getElementById('custom-audio');
        
        if (hls.audioTracks && hls.audioTracks.length > 1) {
            this.logger.info(`${hls.audioTracks.length} ses izi bulundu`);
            
            if (audioBtn) {
                audioBtn.style.display = 'block'; // Butonu göster
                
                // Tıklama olayı (Tekrar tekrar eklememek için kontrol et veya replace et)
                // En temizi: eski listener'ı kaldırmak zordur, cloneNode ile temizleyelim
                const newBtn = audioBtn.cloneNode(true);
                audioBtn.parentNode.replaceChild(newBtn, audioBtn);
                newBtn.style.display = 'block';

                newBtn.onclick = () => {
                    this.showSelectionModal(
                        'Ses Seç',
                        'fa-headphones-alt',
                        hls.audioTracks.map((track, index) => ({
                            label: track.name || track.lang || `Audio ${index + 1}`,
                            value: index,
                            action: () => {
                                try {
                                    hls.audioTrack = index;
                                    this.logger.info(`Ses değiştirildi: ${track.name || index}`);
                                    this.hideSelectionModal();
                                    
                                    // Player üzerinde bilgi göster (Opsiyonel, toast msj gibi)
                                } catch(e) {
                                    this.logger.error('Ses değiştirme hatası', e);
                                }
                            }
                        }))
                    );
                };
            }

        } else if (audioBtn) {
            audioBtn.style.display = 'none';
        }
    }

    loadHLSVideo(originalUrl, referer, userAgent) {
        this.logger.info('HLS yükleniyor: direct');
        this.retryCount = 0;
        
        // HLS video için
        if (Hls.isSupported()) {
            try {
                // HLS.js yapılandırması (direct)
                const hlsConfig = {
                    debug: false,
                    enableWorker: !/iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent),
                    capLevelToPlayerSize: true,
                    maxLoadingDelay: 4,
                    minAutoBitrate: 0,
                    maxBufferLength: /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) ? 15 : 30,
                    maxMaxBufferLength: /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) ? 30 : 600,
                    startLevel: -1,
                };
                const hls = new Hls(hlsConfig);
                this.currentHls = hls;

                // HLS hata olaylarını dinle
                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        this.logger.error('HLS fatal hata', data.details);
                        
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                this.retryCount++;
                                if (this.retryCount <= 2) {
                                    this.logger.info(`Ağ hatası, yeniden deneniyor (${this.retryCount}/2)...`);
                                    hls.startLoad();
                                } else {
                                    this.onVideoError();
                                }
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                this.logger.info('Medya hatası, kurtarılmaya çalışılıyor...');
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
                    this.logger.info('HLS manifest başarıyla analiz edildi');
                    this.retryCount = 0;
                    
                    // Ses izlerini kontrol et
                    this.checkHlsAudioTracks(hls);
                });
                
                // Ses izleri güncellendiğinde de kontrol et
                hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
                     this.checkHlsAudioTracks(hls);
                });

                // Manifest kaynağını belirle
                const loadUrl = originalUrl;
                this.logger.info('HLS Kaynağı: Direct', loadUrl);
                
                hls.loadSource(loadUrl);
                hls.attachMedia(this.videoPlayer);
            } catch (error) {
                this.logger.error('HLS yükleme hatası', error.message);
                this.onVideoError();
            }
        } else if (this.videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS desteği (Safari/iOS)
            this.logger.info('Native HLS kullanılıyor');
            this.videoPlayer.src = originalUrl;
            this.videoPlayer.load();
        } else {
            this.logger.error('HLS desteklenmiyor');
            this.onVideoError();
        }
    }

    loadNormalVideo(originalUrl) {
        this.logger.info('Normal video formatı yükleniyor');

        try {
            // MKV dosyaları için ek seçenekler
            if (originalUrl.includes('.mkv')) {
                this.videoPlayer.setAttribute('type', 'video/x-matroska');
                this.logger.info('MKV formatı tespit edildi');
            }

            this.videoPlayer.src = originalUrl;
            this.videoPlayer.load(); // Bazı tarayıcılarda (Safari/Mobile) şart
        } catch (error) {
            this.logger.error('Video yükleme hatası', error.message);
            this.onVideoError();
        }
    }

    loadHlsLibrary() {
        this.logger.info('HLS.js yükleniyor');
        const hlsScript = document.createElement('script');
        hlsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.12/hls.min.js';
        hlsScript.onload = () => {
            this.logger.info('HLS.js yüklendi');
            // Sayfa yüklendiğinde ilk videoyu yükle (HLS.js yüklendikten sonra)
            if (this.videoData.length > 0) {
                this.loadVideo(0);
            } else {
                this.logger.warn('Hiç video kaynağı bulunamadı');
            }
        };
        hlsScript.onerror = () => {
            this.logger.error('HLS.js yüklenemedi');
            // Hata mesajını göster
            const errorEl = document.createElement('div');
            errorEl.className = 'error-message';
            errorEl.innerHTML = '<strong>HLS.js yüklenemedi</strong><br>Video oynatıcı bileşeni yüklenemedi. Lütfen sayfayı yenileyin veya farklı bir tarayıcı deneyin.';
            document.getElementById('video-player-container').insertAdjacentElement('afterend', errorEl);
        };
        document.head.appendChild(hlsScript);
    }

    setupGlobalErrorHandling() {
        this.videoPlayer.addEventListener('error', (e) => {
            this.logger.error('Video Player genel hatası', e);
        });
    }

    /**
     * Seçim modalını ayarla (Genel)
     */
    setupSelectionModal() {
        if (!this.selectionModal) return;

        const closeBtn = document.getElementById('selection-modal-close');
        const backdrop = this.selectionModal.querySelector('.subtitle-modal-backdrop');

        // Kapat butonu
        closeBtn?.addEventListener('click', () => this.hideSelectionModal());

        // Backdrop'a tıklayınca kapat
        backdrop?.addEventListener('click', () => this.hideSelectionModal());

        // ESC tuşu ile kapat
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.selectionModal.style.display !== 'none') {
                this.hideSelectionModal();
            }
        });
    }

    /**
     * Seçim modalını göster (Genel)
     * @param {string} title - Modal başlığı
     * @param {string} iconClass - İkon sınıfı (örn: fa-volume-up)
     * @param {Array} items - { label, value, action } objeleri
     */
    showSelectionModal(title, iconClass, items) {
        if (!this.selectionModal || !this.selectionList) return;

        // Başlık ve İkonu Güncelle
        const titleEl = document.getElementById('modal-title');
        const iconEl = document.getElementById('modal-icon');
        
        if (titleEl) titleEl.querySelector('span').textContent = title;
        if (iconEl) iconEl.className = `fas ${iconClass}`;

        // Önceki listeyi temizle
        this.selectionList.innerHTML = '';

        // UI donmasını önlemek için DocumentFragment kullan
        const fragment = document.createDocumentFragment();

        items.forEach((item) => {
            const btn = document.createElement('button');
            btn.className = 'subtitle-item-btn';
            btn.innerHTML = `
                <i class="fas ${iconClass}"></i>
                <span>${item.label}</span>
                <i class="fas fa-chevron-right" style="color: var(--text-muted); font-size: 0.875rem;"></i>
            `;
            btn.addEventListener('click', () => {
                if (item.action) item.action();
                else this.hideSelectionModal();
            });
            fragment.appendChild(btn);
        });

        this.selectionList.appendChild(fragment);

        // Modalı göster (DOM güncellemelerinden sonra render için rAF kullan)
        requestAnimationFrame(() => {
            this.selectionModal.style.display = 'flex';
        });
    }

    /**
     * Seçim modalını gizle
     */
    hideSelectionModal() {
        if (this.selectionModal) {
            this.selectionModal.style.display = 'none';
        }
    }

    /**
     * Altyazıyı değiştir (Player ve UI)
     */
    changeSubtitle(subtitle) {
        this.selectedSubtitleUrl = subtitle.url;
        this.logger.info(`Altyazı değiştiriliyor: ${subtitle.name}`);

        const tracks = Array.from(this.videoPlayer.textTracks);
        let found = false;
        
        tracks.forEach(track => {
            if (track.label === subtitle.name) {
                track.mode = 'showing';
                found = true;
            } else {
                track.mode = 'hidden';
            }
        });
        
        if (!found) {
             this.logger.warn(`Track bulunamadı: ${subtitle.name}`);
        }

        const subtitleSelectBtn = document.getElementById('subtitle-select-btn');
        if (subtitleSelectBtn) {
            subtitleSelectBtn.innerHTML = `<i class="fas fa-closed-captioning"></i> ${subtitle.name}`;
        }

        this.hideSelectionModal();
    }
}
