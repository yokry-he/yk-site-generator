export {}

declare global {
  /** 质量分析器统一读取表单提示文本；select 在运行时没有该值，因此保持可选。 */
  interface HTMLSelectElement {
    readonly placeholder?: string
  }
}
