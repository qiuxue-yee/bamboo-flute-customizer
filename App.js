/**
 * 3D竹笛定制器 - 主应用类
 * 简化的版本，专注于核心功能
 */

import { ThreeDManager } from './ThreeDManager.js';
import { UIController } from './UIController.js';
import { Customizer } from './Customizer.js';

export class App {
    constructor() {
        this.initialized = false;
        this.components = new Map();
        this.locales = null; // 将在初始化期间加载
        
        // DOM缓存用于性能优化
        this.domCache = {
            canvasContainer: null,
            textInput: null,
            colorInput: null,
            fontSelect: null,
            textSizePreset: null,
            langSelect: null,
            fileInput: null,
            clearImageBtn: null,
            uSlider: null,
            vSlider: null,
            uValue: null,
            vValue: null,
            fileNameDisplay: null
        };
        
        // 立即初始化
        this.init();
    }
    
    /**
     * 获取当前语言的国际化字符串
     */
    getString(key, defaultValue = '') {
        const currentLang = 'en';
        return this.locales?.[currentLang]?.[key] || this.locales?.en?.[key] || defaultValue;
    }
    
    /**
     * 缓存DOM元素以提升性能
     */
    cacheElement(key, selector) {
        if (!this.domCache[key]) {
            this.domCache[key] = document.getElementById(selector) || document.querySelector(selector);
        }
        return this.domCache[key];
    }

    async init() {
        try {
            if (window.__DEV__) if (window.__DEV__) console.log('Initializing 3D Bamboo Flute Customizer...');

            // 首先加载本地化文件
            await this.loadLocales();

            // 获取画布容器
        this.canvasContainer = document.getElementById('canvas-container');
        if (!this.canvasContainer) {
                if (window.__DEV__) console.error('Canvas container not found');
                return;
        }

            // 初始化UI控制器
            this.ui = new UIController(document);
            // 加载本地化文件后显示带有国际化字符串的加载提示
            this.ui.showLoading(this.getString('loading_3d_model', 'Loading 3D Model...'));

            // 使用回调函数初始化3D管理器
            if (window.__DEV__) if (window.__DEV__) console.log('Initializing ThreeDManager with container:', this.canvasContainer);
        this.three = new ThreeDManager(this.canvasContainer, () => {
                if (window.__DEV__) if (window.__DEV__) console.log('ThreeDManager ready callback triggered');
            this.ui.hideLoading();
            this.ui.toast(this.getString('model_ready', '3D模型已就绪'), 'success');
                this.onThreeDReady();
            });

            // 初始化定制器
            this.customizer = new Customizer(this.three, this.ui, this);
            
            // 等待导出系统
            if (window.__DEV__) if (window.__DEV__) console.log('Waiting for export system to initialize...');
            await this.customizer.initializeExporters();
            if (window.__DEV__) if (window.__DEV__) console.log('Export system initialized and ready');

        // 设置事件处理器
        this.setupEventHandlers();

        // 设置相机帮助
        this.setupCameraHelp();
        
        // 设置UV预览
        this.setupUVPreview();

            // 为调试暴露全局对象
        if (typeof window !== 'undefined') {
                window.app = this;
            window.threeDManager = this.three;
                window.ui = this.ui;
                // 桥接助手函数以避免未定义的全局函数
                window.snapTextToTail = () => window.customizer && window.customizer.snapTextToTail && window.customizer.snapTextToTail();
                window.toggleAutoSnapTextTail = () => {
                    if (!window.customizer) return;
                    window.customizer.autoSnapTextTail = !window.customizer.autoSnapTextTail;
                    if (window.__DEV__) if (window.__DEV__) console.log('autoSnapTextTail =', window.customizer.autoSnapTextTail);
                };
            }

            this.initialized = true;
            if (window.__DEV__) if (window.__DEV__) console.log('Application initialized successfully');

        } catch (error) {
            if (window.__DEV__) if (window.__DEV__) console.error('Failed to initialize application:', error);
            if (this.ui) {
                this.ui.toast(this.getString('failed_init', 'Application initialization failed'), 'error');
            }
        }
    }

    onThreeDReady() {
        if (window.__DEV__) if (window.__DEV__) console.log('3D场景已准备好进行定制');
        
        // 调试：记录模型中的所有材质
        this.debugModelMaterials();
        
        // 现在模型已加载，初始化真实的UV预览
        if (this.uvMapper) {
            this.initializeRealUVPreview();
        }
        
        // 启用定制控件
        this.enableCustomizationControls();
        
        // 应用任何保存的状态
        this.restoreState();
    }

    debugModelMaterials() {
        if (this.three && this.three.currentModel && window.__DEV__) {
            if (window.__DEV__) console.log('Debugging model materials:');
            this.three.currentModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (window.__DEV__) console.log(`- Mesh: ${child.name || 'unnamed'}, Material: ${child.material.name || 'unnamed'}, Type: ${child.material.type}`);
                    if (child.material.map) {
                        if (window.__DEV__) console.log(`  Has texture: ${child.material.map.constructor.name}`);
                    }
                }
            });
        }
    }

    enableCustomizationControls() {
        // 启用所有表单控件，包括选择框
        const controls = document.querySelectorAll('#control-panel input, #control-panel button, #control-panel select');
        controls.forEach(control => {
            control.disabled = false;
        });
    }

    /**
     * 从JSON文件加载本地化字符串
     */
    async loadLocales() {
        try {
            const response = await fetch('./locales.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.locales = await response.json();
            if (window.__DEV__) if (window.__DEV__) console.log('Locales loaded successfully:', Object.keys(this.locales));
        } catch (error) {
            if (window.__DEV__) if (window.__DEV__) console.error('Failed to load locales:', error);
            // 备用本地化字符串
            this.locales = {
                zh: {
                    previewText: '文字预览',
                    previewImage: '图案预览'
                },
                en: {
                    previewText: 'Text Preview',
                    previewImage: 'Image Preview'
                }
            };
        }
    }

    setupEventHandlers() {
        // 文件上传处理（支持按钮触发或原生输入）
        const uploadEl = document.getElementById('pattern-upload');
        if (uploadEl) {
            if (uploadEl.tagName === 'INPUT' && uploadEl.type === 'file') {
                uploadEl.addEventListener('change', (e) => this.handleFileUpload(e));
            } else {
                // 创建隐藏的文件输入并重复使用
                let hiddenInput = document.getElementById('hidden-file-input');
                if (!hiddenInput) {
                    hiddenInput = document.createElement('input');
                    hiddenInput.type = 'file';
                    hiddenInput.accept = 'image/*';
                    hiddenInput.id = 'hidden-file-input';
                    hiddenInput.style.display = 'none';
                    document.body.appendChild(hiddenInput);
                }
                uploadEl.addEventListener('click', (e) => {
                    e.preventDefault();
                    hiddenInput.click();
                });
                hiddenInput.addEventListener('change', (e) => this.handleFileUpload(e));
            }
        }

        // 清除按钮
        const clearImageBtn = document.getElementById('clear-image-btn');
        
        if (clearImageBtn) {
            clearImageBtn.addEventListener('click', () => this.clearImage());
        }

        // 图像U/V滑块
        // 支持新的ID（u-slider, v-slider）并回退到旧的ID
        const uRange = document.getElementById('u-slider') || document.getElementById('image-u-range');
        const vRange = document.getElementById('v-slider') || document.getElementById('image-v-range');
        const uValue = document.getElementById('u-value');
        const vValue = document.getElementById('v-value');
        const syncAndApply = () => {
            const u = parseFloat(uRange?.value || '0') || 0;
            const v = parseFloat(vRange?.value || '0') || 0;
            if (uValue) uValue.textContent = u.toFixed(2);
            if (vValue) vValue.textContent = v.toFixed(2);
            if (window.setImageCenterBias) window.setImageCenterBias(u, v);
        };
        if (uRange) uRange.addEventListener('input', syncAndApply);
        if (vRange) vRange.addEventListener('input', syncAndApply);
        // 如果可用，从当前偏差初始化滑块
        setTimeout(() => {
            const bias = this.customizer?.centerBiasImage || { u: 0, v: 0 };
            if (uRange) uRange.value = String(bias.u || 0);
            if (vRange) vRange.value = String(bias.v || 0);
            if (uValue) uValue.textContent = (bias.u || 0).toFixed(2);
            if (vValue) vValue.textContent = (bias.v || 0).toFixed(2);
        }, 300);

        // 键盘快捷键
        this.setupKeyboardShortcuts();

        // 视图切换按钮
        this.setupViewToggle();
        
        // 国际化
        this.setupI18n();
        
        // D-pad UI已移除：在保留键盘快捷键处理器的同时跳过键盘UI反馈
    }

    setupUserGuide() {}

    showGuide() {
        const guideOverlay = document.getElementById('guide-modal-overlay');
        if (guideOverlay) guideOverlay.classList.remove('hidden');
    }

    hideGuide() {
        const guideOverlay = document.getElementById('guide-modal-overlay');
        if (guideOverlay) guideOverlay.classList.add('hidden');
    }

    setupViewToggle() {
        if (window.__DEV__) if (window.__DEV__) console.log('Setting up 360° camera rotation controls...');
        
        // 隐藏旧的视图控制按钮，因为它们不再需要
        const leftBtn = document.getElementById('view-left-btn');
        const rightBtn = document.getElementById('view-right-btn');
        if (leftBtn) leftBtn.style.display = 'none';
        if (rightBtn) rightBtn.style.display = 'none';

        // D-pad控件已移除：仅限鼠标/键盘快捷键

        // 如果存在旧的视图按钮则隐藏它们
        const oldFrontBtn = document.getElementById('view-front-btn');
        const oldBackBtn = document.getElementById('view-back-btn');
        if (oldFrontBtn) oldFrontBtn.style.display = 'none';
        if (oldBackBtn) oldBackBtn.style.display = 'none';
        
        if (window.__DEV__) if (window.__DEV__) console.log('360° rotation controls initialized');

        const exportModelBtn = document.getElementById('export-model-btn');
        const exportFormatSelect = document.getElementById('export-format-select');
        const exportOptions = document.getElementById('export-options') || document.querySelector('.checkbox-container');
        
        // 根据选择的格式显示/隐藏导出选项
        if (exportFormatSelect && exportOptions) {
            exportFormatSelect.addEventListener('change', (e) => {
                const isZip = e.target.value === 'zip' || e.target.value === 'manufacturing';
                if (isZip) {
                    exportOptions.classList.add('show');
                    if (exportOptions.style) exportOptions.style.display = 'flex';
                } else {
                    exportOptions.classList.remove('show');
                    if (exportOptions.style) exportOptions.style.display = 'none';
                }
            });
            // 根据初始值初始化可见性
            const isInitiallyZip = exportFormatSelect.value === 'zip' || exportFormatSelect.value === 'manufacturing';
            if (isInitiallyZip) {
                exportOptions.classList.add('show');
                if (exportOptions.style) exportOptions.style.display = 'flex';
            }
        }
        
        if (exportModelBtn) {
            exportModelBtn.addEventListener('click', async () => {
                let format = exportFormatSelect?.value || 'zip';
                const includeStl = document.getElementById('include-stl-checkbox')?.checked || false;
                if (format === 'zip') format = 'manufacturing';
                
                if (this.customizer && this.customizer.exportModel) {
                    if (window.__DEV__) if (window.__DEV__) console.log(`Initiating ${format} export...`);
                    const capabilities = this.customizer.getExportCapabilities();
                    if (!capabilities.canExport) {
                        this.ui.toast(this.getString('export_lib_not_loaded', 'Export libraries not loaded'), 'error');
                        return;
                    }
                    if (format === 'manufacturing') {
                        const hasCustomizations = this.customizer.currentCustomizations?.textTexture || this.customizer.currentCustomizations?.imageTexture;
                        if (!hasCustomizations) {
                            const proceed = confirm(this.getString('confirm_export_without_customizations', 'No customizations detected. Export default manufacturing package?'));
                            if (!proceed) return;
                        }
                        if (window.__DEV__) if (window.__DEV__) console.log(`Exporting complete manufacturing package (STL: ${includeStl})...`);
                        await this.customizer.exportModel('manufacturing', { includeStl });
                        return;
                    }
                    if (window.__DEV__) if (window.__DEV__) console.log(`Exporting single ${format} file...`);
                    await this.customizer.exportModel(format);
                } else {
                    this.ui.toast(this.getString('export_system_not_ready', 'Export system not ready'), 'error');
                }
            });
        }

        if (window.__DEV__) if (window.__DEV__) console.log('Guided view controls and model controls configured');
    }
    
    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            const mod = e.ctrlKey || e.metaKey;
            
            if (mod && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                this.customizer.undo();
            } else if (mod && (e.key === 'y' || (e.shiftKey && (e.key === 'Z' || e.key === 'z')))) {
                e.preventDefault();
                this.customizer.redo();
            }
        });
    }

    setupI18n() {
        if (window.__DEV__) if (window.__DEV__) console.log('Initializing language system...');
        
        // 使用从locales.json加载的本地化字符串
        
        const applyLanguage = (lang) => {
            if (window.__DEV__) if (window.__DEV__) console.log(`Applying language: ${lang}`);
            const strings = this.locales[lang] || this.locales['en'];
            
            // 页面标题
            document.title = strings.dizi_title || document.title;

            // 更新带有data-i18n-key属性的元素
            document.querySelectorAll('[data-i18n-key]').forEach((el) => {
                const key = el.getAttribute('data-i18n-key');
                if (key && strings[key]) {
                    el.textContent = strings[key];
                }
            });

            // 更新带有data-i18n-title属性的元素（工具提示）
            document.querySelectorAll('[data-i18n-title]').forEach((el) => {
                const key = el.getAttribute('data-i18n-title');
                if (key && strings[key]) {
                    el.title = strings[key];
                }
            });
            
            // 使用查询选择器更新上传标签
            const uploadLabel = document.querySelector('label[for="pattern-upload"]');
            if (uploadLabel && strings.upload_pattern) {
                uploadLabel.textContent = strings.upload_pattern;
            }
            
            // 更新相机帮助
            this.updateCameraHelp(strings);
            
            if (window.__DEV__) if (window.__DEV__) console.log(`Language applied successfully: ${lang}`);
        };
        
        // Language selector removed - English only
        // Apply English language directly
        applyLanguage('en');
    }
    
    // 当UIController不可用时的备用语言更新
    fallbackLanguageUpdate(lang) {
        if (window.__DEV__) if (window.__DEV__) console.log('Using fallback language update for:', lang);
        
        const translations = {
            zh: {
                title: '竹笛 | Dizi',
                apply: '应用',
                save: '保存预设',
                load: '加载预设',
                upload: '上传图案',
                textPlaceholder: '添加文字'
            },
            en: {
                title: 'Bamboo Flute | Dizi',
                apply: 'Apply',
                save: 'Save Preset',
                load: 'Load Preset',
                upload: 'Upload Pattern',
                textPlaceholder: 'Add text'
            }
        };
        
        const strings = translations[lang] || translations['en'];
        
        // 直接DOM更新
        const updates = [
            { id: 'app-title', key: 'title' },
            { id: 'apply-text-btn', key: 'apply' }
        ];
        
        updates.forEach(({ id, key }) => {
            const el = document.getElementById(id);
            if (el && strings[key]) {
                el.textContent = strings[key];
                if (window.__DEV__) if (window.__DEV__) console.log(`Fallback updated ${id}: ${strings[key]}`);
            }
        });
        
        // 更新占位符
        const textInput = document.getElementById('text-input');
        if (textInput && strings.textPlaceholder) {
            textInput.placeholder = strings.textPlaceholder;
        }
        
        // 更新上传标签
        const uploadLabel = document.querySelector('label[for="pattern-upload"]');
        if (uploadLabel && strings.upload) {
            uploadLabel.textContent = strings.upload;
        }
        
        // 更新页面标题
        document.title = strings.title;
        
        // 旋转按钮已移除：无需UI文本更新
        
        // 更新UV预览标题
        const previewTitle = document.querySelector('.preview-title');
        if (previewTitle) previewTitle.textContent = strings.uvPreviewTitle || 'UV Preview';
        
        // 更新UV预览状态文本
        if (this.textUvStatus && this.textUvStatus.textContent.includes('等待')) {
            this.textUvStatus.textContent = strings.previewWaiting || 'Waiting...';
        }
        if (this.imageUvStatus && this.imageUvStatus.textContent.includes('等待')) {
            this.imageUvStatus.textContent = strings.previewWaiting || 'Waiting...';
        }
    }

    setupCameraHelp() {
        const cameraHelp = document.getElementById('camera-help');
        const minimizeBtn = document.getElementById('minimize-help');

        if (!cameraHelp || !minimizeBtn) {
            // 相机帮助UI已移除以获得更清洁的界面 - 静默跳过
            return;
        }

        // 处理最小化/最大化
        minimizeBtn.addEventListener('click', () => {
            const isMinimized = cameraHelp.classList.contains('minimized');
            if (isMinimized) {
                cameraHelp.classList.remove('minimized');
                // 使用常规连字符替代特殊字符，避免编码问题
                minimizeBtn.textContent = '-';
                minimizeBtn.title = '最小化';
            } else {
                cameraHelp.classList.add('minimized');
                minimizeBtn.textContent = '+';
                minimizeBtn.title = '展开';
            }
        });

        // 对于新用户5秒后自动隐藏
        const hasSeenCameraHelp = localStorage.getItem('hasSeenCameraHelp');
        if (!hasSeenCameraHelp) {
            setTimeout(() => {
                cameraHelp.classList.add('minimized');
                minimizeBtn.textContent = '+';
                localStorage.setItem('hasSeenCameraHelp', 'true');
            }, 5000);
        } else {
            // 对于返回用户，默认最小化
            cameraHelp.classList.add('minimized');
            minimizeBtn.textContent = '+';
        }

        if (window.__DEV__) if (window.__DEV__) console.log('Camera help initialized');
    }

    updateCameraHelp(strings) {
        const helpTitle = document.querySelector('.help-title');
        const helpTexts = document.querySelectorAll('.help-text');

        if (helpTitle) {
            helpTitle.textContent = strings.helpTitle || '3D Controls';
        }

        if (helpTexts.length >= 4) {
            helpTexts[0].textContent = strings.helpRotate || 'Rotate: Left-click & drag';
            helpTexts[1].textContent = strings.helpZoom || 'Zoom: Mouse wheel';
            helpTexts[2].textContent = strings.helpPan || 'Pan: Right-click & drag';
            helpTexts[3].textContent = strings.helpToggle || 'Click the button to switch view';
        }

        if (window.__DEV__) if (window.__DEV__) console.log('Camera help language updated');
    }

    setupUVPreview() {
        // 仅图像UV画布
        this.imageUvCanvas = document.getElementById('imageUvCanvas');
        this.imageUvContext = this.imageUvCanvas?.getContext('2d');
        // 状态
        this.imageUvStatus = document.getElementById('imageUvStatus');
        if (!this.imageUvCanvas) {
            if (window.__DEV__) if (window.__DEV__) console.warn('Image UV canvas not found');
            return;
        }
        
        // 初始化UV映射系统（仅图像）
        this.uvMapper = {
            extractUVFromModel: this.extractUVFromModel.bind(this),
            renderRealUVLayout: this.renderRealUVLayout.bind(this)
        };
        this.clearImageUvPreview();
        
        if (window.__DEV__) if (window.__DEV__) console.log('UV mapping system initialized');
    }


    async initializeRealUVPreview() {
        // 等待模型加载
        if (!this.three || !this.three.currentModel) {
            if (window.__DEV__) if (window.__DEV__) console.log('等待模型加载完成后初始化UV...');
            setTimeout(() => this.initializeRealUVPreview(), 500);
            return;
        }

        if (window.__DEV__) if (window.__DEV__) console.log('从3D模型中提取真实的UV坐标...');
        
        // 从模型中提取UV坐标
        const uvData = this.extractUVFromModel(this.three.currentModel);
        
        if (uvData) {
            // 在画布上渲染真实的UV布局
            this.renderRealUVLayout(uvData);
            if (window.__DEV__) if (window.__DEV__) console.log('Real UV layout rendered successfully');
        } else {
            if (window.__DEV__) if (window.__DEV__) console.warn('无法提取UV数据，回退到占位符');
            this.clearTextUvPreview();
            this.clearImageUvPreview();
        }
    }


    extractUVFromModel(model) {
        let uvData = {
            textUVs: null,
            imageUVs: null,
            modelBounds: null
        };

        model.traverse((child) => {
            if (child.isMesh && child.geometry && child.geometry.attributes.uv) {
                const geometry = child.geometry;
                const uvAttribute = geometry.attributes.uv;
                const materialName = child.material?.name || 'unnamed';
                
                if (window.__DEV__) {
                    if (window.__DEV__) console.log(`Found UV data in mesh: ${child.name}, material: ${materialName}`);
                    if (window.__DEV__) console.log(`   UV coordinates: ${uvAttribute.count} points`);
                }
                
                // 根据材质类型存储UV数据
                if (materialName.toLowerCase().includes('text') || 
                    materialName.toLowerCase().includes('custom_area_text')) {
                    uvData.textUVs = {
                        uvArray: uvAttribute.array,
                        count: uvAttribute.count,
                        meshName: child.name,
                        materialName: materialName
                    };
                } else if (materialName.toLowerCase().includes('image') || 
                          materialName.toLowerCase().includes('custom_area_image')) {
                    uvData.imageUVs = {
                        uvArray: uvAttribute.array,
                        count: uvAttribute.count,
                        meshName: child.name,
                        materialName: materialName
                    };
                }

                // 计算模型边界以进行UV映射
                if (!uvData.modelBounds) {
                    const box = new THREE.Box3().setFromObject(child);
                    uvData.modelBounds = {
                        min: box.min,
                        max: box.max,
                        size: box.getSize(new THREE.Vector3())
                    };
                }
            }
        });

        return uvData.textUVs || uvData.imageUVs ? uvData : null;
    }


    renderRealUVLayout(uvData) {
        // 渲染图像UV布局
        if (uvData.imageUVs && this.imageUvContext) {
            this.renderUVMeshOnCanvas(this.imageUvContext, this.imageUvCanvas, uvData.imageUVs, 'image');
            this.imageUvStatus.textContent = `Image UV Layout (${uvData.imageUVs.meshName})`;
        }
    }


    renderUVMeshOnCanvas(ctx, canvas, uvData, type) {
        const { uvArray, count } = uvData;
        
        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 设置绘制样式
        ctx.strokeStyle = type === 'text' ? '#00ff88' : '#ff8800';
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        
        // 绘制UV坐标网格
        ctx.beginPath();
        for (let i = 0; i < count; i += 3) {
            // 获取三角形UV坐标
            const u1 = uvArray[i * 2];
            const v1 = uvArray[i * 2 + 1];
            const u2 = uvArray[(i + 1) * 2];
            const v2 = uvArray[(i + 1) * 2 + 1];
            const u3 = uvArray[(i + 2) * 2];
            const v3 = uvArray[(i + 2) * 2 + 1];
            
            // 将UV坐标（0-1）转换为画布坐标
            const x1 = u1 * canvas.width;
            const y1 = (1 - v1) * canvas.height; // 翻转V坐标
            const x2 = u2 * canvas.width;
            const y2 = (1 - v2) * canvas.height;
            const x3 = u3 * canvas.width;
            const y3 = (1 - v3) * canvas.height;
            
            // 绘制三角形
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.lineTo(x1, y1);
        }
        ctx.stroke();
        
        // 添加坐标网格作为参考
        this.drawUVGrid(ctx, canvas);
        
            if (window.__DEV__) if (window.__DEV__) console.log(`为${type}渲染UV布局: ${count}个UV坐标`);
    }


    drawUVGrid(ctx, canvas) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 0.5;
        
        // 绘制网格线
        const gridSize = 10;
        for (let i = 0; i <= gridSize; i++) {
            const x = (i / gridSize) * canvas.width;
            const y = (i / gridSize) * canvas.height;
            
            // 垂直线
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
            
            // 水平线
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }
    
    clearTextUvPreview() {
        if (!this.textUvContext) return;

        // 完全清空画布以显示背景图像
        this.textUvContext.clearRect(0, 0, this.textUvCanvas.width, this.textUvCanvas.height);

        // 更新状态
        if (this.textUvStatus) {
            this.textUvStatus.textContent = '等待文字内容...';
        }
    }
    
    clearImageUvPreview() {
        if (!this.imageUvContext) return;

        // 完全清空画布以显示背景图像
        this.imageUvContext.clearRect(0, 0, this.imageUvCanvas.width, this.imageUvCanvas.height);

            // 更新状态
        if (this.imageUvStatus) {
            const currentLang = 'en';
            const strings = (this.locales && this.locales[currentLang]) || (this.locales && this.locales.en) || {};
            this.imageUvStatus.textContent = strings.waiting_image || '等待图像内容...';
        }
    }
    
    // 遗留方法 - 保留以维持向后兼容性
    drawUVLayout() {
        // 此方法已弃用 - UV布局现在由单独的画布处理
        if (window.__DEV__) if (window.__DEV__) console.log('drawUVLayout is deprecated - using dual canvas system');
    }
    
    updateTextUvPreview(text, color = '#ffffff') {
        if (!this.textUvContext) return;

        // 清空画布以显示背景UV布局
        this.clearTextUvPreview();
        
        if (text && text.trim()) {
            // 在UV画布上绘制文字
            this.drawTextOnUvCanvas(text, color);

            // 更新状态
            if (this.textUvStatus) {
                const currentLang = 'en';
                const strings = (this.locales && this.locales[currentLang]) || (this.locales && this.locales.en) || {};
                this.textUvStatus.textContent = `${strings.previewText || '文字预览'}: "${text}"`;
            }
        }
    }
    
    updateImageUvPreview(image) {
        if (!this.imageUvContext) return;

        // 清空画布以显示背景UV布局
        this.clearImageUvPreview();
        
        if (image) {
            // 在UV画布上绘制图像
            this.drawImageOnUvCanvas(image);

            // 更新状态
        if (this.imageUvStatus) {
            const currentLang = 'en';
            const strings = (this.locales && this.locales[currentLang]) || (this.locales && this.locales.en) || {};
            this.imageUvStatus.textContent = strings.previewImage || '图案预览';
        }
        }
    }
    
    drawTextOnUvCanvas(text, color) {
        const ctx = this.textUvContext;
        const canvas = this.textUvCanvas;
        
        // 设置文字属性
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.min(canvas.width / 12, canvas.height / 4)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 添加文字阴影以提高可见性
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // 在画布中心绘制文字
        const x = canvas.width / 2;
        const y = canvas.height / 2;
        
        // 如果文字过长则进行换行
        const maxWidth = canvas.width * 0.9;
        this.wrapTextOnCanvas(ctx, text, x, y, maxWidth, canvas.height / 6);
        
        // 重置阴影
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }
    
    wrapTextOnCanvas(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let testLine = '';
        const lines = [];
        
        for (let n = 0; n < words.length; n++) {
            testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            
            if (testWidth > maxWidth && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);
        
        // 居中绘制行
        const totalHeight = lines.length * lineHeight;
        const startY = y - totalHeight / 2;
        
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x, startY + (i * lineHeight) + lineHeight / 2);
        }
    }
    
    drawImageOnUvCanvas(image) {
        const ctx = this.imageUvContext;
        const canvas = this.imageUvCanvas;
        
        // 计算纵横比以正确适应画布中的图像
        const imageAspectRatio = image.width / image.height;
        const canvasAspectRatio = canvas.width / canvas.height;
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (imageAspectRatio > canvasAspectRatio) {
            // 图像比画布宽 - 适应宽度
            drawWidth = canvas.width * 0.9; // 留出一些边距
            drawHeight = drawWidth / imageAspectRatio;
            drawX = (canvas.width - drawWidth) / 2;
            drawY = (canvas.height - drawHeight) / 2;
        } else {
            // 图像比画布高 - 适应高度
            drawHeight = canvas.height * 0.9; // 留出一些边距
            drawWidth = drawHeight * imageAspectRatio;
            drawX = (canvas.width - drawWidth) / 2;
            drawY = (canvas.height - drawHeight) / 2;
        }
        
        // 在画布中居中绘制图像
        ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
        
        // 添加边框以显示图像边界
        ctx.strokeStyle = 'rgba(100, 255, 200, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
    }
    
        // 遗留方法 - 已弃用
    updatePreviewStatus(status) {
        if (window.__DEV__) if (window.__DEV__) console.log('updatePreviewStatus is deprecated - status handled by individual UV canvases');
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        const fileNameDisplay = this.cacheElement('fileNameDisplay', 'file-name-display');
        
        if (!file) {
            if (fileNameDisplay) fileNameDisplay.textContent = this.getString('no_file_chosen', '未选择文件');
            return;
        }

        if (!file.type.startsWith('image/')) {
            this.ui.toast(this.getString('err_file_not_image', 'Please select an image file'), 'error');
            if (fileNameDisplay) fileNameDisplay.textContent = this.getString('no_file_chosen', '未选择文件');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            this.ui.toast(this.getString('err_file_too_large_5mb', 'File too large. Maximum size is 5MB'), 'error');
            if (fileNameDisplay) fileNameDisplay.textContent = this.getString('no_file_chosen', '未选择文件');
            return;
        }

        // 显示文件 if (fileNameDisplay) fileNameDisplay.textContent = file.name;

        const img = new Image();
        img.onload = () => {
            this.customizer.applyImageTexture(img);
            
            // 同步更新UV预览 - 这是关键修复
            this.updateImageUvPreview(img);
            
            URL.revokeObjectURL(img.src); // 清理资源
        };
        img.onerror = () => {
            this.ui.toast(this.getString('failed_load_image', 'Failed to load image'), 'error');
            if (fileNameDisplay) fileNameDisplay.textContent = this.getString('no_file_chosen', '未选择文件');
        };
        img.src = URL.createObjectURL(file);
    }

    handleTextApply() {
        const textInput = this.cacheElement('textInput', 'text-input');
        const colorInput = this.cacheElement('colorInput', 'text-color');
        const fontSelect = this.cacheElement('fontSelect', 'font-select');
        const textSizePreset = this.cacheElement('textSizePreset', 'text-size-preset');
        
        if (!textInput) return;
        
        const text = textInput.value.trim();
        if (!text) {
            this.ui.toast(this.getString('please_enter_text', 'Please enter text'), 'error');
            return;
        }

        const color = colorInput?.value || '#ffffff';
        const fontFamily = fontSelect?.value || 'Arial';
        const preset = (textSizePreset?.value || 'medium');
        const presetSize = preset === 'large' ? 96 : preset === 'small' ? 36 : 64;
        
        if (window.__DEV__) if (window.__DEV__) console.log(`Applying text: "${text}", color: ${color}, font: ${fontFamily}`);
        
        this.customizer.applyTextTexture({
            text: text,
            color: color,
            fontSize: presetSize,
            fontFamily: fontFamily
        });
    }

    clearImage() {
        const fileInput = document.getElementById('pattern-upload');
        if (fileInput) {
            fileInput.value = '';
        }
        
        // 应用空纹理
        if (this.customizer && this.three.currentModel) {
            this.three.currentModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.map = null;
                    child.material.needsUpdate = true;
                }
            });
        }

        // 同步清除UV预览 - 这是关键修复
        this.clearImageUvPreview();
        
        // 强制渲染更新
        if (this.three && this.three.renderer && this.three.scene && this.three.camera) {
            this.three.renderer.render(this.three.scene, this.three.camera);
        }

        this.ui.toast(this.getString('image_cleared', 'Image cleared'), 'info');
    }

    clearText() {
        const textInput = document.getElementById('text-input');
        if (textInput) {
            textInput.value = '';
        }
        
        // 更新字符计数器
        const textCounter = document.getElementById('text-counter');
        if (textCounter) {
            textCounter.textContent = '0 / 10';
        }
        
        // 应用空纹理
        if (this.customizer && this.three.currentModel) {
            this.three.currentModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.map = null;
                    child.material.needsUpdate = true;
                }
            });
        }

        this.ui.toast(this.getString('text_cleared', 'Text cleared'), 'info');
    }

        // 预设功能已按用户要求移除

    restoreState() {
        // 恢复任何保存的应用状态
        try {
            const savedState = localStorage.getItem('bambooFluteState');
            if (savedState) {
                const state = JSON.parse(savedState);
                if (window.__DEV__) if (window.__DEV__) console.log('Restored application state:', state);
            }
        } catch (error) {
            if (window.__DEV__) if (window.__DEV__) console.warn('Failed to restore state:', error);
        }
    }

    saveState() {
        try {
            const state = {
                timestamp: Date.now(),
                language: 'en',
                theme: document.documentElement.getAttribute('data-theme') || 'dark'
            };
            localStorage.setItem('bambooFluteState', JSON.stringify(state));
        } catch (error) {
            if (window.__DEV__) if (window.__DEV__) console.warn('Failed to save state:', error);
        }
    }

    // 公共API方法
    getThreeDManager() {
        return this.three;
    }

    getUIController() {
        return this.ui;
    }

    getCustomizer() {
        return this.customizer;
    }

    isInitialized() {
        return this.initialized;
    }

    // 实用工具方法
    takeScreenshot() {
        if (this.three) {
            return this.three.takeScreenshot();
        }
        return null;
    }

    resetCamera() {
        if (this.three) {
            this.three.resetCamera();
        }
    }

    toggleWireframe() {
        if (this.three) {
            this.three.toggleWireframeMode();
        }
    }

    getSceneStats() {
        if (this.three) {
            return this.three.getSceneStats();
        }
        return null;
    }

    // 清理资源
    destroy() {
        if (this.three) {
            this.three.dispose();
        }
        
        this.components.forEach(component => {
            if (component.destroy) {
                component.destroy();
            }
        });
        
        this.components.clear();
        this.initialized = false;
        
        if (window.__DEV__) if (window.__DEV__) console.log('Application destroyed');
    }
}
