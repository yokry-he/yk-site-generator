export const BRAND_FONT_OPTIONS = [
  { id: 'modern-sans', name: '现代无衬线', stack: "Inter, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif" },
  { id: 'humanist-sans', name: '人文无衬线', stack: "'Avenir Next', Avenir, 'PingFang SC', system-ui, sans-serif" },
  { id: 'editorial-serif', name: '编辑部衬线', stack: "Georgia, 'Noto Serif SC', 'Songti SC', serif" },
  { id: 'geometric-sans', name: '几何无衬线', stack: "Montserrat, 'PingFang SC', system-ui, sans-serif" },
  { id: 'mono', name: '科技等宽', stack: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace" },
] as const

export type BrandFontId = (typeof BRAND_FONT_OPTIONS)[number]['id']
export type BrandButtonStyle = 'solid' | 'soft' | 'outline'
export type BrandShadowStyle = 'none' | 'soft' | 'medium' | 'dramatic'
export type BrandSpacingDensity = 'compact' | 'comfortable' | 'spacious'
export type BrandNavigationStyle = 'minimal' | 'pill' | 'bordered'
export type BrandInputStyle = 'soft' | 'outline' | 'underline'
export type BrandImageStyle = 'square' | 'rounded' | 'organic'
export type BrandIconStyle = 'outline' | 'solid' | 'duotone'

export interface BrandKitTokens {
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
  muted: string
  headingFont: BrandFontId
  bodyFont: BrandFontId
  radius: number
  buttonStyle: BrandButtonStyle
  shadow: BrandShadowStyle
  headingScale?: number
  spacingDensity?: BrandSpacingDensity
  contentWidth?: number
  navigationStyle?: BrandNavigationStyle
  inputStyle?: BrandInputStyle
  imageStyle?: BrandImageStyle
  iconStyle?: BrandIconStyle
}

export interface BrandKit extends BrandKitTokens {
  id: string
  userId?: string
  name: string
  description: string
  logoDataUrl?: string
  logoDarkDataUrl?: string
  logoVerticalDataUrl?: string
  logoMarkDataUrl?: string
  faviconDataUrl?: string
  ogImageDataUrl?: string
  companyName?: string
  companyDescription?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  socialLinks?: Record<string, string>
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface BrandPreset {
  id: string
  name: string
  description: string
  tokens: BrandKitTokens
}

export const BRAND_PRESETS: BrandPreset[] = [
  { id: 'violet-studio', name: 'Violet Studio', description: '克制的紫色品牌感，适合创意工作室与 AI 产品。', tokens: { primary: '#7c3aed', secondary: '#22d3ee', accent: '#f472b6', background: '#09090b', surface: '#18181b', text: '#fafafa', muted: '#a1a1aa', headingFont: 'modern-sans', bodyFont: 'modern-sans', radius: 18, buttonStyle: 'solid', shadow: 'medium', headingScale: 1.05, spacingDensity: 'comfortable', contentWidth: 1180, navigationStyle: 'pill', inputStyle: 'soft', imageStyle: 'rounded', iconStyle: 'duotone' } },
  { id: 'cloud-saas', name: 'Cloud SaaS', description: '清晰、可信、转化导向，适合 SaaS 和企业服务。', tokens: { primary: '#2563eb', secondary: '#0891b2', accent: '#7c3aed', background: '#f8fafc', surface: '#ffffff', text: '#0f172a', muted: '#64748b', headingFont: 'geometric-sans', bodyFont: 'modern-sans', radius: 14, buttonStyle: 'solid', shadow: 'soft', headingScale: 1, spacingDensity: 'comfortable', contentWidth: 1200, navigationStyle: 'bordered', inputStyle: 'outline', imageStyle: 'rounded', iconStyle: 'outline' } },
  { id: 'sage-craft', name: 'Sage Craft', description: '自然、温暖、带手作质感，适合生活方式品牌。', tokens: { primary: '#047857', secondary: '#a16207', accent: '#be123c', background: '#fafaf5', surface: '#ffffff', text: '#292524', muted: '#78716c', headingFont: 'editorial-serif', bodyFont: 'humanist-sans', radius: 12, buttonStyle: 'soft', shadow: 'soft', headingScale: 1.08, spacingDensity: 'spacious', contentWidth: 1120, navigationStyle: 'minimal', inputStyle: 'underline', imageStyle: 'organic', iconStyle: 'outline' } },
  { id: 'editorial-ink', name: 'Editorial Ink', description: '强排版、低饱和，适合作品集、杂志和个人品牌。', tokens: { primary: '#111827', secondary: '#4b5563', accent: '#dc2626', background: '#f5f1e8', surface: '#fffdf8', text: '#1c1917', muted: '#78716c', headingFont: 'editorial-serif', bodyFont: 'humanist-sans', radius: 6, buttonStyle: 'outline', shadow: 'none', headingScale: 1.12, spacingDensity: 'spacious', contentWidth: 1040, navigationStyle: 'minimal', inputStyle: 'underline', imageStyle: 'square', iconStyle: 'outline' } },
  { id: 'neon-grid', name: 'Neon Grid', description: '高对比霓虹与等宽字体，适合开发者和数据产品。', tokens: { primary: '#22c55e', secondary: '#06b6d4', accent: '#e879f9', background: '#020617', surface: '#0f172a', text: '#f8fafc', muted: '#94a3b8', headingFont: 'mono', bodyFont: 'modern-sans', radius: 8, buttonStyle: 'outline', shadow: 'dramatic', headingScale: .96, spacingDensity: 'compact', contentWidth: 1280, navigationStyle: 'bordered', inputStyle: 'outline', imageStyle: 'square', iconStyle: 'duotone' } },
  { id: 'sunset-commerce', name: 'Sunset Commerce', description: '温暖、活力、商品感强，适合餐饮与电商展示。', tokens: { primary: '#ea580c', secondary: '#db2777', accent: '#facc15', background: '#fff7ed', surface: '#ffffff', text: '#431407', muted: '#9a3412', headingFont: 'geometric-sans', bodyFont: 'humanist-sans', radius: 20, buttonStyle: 'solid', shadow: 'medium', headingScale: 1.04, spacingDensity: 'comfortable', contentWidth: 1200, navigationStyle: 'pill', inputStyle: 'soft', imageStyle: 'rounded', iconStyle: 'solid' } },
]

const HEX_RE = /^#[0-9a-f]{6}$/i
export function isHexColor(value: string): boolean { return HEX_RE.test(value) }
export function normalizeHex(value: string, fallback = '#000000'): string {
  const trimmed = value.trim()
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) return `#${trimmed.slice(1).split('').map((char) => `${char}${char}`).join('')}`.toLowerCase()
  return isHexColor(trimmed) ? trimmed.toLowerCase() : fallback
}
function rgb(hex: string): [number, number, number] { const value = normalizeHex(hex).slice(1); return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number] }
function linearChannel(channel: number): number { const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4 }
export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => { const [red, green, blue] = rgb(hex).map(linearChannel); return 0.2126 * red + 0.7152 * green + 0.0722 * blue }
  const first = luminance(foreground); const second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}
export function bestContrastText(background: string): '#000000' | '#ffffff' { return contrastRatio('#000000', background) >= contrastRatio('#ffffff', background) ? '#000000' : '#ffffff' }
export function fontStack(id: BrandFontId): string { return BRAND_FONT_OPTIONS.find((font) => font.id === id)?.stack ?? BRAND_FONT_OPTIONS[0].stack }
export function brandShadow(style: BrandShadowStyle): string { if (style === 'none') return 'none'; if (style === 'soft') return '0 10px 30px rgba(15,23,42,.10)'; if (style === 'dramatic') return '0 28px 80px rgba(15,23,42,.28)'; return '0 18px 50px rgba(15,23,42,.18)' }
function escapeCss(value: string): string { return value.replace(/[{};]/g, '') }
function safeText(value: string | undefined): string | undefined { return value?.trim().slice(0, 500) || undefined }
function spacingValue(density: BrandSpacingDensity | undefined): string { return density === 'compact' ? '.82' : density === 'spacious' ? '1.2' : '1' }
function imageRadius(style: BrandImageStyle | undefined, radius: number): string { if (style === 'square') return '0px'; if (style === 'organic') return `${Math.max(20, radius * 2)}px ${Math.max(8, radius)}px ${Math.max(24, radius * 2.5)}px ${Math.max(10, radius * 1.2)}px`; return `${Math.max(8, radius)}px` }

export function brandCssVariables(tokens: BrandKitTokens): string {
  const radius = Math.min(32, Math.max(0, Math.round(tokens.radius)))
  return [
    `--sf-brand-primary:${normalizeHex(tokens.primary, '#7c3aed')}`, `--sf-brand-secondary:${normalizeHex(tokens.secondary, '#22d3ee')}`, `--sf-brand-accent:${normalizeHex(tokens.accent, '#f472b6')}`,
    `--sf-brand-background:${normalizeHex(tokens.background, '#ffffff')}`, `--sf-brand-surface:${normalizeHex(tokens.surface, '#ffffff')}`, `--sf-brand-text:${normalizeHex(tokens.text, '#18181b')}`, `--sf-brand-muted:${normalizeHex(tokens.muted, '#71717a')}`,
    `--sf-brand-heading-font:${escapeCss(fontStack(tokens.headingFont))}`, `--sf-brand-body-font:${escapeCss(fontStack(tokens.bodyFont))}`, `--sf-brand-radius:${radius}px`, `--sf-brand-shadow:${brandShadow(tokens.shadow)}`,
    `--sf-brand-heading-scale:${Math.min(1.35, Math.max(.8, tokens.headingScale ?? 1))}`, `--sf-brand-spacing:${spacingValue(tokens.spacingDensity)}`, `--sf-brand-content-width:${Math.min(1600, Math.max(720, tokens.contentWidth ?? 1200))}px`, `--sf-brand-image-radius:${imageRadius(tokens.imageStyle, radius)}`,
    `--primary:${normalizeHex(tokens.primary, '#7c3aed')}`, `--secondary:${normalizeHex(tokens.secondary, '#22d3ee')}`, `--accent:${normalizeHex(tokens.accent, '#f472b6')}`, `--background:${normalizeHex(tokens.background, '#ffffff')}`, `--foreground:${normalizeHex(tokens.text, '#18181b')}`,
  ].join(';')
}

const BRAND_STYLE_RE = /<style\s+id=["']siteforge-brand-kit["'][^>]*>[\s\S]*?<\/style>/gi
const BRAND_PROFILE_RE = /<script\s+id=["']siteforge-brand-profile["'][^>]*>[\s\S]*?<\/script>/gi
const BRAND_OG_RE = /<meta\b[^>]*property=["']og:image["'][^>]*>/i

export function applyBrandKitToHtml(html: string, kit: Pick<BrandKit, keyof BrandKitTokens | 'id'> & Partial<BrandKit>): string {
  const clean = html.replace(BRAND_STYLE_RE, '').replace(BRAND_PROFILE_RE, '')
  const buttonText = bestContrastText(kit.primary)
  const solidButton = kit.buttonStyle === 'solid'
    ? `background:var(--sf-brand-primary)!important;color:${buttonText}!important;border-color:transparent!important;`
    : kit.buttonStyle === 'soft'
      ? `background:color-mix(in srgb,var(--sf-brand-primary) 14%,transparent)!important;color:var(--sf-brand-primary)!important;border-color:color-mix(in srgb,var(--sf-brand-primary) 30%,transparent)!important;`
      : `background:transparent!important;color:var(--sf-brand-primary)!important;border-color:var(--sf-brand-primary)!important;`
  const navigation = kit.navigationStyle === 'pill'
    ? 'nav a{border-radius:999px;padding:.65em 1em}nav a:hover{background:color-mix(in srgb,var(--sf-brand-primary) 10%,transparent)}'
    : kit.navigationStyle === 'bordered'
      ? 'nav{border-bottom:1px solid color-mix(in srgb,var(--sf-brand-muted) 25%,transparent)}'
      : 'nav a{text-decoration-thickness:1px;text-underline-offset:.35em}'
  const inputs = kit.inputStyle === 'underline'
    ? 'input,textarea,select{border:0!important;border-bottom:1px solid var(--sf-brand-muted)!important;border-radius:0!important;background:transparent!important}'
    : kit.inputStyle === 'soft'
      ? 'input,textarea,select{border-color:transparent!important;background:color-mix(in srgb,var(--sf-brand-surface) 84%,var(--sf-brand-muted))!important}'
      : 'input,textarea,select{border:1px solid color-mix(in srgb,var(--sf-brand-muted) 45%,transparent)!important;background:var(--sf-brand-surface)!important}'
  const icons = kit.iconStyle === 'solid'
    ? 'svg[data-icon],.icon{fill:currentColor;stroke-width:0}'
    : kit.iconStyle === 'duotone'
      ? 'svg[data-icon],.icon{filter:drop-shadow(2px 2px 0 color-mix(in srgb,var(--sf-brand-secondary) 32%,transparent))}'
      : 'svg[data-icon],.icon{fill:none;stroke-width:1.75}'
  const style = `<style id="siteforge-brand-kit" data-brand-kit="${escapeCss(kit.id)}">
:root{${brandCssVariables(kit)}}
html,body{background-color:var(--sf-brand-background)!important;color:var(--sf-brand-text)!important;font-family:var(--sf-brand-body-font)!important}
body{--sf-section-space:calc(1rem * var(--sf-brand-spacing))}
h1,h2,h3,h4,h5,h6{font-family:var(--sf-brand-heading-font)!important;line-height:1.12}h1{font-size:calc(clamp(2.4rem,7vw,5.4rem) * var(--sf-brand-heading-scale))}h2{font-size:calc(clamp(1.9rem,5vw,3.8rem) * var(--sf-brand-heading-scale))}
main>section,body>section,body>main,body>header>div,body>footer>div{max-width:var(--sf-brand-content-width);margin-left:auto;margin-right:auto}
a{color:var(--sf-brand-primary)}
button,[role="button"],.btn,.button{border-radius:var(--sf-brand-radius);${solidButton}}
.card,[class*="card"],section[data-card]{border-radius:var(--sf-brand-radius);box-shadow:var(--sf-brand-shadow)}
img:not([data-no-brand-style]){border-radius:var(--sf-brand-image-radius)}
${navigation}${inputs}${icons}
</style>`
  let themed = /<\/head>/i.test(clean) ? clean.replace(/<\/head>/i, `${style}\n</head>`) : `${style}\n${clean}`
  const themeMeta = `<meta name="theme-color" content="${normalizeHex(kit.primary, '#7c3aed')}" />`
  themed = /<meta\b[^>]*name=["']theme-color["'][^>]*>/i.test(themed) ? themed.replace(/<meta\b[^>]*name=["']theme-color["'][^>]*>/i, themeMeta) : themed.replace(/<\/head>/i, `${themeMeta}\n</head>`)
  if (kit.ogImageDataUrl) {
    const og = `<meta property="og:image" content="${kit.ogImageDataUrl.replace(/["<>]/g, '')}" />`
    themed = BRAND_OG_RE.test(themed) ? themed.replace(BRAND_OG_RE, og) : themed.replace(/<\/head>/i, `${og}\n</head>`)
  }
  const profile = { '@context': 'https://schema.org', '@type': 'Organization', name: safeText(kit.companyName) || safeText(kit.name), description: safeText(kit.companyDescription) || safeText(kit.description), email: safeText(kit.contactEmail), telephone: safeText(kit.contactPhone), address: safeText(kit.address), url: kit.socialLinks }
  if (Object.values(profile).some(Boolean)) {
    const script = `<script id="siteforge-brand-profile" type="application/ld+json">${JSON.stringify(profile).replace(/<\//g, '<\\/')}</script>`
    themed = /<\/head>/i.test(themed) ? themed.replace(/<\/head>/i, `${script}\n</head>`) : `${script}\n${themed}`
  }
  return themed
}
