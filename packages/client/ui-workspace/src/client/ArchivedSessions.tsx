/** Archived Session browsing; viewing never mutates archive membership. */
import { useState } from 'react'
import { Button, IconArchiveOutline20 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import css from './ArchivedSessions.module.css'

/** Actions bound to the owning UI navigation and Workspace Controller. */
export type ArchivedSessionsInjected = {
  /** Open content without changing archive membership. */
  open: (sessionId: SessionId) => void
  /** Restore sidebar visibility; rejection leaves the row available for retry. */
  unarchive: (sessionId: SessionId) => Promise<void>
}

/** Root-scoped archive page with framework-provided data and locale seats. */
export type ArchivedSessionsProps = PropsRuntime<'main'> & PropsLocale<'workspace'> & ArchivedSessionsInjected

/**
 * Render the sidebar's decorative archive glyph.
 * @param props - Sidebar-owned icon geometry.
 * @returns Archive icon.
 */
export function ArchivedSessionsIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <IconArchiveOutline20 size={size} />
}

function ArchivedSessionRow({ sessionId, title, available, open, unarchive, t }: ArchivedSessionsInjected & {
  sessionId: SessionId
  title: string
  available: boolean
  t: ArchivedSessionsProps['t']
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const restore = async (): Promise<void> => {
    setPending(true)
    setError(null)
    try {
      await unarchive(sessionId)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setPending(false)
    }
  }
  return (
    <li className={css.row}>
      <div className={css.details}>
        <span className={css.title}>{title}</span>
        <span className={css.meta}>{sessionId}</span>
        {!available && <span className={css.meta}>{t('archived.unavailable')}</span>}
        {error !== null && <span className={css.error} role="alert">{t('archived.restoreError', { error })}</span>}
      </div>
      <div className={css.actions}>
        <Button size="sm" disabled={!available} onClick={() => { open(sessionId) }}>
          {t('archived.view')}
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => { void restore() }}>
          {pending ? t('archived.restoring') : t('archived.restore')}
        </Button>
      </div>
    </li>
  )
}

/**
 * Render archived ids from the authoritative Workspace snapshot, including unavailable Sessions.
 * @param props - Standard snapshots, localized copy and injected actions.
 * @returns Archive page with loading, error, empty and per-row mutation states.
 */
export function ArchivedSessions({ useSessions, useWorkspaces, open, unarchive, t }: ArchivedSessionsProps) {
  const sessions = useSessions(state => state)
  const workspaces = useWorkspaces(state => state)
  const loading = workspaces.phase !== 'ready' || workspaces.state === 'loading' || sessions.phase !== 'ready'
  const failed = workspaces.state === 'error'
  return (
    <section className={css.root} aria-label={t('archived.title')}>
      <header className={css.header}>
        <h1 className={css.heading}>{t('archived.title')}</h1>
        <p className={css.meta}>{t('archived.description')}</p>
      </header>
      {failed && <p className={css.error} role="alert">{t('archived.loadError')}</p>}
      {loading && !failed && <p className={css.meta} role="status">{t('archived.loading')}</p>}
      {!loading && !failed && workspaces.archivedSessionIds.length === 0 && (
        <p className={css.meta}>{t('archived.empty')}</p>
      )}
      <ul className={css.list}>
        {workspaces.archivedSessionIds.map((sessionId) => {
          const session = sessions.byId[sessionId]
          return (
            <ArchivedSessionRow
              key={sessionId}
              sessionId={sessionId}
              title={session?.displayTitle || sessionId}
              available={session !== undefined}
              open={open}
              unarchive={unarchive}
              t={t}
            />
          )
        })}
      </ul>
    </section>
  )
}
