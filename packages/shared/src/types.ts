/**
 * 生成产物协议(SF-1-1)。
 *
 * 规划决策(Q5):MVP 产物为「单个自包含 HTML」,架构上抽象为「文件树」,
 * 单 HTML 只是只有 1 个文件的特例,后续可平滑扩展到多文件静态站。
 */

/** 文件树中的单个文件 */
export interface ArtifactFile {
  /** 相对路径,如 `index.html`、`styles/main.css` */
  path: string
  /** 文本内容;binary 为 true 时存放 base64 编码 */
  content: string
  /** 是否为二进制文件(二进制不参与内联与文本处理) */
  binary?: boolean
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
  /** 产物标题(用于 <title> 与 og:title) */
  title: string
  /** 用户的原始需求描述 */
  requirement: string
  /** 生成所用模型与厂商(演示模式可缺省) */
  model?: string
  provider?: string
  /** ISO 时间戳 */
  createdAt: string
  /** 迭代轮次,首次生成为 1(SF-1-6 对话式迭代递增) */
  iteration: number
  /** 父版本产物 id(迭代生成时指向上轮产物) */
  parentId?: string
}

/** 完整产物 = 元信息 + 文件树 */
export interface Artifact {
  meta: ArtifactMeta
  tree: ArtifactFileTree
}
