export interface StreamTextBuffer {
  push(delta: string): void
  flush(): void
  clear(): void
  dispose(): void
}

/** Batch provider token fragments so Vue and iframe preview are not updated for every token. */
export function createStreamTextBuffer(
  onFlush: (text: string, tokenCount: number) => void,
  delayMs = 40,
): StreamTextBuffer {
  let chunks: string[] = []
  let tokenCount = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  function cancelTimer() {
    if (timer) clearTimeout(timer)
    timer = null
  }

  function flush() {
    cancelTimer()
    if (!chunks.length) return
    const text = chunks.join('')
    const count = tokenCount
    chunks = []
    tokenCount = 0
    onFlush(text, count)
  }

  function push(delta: string) {
    if (!delta) return
    chunks.push(delta)
    tokenCount += 1
    if (!timer) timer = setTimeout(flush, delayMs)
  }

  function clear() {
    cancelTimer()
    chunks = []
    tokenCount = 0
  }

  return { push, flush, clear, dispose: clear }
}
