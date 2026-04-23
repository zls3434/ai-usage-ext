#!/bin/bash

# ============================================================================
# AI Usage Extension - 编译打包脚本
# @date 2026-04-23
# @author zls3434
# @purpose 一键完成 TypeScript 类型检查、编译、打包 .vsix 文件
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $1"; exit 1; }

# --------------------------------------------------------------------------
# 步骤 1: 安装依赖
# --------------------------------------------------------------------------
info "Installing dependencies..."
npm install --quiet
ok "Dependencies installed."

# --------------------------------------------------------------------------
# 步骤 2: TypeScript 类型检查
# --------------------------------------------------------------------------
info "Running TypeScript type check..."
if npx tsc --noEmit; then
    ok "Type check passed."
else
    fail "Type check failed. Fix the errors above before packaging."
fi

# --------------------------------------------------------------------------
# 步骤 3: 编译 (esbuild)
# --------------------------------------------------------------------------
info "Compiling with esbuild..."
npm run compile
ok "Compilation done."

# --------------------------------------------------------------------------
# 步骤 4: 打包 .vsix
# --------------------------------------------------------------------------
info "Packaging .vsix..."
if ls ai-usage-ext-*.vsix 1> /dev/null 2>&1; then
    rm -f ai-usage-ext-*.vsix
fi
npx vsce package --allow-missing-repository
VSIX_FILE=$(ls -t ai-usage-ext-*.vsix 2>/dev/null | head -1)

if [ -z "$VSIX_FILE" ]; then
    fail "VSIX file not found after packaging."
fi

VSIX_SIZE=$(du -h "$VSIX_FILE" | cut -f1 | tr -d ' ')
ok "Packaged: $VSIX_FILE ($VSIX_SIZE)"

# --------------------------------------------------------------------------
# 完成
# --------------------------------------------------------------------------
echo ""
echo "============================================"
ok "Build complete!"
echo "  Output: $SCRIPT_DIR/$VSIX_FILE"
echo "  Size:   $VSIX_SIZE"
echo "============================================"