import { mkdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { WorkspacePaths } from "../bootstrap/WorkspacePaths.js";

export class WorkspaceStorage {
  readonly #paths: WorkspacePaths;
  readonly #database: DatabaseSync;
  #closed = false;

  private constructor(paths: WorkspacePaths, database: DatabaseSync) {
    this.#paths = paths;
    this.#database = database;
  }

  static open(workspaceRoot: string): WorkspaceStorage {
    const paths = new WorkspacePaths(workspaceRoot);

    mkdirSync(paths.stateRoot, { recursive: true });
    mkdirSync(paths.logsRoot, { recursive: true });
    mkdirSync(paths.runtimeRoot, { recursive: true });
    mkdirSync(paths.resultsRoot, { recursive: true });
    mkdirSync(paths.abortSignalsRoot, { recursive: true });

    const database = new DatabaseSync(paths.databasePath);
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec(
      readFileSync(
        new URL("./migrations/001_initial_schema.sql", import.meta.url),
        "utf8"
      )
    );

    return new WorkspaceStorage(paths, database);
  }

  get paths(): WorkspacePaths {
    return this.#paths;
  }

  get database(): DatabaseSync {
    return this.#database;
  }

  close(): void {
    if (this.#closed) {
      return;
    }

    this.#database.close();
    this.#closed = true;
  }
}
