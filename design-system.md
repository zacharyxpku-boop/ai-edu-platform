# 原点智学 Design System v2.0

## Brand Identity
- **Tagline**: 让每个孩子站在更高的出发点
- **Value Prop**: 学得快 × 考得高 × 思维好 × 有产出
- **Tone**: 专业但温暖，理性不冷漠，引领不焦虑

## Typography
- **Primary**: "Noto Serif SC", serif (headings — 有文化厚度，不是AI默认)
- **Body**: "Noto Sans SC", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif
- **BANNED**: Inter, Roboto, Arial, Open Sans, Poppins

### Scale (mobile-first)
| Token | Mobile | Desktop | Weight |
|-------|--------|---------|--------|
| --fs-hero | 2rem | 3.2rem | 900 |
| --fs-h2 | 1.5rem | 2rem | 800 |
| --fs-h3 | 1.15rem | 1.35rem | 700 |
| --fs-body | 1rem | 1.05rem | 400 |
| --fs-small | 0.875rem | 0.875rem | 400 |
| --fs-caption | 0.75rem | 0.8rem | 400 |

## Color Palette

### Primary — Warm Ink 暖墨色系 (NOT purple-to-blue)
| Token | Hex | Usage |
|-------|-----|-------|
| --c-ink | #1A1A2E | 主背景、深色块 |
| --c-ink-light | #16213E | 次背景、卡片 |
| --c-ink-surface | #0F3460 | 表面色、hover态 |

### Accent — 原点橙 (品牌识别色)
| Token | Hex | Usage |
|-------|-----|-------|
| --c-origin | #E94D35 | 主CTA、品牌标记 |
| --c-origin-soft | #FF6B4A | hover态、渐变末端 |
| --c-origin-glow | rgba(233,77,53,0.15) | 光晕、背景点缀 |

### Warm Neutral 暖灰
| Token | Hex | Usage |
|-------|-----|-------|
| --c-warm-white | #F5F0EB | 浅色文字、亮色背景 |
| --c-warm-gray | #B8B0A8 | 辅助文字 |
| --c-warm-dim | #7A7067 | 弱化文字 |

### Semantic
| Token | Hex |
|-------|-----|
| --c-success | #2D9F6F |
| --c-warning | #D4A843 |
| --c-error | #C94040 |

### BANNED Gradients
- purple-to-blue gradient
- violet-to-fuchsia
- Any gradient with both #6366F1 and #3B82F6

### Allowed Gradients
- `--grad-hero: linear-gradient(135deg, #1A1A2E 0%, #0F3460 100%)`
- `--grad-cta: linear-gradient(135deg, #E94D35, #FF6B4A)`
- `--grad-warm: linear-gradient(180deg, #1A1A2E, #16213E)`

## Spacing
| Token | Value |
|-------|-------|
| --sp-xs | 4px |
| --sp-sm | 8px |
| --sp-md | 16px |
| --sp-lg | 24px |
| --sp-xl | 40px |
| --sp-2xl | 64px |
| --sp-3xl | 96px |
| --sp-section | clamp(64px, 10vw, 120px) |

## Border Radius
| Token | Value |
|-------|-------|
| --r-sm | 4px |
| --r-md | 8px |
| --r-lg | 12px |
| --r-pill | 100px |
| **BANNED** | rounded-3xl (24px+), anything > 16px on cards |

## Shadows
| Token | Value |
|-------|-------|
| --shadow-card | 0 1px 3px rgba(0,0,0,0.2) |
| --shadow-hover | 0 4px 12px rgba(0,0,0,0.3) |
| --shadow-cta | 0 4px 16px rgba(233,77,53,0.25) |
| **BANNED** | shadow-2xl, any shadow > 20px blur |

## Layout
- **Max width**: 1120px (content), 1280px (full-bleed)
- **Grid**: CSS Grid, NOT flexbox-only
- **BANNED**: Three-column equal-width card grids
- **Preferred**: 2-col asymmetric, 1-col stacked on mobile, masonry, offset grids

## Motion
| Trigger | Animation |
|---------|-----------|
| Hero load | Stagger fade-up, 0.1s delay per element |
| Section enter | fade-up, 0.5s, ease-out, threshold 0.1 |
| Card hover | translateY(-2px) + shadow-hover, 0.2s |
| CTA hover | scale(1.02) + shadow-cta, 0.2s |
| Nav scroll | backdrop-filter: blur(12px), 0.3s |

## Copy Rules
### BANNED Phrases
- "AI驱动" / "AI-powered"
- "智能洞察" / "Get insights"
- "Powered by AI"
- "Save time"
- Any generic SaaS marketing language

### Preferred Voice
- Use specific numbers: "3个月内孩子独立完成AI辅助项目作品"
- Use real scenarios: "孩子用AI做了一份城市旅行指南"
- Use the brand's own language: "学得快×考得高×思维好×有产出"
- Speak to parents' dual anxiety: scores AND future-readiness
