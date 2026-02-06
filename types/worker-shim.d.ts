interface ExtendableEvent extends Event {
  waitUntil(fn: Promise<any>): void;
}
