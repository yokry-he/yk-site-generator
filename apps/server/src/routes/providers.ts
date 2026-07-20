import { Hono } from 'hono'
import { errorBody } from '../types'

/**
 * 模型厂商路由(占位)。
 * TODO(SF-1-4):实现 POST /test —— 真实测试连接,超时控制与错误分类
 * (Key 错误 / 额度不足 / 网络故障)。
 */
const providers = new Hono()

providers.post('/test', (c) =>
  c.json(errorBody('NOT_IMPLEMENTED', '测试连接接口将在 SF-1-4 实现'), 501),
)

export default providers
