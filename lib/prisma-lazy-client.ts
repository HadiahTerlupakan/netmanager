type LazyClientFactory<T extends object> = () => T;

/** Creates a lazily initialized proxy for Prisma clients. */
export const createLazyPrismaClient = <T extends object>(
  getClient: LazyClientFactory<T>,
): T =>
  new Proxy({} as T, {
    get(_target, prop, receiver) {
      return Reflect.get(getClient() as object, prop, receiver);
    },
    set(_target, prop, value, receiver) {
      return Reflect.set(getClient() as object, prop, value, receiver);
    },
    has(_target, prop) {
      return Reflect.has(getClient() as object, prop);
    },
    ownKeys() {
      return Reflect.ownKeys(getClient() as object);
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Object.getOwnPropertyDescriptor(getClient() as object, prop);
    },
  });
