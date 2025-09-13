# 3D渲染性能优化指南

## 概述

本指南详细介绍了在WebGL和Three.js中实现高性能3D渲染的最佳实践。通过这些优化技术，可以显著提升应用的帧率、减少内存使用，并在各种设备上提供流畅的用户体验。

## 核心优化策略

### 1. Three.js渲染最佳实践

#### 渲染器优化
- **使用正确的WebGL上下文配置**：
  ```javascript
  const renderer = new THREE.WebGLRenderer({
    antialias: !isMobile, // 移动设备禁用抗锯齿
    alpha: false, // 禁用透明背景
    powerPreference: "high-performance", // 优先性能
    depth: true,
    stencil: false, // 禁用模板缓冲
    desynchronized: true // 异步渲染
  });
  ```

- **设置合适的像素比**：
  ```javascript
  // 移动设备限制为1.5倍
  const pixelRatio = isMobile ?
    Math.min(window.devicePixelRatio, 1.5) :
    Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  ```

- **使用合适的输出编码**：
  ```javascript
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  ```

#### 相机优化
- 使用合适的视野角度（45-60度）
- 禁用不必要的矩阵更新：
  ```javascript
  camera.matrixAutoUpdate = false;
  ```

#### 场景优化
- 启用雾效遮挡远处物体：
  ```javascript
  scene.fog = new THREE.Fog(0xf0f2f5, 100, 1000);
  ```
- 禁用自动更新：
  ```javascript
  scene.autoUpdate = false;
  ```

### 2. 批处理和实例化

#### 批处理静态对象
将使用相同材质的静态网格合并，减少Draw Calls：
```javascript
// 按材质分组
const materialGroups = new Map();
meshes.forEach(mesh => {
  const key = getMaterialKey(mesh.material);
  if (!materialGroups.has(key)) {
    materialGroups.set(key, []);
  }
  materialGroups.get(key).push(mesh);
});

// 合并几何体
materialGroups.forEach((group, key) => {
  if (group.length > 1) {
    const geometries = group.map(mesh => {
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      return geometry;
    });

    const mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
    const batchedMesh = new THREE.Mesh(mergedGeometry, group[0].material);

    // 替换原网格
    group.forEach(mesh => scene.remove(mesh));
    scene.add(batchedMesh);
  }
});
```

#### 实例化渲染
对于重复对象，使用实例化渲染：
```javascript
const instancedMesh = new THREE.InstancedMesh(geometry, material, count);

// 设置每个实例的变换
const matrix = new THREE.Matrix4();
instances.forEach((instance, index) => {
  matrix.setPosition(instance.position);
  instancedMesh.setMatrixAt(index, matrix);
});

instancedMesh.instanceMatrix.needsUpdate = true;
```

### 3. LOD（细节级别）

根据距离使用不同细节的模型：
```javascript
const lod = new THREE.LOD();

lod.addLevel(highDetailModel, 0);    // 近距离
lod.addLevel(mediumDetailModel, 100); // 中距离
lod.addLevel(lowDetailModel, 200);    // 远距离

// 在渲染循环中更新
lod.update(camera);
```

### 4. 内存使用优化

#### 纹理优化
- 限制纹理大小：
  ```javascript
  const maxSize = isMobile ? 512 : 1024;
  if (texture.image.width > maxSize) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = maxSize;
    canvas.height = maxSize;
    ctx.drawImage(texture.image, 0, 0, maxSize, maxSize);
    texture.image = canvas;
    texture.needsUpdate = true;
  }
  ```

- 使用合适的纹理参数：
  ```javascript
  texture.generateMipmaps = !isMobile;
  texture.minFilter = isMobile ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
  texture.anisotropy = isMobile ? 1 : 4;
  ```

#### 几何体优化
- 合并顶点：
  ```javascript
  geometry.mergeVertices();
  ```

- 使用合适的索引类型
- 及时清理未使用的几何体

#### 材质优化
- 移动端使用简化材质
- 共享材质实例
- 复用材质属性

### 5. GPU利用率优化

#### 减少状态切换
- 按材质排序渲染对象
- 使用纹理图集减少纹理切换
- 合并使用相同材质的网格

#### 阴影优化
- 移动端禁用或简化阴影：
  ```javascript
  if (isMobile) {
    renderer.shadowMap.enabled = false;
  } else {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  ```

- 限制阴影贴图大小
- 只为重要对象启用阴影

#### 遮挡剔除
使用视锥体剔除和遮挡剔除：
```javascript
const frustum = new THREE.Frustum();
frustum.setFromProjectionMatrix(camera.projectionMatrix);

objects.forEach(object => {
  object.visible = frustum.intersectsObject(object);
});
```

### 6. 动画性能调优

#### 使用requestAnimationFrame
```javascript
function animate(currentTime) {
  requestAnimationFrame(animate);

  // 限制帧率
  if (currentTime - lastTime < frameInterval) return;
  lastTime = currentTime;

  // 更新逻辑
  update();

  // 渲染
  render();
}
```

#### 动画插值
使用固定时间步长进行物理和动画更新：
```javascript
let accumulatedTime = 0;
const fixedStep = 1/60;

function update(deltaTime) {
  accumulatedTime += deltaTime;

  while (accumulatedTime >= fixedStep) {
    updatePhysics(fixedStep);
    accumulatedTime -= fixedStep;
  }
}
```

#### 批量更新
避免频繁的小更新，使用批量更新：
```javascript
const updates = [];
// 收集更新
updates.push({ id: 'obj1', property: 'position', value: newPosition });
// 一次性应用
batchUpdate(updates);
```

### 7. 移动端性能适配

#### 设备检测和适配
```javascript
function detectMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (navigator.maxTouchPoints > 0 && navigator.maxTouchPoints > 1);
}
```

#### 性能级别调整
根据设备性能调整渲染质量：
```javascript
const profiles = {
  high: { shadows: true, antialias: true, textureSize: 1024 },
  medium: { shadows: true, antialias: false, textureSize: 512 },
  low: { shadows: false, antialias: false, textureSize: 256 }
};

const profile = profiles[getPerformanceLevel()];
```

#### 触摸优化
- 优化触摸响应
- 使用被动事件监听器
- 实现触摸去抖动

### 8. 高级优化技术

#### Web Workers
将复杂的计算移到Worker线程：
```javascript
// 主线程
const worker = new Worker('animation-worker.js');
worker.postMessage({ animations: activeAnimations });
worker.onmessage = (e) => {
  applyResults(e.data.results);
};
```

#### WebGL 2.0特性
使用WebGL 2.0的新特性提升性能：
- 变换反馈
- 多渲染目标
- 统一缓冲区对象
- 实例化数组

#### 压缩纹理
使用KTX2和 Basis Universal压缩纹理：
```javascript
const ktx2Loader = new KTX2Loader()
  .setTranscoderPath('/basis/')
  .detectSupport(renderer);

ktx2Loader.load('texture.ktx2', (texture) => {
  material.map = texture;
});
```

## 性能监控和分析

### 实时监控
使用Stats.js监控FPS：
```javascript
const stats = new Stats();
stats.showPanel(0); // FPS
document.body.appendChild(stats.dom);

function animate() {
  stats.begin();
  // 渲染代码
  stats.end();
}
```

### 内存监控
监控JavaScript堆内存使用：
```javascript
function checkMemory() {
  if (performance.memory) {
    const used = performance.memory.usedJSHeapSize / 1048576;
    console.log(`内存使用: ${used.toFixed(2)}MB`);
  }
}

setInterval(checkMemory, 5000);
```

### WebGL信息
获取WebGL渲染信息：
```javascript
const info = renderer.info;
console.log({
  drawCalls: info.render.calls,
  triangles: info.render.triangles,
  geometries: info.memory.geometries,
  textures: info.memory.textures
});
```

## 最佳实践总结

### 渲染管线优化
1. 减少Draw Calls（批处理、实例化）
2. 最小化状态切换
3. 使用合适的LOD
4. 优化着色器复杂度

### 内存管理
1. 及时释放资源
2. 使用对象池
3. 限制纹理和几何体大小
4. 监控内存使用

### 响应式设计
1. 根据设备性能调整质量
2. 实现渐进式加载
3. 使用可见性API暂停不可见内容
4. 支持横竖屏切换

### 调试技巧
1. 使用WebGL Inspector
2. 启用Three.js调试模式
3. 分析帧时间分布
4. 使用Chrome DevTools性能面板

## 工具和资源

### 推荐工具
- **Three.js Inspector** - Chrome扩展，调试Three.js场景
- **WebGL Inspector** - 分析WebGL调用
- **Babylon.js Spector.js** - 捕获WebGL帧
- **Google Lighthouse** - 性能审计

### 在线资源
- [Three.js Performance Tips](https://threejs.org/docs/#manual/en/introduction/How-to-use-performance-monitoring)
- [WebGL Best Practices](https://developers.google.com/web/fundamentals/webgl/)
- [MDN WebGL Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

### 示例代码
本项目包含的优化器：
- `ThreeOptimizedUtils.js` - Three.js优化工具集
- `MemoryOptimizer.js` - 内存管理优化
- `GPUOptimizer.js` - GPU利用率优化
- `AnimationOptimizer.js` - 动画性能优化
- `MobileOptimizer.js` - 移动端适配优化
- `PerformanceOptimizedApp.js` - 综合应用示例

通过应用这些优化技术，您的3D应用将能够在各种设备上提供流畅的用户体验。