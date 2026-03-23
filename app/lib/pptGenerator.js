const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const PptxGenJS = require('pptxgenjs');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff']);

// 压缩目标：PPT 16:9 幻灯片最大分辨率
const MAX_WIDTH = 2560;
const MAX_HEIGHT = 1440;

/**
 * 自然排序 key：数字按大小排，其余按 localeCompare（中文走拼音）
 */
function naturalCompare(a, b) {
  const re = /(\d+)/g;
  const aParts = a.split(re);
  const bParts = b.split(re);
  const len = Math.min(aParts.length, bParts.length);

  for (let i = 0; i < len; i++) {
    const aVal = aParts[i];
    const bVal = bParts[i] ?? '';

    // 偶数索引是文本，奇数索引是数字
    if (i % 2 === 1) {
      const diff = parseInt(aVal, 10) - parseInt(bVal || '0', 10);
      if (diff !== 0) return diff;
    } else {
      const diff = aVal.localeCompare(bVal, 'zh-CN', { sensitivity: 'base' });
      if (diff !== 0) return diff;
    }
  }
  return aParts.length - bParts.length;
}

/**
 * 收集并排序图片文件
 */
function collectImages(dirPath) {
  const files = fs.readdirSync(dirPath)
    .filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return IMAGE_EXTS.has(ext) && !f.startsWith('.');
    });

  files.sort(naturalCompare);
  return files;
}

/**
 * 用 sharp 处理图片：获取尺寸 + 可选压缩
 * @param {string} filePath 图片路径
 * @param {boolean} compress 是否压缩
 * @returns {Promise<{width, height, buffer, mimeType}>}
 */
async function processImage(filePath, compress) {
  const image = sharp(filePath);
  const metadata = await image.metadata();
  let { width, height } = metadata;
  const hasAlpha = metadata.hasAlpha;

  if (!compress) {
    // 不压缩：直接读取原始文件
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mimeType = ext === 'jpg' ? 'jpeg' : ext;
    return { width, height, buffer, mimeType };
  }

  // ── 自适应压缩 ──
  let pipeline = image;

  // 超过最大分辨率则等比缩小
  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    pipeline = pipeline.resize(MAX_WIDTH, MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    });
    const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // 有透明通道 → PNG 压缩，否则 → JPEG（MozJPEG 质量 85）
  let buffer, mimeType;
  if (hasAlpha) {
    buffer = await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    mimeType = 'png';
  } else {
    buffer = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    mimeType = 'jpeg';
  }

  return { width, height, buffer, mimeType };
}

/**
 * 生成 PPT
 * @param {string} sourceDir  图片文件夹路径
 * @param {string} outputPath 输出 .pptx 路径
 * @param {object} options    { compress: boolean }
 * @param {Function} onProgress 进度回调 (current, total, fileName)
 * @returns {{ count: number, savedBytes: number }}
 */
async function generatePPT(sourceDir, outputPath, options, onProgress) {
  const compress = options?.compress ?? false;
  const images = collectImages(sourceDir);
  if (images.length === 0) {
    return { count: 0, error: '文件夹中没有找到图片' };
  }

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
  pptx.layout = 'WIDE';

  const slideW = 13.333;
  const slideH = 7.5;
  let totalOriginal = 0;
  let totalCompressed = 0;

  for (let i = 0; i < images.length; i++) {
    const fileName = images[i];
    const filePath = path.join(sourceDir, fileName);

    const { width, height, buffer, mimeType } = await processImage(filePath, compress);

    // 统计压缩效果
    const originalSize = fs.statSync(filePath).size;
    totalOriginal += originalSize;
    totalCompressed += buffer.length;

    // 居中铺满（等比缩放）
    const ratio = Math.min(slideW / width, slideH / height);
    const picW = width * ratio;
    const picH = height * ratio;
    const left = (slideW - picW) / 2;
    const top = (slideH - picH) / 2;

    const base64 = `image/${mimeType};base64,` + buffer.toString('base64');

    const slide = pptx.addSlide();
    slide.addImage({ data: base64, x: left, y: top, w: picW, h: picH });

    if (onProgress) {
      onProgress(i + 1, images.length, fileName);
    }
  }

  await pptx.writeFile({ fileName: outputPath });
  return {
    count: images.length,
    originalSize: totalOriginal,
    compressedSize: totalCompressed,
    savedBytes: totalOriginal - totalCompressed,
  };
}

module.exports = { generatePPT, collectImages };
