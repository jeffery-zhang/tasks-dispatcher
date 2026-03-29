export class WorkspaceSession {
  readonly #workspacePath: string;
  readonly #openedAt: Date;

  constructor(workspacePath: string, openedAt: Date) {
    this.#workspacePath = workspacePath;
    this.#openedAt = openedAt;
  }

  toSnapshot(): { workspacePath: string; openedAt: string } {
    return {
      workspacePath: this.#workspacePath,
      openedAt: this.#openedAt.toISOString()
    };
  }
}
