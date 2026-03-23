# 架构说明

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | Electron 33 | 主进程 + 渲染进程分离架构 |
| PPT 生成 | pptxgenjs 3 | 纯 JS 实现，不依赖 LibreOffice |
| 图像处理 | sharp 0.34 | 基于 libvips，高性能原生模块 |
| 前端 | 原生 HTML/CSS/JS | 无框架，保持轻量 |

---

## 进程模型

```
┌─────────────────────────────────────────────────────┐
│                    Electron 应用                     │
│                                                     │
│  ┌──────────────────┐      ┌─────────────────────┐  │
│  │    主进程         │      │    渲染进程           │  │
│  │  (main.js)       │◄────►│  (renderer/index.html│  │
│  │                  │ IPC  │   renderer.js)       │  │
│  │  - 窗口管理      │      │                     │  │
│  │  - 原生对话框    │      │  - 界面交互           │  │
│  │  - 文件系统读写  │      │  - 进度展示           │  │
│  │  - PPT 生成      │      │  - 用户输入           │  │
│  └──────────────────┘      └─────────────────────┘  │
│           ▲                         ▲               │
│           │      ┌──────────────┐   │               │
│           └──────│  preload.js  │───┘               │
│                  │  (安全桥接)  │                   │
│                  └──────────────┘                   │
└─────────────────────────────────────────────────────┘
```

### 为什么需要 preload.js

Electron 默认禁止渲染进程直接访问 Node.js API（`contextIsolation: true`），preload 脚本运行在特权上下文中，通过 `contextBridge.exposeInMainWorld` 将安全的 API 暴露给前端，防止网页内容意外（或恶意）访问系统资源。

---

## IPC 通信通道

| 通道名 | 方向 | 说明 |
|--------|------|------|
| `select-folder` | 渲染 → 主 | 打开文件夹选择对话框，返回路径 |
| `select-save-path` | 渲染 → 主 | 打开文件保存对话框，返回路径 |
| `generate-ppt` | 渲染 → 主 | 触发 PPT 生成，传入 `{ sourceDir, outputPath, compress }` |
| `progress` | 主 → 渲染 | 推送进度更新 `{ current, total, name }` |

所有双向通信均使用 `ipcMain.handle` / `ipcRenderer.invoke` 的 Promise 模式，避免回调嵌套。

---

## PPT 生成流程

```
用户点击"生成 PPT"
        │
        ▼
  collectImages(sourceDir)
  扫描文件夹，过滤图片格式
  按自然排序排列（数字大小 + 中文拼音）
        │
        ▼
  for each 图片:
    ┌── compress = false ──► 直接读取原始文件
    │
    └── compress = true  ──► processImage()
              │
              ▼
        sharp 读取 metadata
        （获取宽高、是否含透明通道）
              │
         超过 2560×1440？
         ├── 是 ──► resize(fit: inside)
         └── 否 ──► 保持原尺寸
              │
         hasAlpha？
         ├── 是 ──► PNG (compressionLevel:9)
         └── 否 ──► JPEG (mozjpeg, quality:85)
              │
              ▼
        计算居中位置（等比铺满幻灯片）
        pptx.addSlide().addImage(base64)
              │
              ▼
  pptx.writeFile(outputPath)
        │
        ▼
  返回 { count, originalSize, compressedSize }
```

---

## 图片排序算法

排序目标：匹配 macOS Finder 的「文件名」默认排序行为。

```
"第9页"  < "第10页"   ← 数字按大小（非字典序）
"工具详解" < "系统提示" ← 中文按拼音（g < x）
```

实现方式：将文件名按 `(\d+)` 分割为文本/数字交替的数组，文本段用 `String.localeCompare('zh-CN')` 比较，数字段转为整数比较。

---

## 自适应压缩策略

PPT 放映时幻灯片实际像素不超过投影仪/屏幕分辨率（通常 1920×1080 ~ 2560×1440），嵌入更高分辨率的图片只会增大文件体积而对显示质量无任何提升。

| 条件 | 处理方式 | 原因 |
|------|----------|------|
| 尺寸 > 2560×1440 | 等比缩放至边界内 | 超出显示范围的像素无意义 |
| 含透明通道 | 输出 PNG | 转 JPEG 会破坏透明度 |
| 不含透明通道 | 输出 JPEG (MozJPEG q85) | MozJPEG 编码效率比标准 libjpeg 高 ≈30% |
| 已是小图 | 仅重编码，不缩放 | `withoutEnlargement: true` 防止放大 |

典型压缩效果：2K PNG 截图（约 2MB）→ JPEG（约 200KB），节省 **90%**。

---

## 构建与发布

```
本地开发:  npx electron .
本地打包:  npm run dist   →  app/dist/*.dmg
CI 发布:   git tag v1.x.x && git push origin v1.x.x
           └─► GitHub Actions 自动构建 arm64 + x64 DMG 并发布 Release
```

详见 [.github/workflows/release.yml](../.github/workflows/release.yml)。

---

## 遗留代码

`python/` 目录保存了项目早期的 Python 命令行版本（基于 `python-pptx` + `Pillow`），已不再作为主要功能维护，仅供参考。当前主体为 Electron 桌面应用。
