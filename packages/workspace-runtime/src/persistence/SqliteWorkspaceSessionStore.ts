import { WorkspaceSession } from "@tasks-dispatcher/core";
import type { DatabaseSync } from "node:sqlite";

export class SqliteWorkspaceSessionStore {
  readonly #database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.#database = database;
  }

  save(session: WorkspaceSession): void {
    const snapshot = session.toSnapshot();

    this.#database
      .prepare(
        `
        INSERT INTO workspace_session (id, workspace_path, opened_at)
        VALUES (1, @workspacePath, @openedAt)
        ON CONFLICT(id) DO UPDATE SET
          workspace_path = excluded.workspace_path,
          opened_at = excluded.opened_at
      `
      )
      .run({
        workspacePath: snapshot.workspacePath,
        openedAt: snapshot.openedAt
      } satisfies Record<string, string>);
  }

  load(): WorkspaceSession | null {
    const row = this.#database
      .prepare("SELECT workspace_path, opened_at FROM workspace_session WHERE id = 1")
      .get() as { workspace_path: string; opened_at: string } | undefined;

    if (!row) {
      return null;
    }

    return new WorkspaceSession(row.workspace_path, new Date(row.opened_at));
  }
}
