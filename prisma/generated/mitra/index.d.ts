/**
 * Client
 **/

import * as runtime from "./runtime/client.js";
import $Types = runtime.Types; // general types
import $Public = runtime.Types.Public;
import $Utils = runtime.Types.Utils;
import $Extensions = runtime.Types.Extensions;
import $Result = runtime.Types.Result;

export type PrismaPromise<T> = $Public.PrismaPromise<T>;

/**
 * Model Mitra
 *
 */
export type Mitra = $Result.DefaultSelection<Prisma.$MitraPayload>;
/**
 * Model MitraWallet
 *
 */
export type MitraWallet = $Result.DefaultSelection<Prisma.$MitraWalletPayload>;
/**
 * Model MitraTransaction
 *
 */
export type MitraTransaction =
  $Result.DefaultSelection<Prisma.$MitraTransactionPayload>;
/**
 * Model WithdrawRequest
 *
 */
export type WithdrawRequest =
  $Result.DefaultSelection<Prisma.$WithdrawRequestPayload>;
/**
 * Model FaceVerificationLog
 *
 */
export type FaceVerificationLog =
  $Result.DefaultSelection<Prisma.$FaceVerificationLogPayload>;

/**
 * Enums
 */
export namespace $Enums {
  export const MitraType: {
    MITRA_SALES: "MITRA_SALES";
    MITRA_TEKNISI: "MITRA_TEKNISI";
  };

  export type MitraType = (typeof MitraType)[keyof typeof MitraType];

  export const MitraTransactionType: {
    EARNING: "EARNING";
    WITHDRAW: "WITHDRAW";
    ADJUSTMENT: "ADJUSTMENT";
  };

  export type MitraTransactionType =
    (typeof MitraTransactionType)[keyof typeof MitraTransactionType];

  export const WithdrawStatus: {
    PENDING: "PENDING";
    APPROVED: "APPROVED";
    PROCESSING: "PROCESSING";
    COMPLETED: "COMPLETED";
    REJECTED: "REJECTED";
  };

  export type WithdrawStatus =
    (typeof WithdrawStatus)[keyof typeof WithdrawStatus];

  export const WithdrawMethod: {
    TRANSFER: "TRANSFER";
    CASH: "CASH";
  };

  export type WithdrawMethod =
    (typeof WithdrawMethod)[keyof typeof WithdrawMethod];
}

export type MitraType = $Enums.MitraType;

export const MitraType: typeof $Enums.MitraType;

export type MitraTransactionType = $Enums.MitraTransactionType;

export const MitraTransactionType: typeof $Enums.MitraTransactionType;

export type WithdrawStatus = $Enums.WithdrawStatus;

export const WithdrawStatus: typeof $Enums.WithdrawStatus;

export type WithdrawMethod = $Enums.WithdrawMethod;

export const WithdrawMethod: typeof $Enums.WithdrawMethod;

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more Mitras
 * const mitras = await prisma.mitra.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = "log" extends keyof ClientOptions
    ? ClientOptions["log"] extends Array<Prisma.LogLevel | Prisma.LogDefinition>
      ? Prisma.GetEvents<ClientOptions["log"]>
      : never
    : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>["other"] };

  /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient({
   *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
   * })
   * // Fetch zero or more Mitras
   * const mitras = await prisma.mitra.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(optionsArg?: Prisma.PrismaClientConstructorArgs<ClientOptions>);
  $on<V extends U>(
    eventType: V,
    callback: (
      event: V extends "query" ? Prisma.QueryEvent : Prisma.LogEvent,
    ) => void,
  ): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(
    query: string,
    ...values: any[]
  ): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(
    query: string,
    ...values: any[]
  ): Prisma.PrismaPromise<T>;

  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(
    arg: [...P],
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>;

  $transaction<R>(
    fn: (
      prisma: Omit<PrismaClient, runtime.ITXClientDenyList>,
    ) => $Utils.JsPromise<R>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): $Utils.JsPromise<R>;

  $extends: $Extensions.ExtendsHook<
    "extends",
    Prisma.TypeMapCb<ClientOptions>,
    ExtArgs,
    $Utils.Call<
      Prisma.TypeMapCb<ClientOptions>,
      {
        extArgs: ExtArgs;
      }
    >
  >;

  /**
   * `prisma.mitra`: Exposes CRUD operations for the **Mitra** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more Mitras
   * const mitras = await prisma.mitra.findMany()
   * ```
   */
  get mitra(): Prisma.MitraDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.mitraWallet`: Exposes CRUD operations for the **MitraWallet** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more MitraWallets
   * const mitraWallets = await prisma.mitraWallet.findMany()
   * ```
   */
  get mitraWallet(): Prisma.MitraWalletDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.mitraTransaction`: Exposes CRUD operations for the **MitraTransaction** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more MitraTransactions
   * const mitraTransactions = await prisma.mitraTransaction.findMany()
   * ```
   */
  get mitraTransaction(): Prisma.MitraTransactionDelegate<
    ExtArgs,
    ClientOptions
  >;

  /**
   * `prisma.withdrawRequest`: Exposes CRUD operations for the **WithdrawRequest** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more WithdrawRequests
   * const withdrawRequests = await prisma.withdrawRequest.findMany()
   * ```
   */
  get withdrawRequest(): Prisma.WithdrawRequestDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.faceVerificationLog`: Exposes CRUD operations for the **FaceVerificationLog** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more FaceVerificationLogs
   * const faceVerificationLogs = await prisma.faceVerificationLog.findMany()
   * ```
   */
  get faceVerificationLog(): Prisma.FaceVerificationLogDelegate<
    ExtArgs,
    ClientOptions
  >;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF;

  export type PrismaPromise<T> = $Public.PrismaPromise<T>;

  /**
   * Validator
   */
  export import validator = runtime.Public.validator;

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError;
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError;
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError;
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError;
  export import PrismaClientValidationError = runtime.PrismaClientValidationError;

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag;
  export import empty = runtime.empty;
  export import join = runtime.join;
  export import raw = runtime.raw;
  export import Sql = runtime.Sql;

  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal;

  export type DecimalJsLike = runtime.DecimalJsLike;

  /**
   * Extensions
   */
  export import Extension = $Extensions.UserArgs;
  export import getExtensionContext = runtime.Extensions.getExtensionContext;
  export import Args = $Public.Args;
  export import Payload = $Public.Payload;
  export import Result = $Public.Result;
  export import Exact = $Public.Exact;

  /**
   * Prisma Client JS version: 7.10.0
   * Query Engine version: 0edf323efd1d98336f3f0a68684b56f689b900d3
   */
  export type PrismaVersion = {
    client: string;
    engine: string;
  };

  export const prismaVersion: PrismaVersion;

  /**
   * Utility Types
   */

  export import Bytes = runtime.Bytes;
  export import JsonObject = runtime.JsonObject;
  export import JsonArray = runtime.JsonArray;
  export import JsonValue = runtime.JsonValue;
  export import InputJsonObject = runtime.InputJsonObject;
  export import InputJsonArray = runtime.InputJsonArray;
  export import InputJsonValue = runtime.InputJsonValue;

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
     * Type of `Prisma.DbNull`.
     *
     * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
     *
     * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
     */
    class DbNull {
      private DbNull: never;
      private constructor();
    }

    /**
     * Type of `Prisma.JsonNull`.
     *
     * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
     *
     * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
     */
    class JsonNull {
      private JsonNull: never;
      private constructor();
    }

    /**
     * Type of `Prisma.AnyNull`.
     *
     * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
     *
     * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
     */
    class AnyNull {
      private AnyNull: never;
      private constructor();
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull;

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull;

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull;

  type SelectAndInclude = {
    select: any;
    include: any;
  };

  type SelectAndOmit = {
    select: any;
    omit: any;
  };

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> =
    T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<
    T extends (...args: any) => $Utils.JsPromise<any>,
  > = PromiseType<ReturnType<T>>;

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
    [P in K]: T[P];
  };

  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K;
  }[keyof T];

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K;
  };

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>;

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * Resolved type of the argument passed to the `PrismaClient` constructor.
   *
   * When called without a narrower options type (the common case), this resolves
   * to `PrismaClientOptions` directly, which produces a clear TypeScript error
   * message (`not assignable to parameter of type 'PrismaClientOptions'`) when
   * the argument is missing or incomplete. When the user supplies a narrower
   * options type (e.g. via a literal), it falls back to `Subset` to keep
   * filtering out unknown properties.
   */
  export type PrismaClientConstructorArgs<Options extends PrismaClientOptions> =
    [PrismaClientOptions] extends [Options]
      ? PrismaClientOptions
      : Subset<Options, PrismaClientOptions>;

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  } & (T extends SelectAndInclude
    ? "Please either choose `select` or `include`."
    : T extends SelectAndOmit
      ? "Please either choose `select` or `omit`."
      : {});

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  } & K;

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> = T extends object
    ? U extends object
      ? ((Without<T, U> & U) | (Without<U, T> & T)) & object
      : U
    : T;

  /**
   * Is T a Record?
   */
  type IsObject<T extends any> =
    T extends Array<any>
      ? False
      : T extends Date
        ? False
        : T extends Uint8Array
          ? False
          : T extends BigInt
            ? False
            : T extends object
              ? True
              : False;

  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T;

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O>; // With K possibilities
    }[K];

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>;

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<
    __Either<O, K>
  >;

  type _Either<O extends object, K extends Key, strict extends Boolean> = {
    1: EitherStrict<O, K>;
    0: EitherLoose<O, K>;
  }[strict];

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1,
  > = O extends unknown ? _Either<O, K, strict> : never;

  export type Union = any;

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K];
  } & {};

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never;

  export type Overwrite<O extends object, O1 extends object> = {
    [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<
    Overwrite<
      U,
      {
        [K in keyof U]-?: At<U, K>;
      }
    >
  >;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O
    ? O[K]
    : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown
    ? AtStrict<O, K>
    : never;
  export type At<
    O extends object,
    K extends Key,
    strict extends Boolean = 1,
  > = {
    1: AtStrict<O, K>;
    0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function
    ? A
    : {
        [K in keyof A]: A[K];
      } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
      ?
          | (K extends keyof O ? { [P in K]: O[P] } & O : O)
          | ({ [P in keyof O as P extends K ? P : never]-?: O[P] } & O)
      : never
  >;

  type _Strict<U, _U = U> = U extends unknown
    ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>>
    : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False;

  // /**
  // 1
  // */
  export type True = 1;

  /**
  0
  */
  export type False = 0;

  export type Not<B extends Boolean> = {
    0: 1;
    1: 0;
  }[B];

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
      ? 1
      : 0;

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >;

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0;
      1: 1;
    };
    1: {
      0: 1;
      1: 1;
    };
  }[B1][B2];

  export type Keys<U extends Union> = U extends unknown ? keyof U : never;

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;

  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object
    ? {
        [P in keyof T]: P extends keyof O ? O[P] : never;
      }
    : never;

  type FieldPaths<
    T,
    U = Omit<T, "_avg" | "_sum" | "_count" | "_min" | "_max">,
  > = IsObject<T> extends True ? U : T;

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<"OR", K>, Extends<"AND", K>>,
      Extends<"NOT", K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<
            UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never
          >
        : never
      : {} extends FieldPaths<T[K]>
        ? never
        : K;
  }[keyof T];

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never;
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>;
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T;

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<
    T,
    K extends Enumerable<keyof T> | keyof T,
  > = Prisma__Pick<T, MaybeTupleToUnion<K>>;

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}`
    ? never
    : T;

  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>;

  type FieldRefInputType<Model, FieldType> = Model extends never
    ? never
    : FieldRef<Model, FieldType>;

  export const ModelName: {
    Mitra: "Mitra";
    MitraWallet: "MitraWallet";
    MitraTransaction: "MitraTransaction";
    WithdrawRequest: "WithdrawRequest";
    FaceVerificationLog: "FaceVerificationLog";
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName];

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<
    { extArgs: $Extensions.InternalArgs },
    $Utils.Record<string, any>
  > {
    returns: Prisma.TypeMap<
      this["params"]["extArgs"],
      ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}
    >;
  }

  export type TypeMap<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > = {
    globalOmitOptions: {
      omit: GlobalOmitOptions;
    };
    meta: {
      modelProps:
        | "mitra"
        | "mitraWallet"
        | "mitraTransaction"
        | "withdrawRequest"
        | "faceVerificationLog";
      txIsolationLevel: Prisma.TransactionIsolationLevel;
    };
    model: {
      Mitra: {
        payload: Prisma.$MitraPayload<ExtArgs>;
        fields: Prisma.MitraFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.MitraFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.MitraFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraPayload>;
          };
          findFirst: {
            args: Prisma.MitraFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.MitraFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraPayload>;
          };
          findMany: {
            args: Prisma.MitraFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraPayload>[];
          };
          create: {
            args: Prisma.MitraCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraPayload>;
          };
          createMany: {
            args: Prisma.MitraCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.MitraCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraPayload>[];
          };
          delete: {
            args: Prisma.MitraDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraPayload>;
          };
          update: {
            args: Prisma.MitraUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraPayload>;
          };
          deleteMany: {
            args: Prisma.MitraDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.MitraUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.MitraUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraPayload>[];
          };
          upsert: {
            args: Prisma.MitraUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraPayload>;
          };
          aggregate: {
            args: Prisma.MitraAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateMitra>;
          };
          groupBy: {
            args: Prisma.MitraGroupByArgs<ExtArgs>;
            result: $Utils.Optional<MitraGroupByOutputType>[];
          };
          count: {
            args: Prisma.MitraCountArgs<ExtArgs>;
            result: $Utils.Optional<MitraCountAggregateOutputType> | number;
          };
        };
      };
      MitraWallet: {
        payload: Prisma.$MitraWalletPayload<ExtArgs>;
        fields: Prisma.MitraWalletFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.MitraWalletFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraWalletPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.MitraWalletFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraWalletPayload>;
          };
          findFirst: {
            args: Prisma.MitraWalletFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraWalletPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.MitraWalletFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraWalletPayload>;
          };
          findMany: {
            args: Prisma.MitraWalletFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraWalletPayload>[];
          };
          create: {
            args: Prisma.MitraWalletCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraWalletPayload>;
          };
          createMany: {
            args: Prisma.MitraWalletCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.MitraWalletCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraWalletPayload>[];
          };
          delete: {
            args: Prisma.MitraWalletDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraWalletPayload>;
          };
          update: {
            args: Prisma.MitraWalletUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraWalletPayload>;
          };
          deleteMany: {
            args: Prisma.MitraWalletDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.MitraWalletUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.MitraWalletUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraWalletPayload>[];
          };
          upsert: {
            args: Prisma.MitraWalletUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraWalletPayload>;
          };
          aggregate: {
            args: Prisma.MitraWalletAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateMitraWallet>;
          };
          groupBy: {
            args: Prisma.MitraWalletGroupByArgs<ExtArgs>;
            result: $Utils.Optional<MitraWalletGroupByOutputType>[];
          };
          count: {
            args: Prisma.MitraWalletCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<MitraWalletCountAggregateOutputType>
              | number;
          };
        };
      };
      MitraTransaction: {
        payload: Prisma.$MitraTransactionPayload<ExtArgs>;
        fields: Prisma.MitraTransactionFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.MitraTransactionFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraTransactionPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.MitraTransactionFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraTransactionPayload>;
          };
          findFirst: {
            args: Prisma.MitraTransactionFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraTransactionPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.MitraTransactionFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraTransactionPayload>;
          };
          findMany: {
            args: Prisma.MitraTransactionFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraTransactionPayload>[];
          };
          create: {
            args: Prisma.MitraTransactionCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraTransactionPayload>;
          };
          createMany: {
            args: Prisma.MitraTransactionCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.MitraTransactionCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraTransactionPayload>[];
          };
          delete: {
            args: Prisma.MitraTransactionDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraTransactionPayload>;
          };
          update: {
            args: Prisma.MitraTransactionUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraTransactionPayload>;
          };
          deleteMany: {
            args: Prisma.MitraTransactionDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.MitraTransactionUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.MitraTransactionUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraTransactionPayload>[];
          };
          upsert: {
            args: Prisma.MitraTransactionUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$MitraTransactionPayload>;
          };
          aggregate: {
            args: Prisma.MitraTransactionAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateMitraTransaction>;
          };
          groupBy: {
            args: Prisma.MitraTransactionGroupByArgs<ExtArgs>;
            result: $Utils.Optional<MitraTransactionGroupByOutputType>[];
          };
          count: {
            args: Prisma.MitraTransactionCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<MitraTransactionCountAggregateOutputType>
              | number;
          };
        };
      };
      WithdrawRequest: {
        payload: Prisma.$WithdrawRequestPayload<ExtArgs>;
        fields: Prisma.WithdrawRequestFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.WithdrawRequestFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WithdrawRequestPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.WithdrawRequestFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WithdrawRequestPayload>;
          };
          findFirst: {
            args: Prisma.WithdrawRequestFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WithdrawRequestPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.WithdrawRequestFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WithdrawRequestPayload>;
          };
          findMany: {
            args: Prisma.WithdrawRequestFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WithdrawRequestPayload>[];
          };
          create: {
            args: Prisma.WithdrawRequestCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WithdrawRequestPayload>;
          };
          createMany: {
            args: Prisma.WithdrawRequestCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.WithdrawRequestCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WithdrawRequestPayload>[];
          };
          delete: {
            args: Prisma.WithdrawRequestDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WithdrawRequestPayload>;
          };
          update: {
            args: Prisma.WithdrawRequestUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WithdrawRequestPayload>;
          };
          deleteMany: {
            args: Prisma.WithdrawRequestDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.WithdrawRequestUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.WithdrawRequestUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WithdrawRequestPayload>[];
          };
          upsert: {
            args: Prisma.WithdrawRequestUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WithdrawRequestPayload>;
          };
          aggregate: {
            args: Prisma.WithdrawRequestAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateWithdrawRequest>;
          };
          groupBy: {
            args: Prisma.WithdrawRequestGroupByArgs<ExtArgs>;
            result: $Utils.Optional<WithdrawRequestGroupByOutputType>[];
          };
          count: {
            args: Prisma.WithdrawRequestCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<WithdrawRequestCountAggregateOutputType>
              | number;
          };
        };
      };
      FaceVerificationLog: {
        payload: Prisma.$FaceVerificationLogPayload<ExtArgs>;
        fields: Prisma.FaceVerificationLogFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.FaceVerificationLogFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FaceVerificationLogPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.FaceVerificationLogFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FaceVerificationLogPayload>;
          };
          findFirst: {
            args: Prisma.FaceVerificationLogFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FaceVerificationLogPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.FaceVerificationLogFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FaceVerificationLogPayload>;
          };
          findMany: {
            args: Prisma.FaceVerificationLogFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FaceVerificationLogPayload>[];
          };
          create: {
            args: Prisma.FaceVerificationLogCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FaceVerificationLogPayload>;
          };
          createMany: {
            args: Prisma.FaceVerificationLogCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.FaceVerificationLogCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FaceVerificationLogPayload>[];
          };
          delete: {
            args: Prisma.FaceVerificationLogDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FaceVerificationLogPayload>;
          };
          update: {
            args: Prisma.FaceVerificationLogUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FaceVerificationLogPayload>;
          };
          deleteMany: {
            args: Prisma.FaceVerificationLogDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.FaceVerificationLogUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.FaceVerificationLogUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FaceVerificationLogPayload>[];
          };
          upsert: {
            args: Prisma.FaceVerificationLogUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FaceVerificationLogPayload>;
          };
          aggregate: {
            args: Prisma.FaceVerificationLogAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateFaceVerificationLog>;
          };
          groupBy: {
            args: Prisma.FaceVerificationLogGroupByArgs<ExtArgs>;
            result: $Utils.Optional<FaceVerificationLogGroupByOutputType>[];
          };
          count: {
            args: Prisma.FaceVerificationLogCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<FaceVerificationLogCountAggregateOutputType>
              | number;
          };
        };
      };
    };
  } & {
    other: {
      payload: any;
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]];
          result: any;
        };
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]];
          result: any;
        };
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]];
          result: any;
        };
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]];
          result: any;
        };
      };
    };
  };
  export const defineExtension: $Extensions.ExtendsHook<
    "define",
    Prisma.TypeMapCb,
    $Extensions.DefaultArgs
  >;
  export type DefaultPrismaClient = PrismaClient;
  export type ErrorFormat = "pretty" | "colorless" | "minimal";
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat;
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     *
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     *
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     *
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[];
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    };
    /**
     * A driver adapter that PrismaClient uses to connect to your database, such as the ones provided by `@prisma/adapter-pg`, `@prisma/adapter-libsql`, `@prisma/adapter-planetscale`, etc.
     *
     * A driver adapter is **required** unless you connect to your database through Prisma Accelerate (in which case use `accelerateUrl` instead).
     *
     * Learn more: https://pris.ly/d/driver-adapters
     *
     * @example
     * ```ts
     * import { PrismaPg } from '@prisma/adapter-pg'
     * import { PrismaClient } from './generated/prisma/client'
     *
     * const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
     * const prisma = new PrismaClient({ adapter })
     * ```
     */
    adapter?: runtime.SqlDriverAdapterFactory;
    /**
     * The Prisma Accelerate connection URL. Use this option to connect to your database through Prisma Accelerate instead of using a driver adapter to connect directly.
     *
     * Learn more: https://pris.ly/d/accelerate
     */
    accelerateUrl?: string;
    /**
     * Global configuration for omitting model fields by default.
     *
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig;
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     *
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[];
  }
  export type GlobalOmitConfig = {
    mitra?: MitraOmit;
    mitraWallet?: MitraWalletOmit;
    mitraTransaction?: MitraTransactionOmit;
    withdrawRequest?: WithdrawRequestOmit;
    faceVerificationLog?: FaceVerificationLogOmit;
  };

  /* Types for Logging */
  export type LogLevel = "info" | "query" | "warn" | "error";
  export type LogDefinition = {
    level: LogLevel;
    emit: "stdout" | "event";
  };

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T["level"] : T
  >;

  export type GetEvents<T extends any[]> =
    T extends Array<LogLevel | LogDefinition> ? GetLogType<T[number]> : never;

  export type QueryEvent = {
    timestamp: Date;
    query: string;
    params: string;
    duration: number;
    target: string;
  };

  export type LogEvent = {
    timestamp: Date;
    message: string;
    target: string;
  };
  /* End Types for Logging */

  export type PrismaAction =
    | "findUnique"
    | "findUniqueOrThrow"
    | "findMany"
    | "findFirst"
    | "findFirstOrThrow"
    | "create"
    | "createMany"
    | "createManyAndReturn"
    | "update"
    | "updateMany"
    | "updateManyAndReturn"
    | "upsert"
    | "delete"
    | "deleteMany"
    | "executeRaw"
    | "queryRaw"
    | "aggregate"
    | "count"
    | "runCommandRaw"
    | "findRaw"
    | "groupBy";

  // tested in getLogLevel.test.ts
  export function getLogLevel(
    log: Array<LogLevel | LogDefinition>,
  ): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<
    Prisma.DefaultPrismaClient,
    runtime.ITXClientDenyList
  >;

  export type Datasource = {
    url?: string;
  };

  /**
   * Count Types
   */

  /**
   * Count Type MitraCountOutputType
   */

  export type MitraCountOutputType = {
    withdrawalsRequested: number;
    faceVerificationLogs: number;
  };

  export type MitraCountOutputTypeSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    withdrawalsRequested?:
      | boolean
      | MitraCountOutputTypeCountWithdrawalsRequestedArgs;
    faceVerificationLogs?:
      | boolean
      | MitraCountOutputTypeCountFaceVerificationLogsArgs;
  };

  // Custom InputTypes
  /**
   * MitraCountOutputType without action
   */
  export type MitraCountOutputTypeDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraCountOutputType
     */
    select?: MitraCountOutputTypeSelect<ExtArgs> | null;
  };

  /**
   * MitraCountOutputType without action
   */
  export type MitraCountOutputTypeCountWithdrawalsRequestedArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: WithdrawRequestWhereInput;
  };

  /**
   * MitraCountOutputType without action
   */
  export type MitraCountOutputTypeCountFaceVerificationLogsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: FaceVerificationLogWhereInput;
  };

  /**
   * Count Type MitraWalletCountOutputType
   */

  export type MitraWalletCountOutputType = {
    transactions: number;
    withdrawals: number;
  };

  export type MitraWalletCountOutputTypeSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    transactions?: boolean | MitraWalletCountOutputTypeCountTransactionsArgs;
    withdrawals?: boolean | MitraWalletCountOutputTypeCountWithdrawalsArgs;
  };

  // Custom InputTypes
  /**
   * MitraWalletCountOutputType without action
   */
  export type MitraWalletCountOutputTypeDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraWalletCountOutputType
     */
    select?: MitraWalletCountOutputTypeSelect<ExtArgs> | null;
  };

  /**
   * MitraWalletCountOutputType without action
   */
  export type MitraWalletCountOutputTypeCountTransactionsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: MitraTransactionWhereInput;
  };

  /**
   * MitraWalletCountOutputType without action
   */
  export type MitraWalletCountOutputTypeCountWithdrawalsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: WithdrawRequestWhereInput;
  };

  /**
   * Models
   */

  /**
   * Model Mitra
   */

  export type AggregateMitra = {
    _count: MitraCountAggregateOutputType | null;
    _avg: MitraAvgAggregateOutputType | null;
    _sum: MitraSumAggregateOutputType | null;
    _min: MitraMinAggregateOutputType | null;
    _max: MitraMaxAggregateOutputType | null;
  };

  export type MitraAvgAggregateOutputType = {
    lastVersionCode: number | null;
    tokenVersion: number | null;
    mitraRateWoPsb: number | null;
    mitraRateWoMaintenance: number | null;
    mitraRateCanvasing: number | null;
    targetHarian: number | null;
    minWithdrawal: number | null;
    latitudeRumah: number | null;
    longitudeRumah: number | null;
    garansiHari: number | null;
    slaGaransiJam: number | null;
    penaltyPsb: number | null;
    penaltyMaintenance: number | null;
  };

  export type MitraSumAggregateOutputType = {
    lastVersionCode: number | null;
    tokenVersion: number | null;
    mitraRateWoPsb: number | null;
    mitraRateWoMaintenance: number | null;
    mitraRateCanvasing: number | null;
    targetHarian: number | null;
    minWithdrawal: number | null;
    latitudeRumah: number | null;
    longitudeRumah: number | null;
    garansiHari: number | null;
    slaGaransiJam: number | null;
    penaltyPsb: number | null;
    penaltyMaintenance: number | null;
  };

  export type MitraMinAggregateOutputType = {
    id: string | null;
    name: string | null;
    email: string | null;
    passwordHash: string | null;
    phone: string | null;
    isActive: boolean | null;
    siteId: string | null;
    mitraType: $Enums.MitraType | null;
    pushToken: string | null;
    pushTokenUpdatedAt: Date | null;
    lastVersionCode: number | null;
    lastVersionName: string | null;
    lastVersionUpdate: Date | null;
    tokenVersion: number | null;
    mitraRateWoPsb: number | null;
    mitraRateWoMaintenance: number | null;
    mitraRateCanvasing: number | null;
    bankName: string | null;
    bankAccountNo: string | null;
    bankAccountName: string | null;
    targetHarian: number | null;
    minWithdrawal: number | null;
    nik: string | null;
    tempatLahir: string | null;
    tanggalLahir: Date | null;
    alamat: string | null;
    latitudeRumah: number | null;
    longitudeRumah: number | null;
    fotoDiri: string | null;
    fotoKtp: string | null;
    fotoSim: string | null;
    fotoKk: string | null;
    requiresFaceVerification: boolean | null;
    lastFaceVerification: Date | null;
    garansiHari: number | null;
    slaGaransiJam: number | null;
    penaltyPsb: number | null;
    penaltyMaintenance: number | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    tenantId: string | null;
  };

  export type MitraMaxAggregateOutputType = {
    id: string | null;
    name: string | null;
    email: string | null;
    passwordHash: string | null;
    phone: string | null;
    isActive: boolean | null;
    siteId: string | null;
    mitraType: $Enums.MitraType | null;
    pushToken: string | null;
    pushTokenUpdatedAt: Date | null;
    lastVersionCode: number | null;
    lastVersionName: string | null;
    lastVersionUpdate: Date | null;
    tokenVersion: number | null;
    mitraRateWoPsb: number | null;
    mitraRateWoMaintenance: number | null;
    mitraRateCanvasing: number | null;
    bankName: string | null;
    bankAccountNo: string | null;
    bankAccountName: string | null;
    targetHarian: number | null;
    minWithdrawal: number | null;
    nik: string | null;
    tempatLahir: string | null;
    tanggalLahir: Date | null;
    alamat: string | null;
    latitudeRumah: number | null;
    longitudeRumah: number | null;
    fotoDiri: string | null;
    fotoKtp: string | null;
    fotoSim: string | null;
    fotoKk: string | null;
    requiresFaceVerification: boolean | null;
    lastFaceVerification: Date | null;
    garansiHari: number | null;
    slaGaransiJam: number | null;
    penaltyPsb: number | null;
    penaltyMaintenance: number | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    tenantId: string | null;
  };

  export type MitraCountAggregateOutputType = {
    id: number;
    name: number;
    email: number;
    passwordHash: number;
    phone: number;
    isActive: number;
    siteId: number;
    mitraType: number;
    pushToken: number;
    pushTokenUpdatedAt: number;
    fcmTokens: number;
    lastVersionCode: number;
    lastVersionName: number;
    lastVersionUpdate: number;
    tokenVersion: number;
    mitraRateWoPsb: number;
    mitraRateWoMaintenance: number;
    mitraRateCanvasing: number;
    bankName: number;
    bankAccountNo: number;
    bankAccountName: number;
    targetHarian: number;
    minWithdrawal: number;
    nik: number;
    tempatLahir: number;
    tanggalLahir: number;
    alamat: number;
    latitudeRumah: number;
    longitudeRumah: number;
    fotoDiri: number;
    fotoKtp: number;
    fotoSim: number;
    fotoKk: number;
    requiresFaceVerification: number;
    lastFaceVerification: number;
    garansiHari: number;
    slaGaransiJam: number;
    penaltyPsb: number;
    penaltyMaintenance: number;
    createdAt: number;
    updatedAt: number;
    tenantId: number;
    _all: number;
  };

  export type MitraAvgAggregateInputType = {
    lastVersionCode?: true;
    tokenVersion?: true;
    mitraRateWoPsb?: true;
    mitraRateWoMaintenance?: true;
    mitraRateCanvasing?: true;
    targetHarian?: true;
    minWithdrawal?: true;
    latitudeRumah?: true;
    longitudeRumah?: true;
    garansiHari?: true;
    slaGaransiJam?: true;
    penaltyPsb?: true;
    penaltyMaintenance?: true;
  };

  export type MitraSumAggregateInputType = {
    lastVersionCode?: true;
    tokenVersion?: true;
    mitraRateWoPsb?: true;
    mitraRateWoMaintenance?: true;
    mitraRateCanvasing?: true;
    targetHarian?: true;
    minWithdrawal?: true;
    latitudeRumah?: true;
    longitudeRumah?: true;
    garansiHari?: true;
    slaGaransiJam?: true;
    penaltyPsb?: true;
    penaltyMaintenance?: true;
  };

  export type MitraMinAggregateInputType = {
    id?: true;
    name?: true;
    email?: true;
    passwordHash?: true;
    phone?: true;
    isActive?: true;
    siteId?: true;
    mitraType?: true;
    pushToken?: true;
    pushTokenUpdatedAt?: true;
    lastVersionCode?: true;
    lastVersionName?: true;
    lastVersionUpdate?: true;
    tokenVersion?: true;
    mitraRateWoPsb?: true;
    mitraRateWoMaintenance?: true;
    mitraRateCanvasing?: true;
    bankName?: true;
    bankAccountNo?: true;
    bankAccountName?: true;
    targetHarian?: true;
    minWithdrawal?: true;
    nik?: true;
    tempatLahir?: true;
    tanggalLahir?: true;
    alamat?: true;
    latitudeRumah?: true;
    longitudeRumah?: true;
    fotoDiri?: true;
    fotoKtp?: true;
    fotoSim?: true;
    fotoKk?: true;
    requiresFaceVerification?: true;
    lastFaceVerification?: true;
    garansiHari?: true;
    slaGaransiJam?: true;
    penaltyPsb?: true;
    penaltyMaintenance?: true;
    createdAt?: true;
    updatedAt?: true;
    tenantId?: true;
  };

  export type MitraMaxAggregateInputType = {
    id?: true;
    name?: true;
    email?: true;
    passwordHash?: true;
    phone?: true;
    isActive?: true;
    siteId?: true;
    mitraType?: true;
    pushToken?: true;
    pushTokenUpdatedAt?: true;
    lastVersionCode?: true;
    lastVersionName?: true;
    lastVersionUpdate?: true;
    tokenVersion?: true;
    mitraRateWoPsb?: true;
    mitraRateWoMaintenance?: true;
    mitraRateCanvasing?: true;
    bankName?: true;
    bankAccountNo?: true;
    bankAccountName?: true;
    targetHarian?: true;
    minWithdrawal?: true;
    nik?: true;
    tempatLahir?: true;
    tanggalLahir?: true;
    alamat?: true;
    latitudeRumah?: true;
    longitudeRumah?: true;
    fotoDiri?: true;
    fotoKtp?: true;
    fotoSim?: true;
    fotoKk?: true;
    requiresFaceVerification?: true;
    lastFaceVerification?: true;
    garansiHari?: true;
    slaGaransiJam?: true;
    penaltyPsb?: true;
    penaltyMaintenance?: true;
    createdAt?: true;
    updatedAt?: true;
    tenantId?: true;
  };

  export type MitraCountAggregateInputType = {
    id?: true;
    name?: true;
    email?: true;
    passwordHash?: true;
    phone?: true;
    isActive?: true;
    siteId?: true;
    mitraType?: true;
    pushToken?: true;
    pushTokenUpdatedAt?: true;
    fcmTokens?: true;
    lastVersionCode?: true;
    lastVersionName?: true;
    lastVersionUpdate?: true;
    tokenVersion?: true;
    mitraRateWoPsb?: true;
    mitraRateWoMaintenance?: true;
    mitraRateCanvasing?: true;
    bankName?: true;
    bankAccountNo?: true;
    bankAccountName?: true;
    targetHarian?: true;
    minWithdrawal?: true;
    nik?: true;
    tempatLahir?: true;
    tanggalLahir?: true;
    alamat?: true;
    latitudeRumah?: true;
    longitudeRumah?: true;
    fotoDiri?: true;
    fotoKtp?: true;
    fotoSim?: true;
    fotoKk?: true;
    requiresFaceVerification?: true;
    lastFaceVerification?: true;
    garansiHari?: true;
    slaGaransiJam?: true;
    penaltyPsb?: true;
    penaltyMaintenance?: true;
    createdAt?: true;
    updatedAt?: true;
    tenantId?: true;
    _all?: true;
  };

  export type MitraAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Mitra to aggregate.
     */
    where?: MitraWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Mitras to fetch.
     */
    orderBy?: MitraOrderByWithRelationInput | MitraOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: MitraWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Mitras from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Mitras.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned Mitras
     **/
    _count?: true | MitraCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: MitraAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: MitraSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: MitraMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: MitraMaxAggregateInputType;
  };

  export type GetMitraAggregateType<T extends MitraAggregateArgs> = {
    [P in keyof T & keyof AggregateMitra]: P extends "_count" | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMitra[P]>
      : GetScalarType<T[P], AggregateMitra[P]>;
  };

  export type MitraGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: MitraWhereInput;
    orderBy?:
      | MitraOrderByWithAggregationInput
      | MitraOrderByWithAggregationInput[];
    by: MitraScalarFieldEnum[] | MitraScalarFieldEnum;
    having?: MitraScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: MitraCountAggregateInputType | true;
    _avg?: MitraAvgAggregateInputType;
    _sum?: MitraSumAggregateInputType;
    _min?: MitraMinAggregateInputType;
    _max?: MitraMaxAggregateInputType;
  };

  export type MitraGroupByOutputType = {
    id: string;
    name: string;
    email: string;
    passwordHash: string | null;
    phone: string | null;
    isActive: boolean;
    siteId: string | null;
    mitraType: $Enums.MitraType;
    pushToken: string | null;
    pushTokenUpdatedAt: Date | null;
    fcmTokens: string[];
    lastVersionCode: number | null;
    lastVersionName: string | null;
    lastVersionUpdate: Date | null;
    tokenVersion: number;
    mitraRateWoPsb: number | null;
    mitraRateWoMaintenance: number | null;
    mitraRateCanvasing: number | null;
    bankName: string | null;
    bankAccountNo: string | null;
    bankAccountName: string | null;
    targetHarian: number | null;
    minWithdrawal: number | null;
    nik: string | null;
    tempatLahir: string | null;
    tanggalLahir: Date | null;
    alamat: string | null;
    latitudeRumah: number | null;
    longitudeRumah: number | null;
    fotoDiri: string | null;
    fotoKtp: string | null;
    fotoSim: string | null;
    fotoKk: string | null;
    requiresFaceVerification: boolean;
    lastFaceVerification: Date | null;
    garansiHari: number | null;
    slaGaransiJam: number | null;
    penaltyPsb: number | null;
    penaltyMaintenance: number | null;
    createdAt: Date;
    updatedAt: Date;
    tenantId: string | null;
    _count: MitraCountAggregateOutputType | null;
    _avg: MitraAvgAggregateOutputType | null;
    _sum: MitraSumAggregateOutputType | null;
    _min: MitraMinAggregateOutputType | null;
    _max: MitraMaxAggregateOutputType | null;
  };

  type GetMitraGroupByPayload<T extends MitraGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<MitraGroupByOutputType, T["by"]> & {
          [P in keyof T & keyof MitraGroupByOutputType]: P extends "_count"
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MitraGroupByOutputType[P]>
            : GetScalarType<T[P], MitraGroupByOutputType[P]>;
        }
      >
    >;

  export type MitraSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      name?: boolean;
      email?: boolean;
      passwordHash?: boolean;
      phone?: boolean;
      isActive?: boolean;
      siteId?: boolean;
      mitraType?: boolean;
      pushToken?: boolean;
      pushTokenUpdatedAt?: boolean;
      fcmTokens?: boolean;
      lastVersionCode?: boolean;
      lastVersionName?: boolean;
      lastVersionUpdate?: boolean;
      tokenVersion?: boolean;
      mitraRateWoPsb?: boolean;
      mitraRateWoMaintenance?: boolean;
      mitraRateCanvasing?: boolean;
      bankName?: boolean;
      bankAccountNo?: boolean;
      bankAccountName?: boolean;
      targetHarian?: boolean;
      minWithdrawal?: boolean;
      nik?: boolean;
      tempatLahir?: boolean;
      tanggalLahir?: boolean;
      alamat?: boolean;
      latitudeRumah?: boolean;
      longitudeRumah?: boolean;
      fotoDiri?: boolean;
      fotoKtp?: boolean;
      fotoSim?: boolean;
      fotoKk?: boolean;
      requiresFaceVerification?: boolean;
      lastFaceVerification?: boolean;
      garansiHari?: boolean;
      slaGaransiJam?: boolean;
      penaltyPsb?: boolean;
      penaltyMaintenance?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      tenantId?: boolean;
      mitraWallet?: boolean | Mitra$mitraWalletArgs<ExtArgs>;
      withdrawalsRequested?: boolean | Mitra$withdrawalsRequestedArgs<ExtArgs>;
      faceVerificationLogs?: boolean | Mitra$faceVerificationLogsArgs<ExtArgs>;
      _count?: boolean | MitraCountOutputTypeDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["mitra"]
  >;

  export type MitraSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      name?: boolean;
      email?: boolean;
      passwordHash?: boolean;
      phone?: boolean;
      isActive?: boolean;
      siteId?: boolean;
      mitraType?: boolean;
      pushToken?: boolean;
      pushTokenUpdatedAt?: boolean;
      fcmTokens?: boolean;
      lastVersionCode?: boolean;
      lastVersionName?: boolean;
      lastVersionUpdate?: boolean;
      tokenVersion?: boolean;
      mitraRateWoPsb?: boolean;
      mitraRateWoMaintenance?: boolean;
      mitraRateCanvasing?: boolean;
      bankName?: boolean;
      bankAccountNo?: boolean;
      bankAccountName?: boolean;
      targetHarian?: boolean;
      minWithdrawal?: boolean;
      nik?: boolean;
      tempatLahir?: boolean;
      tanggalLahir?: boolean;
      alamat?: boolean;
      latitudeRumah?: boolean;
      longitudeRumah?: boolean;
      fotoDiri?: boolean;
      fotoKtp?: boolean;
      fotoSim?: boolean;
      fotoKk?: boolean;
      requiresFaceVerification?: boolean;
      lastFaceVerification?: boolean;
      garansiHari?: boolean;
      slaGaransiJam?: boolean;
      penaltyPsb?: boolean;
      penaltyMaintenance?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      tenantId?: boolean;
    },
    ExtArgs["result"]["mitra"]
  >;

  export type MitraSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      name?: boolean;
      email?: boolean;
      passwordHash?: boolean;
      phone?: boolean;
      isActive?: boolean;
      siteId?: boolean;
      mitraType?: boolean;
      pushToken?: boolean;
      pushTokenUpdatedAt?: boolean;
      fcmTokens?: boolean;
      lastVersionCode?: boolean;
      lastVersionName?: boolean;
      lastVersionUpdate?: boolean;
      tokenVersion?: boolean;
      mitraRateWoPsb?: boolean;
      mitraRateWoMaintenance?: boolean;
      mitraRateCanvasing?: boolean;
      bankName?: boolean;
      bankAccountNo?: boolean;
      bankAccountName?: boolean;
      targetHarian?: boolean;
      minWithdrawal?: boolean;
      nik?: boolean;
      tempatLahir?: boolean;
      tanggalLahir?: boolean;
      alamat?: boolean;
      latitudeRumah?: boolean;
      longitudeRumah?: boolean;
      fotoDiri?: boolean;
      fotoKtp?: boolean;
      fotoSim?: boolean;
      fotoKk?: boolean;
      requiresFaceVerification?: boolean;
      lastFaceVerification?: boolean;
      garansiHari?: boolean;
      slaGaransiJam?: boolean;
      penaltyPsb?: boolean;
      penaltyMaintenance?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      tenantId?: boolean;
    },
    ExtArgs["result"]["mitra"]
  >;

  export type MitraSelectScalar = {
    id?: boolean;
    name?: boolean;
    email?: boolean;
    passwordHash?: boolean;
    phone?: boolean;
    isActive?: boolean;
    siteId?: boolean;
    mitraType?: boolean;
    pushToken?: boolean;
    pushTokenUpdatedAt?: boolean;
    fcmTokens?: boolean;
    lastVersionCode?: boolean;
    lastVersionName?: boolean;
    lastVersionUpdate?: boolean;
    tokenVersion?: boolean;
    mitraRateWoPsb?: boolean;
    mitraRateWoMaintenance?: boolean;
    mitraRateCanvasing?: boolean;
    bankName?: boolean;
    bankAccountNo?: boolean;
    bankAccountName?: boolean;
    targetHarian?: boolean;
    minWithdrawal?: boolean;
    nik?: boolean;
    tempatLahir?: boolean;
    tanggalLahir?: boolean;
    alamat?: boolean;
    latitudeRumah?: boolean;
    longitudeRumah?: boolean;
    fotoDiri?: boolean;
    fotoKtp?: boolean;
    fotoSim?: boolean;
    fotoKk?: boolean;
    requiresFaceVerification?: boolean;
    lastFaceVerification?: boolean;
    garansiHari?: boolean;
    slaGaransiJam?: boolean;
    penaltyPsb?: boolean;
    penaltyMaintenance?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    tenantId?: boolean;
  };

  export type MitraOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "name"
    | "email"
    | "passwordHash"
    | "phone"
    | "isActive"
    | "siteId"
    | "mitraType"
    | "pushToken"
    | "pushTokenUpdatedAt"
    | "fcmTokens"
    | "lastVersionCode"
    | "lastVersionName"
    | "lastVersionUpdate"
    | "tokenVersion"
    | "mitraRateWoPsb"
    | "mitraRateWoMaintenance"
    | "mitraRateCanvasing"
    | "bankName"
    | "bankAccountNo"
    | "bankAccountName"
    | "targetHarian"
    | "minWithdrawal"
    | "nik"
    | "tempatLahir"
    | "tanggalLahir"
    | "alamat"
    | "latitudeRumah"
    | "longitudeRumah"
    | "fotoDiri"
    | "fotoKtp"
    | "fotoSim"
    | "fotoKk"
    | "requiresFaceVerification"
    | "lastFaceVerification"
    | "garansiHari"
    | "slaGaransiJam"
    | "penaltyPsb"
    | "penaltyMaintenance"
    | "createdAt"
    | "updatedAt"
    | "tenantId",
    ExtArgs["result"]["mitra"]
  >;
  export type MitraInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    mitraWallet?: boolean | Mitra$mitraWalletArgs<ExtArgs>;
    withdrawalsRequested?: boolean | Mitra$withdrawalsRequestedArgs<ExtArgs>;
    faceVerificationLogs?: boolean | Mitra$faceVerificationLogsArgs<ExtArgs>;
    _count?: boolean | MitraCountOutputTypeDefaultArgs<ExtArgs>;
  };
  export type MitraIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {};
  export type MitraIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {};

  export type $MitraPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "Mitra";
    objects: {
      mitraWallet: Prisma.$MitraWalletPayload<ExtArgs> | null;
      withdrawalsRequested: Prisma.$WithdrawRequestPayload<ExtArgs>[];
      faceVerificationLogs: Prisma.$FaceVerificationLogPayload<ExtArgs>[];
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        name: string;
        email: string;
        passwordHash: string | null;
        phone: string | null;
        isActive: boolean;
        siteId: string | null;
        mitraType: $Enums.MitraType;
        pushToken: string | null;
        pushTokenUpdatedAt: Date | null;
        fcmTokens: string[];
        lastVersionCode: number | null;
        lastVersionName: string | null;
        lastVersionUpdate: Date | null;
        tokenVersion: number;
        mitraRateWoPsb: number | null;
        mitraRateWoMaintenance: number | null;
        mitraRateCanvasing: number | null;
        bankName: string | null;
        bankAccountNo: string | null;
        bankAccountName: string | null;
        targetHarian: number | null;
        minWithdrawal: number | null;
        nik: string | null;
        tempatLahir: string | null;
        tanggalLahir: Date | null;
        alamat: string | null;
        latitudeRumah: number | null;
        longitudeRumah: number | null;
        fotoDiri: string | null;
        fotoKtp: string | null;
        fotoSim: string | null;
        fotoKk: string | null;
        requiresFaceVerification: boolean;
        lastFaceVerification: Date | null;
        garansiHari: number | null;
        slaGaransiJam: number | null;
        penaltyPsb: number | null;
        penaltyMaintenance: number | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
      },
      ExtArgs["result"]["mitra"]
    >;
    composites: {};
  };

  type MitraGetPayload<
    S extends boolean | null | undefined | MitraDefaultArgs,
  > = $Result.GetResult<Prisma.$MitraPayload, S>;

  type MitraCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<MitraFindManyArgs, "select" | "include" | "distinct" | "omit"> & {
    select?: MitraCountAggregateInputType | true;
  };

  export interface MitraDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["Mitra"];
      meta: { name: "Mitra" };
    };
    /**
     * Find zero or one Mitra that matches the filter.
     * @param {MitraFindUniqueArgs} args - Arguments to find a Mitra
     * @example
     * // Get one Mitra
     * const mitra = await prisma.mitra.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MitraFindUniqueArgs>(
      args: SelectSubset<T, MitraFindUniqueArgs<ExtArgs>>,
    ): Prisma__MitraClient<
      $Result.GetResult<
        Prisma.$MitraPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one Mitra that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MitraFindUniqueOrThrowArgs} args - Arguments to find a Mitra
     * @example
     * // Get one Mitra
     * const mitra = await prisma.mitra.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MitraFindUniqueOrThrowArgs>(
      args: SelectSubset<T, MitraFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__MitraClient<
      $Result.GetResult<
        Prisma.$MitraPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first Mitra that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraFindFirstArgs} args - Arguments to find a Mitra
     * @example
     * // Get one Mitra
     * const mitra = await prisma.mitra.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MitraFindFirstArgs>(
      args?: SelectSubset<T, MitraFindFirstArgs<ExtArgs>>,
    ): Prisma__MitraClient<
      $Result.GetResult<
        Prisma.$MitraPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first Mitra that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraFindFirstOrThrowArgs} args - Arguments to find a Mitra
     * @example
     * // Get one Mitra
     * const mitra = await prisma.mitra.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MitraFindFirstOrThrowArgs>(
      args?: SelectSubset<T, MitraFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__MitraClient<
      $Result.GetResult<
        Prisma.$MitraPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more Mitras that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Mitras
     * const mitras = await prisma.mitra.findMany()
     *
     * // Get first 10 Mitras
     * const mitras = await prisma.mitra.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const mitraWithIdOnly = await prisma.mitra.findMany({ select: { id: true } })
     *
     */
    findMany<T extends MitraFindManyArgs>(
      args?: SelectSubset<T, MitraFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$MitraPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a Mitra.
     * @param {MitraCreateArgs} args - Arguments to create a Mitra.
     * @example
     * // Create one Mitra
     * const Mitra = await prisma.mitra.create({
     *   data: {
     *     // ... data to create a Mitra
     *   }
     * })
     *
     */
    create<T extends MitraCreateArgs>(
      args: SelectSubset<T, MitraCreateArgs<ExtArgs>>,
    ): Prisma__MitraClient<
      $Result.GetResult<
        Prisma.$MitraPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many Mitras.
     * @param {MitraCreateManyArgs} args - Arguments to create many Mitras.
     * @example
     * // Create many Mitras
     * const mitra = await prisma.mitra.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends MitraCreateManyArgs>(
      args?: SelectSubset<T, MitraCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many Mitras and returns the data saved in the database.
     * @param {MitraCreateManyAndReturnArgs} args - Arguments to create many Mitras.
     * @example
     * // Create many Mitras
     * const mitra = await prisma.mitra.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many Mitras and only return the `id`
     * const mitraWithIdOnly = await prisma.mitra.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends MitraCreateManyAndReturnArgs>(
      args?: SelectSubset<T, MitraCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$MitraPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a Mitra.
     * @param {MitraDeleteArgs} args - Arguments to delete one Mitra.
     * @example
     * // Delete one Mitra
     * const Mitra = await prisma.mitra.delete({
     *   where: {
     *     // ... filter to delete one Mitra
     *   }
     * })
     *
     */
    delete<T extends MitraDeleteArgs>(
      args: SelectSubset<T, MitraDeleteArgs<ExtArgs>>,
    ): Prisma__MitraClient<
      $Result.GetResult<
        Prisma.$MitraPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one Mitra.
     * @param {MitraUpdateArgs} args - Arguments to update one Mitra.
     * @example
     * // Update one Mitra
     * const mitra = await prisma.mitra.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends MitraUpdateArgs>(
      args: SelectSubset<T, MitraUpdateArgs<ExtArgs>>,
    ): Prisma__MitraClient<
      $Result.GetResult<
        Prisma.$MitraPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more Mitras.
     * @param {MitraDeleteManyArgs} args - Arguments to filter Mitras to delete.
     * @example
     * // Delete a few Mitras
     * const { count } = await prisma.mitra.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends MitraDeleteManyArgs>(
      args?: SelectSubset<T, MitraDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Mitras.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Mitras
     * const mitra = await prisma.mitra.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends MitraUpdateManyArgs>(
      args: SelectSubset<T, MitraUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Mitras and returns the data updated in the database.
     * @param {MitraUpdateManyAndReturnArgs} args - Arguments to update many Mitras.
     * @example
     * // Update many Mitras
     * const mitra = await prisma.mitra.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more Mitras and only return the `id`
     * const mitraWithIdOnly = await prisma.mitra.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends MitraUpdateManyAndReturnArgs>(
      args: SelectSubset<T, MitraUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$MitraPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one Mitra.
     * @param {MitraUpsertArgs} args - Arguments to update or create a Mitra.
     * @example
     * // Update or create a Mitra
     * const mitra = await prisma.mitra.upsert({
     *   create: {
     *     // ... data to create a Mitra
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Mitra we want to update
     *   }
     * })
     */
    upsert<T extends MitraUpsertArgs>(
      args: SelectSubset<T, MitraUpsertArgs<ExtArgs>>,
    ): Prisma__MitraClient<
      $Result.GetResult<
        Prisma.$MitraPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of Mitras.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraCountArgs} args - Arguments to filter Mitras to count.
     * @example
     * // Count the number of Mitras
     * const count = await prisma.mitra.count({
     *   where: {
     *     // ... the filter for the Mitras we want to count
     *   }
     * })
     **/
    count<T extends MitraCountArgs>(
      args?: Subset<T, MitraCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], MitraCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a Mitra.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends MitraAggregateArgs>(
      args: Subset<T, MitraAggregateArgs>,
    ): Prisma.PrismaPromise<GetMitraAggregateType<T>>;

    /**
     * Group by Mitra.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends MitraGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MitraGroupByArgs["orderBy"] }
        : { orderBy?: MitraGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, MitraGroupByArgs, OrderByArg> & InputErrors,
    ): {} extends InputErrors
      ? GetMitraGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the Mitra model
     */
    readonly fields: MitraFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Mitra.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MitraClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    mitraWallet<T extends Mitra$mitraWalletArgs<ExtArgs> = {}>(
      args?: Subset<T, Mitra$mitraWalletArgs<ExtArgs>>,
    ): Prisma__MitraWalletClient<
      $Result.GetResult<
        Prisma.$MitraWalletPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;
    withdrawalsRequested<
      T extends Mitra$withdrawalsRequestedArgs<ExtArgs> = {},
    >(
      args?: Subset<T, Mitra$withdrawalsRequestedArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$WithdrawRequestPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    faceVerificationLogs<
      T extends Mitra$faceVerificationLogsArgs<ExtArgs> = {},
    >(
      args?: Subset<T, Mitra$faceVerificationLogsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$FaceVerificationLogPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the Mitra model
   */
  interface MitraFieldRefs {
    readonly id: FieldRef<"Mitra", "String">;
    readonly name: FieldRef<"Mitra", "String">;
    readonly email: FieldRef<"Mitra", "String">;
    readonly passwordHash: FieldRef<"Mitra", "String">;
    readonly phone: FieldRef<"Mitra", "String">;
    readonly isActive: FieldRef<"Mitra", "Boolean">;
    readonly siteId: FieldRef<"Mitra", "String">;
    readonly mitraType: FieldRef<"Mitra", "MitraType">;
    readonly pushToken: FieldRef<"Mitra", "String">;
    readonly pushTokenUpdatedAt: FieldRef<"Mitra", "DateTime">;
    readonly fcmTokens: FieldRef<"Mitra", "String[]">;
    readonly lastVersionCode: FieldRef<"Mitra", "Int">;
    readonly lastVersionName: FieldRef<"Mitra", "String">;
    readonly lastVersionUpdate: FieldRef<"Mitra", "DateTime">;
    readonly tokenVersion: FieldRef<"Mitra", "Int">;
    readonly mitraRateWoPsb: FieldRef<"Mitra", "Float">;
    readonly mitraRateWoMaintenance: FieldRef<"Mitra", "Float">;
    readonly mitraRateCanvasing: FieldRef<"Mitra", "Float">;
    readonly bankName: FieldRef<"Mitra", "String">;
    readonly bankAccountNo: FieldRef<"Mitra", "String">;
    readonly bankAccountName: FieldRef<"Mitra", "String">;
    readonly targetHarian: FieldRef<"Mitra", "Int">;
    readonly minWithdrawal: FieldRef<"Mitra", "Int">;
    readonly nik: FieldRef<"Mitra", "String">;
    readonly tempatLahir: FieldRef<"Mitra", "String">;
    readonly tanggalLahir: FieldRef<"Mitra", "DateTime">;
    readonly alamat: FieldRef<"Mitra", "String">;
    readonly latitudeRumah: FieldRef<"Mitra", "Float">;
    readonly longitudeRumah: FieldRef<"Mitra", "Float">;
    readonly fotoDiri: FieldRef<"Mitra", "String">;
    readonly fotoKtp: FieldRef<"Mitra", "String">;
    readonly fotoSim: FieldRef<"Mitra", "String">;
    readonly fotoKk: FieldRef<"Mitra", "String">;
    readonly requiresFaceVerification: FieldRef<"Mitra", "Boolean">;
    readonly lastFaceVerification: FieldRef<"Mitra", "DateTime">;
    readonly garansiHari: FieldRef<"Mitra", "Int">;
    readonly slaGaransiJam: FieldRef<"Mitra", "Int">;
    readonly penaltyPsb: FieldRef<"Mitra", "Float">;
    readonly penaltyMaintenance: FieldRef<"Mitra", "Float">;
    readonly createdAt: FieldRef<"Mitra", "DateTime">;
    readonly updatedAt: FieldRef<"Mitra", "DateTime">;
    readonly tenantId: FieldRef<"Mitra", "String">;
  }

  // Custom InputTypes
  /**
   * Mitra findUnique
   */
  export type MitraFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Mitra
     */
    select?: MitraSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Mitra
     */
    omit?: MitraOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraInclude<ExtArgs> | null;
    /**
     * Filter, which Mitra to fetch.
     */
    where: MitraWhereUniqueInput;
  };

  /**
   * Mitra findUniqueOrThrow
   */
  export type MitraFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Mitra
     */
    select?: MitraSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Mitra
     */
    omit?: MitraOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraInclude<ExtArgs> | null;
    /**
     * Filter, which Mitra to fetch.
     */
    where: MitraWhereUniqueInput;
  };

  /**
   * Mitra findFirst
   */
  export type MitraFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Mitra
     */
    select?: MitraSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Mitra
     */
    omit?: MitraOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraInclude<ExtArgs> | null;
    /**
     * Filter, which Mitra to fetch.
     */
    where?: MitraWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Mitras to fetch.
     */
    orderBy?: MitraOrderByWithRelationInput | MitraOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Mitras.
     */
    cursor?: MitraWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Mitras from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Mitras.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Mitras.
     */
    distinct?: MitraScalarFieldEnum | MitraScalarFieldEnum[];
  };

  /**
   * Mitra findFirstOrThrow
   */
  export type MitraFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Mitra
     */
    select?: MitraSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Mitra
     */
    omit?: MitraOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraInclude<ExtArgs> | null;
    /**
     * Filter, which Mitra to fetch.
     */
    where?: MitraWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Mitras to fetch.
     */
    orderBy?: MitraOrderByWithRelationInput | MitraOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Mitras.
     */
    cursor?: MitraWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Mitras from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Mitras.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Mitras.
     */
    distinct?: MitraScalarFieldEnum | MitraScalarFieldEnum[];
  };

  /**
   * Mitra findMany
   */
  export type MitraFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Mitra
     */
    select?: MitraSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Mitra
     */
    omit?: MitraOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraInclude<ExtArgs> | null;
    /**
     * Filter, which Mitras to fetch.
     */
    where?: MitraWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Mitras to fetch.
     */
    orderBy?: MitraOrderByWithRelationInput | MitraOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing Mitras.
     */
    cursor?: MitraWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Mitras from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Mitras.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Mitras.
     */
    distinct?: MitraScalarFieldEnum | MitraScalarFieldEnum[];
  };

  /**
   * Mitra create
   */
  export type MitraCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Mitra
     */
    select?: MitraSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Mitra
     */
    omit?: MitraOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraInclude<ExtArgs> | null;
    /**
     * The data needed to create a Mitra.
     */
    data: XOR<MitraCreateInput, MitraUncheckedCreateInput>;
  };

  /**
   * Mitra createMany
   */
  export type MitraCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many Mitras.
     */
    data: MitraCreateManyInput | MitraCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * Mitra createManyAndReturn
   */
  export type MitraCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Mitra
     */
    select?: MitraSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Mitra
     */
    omit?: MitraOmit<ExtArgs> | null;
    /**
     * The data used to create many Mitras.
     */
    data: MitraCreateManyInput | MitraCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * Mitra update
   */
  export type MitraUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Mitra
     */
    select?: MitraSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Mitra
     */
    omit?: MitraOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraInclude<ExtArgs> | null;
    /**
     * The data needed to update a Mitra.
     */
    data: XOR<MitraUpdateInput, MitraUncheckedUpdateInput>;
    /**
     * Choose, which Mitra to update.
     */
    where: MitraWhereUniqueInput;
  };

  /**
   * Mitra updateMany
   */
  export type MitraUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update Mitras.
     */
    data: XOR<MitraUpdateManyMutationInput, MitraUncheckedUpdateManyInput>;
    /**
     * Filter which Mitras to update
     */
    where?: MitraWhereInput;
    /**
     * Limit how many Mitras to update.
     */
    limit?: number;
  };

  /**
   * Mitra updateManyAndReturn
   */
  export type MitraUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Mitra
     */
    select?: MitraSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Mitra
     */
    omit?: MitraOmit<ExtArgs> | null;
    /**
     * The data used to update Mitras.
     */
    data: XOR<MitraUpdateManyMutationInput, MitraUncheckedUpdateManyInput>;
    /**
     * Filter which Mitras to update
     */
    where?: MitraWhereInput;
    /**
     * Limit how many Mitras to update.
     */
    limit?: number;
  };

  /**
   * Mitra upsert
   */
  export type MitraUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Mitra
     */
    select?: MitraSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Mitra
     */
    omit?: MitraOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraInclude<ExtArgs> | null;
    /**
     * The filter to search for the Mitra to update in case it exists.
     */
    where: MitraWhereUniqueInput;
    /**
     * In case the Mitra found by the `where` argument doesn't exist, create a new Mitra with this data.
     */
    create: XOR<MitraCreateInput, MitraUncheckedCreateInput>;
    /**
     * In case the Mitra was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MitraUpdateInput, MitraUncheckedUpdateInput>;
  };

  /**
   * Mitra delete
   */
  export type MitraDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Mitra
     */
    select?: MitraSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Mitra
     */
    omit?: MitraOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraInclude<ExtArgs> | null;
    /**
     * Filter which Mitra to delete.
     */
    where: MitraWhereUniqueInput;
  };

  /**
   * Mitra deleteMany
   */
  export type MitraDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Mitras to delete
     */
    where?: MitraWhereInput;
    /**
     * Limit how many Mitras to delete.
     */
    limit?: number;
  };

  /**
   * Mitra.mitraWallet
   */
  export type Mitra$mitraWalletArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraWallet
     */
    select?: MitraWalletSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraWallet
     */
    omit?: MitraWalletOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraWalletInclude<ExtArgs> | null;
    where?: MitraWalletWhereInput;
  };

  /**
   * Mitra.withdrawalsRequested
   */
  export type Mitra$withdrawalsRequestedArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WithdrawRequest
     */
    select?: WithdrawRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WithdrawRequest
     */
    omit?: WithdrawRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WithdrawRequestInclude<ExtArgs> | null;
    where?: WithdrawRequestWhereInput;
    orderBy?:
      | WithdrawRequestOrderByWithRelationInput
      | WithdrawRequestOrderByWithRelationInput[];
    cursor?: WithdrawRequestWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?:
      | WithdrawRequestScalarFieldEnum
      | WithdrawRequestScalarFieldEnum[];
  };

  /**
   * Mitra.faceVerificationLogs
   */
  export type Mitra$faceVerificationLogsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FaceVerificationLog
     */
    select?: FaceVerificationLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FaceVerificationLog
     */
    omit?: FaceVerificationLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FaceVerificationLogInclude<ExtArgs> | null;
    where?: FaceVerificationLogWhereInput;
    orderBy?:
      | FaceVerificationLogOrderByWithRelationInput
      | FaceVerificationLogOrderByWithRelationInput[];
    cursor?: FaceVerificationLogWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?:
      | FaceVerificationLogScalarFieldEnum
      | FaceVerificationLogScalarFieldEnum[];
  };

  /**
   * Mitra without action
   */
  export type MitraDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Mitra
     */
    select?: MitraSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Mitra
     */
    omit?: MitraOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraInclude<ExtArgs> | null;
  };

  /**
   * Model MitraWallet
   */

  export type AggregateMitraWallet = {
    _count: MitraWalletCountAggregateOutputType | null;
    _avg: MitraWalletAvgAggregateOutputType | null;
    _sum: MitraWalletSumAggregateOutputType | null;
    _min: MitraWalletMinAggregateOutputType | null;
    _max: MitraWalletMaxAggregateOutputType | null;
  };

  export type MitraWalletAvgAggregateOutputType = {
    balance: Decimal | null;
    totalEarnings: Decimal | null;
    totalWithdrawn: Decimal | null;
  };

  export type MitraWalletSumAggregateOutputType = {
    balance: Decimal | null;
    totalEarnings: Decimal | null;
    totalWithdrawn: Decimal | null;
  };

  export type MitraWalletMinAggregateOutputType = {
    id: string | null;
    mitraId: string | null;
    balance: Decimal | null;
    totalEarnings: Decimal | null;
    totalWithdrawn: Decimal | null;
    currency: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    tenantId: string | null;
  };

  export type MitraWalletMaxAggregateOutputType = {
    id: string | null;
    mitraId: string | null;
    balance: Decimal | null;
    totalEarnings: Decimal | null;
    totalWithdrawn: Decimal | null;
    currency: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    tenantId: string | null;
  };

  export type MitraWalletCountAggregateOutputType = {
    id: number;
    mitraId: number;
    balance: number;
    totalEarnings: number;
    totalWithdrawn: number;
    currency: number;
    createdAt: number;
    updatedAt: number;
    tenantId: number;
    _all: number;
  };

  export type MitraWalletAvgAggregateInputType = {
    balance?: true;
    totalEarnings?: true;
    totalWithdrawn?: true;
  };

  export type MitraWalletSumAggregateInputType = {
    balance?: true;
    totalEarnings?: true;
    totalWithdrawn?: true;
  };

  export type MitraWalletMinAggregateInputType = {
    id?: true;
    mitraId?: true;
    balance?: true;
    totalEarnings?: true;
    totalWithdrawn?: true;
    currency?: true;
    createdAt?: true;
    updatedAt?: true;
    tenantId?: true;
  };

  export type MitraWalletMaxAggregateInputType = {
    id?: true;
    mitraId?: true;
    balance?: true;
    totalEarnings?: true;
    totalWithdrawn?: true;
    currency?: true;
    createdAt?: true;
    updatedAt?: true;
    tenantId?: true;
  };

  export type MitraWalletCountAggregateInputType = {
    id?: true;
    mitraId?: true;
    balance?: true;
    totalEarnings?: true;
    totalWithdrawn?: true;
    currency?: true;
    createdAt?: true;
    updatedAt?: true;
    tenantId?: true;
    _all?: true;
  };

  export type MitraWalletAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which MitraWallet to aggregate.
     */
    where?: MitraWalletWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MitraWallets to fetch.
     */
    orderBy?:
      | MitraWalletOrderByWithRelationInput
      | MitraWalletOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: MitraWalletWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MitraWallets from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MitraWallets.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned MitraWallets
     **/
    _count?: true | MitraWalletCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: MitraWalletAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: MitraWalletSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: MitraWalletMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: MitraWalletMaxAggregateInputType;
  };

  export type GetMitraWalletAggregateType<T extends MitraWalletAggregateArgs> =
    {
      [P in keyof T & keyof AggregateMitraWallet]: P extends "_count" | "count"
        ? T[P] extends true
          ? number
          : GetScalarType<T[P], AggregateMitraWallet[P]>
        : GetScalarType<T[P], AggregateMitraWallet[P]>;
    };

  export type MitraWalletGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: MitraWalletWhereInput;
    orderBy?:
      | MitraWalletOrderByWithAggregationInput
      | MitraWalletOrderByWithAggregationInput[];
    by: MitraWalletScalarFieldEnum[] | MitraWalletScalarFieldEnum;
    having?: MitraWalletScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: MitraWalletCountAggregateInputType | true;
    _avg?: MitraWalletAvgAggregateInputType;
    _sum?: MitraWalletSumAggregateInputType;
    _min?: MitraWalletMinAggregateInputType;
    _max?: MitraWalletMaxAggregateInputType;
  };

  export type MitraWalletGroupByOutputType = {
    id: string;
    mitraId: string;
    balance: Decimal;
    totalEarnings: Decimal;
    totalWithdrawn: Decimal;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
    tenantId: string | null;
    _count: MitraWalletCountAggregateOutputType | null;
    _avg: MitraWalletAvgAggregateOutputType | null;
    _sum: MitraWalletSumAggregateOutputType | null;
    _min: MitraWalletMinAggregateOutputType | null;
    _max: MitraWalletMaxAggregateOutputType | null;
  };

  type GetMitraWalletGroupByPayload<T extends MitraWalletGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<MitraWalletGroupByOutputType, T["by"]> & {
          [P in keyof T &
            keyof MitraWalletGroupByOutputType]: P extends "_count"
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MitraWalletGroupByOutputType[P]>
            : GetScalarType<T[P], MitraWalletGroupByOutputType[P]>;
        }
      >
    >;

  export type MitraWalletSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      mitraId?: boolean;
      balance?: boolean;
      totalEarnings?: boolean;
      totalWithdrawn?: boolean;
      currency?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      tenantId?: boolean;
      mitra?: boolean | MitraDefaultArgs<ExtArgs>;
      transactions?: boolean | MitraWallet$transactionsArgs<ExtArgs>;
      withdrawals?: boolean | MitraWallet$withdrawalsArgs<ExtArgs>;
      _count?: boolean | MitraWalletCountOutputTypeDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["mitraWallet"]
  >;

  export type MitraWalletSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      mitraId?: boolean;
      balance?: boolean;
      totalEarnings?: boolean;
      totalWithdrawn?: boolean;
      currency?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      tenantId?: boolean;
      mitra?: boolean | MitraDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["mitraWallet"]
  >;

  export type MitraWalletSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      mitraId?: boolean;
      balance?: boolean;
      totalEarnings?: boolean;
      totalWithdrawn?: boolean;
      currency?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      tenantId?: boolean;
      mitra?: boolean | MitraDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["mitraWallet"]
  >;

  export type MitraWalletSelectScalar = {
    id?: boolean;
    mitraId?: boolean;
    balance?: boolean;
    totalEarnings?: boolean;
    totalWithdrawn?: boolean;
    currency?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    tenantId?: boolean;
  };

  export type MitraWalletOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "mitraId"
    | "balance"
    | "totalEarnings"
    | "totalWithdrawn"
    | "currency"
    | "createdAt"
    | "updatedAt"
    | "tenantId",
    ExtArgs["result"]["mitraWallet"]
  >;
  export type MitraWalletInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    mitra?: boolean | MitraDefaultArgs<ExtArgs>;
    transactions?: boolean | MitraWallet$transactionsArgs<ExtArgs>;
    withdrawals?: boolean | MitraWallet$withdrawalsArgs<ExtArgs>;
    _count?: boolean | MitraWalletCountOutputTypeDefaultArgs<ExtArgs>;
  };
  export type MitraWalletIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    mitra?: boolean | MitraDefaultArgs<ExtArgs>;
  };
  export type MitraWalletIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    mitra?: boolean | MitraDefaultArgs<ExtArgs>;
  };

  export type $MitraWalletPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "MitraWallet";
    objects: {
      mitra: Prisma.$MitraPayload<ExtArgs>;
      transactions: Prisma.$MitraTransactionPayload<ExtArgs>[];
      withdrawals: Prisma.$WithdrawRequestPayload<ExtArgs>[];
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        mitraId: string;
        balance: Prisma.Decimal;
        totalEarnings: Prisma.Decimal;
        totalWithdrawn: Prisma.Decimal;
        currency: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
      },
      ExtArgs["result"]["mitraWallet"]
    >;
    composites: {};
  };

  type MitraWalletGetPayload<
    S extends boolean | null | undefined | MitraWalletDefaultArgs,
  > = $Result.GetResult<Prisma.$MitraWalletPayload, S>;

  type MitraWalletCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    MitraWalletFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: MitraWalletCountAggregateInputType | true;
  };

  export interface MitraWalletDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["MitraWallet"];
      meta: { name: "MitraWallet" };
    };
    /**
     * Find zero or one MitraWallet that matches the filter.
     * @param {MitraWalletFindUniqueArgs} args - Arguments to find a MitraWallet
     * @example
     * // Get one MitraWallet
     * const mitraWallet = await prisma.mitraWallet.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MitraWalletFindUniqueArgs>(
      args: SelectSubset<T, MitraWalletFindUniqueArgs<ExtArgs>>,
    ): Prisma__MitraWalletClient<
      $Result.GetResult<
        Prisma.$MitraWalletPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one MitraWallet that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MitraWalletFindUniqueOrThrowArgs} args - Arguments to find a MitraWallet
     * @example
     * // Get one MitraWallet
     * const mitraWallet = await prisma.mitraWallet.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MitraWalletFindUniqueOrThrowArgs>(
      args: SelectSubset<T, MitraWalletFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__MitraWalletClient<
      $Result.GetResult<
        Prisma.$MitraWalletPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first MitraWallet that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraWalletFindFirstArgs} args - Arguments to find a MitraWallet
     * @example
     * // Get one MitraWallet
     * const mitraWallet = await prisma.mitraWallet.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MitraWalletFindFirstArgs>(
      args?: SelectSubset<T, MitraWalletFindFirstArgs<ExtArgs>>,
    ): Prisma__MitraWalletClient<
      $Result.GetResult<
        Prisma.$MitraWalletPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first MitraWallet that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraWalletFindFirstOrThrowArgs} args - Arguments to find a MitraWallet
     * @example
     * // Get one MitraWallet
     * const mitraWallet = await prisma.mitraWallet.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MitraWalletFindFirstOrThrowArgs>(
      args?: SelectSubset<T, MitraWalletFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__MitraWalletClient<
      $Result.GetResult<
        Prisma.$MitraWalletPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more MitraWallets that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraWalletFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MitraWallets
     * const mitraWallets = await prisma.mitraWallet.findMany()
     *
     * // Get first 10 MitraWallets
     * const mitraWallets = await prisma.mitraWallet.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const mitraWalletWithIdOnly = await prisma.mitraWallet.findMany({ select: { id: true } })
     *
     */
    findMany<T extends MitraWalletFindManyArgs>(
      args?: SelectSubset<T, MitraWalletFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$MitraWalletPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a MitraWallet.
     * @param {MitraWalletCreateArgs} args - Arguments to create a MitraWallet.
     * @example
     * // Create one MitraWallet
     * const MitraWallet = await prisma.mitraWallet.create({
     *   data: {
     *     // ... data to create a MitraWallet
     *   }
     * })
     *
     */
    create<T extends MitraWalletCreateArgs>(
      args: SelectSubset<T, MitraWalletCreateArgs<ExtArgs>>,
    ): Prisma__MitraWalletClient<
      $Result.GetResult<
        Prisma.$MitraWalletPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many MitraWallets.
     * @param {MitraWalletCreateManyArgs} args - Arguments to create many MitraWallets.
     * @example
     * // Create many MitraWallets
     * const mitraWallet = await prisma.mitraWallet.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends MitraWalletCreateManyArgs>(
      args?: SelectSubset<T, MitraWalletCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many MitraWallets and returns the data saved in the database.
     * @param {MitraWalletCreateManyAndReturnArgs} args - Arguments to create many MitraWallets.
     * @example
     * // Create many MitraWallets
     * const mitraWallet = await prisma.mitraWallet.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many MitraWallets and only return the `id`
     * const mitraWalletWithIdOnly = await prisma.mitraWallet.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends MitraWalletCreateManyAndReturnArgs>(
      args?: SelectSubset<T, MitraWalletCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$MitraWalletPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a MitraWallet.
     * @param {MitraWalletDeleteArgs} args - Arguments to delete one MitraWallet.
     * @example
     * // Delete one MitraWallet
     * const MitraWallet = await prisma.mitraWallet.delete({
     *   where: {
     *     // ... filter to delete one MitraWallet
     *   }
     * })
     *
     */
    delete<T extends MitraWalletDeleteArgs>(
      args: SelectSubset<T, MitraWalletDeleteArgs<ExtArgs>>,
    ): Prisma__MitraWalletClient<
      $Result.GetResult<
        Prisma.$MitraWalletPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one MitraWallet.
     * @param {MitraWalletUpdateArgs} args - Arguments to update one MitraWallet.
     * @example
     * // Update one MitraWallet
     * const mitraWallet = await prisma.mitraWallet.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends MitraWalletUpdateArgs>(
      args: SelectSubset<T, MitraWalletUpdateArgs<ExtArgs>>,
    ): Prisma__MitraWalletClient<
      $Result.GetResult<
        Prisma.$MitraWalletPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more MitraWallets.
     * @param {MitraWalletDeleteManyArgs} args - Arguments to filter MitraWallets to delete.
     * @example
     * // Delete a few MitraWallets
     * const { count } = await prisma.mitraWallet.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends MitraWalletDeleteManyArgs>(
      args?: SelectSubset<T, MitraWalletDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more MitraWallets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraWalletUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MitraWallets
     * const mitraWallet = await prisma.mitraWallet.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends MitraWalletUpdateManyArgs>(
      args: SelectSubset<T, MitraWalletUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more MitraWallets and returns the data updated in the database.
     * @param {MitraWalletUpdateManyAndReturnArgs} args - Arguments to update many MitraWallets.
     * @example
     * // Update many MitraWallets
     * const mitraWallet = await prisma.mitraWallet.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more MitraWallets and only return the `id`
     * const mitraWalletWithIdOnly = await prisma.mitraWallet.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends MitraWalletUpdateManyAndReturnArgs>(
      args: SelectSubset<T, MitraWalletUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$MitraWalletPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one MitraWallet.
     * @param {MitraWalletUpsertArgs} args - Arguments to update or create a MitraWallet.
     * @example
     * // Update or create a MitraWallet
     * const mitraWallet = await prisma.mitraWallet.upsert({
     *   create: {
     *     // ... data to create a MitraWallet
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MitraWallet we want to update
     *   }
     * })
     */
    upsert<T extends MitraWalletUpsertArgs>(
      args: SelectSubset<T, MitraWalletUpsertArgs<ExtArgs>>,
    ): Prisma__MitraWalletClient<
      $Result.GetResult<
        Prisma.$MitraWalletPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of MitraWallets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraWalletCountArgs} args - Arguments to filter MitraWallets to count.
     * @example
     * // Count the number of MitraWallets
     * const count = await prisma.mitraWallet.count({
     *   where: {
     *     // ... the filter for the MitraWallets we want to count
     *   }
     * })
     **/
    count<T extends MitraWalletCountArgs>(
      args?: Subset<T, MitraWalletCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], MitraWalletCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a MitraWallet.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraWalletAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends MitraWalletAggregateArgs>(
      args: Subset<T, MitraWalletAggregateArgs>,
    ): Prisma.PrismaPromise<GetMitraWalletAggregateType<T>>;

    /**
     * Group by MitraWallet.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraWalletGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends MitraWalletGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MitraWalletGroupByArgs["orderBy"] }
        : { orderBy?: MitraWalletGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, MitraWalletGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetMitraWalletGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the MitraWallet model
     */
    readonly fields: MitraWalletFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MitraWallet.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MitraWalletClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    mitra<T extends MitraDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, MitraDefaultArgs<ExtArgs>>,
    ): Prisma__MitraClient<
      | $Result.GetResult<
          Prisma.$MitraPayload<ExtArgs>,
          T,
          "findUniqueOrThrow",
          GlobalOmitOptions
        >
      | Null,
      Null,
      ExtArgs,
      GlobalOmitOptions
    >;
    transactions<T extends MitraWallet$transactionsArgs<ExtArgs> = {}>(
      args?: Subset<T, MitraWallet$transactionsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$MitraTransactionPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    withdrawals<T extends MitraWallet$withdrawalsArgs<ExtArgs> = {}>(
      args?: Subset<T, MitraWallet$withdrawalsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$WithdrawRequestPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the MitraWallet model
   */
  interface MitraWalletFieldRefs {
    readonly id: FieldRef<"MitraWallet", "String">;
    readonly mitraId: FieldRef<"MitraWallet", "String">;
    readonly balance: FieldRef<"MitraWallet", "Decimal">;
    readonly totalEarnings: FieldRef<"MitraWallet", "Decimal">;
    readonly totalWithdrawn: FieldRef<"MitraWallet", "Decimal">;
    readonly currency: FieldRef<"MitraWallet", "String">;
    readonly createdAt: FieldRef<"MitraWallet", "DateTime">;
    readonly updatedAt: FieldRef<"MitraWallet", "DateTime">;
    readonly tenantId: FieldRef<"MitraWallet", "String">;
  }

  // Custom InputTypes
  /**
   * MitraWallet findUnique
   */
  export type MitraWalletFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraWallet
     */
    select?: MitraWalletSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraWallet
     */
    omit?: MitraWalletOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraWalletInclude<ExtArgs> | null;
    /**
     * Filter, which MitraWallet to fetch.
     */
    where: MitraWalletWhereUniqueInput;
  };

  /**
   * MitraWallet findUniqueOrThrow
   */
  export type MitraWalletFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraWallet
     */
    select?: MitraWalletSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraWallet
     */
    omit?: MitraWalletOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraWalletInclude<ExtArgs> | null;
    /**
     * Filter, which MitraWallet to fetch.
     */
    where: MitraWalletWhereUniqueInput;
  };

  /**
   * MitraWallet findFirst
   */
  export type MitraWalletFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraWallet
     */
    select?: MitraWalletSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraWallet
     */
    omit?: MitraWalletOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraWalletInclude<ExtArgs> | null;
    /**
     * Filter, which MitraWallet to fetch.
     */
    where?: MitraWalletWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MitraWallets to fetch.
     */
    orderBy?:
      | MitraWalletOrderByWithRelationInput
      | MitraWalletOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for MitraWallets.
     */
    cursor?: MitraWalletWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MitraWallets from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MitraWallets.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MitraWallets.
     */
    distinct?: MitraWalletScalarFieldEnum | MitraWalletScalarFieldEnum[];
  };

  /**
   * MitraWallet findFirstOrThrow
   */
  export type MitraWalletFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraWallet
     */
    select?: MitraWalletSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraWallet
     */
    omit?: MitraWalletOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraWalletInclude<ExtArgs> | null;
    /**
     * Filter, which MitraWallet to fetch.
     */
    where?: MitraWalletWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MitraWallets to fetch.
     */
    orderBy?:
      | MitraWalletOrderByWithRelationInput
      | MitraWalletOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for MitraWallets.
     */
    cursor?: MitraWalletWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MitraWallets from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MitraWallets.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MitraWallets.
     */
    distinct?: MitraWalletScalarFieldEnum | MitraWalletScalarFieldEnum[];
  };

  /**
   * MitraWallet findMany
   */
  export type MitraWalletFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraWallet
     */
    select?: MitraWalletSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraWallet
     */
    omit?: MitraWalletOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraWalletInclude<ExtArgs> | null;
    /**
     * Filter, which MitraWallets to fetch.
     */
    where?: MitraWalletWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MitraWallets to fetch.
     */
    orderBy?:
      | MitraWalletOrderByWithRelationInput
      | MitraWalletOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing MitraWallets.
     */
    cursor?: MitraWalletWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MitraWallets from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MitraWallets.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MitraWallets.
     */
    distinct?: MitraWalletScalarFieldEnum | MitraWalletScalarFieldEnum[];
  };

  /**
   * MitraWallet create
   */
  export type MitraWalletCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraWallet
     */
    select?: MitraWalletSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraWallet
     */
    omit?: MitraWalletOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraWalletInclude<ExtArgs> | null;
    /**
     * The data needed to create a MitraWallet.
     */
    data: XOR<MitraWalletCreateInput, MitraWalletUncheckedCreateInput>;
  };

  /**
   * MitraWallet createMany
   */
  export type MitraWalletCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many MitraWallets.
     */
    data: MitraWalletCreateManyInput | MitraWalletCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * MitraWallet createManyAndReturn
   */
  export type MitraWalletCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraWallet
     */
    select?: MitraWalletSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraWallet
     */
    omit?: MitraWalletOmit<ExtArgs> | null;
    /**
     * The data used to create many MitraWallets.
     */
    data: MitraWalletCreateManyInput | MitraWalletCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraWalletIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * MitraWallet update
   */
  export type MitraWalletUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraWallet
     */
    select?: MitraWalletSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraWallet
     */
    omit?: MitraWalletOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraWalletInclude<ExtArgs> | null;
    /**
     * The data needed to update a MitraWallet.
     */
    data: XOR<MitraWalletUpdateInput, MitraWalletUncheckedUpdateInput>;
    /**
     * Choose, which MitraWallet to update.
     */
    where: MitraWalletWhereUniqueInput;
  };

  /**
   * MitraWallet updateMany
   */
  export type MitraWalletUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update MitraWallets.
     */
    data: XOR<
      MitraWalletUpdateManyMutationInput,
      MitraWalletUncheckedUpdateManyInput
    >;
    /**
     * Filter which MitraWallets to update
     */
    where?: MitraWalletWhereInput;
    /**
     * Limit how many MitraWallets to update.
     */
    limit?: number;
  };

  /**
   * MitraWallet updateManyAndReturn
   */
  export type MitraWalletUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraWallet
     */
    select?: MitraWalletSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraWallet
     */
    omit?: MitraWalletOmit<ExtArgs> | null;
    /**
     * The data used to update MitraWallets.
     */
    data: XOR<
      MitraWalletUpdateManyMutationInput,
      MitraWalletUncheckedUpdateManyInput
    >;
    /**
     * Filter which MitraWallets to update
     */
    where?: MitraWalletWhereInput;
    /**
     * Limit how many MitraWallets to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraWalletIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * MitraWallet upsert
   */
  export type MitraWalletUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraWallet
     */
    select?: MitraWalletSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraWallet
     */
    omit?: MitraWalletOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraWalletInclude<ExtArgs> | null;
    /**
     * The filter to search for the MitraWallet to update in case it exists.
     */
    where: MitraWalletWhereUniqueInput;
    /**
     * In case the MitraWallet found by the `where` argument doesn't exist, create a new MitraWallet with this data.
     */
    create: XOR<MitraWalletCreateInput, MitraWalletUncheckedCreateInput>;
    /**
     * In case the MitraWallet was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MitraWalletUpdateInput, MitraWalletUncheckedUpdateInput>;
  };

  /**
   * MitraWallet delete
   */
  export type MitraWalletDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraWallet
     */
    select?: MitraWalletSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraWallet
     */
    omit?: MitraWalletOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraWalletInclude<ExtArgs> | null;
    /**
     * Filter which MitraWallet to delete.
     */
    where: MitraWalletWhereUniqueInput;
  };

  /**
   * MitraWallet deleteMany
   */
  export type MitraWalletDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which MitraWallets to delete
     */
    where?: MitraWalletWhereInput;
    /**
     * Limit how many MitraWallets to delete.
     */
    limit?: number;
  };

  /**
   * MitraWallet.transactions
   */
  export type MitraWallet$transactionsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraTransaction
     */
    select?: MitraTransactionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraTransaction
     */
    omit?: MitraTransactionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraTransactionInclude<ExtArgs> | null;
    where?: MitraTransactionWhereInput;
    orderBy?:
      | MitraTransactionOrderByWithRelationInput
      | MitraTransactionOrderByWithRelationInput[];
    cursor?: MitraTransactionWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?:
      | MitraTransactionScalarFieldEnum
      | MitraTransactionScalarFieldEnum[];
  };

  /**
   * MitraWallet.withdrawals
   */
  export type MitraWallet$withdrawalsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WithdrawRequest
     */
    select?: WithdrawRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WithdrawRequest
     */
    omit?: WithdrawRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WithdrawRequestInclude<ExtArgs> | null;
    where?: WithdrawRequestWhereInput;
    orderBy?:
      | WithdrawRequestOrderByWithRelationInput
      | WithdrawRequestOrderByWithRelationInput[];
    cursor?: WithdrawRequestWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?:
      | WithdrawRequestScalarFieldEnum
      | WithdrawRequestScalarFieldEnum[];
  };

  /**
   * MitraWallet without action
   */
  export type MitraWalletDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraWallet
     */
    select?: MitraWalletSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraWallet
     */
    omit?: MitraWalletOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraWalletInclude<ExtArgs> | null;
  };

  /**
   * Model MitraTransaction
   */

  export type AggregateMitraTransaction = {
    _count: MitraTransactionCountAggregateOutputType | null;
    _avg: MitraTransactionAvgAggregateOutputType | null;
    _sum: MitraTransactionSumAggregateOutputType | null;
    _min: MitraTransactionMinAggregateOutputType | null;
    _max: MitraTransactionMaxAggregateOutputType | null;
  };

  export type MitraTransactionAvgAggregateOutputType = {
    amount: Decimal | null;
  };

  export type MitraTransactionSumAggregateOutputType = {
    amount: Decimal | null;
  };

  export type MitraTransactionMinAggregateOutputType = {
    id: string | null;
    walletId: string | null;
    amount: Decimal | null;
    type: $Enums.MitraTransactionType | null;
    description: string | null;
    referenceId: string | null;
    referenceType: string | null;
    createdAt: Date | null;
    tenantId: string | null;
  };

  export type MitraTransactionMaxAggregateOutputType = {
    id: string | null;
    walletId: string | null;
    amount: Decimal | null;
    type: $Enums.MitraTransactionType | null;
    description: string | null;
    referenceId: string | null;
    referenceType: string | null;
    createdAt: Date | null;
    tenantId: string | null;
  };

  export type MitraTransactionCountAggregateOutputType = {
    id: number;
    walletId: number;
    amount: number;
    type: number;
    description: number;
    referenceId: number;
    referenceType: number;
    createdAt: number;
    tenantId: number;
    _all: number;
  };

  export type MitraTransactionAvgAggregateInputType = {
    amount?: true;
  };

  export type MitraTransactionSumAggregateInputType = {
    amount?: true;
  };

  export type MitraTransactionMinAggregateInputType = {
    id?: true;
    walletId?: true;
    amount?: true;
    type?: true;
    description?: true;
    referenceId?: true;
    referenceType?: true;
    createdAt?: true;
    tenantId?: true;
  };

  export type MitraTransactionMaxAggregateInputType = {
    id?: true;
    walletId?: true;
    amount?: true;
    type?: true;
    description?: true;
    referenceId?: true;
    referenceType?: true;
    createdAt?: true;
    tenantId?: true;
  };

  export type MitraTransactionCountAggregateInputType = {
    id?: true;
    walletId?: true;
    amount?: true;
    type?: true;
    description?: true;
    referenceId?: true;
    referenceType?: true;
    createdAt?: true;
    tenantId?: true;
    _all?: true;
  };

  export type MitraTransactionAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which MitraTransaction to aggregate.
     */
    where?: MitraTransactionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MitraTransactions to fetch.
     */
    orderBy?:
      | MitraTransactionOrderByWithRelationInput
      | MitraTransactionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: MitraTransactionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MitraTransactions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MitraTransactions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned MitraTransactions
     **/
    _count?: true | MitraTransactionCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: MitraTransactionAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: MitraTransactionSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: MitraTransactionMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: MitraTransactionMaxAggregateInputType;
  };

  export type GetMitraTransactionAggregateType<
    T extends MitraTransactionAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateMitraTransaction]: P extends
      | "_count"
      | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMitraTransaction[P]>
      : GetScalarType<T[P], AggregateMitraTransaction[P]>;
  };

  export type MitraTransactionGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: MitraTransactionWhereInput;
    orderBy?:
      | MitraTransactionOrderByWithAggregationInput
      | MitraTransactionOrderByWithAggregationInput[];
    by: MitraTransactionScalarFieldEnum[] | MitraTransactionScalarFieldEnum;
    having?: MitraTransactionScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: MitraTransactionCountAggregateInputType | true;
    _avg?: MitraTransactionAvgAggregateInputType;
    _sum?: MitraTransactionSumAggregateInputType;
    _min?: MitraTransactionMinAggregateInputType;
    _max?: MitraTransactionMaxAggregateInputType;
  };

  export type MitraTransactionGroupByOutputType = {
    id: string;
    walletId: string;
    amount: Decimal;
    type: $Enums.MitraTransactionType;
    description: string;
    referenceId: string | null;
    referenceType: string | null;
    createdAt: Date;
    tenantId: string | null;
    _count: MitraTransactionCountAggregateOutputType | null;
    _avg: MitraTransactionAvgAggregateOutputType | null;
    _sum: MitraTransactionSumAggregateOutputType | null;
    _min: MitraTransactionMinAggregateOutputType | null;
    _max: MitraTransactionMaxAggregateOutputType | null;
  };

  type GetMitraTransactionGroupByPayload<
    T extends MitraTransactionGroupByArgs,
  > = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MitraTransactionGroupByOutputType, T["by"]> & {
        [P in keyof T &
          keyof MitraTransactionGroupByOutputType]: P extends "_count"
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], MitraTransactionGroupByOutputType[P]>
          : GetScalarType<T[P], MitraTransactionGroupByOutputType[P]>;
      }
    >
  >;

  export type MitraTransactionSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      walletId?: boolean;
      amount?: boolean;
      type?: boolean;
      description?: boolean;
      referenceId?: boolean;
      referenceType?: boolean;
      createdAt?: boolean;
      tenantId?: boolean;
      wallet?: boolean | MitraWalletDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["mitraTransaction"]
  >;

  export type MitraTransactionSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      walletId?: boolean;
      amount?: boolean;
      type?: boolean;
      description?: boolean;
      referenceId?: boolean;
      referenceType?: boolean;
      createdAt?: boolean;
      tenantId?: boolean;
      wallet?: boolean | MitraWalletDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["mitraTransaction"]
  >;

  export type MitraTransactionSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      walletId?: boolean;
      amount?: boolean;
      type?: boolean;
      description?: boolean;
      referenceId?: boolean;
      referenceType?: boolean;
      createdAt?: boolean;
      tenantId?: boolean;
      wallet?: boolean | MitraWalletDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["mitraTransaction"]
  >;

  export type MitraTransactionSelectScalar = {
    id?: boolean;
    walletId?: boolean;
    amount?: boolean;
    type?: boolean;
    description?: boolean;
    referenceId?: boolean;
    referenceType?: boolean;
    createdAt?: boolean;
    tenantId?: boolean;
  };

  export type MitraTransactionOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "walletId"
    | "amount"
    | "type"
    | "description"
    | "referenceId"
    | "referenceType"
    | "createdAt"
    | "tenantId",
    ExtArgs["result"]["mitraTransaction"]
  >;
  export type MitraTransactionInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    wallet?: boolean | MitraWalletDefaultArgs<ExtArgs>;
  };
  export type MitraTransactionIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    wallet?: boolean | MitraWalletDefaultArgs<ExtArgs>;
  };
  export type MitraTransactionIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    wallet?: boolean | MitraWalletDefaultArgs<ExtArgs>;
  };

  export type $MitraTransactionPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "MitraTransaction";
    objects: {
      wallet: Prisma.$MitraWalletPayload<ExtArgs>;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        walletId: string;
        amount: Prisma.Decimal;
        type: $Enums.MitraTransactionType;
        description: string;
        referenceId: string | null;
        referenceType: string | null;
        createdAt: Date;
        tenantId: string | null;
      },
      ExtArgs["result"]["mitraTransaction"]
    >;
    composites: {};
  };

  type MitraTransactionGetPayload<
    S extends boolean | null | undefined | MitraTransactionDefaultArgs,
  > = $Result.GetResult<Prisma.$MitraTransactionPayload, S>;

  type MitraTransactionCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    MitraTransactionFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: MitraTransactionCountAggregateInputType | true;
  };

  export interface MitraTransactionDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["MitraTransaction"];
      meta: { name: "MitraTransaction" };
    };
    /**
     * Find zero or one MitraTransaction that matches the filter.
     * @param {MitraTransactionFindUniqueArgs} args - Arguments to find a MitraTransaction
     * @example
     * // Get one MitraTransaction
     * const mitraTransaction = await prisma.mitraTransaction.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MitraTransactionFindUniqueArgs>(
      args: SelectSubset<T, MitraTransactionFindUniqueArgs<ExtArgs>>,
    ): Prisma__MitraTransactionClient<
      $Result.GetResult<
        Prisma.$MitraTransactionPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one MitraTransaction that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MitraTransactionFindUniqueOrThrowArgs} args - Arguments to find a MitraTransaction
     * @example
     * // Get one MitraTransaction
     * const mitraTransaction = await prisma.mitraTransaction.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MitraTransactionFindUniqueOrThrowArgs>(
      args: SelectSubset<T, MitraTransactionFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__MitraTransactionClient<
      $Result.GetResult<
        Prisma.$MitraTransactionPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first MitraTransaction that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraTransactionFindFirstArgs} args - Arguments to find a MitraTransaction
     * @example
     * // Get one MitraTransaction
     * const mitraTransaction = await prisma.mitraTransaction.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MitraTransactionFindFirstArgs>(
      args?: SelectSubset<T, MitraTransactionFindFirstArgs<ExtArgs>>,
    ): Prisma__MitraTransactionClient<
      $Result.GetResult<
        Prisma.$MitraTransactionPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first MitraTransaction that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraTransactionFindFirstOrThrowArgs} args - Arguments to find a MitraTransaction
     * @example
     * // Get one MitraTransaction
     * const mitraTransaction = await prisma.mitraTransaction.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MitraTransactionFindFirstOrThrowArgs>(
      args?: SelectSubset<T, MitraTransactionFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__MitraTransactionClient<
      $Result.GetResult<
        Prisma.$MitraTransactionPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more MitraTransactions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraTransactionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MitraTransactions
     * const mitraTransactions = await prisma.mitraTransaction.findMany()
     *
     * // Get first 10 MitraTransactions
     * const mitraTransactions = await prisma.mitraTransaction.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const mitraTransactionWithIdOnly = await prisma.mitraTransaction.findMany({ select: { id: true } })
     *
     */
    findMany<T extends MitraTransactionFindManyArgs>(
      args?: SelectSubset<T, MitraTransactionFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$MitraTransactionPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a MitraTransaction.
     * @param {MitraTransactionCreateArgs} args - Arguments to create a MitraTransaction.
     * @example
     * // Create one MitraTransaction
     * const MitraTransaction = await prisma.mitraTransaction.create({
     *   data: {
     *     // ... data to create a MitraTransaction
     *   }
     * })
     *
     */
    create<T extends MitraTransactionCreateArgs>(
      args: SelectSubset<T, MitraTransactionCreateArgs<ExtArgs>>,
    ): Prisma__MitraTransactionClient<
      $Result.GetResult<
        Prisma.$MitraTransactionPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many MitraTransactions.
     * @param {MitraTransactionCreateManyArgs} args - Arguments to create many MitraTransactions.
     * @example
     * // Create many MitraTransactions
     * const mitraTransaction = await prisma.mitraTransaction.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends MitraTransactionCreateManyArgs>(
      args?: SelectSubset<T, MitraTransactionCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many MitraTransactions and returns the data saved in the database.
     * @param {MitraTransactionCreateManyAndReturnArgs} args - Arguments to create many MitraTransactions.
     * @example
     * // Create many MitraTransactions
     * const mitraTransaction = await prisma.mitraTransaction.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many MitraTransactions and only return the `id`
     * const mitraTransactionWithIdOnly = await prisma.mitraTransaction.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends MitraTransactionCreateManyAndReturnArgs>(
      args?: SelectSubset<T, MitraTransactionCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$MitraTransactionPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a MitraTransaction.
     * @param {MitraTransactionDeleteArgs} args - Arguments to delete one MitraTransaction.
     * @example
     * // Delete one MitraTransaction
     * const MitraTransaction = await prisma.mitraTransaction.delete({
     *   where: {
     *     // ... filter to delete one MitraTransaction
     *   }
     * })
     *
     */
    delete<T extends MitraTransactionDeleteArgs>(
      args: SelectSubset<T, MitraTransactionDeleteArgs<ExtArgs>>,
    ): Prisma__MitraTransactionClient<
      $Result.GetResult<
        Prisma.$MitraTransactionPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one MitraTransaction.
     * @param {MitraTransactionUpdateArgs} args - Arguments to update one MitraTransaction.
     * @example
     * // Update one MitraTransaction
     * const mitraTransaction = await prisma.mitraTransaction.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends MitraTransactionUpdateArgs>(
      args: SelectSubset<T, MitraTransactionUpdateArgs<ExtArgs>>,
    ): Prisma__MitraTransactionClient<
      $Result.GetResult<
        Prisma.$MitraTransactionPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more MitraTransactions.
     * @param {MitraTransactionDeleteManyArgs} args - Arguments to filter MitraTransactions to delete.
     * @example
     * // Delete a few MitraTransactions
     * const { count } = await prisma.mitraTransaction.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends MitraTransactionDeleteManyArgs>(
      args?: SelectSubset<T, MitraTransactionDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more MitraTransactions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraTransactionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MitraTransactions
     * const mitraTransaction = await prisma.mitraTransaction.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends MitraTransactionUpdateManyArgs>(
      args: SelectSubset<T, MitraTransactionUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more MitraTransactions and returns the data updated in the database.
     * @param {MitraTransactionUpdateManyAndReturnArgs} args - Arguments to update many MitraTransactions.
     * @example
     * // Update many MitraTransactions
     * const mitraTransaction = await prisma.mitraTransaction.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more MitraTransactions and only return the `id`
     * const mitraTransactionWithIdOnly = await prisma.mitraTransaction.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends MitraTransactionUpdateManyAndReturnArgs>(
      args: SelectSubset<T, MitraTransactionUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$MitraTransactionPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one MitraTransaction.
     * @param {MitraTransactionUpsertArgs} args - Arguments to update or create a MitraTransaction.
     * @example
     * // Update or create a MitraTransaction
     * const mitraTransaction = await prisma.mitraTransaction.upsert({
     *   create: {
     *     // ... data to create a MitraTransaction
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MitraTransaction we want to update
     *   }
     * })
     */
    upsert<T extends MitraTransactionUpsertArgs>(
      args: SelectSubset<T, MitraTransactionUpsertArgs<ExtArgs>>,
    ): Prisma__MitraTransactionClient<
      $Result.GetResult<
        Prisma.$MitraTransactionPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of MitraTransactions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraTransactionCountArgs} args - Arguments to filter MitraTransactions to count.
     * @example
     * // Count the number of MitraTransactions
     * const count = await prisma.mitraTransaction.count({
     *   where: {
     *     // ... the filter for the MitraTransactions we want to count
     *   }
     * })
     **/
    count<T extends MitraTransactionCountArgs>(
      args?: Subset<T, MitraTransactionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], MitraTransactionCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a MitraTransaction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraTransactionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends MitraTransactionAggregateArgs>(
      args: Subset<T, MitraTransactionAggregateArgs>,
    ): Prisma.PrismaPromise<GetMitraTransactionAggregateType<T>>;

    /**
     * Group by MitraTransaction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MitraTransactionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends MitraTransactionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MitraTransactionGroupByArgs["orderBy"] }
        : { orderBy?: MitraTransactionGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, MitraTransactionGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetMitraTransactionGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the MitraTransaction model
     */
    readonly fields: MitraTransactionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MitraTransaction.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MitraTransactionClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    wallet<T extends MitraWalletDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, MitraWalletDefaultArgs<ExtArgs>>,
    ): Prisma__MitraWalletClient<
      | $Result.GetResult<
          Prisma.$MitraWalletPayload<ExtArgs>,
          T,
          "findUniqueOrThrow",
          GlobalOmitOptions
        >
      | Null,
      Null,
      ExtArgs,
      GlobalOmitOptions
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the MitraTransaction model
   */
  interface MitraTransactionFieldRefs {
    readonly id: FieldRef<"MitraTransaction", "String">;
    readonly walletId: FieldRef<"MitraTransaction", "String">;
    readonly amount: FieldRef<"MitraTransaction", "Decimal">;
    readonly type: FieldRef<"MitraTransaction", "MitraTransactionType">;
    readonly description: FieldRef<"MitraTransaction", "String">;
    readonly referenceId: FieldRef<"MitraTransaction", "String">;
    readonly referenceType: FieldRef<"MitraTransaction", "String">;
    readonly createdAt: FieldRef<"MitraTransaction", "DateTime">;
    readonly tenantId: FieldRef<"MitraTransaction", "String">;
  }

  // Custom InputTypes
  /**
   * MitraTransaction findUnique
   */
  export type MitraTransactionFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraTransaction
     */
    select?: MitraTransactionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraTransaction
     */
    omit?: MitraTransactionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraTransactionInclude<ExtArgs> | null;
    /**
     * Filter, which MitraTransaction to fetch.
     */
    where: MitraTransactionWhereUniqueInput;
  };

  /**
   * MitraTransaction findUniqueOrThrow
   */
  export type MitraTransactionFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraTransaction
     */
    select?: MitraTransactionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraTransaction
     */
    omit?: MitraTransactionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraTransactionInclude<ExtArgs> | null;
    /**
     * Filter, which MitraTransaction to fetch.
     */
    where: MitraTransactionWhereUniqueInput;
  };

  /**
   * MitraTransaction findFirst
   */
  export type MitraTransactionFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraTransaction
     */
    select?: MitraTransactionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraTransaction
     */
    omit?: MitraTransactionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraTransactionInclude<ExtArgs> | null;
    /**
     * Filter, which MitraTransaction to fetch.
     */
    where?: MitraTransactionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MitraTransactions to fetch.
     */
    orderBy?:
      | MitraTransactionOrderByWithRelationInput
      | MitraTransactionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for MitraTransactions.
     */
    cursor?: MitraTransactionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MitraTransactions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MitraTransactions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MitraTransactions.
     */
    distinct?:
      | MitraTransactionScalarFieldEnum
      | MitraTransactionScalarFieldEnum[];
  };

  /**
   * MitraTransaction findFirstOrThrow
   */
  export type MitraTransactionFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraTransaction
     */
    select?: MitraTransactionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraTransaction
     */
    omit?: MitraTransactionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraTransactionInclude<ExtArgs> | null;
    /**
     * Filter, which MitraTransaction to fetch.
     */
    where?: MitraTransactionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MitraTransactions to fetch.
     */
    orderBy?:
      | MitraTransactionOrderByWithRelationInput
      | MitraTransactionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for MitraTransactions.
     */
    cursor?: MitraTransactionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MitraTransactions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MitraTransactions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MitraTransactions.
     */
    distinct?:
      | MitraTransactionScalarFieldEnum
      | MitraTransactionScalarFieldEnum[];
  };

  /**
   * MitraTransaction findMany
   */
  export type MitraTransactionFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraTransaction
     */
    select?: MitraTransactionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraTransaction
     */
    omit?: MitraTransactionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraTransactionInclude<ExtArgs> | null;
    /**
     * Filter, which MitraTransactions to fetch.
     */
    where?: MitraTransactionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of MitraTransactions to fetch.
     */
    orderBy?:
      | MitraTransactionOrderByWithRelationInput
      | MitraTransactionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing MitraTransactions.
     */
    cursor?: MitraTransactionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` MitraTransactions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` MitraTransactions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of MitraTransactions.
     */
    distinct?:
      | MitraTransactionScalarFieldEnum
      | MitraTransactionScalarFieldEnum[];
  };

  /**
   * MitraTransaction create
   */
  export type MitraTransactionCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraTransaction
     */
    select?: MitraTransactionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraTransaction
     */
    omit?: MitraTransactionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraTransactionInclude<ExtArgs> | null;
    /**
     * The data needed to create a MitraTransaction.
     */
    data: XOR<
      MitraTransactionCreateInput,
      MitraTransactionUncheckedCreateInput
    >;
  };

  /**
   * MitraTransaction createMany
   */
  export type MitraTransactionCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many MitraTransactions.
     */
    data: MitraTransactionCreateManyInput | MitraTransactionCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * MitraTransaction createManyAndReturn
   */
  export type MitraTransactionCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraTransaction
     */
    select?: MitraTransactionSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraTransaction
     */
    omit?: MitraTransactionOmit<ExtArgs> | null;
    /**
     * The data used to create many MitraTransactions.
     */
    data: MitraTransactionCreateManyInput | MitraTransactionCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraTransactionIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * MitraTransaction update
   */
  export type MitraTransactionUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraTransaction
     */
    select?: MitraTransactionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraTransaction
     */
    omit?: MitraTransactionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraTransactionInclude<ExtArgs> | null;
    /**
     * The data needed to update a MitraTransaction.
     */
    data: XOR<
      MitraTransactionUpdateInput,
      MitraTransactionUncheckedUpdateInput
    >;
    /**
     * Choose, which MitraTransaction to update.
     */
    where: MitraTransactionWhereUniqueInput;
  };

  /**
   * MitraTransaction updateMany
   */
  export type MitraTransactionUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update MitraTransactions.
     */
    data: XOR<
      MitraTransactionUpdateManyMutationInput,
      MitraTransactionUncheckedUpdateManyInput
    >;
    /**
     * Filter which MitraTransactions to update
     */
    where?: MitraTransactionWhereInput;
    /**
     * Limit how many MitraTransactions to update.
     */
    limit?: number;
  };

  /**
   * MitraTransaction updateManyAndReturn
   */
  export type MitraTransactionUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraTransaction
     */
    select?: MitraTransactionSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraTransaction
     */
    omit?: MitraTransactionOmit<ExtArgs> | null;
    /**
     * The data used to update MitraTransactions.
     */
    data: XOR<
      MitraTransactionUpdateManyMutationInput,
      MitraTransactionUncheckedUpdateManyInput
    >;
    /**
     * Filter which MitraTransactions to update
     */
    where?: MitraTransactionWhereInput;
    /**
     * Limit how many MitraTransactions to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraTransactionIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * MitraTransaction upsert
   */
  export type MitraTransactionUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraTransaction
     */
    select?: MitraTransactionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraTransaction
     */
    omit?: MitraTransactionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraTransactionInclude<ExtArgs> | null;
    /**
     * The filter to search for the MitraTransaction to update in case it exists.
     */
    where: MitraTransactionWhereUniqueInput;
    /**
     * In case the MitraTransaction found by the `where` argument doesn't exist, create a new MitraTransaction with this data.
     */
    create: XOR<
      MitraTransactionCreateInput,
      MitraTransactionUncheckedCreateInput
    >;
    /**
     * In case the MitraTransaction was found with the provided `where` argument, update it with this data.
     */
    update: XOR<
      MitraTransactionUpdateInput,
      MitraTransactionUncheckedUpdateInput
    >;
  };

  /**
   * MitraTransaction delete
   */
  export type MitraTransactionDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraTransaction
     */
    select?: MitraTransactionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraTransaction
     */
    omit?: MitraTransactionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraTransactionInclude<ExtArgs> | null;
    /**
     * Filter which MitraTransaction to delete.
     */
    where: MitraTransactionWhereUniqueInput;
  };

  /**
   * MitraTransaction deleteMany
   */
  export type MitraTransactionDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which MitraTransactions to delete
     */
    where?: MitraTransactionWhereInput;
    /**
     * Limit how many MitraTransactions to delete.
     */
    limit?: number;
  };

  /**
   * MitraTransaction without action
   */
  export type MitraTransactionDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraTransaction
     */
    select?: MitraTransactionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraTransaction
     */
    omit?: MitraTransactionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraTransactionInclude<ExtArgs> | null;
  };

  /**
   * Model WithdrawRequest
   */

  export type AggregateWithdrawRequest = {
    _count: WithdrawRequestCountAggregateOutputType | null;
    _avg: WithdrawRequestAvgAggregateOutputType | null;
    _sum: WithdrawRequestSumAggregateOutputType | null;
    _min: WithdrawRequestMinAggregateOutputType | null;
    _max: WithdrawRequestMaxAggregateOutputType | null;
  };

  export type WithdrawRequestAvgAggregateOutputType = {
    amount: number | null;
  };

  export type WithdrawRequestSumAggregateOutputType = {
    amount: number | null;
  };

  export type WithdrawRequestMinAggregateOutputType = {
    id: string | null;
    mitraId: string | null;
    amount: number | null;
    bankName: string | null;
    bankAccountNo: string | null;
    bankAccountName: string | null;
    status: $Enums.WithdrawStatus | null;
    method: $Enums.WithdrawMethod | null;
    notes: string | null;
    processedById: string | null;
    processedAt: Date | null;
    rejectionReason: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    mitraWalletId: string | null;
    tenantId: string | null;
  };

  export type WithdrawRequestMaxAggregateOutputType = {
    id: string | null;
    mitraId: string | null;
    amount: number | null;
    bankName: string | null;
    bankAccountNo: string | null;
    bankAccountName: string | null;
    status: $Enums.WithdrawStatus | null;
    method: $Enums.WithdrawMethod | null;
    notes: string | null;
    processedById: string | null;
    processedAt: Date | null;
    rejectionReason: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    mitraWalletId: string | null;
    tenantId: string | null;
  };

  export type WithdrawRequestCountAggregateOutputType = {
    id: number;
    mitraId: number;
    amount: number;
    bankName: number;
    bankAccountNo: number;
    bankAccountName: number;
    status: number;
    method: number;
    notes: number;
    processedById: number;
    processedAt: number;
    rejectionReason: number;
    createdAt: number;
    updatedAt: number;
    mitraWalletId: number;
    tenantId: number;
    _all: number;
  };

  export type WithdrawRequestAvgAggregateInputType = {
    amount?: true;
  };

  export type WithdrawRequestSumAggregateInputType = {
    amount?: true;
  };

  export type WithdrawRequestMinAggregateInputType = {
    id?: true;
    mitraId?: true;
    amount?: true;
    bankName?: true;
    bankAccountNo?: true;
    bankAccountName?: true;
    status?: true;
    method?: true;
    notes?: true;
    processedById?: true;
    processedAt?: true;
    rejectionReason?: true;
    createdAt?: true;
    updatedAt?: true;
    mitraWalletId?: true;
    tenantId?: true;
  };

  export type WithdrawRequestMaxAggregateInputType = {
    id?: true;
    mitraId?: true;
    amount?: true;
    bankName?: true;
    bankAccountNo?: true;
    bankAccountName?: true;
    status?: true;
    method?: true;
    notes?: true;
    processedById?: true;
    processedAt?: true;
    rejectionReason?: true;
    createdAt?: true;
    updatedAt?: true;
    mitraWalletId?: true;
    tenantId?: true;
  };

  export type WithdrawRequestCountAggregateInputType = {
    id?: true;
    mitraId?: true;
    amount?: true;
    bankName?: true;
    bankAccountNo?: true;
    bankAccountName?: true;
    status?: true;
    method?: true;
    notes?: true;
    processedById?: true;
    processedAt?: true;
    rejectionReason?: true;
    createdAt?: true;
    updatedAt?: true;
    mitraWalletId?: true;
    tenantId?: true;
    _all?: true;
  };

  export type WithdrawRequestAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which WithdrawRequest to aggregate.
     */
    where?: WithdrawRequestWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of WithdrawRequests to fetch.
     */
    orderBy?:
      | WithdrawRequestOrderByWithRelationInput
      | WithdrawRequestOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: WithdrawRequestWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` WithdrawRequests from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` WithdrawRequests.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned WithdrawRequests
     **/
    _count?: true | WithdrawRequestCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: WithdrawRequestAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: WithdrawRequestSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: WithdrawRequestMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: WithdrawRequestMaxAggregateInputType;
  };

  export type GetWithdrawRequestAggregateType<
    T extends WithdrawRequestAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateWithdrawRequest]: P extends
      | "_count"
      | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateWithdrawRequest[P]>
      : GetScalarType<T[P], AggregateWithdrawRequest[P]>;
  };

  export type WithdrawRequestGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: WithdrawRequestWhereInput;
    orderBy?:
      | WithdrawRequestOrderByWithAggregationInput
      | WithdrawRequestOrderByWithAggregationInput[];
    by: WithdrawRequestScalarFieldEnum[] | WithdrawRequestScalarFieldEnum;
    having?: WithdrawRequestScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: WithdrawRequestCountAggregateInputType | true;
    _avg?: WithdrawRequestAvgAggregateInputType;
    _sum?: WithdrawRequestSumAggregateInputType;
    _min?: WithdrawRequestMinAggregateInputType;
    _max?: WithdrawRequestMaxAggregateInputType;
  };

  export type WithdrawRequestGroupByOutputType = {
    id: string;
    mitraId: string;
    amount: number;
    bankName: string;
    bankAccountNo: string;
    bankAccountName: string;
    status: $Enums.WithdrawStatus;
    method: $Enums.WithdrawMethod;
    notes: string | null;
    processedById: string | null;
    processedAt: Date | null;
    rejectionReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    mitraWalletId: string | null;
    tenantId: string | null;
    _count: WithdrawRequestCountAggregateOutputType | null;
    _avg: WithdrawRequestAvgAggregateOutputType | null;
    _sum: WithdrawRequestSumAggregateOutputType | null;
    _min: WithdrawRequestMinAggregateOutputType | null;
    _max: WithdrawRequestMaxAggregateOutputType | null;
  };

  type GetWithdrawRequestGroupByPayload<T extends WithdrawRequestGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<WithdrawRequestGroupByOutputType, T["by"]> & {
          [P in keyof T &
            keyof WithdrawRequestGroupByOutputType]: P extends "_count"
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], WithdrawRequestGroupByOutputType[P]>
            : GetScalarType<T[P], WithdrawRequestGroupByOutputType[P]>;
        }
      >
    >;

  export type WithdrawRequestSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      mitraId?: boolean;
      amount?: boolean;
      bankName?: boolean;
      bankAccountNo?: boolean;
      bankAccountName?: boolean;
      status?: boolean;
      method?: boolean;
      notes?: boolean;
      processedById?: boolean;
      processedAt?: boolean;
      rejectionReason?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      mitraWalletId?: boolean;
      tenantId?: boolean;
      mitra?: boolean | MitraDefaultArgs<ExtArgs>;
      mitraWallet?: boolean | WithdrawRequest$mitraWalletArgs<ExtArgs>;
    },
    ExtArgs["result"]["withdrawRequest"]
  >;

  export type WithdrawRequestSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      mitraId?: boolean;
      amount?: boolean;
      bankName?: boolean;
      bankAccountNo?: boolean;
      bankAccountName?: boolean;
      status?: boolean;
      method?: boolean;
      notes?: boolean;
      processedById?: boolean;
      processedAt?: boolean;
      rejectionReason?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      mitraWalletId?: boolean;
      tenantId?: boolean;
      mitra?: boolean | MitraDefaultArgs<ExtArgs>;
      mitraWallet?: boolean | WithdrawRequest$mitraWalletArgs<ExtArgs>;
    },
    ExtArgs["result"]["withdrawRequest"]
  >;

  export type WithdrawRequestSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      mitraId?: boolean;
      amount?: boolean;
      bankName?: boolean;
      bankAccountNo?: boolean;
      bankAccountName?: boolean;
      status?: boolean;
      method?: boolean;
      notes?: boolean;
      processedById?: boolean;
      processedAt?: boolean;
      rejectionReason?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      mitraWalletId?: boolean;
      tenantId?: boolean;
      mitra?: boolean | MitraDefaultArgs<ExtArgs>;
      mitraWallet?: boolean | WithdrawRequest$mitraWalletArgs<ExtArgs>;
    },
    ExtArgs["result"]["withdrawRequest"]
  >;

  export type WithdrawRequestSelectScalar = {
    id?: boolean;
    mitraId?: boolean;
    amount?: boolean;
    bankName?: boolean;
    bankAccountNo?: boolean;
    bankAccountName?: boolean;
    status?: boolean;
    method?: boolean;
    notes?: boolean;
    processedById?: boolean;
    processedAt?: boolean;
    rejectionReason?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    mitraWalletId?: boolean;
    tenantId?: boolean;
  };

  export type WithdrawRequestOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "mitraId"
    | "amount"
    | "bankName"
    | "bankAccountNo"
    | "bankAccountName"
    | "status"
    | "method"
    | "notes"
    | "processedById"
    | "processedAt"
    | "rejectionReason"
    | "createdAt"
    | "updatedAt"
    | "mitraWalletId"
    | "tenantId",
    ExtArgs["result"]["withdrawRequest"]
  >;
  export type WithdrawRequestInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    mitra?: boolean | MitraDefaultArgs<ExtArgs>;
    mitraWallet?: boolean | WithdrawRequest$mitraWalletArgs<ExtArgs>;
  };
  export type WithdrawRequestIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    mitra?: boolean | MitraDefaultArgs<ExtArgs>;
    mitraWallet?: boolean | WithdrawRequest$mitraWalletArgs<ExtArgs>;
  };
  export type WithdrawRequestIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    mitra?: boolean | MitraDefaultArgs<ExtArgs>;
    mitraWallet?: boolean | WithdrawRequest$mitraWalletArgs<ExtArgs>;
  };

  export type $WithdrawRequestPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "WithdrawRequest";
    objects: {
      mitra: Prisma.$MitraPayload<ExtArgs>;
      mitraWallet: Prisma.$MitraWalletPayload<ExtArgs> | null;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        mitraId: string;
        amount: number;
        bankName: string;
        bankAccountNo: string;
        bankAccountName: string;
        status: $Enums.WithdrawStatus;
        method: $Enums.WithdrawMethod;
        notes: string | null;
        processedById: string | null;
        processedAt: Date | null;
        rejectionReason: string | null;
        createdAt: Date;
        updatedAt: Date;
        mitraWalletId: string | null;
        tenantId: string | null;
      },
      ExtArgs["result"]["withdrawRequest"]
    >;
    composites: {};
  };

  type WithdrawRequestGetPayload<
    S extends boolean | null | undefined | WithdrawRequestDefaultArgs,
  > = $Result.GetResult<Prisma.$WithdrawRequestPayload, S>;

  type WithdrawRequestCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    WithdrawRequestFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: WithdrawRequestCountAggregateInputType | true;
  };

  export interface WithdrawRequestDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["WithdrawRequest"];
      meta: { name: "WithdrawRequest" };
    };
    /**
     * Find zero or one WithdrawRequest that matches the filter.
     * @param {WithdrawRequestFindUniqueArgs} args - Arguments to find a WithdrawRequest
     * @example
     * // Get one WithdrawRequest
     * const withdrawRequest = await prisma.withdrawRequest.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends WithdrawRequestFindUniqueArgs>(
      args: SelectSubset<T, WithdrawRequestFindUniqueArgs<ExtArgs>>,
    ): Prisma__WithdrawRequestClient<
      $Result.GetResult<
        Prisma.$WithdrawRequestPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one WithdrawRequest that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {WithdrawRequestFindUniqueOrThrowArgs} args - Arguments to find a WithdrawRequest
     * @example
     * // Get one WithdrawRequest
     * const withdrawRequest = await prisma.withdrawRequest.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends WithdrawRequestFindUniqueOrThrowArgs>(
      args: SelectSubset<T, WithdrawRequestFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__WithdrawRequestClient<
      $Result.GetResult<
        Prisma.$WithdrawRequestPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first WithdrawRequest that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WithdrawRequestFindFirstArgs} args - Arguments to find a WithdrawRequest
     * @example
     * // Get one WithdrawRequest
     * const withdrawRequest = await prisma.withdrawRequest.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends WithdrawRequestFindFirstArgs>(
      args?: SelectSubset<T, WithdrawRequestFindFirstArgs<ExtArgs>>,
    ): Prisma__WithdrawRequestClient<
      $Result.GetResult<
        Prisma.$WithdrawRequestPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first WithdrawRequest that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WithdrawRequestFindFirstOrThrowArgs} args - Arguments to find a WithdrawRequest
     * @example
     * // Get one WithdrawRequest
     * const withdrawRequest = await prisma.withdrawRequest.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends WithdrawRequestFindFirstOrThrowArgs>(
      args?: SelectSubset<T, WithdrawRequestFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__WithdrawRequestClient<
      $Result.GetResult<
        Prisma.$WithdrawRequestPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more WithdrawRequests that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WithdrawRequestFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all WithdrawRequests
     * const withdrawRequests = await prisma.withdrawRequest.findMany()
     *
     * // Get first 10 WithdrawRequests
     * const withdrawRequests = await prisma.withdrawRequest.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const withdrawRequestWithIdOnly = await prisma.withdrawRequest.findMany({ select: { id: true } })
     *
     */
    findMany<T extends WithdrawRequestFindManyArgs>(
      args?: SelectSubset<T, WithdrawRequestFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$WithdrawRequestPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a WithdrawRequest.
     * @param {WithdrawRequestCreateArgs} args - Arguments to create a WithdrawRequest.
     * @example
     * // Create one WithdrawRequest
     * const WithdrawRequest = await prisma.withdrawRequest.create({
     *   data: {
     *     // ... data to create a WithdrawRequest
     *   }
     * })
     *
     */
    create<T extends WithdrawRequestCreateArgs>(
      args: SelectSubset<T, WithdrawRequestCreateArgs<ExtArgs>>,
    ): Prisma__WithdrawRequestClient<
      $Result.GetResult<
        Prisma.$WithdrawRequestPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many WithdrawRequests.
     * @param {WithdrawRequestCreateManyArgs} args - Arguments to create many WithdrawRequests.
     * @example
     * // Create many WithdrawRequests
     * const withdrawRequest = await prisma.withdrawRequest.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends WithdrawRequestCreateManyArgs>(
      args?: SelectSubset<T, WithdrawRequestCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many WithdrawRequests and returns the data saved in the database.
     * @param {WithdrawRequestCreateManyAndReturnArgs} args - Arguments to create many WithdrawRequests.
     * @example
     * // Create many WithdrawRequests
     * const withdrawRequest = await prisma.withdrawRequest.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many WithdrawRequests and only return the `id`
     * const withdrawRequestWithIdOnly = await prisma.withdrawRequest.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends WithdrawRequestCreateManyAndReturnArgs>(
      args?: SelectSubset<T, WithdrawRequestCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$WithdrawRequestPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a WithdrawRequest.
     * @param {WithdrawRequestDeleteArgs} args - Arguments to delete one WithdrawRequest.
     * @example
     * // Delete one WithdrawRequest
     * const WithdrawRequest = await prisma.withdrawRequest.delete({
     *   where: {
     *     // ... filter to delete one WithdrawRequest
     *   }
     * })
     *
     */
    delete<T extends WithdrawRequestDeleteArgs>(
      args: SelectSubset<T, WithdrawRequestDeleteArgs<ExtArgs>>,
    ): Prisma__WithdrawRequestClient<
      $Result.GetResult<
        Prisma.$WithdrawRequestPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one WithdrawRequest.
     * @param {WithdrawRequestUpdateArgs} args - Arguments to update one WithdrawRequest.
     * @example
     * // Update one WithdrawRequest
     * const withdrawRequest = await prisma.withdrawRequest.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends WithdrawRequestUpdateArgs>(
      args: SelectSubset<T, WithdrawRequestUpdateArgs<ExtArgs>>,
    ): Prisma__WithdrawRequestClient<
      $Result.GetResult<
        Prisma.$WithdrawRequestPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more WithdrawRequests.
     * @param {WithdrawRequestDeleteManyArgs} args - Arguments to filter WithdrawRequests to delete.
     * @example
     * // Delete a few WithdrawRequests
     * const { count } = await prisma.withdrawRequest.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends WithdrawRequestDeleteManyArgs>(
      args?: SelectSubset<T, WithdrawRequestDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more WithdrawRequests.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WithdrawRequestUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many WithdrawRequests
     * const withdrawRequest = await prisma.withdrawRequest.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends WithdrawRequestUpdateManyArgs>(
      args: SelectSubset<T, WithdrawRequestUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more WithdrawRequests and returns the data updated in the database.
     * @param {WithdrawRequestUpdateManyAndReturnArgs} args - Arguments to update many WithdrawRequests.
     * @example
     * // Update many WithdrawRequests
     * const withdrawRequest = await prisma.withdrawRequest.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more WithdrawRequests and only return the `id`
     * const withdrawRequestWithIdOnly = await prisma.withdrawRequest.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends WithdrawRequestUpdateManyAndReturnArgs>(
      args: SelectSubset<T, WithdrawRequestUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$WithdrawRequestPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one WithdrawRequest.
     * @param {WithdrawRequestUpsertArgs} args - Arguments to update or create a WithdrawRequest.
     * @example
     * // Update or create a WithdrawRequest
     * const withdrawRequest = await prisma.withdrawRequest.upsert({
     *   create: {
     *     // ... data to create a WithdrawRequest
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the WithdrawRequest we want to update
     *   }
     * })
     */
    upsert<T extends WithdrawRequestUpsertArgs>(
      args: SelectSubset<T, WithdrawRequestUpsertArgs<ExtArgs>>,
    ): Prisma__WithdrawRequestClient<
      $Result.GetResult<
        Prisma.$WithdrawRequestPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of WithdrawRequests.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WithdrawRequestCountArgs} args - Arguments to filter WithdrawRequests to count.
     * @example
     * // Count the number of WithdrawRequests
     * const count = await prisma.withdrawRequest.count({
     *   where: {
     *     // ... the filter for the WithdrawRequests we want to count
     *   }
     * })
     **/
    count<T extends WithdrawRequestCountArgs>(
      args?: Subset<T, WithdrawRequestCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], WithdrawRequestCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a WithdrawRequest.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WithdrawRequestAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends WithdrawRequestAggregateArgs>(
      args: Subset<T, WithdrawRequestAggregateArgs>,
    ): Prisma.PrismaPromise<GetWithdrawRequestAggregateType<T>>;

    /**
     * Group by WithdrawRequest.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WithdrawRequestGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends WithdrawRequestGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: WithdrawRequestGroupByArgs["orderBy"] }
        : { orderBy?: WithdrawRequestGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, WithdrawRequestGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetWithdrawRequestGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the WithdrawRequest model
     */
    readonly fields: WithdrawRequestFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for WithdrawRequest.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__WithdrawRequestClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    mitra<T extends MitraDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, MitraDefaultArgs<ExtArgs>>,
    ): Prisma__MitraClient<
      | $Result.GetResult<
          Prisma.$MitraPayload<ExtArgs>,
          T,
          "findUniqueOrThrow",
          GlobalOmitOptions
        >
      | Null,
      Null,
      ExtArgs,
      GlobalOmitOptions
    >;
    mitraWallet<T extends WithdrawRequest$mitraWalletArgs<ExtArgs> = {}>(
      args?: Subset<T, WithdrawRequest$mitraWalletArgs<ExtArgs>>,
    ): Prisma__MitraWalletClient<
      $Result.GetResult<
        Prisma.$MitraWalletPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the WithdrawRequest model
   */
  interface WithdrawRequestFieldRefs {
    readonly id: FieldRef<"WithdrawRequest", "String">;
    readonly mitraId: FieldRef<"WithdrawRequest", "String">;
    readonly amount: FieldRef<"WithdrawRequest", "Float">;
    readonly bankName: FieldRef<"WithdrawRequest", "String">;
    readonly bankAccountNo: FieldRef<"WithdrawRequest", "String">;
    readonly bankAccountName: FieldRef<"WithdrawRequest", "String">;
    readonly status: FieldRef<"WithdrawRequest", "WithdrawStatus">;
    readonly method: FieldRef<"WithdrawRequest", "WithdrawMethod">;
    readonly notes: FieldRef<"WithdrawRequest", "String">;
    readonly processedById: FieldRef<"WithdrawRequest", "String">;
    readonly processedAt: FieldRef<"WithdrawRequest", "DateTime">;
    readonly rejectionReason: FieldRef<"WithdrawRequest", "String">;
    readonly createdAt: FieldRef<"WithdrawRequest", "DateTime">;
    readonly updatedAt: FieldRef<"WithdrawRequest", "DateTime">;
    readonly mitraWalletId: FieldRef<"WithdrawRequest", "String">;
    readonly tenantId: FieldRef<"WithdrawRequest", "String">;
  }

  // Custom InputTypes
  /**
   * WithdrawRequest findUnique
   */
  export type WithdrawRequestFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WithdrawRequest
     */
    select?: WithdrawRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WithdrawRequest
     */
    omit?: WithdrawRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WithdrawRequestInclude<ExtArgs> | null;
    /**
     * Filter, which WithdrawRequest to fetch.
     */
    where: WithdrawRequestWhereUniqueInput;
  };

  /**
   * WithdrawRequest findUniqueOrThrow
   */
  export type WithdrawRequestFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WithdrawRequest
     */
    select?: WithdrawRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WithdrawRequest
     */
    omit?: WithdrawRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WithdrawRequestInclude<ExtArgs> | null;
    /**
     * Filter, which WithdrawRequest to fetch.
     */
    where: WithdrawRequestWhereUniqueInput;
  };

  /**
   * WithdrawRequest findFirst
   */
  export type WithdrawRequestFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WithdrawRequest
     */
    select?: WithdrawRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WithdrawRequest
     */
    omit?: WithdrawRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WithdrawRequestInclude<ExtArgs> | null;
    /**
     * Filter, which WithdrawRequest to fetch.
     */
    where?: WithdrawRequestWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of WithdrawRequests to fetch.
     */
    orderBy?:
      | WithdrawRequestOrderByWithRelationInput
      | WithdrawRequestOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for WithdrawRequests.
     */
    cursor?: WithdrawRequestWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` WithdrawRequests from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` WithdrawRequests.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of WithdrawRequests.
     */
    distinct?:
      | WithdrawRequestScalarFieldEnum
      | WithdrawRequestScalarFieldEnum[];
  };

  /**
   * WithdrawRequest findFirstOrThrow
   */
  export type WithdrawRequestFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WithdrawRequest
     */
    select?: WithdrawRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WithdrawRequest
     */
    omit?: WithdrawRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WithdrawRequestInclude<ExtArgs> | null;
    /**
     * Filter, which WithdrawRequest to fetch.
     */
    where?: WithdrawRequestWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of WithdrawRequests to fetch.
     */
    orderBy?:
      | WithdrawRequestOrderByWithRelationInput
      | WithdrawRequestOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for WithdrawRequests.
     */
    cursor?: WithdrawRequestWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` WithdrawRequests from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` WithdrawRequests.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of WithdrawRequests.
     */
    distinct?:
      | WithdrawRequestScalarFieldEnum
      | WithdrawRequestScalarFieldEnum[];
  };

  /**
   * WithdrawRequest findMany
   */
  export type WithdrawRequestFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WithdrawRequest
     */
    select?: WithdrawRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WithdrawRequest
     */
    omit?: WithdrawRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WithdrawRequestInclude<ExtArgs> | null;
    /**
     * Filter, which WithdrawRequests to fetch.
     */
    where?: WithdrawRequestWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of WithdrawRequests to fetch.
     */
    orderBy?:
      | WithdrawRequestOrderByWithRelationInput
      | WithdrawRequestOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing WithdrawRequests.
     */
    cursor?: WithdrawRequestWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` WithdrawRequests from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` WithdrawRequests.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of WithdrawRequests.
     */
    distinct?:
      | WithdrawRequestScalarFieldEnum
      | WithdrawRequestScalarFieldEnum[];
  };

  /**
   * WithdrawRequest create
   */
  export type WithdrawRequestCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WithdrawRequest
     */
    select?: WithdrawRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WithdrawRequest
     */
    omit?: WithdrawRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WithdrawRequestInclude<ExtArgs> | null;
    /**
     * The data needed to create a WithdrawRequest.
     */
    data: XOR<WithdrawRequestCreateInput, WithdrawRequestUncheckedCreateInput>;
  };

  /**
   * WithdrawRequest createMany
   */
  export type WithdrawRequestCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many WithdrawRequests.
     */
    data: WithdrawRequestCreateManyInput | WithdrawRequestCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * WithdrawRequest createManyAndReturn
   */
  export type WithdrawRequestCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WithdrawRequest
     */
    select?: WithdrawRequestSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the WithdrawRequest
     */
    omit?: WithdrawRequestOmit<ExtArgs> | null;
    /**
     * The data used to create many WithdrawRequests.
     */
    data: WithdrawRequestCreateManyInput | WithdrawRequestCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WithdrawRequestIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * WithdrawRequest update
   */
  export type WithdrawRequestUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WithdrawRequest
     */
    select?: WithdrawRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WithdrawRequest
     */
    omit?: WithdrawRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WithdrawRequestInclude<ExtArgs> | null;
    /**
     * The data needed to update a WithdrawRequest.
     */
    data: XOR<WithdrawRequestUpdateInput, WithdrawRequestUncheckedUpdateInput>;
    /**
     * Choose, which WithdrawRequest to update.
     */
    where: WithdrawRequestWhereUniqueInput;
  };

  /**
   * WithdrawRequest updateMany
   */
  export type WithdrawRequestUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update WithdrawRequests.
     */
    data: XOR<
      WithdrawRequestUpdateManyMutationInput,
      WithdrawRequestUncheckedUpdateManyInput
    >;
    /**
     * Filter which WithdrawRequests to update
     */
    where?: WithdrawRequestWhereInput;
    /**
     * Limit how many WithdrawRequests to update.
     */
    limit?: number;
  };

  /**
   * WithdrawRequest updateManyAndReturn
   */
  export type WithdrawRequestUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WithdrawRequest
     */
    select?: WithdrawRequestSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the WithdrawRequest
     */
    omit?: WithdrawRequestOmit<ExtArgs> | null;
    /**
     * The data used to update WithdrawRequests.
     */
    data: XOR<
      WithdrawRequestUpdateManyMutationInput,
      WithdrawRequestUncheckedUpdateManyInput
    >;
    /**
     * Filter which WithdrawRequests to update
     */
    where?: WithdrawRequestWhereInput;
    /**
     * Limit how many WithdrawRequests to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WithdrawRequestIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * WithdrawRequest upsert
   */
  export type WithdrawRequestUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WithdrawRequest
     */
    select?: WithdrawRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WithdrawRequest
     */
    omit?: WithdrawRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WithdrawRequestInclude<ExtArgs> | null;
    /**
     * The filter to search for the WithdrawRequest to update in case it exists.
     */
    where: WithdrawRequestWhereUniqueInput;
    /**
     * In case the WithdrawRequest found by the `where` argument doesn't exist, create a new WithdrawRequest with this data.
     */
    create: XOR<
      WithdrawRequestCreateInput,
      WithdrawRequestUncheckedCreateInput
    >;
    /**
     * In case the WithdrawRequest was found with the provided `where` argument, update it with this data.
     */
    update: XOR<
      WithdrawRequestUpdateInput,
      WithdrawRequestUncheckedUpdateInput
    >;
  };

  /**
   * WithdrawRequest delete
   */
  export type WithdrawRequestDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WithdrawRequest
     */
    select?: WithdrawRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WithdrawRequest
     */
    omit?: WithdrawRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WithdrawRequestInclude<ExtArgs> | null;
    /**
     * Filter which WithdrawRequest to delete.
     */
    where: WithdrawRequestWhereUniqueInput;
  };

  /**
   * WithdrawRequest deleteMany
   */
  export type WithdrawRequestDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which WithdrawRequests to delete
     */
    where?: WithdrawRequestWhereInput;
    /**
     * Limit how many WithdrawRequests to delete.
     */
    limit?: number;
  };

  /**
   * WithdrawRequest.mitraWallet
   */
  export type WithdrawRequest$mitraWalletArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the MitraWallet
     */
    select?: MitraWalletSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the MitraWallet
     */
    omit?: MitraWalletOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MitraWalletInclude<ExtArgs> | null;
    where?: MitraWalletWhereInput;
  };

  /**
   * WithdrawRequest without action
   */
  export type WithdrawRequestDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WithdrawRequest
     */
    select?: WithdrawRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WithdrawRequest
     */
    omit?: WithdrawRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WithdrawRequestInclude<ExtArgs> | null;
  };

  /**
   * Model FaceVerificationLog
   */

  export type AggregateFaceVerificationLog = {
    _count: FaceVerificationLogCountAggregateOutputType | null;
    _avg: FaceVerificationLogAvgAggregateOutputType | null;
    _sum: FaceVerificationLogSumAggregateOutputType | null;
    _min: FaceVerificationLogMinAggregateOutputType | null;
    _max: FaceVerificationLogMaxAggregateOutputType | null;
  };

  export type FaceVerificationLogAvgAggregateOutputType = {
    latitude: number | null;
    longitude: number | null;
  };

  export type FaceVerificationLogSumAggregateOutputType = {
    latitude: number | null;
    longitude: number | null;
  };

  export type FaceVerificationLogMinAggregateOutputType = {
    id: string | null;
    mitraId: string | null;
    photoUrl: string | null;
    latitude: number | null;
    longitude: number | null;
    deviceInfo: string | null;
    createdAt: Date | null;
    tenantId: string | null;
  };

  export type FaceVerificationLogMaxAggregateOutputType = {
    id: string | null;
    mitraId: string | null;
    photoUrl: string | null;
    latitude: number | null;
    longitude: number | null;
    deviceInfo: string | null;
    createdAt: Date | null;
    tenantId: string | null;
  };

  export type FaceVerificationLogCountAggregateOutputType = {
    id: number;
    mitraId: number;
    photoUrl: number;
    latitude: number;
    longitude: number;
    deviceInfo: number;
    createdAt: number;
    tenantId: number;
    _all: number;
  };

  export type FaceVerificationLogAvgAggregateInputType = {
    latitude?: true;
    longitude?: true;
  };

  export type FaceVerificationLogSumAggregateInputType = {
    latitude?: true;
    longitude?: true;
  };

  export type FaceVerificationLogMinAggregateInputType = {
    id?: true;
    mitraId?: true;
    photoUrl?: true;
    latitude?: true;
    longitude?: true;
    deviceInfo?: true;
    createdAt?: true;
    tenantId?: true;
  };

  export type FaceVerificationLogMaxAggregateInputType = {
    id?: true;
    mitraId?: true;
    photoUrl?: true;
    latitude?: true;
    longitude?: true;
    deviceInfo?: true;
    createdAt?: true;
    tenantId?: true;
  };

  export type FaceVerificationLogCountAggregateInputType = {
    id?: true;
    mitraId?: true;
    photoUrl?: true;
    latitude?: true;
    longitude?: true;
    deviceInfo?: true;
    createdAt?: true;
    tenantId?: true;
    _all?: true;
  };

  export type FaceVerificationLogAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which FaceVerificationLog to aggregate.
     */
    where?: FaceVerificationLogWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of FaceVerificationLogs to fetch.
     */
    orderBy?:
      | FaceVerificationLogOrderByWithRelationInput
      | FaceVerificationLogOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: FaceVerificationLogWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` FaceVerificationLogs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` FaceVerificationLogs.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned FaceVerificationLogs
     **/
    _count?: true | FaceVerificationLogCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: FaceVerificationLogAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: FaceVerificationLogSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: FaceVerificationLogMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: FaceVerificationLogMaxAggregateInputType;
  };

  export type GetFaceVerificationLogAggregateType<
    T extends FaceVerificationLogAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateFaceVerificationLog]: P extends
      | "_count"
      | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateFaceVerificationLog[P]>
      : GetScalarType<T[P], AggregateFaceVerificationLog[P]>;
  };

  export type FaceVerificationLogGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: FaceVerificationLogWhereInput;
    orderBy?:
      | FaceVerificationLogOrderByWithAggregationInput
      | FaceVerificationLogOrderByWithAggregationInput[];
    by:
      | FaceVerificationLogScalarFieldEnum[]
      | FaceVerificationLogScalarFieldEnum;
    having?: FaceVerificationLogScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: FaceVerificationLogCountAggregateInputType | true;
    _avg?: FaceVerificationLogAvgAggregateInputType;
    _sum?: FaceVerificationLogSumAggregateInputType;
    _min?: FaceVerificationLogMinAggregateInputType;
    _max?: FaceVerificationLogMaxAggregateInputType;
  };

  export type FaceVerificationLogGroupByOutputType = {
    id: string;
    mitraId: string;
    photoUrl: string;
    latitude: number | null;
    longitude: number | null;
    deviceInfo: string | null;
    createdAt: Date;
    tenantId: string | null;
    _count: FaceVerificationLogCountAggregateOutputType | null;
    _avg: FaceVerificationLogAvgAggregateOutputType | null;
    _sum: FaceVerificationLogSumAggregateOutputType | null;
    _min: FaceVerificationLogMinAggregateOutputType | null;
    _max: FaceVerificationLogMaxAggregateOutputType | null;
  };

  type GetFaceVerificationLogGroupByPayload<
    T extends FaceVerificationLogGroupByArgs,
  > = Prisma.PrismaPromise<
    Array<
      PickEnumerable<FaceVerificationLogGroupByOutputType, T["by"]> & {
        [P in keyof T &
          keyof FaceVerificationLogGroupByOutputType]: P extends "_count"
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], FaceVerificationLogGroupByOutputType[P]>
          : GetScalarType<T[P], FaceVerificationLogGroupByOutputType[P]>;
      }
    >
  >;

  export type FaceVerificationLogSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      mitraId?: boolean;
      photoUrl?: boolean;
      latitude?: boolean;
      longitude?: boolean;
      deviceInfo?: boolean;
      createdAt?: boolean;
      tenantId?: boolean;
      mitra?: boolean | MitraDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["faceVerificationLog"]
  >;

  export type FaceVerificationLogSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      mitraId?: boolean;
      photoUrl?: boolean;
      latitude?: boolean;
      longitude?: boolean;
      deviceInfo?: boolean;
      createdAt?: boolean;
      tenantId?: boolean;
      mitra?: boolean | MitraDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["faceVerificationLog"]
  >;

  export type FaceVerificationLogSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      mitraId?: boolean;
      photoUrl?: boolean;
      latitude?: boolean;
      longitude?: boolean;
      deviceInfo?: boolean;
      createdAt?: boolean;
      tenantId?: boolean;
      mitra?: boolean | MitraDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["faceVerificationLog"]
  >;

  export type FaceVerificationLogSelectScalar = {
    id?: boolean;
    mitraId?: boolean;
    photoUrl?: boolean;
    latitude?: boolean;
    longitude?: boolean;
    deviceInfo?: boolean;
    createdAt?: boolean;
    tenantId?: boolean;
  };

  export type FaceVerificationLogOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "mitraId"
    | "photoUrl"
    | "latitude"
    | "longitude"
    | "deviceInfo"
    | "createdAt"
    | "tenantId",
    ExtArgs["result"]["faceVerificationLog"]
  >;
  export type FaceVerificationLogInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    mitra?: boolean | MitraDefaultArgs<ExtArgs>;
  };
  export type FaceVerificationLogIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    mitra?: boolean | MitraDefaultArgs<ExtArgs>;
  };
  export type FaceVerificationLogIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    mitra?: boolean | MitraDefaultArgs<ExtArgs>;
  };

  export type $FaceVerificationLogPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "FaceVerificationLog";
    objects: {
      mitra: Prisma.$MitraPayload<ExtArgs>;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        mitraId: string;
        photoUrl: string;
        latitude: number | null;
        longitude: number | null;
        deviceInfo: string | null;
        createdAt: Date;
        tenantId: string | null;
      },
      ExtArgs["result"]["faceVerificationLog"]
    >;
    composites: {};
  };

  type FaceVerificationLogGetPayload<
    S extends boolean | null | undefined | FaceVerificationLogDefaultArgs,
  > = $Result.GetResult<Prisma.$FaceVerificationLogPayload, S>;

  type FaceVerificationLogCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    FaceVerificationLogFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: FaceVerificationLogCountAggregateInputType | true;
  };

  export interface FaceVerificationLogDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["FaceVerificationLog"];
      meta: { name: "FaceVerificationLog" };
    };
    /**
     * Find zero or one FaceVerificationLog that matches the filter.
     * @param {FaceVerificationLogFindUniqueArgs} args - Arguments to find a FaceVerificationLog
     * @example
     * // Get one FaceVerificationLog
     * const faceVerificationLog = await prisma.faceVerificationLog.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends FaceVerificationLogFindUniqueArgs>(
      args: SelectSubset<T, FaceVerificationLogFindUniqueArgs<ExtArgs>>,
    ): Prisma__FaceVerificationLogClient<
      $Result.GetResult<
        Prisma.$FaceVerificationLogPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one FaceVerificationLog that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {FaceVerificationLogFindUniqueOrThrowArgs} args - Arguments to find a FaceVerificationLog
     * @example
     * // Get one FaceVerificationLog
     * const faceVerificationLog = await prisma.faceVerificationLog.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends FaceVerificationLogFindUniqueOrThrowArgs>(
      args: SelectSubset<T, FaceVerificationLogFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__FaceVerificationLogClient<
      $Result.GetResult<
        Prisma.$FaceVerificationLogPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first FaceVerificationLog that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FaceVerificationLogFindFirstArgs} args - Arguments to find a FaceVerificationLog
     * @example
     * // Get one FaceVerificationLog
     * const faceVerificationLog = await prisma.faceVerificationLog.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends FaceVerificationLogFindFirstArgs>(
      args?: SelectSubset<T, FaceVerificationLogFindFirstArgs<ExtArgs>>,
    ): Prisma__FaceVerificationLogClient<
      $Result.GetResult<
        Prisma.$FaceVerificationLogPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first FaceVerificationLog that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FaceVerificationLogFindFirstOrThrowArgs} args - Arguments to find a FaceVerificationLog
     * @example
     * // Get one FaceVerificationLog
     * const faceVerificationLog = await prisma.faceVerificationLog.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends FaceVerificationLogFindFirstOrThrowArgs>(
      args?: SelectSubset<T, FaceVerificationLogFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__FaceVerificationLogClient<
      $Result.GetResult<
        Prisma.$FaceVerificationLogPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more FaceVerificationLogs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FaceVerificationLogFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all FaceVerificationLogs
     * const faceVerificationLogs = await prisma.faceVerificationLog.findMany()
     *
     * // Get first 10 FaceVerificationLogs
     * const faceVerificationLogs = await prisma.faceVerificationLog.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const faceVerificationLogWithIdOnly = await prisma.faceVerificationLog.findMany({ select: { id: true } })
     *
     */
    findMany<T extends FaceVerificationLogFindManyArgs>(
      args?: SelectSubset<T, FaceVerificationLogFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$FaceVerificationLogPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a FaceVerificationLog.
     * @param {FaceVerificationLogCreateArgs} args - Arguments to create a FaceVerificationLog.
     * @example
     * // Create one FaceVerificationLog
     * const FaceVerificationLog = await prisma.faceVerificationLog.create({
     *   data: {
     *     // ... data to create a FaceVerificationLog
     *   }
     * })
     *
     */
    create<T extends FaceVerificationLogCreateArgs>(
      args: SelectSubset<T, FaceVerificationLogCreateArgs<ExtArgs>>,
    ): Prisma__FaceVerificationLogClient<
      $Result.GetResult<
        Prisma.$FaceVerificationLogPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many FaceVerificationLogs.
     * @param {FaceVerificationLogCreateManyArgs} args - Arguments to create many FaceVerificationLogs.
     * @example
     * // Create many FaceVerificationLogs
     * const faceVerificationLog = await prisma.faceVerificationLog.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends FaceVerificationLogCreateManyArgs>(
      args?: SelectSubset<T, FaceVerificationLogCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many FaceVerificationLogs and returns the data saved in the database.
     * @param {FaceVerificationLogCreateManyAndReturnArgs} args - Arguments to create many FaceVerificationLogs.
     * @example
     * // Create many FaceVerificationLogs
     * const faceVerificationLog = await prisma.faceVerificationLog.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many FaceVerificationLogs and only return the `id`
     * const faceVerificationLogWithIdOnly = await prisma.faceVerificationLog.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends FaceVerificationLogCreateManyAndReturnArgs>(
      args?: SelectSubset<
        T,
        FaceVerificationLogCreateManyAndReturnArgs<ExtArgs>
      >,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$FaceVerificationLogPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a FaceVerificationLog.
     * @param {FaceVerificationLogDeleteArgs} args - Arguments to delete one FaceVerificationLog.
     * @example
     * // Delete one FaceVerificationLog
     * const FaceVerificationLog = await prisma.faceVerificationLog.delete({
     *   where: {
     *     // ... filter to delete one FaceVerificationLog
     *   }
     * })
     *
     */
    delete<T extends FaceVerificationLogDeleteArgs>(
      args: SelectSubset<T, FaceVerificationLogDeleteArgs<ExtArgs>>,
    ): Prisma__FaceVerificationLogClient<
      $Result.GetResult<
        Prisma.$FaceVerificationLogPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one FaceVerificationLog.
     * @param {FaceVerificationLogUpdateArgs} args - Arguments to update one FaceVerificationLog.
     * @example
     * // Update one FaceVerificationLog
     * const faceVerificationLog = await prisma.faceVerificationLog.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends FaceVerificationLogUpdateArgs>(
      args: SelectSubset<T, FaceVerificationLogUpdateArgs<ExtArgs>>,
    ): Prisma__FaceVerificationLogClient<
      $Result.GetResult<
        Prisma.$FaceVerificationLogPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more FaceVerificationLogs.
     * @param {FaceVerificationLogDeleteManyArgs} args - Arguments to filter FaceVerificationLogs to delete.
     * @example
     * // Delete a few FaceVerificationLogs
     * const { count } = await prisma.faceVerificationLog.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends FaceVerificationLogDeleteManyArgs>(
      args?: SelectSubset<T, FaceVerificationLogDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more FaceVerificationLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FaceVerificationLogUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many FaceVerificationLogs
     * const faceVerificationLog = await prisma.faceVerificationLog.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends FaceVerificationLogUpdateManyArgs>(
      args: SelectSubset<T, FaceVerificationLogUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more FaceVerificationLogs and returns the data updated in the database.
     * @param {FaceVerificationLogUpdateManyAndReturnArgs} args - Arguments to update many FaceVerificationLogs.
     * @example
     * // Update many FaceVerificationLogs
     * const faceVerificationLog = await prisma.faceVerificationLog.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more FaceVerificationLogs and only return the `id`
     * const faceVerificationLogWithIdOnly = await prisma.faceVerificationLog.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends FaceVerificationLogUpdateManyAndReturnArgs>(
      args: SelectSubset<
        T,
        FaceVerificationLogUpdateManyAndReturnArgs<ExtArgs>
      >,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$FaceVerificationLogPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one FaceVerificationLog.
     * @param {FaceVerificationLogUpsertArgs} args - Arguments to update or create a FaceVerificationLog.
     * @example
     * // Update or create a FaceVerificationLog
     * const faceVerificationLog = await prisma.faceVerificationLog.upsert({
     *   create: {
     *     // ... data to create a FaceVerificationLog
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the FaceVerificationLog we want to update
     *   }
     * })
     */
    upsert<T extends FaceVerificationLogUpsertArgs>(
      args: SelectSubset<T, FaceVerificationLogUpsertArgs<ExtArgs>>,
    ): Prisma__FaceVerificationLogClient<
      $Result.GetResult<
        Prisma.$FaceVerificationLogPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of FaceVerificationLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FaceVerificationLogCountArgs} args - Arguments to filter FaceVerificationLogs to count.
     * @example
     * // Count the number of FaceVerificationLogs
     * const count = await prisma.faceVerificationLog.count({
     *   where: {
     *     // ... the filter for the FaceVerificationLogs we want to count
     *   }
     * })
     **/
    count<T extends FaceVerificationLogCountArgs>(
      args?: Subset<T, FaceVerificationLogCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<
              T["select"],
              FaceVerificationLogCountAggregateOutputType
            >
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a FaceVerificationLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FaceVerificationLogAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends FaceVerificationLogAggregateArgs>(
      args: Subset<T, FaceVerificationLogAggregateArgs>,
    ): Prisma.PrismaPromise<GetFaceVerificationLogAggregateType<T>>;

    /**
     * Group by FaceVerificationLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FaceVerificationLogGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends FaceVerificationLogGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: FaceVerificationLogGroupByArgs["orderBy"] }
        : { orderBy?: FaceVerificationLogGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, FaceVerificationLogGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetFaceVerificationLogGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the FaceVerificationLog model
     */
    readonly fields: FaceVerificationLogFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for FaceVerificationLog.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__FaceVerificationLogClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    mitra<T extends MitraDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, MitraDefaultArgs<ExtArgs>>,
    ): Prisma__MitraClient<
      | $Result.GetResult<
          Prisma.$MitraPayload<ExtArgs>,
          T,
          "findUniqueOrThrow",
          GlobalOmitOptions
        >
      | Null,
      Null,
      ExtArgs,
      GlobalOmitOptions
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the FaceVerificationLog model
   */
  interface FaceVerificationLogFieldRefs {
    readonly id: FieldRef<"FaceVerificationLog", "String">;
    readonly mitraId: FieldRef<"FaceVerificationLog", "String">;
    readonly photoUrl: FieldRef<"FaceVerificationLog", "String">;
    readonly latitude: FieldRef<"FaceVerificationLog", "Float">;
    readonly longitude: FieldRef<"FaceVerificationLog", "Float">;
    readonly deviceInfo: FieldRef<"FaceVerificationLog", "String">;
    readonly createdAt: FieldRef<"FaceVerificationLog", "DateTime">;
    readonly tenantId: FieldRef<"FaceVerificationLog", "String">;
  }

  // Custom InputTypes
  /**
   * FaceVerificationLog findUnique
   */
  export type FaceVerificationLogFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FaceVerificationLog
     */
    select?: FaceVerificationLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FaceVerificationLog
     */
    omit?: FaceVerificationLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FaceVerificationLogInclude<ExtArgs> | null;
    /**
     * Filter, which FaceVerificationLog to fetch.
     */
    where: FaceVerificationLogWhereUniqueInput;
  };

  /**
   * FaceVerificationLog findUniqueOrThrow
   */
  export type FaceVerificationLogFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FaceVerificationLog
     */
    select?: FaceVerificationLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FaceVerificationLog
     */
    omit?: FaceVerificationLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FaceVerificationLogInclude<ExtArgs> | null;
    /**
     * Filter, which FaceVerificationLog to fetch.
     */
    where: FaceVerificationLogWhereUniqueInput;
  };

  /**
   * FaceVerificationLog findFirst
   */
  export type FaceVerificationLogFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FaceVerificationLog
     */
    select?: FaceVerificationLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FaceVerificationLog
     */
    omit?: FaceVerificationLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FaceVerificationLogInclude<ExtArgs> | null;
    /**
     * Filter, which FaceVerificationLog to fetch.
     */
    where?: FaceVerificationLogWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of FaceVerificationLogs to fetch.
     */
    orderBy?:
      | FaceVerificationLogOrderByWithRelationInput
      | FaceVerificationLogOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for FaceVerificationLogs.
     */
    cursor?: FaceVerificationLogWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` FaceVerificationLogs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` FaceVerificationLogs.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of FaceVerificationLogs.
     */
    distinct?:
      | FaceVerificationLogScalarFieldEnum
      | FaceVerificationLogScalarFieldEnum[];
  };

  /**
   * FaceVerificationLog findFirstOrThrow
   */
  export type FaceVerificationLogFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FaceVerificationLog
     */
    select?: FaceVerificationLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FaceVerificationLog
     */
    omit?: FaceVerificationLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FaceVerificationLogInclude<ExtArgs> | null;
    /**
     * Filter, which FaceVerificationLog to fetch.
     */
    where?: FaceVerificationLogWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of FaceVerificationLogs to fetch.
     */
    orderBy?:
      | FaceVerificationLogOrderByWithRelationInput
      | FaceVerificationLogOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for FaceVerificationLogs.
     */
    cursor?: FaceVerificationLogWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` FaceVerificationLogs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` FaceVerificationLogs.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of FaceVerificationLogs.
     */
    distinct?:
      | FaceVerificationLogScalarFieldEnum
      | FaceVerificationLogScalarFieldEnum[];
  };

  /**
   * FaceVerificationLog findMany
   */
  export type FaceVerificationLogFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FaceVerificationLog
     */
    select?: FaceVerificationLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FaceVerificationLog
     */
    omit?: FaceVerificationLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FaceVerificationLogInclude<ExtArgs> | null;
    /**
     * Filter, which FaceVerificationLogs to fetch.
     */
    where?: FaceVerificationLogWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of FaceVerificationLogs to fetch.
     */
    orderBy?:
      | FaceVerificationLogOrderByWithRelationInput
      | FaceVerificationLogOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing FaceVerificationLogs.
     */
    cursor?: FaceVerificationLogWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` FaceVerificationLogs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` FaceVerificationLogs.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of FaceVerificationLogs.
     */
    distinct?:
      | FaceVerificationLogScalarFieldEnum
      | FaceVerificationLogScalarFieldEnum[];
  };

  /**
   * FaceVerificationLog create
   */
  export type FaceVerificationLogCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FaceVerificationLog
     */
    select?: FaceVerificationLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FaceVerificationLog
     */
    omit?: FaceVerificationLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FaceVerificationLogInclude<ExtArgs> | null;
    /**
     * The data needed to create a FaceVerificationLog.
     */
    data: XOR<
      FaceVerificationLogCreateInput,
      FaceVerificationLogUncheckedCreateInput
    >;
  };

  /**
   * FaceVerificationLog createMany
   */
  export type FaceVerificationLogCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many FaceVerificationLogs.
     */
    data:
      | FaceVerificationLogCreateManyInput
      | FaceVerificationLogCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * FaceVerificationLog createManyAndReturn
   */
  export type FaceVerificationLogCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FaceVerificationLog
     */
    select?: FaceVerificationLogSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the FaceVerificationLog
     */
    omit?: FaceVerificationLogOmit<ExtArgs> | null;
    /**
     * The data used to create many FaceVerificationLogs.
     */
    data:
      | FaceVerificationLogCreateManyInput
      | FaceVerificationLogCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FaceVerificationLogIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * FaceVerificationLog update
   */
  export type FaceVerificationLogUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FaceVerificationLog
     */
    select?: FaceVerificationLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FaceVerificationLog
     */
    omit?: FaceVerificationLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FaceVerificationLogInclude<ExtArgs> | null;
    /**
     * The data needed to update a FaceVerificationLog.
     */
    data: XOR<
      FaceVerificationLogUpdateInput,
      FaceVerificationLogUncheckedUpdateInput
    >;
    /**
     * Choose, which FaceVerificationLog to update.
     */
    where: FaceVerificationLogWhereUniqueInput;
  };

  /**
   * FaceVerificationLog updateMany
   */
  export type FaceVerificationLogUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update FaceVerificationLogs.
     */
    data: XOR<
      FaceVerificationLogUpdateManyMutationInput,
      FaceVerificationLogUncheckedUpdateManyInput
    >;
    /**
     * Filter which FaceVerificationLogs to update
     */
    where?: FaceVerificationLogWhereInput;
    /**
     * Limit how many FaceVerificationLogs to update.
     */
    limit?: number;
  };

  /**
   * FaceVerificationLog updateManyAndReturn
   */
  export type FaceVerificationLogUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FaceVerificationLog
     */
    select?: FaceVerificationLogSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the FaceVerificationLog
     */
    omit?: FaceVerificationLogOmit<ExtArgs> | null;
    /**
     * The data used to update FaceVerificationLogs.
     */
    data: XOR<
      FaceVerificationLogUpdateManyMutationInput,
      FaceVerificationLogUncheckedUpdateManyInput
    >;
    /**
     * Filter which FaceVerificationLogs to update
     */
    where?: FaceVerificationLogWhereInput;
    /**
     * Limit how many FaceVerificationLogs to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FaceVerificationLogIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * FaceVerificationLog upsert
   */
  export type FaceVerificationLogUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FaceVerificationLog
     */
    select?: FaceVerificationLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FaceVerificationLog
     */
    omit?: FaceVerificationLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FaceVerificationLogInclude<ExtArgs> | null;
    /**
     * The filter to search for the FaceVerificationLog to update in case it exists.
     */
    where: FaceVerificationLogWhereUniqueInput;
    /**
     * In case the FaceVerificationLog found by the `where` argument doesn't exist, create a new FaceVerificationLog with this data.
     */
    create: XOR<
      FaceVerificationLogCreateInput,
      FaceVerificationLogUncheckedCreateInput
    >;
    /**
     * In case the FaceVerificationLog was found with the provided `where` argument, update it with this data.
     */
    update: XOR<
      FaceVerificationLogUpdateInput,
      FaceVerificationLogUncheckedUpdateInput
    >;
  };

  /**
   * FaceVerificationLog delete
   */
  export type FaceVerificationLogDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FaceVerificationLog
     */
    select?: FaceVerificationLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FaceVerificationLog
     */
    omit?: FaceVerificationLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FaceVerificationLogInclude<ExtArgs> | null;
    /**
     * Filter which FaceVerificationLog to delete.
     */
    where: FaceVerificationLogWhereUniqueInput;
  };

  /**
   * FaceVerificationLog deleteMany
   */
  export type FaceVerificationLogDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which FaceVerificationLogs to delete
     */
    where?: FaceVerificationLogWhereInput;
    /**
     * Limit how many FaceVerificationLogs to delete.
     */
    limit?: number;
  };

  /**
   * FaceVerificationLog without action
   */
  export type FaceVerificationLogDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FaceVerificationLog
     */
    select?: FaceVerificationLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FaceVerificationLog
     */
    omit?: FaceVerificationLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FaceVerificationLogInclude<ExtArgs> | null;
  };

  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: "ReadUncommitted";
    ReadCommitted: "ReadCommitted";
    RepeatableRead: "RepeatableRead";
    Serializable: "Serializable";
  };

  export type TransactionIsolationLevel =
    (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel];

  export const MitraScalarFieldEnum: {
    id: "id";
    name: "name";
    email: "email";
    passwordHash: "passwordHash";
    phone: "phone";
    isActive: "isActive";
    siteId: "siteId";
    mitraType: "mitraType";
    pushToken: "pushToken";
    pushTokenUpdatedAt: "pushTokenUpdatedAt";
    fcmTokens: "fcmTokens";
    lastVersionCode: "lastVersionCode";
    lastVersionName: "lastVersionName";
    lastVersionUpdate: "lastVersionUpdate";
    tokenVersion: "tokenVersion";
    mitraRateWoPsb: "mitraRateWoPsb";
    mitraRateWoMaintenance: "mitraRateWoMaintenance";
    mitraRateCanvasing: "mitraRateCanvasing";
    bankName: "bankName";
    bankAccountNo: "bankAccountNo";
    bankAccountName: "bankAccountName";
    targetHarian: "targetHarian";
    minWithdrawal: "minWithdrawal";
    nik: "nik";
    tempatLahir: "tempatLahir";
    tanggalLahir: "tanggalLahir";
    alamat: "alamat";
    latitudeRumah: "latitudeRumah";
    longitudeRumah: "longitudeRumah";
    fotoDiri: "fotoDiri";
    fotoKtp: "fotoKtp";
    fotoSim: "fotoSim";
    fotoKk: "fotoKk";
    requiresFaceVerification: "requiresFaceVerification";
    lastFaceVerification: "lastFaceVerification";
    garansiHari: "garansiHari";
    slaGaransiJam: "slaGaransiJam";
    penaltyPsb: "penaltyPsb";
    penaltyMaintenance: "penaltyMaintenance";
    createdAt: "createdAt";
    updatedAt: "updatedAt";
    tenantId: "tenantId";
  };

  export type MitraScalarFieldEnum =
    (typeof MitraScalarFieldEnum)[keyof typeof MitraScalarFieldEnum];

  export const MitraWalletScalarFieldEnum: {
    id: "id";
    mitraId: "mitraId";
    balance: "balance";
    totalEarnings: "totalEarnings";
    totalWithdrawn: "totalWithdrawn";
    currency: "currency";
    createdAt: "createdAt";
    updatedAt: "updatedAt";
    tenantId: "tenantId";
  };

  export type MitraWalletScalarFieldEnum =
    (typeof MitraWalletScalarFieldEnum)[keyof typeof MitraWalletScalarFieldEnum];

  export const MitraTransactionScalarFieldEnum: {
    id: "id";
    walletId: "walletId";
    amount: "amount";
    type: "type";
    description: "description";
    referenceId: "referenceId";
    referenceType: "referenceType";
    createdAt: "createdAt";
    tenantId: "tenantId";
  };

  export type MitraTransactionScalarFieldEnum =
    (typeof MitraTransactionScalarFieldEnum)[keyof typeof MitraTransactionScalarFieldEnum];

  export const WithdrawRequestScalarFieldEnum: {
    id: "id";
    mitraId: "mitraId";
    amount: "amount";
    bankName: "bankName";
    bankAccountNo: "bankAccountNo";
    bankAccountName: "bankAccountName";
    status: "status";
    method: "method";
    notes: "notes";
    processedById: "processedById";
    processedAt: "processedAt";
    rejectionReason: "rejectionReason";
    createdAt: "createdAt";
    updatedAt: "updatedAt";
    mitraWalletId: "mitraWalletId";
    tenantId: "tenantId";
  };

  export type WithdrawRequestScalarFieldEnum =
    (typeof WithdrawRequestScalarFieldEnum)[keyof typeof WithdrawRequestScalarFieldEnum];

  export const FaceVerificationLogScalarFieldEnum: {
    id: "id";
    mitraId: "mitraId";
    photoUrl: "photoUrl";
    latitude: "latitude";
    longitude: "longitude";
    deviceInfo: "deviceInfo";
    createdAt: "createdAt";
    tenantId: "tenantId";
  };

  export type FaceVerificationLogScalarFieldEnum =
    (typeof FaceVerificationLogScalarFieldEnum)[keyof typeof FaceVerificationLogScalarFieldEnum];

  export const SortOrder: {
    asc: "asc";
    desc: "desc";
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

  export const QueryMode: {
    default: "default";
    insensitive: "insensitive";
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode];

  export const NullsOrder: {
    first: "first";
    last: "last";
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder];

  /**
   * Field references
   */

  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "String"
  >;

  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "String[]"
  >;

  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Boolean"
  >;

  /**
   * Reference to a field of type 'MitraType'
   */
  export type EnumMitraTypeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "MitraType"
  >;

  /**
   * Reference to a field of type 'MitraType[]'
   */
  export type ListEnumMitraTypeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "MitraType[]"
  >;

  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "DateTime"
  >;

  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "DateTime[]"
  >;

  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Int"
  >;

  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Int[]"
  >;

  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Float"
  >;

  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Float[]"
  >;

  /**
   * Reference to a field of type 'Decimal'
   */
  export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Decimal"
  >;

  /**
   * Reference to a field of type 'Decimal[]'
   */
  export type ListDecimalFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Decimal[]"
  >;

  /**
   * Reference to a field of type 'MitraTransactionType'
   */
  export type EnumMitraTransactionTypeFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "MitraTransactionType">;

  /**
   * Reference to a field of type 'MitraTransactionType[]'
   */
  export type ListEnumMitraTransactionTypeFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "MitraTransactionType[]">;

  /**
   * Reference to a field of type 'WithdrawStatus'
   */
  export type EnumWithdrawStatusFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "WithdrawStatus"
  >;

  /**
   * Reference to a field of type 'WithdrawStatus[]'
   */
  export type ListEnumWithdrawStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "WithdrawStatus[]">;

  /**
   * Reference to a field of type 'WithdrawMethod'
   */
  export type EnumWithdrawMethodFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "WithdrawMethod"
  >;

  /**
   * Reference to a field of type 'WithdrawMethod[]'
   */
  export type ListEnumWithdrawMethodFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "WithdrawMethod[]">;

  /**
   * Deep Input Types
   */

  export type MitraWhereInput = {
    AND?: MitraWhereInput | MitraWhereInput[];
    OR?: MitraWhereInput[];
    NOT?: MitraWhereInput | MitraWhereInput[];
    id?: StringFilter<"Mitra"> | string;
    name?: StringFilter<"Mitra"> | string;
    email?: StringFilter<"Mitra"> | string;
    passwordHash?: StringNullableFilter<"Mitra"> | string | null;
    phone?: StringNullableFilter<"Mitra"> | string | null;
    isActive?: BoolFilter<"Mitra"> | boolean;
    siteId?: StringNullableFilter<"Mitra"> | string | null;
    mitraType?: EnumMitraTypeFilter<"Mitra"> | $Enums.MitraType;
    pushToken?: StringNullableFilter<"Mitra"> | string | null;
    pushTokenUpdatedAt?: DateTimeNullableFilter<"Mitra"> | Date | string | null;
    fcmTokens?: StringNullableListFilter<"Mitra">;
    lastVersionCode?: IntNullableFilter<"Mitra"> | number | null;
    lastVersionName?: StringNullableFilter<"Mitra"> | string | null;
    lastVersionUpdate?: DateTimeNullableFilter<"Mitra"> | Date | string | null;
    tokenVersion?: IntFilter<"Mitra"> | number;
    mitraRateWoPsb?: FloatNullableFilter<"Mitra"> | number | null;
    mitraRateWoMaintenance?: FloatNullableFilter<"Mitra"> | number | null;
    mitraRateCanvasing?: FloatNullableFilter<"Mitra"> | number | null;
    bankName?: StringNullableFilter<"Mitra"> | string | null;
    bankAccountNo?: StringNullableFilter<"Mitra"> | string | null;
    bankAccountName?: StringNullableFilter<"Mitra"> | string | null;
    targetHarian?: IntNullableFilter<"Mitra"> | number | null;
    minWithdrawal?: IntNullableFilter<"Mitra"> | number | null;
    nik?: StringNullableFilter<"Mitra"> | string | null;
    tempatLahir?: StringNullableFilter<"Mitra"> | string | null;
    tanggalLahir?: DateTimeNullableFilter<"Mitra"> | Date | string | null;
    alamat?: StringNullableFilter<"Mitra"> | string | null;
    latitudeRumah?: FloatNullableFilter<"Mitra"> | number | null;
    longitudeRumah?: FloatNullableFilter<"Mitra"> | number | null;
    fotoDiri?: StringNullableFilter<"Mitra"> | string | null;
    fotoKtp?: StringNullableFilter<"Mitra"> | string | null;
    fotoSim?: StringNullableFilter<"Mitra"> | string | null;
    fotoKk?: StringNullableFilter<"Mitra"> | string | null;
    requiresFaceVerification?: BoolFilter<"Mitra"> | boolean;
    lastFaceVerification?:
      | DateTimeNullableFilter<"Mitra">
      | Date
      | string
      | null;
    garansiHari?: IntNullableFilter<"Mitra"> | number | null;
    slaGaransiJam?: IntNullableFilter<"Mitra"> | number | null;
    penaltyPsb?: FloatNullableFilter<"Mitra"> | number | null;
    penaltyMaintenance?: FloatNullableFilter<"Mitra"> | number | null;
    createdAt?: DateTimeFilter<"Mitra"> | Date | string;
    updatedAt?: DateTimeFilter<"Mitra"> | Date | string;
    tenantId?: StringNullableFilter<"Mitra"> | string | null;
    mitraWallet?: XOR<
      MitraWalletNullableScalarRelationFilter,
      MitraWalletWhereInput
    > | null;
    withdrawalsRequested?: WithdrawRequestListRelationFilter;
    faceVerificationLogs?: FaceVerificationLogListRelationFilter;
  };

  export type MitraOrderByWithRelationInput = {
    id?: SortOrder;
    name?: SortOrder;
    email?: SortOrder;
    passwordHash?: SortOrderInput | SortOrder;
    phone?: SortOrderInput | SortOrder;
    isActive?: SortOrder;
    siteId?: SortOrderInput | SortOrder;
    mitraType?: SortOrder;
    pushToken?: SortOrderInput | SortOrder;
    pushTokenUpdatedAt?: SortOrderInput | SortOrder;
    fcmTokens?: SortOrder;
    lastVersionCode?: SortOrderInput | SortOrder;
    lastVersionName?: SortOrderInput | SortOrder;
    lastVersionUpdate?: SortOrderInput | SortOrder;
    tokenVersion?: SortOrder;
    mitraRateWoPsb?: SortOrderInput | SortOrder;
    mitraRateWoMaintenance?: SortOrderInput | SortOrder;
    mitraRateCanvasing?: SortOrderInput | SortOrder;
    bankName?: SortOrderInput | SortOrder;
    bankAccountNo?: SortOrderInput | SortOrder;
    bankAccountName?: SortOrderInput | SortOrder;
    targetHarian?: SortOrderInput | SortOrder;
    minWithdrawal?: SortOrderInput | SortOrder;
    nik?: SortOrderInput | SortOrder;
    tempatLahir?: SortOrderInput | SortOrder;
    tanggalLahir?: SortOrderInput | SortOrder;
    alamat?: SortOrderInput | SortOrder;
    latitudeRumah?: SortOrderInput | SortOrder;
    longitudeRumah?: SortOrderInput | SortOrder;
    fotoDiri?: SortOrderInput | SortOrder;
    fotoKtp?: SortOrderInput | SortOrder;
    fotoSim?: SortOrderInput | SortOrder;
    fotoKk?: SortOrderInput | SortOrder;
    requiresFaceVerification?: SortOrder;
    lastFaceVerification?: SortOrderInput | SortOrder;
    garansiHari?: SortOrderInput | SortOrder;
    slaGaransiJam?: SortOrderInput | SortOrder;
    penaltyPsb?: SortOrderInput | SortOrder;
    penaltyMaintenance?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    mitraWallet?: MitraWalletOrderByWithRelationInput;
    withdrawalsRequested?: WithdrawRequestOrderByRelationAggregateInput;
    faceVerificationLogs?: FaceVerificationLogOrderByRelationAggregateInput;
  };

  export type MitraWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      tenantId_email?: MitraTenantIdEmailCompoundUniqueInput;
      tenantId_nik?: MitraTenantIdNikCompoundUniqueInput;
      AND?: MitraWhereInput | MitraWhereInput[];
      OR?: MitraWhereInput[];
      NOT?: MitraWhereInput | MitraWhereInput[];
      name?: StringFilter<"Mitra"> | string;
      email?: StringFilter<"Mitra"> | string;
      passwordHash?: StringNullableFilter<"Mitra"> | string | null;
      phone?: StringNullableFilter<"Mitra"> | string | null;
      isActive?: BoolFilter<"Mitra"> | boolean;
      siteId?: StringNullableFilter<"Mitra"> | string | null;
      mitraType?: EnumMitraTypeFilter<"Mitra"> | $Enums.MitraType;
      pushToken?: StringNullableFilter<"Mitra"> | string | null;
      pushTokenUpdatedAt?:
        | DateTimeNullableFilter<"Mitra">
        | Date
        | string
        | null;
      fcmTokens?: StringNullableListFilter<"Mitra">;
      lastVersionCode?: IntNullableFilter<"Mitra"> | number | null;
      lastVersionName?: StringNullableFilter<"Mitra"> | string | null;
      lastVersionUpdate?:
        | DateTimeNullableFilter<"Mitra">
        | Date
        | string
        | null;
      tokenVersion?: IntFilter<"Mitra"> | number;
      mitraRateWoPsb?: FloatNullableFilter<"Mitra"> | number | null;
      mitraRateWoMaintenance?: FloatNullableFilter<"Mitra"> | number | null;
      mitraRateCanvasing?: FloatNullableFilter<"Mitra"> | number | null;
      bankName?: StringNullableFilter<"Mitra"> | string | null;
      bankAccountNo?: StringNullableFilter<"Mitra"> | string | null;
      bankAccountName?: StringNullableFilter<"Mitra"> | string | null;
      targetHarian?: IntNullableFilter<"Mitra"> | number | null;
      minWithdrawal?: IntNullableFilter<"Mitra"> | number | null;
      nik?: StringNullableFilter<"Mitra"> | string | null;
      tempatLahir?: StringNullableFilter<"Mitra"> | string | null;
      tanggalLahir?: DateTimeNullableFilter<"Mitra"> | Date | string | null;
      alamat?: StringNullableFilter<"Mitra"> | string | null;
      latitudeRumah?: FloatNullableFilter<"Mitra"> | number | null;
      longitudeRumah?: FloatNullableFilter<"Mitra"> | number | null;
      fotoDiri?: StringNullableFilter<"Mitra"> | string | null;
      fotoKtp?: StringNullableFilter<"Mitra"> | string | null;
      fotoSim?: StringNullableFilter<"Mitra"> | string | null;
      fotoKk?: StringNullableFilter<"Mitra"> | string | null;
      requiresFaceVerification?: BoolFilter<"Mitra"> | boolean;
      lastFaceVerification?:
        | DateTimeNullableFilter<"Mitra">
        | Date
        | string
        | null;
      garansiHari?: IntNullableFilter<"Mitra"> | number | null;
      slaGaransiJam?: IntNullableFilter<"Mitra"> | number | null;
      penaltyPsb?: FloatNullableFilter<"Mitra"> | number | null;
      penaltyMaintenance?: FloatNullableFilter<"Mitra"> | number | null;
      createdAt?: DateTimeFilter<"Mitra"> | Date | string;
      updatedAt?: DateTimeFilter<"Mitra"> | Date | string;
      tenantId?: StringNullableFilter<"Mitra"> | string | null;
      mitraWallet?: XOR<
        MitraWalletNullableScalarRelationFilter,
        MitraWalletWhereInput
      > | null;
      withdrawalsRequested?: WithdrawRequestListRelationFilter;
      faceVerificationLogs?: FaceVerificationLogListRelationFilter;
    },
    "id" | "tenantId_email" | "tenantId_nik"
  >;

  export type MitraOrderByWithAggregationInput = {
    id?: SortOrder;
    name?: SortOrder;
    email?: SortOrder;
    passwordHash?: SortOrderInput | SortOrder;
    phone?: SortOrderInput | SortOrder;
    isActive?: SortOrder;
    siteId?: SortOrderInput | SortOrder;
    mitraType?: SortOrder;
    pushToken?: SortOrderInput | SortOrder;
    pushTokenUpdatedAt?: SortOrderInput | SortOrder;
    fcmTokens?: SortOrder;
    lastVersionCode?: SortOrderInput | SortOrder;
    lastVersionName?: SortOrderInput | SortOrder;
    lastVersionUpdate?: SortOrderInput | SortOrder;
    tokenVersion?: SortOrder;
    mitraRateWoPsb?: SortOrderInput | SortOrder;
    mitraRateWoMaintenance?: SortOrderInput | SortOrder;
    mitraRateCanvasing?: SortOrderInput | SortOrder;
    bankName?: SortOrderInput | SortOrder;
    bankAccountNo?: SortOrderInput | SortOrder;
    bankAccountName?: SortOrderInput | SortOrder;
    targetHarian?: SortOrderInput | SortOrder;
    minWithdrawal?: SortOrderInput | SortOrder;
    nik?: SortOrderInput | SortOrder;
    tempatLahir?: SortOrderInput | SortOrder;
    tanggalLahir?: SortOrderInput | SortOrder;
    alamat?: SortOrderInput | SortOrder;
    latitudeRumah?: SortOrderInput | SortOrder;
    longitudeRumah?: SortOrderInput | SortOrder;
    fotoDiri?: SortOrderInput | SortOrder;
    fotoKtp?: SortOrderInput | SortOrder;
    fotoSim?: SortOrderInput | SortOrder;
    fotoKk?: SortOrderInput | SortOrder;
    requiresFaceVerification?: SortOrder;
    lastFaceVerification?: SortOrderInput | SortOrder;
    garansiHari?: SortOrderInput | SortOrder;
    slaGaransiJam?: SortOrderInput | SortOrder;
    penaltyPsb?: SortOrderInput | SortOrder;
    penaltyMaintenance?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    _count?: MitraCountOrderByAggregateInput;
    _avg?: MitraAvgOrderByAggregateInput;
    _max?: MitraMaxOrderByAggregateInput;
    _min?: MitraMinOrderByAggregateInput;
    _sum?: MitraSumOrderByAggregateInput;
  };

  export type MitraScalarWhereWithAggregatesInput = {
    AND?:
      | MitraScalarWhereWithAggregatesInput
      | MitraScalarWhereWithAggregatesInput[];
    OR?: MitraScalarWhereWithAggregatesInput[];
    NOT?:
      | MitraScalarWhereWithAggregatesInput
      | MitraScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"Mitra"> | string;
    name?: StringWithAggregatesFilter<"Mitra"> | string;
    email?: StringWithAggregatesFilter<"Mitra"> | string;
    passwordHash?: StringNullableWithAggregatesFilter<"Mitra"> | string | null;
    phone?: StringNullableWithAggregatesFilter<"Mitra"> | string | null;
    isActive?: BoolWithAggregatesFilter<"Mitra"> | boolean;
    siteId?: StringNullableWithAggregatesFilter<"Mitra"> | string | null;
    mitraType?: EnumMitraTypeWithAggregatesFilter<"Mitra"> | $Enums.MitraType;
    pushToken?: StringNullableWithAggregatesFilter<"Mitra"> | string | null;
    pushTokenUpdatedAt?:
      | DateTimeNullableWithAggregatesFilter<"Mitra">
      | Date
      | string
      | null;
    fcmTokens?: StringNullableListFilter<"Mitra">;
    lastVersionCode?: IntNullableWithAggregatesFilter<"Mitra"> | number | null;
    lastVersionName?:
      | StringNullableWithAggregatesFilter<"Mitra">
      | string
      | null;
    lastVersionUpdate?:
      | DateTimeNullableWithAggregatesFilter<"Mitra">
      | Date
      | string
      | null;
    tokenVersion?: IntWithAggregatesFilter<"Mitra"> | number;
    mitraRateWoPsb?: FloatNullableWithAggregatesFilter<"Mitra"> | number | null;
    mitraRateWoMaintenance?:
      | FloatNullableWithAggregatesFilter<"Mitra">
      | number
      | null;
    mitraRateCanvasing?:
      | FloatNullableWithAggregatesFilter<"Mitra">
      | number
      | null;
    bankName?: StringNullableWithAggregatesFilter<"Mitra"> | string | null;
    bankAccountNo?: StringNullableWithAggregatesFilter<"Mitra"> | string | null;
    bankAccountName?:
      | StringNullableWithAggregatesFilter<"Mitra">
      | string
      | null;
    targetHarian?: IntNullableWithAggregatesFilter<"Mitra"> | number | null;
    minWithdrawal?: IntNullableWithAggregatesFilter<"Mitra"> | number | null;
    nik?: StringNullableWithAggregatesFilter<"Mitra"> | string | null;
    tempatLahir?: StringNullableWithAggregatesFilter<"Mitra"> | string | null;
    tanggalLahir?:
      | DateTimeNullableWithAggregatesFilter<"Mitra">
      | Date
      | string
      | null;
    alamat?: StringNullableWithAggregatesFilter<"Mitra"> | string | null;
    latitudeRumah?: FloatNullableWithAggregatesFilter<"Mitra"> | number | null;
    longitudeRumah?: FloatNullableWithAggregatesFilter<"Mitra"> | number | null;
    fotoDiri?: StringNullableWithAggregatesFilter<"Mitra"> | string | null;
    fotoKtp?: StringNullableWithAggregatesFilter<"Mitra"> | string | null;
    fotoSim?: StringNullableWithAggregatesFilter<"Mitra"> | string | null;
    fotoKk?: StringNullableWithAggregatesFilter<"Mitra"> | string | null;
    requiresFaceVerification?: BoolWithAggregatesFilter<"Mitra"> | boolean;
    lastFaceVerification?:
      | DateTimeNullableWithAggregatesFilter<"Mitra">
      | Date
      | string
      | null;
    garansiHari?: IntNullableWithAggregatesFilter<"Mitra"> | number | null;
    slaGaransiJam?: IntNullableWithAggregatesFilter<"Mitra"> | number | null;
    penaltyPsb?: FloatNullableWithAggregatesFilter<"Mitra"> | number | null;
    penaltyMaintenance?:
      | FloatNullableWithAggregatesFilter<"Mitra">
      | number
      | null;
    createdAt?: DateTimeWithAggregatesFilter<"Mitra"> | Date | string;
    updatedAt?: DateTimeWithAggregatesFilter<"Mitra"> | Date | string;
    tenantId?: StringNullableWithAggregatesFilter<"Mitra"> | string | null;
  };

  export type MitraWalletWhereInput = {
    AND?: MitraWalletWhereInput | MitraWalletWhereInput[];
    OR?: MitraWalletWhereInput[];
    NOT?: MitraWalletWhereInput | MitraWalletWhereInput[];
    id?: StringFilter<"MitraWallet"> | string;
    mitraId?: StringFilter<"MitraWallet"> | string;
    balance?:
      | DecimalFilter<"MitraWallet">
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalEarnings?:
      | DecimalFilter<"MitraWallet">
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalWithdrawn?:
      | DecimalFilter<"MitraWallet">
      | Decimal
      | DecimalJsLike
      | number
      | string;
    currency?: StringFilter<"MitraWallet"> | string;
    createdAt?: DateTimeFilter<"MitraWallet"> | Date | string;
    updatedAt?: DateTimeFilter<"MitraWallet"> | Date | string;
    tenantId?: StringNullableFilter<"MitraWallet"> | string | null;
    mitra?: XOR<MitraScalarRelationFilter, MitraWhereInput>;
    transactions?: MitraTransactionListRelationFilter;
    withdrawals?: WithdrawRequestListRelationFilter;
  };

  export type MitraWalletOrderByWithRelationInput = {
    id?: SortOrder;
    mitraId?: SortOrder;
    balance?: SortOrder;
    totalEarnings?: SortOrder;
    totalWithdrawn?: SortOrder;
    currency?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    mitra?: MitraOrderByWithRelationInput;
    transactions?: MitraTransactionOrderByRelationAggregateInput;
    withdrawals?: WithdrawRequestOrderByRelationAggregateInput;
  };

  export type MitraWalletWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      mitraId?: string;
      AND?: MitraWalletWhereInput | MitraWalletWhereInput[];
      OR?: MitraWalletWhereInput[];
      NOT?: MitraWalletWhereInput | MitraWalletWhereInput[];
      balance?:
        | DecimalFilter<"MitraWallet">
        | Decimal
        | DecimalJsLike
        | number
        | string;
      totalEarnings?:
        | DecimalFilter<"MitraWallet">
        | Decimal
        | DecimalJsLike
        | number
        | string;
      totalWithdrawn?:
        | DecimalFilter<"MitraWallet">
        | Decimal
        | DecimalJsLike
        | number
        | string;
      currency?: StringFilter<"MitraWallet"> | string;
      createdAt?: DateTimeFilter<"MitraWallet"> | Date | string;
      updatedAt?: DateTimeFilter<"MitraWallet"> | Date | string;
      tenantId?: StringNullableFilter<"MitraWallet"> | string | null;
      mitra?: XOR<MitraScalarRelationFilter, MitraWhereInput>;
      transactions?: MitraTransactionListRelationFilter;
      withdrawals?: WithdrawRequestListRelationFilter;
    },
    "id" | "mitraId"
  >;

  export type MitraWalletOrderByWithAggregationInput = {
    id?: SortOrder;
    mitraId?: SortOrder;
    balance?: SortOrder;
    totalEarnings?: SortOrder;
    totalWithdrawn?: SortOrder;
    currency?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    _count?: MitraWalletCountOrderByAggregateInput;
    _avg?: MitraWalletAvgOrderByAggregateInput;
    _max?: MitraWalletMaxOrderByAggregateInput;
    _min?: MitraWalletMinOrderByAggregateInput;
    _sum?: MitraWalletSumOrderByAggregateInput;
  };

  export type MitraWalletScalarWhereWithAggregatesInput = {
    AND?:
      | MitraWalletScalarWhereWithAggregatesInput
      | MitraWalletScalarWhereWithAggregatesInput[];
    OR?: MitraWalletScalarWhereWithAggregatesInput[];
    NOT?:
      | MitraWalletScalarWhereWithAggregatesInput
      | MitraWalletScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"MitraWallet"> | string;
    mitraId?: StringWithAggregatesFilter<"MitraWallet"> | string;
    balance?:
      | DecimalWithAggregatesFilter<"MitraWallet">
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalEarnings?:
      | DecimalWithAggregatesFilter<"MitraWallet">
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalWithdrawn?:
      | DecimalWithAggregatesFilter<"MitraWallet">
      | Decimal
      | DecimalJsLike
      | number
      | string;
    currency?: StringWithAggregatesFilter<"MitraWallet"> | string;
    createdAt?: DateTimeWithAggregatesFilter<"MitraWallet"> | Date | string;
    updatedAt?: DateTimeWithAggregatesFilter<"MitraWallet"> | Date | string;
    tenantId?:
      | StringNullableWithAggregatesFilter<"MitraWallet">
      | string
      | null;
  };

  export type MitraTransactionWhereInput = {
    AND?: MitraTransactionWhereInput | MitraTransactionWhereInput[];
    OR?: MitraTransactionWhereInput[];
    NOT?: MitraTransactionWhereInput | MitraTransactionWhereInput[];
    id?: StringFilter<"MitraTransaction"> | string;
    walletId?: StringFilter<"MitraTransaction"> | string;
    amount?:
      | DecimalFilter<"MitraTransaction">
      | Decimal
      | DecimalJsLike
      | number
      | string;
    type?:
      | EnumMitraTransactionTypeFilter<"MitraTransaction">
      | $Enums.MitraTransactionType;
    description?: StringFilter<"MitraTransaction"> | string;
    referenceId?: StringNullableFilter<"MitraTransaction"> | string | null;
    referenceType?: StringNullableFilter<"MitraTransaction"> | string | null;
    createdAt?: DateTimeFilter<"MitraTransaction"> | Date | string;
    tenantId?: StringNullableFilter<"MitraTransaction"> | string | null;
    wallet?: XOR<MitraWalletScalarRelationFilter, MitraWalletWhereInput>;
  };

  export type MitraTransactionOrderByWithRelationInput = {
    id?: SortOrder;
    walletId?: SortOrder;
    amount?: SortOrder;
    type?: SortOrder;
    description?: SortOrder;
    referenceId?: SortOrderInput | SortOrder;
    referenceType?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    wallet?: MitraWalletOrderByWithRelationInput;
  };

  export type MitraTransactionWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      AND?: MitraTransactionWhereInput | MitraTransactionWhereInput[];
      OR?: MitraTransactionWhereInput[];
      NOT?: MitraTransactionWhereInput | MitraTransactionWhereInput[];
      walletId?: StringFilter<"MitraTransaction"> | string;
      amount?:
        | DecimalFilter<"MitraTransaction">
        | Decimal
        | DecimalJsLike
        | number
        | string;
      type?:
        | EnumMitraTransactionTypeFilter<"MitraTransaction">
        | $Enums.MitraTransactionType;
      description?: StringFilter<"MitraTransaction"> | string;
      referenceId?: StringNullableFilter<"MitraTransaction"> | string | null;
      referenceType?: StringNullableFilter<"MitraTransaction"> | string | null;
      createdAt?: DateTimeFilter<"MitraTransaction"> | Date | string;
      tenantId?: StringNullableFilter<"MitraTransaction"> | string | null;
      wallet?: XOR<MitraWalletScalarRelationFilter, MitraWalletWhereInput>;
    },
    "id"
  >;

  export type MitraTransactionOrderByWithAggregationInput = {
    id?: SortOrder;
    walletId?: SortOrder;
    amount?: SortOrder;
    type?: SortOrder;
    description?: SortOrder;
    referenceId?: SortOrderInput | SortOrder;
    referenceType?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    _count?: MitraTransactionCountOrderByAggregateInput;
    _avg?: MitraTransactionAvgOrderByAggregateInput;
    _max?: MitraTransactionMaxOrderByAggregateInput;
    _min?: MitraTransactionMinOrderByAggregateInput;
    _sum?: MitraTransactionSumOrderByAggregateInput;
  };

  export type MitraTransactionScalarWhereWithAggregatesInput = {
    AND?:
      | MitraTransactionScalarWhereWithAggregatesInput
      | MitraTransactionScalarWhereWithAggregatesInput[];
    OR?: MitraTransactionScalarWhereWithAggregatesInput[];
    NOT?:
      | MitraTransactionScalarWhereWithAggregatesInput
      | MitraTransactionScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"MitraTransaction"> | string;
    walletId?: StringWithAggregatesFilter<"MitraTransaction"> | string;
    amount?:
      | DecimalWithAggregatesFilter<"MitraTransaction">
      | Decimal
      | DecimalJsLike
      | number
      | string;
    type?:
      | EnumMitraTransactionTypeWithAggregatesFilter<"MitraTransaction">
      | $Enums.MitraTransactionType;
    description?: StringWithAggregatesFilter<"MitraTransaction"> | string;
    referenceId?:
      | StringNullableWithAggregatesFilter<"MitraTransaction">
      | string
      | null;
    referenceType?:
      | StringNullableWithAggregatesFilter<"MitraTransaction">
      | string
      | null;
    createdAt?:
      | DateTimeWithAggregatesFilter<"MitraTransaction">
      | Date
      | string;
    tenantId?:
      | StringNullableWithAggregatesFilter<"MitraTransaction">
      | string
      | null;
  };

  export type WithdrawRequestWhereInput = {
    AND?: WithdrawRequestWhereInput | WithdrawRequestWhereInput[];
    OR?: WithdrawRequestWhereInput[];
    NOT?: WithdrawRequestWhereInput | WithdrawRequestWhereInput[];
    id?: StringFilter<"WithdrawRequest"> | string;
    mitraId?: StringFilter<"WithdrawRequest"> | string;
    amount?: FloatFilter<"WithdrawRequest"> | number;
    bankName?: StringFilter<"WithdrawRequest"> | string;
    bankAccountNo?: StringFilter<"WithdrawRequest"> | string;
    bankAccountName?: StringFilter<"WithdrawRequest"> | string;
    status?:
      | EnumWithdrawStatusFilter<"WithdrawRequest">
      | $Enums.WithdrawStatus;
    method?:
      | EnumWithdrawMethodFilter<"WithdrawRequest">
      | $Enums.WithdrawMethod;
    notes?: StringNullableFilter<"WithdrawRequest"> | string | null;
    processedById?: StringNullableFilter<"WithdrawRequest"> | string | null;
    processedAt?:
      | DateTimeNullableFilter<"WithdrawRequest">
      | Date
      | string
      | null;
    rejectionReason?: StringNullableFilter<"WithdrawRequest"> | string | null;
    createdAt?: DateTimeFilter<"WithdrawRequest"> | Date | string;
    updatedAt?: DateTimeFilter<"WithdrawRequest"> | Date | string;
    mitraWalletId?: StringNullableFilter<"WithdrawRequest"> | string | null;
    tenantId?: StringNullableFilter<"WithdrawRequest"> | string | null;
    mitra?: XOR<MitraScalarRelationFilter, MitraWhereInput>;
    mitraWallet?: XOR<
      MitraWalletNullableScalarRelationFilter,
      MitraWalletWhereInput
    > | null;
  };

  export type WithdrawRequestOrderByWithRelationInput = {
    id?: SortOrder;
    mitraId?: SortOrder;
    amount?: SortOrder;
    bankName?: SortOrder;
    bankAccountNo?: SortOrder;
    bankAccountName?: SortOrder;
    status?: SortOrder;
    method?: SortOrder;
    notes?: SortOrderInput | SortOrder;
    processedById?: SortOrderInput | SortOrder;
    processedAt?: SortOrderInput | SortOrder;
    rejectionReason?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    mitraWalletId?: SortOrderInput | SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    mitra?: MitraOrderByWithRelationInput;
    mitraWallet?: MitraWalletOrderByWithRelationInput;
  };

  export type WithdrawRequestWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      AND?: WithdrawRequestWhereInput | WithdrawRequestWhereInput[];
      OR?: WithdrawRequestWhereInput[];
      NOT?: WithdrawRequestWhereInput | WithdrawRequestWhereInput[];
      mitraId?: StringFilter<"WithdrawRequest"> | string;
      amount?: FloatFilter<"WithdrawRequest"> | number;
      bankName?: StringFilter<"WithdrawRequest"> | string;
      bankAccountNo?: StringFilter<"WithdrawRequest"> | string;
      bankAccountName?: StringFilter<"WithdrawRequest"> | string;
      status?:
        | EnumWithdrawStatusFilter<"WithdrawRequest">
        | $Enums.WithdrawStatus;
      method?:
        | EnumWithdrawMethodFilter<"WithdrawRequest">
        | $Enums.WithdrawMethod;
      notes?: StringNullableFilter<"WithdrawRequest"> | string | null;
      processedById?: StringNullableFilter<"WithdrawRequest"> | string | null;
      processedAt?:
        | DateTimeNullableFilter<"WithdrawRequest">
        | Date
        | string
        | null;
      rejectionReason?: StringNullableFilter<"WithdrawRequest"> | string | null;
      createdAt?: DateTimeFilter<"WithdrawRequest"> | Date | string;
      updatedAt?: DateTimeFilter<"WithdrawRequest"> | Date | string;
      mitraWalletId?: StringNullableFilter<"WithdrawRequest"> | string | null;
      tenantId?: StringNullableFilter<"WithdrawRequest"> | string | null;
      mitra?: XOR<MitraScalarRelationFilter, MitraWhereInput>;
      mitraWallet?: XOR<
        MitraWalletNullableScalarRelationFilter,
        MitraWalletWhereInput
      > | null;
    },
    "id"
  >;

  export type WithdrawRequestOrderByWithAggregationInput = {
    id?: SortOrder;
    mitraId?: SortOrder;
    amount?: SortOrder;
    bankName?: SortOrder;
    bankAccountNo?: SortOrder;
    bankAccountName?: SortOrder;
    status?: SortOrder;
    method?: SortOrder;
    notes?: SortOrderInput | SortOrder;
    processedById?: SortOrderInput | SortOrder;
    processedAt?: SortOrderInput | SortOrder;
    rejectionReason?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    mitraWalletId?: SortOrderInput | SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    _count?: WithdrawRequestCountOrderByAggregateInput;
    _avg?: WithdrawRequestAvgOrderByAggregateInput;
    _max?: WithdrawRequestMaxOrderByAggregateInput;
    _min?: WithdrawRequestMinOrderByAggregateInput;
    _sum?: WithdrawRequestSumOrderByAggregateInput;
  };

  export type WithdrawRequestScalarWhereWithAggregatesInput = {
    AND?:
      | WithdrawRequestScalarWhereWithAggregatesInput
      | WithdrawRequestScalarWhereWithAggregatesInput[];
    OR?: WithdrawRequestScalarWhereWithAggregatesInput[];
    NOT?:
      | WithdrawRequestScalarWhereWithAggregatesInput
      | WithdrawRequestScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"WithdrawRequest"> | string;
    mitraId?: StringWithAggregatesFilter<"WithdrawRequest"> | string;
    amount?: FloatWithAggregatesFilter<"WithdrawRequest"> | number;
    bankName?: StringWithAggregatesFilter<"WithdrawRequest"> | string;
    bankAccountNo?: StringWithAggregatesFilter<"WithdrawRequest"> | string;
    bankAccountName?: StringWithAggregatesFilter<"WithdrawRequest"> | string;
    status?:
      | EnumWithdrawStatusWithAggregatesFilter<"WithdrawRequest">
      | $Enums.WithdrawStatus;
    method?:
      | EnumWithdrawMethodWithAggregatesFilter<"WithdrawRequest">
      | $Enums.WithdrawMethod;
    notes?:
      | StringNullableWithAggregatesFilter<"WithdrawRequest">
      | string
      | null;
    processedById?:
      | StringNullableWithAggregatesFilter<"WithdrawRequest">
      | string
      | null;
    processedAt?:
      | DateTimeNullableWithAggregatesFilter<"WithdrawRequest">
      | Date
      | string
      | null;
    rejectionReason?:
      | StringNullableWithAggregatesFilter<"WithdrawRequest">
      | string
      | null;
    createdAt?: DateTimeWithAggregatesFilter<"WithdrawRequest"> | Date | string;
    updatedAt?: DateTimeWithAggregatesFilter<"WithdrawRequest"> | Date | string;
    mitraWalletId?:
      | StringNullableWithAggregatesFilter<"WithdrawRequest">
      | string
      | null;
    tenantId?:
      | StringNullableWithAggregatesFilter<"WithdrawRequest">
      | string
      | null;
  };

  export type FaceVerificationLogWhereInput = {
    AND?: FaceVerificationLogWhereInput | FaceVerificationLogWhereInput[];
    OR?: FaceVerificationLogWhereInput[];
    NOT?: FaceVerificationLogWhereInput | FaceVerificationLogWhereInput[];
    id?: StringFilter<"FaceVerificationLog"> | string;
    mitraId?: StringFilter<"FaceVerificationLog"> | string;
    photoUrl?: StringFilter<"FaceVerificationLog"> | string;
    latitude?: FloatNullableFilter<"FaceVerificationLog"> | number | null;
    longitude?: FloatNullableFilter<"FaceVerificationLog"> | number | null;
    deviceInfo?: StringNullableFilter<"FaceVerificationLog"> | string | null;
    createdAt?: DateTimeFilter<"FaceVerificationLog"> | Date | string;
    tenantId?: StringNullableFilter<"FaceVerificationLog"> | string | null;
    mitra?: XOR<MitraScalarRelationFilter, MitraWhereInput>;
  };

  export type FaceVerificationLogOrderByWithRelationInput = {
    id?: SortOrder;
    mitraId?: SortOrder;
    photoUrl?: SortOrder;
    latitude?: SortOrderInput | SortOrder;
    longitude?: SortOrderInput | SortOrder;
    deviceInfo?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    mitra?: MitraOrderByWithRelationInput;
  };

  export type FaceVerificationLogWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      AND?: FaceVerificationLogWhereInput | FaceVerificationLogWhereInput[];
      OR?: FaceVerificationLogWhereInput[];
      NOT?: FaceVerificationLogWhereInput | FaceVerificationLogWhereInput[];
      mitraId?: StringFilter<"FaceVerificationLog"> | string;
      photoUrl?: StringFilter<"FaceVerificationLog"> | string;
      latitude?: FloatNullableFilter<"FaceVerificationLog"> | number | null;
      longitude?: FloatNullableFilter<"FaceVerificationLog"> | number | null;
      deviceInfo?: StringNullableFilter<"FaceVerificationLog"> | string | null;
      createdAt?: DateTimeFilter<"FaceVerificationLog"> | Date | string;
      tenantId?: StringNullableFilter<"FaceVerificationLog"> | string | null;
      mitra?: XOR<MitraScalarRelationFilter, MitraWhereInput>;
    },
    "id"
  >;

  export type FaceVerificationLogOrderByWithAggregationInput = {
    id?: SortOrder;
    mitraId?: SortOrder;
    photoUrl?: SortOrder;
    latitude?: SortOrderInput | SortOrder;
    longitude?: SortOrderInput | SortOrder;
    deviceInfo?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    _count?: FaceVerificationLogCountOrderByAggregateInput;
    _avg?: FaceVerificationLogAvgOrderByAggregateInput;
    _max?: FaceVerificationLogMaxOrderByAggregateInput;
    _min?: FaceVerificationLogMinOrderByAggregateInput;
    _sum?: FaceVerificationLogSumOrderByAggregateInput;
  };

  export type FaceVerificationLogScalarWhereWithAggregatesInput = {
    AND?:
      | FaceVerificationLogScalarWhereWithAggregatesInput
      | FaceVerificationLogScalarWhereWithAggregatesInput[];
    OR?: FaceVerificationLogScalarWhereWithAggregatesInput[];
    NOT?:
      | FaceVerificationLogScalarWhereWithAggregatesInput
      | FaceVerificationLogScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"FaceVerificationLog"> | string;
    mitraId?: StringWithAggregatesFilter<"FaceVerificationLog"> | string;
    photoUrl?: StringWithAggregatesFilter<"FaceVerificationLog"> | string;
    latitude?:
      | FloatNullableWithAggregatesFilter<"FaceVerificationLog">
      | number
      | null;
    longitude?:
      | FloatNullableWithAggregatesFilter<"FaceVerificationLog">
      | number
      | null;
    deviceInfo?:
      | StringNullableWithAggregatesFilter<"FaceVerificationLog">
      | string
      | null;
    createdAt?:
      | DateTimeWithAggregatesFilter<"FaceVerificationLog">
      | Date
      | string;
    tenantId?:
      | StringNullableWithAggregatesFilter<"FaceVerificationLog">
      | string
      | null;
  };

  export type MitraCreateInput = {
    id?: string;
    name: string;
    email: string;
    passwordHash?: string | null;
    phone?: string | null;
    isActive?: boolean;
    siteId?: string | null;
    mitraType?: $Enums.MitraType;
    pushToken?: string | null;
    pushTokenUpdatedAt?: Date | string | null;
    fcmTokens?: MitraCreatefcmTokensInput | string[];
    lastVersionCode?: number | null;
    lastVersionName?: string | null;
    lastVersionUpdate?: Date | string | null;
    tokenVersion?: number;
    mitraRateWoPsb?: number | null;
    mitraRateWoMaintenance?: number | null;
    mitraRateCanvasing?: number | null;
    bankName?: string | null;
    bankAccountNo?: string | null;
    bankAccountName?: string | null;
    targetHarian?: number | null;
    minWithdrawal?: number | null;
    nik?: string | null;
    tempatLahir?: string | null;
    tanggalLahir?: Date | string | null;
    alamat?: string | null;
    latitudeRumah?: number | null;
    longitudeRumah?: number | null;
    fotoDiri?: string | null;
    fotoKtp?: string | null;
    fotoSim?: string | null;
    fotoKk?: string | null;
    requiresFaceVerification?: boolean;
    lastFaceVerification?: Date | string | null;
    garansiHari?: number | null;
    slaGaransiJam?: number | null;
    penaltyPsb?: number | null;
    penaltyMaintenance?: number | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    mitraWallet?: MitraWalletCreateNestedOneWithoutMitraInput;
    withdrawalsRequested?: WithdrawRequestCreateNestedManyWithoutMitraInput;
    faceVerificationLogs?: FaceVerificationLogCreateNestedManyWithoutMitraInput;
  };

  export type MitraUncheckedCreateInput = {
    id?: string;
    name: string;
    email: string;
    passwordHash?: string | null;
    phone?: string | null;
    isActive?: boolean;
    siteId?: string | null;
    mitraType?: $Enums.MitraType;
    pushToken?: string | null;
    pushTokenUpdatedAt?: Date | string | null;
    fcmTokens?: MitraCreatefcmTokensInput | string[];
    lastVersionCode?: number | null;
    lastVersionName?: string | null;
    lastVersionUpdate?: Date | string | null;
    tokenVersion?: number;
    mitraRateWoPsb?: number | null;
    mitraRateWoMaintenance?: number | null;
    mitraRateCanvasing?: number | null;
    bankName?: string | null;
    bankAccountNo?: string | null;
    bankAccountName?: string | null;
    targetHarian?: number | null;
    minWithdrawal?: number | null;
    nik?: string | null;
    tempatLahir?: string | null;
    tanggalLahir?: Date | string | null;
    alamat?: string | null;
    latitudeRumah?: number | null;
    longitudeRumah?: number | null;
    fotoDiri?: string | null;
    fotoKtp?: string | null;
    fotoSim?: string | null;
    fotoKk?: string | null;
    requiresFaceVerification?: boolean;
    lastFaceVerification?: Date | string | null;
    garansiHari?: number | null;
    slaGaransiJam?: number | null;
    penaltyPsb?: number | null;
    penaltyMaintenance?: number | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    mitraWallet?: MitraWalletUncheckedCreateNestedOneWithoutMitraInput;
    withdrawalsRequested?: WithdrawRequestUncheckedCreateNestedManyWithoutMitraInput;
    faceVerificationLogs?: FaceVerificationLogUncheckedCreateNestedManyWithoutMitraInput;
  };

  export type MitraUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraType?: EnumMitraTypeFieldUpdateOperationsInput | $Enums.MitraType;
    pushToken?: NullableStringFieldUpdateOperationsInput | string | null;
    pushTokenUpdatedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    fcmTokens?: MitraUpdatefcmTokensInput | string[];
    lastVersionCode?: NullableIntFieldUpdateOperationsInput | number | null;
    lastVersionName?: NullableStringFieldUpdateOperationsInput | string | null;
    lastVersionUpdate?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    tokenVersion?: IntFieldUpdateOperationsInput | number;
    mitraRateWoPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    mitraRateWoMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    mitraRateCanvasing?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    bankName?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountNo?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountName?: NullableStringFieldUpdateOperationsInput | string | null;
    targetHarian?: NullableIntFieldUpdateOperationsInput | number | null;
    minWithdrawal?: NullableIntFieldUpdateOperationsInput | number | null;
    nik?: NullableStringFieldUpdateOperationsInput | string | null;
    tempatLahir?: NullableStringFieldUpdateOperationsInput | string | null;
    tanggalLahir?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    alamat?: NullableStringFieldUpdateOperationsInput | string | null;
    latitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    fotoDiri?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKtp?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoSim?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKk?: NullableStringFieldUpdateOperationsInput | string | null;
    requiresFaceVerification?: BoolFieldUpdateOperationsInput | boolean;
    lastFaceVerification?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    garansiHari?: NullableIntFieldUpdateOperationsInput | number | null;
    slaGaransiJam?: NullableIntFieldUpdateOperationsInput | number | null;
    penaltyPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    penaltyMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraWallet?: MitraWalletUpdateOneWithoutMitraNestedInput;
    withdrawalsRequested?: WithdrawRequestUpdateManyWithoutMitraNestedInput;
    faceVerificationLogs?: FaceVerificationLogUpdateManyWithoutMitraNestedInput;
  };

  export type MitraUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraType?: EnumMitraTypeFieldUpdateOperationsInput | $Enums.MitraType;
    pushToken?: NullableStringFieldUpdateOperationsInput | string | null;
    pushTokenUpdatedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    fcmTokens?: MitraUpdatefcmTokensInput | string[];
    lastVersionCode?: NullableIntFieldUpdateOperationsInput | number | null;
    lastVersionName?: NullableStringFieldUpdateOperationsInput | string | null;
    lastVersionUpdate?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    tokenVersion?: IntFieldUpdateOperationsInput | number;
    mitraRateWoPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    mitraRateWoMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    mitraRateCanvasing?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    bankName?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountNo?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountName?: NullableStringFieldUpdateOperationsInput | string | null;
    targetHarian?: NullableIntFieldUpdateOperationsInput | number | null;
    minWithdrawal?: NullableIntFieldUpdateOperationsInput | number | null;
    nik?: NullableStringFieldUpdateOperationsInput | string | null;
    tempatLahir?: NullableStringFieldUpdateOperationsInput | string | null;
    tanggalLahir?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    alamat?: NullableStringFieldUpdateOperationsInput | string | null;
    latitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    fotoDiri?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKtp?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoSim?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKk?: NullableStringFieldUpdateOperationsInput | string | null;
    requiresFaceVerification?: BoolFieldUpdateOperationsInput | boolean;
    lastFaceVerification?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    garansiHari?: NullableIntFieldUpdateOperationsInput | number | null;
    slaGaransiJam?: NullableIntFieldUpdateOperationsInput | number | null;
    penaltyPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    penaltyMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraWallet?: MitraWalletUncheckedUpdateOneWithoutMitraNestedInput;
    withdrawalsRequested?: WithdrawRequestUncheckedUpdateManyWithoutMitraNestedInput;
    faceVerificationLogs?: FaceVerificationLogUncheckedUpdateManyWithoutMitraNestedInput;
  };

  export type MitraCreateManyInput = {
    id?: string;
    name: string;
    email: string;
    passwordHash?: string | null;
    phone?: string | null;
    isActive?: boolean;
    siteId?: string | null;
    mitraType?: $Enums.MitraType;
    pushToken?: string | null;
    pushTokenUpdatedAt?: Date | string | null;
    fcmTokens?: MitraCreatefcmTokensInput | string[];
    lastVersionCode?: number | null;
    lastVersionName?: string | null;
    lastVersionUpdate?: Date | string | null;
    tokenVersion?: number;
    mitraRateWoPsb?: number | null;
    mitraRateWoMaintenance?: number | null;
    mitraRateCanvasing?: number | null;
    bankName?: string | null;
    bankAccountNo?: string | null;
    bankAccountName?: string | null;
    targetHarian?: number | null;
    minWithdrawal?: number | null;
    nik?: string | null;
    tempatLahir?: string | null;
    tanggalLahir?: Date | string | null;
    alamat?: string | null;
    latitudeRumah?: number | null;
    longitudeRumah?: number | null;
    fotoDiri?: string | null;
    fotoKtp?: string | null;
    fotoSim?: string | null;
    fotoKk?: string | null;
    requiresFaceVerification?: boolean;
    lastFaceVerification?: Date | string | null;
    garansiHari?: number | null;
    slaGaransiJam?: number | null;
    penaltyPsb?: number | null;
    penaltyMaintenance?: number | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
  };

  export type MitraUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraType?: EnumMitraTypeFieldUpdateOperationsInput | $Enums.MitraType;
    pushToken?: NullableStringFieldUpdateOperationsInput | string | null;
    pushTokenUpdatedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    fcmTokens?: MitraUpdatefcmTokensInput | string[];
    lastVersionCode?: NullableIntFieldUpdateOperationsInput | number | null;
    lastVersionName?: NullableStringFieldUpdateOperationsInput | string | null;
    lastVersionUpdate?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    tokenVersion?: IntFieldUpdateOperationsInput | number;
    mitraRateWoPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    mitraRateWoMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    mitraRateCanvasing?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    bankName?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountNo?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountName?: NullableStringFieldUpdateOperationsInput | string | null;
    targetHarian?: NullableIntFieldUpdateOperationsInput | number | null;
    minWithdrawal?: NullableIntFieldUpdateOperationsInput | number | null;
    nik?: NullableStringFieldUpdateOperationsInput | string | null;
    tempatLahir?: NullableStringFieldUpdateOperationsInput | string | null;
    tanggalLahir?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    alamat?: NullableStringFieldUpdateOperationsInput | string | null;
    latitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    fotoDiri?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKtp?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoSim?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKk?: NullableStringFieldUpdateOperationsInput | string | null;
    requiresFaceVerification?: BoolFieldUpdateOperationsInput | boolean;
    lastFaceVerification?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    garansiHari?: NullableIntFieldUpdateOperationsInput | number | null;
    slaGaransiJam?: NullableIntFieldUpdateOperationsInput | number | null;
    penaltyPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    penaltyMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type MitraUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraType?: EnumMitraTypeFieldUpdateOperationsInput | $Enums.MitraType;
    pushToken?: NullableStringFieldUpdateOperationsInput | string | null;
    pushTokenUpdatedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    fcmTokens?: MitraUpdatefcmTokensInput | string[];
    lastVersionCode?: NullableIntFieldUpdateOperationsInput | number | null;
    lastVersionName?: NullableStringFieldUpdateOperationsInput | string | null;
    lastVersionUpdate?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    tokenVersion?: IntFieldUpdateOperationsInput | number;
    mitraRateWoPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    mitraRateWoMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    mitraRateCanvasing?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    bankName?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountNo?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountName?: NullableStringFieldUpdateOperationsInput | string | null;
    targetHarian?: NullableIntFieldUpdateOperationsInput | number | null;
    minWithdrawal?: NullableIntFieldUpdateOperationsInput | number | null;
    nik?: NullableStringFieldUpdateOperationsInput | string | null;
    tempatLahir?: NullableStringFieldUpdateOperationsInput | string | null;
    tanggalLahir?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    alamat?: NullableStringFieldUpdateOperationsInput | string | null;
    latitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    fotoDiri?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKtp?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoSim?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKk?: NullableStringFieldUpdateOperationsInput | string | null;
    requiresFaceVerification?: BoolFieldUpdateOperationsInput | boolean;
    lastFaceVerification?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    garansiHari?: NullableIntFieldUpdateOperationsInput | number | null;
    slaGaransiJam?: NullableIntFieldUpdateOperationsInput | number | null;
    penaltyPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    penaltyMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type MitraWalletCreateInput = {
    id?: string;
    balance?: Decimal | DecimalJsLike | number | string;
    totalEarnings?: Decimal | DecimalJsLike | number | string;
    totalWithdrawn?: Decimal | DecimalJsLike | number | string;
    currency?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    mitra: MitraCreateNestedOneWithoutMitraWalletInput;
    transactions?: MitraTransactionCreateNestedManyWithoutWalletInput;
    withdrawals?: WithdrawRequestCreateNestedManyWithoutMitraWalletInput;
  };

  export type MitraWalletUncheckedCreateInput = {
    id?: string;
    mitraId: string;
    balance?: Decimal | DecimalJsLike | number | string;
    totalEarnings?: Decimal | DecimalJsLike | number | string;
    totalWithdrawn?: Decimal | DecimalJsLike | number | string;
    currency?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    transactions?: MitraTransactionUncheckedCreateNestedManyWithoutWalletInput;
    withdrawals?: WithdrawRequestUncheckedCreateNestedManyWithoutMitraWalletInput;
  };

  export type MitraWalletUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    balance?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalEarnings?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalWithdrawn?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    currency?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitra?: MitraUpdateOneRequiredWithoutMitraWalletNestedInput;
    transactions?: MitraTransactionUpdateManyWithoutWalletNestedInput;
    withdrawals?: WithdrawRequestUpdateManyWithoutMitraWalletNestedInput;
  };

  export type MitraWalletUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    mitraId?: StringFieldUpdateOperationsInput | string;
    balance?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalEarnings?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalWithdrawn?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    currency?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    transactions?: MitraTransactionUncheckedUpdateManyWithoutWalletNestedInput;
    withdrawals?: WithdrawRequestUncheckedUpdateManyWithoutMitraWalletNestedInput;
  };

  export type MitraWalletCreateManyInput = {
    id?: string;
    mitraId: string;
    balance?: Decimal | DecimalJsLike | number | string;
    totalEarnings?: Decimal | DecimalJsLike | number | string;
    totalWithdrawn?: Decimal | DecimalJsLike | number | string;
    currency?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
  };

  export type MitraWalletUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    balance?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalEarnings?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalWithdrawn?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    currency?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type MitraWalletUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    mitraId?: StringFieldUpdateOperationsInput | string;
    balance?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalEarnings?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalWithdrawn?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    currency?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type MitraTransactionCreateInput = {
    id?: string;
    amount: Decimal | DecimalJsLike | number | string;
    type: $Enums.MitraTransactionType;
    description: string;
    referenceId?: string | null;
    referenceType?: string | null;
    createdAt?: Date | string;
    tenantId?: string | null;
    wallet: MitraWalletCreateNestedOneWithoutTransactionsInput;
  };

  export type MitraTransactionUncheckedCreateInput = {
    id?: string;
    walletId: string;
    amount: Decimal | DecimalJsLike | number | string;
    type: $Enums.MitraTransactionType;
    description: string;
    referenceId?: string | null;
    referenceType?: string | null;
    createdAt?: Date | string;
    tenantId?: string | null;
  };

  export type MitraTransactionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    amount?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    type?:
      | EnumMitraTransactionTypeFieldUpdateOperationsInput
      | $Enums.MitraTransactionType;
    description?: StringFieldUpdateOperationsInput | string;
    referenceId?: NullableStringFieldUpdateOperationsInput | string | null;
    referenceType?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    wallet?: MitraWalletUpdateOneRequiredWithoutTransactionsNestedInput;
  };

  export type MitraTransactionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    walletId?: StringFieldUpdateOperationsInput | string;
    amount?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    type?:
      | EnumMitraTransactionTypeFieldUpdateOperationsInput
      | $Enums.MitraTransactionType;
    description?: StringFieldUpdateOperationsInput | string;
    referenceId?: NullableStringFieldUpdateOperationsInput | string | null;
    referenceType?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type MitraTransactionCreateManyInput = {
    id?: string;
    walletId: string;
    amount: Decimal | DecimalJsLike | number | string;
    type: $Enums.MitraTransactionType;
    description: string;
    referenceId?: string | null;
    referenceType?: string | null;
    createdAt?: Date | string;
    tenantId?: string | null;
  };

  export type MitraTransactionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    amount?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    type?:
      | EnumMitraTransactionTypeFieldUpdateOperationsInput
      | $Enums.MitraTransactionType;
    description?: StringFieldUpdateOperationsInput | string;
    referenceId?: NullableStringFieldUpdateOperationsInput | string | null;
    referenceType?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type MitraTransactionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    walletId?: StringFieldUpdateOperationsInput | string;
    amount?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    type?:
      | EnumMitraTransactionTypeFieldUpdateOperationsInput
      | $Enums.MitraTransactionType;
    description?: StringFieldUpdateOperationsInput | string;
    referenceId?: NullableStringFieldUpdateOperationsInput | string | null;
    referenceType?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type WithdrawRequestCreateInput = {
    id?: string;
    amount: number;
    bankName: string;
    bankAccountNo: string;
    bankAccountName: string;
    status?: $Enums.WithdrawStatus;
    method?: $Enums.WithdrawMethod;
    notes?: string | null;
    processedById?: string | null;
    processedAt?: Date | string | null;
    rejectionReason?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    mitra: MitraCreateNestedOneWithoutWithdrawalsRequestedInput;
    mitraWallet?: MitraWalletCreateNestedOneWithoutWithdrawalsInput;
  };

  export type WithdrawRequestUncheckedCreateInput = {
    id?: string;
    mitraId: string;
    amount: number;
    bankName: string;
    bankAccountNo: string;
    bankAccountName: string;
    status?: $Enums.WithdrawStatus;
    method?: $Enums.WithdrawMethod;
    notes?: string | null;
    processedById?: string | null;
    processedAt?: Date | string | null;
    rejectionReason?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    mitraWalletId?: string | null;
    tenantId?: string | null;
  };

  export type WithdrawRequestUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    amount?: FloatFieldUpdateOperationsInput | number;
    bankName?: StringFieldUpdateOperationsInput | string;
    bankAccountNo?: StringFieldUpdateOperationsInput | string;
    bankAccountName?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumWithdrawStatusFieldUpdateOperationsInput
      | $Enums.WithdrawStatus;
    method?:
      | EnumWithdrawMethodFieldUpdateOperationsInput
      | $Enums.WithdrawMethod;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    processedById?: NullableStringFieldUpdateOperationsInput | string | null;
    processedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitra?: MitraUpdateOneRequiredWithoutWithdrawalsRequestedNestedInput;
    mitraWallet?: MitraWalletUpdateOneWithoutWithdrawalsNestedInput;
  };

  export type WithdrawRequestUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    mitraId?: StringFieldUpdateOperationsInput | string;
    amount?: FloatFieldUpdateOperationsInput | number;
    bankName?: StringFieldUpdateOperationsInput | string;
    bankAccountNo?: StringFieldUpdateOperationsInput | string;
    bankAccountName?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumWithdrawStatusFieldUpdateOperationsInput
      | $Enums.WithdrawStatus;
    method?:
      | EnumWithdrawMethodFieldUpdateOperationsInput
      | $Enums.WithdrawMethod;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    processedById?: NullableStringFieldUpdateOperationsInput | string | null;
    processedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    mitraWalletId?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type WithdrawRequestCreateManyInput = {
    id?: string;
    mitraId: string;
    amount: number;
    bankName: string;
    bankAccountNo: string;
    bankAccountName: string;
    status?: $Enums.WithdrawStatus;
    method?: $Enums.WithdrawMethod;
    notes?: string | null;
    processedById?: string | null;
    processedAt?: Date | string | null;
    rejectionReason?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    mitraWalletId?: string | null;
    tenantId?: string | null;
  };

  export type WithdrawRequestUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    amount?: FloatFieldUpdateOperationsInput | number;
    bankName?: StringFieldUpdateOperationsInput | string;
    bankAccountNo?: StringFieldUpdateOperationsInput | string;
    bankAccountName?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumWithdrawStatusFieldUpdateOperationsInput
      | $Enums.WithdrawStatus;
    method?:
      | EnumWithdrawMethodFieldUpdateOperationsInput
      | $Enums.WithdrawMethod;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    processedById?: NullableStringFieldUpdateOperationsInput | string | null;
    processedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type WithdrawRequestUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    mitraId?: StringFieldUpdateOperationsInput | string;
    amount?: FloatFieldUpdateOperationsInput | number;
    bankName?: StringFieldUpdateOperationsInput | string;
    bankAccountNo?: StringFieldUpdateOperationsInput | string;
    bankAccountName?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumWithdrawStatusFieldUpdateOperationsInput
      | $Enums.WithdrawStatus;
    method?:
      | EnumWithdrawMethodFieldUpdateOperationsInput
      | $Enums.WithdrawMethod;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    processedById?: NullableStringFieldUpdateOperationsInput | string | null;
    processedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    mitraWalletId?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type FaceVerificationLogCreateInput = {
    id?: string;
    photoUrl: string;
    latitude?: number | null;
    longitude?: number | null;
    deviceInfo?: string | null;
    createdAt?: Date | string;
    tenantId?: string | null;
    mitra: MitraCreateNestedOneWithoutFaceVerificationLogsInput;
  };

  export type FaceVerificationLogUncheckedCreateInput = {
    id?: string;
    mitraId: string;
    photoUrl: string;
    latitude?: number | null;
    longitude?: number | null;
    deviceInfo?: string | null;
    createdAt?: Date | string;
    tenantId?: string | null;
  };

  export type FaceVerificationLogUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    photoUrl?: StringFieldUpdateOperationsInput | string;
    latitude?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitude?: NullableFloatFieldUpdateOperationsInput | number | null;
    deviceInfo?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitra?: MitraUpdateOneRequiredWithoutFaceVerificationLogsNestedInput;
  };

  export type FaceVerificationLogUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    mitraId?: StringFieldUpdateOperationsInput | string;
    photoUrl?: StringFieldUpdateOperationsInput | string;
    latitude?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitude?: NullableFloatFieldUpdateOperationsInput | number | null;
    deviceInfo?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type FaceVerificationLogCreateManyInput = {
    id?: string;
    mitraId: string;
    photoUrl: string;
    latitude?: number | null;
    longitude?: number | null;
    deviceInfo?: string | null;
    createdAt?: Date | string;
    tenantId?: string | null;
  };

  export type FaceVerificationLogUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    photoUrl?: StringFieldUpdateOperationsInput | string;
    latitude?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitude?: NullableFloatFieldUpdateOperationsInput | number | null;
    deviceInfo?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type FaceVerificationLogUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    mitraId?: StringFieldUpdateOperationsInput | string;
    photoUrl?: StringFieldUpdateOperationsInput | string;
    latitude?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitude?: NullableFloatFieldUpdateOperationsInput | number | null;
    deviceInfo?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?: NestedStringFilter<$PrismaModel> | string;
  };

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?: NestedStringNullableFilter<$PrismaModel> | string | null;
  };

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolFilter<$PrismaModel> | boolean;
  };

  export type EnumMitraTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.MitraType | EnumMitraTypeFieldRefInput<$PrismaModel>;
    in?: $Enums.MitraType[] | ListEnumMitraTypeFieldRefInput<$PrismaModel>;
    notIn?: $Enums.MitraType[] | ListEnumMitraTypeFieldRefInput<$PrismaModel>;
    not?: NestedEnumMitraTypeFilter<$PrismaModel> | $Enums.MitraType;
  };

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null;
  };

  export type StringNullableListFilter<$PrismaModel = never> = {
    equals?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    has?: string | StringFieldRefInput<$PrismaModel> | null;
    hasEvery?: string[] | ListStringFieldRefInput<$PrismaModel>;
    hasSome?: string[] | ListStringFieldRefInput<$PrismaModel>;
    isEmpty?: boolean;
  };

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null;
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntNullableFilter<$PrismaModel> | number | null;
  };

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[] | ListIntFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntFilter<$PrismaModel> | number;
  };

  export type FloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null;
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null;
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null;
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null;
  };

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string;
  };

  export type MitraWalletNullableScalarRelationFilter = {
    is?: MitraWalletWhereInput | null;
    isNot?: MitraWalletWhereInput | null;
  };

  export type WithdrawRequestListRelationFilter = {
    every?: WithdrawRequestWhereInput;
    some?: WithdrawRequestWhereInput;
    none?: WithdrawRequestWhereInput;
  };

  export type FaceVerificationLogListRelationFilter = {
    every?: FaceVerificationLogWhereInput;
    some?: FaceVerificationLogWhereInput;
    none?: FaceVerificationLogWhereInput;
  };

  export type SortOrderInput = {
    sort: SortOrder;
    nulls?: NullsOrder;
  };

  export type WithdrawRequestOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type FaceVerificationLogOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type MitraTenantIdEmailCompoundUniqueInput = {
    tenantId: string;
    email: string;
  };

  export type MitraTenantIdNikCompoundUniqueInput = {
    tenantId: string;
    nik: string;
  };

  export type MitraCountOrderByAggregateInput = {
    id?: SortOrder;
    name?: SortOrder;
    email?: SortOrder;
    passwordHash?: SortOrder;
    phone?: SortOrder;
    isActive?: SortOrder;
    siteId?: SortOrder;
    mitraType?: SortOrder;
    pushToken?: SortOrder;
    pushTokenUpdatedAt?: SortOrder;
    fcmTokens?: SortOrder;
    lastVersionCode?: SortOrder;
    lastVersionName?: SortOrder;
    lastVersionUpdate?: SortOrder;
    tokenVersion?: SortOrder;
    mitraRateWoPsb?: SortOrder;
    mitraRateWoMaintenance?: SortOrder;
    mitraRateCanvasing?: SortOrder;
    bankName?: SortOrder;
    bankAccountNo?: SortOrder;
    bankAccountName?: SortOrder;
    targetHarian?: SortOrder;
    minWithdrawal?: SortOrder;
    nik?: SortOrder;
    tempatLahir?: SortOrder;
    tanggalLahir?: SortOrder;
    alamat?: SortOrder;
    latitudeRumah?: SortOrder;
    longitudeRumah?: SortOrder;
    fotoDiri?: SortOrder;
    fotoKtp?: SortOrder;
    fotoSim?: SortOrder;
    fotoKk?: SortOrder;
    requiresFaceVerification?: SortOrder;
    lastFaceVerification?: SortOrder;
    garansiHari?: SortOrder;
    slaGaransiJam?: SortOrder;
    penaltyPsb?: SortOrder;
    penaltyMaintenance?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type MitraAvgOrderByAggregateInput = {
    lastVersionCode?: SortOrder;
    tokenVersion?: SortOrder;
    mitraRateWoPsb?: SortOrder;
    mitraRateWoMaintenance?: SortOrder;
    mitraRateCanvasing?: SortOrder;
    targetHarian?: SortOrder;
    minWithdrawal?: SortOrder;
    latitudeRumah?: SortOrder;
    longitudeRumah?: SortOrder;
    garansiHari?: SortOrder;
    slaGaransiJam?: SortOrder;
    penaltyPsb?: SortOrder;
    penaltyMaintenance?: SortOrder;
  };

  export type MitraMaxOrderByAggregateInput = {
    id?: SortOrder;
    name?: SortOrder;
    email?: SortOrder;
    passwordHash?: SortOrder;
    phone?: SortOrder;
    isActive?: SortOrder;
    siteId?: SortOrder;
    mitraType?: SortOrder;
    pushToken?: SortOrder;
    pushTokenUpdatedAt?: SortOrder;
    lastVersionCode?: SortOrder;
    lastVersionName?: SortOrder;
    lastVersionUpdate?: SortOrder;
    tokenVersion?: SortOrder;
    mitraRateWoPsb?: SortOrder;
    mitraRateWoMaintenance?: SortOrder;
    mitraRateCanvasing?: SortOrder;
    bankName?: SortOrder;
    bankAccountNo?: SortOrder;
    bankAccountName?: SortOrder;
    targetHarian?: SortOrder;
    minWithdrawal?: SortOrder;
    nik?: SortOrder;
    tempatLahir?: SortOrder;
    tanggalLahir?: SortOrder;
    alamat?: SortOrder;
    latitudeRumah?: SortOrder;
    longitudeRumah?: SortOrder;
    fotoDiri?: SortOrder;
    fotoKtp?: SortOrder;
    fotoSim?: SortOrder;
    fotoKk?: SortOrder;
    requiresFaceVerification?: SortOrder;
    lastFaceVerification?: SortOrder;
    garansiHari?: SortOrder;
    slaGaransiJam?: SortOrder;
    penaltyPsb?: SortOrder;
    penaltyMaintenance?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type MitraMinOrderByAggregateInput = {
    id?: SortOrder;
    name?: SortOrder;
    email?: SortOrder;
    passwordHash?: SortOrder;
    phone?: SortOrder;
    isActive?: SortOrder;
    siteId?: SortOrder;
    mitraType?: SortOrder;
    pushToken?: SortOrder;
    pushTokenUpdatedAt?: SortOrder;
    lastVersionCode?: SortOrder;
    lastVersionName?: SortOrder;
    lastVersionUpdate?: SortOrder;
    tokenVersion?: SortOrder;
    mitraRateWoPsb?: SortOrder;
    mitraRateWoMaintenance?: SortOrder;
    mitraRateCanvasing?: SortOrder;
    bankName?: SortOrder;
    bankAccountNo?: SortOrder;
    bankAccountName?: SortOrder;
    targetHarian?: SortOrder;
    minWithdrawal?: SortOrder;
    nik?: SortOrder;
    tempatLahir?: SortOrder;
    tanggalLahir?: SortOrder;
    alamat?: SortOrder;
    latitudeRumah?: SortOrder;
    longitudeRumah?: SortOrder;
    fotoDiri?: SortOrder;
    fotoKtp?: SortOrder;
    fotoSim?: SortOrder;
    fotoKk?: SortOrder;
    requiresFaceVerification?: SortOrder;
    lastFaceVerification?: SortOrder;
    garansiHari?: SortOrder;
    slaGaransiJam?: SortOrder;
    penaltyPsb?: SortOrder;
    penaltyMaintenance?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type MitraSumOrderByAggregateInput = {
    lastVersionCode?: SortOrder;
    tokenVersion?: SortOrder;
    mitraRateWoPsb?: SortOrder;
    mitraRateWoMaintenance?: SortOrder;
    mitraRateCanvasing?: SortOrder;
    targetHarian?: SortOrder;
    minWithdrawal?: SortOrder;
    latitudeRumah?: SortOrder;
    longitudeRumah?: SortOrder;
    garansiHari?: SortOrder;
    slaGaransiJam?: SortOrder;
    penaltyPsb?: SortOrder;
    penaltyMaintenance?: SortOrder;
  };

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedStringFilter<$PrismaModel>;
    _max?: NestedStringFilter<$PrismaModel>;
  };

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?:
      | NestedStringNullableWithAggregatesFilter<$PrismaModel>
      | string
      | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedStringNullableFilter<$PrismaModel>;
    _max?: NestedStringNullableFilter<$PrismaModel>;
  };

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedBoolFilter<$PrismaModel>;
    _max?: NestedBoolFilter<$PrismaModel>;
  };

  export type EnumMitraTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.MitraType | EnumMitraTypeFieldRefInput<$PrismaModel>;
    in?: $Enums.MitraType[] | ListEnumMitraTypeFieldRefInput<$PrismaModel>;
    notIn?: $Enums.MitraType[] | ListEnumMitraTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumMitraTypeWithAggregatesFilter<$PrismaModel>
      | $Enums.MitraType;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumMitraTypeFilter<$PrismaModel>;
    _max?: NestedEnumMitraTypeFilter<$PrismaModel>;
  };

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?:
      | NestedDateTimeNullableWithAggregatesFilter<$PrismaModel>
      | Date
      | string
      | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedDateTimeNullableFilter<$PrismaModel>;
    _max?: NestedDateTimeNullableFilter<$PrismaModel>;
  };

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null;
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _avg?: NestedFloatNullableFilter<$PrismaModel>;
    _sum?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedIntNullableFilter<$PrismaModel>;
    _max?: NestedIntNullableFilter<$PrismaModel>;
  };

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[] | ListIntFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number;
    _count?: NestedIntFilter<$PrismaModel>;
    _avg?: NestedFloatFilter<$PrismaModel>;
    _sum?: NestedIntFilter<$PrismaModel>;
    _min?: NestedIntFilter<$PrismaModel>;
    _max?: NestedIntFilter<$PrismaModel>;
  };

  export type FloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null;
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null;
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null;
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _avg?: NestedFloatNullableFilter<$PrismaModel>;
    _sum?: NestedFloatNullableFilter<$PrismaModel>;
    _min?: NestedFloatNullableFilter<$PrismaModel>;
    _max?: NestedFloatNullableFilter<$PrismaModel>;
  };

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedDateTimeFilter<$PrismaModel>;
    _max?: NestedDateTimeFilter<$PrismaModel>;
  };

  export type DecimalFilter<$PrismaModel = never> = {
    equals?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    in?:
      | Decimal[]
      | DecimalJsLike[]
      | number[]
      | string[]
      | ListDecimalFieldRefInput<$PrismaModel>;
    notIn?:
      | Decimal[]
      | DecimalJsLike[]
      | number[]
      | string[]
      | ListDecimalFieldRefInput<$PrismaModel>;
    lt?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    lte?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    gt?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    gte?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    not?:
      | NestedDecimalFilter<$PrismaModel>
      | Decimal
      | DecimalJsLike
      | number
      | string;
  };

  export type MitraScalarRelationFilter = {
    is?: MitraWhereInput;
    isNot?: MitraWhereInput;
  };

  export type MitraTransactionListRelationFilter = {
    every?: MitraTransactionWhereInput;
    some?: MitraTransactionWhereInput;
    none?: MitraTransactionWhereInput;
  };

  export type MitraTransactionOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type MitraWalletCountOrderByAggregateInput = {
    id?: SortOrder;
    mitraId?: SortOrder;
    balance?: SortOrder;
    totalEarnings?: SortOrder;
    totalWithdrawn?: SortOrder;
    currency?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type MitraWalletAvgOrderByAggregateInput = {
    balance?: SortOrder;
    totalEarnings?: SortOrder;
    totalWithdrawn?: SortOrder;
  };

  export type MitraWalletMaxOrderByAggregateInput = {
    id?: SortOrder;
    mitraId?: SortOrder;
    balance?: SortOrder;
    totalEarnings?: SortOrder;
    totalWithdrawn?: SortOrder;
    currency?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type MitraWalletMinOrderByAggregateInput = {
    id?: SortOrder;
    mitraId?: SortOrder;
    balance?: SortOrder;
    totalEarnings?: SortOrder;
    totalWithdrawn?: SortOrder;
    currency?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type MitraWalletSumOrderByAggregateInput = {
    balance?: SortOrder;
    totalEarnings?: SortOrder;
    totalWithdrawn?: SortOrder;
  };

  export type DecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    in?:
      | Decimal[]
      | DecimalJsLike[]
      | number[]
      | string[]
      | ListDecimalFieldRefInput<$PrismaModel>;
    notIn?:
      | Decimal[]
      | DecimalJsLike[]
      | number[]
      | string[]
      | ListDecimalFieldRefInput<$PrismaModel>;
    lt?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    lte?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    gt?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    gte?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    not?:
      | NestedDecimalWithAggregatesFilter<$PrismaModel>
      | Decimal
      | DecimalJsLike
      | number
      | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _avg?: NestedDecimalFilter<$PrismaModel>;
    _sum?: NestedDecimalFilter<$PrismaModel>;
    _min?: NestedDecimalFilter<$PrismaModel>;
    _max?: NestedDecimalFilter<$PrismaModel>;
  };

  export type EnumMitraTransactionTypeFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.MitraTransactionType
      | EnumMitraTransactionTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.MitraTransactionType[]
      | ListEnumMitraTransactionTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.MitraTransactionType[]
      | ListEnumMitraTransactionTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumMitraTransactionTypeFilter<$PrismaModel>
      | $Enums.MitraTransactionType;
  };

  export type MitraWalletScalarRelationFilter = {
    is?: MitraWalletWhereInput;
    isNot?: MitraWalletWhereInput;
  };

  export type MitraTransactionCountOrderByAggregateInput = {
    id?: SortOrder;
    walletId?: SortOrder;
    amount?: SortOrder;
    type?: SortOrder;
    description?: SortOrder;
    referenceId?: SortOrder;
    referenceType?: SortOrder;
    createdAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type MitraTransactionAvgOrderByAggregateInput = {
    amount?: SortOrder;
  };

  export type MitraTransactionMaxOrderByAggregateInput = {
    id?: SortOrder;
    walletId?: SortOrder;
    amount?: SortOrder;
    type?: SortOrder;
    description?: SortOrder;
    referenceId?: SortOrder;
    referenceType?: SortOrder;
    createdAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type MitraTransactionMinOrderByAggregateInput = {
    id?: SortOrder;
    walletId?: SortOrder;
    amount?: SortOrder;
    type?: SortOrder;
    description?: SortOrder;
    referenceId?: SortOrder;
    referenceType?: SortOrder;
    createdAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type MitraTransactionSumOrderByAggregateInput = {
    amount?: SortOrder;
  };

  export type EnumMitraTransactionTypeWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.MitraTransactionType
      | EnumMitraTransactionTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.MitraTransactionType[]
      | ListEnumMitraTransactionTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.MitraTransactionType[]
      | ListEnumMitraTransactionTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumMitraTransactionTypeWithAggregatesFilter<$PrismaModel>
      | $Enums.MitraTransactionType;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumMitraTransactionTypeFilter<$PrismaModel>;
    _max?: NestedEnumMitraTransactionTypeFilter<$PrismaModel>;
  };

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>;
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>;
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatFilter<$PrismaModel> | number;
  };

  export type EnumWithdrawStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.WithdrawStatus
      | EnumWithdrawStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.WithdrawStatus[]
      | ListEnumWithdrawStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.WithdrawStatus[]
      | ListEnumWithdrawStatusFieldRefInput<$PrismaModel>;
    not?: NestedEnumWithdrawStatusFilter<$PrismaModel> | $Enums.WithdrawStatus;
  };

  export type EnumWithdrawMethodFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.WithdrawMethod
      | EnumWithdrawMethodFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.WithdrawMethod[]
      | ListEnumWithdrawMethodFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.WithdrawMethod[]
      | ListEnumWithdrawMethodFieldRefInput<$PrismaModel>;
    not?: NestedEnumWithdrawMethodFilter<$PrismaModel> | $Enums.WithdrawMethod;
  };

  export type WithdrawRequestCountOrderByAggregateInput = {
    id?: SortOrder;
    mitraId?: SortOrder;
    amount?: SortOrder;
    bankName?: SortOrder;
    bankAccountNo?: SortOrder;
    bankAccountName?: SortOrder;
    status?: SortOrder;
    method?: SortOrder;
    notes?: SortOrder;
    processedById?: SortOrder;
    processedAt?: SortOrder;
    rejectionReason?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    mitraWalletId?: SortOrder;
    tenantId?: SortOrder;
  };

  export type WithdrawRequestAvgOrderByAggregateInput = {
    amount?: SortOrder;
  };

  export type WithdrawRequestMaxOrderByAggregateInput = {
    id?: SortOrder;
    mitraId?: SortOrder;
    amount?: SortOrder;
    bankName?: SortOrder;
    bankAccountNo?: SortOrder;
    bankAccountName?: SortOrder;
    status?: SortOrder;
    method?: SortOrder;
    notes?: SortOrder;
    processedById?: SortOrder;
    processedAt?: SortOrder;
    rejectionReason?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    mitraWalletId?: SortOrder;
    tenantId?: SortOrder;
  };

  export type WithdrawRequestMinOrderByAggregateInput = {
    id?: SortOrder;
    mitraId?: SortOrder;
    amount?: SortOrder;
    bankName?: SortOrder;
    bankAccountNo?: SortOrder;
    bankAccountName?: SortOrder;
    status?: SortOrder;
    method?: SortOrder;
    notes?: SortOrder;
    processedById?: SortOrder;
    processedAt?: SortOrder;
    rejectionReason?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    mitraWalletId?: SortOrder;
    tenantId?: SortOrder;
  };

  export type WithdrawRequestSumOrderByAggregateInput = {
    amount?: SortOrder;
  };

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>;
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>;
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number;
    _count?: NestedIntFilter<$PrismaModel>;
    _avg?: NestedFloatFilter<$PrismaModel>;
    _sum?: NestedFloatFilter<$PrismaModel>;
    _min?: NestedFloatFilter<$PrismaModel>;
    _max?: NestedFloatFilter<$PrismaModel>;
  };

  export type EnumWithdrawStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.WithdrawStatus
      | EnumWithdrawStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.WithdrawStatus[]
      | ListEnumWithdrawStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.WithdrawStatus[]
      | ListEnumWithdrawStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumWithdrawStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.WithdrawStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumWithdrawStatusFilter<$PrismaModel>;
    _max?: NestedEnumWithdrawStatusFilter<$PrismaModel>;
  };

  export type EnumWithdrawMethodWithAggregatesFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.WithdrawMethod
      | EnumWithdrawMethodFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.WithdrawMethod[]
      | ListEnumWithdrawMethodFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.WithdrawMethod[]
      | ListEnumWithdrawMethodFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumWithdrawMethodWithAggregatesFilter<$PrismaModel>
      | $Enums.WithdrawMethod;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumWithdrawMethodFilter<$PrismaModel>;
    _max?: NestedEnumWithdrawMethodFilter<$PrismaModel>;
  };

  export type FaceVerificationLogCountOrderByAggregateInput = {
    id?: SortOrder;
    mitraId?: SortOrder;
    photoUrl?: SortOrder;
    latitude?: SortOrder;
    longitude?: SortOrder;
    deviceInfo?: SortOrder;
    createdAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type FaceVerificationLogAvgOrderByAggregateInput = {
    latitude?: SortOrder;
    longitude?: SortOrder;
  };

  export type FaceVerificationLogMaxOrderByAggregateInput = {
    id?: SortOrder;
    mitraId?: SortOrder;
    photoUrl?: SortOrder;
    latitude?: SortOrder;
    longitude?: SortOrder;
    deviceInfo?: SortOrder;
    createdAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type FaceVerificationLogMinOrderByAggregateInput = {
    id?: SortOrder;
    mitraId?: SortOrder;
    photoUrl?: SortOrder;
    latitude?: SortOrder;
    longitude?: SortOrder;
    deviceInfo?: SortOrder;
    createdAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type FaceVerificationLogSumOrderByAggregateInput = {
    latitude?: SortOrder;
    longitude?: SortOrder;
  };

  export type MitraCreatefcmTokensInput = {
    set: string[];
  };

  export type MitraWalletCreateNestedOneWithoutMitraInput = {
    create?: XOR<
      MitraWalletCreateWithoutMitraInput,
      MitraWalletUncheckedCreateWithoutMitraInput
    >;
    connectOrCreate?: MitraWalletCreateOrConnectWithoutMitraInput;
    connect?: MitraWalletWhereUniqueInput;
  };

  export type WithdrawRequestCreateNestedManyWithoutMitraInput = {
    create?:
      | XOR<
          WithdrawRequestCreateWithoutMitraInput,
          WithdrawRequestUncheckedCreateWithoutMitraInput
        >
      | WithdrawRequestCreateWithoutMitraInput[]
      | WithdrawRequestUncheckedCreateWithoutMitraInput[];
    connectOrCreate?:
      | WithdrawRequestCreateOrConnectWithoutMitraInput
      | WithdrawRequestCreateOrConnectWithoutMitraInput[];
    createMany?: WithdrawRequestCreateManyMitraInputEnvelope;
    connect?:
      | WithdrawRequestWhereUniqueInput
      | WithdrawRequestWhereUniqueInput[];
  };

  export type FaceVerificationLogCreateNestedManyWithoutMitraInput = {
    create?:
      | XOR<
          FaceVerificationLogCreateWithoutMitraInput,
          FaceVerificationLogUncheckedCreateWithoutMitraInput
        >
      | FaceVerificationLogCreateWithoutMitraInput[]
      | FaceVerificationLogUncheckedCreateWithoutMitraInput[];
    connectOrCreate?:
      | FaceVerificationLogCreateOrConnectWithoutMitraInput
      | FaceVerificationLogCreateOrConnectWithoutMitraInput[];
    createMany?: FaceVerificationLogCreateManyMitraInputEnvelope;
    connect?:
      | FaceVerificationLogWhereUniqueInput
      | FaceVerificationLogWhereUniqueInput[];
  };

  export type MitraWalletUncheckedCreateNestedOneWithoutMitraInput = {
    create?: XOR<
      MitraWalletCreateWithoutMitraInput,
      MitraWalletUncheckedCreateWithoutMitraInput
    >;
    connectOrCreate?: MitraWalletCreateOrConnectWithoutMitraInput;
    connect?: MitraWalletWhereUniqueInput;
  };

  export type WithdrawRequestUncheckedCreateNestedManyWithoutMitraInput = {
    create?:
      | XOR<
          WithdrawRequestCreateWithoutMitraInput,
          WithdrawRequestUncheckedCreateWithoutMitraInput
        >
      | WithdrawRequestCreateWithoutMitraInput[]
      | WithdrawRequestUncheckedCreateWithoutMitraInput[];
    connectOrCreate?:
      | WithdrawRequestCreateOrConnectWithoutMitraInput
      | WithdrawRequestCreateOrConnectWithoutMitraInput[];
    createMany?: WithdrawRequestCreateManyMitraInputEnvelope;
    connect?:
      | WithdrawRequestWhereUniqueInput
      | WithdrawRequestWhereUniqueInput[];
  };

  export type FaceVerificationLogUncheckedCreateNestedManyWithoutMitraInput = {
    create?:
      | XOR<
          FaceVerificationLogCreateWithoutMitraInput,
          FaceVerificationLogUncheckedCreateWithoutMitraInput
        >
      | FaceVerificationLogCreateWithoutMitraInput[]
      | FaceVerificationLogUncheckedCreateWithoutMitraInput[];
    connectOrCreate?:
      | FaceVerificationLogCreateOrConnectWithoutMitraInput
      | FaceVerificationLogCreateOrConnectWithoutMitraInput[];
    createMany?: FaceVerificationLogCreateManyMitraInputEnvelope;
    connect?:
      | FaceVerificationLogWhereUniqueInput
      | FaceVerificationLogWhereUniqueInput[];
  };

  export type StringFieldUpdateOperationsInput = {
    set?: string;
  };

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null;
  };

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean;
  };

  export type EnumMitraTypeFieldUpdateOperationsInput = {
    set?: $Enums.MitraType;
  };

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null;
  };

  export type MitraUpdatefcmTokensInput = {
    set?: string[];
    push?: string | string[];
  };

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
  };

  export type IntFieldUpdateOperationsInput = {
    set?: number;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
  };

  export type NullableFloatFieldUpdateOperationsInput = {
    set?: number | null;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
  };

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string;
  };

  export type MitraWalletUpdateOneWithoutMitraNestedInput = {
    create?: XOR<
      MitraWalletCreateWithoutMitraInput,
      MitraWalletUncheckedCreateWithoutMitraInput
    >;
    connectOrCreate?: MitraWalletCreateOrConnectWithoutMitraInput;
    upsert?: MitraWalletUpsertWithoutMitraInput;
    disconnect?: MitraWalletWhereInput | boolean;
    delete?: MitraWalletWhereInput | boolean;
    connect?: MitraWalletWhereUniqueInput;
    update?: XOR<
      XOR<
        MitraWalletUpdateToOneWithWhereWithoutMitraInput,
        MitraWalletUpdateWithoutMitraInput
      >,
      MitraWalletUncheckedUpdateWithoutMitraInput
    >;
  };

  export type WithdrawRequestUpdateManyWithoutMitraNestedInput = {
    create?:
      | XOR<
          WithdrawRequestCreateWithoutMitraInput,
          WithdrawRequestUncheckedCreateWithoutMitraInput
        >
      | WithdrawRequestCreateWithoutMitraInput[]
      | WithdrawRequestUncheckedCreateWithoutMitraInput[];
    connectOrCreate?:
      | WithdrawRequestCreateOrConnectWithoutMitraInput
      | WithdrawRequestCreateOrConnectWithoutMitraInput[];
    upsert?:
      | WithdrawRequestUpsertWithWhereUniqueWithoutMitraInput
      | WithdrawRequestUpsertWithWhereUniqueWithoutMitraInput[];
    createMany?: WithdrawRequestCreateManyMitraInputEnvelope;
    set?: WithdrawRequestWhereUniqueInput | WithdrawRequestWhereUniqueInput[];
    disconnect?:
      | WithdrawRequestWhereUniqueInput
      | WithdrawRequestWhereUniqueInput[];
    delete?:
      | WithdrawRequestWhereUniqueInput
      | WithdrawRequestWhereUniqueInput[];
    connect?:
      | WithdrawRequestWhereUniqueInput
      | WithdrawRequestWhereUniqueInput[];
    update?:
      | WithdrawRequestUpdateWithWhereUniqueWithoutMitraInput
      | WithdrawRequestUpdateWithWhereUniqueWithoutMitraInput[];
    updateMany?:
      | WithdrawRequestUpdateManyWithWhereWithoutMitraInput
      | WithdrawRequestUpdateManyWithWhereWithoutMitraInput[];
    deleteMany?:
      | WithdrawRequestScalarWhereInput
      | WithdrawRequestScalarWhereInput[];
  };

  export type FaceVerificationLogUpdateManyWithoutMitraNestedInput = {
    create?:
      | XOR<
          FaceVerificationLogCreateWithoutMitraInput,
          FaceVerificationLogUncheckedCreateWithoutMitraInput
        >
      | FaceVerificationLogCreateWithoutMitraInput[]
      | FaceVerificationLogUncheckedCreateWithoutMitraInput[];
    connectOrCreate?:
      | FaceVerificationLogCreateOrConnectWithoutMitraInput
      | FaceVerificationLogCreateOrConnectWithoutMitraInput[];
    upsert?:
      | FaceVerificationLogUpsertWithWhereUniqueWithoutMitraInput
      | FaceVerificationLogUpsertWithWhereUniqueWithoutMitraInput[];
    createMany?: FaceVerificationLogCreateManyMitraInputEnvelope;
    set?:
      | FaceVerificationLogWhereUniqueInput
      | FaceVerificationLogWhereUniqueInput[];
    disconnect?:
      | FaceVerificationLogWhereUniqueInput
      | FaceVerificationLogWhereUniqueInput[];
    delete?:
      | FaceVerificationLogWhereUniqueInput
      | FaceVerificationLogWhereUniqueInput[];
    connect?:
      | FaceVerificationLogWhereUniqueInput
      | FaceVerificationLogWhereUniqueInput[];
    update?:
      | FaceVerificationLogUpdateWithWhereUniqueWithoutMitraInput
      | FaceVerificationLogUpdateWithWhereUniqueWithoutMitraInput[];
    updateMany?:
      | FaceVerificationLogUpdateManyWithWhereWithoutMitraInput
      | FaceVerificationLogUpdateManyWithWhereWithoutMitraInput[];
    deleteMany?:
      | FaceVerificationLogScalarWhereInput
      | FaceVerificationLogScalarWhereInput[];
  };

  export type MitraWalletUncheckedUpdateOneWithoutMitraNestedInput = {
    create?: XOR<
      MitraWalletCreateWithoutMitraInput,
      MitraWalletUncheckedCreateWithoutMitraInput
    >;
    connectOrCreate?: MitraWalletCreateOrConnectWithoutMitraInput;
    upsert?: MitraWalletUpsertWithoutMitraInput;
    disconnect?: MitraWalletWhereInput | boolean;
    delete?: MitraWalletWhereInput | boolean;
    connect?: MitraWalletWhereUniqueInput;
    update?: XOR<
      XOR<
        MitraWalletUpdateToOneWithWhereWithoutMitraInput,
        MitraWalletUpdateWithoutMitraInput
      >,
      MitraWalletUncheckedUpdateWithoutMitraInput
    >;
  };

  export type WithdrawRequestUncheckedUpdateManyWithoutMitraNestedInput = {
    create?:
      | XOR<
          WithdrawRequestCreateWithoutMitraInput,
          WithdrawRequestUncheckedCreateWithoutMitraInput
        >
      | WithdrawRequestCreateWithoutMitraInput[]
      | WithdrawRequestUncheckedCreateWithoutMitraInput[];
    connectOrCreate?:
      | WithdrawRequestCreateOrConnectWithoutMitraInput
      | WithdrawRequestCreateOrConnectWithoutMitraInput[];
    upsert?:
      | WithdrawRequestUpsertWithWhereUniqueWithoutMitraInput
      | WithdrawRequestUpsertWithWhereUniqueWithoutMitraInput[];
    createMany?: WithdrawRequestCreateManyMitraInputEnvelope;
    set?: WithdrawRequestWhereUniqueInput | WithdrawRequestWhereUniqueInput[];
    disconnect?:
      | WithdrawRequestWhereUniqueInput
      | WithdrawRequestWhereUniqueInput[];
    delete?:
      | WithdrawRequestWhereUniqueInput
      | WithdrawRequestWhereUniqueInput[];
    connect?:
      | WithdrawRequestWhereUniqueInput
      | WithdrawRequestWhereUniqueInput[];
    update?:
      | WithdrawRequestUpdateWithWhereUniqueWithoutMitraInput
      | WithdrawRequestUpdateWithWhereUniqueWithoutMitraInput[];
    updateMany?:
      | WithdrawRequestUpdateManyWithWhereWithoutMitraInput
      | WithdrawRequestUpdateManyWithWhereWithoutMitraInput[];
    deleteMany?:
      | WithdrawRequestScalarWhereInput
      | WithdrawRequestScalarWhereInput[];
  };

  export type FaceVerificationLogUncheckedUpdateManyWithoutMitraNestedInput = {
    create?:
      | XOR<
          FaceVerificationLogCreateWithoutMitraInput,
          FaceVerificationLogUncheckedCreateWithoutMitraInput
        >
      | FaceVerificationLogCreateWithoutMitraInput[]
      | FaceVerificationLogUncheckedCreateWithoutMitraInput[];
    connectOrCreate?:
      | FaceVerificationLogCreateOrConnectWithoutMitraInput
      | FaceVerificationLogCreateOrConnectWithoutMitraInput[];
    upsert?:
      | FaceVerificationLogUpsertWithWhereUniqueWithoutMitraInput
      | FaceVerificationLogUpsertWithWhereUniqueWithoutMitraInput[];
    createMany?: FaceVerificationLogCreateManyMitraInputEnvelope;
    set?:
      | FaceVerificationLogWhereUniqueInput
      | FaceVerificationLogWhereUniqueInput[];
    disconnect?:
      | FaceVerificationLogWhereUniqueInput
      | FaceVerificationLogWhereUniqueInput[];
    delete?:
      | FaceVerificationLogWhereUniqueInput
      | FaceVerificationLogWhereUniqueInput[];
    connect?:
      | FaceVerificationLogWhereUniqueInput
      | FaceVerificationLogWhereUniqueInput[];
    update?:
      | FaceVerificationLogUpdateWithWhereUniqueWithoutMitraInput
      | FaceVerificationLogUpdateWithWhereUniqueWithoutMitraInput[];
    updateMany?:
      | FaceVerificationLogUpdateManyWithWhereWithoutMitraInput
      | FaceVerificationLogUpdateManyWithWhereWithoutMitraInput[];
    deleteMany?:
      | FaceVerificationLogScalarWhereInput
      | FaceVerificationLogScalarWhereInput[];
  };

  export type MitraCreateNestedOneWithoutMitraWalletInput = {
    create?: XOR<
      MitraCreateWithoutMitraWalletInput,
      MitraUncheckedCreateWithoutMitraWalletInput
    >;
    connectOrCreate?: MitraCreateOrConnectWithoutMitraWalletInput;
    connect?: MitraWhereUniqueInput;
  };

  export type MitraTransactionCreateNestedManyWithoutWalletInput = {
    create?:
      | XOR<
          MitraTransactionCreateWithoutWalletInput,
          MitraTransactionUncheckedCreateWithoutWalletInput
        >
      | MitraTransactionCreateWithoutWalletInput[]
      | MitraTransactionUncheckedCreateWithoutWalletInput[];
    connectOrCreate?:
      | MitraTransactionCreateOrConnectWithoutWalletInput
      | MitraTransactionCreateOrConnectWithoutWalletInput[];
    createMany?: MitraTransactionCreateManyWalletInputEnvelope;
    connect?:
      | MitraTransactionWhereUniqueInput
      | MitraTransactionWhereUniqueInput[];
  };

  export type WithdrawRequestCreateNestedManyWithoutMitraWalletInput = {
    create?:
      | XOR<
          WithdrawRequestCreateWithoutMitraWalletInput,
          WithdrawRequestUncheckedCreateWithoutMitraWalletInput
        >
      | WithdrawRequestCreateWithoutMitraWalletInput[]
      | WithdrawRequestUncheckedCreateWithoutMitraWalletInput[];
    connectOrCreate?:
      | WithdrawRequestCreateOrConnectWithoutMitraWalletInput
      | WithdrawRequestCreateOrConnectWithoutMitraWalletInput[];
    createMany?: WithdrawRequestCreateManyMitraWalletInputEnvelope;
    connect?:
      | WithdrawRequestWhereUniqueInput
      | WithdrawRequestWhereUniqueInput[];
  };

  export type MitraTransactionUncheckedCreateNestedManyWithoutWalletInput = {
    create?:
      | XOR<
          MitraTransactionCreateWithoutWalletInput,
          MitraTransactionUncheckedCreateWithoutWalletInput
        >
      | MitraTransactionCreateWithoutWalletInput[]
      | MitraTransactionUncheckedCreateWithoutWalletInput[];
    connectOrCreate?:
      | MitraTransactionCreateOrConnectWithoutWalletInput
      | MitraTransactionCreateOrConnectWithoutWalletInput[];
    createMany?: MitraTransactionCreateManyWalletInputEnvelope;
    connect?:
      | MitraTransactionWhereUniqueInput
      | MitraTransactionWhereUniqueInput[];
  };

  export type WithdrawRequestUncheckedCreateNestedManyWithoutMitraWalletInput =
    {
      create?:
        | XOR<
            WithdrawRequestCreateWithoutMitraWalletInput,
            WithdrawRequestUncheckedCreateWithoutMitraWalletInput
          >
        | WithdrawRequestCreateWithoutMitraWalletInput[]
        | WithdrawRequestUncheckedCreateWithoutMitraWalletInput[];
      connectOrCreate?:
        | WithdrawRequestCreateOrConnectWithoutMitraWalletInput
        | WithdrawRequestCreateOrConnectWithoutMitraWalletInput[];
      createMany?: WithdrawRequestCreateManyMitraWalletInputEnvelope;
      connect?:
        | WithdrawRequestWhereUniqueInput
        | WithdrawRequestWhereUniqueInput[];
    };

  export type DecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string;
    increment?: Decimal | DecimalJsLike | number | string;
    decrement?: Decimal | DecimalJsLike | number | string;
    multiply?: Decimal | DecimalJsLike | number | string;
    divide?: Decimal | DecimalJsLike | number | string;
  };

  export type MitraUpdateOneRequiredWithoutMitraWalletNestedInput = {
    create?: XOR<
      MitraCreateWithoutMitraWalletInput,
      MitraUncheckedCreateWithoutMitraWalletInput
    >;
    connectOrCreate?: MitraCreateOrConnectWithoutMitraWalletInput;
    upsert?: MitraUpsertWithoutMitraWalletInput;
    connect?: MitraWhereUniqueInput;
    update?: XOR<
      XOR<
        MitraUpdateToOneWithWhereWithoutMitraWalletInput,
        MitraUpdateWithoutMitraWalletInput
      >,
      MitraUncheckedUpdateWithoutMitraWalletInput
    >;
  };

  export type MitraTransactionUpdateManyWithoutWalletNestedInput = {
    create?:
      | XOR<
          MitraTransactionCreateWithoutWalletInput,
          MitraTransactionUncheckedCreateWithoutWalletInput
        >
      | MitraTransactionCreateWithoutWalletInput[]
      | MitraTransactionUncheckedCreateWithoutWalletInput[];
    connectOrCreate?:
      | MitraTransactionCreateOrConnectWithoutWalletInput
      | MitraTransactionCreateOrConnectWithoutWalletInput[];
    upsert?:
      | MitraTransactionUpsertWithWhereUniqueWithoutWalletInput
      | MitraTransactionUpsertWithWhereUniqueWithoutWalletInput[];
    createMany?: MitraTransactionCreateManyWalletInputEnvelope;
    set?: MitraTransactionWhereUniqueInput | MitraTransactionWhereUniqueInput[];
    disconnect?:
      | MitraTransactionWhereUniqueInput
      | MitraTransactionWhereUniqueInput[];
    delete?:
      | MitraTransactionWhereUniqueInput
      | MitraTransactionWhereUniqueInput[];
    connect?:
      | MitraTransactionWhereUniqueInput
      | MitraTransactionWhereUniqueInput[];
    update?:
      | MitraTransactionUpdateWithWhereUniqueWithoutWalletInput
      | MitraTransactionUpdateWithWhereUniqueWithoutWalletInput[];
    updateMany?:
      | MitraTransactionUpdateManyWithWhereWithoutWalletInput
      | MitraTransactionUpdateManyWithWhereWithoutWalletInput[];
    deleteMany?:
      | MitraTransactionScalarWhereInput
      | MitraTransactionScalarWhereInput[];
  };

  export type WithdrawRequestUpdateManyWithoutMitraWalletNestedInput = {
    create?:
      | XOR<
          WithdrawRequestCreateWithoutMitraWalletInput,
          WithdrawRequestUncheckedCreateWithoutMitraWalletInput
        >
      | WithdrawRequestCreateWithoutMitraWalletInput[]
      | WithdrawRequestUncheckedCreateWithoutMitraWalletInput[];
    connectOrCreate?:
      | WithdrawRequestCreateOrConnectWithoutMitraWalletInput
      | WithdrawRequestCreateOrConnectWithoutMitraWalletInput[];
    upsert?:
      | WithdrawRequestUpsertWithWhereUniqueWithoutMitraWalletInput
      | WithdrawRequestUpsertWithWhereUniqueWithoutMitraWalletInput[];
    createMany?: WithdrawRequestCreateManyMitraWalletInputEnvelope;
    set?: WithdrawRequestWhereUniqueInput | WithdrawRequestWhereUniqueInput[];
    disconnect?:
      | WithdrawRequestWhereUniqueInput
      | WithdrawRequestWhereUniqueInput[];
    delete?:
      | WithdrawRequestWhereUniqueInput
      | WithdrawRequestWhereUniqueInput[];
    connect?:
      | WithdrawRequestWhereUniqueInput
      | WithdrawRequestWhereUniqueInput[];
    update?:
      | WithdrawRequestUpdateWithWhereUniqueWithoutMitraWalletInput
      | WithdrawRequestUpdateWithWhereUniqueWithoutMitraWalletInput[];
    updateMany?:
      | WithdrawRequestUpdateManyWithWhereWithoutMitraWalletInput
      | WithdrawRequestUpdateManyWithWhereWithoutMitraWalletInput[];
    deleteMany?:
      | WithdrawRequestScalarWhereInput
      | WithdrawRequestScalarWhereInput[];
  };

  export type MitraTransactionUncheckedUpdateManyWithoutWalletNestedInput = {
    create?:
      | XOR<
          MitraTransactionCreateWithoutWalletInput,
          MitraTransactionUncheckedCreateWithoutWalletInput
        >
      | MitraTransactionCreateWithoutWalletInput[]
      | MitraTransactionUncheckedCreateWithoutWalletInput[];
    connectOrCreate?:
      | MitraTransactionCreateOrConnectWithoutWalletInput
      | MitraTransactionCreateOrConnectWithoutWalletInput[];
    upsert?:
      | MitraTransactionUpsertWithWhereUniqueWithoutWalletInput
      | MitraTransactionUpsertWithWhereUniqueWithoutWalletInput[];
    createMany?: MitraTransactionCreateManyWalletInputEnvelope;
    set?: MitraTransactionWhereUniqueInput | MitraTransactionWhereUniqueInput[];
    disconnect?:
      | MitraTransactionWhereUniqueInput
      | MitraTransactionWhereUniqueInput[];
    delete?:
      | MitraTransactionWhereUniqueInput
      | MitraTransactionWhereUniqueInput[];
    connect?:
      | MitraTransactionWhereUniqueInput
      | MitraTransactionWhereUniqueInput[];
    update?:
      | MitraTransactionUpdateWithWhereUniqueWithoutWalletInput
      | MitraTransactionUpdateWithWhereUniqueWithoutWalletInput[];
    updateMany?:
      | MitraTransactionUpdateManyWithWhereWithoutWalletInput
      | MitraTransactionUpdateManyWithWhereWithoutWalletInput[];
    deleteMany?:
      | MitraTransactionScalarWhereInput
      | MitraTransactionScalarWhereInput[];
  };

  export type WithdrawRequestUncheckedUpdateManyWithoutMitraWalletNestedInput =
    {
      create?:
        | XOR<
            WithdrawRequestCreateWithoutMitraWalletInput,
            WithdrawRequestUncheckedCreateWithoutMitraWalletInput
          >
        | WithdrawRequestCreateWithoutMitraWalletInput[]
        | WithdrawRequestUncheckedCreateWithoutMitraWalletInput[];
      connectOrCreate?:
        | WithdrawRequestCreateOrConnectWithoutMitraWalletInput
        | WithdrawRequestCreateOrConnectWithoutMitraWalletInput[];
      upsert?:
        | WithdrawRequestUpsertWithWhereUniqueWithoutMitraWalletInput
        | WithdrawRequestUpsertWithWhereUniqueWithoutMitraWalletInput[];
      createMany?: WithdrawRequestCreateManyMitraWalletInputEnvelope;
      set?: WithdrawRequestWhereUniqueInput | WithdrawRequestWhereUniqueInput[];
      disconnect?:
        | WithdrawRequestWhereUniqueInput
        | WithdrawRequestWhereUniqueInput[];
      delete?:
        | WithdrawRequestWhereUniqueInput
        | WithdrawRequestWhereUniqueInput[];
      connect?:
        | WithdrawRequestWhereUniqueInput
        | WithdrawRequestWhereUniqueInput[];
      update?:
        | WithdrawRequestUpdateWithWhereUniqueWithoutMitraWalletInput
        | WithdrawRequestUpdateWithWhereUniqueWithoutMitraWalletInput[];
      updateMany?:
        | WithdrawRequestUpdateManyWithWhereWithoutMitraWalletInput
        | WithdrawRequestUpdateManyWithWhereWithoutMitraWalletInput[];
      deleteMany?:
        | WithdrawRequestScalarWhereInput
        | WithdrawRequestScalarWhereInput[];
    };

  export type MitraWalletCreateNestedOneWithoutTransactionsInput = {
    create?: XOR<
      MitraWalletCreateWithoutTransactionsInput,
      MitraWalletUncheckedCreateWithoutTransactionsInput
    >;
    connectOrCreate?: MitraWalletCreateOrConnectWithoutTransactionsInput;
    connect?: MitraWalletWhereUniqueInput;
  };

  export type EnumMitraTransactionTypeFieldUpdateOperationsInput = {
    set?: $Enums.MitraTransactionType;
  };

  export type MitraWalletUpdateOneRequiredWithoutTransactionsNestedInput = {
    create?: XOR<
      MitraWalletCreateWithoutTransactionsInput,
      MitraWalletUncheckedCreateWithoutTransactionsInput
    >;
    connectOrCreate?: MitraWalletCreateOrConnectWithoutTransactionsInput;
    upsert?: MitraWalletUpsertWithoutTransactionsInput;
    connect?: MitraWalletWhereUniqueInput;
    update?: XOR<
      XOR<
        MitraWalletUpdateToOneWithWhereWithoutTransactionsInput,
        MitraWalletUpdateWithoutTransactionsInput
      >,
      MitraWalletUncheckedUpdateWithoutTransactionsInput
    >;
  };

  export type MitraCreateNestedOneWithoutWithdrawalsRequestedInput = {
    create?: XOR<
      MitraCreateWithoutWithdrawalsRequestedInput,
      MitraUncheckedCreateWithoutWithdrawalsRequestedInput
    >;
    connectOrCreate?: MitraCreateOrConnectWithoutWithdrawalsRequestedInput;
    connect?: MitraWhereUniqueInput;
  };

  export type MitraWalletCreateNestedOneWithoutWithdrawalsInput = {
    create?: XOR<
      MitraWalletCreateWithoutWithdrawalsInput,
      MitraWalletUncheckedCreateWithoutWithdrawalsInput
    >;
    connectOrCreate?: MitraWalletCreateOrConnectWithoutWithdrawalsInput;
    connect?: MitraWalletWhereUniqueInput;
  };

  export type FloatFieldUpdateOperationsInput = {
    set?: number;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
  };

  export type EnumWithdrawStatusFieldUpdateOperationsInput = {
    set?: $Enums.WithdrawStatus;
  };

  export type EnumWithdrawMethodFieldUpdateOperationsInput = {
    set?: $Enums.WithdrawMethod;
  };

  export type MitraUpdateOneRequiredWithoutWithdrawalsRequestedNestedInput = {
    create?: XOR<
      MitraCreateWithoutWithdrawalsRequestedInput,
      MitraUncheckedCreateWithoutWithdrawalsRequestedInput
    >;
    connectOrCreate?: MitraCreateOrConnectWithoutWithdrawalsRequestedInput;
    upsert?: MitraUpsertWithoutWithdrawalsRequestedInput;
    connect?: MitraWhereUniqueInput;
    update?: XOR<
      XOR<
        MitraUpdateToOneWithWhereWithoutWithdrawalsRequestedInput,
        MitraUpdateWithoutWithdrawalsRequestedInput
      >,
      MitraUncheckedUpdateWithoutWithdrawalsRequestedInput
    >;
  };

  export type MitraWalletUpdateOneWithoutWithdrawalsNestedInput = {
    create?: XOR<
      MitraWalletCreateWithoutWithdrawalsInput,
      MitraWalletUncheckedCreateWithoutWithdrawalsInput
    >;
    connectOrCreate?: MitraWalletCreateOrConnectWithoutWithdrawalsInput;
    upsert?: MitraWalletUpsertWithoutWithdrawalsInput;
    disconnect?: MitraWalletWhereInput | boolean;
    delete?: MitraWalletWhereInput | boolean;
    connect?: MitraWalletWhereUniqueInput;
    update?: XOR<
      XOR<
        MitraWalletUpdateToOneWithWhereWithoutWithdrawalsInput,
        MitraWalletUpdateWithoutWithdrawalsInput
      >,
      MitraWalletUncheckedUpdateWithoutWithdrawalsInput
    >;
  };

  export type MitraCreateNestedOneWithoutFaceVerificationLogsInput = {
    create?: XOR<
      MitraCreateWithoutFaceVerificationLogsInput,
      MitraUncheckedCreateWithoutFaceVerificationLogsInput
    >;
    connectOrCreate?: MitraCreateOrConnectWithoutFaceVerificationLogsInput;
    connect?: MitraWhereUniqueInput;
  };

  export type MitraUpdateOneRequiredWithoutFaceVerificationLogsNestedInput = {
    create?: XOR<
      MitraCreateWithoutFaceVerificationLogsInput,
      MitraUncheckedCreateWithoutFaceVerificationLogsInput
    >;
    connectOrCreate?: MitraCreateOrConnectWithoutFaceVerificationLogsInput;
    upsert?: MitraUpsertWithoutFaceVerificationLogsInput;
    connect?: MitraWhereUniqueInput;
    update?: XOR<
      XOR<
        MitraUpdateToOneWithWhereWithoutFaceVerificationLogsInput,
        MitraUpdateWithoutFaceVerificationLogsInput
      >,
      MitraUncheckedUpdateWithoutFaceVerificationLogsInput
    >;
  };

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringFilter<$PrismaModel> | string;
  };

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringNullableFilter<$PrismaModel> | string | null;
  };

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolFilter<$PrismaModel> | boolean;
  };

  export type NestedEnumMitraTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.MitraType | EnumMitraTypeFieldRefInput<$PrismaModel>;
    in?: $Enums.MitraType[] | ListEnumMitraTypeFieldRefInput<$PrismaModel>;
    notIn?: $Enums.MitraType[] | ListEnumMitraTypeFieldRefInput<$PrismaModel>;
    not?: NestedEnumMitraTypeFilter<$PrismaModel> | $Enums.MitraType;
  };

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null;
  };

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null;
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntNullableFilter<$PrismaModel> | number | null;
  };

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[] | ListIntFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntFilter<$PrismaModel> | number;
  };

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null;
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null;
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null;
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null;
  };

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string;
  };

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedStringFilter<$PrismaModel>;
    _max?: NestedStringFilter<$PrismaModel>;
  };

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?:
      | NestedStringNullableWithAggregatesFilter<$PrismaModel>
      | string
      | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedStringNullableFilter<$PrismaModel>;
    _max?: NestedStringNullableFilter<$PrismaModel>;
  };

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedBoolFilter<$PrismaModel>;
    _max?: NestedBoolFilter<$PrismaModel>;
  };

  export type NestedEnumMitraTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.MitraType | EnumMitraTypeFieldRefInput<$PrismaModel>;
    in?: $Enums.MitraType[] | ListEnumMitraTypeFieldRefInput<$PrismaModel>;
    notIn?: $Enums.MitraType[] | ListEnumMitraTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumMitraTypeWithAggregatesFilter<$PrismaModel>
      | $Enums.MitraType;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumMitraTypeFilter<$PrismaModel>;
    _max?: NestedEnumMitraTypeFilter<$PrismaModel>;
  };

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> =
    {
      equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
      in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
      notIn?:
        | Date[]
        | string[]
        | ListDateTimeFieldRefInput<$PrismaModel>
        | null;
      lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
      lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
      gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
      gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
      not?:
        | NestedDateTimeNullableWithAggregatesFilter<$PrismaModel>
        | Date
        | string
        | null;
      _count?: NestedIntNullableFilter<$PrismaModel>;
      _min?: NestedDateTimeNullableFilter<$PrismaModel>;
      _max?: NestedDateTimeNullableFilter<$PrismaModel>;
    };

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null;
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _avg?: NestedFloatNullableFilter<$PrismaModel>;
    _sum?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedIntNullableFilter<$PrismaModel>;
    _max?: NestedIntNullableFilter<$PrismaModel>;
  };

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[] | ListIntFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number;
    _count?: NestedIntFilter<$PrismaModel>;
    _avg?: NestedFloatFilter<$PrismaModel>;
    _sum?: NestedIntFilter<$PrismaModel>;
    _min?: NestedIntFilter<$PrismaModel>;
    _max?: NestedIntFilter<$PrismaModel>;
  };

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>;
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>;
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatFilter<$PrismaModel> | number;
  };

  export type NestedFloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null;
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null;
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null;
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _avg?: NestedFloatNullableFilter<$PrismaModel>;
    _sum?: NestedFloatNullableFilter<$PrismaModel>;
    _min?: NestedFloatNullableFilter<$PrismaModel>;
    _max?: NestedFloatNullableFilter<$PrismaModel>;
  };

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedDateTimeFilter<$PrismaModel>;
    _max?: NestedDateTimeFilter<$PrismaModel>;
  };

  export type NestedDecimalFilter<$PrismaModel = never> = {
    equals?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    in?:
      | Decimal[]
      | DecimalJsLike[]
      | number[]
      | string[]
      | ListDecimalFieldRefInput<$PrismaModel>;
    notIn?:
      | Decimal[]
      | DecimalJsLike[]
      | number[]
      | string[]
      | ListDecimalFieldRefInput<$PrismaModel>;
    lt?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    lte?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    gt?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    gte?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    not?:
      | NestedDecimalFilter<$PrismaModel>
      | Decimal
      | DecimalJsLike
      | number
      | string;
  };

  export type NestedDecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    in?:
      | Decimal[]
      | DecimalJsLike[]
      | number[]
      | string[]
      | ListDecimalFieldRefInput<$PrismaModel>;
    notIn?:
      | Decimal[]
      | DecimalJsLike[]
      | number[]
      | string[]
      | ListDecimalFieldRefInput<$PrismaModel>;
    lt?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    lte?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    gt?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    gte?:
      | Decimal
      | DecimalJsLike
      | number
      | string
      | DecimalFieldRefInput<$PrismaModel>;
    not?:
      | NestedDecimalWithAggregatesFilter<$PrismaModel>
      | Decimal
      | DecimalJsLike
      | number
      | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _avg?: NestedDecimalFilter<$PrismaModel>;
    _sum?: NestedDecimalFilter<$PrismaModel>;
    _min?: NestedDecimalFilter<$PrismaModel>;
    _max?: NestedDecimalFilter<$PrismaModel>;
  };

  export type NestedEnumMitraTransactionTypeFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.MitraTransactionType
      | EnumMitraTransactionTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.MitraTransactionType[]
      | ListEnumMitraTransactionTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.MitraTransactionType[]
      | ListEnumMitraTransactionTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumMitraTransactionTypeFilter<$PrismaModel>
      | $Enums.MitraTransactionType;
  };

  export type NestedEnumMitraTransactionTypeWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.MitraTransactionType
      | EnumMitraTransactionTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.MitraTransactionType[]
      | ListEnumMitraTransactionTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.MitraTransactionType[]
      | ListEnumMitraTransactionTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumMitraTransactionTypeWithAggregatesFilter<$PrismaModel>
      | $Enums.MitraTransactionType;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumMitraTransactionTypeFilter<$PrismaModel>;
    _max?: NestedEnumMitraTransactionTypeFilter<$PrismaModel>;
  };

  export type NestedEnumWithdrawStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.WithdrawStatus
      | EnumWithdrawStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.WithdrawStatus[]
      | ListEnumWithdrawStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.WithdrawStatus[]
      | ListEnumWithdrawStatusFieldRefInput<$PrismaModel>;
    not?: NestedEnumWithdrawStatusFilter<$PrismaModel> | $Enums.WithdrawStatus;
  };

  export type NestedEnumWithdrawMethodFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.WithdrawMethod
      | EnumWithdrawMethodFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.WithdrawMethod[]
      | ListEnumWithdrawMethodFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.WithdrawMethod[]
      | ListEnumWithdrawMethodFieldRefInput<$PrismaModel>;
    not?: NestedEnumWithdrawMethodFilter<$PrismaModel> | $Enums.WithdrawMethod;
  };

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>;
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>;
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number;
    _count?: NestedIntFilter<$PrismaModel>;
    _avg?: NestedFloatFilter<$PrismaModel>;
    _sum?: NestedFloatFilter<$PrismaModel>;
    _min?: NestedFloatFilter<$PrismaModel>;
    _max?: NestedFloatFilter<$PrismaModel>;
  };

  export type NestedEnumWithdrawStatusWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.WithdrawStatus
      | EnumWithdrawStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.WithdrawStatus[]
      | ListEnumWithdrawStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.WithdrawStatus[]
      | ListEnumWithdrawStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumWithdrawStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.WithdrawStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumWithdrawStatusFilter<$PrismaModel>;
    _max?: NestedEnumWithdrawStatusFilter<$PrismaModel>;
  };

  export type NestedEnumWithdrawMethodWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.WithdrawMethod
      | EnumWithdrawMethodFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.WithdrawMethod[]
      | ListEnumWithdrawMethodFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.WithdrawMethod[]
      | ListEnumWithdrawMethodFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumWithdrawMethodWithAggregatesFilter<$PrismaModel>
      | $Enums.WithdrawMethod;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumWithdrawMethodFilter<$PrismaModel>;
    _max?: NestedEnumWithdrawMethodFilter<$PrismaModel>;
  };

  export type MitraWalletCreateWithoutMitraInput = {
    id?: string;
    balance?: Decimal | DecimalJsLike | number | string;
    totalEarnings?: Decimal | DecimalJsLike | number | string;
    totalWithdrawn?: Decimal | DecimalJsLike | number | string;
    currency?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    transactions?: MitraTransactionCreateNestedManyWithoutWalletInput;
    withdrawals?: WithdrawRequestCreateNestedManyWithoutMitraWalletInput;
  };

  export type MitraWalletUncheckedCreateWithoutMitraInput = {
    id?: string;
    balance?: Decimal | DecimalJsLike | number | string;
    totalEarnings?: Decimal | DecimalJsLike | number | string;
    totalWithdrawn?: Decimal | DecimalJsLike | number | string;
    currency?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    transactions?: MitraTransactionUncheckedCreateNestedManyWithoutWalletInput;
    withdrawals?: WithdrawRequestUncheckedCreateNestedManyWithoutMitraWalletInput;
  };

  export type MitraWalletCreateOrConnectWithoutMitraInput = {
    where: MitraWalletWhereUniqueInput;
    create: XOR<
      MitraWalletCreateWithoutMitraInput,
      MitraWalletUncheckedCreateWithoutMitraInput
    >;
  };

  export type WithdrawRequestCreateWithoutMitraInput = {
    id?: string;
    amount: number;
    bankName: string;
    bankAccountNo: string;
    bankAccountName: string;
    status?: $Enums.WithdrawStatus;
    method?: $Enums.WithdrawMethod;
    notes?: string | null;
    processedById?: string | null;
    processedAt?: Date | string | null;
    rejectionReason?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    mitraWallet?: MitraWalletCreateNestedOneWithoutWithdrawalsInput;
  };

  export type WithdrawRequestUncheckedCreateWithoutMitraInput = {
    id?: string;
    amount: number;
    bankName: string;
    bankAccountNo: string;
    bankAccountName: string;
    status?: $Enums.WithdrawStatus;
    method?: $Enums.WithdrawMethod;
    notes?: string | null;
    processedById?: string | null;
    processedAt?: Date | string | null;
    rejectionReason?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    mitraWalletId?: string | null;
    tenantId?: string | null;
  };

  export type WithdrawRequestCreateOrConnectWithoutMitraInput = {
    where: WithdrawRequestWhereUniqueInput;
    create: XOR<
      WithdrawRequestCreateWithoutMitraInput,
      WithdrawRequestUncheckedCreateWithoutMitraInput
    >;
  };

  export type WithdrawRequestCreateManyMitraInputEnvelope = {
    data:
      | WithdrawRequestCreateManyMitraInput
      | WithdrawRequestCreateManyMitraInput[];
    skipDuplicates?: boolean;
  };

  export type FaceVerificationLogCreateWithoutMitraInput = {
    id?: string;
    photoUrl: string;
    latitude?: number | null;
    longitude?: number | null;
    deviceInfo?: string | null;
    createdAt?: Date | string;
    tenantId?: string | null;
  };

  export type FaceVerificationLogUncheckedCreateWithoutMitraInput = {
    id?: string;
    photoUrl: string;
    latitude?: number | null;
    longitude?: number | null;
    deviceInfo?: string | null;
    createdAt?: Date | string;
    tenantId?: string | null;
  };

  export type FaceVerificationLogCreateOrConnectWithoutMitraInput = {
    where: FaceVerificationLogWhereUniqueInput;
    create: XOR<
      FaceVerificationLogCreateWithoutMitraInput,
      FaceVerificationLogUncheckedCreateWithoutMitraInput
    >;
  };

  export type FaceVerificationLogCreateManyMitraInputEnvelope = {
    data:
      | FaceVerificationLogCreateManyMitraInput
      | FaceVerificationLogCreateManyMitraInput[];
    skipDuplicates?: boolean;
  };

  export type MitraWalletUpsertWithoutMitraInput = {
    update: XOR<
      MitraWalletUpdateWithoutMitraInput,
      MitraWalletUncheckedUpdateWithoutMitraInput
    >;
    create: XOR<
      MitraWalletCreateWithoutMitraInput,
      MitraWalletUncheckedCreateWithoutMitraInput
    >;
    where?: MitraWalletWhereInput;
  };

  export type MitraWalletUpdateToOneWithWhereWithoutMitraInput = {
    where?: MitraWalletWhereInput;
    data: XOR<
      MitraWalletUpdateWithoutMitraInput,
      MitraWalletUncheckedUpdateWithoutMitraInput
    >;
  };

  export type MitraWalletUpdateWithoutMitraInput = {
    id?: StringFieldUpdateOperationsInput | string;
    balance?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalEarnings?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalWithdrawn?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    currency?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    transactions?: MitraTransactionUpdateManyWithoutWalletNestedInput;
    withdrawals?: WithdrawRequestUpdateManyWithoutMitraWalletNestedInput;
  };

  export type MitraWalletUncheckedUpdateWithoutMitraInput = {
    id?: StringFieldUpdateOperationsInput | string;
    balance?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalEarnings?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalWithdrawn?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    currency?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    transactions?: MitraTransactionUncheckedUpdateManyWithoutWalletNestedInput;
    withdrawals?: WithdrawRequestUncheckedUpdateManyWithoutMitraWalletNestedInput;
  };

  export type WithdrawRequestUpsertWithWhereUniqueWithoutMitraInput = {
    where: WithdrawRequestWhereUniqueInput;
    update: XOR<
      WithdrawRequestUpdateWithoutMitraInput,
      WithdrawRequestUncheckedUpdateWithoutMitraInput
    >;
    create: XOR<
      WithdrawRequestCreateWithoutMitraInput,
      WithdrawRequestUncheckedCreateWithoutMitraInput
    >;
  };

  export type WithdrawRequestUpdateWithWhereUniqueWithoutMitraInput = {
    where: WithdrawRequestWhereUniqueInput;
    data: XOR<
      WithdrawRequestUpdateWithoutMitraInput,
      WithdrawRequestUncheckedUpdateWithoutMitraInput
    >;
  };

  export type WithdrawRequestUpdateManyWithWhereWithoutMitraInput = {
    where: WithdrawRequestScalarWhereInput;
    data: XOR<
      WithdrawRequestUpdateManyMutationInput,
      WithdrawRequestUncheckedUpdateManyWithoutMitraInput
    >;
  };

  export type WithdrawRequestScalarWhereInput = {
    AND?: WithdrawRequestScalarWhereInput | WithdrawRequestScalarWhereInput[];
    OR?: WithdrawRequestScalarWhereInput[];
    NOT?: WithdrawRequestScalarWhereInput | WithdrawRequestScalarWhereInput[];
    id?: StringFilter<"WithdrawRequest"> | string;
    mitraId?: StringFilter<"WithdrawRequest"> | string;
    amount?: FloatFilter<"WithdrawRequest"> | number;
    bankName?: StringFilter<"WithdrawRequest"> | string;
    bankAccountNo?: StringFilter<"WithdrawRequest"> | string;
    bankAccountName?: StringFilter<"WithdrawRequest"> | string;
    status?:
      | EnumWithdrawStatusFilter<"WithdrawRequest">
      | $Enums.WithdrawStatus;
    method?:
      | EnumWithdrawMethodFilter<"WithdrawRequest">
      | $Enums.WithdrawMethod;
    notes?: StringNullableFilter<"WithdrawRequest"> | string | null;
    processedById?: StringNullableFilter<"WithdrawRequest"> | string | null;
    processedAt?:
      | DateTimeNullableFilter<"WithdrawRequest">
      | Date
      | string
      | null;
    rejectionReason?: StringNullableFilter<"WithdrawRequest"> | string | null;
    createdAt?: DateTimeFilter<"WithdrawRequest"> | Date | string;
    updatedAt?: DateTimeFilter<"WithdrawRequest"> | Date | string;
    mitraWalletId?: StringNullableFilter<"WithdrawRequest"> | string | null;
    tenantId?: StringNullableFilter<"WithdrawRequest"> | string | null;
  };

  export type FaceVerificationLogUpsertWithWhereUniqueWithoutMitraInput = {
    where: FaceVerificationLogWhereUniqueInput;
    update: XOR<
      FaceVerificationLogUpdateWithoutMitraInput,
      FaceVerificationLogUncheckedUpdateWithoutMitraInput
    >;
    create: XOR<
      FaceVerificationLogCreateWithoutMitraInput,
      FaceVerificationLogUncheckedCreateWithoutMitraInput
    >;
  };

  export type FaceVerificationLogUpdateWithWhereUniqueWithoutMitraInput = {
    where: FaceVerificationLogWhereUniqueInput;
    data: XOR<
      FaceVerificationLogUpdateWithoutMitraInput,
      FaceVerificationLogUncheckedUpdateWithoutMitraInput
    >;
  };

  export type FaceVerificationLogUpdateManyWithWhereWithoutMitraInput = {
    where: FaceVerificationLogScalarWhereInput;
    data: XOR<
      FaceVerificationLogUpdateManyMutationInput,
      FaceVerificationLogUncheckedUpdateManyWithoutMitraInput
    >;
  };

  export type FaceVerificationLogScalarWhereInput = {
    AND?:
      | FaceVerificationLogScalarWhereInput
      | FaceVerificationLogScalarWhereInput[];
    OR?: FaceVerificationLogScalarWhereInput[];
    NOT?:
      | FaceVerificationLogScalarWhereInput
      | FaceVerificationLogScalarWhereInput[];
    id?: StringFilter<"FaceVerificationLog"> | string;
    mitraId?: StringFilter<"FaceVerificationLog"> | string;
    photoUrl?: StringFilter<"FaceVerificationLog"> | string;
    latitude?: FloatNullableFilter<"FaceVerificationLog"> | number | null;
    longitude?: FloatNullableFilter<"FaceVerificationLog"> | number | null;
    deviceInfo?: StringNullableFilter<"FaceVerificationLog"> | string | null;
    createdAt?: DateTimeFilter<"FaceVerificationLog"> | Date | string;
    tenantId?: StringNullableFilter<"FaceVerificationLog"> | string | null;
  };

  export type MitraCreateWithoutMitraWalletInput = {
    id?: string;
    name: string;
    email: string;
    passwordHash?: string | null;
    phone?: string | null;
    isActive?: boolean;
    siteId?: string | null;
    mitraType?: $Enums.MitraType;
    pushToken?: string | null;
    pushTokenUpdatedAt?: Date | string | null;
    fcmTokens?: MitraCreatefcmTokensInput | string[];
    lastVersionCode?: number | null;
    lastVersionName?: string | null;
    lastVersionUpdate?: Date | string | null;
    tokenVersion?: number;
    mitraRateWoPsb?: number | null;
    mitraRateWoMaintenance?: number | null;
    mitraRateCanvasing?: number | null;
    bankName?: string | null;
    bankAccountNo?: string | null;
    bankAccountName?: string | null;
    targetHarian?: number | null;
    minWithdrawal?: number | null;
    nik?: string | null;
    tempatLahir?: string | null;
    tanggalLahir?: Date | string | null;
    alamat?: string | null;
    latitudeRumah?: number | null;
    longitudeRumah?: number | null;
    fotoDiri?: string | null;
    fotoKtp?: string | null;
    fotoSim?: string | null;
    fotoKk?: string | null;
    requiresFaceVerification?: boolean;
    lastFaceVerification?: Date | string | null;
    garansiHari?: number | null;
    slaGaransiJam?: number | null;
    penaltyPsb?: number | null;
    penaltyMaintenance?: number | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    withdrawalsRequested?: WithdrawRequestCreateNestedManyWithoutMitraInput;
    faceVerificationLogs?: FaceVerificationLogCreateNestedManyWithoutMitraInput;
  };

  export type MitraUncheckedCreateWithoutMitraWalletInput = {
    id?: string;
    name: string;
    email: string;
    passwordHash?: string | null;
    phone?: string | null;
    isActive?: boolean;
    siteId?: string | null;
    mitraType?: $Enums.MitraType;
    pushToken?: string | null;
    pushTokenUpdatedAt?: Date | string | null;
    fcmTokens?: MitraCreatefcmTokensInput | string[];
    lastVersionCode?: number | null;
    lastVersionName?: string | null;
    lastVersionUpdate?: Date | string | null;
    tokenVersion?: number;
    mitraRateWoPsb?: number | null;
    mitraRateWoMaintenance?: number | null;
    mitraRateCanvasing?: number | null;
    bankName?: string | null;
    bankAccountNo?: string | null;
    bankAccountName?: string | null;
    targetHarian?: number | null;
    minWithdrawal?: number | null;
    nik?: string | null;
    tempatLahir?: string | null;
    tanggalLahir?: Date | string | null;
    alamat?: string | null;
    latitudeRumah?: number | null;
    longitudeRumah?: number | null;
    fotoDiri?: string | null;
    fotoKtp?: string | null;
    fotoSim?: string | null;
    fotoKk?: string | null;
    requiresFaceVerification?: boolean;
    lastFaceVerification?: Date | string | null;
    garansiHari?: number | null;
    slaGaransiJam?: number | null;
    penaltyPsb?: number | null;
    penaltyMaintenance?: number | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    withdrawalsRequested?: WithdrawRequestUncheckedCreateNestedManyWithoutMitraInput;
    faceVerificationLogs?: FaceVerificationLogUncheckedCreateNestedManyWithoutMitraInput;
  };

  export type MitraCreateOrConnectWithoutMitraWalletInput = {
    where: MitraWhereUniqueInput;
    create: XOR<
      MitraCreateWithoutMitraWalletInput,
      MitraUncheckedCreateWithoutMitraWalletInput
    >;
  };

  export type MitraTransactionCreateWithoutWalletInput = {
    id?: string;
    amount: Decimal | DecimalJsLike | number | string;
    type: $Enums.MitraTransactionType;
    description: string;
    referenceId?: string | null;
    referenceType?: string | null;
    createdAt?: Date | string;
    tenantId?: string | null;
  };

  export type MitraTransactionUncheckedCreateWithoutWalletInput = {
    id?: string;
    amount: Decimal | DecimalJsLike | number | string;
    type: $Enums.MitraTransactionType;
    description: string;
    referenceId?: string | null;
    referenceType?: string | null;
    createdAt?: Date | string;
    tenantId?: string | null;
  };

  export type MitraTransactionCreateOrConnectWithoutWalletInput = {
    where: MitraTransactionWhereUniqueInput;
    create: XOR<
      MitraTransactionCreateWithoutWalletInput,
      MitraTransactionUncheckedCreateWithoutWalletInput
    >;
  };

  export type MitraTransactionCreateManyWalletInputEnvelope = {
    data:
      | MitraTransactionCreateManyWalletInput
      | MitraTransactionCreateManyWalletInput[];
    skipDuplicates?: boolean;
  };

  export type WithdrawRequestCreateWithoutMitraWalletInput = {
    id?: string;
    amount: number;
    bankName: string;
    bankAccountNo: string;
    bankAccountName: string;
    status?: $Enums.WithdrawStatus;
    method?: $Enums.WithdrawMethod;
    notes?: string | null;
    processedById?: string | null;
    processedAt?: Date | string | null;
    rejectionReason?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    mitra: MitraCreateNestedOneWithoutWithdrawalsRequestedInput;
  };

  export type WithdrawRequestUncheckedCreateWithoutMitraWalletInput = {
    id?: string;
    mitraId: string;
    amount: number;
    bankName: string;
    bankAccountNo: string;
    bankAccountName: string;
    status?: $Enums.WithdrawStatus;
    method?: $Enums.WithdrawMethod;
    notes?: string | null;
    processedById?: string | null;
    processedAt?: Date | string | null;
    rejectionReason?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
  };

  export type WithdrawRequestCreateOrConnectWithoutMitraWalletInput = {
    where: WithdrawRequestWhereUniqueInput;
    create: XOR<
      WithdrawRequestCreateWithoutMitraWalletInput,
      WithdrawRequestUncheckedCreateWithoutMitraWalletInput
    >;
  };

  export type WithdrawRequestCreateManyMitraWalletInputEnvelope = {
    data:
      | WithdrawRequestCreateManyMitraWalletInput
      | WithdrawRequestCreateManyMitraWalletInput[];
    skipDuplicates?: boolean;
  };

  export type MitraUpsertWithoutMitraWalletInput = {
    update: XOR<
      MitraUpdateWithoutMitraWalletInput,
      MitraUncheckedUpdateWithoutMitraWalletInput
    >;
    create: XOR<
      MitraCreateWithoutMitraWalletInput,
      MitraUncheckedCreateWithoutMitraWalletInput
    >;
    where?: MitraWhereInput;
  };

  export type MitraUpdateToOneWithWhereWithoutMitraWalletInput = {
    where?: MitraWhereInput;
    data: XOR<
      MitraUpdateWithoutMitraWalletInput,
      MitraUncheckedUpdateWithoutMitraWalletInput
    >;
  };

  export type MitraUpdateWithoutMitraWalletInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraType?: EnumMitraTypeFieldUpdateOperationsInput | $Enums.MitraType;
    pushToken?: NullableStringFieldUpdateOperationsInput | string | null;
    pushTokenUpdatedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    fcmTokens?: MitraUpdatefcmTokensInput | string[];
    lastVersionCode?: NullableIntFieldUpdateOperationsInput | number | null;
    lastVersionName?: NullableStringFieldUpdateOperationsInput | string | null;
    lastVersionUpdate?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    tokenVersion?: IntFieldUpdateOperationsInput | number;
    mitraRateWoPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    mitraRateWoMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    mitraRateCanvasing?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    bankName?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountNo?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountName?: NullableStringFieldUpdateOperationsInput | string | null;
    targetHarian?: NullableIntFieldUpdateOperationsInput | number | null;
    minWithdrawal?: NullableIntFieldUpdateOperationsInput | number | null;
    nik?: NullableStringFieldUpdateOperationsInput | string | null;
    tempatLahir?: NullableStringFieldUpdateOperationsInput | string | null;
    tanggalLahir?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    alamat?: NullableStringFieldUpdateOperationsInput | string | null;
    latitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    fotoDiri?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKtp?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoSim?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKk?: NullableStringFieldUpdateOperationsInput | string | null;
    requiresFaceVerification?: BoolFieldUpdateOperationsInput | boolean;
    lastFaceVerification?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    garansiHari?: NullableIntFieldUpdateOperationsInput | number | null;
    slaGaransiJam?: NullableIntFieldUpdateOperationsInput | number | null;
    penaltyPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    penaltyMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    withdrawalsRequested?: WithdrawRequestUpdateManyWithoutMitraNestedInput;
    faceVerificationLogs?: FaceVerificationLogUpdateManyWithoutMitraNestedInput;
  };

  export type MitraUncheckedUpdateWithoutMitraWalletInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraType?: EnumMitraTypeFieldUpdateOperationsInput | $Enums.MitraType;
    pushToken?: NullableStringFieldUpdateOperationsInput | string | null;
    pushTokenUpdatedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    fcmTokens?: MitraUpdatefcmTokensInput | string[];
    lastVersionCode?: NullableIntFieldUpdateOperationsInput | number | null;
    lastVersionName?: NullableStringFieldUpdateOperationsInput | string | null;
    lastVersionUpdate?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    tokenVersion?: IntFieldUpdateOperationsInput | number;
    mitraRateWoPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    mitraRateWoMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    mitraRateCanvasing?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    bankName?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountNo?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountName?: NullableStringFieldUpdateOperationsInput | string | null;
    targetHarian?: NullableIntFieldUpdateOperationsInput | number | null;
    minWithdrawal?: NullableIntFieldUpdateOperationsInput | number | null;
    nik?: NullableStringFieldUpdateOperationsInput | string | null;
    tempatLahir?: NullableStringFieldUpdateOperationsInput | string | null;
    tanggalLahir?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    alamat?: NullableStringFieldUpdateOperationsInput | string | null;
    latitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    fotoDiri?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKtp?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoSim?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKk?: NullableStringFieldUpdateOperationsInput | string | null;
    requiresFaceVerification?: BoolFieldUpdateOperationsInput | boolean;
    lastFaceVerification?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    garansiHari?: NullableIntFieldUpdateOperationsInput | number | null;
    slaGaransiJam?: NullableIntFieldUpdateOperationsInput | number | null;
    penaltyPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    penaltyMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    withdrawalsRequested?: WithdrawRequestUncheckedUpdateManyWithoutMitraNestedInput;
    faceVerificationLogs?: FaceVerificationLogUncheckedUpdateManyWithoutMitraNestedInput;
  };

  export type MitraTransactionUpsertWithWhereUniqueWithoutWalletInput = {
    where: MitraTransactionWhereUniqueInput;
    update: XOR<
      MitraTransactionUpdateWithoutWalletInput,
      MitraTransactionUncheckedUpdateWithoutWalletInput
    >;
    create: XOR<
      MitraTransactionCreateWithoutWalletInput,
      MitraTransactionUncheckedCreateWithoutWalletInput
    >;
  };

  export type MitraTransactionUpdateWithWhereUniqueWithoutWalletInput = {
    where: MitraTransactionWhereUniqueInput;
    data: XOR<
      MitraTransactionUpdateWithoutWalletInput,
      MitraTransactionUncheckedUpdateWithoutWalletInput
    >;
  };

  export type MitraTransactionUpdateManyWithWhereWithoutWalletInput = {
    where: MitraTransactionScalarWhereInput;
    data: XOR<
      MitraTransactionUpdateManyMutationInput,
      MitraTransactionUncheckedUpdateManyWithoutWalletInput
    >;
  };

  export type MitraTransactionScalarWhereInput = {
    AND?: MitraTransactionScalarWhereInput | MitraTransactionScalarWhereInput[];
    OR?: MitraTransactionScalarWhereInput[];
    NOT?: MitraTransactionScalarWhereInput | MitraTransactionScalarWhereInput[];
    id?: StringFilter<"MitraTransaction"> | string;
    walletId?: StringFilter<"MitraTransaction"> | string;
    amount?:
      | DecimalFilter<"MitraTransaction">
      | Decimal
      | DecimalJsLike
      | number
      | string;
    type?:
      | EnumMitraTransactionTypeFilter<"MitraTransaction">
      | $Enums.MitraTransactionType;
    description?: StringFilter<"MitraTransaction"> | string;
    referenceId?: StringNullableFilter<"MitraTransaction"> | string | null;
    referenceType?: StringNullableFilter<"MitraTransaction"> | string | null;
    createdAt?: DateTimeFilter<"MitraTransaction"> | Date | string;
    tenantId?: StringNullableFilter<"MitraTransaction"> | string | null;
  };

  export type WithdrawRequestUpsertWithWhereUniqueWithoutMitraWalletInput = {
    where: WithdrawRequestWhereUniqueInput;
    update: XOR<
      WithdrawRequestUpdateWithoutMitraWalletInput,
      WithdrawRequestUncheckedUpdateWithoutMitraWalletInput
    >;
    create: XOR<
      WithdrawRequestCreateWithoutMitraWalletInput,
      WithdrawRequestUncheckedCreateWithoutMitraWalletInput
    >;
  };

  export type WithdrawRequestUpdateWithWhereUniqueWithoutMitraWalletInput = {
    where: WithdrawRequestWhereUniqueInput;
    data: XOR<
      WithdrawRequestUpdateWithoutMitraWalletInput,
      WithdrawRequestUncheckedUpdateWithoutMitraWalletInput
    >;
  };

  export type WithdrawRequestUpdateManyWithWhereWithoutMitraWalletInput = {
    where: WithdrawRequestScalarWhereInput;
    data: XOR<
      WithdrawRequestUpdateManyMutationInput,
      WithdrawRequestUncheckedUpdateManyWithoutMitraWalletInput
    >;
  };

  export type MitraWalletCreateWithoutTransactionsInput = {
    id?: string;
    balance?: Decimal | DecimalJsLike | number | string;
    totalEarnings?: Decimal | DecimalJsLike | number | string;
    totalWithdrawn?: Decimal | DecimalJsLike | number | string;
    currency?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    mitra: MitraCreateNestedOneWithoutMitraWalletInput;
    withdrawals?: WithdrawRequestCreateNestedManyWithoutMitraWalletInput;
  };

  export type MitraWalletUncheckedCreateWithoutTransactionsInput = {
    id?: string;
    mitraId: string;
    balance?: Decimal | DecimalJsLike | number | string;
    totalEarnings?: Decimal | DecimalJsLike | number | string;
    totalWithdrawn?: Decimal | DecimalJsLike | number | string;
    currency?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    withdrawals?: WithdrawRequestUncheckedCreateNestedManyWithoutMitraWalletInput;
  };

  export type MitraWalletCreateOrConnectWithoutTransactionsInput = {
    where: MitraWalletWhereUniqueInput;
    create: XOR<
      MitraWalletCreateWithoutTransactionsInput,
      MitraWalletUncheckedCreateWithoutTransactionsInput
    >;
  };

  export type MitraWalletUpsertWithoutTransactionsInput = {
    update: XOR<
      MitraWalletUpdateWithoutTransactionsInput,
      MitraWalletUncheckedUpdateWithoutTransactionsInput
    >;
    create: XOR<
      MitraWalletCreateWithoutTransactionsInput,
      MitraWalletUncheckedCreateWithoutTransactionsInput
    >;
    where?: MitraWalletWhereInput;
  };

  export type MitraWalletUpdateToOneWithWhereWithoutTransactionsInput = {
    where?: MitraWalletWhereInput;
    data: XOR<
      MitraWalletUpdateWithoutTransactionsInput,
      MitraWalletUncheckedUpdateWithoutTransactionsInput
    >;
  };

  export type MitraWalletUpdateWithoutTransactionsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    balance?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalEarnings?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalWithdrawn?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    currency?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitra?: MitraUpdateOneRequiredWithoutMitraWalletNestedInput;
    withdrawals?: WithdrawRequestUpdateManyWithoutMitraWalletNestedInput;
  };

  export type MitraWalletUncheckedUpdateWithoutTransactionsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    mitraId?: StringFieldUpdateOperationsInput | string;
    balance?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalEarnings?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalWithdrawn?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    currency?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    withdrawals?: WithdrawRequestUncheckedUpdateManyWithoutMitraWalletNestedInput;
  };

  export type MitraCreateWithoutWithdrawalsRequestedInput = {
    id?: string;
    name: string;
    email: string;
    passwordHash?: string | null;
    phone?: string | null;
    isActive?: boolean;
    siteId?: string | null;
    mitraType?: $Enums.MitraType;
    pushToken?: string | null;
    pushTokenUpdatedAt?: Date | string | null;
    fcmTokens?: MitraCreatefcmTokensInput | string[];
    lastVersionCode?: number | null;
    lastVersionName?: string | null;
    lastVersionUpdate?: Date | string | null;
    tokenVersion?: number;
    mitraRateWoPsb?: number | null;
    mitraRateWoMaintenance?: number | null;
    mitraRateCanvasing?: number | null;
    bankName?: string | null;
    bankAccountNo?: string | null;
    bankAccountName?: string | null;
    targetHarian?: number | null;
    minWithdrawal?: number | null;
    nik?: string | null;
    tempatLahir?: string | null;
    tanggalLahir?: Date | string | null;
    alamat?: string | null;
    latitudeRumah?: number | null;
    longitudeRumah?: number | null;
    fotoDiri?: string | null;
    fotoKtp?: string | null;
    fotoSim?: string | null;
    fotoKk?: string | null;
    requiresFaceVerification?: boolean;
    lastFaceVerification?: Date | string | null;
    garansiHari?: number | null;
    slaGaransiJam?: number | null;
    penaltyPsb?: number | null;
    penaltyMaintenance?: number | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    mitraWallet?: MitraWalletCreateNestedOneWithoutMitraInput;
    faceVerificationLogs?: FaceVerificationLogCreateNestedManyWithoutMitraInput;
  };

  export type MitraUncheckedCreateWithoutWithdrawalsRequestedInput = {
    id?: string;
    name: string;
    email: string;
    passwordHash?: string | null;
    phone?: string | null;
    isActive?: boolean;
    siteId?: string | null;
    mitraType?: $Enums.MitraType;
    pushToken?: string | null;
    pushTokenUpdatedAt?: Date | string | null;
    fcmTokens?: MitraCreatefcmTokensInput | string[];
    lastVersionCode?: number | null;
    lastVersionName?: string | null;
    lastVersionUpdate?: Date | string | null;
    tokenVersion?: number;
    mitraRateWoPsb?: number | null;
    mitraRateWoMaintenance?: number | null;
    mitraRateCanvasing?: number | null;
    bankName?: string | null;
    bankAccountNo?: string | null;
    bankAccountName?: string | null;
    targetHarian?: number | null;
    minWithdrawal?: number | null;
    nik?: string | null;
    tempatLahir?: string | null;
    tanggalLahir?: Date | string | null;
    alamat?: string | null;
    latitudeRumah?: number | null;
    longitudeRumah?: number | null;
    fotoDiri?: string | null;
    fotoKtp?: string | null;
    fotoSim?: string | null;
    fotoKk?: string | null;
    requiresFaceVerification?: boolean;
    lastFaceVerification?: Date | string | null;
    garansiHari?: number | null;
    slaGaransiJam?: number | null;
    penaltyPsb?: number | null;
    penaltyMaintenance?: number | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    mitraWallet?: MitraWalletUncheckedCreateNestedOneWithoutMitraInput;
    faceVerificationLogs?: FaceVerificationLogUncheckedCreateNestedManyWithoutMitraInput;
  };

  export type MitraCreateOrConnectWithoutWithdrawalsRequestedInput = {
    where: MitraWhereUniqueInput;
    create: XOR<
      MitraCreateWithoutWithdrawalsRequestedInput,
      MitraUncheckedCreateWithoutWithdrawalsRequestedInput
    >;
  };

  export type MitraWalletCreateWithoutWithdrawalsInput = {
    id?: string;
    balance?: Decimal | DecimalJsLike | number | string;
    totalEarnings?: Decimal | DecimalJsLike | number | string;
    totalWithdrawn?: Decimal | DecimalJsLike | number | string;
    currency?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    mitra: MitraCreateNestedOneWithoutMitraWalletInput;
    transactions?: MitraTransactionCreateNestedManyWithoutWalletInput;
  };

  export type MitraWalletUncheckedCreateWithoutWithdrawalsInput = {
    id?: string;
    mitraId: string;
    balance?: Decimal | DecimalJsLike | number | string;
    totalEarnings?: Decimal | DecimalJsLike | number | string;
    totalWithdrawn?: Decimal | DecimalJsLike | number | string;
    currency?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    transactions?: MitraTransactionUncheckedCreateNestedManyWithoutWalletInput;
  };

  export type MitraWalletCreateOrConnectWithoutWithdrawalsInput = {
    where: MitraWalletWhereUniqueInput;
    create: XOR<
      MitraWalletCreateWithoutWithdrawalsInput,
      MitraWalletUncheckedCreateWithoutWithdrawalsInput
    >;
  };

  export type MitraUpsertWithoutWithdrawalsRequestedInput = {
    update: XOR<
      MitraUpdateWithoutWithdrawalsRequestedInput,
      MitraUncheckedUpdateWithoutWithdrawalsRequestedInput
    >;
    create: XOR<
      MitraCreateWithoutWithdrawalsRequestedInput,
      MitraUncheckedCreateWithoutWithdrawalsRequestedInput
    >;
    where?: MitraWhereInput;
  };

  export type MitraUpdateToOneWithWhereWithoutWithdrawalsRequestedInput = {
    where?: MitraWhereInput;
    data: XOR<
      MitraUpdateWithoutWithdrawalsRequestedInput,
      MitraUncheckedUpdateWithoutWithdrawalsRequestedInput
    >;
  };

  export type MitraUpdateWithoutWithdrawalsRequestedInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraType?: EnumMitraTypeFieldUpdateOperationsInput | $Enums.MitraType;
    pushToken?: NullableStringFieldUpdateOperationsInput | string | null;
    pushTokenUpdatedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    fcmTokens?: MitraUpdatefcmTokensInput | string[];
    lastVersionCode?: NullableIntFieldUpdateOperationsInput | number | null;
    lastVersionName?: NullableStringFieldUpdateOperationsInput | string | null;
    lastVersionUpdate?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    tokenVersion?: IntFieldUpdateOperationsInput | number;
    mitraRateWoPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    mitraRateWoMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    mitraRateCanvasing?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    bankName?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountNo?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountName?: NullableStringFieldUpdateOperationsInput | string | null;
    targetHarian?: NullableIntFieldUpdateOperationsInput | number | null;
    minWithdrawal?: NullableIntFieldUpdateOperationsInput | number | null;
    nik?: NullableStringFieldUpdateOperationsInput | string | null;
    tempatLahir?: NullableStringFieldUpdateOperationsInput | string | null;
    tanggalLahir?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    alamat?: NullableStringFieldUpdateOperationsInput | string | null;
    latitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    fotoDiri?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKtp?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoSim?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKk?: NullableStringFieldUpdateOperationsInput | string | null;
    requiresFaceVerification?: BoolFieldUpdateOperationsInput | boolean;
    lastFaceVerification?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    garansiHari?: NullableIntFieldUpdateOperationsInput | number | null;
    slaGaransiJam?: NullableIntFieldUpdateOperationsInput | number | null;
    penaltyPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    penaltyMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraWallet?: MitraWalletUpdateOneWithoutMitraNestedInput;
    faceVerificationLogs?: FaceVerificationLogUpdateManyWithoutMitraNestedInput;
  };

  export type MitraUncheckedUpdateWithoutWithdrawalsRequestedInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraType?: EnumMitraTypeFieldUpdateOperationsInput | $Enums.MitraType;
    pushToken?: NullableStringFieldUpdateOperationsInput | string | null;
    pushTokenUpdatedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    fcmTokens?: MitraUpdatefcmTokensInput | string[];
    lastVersionCode?: NullableIntFieldUpdateOperationsInput | number | null;
    lastVersionName?: NullableStringFieldUpdateOperationsInput | string | null;
    lastVersionUpdate?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    tokenVersion?: IntFieldUpdateOperationsInput | number;
    mitraRateWoPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    mitraRateWoMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    mitraRateCanvasing?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    bankName?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountNo?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountName?: NullableStringFieldUpdateOperationsInput | string | null;
    targetHarian?: NullableIntFieldUpdateOperationsInput | number | null;
    minWithdrawal?: NullableIntFieldUpdateOperationsInput | number | null;
    nik?: NullableStringFieldUpdateOperationsInput | string | null;
    tempatLahir?: NullableStringFieldUpdateOperationsInput | string | null;
    tanggalLahir?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    alamat?: NullableStringFieldUpdateOperationsInput | string | null;
    latitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    fotoDiri?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKtp?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoSim?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKk?: NullableStringFieldUpdateOperationsInput | string | null;
    requiresFaceVerification?: BoolFieldUpdateOperationsInput | boolean;
    lastFaceVerification?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    garansiHari?: NullableIntFieldUpdateOperationsInput | number | null;
    slaGaransiJam?: NullableIntFieldUpdateOperationsInput | number | null;
    penaltyPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    penaltyMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraWallet?: MitraWalletUncheckedUpdateOneWithoutMitraNestedInput;
    faceVerificationLogs?: FaceVerificationLogUncheckedUpdateManyWithoutMitraNestedInput;
  };

  export type MitraWalletUpsertWithoutWithdrawalsInput = {
    update: XOR<
      MitraWalletUpdateWithoutWithdrawalsInput,
      MitraWalletUncheckedUpdateWithoutWithdrawalsInput
    >;
    create: XOR<
      MitraWalletCreateWithoutWithdrawalsInput,
      MitraWalletUncheckedCreateWithoutWithdrawalsInput
    >;
    where?: MitraWalletWhereInput;
  };

  export type MitraWalletUpdateToOneWithWhereWithoutWithdrawalsInput = {
    where?: MitraWalletWhereInput;
    data: XOR<
      MitraWalletUpdateWithoutWithdrawalsInput,
      MitraWalletUncheckedUpdateWithoutWithdrawalsInput
    >;
  };

  export type MitraWalletUpdateWithoutWithdrawalsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    balance?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalEarnings?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalWithdrawn?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    currency?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitra?: MitraUpdateOneRequiredWithoutMitraWalletNestedInput;
    transactions?: MitraTransactionUpdateManyWithoutWalletNestedInput;
  };

  export type MitraWalletUncheckedUpdateWithoutWithdrawalsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    mitraId?: StringFieldUpdateOperationsInput | string;
    balance?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalEarnings?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    totalWithdrawn?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    currency?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    transactions?: MitraTransactionUncheckedUpdateManyWithoutWalletNestedInput;
  };

  export type MitraCreateWithoutFaceVerificationLogsInput = {
    id?: string;
    name: string;
    email: string;
    passwordHash?: string | null;
    phone?: string | null;
    isActive?: boolean;
    siteId?: string | null;
    mitraType?: $Enums.MitraType;
    pushToken?: string | null;
    pushTokenUpdatedAt?: Date | string | null;
    fcmTokens?: MitraCreatefcmTokensInput | string[];
    lastVersionCode?: number | null;
    lastVersionName?: string | null;
    lastVersionUpdate?: Date | string | null;
    tokenVersion?: number;
    mitraRateWoPsb?: number | null;
    mitraRateWoMaintenance?: number | null;
    mitraRateCanvasing?: number | null;
    bankName?: string | null;
    bankAccountNo?: string | null;
    bankAccountName?: string | null;
    targetHarian?: number | null;
    minWithdrawal?: number | null;
    nik?: string | null;
    tempatLahir?: string | null;
    tanggalLahir?: Date | string | null;
    alamat?: string | null;
    latitudeRumah?: number | null;
    longitudeRumah?: number | null;
    fotoDiri?: string | null;
    fotoKtp?: string | null;
    fotoSim?: string | null;
    fotoKk?: string | null;
    requiresFaceVerification?: boolean;
    lastFaceVerification?: Date | string | null;
    garansiHari?: number | null;
    slaGaransiJam?: number | null;
    penaltyPsb?: number | null;
    penaltyMaintenance?: number | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    mitraWallet?: MitraWalletCreateNestedOneWithoutMitraInput;
    withdrawalsRequested?: WithdrawRequestCreateNestedManyWithoutMitraInput;
  };

  export type MitraUncheckedCreateWithoutFaceVerificationLogsInput = {
    id?: string;
    name: string;
    email: string;
    passwordHash?: string | null;
    phone?: string | null;
    isActive?: boolean;
    siteId?: string | null;
    mitraType?: $Enums.MitraType;
    pushToken?: string | null;
    pushTokenUpdatedAt?: Date | string | null;
    fcmTokens?: MitraCreatefcmTokensInput | string[];
    lastVersionCode?: number | null;
    lastVersionName?: string | null;
    lastVersionUpdate?: Date | string | null;
    tokenVersion?: number;
    mitraRateWoPsb?: number | null;
    mitraRateWoMaintenance?: number | null;
    mitraRateCanvasing?: number | null;
    bankName?: string | null;
    bankAccountNo?: string | null;
    bankAccountName?: string | null;
    targetHarian?: number | null;
    minWithdrawal?: number | null;
    nik?: string | null;
    tempatLahir?: string | null;
    tanggalLahir?: Date | string | null;
    alamat?: string | null;
    latitudeRumah?: number | null;
    longitudeRumah?: number | null;
    fotoDiri?: string | null;
    fotoKtp?: string | null;
    fotoSim?: string | null;
    fotoKk?: string | null;
    requiresFaceVerification?: boolean;
    lastFaceVerification?: Date | string | null;
    garansiHari?: number | null;
    slaGaransiJam?: number | null;
    penaltyPsb?: number | null;
    penaltyMaintenance?: number | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    mitraWallet?: MitraWalletUncheckedCreateNestedOneWithoutMitraInput;
    withdrawalsRequested?: WithdrawRequestUncheckedCreateNestedManyWithoutMitraInput;
  };

  export type MitraCreateOrConnectWithoutFaceVerificationLogsInput = {
    where: MitraWhereUniqueInput;
    create: XOR<
      MitraCreateWithoutFaceVerificationLogsInput,
      MitraUncheckedCreateWithoutFaceVerificationLogsInput
    >;
  };

  export type MitraUpsertWithoutFaceVerificationLogsInput = {
    update: XOR<
      MitraUpdateWithoutFaceVerificationLogsInput,
      MitraUncheckedUpdateWithoutFaceVerificationLogsInput
    >;
    create: XOR<
      MitraCreateWithoutFaceVerificationLogsInput,
      MitraUncheckedCreateWithoutFaceVerificationLogsInput
    >;
    where?: MitraWhereInput;
  };

  export type MitraUpdateToOneWithWhereWithoutFaceVerificationLogsInput = {
    where?: MitraWhereInput;
    data: XOR<
      MitraUpdateWithoutFaceVerificationLogsInput,
      MitraUncheckedUpdateWithoutFaceVerificationLogsInput
    >;
  };

  export type MitraUpdateWithoutFaceVerificationLogsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraType?: EnumMitraTypeFieldUpdateOperationsInput | $Enums.MitraType;
    pushToken?: NullableStringFieldUpdateOperationsInput | string | null;
    pushTokenUpdatedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    fcmTokens?: MitraUpdatefcmTokensInput | string[];
    lastVersionCode?: NullableIntFieldUpdateOperationsInput | number | null;
    lastVersionName?: NullableStringFieldUpdateOperationsInput | string | null;
    lastVersionUpdate?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    tokenVersion?: IntFieldUpdateOperationsInput | number;
    mitraRateWoPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    mitraRateWoMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    mitraRateCanvasing?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    bankName?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountNo?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountName?: NullableStringFieldUpdateOperationsInput | string | null;
    targetHarian?: NullableIntFieldUpdateOperationsInput | number | null;
    minWithdrawal?: NullableIntFieldUpdateOperationsInput | number | null;
    nik?: NullableStringFieldUpdateOperationsInput | string | null;
    tempatLahir?: NullableStringFieldUpdateOperationsInput | string | null;
    tanggalLahir?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    alamat?: NullableStringFieldUpdateOperationsInput | string | null;
    latitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    fotoDiri?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKtp?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoSim?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKk?: NullableStringFieldUpdateOperationsInput | string | null;
    requiresFaceVerification?: BoolFieldUpdateOperationsInput | boolean;
    lastFaceVerification?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    garansiHari?: NullableIntFieldUpdateOperationsInput | number | null;
    slaGaransiJam?: NullableIntFieldUpdateOperationsInput | number | null;
    penaltyPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    penaltyMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraWallet?: MitraWalletUpdateOneWithoutMitraNestedInput;
    withdrawalsRequested?: WithdrawRequestUpdateManyWithoutMitraNestedInput;
  };

  export type MitraUncheckedUpdateWithoutFaceVerificationLogsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraType?: EnumMitraTypeFieldUpdateOperationsInput | $Enums.MitraType;
    pushToken?: NullableStringFieldUpdateOperationsInput | string | null;
    pushTokenUpdatedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    fcmTokens?: MitraUpdatefcmTokensInput | string[];
    lastVersionCode?: NullableIntFieldUpdateOperationsInput | number | null;
    lastVersionName?: NullableStringFieldUpdateOperationsInput | string | null;
    lastVersionUpdate?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    tokenVersion?: IntFieldUpdateOperationsInput | number;
    mitraRateWoPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    mitraRateWoMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    mitraRateCanvasing?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    bankName?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountNo?: NullableStringFieldUpdateOperationsInput | string | null;
    bankAccountName?: NullableStringFieldUpdateOperationsInput | string | null;
    targetHarian?: NullableIntFieldUpdateOperationsInput | number | null;
    minWithdrawal?: NullableIntFieldUpdateOperationsInput | number | null;
    nik?: NullableStringFieldUpdateOperationsInput | string | null;
    tempatLahir?: NullableStringFieldUpdateOperationsInput | string | null;
    tanggalLahir?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    alamat?: NullableStringFieldUpdateOperationsInput | string | null;
    latitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitudeRumah?: NullableFloatFieldUpdateOperationsInput | number | null;
    fotoDiri?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKtp?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoSim?: NullableStringFieldUpdateOperationsInput | string | null;
    fotoKk?: NullableStringFieldUpdateOperationsInput | string | null;
    requiresFaceVerification?: BoolFieldUpdateOperationsInput | boolean;
    lastFaceVerification?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    garansiHari?: NullableIntFieldUpdateOperationsInput | number | null;
    slaGaransiJam?: NullableIntFieldUpdateOperationsInput | number | null;
    penaltyPsb?: NullableFloatFieldUpdateOperationsInput | number | null;
    penaltyMaintenance?:
      | NullableFloatFieldUpdateOperationsInput
      | number
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraWallet?: MitraWalletUncheckedUpdateOneWithoutMitraNestedInput;
    withdrawalsRequested?: WithdrawRequestUncheckedUpdateManyWithoutMitraNestedInput;
  };

  export type WithdrawRequestCreateManyMitraInput = {
    id?: string;
    amount: number;
    bankName: string;
    bankAccountNo: string;
    bankAccountName: string;
    status?: $Enums.WithdrawStatus;
    method?: $Enums.WithdrawMethod;
    notes?: string | null;
    processedById?: string | null;
    processedAt?: Date | string | null;
    rejectionReason?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    mitraWalletId?: string | null;
    tenantId?: string | null;
  };

  export type FaceVerificationLogCreateManyMitraInput = {
    id?: string;
    photoUrl: string;
    latitude?: number | null;
    longitude?: number | null;
    deviceInfo?: string | null;
    createdAt?: Date | string;
    tenantId?: string | null;
  };

  export type WithdrawRequestUpdateWithoutMitraInput = {
    id?: StringFieldUpdateOperationsInput | string;
    amount?: FloatFieldUpdateOperationsInput | number;
    bankName?: StringFieldUpdateOperationsInput | string;
    bankAccountNo?: StringFieldUpdateOperationsInput | string;
    bankAccountName?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumWithdrawStatusFieldUpdateOperationsInput
      | $Enums.WithdrawStatus;
    method?:
      | EnumWithdrawMethodFieldUpdateOperationsInput
      | $Enums.WithdrawMethod;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    processedById?: NullableStringFieldUpdateOperationsInput | string | null;
    processedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitraWallet?: MitraWalletUpdateOneWithoutWithdrawalsNestedInput;
  };

  export type WithdrawRequestUncheckedUpdateWithoutMitraInput = {
    id?: StringFieldUpdateOperationsInput | string;
    amount?: FloatFieldUpdateOperationsInput | number;
    bankName?: StringFieldUpdateOperationsInput | string;
    bankAccountNo?: StringFieldUpdateOperationsInput | string;
    bankAccountName?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumWithdrawStatusFieldUpdateOperationsInput
      | $Enums.WithdrawStatus;
    method?:
      | EnumWithdrawMethodFieldUpdateOperationsInput
      | $Enums.WithdrawMethod;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    processedById?: NullableStringFieldUpdateOperationsInput | string | null;
    processedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    mitraWalletId?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type WithdrawRequestUncheckedUpdateManyWithoutMitraInput = {
    id?: StringFieldUpdateOperationsInput | string;
    amount?: FloatFieldUpdateOperationsInput | number;
    bankName?: StringFieldUpdateOperationsInput | string;
    bankAccountNo?: StringFieldUpdateOperationsInput | string;
    bankAccountName?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumWithdrawStatusFieldUpdateOperationsInput
      | $Enums.WithdrawStatus;
    method?:
      | EnumWithdrawMethodFieldUpdateOperationsInput
      | $Enums.WithdrawMethod;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    processedById?: NullableStringFieldUpdateOperationsInput | string | null;
    processedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    mitraWalletId?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type FaceVerificationLogUpdateWithoutMitraInput = {
    id?: StringFieldUpdateOperationsInput | string;
    photoUrl?: StringFieldUpdateOperationsInput | string;
    latitude?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitude?: NullableFloatFieldUpdateOperationsInput | number | null;
    deviceInfo?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type FaceVerificationLogUncheckedUpdateWithoutMitraInput = {
    id?: StringFieldUpdateOperationsInput | string;
    photoUrl?: StringFieldUpdateOperationsInput | string;
    latitude?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitude?: NullableFloatFieldUpdateOperationsInput | number | null;
    deviceInfo?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type FaceVerificationLogUncheckedUpdateManyWithoutMitraInput = {
    id?: StringFieldUpdateOperationsInput | string;
    photoUrl?: StringFieldUpdateOperationsInput | string;
    latitude?: NullableFloatFieldUpdateOperationsInput | number | null;
    longitude?: NullableFloatFieldUpdateOperationsInput | number | null;
    deviceInfo?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type MitraTransactionCreateManyWalletInput = {
    id?: string;
    amount: Decimal | DecimalJsLike | number | string;
    type: $Enums.MitraTransactionType;
    description: string;
    referenceId?: string | null;
    referenceType?: string | null;
    createdAt?: Date | string;
    tenantId?: string | null;
  };

  export type WithdrawRequestCreateManyMitraWalletInput = {
    id?: string;
    mitraId: string;
    amount: number;
    bankName: string;
    bankAccountNo: string;
    bankAccountName: string;
    status?: $Enums.WithdrawStatus;
    method?: $Enums.WithdrawMethod;
    notes?: string | null;
    processedById?: string | null;
    processedAt?: Date | string | null;
    rejectionReason?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
  };

  export type MitraTransactionUpdateWithoutWalletInput = {
    id?: StringFieldUpdateOperationsInput | string;
    amount?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    type?:
      | EnumMitraTransactionTypeFieldUpdateOperationsInput
      | $Enums.MitraTransactionType;
    description?: StringFieldUpdateOperationsInput | string;
    referenceId?: NullableStringFieldUpdateOperationsInput | string | null;
    referenceType?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type MitraTransactionUncheckedUpdateWithoutWalletInput = {
    id?: StringFieldUpdateOperationsInput | string;
    amount?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    type?:
      | EnumMitraTransactionTypeFieldUpdateOperationsInput
      | $Enums.MitraTransactionType;
    description?: StringFieldUpdateOperationsInput | string;
    referenceId?: NullableStringFieldUpdateOperationsInput | string | null;
    referenceType?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type MitraTransactionUncheckedUpdateManyWithoutWalletInput = {
    id?: StringFieldUpdateOperationsInput | string;
    amount?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    type?:
      | EnumMitraTransactionTypeFieldUpdateOperationsInput
      | $Enums.MitraTransactionType;
    description?: StringFieldUpdateOperationsInput | string;
    referenceId?: NullableStringFieldUpdateOperationsInput | string | null;
    referenceType?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type WithdrawRequestUpdateWithoutMitraWalletInput = {
    id?: StringFieldUpdateOperationsInput | string;
    amount?: FloatFieldUpdateOperationsInput | number;
    bankName?: StringFieldUpdateOperationsInput | string;
    bankAccountNo?: StringFieldUpdateOperationsInput | string;
    bankAccountName?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumWithdrawStatusFieldUpdateOperationsInput
      | $Enums.WithdrawStatus;
    method?:
      | EnumWithdrawMethodFieldUpdateOperationsInput
      | $Enums.WithdrawMethod;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    processedById?: NullableStringFieldUpdateOperationsInput | string | null;
    processedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    mitra?: MitraUpdateOneRequiredWithoutWithdrawalsRequestedNestedInput;
  };

  export type WithdrawRequestUncheckedUpdateWithoutMitraWalletInput = {
    id?: StringFieldUpdateOperationsInput | string;
    mitraId?: StringFieldUpdateOperationsInput | string;
    amount?: FloatFieldUpdateOperationsInput | number;
    bankName?: StringFieldUpdateOperationsInput | string;
    bankAccountNo?: StringFieldUpdateOperationsInput | string;
    bankAccountName?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumWithdrawStatusFieldUpdateOperationsInput
      | $Enums.WithdrawStatus;
    method?:
      | EnumWithdrawMethodFieldUpdateOperationsInput
      | $Enums.WithdrawMethod;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    processedById?: NullableStringFieldUpdateOperationsInput | string | null;
    processedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type WithdrawRequestUncheckedUpdateManyWithoutMitraWalletInput = {
    id?: StringFieldUpdateOperationsInput | string;
    mitraId?: StringFieldUpdateOperationsInput | string;
    amount?: FloatFieldUpdateOperationsInput | number;
    bankName?: StringFieldUpdateOperationsInput | string;
    bankAccountNo?: StringFieldUpdateOperationsInput | string;
    bankAccountName?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumWithdrawStatusFieldUpdateOperationsInput
      | $Enums.WithdrawStatus;
    method?:
      | EnumWithdrawMethodFieldUpdateOperationsInput
      | $Enums.WithdrawMethod;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    processedById?: NullableStringFieldUpdateOperationsInput | string | null;
    processedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number;
  };

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF;
}
