# 图片转 PPT (img-to-ppt)

一键将文件夹中的图片生成为 PowerPoint 演示文稿，每页一张图片，居中等比铺满。

提供两种使用方式：

- **桌面应用** — Electron GUI，选择文件夹 → 点击生成 → 导出 .pptx
- **命令行脚本** — Python 脚本，适合批量/自动化场景

## 项目结构

```
├── app/                    # Electron 桌面应用
│   ├── main.js             # 主进程
│   ├── preload.js          # 安全桥接
│   ├── renderer/           # 前端界面
│   │   ├── index.html
│   │   ├── style.css
│   │   └── renderer.js
│   ├── lib/
│   │   └── pptGenerator.js # PPT 生成核心
│   └── package.json
├── python/                 # Python 命令行版
│   ├── make_ppt.py
│   └── requirements.txt
└── .gitignore
```

## 桌面应用

### 环境要求

- Node.js >= 18

### 安装 & 运行

```bash
cd app
npm install
npx electron .
```

操作步骤：

1. 点击「选择」按钮选取图片文件夹
2. 点击「选择」按钮指定 PPT 保存位置
3. 点击「生成 PPT」

### 打包分发

```bash
cd app
npm run dist
```

生成的 `.dmg` 文件在 `app/dist/` 目录下，双击安装即可使用。

## Python 命令行版

### 环境要求

- Python >= 3.9

### 安装 & 运行

```bash
cd python
pip install -r requirements.txt
python make_ppt.py
```

默认读取项目根目录下的 `source/` 文件夹，输出 `output.pptx` 到项目根目录。

## 支持的图片格式

PNG、JPG/JPEG、BMP、GIF、TIFF

## 排序规则

按文件名自然排序（数字按大小、中文按拼音），与 macOS Finder 排序一致。

## License

MIT
