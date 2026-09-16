// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { ArchivedSessions, ArchivedSessionsIcon, type ArchivedSessionsProps } from '../src/client/ArchivedSessions.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)
const sid = (value: string) => value as SessionId
const sessions: SessionListState = {
  ids: [sid('archived'), sid('visible')],
  byId: {
    [sid('archived')]: { id: sid('archived'), displayTitle: 'Research notes', running: false, blank: false, updatedAt: 1 },
    [sid('visible')]: { id: sid('visible'), displayTitle: 'Not archived', running: false, blank: false, updatedAt: 2 },
  },
  current: undefined, currentAddress: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {},
}
const workspace: WorkspaceSnapshot = {
  items: [], archivedSessionIds: [sid('archived'), sid('missing')], state: 'idle', phase: 'ready', error: null,
}
function hook<T>(snapshot: T) {
  return <S,>(selector: (state: T) => S): S => selector(snapshot)
}
function mount(overrides: Partial<ArchivedSessionsProps> = {}) {
  const props: ArchivedSessionsProps = {
    useSessions: hook(sessions), useWorkspaces: hook(workspace),
    useSessionPendingInteraction: hook(new Map()), usePanelInfo: hook({ activePanelId: null }),
    useResource: () => ({ status: 'none', value: undefined, failure: undefined, reload: () => {} }),
    t: makeTranslate(en), open: vi.fn(), unarchive: vi.fn(async () => {}), ...overrides,
  }
  const view = render(<ArchivedSessions {...props} />)
  return { props, view }
}

describe('ArchivedSessions', () => {
  it('shows only archived ids and opens content without unarchiving', () => {
    const b = mount()
    expect(screen.getByRole('region', { name: 'Archived' })).toBeTruthy()
    expect(screen.queryByText('Not archived')).toBeNull()
    const row = within(screen.getAllByRole('listitem')[0]!)
    expect(row.getByText('Research notes')).toBeTruthy()
    fireEvent.click(row.getByRole('button', { name: 'View' }))
    expect(b.props.open).toHaveBeenCalledWith('archived')
    expect(b.props.unarchive).not.toHaveBeenCalled()
  })

  it('keeps unknown ids restorable while disabling their content action', async () => {
    const b = mount()
    const row = within(screen.getAllByRole('listitem')[1]!)
    expect(row.getAllByText('missing')).toHaveLength(2)
    expect(row.getByRole<HTMLButtonElement>('button', { name: 'View' }).disabled).toBe(true)
    fireEvent.click(row.getByRole('button', { name: 'View' }))
    expect(b.props.open).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(row.getByRole('button', { name: 'Unarchive' })) })
    expect(b.props.unarchive).toHaveBeenCalledWith('missing')
    expect(b.props.open).not.toHaveBeenCalled()
  })

  it('owns pending and retryable failure per row and waits for authoritative removal', async () => {
    let reject!: (error: unknown) => void
    const unarchive = vi.fn<ArchivedSessionsProps['unarchive']>()
      .mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise }))
      .mockResolvedValue(undefined)
    const b = mount({ unarchive })
    const [first, second] = screen.getAllByRole('listitem')
    fireEvent.click(within(first!).getByRole('button', { name: 'Unarchive' }))
    expect(within(first!).getByRole<HTMLButtonElement>('button', { name: 'Unarchiving…' }).disabled).toBe(true)
    expect(within(second!).getByRole<HTMLButtonElement>('button', { name: 'Unarchive' }).disabled).toBe(false)
    await act(async () => { reject(new Error('offline')) })
    expect(within(first!).getByRole('alert').textContent).toBe('Could not unarchive: offline')
    await act(async () => { fireEvent.click(within(first!).getByRole('button', { name: 'Unarchive' })) })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Research notes')).toBeTruthy()
    b.view.rerender(<ArchivedSessions {...b.props} useWorkspaces={hook({ ...workspace, archivedSessionIds: [] })} />)
    expect(screen.getByText('No archived sessions')).toBeTruthy()
  })

  it('renders non-Error rejections as retryable row failures', async () => {
    mount({ unarchive: vi.fn(async () => { throw 'denied' }) })
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Unarchive' })[0]!) })
    expect(screen.getByRole('alert').textContent).toBe('Could not unarchive: denied')
  })

  it('distinguishes baseline loading, reconnect loading, failures and an empty archive', () => {
    const b = mount({ useWorkspaces: hook({ ...workspace, archivedSessionIds: [], phase: 'pending', state: 'loading' }) })
    expect(screen.getByRole('status').textContent).toBe('Loading archived sessions…')
    expect(screen.queryByText('No archived sessions')).toBeNull()
    b.view.rerender(<ArchivedSessions {...b.props} useWorkspaces={hook({ ...workspace, state: 'loading' })} />)
    expect(screen.getByRole('status')).toBeTruthy()
    b.view.rerender(<ArchivedSessions {...b.props} useWorkspaces={hook({ ...workspace, archivedSessionIds: [], state: 'error' })} />)
    expect(screen.getByRole('alert').textContent).toBe('Could not load archived sessions.')
    expect(screen.queryByText('No archived sessions')).toBeNull()
    b.view.rerender(<ArchivedSessions {...b.props} useWorkspaces={hook({ ...workspace, archivedSessionIds: [] })} useSessions={hook({ ...sessions, phase: 'pending' })} />)
    expect(screen.getByRole('status')).toBeTruthy()
    b.view.rerender(<ArchivedSessions {...b.props} useWorkspaces={hook({ ...workspace, archivedSessionIds: [] })} />)
    expect(screen.getByText('No archived sessions')).toBeTruthy()
  })

  it('renders the sidebar archive glyph at its requested size', () => {
    const b = mount()
    b.view.rerender(<ArchivedSessionsIcon {...b.props} size={18} active={false} />)
    expect(b.view.container.querySelector('svg')?.getAttribute('width')).toBe('18')
  })
})
