#!/usr/bin/env python3
"""
批量给 api/*.js 端点加 env fallback：
  process.env.DEEPSEEK_KEY  →  process.env.DEEPSEEK_KEY || process.env.DEEPSEEK_API_KEY
  process.env.QWEN_KEY      →  process.env.QWEN_KEY || process.env.DASHSCOPE_API_KEY
  process.env.SUPABASE_URL  →  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.SUPABASE_ANON_KEY → ... || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

跑法：python scripts/patch_env_fallback.py
"""
import re
import sys
from pathlib import Path

API_DIR = Path("C:/Users/86136/Desktop/claude/ai-edu-platform/api")

# 字段 → fallback 字段
FALLBACKS = {
    "DEEPSEEK_KEY": "DEEPSEEK_API_KEY",
    "QWEN_KEY": "DASHSCOPE_API_KEY",
    "SUPABASE_URL": "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_ANON_KEY": "NEXT_PUBLIC_SUPABASE_ANON_KEY",
}

def patch_file(path: Path) -> int:
    txt = path.read_text(encoding="utf-8")
    orig = txt
    edits = 0
    for primary, alias in FALLBACKS.items():
        # 模式：process.env.PRIMARY  →  (process.env.PRIMARY || process.env.ALIAS)
        # 但避开已经做过 fallback 的（含 ||）
        pat = re.compile(
            rf'(?<!\|\| )process\.env\.{primary}(?!\s*\|\|)',
        )
        new_txt, n = pat.subn(
            f'(process.env.{primary} || process.env.{alias})',
            txt,
        )
        if n > 0:
            txt = new_txt
            edits += n
    if txt != orig:
        path.write_text(txt, encoding="utf-8")
    return edits


def main():
    files = sorted(API_DIR.rglob("*.js"))
    total = 0
    for f in files:
        n = patch_file(f)
        if n:
            print(f"  {f.relative_to(API_DIR)}  +{n} fallback")
            total += n
    print(f"\n=== 完成: {total} 处 fallback 加好 ===")

if __name__ == "__main__":
    main()
