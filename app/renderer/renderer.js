const $sourceDir = document.getElementById('sourceDir');
const $outputPath = document.getElementById('outputPath');
const $imageCount = document.getElementById('imageCount');
const $btnFolder = document.getElementById('btnSelectFolder');
const $btnSave = document.getElementById('btnSelectSave');
const $btnGenerate = document.getElementById('btnGenerate');
const $progressWrap = document.getElementById('progressWrap');
const $progressFill = document.getElementById('progressFill');
const $progressText = document.getElementById('progressText');
const $compressToggle = document.getElementById('compressToggle');

// ── 选择图片文件夹 ──
$btnFolder.addEventListener('click', async () => {
  const dir = await window.api.selectFolder();
  if (dir) {
    $sourceDir.value = dir;
    $imageCount.textContent = '正在扫描…';
    // 自动填充保存路径
    if (!$outputPath.value) {
      const parentDir = dir.replace(/\/[^/]*$/, '');
      $outputPath.value = parentDir + '/output.pptx';
    }
    // 我们不在渲染进程直接读文件系统，先清掉提示
    $imageCount.textContent = '已选择文件夹';
  }
});

// ── 选择保存位置 ──
$btnSave.addEventListener('click', async () => {
  const p = await window.api.selectSavePath();
  if (p) $outputPath.value = p;
});

// ── 进度回调 ──
window.api.onProgress(({ current, total, name }) => {
  const pct = Math.round((current / total) * 100);
  $progressFill.style.width = pct + '%';
  $progressText.textContent = `正在处理 (${current}/${total}): ${name}`;
});

// ── 生成 PPT ──
$btnGenerate.addEventListener('click', async () => {
  const sourceDir = $sourceDir.value;
  const outputPath = $outputPath.value;

  if (!sourceDir) return alert('请先选择图片文件夹');
  if (!outputPath) return alert('请先选择保存位置');

  $btnGenerate.disabled = true;
  $btnGenerate.textContent = '生成中…';
  $progressWrap.style.display = 'block';
  $progressFill.style.width = '0%';
  $progressText.textContent = '准备中…';

  try {
    const compress = $compressToggle.checked;
    const result = await window.api.generatePPT({ sourceDir, outputPath, compress });
    if (result.error) {
      alert(result.error);
    } else {
      $progressFill.style.width = '100%';
      let msg = `PPT 已生成！\n共 ${result.count} 页\n保存到：${outputPath}`;
      if (compress && result.savedBytes > 0) {
        const origMB = (result.originalSize / 1048576).toFixed(1);
        const compMB = (result.compressedSize / 1048576).toFixed(1);
        const pct = Math.round((1 - result.compressedSize / result.originalSize) * 100);
        $progressText.textContent = `完成！共 ${result.count} 页 | 图片 ${origMB}MB → ${compMB}MB（节省 ${pct}%）`;
        msg += `\n\n图片压缩：${origMB}MB → ${compMB}MB（节省 ${pct}%）`;
      } else {
        $progressText.textContent = `完成！共生成 ${result.count} 页`;
      }
      alert(msg);
    }
  } catch (err) {
    alert('生成失败：' + err.message);
  } finally {
    $btnGenerate.disabled = false;
    $btnGenerate.textContent = '生成 PPT';
  }
});
