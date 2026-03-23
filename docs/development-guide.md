# 开发规范

## 目录结构约定

```
img_to_ppt/
├── .github/
│   └── workflows/
│       └── release.yml     # CI/CD：打 tag 后自动发布
├── app/                    # ★ 主体：Electron 桌面应用
│   ├── main.js             # 主进程入口，负责窗口 + IPC
│   ├── preload.js          # 安全桥接，暴露 API 给渲染进程
│   ├── renderer/           # 渲染进程（纯前端，无 Node.js 权限）
│   │   ├── index.html
│   │   ├── style.css
│   │   └── renderer.js
│   ├── lib/                # 业务逻辑（仅在主进程中 require）
│   │   └── pptGenerator.js
│   └── package.json
├── docs/                   # 技术文档
│   ├── architecture.md
│   ├── getting-started.md
│   └── development-guide.md
├── python/                 # ⚠️ 遗留代码，不再维护
│   ├── make_ppt.py
│   └── requirements.txt
└── .gitignore
```

**原则**：
- 所有文件系统操作、原生模块调用只能在 `main.js` 或 `lib/` 中进行，不允许在 `renderer/` 中直接使用 `fs`、`path` 等 Node.js 模块
- 新增业务逻辑放在 `lib/` 下独立文件，保持 `main.js` 只做 IPC 路由

---

## IPC 命名规范

| 规则 | 示例 |
|------|------|
| 全小写，单词用 `-` 连接 | `generate-ppt`、`select-folder` |
| 动词在前，名词在后 | `get-image-list`，不用 `image-list-get` |
| 主进程推送事件用名词 | `progress`、`error` |

新增 IPC 通道时，需同时修改三处：
1. `main.js` — `ipcMain.handle('通道名', handler)`
2. `preload.js` — `contextBridge.exposeInMainWorld` 中添加方法
3. `renderer/renderer.js` — 调用 `window.api.方法名()`

---

## 代码风格

- **JavaScript**：CommonJS（`require` / `module.exports`），不使用 ES Module（Electron 主进程兼容性更好）
- **异步**：统一使用 `async/await`，避免直接使用回调
- **错误处理**：主进程的 IPC handler 内用 `try/catch` 捕获异常，通过返回值的 `{ error: string }` 字段传递给前端
- **缩进**：2 个空格
- **字符串**：优先使用单引号，模板字符串用于拼接

---

## 依赖管理

| 包 | 类型 | 说明 |
|----|------|------|
| `electron` | devDependency | 开发运行时，不打包进应用 |
| `electron-builder` | devDependency | 打包工具 |
| `pptxgenjs` | dependency | 打包进应用 |
| `sharp` | dependency | 原生模块，打包时需重编译 |

> **添加新依赖时注意**：`sharp` 这类含原生 C++ 扩展的模块需要针对 Electron 的 Node.js 版本重新编译。本地通过 `npm install`（触发 `postinstall` → `electron-builder install-app-deps`）自动处理；CI 中有单独的重编译步骤。

---

## 发布流程

### 版本号规范（遵循 Semantic Versioning）

- `v1.0.0` → 重大重构或不兼容的功能变更
- `v1.1.0` → 新增功能
- `v1.1.1` → Bug 修复

### 发布步骤

```bash
# 1. 更新 app/package.json 中的 version 字段
#    例如: "version": "1.1.0"

# 2. 提交所有改动
git add -A
git commit -m "release: v1.1.0"

# 3. 打 tag（必须以 v 开头）
git tag v1.1.0

# 4. 推送代码和 tag
git push
git push origin v1.1.0
```

推送 tag 后，GitHub Actions 自动执行：
- 在 macOS 环境安装依赖并重编译原生模块
- 打包 Apple Silicon (arm64) 和 Intel (x64) 两个 DMG
- 创建 GitHub Release，附带安装包和自动生成的更新日志

也可在 GitHub → Actions → 「构建并发布 Release」→ 「Run workflow」手动触发。

---

## 本地调试

```bash
cd app

# 启动应用（带 DevTools）
npx electron .

# 在应用窗口中打开 DevTools
# 渲染进程：右键 → 检查元素
# 主进程日志：直接打印在启动的终端中
```

主进程的 `console.log` 输出在终端，渲染进程的 `console.log` 输出在 DevTools Console 面板。

---

## 关于遗留 Python 代码

`python/make_ppt.py` 是项目的早期版本，使用 `python-pptx` + `Pillow` 实现，功能与 Electron 版等价。

- 不再作为主功能维护，不接受新特性 PR
- Bug 修复视情况处理
- 如有命令行/自动化场景需求，可基于此文件独立维护
