import { listSessions, type StoredSession } from './historyStore'
import { addProjectVersion, createProject } from './workspace'

const markerKey = (userId: string, sessionId: string) => `siteforge:migrated:${userId}:${sessionId}`

export async function pendingLocalSessions(userId: string): Promise<StoredSession[]> {
  const sessions = await listSessions()
  return sessions.filter((session) => !localStorage.getItem(markerKey(userId, session.id)))
}

export interface MigrationResult {
  migrated: number
  failed: Array<{ sessionId: string; title: string; message: string }>
}

/** 本地会话保留不删除;云端成功后仅写入用户级迁移标记,支持多账号分别迁移。 */
export async function migrateLocalSessions(userId: string, sessions: StoredSession[]): Promise<MigrationResult> {
  const failed: MigrationResult['failed'] = []
  let migrated = 0

  for (const session of sessions) {
    if (!session.rounds.length) {
      localStorage.setItem(markerKey(userId, session.id), 'empty')
      continue
    }
    try {
      const first = session.rounds[0]
      const project = await createProject({
        title: session.title,
        siteType: session.siteType,
        requirement: session.requirement,
        html: first.html,
        source: 'import',
        instruction: first.instruction || session.requirement,
        model: first.model || session.model,
      })
      for (const round of session.rounds.slice(1)) {
        await addProjectVersion(project.id, {
          html: round.html,
          source: 'iterate',
          instruction: round.instruction,
          model: round.model || session.model,
        })
      }
      localStorage.setItem(markerKey(userId, session.id), project.id)
      migrated += 1
    } catch (err) {
      failed.push({
        sessionId: session.id,
        title: session.title,
        message: err instanceof Error ? err.message : '迁移失败',
      })
    }
  }
  return { migrated, failed }
}
