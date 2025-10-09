// UI 配置内联，config.js 已移除

export class UIController {
    constructor(root = document) {
        this.root = root;
        
        // DOM 缓存，提升性能
        this.domCache = {
            loadingOverlay: null,
            toastContainer: null,
            helpPopover: null,
            helpButton: null,
            langSelect: null,
            panel: null,
            panelHeader: null,
            clearImageBtn: null,
            patternUpload: null
        };
        
        // 缓存所有 DOM 元素
        this.loadingOverlay = this._cacheElement('loadingOverlay', 'loading-overlay');
        this.toastContainer = this._ensureToastContainer();
        this.helpPopover = this._cacheElement('helpPopover', 'help-popover');
        this.helpButton = this._cacheElement('helpButton', 'help-button');
        this.langSelect = this._cacheElement('langSelect', 'lang-select');
        this.panel = this._cacheElement('panel', 'control-panel');
        this.panelHeader = this._cacheElement('panelHeader', 'panel-header');
        this.clearImageBtn = this._cacheElement('clearImageBtn', 'clear-image-btn');
        this.patternUpload = this._cacheElement('patternUpload', 'pattern-upload');

        this._wireHelp();
        this._wireDrag();
        this._wireInputs();
    }
    
    /**
     * 缓存 DOM 元素，避免重复查询
     */
    _cacheElement(key, id) {
        if (!this.domCache[key]) {
            this.domCache[key] = this.root.getElementById(id);
        }
        return this.domCache[key];
    }

    showLoading(text = '正在加载3D模型...', showProgress = false, progressValue = 0) {
        if (!this.loadingOverlay) return;
        
        const loadingText = this.loadingOverlay.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = text;
        }
        
        // 进度条（可选）
        let progressBar = this.loadingOverlay.querySelector('.progress-bar');
        let progressFill = this.loadingOverlay.querySelector('.progress-fill');
        let progressText = this.loadingOverlay.querySelector('.progress-text');
        
        if (showProgress) {
            if (!progressBar) {
                progressBar = document.createElement('div');
                progressBar.className = 'progress-bar';
                progressBar.innerHTML = `
                    <div class="progress-fill"></div>
                    <div class="progress-text">0%</div>
                `;
                this.loadingOverlay.appendChild(progressBar);
                progressFill = progressBar.querySelector('.progress-fill');
                progressText = progressBar.querySelector('.progress-text');
            }
            progressBar.style.display = 'block';
            progressFill.style.width = `${Math.min(100, Math.max(0, progressValue))}%`;
            progressText.textContent = `${Math.round(progressValue)}%`;
        } else if (progressBar) {
            progressBar.style.display = 'none';
        }
        
        this.loadingOverlay.style.display = 'flex';
        if (window.__DEV__) console.log('Loading overlay shown:', text, showProgress ? `(${progressValue}%)` : '');
    }

    updateLoadingProgress(progressValue, text = null) {
        if (!this.loadingOverlay) return;
        
        const progressFill = this.loadingOverlay.querySelector('.progress-fill');
        const progressText = this.loadingOverlay.querySelector('.progress-text');
        const loadingText = this.loadingOverlay.querySelector('.loading-text');
        
        if (progressFill && progressText) {
            const clampedProgress = Math.min(100, Math.max(0, progressValue));
            progressFill.style.width = `${clampedProgress}%`;
            progressText.textContent = `${Math.round(clampedProgress)}%`;
        }
        
        if (text && loadingText) {
            loadingText.textContent = text;
        }
        
        if (window.__DEV__) console.log('Loading progress updated:', progressValue + '%', text || '');
    }

    hideLoading() {
        if (!this.loadingOverlay) return;
        this.loadingOverlay.style.display = 'none';
        if (window.__DEV__) console.log('Loading overlay hidden');
    }

    /**
     * 轻量 Toast 提示
     */
    toast(message, type = 'info', duration = 3000) {
        // 查找或创建容器
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        const toastElement = document.createElement('div');
        toastElement.className = `toast toast--${type}`;
        toastElement.textContent = message;

        toastContainer.appendChild(toastElement);

        setTimeout(() => {
            toastElement.classList.add('is-visible');
        }, 10);

        setTimeout(() => {
            toastElement.classList.remove('is-visible');
            toastElement.addEventListener('transitionend', () => {
                if (toastElement.parentElement) {
                    toastElement.parentElement.removeChild(toastElement);
                }
            }, { once: true });

        }, duration);
    }

    _ensureToastContainer() {
        let c = this.root.getElementById('toast-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toast-container';
            c.className = 'toast-container';
            document.body.appendChild(c);
        } else {
            if (!c.classList.contains('toast-container')) {
                c.classList.add('toast-container');
            }
        }
        return c;
    }

    _wireHelp() {
        if (!this.helpButton || !this.helpPopover) return;
        const toggle = () => {
            const visible = this.helpPopover.getAttribute('data-open') === '1';
            this.helpPopover.setAttribute('data-open', visible ? '0' : '1');
        };
        this.helpButton.addEventListener('click', toggle);
        this.helpButton.addEventListener('mouseenter', () => this.helpPopover.setAttribute('data-open', '1'));
        this.helpButton.addEventListener('mouseleave', () => this.helpPopover.setAttribute('data-open', '0'));
    }

    _wireDrag() {
        if (!this.panel || !this.panelHeader) return;
        let offsetX = 0, offsetY = 0, dragging = false;
        const onDown = (e) => {
            dragging = true;
            const rect = this.panel.getBoundingClientRect();
            const point = e.touches ? e.touches[0] : e;
            offsetX = point.clientX - rect.left;
            offsetY = point.clientY - rect.top;
            this.panelHeader.setAttribute('aria-grabbed', 'true');
            e.preventDefault();
        };
        const onMove = (e) => {
            if (!dragging) return;
            const point = e.touches ? e.touches[0] : e;
            const x = point.clientX - offsetX;
            const y = point.clientY - offsetY;
            this.panel.style.left = `${Math.max(10, Math.min(window.innerWidth - 10 - this.panel.offsetWidth, x))}px`;
            this.panel.style.top = `${Math.max(10, Math.min(window.innerHeight - 10 - this.panel.offsetHeight, y))}px`;
            this.panel.style.right = 'auto';
        };
        const onUp = () => {
            dragging = false;
            this.panelHeader.setAttribute('aria-grabbed', 'false');
        };
        this.panelHeader.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        this.panelHeader.addEventListener('touchstart', onDown, { passive: false });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
    }


    _wireInputs() {
        // 事件由 App.js 统一绑定
    }

    _debounce(fn, wait) {
        let t = null;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), wait);
        };
    }

    // i18n: 更新界面文案
    applyI18n(strings) {
        if (window.__DEV__) console.log('Applying i18n strings:', strings);
        
        const setText = (id, key) => { 
            const el = this.root.getElementById(id); 
            if (el && strings[key]) {
                el.textContent = strings[key];
                if (window.__DEV__) console.log(`Updated ${id} with: ${strings[key]}`);
            } else if (!el) {
                if (window.__DEV__) console.warn(`Element not found: ${id}`);
            } else if (!strings[key]) {
                if (window.__DEV__) console.warn(`Translation not found for key: ${key}`);
            }
        };
        
        setText('app-title', 'title');
        setText('help-rotate', 'helpRotate');
        setText('help-zoom', 'helpZoom');
        setText('help-pan', 'helpPan');
        setText('apply-text-btn', 'apply');
        setText('save-preset-btn', 'save');
        setText('load-preset-btn', 'load');
        
        const textInput = this.root.getElementById('text-input');
        if (textInput && strings['textPlaceholder']) {
            textInput.placeholder = strings['textPlaceholder'];
            if (window.__DEV__) console.log(`Updated text input placeholder with: ${strings['textPlaceholder']}`);
        }
        
        const uploadLabel = this.root.querySelector('label[for="pattern-upload"]');
        if (uploadLabel && strings['upload']) {
            uploadLabel.textContent = strings['upload'];
            if (window.__DEV__) console.log(`Updated upload label with: ${strings['upload']}`);
        }
    }
}


