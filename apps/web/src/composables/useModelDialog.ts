import { ref } from 'vue'

// 模块级单例:模型设置 Dialog 的开关状态(导航栏与 Demo 区共用)
const open = ref(false)

export function useModelDialog() {
  return {
    open,
    show: () => {
      open.value = true
    },
  }
}
