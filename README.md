# 图片转 PPT (img-to-ppt)

一键将文件夹中的图片生成为 PowerPoint 演示文稿，每页一张图片，居中等比铺满。

**核心功能：**
- 选择图片文件夹 → 指定保存位置 → 点击生成，全程无命令行
- 自适应图片压缩：大图自动缩放 + MozJPEG 编码，典型场景节省 60-90% 体积，肉眼无损
- 文件名自然排序（数字按大小、中文按拼音），与 Finder 排列一致
- 支持 PNG、JPG、BMP、GIF、TIFF，有透明通道自动保留

## 下载安装

前往 [Releases](../../releases) 页面下载最新 `.dmg`：
- Apple Silicon Mac（M 系列）→ `图片转PPT-arm64.dmg`
- Intel Mac → `图片转PPT-x64.dmg`

## 项目结构

```
├── .github/workflows/
│   └── release.yml         # CI/CD：打 tag 自动发布 Release
├── app/                    # Electron 桌面应用（主体）
│   ├── main.js             # 主进程：窗口管理 + IPC 路由
│   ├── preload.js          # 安全桥接
│   ├── renderer/           # 前端界面
│   │   ├── index.html
│   │   ├── style.css
│   │   └── renderer.js
│   ├── lib/
│   │   └── pptGenerator.js # PPT 生成 + 图片压缩核心
│   └── package.json
├── docs/                   # 技术文档
│   ├── architecture.md     # 架构说明
│   ├── getting-started.md  # 新手指引
│   └── development-guide.md# 开发规范
└── python/                 # ⚠️ 遗留命令行版本，不再维护
```

## 本地开发

**环境要求**：Node.js >= 18

```bash
cd app
npm install
npx electron .
```

## 打包发布

```bash
cd app
npm run dist        # 本地打包
```

或推送 tag 触发 GitHub Actions 自动打包：

```bash
git tag v1.x.x
git push origin v1.x.x
```

## 文档

| 文档 | 说明 |
|------|------|
| [架构说明](docs/architecture.md) | 进程模型、IPC 通道、PPT 生成流程、压缩策略 |
| [新手指引](docs/getting-started.md) | 安装步骤、使用方法、常见问题 |
| [开发规范](docs/development-guide.md) | 目录约定、代码风格、发布流程 |

## License

MIT
