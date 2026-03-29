export class WorkspaceClientSession {
  #activeSubscribers = 0;
  #lastActivityAt = new Date();

  touch(): void {
    this.#lastActivityAt = new Date();
  }

  openSubscriber(): void {
    this.#activeSubscribers += 1;
    this.touch();
  }

  closeSubscriber(): void {
    this.#activeSubscribers = Math.max(0, this.#activeSubscribers - 1);
    this.touch();
  }

  get hasActiveSubscribers(): boolean {
    return this.#activeSubscribers > 0;
  }

  isIdleBeyond(timeoutMs: number): boolean {
    return !this.hasActiveSubscribers && Date.now() - this.#lastActivityAt.getTime() >= timeoutMs;
  }
}

