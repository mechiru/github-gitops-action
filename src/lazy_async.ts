export class LazyAsync<T> {
  private init: (() => Promise<T>) | null;
  private data?: T;

  constructor(init: () => Promise<T>) {
    this.init = init;
  }

  async value(): Promise<T> {
    if (this.init != null) {
      this.data = await this.init();
      this.init = null;
    }
    return this.data!;
  }
}
