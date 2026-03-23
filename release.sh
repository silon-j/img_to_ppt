#!/bin/bash
set -e

# 从 app/package.json 读取版本号
VERSION=$(node -p "require('./app/package.json').version")
TAG="v$VERSION"

echo "准备发布 $TAG"

# 检查 tag 是否已存在
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "错误：tag $TAG 已存在，请先修改 app/package.json 中的 version"
  exit 1
fi

# 确认
read -p "确认发布 $TAG？(y/N) " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || exit 0

git add -A
git diff --cached --quiet || git commit -m "release: $TAG"
git tag "$TAG"
git push
git push origin "$TAG"

echo "✓ 已推送 $TAG，GitHub Actions 正在构建，稍后在 Releases 页面查看"
