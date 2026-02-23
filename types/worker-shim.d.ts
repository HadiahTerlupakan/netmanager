interface ExtendableEvent extends Event {
  waitUntil(fn: Promise<unknown>): void;
}
