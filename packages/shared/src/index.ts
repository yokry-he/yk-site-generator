/**
 * 生成产物协议 —— 占位类型(SF-1-1)。
 *
 * 规划决策(Q5):MVP 产物为「单个自包含 HTML」,但架构上抽象为「文件树」,
 * 单 HTML 只是只有 1 个文件的特例,后续可平滑扩展到多文件静态站。
 *
 * 本包当前仅包含类型定义,序列化/反序列化逻辑在 P1 阶段(SF-1-1)实现。
 */

/** 文件树中的单个文件 */
export interface ArtifactFile {
  /** 相对路径,如 `index.html`、`styles/main.css` */
  path: string
  /** 文本内容;encoding 为 base64 时存放 base64 编码的二进制内容 */
  content: string
  /** 内容编码,默认 utf-8 */
  encoding?: 'utf-8' | 'base64'
}

/** 生成产物:虚拟文件树 */
export interface ArtifactFileTree {
  files: ArtifactFile[]
  /** 入口文件路径;单 HTML 产物固定为 `index.html` */
  entry: string
}

/** 产物元信息 */
export interface ArtifactMeta {
  id: string
  /** 站点类型(14 种之一,如 personal / business / dashboard) */
  siteType: string
  /** 用户的原始需求描述 */
  prompt: string
  /** 生成所用的模型(未接入真实模型时缺省,即演示模式) */
  model?: {
    provider: string
    model: string
  }
  /** ISO 时间戳 */
  createdAt: string
}

/** 完整产物 = 元信息 + 文件树 */
export interface Artifact {
  meta: ArtifactMeta
  tree: ArtifactFileTree
}
