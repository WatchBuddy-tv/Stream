// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

export default class BuddyLogger {
    static logs = [];
    static isDebug = false;
    static startTime = Date.now();
    static maxLogs = 200;
    static lastLog = null;

    static init(isDebug = false) {
        this.isDebug = isDebug;
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.has('debug')) this.isDebug = params.get('debug') === 'true';

            if (this.isDebug) {
                const toggleBtn = document.getElementById('toggle-diagnostics');
                if (toggleBtn) toggleBtn.style.display = 'block';
            }
        }
    }

    static get styles() {
        return {
            prefix: 'color:#EF7F1A; font-weight:bold;',
            separator: 'color:#666; font-weight:normal; margin: 0 5px;',
            category: 'color:#EF7F1A; font-weight:bold;',
            title: 'color:#ccc; font-weight:bold;',
            key: 'color:#888; margin-left:4px;',
            value: 'color:#ccc; font-weight:bold;',
            warn: 'color:#FFD700; font-weight:bold;',
            error: 'color:#FF4444; font-weight:bold;'
        };
    }

    static _print(emoji, category, title, details, level = 'info') {
        const elapsed = Math.round((Date.now() - this.startTime) / 10) / 100;
        const msgKey = `${category}|${title}|${JSON.stringify(details)}`;

        // --- Suppress Duplicates & Store ---
        if (this.lastLog && this.lastLog.key === msgKey && this.lastLog.level === level) {
            this.lastLog.count++;
            if (this.logs.length > 0) {
                const lastEntry = this.logs[this.logs.length - 1];
                lastEntry.count = this.lastLog.count;
                lastEntry.elapsed = elapsed; // Update to show latest occurrence
            }
        } else {
            this.lastLog = { key: msgKey, level, count: 1 };
            this.logs.push({ elapsed, level: level.toUpperCase(), emoji, category, title, details, count: 1 });
            if (this.logs.length > this.maxLogs) this.logs.shift();
        }

        // --- Console Output Filtering ---
        // INFO logs are hidden from console by default to prevent clutter (still stored in panel)
        // They are only printed if isDebug is explicitly active.
        let shouldPrint = true;
        if (level === 'info' && !this.isDebug) {
            shouldPrint = false;
        } else if (level === 'debug' && !this.isDebug) {
            shouldPrint = false;
        }

        if (shouldPrint) {
            let message = `%c${emoji} WatchBuddy%c|%c${category}%c|%c${title}`;
            const args = [
                this.styles.prefix,
                this.styles.separator,
                this.styles.category,
                this.styles.separator,
                level === 'error' ? this.styles.error : (level === 'warn' ? this.styles.warn : this.styles.title)
            ];

            Object.entries(details).forEach(([key, value]) => {
                const valStr = typeof value === 'object' ? JSON.stringify(value) : value;
                message += `\n%c  • ${key}: %c${valStr}`;
                args.push(this.styles.key, this.styles.value);
            });

            console.log(message, ...args);
        }

        // --- UI Update ---
        this.updateDiagnosticsPanel();
    }

    static info(emoji, category, title, details) { this._smartLog(emoji, category, title, details, 'info', 'ℹ️'); }
    static warn(emoji, category, title, details) { this._smartLog(emoji, category, title, details, 'warn', '⚠️'); }
    static error(emoji, category, title, details) { this._smartLog(emoji, category, title, details, 'error', '❌'); }
    static debug(emoji, category, title, details) { this._smartLog(emoji, category, title, details, 'debug', '🔍'); }

    static _smartLog(a, b, c, d, level, defaultEmoji) {
        if (c === undefined) {
            const details = b ? (typeof b === 'object' ? b : { 'Data': b }) : {};
            this._print(defaultEmoji, 'APP', a, details, level);
        } else {
            this._print(a, b, c, d || {}, level);
        }
    }

    static clear() {
        this.logs = [];
        this.lastLog = null;
        this.updateDiagnosticsPanel();
    }

    static getFormattedLogs() {
        return this.logs.map(e => {
            const detailsStr = e.details && Object.keys(e.details).length > 0 ? JSON.stringify(e.details) : '';
            return `[${e.elapsed}s] [${e.level}] ${e.category} | ${e.title} ${detailsStr} ${e.count > 1 ? `(x${e.count})` : ''}`;
        }).join('\n');
    }

    static updateDiagnosticsPanel() {
        if (typeof document === 'undefined') return;
        const logEl = document.getElementById('diagnostics-log');
        if (!logEl) return;

        logEl.innerHTML = this.logs.map(e => `
            <div class="log-entry">
                <div class="log-entry-header">
                    <span class="log-entry-time">[${e.elapsed}s]</span>
                    <span class="log-entry-${e.level.toLowerCase()}">[${e.level}]</span>
                    <span class="log-entry-message">${e.category} | ${e.title} ${e.count > 1 ? `(x${e.count})` : ''}</span>
                </div>
                ${e.details && Object.keys(e.details).length > 0 ? `<div class="log-entry-data">${JSON.stringify(e.details, null, 2)}</div>` : ''}
            </div>
        `).join('');
        logEl.scrollTop = logEl.scrollHeight;
    }

    // Instance compatibility
    constructor(isDebug = false) { BuddyLogger.init(isDebug); }
    info(...args) { BuddyLogger.info(...args); }
    warn(...args) { BuddyLogger.warn(...args); }
    error(...args) { BuddyLogger.error(...args); }
    debug(...args) { BuddyLogger.debug(...args); }
    log(...args) { BuddyLogger.info(...args); }
    clear() { BuddyLogger.clear(); }
    getFormattedLogs() { return BuddyLogger.getFormattedLogs(); }
    updateDiagnosticsPanel() { BuddyLogger.updateDiagnosticsPanel(); }
}
