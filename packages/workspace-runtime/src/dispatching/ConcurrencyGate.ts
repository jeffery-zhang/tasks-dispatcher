export class ConcurrencyGate {
  readonly #maxConcurrentExecutions: number;
  #activeExecutions = 0;

  constructor(maxConcurrentExecutions: number) {
    this.#maxConcurrentExecutions = maxConcurrentExecutions;
  }

  get activeExecutions(): number {
    return this.#activeExecutions;
  }

  get hasCapacity(): boolean {
    return this.#activeExecutions < this.#maxConcurrentExecutions;
  }

  acquire(): void {
    if (!this.hasCapacity) {
      throw new Error("No concurrency slot available.");
    }

    this.#activeExecutions += 1;
  }

  release(): void {
    this.#activeExecutions = Math.max(0, this.#activeExecutions - 1);
  }
}

