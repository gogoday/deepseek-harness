import { describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { TestWorkspaces } from '../src/workspaces.ts'

const sessionId = 'restored' as SessionId

describe('TestWorkspaces archive membership', () => {
  it('records idempotent archive and restore mutations', async () => {
    const workspaces = new TestWorkspaces(async (operation) => { await operation() })
    await workspaces.archiveSession(sessionId)
    await workspaces.archiveSession(sessionId)
    expect(workspaces.list.getSnapshot().archivedSessionIds).toEqual([sessionId])
    await workspaces.unarchiveSession(sessionId)
    await workspaces.unarchiveSession(sessionId)
    expect(workspaces.list.getSnapshot().archivedSessionIds).toEqual([])
    expect(workspaces.calls.map(call => call.method)).toEqual([
      'archiveSession', 'archiveSession', 'unarchiveSession', 'unarchiveSession',
    ])
  })

  it('delegates restore stubs without changing the fixture snapshot', async () => {
    const workspaces = new TestWorkspaces(async (operation) => { await operation() })
    await workspaces.archiveSession(sessionId)
    const stub = vi.fn(async () => { throw new Error('restore failed') })
    workspaces.stub('unarchiveSession', stub)
    await expect(workspaces.unarchiveSession(sessionId)).rejects.toThrow('restore failed')
    expect(stub).toHaveBeenCalledWith(sessionId)
    expect(workspaces.list.getSnapshot().archivedSessionIds).toEqual([sessionId])
  })
})
