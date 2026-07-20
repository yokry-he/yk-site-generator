/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        // 主题语义色(CSS 变量驱动,支持透明度修饰符)
        app: 'rgb(var(--c-bg) / <alpha-value>)',
        soft: 'rgb(var(--c-bg-soft) / <alpha-value>)',
        ink: 'rgb(var(--c-text) / <alpha-value>)',
        sub: 'rgb(var(--c-sub) / <alpha-value>)',
        mut: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        brand1: 'rgb(var(--c-brand1) / <alpha-value>)',
        brand2: 'rgb(var(--c-brand2) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
