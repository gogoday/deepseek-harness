# Agent Note: Archived Session browsing and restoration

Status: implemented

English | [中文](2026-09-16-archived-session-browser.zh.md)

## Problem

Archiving hides a Session without deleting its history. Users need to inspect that retained history and restore the Session without editing Harness storage files.

## Decision

The Workspace UI contributes an Archived main panel and a matching sidebar entry through the existing Slots navigation. The panel derives its rows from the Workspace Controller's archive set and the Session Controller's summaries; it owns no duplicate Session data. Opening a row selects the existing Conversation without changing archive membership. Unarchive removes only the durable archive marker and preserves Workspace accounting and history.

Navigation clears the current Session only when it enters the archive set, including an initial archived selection. Opening an already archived Session is allowed. The observer records the new archive set before clearing selection so synchronous selection notifications cannot repeat the transition.

The registry serializes unarchive with other Workspace mutations and treats an absent archive marker as a no-op. It does not require the Session log to exist: users can clear a stale archive marker even when external storage removal has made its content unavailable.

## Alternatives considered

**Unarchive on view.** Reading history must not change whether a Session appears in ordinary lists; restoration remains an explicit action.

**Separate transcript renderer.** Reusing Conversation retains paging and existing message/tool presentation rather than creating a second history implementation. Archive is a visibility preference, not a read-only or authorization restriction.

**Clear every archived selection.** A membership-only navigation guard prevents users from opening archived content. Transition-based clearing preserves the archive gesture while permitting explicit inspection.

## Consequences

The archive set remains the single durable authority. Restored Sessions rejoin normal lists under their existing accounting and ordering policies; no log rewrite or data migration is required. Missing summaries can retain an archive row with content viewing unavailable and restoration enabled. Opening archived content uses the normal Conversation capabilities, not a read-only mode.

The existing [Client ownership decision](../architecture/2026-08-20-client-session-conversation-ownership.md) remains authoritative: the page consumes Controller snapshots rather than storing business data in a UI store. No active archive-specific decision is superseded.
