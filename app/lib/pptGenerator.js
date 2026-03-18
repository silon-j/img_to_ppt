const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff']);

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
 * 从 Buffer 解析图片尺寸（支持 PNG / JPEG / BMP / GIF）
 */
function getImageSize(filePath) {
  const buf = fs.readFileSync(filePath);

  // PNG: 宽高在第 16-23 字节
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // GIF: 宽高在第 6-9 字节 (little-endian)
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  // BMP: 宽高在第 18-25 字节
  if (buf[0] === 0x42 && buf[1] === 0x4d) {
    return { width: buf.readUInt32LE(18), height: Math.abs(buf.readInt32LE(22)) };
  }

  // JPEG: 需要查找 SOF 标记
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset < buf.length - 1) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1];
      // SOF0 ~ SOF15 (排除 DHT/DRI 等)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
      }
      const segLen = buf.readUInt16BE(offset + 2);
      offset += 2 + segLen;
    }
  }

  throw new Error('无法识别图片格式: ' + path.basename(filePath));
}

/**
 * 生成 PPT
 * @param {string} sourceDir  图片文件夹路径
 * @param {string} outputPath 输出 .pptx 路径
 * @param {Function} onProgress 进度回调 (current, total, fileName)
 * @returns {{ count: number }}
 */
async function generatePPT(sourceDir, outputPath, onProgress) {
  const images = collectImages(sourceDir);
  if (images.length === 0) {
    return { count: 0, error: '文件夹中没有找到图片' };
  }

  const pptx = new PptxGenJS();
  // 16:9 宽屏
  pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
  pptx.layout = 'WIDE';

  const slideW = 13.333; // inches
  const slideH = 7.5;

  for (let i = 0; i < images.length; i++) {
    const fileName = images[i];
    const filePath = path.join(sourceDir, fileName);
    const dims = getImageSize(filePath);

    // 居中铺满（等比缩放）
    const ratioW = slideW / dims.width;
    const ratioH = slideH / dims.height;
    const ratio = Math.min(ratioW, ratioH);

    const picW = dims.width * ratio;
    const picH = dims.height * ratio;
    const left = (slideW - picW) / 2;
    const top = (slideH - picH) / 2;

    // 读取图片为 base64
    const imgData = fs.readFileSync(filePath);
    const ext = path.extname(fileName).toLowerCase().replace('.', '');
    const mimeType = ext === 'jpg' ? 'jpeg' : ext;
    const base64 = `image/${mimeType};base64,` + imgData.toString('base64');

    const slide = pptx.addSlide();
    slide.addImage({
      data: base64,
      x: left,
      y: top,
      w: picW,
      h: picH,
    });

    if (onProgress) {
      onProgress(i + 1, images.length, fileName);
    }
  }

  await pptx.writeFile({ fileName: outputPath });
  return { count: images.length };
}

module.exports = { generatePPT, collectImages };
