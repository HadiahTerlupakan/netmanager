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
 * Model Invoice
 *
 */
export type Invoice = $Result.DefaultSelection<Prisma.$InvoicePayload>;
/**
 * Model BillingSchedule
 *
 */
export type BillingSchedule =
  $Result.DefaultSelection<Prisma.$BillingSchedulePayload>;
/**
 * Model InvoiceItem
 *
 */
export type InvoiceItem = $Result.DefaultSelection<Prisma.$InvoiceItemPayload>;
/**
 * Model Payment
 *
 */
export type Payment = $Result.DefaultSelection<Prisma.$PaymentPayload>;
/**
 * Model PaymentGatewayConfig
 *
 */
export type PaymentGatewayConfig =
  $Result.DefaultSelection<Prisma.$PaymentGatewayConfigPayload>;
/**
 * Model UnmatchedMutation
 *
 */
export type UnmatchedMutation =
  $Result.DefaultSelection<Prisma.$UnmatchedMutationPayload>;
/**
 * Model WebhookEvent
 *
 */
export type WebhookEvent =
  $Result.DefaultSelection<Prisma.$WebhookEventPayload>;

/**
 * Enums
 */
export namespace $Enums {
  export const WebhookEventStatus: {
    PENDING: "PENDING";
    PROCESSED: "PROCESSED";
    FAILED: "FAILED";
  };

  export type WebhookEventStatus =
    (typeof WebhookEventStatus)[keyof typeof WebhookEventStatus];

  export const UnmatchedStatus: {
    PENDING: "PENDING";
    RESOLVED: "RESOLVED";
    IGNORED: "IGNORED";
  };

  export type UnmatchedStatus =
    (typeof UnmatchedStatus)[keyof typeof UnmatchedStatus];

  export const InvoiceStatus: {
    DRAFT: "DRAFT";
    SENT: "SENT";
    OVERDUE: "OVERDUE";
    PAID: "PAID";
    PARTIAL_PAID: "PARTIAL_PAID";
    CANCELLED: "CANCELLED";
  };

  export type InvoiceStatus =
    (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

  export const BillingScheduleJobType: {
    INVOICE_MARK_OVERDUE: "INVOICE_MARK_OVERDUE";
    CUSTOMER_AUTO_ISOLIR: "CUSTOMER_AUTO_ISOLIR";
  };

  export type BillingScheduleJobType =
    (typeof BillingScheduleJobType)[keyof typeof BillingScheduleJobType];

  export const BillingScheduleStatus: {
    PENDING: "PENDING";
    QUEUED: "QUEUED";
    PROCESSING: "PROCESSING";
    COMPLETED: "COMPLETED";
    CANCELLED: "CANCELLED";
    FAILED: "FAILED";
  };

  export type BillingScheduleStatus =
    (typeof BillingScheduleStatus)[keyof typeof BillingScheduleStatus];

  export const ItemType: {
    SERVICE: "SERVICE";
    PRODUCT: "PRODUCT";
    SETUP_FEE: "SETUP_FEE";
    MONTHLY_FEE: "MONTHLY_FEE";
    ONE_TIME_FEE: "ONE_TIME_FEE";
    OTHER: "OTHER";
  };

  export type ItemType = (typeof ItemType)[keyof typeof ItemType];

  export const PaymentMethod: {
    CASH: "CASH";
    BANK_TRANSFER: "BANK_TRANSFER";
    E_WALLET: "E_WALLET";
    CREDIT_CARD: "CREDIT_CARD";
    DEBIT_CARD: "DEBIT_CARD";
    CHECK: "CHECK";
    OTHER: "OTHER";
  };

  export type PaymentMethod =
    (typeof PaymentMethod)[keyof typeof PaymentMethod];

  export const Status: {
    AKTIF: "AKTIF";
    NONAKTIF: "NONAKTIF";
    MAINTENANCE: "MAINTENANCE";
    ISOLIR: "ISOLIR";
    DISMANTLE: "DISMANTLE";
  };

  export type Status = (typeof Status)[keyof typeof Status];

  export const TransactionType: {
    INCOME: "INCOME";
    EXPENSE: "EXPENSE";
  };

  export type TransactionType =
    (typeof TransactionType)[keyof typeof TransactionType];

  export const ExpenseType: {
    OPERATIONAL: "OPERATIONAL";
    CAPITAL: "CAPITAL";
    OTHER: "OTHER";
  };

  export type ExpenseType = (typeof ExpenseType)[keyof typeof ExpenseType];

  export const PaymentStatus: {
    UNPAID: "UNPAID";
    PARTIAL: "PARTIAL";
    PAID: "PAID";
  };

  export type PaymentStatus =
    (typeof PaymentStatus)[keyof typeof PaymentStatus];

  export const GatewayPaymentStatus: {
    PENDING: "PENDING";
    PAID: "PAID";
    FAILED: "FAILED";
    EXPIRED: "EXPIRED";
    CANCELLED: "CANCELLED";
    REFUNDED: "REFUNDED";
  };

  export type GatewayPaymentStatus =
    (typeof GatewayPaymentStatus)[keyof typeof GatewayPaymentStatus];
}

export type WebhookEventStatus = $Enums.WebhookEventStatus;

export const WebhookEventStatus: typeof $Enums.WebhookEventStatus;

export type UnmatchedStatus = $Enums.UnmatchedStatus;

export const UnmatchedStatus: typeof $Enums.UnmatchedStatus;

export type InvoiceStatus = $Enums.InvoiceStatus;

export const InvoiceStatus: typeof $Enums.InvoiceStatus;

export type BillingScheduleJobType = $Enums.BillingScheduleJobType;

export const BillingScheduleJobType: typeof $Enums.BillingScheduleJobType;

export type BillingScheduleStatus = $Enums.BillingScheduleStatus;

export const BillingScheduleStatus: typeof $Enums.BillingScheduleStatus;

export type ItemType = $Enums.ItemType;

export const ItemType: typeof $Enums.ItemType;

export type PaymentMethod = $Enums.PaymentMethod;

export const PaymentMethod: typeof $Enums.PaymentMethod;

export type Status = $Enums.Status;

export const Status: typeof $Enums.Status;

export type TransactionType = $Enums.TransactionType;

export const TransactionType: typeof $Enums.TransactionType;

export type ExpenseType = $Enums.ExpenseType;

export const ExpenseType: typeof $Enums.ExpenseType;

export type PaymentStatus = $Enums.PaymentStatus;

export const PaymentStatus: typeof $Enums.PaymentStatus;

export type GatewayPaymentStatus = $Enums.GatewayPaymentStatus;

export const GatewayPaymentStatus: typeof $Enums.GatewayPaymentStatus;

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more Invoices
 * const invoices = await prisma.invoice.findMany()
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
   * // Fetch zero or more Invoices
   * const invoices = await prisma.invoice.findMany()
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
   * `prisma.invoice`: Exposes CRUD operations for the **Invoice** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more Invoices
   * const invoices = await prisma.invoice.findMany()
   * ```
   */
  get invoice(): Prisma.InvoiceDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.billingSchedule`: Exposes CRUD operations for the **BillingSchedule** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more BillingSchedules
   * const billingSchedules = await prisma.billingSchedule.findMany()
   * ```
   */
  get billingSchedule(): Prisma.BillingScheduleDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.invoiceItem`: Exposes CRUD operations for the **InvoiceItem** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more InvoiceItems
   * const invoiceItems = await prisma.invoiceItem.findMany()
   * ```
   */
  get invoiceItem(): Prisma.InvoiceItemDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.payment`: Exposes CRUD operations for the **Payment** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more Payments
   * const payments = await prisma.payment.findMany()
   * ```
   */
  get payment(): Prisma.PaymentDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.paymentGatewayConfig`: Exposes CRUD operations for the **PaymentGatewayConfig** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more PaymentGatewayConfigs
   * const paymentGatewayConfigs = await prisma.paymentGatewayConfig.findMany()
   * ```
   */
  get paymentGatewayConfig(): Prisma.PaymentGatewayConfigDelegate<
    ExtArgs,
    ClientOptions
  >;

  /**
   * `prisma.unmatchedMutation`: Exposes CRUD operations for the **UnmatchedMutation** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more UnmatchedMutations
   * const unmatchedMutations = await prisma.unmatchedMutation.findMany()
   * ```
   */
  get unmatchedMutation(): Prisma.UnmatchedMutationDelegate<
    ExtArgs,
    ClientOptions
  >;

  /**
   * `prisma.webhookEvent`: Exposes CRUD operations for the **WebhookEvent** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more WebhookEvents
   * const webhookEvents = await prisma.webhookEvent.findMany()
   * ```
   */
  get webhookEvent(): Prisma.WebhookEventDelegate<ExtArgs, ClientOptions>;
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
    Invoice: "Invoice";
    BillingSchedule: "BillingSchedule";
    InvoiceItem: "InvoiceItem";
    Payment: "Payment";
    PaymentGatewayConfig: "PaymentGatewayConfig";
    UnmatchedMutation: "UnmatchedMutation";
    WebhookEvent: "WebhookEvent";
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
        | "invoice"
        | "billingSchedule"
        | "invoiceItem"
        | "payment"
        | "paymentGatewayConfig"
        | "unmatchedMutation"
        | "webhookEvent";
      txIsolationLevel: Prisma.TransactionIsolationLevel;
    };
    model: {
      Invoice: {
        payload: Prisma.$InvoicePayload<ExtArgs>;
        fields: Prisma.InvoiceFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.InvoiceFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.InvoiceFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>;
          };
          findFirst: {
            args: Prisma.InvoiceFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.InvoiceFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>;
          };
          findMany: {
            args: Prisma.InvoiceFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>[];
          };
          create: {
            args: Prisma.InvoiceCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>;
          };
          createMany: {
            args: Prisma.InvoiceCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.InvoiceCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>[];
          };
          delete: {
            args: Prisma.InvoiceDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>;
          };
          update: {
            args: Prisma.InvoiceUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>;
          };
          deleteMany: {
            args: Prisma.InvoiceDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.InvoiceUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.InvoiceUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>[];
          };
          upsert: {
            args: Prisma.InvoiceUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>;
          };
          aggregate: {
            args: Prisma.InvoiceAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateInvoice>;
          };
          groupBy: {
            args: Prisma.InvoiceGroupByArgs<ExtArgs>;
            result: $Utils.Optional<InvoiceGroupByOutputType>[];
          };
          count: {
            args: Prisma.InvoiceCountArgs<ExtArgs>;
            result: $Utils.Optional<InvoiceCountAggregateOutputType> | number;
          };
        };
      };
      BillingSchedule: {
        payload: Prisma.$BillingSchedulePayload<ExtArgs>;
        fields: Prisma.BillingScheduleFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.BillingScheduleFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$BillingSchedulePayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.BillingScheduleFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$BillingSchedulePayload>;
          };
          findFirst: {
            args: Prisma.BillingScheduleFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$BillingSchedulePayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.BillingScheduleFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$BillingSchedulePayload>;
          };
          findMany: {
            args: Prisma.BillingScheduleFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$BillingSchedulePayload>[];
          };
          create: {
            args: Prisma.BillingScheduleCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$BillingSchedulePayload>;
          };
          createMany: {
            args: Prisma.BillingScheduleCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.BillingScheduleCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$BillingSchedulePayload>[];
          };
          delete: {
            args: Prisma.BillingScheduleDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$BillingSchedulePayload>;
          };
          update: {
            args: Prisma.BillingScheduleUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$BillingSchedulePayload>;
          };
          deleteMany: {
            args: Prisma.BillingScheduleDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.BillingScheduleUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.BillingScheduleUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$BillingSchedulePayload>[];
          };
          upsert: {
            args: Prisma.BillingScheduleUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$BillingSchedulePayload>;
          };
          aggregate: {
            args: Prisma.BillingScheduleAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateBillingSchedule>;
          };
          groupBy: {
            args: Prisma.BillingScheduleGroupByArgs<ExtArgs>;
            result: $Utils.Optional<BillingScheduleGroupByOutputType>[];
          };
          count: {
            args: Prisma.BillingScheduleCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<BillingScheduleCountAggregateOutputType>
              | number;
          };
        };
      };
      InvoiceItem: {
        payload: Prisma.$InvoiceItemPayload<ExtArgs>;
        fields: Prisma.InvoiceItemFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.InvoiceItemFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.InvoiceItemFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>;
          };
          findFirst: {
            args: Prisma.InvoiceItemFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.InvoiceItemFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>;
          };
          findMany: {
            args: Prisma.InvoiceItemFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>[];
          };
          create: {
            args: Prisma.InvoiceItemCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>;
          };
          createMany: {
            args: Prisma.InvoiceItemCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.InvoiceItemCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>[];
          };
          delete: {
            args: Prisma.InvoiceItemDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>;
          };
          update: {
            args: Prisma.InvoiceItemUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>;
          };
          deleteMany: {
            args: Prisma.InvoiceItemDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.InvoiceItemUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.InvoiceItemUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>[];
          };
          upsert: {
            args: Prisma.InvoiceItemUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>;
          };
          aggregate: {
            args: Prisma.InvoiceItemAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateInvoiceItem>;
          };
          groupBy: {
            args: Prisma.InvoiceItemGroupByArgs<ExtArgs>;
            result: $Utils.Optional<InvoiceItemGroupByOutputType>[];
          };
          count: {
            args: Prisma.InvoiceItemCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<InvoiceItemCountAggregateOutputType>
              | number;
          };
        };
      };
      Payment: {
        payload: Prisma.$PaymentPayload<ExtArgs>;
        fields: Prisma.PaymentFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.PaymentFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.PaymentFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>;
          };
          findFirst: {
            args: Prisma.PaymentFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.PaymentFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>;
          };
          findMany: {
            args: Prisma.PaymentFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>[];
          };
          create: {
            args: Prisma.PaymentCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>;
          };
          createMany: {
            args: Prisma.PaymentCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.PaymentCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>[];
          };
          delete: {
            args: Prisma.PaymentDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>;
          };
          update: {
            args: Prisma.PaymentUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>;
          };
          deleteMany: {
            args: Prisma.PaymentDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.PaymentUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.PaymentUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>[];
          };
          upsert: {
            args: Prisma.PaymentUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>;
          };
          aggregate: {
            args: Prisma.PaymentAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregatePayment>;
          };
          groupBy: {
            args: Prisma.PaymentGroupByArgs<ExtArgs>;
            result: $Utils.Optional<PaymentGroupByOutputType>[];
          };
          count: {
            args: Prisma.PaymentCountArgs<ExtArgs>;
            result: $Utils.Optional<PaymentCountAggregateOutputType> | number;
          };
        };
      };
      PaymentGatewayConfig: {
        payload: Prisma.$PaymentGatewayConfigPayload<ExtArgs>;
        fields: Prisma.PaymentGatewayConfigFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.PaymentGatewayConfigFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.PaymentGatewayConfigFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>;
          };
          findFirst: {
            args: Prisma.PaymentGatewayConfigFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.PaymentGatewayConfigFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>;
          };
          findMany: {
            args: Prisma.PaymentGatewayConfigFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>[];
          };
          create: {
            args: Prisma.PaymentGatewayConfigCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>;
          };
          createMany: {
            args: Prisma.PaymentGatewayConfigCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.PaymentGatewayConfigCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>[];
          };
          delete: {
            args: Prisma.PaymentGatewayConfigDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>;
          };
          update: {
            args: Prisma.PaymentGatewayConfigUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>;
          };
          deleteMany: {
            args: Prisma.PaymentGatewayConfigDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.PaymentGatewayConfigUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.PaymentGatewayConfigUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>[];
          };
          upsert: {
            args: Prisma.PaymentGatewayConfigUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>;
          };
          aggregate: {
            args: Prisma.PaymentGatewayConfigAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregatePaymentGatewayConfig>;
          };
          groupBy: {
            args: Prisma.PaymentGatewayConfigGroupByArgs<ExtArgs>;
            result: $Utils.Optional<PaymentGatewayConfigGroupByOutputType>[];
          };
          count: {
            args: Prisma.PaymentGatewayConfigCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<PaymentGatewayConfigCountAggregateOutputType>
              | number;
          };
        };
      };
      UnmatchedMutation: {
        payload: Prisma.$UnmatchedMutationPayload<ExtArgs>;
        fields: Prisma.UnmatchedMutationFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.UnmatchedMutationFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.UnmatchedMutationFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>;
          };
          findFirst: {
            args: Prisma.UnmatchedMutationFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.UnmatchedMutationFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>;
          };
          findMany: {
            args: Prisma.UnmatchedMutationFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>[];
          };
          create: {
            args: Prisma.UnmatchedMutationCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>;
          };
          createMany: {
            args: Prisma.UnmatchedMutationCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.UnmatchedMutationCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>[];
          };
          delete: {
            args: Prisma.UnmatchedMutationDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>;
          };
          update: {
            args: Prisma.UnmatchedMutationUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>;
          };
          deleteMany: {
            args: Prisma.UnmatchedMutationDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.UnmatchedMutationUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.UnmatchedMutationUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>[];
          };
          upsert: {
            args: Prisma.UnmatchedMutationUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>;
          };
          aggregate: {
            args: Prisma.UnmatchedMutationAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateUnmatchedMutation>;
          };
          groupBy: {
            args: Prisma.UnmatchedMutationGroupByArgs<ExtArgs>;
            result: $Utils.Optional<UnmatchedMutationGroupByOutputType>[];
          };
          count: {
            args: Prisma.UnmatchedMutationCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<UnmatchedMutationCountAggregateOutputType>
              | number;
          };
        };
      };
      WebhookEvent: {
        payload: Prisma.$WebhookEventPayload<ExtArgs>;
        fields: Prisma.WebhookEventFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.WebhookEventFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WebhookEventPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.WebhookEventFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WebhookEventPayload>;
          };
          findFirst: {
            args: Prisma.WebhookEventFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WebhookEventPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.WebhookEventFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WebhookEventPayload>;
          };
          findMany: {
            args: Prisma.WebhookEventFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WebhookEventPayload>[];
          };
          create: {
            args: Prisma.WebhookEventCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WebhookEventPayload>;
          };
          createMany: {
            args: Prisma.WebhookEventCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.WebhookEventCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WebhookEventPayload>[];
          };
          delete: {
            args: Prisma.WebhookEventDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WebhookEventPayload>;
          };
          update: {
            args: Prisma.WebhookEventUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WebhookEventPayload>;
          };
          deleteMany: {
            args: Prisma.WebhookEventDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.WebhookEventUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.WebhookEventUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WebhookEventPayload>[];
          };
          upsert: {
            args: Prisma.WebhookEventUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$WebhookEventPayload>;
          };
          aggregate: {
            args: Prisma.WebhookEventAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateWebhookEvent>;
          };
          groupBy: {
            args: Prisma.WebhookEventGroupByArgs<ExtArgs>;
            result: $Utils.Optional<WebhookEventGroupByOutputType>[];
          };
          count: {
            args: Prisma.WebhookEventCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<WebhookEventCountAggregateOutputType>
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
    invoice?: InvoiceOmit;
    billingSchedule?: BillingScheduleOmit;
    invoiceItem?: InvoiceItemOmit;
    payment?: PaymentOmit;
    paymentGatewayConfig?: PaymentGatewayConfigOmit;
    unmatchedMutation?: UnmatchedMutationOmit;
    webhookEvent?: WebhookEventOmit;
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
   * Count Type InvoiceCountOutputType
   */

  export type InvoiceCountOutputType = {
    invoiceItem: number;
    payment: number;
    billingSchedules: number;
  };

  export type InvoiceCountOutputTypeSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    invoiceItem?: boolean | InvoiceCountOutputTypeCountInvoiceItemArgs;
    payment?: boolean | InvoiceCountOutputTypeCountPaymentArgs;
    billingSchedules?:
      | boolean
      | InvoiceCountOutputTypeCountBillingSchedulesArgs;
  };

  // Custom InputTypes
  /**
   * InvoiceCountOutputType without action
   */
  export type InvoiceCountOutputTypeDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the InvoiceCountOutputType
     */
    select?: InvoiceCountOutputTypeSelect<ExtArgs> | null;
  };

  /**
   * InvoiceCountOutputType without action
   */
  export type InvoiceCountOutputTypeCountInvoiceItemArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: InvoiceItemWhereInput;
  };

  /**
   * InvoiceCountOutputType without action
   */
  export type InvoiceCountOutputTypeCountPaymentArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: PaymentWhereInput;
  };

  /**
   * InvoiceCountOutputType without action
   */
  export type InvoiceCountOutputTypeCountBillingSchedulesArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: BillingScheduleWhereInput;
  };

  /**
   * Models
   */

  /**
   * Model Invoice
   */

  export type AggregateInvoice = {
    _count: InvoiceCountAggregateOutputType | null;
    _avg: InvoiceAvgAggregateOutputType | null;
    _sum: InvoiceSumAggregateOutputType | null;
    _min: InvoiceMinAggregateOutputType | null;
    _max: InvoiceMaxAggregateOutputType | null;
  };

  export type InvoiceAvgAggregateOutputType = {
    subtotal: number | null;
    taxAmount: number | null;
    discountAmount: number | null;
    totalAmount: number | null;
    paidAmount: number | null;
  };

  export type InvoiceSumAggregateOutputType = {
    subtotal: bigint | null;
    taxAmount: bigint | null;
    discountAmount: bigint | null;
    totalAmount: bigint | null;
    paidAmount: bigint | null;
  };

  export type InvoiceMinAggregateOutputType = {
    id: string | null;
    invoiceNumber: string | null;
    pelangganId: string | null;
    issueDate: Date | null;
    dueDate: Date | null;
    status: $Enums.InvoiceStatus | null;
    subtotal: bigint | null;
    taxAmount: bigint | null;
    discountAmount: bigint | null;
    totalAmount: bigint | null;
    paidAmount: bigint | null;
    notes: string | null;
    terms: string | null;
    sentAt: Date | null;
    paidAt: Date | null;
    createdBy: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    siteId: string | null;
    tenantId: string | null;
  };

  export type InvoiceMaxAggregateOutputType = {
    id: string | null;
    invoiceNumber: string | null;
    pelangganId: string | null;
    issueDate: Date | null;
    dueDate: Date | null;
    status: $Enums.InvoiceStatus | null;
    subtotal: bigint | null;
    taxAmount: bigint | null;
    discountAmount: bigint | null;
    totalAmount: bigint | null;
    paidAmount: bigint | null;
    notes: string | null;
    terms: string | null;
    sentAt: Date | null;
    paidAt: Date | null;
    createdBy: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    siteId: string | null;
    tenantId: string | null;
  };

  export type InvoiceCountAggregateOutputType = {
    id: number;
    invoiceNumber: number;
    pelangganId: number;
    issueDate: number;
    dueDate: number;
    status: number;
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
    paidAmount: number;
    notes: number;
    terms: number;
    sentAt: number;
    paidAt: number;
    createdBy: number;
    createdAt: number;
    updatedAt: number;
    siteId: number;
    tenantId: number;
    _all: number;
  };

  export type InvoiceAvgAggregateInputType = {
    subtotal?: true;
    taxAmount?: true;
    discountAmount?: true;
    totalAmount?: true;
    paidAmount?: true;
  };

  export type InvoiceSumAggregateInputType = {
    subtotal?: true;
    taxAmount?: true;
    discountAmount?: true;
    totalAmount?: true;
    paidAmount?: true;
  };

  export type InvoiceMinAggregateInputType = {
    id?: true;
    invoiceNumber?: true;
    pelangganId?: true;
    issueDate?: true;
    dueDate?: true;
    status?: true;
    subtotal?: true;
    taxAmount?: true;
    discountAmount?: true;
    totalAmount?: true;
    paidAmount?: true;
    notes?: true;
    terms?: true;
    sentAt?: true;
    paidAt?: true;
    createdBy?: true;
    createdAt?: true;
    updatedAt?: true;
    siteId?: true;
    tenantId?: true;
  };

  export type InvoiceMaxAggregateInputType = {
    id?: true;
    invoiceNumber?: true;
    pelangganId?: true;
    issueDate?: true;
    dueDate?: true;
    status?: true;
    subtotal?: true;
    taxAmount?: true;
    discountAmount?: true;
    totalAmount?: true;
    paidAmount?: true;
    notes?: true;
    terms?: true;
    sentAt?: true;
    paidAt?: true;
    createdBy?: true;
    createdAt?: true;
    updatedAt?: true;
    siteId?: true;
    tenantId?: true;
  };

  export type InvoiceCountAggregateInputType = {
    id?: true;
    invoiceNumber?: true;
    pelangganId?: true;
    issueDate?: true;
    dueDate?: true;
    status?: true;
    subtotal?: true;
    taxAmount?: true;
    discountAmount?: true;
    totalAmount?: true;
    paidAmount?: true;
    notes?: true;
    terms?: true;
    sentAt?: true;
    paidAt?: true;
    createdBy?: true;
    createdAt?: true;
    updatedAt?: true;
    siteId?: true;
    tenantId?: true;
    _all?: true;
  };

  export type InvoiceAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Invoice to aggregate.
     */
    where?: InvoiceWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Invoices to fetch.
     */
    orderBy?:
      | InvoiceOrderByWithRelationInput
      | InvoiceOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: InvoiceWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Invoices from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Invoices.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned Invoices
     **/
    _count?: true | InvoiceCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: InvoiceAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: InvoiceSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: InvoiceMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: InvoiceMaxAggregateInputType;
  };

  export type GetInvoiceAggregateType<T extends InvoiceAggregateArgs> = {
    [P in keyof T & keyof AggregateInvoice]: P extends "_count" | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateInvoice[P]>
      : GetScalarType<T[P], AggregateInvoice[P]>;
  };

  export type InvoiceGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: InvoiceWhereInput;
    orderBy?:
      | InvoiceOrderByWithAggregationInput
      | InvoiceOrderByWithAggregationInput[];
    by: InvoiceScalarFieldEnum[] | InvoiceScalarFieldEnum;
    having?: InvoiceScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: InvoiceCountAggregateInputType | true;
    _avg?: InvoiceAvgAggregateInputType;
    _sum?: InvoiceSumAggregateInputType;
    _min?: InvoiceMinAggregateInputType;
    _max?: InvoiceMaxAggregateInputType;
  };

  export type InvoiceGroupByOutputType = {
    id: string;
    invoiceNumber: string;
    pelangganId: string;
    issueDate: Date;
    dueDate: Date;
    status: $Enums.InvoiceStatus;
    subtotal: bigint;
    taxAmount: bigint;
    discountAmount: bigint;
    totalAmount: bigint;
    paidAmount: bigint;
    notes: string | null;
    terms: string | null;
    sentAt: Date | null;
    paidAt: Date | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    siteId: string | null;
    tenantId: string | null;
    _count: InvoiceCountAggregateOutputType | null;
    _avg: InvoiceAvgAggregateOutputType | null;
    _sum: InvoiceSumAggregateOutputType | null;
    _min: InvoiceMinAggregateOutputType | null;
    _max: InvoiceMaxAggregateOutputType | null;
  };

  type GetInvoiceGroupByPayload<T extends InvoiceGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<InvoiceGroupByOutputType, T["by"]> & {
          [P in keyof T & keyof InvoiceGroupByOutputType]: P extends "_count"
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], InvoiceGroupByOutputType[P]>
            : GetScalarType<T[P], InvoiceGroupByOutputType[P]>;
        }
      >
    >;

  export type InvoiceSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      invoiceNumber?: boolean;
      pelangganId?: boolean;
      issueDate?: boolean;
      dueDate?: boolean;
      status?: boolean;
      subtotal?: boolean;
      taxAmount?: boolean;
      discountAmount?: boolean;
      totalAmount?: boolean;
      paidAmount?: boolean;
      notes?: boolean;
      terms?: boolean;
      sentAt?: boolean;
      paidAt?: boolean;
      createdBy?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      siteId?: boolean;
      tenantId?: boolean;
      invoiceItem?: boolean | Invoice$invoiceItemArgs<ExtArgs>;
      payment?: boolean | Invoice$paymentArgs<ExtArgs>;
      billingSchedules?: boolean | Invoice$billingSchedulesArgs<ExtArgs>;
      _count?: boolean | InvoiceCountOutputTypeDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["invoice"]
  >;

  export type InvoiceSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      invoiceNumber?: boolean;
      pelangganId?: boolean;
      issueDate?: boolean;
      dueDate?: boolean;
      status?: boolean;
      subtotal?: boolean;
      taxAmount?: boolean;
      discountAmount?: boolean;
      totalAmount?: boolean;
      paidAmount?: boolean;
      notes?: boolean;
      terms?: boolean;
      sentAt?: boolean;
      paidAt?: boolean;
      createdBy?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      siteId?: boolean;
      tenantId?: boolean;
    },
    ExtArgs["result"]["invoice"]
  >;

  export type InvoiceSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      invoiceNumber?: boolean;
      pelangganId?: boolean;
      issueDate?: boolean;
      dueDate?: boolean;
      status?: boolean;
      subtotal?: boolean;
      taxAmount?: boolean;
      discountAmount?: boolean;
      totalAmount?: boolean;
      paidAmount?: boolean;
      notes?: boolean;
      terms?: boolean;
      sentAt?: boolean;
      paidAt?: boolean;
      createdBy?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      siteId?: boolean;
      tenantId?: boolean;
    },
    ExtArgs["result"]["invoice"]
  >;

  export type InvoiceSelectScalar = {
    id?: boolean;
    invoiceNumber?: boolean;
    pelangganId?: boolean;
    issueDate?: boolean;
    dueDate?: boolean;
    status?: boolean;
    subtotal?: boolean;
    taxAmount?: boolean;
    discountAmount?: boolean;
    totalAmount?: boolean;
    paidAmount?: boolean;
    notes?: boolean;
    terms?: boolean;
    sentAt?: boolean;
    paidAt?: boolean;
    createdBy?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    siteId?: boolean;
    tenantId?: boolean;
  };

  export type InvoiceOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "invoiceNumber"
    | "pelangganId"
    | "issueDate"
    | "dueDate"
    | "status"
    | "subtotal"
    | "taxAmount"
    | "discountAmount"
    | "totalAmount"
    | "paidAmount"
    | "notes"
    | "terms"
    | "sentAt"
    | "paidAt"
    | "createdBy"
    | "createdAt"
    | "updatedAt"
    | "siteId"
    | "tenantId",
    ExtArgs["result"]["invoice"]
  >;
  export type InvoiceInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    invoiceItem?: boolean | Invoice$invoiceItemArgs<ExtArgs>;
    payment?: boolean | Invoice$paymentArgs<ExtArgs>;
    billingSchedules?: boolean | Invoice$billingSchedulesArgs<ExtArgs>;
    _count?: boolean | InvoiceCountOutputTypeDefaultArgs<ExtArgs>;
  };
  export type InvoiceIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {};
  export type InvoiceIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {};

  export type $InvoicePayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "Invoice";
    objects: {
      invoiceItem: Prisma.$InvoiceItemPayload<ExtArgs>[];
      payment: Prisma.$PaymentPayload<ExtArgs>[];
      billingSchedules: Prisma.$BillingSchedulePayload<ExtArgs>[];
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        invoiceNumber: string;
        pelangganId: string;
        issueDate: Date;
        dueDate: Date;
        status: $Enums.InvoiceStatus;
        subtotal: bigint;
        taxAmount: bigint;
        discountAmount: bigint;
        totalAmount: bigint;
        paidAmount: bigint;
        notes: string | null;
        terms: string | null;
        sentAt: Date | null;
        paidAt: Date | null;
        createdBy: string | null;
        createdAt: Date;
        updatedAt: Date;
        siteId: string | null;
        tenantId: string | null;
      },
      ExtArgs["result"]["invoice"]
    >;
    composites: {};
  };

  type InvoiceGetPayload<
    S extends boolean | null | undefined | InvoiceDefaultArgs,
  > = $Result.GetResult<Prisma.$InvoicePayload, S>;

  type InvoiceCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<InvoiceFindManyArgs, "select" | "include" | "distinct" | "omit"> & {
    select?: InvoiceCountAggregateInputType | true;
  };

  export interface InvoiceDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["Invoice"];
      meta: { name: "Invoice" };
    };
    /**
     * Find zero or one Invoice that matches the filter.
     * @param {InvoiceFindUniqueArgs} args - Arguments to find a Invoice
     * @example
     * // Get one Invoice
     * const invoice = await prisma.invoice.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends InvoiceFindUniqueArgs>(
      args: SelectSubset<T, InvoiceFindUniqueArgs<ExtArgs>>,
    ): Prisma__InvoiceClient<
      $Result.GetResult<
        Prisma.$InvoicePayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one Invoice that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {InvoiceFindUniqueOrThrowArgs} args - Arguments to find a Invoice
     * @example
     * // Get one Invoice
     * const invoice = await prisma.invoice.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends InvoiceFindUniqueOrThrowArgs>(
      args: SelectSubset<T, InvoiceFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__InvoiceClient<
      $Result.GetResult<
        Prisma.$InvoicePayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first Invoice that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceFindFirstArgs} args - Arguments to find a Invoice
     * @example
     * // Get one Invoice
     * const invoice = await prisma.invoice.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends InvoiceFindFirstArgs>(
      args?: SelectSubset<T, InvoiceFindFirstArgs<ExtArgs>>,
    ): Prisma__InvoiceClient<
      $Result.GetResult<
        Prisma.$InvoicePayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first Invoice that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceFindFirstOrThrowArgs} args - Arguments to find a Invoice
     * @example
     * // Get one Invoice
     * const invoice = await prisma.invoice.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends InvoiceFindFirstOrThrowArgs>(
      args?: SelectSubset<T, InvoiceFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__InvoiceClient<
      $Result.GetResult<
        Prisma.$InvoicePayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more Invoices that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Invoices
     * const invoices = await prisma.invoice.findMany()
     *
     * // Get first 10 Invoices
     * const invoices = await prisma.invoice.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const invoiceWithIdOnly = await prisma.invoice.findMany({ select: { id: true } })
     *
     */
    findMany<T extends InvoiceFindManyArgs>(
      args?: SelectSubset<T, InvoiceFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$InvoicePayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a Invoice.
     * @param {InvoiceCreateArgs} args - Arguments to create a Invoice.
     * @example
     * // Create one Invoice
     * const Invoice = await prisma.invoice.create({
     *   data: {
     *     // ... data to create a Invoice
     *   }
     * })
     *
     */
    create<T extends InvoiceCreateArgs>(
      args: SelectSubset<T, InvoiceCreateArgs<ExtArgs>>,
    ): Prisma__InvoiceClient<
      $Result.GetResult<
        Prisma.$InvoicePayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many Invoices.
     * @param {InvoiceCreateManyArgs} args - Arguments to create many Invoices.
     * @example
     * // Create many Invoices
     * const invoice = await prisma.invoice.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends InvoiceCreateManyArgs>(
      args?: SelectSubset<T, InvoiceCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many Invoices and returns the data saved in the database.
     * @param {InvoiceCreateManyAndReturnArgs} args - Arguments to create many Invoices.
     * @example
     * // Create many Invoices
     * const invoice = await prisma.invoice.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many Invoices and only return the `id`
     * const invoiceWithIdOnly = await prisma.invoice.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends InvoiceCreateManyAndReturnArgs>(
      args?: SelectSubset<T, InvoiceCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$InvoicePayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a Invoice.
     * @param {InvoiceDeleteArgs} args - Arguments to delete one Invoice.
     * @example
     * // Delete one Invoice
     * const Invoice = await prisma.invoice.delete({
     *   where: {
     *     // ... filter to delete one Invoice
     *   }
     * })
     *
     */
    delete<T extends InvoiceDeleteArgs>(
      args: SelectSubset<T, InvoiceDeleteArgs<ExtArgs>>,
    ): Prisma__InvoiceClient<
      $Result.GetResult<
        Prisma.$InvoicePayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one Invoice.
     * @param {InvoiceUpdateArgs} args - Arguments to update one Invoice.
     * @example
     * // Update one Invoice
     * const invoice = await prisma.invoice.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends InvoiceUpdateArgs>(
      args: SelectSubset<T, InvoiceUpdateArgs<ExtArgs>>,
    ): Prisma__InvoiceClient<
      $Result.GetResult<
        Prisma.$InvoicePayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more Invoices.
     * @param {InvoiceDeleteManyArgs} args - Arguments to filter Invoices to delete.
     * @example
     * // Delete a few Invoices
     * const { count } = await prisma.invoice.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends InvoiceDeleteManyArgs>(
      args?: SelectSubset<T, InvoiceDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Invoices.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Invoices
     * const invoice = await prisma.invoice.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends InvoiceUpdateManyArgs>(
      args: SelectSubset<T, InvoiceUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Invoices and returns the data updated in the database.
     * @param {InvoiceUpdateManyAndReturnArgs} args - Arguments to update many Invoices.
     * @example
     * // Update many Invoices
     * const invoice = await prisma.invoice.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more Invoices and only return the `id`
     * const invoiceWithIdOnly = await prisma.invoice.updateManyAndReturn({
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
    updateManyAndReturn<T extends InvoiceUpdateManyAndReturnArgs>(
      args: SelectSubset<T, InvoiceUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$InvoicePayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one Invoice.
     * @param {InvoiceUpsertArgs} args - Arguments to update or create a Invoice.
     * @example
     * // Update or create a Invoice
     * const invoice = await prisma.invoice.upsert({
     *   create: {
     *     // ... data to create a Invoice
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Invoice we want to update
     *   }
     * })
     */
    upsert<T extends InvoiceUpsertArgs>(
      args: SelectSubset<T, InvoiceUpsertArgs<ExtArgs>>,
    ): Prisma__InvoiceClient<
      $Result.GetResult<
        Prisma.$InvoicePayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of Invoices.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceCountArgs} args - Arguments to filter Invoices to count.
     * @example
     * // Count the number of Invoices
     * const count = await prisma.invoice.count({
     *   where: {
     *     // ... the filter for the Invoices we want to count
     *   }
     * })
     **/
    count<T extends InvoiceCountArgs>(
      args?: Subset<T, InvoiceCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], InvoiceCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a Invoice.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends InvoiceAggregateArgs>(
      args: Subset<T, InvoiceAggregateArgs>,
    ): Prisma.PrismaPromise<GetInvoiceAggregateType<T>>;

    /**
     * Group by Invoice.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceGroupByArgs} args - Group by arguments.
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
      T extends InvoiceGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: InvoiceGroupByArgs["orderBy"] }
        : { orderBy?: InvoiceGroupByArgs["orderBy"] },
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
      args: SubsetIntersection<T, InvoiceGroupByArgs, OrderByArg> & InputErrors,
    ): {} extends InputErrors
      ? GetInvoiceGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the Invoice model
     */
    readonly fields: InvoiceFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Invoice.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__InvoiceClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    invoiceItem<T extends Invoice$invoiceItemArgs<ExtArgs> = {}>(
      args?: Subset<T, Invoice$invoiceItemArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$InvoiceItemPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    payment<T extends Invoice$paymentArgs<ExtArgs> = {}>(
      args?: Subset<T, Invoice$paymentArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$PaymentPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    billingSchedules<T extends Invoice$billingSchedulesArgs<ExtArgs> = {}>(
      args?: Subset<T, Invoice$billingSchedulesArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$BillingSchedulePayload<ExtArgs>,
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
   * Fields of the Invoice model
   */
  interface InvoiceFieldRefs {
    readonly id: FieldRef<"Invoice", "String">;
    readonly invoiceNumber: FieldRef<"Invoice", "String">;
    readonly pelangganId: FieldRef<"Invoice", "String">;
    readonly issueDate: FieldRef<"Invoice", "DateTime">;
    readonly dueDate: FieldRef<"Invoice", "DateTime">;
    readonly status: FieldRef<"Invoice", "InvoiceStatus">;
    readonly subtotal: FieldRef<"Invoice", "BigInt">;
    readonly taxAmount: FieldRef<"Invoice", "BigInt">;
    readonly discountAmount: FieldRef<"Invoice", "BigInt">;
    readonly totalAmount: FieldRef<"Invoice", "BigInt">;
    readonly paidAmount: FieldRef<"Invoice", "BigInt">;
    readonly notes: FieldRef<"Invoice", "String">;
    readonly terms: FieldRef<"Invoice", "String">;
    readonly sentAt: FieldRef<"Invoice", "DateTime">;
    readonly paidAt: FieldRef<"Invoice", "DateTime">;
    readonly createdBy: FieldRef<"Invoice", "String">;
    readonly createdAt: FieldRef<"Invoice", "DateTime">;
    readonly updatedAt: FieldRef<"Invoice", "DateTime">;
    readonly siteId: FieldRef<"Invoice", "String">;
    readonly tenantId: FieldRef<"Invoice", "String">;
  }

  // Custom InputTypes
  /**
   * Invoice findUnique
   */
  export type InvoiceFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null;
    /**
     * Filter, which Invoice to fetch.
     */
    where: InvoiceWhereUniqueInput;
  };

  /**
   * Invoice findUniqueOrThrow
   */
  export type InvoiceFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null;
    /**
     * Filter, which Invoice to fetch.
     */
    where: InvoiceWhereUniqueInput;
  };

  /**
   * Invoice findFirst
   */
  export type InvoiceFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null;
    /**
     * Filter, which Invoice to fetch.
     */
    where?: InvoiceWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Invoices to fetch.
     */
    orderBy?:
      | InvoiceOrderByWithRelationInput
      | InvoiceOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Invoices.
     */
    cursor?: InvoiceWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Invoices from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Invoices.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Invoices.
     */
    distinct?: InvoiceScalarFieldEnum | InvoiceScalarFieldEnum[];
  };

  /**
   * Invoice findFirstOrThrow
   */
  export type InvoiceFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null;
    /**
     * Filter, which Invoice to fetch.
     */
    where?: InvoiceWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Invoices to fetch.
     */
    orderBy?:
      | InvoiceOrderByWithRelationInput
      | InvoiceOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Invoices.
     */
    cursor?: InvoiceWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Invoices from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Invoices.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Invoices.
     */
    distinct?: InvoiceScalarFieldEnum | InvoiceScalarFieldEnum[];
  };

  /**
   * Invoice findMany
   */
  export type InvoiceFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null;
    /**
     * Filter, which Invoices to fetch.
     */
    where?: InvoiceWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Invoices to fetch.
     */
    orderBy?:
      | InvoiceOrderByWithRelationInput
      | InvoiceOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing Invoices.
     */
    cursor?: InvoiceWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Invoices from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Invoices.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Invoices.
     */
    distinct?: InvoiceScalarFieldEnum | InvoiceScalarFieldEnum[];
  };

  /**
   * Invoice create
   */
  export type InvoiceCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null;
    /**
     * The data needed to create a Invoice.
     */
    data: XOR<InvoiceCreateInput, InvoiceUncheckedCreateInput>;
  };

  /**
   * Invoice createMany
   */
  export type InvoiceCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many Invoices.
     */
    data: InvoiceCreateManyInput | InvoiceCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * Invoice createManyAndReturn
   */
  export type InvoiceCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null;
    /**
     * The data used to create many Invoices.
     */
    data: InvoiceCreateManyInput | InvoiceCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * Invoice update
   */
  export type InvoiceUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null;
    /**
     * The data needed to update a Invoice.
     */
    data: XOR<InvoiceUpdateInput, InvoiceUncheckedUpdateInput>;
    /**
     * Choose, which Invoice to update.
     */
    where: InvoiceWhereUniqueInput;
  };

  /**
   * Invoice updateMany
   */
  export type InvoiceUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update Invoices.
     */
    data: XOR<InvoiceUpdateManyMutationInput, InvoiceUncheckedUpdateManyInput>;
    /**
     * Filter which Invoices to update
     */
    where?: InvoiceWhereInput;
    /**
     * Limit how many Invoices to update.
     */
    limit?: number;
  };

  /**
   * Invoice updateManyAndReturn
   */
  export type InvoiceUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null;
    /**
     * The data used to update Invoices.
     */
    data: XOR<InvoiceUpdateManyMutationInput, InvoiceUncheckedUpdateManyInput>;
    /**
     * Filter which Invoices to update
     */
    where?: InvoiceWhereInput;
    /**
     * Limit how many Invoices to update.
     */
    limit?: number;
  };

  /**
   * Invoice upsert
   */
  export type InvoiceUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null;
    /**
     * The filter to search for the Invoice to update in case it exists.
     */
    where: InvoiceWhereUniqueInput;
    /**
     * In case the Invoice found by the `where` argument doesn't exist, create a new Invoice with this data.
     */
    create: XOR<InvoiceCreateInput, InvoiceUncheckedCreateInput>;
    /**
     * In case the Invoice was found with the provided `where` argument, update it with this data.
     */
    update: XOR<InvoiceUpdateInput, InvoiceUncheckedUpdateInput>;
  };

  /**
   * Invoice delete
   */
  export type InvoiceDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null;
    /**
     * Filter which Invoice to delete.
     */
    where: InvoiceWhereUniqueInput;
  };

  /**
   * Invoice deleteMany
   */
  export type InvoiceDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Invoices to delete
     */
    where?: InvoiceWhereInput;
    /**
     * Limit how many Invoices to delete.
     */
    limit?: number;
  };

  /**
   * Invoice.invoiceItem
   */
  export type Invoice$invoiceItemArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null;
    where?: InvoiceItemWhereInput;
    orderBy?:
      | InvoiceItemOrderByWithRelationInput
      | InvoiceItemOrderByWithRelationInput[];
    cursor?: InvoiceItemWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: InvoiceItemScalarFieldEnum | InvoiceItemScalarFieldEnum[];
  };

  /**
   * Invoice.payment
   */
  export type Invoice$paymentArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null;
    where?: PaymentWhereInput;
    orderBy?:
      | PaymentOrderByWithRelationInput
      | PaymentOrderByWithRelationInput[];
    cursor?: PaymentWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: PaymentScalarFieldEnum | PaymentScalarFieldEnum[];
  };

  /**
   * Invoice.billingSchedules
   */
  export type Invoice$billingSchedulesArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the BillingSchedule
     */
    select?: BillingScheduleSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the BillingSchedule
     */
    omit?: BillingScheduleOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BillingScheduleInclude<ExtArgs> | null;
    where?: BillingScheduleWhereInput;
    orderBy?:
      | BillingScheduleOrderByWithRelationInput
      | BillingScheduleOrderByWithRelationInput[];
    cursor?: BillingScheduleWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?:
      | BillingScheduleScalarFieldEnum
      | BillingScheduleScalarFieldEnum[];
  };

  /**
   * Invoice without action
   */
  export type InvoiceDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null;
  };

  /**
   * Model BillingSchedule
   */

  export type AggregateBillingSchedule = {
    _count: BillingScheduleCountAggregateOutputType | null;
    _avg: BillingScheduleAvgAggregateOutputType | null;
    _sum: BillingScheduleSumAggregateOutputType | null;
    _min: BillingScheduleMinAggregateOutputType | null;
    _max: BillingScheduleMaxAggregateOutputType | null;
  };

  export type BillingScheduleAvgAggregateOutputType = {
    version: number | null;
    attemptCount: number | null;
  };

  export type BillingScheduleSumAggregateOutputType = {
    version: number | null;
    attemptCount: number | null;
  };

  export type BillingScheduleMinAggregateOutputType = {
    id: string | null;
    dedupeKey: string | null;
    jobType: $Enums.BillingScheduleJobType | null;
    invoiceId: string | null;
    pelangganId: string | null;
    runAt: Date | null;
    status: $Enums.BillingScheduleStatus | null;
    queueJobId: string | null;
    version: number | null;
    attemptCount: number | null;
    queuedAt: Date | null;
    processingAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    failedAt: Date | null;
    lastAttemptAt: Date | null;
    lastError: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    tenantId: string | null;
  };

  export type BillingScheduleMaxAggregateOutputType = {
    id: string | null;
    dedupeKey: string | null;
    jobType: $Enums.BillingScheduleJobType | null;
    invoiceId: string | null;
    pelangganId: string | null;
    runAt: Date | null;
    status: $Enums.BillingScheduleStatus | null;
    queueJobId: string | null;
    version: number | null;
    attemptCount: number | null;
    queuedAt: Date | null;
    processingAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    failedAt: Date | null;
    lastAttemptAt: Date | null;
    lastError: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    tenantId: string | null;
  };

  export type BillingScheduleCountAggregateOutputType = {
    id: number;
    dedupeKey: number;
    jobType: number;
    invoiceId: number;
    pelangganId: number;
    runAt: number;
    status: number;
    queueJobId: number;
    payload: number;
    version: number;
    attemptCount: number;
    queuedAt: number;
    processingAt: number;
    completedAt: number;
    cancelledAt: number;
    failedAt: number;
    lastAttemptAt: number;
    lastError: number;
    createdAt: number;
    updatedAt: number;
    tenantId: number;
    _all: number;
  };

  export type BillingScheduleAvgAggregateInputType = {
    version?: true;
    attemptCount?: true;
  };

  export type BillingScheduleSumAggregateInputType = {
    version?: true;
    attemptCount?: true;
  };

  export type BillingScheduleMinAggregateInputType = {
    id?: true;
    dedupeKey?: true;
    jobType?: true;
    invoiceId?: true;
    pelangganId?: true;
    runAt?: true;
    status?: true;
    queueJobId?: true;
    version?: true;
    attemptCount?: true;
    queuedAt?: true;
    processingAt?: true;
    completedAt?: true;
    cancelledAt?: true;
    failedAt?: true;
    lastAttemptAt?: true;
    lastError?: true;
    createdAt?: true;
    updatedAt?: true;
    tenantId?: true;
  };

  export type BillingScheduleMaxAggregateInputType = {
    id?: true;
    dedupeKey?: true;
    jobType?: true;
    invoiceId?: true;
    pelangganId?: true;
    runAt?: true;
    status?: true;
    queueJobId?: true;
    version?: true;
    attemptCount?: true;
    queuedAt?: true;
    processingAt?: true;
    completedAt?: true;
    cancelledAt?: true;
    failedAt?: true;
    lastAttemptAt?: true;
    lastError?: true;
    createdAt?: true;
    updatedAt?: true;
    tenantId?: true;
  };

  export type BillingScheduleCountAggregateInputType = {
    id?: true;
    dedupeKey?: true;
    jobType?: true;
    invoiceId?: true;
    pelangganId?: true;
    runAt?: true;
    status?: true;
    queueJobId?: true;
    payload?: true;
    version?: true;
    attemptCount?: true;
    queuedAt?: true;
    processingAt?: true;
    completedAt?: true;
    cancelledAt?: true;
    failedAt?: true;
    lastAttemptAt?: true;
    lastError?: true;
    createdAt?: true;
    updatedAt?: true;
    tenantId?: true;
    _all?: true;
  };

  export type BillingScheduleAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which BillingSchedule to aggregate.
     */
    where?: BillingScheduleWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of BillingSchedules to fetch.
     */
    orderBy?:
      | BillingScheduleOrderByWithRelationInput
      | BillingScheduleOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: BillingScheduleWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` BillingSchedules from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` BillingSchedules.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned BillingSchedules
     **/
    _count?: true | BillingScheduleCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: BillingScheduleAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: BillingScheduleSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: BillingScheduleMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: BillingScheduleMaxAggregateInputType;
  };

  export type GetBillingScheduleAggregateType<
    T extends BillingScheduleAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateBillingSchedule]: P extends
      | "_count"
      | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateBillingSchedule[P]>
      : GetScalarType<T[P], AggregateBillingSchedule[P]>;
  };

  export type BillingScheduleGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: BillingScheduleWhereInput;
    orderBy?:
      | BillingScheduleOrderByWithAggregationInput
      | BillingScheduleOrderByWithAggregationInput[];
    by: BillingScheduleScalarFieldEnum[] | BillingScheduleScalarFieldEnum;
    having?: BillingScheduleScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: BillingScheduleCountAggregateInputType | true;
    _avg?: BillingScheduleAvgAggregateInputType;
    _sum?: BillingScheduleSumAggregateInputType;
    _min?: BillingScheduleMinAggregateInputType;
    _max?: BillingScheduleMaxAggregateInputType;
  };

  export type BillingScheduleGroupByOutputType = {
    id: string;
    dedupeKey: string;
    jobType: $Enums.BillingScheduleJobType;
    invoiceId: string | null;
    pelangganId: string | null;
    runAt: Date;
    status: $Enums.BillingScheduleStatus;
    queueJobId: string | null;
    payload: JsonValue | null;
    version: number;
    attemptCount: number;
    queuedAt: Date | null;
    processingAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    failedAt: Date | null;
    lastAttemptAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
    tenantId: string | null;
    _count: BillingScheduleCountAggregateOutputType | null;
    _avg: BillingScheduleAvgAggregateOutputType | null;
    _sum: BillingScheduleSumAggregateOutputType | null;
    _min: BillingScheduleMinAggregateOutputType | null;
    _max: BillingScheduleMaxAggregateOutputType | null;
  };

  type GetBillingScheduleGroupByPayload<T extends BillingScheduleGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<BillingScheduleGroupByOutputType, T["by"]> & {
          [P in keyof T &
            keyof BillingScheduleGroupByOutputType]: P extends "_count"
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], BillingScheduleGroupByOutputType[P]>
            : GetScalarType<T[P], BillingScheduleGroupByOutputType[P]>;
        }
      >
    >;

  export type BillingScheduleSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      dedupeKey?: boolean;
      jobType?: boolean;
      invoiceId?: boolean;
      pelangganId?: boolean;
      runAt?: boolean;
      status?: boolean;
      queueJobId?: boolean;
      payload?: boolean;
      version?: boolean;
      attemptCount?: boolean;
      queuedAt?: boolean;
      processingAt?: boolean;
      completedAt?: boolean;
      cancelledAt?: boolean;
      failedAt?: boolean;
      lastAttemptAt?: boolean;
      lastError?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      tenantId?: boolean;
      invoice?: boolean | BillingSchedule$invoiceArgs<ExtArgs>;
    },
    ExtArgs["result"]["billingSchedule"]
  >;

  export type BillingScheduleSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      dedupeKey?: boolean;
      jobType?: boolean;
      invoiceId?: boolean;
      pelangganId?: boolean;
      runAt?: boolean;
      status?: boolean;
      queueJobId?: boolean;
      payload?: boolean;
      version?: boolean;
      attemptCount?: boolean;
      queuedAt?: boolean;
      processingAt?: boolean;
      completedAt?: boolean;
      cancelledAt?: boolean;
      failedAt?: boolean;
      lastAttemptAt?: boolean;
      lastError?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      tenantId?: boolean;
      invoice?: boolean | BillingSchedule$invoiceArgs<ExtArgs>;
    },
    ExtArgs["result"]["billingSchedule"]
  >;

  export type BillingScheduleSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      dedupeKey?: boolean;
      jobType?: boolean;
      invoiceId?: boolean;
      pelangganId?: boolean;
      runAt?: boolean;
      status?: boolean;
      queueJobId?: boolean;
      payload?: boolean;
      version?: boolean;
      attemptCount?: boolean;
      queuedAt?: boolean;
      processingAt?: boolean;
      completedAt?: boolean;
      cancelledAt?: boolean;
      failedAt?: boolean;
      lastAttemptAt?: boolean;
      lastError?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      tenantId?: boolean;
      invoice?: boolean | BillingSchedule$invoiceArgs<ExtArgs>;
    },
    ExtArgs["result"]["billingSchedule"]
  >;

  export type BillingScheduleSelectScalar = {
    id?: boolean;
    dedupeKey?: boolean;
    jobType?: boolean;
    invoiceId?: boolean;
    pelangganId?: boolean;
    runAt?: boolean;
    status?: boolean;
    queueJobId?: boolean;
    payload?: boolean;
    version?: boolean;
    attemptCount?: boolean;
    queuedAt?: boolean;
    processingAt?: boolean;
    completedAt?: boolean;
    cancelledAt?: boolean;
    failedAt?: boolean;
    lastAttemptAt?: boolean;
    lastError?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    tenantId?: boolean;
  };

  export type BillingScheduleOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "dedupeKey"
    | "jobType"
    | "invoiceId"
    | "pelangganId"
    | "runAt"
    | "status"
    | "queueJobId"
    | "payload"
    | "version"
    | "attemptCount"
    | "queuedAt"
    | "processingAt"
    | "completedAt"
    | "cancelledAt"
    | "failedAt"
    | "lastAttemptAt"
    | "lastError"
    | "createdAt"
    | "updatedAt"
    | "tenantId",
    ExtArgs["result"]["billingSchedule"]
  >;
  export type BillingScheduleInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    invoice?: boolean | BillingSchedule$invoiceArgs<ExtArgs>;
  };
  export type BillingScheduleIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    invoice?: boolean | BillingSchedule$invoiceArgs<ExtArgs>;
  };
  export type BillingScheduleIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    invoice?: boolean | BillingSchedule$invoiceArgs<ExtArgs>;
  };

  export type $BillingSchedulePayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "BillingSchedule";
    objects: {
      invoice: Prisma.$InvoicePayload<ExtArgs> | null;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        dedupeKey: string;
        jobType: $Enums.BillingScheduleJobType;
        invoiceId: string | null;
        pelangganId: string | null;
        runAt: Date;
        status: $Enums.BillingScheduleStatus;
        queueJobId: string | null;
        payload: Prisma.JsonValue | null;
        version: number;
        attemptCount: number;
        queuedAt: Date | null;
        processingAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
        failedAt: Date | null;
        lastAttemptAt: Date | null;
        lastError: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
      },
      ExtArgs["result"]["billingSchedule"]
    >;
    composites: {};
  };

  type BillingScheduleGetPayload<
    S extends boolean | null | undefined | BillingScheduleDefaultArgs,
  > = $Result.GetResult<Prisma.$BillingSchedulePayload, S>;

  type BillingScheduleCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    BillingScheduleFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: BillingScheduleCountAggregateInputType | true;
  };

  export interface BillingScheduleDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["BillingSchedule"];
      meta: { name: "BillingSchedule" };
    };
    /**
     * Find zero or one BillingSchedule that matches the filter.
     * @param {BillingScheduleFindUniqueArgs} args - Arguments to find a BillingSchedule
     * @example
     * // Get one BillingSchedule
     * const billingSchedule = await prisma.billingSchedule.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends BillingScheduleFindUniqueArgs>(
      args: SelectSubset<T, BillingScheduleFindUniqueArgs<ExtArgs>>,
    ): Prisma__BillingScheduleClient<
      $Result.GetResult<
        Prisma.$BillingSchedulePayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one BillingSchedule that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {BillingScheduleFindUniqueOrThrowArgs} args - Arguments to find a BillingSchedule
     * @example
     * // Get one BillingSchedule
     * const billingSchedule = await prisma.billingSchedule.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends BillingScheduleFindUniqueOrThrowArgs>(
      args: SelectSubset<T, BillingScheduleFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__BillingScheduleClient<
      $Result.GetResult<
        Prisma.$BillingSchedulePayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first BillingSchedule that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BillingScheduleFindFirstArgs} args - Arguments to find a BillingSchedule
     * @example
     * // Get one BillingSchedule
     * const billingSchedule = await prisma.billingSchedule.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends BillingScheduleFindFirstArgs>(
      args?: SelectSubset<T, BillingScheduleFindFirstArgs<ExtArgs>>,
    ): Prisma__BillingScheduleClient<
      $Result.GetResult<
        Prisma.$BillingSchedulePayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first BillingSchedule that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BillingScheduleFindFirstOrThrowArgs} args - Arguments to find a BillingSchedule
     * @example
     * // Get one BillingSchedule
     * const billingSchedule = await prisma.billingSchedule.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends BillingScheduleFindFirstOrThrowArgs>(
      args?: SelectSubset<T, BillingScheduleFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__BillingScheduleClient<
      $Result.GetResult<
        Prisma.$BillingSchedulePayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more BillingSchedules that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BillingScheduleFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all BillingSchedules
     * const billingSchedules = await prisma.billingSchedule.findMany()
     *
     * // Get first 10 BillingSchedules
     * const billingSchedules = await prisma.billingSchedule.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const billingScheduleWithIdOnly = await prisma.billingSchedule.findMany({ select: { id: true } })
     *
     */
    findMany<T extends BillingScheduleFindManyArgs>(
      args?: SelectSubset<T, BillingScheduleFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$BillingSchedulePayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a BillingSchedule.
     * @param {BillingScheduleCreateArgs} args - Arguments to create a BillingSchedule.
     * @example
     * // Create one BillingSchedule
     * const BillingSchedule = await prisma.billingSchedule.create({
     *   data: {
     *     // ... data to create a BillingSchedule
     *   }
     * })
     *
     */
    create<T extends BillingScheduleCreateArgs>(
      args: SelectSubset<T, BillingScheduleCreateArgs<ExtArgs>>,
    ): Prisma__BillingScheduleClient<
      $Result.GetResult<
        Prisma.$BillingSchedulePayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many BillingSchedules.
     * @param {BillingScheduleCreateManyArgs} args - Arguments to create many BillingSchedules.
     * @example
     * // Create many BillingSchedules
     * const billingSchedule = await prisma.billingSchedule.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends BillingScheduleCreateManyArgs>(
      args?: SelectSubset<T, BillingScheduleCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many BillingSchedules and returns the data saved in the database.
     * @param {BillingScheduleCreateManyAndReturnArgs} args - Arguments to create many BillingSchedules.
     * @example
     * // Create many BillingSchedules
     * const billingSchedule = await prisma.billingSchedule.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many BillingSchedules and only return the `id`
     * const billingScheduleWithIdOnly = await prisma.billingSchedule.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends BillingScheduleCreateManyAndReturnArgs>(
      args?: SelectSubset<T, BillingScheduleCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$BillingSchedulePayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a BillingSchedule.
     * @param {BillingScheduleDeleteArgs} args - Arguments to delete one BillingSchedule.
     * @example
     * // Delete one BillingSchedule
     * const BillingSchedule = await prisma.billingSchedule.delete({
     *   where: {
     *     // ... filter to delete one BillingSchedule
     *   }
     * })
     *
     */
    delete<T extends BillingScheduleDeleteArgs>(
      args: SelectSubset<T, BillingScheduleDeleteArgs<ExtArgs>>,
    ): Prisma__BillingScheduleClient<
      $Result.GetResult<
        Prisma.$BillingSchedulePayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one BillingSchedule.
     * @param {BillingScheduleUpdateArgs} args - Arguments to update one BillingSchedule.
     * @example
     * // Update one BillingSchedule
     * const billingSchedule = await prisma.billingSchedule.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends BillingScheduleUpdateArgs>(
      args: SelectSubset<T, BillingScheduleUpdateArgs<ExtArgs>>,
    ): Prisma__BillingScheduleClient<
      $Result.GetResult<
        Prisma.$BillingSchedulePayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more BillingSchedules.
     * @param {BillingScheduleDeleteManyArgs} args - Arguments to filter BillingSchedules to delete.
     * @example
     * // Delete a few BillingSchedules
     * const { count } = await prisma.billingSchedule.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends BillingScheduleDeleteManyArgs>(
      args?: SelectSubset<T, BillingScheduleDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more BillingSchedules.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BillingScheduleUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many BillingSchedules
     * const billingSchedule = await prisma.billingSchedule.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends BillingScheduleUpdateManyArgs>(
      args: SelectSubset<T, BillingScheduleUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more BillingSchedules and returns the data updated in the database.
     * @param {BillingScheduleUpdateManyAndReturnArgs} args - Arguments to update many BillingSchedules.
     * @example
     * // Update many BillingSchedules
     * const billingSchedule = await prisma.billingSchedule.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more BillingSchedules and only return the `id`
     * const billingScheduleWithIdOnly = await prisma.billingSchedule.updateManyAndReturn({
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
    updateManyAndReturn<T extends BillingScheduleUpdateManyAndReturnArgs>(
      args: SelectSubset<T, BillingScheduleUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$BillingSchedulePayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one BillingSchedule.
     * @param {BillingScheduleUpsertArgs} args - Arguments to update or create a BillingSchedule.
     * @example
     * // Update or create a BillingSchedule
     * const billingSchedule = await prisma.billingSchedule.upsert({
     *   create: {
     *     // ... data to create a BillingSchedule
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the BillingSchedule we want to update
     *   }
     * })
     */
    upsert<T extends BillingScheduleUpsertArgs>(
      args: SelectSubset<T, BillingScheduleUpsertArgs<ExtArgs>>,
    ): Prisma__BillingScheduleClient<
      $Result.GetResult<
        Prisma.$BillingSchedulePayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of BillingSchedules.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BillingScheduleCountArgs} args - Arguments to filter BillingSchedules to count.
     * @example
     * // Count the number of BillingSchedules
     * const count = await prisma.billingSchedule.count({
     *   where: {
     *     // ... the filter for the BillingSchedules we want to count
     *   }
     * })
     **/
    count<T extends BillingScheduleCountArgs>(
      args?: Subset<T, BillingScheduleCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], BillingScheduleCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a BillingSchedule.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BillingScheduleAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends BillingScheduleAggregateArgs>(
      args: Subset<T, BillingScheduleAggregateArgs>,
    ): Prisma.PrismaPromise<GetBillingScheduleAggregateType<T>>;

    /**
     * Group by BillingSchedule.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BillingScheduleGroupByArgs} args - Group by arguments.
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
      T extends BillingScheduleGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: BillingScheduleGroupByArgs["orderBy"] }
        : { orderBy?: BillingScheduleGroupByArgs["orderBy"] },
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
      args: SubsetIntersection<T, BillingScheduleGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetBillingScheduleGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the BillingSchedule model
     */
    readonly fields: BillingScheduleFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for BillingSchedule.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__BillingScheduleClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    invoice<T extends BillingSchedule$invoiceArgs<ExtArgs> = {}>(
      args?: Subset<T, BillingSchedule$invoiceArgs<ExtArgs>>,
    ): Prisma__InvoiceClient<
      $Result.GetResult<
        Prisma.$InvoicePayload<ExtArgs>,
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
   * Fields of the BillingSchedule model
   */
  interface BillingScheduleFieldRefs {
    readonly id: FieldRef<"BillingSchedule", "String">;
    readonly dedupeKey: FieldRef<"BillingSchedule", "String">;
    readonly jobType: FieldRef<"BillingSchedule", "BillingScheduleJobType">;
    readonly invoiceId: FieldRef<"BillingSchedule", "String">;
    readonly pelangganId: FieldRef<"BillingSchedule", "String">;
    readonly runAt: FieldRef<"BillingSchedule", "DateTime">;
    readonly status: FieldRef<"BillingSchedule", "BillingScheduleStatus">;
    readonly queueJobId: FieldRef<"BillingSchedule", "String">;
    readonly payload: FieldRef<"BillingSchedule", "Json">;
    readonly version: FieldRef<"BillingSchedule", "Int">;
    readonly attemptCount: FieldRef<"BillingSchedule", "Int">;
    readonly queuedAt: FieldRef<"BillingSchedule", "DateTime">;
    readonly processingAt: FieldRef<"BillingSchedule", "DateTime">;
    readonly completedAt: FieldRef<"BillingSchedule", "DateTime">;
    readonly cancelledAt: FieldRef<"BillingSchedule", "DateTime">;
    readonly failedAt: FieldRef<"BillingSchedule", "DateTime">;
    readonly lastAttemptAt: FieldRef<"BillingSchedule", "DateTime">;
    readonly lastError: FieldRef<"BillingSchedule", "String">;
    readonly createdAt: FieldRef<"BillingSchedule", "DateTime">;
    readonly updatedAt: FieldRef<"BillingSchedule", "DateTime">;
    readonly tenantId: FieldRef<"BillingSchedule", "String">;
  }

  // Custom InputTypes
  /**
   * BillingSchedule findUnique
   */
  export type BillingScheduleFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the BillingSchedule
     */
    select?: BillingScheduleSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the BillingSchedule
     */
    omit?: BillingScheduleOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BillingScheduleInclude<ExtArgs> | null;
    /**
     * Filter, which BillingSchedule to fetch.
     */
    where: BillingScheduleWhereUniqueInput;
  };

  /**
   * BillingSchedule findUniqueOrThrow
   */
  export type BillingScheduleFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the BillingSchedule
     */
    select?: BillingScheduleSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the BillingSchedule
     */
    omit?: BillingScheduleOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BillingScheduleInclude<ExtArgs> | null;
    /**
     * Filter, which BillingSchedule to fetch.
     */
    where: BillingScheduleWhereUniqueInput;
  };

  /**
   * BillingSchedule findFirst
   */
  export type BillingScheduleFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the BillingSchedule
     */
    select?: BillingScheduleSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the BillingSchedule
     */
    omit?: BillingScheduleOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BillingScheduleInclude<ExtArgs> | null;
    /**
     * Filter, which BillingSchedule to fetch.
     */
    where?: BillingScheduleWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of BillingSchedules to fetch.
     */
    orderBy?:
      | BillingScheduleOrderByWithRelationInput
      | BillingScheduleOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for BillingSchedules.
     */
    cursor?: BillingScheduleWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` BillingSchedules from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` BillingSchedules.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of BillingSchedules.
     */
    distinct?:
      | BillingScheduleScalarFieldEnum
      | BillingScheduleScalarFieldEnum[];
  };

  /**
   * BillingSchedule findFirstOrThrow
   */
  export type BillingScheduleFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the BillingSchedule
     */
    select?: BillingScheduleSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the BillingSchedule
     */
    omit?: BillingScheduleOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BillingScheduleInclude<ExtArgs> | null;
    /**
     * Filter, which BillingSchedule to fetch.
     */
    where?: BillingScheduleWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of BillingSchedules to fetch.
     */
    orderBy?:
      | BillingScheduleOrderByWithRelationInput
      | BillingScheduleOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for BillingSchedules.
     */
    cursor?: BillingScheduleWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` BillingSchedules from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` BillingSchedules.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of BillingSchedules.
     */
    distinct?:
      | BillingScheduleScalarFieldEnum
      | BillingScheduleScalarFieldEnum[];
  };

  /**
   * BillingSchedule findMany
   */
  export type BillingScheduleFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the BillingSchedule
     */
    select?: BillingScheduleSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the BillingSchedule
     */
    omit?: BillingScheduleOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BillingScheduleInclude<ExtArgs> | null;
    /**
     * Filter, which BillingSchedules to fetch.
     */
    where?: BillingScheduleWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of BillingSchedules to fetch.
     */
    orderBy?:
      | BillingScheduleOrderByWithRelationInput
      | BillingScheduleOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing BillingSchedules.
     */
    cursor?: BillingScheduleWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` BillingSchedules from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` BillingSchedules.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of BillingSchedules.
     */
    distinct?:
      | BillingScheduleScalarFieldEnum
      | BillingScheduleScalarFieldEnum[];
  };

  /**
   * BillingSchedule create
   */
  export type BillingScheduleCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the BillingSchedule
     */
    select?: BillingScheduleSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the BillingSchedule
     */
    omit?: BillingScheduleOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BillingScheduleInclude<ExtArgs> | null;
    /**
     * The data needed to create a BillingSchedule.
     */
    data: XOR<BillingScheduleCreateInput, BillingScheduleUncheckedCreateInput>;
  };

  /**
   * BillingSchedule createMany
   */
  export type BillingScheduleCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many BillingSchedules.
     */
    data: BillingScheduleCreateManyInput | BillingScheduleCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * BillingSchedule createManyAndReturn
   */
  export type BillingScheduleCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the BillingSchedule
     */
    select?: BillingScheduleSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the BillingSchedule
     */
    omit?: BillingScheduleOmit<ExtArgs> | null;
    /**
     * The data used to create many BillingSchedules.
     */
    data: BillingScheduleCreateManyInput | BillingScheduleCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BillingScheduleIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * BillingSchedule update
   */
  export type BillingScheduleUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the BillingSchedule
     */
    select?: BillingScheduleSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the BillingSchedule
     */
    omit?: BillingScheduleOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BillingScheduleInclude<ExtArgs> | null;
    /**
     * The data needed to update a BillingSchedule.
     */
    data: XOR<BillingScheduleUpdateInput, BillingScheduleUncheckedUpdateInput>;
    /**
     * Choose, which BillingSchedule to update.
     */
    where: BillingScheduleWhereUniqueInput;
  };

  /**
   * BillingSchedule updateMany
   */
  export type BillingScheduleUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update BillingSchedules.
     */
    data: XOR<
      BillingScheduleUpdateManyMutationInput,
      BillingScheduleUncheckedUpdateManyInput
    >;
    /**
     * Filter which BillingSchedules to update
     */
    where?: BillingScheduleWhereInput;
    /**
     * Limit how many BillingSchedules to update.
     */
    limit?: number;
  };

  /**
   * BillingSchedule updateManyAndReturn
   */
  export type BillingScheduleUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the BillingSchedule
     */
    select?: BillingScheduleSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the BillingSchedule
     */
    omit?: BillingScheduleOmit<ExtArgs> | null;
    /**
     * The data used to update BillingSchedules.
     */
    data: XOR<
      BillingScheduleUpdateManyMutationInput,
      BillingScheduleUncheckedUpdateManyInput
    >;
    /**
     * Filter which BillingSchedules to update
     */
    where?: BillingScheduleWhereInput;
    /**
     * Limit how many BillingSchedules to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BillingScheduleIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * BillingSchedule upsert
   */
  export type BillingScheduleUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the BillingSchedule
     */
    select?: BillingScheduleSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the BillingSchedule
     */
    omit?: BillingScheduleOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BillingScheduleInclude<ExtArgs> | null;
    /**
     * The filter to search for the BillingSchedule to update in case it exists.
     */
    where: BillingScheduleWhereUniqueInput;
    /**
     * In case the BillingSchedule found by the `where` argument doesn't exist, create a new BillingSchedule with this data.
     */
    create: XOR<
      BillingScheduleCreateInput,
      BillingScheduleUncheckedCreateInput
    >;
    /**
     * In case the BillingSchedule was found with the provided `where` argument, update it with this data.
     */
    update: XOR<
      BillingScheduleUpdateInput,
      BillingScheduleUncheckedUpdateInput
    >;
  };

  /**
   * BillingSchedule delete
   */
  export type BillingScheduleDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the BillingSchedule
     */
    select?: BillingScheduleSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the BillingSchedule
     */
    omit?: BillingScheduleOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BillingScheduleInclude<ExtArgs> | null;
    /**
     * Filter which BillingSchedule to delete.
     */
    where: BillingScheduleWhereUniqueInput;
  };

  /**
   * BillingSchedule deleteMany
   */
  export type BillingScheduleDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which BillingSchedules to delete
     */
    where?: BillingScheduleWhereInput;
    /**
     * Limit how many BillingSchedules to delete.
     */
    limit?: number;
  };

  /**
   * BillingSchedule.invoice
   */
  export type BillingSchedule$invoiceArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null;
    where?: InvoiceWhereInput;
  };

  /**
   * BillingSchedule without action
   */
  export type BillingScheduleDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the BillingSchedule
     */
    select?: BillingScheduleSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the BillingSchedule
     */
    omit?: BillingScheduleOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BillingScheduleInclude<ExtArgs> | null;
  };

  /**
   * Model InvoiceItem
   */

  export type AggregateInvoiceItem = {
    _count: InvoiceItemCountAggregateOutputType | null;
    _avg: InvoiceItemAvgAggregateOutputType | null;
    _sum: InvoiceItemSumAggregateOutputType | null;
    _min: InvoiceItemMinAggregateOutputType | null;
    _max: InvoiceItemMaxAggregateOutputType | null;
  };

  export type InvoiceItemAvgAggregateOutputType = {
    quantity: number | null;
    unitPrice: number | null;
    totalPrice: number | null;
  };

  export type InvoiceItemSumAggregateOutputType = {
    quantity: number | null;
    unitPrice: bigint | null;
    totalPrice: bigint | null;
  };

  export type InvoiceItemMinAggregateOutputType = {
    id: string | null;
    invoiceId: string | null;
    description: string | null;
    quantity: number | null;
    unitPrice: bigint | null;
    totalPrice: bigint | null;
    itemType: $Enums.ItemType | null;
    tenantId: string | null;
  };

  export type InvoiceItemMaxAggregateOutputType = {
    id: string | null;
    invoiceId: string | null;
    description: string | null;
    quantity: number | null;
    unitPrice: bigint | null;
    totalPrice: bigint | null;
    itemType: $Enums.ItemType | null;
    tenantId: string | null;
  };

  export type InvoiceItemCountAggregateOutputType = {
    id: number;
    invoiceId: number;
    description: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    itemType: number;
    tenantId: number;
    _all: number;
  };

  export type InvoiceItemAvgAggregateInputType = {
    quantity?: true;
    unitPrice?: true;
    totalPrice?: true;
  };

  export type InvoiceItemSumAggregateInputType = {
    quantity?: true;
    unitPrice?: true;
    totalPrice?: true;
  };

  export type InvoiceItemMinAggregateInputType = {
    id?: true;
    invoiceId?: true;
    description?: true;
    quantity?: true;
    unitPrice?: true;
    totalPrice?: true;
    itemType?: true;
    tenantId?: true;
  };

  export type InvoiceItemMaxAggregateInputType = {
    id?: true;
    invoiceId?: true;
    description?: true;
    quantity?: true;
    unitPrice?: true;
    totalPrice?: true;
    itemType?: true;
    tenantId?: true;
  };

  export type InvoiceItemCountAggregateInputType = {
    id?: true;
    invoiceId?: true;
    description?: true;
    quantity?: true;
    unitPrice?: true;
    totalPrice?: true;
    itemType?: true;
    tenantId?: true;
    _all?: true;
  };

  export type InvoiceItemAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which InvoiceItem to aggregate.
     */
    where?: InvoiceItemWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of InvoiceItems to fetch.
     */
    orderBy?:
      | InvoiceItemOrderByWithRelationInput
      | InvoiceItemOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: InvoiceItemWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` InvoiceItems from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` InvoiceItems.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned InvoiceItems
     **/
    _count?: true | InvoiceItemCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: InvoiceItemAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: InvoiceItemSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: InvoiceItemMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: InvoiceItemMaxAggregateInputType;
  };

  export type GetInvoiceItemAggregateType<T extends InvoiceItemAggregateArgs> =
    {
      [P in keyof T & keyof AggregateInvoiceItem]: P extends "_count" | "count"
        ? T[P] extends true
          ? number
          : GetScalarType<T[P], AggregateInvoiceItem[P]>
        : GetScalarType<T[P], AggregateInvoiceItem[P]>;
    };

  export type InvoiceItemGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: InvoiceItemWhereInput;
    orderBy?:
      | InvoiceItemOrderByWithAggregationInput
      | InvoiceItemOrderByWithAggregationInput[];
    by: InvoiceItemScalarFieldEnum[] | InvoiceItemScalarFieldEnum;
    having?: InvoiceItemScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: InvoiceItemCountAggregateInputType | true;
    _avg?: InvoiceItemAvgAggregateInputType;
    _sum?: InvoiceItemSumAggregateInputType;
    _min?: InvoiceItemMinAggregateInputType;
    _max?: InvoiceItemMaxAggregateInputType;
  };

  export type InvoiceItemGroupByOutputType = {
    id: string;
    invoiceId: string;
    description: string;
    quantity: number;
    unitPrice: bigint;
    totalPrice: bigint;
    itemType: $Enums.ItemType;
    tenantId: string | null;
    _count: InvoiceItemCountAggregateOutputType | null;
    _avg: InvoiceItemAvgAggregateOutputType | null;
    _sum: InvoiceItemSumAggregateOutputType | null;
    _min: InvoiceItemMinAggregateOutputType | null;
    _max: InvoiceItemMaxAggregateOutputType | null;
  };

  type GetInvoiceItemGroupByPayload<T extends InvoiceItemGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<InvoiceItemGroupByOutputType, T["by"]> & {
          [P in keyof T &
            keyof InvoiceItemGroupByOutputType]: P extends "_count"
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], InvoiceItemGroupByOutputType[P]>
            : GetScalarType<T[P], InvoiceItemGroupByOutputType[P]>;
        }
      >
    >;

  export type InvoiceItemSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      invoiceId?: boolean;
      description?: boolean;
      quantity?: boolean;
      unitPrice?: boolean;
      totalPrice?: boolean;
      itemType?: boolean;
      tenantId?: boolean;
      invoice?: boolean | InvoiceDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["invoiceItem"]
  >;

  export type InvoiceItemSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      invoiceId?: boolean;
      description?: boolean;
      quantity?: boolean;
      unitPrice?: boolean;
      totalPrice?: boolean;
      itemType?: boolean;
      tenantId?: boolean;
      invoice?: boolean | InvoiceDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["invoiceItem"]
  >;

  export type InvoiceItemSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      invoiceId?: boolean;
      description?: boolean;
      quantity?: boolean;
      unitPrice?: boolean;
      totalPrice?: boolean;
      itemType?: boolean;
      tenantId?: boolean;
      invoice?: boolean | InvoiceDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["invoiceItem"]
  >;

  export type InvoiceItemSelectScalar = {
    id?: boolean;
    invoiceId?: boolean;
    description?: boolean;
    quantity?: boolean;
    unitPrice?: boolean;
    totalPrice?: boolean;
    itemType?: boolean;
    tenantId?: boolean;
  };

  export type InvoiceItemOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "invoiceId"
    | "description"
    | "quantity"
    | "unitPrice"
    | "totalPrice"
    | "itemType"
    | "tenantId",
    ExtArgs["result"]["invoiceItem"]
  >;
  export type InvoiceItemInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    invoice?: boolean | InvoiceDefaultArgs<ExtArgs>;
  };
  export type InvoiceItemIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    invoice?: boolean | InvoiceDefaultArgs<ExtArgs>;
  };
  export type InvoiceItemIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    invoice?: boolean | InvoiceDefaultArgs<ExtArgs>;
  };

  export type $InvoiceItemPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "InvoiceItem";
    objects: {
      invoice: Prisma.$InvoicePayload<ExtArgs>;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        invoiceId: string;
        description: string;
        quantity: number;
        unitPrice: bigint;
        totalPrice: bigint;
        itemType: $Enums.ItemType;
        tenantId: string | null;
      },
      ExtArgs["result"]["invoiceItem"]
    >;
    composites: {};
  };

  type InvoiceItemGetPayload<
    S extends boolean | null | undefined | InvoiceItemDefaultArgs,
  > = $Result.GetResult<Prisma.$InvoiceItemPayload, S>;

  type InvoiceItemCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    InvoiceItemFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: InvoiceItemCountAggregateInputType | true;
  };

  export interface InvoiceItemDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["InvoiceItem"];
      meta: { name: "InvoiceItem" };
    };
    /**
     * Find zero or one InvoiceItem that matches the filter.
     * @param {InvoiceItemFindUniqueArgs} args - Arguments to find a InvoiceItem
     * @example
     * // Get one InvoiceItem
     * const invoiceItem = await prisma.invoiceItem.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends InvoiceItemFindUniqueArgs>(
      args: SelectSubset<T, InvoiceItemFindUniqueArgs<ExtArgs>>,
    ): Prisma__InvoiceItemClient<
      $Result.GetResult<
        Prisma.$InvoiceItemPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one InvoiceItem that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {InvoiceItemFindUniqueOrThrowArgs} args - Arguments to find a InvoiceItem
     * @example
     * // Get one InvoiceItem
     * const invoiceItem = await prisma.invoiceItem.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends InvoiceItemFindUniqueOrThrowArgs>(
      args: SelectSubset<T, InvoiceItemFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__InvoiceItemClient<
      $Result.GetResult<
        Prisma.$InvoiceItemPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first InvoiceItem that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceItemFindFirstArgs} args - Arguments to find a InvoiceItem
     * @example
     * // Get one InvoiceItem
     * const invoiceItem = await prisma.invoiceItem.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends InvoiceItemFindFirstArgs>(
      args?: SelectSubset<T, InvoiceItemFindFirstArgs<ExtArgs>>,
    ): Prisma__InvoiceItemClient<
      $Result.GetResult<
        Prisma.$InvoiceItemPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first InvoiceItem that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceItemFindFirstOrThrowArgs} args - Arguments to find a InvoiceItem
     * @example
     * // Get one InvoiceItem
     * const invoiceItem = await prisma.invoiceItem.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends InvoiceItemFindFirstOrThrowArgs>(
      args?: SelectSubset<T, InvoiceItemFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__InvoiceItemClient<
      $Result.GetResult<
        Prisma.$InvoiceItemPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more InvoiceItems that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceItemFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all InvoiceItems
     * const invoiceItems = await prisma.invoiceItem.findMany()
     *
     * // Get first 10 InvoiceItems
     * const invoiceItems = await prisma.invoiceItem.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const invoiceItemWithIdOnly = await prisma.invoiceItem.findMany({ select: { id: true } })
     *
     */
    findMany<T extends InvoiceItemFindManyArgs>(
      args?: SelectSubset<T, InvoiceItemFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$InvoiceItemPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a InvoiceItem.
     * @param {InvoiceItemCreateArgs} args - Arguments to create a InvoiceItem.
     * @example
     * // Create one InvoiceItem
     * const InvoiceItem = await prisma.invoiceItem.create({
     *   data: {
     *     // ... data to create a InvoiceItem
     *   }
     * })
     *
     */
    create<T extends InvoiceItemCreateArgs>(
      args: SelectSubset<T, InvoiceItemCreateArgs<ExtArgs>>,
    ): Prisma__InvoiceItemClient<
      $Result.GetResult<
        Prisma.$InvoiceItemPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many InvoiceItems.
     * @param {InvoiceItemCreateManyArgs} args - Arguments to create many InvoiceItems.
     * @example
     * // Create many InvoiceItems
     * const invoiceItem = await prisma.invoiceItem.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends InvoiceItemCreateManyArgs>(
      args?: SelectSubset<T, InvoiceItemCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many InvoiceItems and returns the data saved in the database.
     * @param {InvoiceItemCreateManyAndReturnArgs} args - Arguments to create many InvoiceItems.
     * @example
     * // Create many InvoiceItems
     * const invoiceItem = await prisma.invoiceItem.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many InvoiceItems and only return the `id`
     * const invoiceItemWithIdOnly = await prisma.invoiceItem.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends InvoiceItemCreateManyAndReturnArgs>(
      args?: SelectSubset<T, InvoiceItemCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$InvoiceItemPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a InvoiceItem.
     * @param {InvoiceItemDeleteArgs} args - Arguments to delete one InvoiceItem.
     * @example
     * // Delete one InvoiceItem
     * const InvoiceItem = await prisma.invoiceItem.delete({
     *   where: {
     *     // ... filter to delete one InvoiceItem
     *   }
     * })
     *
     */
    delete<T extends InvoiceItemDeleteArgs>(
      args: SelectSubset<T, InvoiceItemDeleteArgs<ExtArgs>>,
    ): Prisma__InvoiceItemClient<
      $Result.GetResult<
        Prisma.$InvoiceItemPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one InvoiceItem.
     * @param {InvoiceItemUpdateArgs} args - Arguments to update one InvoiceItem.
     * @example
     * // Update one InvoiceItem
     * const invoiceItem = await prisma.invoiceItem.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends InvoiceItemUpdateArgs>(
      args: SelectSubset<T, InvoiceItemUpdateArgs<ExtArgs>>,
    ): Prisma__InvoiceItemClient<
      $Result.GetResult<
        Prisma.$InvoiceItemPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more InvoiceItems.
     * @param {InvoiceItemDeleteManyArgs} args - Arguments to filter InvoiceItems to delete.
     * @example
     * // Delete a few InvoiceItems
     * const { count } = await prisma.invoiceItem.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends InvoiceItemDeleteManyArgs>(
      args?: SelectSubset<T, InvoiceItemDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more InvoiceItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceItemUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many InvoiceItems
     * const invoiceItem = await prisma.invoiceItem.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends InvoiceItemUpdateManyArgs>(
      args: SelectSubset<T, InvoiceItemUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more InvoiceItems and returns the data updated in the database.
     * @param {InvoiceItemUpdateManyAndReturnArgs} args - Arguments to update many InvoiceItems.
     * @example
     * // Update many InvoiceItems
     * const invoiceItem = await prisma.invoiceItem.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more InvoiceItems and only return the `id`
     * const invoiceItemWithIdOnly = await prisma.invoiceItem.updateManyAndReturn({
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
    updateManyAndReturn<T extends InvoiceItemUpdateManyAndReturnArgs>(
      args: SelectSubset<T, InvoiceItemUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$InvoiceItemPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one InvoiceItem.
     * @param {InvoiceItemUpsertArgs} args - Arguments to update or create a InvoiceItem.
     * @example
     * // Update or create a InvoiceItem
     * const invoiceItem = await prisma.invoiceItem.upsert({
     *   create: {
     *     // ... data to create a InvoiceItem
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the InvoiceItem we want to update
     *   }
     * })
     */
    upsert<T extends InvoiceItemUpsertArgs>(
      args: SelectSubset<T, InvoiceItemUpsertArgs<ExtArgs>>,
    ): Prisma__InvoiceItemClient<
      $Result.GetResult<
        Prisma.$InvoiceItemPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of InvoiceItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceItemCountArgs} args - Arguments to filter InvoiceItems to count.
     * @example
     * // Count the number of InvoiceItems
     * const count = await prisma.invoiceItem.count({
     *   where: {
     *     // ... the filter for the InvoiceItems we want to count
     *   }
     * })
     **/
    count<T extends InvoiceItemCountArgs>(
      args?: Subset<T, InvoiceItemCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], InvoiceItemCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a InvoiceItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceItemAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends InvoiceItemAggregateArgs>(
      args: Subset<T, InvoiceItemAggregateArgs>,
    ): Prisma.PrismaPromise<GetInvoiceItemAggregateType<T>>;

    /**
     * Group by InvoiceItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceItemGroupByArgs} args - Group by arguments.
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
      T extends InvoiceItemGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: InvoiceItemGroupByArgs["orderBy"] }
        : { orderBy?: InvoiceItemGroupByArgs["orderBy"] },
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
      args: SubsetIntersection<T, InvoiceItemGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetInvoiceItemGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the InvoiceItem model
     */
    readonly fields: InvoiceItemFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for InvoiceItem.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__InvoiceItemClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    invoice<T extends InvoiceDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, InvoiceDefaultArgs<ExtArgs>>,
    ): Prisma__InvoiceClient<
      | $Result.GetResult<
          Prisma.$InvoicePayload<ExtArgs>,
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
   * Fields of the InvoiceItem model
   */
  interface InvoiceItemFieldRefs {
    readonly id: FieldRef<"InvoiceItem", "String">;
    readonly invoiceId: FieldRef<"InvoiceItem", "String">;
    readonly description: FieldRef<"InvoiceItem", "String">;
    readonly quantity: FieldRef<"InvoiceItem", "Int">;
    readonly unitPrice: FieldRef<"InvoiceItem", "BigInt">;
    readonly totalPrice: FieldRef<"InvoiceItem", "BigInt">;
    readonly itemType: FieldRef<"InvoiceItem", "ItemType">;
    readonly tenantId: FieldRef<"InvoiceItem", "String">;
  }

  // Custom InputTypes
  /**
   * InvoiceItem findUnique
   */
  export type InvoiceItemFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null;
    /**
     * Filter, which InvoiceItem to fetch.
     */
    where: InvoiceItemWhereUniqueInput;
  };

  /**
   * InvoiceItem findUniqueOrThrow
   */
  export type InvoiceItemFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null;
    /**
     * Filter, which InvoiceItem to fetch.
     */
    where: InvoiceItemWhereUniqueInput;
  };

  /**
   * InvoiceItem findFirst
   */
  export type InvoiceItemFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null;
    /**
     * Filter, which InvoiceItem to fetch.
     */
    where?: InvoiceItemWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of InvoiceItems to fetch.
     */
    orderBy?:
      | InvoiceItemOrderByWithRelationInput
      | InvoiceItemOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for InvoiceItems.
     */
    cursor?: InvoiceItemWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` InvoiceItems from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` InvoiceItems.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of InvoiceItems.
     */
    distinct?: InvoiceItemScalarFieldEnum | InvoiceItemScalarFieldEnum[];
  };

  /**
   * InvoiceItem findFirstOrThrow
   */
  export type InvoiceItemFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null;
    /**
     * Filter, which InvoiceItem to fetch.
     */
    where?: InvoiceItemWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of InvoiceItems to fetch.
     */
    orderBy?:
      | InvoiceItemOrderByWithRelationInput
      | InvoiceItemOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for InvoiceItems.
     */
    cursor?: InvoiceItemWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` InvoiceItems from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` InvoiceItems.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of InvoiceItems.
     */
    distinct?: InvoiceItemScalarFieldEnum | InvoiceItemScalarFieldEnum[];
  };

  /**
   * InvoiceItem findMany
   */
  export type InvoiceItemFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null;
    /**
     * Filter, which InvoiceItems to fetch.
     */
    where?: InvoiceItemWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of InvoiceItems to fetch.
     */
    orderBy?:
      | InvoiceItemOrderByWithRelationInput
      | InvoiceItemOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing InvoiceItems.
     */
    cursor?: InvoiceItemWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` InvoiceItems from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` InvoiceItems.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of InvoiceItems.
     */
    distinct?: InvoiceItemScalarFieldEnum | InvoiceItemScalarFieldEnum[];
  };

  /**
   * InvoiceItem create
   */
  export type InvoiceItemCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null;
    /**
     * The data needed to create a InvoiceItem.
     */
    data: XOR<InvoiceItemCreateInput, InvoiceItemUncheckedCreateInput>;
  };

  /**
   * InvoiceItem createMany
   */
  export type InvoiceItemCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many InvoiceItems.
     */
    data: InvoiceItemCreateManyInput | InvoiceItemCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * InvoiceItem createManyAndReturn
   */
  export type InvoiceItemCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null;
    /**
     * The data used to create many InvoiceItems.
     */
    data: InvoiceItemCreateManyInput | InvoiceItemCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * InvoiceItem update
   */
  export type InvoiceItemUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null;
    /**
     * The data needed to update a InvoiceItem.
     */
    data: XOR<InvoiceItemUpdateInput, InvoiceItemUncheckedUpdateInput>;
    /**
     * Choose, which InvoiceItem to update.
     */
    where: InvoiceItemWhereUniqueInput;
  };

  /**
   * InvoiceItem updateMany
   */
  export type InvoiceItemUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update InvoiceItems.
     */
    data: XOR<
      InvoiceItemUpdateManyMutationInput,
      InvoiceItemUncheckedUpdateManyInput
    >;
    /**
     * Filter which InvoiceItems to update
     */
    where?: InvoiceItemWhereInput;
    /**
     * Limit how many InvoiceItems to update.
     */
    limit?: number;
  };

  /**
   * InvoiceItem updateManyAndReturn
   */
  export type InvoiceItemUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null;
    /**
     * The data used to update InvoiceItems.
     */
    data: XOR<
      InvoiceItemUpdateManyMutationInput,
      InvoiceItemUncheckedUpdateManyInput
    >;
    /**
     * Filter which InvoiceItems to update
     */
    where?: InvoiceItemWhereInput;
    /**
     * Limit how many InvoiceItems to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * InvoiceItem upsert
   */
  export type InvoiceItemUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null;
    /**
     * The filter to search for the InvoiceItem to update in case it exists.
     */
    where: InvoiceItemWhereUniqueInput;
    /**
     * In case the InvoiceItem found by the `where` argument doesn't exist, create a new InvoiceItem with this data.
     */
    create: XOR<InvoiceItemCreateInput, InvoiceItemUncheckedCreateInput>;
    /**
     * In case the InvoiceItem was found with the provided `where` argument, update it with this data.
     */
    update: XOR<InvoiceItemUpdateInput, InvoiceItemUncheckedUpdateInput>;
  };

  /**
   * InvoiceItem delete
   */
  export type InvoiceItemDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null;
    /**
     * Filter which InvoiceItem to delete.
     */
    where: InvoiceItemWhereUniqueInput;
  };

  /**
   * InvoiceItem deleteMany
   */
  export type InvoiceItemDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which InvoiceItems to delete
     */
    where?: InvoiceItemWhereInput;
    /**
     * Limit how many InvoiceItems to delete.
     */
    limit?: number;
  };

  /**
   * InvoiceItem without action
   */
  export type InvoiceItemDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null;
  };

  /**
   * Model Payment
   */

  export type AggregatePayment = {
    _count: PaymentCountAggregateOutputType | null;
    _avg: PaymentAvgAggregateOutputType | null;
    _sum: PaymentSumAggregateOutputType | null;
    _min: PaymentMinAggregateOutputType | null;
    _max: PaymentMaxAggregateOutputType | null;
  };

  export type PaymentAvgAggregateOutputType = {
    amount: number | null;
  };

  export type PaymentSumAggregateOutputType = {
    amount: bigint | null;
  };

  export type PaymentMinAggregateOutputType = {
    id: string | null;
    invoiceId: string | null;
    pelangganId: string | null;
    amount: bigint | null;
    paymentDate: Date | null;
    paymentMethod: $Enums.PaymentMethod | null;
    reference: string | null;
    notes: string | null;
    verifiedBy: string | null;
    verifiedAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    accountId: string | null;
    gatewayStatus: $Enums.GatewayPaymentStatus | null;
    gatewayProvider: string | null;
    transactionId: string | null;
    paymentUrl: string | null;
    expiresAt: Date | null;
    unmatchedMutationId: string | null;
    receiptUrl: string | null;
    tenantId: string | null;
  };

  export type PaymentMaxAggregateOutputType = {
    id: string | null;
    invoiceId: string | null;
    pelangganId: string | null;
    amount: bigint | null;
    paymentDate: Date | null;
    paymentMethod: $Enums.PaymentMethod | null;
    reference: string | null;
    notes: string | null;
    verifiedBy: string | null;
    verifiedAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    accountId: string | null;
    gatewayStatus: $Enums.GatewayPaymentStatus | null;
    gatewayProvider: string | null;
    transactionId: string | null;
    paymentUrl: string | null;
    expiresAt: Date | null;
    unmatchedMutationId: string | null;
    receiptUrl: string | null;
    tenantId: string | null;
  };

  export type PaymentCountAggregateOutputType = {
    id: number;
    invoiceId: number;
    pelangganId: number;
    amount: number;
    paymentDate: number;
    paymentMethod: number;
    reference: number;
    notes: number;
    verifiedBy: number;
    verifiedAt: number;
    createdAt: number;
    updatedAt: number;
    accountId: number;
    gatewayStatus: number;
    gatewayProvider: number;
    transactionId: number;
    paymentUrl: number;
    expiresAt: number;
    unmatchedMutationId: number;
    receiptUrl: number;
    tenantId: number;
    _all: number;
  };

  export type PaymentAvgAggregateInputType = {
    amount?: true;
  };

  export type PaymentSumAggregateInputType = {
    amount?: true;
  };

  export type PaymentMinAggregateInputType = {
    id?: true;
    invoiceId?: true;
    pelangganId?: true;
    amount?: true;
    paymentDate?: true;
    paymentMethod?: true;
    reference?: true;
    notes?: true;
    verifiedBy?: true;
    verifiedAt?: true;
    createdAt?: true;
    updatedAt?: true;
    accountId?: true;
    gatewayStatus?: true;
    gatewayProvider?: true;
    transactionId?: true;
    paymentUrl?: true;
    expiresAt?: true;
    unmatchedMutationId?: true;
    receiptUrl?: true;
    tenantId?: true;
  };

  export type PaymentMaxAggregateInputType = {
    id?: true;
    invoiceId?: true;
    pelangganId?: true;
    amount?: true;
    paymentDate?: true;
    paymentMethod?: true;
    reference?: true;
    notes?: true;
    verifiedBy?: true;
    verifiedAt?: true;
    createdAt?: true;
    updatedAt?: true;
    accountId?: true;
    gatewayStatus?: true;
    gatewayProvider?: true;
    transactionId?: true;
    paymentUrl?: true;
    expiresAt?: true;
    unmatchedMutationId?: true;
    receiptUrl?: true;
    tenantId?: true;
  };

  export type PaymentCountAggregateInputType = {
    id?: true;
    invoiceId?: true;
    pelangganId?: true;
    amount?: true;
    paymentDate?: true;
    paymentMethod?: true;
    reference?: true;
    notes?: true;
    verifiedBy?: true;
    verifiedAt?: true;
    createdAt?: true;
    updatedAt?: true;
    accountId?: true;
    gatewayStatus?: true;
    gatewayProvider?: true;
    transactionId?: true;
    paymentUrl?: true;
    expiresAt?: true;
    unmatchedMutationId?: true;
    receiptUrl?: true;
    tenantId?: true;
    _all?: true;
  };

  export type PaymentAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Payment to aggregate.
     */
    where?: PaymentWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Payments to fetch.
     */
    orderBy?:
      | PaymentOrderByWithRelationInput
      | PaymentOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: PaymentWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Payments from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Payments.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned Payments
     **/
    _count?: true | PaymentCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: PaymentAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: PaymentSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: PaymentMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: PaymentMaxAggregateInputType;
  };

  export type GetPaymentAggregateType<T extends PaymentAggregateArgs> = {
    [P in keyof T & keyof AggregatePayment]: P extends "_count" | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePayment[P]>
      : GetScalarType<T[P], AggregatePayment[P]>;
  };

  export type PaymentGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: PaymentWhereInput;
    orderBy?:
      | PaymentOrderByWithAggregationInput
      | PaymentOrderByWithAggregationInput[];
    by: PaymentScalarFieldEnum[] | PaymentScalarFieldEnum;
    having?: PaymentScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: PaymentCountAggregateInputType | true;
    _avg?: PaymentAvgAggregateInputType;
    _sum?: PaymentSumAggregateInputType;
    _min?: PaymentMinAggregateInputType;
    _max?: PaymentMaxAggregateInputType;
  };

  export type PaymentGroupByOutputType = {
    id: string;
    invoiceId: string | null;
    pelangganId: string;
    amount: bigint;
    paymentDate: Date;
    paymentMethod: $Enums.PaymentMethod;
    reference: string | null;
    notes: string | null;
    verifiedBy: string | null;
    verifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    accountId: string | null;
    gatewayStatus: $Enums.GatewayPaymentStatus | null;
    gatewayProvider: string | null;
    transactionId: string | null;
    paymentUrl: string | null;
    expiresAt: Date | null;
    unmatchedMutationId: string | null;
    receiptUrl: string | null;
    tenantId: string | null;
    _count: PaymentCountAggregateOutputType | null;
    _avg: PaymentAvgAggregateOutputType | null;
    _sum: PaymentSumAggregateOutputType | null;
    _min: PaymentMinAggregateOutputType | null;
    _max: PaymentMaxAggregateOutputType | null;
  };

  type GetPaymentGroupByPayload<T extends PaymentGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<PaymentGroupByOutputType, T["by"]> & {
          [P in keyof T & keyof PaymentGroupByOutputType]: P extends "_count"
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PaymentGroupByOutputType[P]>
            : GetScalarType<T[P], PaymentGroupByOutputType[P]>;
        }
      >
    >;

  export type PaymentSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      invoiceId?: boolean;
      pelangganId?: boolean;
      amount?: boolean;
      paymentDate?: boolean;
      paymentMethod?: boolean;
      reference?: boolean;
      notes?: boolean;
      verifiedBy?: boolean;
      verifiedAt?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      accountId?: boolean;
      gatewayStatus?: boolean;
      gatewayProvider?: boolean;
      transactionId?: boolean;
      paymentUrl?: boolean;
      expiresAt?: boolean;
      unmatchedMutationId?: boolean;
      receiptUrl?: boolean;
      tenantId?: boolean;
      invoice?: boolean | Payment$invoiceArgs<ExtArgs>;
      unmatchedMutation?: boolean | Payment$unmatchedMutationArgs<ExtArgs>;
    },
    ExtArgs["result"]["payment"]
  >;

  export type PaymentSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      invoiceId?: boolean;
      pelangganId?: boolean;
      amount?: boolean;
      paymentDate?: boolean;
      paymentMethod?: boolean;
      reference?: boolean;
      notes?: boolean;
      verifiedBy?: boolean;
      verifiedAt?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      accountId?: boolean;
      gatewayStatus?: boolean;
      gatewayProvider?: boolean;
      transactionId?: boolean;
      paymentUrl?: boolean;
      expiresAt?: boolean;
      unmatchedMutationId?: boolean;
      receiptUrl?: boolean;
      tenantId?: boolean;
      invoice?: boolean | Payment$invoiceArgs<ExtArgs>;
      unmatchedMutation?: boolean | Payment$unmatchedMutationArgs<ExtArgs>;
    },
    ExtArgs["result"]["payment"]
  >;

  export type PaymentSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      invoiceId?: boolean;
      pelangganId?: boolean;
      amount?: boolean;
      paymentDate?: boolean;
      paymentMethod?: boolean;
      reference?: boolean;
      notes?: boolean;
      verifiedBy?: boolean;
      verifiedAt?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      accountId?: boolean;
      gatewayStatus?: boolean;
      gatewayProvider?: boolean;
      transactionId?: boolean;
      paymentUrl?: boolean;
      expiresAt?: boolean;
      unmatchedMutationId?: boolean;
      receiptUrl?: boolean;
      tenantId?: boolean;
      invoice?: boolean | Payment$invoiceArgs<ExtArgs>;
      unmatchedMutation?: boolean | Payment$unmatchedMutationArgs<ExtArgs>;
    },
    ExtArgs["result"]["payment"]
  >;

  export type PaymentSelectScalar = {
    id?: boolean;
    invoiceId?: boolean;
    pelangganId?: boolean;
    amount?: boolean;
    paymentDate?: boolean;
    paymentMethod?: boolean;
    reference?: boolean;
    notes?: boolean;
    verifiedBy?: boolean;
    verifiedAt?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    accountId?: boolean;
    gatewayStatus?: boolean;
    gatewayProvider?: boolean;
    transactionId?: boolean;
    paymentUrl?: boolean;
    expiresAt?: boolean;
    unmatchedMutationId?: boolean;
    receiptUrl?: boolean;
    tenantId?: boolean;
  };

  export type PaymentOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "invoiceId"
    | "pelangganId"
    | "amount"
    | "paymentDate"
    | "paymentMethod"
    | "reference"
    | "notes"
    | "verifiedBy"
    | "verifiedAt"
    | "createdAt"
    | "updatedAt"
    | "accountId"
    | "gatewayStatus"
    | "gatewayProvider"
    | "transactionId"
    | "paymentUrl"
    | "expiresAt"
    | "unmatchedMutationId"
    | "receiptUrl"
    | "tenantId",
    ExtArgs["result"]["payment"]
  >;
  export type PaymentInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    invoice?: boolean | Payment$invoiceArgs<ExtArgs>;
    unmatchedMutation?: boolean | Payment$unmatchedMutationArgs<ExtArgs>;
  };
  export type PaymentIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    invoice?: boolean | Payment$invoiceArgs<ExtArgs>;
    unmatchedMutation?: boolean | Payment$unmatchedMutationArgs<ExtArgs>;
  };
  export type PaymentIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    invoice?: boolean | Payment$invoiceArgs<ExtArgs>;
    unmatchedMutation?: boolean | Payment$unmatchedMutationArgs<ExtArgs>;
  };

  export type $PaymentPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "Payment";
    objects: {
      invoice: Prisma.$InvoicePayload<ExtArgs> | null;
      unmatchedMutation: Prisma.$UnmatchedMutationPayload<ExtArgs> | null;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        invoiceId: string | null;
        pelangganId: string;
        amount: bigint;
        paymentDate: Date;
        paymentMethod: $Enums.PaymentMethod;
        reference: string | null;
        notes: string | null;
        verifiedBy: string | null;
        verifiedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        accountId: string | null;
        gatewayStatus: $Enums.GatewayPaymentStatus | null;
        gatewayProvider: string | null;
        transactionId: string | null;
        paymentUrl: string | null;
        expiresAt: Date | null;
        unmatchedMutationId: string | null;
        receiptUrl: string | null;
        tenantId: string | null;
      },
      ExtArgs["result"]["payment"]
    >;
    composites: {};
  };

  type PaymentGetPayload<
    S extends boolean | null | undefined | PaymentDefaultArgs,
  > = $Result.GetResult<Prisma.$PaymentPayload, S>;

  type PaymentCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<PaymentFindManyArgs, "select" | "include" | "distinct" | "omit"> & {
    select?: PaymentCountAggregateInputType | true;
  };

  export interface PaymentDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["Payment"];
      meta: { name: "Payment" };
    };
    /**
     * Find zero or one Payment that matches the filter.
     * @param {PaymentFindUniqueArgs} args - Arguments to find a Payment
     * @example
     * // Get one Payment
     * const payment = await prisma.payment.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PaymentFindUniqueArgs>(
      args: SelectSubset<T, PaymentFindUniqueArgs<ExtArgs>>,
    ): Prisma__PaymentClient<
      $Result.GetResult<
        Prisma.$PaymentPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one Payment that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PaymentFindUniqueOrThrowArgs} args - Arguments to find a Payment
     * @example
     * // Get one Payment
     * const payment = await prisma.payment.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PaymentFindUniqueOrThrowArgs>(
      args: SelectSubset<T, PaymentFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__PaymentClient<
      $Result.GetResult<
        Prisma.$PaymentPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first Payment that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentFindFirstArgs} args - Arguments to find a Payment
     * @example
     * // Get one Payment
     * const payment = await prisma.payment.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PaymentFindFirstArgs>(
      args?: SelectSubset<T, PaymentFindFirstArgs<ExtArgs>>,
    ): Prisma__PaymentClient<
      $Result.GetResult<
        Prisma.$PaymentPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first Payment that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentFindFirstOrThrowArgs} args - Arguments to find a Payment
     * @example
     * // Get one Payment
     * const payment = await prisma.payment.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PaymentFindFirstOrThrowArgs>(
      args?: SelectSubset<T, PaymentFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__PaymentClient<
      $Result.GetResult<
        Prisma.$PaymentPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more Payments that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Payments
     * const payments = await prisma.payment.findMany()
     *
     * // Get first 10 Payments
     * const payments = await prisma.payment.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const paymentWithIdOnly = await prisma.payment.findMany({ select: { id: true } })
     *
     */
    findMany<T extends PaymentFindManyArgs>(
      args?: SelectSubset<T, PaymentFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$PaymentPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a Payment.
     * @param {PaymentCreateArgs} args - Arguments to create a Payment.
     * @example
     * // Create one Payment
     * const Payment = await prisma.payment.create({
     *   data: {
     *     // ... data to create a Payment
     *   }
     * })
     *
     */
    create<T extends PaymentCreateArgs>(
      args: SelectSubset<T, PaymentCreateArgs<ExtArgs>>,
    ): Prisma__PaymentClient<
      $Result.GetResult<
        Prisma.$PaymentPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many Payments.
     * @param {PaymentCreateManyArgs} args - Arguments to create many Payments.
     * @example
     * // Create many Payments
     * const payment = await prisma.payment.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends PaymentCreateManyArgs>(
      args?: SelectSubset<T, PaymentCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many Payments and returns the data saved in the database.
     * @param {PaymentCreateManyAndReturnArgs} args - Arguments to create many Payments.
     * @example
     * // Create many Payments
     * const payment = await prisma.payment.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many Payments and only return the `id`
     * const paymentWithIdOnly = await prisma.payment.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends PaymentCreateManyAndReturnArgs>(
      args?: SelectSubset<T, PaymentCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$PaymentPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a Payment.
     * @param {PaymentDeleteArgs} args - Arguments to delete one Payment.
     * @example
     * // Delete one Payment
     * const Payment = await prisma.payment.delete({
     *   where: {
     *     // ... filter to delete one Payment
     *   }
     * })
     *
     */
    delete<T extends PaymentDeleteArgs>(
      args: SelectSubset<T, PaymentDeleteArgs<ExtArgs>>,
    ): Prisma__PaymentClient<
      $Result.GetResult<
        Prisma.$PaymentPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one Payment.
     * @param {PaymentUpdateArgs} args - Arguments to update one Payment.
     * @example
     * // Update one Payment
     * const payment = await prisma.payment.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends PaymentUpdateArgs>(
      args: SelectSubset<T, PaymentUpdateArgs<ExtArgs>>,
    ): Prisma__PaymentClient<
      $Result.GetResult<
        Prisma.$PaymentPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more Payments.
     * @param {PaymentDeleteManyArgs} args - Arguments to filter Payments to delete.
     * @example
     * // Delete a few Payments
     * const { count } = await prisma.payment.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends PaymentDeleteManyArgs>(
      args?: SelectSubset<T, PaymentDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Payments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Payments
     * const payment = await prisma.payment.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends PaymentUpdateManyArgs>(
      args: SelectSubset<T, PaymentUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Payments and returns the data updated in the database.
     * @param {PaymentUpdateManyAndReturnArgs} args - Arguments to update many Payments.
     * @example
     * // Update many Payments
     * const payment = await prisma.payment.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more Payments and only return the `id`
     * const paymentWithIdOnly = await prisma.payment.updateManyAndReturn({
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
    updateManyAndReturn<T extends PaymentUpdateManyAndReturnArgs>(
      args: SelectSubset<T, PaymentUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$PaymentPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one Payment.
     * @param {PaymentUpsertArgs} args - Arguments to update or create a Payment.
     * @example
     * // Update or create a Payment
     * const payment = await prisma.payment.upsert({
     *   create: {
     *     // ... data to create a Payment
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Payment we want to update
     *   }
     * })
     */
    upsert<T extends PaymentUpsertArgs>(
      args: SelectSubset<T, PaymentUpsertArgs<ExtArgs>>,
    ): Prisma__PaymentClient<
      $Result.GetResult<
        Prisma.$PaymentPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of Payments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentCountArgs} args - Arguments to filter Payments to count.
     * @example
     * // Count the number of Payments
     * const count = await prisma.payment.count({
     *   where: {
     *     // ... the filter for the Payments we want to count
     *   }
     * })
     **/
    count<T extends PaymentCountArgs>(
      args?: Subset<T, PaymentCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], PaymentCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a Payment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends PaymentAggregateArgs>(
      args: Subset<T, PaymentAggregateArgs>,
    ): Prisma.PrismaPromise<GetPaymentAggregateType<T>>;

    /**
     * Group by Payment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentGroupByArgs} args - Group by arguments.
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
      T extends PaymentGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PaymentGroupByArgs["orderBy"] }
        : { orderBy?: PaymentGroupByArgs["orderBy"] },
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
      args: SubsetIntersection<T, PaymentGroupByArgs, OrderByArg> & InputErrors,
    ): {} extends InputErrors
      ? GetPaymentGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the Payment model
     */
    readonly fields: PaymentFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Payment.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PaymentClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    invoice<T extends Payment$invoiceArgs<ExtArgs> = {}>(
      args?: Subset<T, Payment$invoiceArgs<ExtArgs>>,
    ): Prisma__InvoiceClient<
      $Result.GetResult<
        Prisma.$InvoicePayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;
    unmatchedMutation<T extends Payment$unmatchedMutationArgs<ExtArgs> = {}>(
      args?: Subset<T, Payment$unmatchedMutationArgs<ExtArgs>>,
    ): Prisma__UnmatchedMutationClient<
      $Result.GetResult<
        Prisma.$UnmatchedMutationPayload<ExtArgs>,
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
   * Fields of the Payment model
   */
  interface PaymentFieldRefs {
    readonly id: FieldRef<"Payment", "String">;
    readonly invoiceId: FieldRef<"Payment", "String">;
    readonly pelangganId: FieldRef<"Payment", "String">;
    readonly amount: FieldRef<"Payment", "BigInt">;
    readonly paymentDate: FieldRef<"Payment", "DateTime">;
    readonly paymentMethod: FieldRef<"Payment", "PaymentMethod">;
    readonly reference: FieldRef<"Payment", "String">;
    readonly notes: FieldRef<"Payment", "String">;
    readonly verifiedBy: FieldRef<"Payment", "String">;
    readonly verifiedAt: FieldRef<"Payment", "DateTime">;
    readonly createdAt: FieldRef<"Payment", "DateTime">;
    readonly updatedAt: FieldRef<"Payment", "DateTime">;
    readonly accountId: FieldRef<"Payment", "String">;
    readonly gatewayStatus: FieldRef<"Payment", "GatewayPaymentStatus">;
    readonly gatewayProvider: FieldRef<"Payment", "String">;
    readonly transactionId: FieldRef<"Payment", "String">;
    readonly paymentUrl: FieldRef<"Payment", "String">;
    readonly expiresAt: FieldRef<"Payment", "DateTime">;
    readonly unmatchedMutationId: FieldRef<"Payment", "String">;
    readonly receiptUrl: FieldRef<"Payment", "String">;
    readonly tenantId: FieldRef<"Payment", "String">;
  }

  // Custom InputTypes
  /**
   * Payment findUnique
   */
  export type PaymentFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null;
    /**
     * Filter, which Payment to fetch.
     */
    where: PaymentWhereUniqueInput;
  };

  /**
   * Payment findUniqueOrThrow
   */
  export type PaymentFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null;
    /**
     * Filter, which Payment to fetch.
     */
    where: PaymentWhereUniqueInput;
  };

  /**
   * Payment findFirst
   */
  export type PaymentFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null;
    /**
     * Filter, which Payment to fetch.
     */
    where?: PaymentWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Payments to fetch.
     */
    orderBy?:
      | PaymentOrderByWithRelationInput
      | PaymentOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Payments.
     */
    cursor?: PaymentWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Payments from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Payments.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Payments.
     */
    distinct?: PaymentScalarFieldEnum | PaymentScalarFieldEnum[];
  };

  /**
   * Payment findFirstOrThrow
   */
  export type PaymentFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null;
    /**
     * Filter, which Payment to fetch.
     */
    where?: PaymentWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Payments to fetch.
     */
    orderBy?:
      | PaymentOrderByWithRelationInput
      | PaymentOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Payments.
     */
    cursor?: PaymentWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Payments from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Payments.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Payments.
     */
    distinct?: PaymentScalarFieldEnum | PaymentScalarFieldEnum[];
  };

  /**
   * Payment findMany
   */
  export type PaymentFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null;
    /**
     * Filter, which Payments to fetch.
     */
    where?: PaymentWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Payments to fetch.
     */
    orderBy?:
      | PaymentOrderByWithRelationInput
      | PaymentOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing Payments.
     */
    cursor?: PaymentWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Payments from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Payments.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Payments.
     */
    distinct?: PaymentScalarFieldEnum | PaymentScalarFieldEnum[];
  };

  /**
   * Payment create
   */
  export type PaymentCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null;
    /**
     * The data needed to create a Payment.
     */
    data: XOR<PaymentCreateInput, PaymentUncheckedCreateInput>;
  };

  /**
   * Payment createMany
   */
  export type PaymentCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many Payments.
     */
    data: PaymentCreateManyInput | PaymentCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * Payment createManyAndReturn
   */
  export type PaymentCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null;
    /**
     * The data used to create many Payments.
     */
    data: PaymentCreateManyInput | PaymentCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * Payment update
   */
  export type PaymentUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null;
    /**
     * The data needed to update a Payment.
     */
    data: XOR<PaymentUpdateInput, PaymentUncheckedUpdateInput>;
    /**
     * Choose, which Payment to update.
     */
    where: PaymentWhereUniqueInput;
  };

  /**
   * Payment updateMany
   */
  export type PaymentUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update Payments.
     */
    data: XOR<PaymentUpdateManyMutationInput, PaymentUncheckedUpdateManyInput>;
    /**
     * Filter which Payments to update
     */
    where?: PaymentWhereInput;
    /**
     * Limit how many Payments to update.
     */
    limit?: number;
  };

  /**
   * Payment updateManyAndReturn
   */
  export type PaymentUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null;
    /**
     * The data used to update Payments.
     */
    data: XOR<PaymentUpdateManyMutationInput, PaymentUncheckedUpdateManyInput>;
    /**
     * Filter which Payments to update
     */
    where?: PaymentWhereInput;
    /**
     * Limit how many Payments to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * Payment upsert
   */
  export type PaymentUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null;
    /**
     * The filter to search for the Payment to update in case it exists.
     */
    where: PaymentWhereUniqueInput;
    /**
     * In case the Payment found by the `where` argument doesn't exist, create a new Payment with this data.
     */
    create: XOR<PaymentCreateInput, PaymentUncheckedCreateInput>;
    /**
     * In case the Payment was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PaymentUpdateInput, PaymentUncheckedUpdateInput>;
  };

  /**
   * Payment delete
   */
  export type PaymentDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null;
    /**
     * Filter which Payment to delete.
     */
    where: PaymentWhereUniqueInput;
  };

  /**
   * Payment deleteMany
   */
  export type PaymentDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Payments to delete
     */
    where?: PaymentWhereInput;
    /**
     * Limit how many Payments to delete.
     */
    limit?: number;
  };

  /**
   * Payment.invoice
   */
  export type Payment$invoiceArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null;
    where?: InvoiceWhereInput;
  };

  /**
   * Payment.unmatchedMutation
   */
  export type Payment$unmatchedMutationArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null;
    where?: UnmatchedMutationWhereInput;
  };

  /**
   * Payment without action
   */
  export type PaymentDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null;
  };

  /**
   * Model PaymentGatewayConfig
   */

  export type AggregatePaymentGatewayConfig = {
    _count: PaymentGatewayConfigCountAggregateOutputType | null;
    _avg: PaymentGatewayConfigAvgAggregateOutputType | null;
    _sum: PaymentGatewayConfigSumAggregateOutputType | null;
    _min: PaymentGatewayConfigMinAggregateOutputType | null;
    _max: PaymentGatewayConfigMaxAggregateOutputType | null;
  };

  export type PaymentGatewayConfigAvgAggregateOutputType = {
    priority: number | null;
  };

  export type PaymentGatewayConfigSumAggregateOutputType = {
    priority: number | null;
  };

  export type PaymentGatewayConfigMinAggregateOutputType = {
    id: string | null;
    provider: string | null;
    providerName: string | null;
    isEnabled: boolean | null;
    isProduction: boolean | null;
    priority: number | null;
    apiKey: string | null;
    apiSecret: string | null;
    clientKey: string | null;
    merchantId: string | null;
    webhookUrl: string | null;
    callbackUrl: string | null;
    lastTestedAt: Date | null;
    testStatus: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    createdBy: string | null;
    tenantId: string | null;
  };

  export type PaymentGatewayConfigMaxAggregateOutputType = {
    id: string | null;
    provider: string | null;
    providerName: string | null;
    isEnabled: boolean | null;
    isProduction: boolean | null;
    priority: number | null;
    apiKey: string | null;
    apiSecret: string | null;
    clientKey: string | null;
    merchantId: string | null;
    webhookUrl: string | null;
    callbackUrl: string | null;
    lastTestedAt: Date | null;
    testStatus: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    createdBy: string | null;
    tenantId: string | null;
  };

  export type PaymentGatewayConfigCountAggregateOutputType = {
    id: number;
    provider: number;
    providerName: number;
    isEnabled: number;
    isProduction: number;
    priority: number;
    apiKey: number;
    apiSecret: number;
    clientKey: number;
    merchantId: number;
    webhookUrl: number;
    callbackUrl: number;
    settings: number;
    lastTestedAt: number;
    testStatus: number;
    createdAt: number;
    updatedAt: number;
    createdBy: number;
    tenantId: number;
    _all: number;
  };

  export type PaymentGatewayConfigAvgAggregateInputType = {
    priority?: true;
  };

  export type PaymentGatewayConfigSumAggregateInputType = {
    priority?: true;
  };

  export type PaymentGatewayConfigMinAggregateInputType = {
    id?: true;
    provider?: true;
    providerName?: true;
    isEnabled?: true;
    isProduction?: true;
    priority?: true;
    apiKey?: true;
    apiSecret?: true;
    clientKey?: true;
    merchantId?: true;
    webhookUrl?: true;
    callbackUrl?: true;
    lastTestedAt?: true;
    testStatus?: true;
    createdAt?: true;
    updatedAt?: true;
    createdBy?: true;
    tenantId?: true;
  };

  export type PaymentGatewayConfigMaxAggregateInputType = {
    id?: true;
    provider?: true;
    providerName?: true;
    isEnabled?: true;
    isProduction?: true;
    priority?: true;
    apiKey?: true;
    apiSecret?: true;
    clientKey?: true;
    merchantId?: true;
    webhookUrl?: true;
    callbackUrl?: true;
    lastTestedAt?: true;
    testStatus?: true;
    createdAt?: true;
    updatedAt?: true;
    createdBy?: true;
    tenantId?: true;
  };

  export type PaymentGatewayConfigCountAggregateInputType = {
    id?: true;
    provider?: true;
    providerName?: true;
    isEnabled?: true;
    isProduction?: true;
    priority?: true;
    apiKey?: true;
    apiSecret?: true;
    clientKey?: true;
    merchantId?: true;
    webhookUrl?: true;
    callbackUrl?: true;
    settings?: true;
    lastTestedAt?: true;
    testStatus?: true;
    createdAt?: true;
    updatedAt?: true;
    createdBy?: true;
    tenantId?: true;
    _all?: true;
  };

  export type PaymentGatewayConfigAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which PaymentGatewayConfig to aggregate.
     */
    where?: PaymentGatewayConfigWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of PaymentGatewayConfigs to fetch.
     */
    orderBy?:
      | PaymentGatewayConfigOrderByWithRelationInput
      | PaymentGatewayConfigOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: PaymentGatewayConfigWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` PaymentGatewayConfigs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` PaymentGatewayConfigs.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned PaymentGatewayConfigs
     **/
    _count?: true | PaymentGatewayConfigCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: PaymentGatewayConfigAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: PaymentGatewayConfigSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: PaymentGatewayConfigMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: PaymentGatewayConfigMaxAggregateInputType;
  };

  export type GetPaymentGatewayConfigAggregateType<
    T extends PaymentGatewayConfigAggregateArgs,
  > = {
    [P in keyof T & keyof AggregatePaymentGatewayConfig]: P extends
      | "_count"
      | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePaymentGatewayConfig[P]>
      : GetScalarType<T[P], AggregatePaymentGatewayConfig[P]>;
  };

  export type PaymentGatewayConfigGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: PaymentGatewayConfigWhereInput;
    orderBy?:
      | PaymentGatewayConfigOrderByWithAggregationInput
      | PaymentGatewayConfigOrderByWithAggregationInput[];
    by:
      | PaymentGatewayConfigScalarFieldEnum[]
      | PaymentGatewayConfigScalarFieldEnum;
    having?: PaymentGatewayConfigScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: PaymentGatewayConfigCountAggregateInputType | true;
    _avg?: PaymentGatewayConfigAvgAggregateInputType;
    _sum?: PaymentGatewayConfigSumAggregateInputType;
    _min?: PaymentGatewayConfigMinAggregateInputType;
    _max?: PaymentGatewayConfigMaxAggregateInputType;
  };

  export type PaymentGatewayConfigGroupByOutputType = {
    id: string;
    provider: string;
    providerName: string;
    isEnabled: boolean;
    isProduction: boolean;
    priority: number;
    apiKey: string | null;
    apiSecret: string | null;
    clientKey: string | null;
    merchantId: string | null;
    webhookUrl: string | null;
    callbackUrl: string | null;
    settings: JsonValue | null;
    lastTestedAt: Date | null;
    testStatus: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    tenantId: string | null;
    _count: PaymentGatewayConfigCountAggregateOutputType | null;
    _avg: PaymentGatewayConfigAvgAggregateOutputType | null;
    _sum: PaymentGatewayConfigSumAggregateOutputType | null;
    _min: PaymentGatewayConfigMinAggregateOutputType | null;
    _max: PaymentGatewayConfigMaxAggregateOutputType | null;
  };

  type GetPaymentGatewayConfigGroupByPayload<
    T extends PaymentGatewayConfigGroupByArgs,
  > = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PaymentGatewayConfigGroupByOutputType, T["by"]> & {
        [P in keyof T &
          keyof PaymentGatewayConfigGroupByOutputType]: P extends "_count"
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], PaymentGatewayConfigGroupByOutputType[P]>
          : GetScalarType<T[P], PaymentGatewayConfigGroupByOutputType[P]>;
      }
    >
  >;

  export type PaymentGatewayConfigSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      provider?: boolean;
      providerName?: boolean;
      isEnabled?: boolean;
      isProduction?: boolean;
      priority?: boolean;
      apiKey?: boolean;
      apiSecret?: boolean;
      clientKey?: boolean;
      merchantId?: boolean;
      webhookUrl?: boolean;
      callbackUrl?: boolean;
      settings?: boolean;
      lastTestedAt?: boolean;
      testStatus?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      createdBy?: boolean;
      tenantId?: boolean;
    },
    ExtArgs["result"]["paymentGatewayConfig"]
  >;

  export type PaymentGatewayConfigSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      provider?: boolean;
      providerName?: boolean;
      isEnabled?: boolean;
      isProduction?: boolean;
      priority?: boolean;
      apiKey?: boolean;
      apiSecret?: boolean;
      clientKey?: boolean;
      merchantId?: boolean;
      webhookUrl?: boolean;
      callbackUrl?: boolean;
      settings?: boolean;
      lastTestedAt?: boolean;
      testStatus?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      createdBy?: boolean;
      tenantId?: boolean;
    },
    ExtArgs["result"]["paymentGatewayConfig"]
  >;

  export type PaymentGatewayConfigSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      provider?: boolean;
      providerName?: boolean;
      isEnabled?: boolean;
      isProduction?: boolean;
      priority?: boolean;
      apiKey?: boolean;
      apiSecret?: boolean;
      clientKey?: boolean;
      merchantId?: boolean;
      webhookUrl?: boolean;
      callbackUrl?: boolean;
      settings?: boolean;
      lastTestedAt?: boolean;
      testStatus?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      createdBy?: boolean;
      tenantId?: boolean;
    },
    ExtArgs["result"]["paymentGatewayConfig"]
  >;

  export type PaymentGatewayConfigSelectScalar = {
    id?: boolean;
    provider?: boolean;
    providerName?: boolean;
    isEnabled?: boolean;
    isProduction?: boolean;
    priority?: boolean;
    apiKey?: boolean;
    apiSecret?: boolean;
    clientKey?: boolean;
    merchantId?: boolean;
    webhookUrl?: boolean;
    callbackUrl?: boolean;
    settings?: boolean;
    lastTestedAt?: boolean;
    testStatus?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    createdBy?: boolean;
    tenantId?: boolean;
  };

  export type PaymentGatewayConfigOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "provider"
    | "providerName"
    | "isEnabled"
    | "isProduction"
    | "priority"
    | "apiKey"
    | "apiSecret"
    | "clientKey"
    | "merchantId"
    | "webhookUrl"
    | "callbackUrl"
    | "settings"
    | "lastTestedAt"
    | "testStatus"
    | "createdAt"
    | "updatedAt"
    | "createdBy"
    | "tenantId",
    ExtArgs["result"]["paymentGatewayConfig"]
  >;

  export type $PaymentGatewayConfigPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "PaymentGatewayConfig";
    objects: {};
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        provider: string;
        providerName: string;
        isEnabled: boolean;
        isProduction: boolean;
        priority: number;
        apiKey: string | null;
        apiSecret: string | null;
        clientKey: string | null;
        merchantId: string | null;
        webhookUrl: string | null;
        callbackUrl: string | null;
        settings: Prisma.JsonValue | null;
        lastTestedAt: Date | null;
        testStatus: string | null;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
        tenantId: string | null;
      },
      ExtArgs["result"]["paymentGatewayConfig"]
    >;
    composites: {};
  };

  type PaymentGatewayConfigGetPayload<
    S extends boolean | null | undefined | PaymentGatewayConfigDefaultArgs,
  > = $Result.GetResult<Prisma.$PaymentGatewayConfigPayload, S>;

  type PaymentGatewayConfigCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    PaymentGatewayConfigFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: PaymentGatewayConfigCountAggregateInputType | true;
  };

  export interface PaymentGatewayConfigDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["PaymentGatewayConfig"];
      meta: { name: "PaymentGatewayConfig" };
    };
    /**
     * Find zero or one PaymentGatewayConfig that matches the filter.
     * @param {PaymentGatewayConfigFindUniqueArgs} args - Arguments to find a PaymentGatewayConfig
     * @example
     * // Get one PaymentGatewayConfig
     * const paymentGatewayConfig = await prisma.paymentGatewayConfig.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PaymentGatewayConfigFindUniqueArgs>(
      args: SelectSubset<T, PaymentGatewayConfigFindUniqueArgs<ExtArgs>>,
    ): Prisma__PaymentGatewayConfigClient<
      $Result.GetResult<
        Prisma.$PaymentGatewayConfigPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one PaymentGatewayConfig that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PaymentGatewayConfigFindUniqueOrThrowArgs} args - Arguments to find a PaymentGatewayConfig
     * @example
     * // Get one PaymentGatewayConfig
     * const paymentGatewayConfig = await prisma.paymentGatewayConfig.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PaymentGatewayConfigFindUniqueOrThrowArgs>(
      args: SelectSubset<T, PaymentGatewayConfigFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__PaymentGatewayConfigClient<
      $Result.GetResult<
        Prisma.$PaymentGatewayConfigPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first PaymentGatewayConfig that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentGatewayConfigFindFirstArgs} args - Arguments to find a PaymentGatewayConfig
     * @example
     * // Get one PaymentGatewayConfig
     * const paymentGatewayConfig = await prisma.paymentGatewayConfig.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PaymentGatewayConfigFindFirstArgs>(
      args?: SelectSubset<T, PaymentGatewayConfigFindFirstArgs<ExtArgs>>,
    ): Prisma__PaymentGatewayConfigClient<
      $Result.GetResult<
        Prisma.$PaymentGatewayConfigPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first PaymentGatewayConfig that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentGatewayConfigFindFirstOrThrowArgs} args - Arguments to find a PaymentGatewayConfig
     * @example
     * // Get one PaymentGatewayConfig
     * const paymentGatewayConfig = await prisma.paymentGatewayConfig.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PaymentGatewayConfigFindFirstOrThrowArgs>(
      args?: SelectSubset<T, PaymentGatewayConfigFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__PaymentGatewayConfigClient<
      $Result.GetResult<
        Prisma.$PaymentGatewayConfigPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more PaymentGatewayConfigs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentGatewayConfigFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PaymentGatewayConfigs
     * const paymentGatewayConfigs = await prisma.paymentGatewayConfig.findMany()
     *
     * // Get first 10 PaymentGatewayConfigs
     * const paymentGatewayConfigs = await prisma.paymentGatewayConfig.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const paymentGatewayConfigWithIdOnly = await prisma.paymentGatewayConfig.findMany({ select: { id: true } })
     *
     */
    findMany<T extends PaymentGatewayConfigFindManyArgs>(
      args?: SelectSubset<T, PaymentGatewayConfigFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$PaymentGatewayConfigPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a PaymentGatewayConfig.
     * @param {PaymentGatewayConfigCreateArgs} args - Arguments to create a PaymentGatewayConfig.
     * @example
     * // Create one PaymentGatewayConfig
     * const PaymentGatewayConfig = await prisma.paymentGatewayConfig.create({
     *   data: {
     *     // ... data to create a PaymentGatewayConfig
     *   }
     * })
     *
     */
    create<T extends PaymentGatewayConfigCreateArgs>(
      args: SelectSubset<T, PaymentGatewayConfigCreateArgs<ExtArgs>>,
    ): Prisma__PaymentGatewayConfigClient<
      $Result.GetResult<
        Prisma.$PaymentGatewayConfigPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many PaymentGatewayConfigs.
     * @param {PaymentGatewayConfigCreateManyArgs} args - Arguments to create many PaymentGatewayConfigs.
     * @example
     * // Create many PaymentGatewayConfigs
     * const paymentGatewayConfig = await prisma.paymentGatewayConfig.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends PaymentGatewayConfigCreateManyArgs>(
      args?: SelectSubset<T, PaymentGatewayConfigCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many PaymentGatewayConfigs and returns the data saved in the database.
     * @param {PaymentGatewayConfigCreateManyAndReturnArgs} args - Arguments to create many PaymentGatewayConfigs.
     * @example
     * // Create many PaymentGatewayConfigs
     * const paymentGatewayConfig = await prisma.paymentGatewayConfig.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many PaymentGatewayConfigs and only return the `id`
     * const paymentGatewayConfigWithIdOnly = await prisma.paymentGatewayConfig.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends PaymentGatewayConfigCreateManyAndReturnArgs>(
      args?: SelectSubset<
        T,
        PaymentGatewayConfigCreateManyAndReturnArgs<ExtArgs>
      >,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$PaymentGatewayConfigPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a PaymentGatewayConfig.
     * @param {PaymentGatewayConfigDeleteArgs} args - Arguments to delete one PaymentGatewayConfig.
     * @example
     * // Delete one PaymentGatewayConfig
     * const PaymentGatewayConfig = await prisma.paymentGatewayConfig.delete({
     *   where: {
     *     // ... filter to delete one PaymentGatewayConfig
     *   }
     * })
     *
     */
    delete<T extends PaymentGatewayConfigDeleteArgs>(
      args: SelectSubset<T, PaymentGatewayConfigDeleteArgs<ExtArgs>>,
    ): Prisma__PaymentGatewayConfigClient<
      $Result.GetResult<
        Prisma.$PaymentGatewayConfigPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one PaymentGatewayConfig.
     * @param {PaymentGatewayConfigUpdateArgs} args - Arguments to update one PaymentGatewayConfig.
     * @example
     * // Update one PaymentGatewayConfig
     * const paymentGatewayConfig = await prisma.paymentGatewayConfig.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends PaymentGatewayConfigUpdateArgs>(
      args: SelectSubset<T, PaymentGatewayConfigUpdateArgs<ExtArgs>>,
    ): Prisma__PaymentGatewayConfigClient<
      $Result.GetResult<
        Prisma.$PaymentGatewayConfigPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more PaymentGatewayConfigs.
     * @param {PaymentGatewayConfigDeleteManyArgs} args - Arguments to filter PaymentGatewayConfigs to delete.
     * @example
     * // Delete a few PaymentGatewayConfigs
     * const { count } = await prisma.paymentGatewayConfig.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends PaymentGatewayConfigDeleteManyArgs>(
      args?: SelectSubset<T, PaymentGatewayConfigDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more PaymentGatewayConfigs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentGatewayConfigUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PaymentGatewayConfigs
     * const paymentGatewayConfig = await prisma.paymentGatewayConfig.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends PaymentGatewayConfigUpdateManyArgs>(
      args: SelectSubset<T, PaymentGatewayConfigUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more PaymentGatewayConfigs and returns the data updated in the database.
     * @param {PaymentGatewayConfigUpdateManyAndReturnArgs} args - Arguments to update many PaymentGatewayConfigs.
     * @example
     * // Update many PaymentGatewayConfigs
     * const paymentGatewayConfig = await prisma.paymentGatewayConfig.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more PaymentGatewayConfigs and only return the `id`
     * const paymentGatewayConfigWithIdOnly = await prisma.paymentGatewayConfig.updateManyAndReturn({
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
    updateManyAndReturn<T extends PaymentGatewayConfigUpdateManyAndReturnArgs>(
      args: SelectSubset<
        T,
        PaymentGatewayConfigUpdateManyAndReturnArgs<ExtArgs>
      >,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$PaymentGatewayConfigPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one PaymentGatewayConfig.
     * @param {PaymentGatewayConfigUpsertArgs} args - Arguments to update or create a PaymentGatewayConfig.
     * @example
     * // Update or create a PaymentGatewayConfig
     * const paymentGatewayConfig = await prisma.paymentGatewayConfig.upsert({
     *   create: {
     *     // ... data to create a PaymentGatewayConfig
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PaymentGatewayConfig we want to update
     *   }
     * })
     */
    upsert<T extends PaymentGatewayConfigUpsertArgs>(
      args: SelectSubset<T, PaymentGatewayConfigUpsertArgs<ExtArgs>>,
    ): Prisma__PaymentGatewayConfigClient<
      $Result.GetResult<
        Prisma.$PaymentGatewayConfigPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of PaymentGatewayConfigs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentGatewayConfigCountArgs} args - Arguments to filter PaymentGatewayConfigs to count.
     * @example
     * // Count the number of PaymentGatewayConfigs
     * const count = await prisma.paymentGatewayConfig.count({
     *   where: {
     *     // ... the filter for the PaymentGatewayConfigs we want to count
     *   }
     * })
     **/
    count<T extends PaymentGatewayConfigCountArgs>(
      args?: Subset<T, PaymentGatewayConfigCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<
              T["select"],
              PaymentGatewayConfigCountAggregateOutputType
            >
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a PaymentGatewayConfig.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentGatewayConfigAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends PaymentGatewayConfigAggregateArgs>(
      args: Subset<T, PaymentGatewayConfigAggregateArgs>,
    ): Prisma.PrismaPromise<GetPaymentGatewayConfigAggregateType<T>>;

    /**
     * Group by PaymentGatewayConfig.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PaymentGatewayConfigGroupByArgs} args - Group by arguments.
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
      T extends PaymentGatewayConfigGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PaymentGatewayConfigGroupByArgs["orderBy"] }
        : { orderBy?: PaymentGatewayConfigGroupByArgs["orderBy"] },
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
      args: SubsetIntersection<T, PaymentGatewayConfigGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetPaymentGatewayConfigGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the PaymentGatewayConfig model
     */
    readonly fields: PaymentGatewayConfigFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PaymentGatewayConfig.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PaymentGatewayConfigClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
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
   * Fields of the PaymentGatewayConfig model
   */
  interface PaymentGatewayConfigFieldRefs {
    readonly id: FieldRef<"PaymentGatewayConfig", "String">;
    readonly provider: FieldRef<"PaymentGatewayConfig", "String">;
    readonly providerName: FieldRef<"PaymentGatewayConfig", "String">;
    readonly isEnabled: FieldRef<"PaymentGatewayConfig", "Boolean">;
    readonly isProduction: FieldRef<"PaymentGatewayConfig", "Boolean">;
    readonly priority: FieldRef<"PaymentGatewayConfig", "Int">;
    readonly apiKey: FieldRef<"PaymentGatewayConfig", "String">;
    readonly apiSecret: FieldRef<"PaymentGatewayConfig", "String">;
    readonly clientKey: FieldRef<"PaymentGatewayConfig", "String">;
    readonly merchantId: FieldRef<"PaymentGatewayConfig", "String">;
    readonly webhookUrl: FieldRef<"PaymentGatewayConfig", "String">;
    readonly callbackUrl: FieldRef<"PaymentGatewayConfig", "String">;
    readonly settings: FieldRef<"PaymentGatewayConfig", "Json">;
    readonly lastTestedAt: FieldRef<"PaymentGatewayConfig", "DateTime">;
    readonly testStatus: FieldRef<"PaymentGatewayConfig", "String">;
    readonly createdAt: FieldRef<"PaymentGatewayConfig", "DateTime">;
    readonly updatedAt: FieldRef<"PaymentGatewayConfig", "DateTime">;
    readonly createdBy: FieldRef<"PaymentGatewayConfig", "String">;
    readonly tenantId: FieldRef<"PaymentGatewayConfig", "String">;
  }

  // Custom InputTypes
  /**
   * PaymentGatewayConfig findUnique
   */
  export type PaymentGatewayConfigFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null;
    /**
     * Filter, which PaymentGatewayConfig to fetch.
     */
    where: PaymentGatewayConfigWhereUniqueInput;
  };

  /**
   * PaymentGatewayConfig findUniqueOrThrow
   */
  export type PaymentGatewayConfigFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null;
    /**
     * Filter, which PaymentGatewayConfig to fetch.
     */
    where: PaymentGatewayConfigWhereUniqueInput;
  };

  /**
   * PaymentGatewayConfig findFirst
   */
  export type PaymentGatewayConfigFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null;
    /**
     * Filter, which PaymentGatewayConfig to fetch.
     */
    where?: PaymentGatewayConfigWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of PaymentGatewayConfigs to fetch.
     */
    orderBy?:
      | PaymentGatewayConfigOrderByWithRelationInput
      | PaymentGatewayConfigOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for PaymentGatewayConfigs.
     */
    cursor?: PaymentGatewayConfigWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` PaymentGatewayConfigs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` PaymentGatewayConfigs.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of PaymentGatewayConfigs.
     */
    distinct?:
      | PaymentGatewayConfigScalarFieldEnum
      | PaymentGatewayConfigScalarFieldEnum[];
  };

  /**
   * PaymentGatewayConfig findFirstOrThrow
   */
  export type PaymentGatewayConfigFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null;
    /**
     * Filter, which PaymentGatewayConfig to fetch.
     */
    where?: PaymentGatewayConfigWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of PaymentGatewayConfigs to fetch.
     */
    orderBy?:
      | PaymentGatewayConfigOrderByWithRelationInput
      | PaymentGatewayConfigOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for PaymentGatewayConfigs.
     */
    cursor?: PaymentGatewayConfigWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` PaymentGatewayConfigs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` PaymentGatewayConfigs.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of PaymentGatewayConfigs.
     */
    distinct?:
      | PaymentGatewayConfigScalarFieldEnum
      | PaymentGatewayConfigScalarFieldEnum[];
  };

  /**
   * PaymentGatewayConfig findMany
   */
  export type PaymentGatewayConfigFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null;
    /**
     * Filter, which PaymentGatewayConfigs to fetch.
     */
    where?: PaymentGatewayConfigWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of PaymentGatewayConfigs to fetch.
     */
    orderBy?:
      | PaymentGatewayConfigOrderByWithRelationInput
      | PaymentGatewayConfigOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing PaymentGatewayConfigs.
     */
    cursor?: PaymentGatewayConfigWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` PaymentGatewayConfigs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` PaymentGatewayConfigs.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of PaymentGatewayConfigs.
     */
    distinct?:
      | PaymentGatewayConfigScalarFieldEnum
      | PaymentGatewayConfigScalarFieldEnum[];
  };

  /**
   * PaymentGatewayConfig create
   */
  export type PaymentGatewayConfigCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null;
    /**
     * The data needed to create a PaymentGatewayConfig.
     */
    data: XOR<
      PaymentGatewayConfigCreateInput,
      PaymentGatewayConfigUncheckedCreateInput
    >;
  };

  /**
   * PaymentGatewayConfig createMany
   */
  export type PaymentGatewayConfigCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many PaymentGatewayConfigs.
     */
    data:
      | PaymentGatewayConfigCreateManyInput
      | PaymentGatewayConfigCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * PaymentGatewayConfig createManyAndReturn
   */
  export type PaymentGatewayConfigCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null;
    /**
     * The data used to create many PaymentGatewayConfigs.
     */
    data:
      | PaymentGatewayConfigCreateManyInput
      | PaymentGatewayConfigCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * PaymentGatewayConfig update
   */
  export type PaymentGatewayConfigUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null;
    /**
     * The data needed to update a PaymentGatewayConfig.
     */
    data: XOR<
      PaymentGatewayConfigUpdateInput,
      PaymentGatewayConfigUncheckedUpdateInput
    >;
    /**
     * Choose, which PaymentGatewayConfig to update.
     */
    where: PaymentGatewayConfigWhereUniqueInput;
  };

  /**
   * PaymentGatewayConfig updateMany
   */
  export type PaymentGatewayConfigUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update PaymentGatewayConfigs.
     */
    data: XOR<
      PaymentGatewayConfigUpdateManyMutationInput,
      PaymentGatewayConfigUncheckedUpdateManyInput
    >;
    /**
     * Filter which PaymentGatewayConfigs to update
     */
    where?: PaymentGatewayConfigWhereInput;
    /**
     * Limit how many PaymentGatewayConfigs to update.
     */
    limit?: number;
  };

  /**
   * PaymentGatewayConfig updateManyAndReturn
   */
  export type PaymentGatewayConfigUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null;
    /**
     * The data used to update PaymentGatewayConfigs.
     */
    data: XOR<
      PaymentGatewayConfigUpdateManyMutationInput,
      PaymentGatewayConfigUncheckedUpdateManyInput
    >;
    /**
     * Filter which PaymentGatewayConfigs to update
     */
    where?: PaymentGatewayConfigWhereInput;
    /**
     * Limit how many PaymentGatewayConfigs to update.
     */
    limit?: number;
  };

  /**
   * PaymentGatewayConfig upsert
   */
  export type PaymentGatewayConfigUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null;
    /**
     * The filter to search for the PaymentGatewayConfig to update in case it exists.
     */
    where: PaymentGatewayConfigWhereUniqueInput;
    /**
     * In case the PaymentGatewayConfig found by the `where` argument doesn't exist, create a new PaymentGatewayConfig with this data.
     */
    create: XOR<
      PaymentGatewayConfigCreateInput,
      PaymentGatewayConfigUncheckedCreateInput
    >;
    /**
     * In case the PaymentGatewayConfig was found with the provided `where` argument, update it with this data.
     */
    update: XOR<
      PaymentGatewayConfigUpdateInput,
      PaymentGatewayConfigUncheckedUpdateInput
    >;
  };

  /**
   * PaymentGatewayConfig delete
   */
  export type PaymentGatewayConfigDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null;
    /**
     * Filter which PaymentGatewayConfig to delete.
     */
    where: PaymentGatewayConfigWhereUniqueInput;
  };

  /**
   * PaymentGatewayConfig deleteMany
   */
  export type PaymentGatewayConfigDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which PaymentGatewayConfigs to delete
     */
    where?: PaymentGatewayConfigWhereInput;
    /**
     * Limit how many PaymentGatewayConfigs to delete.
     */
    limit?: number;
  };

  /**
   * PaymentGatewayConfig without action
   */
  export type PaymentGatewayConfigDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null;
  };

  /**
   * Model UnmatchedMutation
   */

  export type AggregateUnmatchedMutation = {
    _count: UnmatchedMutationCountAggregateOutputType | null;
    _avg: UnmatchedMutationAvgAggregateOutputType | null;
    _sum: UnmatchedMutationSumAggregateOutputType | null;
    _min: UnmatchedMutationMinAggregateOutputType | null;
    _max: UnmatchedMutationMaxAggregateOutputType | null;
  };

  export type UnmatchedMutationAvgAggregateOutputType = {
    amount: Decimal | null;
  };

  export type UnmatchedMutationSumAggregateOutputType = {
    amount: Decimal | null;
  };

  export type UnmatchedMutationMinAggregateOutputType = {
    id: string | null;
    provider: string | null;
    transactionId: string | null;
    amount: Decimal | null;
    description: string | null;
    type: string | null;
    date: Date | null;
    bankId: string | null;
    status: $Enums.UnmatchedStatus | null;
    resolvedAt: Date | null;
    resolvedById: string | null;
    matchedInvoiceId: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    tenantId: string | null;
  };

  export type UnmatchedMutationMaxAggregateOutputType = {
    id: string | null;
    provider: string | null;
    transactionId: string | null;
    amount: Decimal | null;
    description: string | null;
    type: string | null;
    date: Date | null;
    bankId: string | null;
    status: $Enums.UnmatchedStatus | null;
    resolvedAt: Date | null;
    resolvedById: string | null;
    matchedInvoiceId: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    tenantId: string | null;
  };

  export type UnmatchedMutationCountAggregateOutputType = {
    id: number;
    provider: number;
    transactionId: number;
    amount: number;
    description: number;
    type: number;
    date: number;
    bankId: number;
    rawPayload: number;
    status: number;
    resolvedAt: number;
    resolvedById: number;
    matchedInvoiceId: number;
    createdAt: number;
    updatedAt: number;
    tenantId: number;
    _all: number;
  };

  export type UnmatchedMutationAvgAggregateInputType = {
    amount?: true;
  };

  export type UnmatchedMutationSumAggregateInputType = {
    amount?: true;
  };

  export type UnmatchedMutationMinAggregateInputType = {
    id?: true;
    provider?: true;
    transactionId?: true;
    amount?: true;
    description?: true;
    type?: true;
    date?: true;
    bankId?: true;
    status?: true;
    resolvedAt?: true;
    resolvedById?: true;
    matchedInvoiceId?: true;
    createdAt?: true;
    updatedAt?: true;
    tenantId?: true;
  };

  export type UnmatchedMutationMaxAggregateInputType = {
    id?: true;
    provider?: true;
    transactionId?: true;
    amount?: true;
    description?: true;
    type?: true;
    date?: true;
    bankId?: true;
    status?: true;
    resolvedAt?: true;
    resolvedById?: true;
    matchedInvoiceId?: true;
    createdAt?: true;
    updatedAt?: true;
    tenantId?: true;
  };

  export type UnmatchedMutationCountAggregateInputType = {
    id?: true;
    provider?: true;
    transactionId?: true;
    amount?: true;
    description?: true;
    type?: true;
    date?: true;
    bankId?: true;
    rawPayload?: true;
    status?: true;
    resolvedAt?: true;
    resolvedById?: true;
    matchedInvoiceId?: true;
    createdAt?: true;
    updatedAt?: true;
    tenantId?: true;
    _all?: true;
  };

  export type UnmatchedMutationAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which UnmatchedMutation to aggregate.
     */
    where?: UnmatchedMutationWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of UnmatchedMutations to fetch.
     */
    orderBy?:
      | UnmatchedMutationOrderByWithRelationInput
      | UnmatchedMutationOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: UnmatchedMutationWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` UnmatchedMutations from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` UnmatchedMutations.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned UnmatchedMutations
     **/
    _count?: true | UnmatchedMutationCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: UnmatchedMutationAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: UnmatchedMutationSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: UnmatchedMutationMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: UnmatchedMutationMaxAggregateInputType;
  };

  export type GetUnmatchedMutationAggregateType<
    T extends UnmatchedMutationAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateUnmatchedMutation]: P extends
      | "_count"
      | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUnmatchedMutation[P]>
      : GetScalarType<T[P], AggregateUnmatchedMutation[P]>;
  };

  export type UnmatchedMutationGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: UnmatchedMutationWhereInput;
    orderBy?:
      | UnmatchedMutationOrderByWithAggregationInput
      | UnmatchedMutationOrderByWithAggregationInput[];
    by: UnmatchedMutationScalarFieldEnum[] | UnmatchedMutationScalarFieldEnum;
    having?: UnmatchedMutationScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: UnmatchedMutationCountAggregateInputType | true;
    _avg?: UnmatchedMutationAvgAggregateInputType;
    _sum?: UnmatchedMutationSumAggregateInputType;
    _min?: UnmatchedMutationMinAggregateInputType;
    _max?: UnmatchedMutationMaxAggregateInputType;
  };

  export type UnmatchedMutationGroupByOutputType = {
    id: string;
    provider: string;
    transactionId: string | null;
    amount: Decimal;
    description: string | null;
    type: string | null;
    date: Date;
    bankId: string | null;
    rawPayload: JsonValue | null;
    status: $Enums.UnmatchedStatus;
    resolvedAt: Date | null;
    resolvedById: string | null;
    matchedInvoiceId: string | null;
    createdAt: Date;
    updatedAt: Date;
    tenantId: string | null;
    _count: UnmatchedMutationCountAggregateOutputType | null;
    _avg: UnmatchedMutationAvgAggregateOutputType | null;
    _sum: UnmatchedMutationSumAggregateOutputType | null;
    _min: UnmatchedMutationMinAggregateOutputType | null;
    _max: UnmatchedMutationMaxAggregateOutputType | null;
  };

  type GetUnmatchedMutationGroupByPayload<
    T extends UnmatchedMutationGroupByArgs,
  > = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UnmatchedMutationGroupByOutputType, T["by"]> & {
        [P in keyof T &
          keyof UnmatchedMutationGroupByOutputType]: P extends "_count"
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], UnmatchedMutationGroupByOutputType[P]>
          : GetScalarType<T[P], UnmatchedMutationGroupByOutputType[P]>;
      }
    >
  >;

  export type UnmatchedMutationSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      provider?: boolean;
      transactionId?: boolean;
      amount?: boolean;
      description?: boolean;
      type?: boolean;
      date?: boolean;
      bankId?: boolean;
      rawPayload?: boolean;
      status?: boolean;
      resolvedAt?: boolean;
      resolvedById?: boolean;
      matchedInvoiceId?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      tenantId?: boolean;
      payment?: boolean | UnmatchedMutation$paymentArgs<ExtArgs>;
    },
    ExtArgs["result"]["unmatchedMutation"]
  >;

  export type UnmatchedMutationSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      provider?: boolean;
      transactionId?: boolean;
      amount?: boolean;
      description?: boolean;
      type?: boolean;
      date?: boolean;
      bankId?: boolean;
      rawPayload?: boolean;
      status?: boolean;
      resolvedAt?: boolean;
      resolvedById?: boolean;
      matchedInvoiceId?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      tenantId?: boolean;
    },
    ExtArgs["result"]["unmatchedMutation"]
  >;

  export type UnmatchedMutationSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      provider?: boolean;
      transactionId?: boolean;
      amount?: boolean;
      description?: boolean;
      type?: boolean;
      date?: boolean;
      bankId?: boolean;
      rawPayload?: boolean;
      status?: boolean;
      resolvedAt?: boolean;
      resolvedById?: boolean;
      matchedInvoiceId?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      tenantId?: boolean;
    },
    ExtArgs["result"]["unmatchedMutation"]
  >;

  export type UnmatchedMutationSelectScalar = {
    id?: boolean;
    provider?: boolean;
    transactionId?: boolean;
    amount?: boolean;
    description?: boolean;
    type?: boolean;
    date?: boolean;
    bankId?: boolean;
    rawPayload?: boolean;
    status?: boolean;
    resolvedAt?: boolean;
    resolvedById?: boolean;
    matchedInvoiceId?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    tenantId?: boolean;
  };

  export type UnmatchedMutationOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "provider"
    | "transactionId"
    | "amount"
    | "description"
    | "type"
    | "date"
    | "bankId"
    | "rawPayload"
    | "status"
    | "resolvedAt"
    | "resolvedById"
    | "matchedInvoiceId"
    | "createdAt"
    | "updatedAt"
    | "tenantId",
    ExtArgs["result"]["unmatchedMutation"]
  >;
  export type UnmatchedMutationInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    payment?: boolean | UnmatchedMutation$paymentArgs<ExtArgs>;
  };
  export type UnmatchedMutationIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {};
  export type UnmatchedMutationIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {};

  export type $UnmatchedMutationPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "UnmatchedMutation";
    objects: {
      payment: Prisma.$PaymentPayload<ExtArgs> | null;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        provider: string;
        transactionId: string | null;
        amount: Prisma.Decimal;
        description: string | null;
        type: string | null;
        date: Date;
        bankId: string | null;
        rawPayload: Prisma.JsonValue | null;
        status: $Enums.UnmatchedStatus;
        resolvedAt: Date | null;
        resolvedById: string | null;
        matchedInvoiceId: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
      },
      ExtArgs["result"]["unmatchedMutation"]
    >;
    composites: {};
  };

  type UnmatchedMutationGetPayload<
    S extends boolean | null | undefined | UnmatchedMutationDefaultArgs,
  > = $Result.GetResult<Prisma.$UnmatchedMutationPayload, S>;

  type UnmatchedMutationCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    UnmatchedMutationFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: UnmatchedMutationCountAggregateInputType | true;
  };

  export interface UnmatchedMutationDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["UnmatchedMutation"];
      meta: { name: "UnmatchedMutation" };
    };
    /**
     * Find zero or one UnmatchedMutation that matches the filter.
     * @param {UnmatchedMutationFindUniqueArgs} args - Arguments to find a UnmatchedMutation
     * @example
     * // Get one UnmatchedMutation
     * const unmatchedMutation = await prisma.unmatchedMutation.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UnmatchedMutationFindUniqueArgs>(
      args: SelectSubset<T, UnmatchedMutationFindUniqueArgs<ExtArgs>>,
    ): Prisma__UnmatchedMutationClient<
      $Result.GetResult<
        Prisma.$UnmatchedMutationPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one UnmatchedMutation that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UnmatchedMutationFindUniqueOrThrowArgs} args - Arguments to find a UnmatchedMutation
     * @example
     * // Get one UnmatchedMutation
     * const unmatchedMutation = await prisma.unmatchedMutation.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UnmatchedMutationFindUniqueOrThrowArgs>(
      args: SelectSubset<T, UnmatchedMutationFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__UnmatchedMutationClient<
      $Result.GetResult<
        Prisma.$UnmatchedMutationPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first UnmatchedMutation that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UnmatchedMutationFindFirstArgs} args - Arguments to find a UnmatchedMutation
     * @example
     * // Get one UnmatchedMutation
     * const unmatchedMutation = await prisma.unmatchedMutation.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UnmatchedMutationFindFirstArgs>(
      args?: SelectSubset<T, UnmatchedMutationFindFirstArgs<ExtArgs>>,
    ): Prisma__UnmatchedMutationClient<
      $Result.GetResult<
        Prisma.$UnmatchedMutationPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first UnmatchedMutation that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UnmatchedMutationFindFirstOrThrowArgs} args - Arguments to find a UnmatchedMutation
     * @example
     * // Get one UnmatchedMutation
     * const unmatchedMutation = await prisma.unmatchedMutation.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UnmatchedMutationFindFirstOrThrowArgs>(
      args?: SelectSubset<T, UnmatchedMutationFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__UnmatchedMutationClient<
      $Result.GetResult<
        Prisma.$UnmatchedMutationPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more UnmatchedMutations that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UnmatchedMutationFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all UnmatchedMutations
     * const unmatchedMutations = await prisma.unmatchedMutation.findMany()
     *
     * // Get first 10 UnmatchedMutations
     * const unmatchedMutations = await prisma.unmatchedMutation.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const unmatchedMutationWithIdOnly = await prisma.unmatchedMutation.findMany({ select: { id: true } })
     *
     */
    findMany<T extends UnmatchedMutationFindManyArgs>(
      args?: SelectSubset<T, UnmatchedMutationFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$UnmatchedMutationPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a UnmatchedMutation.
     * @param {UnmatchedMutationCreateArgs} args - Arguments to create a UnmatchedMutation.
     * @example
     * // Create one UnmatchedMutation
     * const UnmatchedMutation = await prisma.unmatchedMutation.create({
     *   data: {
     *     // ... data to create a UnmatchedMutation
     *   }
     * })
     *
     */
    create<T extends UnmatchedMutationCreateArgs>(
      args: SelectSubset<T, UnmatchedMutationCreateArgs<ExtArgs>>,
    ): Prisma__UnmatchedMutationClient<
      $Result.GetResult<
        Prisma.$UnmatchedMutationPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many UnmatchedMutations.
     * @param {UnmatchedMutationCreateManyArgs} args - Arguments to create many UnmatchedMutations.
     * @example
     * // Create many UnmatchedMutations
     * const unmatchedMutation = await prisma.unmatchedMutation.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends UnmatchedMutationCreateManyArgs>(
      args?: SelectSubset<T, UnmatchedMutationCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many UnmatchedMutations and returns the data saved in the database.
     * @param {UnmatchedMutationCreateManyAndReturnArgs} args - Arguments to create many UnmatchedMutations.
     * @example
     * // Create many UnmatchedMutations
     * const unmatchedMutation = await prisma.unmatchedMutation.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many UnmatchedMutations and only return the `id`
     * const unmatchedMutationWithIdOnly = await prisma.unmatchedMutation.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends UnmatchedMutationCreateManyAndReturnArgs>(
      args?: SelectSubset<T, UnmatchedMutationCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$UnmatchedMutationPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a UnmatchedMutation.
     * @param {UnmatchedMutationDeleteArgs} args - Arguments to delete one UnmatchedMutation.
     * @example
     * // Delete one UnmatchedMutation
     * const UnmatchedMutation = await prisma.unmatchedMutation.delete({
     *   where: {
     *     // ... filter to delete one UnmatchedMutation
     *   }
     * })
     *
     */
    delete<T extends UnmatchedMutationDeleteArgs>(
      args: SelectSubset<T, UnmatchedMutationDeleteArgs<ExtArgs>>,
    ): Prisma__UnmatchedMutationClient<
      $Result.GetResult<
        Prisma.$UnmatchedMutationPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one UnmatchedMutation.
     * @param {UnmatchedMutationUpdateArgs} args - Arguments to update one UnmatchedMutation.
     * @example
     * // Update one UnmatchedMutation
     * const unmatchedMutation = await prisma.unmatchedMutation.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends UnmatchedMutationUpdateArgs>(
      args: SelectSubset<T, UnmatchedMutationUpdateArgs<ExtArgs>>,
    ): Prisma__UnmatchedMutationClient<
      $Result.GetResult<
        Prisma.$UnmatchedMutationPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more UnmatchedMutations.
     * @param {UnmatchedMutationDeleteManyArgs} args - Arguments to filter UnmatchedMutations to delete.
     * @example
     * // Delete a few UnmatchedMutations
     * const { count } = await prisma.unmatchedMutation.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends UnmatchedMutationDeleteManyArgs>(
      args?: SelectSubset<T, UnmatchedMutationDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more UnmatchedMutations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UnmatchedMutationUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many UnmatchedMutations
     * const unmatchedMutation = await prisma.unmatchedMutation.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends UnmatchedMutationUpdateManyArgs>(
      args: SelectSubset<T, UnmatchedMutationUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more UnmatchedMutations and returns the data updated in the database.
     * @param {UnmatchedMutationUpdateManyAndReturnArgs} args - Arguments to update many UnmatchedMutations.
     * @example
     * // Update many UnmatchedMutations
     * const unmatchedMutation = await prisma.unmatchedMutation.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more UnmatchedMutations and only return the `id`
     * const unmatchedMutationWithIdOnly = await prisma.unmatchedMutation.updateManyAndReturn({
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
    updateManyAndReturn<T extends UnmatchedMutationUpdateManyAndReturnArgs>(
      args: SelectSubset<T, UnmatchedMutationUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$UnmatchedMutationPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one UnmatchedMutation.
     * @param {UnmatchedMutationUpsertArgs} args - Arguments to update or create a UnmatchedMutation.
     * @example
     * // Update or create a UnmatchedMutation
     * const unmatchedMutation = await prisma.unmatchedMutation.upsert({
     *   create: {
     *     // ... data to create a UnmatchedMutation
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the UnmatchedMutation we want to update
     *   }
     * })
     */
    upsert<T extends UnmatchedMutationUpsertArgs>(
      args: SelectSubset<T, UnmatchedMutationUpsertArgs<ExtArgs>>,
    ): Prisma__UnmatchedMutationClient<
      $Result.GetResult<
        Prisma.$UnmatchedMutationPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of UnmatchedMutations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UnmatchedMutationCountArgs} args - Arguments to filter UnmatchedMutations to count.
     * @example
     * // Count the number of UnmatchedMutations
     * const count = await prisma.unmatchedMutation.count({
     *   where: {
     *     // ... the filter for the UnmatchedMutations we want to count
     *   }
     * })
     **/
    count<T extends UnmatchedMutationCountArgs>(
      args?: Subset<T, UnmatchedMutationCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<
              T["select"],
              UnmatchedMutationCountAggregateOutputType
            >
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a UnmatchedMutation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UnmatchedMutationAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends UnmatchedMutationAggregateArgs>(
      args: Subset<T, UnmatchedMutationAggregateArgs>,
    ): Prisma.PrismaPromise<GetUnmatchedMutationAggregateType<T>>;

    /**
     * Group by UnmatchedMutation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UnmatchedMutationGroupByArgs} args - Group by arguments.
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
      T extends UnmatchedMutationGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UnmatchedMutationGroupByArgs["orderBy"] }
        : { orderBy?: UnmatchedMutationGroupByArgs["orderBy"] },
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
      args: SubsetIntersection<T, UnmatchedMutationGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetUnmatchedMutationGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the UnmatchedMutation model
     */
    readonly fields: UnmatchedMutationFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for UnmatchedMutation.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UnmatchedMutationClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    payment<T extends UnmatchedMutation$paymentArgs<ExtArgs> = {}>(
      args?: Subset<T, UnmatchedMutation$paymentArgs<ExtArgs>>,
    ): Prisma__PaymentClient<
      $Result.GetResult<
        Prisma.$PaymentPayload<ExtArgs>,
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
   * Fields of the UnmatchedMutation model
   */
  interface UnmatchedMutationFieldRefs {
    readonly id: FieldRef<"UnmatchedMutation", "String">;
    readonly provider: FieldRef<"UnmatchedMutation", "String">;
    readonly transactionId: FieldRef<"UnmatchedMutation", "String">;
    readonly amount: FieldRef<"UnmatchedMutation", "Decimal">;
    readonly description: FieldRef<"UnmatchedMutation", "String">;
    readonly type: FieldRef<"UnmatchedMutation", "String">;
    readonly date: FieldRef<"UnmatchedMutation", "DateTime">;
    readonly bankId: FieldRef<"UnmatchedMutation", "String">;
    readonly rawPayload: FieldRef<"UnmatchedMutation", "Json">;
    readonly status: FieldRef<"UnmatchedMutation", "UnmatchedStatus">;
    readonly resolvedAt: FieldRef<"UnmatchedMutation", "DateTime">;
    readonly resolvedById: FieldRef<"UnmatchedMutation", "String">;
    readonly matchedInvoiceId: FieldRef<"UnmatchedMutation", "String">;
    readonly createdAt: FieldRef<"UnmatchedMutation", "DateTime">;
    readonly updatedAt: FieldRef<"UnmatchedMutation", "DateTime">;
    readonly tenantId: FieldRef<"UnmatchedMutation", "String">;
  }

  // Custom InputTypes
  /**
   * UnmatchedMutation findUnique
   */
  export type UnmatchedMutationFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null;
    /**
     * Filter, which UnmatchedMutation to fetch.
     */
    where: UnmatchedMutationWhereUniqueInput;
  };

  /**
   * UnmatchedMutation findUniqueOrThrow
   */
  export type UnmatchedMutationFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null;
    /**
     * Filter, which UnmatchedMutation to fetch.
     */
    where: UnmatchedMutationWhereUniqueInput;
  };

  /**
   * UnmatchedMutation findFirst
   */
  export type UnmatchedMutationFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null;
    /**
     * Filter, which UnmatchedMutation to fetch.
     */
    where?: UnmatchedMutationWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of UnmatchedMutations to fetch.
     */
    orderBy?:
      | UnmatchedMutationOrderByWithRelationInput
      | UnmatchedMutationOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for UnmatchedMutations.
     */
    cursor?: UnmatchedMutationWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` UnmatchedMutations from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` UnmatchedMutations.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of UnmatchedMutations.
     */
    distinct?:
      | UnmatchedMutationScalarFieldEnum
      | UnmatchedMutationScalarFieldEnum[];
  };

  /**
   * UnmatchedMutation findFirstOrThrow
   */
  export type UnmatchedMutationFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null;
    /**
     * Filter, which UnmatchedMutation to fetch.
     */
    where?: UnmatchedMutationWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of UnmatchedMutations to fetch.
     */
    orderBy?:
      | UnmatchedMutationOrderByWithRelationInput
      | UnmatchedMutationOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for UnmatchedMutations.
     */
    cursor?: UnmatchedMutationWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` UnmatchedMutations from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` UnmatchedMutations.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of UnmatchedMutations.
     */
    distinct?:
      | UnmatchedMutationScalarFieldEnum
      | UnmatchedMutationScalarFieldEnum[];
  };

  /**
   * UnmatchedMutation findMany
   */
  export type UnmatchedMutationFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null;
    /**
     * Filter, which UnmatchedMutations to fetch.
     */
    where?: UnmatchedMutationWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of UnmatchedMutations to fetch.
     */
    orderBy?:
      | UnmatchedMutationOrderByWithRelationInput
      | UnmatchedMutationOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing UnmatchedMutations.
     */
    cursor?: UnmatchedMutationWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` UnmatchedMutations from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` UnmatchedMutations.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of UnmatchedMutations.
     */
    distinct?:
      | UnmatchedMutationScalarFieldEnum
      | UnmatchedMutationScalarFieldEnum[];
  };

  /**
   * UnmatchedMutation create
   */
  export type UnmatchedMutationCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null;
    /**
     * The data needed to create a UnmatchedMutation.
     */
    data: XOR<
      UnmatchedMutationCreateInput,
      UnmatchedMutationUncheckedCreateInput
    >;
  };

  /**
   * UnmatchedMutation createMany
   */
  export type UnmatchedMutationCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many UnmatchedMutations.
     */
    data: UnmatchedMutationCreateManyInput | UnmatchedMutationCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * UnmatchedMutation createManyAndReturn
   */
  export type UnmatchedMutationCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null;
    /**
     * The data used to create many UnmatchedMutations.
     */
    data: UnmatchedMutationCreateManyInput | UnmatchedMutationCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * UnmatchedMutation update
   */
  export type UnmatchedMutationUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null;
    /**
     * The data needed to update a UnmatchedMutation.
     */
    data: XOR<
      UnmatchedMutationUpdateInput,
      UnmatchedMutationUncheckedUpdateInput
    >;
    /**
     * Choose, which UnmatchedMutation to update.
     */
    where: UnmatchedMutationWhereUniqueInput;
  };

  /**
   * UnmatchedMutation updateMany
   */
  export type UnmatchedMutationUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update UnmatchedMutations.
     */
    data: XOR<
      UnmatchedMutationUpdateManyMutationInput,
      UnmatchedMutationUncheckedUpdateManyInput
    >;
    /**
     * Filter which UnmatchedMutations to update
     */
    where?: UnmatchedMutationWhereInput;
    /**
     * Limit how many UnmatchedMutations to update.
     */
    limit?: number;
  };

  /**
   * UnmatchedMutation updateManyAndReturn
   */
  export type UnmatchedMutationUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null;
    /**
     * The data used to update UnmatchedMutations.
     */
    data: XOR<
      UnmatchedMutationUpdateManyMutationInput,
      UnmatchedMutationUncheckedUpdateManyInput
    >;
    /**
     * Filter which UnmatchedMutations to update
     */
    where?: UnmatchedMutationWhereInput;
    /**
     * Limit how many UnmatchedMutations to update.
     */
    limit?: number;
  };

  /**
   * UnmatchedMutation upsert
   */
  export type UnmatchedMutationUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null;
    /**
     * The filter to search for the UnmatchedMutation to update in case it exists.
     */
    where: UnmatchedMutationWhereUniqueInput;
    /**
     * In case the UnmatchedMutation found by the `where` argument doesn't exist, create a new UnmatchedMutation with this data.
     */
    create: XOR<
      UnmatchedMutationCreateInput,
      UnmatchedMutationUncheckedCreateInput
    >;
    /**
     * In case the UnmatchedMutation was found with the provided `where` argument, update it with this data.
     */
    update: XOR<
      UnmatchedMutationUpdateInput,
      UnmatchedMutationUncheckedUpdateInput
    >;
  };

  /**
   * UnmatchedMutation delete
   */
  export type UnmatchedMutationDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null;
    /**
     * Filter which UnmatchedMutation to delete.
     */
    where: UnmatchedMutationWhereUniqueInput;
  };

  /**
   * UnmatchedMutation deleteMany
   */
  export type UnmatchedMutationDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which UnmatchedMutations to delete
     */
    where?: UnmatchedMutationWhereInput;
    /**
     * Limit how many UnmatchedMutations to delete.
     */
    limit?: number;
  };

  /**
   * UnmatchedMutation.payment
   */
  export type UnmatchedMutation$paymentArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null;
    where?: PaymentWhereInput;
  };

  /**
   * UnmatchedMutation without action
   */
  export type UnmatchedMutationDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null;
  };

  /**
   * Model WebhookEvent
   */

  export type AggregateWebhookEvent = {
    _count: WebhookEventCountAggregateOutputType | null;
    _min: WebhookEventMinAggregateOutputType | null;
    _max: WebhookEventMaxAggregateOutputType | null;
  };

  export type WebhookEventMinAggregateOutputType = {
    id: string | null;
    idempotencyKey: string | null;
    provider: string | null;
    signature: string | null;
    rawBody: string | null;
    status: $Enums.WebhookEventStatus | null;
    orderId: string | null;
    transactionId: string | null;
    processedAt: Date | null;
    error: string | null;
    tenantId: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type WebhookEventMaxAggregateOutputType = {
    id: string | null;
    idempotencyKey: string | null;
    provider: string | null;
    signature: string | null;
    rawBody: string | null;
    status: $Enums.WebhookEventStatus | null;
    orderId: string | null;
    transactionId: string | null;
    processedAt: Date | null;
    error: string | null;
    tenantId: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type WebhookEventCountAggregateOutputType = {
    id: number;
    idempotencyKey: number;
    provider: number;
    payload: number;
    signature: number;
    rawBody: number;
    status: number;
    orderId: number;
    transactionId: number;
    processedAt: number;
    error: number;
    tenantId: number;
    createdAt: number;
    updatedAt: number;
    _all: number;
  };

  export type WebhookEventMinAggregateInputType = {
    id?: true;
    idempotencyKey?: true;
    provider?: true;
    signature?: true;
    rawBody?: true;
    status?: true;
    orderId?: true;
    transactionId?: true;
    processedAt?: true;
    error?: true;
    tenantId?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type WebhookEventMaxAggregateInputType = {
    id?: true;
    idempotencyKey?: true;
    provider?: true;
    signature?: true;
    rawBody?: true;
    status?: true;
    orderId?: true;
    transactionId?: true;
    processedAt?: true;
    error?: true;
    tenantId?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type WebhookEventCountAggregateInputType = {
    id?: true;
    idempotencyKey?: true;
    provider?: true;
    payload?: true;
    signature?: true;
    rawBody?: true;
    status?: true;
    orderId?: true;
    transactionId?: true;
    processedAt?: true;
    error?: true;
    tenantId?: true;
    createdAt?: true;
    updatedAt?: true;
    _all?: true;
  };

  export type WebhookEventAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which WebhookEvent to aggregate.
     */
    where?: WebhookEventWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of WebhookEvents to fetch.
     */
    orderBy?:
      | WebhookEventOrderByWithRelationInput
      | WebhookEventOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: WebhookEventWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` WebhookEvents from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` WebhookEvents.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned WebhookEvents
     **/
    _count?: true | WebhookEventCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: WebhookEventMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: WebhookEventMaxAggregateInputType;
  };

  export type GetWebhookEventAggregateType<
    T extends WebhookEventAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateWebhookEvent]: P extends "_count" | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateWebhookEvent[P]>
      : GetScalarType<T[P], AggregateWebhookEvent[P]>;
  };

  export type WebhookEventGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: WebhookEventWhereInput;
    orderBy?:
      | WebhookEventOrderByWithAggregationInput
      | WebhookEventOrderByWithAggregationInput[];
    by: WebhookEventScalarFieldEnum[] | WebhookEventScalarFieldEnum;
    having?: WebhookEventScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: WebhookEventCountAggregateInputType | true;
    _min?: WebhookEventMinAggregateInputType;
    _max?: WebhookEventMaxAggregateInputType;
  };

  export type WebhookEventGroupByOutputType = {
    id: string;
    idempotencyKey: string;
    provider: string;
    payload: JsonValue;
    signature: string | null;
    rawBody: string | null;
    status: $Enums.WebhookEventStatus;
    orderId: string | null;
    transactionId: string | null;
    processedAt: Date | null;
    error: string | null;
    tenantId: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: WebhookEventCountAggregateOutputType | null;
    _min: WebhookEventMinAggregateOutputType | null;
    _max: WebhookEventMaxAggregateOutputType | null;
  };

  type GetWebhookEventGroupByPayload<T extends WebhookEventGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<WebhookEventGroupByOutputType, T["by"]> & {
          [P in keyof T &
            keyof WebhookEventGroupByOutputType]: P extends "_count"
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], WebhookEventGroupByOutputType[P]>
            : GetScalarType<T[P], WebhookEventGroupByOutputType[P]>;
        }
      >
    >;

  export type WebhookEventSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      idempotencyKey?: boolean;
      provider?: boolean;
      payload?: boolean;
      signature?: boolean;
      rawBody?: boolean;
      status?: boolean;
      orderId?: boolean;
      transactionId?: boolean;
      processedAt?: boolean;
      error?: boolean;
      tenantId?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
    },
    ExtArgs["result"]["webhookEvent"]
  >;

  export type WebhookEventSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      idempotencyKey?: boolean;
      provider?: boolean;
      payload?: boolean;
      signature?: boolean;
      rawBody?: boolean;
      status?: boolean;
      orderId?: boolean;
      transactionId?: boolean;
      processedAt?: boolean;
      error?: boolean;
      tenantId?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
    },
    ExtArgs["result"]["webhookEvent"]
  >;

  export type WebhookEventSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      idempotencyKey?: boolean;
      provider?: boolean;
      payload?: boolean;
      signature?: boolean;
      rawBody?: boolean;
      status?: boolean;
      orderId?: boolean;
      transactionId?: boolean;
      processedAt?: boolean;
      error?: boolean;
      tenantId?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
    },
    ExtArgs["result"]["webhookEvent"]
  >;

  export type WebhookEventSelectScalar = {
    id?: boolean;
    idempotencyKey?: boolean;
    provider?: boolean;
    payload?: boolean;
    signature?: boolean;
    rawBody?: boolean;
    status?: boolean;
    orderId?: boolean;
    transactionId?: boolean;
    processedAt?: boolean;
    error?: boolean;
    tenantId?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
  };

  export type WebhookEventOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "idempotencyKey"
    | "provider"
    | "payload"
    | "signature"
    | "rawBody"
    | "status"
    | "orderId"
    | "transactionId"
    | "processedAt"
    | "error"
    | "tenantId"
    | "createdAt"
    | "updatedAt",
    ExtArgs["result"]["webhookEvent"]
  >;

  export type $WebhookEventPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "WebhookEvent";
    objects: {};
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        idempotencyKey: string;
        provider: string;
        payload: Prisma.JsonValue;
        signature: string | null;
        rawBody: string | null;
        status: $Enums.WebhookEventStatus;
        orderId: string | null;
        transactionId: string | null;
        processedAt: Date | null;
        error: string | null;
        tenantId: string | null;
        createdAt: Date;
        updatedAt: Date;
      },
      ExtArgs["result"]["webhookEvent"]
    >;
    composites: {};
  };

  type WebhookEventGetPayload<
    S extends boolean | null | undefined | WebhookEventDefaultArgs,
  > = $Result.GetResult<Prisma.$WebhookEventPayload, S>;

  type WebhookEventCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    WebhookEventFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: WebhookEventCountAggregateInputType | true;
  };

  export interface WebhookEventDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["WebhookEvent"];
      meta: { name: "WebhookEvent" };
    };
    /**
     * Find zero or one WebhookEvent that matches the filter.
     * @param {WebhookEventFindUniqueArgs} args - Arguments to find a WebhookEvent
     * @example
     * // Get one WebhookEvent
     * const webhookEvent = await prisma.webhookEvent.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends WebhookEventFindUniqueArgs>(
      args: SelectSubset<T, WebhookEventFindUniqueArgs<ExtArgs>>,
    ): Prisma__WebhookEventClient<
      $Result.GetResult<
        Prisma.$WebhookEventPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one WebhookEvent that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {WebhookEventFindUniqueOrThrowArgs} args - Arguments to find a WebhookEvent
     * @example
     * // Get one WebhookEvent
     * const webhookEvent = await prisma.webhookEvent.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends WebhookEventFindUniqueOrThrowArgs>(
      args: SelectSubset<T, WebhookEventFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__WebhookEventClient<
      $Result.GetResult<
        Prisma.$WebhookEventPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first WebhookEvent that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WebhookEventFindFirstArgs} args - Arguments to find a WebhookEvent
     * @example
     * // Get one WebhookEvent
     * const webhookEvent = await prisma.webhookEvent.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends WebhookEventFindFirstArgs>(
      args?: SelectSubset<T, WebhookEventFindFirstArgs<ExtArgs>>,
    ): Prisma__WebhookEventClient<
      $Result.GetResult<
        Prisma.$WebhookEventPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first WebhookEvent that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WebhookEventFindFirstOrThrowArgs} args - Arguments to find a WebhookEvent
     * @example
     * // Get one WebhookEvent
     * const webhookEvent = await prisma.webhookEvent.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends WebhookEventFindFirstOrThrowArgs>(
      args?: SelectSubset<T, WebhookEventFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__WebhookEventClient<
      $Result.GetResult<
        Prisma.$WebhookEventPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more WebhookEvents that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WebhookEventFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all WebhookEvents
     * const webhookEvents = await prisma.webhookEvent.findMany()
     *
     * // Get first 10 WebhookEvents
     * const webhookEvents = await prisma.webhookEvent.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const webhookEventWithIdOnly = await prisma.webhookEvent.findMany({ select: { id: true } })
     *
     */
    findMany<T extends WebhookEventFindManyArgs>(
      args?: SelectSubset<T, WebhookEventFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$WebhookEventPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a WebhookEvent.
     * @param {WebhookEventCreateArgs} args - Arguments to create a WebhookEvent.
     * @example
     * // Create one WebhookEvent
     * const WebhookEvent = await prisma.webhookEvent.create({
     *   data: {
     *     // ... data to create a WebhookEvent
     *   }
     * })
     *
     */
    create<T extends WebhookEventCreateArgs>(
      args: SelectSubset<T, WebhookEventCreateArgs<ExtArgs>>,
    ): Prisma__WebhookEventClient<
      $Result.GetResult<
        Prisma.$WebhookEventPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many WebhookEvents.
     * @param {WebhookEventCreateManyArgs} args - Arguments to create many WebhookEvents.
     * @example
     * // Create many WebhookEvents
     * const webhookEvent = await prisma.webhookEvent.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends WebhookEventCreateManyArgs>(
      args?: SelectSubset<T, WebhookEventCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many WebhookEvents and returns the data saved in the database.
     * @param {WebhookEventCreateManyAndReturnArgs} args - Arguments to create many WebhookEvents.
     * @example
     * // Create many WebhookEvents
     * const webhookEvent = await prisma.webhookEvent.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many WebhookEvents and only return the `id`
     * const webhookEventWithIdOnly = await prisma.webhookEvent.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends WebhookEventCreateManyAndReturnArgs>(
      args?: SelectSubset<T, WebhookEventCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$WebhookEventPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a WebhookEvent.
     * @param {WebhookEventDeleteArgs} args - Arguments to delete one WebhookEvent.
     * @example
     * // Delete one WebhookEvent
     * const WebhookEvent = await prisma.webhookEvent.delete({
     *   where: {
     *     // ... filter to delete one WebhookEvent
     *   }
     * })
     *
     */
    delete<T extends WebhookEventDeleteArgs>(
      args: SelectSubset<T, WebhookEventDeleteArgs<ExtArgs>>,
    ): Prisma__WebhookEventClient<
      $Result.GetResult<
        Prisma.$WebhookEventPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one WebhookEvent.
     * @param {WebhookEventUpdateArgs} args - Arguments to update one WebhookEvent.
     * @example
     * // Update one WebhookEvent
     * const webhookEvent = await prisma.webhookEvent.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends WebhookEventUpdateArgs>(
      args: SelectSubset<T, WebhookEventUpdateArgs<ExtArgs>>,
    ): Prisma__WebhookEventClient<
      $Result.GetResult<
        Prisma.$WebhookEventPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more WebhookEvents.
     * @param {WebhookEventDeleteManyArgs} args - Arguments to filter WebhookEvents to delete.
     * @example
     * // Delete a few WebhookEvents
     * const { count } = await prisma.webhookEvent.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends WebhookEventDeleteManyArgs>(
      args?: SelectSubset<T, WebhookEventDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more WebhookEvents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WebhookEventUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many WebhookEvents
     * const webhookEvent = await prisma.webhookEvent.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends WebhookEventUpdateManyArgs>(
      args: SelectSubset<T, WebhookEventUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more WebhookEvents and returns the data updated in the database.
     * @param {WebhookEventUpdateManyAndReturnArgs} args - Arguments to update many WebhookEvents.
     * @example
     * // Update many WebhookEvents
     * const webhookEvent = await prisma.webhookEvent.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more WebhookEvents and only return the `id`
     * const webhookEventWithIdOnly = await prisma.webhookEvent.updateManyAndReturn({
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
    updateManyAndReturn<T extends WebhookEventUpdateManyAndReturnArgs>(
      args: SelectSubset<T, WebhookEventUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$WebhookEventPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one WebhookEvent.
     * @param {WebhookEventUpsertArgs} args - Arguments to update or create a WebhookEvent.
     * @example
     * // Update or create a WebhookEvent
     * const webhookEvent = await prisma.webhookEvent.upsert({
     *   create: {
     *     // ... data to create a WebhookEvent
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the WebhookEvent we want to update
     *   }
     * })
     */
    upsert<T extends WebhookEventUpsertArgs>(
      args: SelectSubset<T, WebhookEventUpsertArgs<ExtArgs>>,
    ): Prisma__WebhookEventClient<
      $Result.GetResult<
        Prisma.$WebhookEventPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of WebhookEvents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WebhookEventCountArgs} args - Arguments to filter WebhookEvents to count.
     * @example
     * // Count the number of WebhookEvents
     * const count = await prisma.webhookEvent.count({
     *   where: {
     *     // ... the filter for the WebhookEvents we want to count
     *   }
     * })
     **/
    count<T extends WebhookEventCountArgs>(
      args?: Subset<T, WebhookEventCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], WebhookEventCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a WebhookEvent.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WebhookEventAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends WebhookEventAggregateArgs>(
      args: Subset<T, WebhookEventAggregateArgs>,
    ): Prisma.PrismaPromise<GetWebhookEventAggregateType<T>>;

    /**
     * Group by WebhookEvent.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WebhookEventGroupByArgs} args - Group by arguments.
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
      T extends WebhookEventGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: WebhookEventGroupByArgs["orderBy"] }
        : { orderBy?: WebhookEventGroupByArgs["orderBy"] },
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
      args: SubsetIntersection<T, WebhookEventGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetWebhookEventGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the WebhookEvent model
     */
    readonly fields: WebhookEventFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for WebhookEvent.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__WebhookEventClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
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
   * Fields of the WebhookEvent model
   */
  interface WebhookEventFieldRefs {
    readonly id: FieldRef<"WebhookEvent", "String">;
    readonly idempotencyKey: FieldRef<"WebhookEvent", "String">;
    readonly provider: FieldRef<"WebhookEvent", "String">;
    readonly payload: FieldRef<"WebhookEvent", "Json">;
    readonly signature: FieldRef<"WebhookEvent", "String">;
    readonly rawBody: FieldRef<"WebhookEvent", "String">;
    readonly status: FieldRef<"WebhookEvent", "WebhookEventStatus">;
    readonly orderId: FieldRef<"WebhookEvent", "String">;
    readonly transactionId: FieldRef<"WebhookEvent", "String">;
    readonly processedAt: FieldRef<"WebhookEvent", "DateTime">;
    readonly error: FieldRef<"WebhookEvent", "String">;
    readonly tenantId: FieldRef<"WebhookEvent", "String">;
    readonly createdAt: FieldRef<"WebhookEvent", "DateTime">;
    readonly updatedAt: FieldRef<"WebhookEvent", "DateTime">;
  }

  // Custom InputTypes
  /**
   * WebhookEvent findUnique
   */
  export type WebhookEventFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WebhookEvent
     */
    select?: WebhookEventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WebhookEvent
     */
    omit?: WebhookEventOmit<ExtArgs> | null;
    /**
     * Filter, which WebhookEvent to fetch.
     */
    where: WebhookEventWhereUniqueInput;
  };

  /**
   * WebhookEvent findUniqueOrThrow
   */
  export type WebhookEventFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WebhookEvent
     */
    select?: WebhookEventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WebhookEvent
     */
    omit?: WebhookEventOmit<ExtArgs> | null;
    /**
     * Filter, which WebhookEvent to fetch.
     */
    where: WebhookEventWhereUniqueInput;
  };

  /**
   * WebhookEvent findFirst
   */
  export type WebhookEventFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WebhookEvent
     */
    select?: WebhookEventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WebhookEvent
     */
    omit?: WebhookEventOmit<ExtArgs> | null;
    /**
     * Filter, which WebhookEvent to fetch.
     */
    where?: WebhookEventWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of WebhookEvents to fetch.
     */
    orderBy?:
      | WebhookEventOrderByWithRelationInput
      | WebhookEventOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for WebhookEvents.
     */
    cursor?: WebhookEventWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` WebhookEvents from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` WebhookEvents.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of WebhookEvents.
     */
    distinct?: WebhookEventScalarFieldEnum | WebhookEventScalarFieldEnum[];
  };

  /**
   * WebhookEvent findFirstOrThrow
   */
  export type WebhookEventFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WebhookEvent
     */
    select?: WebhookEventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WebhookEvent
     */
    omit?: WebhookEventOmit<ExtArgs> | null;
    /**
     * Filter, which WebhookEvent to fetch.
     */
    where?: WebhookEventWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of WebhookEvents to fetch.
     */
    orderBy?:
      | WebhookEventOrderByWithRelationInput
      | WebhookEventOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for WebhookEvents.
     */
    cursor?: WebhookEventWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` WebhookEvents from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` WebhookEvents.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of WebhookEvents.
     */
    distinct?: WebhookEventScalarFieldEnum | WebhookEventScalarFieldEnum[];
  };

  /**
   * WebhookEvent findMany
   */
  export type WebhookEventFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WebhookEvent
     */
    select?: WebhookEventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WebhookEvent
     */
    omit?: WebhookEventOmit<ExtArgs> | null;
    /**
     * Filter, which WebhookEvents to fetch.
     */
    where?: WebhookEventWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of WebhookEvents to fetch.
     */
    orderBy?:
      | WebhookEventOrderByWithRelationInput
      | WebhookEventOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing WebhookEvents.
     */
    cursor?: WebhookEventWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` WebhookEvents from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` WebhookEvents.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of WebhookEvents.
     */
    distinct?: WebhookEventScalarFieldEnum | WebhookEventScalarFieldEnum[];
  };

  /**
   * WebhookEvent create
   */
  export type WebhookEventCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WebhookEvent
     */
    select?: WebhookEventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WebhookEvent
     */
    omit?: WebhookEventOmit<ExtArgs> | null;
    /**
     * The data needed to create a WebhookEvent.
     */
    data: XOR<WebhookEventCreateInput, WebhookEventUncheckedCreateInput>;
  };

  /**
   * WebhookEvent createMany
   */
  export type WebhookEventCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many WebhookEvents.
     */
    data: WebhookEventCreateManyInput | WebhookEventCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * WebhookEvent createManyAndReturn
   */
  export type WebhookEventCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WebhookEvent
     */
    select?: WebhookEventSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the WebhookEvent
     */
    omit?: WebhookEventOmit<ExtArgs> | null;
    /**
     * The data used to create many WebhookEvents.
     */
    data: WebhookEventCreateManyInput | WebhookEventCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * WebhookEvent update
   */
  export type WebhookEventUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WebhookEvent
     */
    select?: WebhookEventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WebhookEvent
     */
    omit?: WebhookEventOmit<ExtArgs> | null;
    /**
     * The data needed to update a WebhookEvent.
     */
    data: XOR<WebhookEventUpdateInput, WebhookEventUncheckedUpdateInput>;
    /**
     * Choose, which WebhookEvent to update.
     */
    where: WebhookEventWhereUniqueInput;
  };

  /**
   * WebhookEvent updateMany
   */
  export type WebhookEventUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update WebhookEvents.
     */
    data: XOR<
      WebhookEventUpdateManyMutationInput,
      WebhookEventUncheckedUpdateManyInput
    >;
    /**
     * Filter which WebhookEvents to update
     */
    where?: WebhookEventWhereInput;
    /**
     * Limit how many WebhookEvents to update.
     */
    limit?: number;
  };

  /**
   * WebhookEvent updateManyAndReturn
   */
  export type WebhookEventUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WebhookEvent
     */
    select?: WebhookEventSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the WebhookEvent
     */
    omit?: WebhookEventOmit<ExtArgs> | null;
    /**
     * The data used to update WebhookEvents.
     */
    data: XOR<
      WebhookEventUpdateManyMutationInput,
      WebhookEventUncheckedUpdateManyInput
    >;
    /**
     * Filter which WebhookEvents to update
     */
    where?: WebhookEventWhereInput;
    /**
     * Limit how many WebhookEvents to update.
     */
    limit?: number;
  };

  /**
   * WebhookEvent upsert
   */
  export type WebhookEventUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WebhookEvent
     */
    select?: WebhookEventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WebhookEvent
     */
    omit?: WebhookEventOmit<ExtArgs> | null;
    /**
     * The filter to search for the WebhookEvent to update in case it exists.
     */
    where: WebhookEventWhereUniqueInput;
    /**
     * In case the WebhookEvent found by the `where` argument doesn't exist, create a new WebhookEvent with this data.
     */
    create: XOR<WebhookEventCreateInput, WebhookEventUncheckedCreateInput>;
    /**
     * In case the WebhookEvent was found with the provided `where` argument, update it with this data.
     */
    update: XOR<WebhookEventUpdateInput, WebhookEventUncheckedUpdateInput>;
  };

  /**
   * WebhookEvent delete
   */
  export type WebhookEventDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WebhookEvent
     */
    select?: WebhookEventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WebhookEvent
     */
    omit?: WebhookEventOmit<ExtArgs> | null;
    /**
     * Filter which WebhookEvent to delete.
     */
    where: WebhookEventWhereUniqueInput;
  };

  /**
   * WebhookEvent deleteMany
   */
  export type WebhookEventDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which WebhookEvents to delete
     */
    where?: WebhookEventWhereInput;
    /**
     * Limit how many WebhookEvents to delete.
     */
    limit?: number;
  };

  /**
   * WebhookEvent without action
   */
  export type WebhookEventDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the WebhookEvent
     */
    select?: WebhookEventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the WebhookEvent
     */
    omit?: WebhookEventOmit<ExtArgs> | null;
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

  export const InvoiceScalarFieldEnum: {
    id: "id";
    invoiceNumber: "invoiceNumber";
    pelangganId: "pelangganId";
    issueDate: "issueDate";
    dueDate: "dueDate";
    status: "status";
    subtotal: "subtotal";
    taxAmount: "taxAmount";
    discountAmount: "discountAmount";
    totalAmount: "totalAmount";
    paidAmount: "paidAmount";
    notes: "notes";
    terms: "terms";
    sentAt: "sentAt";
    paidAt: "paidAt";
    createdBy: "createdBy";
    createdAt: "createdAt";
    updatedAt: "updatedAt";
    siteId: "siteId";
    tenantId: "tenantId";
  };

  export type InvoiceScalarFieldEnum =
    (typeof InvoiceScalarFieldEnum)[keyof typeof InvoiceScalarFieldEnum];

  export const BillingScheduleScalarFieldEnum: {
    id: "id";
    dedupeKey: "dedupeKey";
    jobType: "jobType";
    invoiceId: "invoiceId";
    pelangganId: "pelangganId";
    runAt: "runAt";
    status: "status";
    queueJobId: "queueJobId";
    payload: "payload";
    version: "version";
    attemptCount: "attemptCount";
    queuedAt: "queuedAt";
    processingAt: "processingAt";
    completedAt: "completedAt";
    cancelledAt: "cancelledAt";
    failedAt: "failedAt";
    lastAttemptAt: "lastAttemptAt";
    lastError: "lastError";
    createdAt: "createdAt";
    updatedAt: "updatedAt";
    tenantId: "tenantId";
  };

  export type BillingScheduleScalarFieldEnum =
    (typeof BillingScheduleScalarFieldEnum)[keyof typeof BillingScheduleScalarFieldEnum];

  export const InvoiceItemScalarFieldEnum: {
    id: "id";
    invoiceId: "invoiceId";
    description: "description";
    quantity: "quantity";
    unitPrice: "unitPrice";
    totalPrice: "totalPrice";
    itemType: "itemType";
    tenantId: "tenantId";
  };

  export type InvoiceItemScalarFieldEnum =
    (typeof InvoiceItemScalarFieldEnum)[keyof typeof InvoiceItemScalarFieldEnum];

  export const PaymentScalarFieldEnum: {
    id: "id";
    invoiceId: "invoiceId";
    pelangganId: "pelangganId";
    amount: "amount";
    paymentDate: "paymentDate";
    paymentMethod: "paymentMethod";
    reference: "reference";
    notes: "notes";
    verifiedBy: "verifiedBy";
    verifiedAt: "verifiedAt";
    createdAt: "createdAt";
    updatedAt: "updatedAt";
    accountId: "accountId";
    gatewayStatus: "gatewayStatus";
    gatewayProvider: "gatewayProvider";
    transactionId: "transactionId";
    paymentUrl: "paymentUrl";
    expiresAt: "expiresAt";
    unmatchedMutationId: "unmatchedMutationId";
    receiptUrl: "receiptUrl";
    tenantId: "tenantId";
  };

  export type PaymentScalarFieldEnum =
    (typeof PaymentScalarFieldEnum)[keyof typeof PaymentScalarFieldEnum];

  export const PaymentGatewayConfigScalarFieldEnum: {
    id: "id";
    provider: "provider";
    providerName: "providerName";
    isEnabled: "isEnabled";
    isProduction: "isProduction";
    priority: "priority";
    apiKey: "apiKey";
    apiSecret: "apiSecret";
    clientKey: "clientKey";
    merchantId: "merchantId";
    webhookUrl: "webhookUrl";
    callbackUrl: "callbackUrl";
    settings: "settings";
    lastTestedAt: "lastTestedAt";
    testStatus: "testStatus";
    createdAt: "createdAt";
    updatedAt: "updatedAt";
    createdBy: "createdBy";
    tenantId: "tenantId";
  };

  export type PaymentGatewayConfigScalarFieldEnum =
    (typeof PaymentGatewayConfigScalarFieldEnum)[keyof typeof PaymentGatewayConfigScalarFieldEnum];

  export const UnmatchedMutationScalarFieldEnum: {
    id: "id";
    provider: "provider";
    transactionId: "transactionId";
    amount: "amount";
    description: "description";
    type: "type";
    date: "date";
    bankId: "bankId";
    rawPayload: "rawPayload";
    status: "status";
    resolvedAt: "resolvedAt";
    resolvedById: "resolvedById";
    matchedInvoiceId: "matchedInvoiceId";
    createdAt: "createdAt";
    updatedAt: "updatedAt";
    tenantId: "tenantId";
  };

  export type UnmatchedMutationScalarFieldEnum =
    (typeof UnmatchedMutationScalarFieldEnum)[keyof typeof UnmatchedMutationScalarFieldEnum];

  export const WebhookEventScalarFieldEnum: {
    id: "id";
    idempotencyKey: "idempotencyKey";
    provider: "provider";
    payload: "payload";
    signature: "signature";
    rawBody: "rawBody";
    status: "status";
    orderId: "orderId";
    transactionId: "transactionId";
    processedAt: "processedAt";
    error: "error";
    tenantId: "tenantId";
    createdAt: "createdAt";
    updatedAt: "updatedAt";
  };

  export type WebhookEventScalarFieldEnum =
    (typeof WebhookEventScalarFieldEnum)[keyof typeof WebhookEventScalarFieldEnum];

  export const SortOrder: {
    asc: "asc";
    desc: "desc";
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull;
    JsonNull: typeof JsonNull;
  };

  export type NullableJsonNullValueInput =
    (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput];

  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull;
  };

  export type JsonNullValueInput =
    (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput];

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

  export const JsonNullValueFilter: {
    DbNull: typeof DbNull;
    JsonNull: typeof JsonNull;
    AnyNull: typeof AnyNull;
  };

  export type JsonNullValueFilter =
    (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter];

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
   * Reference to a field of type 'InvoiceStatus'
   */
  export type EnumInvoiceStatusFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "InvoiceStatus"
  >;

  /**
   * Reference to a field of type 'InvoiceStatus[]'
   */
  export type ListEnumInvoiceStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "InvoiceStatus[]">;

  /**
   * Reference to a field of type 'BigInt'
   */
  export type BigIntFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "BigInt"
  >;

  /**
   * Reference to a field of type 'BigInt[]'
   */
  export type ListBigIntFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "BigInt[]"
  >;

  /**
   * Reference to a field of type 'BillingScheduleJobType'
   */
  export type EnumBillingScheduleJobTypeFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "BillingScheduleJobType">;

  /**
   * Reference to a field of type 'BillingScheduleJobType[]'
   */
  export type ListEnumBillingScheduleJobTypeFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "BillingScheduleJobType[]">;

  /**
   * Reference to a field of type 'BillingScheduleStatus'
   */
  export type EnumBillingScheduleStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "BillingScheduleStatus">;

  /**
   * Reference to a field of type 'BillingScheduleStatus[]'
   */
  export type ListEnumBillingScheduleStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "BillingScheduleStatus[]">;

  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Json"
  >;

  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "QueryMode"
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
   * Reference to a field of type 'ItemType'
   */
  export type EnumItemTypeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "ItemType"
  >;

  /**
   * Reference to a field of type 'ItemType[]'
   */
  export type ListEnumItemTypeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "ItemType[]"
  >;

  /**
   * Reference to a field of type 'PaymentMethod'
   */
  export type EnumPaymentMethodFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "PaymentMethod"
  >;

  /**
   * Reference to a field of type 'PaymentMethod[]'
   */
  export type ListEnumPaymentMethodFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "PaymentMethod[]">;

  /**
   * Reference to a field of type 'GatewayPaymentStatus'
   */
  export type EnumGatewayPaymentStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "GatewayPaymentStatus">;

  /**
   * Reference to a field of type 'GatewayPaymentStatus[]'
   */
  export type ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "GatewayPaymentStatus[]">;

  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Boolean"
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
   * Reference to a field of type 'UnmatchedStatus'
   */
  export type EnumUnmatchedStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "UnmatchedStatus">;

  /**
   * Reference to a field of type 'UnmatchedStatus[]'
   */
  export type ListEnumUnmatchedStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "UnmatchedStatus[]">;

  /**
   * Reference to a field of type 'WebhookEventStatus'
   */
  export type EnumWebhookEventStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "WebhookEventStatus">;

  /**
   * Reference to a field of type 'WebhookEventStatus[]'
   */
  export type ListEnumWebhookEventStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "WebhookEventStatus[]">;

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
   * Deep Input Types
   */

  export type InvoiceWhereInput = {
    AND?: InvoiceWhereInput | InvoiceWhereInput[];
    OR?: InvoiceWhereInput[];
    NOT?: InvoiceWhereInput | InvoiceWhereInput[];
    id?: StringFilter<"Invoice"> | string;
    invoiceNumber?: StringFilter<"Invoice"> | string;
    pelangganId?: StringFilter<"Invoice"> | string;
    issueDate?: DateTimeFilter<"Invoice"> | Date | string;
    dueDate?: DateTimeFilter<"Invoice"> | Date | string;
    status?: EnumInvoiceStatusFilter<"Invoice"> | $Enums.InvoiceStatus;
    subtotal?: BigIntFilter<"Invoice"> | bigint | number;
    taxAmount?: BigIntFilter<"Invoice"> | bigint | number;
    discountAmount?: BigIntFilter<"Invoice"> | bigint | number;
    totalAmount?: BigIntFilter<"Invoice"> | bigint | number;
    paidAmount?: BigIntFilter<"Invoice"> | bigint | number;
    notes?: StringNullableFilter<"Invoice"> | string | null;
    terms?: StringNullableFilter<"Invoice"> | string | null;
    sentAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null;
    paidAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null;
    createdBy?: StringNullableFilter<"Invoice"> | string | null;
    createdAt?: DateTimeFilter<"Invoice"> | Date | string;
    updatedAt?: DateTimeFilter<"Invoice"> | Date | string;
    siteId?: StringNullableFilter<"Invoice"> | string | null;
    tenantId?: StringNullableFilter<"Invoice"> | string | null;
    invoiceItem?: InvoiceItemListRelationFilter;
    payment?: PaymentListRelationFilter;
    billingSchedules?: BillingScheduleListRelationFilter;
  };

  export type InvoiceOrderByWithRelationInput = {
    id?: SortOrder;
    invoiceNumber?: SortOrder;
    pelangganId?: SortOrder;
    issueDate?: SortOrder;
    dueDate?: SortOrder;
    status?: SortOrder;
    subtotal?: SortOrder;
    taxAmount?: SortOrder;
    discountAmount?: SortOrder;
    totalAmount?: SortOrder;
    paidAmount?: SortOrder;
    notes?: SortOrderInput | SortOrder;
    terms?: SortOrderInput | SortOrder;
    sentAt?: SortOrderInput | SortOrder;
    paidAt?: SortOrderInput | SortOrder;
    createdBy?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    siteId?: SortOrderInput | SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    invoiceItem?: InvoiceItemOrderByRelationAggregateInput;
    payment?: PaymentOrderByRelationAggregateInput;
    billingSchedules?: BillingScheduleOrderByRelationAggregateInput;
  };

  export type InvoiceWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      tenantId_invoiceNumber?: InvoiceTenantIdInvoiceNumberCompoundUniqueInput;
      AND?: InvoiceWhereInput | InvoiceWhereInput[];
      OR?: InvoiceWhereInput[];
      NOT?: InvoiceWhereInput | InvoiceWhereInput[];
      invoiceNumber?: StringFilter<"Invoice"> | string;
      pelangganId?: StringFilter<"Invoice"> | string;
      issueDate?: DateTimeFilter<"Invoice"> | Date | string;
      dueDate?: DateTimeFilter<"Invoice"> | Date | string;
      status?: EnumInvoiceStatusFilter<"Invoice"> | $Enums.InvoiceStatus;
      subtotal?: BigIntFilter<"Invoice"> | bigint | number;
      taxAmount?: BigIntFilter<"Invoice"> | bigint | number;
      discountAmount?: BigIntFilter<"Invoice"> | bigint | number;
      totalAmount?: BigIntFilter<"Invoice"> | bigint | number;
      paidAmount?: BigIntFilter<"Invoice"> | bigint | number;
      notes?: StringNullableFilter<"Invoice"> | string | null;
      terms?: StringNullableFilter<"Invoice"> | string | null;
      sentAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null;
      paidAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null;
      createdBy?: StringNullableFilter<"Invoice"> | string | null;
      createdAt?: DateTimeFilter<"Invoice"> | Date | string;
      updatedAt?: DateTimeFilter<"Invoice"> | Date | string;
      siteId?: StringNullableFilter<"Invoice"> | string | null;
      tenantId?: StringNullableFilter<"Invoice"> | string | null;
      invoiceItem?: InvoiceItemListRelationFilter;
      payment?: PaymentListRelationFilter;
      billingSchedules?: BillingScheduleListRelationFilter;
    },
    "id" | "tenantId_invoiceNumber"
  >;

  export type InvoiceOrderByWithAggregationInput = {
    id?: SortOrder;
    invoiceNumber?: SortOrder;
    pelangganId?: SortOrder;
    issueDate?: SortOrder;
    dueDate?: SortOrder;
    status?: SortOrder;
    subtotal?: SortOrder;
    taxAmount?: SortOrder;
    discountAmount?: SortOrder;
    totalAmount?: SortOrder;
    paidAmount?: SortOrder;
    notes?: SortOrderInput | SortOrder;
    terms?: SortOrderInput | SortOrder;
    sentAt?: SortOrderInput | SortOrder;
    paidAt?: SortOrderInput | SortOrder;
    createdBy?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    siteId?: SortOrderInput | SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    _count?: InvoiceCountOrderByAggregateInput;
    _avg?: InvoiceAvgOrderByAggregateInput;
    _max?: InvoiceMaxOrderByAggregateInput;
    _min?: InvoiceMinOrderByAggregateInput;
    _sum?: InvoiceSumOrderByAggregateInput;
  };

  export type InvoiceScalarWhereWithAggregatesInput = {
    AND?:
      | InvoiceScalarWhereWithAggregatesInput
      | InvoiceScalarWhereWithAggregatesInput[];
    OR?: InvoiceScalarWhereWithAggregatesInput[];
    NOT?:
      | InvoiceScalarWhereWithAggregatesInput
      | InvoiceScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"Invoice"> | string;
    invoiceNumber?: StringWithAggregatesFilter<"Invoice"> | string;
    pelangganId?: StringWithAggregatesFilter<"Invoice"> | string;
    issueDate?: DateTimeWithAggregatesFilter<"Invoice"> | Date | string;
    dueDate?: DateTimeWithAggregatesFilter<"Invoice"> | Date | string;
    status?:
      | EnumInvoiceStatusWithAggregatesFilter<"Invoice">
      | $Enums.InvoiceStatus;
    subtotal?: BigIntWithAggregatesFilter<"Invoice"> | bigint | number;
    taxAmount?: BigIntWithAggregatesFilter<"Invoice"> | bigint | number;
    discountAmount?: BigIntWithAggregatesFilter<"Invoice"> | bigint | number;
    totalAmount?: BigIntWithAggregatesFilter<"Invoice"> | bigint | number;
    paidAmount?: BigIntWithAggregatesFilter<"Invoice"> | bigint | number;
    notes?: StringNullableWithAggregatesFilter<"Invoice"> | string | null;
    terms?: StringNullableWithAggregatesFilter<"Invoice"> | string | null;
    sentAt?:
      | DateTimeNullableWithAggregatesFilter<"Invoice">
      | Date
      | string
      | null;
    paidAt?:
      | DateTimeNullableWithAggregatesFilter<"Invoice">
      | Date
      | string
      | null;
    createdBy?: StringNullableWithAggregatesFilter<"Invoice"> | string | null;
    createdAt?: DateTimeWithAggregatesFilter<"Invoice"> | Date | string;
    updatedAt?: DateTimeWithAggregatesFilter<"Invoice"> | Date | string;
    siteId?: StringNullableWithAggregatesFilter<"Invoice"> | string | null;
    tenantId?: StringNullableWithAggregatesFilter<"Invoice"> | string | null;
  };

  export type BillingScheduleWhereInput = {
    AND?: BillingScheduleWhereInput | BillingScheduleWhereInput[];
    OR?: BillingScheduleWhereInput[];
    NOT?: BillingScheduleWhereInput | BillingScheduleWhereInput[];
    id?: StringFilter<"BillingSchedule"> | string;
    dedupeKey?: StringFilter<"BillingSchedule"> | string;
    jobType?:
      | EnumBillingScheduleJobTypeFilter<"BillingSchedule">
      | $Enums.BillingScheduleJobType;
    invoiceId?: StringNullableFilter<"BillingSchedule"> | string | null;
    pelangganId?: StringNullableFilter<"BillingSchedule"> | string | null;
    runAt?: DateTimeFilter<"BillingSchedule"> | Date | string;
    status?:
      | EnumBillingScheduleStatusFilter<"BillingSchedule">
      | $Enums.BillingScheduleStatus;
    queueJobId?: StringNullableFilter<"BillingSchedule"> | string | null;
    payload?: JsonNullableFilter<"BillingSchedule">;
    version?: IntFilter<"BillingSchedule"> | number;
    attemptCount?: IntFilter<"BillingSchedule"> | number;
    queuedAt?: DateTimeNullableFilter<"BillingSchedule"> | Date | string | null;
    processingAt?:
      | DateTimeNullableFilter<"BillingSchedule">
      | Date
      | string
      | null;
    completedAt?:
      | DateTimeNullableFilter<"BillingSchedule">
      | Date
      | string
      | null;
    cancelledAt?:
      | DateTimeNullableFilter<"BillingSchedule">
      | Date
      | string
      | null;
    failedAt?: DateTimeNullableFilter<"BillingSchedule"> | Date | string | null;
    lastAttemptAt?:
      | DateTimeNullableFilter<"BillingSchedule">
      | Date
      | string
      | null;
    lastError?: StringNullableFilter<"BillingSchedule"> | string | null;
    createdAt?: DateTimeFilter<"BillingSchedule"> | Date | string;
    updatedAt?: DateTimeFilter<"BillingSchedule"> | Date | string;
    tenantId?: StringNullableFilter<"BillingSchedule"> | string | null;
    invoice?: XOR<
      InvoiceNullableScalarRelationFilter,
      InvoiceWhereInput
    > | null;
  };

  export type BillingScheduleOrderByWithRelationInput = {
    id?: SortOrder;
    dedupeKey?: SortOrder;
    jobType?: SortOrder;
    invoiceId?: SortOrderInput | SortOrder;
    pelangganId?: SortOrderInput | SortOrder;
    runAt?: SortOrder;
    status?: SortOrder;
    queueJobId?: SortOrderInput | SortOrder;
    payload?: SortOrderInput | SortOrder;
    version?: SortOrder;
    attemptCount?: SortOrder;
    queuedAt?: SortOrderInput | SortOrder;
    processingAt?: SortOrderInput | SortOrder;
    completedAt?: SortOrderInput | SortOrder;
    cancelledAt?: SortOrderInput | SortOrder;
    failedAt?: SortOrderInput | SortOrder;
    lastAttemptAt?: SortOrderInput | SortOrder;
    lastError?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    invoice?: InvoiceOrderByWithRelationInput;
  };

  export type BillingScheduleWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      dedupeKey?: string;
      AND?: BillingScheduleWhereInput | BillingScheduleWhereInput[];
      OR?: BillingScheduleWhereInput[];
      NOT?: BillingScheduleWhereInput | BillingScheduleWhereInput[];
      jobType?:
        | EnumBillingScheduleJobTypeFilter<"BillingSchedule">
        | $Enums.BillingScheduleJobType;
      invoiceId?: StringNullableFilter<"BillingSchedule"> | string | null;
      pelangganId?: StringNullableFilter<"BillingSchedule"> | string | null;
      runAt?: DateTimeFilter<"BillingSchedule"> | Date | string;
      status?:
        | EnumBillingScheduleStatusFilter<"BillingSchedule">
        | $Enums.BillingScheduleStatus;
      queueJobId?: StringNullableFilter<"BillingSchedule"> | string | null;
      payload?: JsonNullableFilter<"BillingSchedule">;
      version?: IntFilter<"BillingSchedule"> | number;
      attemptCount?: IntFilter<"BillingSchedule"> | number;
      queuedAt?:
        | DateTimeNullableFilter<"BillingSchedule">
        | Date
        | string
        | null;
      processingAt?:
        | DateTimeNullableFilter<"BillingSchedule">
        | Date
        | string
        | null;
      completedAt?:
        | DateTimeNullableFilter<"BillingSchedule">
        | Date
        | string
        | null;
      cancelledAt?:
        | DateTimeNullableFilter<"BillingSchedule">
        | Date
        | string
        | null;
      failedAt?:
        | DateTimeNullableFilter<"BillingSchedule">
        | Date
        | string
        | null;
      lastAttemptAt?:
        | DateTimeNullableFilter<"BillingSchedule">
        | Date
        | string
        | null;
      lastError?: StringNullableFilter<"BillingSchedule"> | string | null;
      createdAt?: DateTimeFilter<"BillingSchedule"> | Date | string;
      updatedAt?: DateTimeFilter<"BillingSchedule"> | Date | string;
      tenantId?: StringNullableFilter<"BillingSchedule"> | string | null;
      invoice?: XOR<
        InvoiceNullableScalarRelationFilter,
        InvoiceWhereInput
      > | null;
    },
    "id" | "dedupeKey"
  >;

  export type BillingScheduleOrderByWithAggregationInput = {
    id?: SortOrder;
    dedupeKey?: SortOrder;
    jobType?: SortOrder;
    invoiceId?: SortOrderInput | SortOrder;
    pelangganId?: SortOrderInput | SortOrder;
    runAt?: SortOrder;
    status?: SortOrder;
    queueJobId?: SortOrderInput | SortOrder;
    payload?: SortOrderInput | SortOrder;
    version?: SortOrder;
    attemptCount?: SortOrder;
    queuedAt?: SortOrderInput | SortOrder;
    processingAt?: SortOrderInput | SortOrder;
    completedAt?: SortOrderInput | SortOrder;
    cancelledAt?: SortOrderInput | SortOrder;
    failedAt?: SortOrderInput | SortOrder;
    lastAttemptAt?: SortOrderInput | SortOrder;
    lastError?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    _count?: BillingScheduleCountOrderByAggregateInput;
    _avg?: BillingScheduleAvgOrderByAggregateInput;
    _max?: BillingScheduleMaxOrderByAggregateInput;
    _min?: BillingScheduleMinOrderByAggregateInput;
    _sum?: BillingScheduleSumOrderByAggregateInput;
  };

  export type BillingScheduleScalarWhereWithAggregatesInput = {
    AND?:
      | BillingScheduleScalarWhereWithAggregatesInput
      | BillingScheduleScalarWhereWithAggregatesInput[];
    OR?: BillingScheduleScalarWhereWithAggregatesInput[];
    NOT?:
      | BillingScheduleScalarWhereWithAggregatesInput
      | BillingScheduleScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"BillingSchedule"> | string;
    dedupeKey?: StringWithAggregatesFilter<"BillingSchedule"> | string;
    jobType?:
      | EnumBillingScheduleJobTypeWithAggregatesFilter<"BillingSchedule">
      | $Enums.BillingScheduleJobType;
    invoiceId?:
      | StringNullableWithAggregatesFilter<"BillingSchedule">
      | string
      | null;
    pelangganId?:
      | StringNullableWithAggregatesFilter<"BillingSchedule">
      | string
      | null;
    runAt?: DateTimeWithAggregatesFilter<"BillingSchedule"> | Date | string;
    status?:
      | EnumBillingScheduleStatusWithAggregatesFilter<"BillingSchedule">
      | $Enums.BillingScheduleStatus;
    queueJobId?:
      | StringNullableWithAggregatesFilter<"BillingSchedule">
      | string
      | null;
    payload?: JsonNullableWithAggregatesFilter<"BillingSchedule">;
    version?: IntWithAggregatesFilter<"BillingSchedule"> | number;
    attemptCount?: IntWithAggregatesFilter<"BillingSchedule"> | number;
    queuedAt?:
      | DateTimeNullableWithAggregatesFilter<"BillingSchedule">
      | Date
      | string
      | null;
    processingAt?:
      | DateTimeNullableWithAggregatesFilter<"BillingSchedule">
      | Date
      | string
      | null;
    completedAt?:
      | DateTimeNullableWithAggregatesFilter<"BillingSchedule">
      | Date
      | string
      | null;
    cancelledAt?:
      | DateTimeNullableWithAggregatesFilter<"BillingSchedule">
      | Date
      | string
      | null;
    failedAt?:
      | DateTimeNullableWithAggregatesFilter<"BillingSchedule">
      | Date
      | string
      | null;
    lastAttemptAt?:
      | DateTimeNullableWithAggregatesFilter<"BillingSchedule">
      | Date
      | string
      | null;
    lastError?:
      | StringNullableWithAggregatesFilter<"BillingSchedule">
      | string
      | null;
    createdAt?: DateTimeWithAggregatesFilter<"BillingSchedule"> | Date | string;
    updatedAt?: DateTimeWithAggregatesFilter<"BillingSchedule"> | Date | string;
    tenantId?:
      | StringNullableWithAggregatesFilter<"BillingSchedule">
      | string
      | null;
  };

  export type InvoiceItemWhereInput = {
    AND?: InvoiceItemWhereInput | InvoiceItemWhereInput[];
    OR?: InvoiceItemWhereInput[];
    NOT?: InvoiceItemWhereInput | InvoiceItemWhereInput[];
    id?: StringFilter<"InvoiceItem"> | string;
    invoiceId?: StringFilter<"InvoiceItem"> | string;
    description?: StringFilter<"InvoiceItem"> | string;
    quantity?: IntFilter<"InvoiceItem"> | number;
    unitPrice?: BigIntFilter<"InvoiceItem"> | bigint | number;
    totalPrice?: BigIntFilter<"InvoiceItem"> | bigint | number;
    itemType?: EnumItemTypeFilter<"InvoiceItem"> | $Enums.ItemType;
    tenantId?: StringNullableFilter<"InvoiceItem"> | string | null;
    invoice?: XOR<InvoiceScalarRelationFilter, InvoiceWhereInput>;
  };

  export type InvoiceItemOrderByWithRelationInput = {
    id?: SortOrder;
    invoiceId?: SortOrder;
    description?: SortOrder;
    quantity?: SortOrder;
    unitPrice?: SortOrder;
    totalPrice?: SortOrder;
    itemType?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    invoice?: InvoiceOrderByWithRelationInput;
  };

  export type InvoiceItemWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      AND?: InvoiceItemWhereInput | InvoiceItemWhereInput[];
      OR?: InvoiceItemWhereInput[];
      NOT?: InvoiceItemWhereInput | InvoiceItemWhereInput[];
      invoiceId?: StringFilter<"InvoiceItem"> | string;
      description?: StringFilter<"InvoiceItem"> | string;
      quantity?: IntFilter<"InvoiceItem"> | number;
      unitPrice?: BigIntFilter<"InvoiceItem"> | bigint | number;
      totalPrice?: BigIntFilter<"InvoiceItem"> | bigint | number;
      itemType?: EnumItemTypeFilter<"InvoiceItem"> | $Enums.ItemType;
      tenantId?: StringNullableFilter<"InvoiceItem"> | string | null;
      invoice?: XOR<InvoiceScalarRelationFilter, InvoiceWhereInput>;
    },
    "id"
  >;

  export type InvoiceItemOrderByWithAggregationInput = {
    id?: SortOrder;
    invoiceId?: SortOrder;
    description?: SortOrder;
    quantity?: SortOrder;
    unitPrice?: SortOrder;
    totalPrice?: SortOrder;
    itemType?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    _count?: InvoiceItemCountOrderByAggregateInput;
    _avg?: InvoiceItemAvgOrderByAggregateInput;
    _max?: InvoiceItemMaxOrderByAggregateInput;
    _min?: InvoiceItemMinOrderByAggregateInput;
    _sum?: InvoiceItemSumOrderByAggregateInput;
  };

  export type InvoiceItemScalarWhereWithAggregatesInput = {
    AND?:
      | InvoiceItemScalarWhereWithAggregatesInput
      | InvoiceItemScalarWhereWithAggregatesInput[];
    OR?: InvoiceItemScalarWhereWithAggregatesInput[];
    NOT?:
      | InvoiceItemScalarWhereWithAggregatesInput
      | InvoiceItemScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"InvoiceItem"> | string;
    invoiceId?: StringWithAggregatesFilter<"InvoiceItem"> | string;
    description?: StringWithAggregatesFilter<"InvoiceItem"> | string;
    quantity?: IntWithAggregatesFilter<"InvoiceItem"> | number;
    unitPrice?: BigIntWithAggregatesFilter<"InvoiceItem"> | bigint | number;
    totalPrice?: BigIntWithAggregatesFilter<"InvoiceItem"> | bigint | number;
    itemType?:
      | EnumItemTypeWithAggregatesFilter<"InvoiceItem">
      | $Enums.ItemType;
    tenantId?:
      | StringNullableWithAggregatesFilter<"InvoiceItem">
      | string
      | null;
  };

  export type PaymentWhereInput = {
    AND?: PaymentWhereInput | PaymentWhereInput[];
    OR?: PaymentWhereInput[];
    NOT?: PaymentWhereInput | PaymentWhereInput[];
    id?: StringFilter<"Payment"> | string;
    invoiceId?: StringNullableFilter<"Payment"> | string | null;
    pelangganId?: StringFilter<"Payment"> | string;
    amount?: BigIntFilter<"Payment"> | bigint | number;
    paymentDate?: DateTimeFilter<"Payment"> | Date | string;
    paymentMethod?: EnumPaymentMethodFilter<"Payment"> | $Enums.PaymentMethod;
    reference?: StringNullableFilter<"Payment"> | string | null;
    notes?: StringNullableFilter<"Payment"> | string | null;
    verifiedBy?: StringNullableFilter<"Payment"> | string | null;
    verifiedAt?: DateTimeNullableFilter<"Payment"> | Date | string | null;
    createdAt?: DateTimeFilter<"Payment"> | Date | string;
    updatedAt?: DateTimeFilter<"Payment"> | Date | string;
    accountId?: StringNullableFilter<"Payment"> | string | null;
    gatewayStatus?:
      | EnumGatewayPaymentStatusNullableFilter<"Payment">
      | $Enums.GatewayPaymentStatus
      | null;
    gatewayProvider?: StringNullableFilter<"Payment"> | string | null;
    transactionId?: StringNullableFilter<"Payment"> | string | null;
    paymentUrl?: StringNullableFilter<"Payment"> | string | null;
    expiresAt?: DateTimeNullableFilter<"Payment"> | Date | string | null;
    unmatchedMutationId?: StringNullableFilter<"Payment"> | string | null;
    receiptUrl?: StringNullableFilter<"Payment"> | string | null;
    tenantId?: StringNullableFilter<"Payment"> | string | null;
    invoice?: XOR<
      InvoiceNullableScalarRelationFilter,
      InvoiceWhereInput
    > | null;
    unmatchedMutation?: XOR<
      UnmatchedMutationNullableScalarRelationFilter,
      UnmatchedMutationWhereInput
    > | null;
  };

  export type PaymentOrderByWithRelationInput = {
    id?: SortOrder;
    invoiceId?: SortOrderInput | SortOrder;
    pelangganId?: SortOrder;
    amount?: SortOrder;
    paymentDate?: SortOrder;
    paymentMethod?: SortOrder;
    reference?: SortOrderInput | SortOrder;
    notes?: SortOrderInput | SortOrder;
    verifiedBy?: SortOrderInput | SortOrder;
    verifiedAt?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    accountId?: SortOrderInput | SortOrder;
    gatewayStatus?: SortOrderInput | SortOrder;
    gatewayProvider?: SortOrderInput | SortOrder;
    transactionId?: SortOrderInput | SortOrder;
    paymentUrl?: SortOrderInput | SortOrder;
    expiresAt?: SortOrderInput | SortOrder;
    unmatchedMutationId?: SortOrderInput | SortOrder;
    receiptUrl?: SortOrderInput | SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    invoice?: InvoiceOrderByWithRelationInput;
    unmatchedMutation?: UnmatchedMutationOrderByWithRelationInput;
  };

  export type PaymentWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      unmatchedMutationId?: string;
      AND?: PaymentWhereInput | PaymentWhereInput[];
      OR?: PaymentWhereInput[];
      NOT?: PaymentWhereInput | PaymentWhereInput[];
      invoiceId?: StringNullableFilter<"Payment"> | string | null;
      pelangganId?: StringFilter<"Payment"> | string;
      amount?: BigIntFilter<"Payment"> | bigint | number;
      paymentDate?: DateTimeFilter<"Payment"> | Date | string;
      paymentMethod?: EnumPaymentMethodFilter<"Payment"> | $Enums.PaymentMethod;
      reference?: StringNullableFilter<"Payment"> | string | null;
      notes?: StringNullableFilter<"Payment"> | string | null;
      verifiedBy?: StringNullableFilter<"Payment"> | string | null;
      verifiedAt?: DateTimeNullableFilter<"Payment"> | Date | string | null;
      createdAt?: DateTimeFilter<"Payment"> | Date | string;
      updatedAt?: DateTimeFilter<"Payment"> | Date | string;
      accountId?: StringNullableFilter<"Payment"> | string | null;
      gatewayStatus?:
        | EnumGatewayPaymentStatusNullableFilter<"Payment">
        | $Enums.GatewayPaymentStatus
        | null;
      gatewayProvider?: StringNullableFilter<"Payment"> | string | null;
      transactionId?: StringNullableFilter<"Payment"> | string | null;
      paymentUrl?: StringNullableFilter<"Payment"> | string | null;
      expiresAt?: DateTimeNullableFilter<"Payment"> | Date | string | null;
      receiptUrl?: StringNullableFilter<"Payment"> | string | null;
      tenantId?: StringNullableFilter<"Payment"> | string | null;
      invoice?: XOR<
        InvoiceNullableScalarRelationFilter,
        InvoiceWhereInput
      > | null;
      unmatchedMutation?: XOR<
        UnmatchedMutationNullableScalarRelationFilter,
        UnmatchedMutationWhereInput
      > | null;
    },
    "id" | "unmatchedMutationId"
  >;

  export type PaymentOrderByWithAggregationInput = {
    id?: SortOrder;
    invoiceId?: SortOrderInput | SortOrder;
    pelangganId?: SortOrder;
    amount?: SortOrder;
    paymentDate?: SortOrder;
    paymentMethod?: SortOrder;
    reference?: SortOrderInput | SortOrder;
    notes?: SortOrderInput | SortOrder;
    verifiedBy?: SortOrderInput | SortOrder;
    verifiedAt?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    accountId?: SortOrderInput | SortOrder;
    gatewayStatus?: SortOrderInput | SortOrder;
    gatewayProvider?: SortOrderInput | SortOrder;
    transactionId?: SortOrderInput | SortOrder;
    paymentUrl?: SortOrderInput | SortOrder;
    expiresAt?: SortOrderInput | SortOrder;
    unmatchedMutationId?: SortOrderInput | SortOrder;
    receiptUrl?: SortOrderInput | SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    _count?: PaymentCountOrderByAggregateInput;
    _avg?: PaymentAvgOrderByAggregateInput;
    _max?: PaymentMaxOrderByAggregateInput;
    _min?: PaymentMinOrderByAggregateInput;
    _sum?: PaymentSumOrderByAggregateInput;
  };

  export type PaymentScalarWhereWithAggregatesInput = {
    AND?:
      | PaymentScalarWhereWithAggregatesInput
      | PaymentScalarWhereWithAggregatesInput[];
    OR?: PaymentScalarWhereWithAggregatesInput[];
    NOT?:
      | PaymentScalarWhereWithAggregatesInput
      | PaymentScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"Payment"> | string;
    invoiceId?: StringNullableWithAggregatesFilter<"Payment"> | string | null;
    pelangganId?: StringWithAggregatesFilter<"Payment"> | string;
    amount?: BigIntWithAggregatesFilter<"Payment"> | bigint | number;
    paymentDate?: DateTimeWithAggregatesFilter<"Payment"> | Date | string;
    paymentMethod?:
      | EnumPaymentMethodWithAggregatesFilter<"Payment">
      | $Enums.PaymentMethod;
    reference?: StringNullableWithAggregatesFilter<"Payment"> | string | null;
    notes?: StringNullableWithAggregatesFilter<"Payment"> | string | null;
    verifiedBy?: StringNullableWithAggregatesFilter<"Payment"> | string | null;
    verifiedAt?:
      | DateTimeNullableWithAggregatesFilter<"Payment">
      | Date
      | string
      | null;
    createdAt?: DateTimeWithAggregatesFilter<"Payment"> | Date | string;
    updatedAt?: DateTimeWithAggregatesFilter<"Payment"> | Date | string;
    accountId?: StringNullableWithAggregatesFilter<"Payment"> | string | null;
    gatewayStatus?:
      | EnumGatewayPaymentStatusNullableWithAggregatesFilter<"Payment">
      | $Enums.GatewayPaymentStatus
      | null;
    gatewayProvider?:
      | StringNullableWithAggregatesFilter<"Payment">
      | string
      | null;
    transactionId?:
      | StringNullableWithAggregatesFilter<"Payment">
      | string
      | null;
    paymentUrl?: StringNullableWithAggregatesFilter<"Payment"> | string | null;
    expiresAt?:
      | DateTimeNullableWithAggregatesFilter<"Payment">
      | Date
      | string
      | null;
    unmatchedMutationId?:
      | StringNullableWithAggregatesFilter<"Payment">
      | string
      | null;
    receiptUrl?: StringNullableWithAggregatesFilter<"Payment"> | string | null;
    tenantId?: StringNullableWithAggregatesFilter<"Payment"> | string | null;
  };

  export type PaymentGatewayConfigWhereInput = {
    AND?: PaymentGatewayConfigWhereInput | PaymentGatewayConfigWhereInput[];
    OR?: PaymentGatewayConfigWhereInput[];
    NOT?: PaymentGatewayConfigWhereInput | PaymentGatewayConfigWhereInput[];
    id?: StringFilter<"PaymentGatewayConfig"> | string;
    provider?: StringFilter<"PaymentGatewayConfig"> | string;
    providerName?: StringFilter<"PaymentGatewayConfig"> | string;
    isEnabled?: BoolFilter<"PaymentGatewayConfig"> | boolean;
    isProduction?: BoolFilter<"PaymentGatewayConfig"> | boolean;
    priority?: IntFilter<"PaymentGatewayConfig"> | number;
    apiKey?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
    apiSecret?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
    clientKey?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
    merchantId?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
    webhookUrl?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
    callbackUrl?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
    settings?: JsonNullableFilter<"PaymentGatewayConfig">;
    lastTestedAt?:
      | DateTimeNullableFilter<"PaymentGatewayConfig">
      | Date
      | string
      | null;
    testStatus?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
    createdAt?: DateTimeFilter<"PaymentGatewayConfig"> | Date | string;
    updatedAt?: DateTimeFilter<"PaymentGatewayConfig"> | Date | string;
    createdBy?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
    tenantId?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
  };

  export type PaymentGatewayConfigOrderByWithRelationInput = {
    id?: SortOrder;
    provider?: SortOrder;
    providerName?: SortOrder;
    isEnabled?: SortOrder;
    isProduction?: SortOrder;
    priority?: SortOrder;
    apiKey?: SortOrderInput | SortOrder;
    apiSecret?: SortOrderInput | SortOrder;
    clientKey?: SortOrderInput | SortOrder;
    merchantId?: SortOrderInput | SortOrder;
    webhookUrl?: SortOrderInput | SortOrder;
    callbackUrl?: SortOrderInput | SortOrder;
    settings?: SortOrderInput | SortOrder;
    lastTestedAt?: SortOrderInput | SortOrder;
    testStatus?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    createdBy?: SortOrderInput | SortOrder;
    tenantId?: SortOrderInput | SortOrder;
  };

  export type PaymentGatewayConfigWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      provider_tenantId?: PaymentGatewayConfigProviderTenantIdCompoundUniqueInput;
      AND?: PaymentGatewayConfigWhereInput | PaymentGatewayConfigWhereInput[];
      OR?: PaymentGatewayConfigWhereInput[];
      NOT?: PaymentGatewayConfigWhereInput | PaymentGatewayConfigWhereInput[];
      provider?: StringFilter<"PaymentGatewayConfig"> | string;
      providerName?: StringFilter<"PaymentGatewayConfig"> | string;
      isEnabled?: BoolFilter<"PaymentGatewayConfig"> | boolean;
      isProduction?: BoolFilter<"PaymentGatewayConfig"> | boolean;
      priority?: IntFilter<"PaymentGatewayConfig"> | number;
      apiKey?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
      apiSecret?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
      clientKey?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
      merchantId?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
      webhookUrl?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
      callbackUrl?:
        | StringNullableFilter<"PaymentGatewayConfig">
        | string
        | null;
      settings?: JsonNullableFilter<"PaymentGatewayConfig">;
      lastTestedAt?:
        | DateTimeNullableFilter<"PaymentGatewayConfig">
        | Date
        | string
        | null;
      testStatus?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
      createdAt?: DateTimeFilter<"PaymentGatewayConfig"> | Date | string;
      updatedAt?: DateTimeFilter<"PaymentGatewayConfig"> | Date | string;
      createdBy?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
      tenantId?: StringNullableFilter<"PaymentGatewayConfig"> | string | null;
    },
    "id" | "provider_tenantId"
  >;

  export type PaymentGatewayConfigOrderByWithAggregationInput = {
    id?: SortOrder;
    provider?: SortOrder;
    providerName?: SortOrder;
    isEnabled?: SortOrder;
    isProduction?: SortOrder;
    priority?: SortOrder;
    apiKey?: SortOrderInput | SortOrder;
    apiSecret?: SortOrderInput | SortOrder;
    clientKey?: SortOrderInput | SortOrder;
    merchantId?: SortOrderInput | SortOrder;
    webhookUrl?: SortOrderInput | SortOrder;
    callbackUrl?: SortOrderInput | SortOrder;
    settings?: SortOrderInput | SortOrder;
    lastTestedAt?: SortOrderInput | SortOrder;
    testStatus?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    createdBy?: SortOrderInput | SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    _count?: PaymentGatewayConfigCountOrderByAggregateInput;
    _avg?: PaymentGatewayConfigAvgOrderByAggregateInput;
    _max?: PaymentGatewayConfigMaxOrderByAggregateInput;
    _min?: PaymentGatewayConfigMinOrderByAggregateInput;
    _sum?: PaymentGatewayConfigSumOrderByAggregateInput;
  };

  export type PaymentGatewayConfigScalarWhereWithAggregatesInput = {
    AND?:
      | PaymentGatewayConfigScalarWhereWithAggregatesInput
      | PaymentGatewayConfigScalarWhereWithAggregatesInput[];
    OR?: PaymentGatewayConfigScalarWhereWithAggregatesInput[];
    NOT?:
      | PaymentGatewayConfigScalarWhereWithAggregatesInput
      | PaymentGatewayConfigScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"PaymentGatewayConfig"> | string;
    provider?: StringWithAggregatesFilter<"PaymentGatewayConfig"> | string;
    providerName?: StringWithAggregatesFilter<"PaymentGatewayConfig"> | string;
    isEnabled?: BoolWithAggregatesFilter<"PaymentGatewayConfig"> | boolean;
    isProduction?: BoolWithAggregatesFilter<"PaymentGatewayConfig"> | boolean;
    priority?: IntWithAggregatesFilter<"PaymentGatewayConfig"> | number;
    apiKey?:
      | StringNullableWithAggregatesFilter<"PaymentGatewayConfig">
      | string
      | null;
    apiSecret?:
      | StringNullableWithAggregatesFilter<"PaymentGatewayConfig">
      | string
      | null;
    clientKey?:
      | StringNullableWithAggregatesFilter<"PaymentGatewayConfig">
      | string
      | null;
    merchantId?:
      | StringNullableWithAggregatesFilter<"PaymentGatewayConfig">
      | string
      | null;
    webhookUrl?:
      | StringNullableWithAggregatesFilter<"PaymentGatewayConfig">
      | string
      | null;
    callbackUrl?:
      | StringNullableWithAggregatesFilter<"PaymentGatewayConfig">
      | string
      | null;
    settings?: JsonNullableWithAggregatesFilter<"PaymentGatewayConfig">;
    lastTestedAt?:
      | DateTimeNullableWithAggregatesFilter<"PaymentGatewayConfig">
      | Date
      | string
      | null;
    testStatus?:
      | StringNullableWithAggregatesFilter<"PaymentGatewayConfig">
      | string
      | null;
    createdAt?:
      | DateTimeWithAggregatesFilter<"PaymentGatewayConfig">
      | Date
      | string;
    updatedAt?:
      | DateTimeWithAggregatesFilter<"PaymentGatewayConfig">
      | Date
      | string;
    createdBy?:
      | StringNullableWithAggregatesFilter<"PaymentGatewayConfig">
      | string
      | null;
    tenantId?:
      | StringNullableWithAggregatesFilter<"PaymentGatewayConfig">
      | string
      | null;
  };

  export type UnmatchedMutationWhereInput = {
    AND?: UnmatchedMutationWhereInput | UnmatchedMutationWhereInput[];
    OR?: UnmatchedMutationWhereInput[];
    NOT?: UnmatchedMutationWhereInput | UnmatchedMutationWhereInput[];
    id?: StringFilter<"UnmatchedMutation"> | string;
    provider?: StringFilter<"UnmatchedMutation"> | string;
    transactionId?: StringNullableFilter<"UnmatchedMutation"> | string | null;
    amount?:
      | DecimalFilter<"UnmatchedMutation">
      | Decimal
      | DecimalJsLike
      | number
      | string;
    description?: StringNullableFilter<"UnmatchedMutation"> | string | null;
    type?: StringNullableFilter<"UnmatchedMutation"> | string | null;
    date?: DateTimeFilter<"UnmatchedMutation"> | Date | string;
    bankId?: StringNullableFilter<"UnmatchedMutation"> | string | null;
    rawPayload?: JsonNullableFilter<"UnmatchedMutation">;
    status?:
      | EnumUnmatchedStatusFilter<"UnmatchedMutation">
      | $Enums.UnmatchedStatus;
    resolvedAt?:
      | DateTimeNullableFilter<"UnmatchedMutation">
      | Date
      | string
      | null;
    resolvedById?: StringNullableFilter<"UnmatchedMutation"> | string | null;
    matchedInvoiceId?:
      | StringNullableFilter<"UnmatchedMutation">
      | string
      | null;
    createdAt?: DateTimeFilter<"UnmatchedMutation"> | Date | string;
    updatedAt?: DateTimeFilter<"UnmatchedMutation"> | Date | string;
    tenantId?: StringNullableFilter<"UnmatchedMutation"> | string | null;
    payment?: XOR<
      PaymentNullableScalarRelationFilter,
      PaymentWhereInput
    > | null;
  };

  export type UnmatchedMutationOrderByWithRelationInput = {
    id?: SortOrder;
    provider?: SortOrder;
    transactionId?: SortOrderInput | SortOrder;
    amount?: SortOrder;
    description?: SortOrderInput | SortOrder;
    type?: SortOrderInput | SortOrder;
    date?: SortOrder;
    bankId?: SortOrderInput | SortOrder;
    rawPayload?: SortOrderInput | SortOrder;
    status?: SortOrder;
    resolvedAt?: SortOrderInput | SortOrder;
    resolvedById?: SortOrderInput | SortOrder;
    matchedInvoiceId?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    payment?: PaymentOrderByWithRelationInput;
  };

  export type UnmatchedMutationWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      transactionId?: string;
      AND?: UnmatchedMutationWhereInput | UnmatchedMutationWhereInput[];
      OR?: UnmatchedMutationWhereInput[];
      NOT?: UnmatchedMutationWhereInput | UnmatchedMutationWhereInput[];
      provider?: StringFilter<"UnmatchedMutation"> | string;
      amount?:
        | DecimalFilter<"UnmatchedMutation">
        | Decimal
        | DecimalJsLike
        | number
        | string;
      description?: StringNullableFilter<"UnmatchedMutation"> | string | null;
      type?: StringNullableFilter<"UnmatchedMutation"> | string | null;
      date?: DateTimeFilter<"UnmatchedMutation"> | Date | string;
      bankId?: StringNullableFilter<"UnmatchedMutation"> | string | null;
      rawPayload?: JsonNullableFilter<"UnmatchedMutation">;
      status?:
        | EnumUnmatchedStatusFilter<"UnmatchedMutation">
        | $Enums.UnmatchedStatus;
      resolvedAt?:
        | DateTimeNullableFilter<"UnmatchedMutation">
        | Date
        | string
        | null;
      resolvedById?: StringNullableFilter<"UnmatchedMutation"> | string | null;
      matchedInvoiceId?:
        | StringNullableFilter<"UnmatchedMutation">
        | string
        | null;
      createdAt?: DateTimeFilter<"UnmatchedMutation"> | Date | string;
      updatedAt?: DateTimeFilter<"UnmatchedMutation"> | Date | string;
      tenantId?: StringNullableFilter<"UnmatchedMutation"> | string | null;
      payment?: XOR<
        PaymentNullableScalarRelationFilter,
        PaymentWhereInput
      > | null;
    },
    "id" | "transactionId"
  >;

  export type UnmatchedMutationOrderByWithAggregationInput = {
    id?: SortOrder;
    provider?: SortOrder;
    transactionId?: SortOrderInput | SortOrder;
    amount?: SortOrder;
    description?: SortOrderInput | SortOrder;
    type?: SortOrderInput | SortOrder;
    date?: SortOrder;
    bankId?: SortOrderInput | SortOrder;
    rawPayload?: SortOrderInput | SortOrder;
    status?: SortOrder;
    resolvedAt?: SortOrderInput | SortOrder;
    resolvedById?: SortOrderInput | SortOrder;
    matchedInvoiceId?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    _count?: UnmatchedMutationCountOrderByAggregateInput;
    _avg?: UnmatchedMutationAvgOrderByAggregateInput;
    _max?: UnmatchedMutationMaxOrderByAggregateInput;
    _min?: UnmatchedMutationMinOrderByAggregateInput;
    _sum?: UnmatchedMutationSumOrderByAggregateInput;
  };

  export type UnmatchedMutationScalarWhereWithAggregatesInput = {
    AND?:
      | UnmatchedMutationScalarWhereWithAggregatesInput
      | UnmatchedMutationScalarWhereWithAggregatesInput[];
    OR?: UnmatchedMutationScalarWhereWithAggregatesInput[];
    NOT?:
      | UnmatchedMutationScalarWhereWithAggregatesInput
      | UnmatchedMutationScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"UnmatchedMutation"> | string;
    provider?: StringWithAggregatesFilter<"UnmatchedMutation"> | string;
    transactionId?:
      | StringNullableWithAggregatesFilter<"UnmatchedMutation">
      | string
      | null;
    amount?:
      | DecimalWithAggregatesFilter<"UnmatchedMutation">
      | Decimal
      | DecimalJsLike
      | number
      | string;
    description?:
      | StringNullableWithAggregatesFilter<"UnmatchedMutation">
      | string
      | null;
    type?:
      | StringNullableWithAggregatesFilter<"UnmatchedMutation">
      | string
      | null;
    date?: DateTimeWithAggregatesFilter<"UnmatchedMutation"> | Date | string;
    bankId?:
      | StringNullableWithAggregatesFilter<"UnmatchedMutation">
      | string
      | null;
    rawPayload?: JsonNullableWithAggregatesFilter<"UnmatchedMutation">;
    status?:
      | EnumUnmatchedStatusWithAggregatesFilter<"UnmatchedMutation">
      | $Enums.UnmatchedStatus;
    resolvedAt?:
      | DateTimeNullableWithAggregatesFilter<"UnmatchedMutation">
      | Date
      | string
      | null;
    resolvedById?:
      | StringNullableWithAggregatesFilter<"UnmatchedMutation">
      | string
      | null;
    matchedInvoiceId?:
      | StringNullableWithAggregatesFilter<"UnmatchedMutation">
      | string
      | null;
    createdAt?:
      | DateTimeWithAggregatesFilter<"UnmatchedMutation">
      | Date
      | string;
    updatedAt?:
      | DateTimeWithAggregatesFilter<"UnmatchedMutation">
      | Date
      | string;
    tenantId?:
      | StringNullableWithAggregatesFilter<"UnmatchedMutation">
      | string
      | null;
  };

  export type WebhookEventWhereInput = {
    AND?: WebhookEventWhereInput | WebhookEventWhereInput[];
    OR?: WebhookEventWhereInput[];
    NOT?: WebhookEventWhereInput | WebhookEventWhereInput[];
    id?: StringFilter<"WebhookEvent"> | string;
    idempotencyKey?: StringFilter<"WebhookEvent"> | string;
    provider?: StringFilter<"WebhookEvent"> | string;
    payload?: JsonFilter<"WebhookEvent">;
    signature?: StringNullableFilter<"WebhookEvent"> | string | null;
    rawBody?: StringNullableFilter<"WebhookEvent"> | string | null;
    status?:
      | EnumWebhookEventStatusFilter<"WebhookEvent">
      | $Enums.WebhookEventStatus;
    orderId?: StringNullableFilter<"WebhookEvent"> | string | null;
    transactionId?: StringNullableFilter<"WebhookEvent"> | string | null;
    processedAt?: DateTimeNullableFilter<"WebhookEvent"> | Date | string | null;
    error?: StringNullableFilter<"WebhookEvent"> | string | null;
    tenantId?: StringNullableFilter<"WebhookEvent"> | string | null;
    createdAt?: DateTimeFilter<"WebhookEvent"> | Date | string;
    updatedAt?: DateTimeFilter<"WebhookEvent"> | Date | string;
  };

  export type WebhookEventOrderByWithRelationInput = {
    id?: SortOrder;
    idempotencyKey?: SortOrder;
    provider?: SortOrder;
    payload?: SortOrder;
    signature?: SortOrderInput | SortOrder;
    rawBody?: SortOrderInput | SortOrder;
    status?: SortOrder;
    orderId?: SortOrderInput | SortOrder;
    transactionId?: SortOrderInput | SortOrder;
    processedAt?: SortOrderInput | SortOrder;
    error?: SortOrderInput | SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type WebhookEventWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      idempotencyKey?: string;
      AND?: WebhookEventWhereInput | WebhookEventWhereInput[];
      OR?: WebhookEventWhereInput[];
      NOT?: WebhookEventWhereInput | WebhookEventWhereInput[];
      provider?: StringFilter<"WebhookEvent"> | string;
      payload?: JsonFilter<"WebhookEvent">;
      signature?: StringNullableFilter<"WebhookEvent"> | string | null;
      rawBody?: StringNullableFilter<"WebhookEvent"> | string | null;
      status?:
        | EnumWebhookEventStatusFilter<"WebhookEvent">
        | $Enums.WebhookEventStatus;
      orderId?: StringNullableFilter<"WebhookEvent"> | string | null;
      transactionId?: StringNullableFilter<"WebhookEvent"> | string | null;
      processedAt?:
        | DateTimeNullableFilter<"WebhookEvent">
        | Date
        | string
        | null;
      error?: StringNullableFilter<"WebhookEvent"> | string | null;
      tenantId?: StringNullableFilter<"WebhookEvent"> | string | null;
      createdAt?: DateTimeFilter<"WebhookEvent"> | Date | string;
      updatedAt?: DateTimeFilter<"WebhookEvent"> | Date | string;
    },
    "id" | "idempotencyKey"
  >;

  export type WebhookEventOrderByWithAggregationInput = {
    id?: SortOrder;
    idempotencyKey?: SortOrder;
    provider?: SortOrder;
    payload?: SortOrder;
    signature?: SortOrderInput | SortOrder;
    rawBody?: SortOrderInput | SortOrder;
    status?: SortOrder;
    orderId?: SortOrderInput | SortOrder;
    transactionId?: SortOrderInput | SortOrder;
    processedAt?: SortOrderInput | SortOrder;
    error?: SortOrderInput | SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    _count?: WebhookEventCountOrderByAggregateInput;
    _max?: WebhookEventMaxOrderByAggregateInput;
    _min?: WebhookEventMinOrderByAggregateInput;
  };

  export type WebhookEventScalarWhereWithAggregatesInput = {
    AND?:
      | WebhookEventScalarWhereWithAggregatesInput
      | WebhookEventScalarWhereWithAggregatesInput[];
    OR?: WebhookEventScalarWhereWithAggregatesInput[];
    NOT?:
      | WebhookEventScalarWhereWithAggregatesInput
      | WebhookEventScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"WebhookEvent"> | string;
    idempotencyKey?: StringWithAggregatesFilter<"WebhookEvent"> | string;
    provider?: StringWithAggregatesFilter<"WebhookEvent"> | string;
    payload?: JsonWithAggregatesFilter<"WebhookEvent">;
    signature?:
      | StringNullableWithAggregatesFilter<"WebhookEvent">
      | string
      | null;
    rawBody?:
      | StringNullableWithAggregatesFilter<"WebhookEvent">
      | string
      | null;
    status?:
      | EnumWebhookEventStatusWithAggregatesFilter<"WebhookEvent">
      | $Enums.WebhookEventStatus;
    orderId?:
      | StringNullableWithAggregatesFilter<"WebhookEvent">
      | string
      | null;
    transactionId?:
      | StringNullableWithAggregatesFilter<"WebhookEvent">
      | string
      | null;
    processedAt?:
      | DateTimeNullableWithAggregatesFilter<"WebhookEvent">
      | Date
      | string
      | null;
    error?: StringNullableWithAggregatesFilter<"WebhookEvent"> | string | null;
    tenantId?:
      | StringNullableWithAggregatesFilter<"WebhookEvent">
      | string
      | null;
    createdAt?: DateTimeWithAggregatesFilter<"WebhookEvent"> | Date | string;
    updatedAt?: DateTimeWithAggregatesFilter<"WebhookEvent"> | Date | string;
  };

  export type InvoiceCreateInput = {
    id: string;
    invoiceNumber: string;
    pelangganId: string;
    issueDate?: Date | string;
    dueDate: Date | string;
    status?: $Enums.InvoiceStatus;
    subtotal?: bigint | number;
    taxAmount?: bigint | number;
    discountAmount?: bigint | number;
    totalAmount?: bigint | number;
    paidAmount?: bigint | number;
    notes?: string | null;
    terms?: string | null;
    sentAt?: Date | string | null;
    paidAt?: Date | string | null;
    createdBy?: string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    siteId?: string | null;
    tenantId?: string | null;
    invoiceItem?: InvoiceItemCreateNestedManyWithoutInvoiceInput;
    payment?: PaymentCreateNestedManyWithoutInvoiceInput;
    billingSchedules?: BillingScheduleCreateNestedManyWithoutInvoiceInput;
  };

  export type InvoiceUncheckedCreateInput = {
    id: string;
    invoiceNumber: string;
    pelangganId: string;
    issueDate?: Date | string;
    dueDate: Date | string;
    status?: $Enums.InvoiceStatus;
    subtotal?: bigint | number;
    taxAmount?: bigint | number;
    discountAmount?: bigint | number;
    totalAmount?: bigint | number;
    paidAmount?: bigint | number;
    notes?: string | null;
    terms?: string | null;
    sentAt?: Date | string | null;
    paidAt?: Date | string | null;
    createdBy?: string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    siteId?: string | null;
    tenantId?: string | null;
    invoiceItem?: InvoiceItemUncheckedCreateNestedManyWithoutInvoiceInput;
    payment?: PaymentUncheckedCreateNestedManyWithoutInvoiceInput;
    billingSchedules?: BillingScheduleUncheckedCreateNestedManyWithoutInvoiceInput;
  };

  export type InvoiceUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    invoiceNumber?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus;
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number;
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    terms?: NullableStringFieldUpdateOperationsInput | string | null;
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    invoiceItem?: InvoiceItemUpdateManyWithoutInvoiceNestedInput;
    payment?: PaymentUpdateManyWithoutInvoiceNestedInput;
    billingSchedules?: BillingScheduleUpdateManyWithoutInvoiceNestedInput;
  };

  export type InvoiceUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    invoiceNumber?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus;
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number;
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    terms?: NullableStringFieldUpdateOperationsInput | string | null;
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    invoiceItem?: InvoiceItemUncheckedUpdateManyWithoutInvoiceNestedInput;
    payment?: PaymentUncheckedUpdateManyWithoutInvoiceNestedInput;
    billingSchedules?: BillingScheduleUncheckedUpdateManyWithoutInvoiceNestedInput;
  };

  export type InvoiceCreateManyInput = {
    id: string;
    invoiceNumber: string;
    pelangganId: string;
    issueDate?: Date | string;
    dueDate: Date | string;
    status?: $Enums.InvoiceStatus;
    subtotal?: bigint | number;
    taxAmount?: bigint | number;
    discountAmount?: bigint | number;
    totalAmount?: bigint | number;
    paidAmount?: bigint | number;
    notes?: string | null;
    terms?: string | null;
    sentAt?: Date | string | null;
    paidAt?: Date | string | null;
    createdBy?: string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    siteId?: string | null;
    tenantId?: string | null;
  };

  export type InvoiceUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    invoiceNumber?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus;
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number;
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    terms?: NullableStringFieldUpdateOperationsInput | string | null;
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type InvoiceUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    invoiceNumber?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus;
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number;
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    terms?: NullableStringFieldUpdateOperationsInput | string | null;
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type BillingScheduleCreateInput = {
    id?: string;
    dedupeKey: string;
    jobType: $Enums.BillingScheduleJobType;
    pelangganId?: string | null;
    runAt: Date | string;
    status?: $Enums.BillingScheduleStatus;
    queueJobId?: string | null;
    payload?: NullableJsonNullValueInput | InputJsonValue;
    version?: number;
    attemptCount?: number;
    queuedAt?: Date | string | null;
    processingAt?: Date | string | null;
    completedAt?: Date | string | null;
    cancelledAt?: Date | string | null;
    failedAt?: Date | string | null;
    lastAttemptAt?: Date | string | null;
    lastError?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    invoice?: InvoiceCreateNestedOneWithoutBillingSchedulesInput;
  };

  export type BillingScheduleUncheckedCreateInput = {
    id?: string;
    dedupeKey: string;
    jobType: $Enums.BillingScheduleJobType;
    invoiceId?: string | null;
    pelangganId?: string | null;
    runAt: Date | string;
    status?: $Enums.BillingScheduleStatus;
    queueJobId?: string | null;
    payload?: NullableJsonNullValueInput | InputJsonValue;
    version?: number;
    attemptCount?: number;
    queuedAt?: Date | string | null;
    processingAt?: Date | string | null;
    completedAt?: Date | string | null;
    cancelledAt?: Date | string | null;
    failedAt?: Date | string | null;
    lastAttemptAt?: Date | string | null;
    lastError?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
  };

  export type BillingScheduleUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    dedupeKey?: StringFieldUpdateOperationsInput | string;
    jobType?:
      | EnumBillingScheduleJobTypeFieldUpdateOperationsInput
      | $Enums.BillingScheduleJobType;
    pelangganId?: NullableStringFieldUpdateOperationsInput | string | null;
    runAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?:
      | EnumBillingScheduleStatusFieldUpdateOperationsInput
      | $Enums.BillingScheduleStatus;
    queueJobId?: NullableStringFieldUpdateOperationsInput | string | null;
    payload?: NullableJsonNullValueInput | InputJsonValue;
    version?: IntFieldUpdateOperationsInput | number;
    attemptCount?: IntFieldUpdateOperationsInput | number;
    queuedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    processingAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    completedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    cancelledAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    failedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastAttemptAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastError?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    invoice?: InvoiceUpdateOneWithoutBillingSchedulesNestedInput;
  };

  export type BillingScheduleUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    dedupeKey?: StringFieldUpdateOperationsInput | string;
    jobType?:
      | EnumBillingScheduleJobTypeFieldUpdateOperationsInput
      | $Enums.BillingScheduleJobType;
    invoiceId?: NullableStringFieldUpdateOperationsInput | string | null;
    pelangganId?: NullableStringFieldUpdateOperationsInput | string | null;
    runAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?:
      | EnumBillingScheduleStatusFieldUpdateOperationsInput
      | $Enums.BillingScheduleStatus;
    queueJobId?: NullableStringFieldUpdateOperationsInput | string | null;
    payload?: NullableJsonNullValueInput | InputJsonValue;
    version?: IntFieldUpdateOperationsInput | number;
    attemptCount?: IntFieldUpdateOperationsInput | number;
    queuedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    processingAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    completedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    cancelledAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    failedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastAttemptAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastError?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type BillingScheduleCreateManyInput = {
    id?: string;
    dedupeKey: string;
    jobType: $Enums.BillingScheduleJobType;
    invoiceId?: string | null;
    pelangganId?: string | null;
    runAt: Date | string;
    status?: $Enums.BillingScheduleStatus;
    queueJobId?: string | null;
    payload?: NullableJsonNullValueInput | InputJsonValue;
    version?: number;
    attemptCount?: number;
    queuedAt?: Date | string | null;
    processingAt?: Date | string | null;
    completedAt?: Date | string | null;
    cancelledAt?: Date | string | null;
    failedAt?: Date | string | null;
    lastAttemptAt?: Date | string | null;
    lastError?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
  };

  export type BillingScheduleUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    dedupeKey?: StringFieldUpdateOperationsInput | string;
    jobType?:
      | EnumBillingScheduleJobTypeFieldUpdateOperationsInput
      | $Enums.BillingScheduleJobType;
    pelangganId?: NullableStringFieldUpdateOperationsInput | string | null;
    runAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?:
      | EnumBillingScheduleStatusFieldUpdateOperationsInput
      | $Enums.BillingScheduleStatus;
    queueJobId?: NullableStringFieldUpdateOperationsInput | string | null;
    payload?: NullableJsonNullValueInput | InputJsonValue;
    version?: IntFieldUpdateOperationsInput | number;
    attemptCount?: IntFieldUpdateOperationsInput | number;
    queuedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    processingAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    completedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    cancelledAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    failedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastAttemptAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastError?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type BillingScheduleUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    dedupeKey?: StringFieldUpdateOperationsInput | string;
    jobType?:
      | EnumBillingScheduleJobTypeFieldUpdateOperationsInput
      | $Enums.BillingScheduleJobType;
    invoiceId?: NullableStringFieldUpdateOperationsInput | string | null;
    pelangganId?: NullableStringFieldUpdateOperationsInput | string | null;
    runAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?:
      | EnumBillingScheduleStatusFieldUpdateOperationsInput
      | $Enums.BillingScheduleStatus;
    queueJobId?: NullableStringFieldUpdateOperationsInput | string | null;
    payload?: NullableJsonNullValueInput | InputJsonValue;
    version?: IntFieldUpdateOperationsInput | number;
    attemptCount?: IntFieldUpdateOperationsInput | number;
    queuedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    processingAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    completedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    cancelledAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    failedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastAttemptAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastError?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type InvoiceItemCreateInput = {
    id: string;
    description: string;
    quantity?: number;
    unitPrice: bigint | number;
    totalPrice: bigint | number;
    itemType?: $Enums.ItemType;
    tenantId?: string | null;
    invoice: InvoiceCreateNestedOneWithoutInvoiceItemInput;
  };

  export type InvoiceItemUncheckedCreateInput = {
    id: string;
    invoiceId: string;
    description: string;
    quantity?: number;
    unitPrice: bigint | number;
    totalPrice: bigint | number;
    itemType?: $Enums.ItemType;
    tenantId?: string | null;
  };

  export type InvoiceItemUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    description?: StringFieldUpdateOperationsInput | string;
    quantity?: IntFieldUpdateOperationsInput | number;
    unitPrice?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalPrice?: BigIntFieldUpdateOperationsInput | bigint | number;
    itemType?: EnumItemTypeFieldUpdateOperationsInput | $Enums.ItemType;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    invoice?: InvoiceUpdateOneRequiredWithoutInvoiceItemNestedInput;
  };

  export type InvoiceItemUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    invoiceId?: StringFieldUpdateOperationsInput | string;
    description?: StringFieldUpdateOperationsInput | string;
    quantity?: IntFieldUpdateOperationsInput | number;
    unitPrice?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalPrice?: BigIntFieldUpdateOperationsInput | bigint | number;
    itemType?: EnumItemTypeFieldUpdateOperationsInput | $Enums.ItemType;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type InvoiceItemCreateManyInput = {
    id: string;
    invoiceId: string;
    description: string;
    quantity?: number;
    unitPrice: bigint | number;
    totalPrice: bigint | number;
    itemType?: $Enums.ItemType;
    tenantId?: string | null;
  };

  export type InvoiceItemUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    description?: StringFieldUpdateOperationsInput | string;
    quantity?: IntFieldUpdateOperationsInput | number;
    unitPrice?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalPrice?: BigIntFieldUpdateOperationsInput | bigint | number;
    itemType?: EnumItemTypeFieldUpdateOperationsInput | $Enums.ItemType;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type InvoiceItemUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    invoiceId?: StringFieldUpdateOperationsInput | string;
    description?: StringFieldUpdateOperationsInput | string;
    quantity?: IntFieldUpdateOperationsInput | number;
    unitPrice?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalPrice?: BigIntFieldUpdateOperationsInput | bigint | number;
    itemType?: EnumItemTypeFieldUpdateOperationsInput | $Enums.ItemType;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type PaymentCreateInput = {
    id: string;
    pelangganId: string;
    amount: bigint | number;
    paymentDate: Date | string;
    paymentMethod: $Enums.PaymentMethod;
    reference?: string | null;
    notes?: string | null;
    verifiedBy?: string | null;
    verifiedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    accountId?: string | null;
    gatewayStatus?: $Enums.GatewayPaymentStatus | null;
    gatewayProvider?: string | null;
    transactionId?: string | null;
    paymentUrl?: string | null;
    expiresAt?: Date | string | null;
    receiptUrl?: string | null;
    tenantId?: string | null;
    invoice?: InvoiceCreateNestedOneWithoutPaymentInput;
    unmatchedMutation?: UnmatchedMutationCreateNestedOneWithoutPaymentInput;
  };

  export type PaymentUncheckedCreateInput = {
    id: string;
    invoiceId?: string | null;
    pelangganId: string;
    amount: bigint | number;
    paymentDate: Date | string;
    paymentMethod: $Enums.PaymentMethod;
    reference?: string | null;
    notes?: string | null;
    verifiedBy?: string | null;
    verifiedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    accountId?: string | null;
    gatewayStatus?: $Enums.GatewayPaymentStatus | null;
    gatewayProvider?: string | null;
    transactionId?: string | null;
    paymentUrl?: string | null;
    expiresAt?: Date | string | null;
    unmatchedMutationId?: string | null;
    receiptUrl?: string | null;
    tenantId?: string | null;
  };

  export type PaymentUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    amount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    paymentMethod?:
      | EnumPaymentMethodFieldUpdateOperationsInput
      | $Enums.PaymentMethod;
    reference?: NullableStringFieldUpdateOperationsInput | string | null;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accountId?: NullableStringFieldUpdateOperationsInput | string | null;
    gatewayStatus?:
      | NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput
      | $Enums.GatewayPaymentStatus
      | null;
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    expiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    invoice?: InvoiceUpdateOneWithoutPaymentNestedInput;
    unmatchedMutation?: UnmatchedMutationUpdateOneWithoutPaymentNestedInput;
  };

  export type PaymentUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    invoiceId?: NullableStringFieldUpdateOperationsInput | string | null;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    amount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    paymentMethod?:
      | EnumPaymentMethodFieldUpdateOperationsInput
      | $Enums.PaymentMethod;
    reference?: NullableStringFieldUpdateOperationsInput | string | null;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accountId?: NullableStringFieldUpdateOperationsInput | string | null;
    gatewayStatus?:
      | NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput
      | $Enums.GatewayPaymentStatus
      | null;
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    expiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    unmatchedMutationId?:
      | NullableStringFieldUpdateOperationsInput
      | string
      | null;
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type PaymentCreateManyInput = {
    id: string;
    invoiceId?: string | null;
    pelangganId: string;
    amount: bigint | number;
    paymentDate: Date | string;
    paymentMethod: $Enums.PaymentMethod;
    reference?: string | null;
    notes?: string | null;
    verifiedBy?: string | null;
    verifiedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    accountId?: string | null;
    gatewayStatus?: $Enums.GatewayPaymentStatus | null;
    gatewayProvider?: string | null;
    transactionId?: string | null;
    paymentUrl?: string | null;
    expiresAt?: Date | string | null;
    unmatchedMutationId?: string | null;
    receiptUrl?: string | null;
    tenantId?: string | null;
  };

  export type PaymentUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    amount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    paymentMethod?:
      | EnumPaymentMethodFieldUpdateOperationsInput
      | $Enums.PaymentMethod;
    reference?: NullableStringFieldUpdateOperationsInput | string | null;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accountId?: NullableStringFieldUpdateOperationsInput | string | null;
    gatewayStatus?:
      | NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput
      | $Enums.GatewayPaymentStatus
      | null;
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    expiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type PaymentUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    invoiceId?: NullableStringFieldUpdateOperationsInput | string | null;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    amount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    paymentMethod?:
      | EnumPaymentMethodFieldUpdateOperationsInput
      | $Enums.PaymentMethod;
    reference?: NullableStringFieldUpdateOperationsInput | string | null;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accountId?: NullableStringFieldUpdateOperationsInput | string | null;
    gatewayStatus?:
      | NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput
      | $Enums.GatewayPaymentStatus
      | null;
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    expiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    unmatchedMutationId?:
      | NullableStringFieldUpdateOperationsInput
      | string
      | null;
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type PaymentGatewayConfigCreateInput = {
    id: string;
    provider: string;
    providerName: string;
    isEnabled?: boolean;
    isProduction?: boolean;
    priority?: number;
    apiKey?: string | null;
    apiSecret?: string | null;
    clientKey?: string | null;
    merchantId?: string | null;
    webhookUrl?: string | null;
    callbackUrl?: string | null;
    settings?: NullableJsonNullValueInput | InputJsonValue;
    lastTestedAt?: Date | string | null;
    testStatus?: string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    createdBy?: string | null;
    tenantId?: string | null;
  };

  export type PaymentGatewayConfigUncheckedCreateInput = {
    id: string;
    provider: string;
    providerName: string;
    isEnabled?: boolean;
    isProduction?: boolean;
    priority?: number;
    apiKey?: string | null;
    apiSecret?: string | null;
    clientKey?: string | null;
    merchantId?: string | null;
    webhookUrl?: string | null;
    callbackUrl?: string | null;
    settings?: NullableJsonNullValueInput | InputJsonValue;
    lastTestedAt?: Date | string | null;
    testStatus?: string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    createdBy?: string | null;
    tenantId?: string | null;
  };

  export type PaymentGatewayConfigUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    providerName?: StringFieldUpdateOperationsInput | string;
    isEnabled?: BoolFieldUpdateOperationsInput | boolean;
    isProduction?: BoolFieldUpdateOperationsInput | boolean;
    priority?: IntFieldUpdateOperationsInput | number;
    apiKey?: NullableStringFieldUpdateOperationsInput | string | null;
    apiSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    clientKey?: NullableStringFieldUpdateOperationsInput | string | null;
    merchantId?: NullableStringFieldUpdateOperationsInput | string | null;
    webhookUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    callbackUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    settings?: NullableJsonNullValueInput | InputJsonValue;
    lastTestedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    testStatus?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type PaymentGatewayConfigUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    providerName?: StringFieldUpdateOperationsInput | string;
    isEnabled?: BoolFieldUpdateOperationsInput | boolean;
    isProduction?: BoolFieldUpdateOperationsInput | boolean;
    priority?: IntFieldUpdateOperationsInput | number;
    apiKey?: NullableStringFieldUpdateOperationsInput | string | null;
    apiSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    clientKey?: NullableStringFieldUpdateOperationsInput | string | null;
    merchantId?: NullableStringFieldUpdateOperationsInput | string | null;
    webhookUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    callbackUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    settings?: NullableJsonNullValueInput | InputJsonValue;
    lastTestedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    testStatus?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type PaymentGatewayConfigCreateManyInput = {
    id: string;
    provider: string;
    providerName: string;
    isEnabled?: boolean;
    isProduction?: boolean;
    priority?: number;
    apiKey?: string | null;
    apiSecret?: string | null;
    clientKey?: string | null;
    merchantId?: string | null;
    webhookUrl?: string | null;
    callbackUrl?: string | null;
    settings?: NullableJsonNullValueInput | InputJsonValue;
    lastTestedAt?: Date | string | null;
    testStatus?: string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    createdBy?: string | null;
    tenantId?: string | null;
  };

  export type PaymentGatewayConfigUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    providerName?: StringFieldUpdateOperationsInput | string;
    isEnabled?: BoolFieldUpdateOperationsInput | boolean;
    isProduction?: BoolFieldUpdateOperationsInput | boolean;
    priority?: IntFieldUpdateOperationsInput | number;
    apiKey?: NullableStringFieldUpdateOperationsInput | string | null;
    apiSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    clientKey?: NullableStringFieldUpdateOperationsInput | string | null;
    merchantId?: NullableStringFieldUpdateOperationsInput | string | null;
    webhookUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    callbackUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    settings?: NullableJsonNullValueInput | InputJsonValue;
    lastTestedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    testStatus?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type PaymentGatewayConfigUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    providerName?: StringFieldUpdateOperationsInput | string;
    isEnabled?: BoolFieldUpdateOperationsInput | boolean;
    isProduction?: BoolFieldUpdateOperationsInput | boolean;
    priority?: IntFieldUpdateOperationsInput | number;
    apiKey?: NullableStringFieldUpdateOperationsInput | string | null;
    apiSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    clientKey?: NullableStringFieldUpdateOperationsInput | string | null;
    merchantId?: NullableStringFieldUpdateOperationsInput | string | null;
    webhookUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    callbackUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    settings?: NullableJsonNullValueInput | InputJsonValue;
    lastTestedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    testStatus?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type UnmatchedMutationCreateInput = {
    id?: string;
    provider?: string;
    transactionId?: string | null;
    amount: Decimal | DecimalJsLike | number | string;
    description?: string | null;
    type?: string | null;
    date: Date | string;
    bankId?: string | null;
    rawPayload?: NullableJsonNullValueInput | InputJsonValue;
    status?: $Enums.UnmatchedStatus;
    resolvedAt?: Date | string | null;
    resolvedById?: string | null;
    matchedInvoiceId?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    payment?: PaymentCreateNestedOneWithoutUnmatchedMutationInput;
  };

  export type UnmatchedMutationUncheckedCreateInput = {
    id?: string;
    provider?: string;
    transactionId?: string | null;
    amount: Decimal | DecimalJsLike | number | string;
    description?: string | null;
    type?: string | null;
    date: Date | string;
    bankId?: string | null;
    rawPayload?: NullableJsonNullValueInput | InputJsonValue;
    status?: $Enums.UnmatchedStatus;
    resolvedAt?: Date | string | null;
    resolvedById?: string | null;
    matchedInvoiceId?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
    payment?: PaymentUncheckedCreateNestedOneWithoutUnmatchedMutationInput;
  };

  export type UnmatchedMutationUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    amount?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    description?: NullableStringFieldUpdateOperationsInput | string | null;
    type?: NullableStringFieldUpdateOperationsInput | string | null;
    date?: DateTimeFieldUpdateOperationsInput | Date | string;
    bankId?: NullableStringFieldUpdateOperationsInput | string | null;
    rawPayload?: NullableJsonNullValueInput | InputJsonValue;
    status?:
      | EnumUnmatchedStatusFieldUpdateOperationsInput
      | $Enums.UnmatchedStatus;
    resolvedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    resolvedById?: NullableStringFieldUpdateOperationsInput | string | null;
    matchedInvoiceId?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    payment?: PaymentUpdateOneWithoutUnmatchedMutationNestedInput;
  };

  export type UnmatchedMutationUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    amount?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    description?: NullableStringFieldUpdateOperationsInput | string | null;
    type?: NullableStringFieldUpdateOperationsInput | string | null;
    date?: DateTimeFieldUpdateOperationsInput | Date | string;
    bankId?: NullableStringFieldUpdateOperationsInput | string | null;
    rawPayload?: NullableJsonNullValueInput | InputJsonValue;
    status?:
      | EnumUnmatchedStatusFieldUpdateOperationsInput
      | $Enums.UnmatchedStatus;
    resolvedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    resolvedById?: NullableStringFieldUpdateOperationsInput | string | null;
    matchedInvoiceId?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    payment?: PaymentUncheckedUpdateOneWithoutUnmatchedMutationNestedInput;
  };

  export type UnmatchedMutationCreateManyInput = {
    id?: string;
    provider?: string;
    transactionId?: string | null;
    amount: Decimal | DecimalJsLike | number | string;
    description?: string | null;
    type?: string | null;
    date: Date | string;
    bankId?: string | null;
    rawPayload?: NullableJsonNullValueInput | InputJsonValue;
    status?: $Enums.UnmatchedStatus;
    resolvedAt?: Date | string | null;
    resolvedById?: string | null;
    matchedInvoiceId?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
  };

  export type UnmatchedMutationUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    amount?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    description?: NullableStringFieldUpdateOperationsInput | string | null;
    type?: NullableStringFieldUpdateOperationsInput | string | null;
    date?: DateTimeFieldUpdateOperationsInput | Date | string;
    bankId?: NullableStringFieldUpdateOperationsInput | string | null;
    rawPayload?: NullableJsonNullValueInput | InputJsonValue;
    status?:
      | EnumUnmatchedStatusFieldUpdateOperationsInput
      | $Enums.UnmatchedStatus;
    resolvedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    resolvedById?: NullableStringFieldUpdateOperationsInput | string | null;
    matchedInvoiceId?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type UnmatchedMutationUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    amount?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    description?: NullableStringFieldUpdateOperationsInput | string | null;
    type?: NullableStringFieldUpdateOperationsInput | string | null;
    date?: DateTimeFieldUpdateOperationsInput | Date | string;
    bankId?: NullableStringFieldUpdateOperationsInput | string | null;
    rawPayload?: NullableJsonNullValueInput | InputJsonValue;
    status?:
      | EnumUnmatchedStatusFieldUpdateOperationsInput
      | $Enums.UnmatchedStatus;
    resolvedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    resolvedById?: NullableStringFieldUpdateOperationsInput | string | null;
    matchedInvoiceId?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type WebhookEventCreateInput = {
    id?: string;
    idempotencyKey: string;
    provider: string;
    payload: JsonNullValueInput | InputJsonValue;
    signature?: string | null;
    rawBody?: string | null;
    status?: $Enums.WebhookEventStatus;
    orderId?: string | null;
    transactionId?: string | null;
    processedAt?: Date | string | null;
    error?: string | null;
    tenantId?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type WebhookEventUncheckedCreateInput = {
    id?: string;
    idempotencyKey: string;
    provider: string;
    payload: JsonNullValueInput | InputJsonValue;
    signature?: string | null;
    rawBody?: string | null;
    status?: $Enums.WebhookEventStatus;
    orderId?: string | null;
    transactionId?: string | null;
    processedAt?: Date | string | null;
    error?: string | null;
    tenantId?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type WebhookEventUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    idempotencyKey?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    payload?: JsonNullValueInput | InputJsonValue;
    signature?: NullableStringFieldUpdateOperationsInput | string | null;
    rawBody?: NullableStringFieldUpdateOperationsInput | string | null;
    status?:
      | EnumWebhookEventStatusFieldUpdateOperationsInput
      | $Enums.WebhookEventStatus;
    orderId?: NullableStringFieldUpdateOperationsInput | string | null;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    processedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    error?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type WebhookEventUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    idempotencyKey?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    payload?: JsonNullValueInput | InputJsonValue;
    signature?: NullableStringFieldUpdateOperationsInput | string | null;
    rawBody?: NullableStringFieldUpdateOperationsInput | string | null;
    status?:
      | EnumWebhookEventStatusFieldUpdateOperationsInput
      | $Enums.WebhookEventStatus;
    orderId?: NullableStringFieldUpdateOperationsInput | string | null;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    processedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    error?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type WebhookEventCreateManyInput = {
    id?: string;
    idempotencyKey: string;
    provider: string;
    payload: JsonNullValueInput | InputJsonValue;
    signature?: string | null;
    rawBody?: string | null;
    status?: $Enums.WebhookEventStatus;
    orderId?: string | null;
    transactionId?: string | null;
    processedAt?: Date | string | null;
    error?: string | null;
    tenantId?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type WebhookEventUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    idempotencyKey?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    payload?: JsonNullValueInput | InputJsonValue;
    signature?: NullableStringFieldUpdateOperationsInput | string | null;
    rawBody?: NullableStringFieldUpdateOperationsInput | string | null;
    status?:
      | EnumWebhookEventStatusFieldUpdateOperationsInput
      | $Enums.WebhookEventStatus;
    orderId?: NullableStringFieldUpdateOperationsInput | string | null;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    processedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    error?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type WebhookEventUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    idempotencyKey?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    payload?: JsonNullValueInput | InputJsonValue;
    signature?: NullableStringFieldUpdateOperationsInput | string | null;
    rawBody?: NullableStringFieldUpdateOperationsInput | string | null;
    status?:
      | EnumWebhookEventStatusFieldUpdateOperationsInput
      | $Enums.WebhookEventStatus;
    orderId?: NullableStringFieldUpdateOperationsInput | string | null;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    processedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    error?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
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

  export type EnumInvoiceStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.InvoiceStatus
      | EnumInvoiceStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.InvoiceStatus[]
      | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.InvoiceStatus[]
      | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>;
    not?: NestedEnumInvoiceStatusFilter<$PrismaModel> | $Enums.InvoiceStatus;
  };

  export type BigIntFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>;
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>;
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    not?: NestedBigIntFilter<$PrismaModel> | bigint | number;
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

  export type InvoiceItemListRelationFilter = {
    every?: InvoiceItemWhereInput;
    some?: InvoiceItemWhereInput;
    none?: InvoiceItemWhereInput;
  };

  export type PaymentListRelationFilter = {
    every?: PaymentWhereInput;
    some?: PaymentWhereInput;
    none?: PaymentWhereInput;
  };

  export type BillingScheduleListRelationFilter = {
    every?: BillingScheduleWhereInput;
    some?: BillingScheduleWhereInput;
    none?: BillingScheduleWhereInput;
  };

  export type SortOrderInput = {
    sort: SortOrder;
    nulls?: NullsOrder;
  };

  export type InvoiceItemOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type PaymentOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type BillingScheduleOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type InvoiceTenantIdInvoiceNumberCompoundUniqueInput = {
    tenantId: string;
    invoiceNumber: string;
  };

  export type InvoiceCountOrderByAggregateInput = {
    id?: SortOrder;
    invoiceNumber?: SortOrder;
    pelangganId?: SortOrder;
    issueDate?: SortOrder;
    dueDate?: SortOrder;
    status?: SortOrder;
    subtotal?: SortOrder;
    taxAmount?: SortOrder;
    discountAmount?: SortOrder;
    totalAmount?: SortOrder;
    paidAmount?: SortOrder;
    notes?: SortOrder;
    terms?: SortOrder;
    sentAt?: SortOrder;
    paidAt?: SortOrder;
    createdBy?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    siteId?: SortOrder;
    tenantId?: SortOrder;
  };

  export type InvoiceAvgOrderByAggregateInput = {
    subtotal?: SortOrder;
    taxAmount?: SortOrder;
    discountAmount?: SortOrder;
    totalAmount?: SortOrder;
    paidAmount?: SortOrder;
  };

  export type InvoiceMaxOrderByAggregateInput = {
    id?: SortOrder;
    invoiceNumber?: SortOrder;
    pelangganId?: SortOrder;
    issueDate?: SortOrder;
    dueDate?: SortOrder;
    status?: SortOrder;
    subtotal?: SortOrder;
    taxAmount?: SortOrder;
    discountAmount?: SortOrder;
    totalAmount?: SortOrder;
    paidAmount?: SortOrder;
    notes?: SortOrder;
    terms?: SortOrder;
    sentAt?: SortOrder;
    paidAt?: SortOrder;
    createdBy?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    siteId?: SortOrder;
    tenantId?: SortOrder;
  };

  export type InvoiceMinOrderByAggregateInput = {
    id?: SortOrder;
    invoiceNumber?: SortOrder;
    pelangganId?: SortOrder;
    issueDate?: SortOrder;
    dueDate?: SortOrder;
    status?: SortOrder;
    subtotal?: SortOrder;
    taxAmount?: SortOrder;
    discountAmount?: SortOrder;
    totalAmount?: SortOrder;
    paidAmount?: SortOrder;
    notes?: SortOrder;
    terms?: SortOrder;
    sentAt?: SortOrder;
    paidAt?: SortOrder;
    createdBy?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    siteId?: SortOrder;
    tenantId?: SortOrder;
  };

  export type InvoiceSumOrderByAggregateInput = {
    subtotal?: SortOrder;
    taxAmount?: SortOrder;
    discountAmount?: SortOrder;
    totalAmount?: SortOrder;
    paidAmount?: SortOrder;
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

  export type EnumInvoiceStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.InvoiceStatus
      | EnumInvoiceStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.InvoiceStatus[]
      | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.InvoiceStatus[]
      | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumInvoiceStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.InvoiceStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumInvoiceStatusFilter<$PrismaModel>;
    _max?: NestedEnumInvoiceStatusFilter<$PrismaModel>;
  };

  export type BigIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>;
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>;
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    not?: NestedBigIntWithAggregatesFilter<$PrismaModel> | bigint | number;
    _count?: NestedIntFilter<$PrismaModel>;
    _avg?: NestedFloatFilter<$PrismaModel>;
    _sum?: NestedBigIntFilter<$PrismaModel>;
    _min?: NestedBigIntFilter<$PrismaModel>;
    _max?: NestedBigIntFilter<$PrismaModel>;
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

  export type EnumBillingScheduleJobTypeFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.BillingScheduleJobType
      | EnumBillingScheduleJobTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.BillingScheduleJobType[]
      | ListEnumBillingScheduleJobTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.BillingScheduleJobType[]
      | ListEnumBillingScheduleJobTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumBillingScheduleJobTypeFilter<$PrismaModel>
      | $Enums.BillingScheduleJobType;
  };

  export type EnumBillingScheduleStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.BillingScheduleStatus
      | EnumBillingScheduleStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.BillingScheduleStatus[]
      | ListEnumBillingScheduleStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.BillingScheduleStatus[]
      | ListEnumBillingScheduleStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumBillingScheduleStatusFilter<$PrismaModel>
      | $Enums.BillingScheduleStatus;
  };
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<
          Required<JsonNullableFilterBase<$PrismaModel>>,
          Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, "path">
        >,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<
        Omit<Required<JsonNullableFilterBase<$PrismaModel>>, "path">
      >;

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    path?: string[];
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>;
    string_contains?: string | StringFieldRefInput<$PrismaModel>;
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>;
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>;
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    not?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
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

  export type InvoiceNullableScalarRelationFilter = {
    is?: InvoiceWhereInput | null;
    isNot?: InvoiceWhereInput | null;
  };

  export type BillingScheduleCountOrderByAggregateInput = {
    id?: SortOrder;
    dedupeKey?: SortOrder;
    jobType?: SortOrder;
    invoiceId?: SortOrder;
    pelangganId?: SortOrder;
    runAt?: SortOrder;
    status?: SortOrder;
    queueJobId?: SortOrder;
    payload?: SortOrder;
    version?: SortOrder;
    attemptCount?: SortOrder;
    queuedAt?: SortOrder;
    processingAt?: SortOrder;
    completedAt?: SortOrder;
    cancelledAt?: SortOrder;
    failedAt?: SortOrder;
    lastAttemptAt?: SortOrder;
    lastError?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type BillingScheduleAvgOrderByAggregateInput = {
    version?: SortOrder;
    attemptCount?: SortOrder;
  };

  export type BillingScheduleMaxOrderByAggregateInput = {
    id?: SortOrder;
    dedupeKey?: SortOrder;
    jobType?: SortOrder;
    invoiceId?: SortOrder;
    pelangganId?: SortOrder;
    runAt?: SortOrder;
    status?: SortOrder;
    queueJobId?: SortOrder;
    version?: SortOrder;
    attemptCount?: SortOrder;
    queuedAt?: SortOrder;
    processingAt?: SortOrder;
    completedAt?: SortOrder;
    cancelledAt?: SortOrder;
    failedAt?: SortOrder;
    lastAttemptAt?: SortOrder;
    lastError?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type BillingScheduleMinOrderByAggregateInput = {
    id?: SortOrder;
    dedupeKey?: SortOrder;
    jobType?: SortOrder;
    invoiceId?: SortOrder;
    pelangganId?: SortOrder;
    runAt?: SortOrder;
    status?: SortOrder;
    queueJobId?: SortOrder;
    version?: SortOrder;
    attemptCount?: SortOrder;
    queuedAt?: SortOrder;
    processingAt?: SortOrder;
    completedAt?: SortOrder;
    cancelledAt?: SortOrder;
    failedAt?: SortOrder;
    lastAttemptAt?: SortOrder;
    lastError?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type BillingScheduleSumOrderByAggregateInput = {
    version?: SortOrder;
    attemptCount?: SortOrder;
  };

  export type EnumBillingScheduleJobTypeWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.BillingScheduleJobType
      | EnumBillingScheduleJobTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.BillingScheduleJobType[]
      | ListEnumBillingScheduleJobTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.BillingScheduleJobType[]
      | ListEnumBillingScheduleJobTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumBillingScheduleJobTypeWithAggregatesFilter<$PrismaModel>
      | $Enums.BillingScheduleJobType;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumBillingScheduleJobTypeFilter<$PrismaModel>;
    _max?: NestedEnumBillingScheduleJobTypeFilter<$PrismaModel>;
  };

  export type EnumBillingScheduleStatusWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.BillingScheduleStatus
      | EnumBillingScheduleStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.BillingScheduleStatus[]
      | ListEnumBillingScheduleStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.BillingScheduleStatus[]
      | ListEnumBillingScheduleStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumBillingScheduleStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.BillingScheduleStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumBillingScheduleStatusFilter<$PrismaModel>;
    _max?: NestedEnumBillingScheduleStatusFilter<$PrismaModel>;
  };
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<
          Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>,
          Exclude<
            keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>,
            "path"
          >
        >,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<
        Omit<
          Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>,
          "path"
        >
      >;

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    path?: string[];
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>;
    string_contains?: string | StringFieldRefInput<$PrismaModel>;
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>;
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>;
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    not?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedJsonNullableFilter<$PrismaModel>;
    _max?: NestedJsonNullableFilter<$PrismaModel>;
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

  export type EnumItemTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.ItemType | EnumItemTypeFieldRefInput<$PrismaModel>;
    in?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>;
    notIn?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>;
    not?: NestedEnumItemTypeFilter<$PrismaModel> | $Enums.ItemType;
  };

  export type InvoiceScalarRelationFilter = {
    is?: InvoiceWhereInput;
    isNot?: InvoiceWhereInput;
  };

  export type InvoiceItemCountOrderByAggregateInput = {
    id?: SortOrder;
    invoiceId?: SortOrder;
    description?: SortOrder;
    quantity?: SortOrder;
    unitPrice?: SortOrder;
    totalPrice?: SortOrder;
    itemType?: SortOrder;
    tenantId?: SortOrder;
  };

  export type InvoiceItemAvgOrderByAggregateInput = {
    quantity?: SortOrder;
    unitPrice?: SortOrder;
    totalPrice?: SortOrder;
  };

  export type InvoiceItemMaxOrderByAggregateInput = {
    id?: SortOrder;
    invoiceId?: SortOrder;
    description?: SortOrder;
    quantity?: SortOrder;
    unitPrice?: SortOrder;
    totalPrice?: SortOrder;
    itemType?: SortOrder;
    tenantId?: SortOrder;
  };

  export type InvoiceItemMinOrderByAggregateInput = {
    id?: SortOrder;
    invoiceId?: SortOrder;
    description?: SortOrder;
    quantity?: SortOrder;
    unitPrice?: SortOrder;
    totalPrice?: SortOrder;
    itemType?: SortOrder;
    tenantId?: SortOrder;
  };

  export type InvoiceItemSumOrderByAggregateInput = {
    quantity?: SortOrder;
    unitPrice?: SortOrder;
    totalPrice?: SortOrder;
  };

  export type EnumItemTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ItemType | EnumItemTypeFieldRefInput<$PrismaModel>;
    in?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>;
    notIn?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumItemTypeWithAggregatesFilter<$PrismaModel>
      | $Enums.ItemType;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumItemTypeFilter<$PrismaModel>;
    _max?: NestedEnumItemTypeFilter<$PrismaModel>;
  };

  export type EnumPaymentMethodFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.PaymentMethod
      | EnumPaymentMethodFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.PaymentMethod[]
      | ListEnumPaymentMethodFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.PaymentMethod[]
      | ListEnumPaymentMethodFieldRefInput<$PrismaModel>;
    not?: NestedEnumPaymentMethodFilter<$PrismaModel> | $Enums.PaymentMethod;
  };

  export type EnumGatewayPaymentStatusNullableFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.GatewayPaymentStatus
      | EnumGatewayPaymentStatusFieldRefInput<$PrismaModel>
      | null;
    in?:
      | $Enums.GatewayPaymentStatus[]
      | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel>
      | null;
    notIn?:
      | $Enums.GatewayPaymentStatus[]
      | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel>
      | null;
    not?:
      | NestedEnumGatewayPaymentStatusNullableFilter<$PrismaModel>
      | $Enums.GatewayPaymentStatus
      | null;
  };

  export type UnmatchedMutationNullableScalarRelationFilter = {
    is?: UnmatchedMutationWhereInput | null;
    isNot?: UnmatchedMutationWhereInput | null;
  };

  export type PaymentCountOrderByAggregateInput = {
    id?: SortOrder;
    invoiceId?: SortOrder;
    pelangganId?: SortOrder;
    amount?: SortOrder;
    paymentDate?: SortOrder;
    paymentMethod?: SortOrder;
    reference?: SortOrder;
    notes?: SortOrder;
    verifiedBy?: SortOrder;
    verifiedAt?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    accountId?: SortOrder;
    gatewayStatus?: SortOrder;
    gatewayProvider?: SortOrder;
    transactionId?: SortOrder;
    paymentUrl?: SortOrder;
    expiresAt?: SortOrder;
    unmatchedMutationId?: SortOrder;
    receiptUrl?: SortOrder;
    tenantId?: SortOrder;
  };

  export type PaymentAvgOrderByAggregateInput = {
    amount?: SortOrder;
  };

  export type PaymentMaxOrderByAggregateInput = {
    id?: SortOrder;
    invoiceId?: SortOrder;
    pelangganId?: SortOrder;
    amount?: SortOrder;
    paymentDate?: SortOrder;
    paymentMethod?: SortOrder;
    reference?: SortOrder;
    notes?: SortOrder;
    verifiedBy?: SortOrder;
    verifiedAt?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    accountId?: SortOrder;
    gatewayStatus?: SortOrder;
    gatewayProvider?: SortOrder;
    transactionId?: SortOrder;
    paymentUrl?: SortOrder;
    expiresAt?: SortOrder;
    unmatchedMutationId?: SortOrder;
    receiptUrl?: SortOrder;
    tenantId?: SortOrder;
  };

  export type PaymentMinOrderByAggregateInput = {
    id?: SortOrder;
    invoiceId?: SortOrder;
    pelangganId?: SortOrder;
    amount?: SortOrder;
    paymentDate?: SortOrder;
    paymentMethod?: SortOrder;
    reference?: SortOrder;
    notes?: SortOrder;
    verifiedBy?: SortOrder;
    verifiedAt?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    accountId?: SortOrder;
    gatewayStatus?: SortOrder;
    gatewayProvider?: SortOrder;
    transactionId?: SortOrder;
    paymentUrl?: SortOrder;
    expiresAt?: SortOrder;
    unmatchedMutationId?: SortOrder;
    receiptUrl?: SortOrder;
    tenantId?: SortOrder;
  };

  export type PaymentSumOrderByAggregateInput = {
    amount?: SortOrder;
  };

  export type EnumPaymentMethodWithAggregatesFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.PaymentMethod
      | EnumPaymentMethodFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.PaymentMethod[]
      | ListEnumPaymentMethodFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.PaymentMethod[]
      | ListEnumPaymentMethodFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumPaymentMethodWithAggregatesFilter<$PrismaModel>
      | $Enums.PaymentMethod;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumPaymentMethodFilter<$PrismaModel>;
    _max?: NestedEnumPaymentMethodFilter<$PrismaModel>;
  };

  export type EnumGatewayPaymentStatusNullableWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.GatewayPaymentStatus
      | EnumGatewayPaymentStatusFieldRefInput<$PrismaModel>
      | null;
    in?:
      | $Enums.GatewayPaymentStatus[]
      | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel>
      | null;
    notIn?:
      | $Enums.GatewayPaymentStatus[]
      | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel>
      | null;
    not?:
      | NestedEnumGatewayPaymentStatusNullableWithAggregatesFilter<$PrismaModel>
      | $Enums.GatewayPaymentStatus
      | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedEnumGatewayPaymentStatusNullableFilter<$PrismaModel>;
    _max?: NestedEnumGatewayPaymentStatusNullableFilter<$PrismaModel>;
  };

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolFilter<$PrismaModel> | boolean;
  };

  export type PaymentGatewayConfigProviderTenantIdCompoundUniqueInput = {
    provider: string;
    tenantId: string;
  };

  export type PaymentGatewayConfigCountOrderByAggregateInput = {
    id?: SortOrder;
    provider?: SortOrder;
    providerName?: SortOrder;
    isEnabled?: SortOrder;
    isProduction?: SortOrder;
    priority?: SortOrder;
    apiKey?: SortOrder;
    apiSecret?: SortOrder;
    clientKey?: SortOrder;
    merchantId?: SortOrder;
    webhookUrl?: SortOrder;
    callbackUrl?: SortOrder;
    settings?: SortOrder;
    lastTestedAt?: SortOrder;
    testStatus?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    createdBy?: SortOrder;
    tenantId?: SortOrder;
  };

  export type PaymentGatewayConfigAvgOrderByAggregateInput = {
    priority?: SortOrder;
  };

  export type PaymentGatewayConfigMaxOrderByAggregateInput = {
    id?: SortOrder;
    provider?: SortOrder;
    providerName?: SortOrder;
    isEnabled?: SortOrder;
    isProduction?: SortOrder;
    priority?: SortOrder;
    apiKey?: SortOrder;
    apiSecret?: SortOrder;
    clientKey?: SortOrder;
    merchantId?: SortOrder;
    webhookUrl?: SortOrder;
    callbackUrl?: SortOrder;
    lastTestedAt?: SortOrder;
    testStatus?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    createdBy?: SortOrder;
    tenantId?: SortOrder;
  };

  export type PaymentGatewayConfigMinOrderByAggregateInput = {
    id?: SortOrder;
    provider?: SortOrder;
    providerName?: SortOrder;
    isEnabled?: SortOrder;
    isProduction?: SortOrder;
    priority?: SortOrder;
    apiKey?: SortOrder;
    apiSecret?: SortOrder;
    clientKey?: SortOrder;
    merchantId?: SortOrder;
    webhookUrl?: SortOrder;
    callbackUrl?: SortOrder;
    lastTestedAt?: SortOrder;
    testStatus?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    createdBy?: SortOrder;
    tenantId?: SortOrder;
  };

  export type PaymentGatewayConfigSumOrderByAggregateInput = {
    priority?: SortOrder;
  };

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedBoolFilter<$PrismaModel>;
    _max?: NestedBoolFilter<$PrismaModel>;
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

  export type EnumUnmatchedStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.UnmatchedStatus
      | EnumUnmatchedStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.UnmatchedStatus[]
      | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.UnmatchedStatus[]
      | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumUnmatchedStatusFilter<$PrismaModel>
      | $Enums.UnmatchedStatus;
  };

  export type PaymentNullableScalarRelationFilter = {
    is?: PaymentWhereInput | null;
    isNot?: PaymentWhereInput | null;
  };

  export type UnmatchedMutationCountOrderByAggregateInput = {
    id?: SortOrder;
    provider?: SortOrder;
    transactionId?: SortOrder;
    amount?: SortOrder;
    description?: SortOrder;
    type?: SortOrder;
    date?: SortOrder;
    bankId?: SortOrder;
    rawPayload?: SortOrder;
    status?: SortOrder;
    resolvedAt?: SortOrder;
    resolvedById?: SortOrder;
    matchedInvoiceId?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type UnmatchedMutationAvgOrderByAggregateInput = {
    amount?: SortOrder;
  };

  export type UnmatchedMutationMaxOrderByAggregateInput = {
    id?: SortOrder;
    provider?: SortOrder;
    transactionId?: SortOrder;
    amount?: SortOrder;
    description?: SortOrder;
    type?: SortOrder;
    date?: SortOrder;
    bankId?: SortOrder;
    status?: SortOrder;
    resolvedAt?: SortOrder;
    resolvedById?: SortOrder;
    matchedInvoiceId?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type UnmatchedMutationMinOrderByAggregateInput = {
    id?: SortOrder;
    provider?: SortOrder;
    transactionId?: SortOrder;
    amount?: SortOrder;
    description?: SortOrder;
    type?: SortOrder;
    date?: SortOrder;
    bankId?: SortOrder;
    status?: SortOrder;
    resolvedAt?: SortOrder;
    resolvedById?: SortOrder;
    matchedInvoiceId?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenantId?: SortOrder;
  };

  export type UnmatchedMutationSumOrderByAggregateInput = {
    amount?: SortOrder;
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

  export type EnumUnmatchedStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.UnmatchedStatus
      | EnumUnmatchedStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.UnmatchedStatus[]
      | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.UnmatchedStatus[]
      | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumUnmatchedStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.UnmatchedStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumUnmatchedStatusFilter<$PrismaModel>;
    _max?: NestedEnumUnmatchedStatusFilter<$PrismaModel>;
  };
  export type JsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<
          Required<JsonFilterBase<$PrismaModel>>,
          Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, "path">
        >,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, "path">>;

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    path?: string[];
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>;
    string_contains?: string | StringFieldRefInput<$PrismaModel>;
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>;
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>;
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    not?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
  };

  export type EnumWebhookEventStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.WebhookEventStatus
      | EnumWebhookEventStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.WebhookEventStatus[]
      | ListEnumWebhookEventStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.WebhookEventStatus[]
      | ListEnumWebhookEventStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumWebhookEventStatusFilter<$PrismaModel>
      | $Enums.WebhookEventStatus;
  };

  export type WebhookEventCountOrderByAggregateInput = {
    id?: SortOrder;
    idempotencyKey?: SortOrder;
    provider?: SortOrder;
    payload?: SortOrder;
    signature?: SortOrder;
    rawBody?: SortOrder;
    status?: SortOrder;
    orderId?: SortOrder;
    transactionId?: SortOrder;
    processedAt?: SortOrder;
    error?: SortOrder;
    tenantId?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type WebhookEventMaxOrderByAggregateInput = {
    id?: SortOrder;
    idempotencyKey?: SortOrder;
    provider?: SortOrder;
    signature?: SortOrder;
    rawBody?: SortOrder;
    status?: SortOrder;
    orderId?: SortOrder;
    transactionId?: SortOrder;
    processedAt?: SortOrder;
    error?: SortOrder;
    tenantId?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type WebhookEventMinOrderByAggregateInput = {
    id?: SortOrder;
    idempotencyKey?: SortOrder;
    provider?: SortOrder;
    signature?: SortOrder;
    rawBody?: SortOrder;
    status?: SortOrder;
    orderId?: SortOrder;
    transactionId?: SortOrder;
    processedAt?: SortOrder;
    error?: SortOrder;
    tenantId?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };
  export type JsonWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<
          Required<JsonWithAggregatesFilterBase<$PrismaModel>>,
          Exclude<
            keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>,
            "path"
          >
        >,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<
        Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, "path">
      >;

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    path?: string[];
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>;
    string_contains?: string | StringFieldRefInput<$PrismaModel>;
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>;
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>;
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    not?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedJsonFilter<$PrismaModel>;
    _max?: NestedJsonFilter<$PrismaModel>;
  };

  export type EnumWebhookEventStatusWithAggregatesFilter<$PrismaModel = never> =
    {
      equals?:
        | $Enums.WebhookEventStatus
        | EnumWebhookEventStatusFieldRefInput<$PrismaModel>;
      in?:
        | $Enums.WebhookEventStatus[]
        | ListEnumWebhookEventStatusFieldRefInput<$PrismaModel>;
      notIn?:
        | $Enums.WebhookEventStatus[]
        | ListEnumWebhookEventStatusFieldRefInput<$PrismaModel>;
      not?:
        | NestedEnumWebhookEventStatusWithAggregatesFilter<$PrismaModel>
        | $Enums.WebhookEventStatus;
      _count?: NestedIntFilter<$PrismaModel>;
      _min?: NestedEnumWebhookEventStatusFilter<$PrismaModel>;
      _max?: NestedEnumWebhookEventStatusFilter<$PrismaModel>;
    };

  export type InvoiceItemCreateNestedManyWithoutInvoiceInput = {
    create?:
      | XOR<
          InvoiceItemCreateWithoutInvoiceInput,
          InvoiceItemUncheckedCreateWithoutInvoiceInput
        >
      | InvoiceItemCreateWithoutInvoiceInput[]
      | InvoiceItemUncheckedCreateWithoutInvoiceInput[];
    connectOrCreate?:
      | InvoiceItemCreateOrConnectWithoutInvoiceInput
      | InvoiceItemCreateOrConnectWithoutInvoiceInput[];
    createMany?: InvoiceItemCreateManyInvoiceInputEnvelope;
    connect?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[];
  };

  export type PaymentCreateNestedManyWithoutInvoiceInput = {
    create?:
      | XOR<
          PaymentCreateWithoutInvoiceInput,
          PaymentUncheckedCreateWithoutInvoiceInput
        >
      | PaymentCreateWithoutInvoiceInput[]
      | PaymentUncheckedCreateWithoutInvoiceInput[];
    connectOrCreate?:
      | PaymentCreateOrConnectWithoutInvoiceInput
      | PaymentCreateOrConnectWithoutInvoiceInput[];
    createMany?: PaymentCreateManyInvoiceInputEnvelope;
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[];
  };

  export type BillingScheduleCreateNestedManyWithoutInvoiceInput = {
    create?:
      | XOR<
          BillingScheduleCreateWithoutInvoiceInput,
          BillingScheduleUncheckedCreateWithoutInvoiceInput
        >
      | BillingScheduleCreateWithoutInvoiceInput[]
      | BillingScheduleUncheckedCreateWithoutInvoiceInput[];
    connectOrCreate?:
      | BillingScheduleCreateOrConnectWithoutInvoiceInput
      | BillingScheduleCreateOrConnectWithoutInvoiceInput[];
    createMany?: BillingScheduleCreateManyInvoiceInputEnvelope;
    connect?:
      | BillingScheduleWhereUniqueInput
      | BillingScheduleWhereUniqueInput[];
  };

  export type InvoiceItemUncheckedCreateNestedManyWithoutInvoiceInput = {
    create?:
      | XOR<
          InvoiceItemCreateWithoutInvoiceInput,
          InvoiceItemUncheckedCreateWithoutInvoiceInput
        >
      | InvoiceItemCreateWithoutInvoiceInput[]
      | InvoiceItemUncheckedCreateWithoutInvoiceInput[];
    connectOrCreate?:
      | InvoiceItemCreateOrConnectWithoutInvoiceInput
      | InvoiceItemCreateOrConnectWithoutInvoiceInput[];
    createMany?: InvoiceItemCreateManyInvoiceInputEnvelope;
    connect?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[];
  };

  export type PaymentUncheckedCreateNestedManyWithoutInvoiceInput = {
    create?:
      | XOR<
          PaymentCreateWithoutInvoiceInput,
          PaymentUncheckedCreateWithoutInvoiceInput
        >
      | PaymentCreateWithoutInvoiceInput[]
      | PaymentUncheckedCreateWithoutInvoiceInput[];
    connectOrCreate?:
      | PaymentCreateOrConnectWithoutInvoiceInput
      | PaymentCreateOrConnectWithoutInvoiceInput[];
    createMany?: PaymentCreateManyInvoiceInputEnvelope;
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[];
  };

  export type BillingScheduleUncheckedCreateNestedManyWithoutInvoiceInput = {
    create?:
      | XOR<
          BillingScheduleCreateWithoutInvoiceInput,
          BillingScheduleUncheckedCreateWithoutInvoiceInput
        >
      | BillingScheduleCreateWithoutInvoiceInput[]
      | BillingScheduleUncheckedCreateWithoutInvoiceInput[];
    connectOrCreate?:
      | BillingScheduleCreateOrConnectWithoutInvoiceInput
      | BillingScheduleCreateOrConnectWithoutInvoiceInput[];
    createMany?: BillingScheduleCreateManyInvoiceInputEnvelope;
    connect?:
      | BillingScheduleWhereUniqueInput
      | BillingScheduleWhereUniqueInput[];
  };

  export type StringFieldUpdateOperationsInput = {
    set?: string;
  };

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string;
  };

  export type EnumInvoiceStatusFieldUpdateOperationsInput = {
    set?: $Enums.InvoiceStatus;
  };

  export type BigIntFieldUpdateOperationsInput = {
    set?: bigint | number;
    increment?: bigint | number;
    decrement?: bigint | number;
    multiply?: bigint | number;
    divide?: bigint | number;
  };

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null;
  };

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null;
  };

  export type InvoiceItemUpdateManyWithoutInvoiceNestedInput = {
    create?:
      | XOR<
          InvoiceItemCreateWithoutInvoiceInput,
          InvoiceItemUncheckedCreateWithoutInvoiceInput
        >
      | InvoiceItemCreateWithoutInvoiceInput[]
      | InvoiceItemUncheckedCreateWithoutInvoiceInput[];
    connectOrCreate?:
      | InvoiceItemCreateOrConnectWithoutInvoiceInput
      | InvoiceItemCreateOrConnectWithoutInvoiceInput[];
    upsert?:
      | InvoiceItemUpsertWithWhereUniqueWithoutInvoiceInput
      | InvoiceItemUpsertWithWhereUniqueWithoutInvoiceInput[];
    createMany?: InvoiceItemCreateManyInvoiceInputEnvelope;
    set?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[];
    disconnect?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[];
    delete?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[];
    connect?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[];
    update?:
      | InvoiceItemUpdateWithWhereUniqueWithoutInvoiceInput
      | InvoiceItemUpdateWithWhereUniqueWithoutInvoiceInput[];
    updateMany?:
      | InvoiceItemUpdateManyWithWhereWithoutInvoiceInput
      | InvoiceItemUpdateManyWithWhereWithoutInvoiceInput[];
    deleteMany?: InvoiceItemScalarWhereInput | InvoiceItemScalarWhereInput[];
  };

  export type PaymentUpdateManyWithoutInvoiceNestedInput = {
    create?:
      | XOR<
          PaymentCreateWithoutInvoiceInput,
          PaymentUncheckedCreateWithoutInvoiceInput
        >
      | PaymentCreateWithoutInvoiceInput[]
      | PaymentUncheckedCreateWithoutInvoiceInput[];
    connectOrCreate?:
      | PaymentCreateOrConnectWithoutInvoiceInput
      | PaymentCreateOrConnectWithoutInvoiceInput[];
    upsert?:
      | PaymentUpsertWithWhereUniqueWithoutInvoiceInput
      | PaymentUpsertWithWhereUniqueWithoutInvoiceInput[];
    createMany?: PaymentCreateManyInvoiceInputEnvelope;
    set?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[];
    disconnect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[];
    delete?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[];
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[];
    update?:
      | PaymentUpdateWithWhereUniqueWithoutInvoiceInput
      | PaymentUpdateWithWhereUniqueWithoutInvoiceInput[];
    updateMany?:
      | PaymentUpdateManyWithWhereWithoutInvoiceInput
      | PaymentUpdateManyWithWhereWithoutInvoiceInput[];
    deleteMany?: PaymentScalarWhereInput | PaymentScalarWhereInput[];
  };

  export type BillingScheduleUpdateManyWithoutInvoiceNestedInput = {
    create?:
      | XOR<
          BillingScheduleCreateWithoutInvoiceInput,
          BillingScheduleUncheckedCreateWithoutInvoiceInput
        >
      | BillingScheduleCreateWithoutInvoiceInput[]
      | BillingScheduleUncheckedCreateWithoutInvoiceInput[];
    connectOrCreate?:
      | BillingScheduleCreateOrConnectWithoutInvoiceInput
      | BillingScheduleCreateOrConnectWithoutInvoiceInput[];
    upsert?:
      | BillingScheduleUpsertWithWhereUniqueWithoutInvoiceInput
      | BillingScheduleUpsertWithWhereUniqueWithoutInvoiceInput[];
    createMany?: BillingScheduleCreateManyInvoiceInputEnvelope;
    set?: BillingScheduleWhereUniqueInput | BillingScheduleWhereUniqueInput[];
    disconnect?:
      | BillingScheduleWhereUniqueInput
      | BillingScheduleWhereUniqueInput[];
    delete?:
      | BillingScheduleWhereUniqueInput
      | BillingScheduleWhereUniqueInput[];
    connect?:
      | BillingScheduleWhereUniqueInput
      | BillingScheduleWhereUniqueInput[];
    update?:
      | BillingScheduleUpdateWithWhereUniqueWithoutInvoiceInput
      | BillingScheduleUpdateWithWhereUniqueWithoutInvoiceInput[];
    updateMany?:
      | BillingScheduleUpdateManyWithWhereWithoutInvoiceInput
      | BillingScheduleUpdateManyWithWhereWithoutInvoiceInput[];
    deleteMany?:
      | BillingScheduleScalarWhereInput
      | BillingScheduleScalarWhereInput[];
  };

  export type InvoiceItemUncheckedUpdateManyWithoutInvoiceNestedInput = {
    create?:
      | XOR<
          InvoiceItemCreateWithoutInvoiceInput,
          InvoiceItemUncheckedCreateWithoutInvoiceInput
        >
      | InvoiceItemCreateWithoutInvoiceInput[]
      | InvoiceItemUncheckedCreateWithoutInvoiceInput[];
    connectOrCreate?:
      | InvoiceItemCreateOrConnectWithoutInvoiceInput
      | InvoiceItemCreateOrConnectWithoutInvoiceInput[];
    upsert?:
      | InvoiceItemUpsertWithWhereUniqueWithoutInvoiceInput
      | InvoiceItemUpsertWithWhereUniqueWithoutInvoiceInput[];
    createMany?: InvoiceItemCreateManyInvoiceInputEnvelope;
    set?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[];
    disconnect?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[];
    delete?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[];
    connect?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[];
    update?:
      | InvoiceItemUpdateWithWhereUniqueWithoutInvoiceInput
      | InvoiceItemUpdateWithWhereUniqueWithoutInvoiceInput[];
    updateMany?:
      | InvoiceItemUpdateManyWithWhereWithoutInvoiceInput
      | InvoiceItemUpdateManyWithWhereWithoutInvoiceInput[];
    deleteMany?: InvoiceItemScalarWhereInput | InvoiceItemScalarWhereInput[];
  };

  export type PaymentUncheckedUpdateManyWithoutInvoiceNestedInput = {
    create?:
      | XOR<
          PaymentCreateWithoutInvoiceInput,
          PaymentUncheckedCreateWithoutInvoiceInput
        >
      | PaymentCreateWithoutInvoiceInput[]
      | PaymentUncheckedCreateWithoutInvoiceInput[];
    connectOrCreate?:
      | PaymentCreateOrConnectWithoutInvoiceInput
      | PaymentCreateOrConnectWithoutInvoiceInput[];
    upsert?:
      | PaymentUpsertWithWhereUniqueWithoutInvoiceInput
      | PaymentUpsertWithWhereUniqueWithoutInvoiceInput[];
    createMany?: PaymentCreateManyInvoiceInputEnvelope;
    set?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[];
    disconnect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[];
    delete?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[];
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[];
    update?:
      | PaymentUpdateWithWhereUniqueWithoutInvoiceInput
      | PaymentUpdateWithWhereUniqueWithoutInvoiceInput[];
    updateMany?:
      | PaymentUpdateManyWithWhereWithoutInvoiceInput
      | PaymentUpdateManyWithWhereWithoutInvoiceInput[];
    deleteMany?: PaymentScalarWhereInput | PaymentScalarWhereInput[];
  };

  export type BillingScheduleUncheckedUpdateManyWithoutInvoiceNestedInput = {
    create?:
      | XOR<
          BillingScheduleCreateWithoutInvoiceInput,
          BillingScheduleUncheckedCreateWithoutInvoiceInput
        >
      | BillingScheduleCreateWithoutInvoiceInput[]
      | BillingScheduleUncheckedCreateWithoutInvoiceInput[];
    connectOrCreate?:
      | BillingScheduleCreateOrConnectWithoutInvoiceInput
      | BillingScheduleCreateOrConnectWithoutInvoiceInput[];
    upsert?:
      | BillingScheduleUpsertWithWhereUniqueWithoutInvoiceInput
      | BillingScheduleUpsertWithWhereUniqueWithoutInvoiceInput[];
    createMany?: BillingScheduleCreateManyInvoiceInputEnvelope;
    set?: BillingScheduleWhereUniqueInput | BillingScheduleWhereUniqueInput[];
    disconnect?:
      | BillingScheduleWhereUniqueInput
      | BillingScheduleWhereUniqueInput[];
    delete?:
      | BillingScheduleWhereUniqueInput
      | BillingScheduleWhereUniqueInput[];
    connect?:
      | BillingScheduleWhereUniqueInput
      | BillingScheduleWhereUniqueInput[];
    update?:
      | BillingScheduleUpdateWithWhereUniqueWithoutInvoiceInput
      | BillingScheduleUpdateWithWhereUniqueWithoutInvoiceInput[];
    updateMany?:
      | BillingScheduleUpdateManyWithWhereWithoutInvoiceInput
      | BillingScheduleUpdateManyWithWhereWithoutInvoiceInput[];
    deleteMany?:
      | BillingScheduleScalarWhereInput
      | BillingScheduleScalarWhereInput[];
  };

  export type InvoiceCreateNestedOneWithoutBillingSchedulesInput = {
    create?: XOR<
      InvoiceCreateWithoutBillingSchedulesInput,
      InvoiceUncheckedCreateWithoutBillingSchedulesInput
    >;
    connectOrCreate?: InvoiceCreateOrConnectWithoutBillingSchedulesInput;
    connect?: InvoiceWhereUniqueInput;
  };

  export type EnumBillingScheduleJobTypeFieldUpdateOperationsInput = {
    set?: $Enums.BillingScheduleJobType;
  };

  export type EnumBillingScheduleStatusFieldUpdateOperationsInput = {
    set?: $Enums.BillingScheduleStatus;
  };

  export type IntFieldUpdateOperationsInput = {
    set?: number;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
  };

  export type InvoiceUpdateOneWithoutBillingSchedulesNestedInput = {
    create?: XOR<
      InvoiceCreateWithoutBillingSchedulesInput,
      InvoiceUncheckedCreateWithoutBillingSchedulesInput
    >;
    connectOrCreate?: InvoiceCreateOrConnectWithoutBillingSchedulesInput;
    upsert?: InvoiceUpsertWithoutBillingSchedulesInput;
    disconnect?: InvoiceWhereInput | boolean;
    delete?: InvoiceWhereInput | boolean;
    connect?: InvoiceWhereUniqueInput;
    update?: XOR<
      XOR<
        InvoiceUpdateToOneWithWhereWithoutBillingSchedulesInput,
        InvoiceUpdateWithoutBillingSchedulesInput
      >,
      InvoiceUncheckedUpdateWithoutBillingSchedulesInput
    >;
  };

  export type InvoiceCreateNestedOneWithoutInvoiceItemInput = {
    create?: XOR<
      InvoiceCreateWithoutInvoiceItemInput,
      InvoiceUncheckedCreateWithoutInvoiceItemInput
    >;
    connectOrCreate?: InvoiceCreateOrConnectWithoutInvoiceItemInput;
    connect?: InvoiceWhereUniqueInput;
  };

  export type EnumItemTypeFieldUpdateOperationsInput = {
    set?: $Enums.ItemType;
  };

  export type InvoiceUpdateOneRequiredWithoutInvoiceItemNestedInput = {
    create?: XOR<
      InvoiceCreateWithoutInvoiceItemInput,
      InvoiceUncheckedCreateWithoutInvoiceItemInput
    >;
    connectOrCreate?: InvoiceCreateOrConnectWithoutInvoiceItemInput;
    upsert?: InvoiceUpsertWithoutInvoiceItemInput;
    connect?: InvoiceWhereUniqueInput;
    update?: XOR<
      XOR<
        InvoiceUpdateToOneWithWhereWithoutInvoiceItemInput,
        InvoiceUpdateWithoutInvoiceItemInput
      >,
      InvoiceUncheckedUpdateWithoutInvoiceItemInput
    >;
  };

  export type InvoiceCreateNestedOneWithoutPaymentInput = {
    create?: XOR<
      InvoiceCreateWithoutPaymentInput,
      InvoiceUncheckedCreateWithoutPaymentInput
    >;
    connectOrCreate?: InvoiceCreateOrConnectWithoutPaymentInput;
    connect?: InvoiceWhereUniqueInput;
  };

  export type UnmatchedMutationCreateNestedOneWithoutPaymentInput = {
    create?: XOR<
      UnmatchedMutationCreateWithoutPaymentInput,
      UnmatchedMutationUncheckedCreateWithoutPaymentInput
    >;
    connectOrCreate?: UnmatchedMutationCreateOrConnectWithoutPaymentInput;
    connect?: UnmatchedMutationWhereUniqueInput;
  };

  export type EnumPaymentMethodFieldUpdateOperationsInput = {
    set?: $Enums.PaymentMethod;
  };

  export type NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput = {
    set?: $Enums.GatewayPaymentStatus | null;
  };

  export type InvoiceUpdateOneWithoutPaymentNestedInput = {
    create?: XOR<
      InvoiceCreateWithoutPaymentInput,
      InvoiceUncheckedCreateWithoutPaymentInput
    >;
    connectOrCreate?: InvoiceCreateOrConnectWithoutPaymentInput;
    upsert?: InvoiceUpsertWithoutPaymentInput;
    disconnect?: InvoiceWhereInput | boolean;
    delete?: InvoiceWhereInput | boolean;
    connect?: InvoiceWhereUniqueInput;
    update?: XOR<
      XOR<
        InvoiceUpdateToOneWithWhereWithoutPaymentInput,
        InvoiceUpdateWithoutPaymentInput
      >,
      InvoiceUncheckedUpdateWithoutPaymentInput
    >;
  };

  export type UnmatchedMutationUpdateOneWithoutPaymentNestedInput = {
    create?: XOR<
      UnmatchedMutationCreateWithoutPaymentInput,
      UnmatchedMutationUncheckedCreateWithoutPaymentInput
    >;
    connectOrCreate?: UnmatchedMutationCreateOrConnectWithoutPaymentInput;
    upsert?: UnmatchedMutationUpsertWithoutPaymentInput;
    disconnect?: UnmatchedMutationWhereInput | boolean;
    delete?: UnmatchedMutationWhereInput | boolean;
    connect?: UnmatchedMutationWhereUniqueInput;
    update?: XOR<
      XOR<
        UnmatchedMutationUpdateToOneWithWhereWithoutPaymentInput,
        UnmatchedMutationUpdateWithoutPaymentInput
      >,
      UnmatchedMutationUncheckedUpdateWithoutPaymentInput
    >;
  };

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean;
  };

  export type PaymentCreateNestedOneWithoutUnmatchedMutationInput = {
    create?: XOR<
      PaymentCreateWithoutUnmatchedMutationInput,
      PaymentUncheckedCreateWithoutUnmatchedMutationInput
    >;
    connectOrCreate?: PaymentCreateOrConnectWithoutUnmatchedMutationInput;
    connect?: PaymentWhereUniqueInput;
  };

  export type PaymentUncheckedCreateNestedOneWithoutUnmatchedMutationInput = {
    create?: XOR<
      PaymentCreateWithoutUnmatchedMutationInput,
      PaymentUncheckedCreateWithoutUnmatchedMutationInput
    >;
    connectOrCreate?: PaymentCreateOrConnectWithoutUnmatchedMutationInput;
    connect?: PaymentWhereUniqueInput;
  };

  export type DecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string;
    increment?: Decimal | DecimalJsLike | number | string;
    decrement?: Decimal | DecimalJsLike | number | string;
    multiply?: Decimal | DecimalJsLike | number | string;
    divide?: Decimal | DecimalJsLike | number | string;
  };

  export type EnumUnmatchedStatusFieldUpdateOperationsInput = {
    set?: $Enums.UnmatchedStatus;
  };

  export type PaymentUpdateOneWithoutUnmatchedMutationNestedInput = {
    create?: XOR<
      PaymentCreateWithoutUnmatchedMutationInput,
      PaymentUncheckedCreateWithoutUnmatchedMutationInput
    >;
    connectOrCreate?: PaymentCreateOrConnectWithoutUnmatchedMutationInput;
    upsert?: PaymentUpsertWithoutUnmatchedMutationInput;
    disconnect?: PaymentWhereInput | boolean;
    delete?: PaymentWhereInput | boolean;
    connect?: PaymentWhereUniqueInput;
    update?: XOR<
      XOR<
        PaymentUpdateToOneWithWhereWithoutUnmatchedMutationInput,
        PaymentUpdateWithoutUnmatchedMutationInput
      >,
      PaymentUncheckedUpdateWithoutUnmatchedMutationInput
    >;
  };

  export type PaymentUncheckedUpdateOneWithoutUnmatchedMutationNestedInput = {
    create?: XOR<
      PaymentCreateWithoutUnmatchedMutationInput,
      PaymentUncheckedCreateWithoutUnmatchedMutationInput
    >;
    connectOrCreate?: PaymentCreateOrConnectWithoutUnmatchedMutationInput;
    upsert?: PaymentUpsertWithoutUnmatchedMutationInput;
    disconnect?: PaymentWhereInput | boolean;
    delete?: PaymentWhereInput | boolean;
    connect?: PaymentWhereUniqueInput;
    update?: XOR<
      XOR<
        PaymentUpdateToOneWithWhereWithoutUnmatchedMutationInput,
        PaymentUpdateWithoutUnmatchedMutationInput
      >,
      PaymentUncheckedUpdateWithoutUnmatchedMutationInput
    >;
  };

  export type EnumWebhookEventStatusFieldUpdateOperationsInput = {
    set?: $Enums.WebhookEventStatus;
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

  export type NestedEnumInvoiceStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.InvoiceStatus
      | EnumInvoiceStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.InvoiceStatus[]
      | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.InvoiceStatus[]
      | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>;
    not?: NestedEnumInvoiceStatusFilter<$PrismaModel> | $Enums.InvoiceStatus;
  };

  export type NestedBigIntFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>;
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>;
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    not?: NestedBigIntFilter<$PrismaModel> | bigint | number;
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

  export type NestedEnumInvoiceStatusWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.InvoiceStatus
      | EnumInvoiceStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.InvoiceStatus[]
      | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.InvoiceStatus[]
      | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumInvoiceStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.InvoiceStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumInvoiceStatusFilter<$PrismaModel>;
    _max?: NestedEnumInvoiceStatusFilter<$PrismaModel>;
  };

  export type NestedBigIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>;
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>;
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>;
    not?: NestedBigIntWithAggregatesFilter<$PrismaModel> | bigint | number;
    _count?: NestedIntFilter<$PrismaModel>;
    _avg?: NestedFloatFilter<$PrismaModel>;
    _sum?: NestedBigIntFilter<$PrismaModel>;
    _min?: NestedBigIntFilter<$PrismaModel>;
    _max?: NestedBigIntFilter<$PrismaModel>;
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

  export type NestedEnumBillingScheduleJobTypeFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.BillingScheduleJobType
      | EnumBillingScheduleJobTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.BillingScheduleJobType[]
      | ListEnumBillingScheduleJobTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.BillingScheduleJobType[]
      | ListEnumBillingScheduleJobTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumBillingScheduleJobTypeFilter<$PrismaModel>
      | $Enums.BillingScheduleJobType;
  };

  export type NestedEnumBillingScheduleStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.BillingScheduleStatus
      | EnumBillingScheduleStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.BillingScheduleStatus[]
      | ListEnumBillingScheduleStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.BillingScheduleStatus[]
      | ListEnumBillingScheduleStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumBillingScheduleStatusFilter<$PrismaModel>
      | $Enums.BillingScheduleStatus;
  };

  export type NestedEnumBillingScheduleJobTypeWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.BillingScheduleJobType
      | EnumBillingScheduleJobTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.BillingScheduleJobType[]
      | ListEnumBillingScheduleJobTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.BillingScheduleJobType[]
      | ListEnumBillingScheduleJobTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumBillingScheduleJobTypeWithAggregatesFilter<$PrismaModel>
      | $Enums.BillingScheduleJobType;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumBillingScheduleJobTypeFilter<$PrismaModel>;
    _max?: NestedEnumBillingScheduleJobTypeFilter<$PrismaModel>;
  };

  export type NestedEnumBillingScheduleStatusWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.BillingScheduleStatus
      | EnumBillingScheduleStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.BillingScheduleStatus[]
      | ListEnumBillingScheduleStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.BillingScheduleStatus[]
      | ListEnumBillingScheduleStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumBillingScheduleStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.BillingScheduleStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumBillingScheduleStatusFilter<$PrismaModel>;
    _max?: NestedEnumBillingScheduleStatusFilter<$PrismaModel>;
  };
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<
          Required<NestedJsonNullableFilterBase<$PrismaModel>>,
          Exclude<
            keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>,
            "path"
          >
        >,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<
        Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, "path">
      >;

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    path?: string[];
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>;
    string_contains?: string | StringFieldRefInput<$PrismaModel>;
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>;
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>;
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    not?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
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

  export type NestedEnumItemTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.ItemType | EnumItemTypeFieldRefInput<$PrismaModel>;
    in?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>;
    notIn?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>;
    not?: NestedEnumItemTypeFilter<$PrismaModel> | $Enums.ItemType;
  };

  export type NestedEnumItemTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ItemType | EnumItemTypeFieldRefInput<$PrismaModel>;
    in?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>;
    notIn?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumItemTypeWithAggregatesFilter<$PrismaModel>
      | $Enums.ItemType;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumItemTypeFilter<$PrismaModel>;
    _max?: NestedEnumItemTypeFilter<$PrismaModel>;
  };

  export type NestedEnumPaymentMethodFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.PaymentMethod
      | EnumPaymentMethodFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.PaymentMethod[]
      | ListEnumPaymentMethodFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.PaymentMethod[]
      | ListEnumPaymentMethodFieldRefInput<$PrismaModel>;
    not?: NestedEnumPaymentMethodFilter<$PrismaModel> | $Enums.PaymentMethod;
  };

  export type NestedEnumGatewayPaymentStatusNullableFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.GatewayPaymentStatus
      | EnumGatewayPaymentStatusFieldRefInput<$PrismaModel>
      | null;
    in?:
      | $Enums.GatewayPaymentStatus[]
      | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel>
      | null;
    notIn?:
      | $Enums.GatewayPaymentStatus[]
      | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel>
      | null;
    not?:
      | NestedEnumGatewayPaymentStatusNullableFilter<$PrismaModel>
      | $Enums.GatewayPaymentStatus
      | null;
  };

  export type NestedEnumPaymentMethodWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.PaymentMethod
      | EnumPaymentMethodFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.PaymentMethod[]
      | ListEnumPaymentMethodFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.PaymentMethod[]
      | ListEnumPaymentMethodFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumPaymentMethodWithAggregatesFilter<$PrismaModel>
      | $Enums.PaymentMethod;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumPaymentMethodFilter<$PrismaModel>;
    _max?: NestedEnumPaymentMethodFilter<$PrismaModel>;
  };

  export type NestedEnumGatewayPaymentStatusNullableWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.GatewayPaymentStatus
      | EnumGatewayPaymentStatusFieldRefInput<$PrismaModel>
      | null;
    in?:
      | $Enums.GatewayPaymentStatus[]
      | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel>
      | null;
    notIn?:
      | $Enums.GatewayPaymentStatus[]
      | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel>
      | null;
    not?:
      | NestedEnumGatewayPaymentStatusNullableWithAggregatesFilter<$PrismaModel>
      | $Enums.GatewayPaymentStatus
      | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedEnumGatewayPaymentStatusNullableFilter<$PrismaModel>;
    _max?: NestedEnumGatewayPaymentStatusNullableFilter<$PrismaModel>;
  };

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolFilter<$PrismaModel> | boolean;
  };

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedBoolFilter<$PrismaModel>;
    _max?: NestedBoolFilter<$PrismaModel>;
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

  export type NestedEnumUnmatchedStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.UnmatchedStatus
      | EnumUnmatchedStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.UnmatchedStatus[]
      | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.UnmatchedStatus[]
      | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumUnmatchedStatusFilter<$PrismaModel>
      | $Enums.UnmatchedStatus;
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

  export type NestedEnumUnmatchedStatusWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.UnmatchedStatus
      | EnumUnmatchedStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.UnmatchedStatus[]
      | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.UnmatchedStatus[]
      | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumUnmatchedStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.UnmatchedStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumUnmatchedStatusFilter<$PrismaModel>;
    _max?: NestedEnumUnmatchedStatusFilter<$PrismaModel>;
  };

  export type NestedEnumWebhookEventStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.WebhookEventStatus
      | EnumWebhookEventStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.WebhookEventStatus[]
      | ListEnumWebhookEventStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.WebhookEventStatus[]
      | ListEnumWebhookEventStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumWebhookEventStatusFilter<$PrismaModel>
      | $Enums.WebhookEventStatus;
  };
  export type NestedJsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<
          Required<NestedJsonFilterBase<$PrismaModel>>,
          Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, "path">
        >,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, "path">>;

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    path?: string[];
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>;
    string_contains?: string | StringFieldRefInput<$PrismaModel>;
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>;
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>;
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    not?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
  };

  export type NestedEnumWebhookEventStatusWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.WebhookEventStatus
      | EnumWebhookEventStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.WebhookEventStatus[]
      | ListEnumWebhookEventStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.WebhookEventStatus[]
      | ListEnumWebhookEventStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumWebhookEventStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.WebhookEventStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumWebhookEventStatusFilter<$PrismaModel>;
    _max?: NestedEnumWebhookEventStatusFilter<$PrismaModel>;
  };

  export type InvoiceItemCreateWithoutInvoiceInput = {
    id: string;
    description: string;
    quantity?: number;
    unitPrice: bigint | number;
    totalPrice: bigint | number;
    itemType?: $Enums.ItemType;
    tenantId?: string | null;
  };

  export type InvoiceItemUncheckedCreateWithoutInvoiceInput = {
    id: string;
    description: string;
    quantity?: number;
    unitPrice: bigint | number;
    totalPrice: bigint | number;
    itemType?: $Enums.ItemType;
    tenantId?: string | null;
  };

  export type InvoiceItemCreateOrConnectWithoutInvoiceInput = {
    where: InvoiceItemWhereUniqueInput;
    create: XOR<
      InvoiceItemCreateWithoutInvoiceInput,
      InvoiceItemUncheckedCreateWithoutInvoiceInput
    >;
  };

  export type InvoiceItemCreateManyInvoiceInputEnvelope = {
    data:
      | InvoiceItemCreateManyInvoiceInput
      | InvoiceItemCreateManyInvoiceInput[];
    skipDuplicates?: boolean;
  };

  export type PaymentCreateWithoutInvoiceInput = {
    id: string;
    pelangganId: string;
    amount: bigint | number;
    paymentDate: Date | string;
    paymentMethod: $Enums.PaymentMethod;
    reference?: string | null;
    notes?: string | null;
    verifiedBy?: string | null;
    verifiedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    accountId?: string | null;
    gatewayStatus?: $Enums.GatewayPaymentStatus | null;
    gatewayProvider?: string | null;
    transactionId?: string | null;
    paymentUrl?: string | null;
    expiresAt?: Date | string | null;
    receiptUrl?: string | null;
    tenantId?: string | null;
    unmatchedMutation?: UnmatchedMutationCreateNestedOneWithoutPaymentInput;
  };

  export type PaymentUncheckedCreateWithoutInvoiceInput = {
    id: string;
    pelangganId: string;
    amount: bigint | number;
    paymentDate: Date | string;
    paymentMethod: $Enums.PaymentMethod;
    reference?: string | null;
    notes?: string | null;
    verifiedBy?: string | null;
    verifiedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    accountId?: string | null;
    gatewayStatus?: $Enums.GatewayPaymentStatus | null;
    gatewayProvider?: string | null;
    transactionId?: string | null;
    paymentUrl?: string | null;
    expiresAt?: Date | string | null;
    unmatchedMutationId?: string | null;
    receiptUrl?: string | null;
    tenantId?: string | null;
  };

  export type PaymentCreateOrConnectWithoutInvoiceInput = {
    where: PaymentWhereUniqueInput;
    create: XOR<
      PaymentCreateWithoutInvoiceInput,
      PaymentUncheckedCreateWithoutInvoiceInput
    >;
  };

  export type PaymentCreateManyInvoiceInputEnvelope = {
    data: PaymentCreateManyInvoiceInput | PaymentCreateManyInvoiceInput[];
    skipDuplicates?: boolean;
  };

  export type BillingScheduleCreateWithoutInvoiceInput = {
    id?: string;
    dedupeKey: string;
    jobType: $Enums.BillingScheduleJobType;
    pelangganId?: string | null;
    runAt: Date | string;
    status?: $Enums.BillingScheduleStatus;
    queueJobId?: string | null;
    payload?: NullableJsonNullValueInput | InputJsonValue;
    version?: number;
    attemptCount?: number;
    queuedAt?: Date | string | null;
    processingAt?: Date | string | null;
    completedAt?: Date | string | null;
    cancelledAt?: Date | string | null;
    failedAt?: Date | string | null;
    lastAttemptAt?: Date | string | null;
    lastError?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
  };

  export type BillingScheduleUncheckedCreateWithoutInvoiceInput = {
    id?: string;
    dedupeKey: string;
    jobType: $Enums.BillingScheduleJobType;
    pelangganId?: string | null;
    runAt: Date | string;
    status?: $Enums.BillingScheduleStatus;
    queueJobId?: string | null;
    payload?: NullableJsonNullValueInput | InputJsonValue;
    version?: number;
    attemptCount?: number;
    queuedAt?: Date | string | null;
    processingAt?: Date | string | null;
    completedAt?: Date | string | null;
    cancelledAt?: Date | string | null;
    failedAt?: Date | string | null;
    lastAttemptAt?: Date | string | null;
    lastError?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
  };

  export type BillingScheduleCreateOrConnectWithoutInvoiceInput = {
    where: BillingScheduleWhereUniqueInput;
    create: XOR<
      BillingScheduleCreateWithoutInvoiceInput,
      BillingScheduleUncheckedCreateWithoutInvoiceInput
    >;
  };

  export type BillingScheduleCreateManyInvoiceInputEnvelope = {
    data:
      | BillingScheduleCreateManyInvoiceInput
      | BillingScheduleCreateManyInvoiceInput[];
    skipDuplicates?: boolean;
  };

  export type InvoiceItemUpsertWithWhereUniqueWithoutInvoiceInput = {
    where: InvoiceItemWhereUniqueInput;
    update: XOR<
      InvoiceItemUpdateWithoutInvoiceInput,
      InvoiceItemUncheckedUpdateWithoutInvoiceInput
    >;
    create: XOR<
      InvoiceItemCreateWithoutInvoiceInput,
      InvoiceItemUncheckedCreateWithoutInvoiceInput
    >;
  };

  export type InvoiceItemUpdateWithWhereUniqueWithoutInvoiceInput = {
    where: InvoiceItemWhereUniqueInput;
    data: XOR<
      InvoiceItemUpdateWithoutInvoiceInput,
      InvoiceItemUncheckedUpdateWithoutInvoiceInput
    >;
  };

  export type InvoiceItemUpdateManyWithWhereWithoutInvoiceInput = {
    where: InvoiceItemScalarWhereInput;
    data: XOR<
      InvoiceItemUpdateManyMutationInput,
      InvoiceItemUncheckedUpdateManyWithoutInvoiceInput
    >;
  };

  export type InvoiceItemScalarWhereInput = {
    AND?: InvoiceItemScalarWhereInput | InvoiceItemScalarWhereInput[];
    OR?: InvoiceItemScalarWhereInput[];
    NOT?: InvoiceItemScalarWhereInput | InvoiceItemScalarWhereInput[];
    id?: StringFilter<"InvoiceItem"> | string;
    invoiceId?: StringFilter<"InvoiceItem"> | string;
    description?: StringFilter<"InvoiceItem"> | string;
    quantity?: IntFilter<"InvoiceItem"> | number;
    unitPrice?: BigIntFilter<"InvoiceItem"> | bigint | number;
    totalPrice?: BigIntFilter<"InvoiceItem"> | bigint | number;
    itemType?: EnumItemTypeFilter<"InvoiceItem"> | $Enums.ItemType;
    tenantId?: StringNullableFilter<"InvoiceItem"> | string | null;
  };

  export type PaymentUpsertWithWhereUniqueWithoutInvoiceInput = {
    where: PaymentWhereUniqueInput;
    update: XOR<
      PaymentUpdateWithoutInvoiceInput,
      PaymentUncheckedUpdateWithoutInvoiceInput
    >;
    create: XOR<
      PaymentCreateWithoutInvoiceInput,
      PaymentUncheckedCreateWithoutInvoiceInput
    >;
  };

  export type PaymentUpdateWithWhereUniqueWithoutInvoiceInput = {
    where: PaymentWhereUniqueInput;
    data: XOR<
      PaymentUpdateWithoutInvoiceInput,
      PaymentUncheckedUpdateWithoutInvoiceInput
    >;
  };

  export type PaymentUpdateManyWithWhereWithoutInvoiceInput = {
    where: PaymentScalarWhereInput;
    data: XOR<
      PaymentUpdateManyMutationInput,
      PaymentUncheckedUpdateManyWithoutInvoiceInput
    >;
  };

  export type PaymentScalarWhereInput = {
    AND?: PaymentScalarWhereInput | PaymentScalarWhereInput[];
    OR?: PaymentScalarWhereInput[];
    NOT?: PaymentScalarWhereInput | PaymentScalarWhereInput[];
    id?: StringFilter<"Payment"> | string;
    invoiceId?: StringNullableFilter<"Payment"> | string | null;
    pelangganId?: StringFilter<"Payment"> | string;
    amount?: BigIntFilter<"Payment"> | bigint | number;
    paymentDate?: DateTimeFilter<"Payment"> | Date | string;
    paymentMethod?: EnumPaymentMethodFilter<"Payment"> | $Enums.PaymentMethod;
    reference?: StringNullableFilter<"Payment"> | string | null;
    notes?: StringNullableFilter<"Payment"> | string | null;
    verifiedBy?: StringNullableFilter<"Payment"> | string | null;
    verifiedAt?: DateTimeNullableFilter<"Payment"> | Date | string | null;
    createdAt?: DateTimeFilter<"Payment"> | Date | string;
    updatedAt?: DateTimeFilter<"Payment"> | Date | string;
    accountId?: StringNullableFilter<"Payment"> | string | null;
    gatewayStatus?:
      | EnumGatewayPaymentStatusNullableFilter<"Payment">
      | $Enums.GatewayPaymentStatus
      | null;
    gatewayProvider?: StringNullableFilter<"Payment"> | string | null;
    transactionId?: StringNullableFilter<"Payment"> | string | null;
    paymentUrl?: StringNullableFilter<"Payment"> | string | null;
    expiresAt?: DateTimeNullableFilter<"Payment"> | Date | string | null;
    unmatchedMutationId?: StringNullableFilter<"Payment"> | string | null;
    receiptUrl?: StringNullableFilter<"Payment"> | string | null;
    tenantId?: StringNullableFilter<"Payment"> | string | null;
  };

  export type BillingScheduleUpsertWithWhereUniqueWithoutInvoiceInput = {
    where: BillingScheduleWhereUniqueInput;
    update: XOR<
      BillingScheduleUpdateWithoutInvoiceInput,
      BillingScheduleUncheckedUpdateWithoutInvoiceInput
    >;
    create: XOR<
      BillingScheduleCreateWithoutInvoiceInput,
      BillingScheduleUncheckedCreateWithoutInvoiceInput
    >;
  };

  export type BillingScheduleUpdateWithWhereUniqueWithoutInvoiceInput = {
    where: BillingScheduleWhereUniqueInput;
    data: XOR<
      BillingScheduleUpdateWithoutInvoiceInput,
      BillingScheduleUncheckedUpdateWithoutInvoiceInput
    >;
  };

  export type BillingScheduleUpdateManyWithWhereWithoutInvoiceInput = {
    where: BillingScheduleScalarWhereInput;
    data: XOR<
      BillingScheduleUpdateManyMutationInput,
      BillingScheduleUncheckedUpdateManyWithoutInvoiceInput
    >;
  };

  export type BillingScheduleScalarWhereInput = {
    AND?: BillingScheduleScalarWhereInput | BillingScheduleScalarWhereInput[];
    OR?: BillingScheduleScalarWhereInput[];
    NOT?: BillingScheduleScalarWhereInput | BillingScheduleScalarWhereInput[];
    id?: StringFilter<"BillingSchedule"> | string;
    dedupeKey?: StringFilter<"BillingSchedule"> | string;
    jobType?:
      | EnumBillingScheduleJobTypeFilter<"BillingSchedule">
      | $Enums.BillingScheduleJobType;
    invoiceId?: StringNullableFilter<"BillingSchedule"> | string | null;
    pelangganId?: StringNullableFilter<"BillingSchedule"> | string | null;
    runAt?: DateTimeFilter<"BillingSchedule"> | Date | string;
    status?:
      | EnumBillingScheduleStatusFilter<"BillingSchedule">
      | $Enums.BillingScheduleStatus;
    queueJobId?: StringNullableFilter<"BillingSchedule"> | string | null;
    payload?: JsonNullableFilter<"BillingSchedule">;
    version?: IntFilter<"BillingSchedule"> | number;
    attemptCount?: IntFilter<"BillingSchedule"> | number;
    queuedAt?: DateTimeNullableFilter<"BillingSchedule"> | Date | string | null;
    processingAt?:
      | DateTimeNullableFilter<"BillingSchedule">
      | Date
      | string
      | null;
    completedAt?:
      | DateTimeNullableFilter<"BillingSchedule">
      | Date
      | string
      | null;
    cancelledAt?:
      | DateTimeNullableFilter<"BillingSchedule">
      | Date
      | string
      | null;
    failedAt?: DateTimeNullableFilter<"BillingSchedule"> | Date | string | null;
    lastAttemptAt?:
      | DateTimeNullableFilter<"BillingSchedule">
      | Date
      | string
      | null;
    lastError?: StringNullableFilter<"BillingSchedule"> | string | null;
    createdAt?: DateTimeFilter<"BillingSchedule"> | Date | string;
    updatedAt?: DateTimeFilter<"BillingSchedule"> | Date | string;
    tenantId?: StringNullableFilter<"BillingSchedule"> | string | null;
  };

  export type InvoiceCreateWithoutBillingSchedulesInput = {
    id: string;
    invoiceNumber: string;
    pelangganId: string;
    issueDate?: Date | string;
    dueDate: Date | string;
    status?: $Enums.InvoiceStatus;
    subtotal?: bigint | number;
    taxAmount?: bigint | number;
    discountAmount?: bigint | number;
    totalAmount?: bigint | number;
    paidAmount?: bigint | number;
    notes?: string | null;
    terms?: string | null;
    sentAt?: Date | string | null;
    paidAt?: Date | string | null;
    createdBy?: string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    siteId?: string | null;
    tenantId?: string | null;
    invoiceItem?: InvoiceItemCreateNestedManyWithoutInvoiceInput;
    payment?: PaymentCreateNestedManyWithoutInvoiceInput;
  };

  export type InvoiceUncheckedCreateWithoutBillingSchedulesInput = {
    id: string;
    invoiceNumber: string;
    pelangganId: string;
    issueDate?: Date | string;
    dueDate: Date | string;
    status?: $Enums.InvoiceStatus;
    subtotal?: bigint | number;
    taxAmount?: bigint | number;
    discountAmount?: bigint | number;
    totalAmount?: bigint | number;
    paidAmount?: bigint | number;
    notes?: string | null;
    terms?: string | null;
    sentAt?: Date | string | null;
    paidAt?: Date | string | null;
    createdBy?: string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    siteId?: string | null;
    tenantId?: string | null;
    invoiceItem?: InvoiceItemUncheckedCreateNestedManyWithoutInvoiceInput;
    payment?: PaymentUncheckedCreateNestedManyWithoutInvoiceInput;
  };

  export type InvoiceCreateOrConnectWithoutBillingSchedulesInput = {
    where: InvoiceWhereUniqueInput;
    create: XOR<
      InvoiceCreateWithoutBillingSchedulesInput,
      InvoiceUncheckedCreateWithoutBillingSchedulesInput
    >;
  };

  export type InvoiceUpsertWithoutBillingSchedulesInput = {
    update: XOR<
      InvoiceUpdateWithoutBillingSchedulesInput,
      InvoiceUncheckedUpdateWithoutBillingSchedulesInput
    >;
    create: XOR<
      InvoiceCreateWithoutBillingSchedulesInput,
      InvoiceUncheckedCreateWithoutBillingSchedulesInput
    >;
    where?: InvoiceWhereInput;
  };

  export type InvoiceUpdateToOneWithWhereWithoutBillingSchedulesInput = {
    where?: InvoiceWhereInput;
    data: XOR<
      InvoiceUpdateWithoutBillingSchedulesInput,
      InvoiceUncheckedUpdateWithoutBillingSchedulesInput
    >;
  };

  export type InvoiceUpdateWithoutBillingSchedulesInput = {
    id?: StringFieldUpdateOperationsInput | string;
    invoiceNumber?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus;
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number;
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    terms?: NullableStringFieldUpdateOperationsInput | string | null;
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    invoiceItem?: InvoiceItemUpdateManyWithoutInvoiceNestedInput;
    payment?: PaymentUpdateManyWithoutInvoiceNestedInput;
  };

  export type InvoiceUncheckedUpdateWithoutBillingSchedulesInput = {
    id?: StringFieldUpdateOperationsInput | string;
    invoiceNumber?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus;
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number;
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    terms?: NullableStringFieldUpdateOperationsInput | string | null;
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    invoiceItem?: InvoiceItemUncheckedUpdateManyWithoutInvoiceNestedInput;
    payment?: PaymentUncheckedUpdateManyWithoutInvoiceNestedInput;
  };

  export type InvoiceCreateWithoutInvoiceItemInput = {
    id: string;
    invoiceNumber: string;
    pelangganId: string;
    issueDate?: Date | string;
    dueDate: Date | string;
    status?: $Enums.InvoiceStatus;
    subtotal?: bigint | number;
    taxAmount?: bigint | number;
    discountAmount?: bigint | number;
    totalAmount?: bigint | number;
    paidAmount?: bigint | number;
    notes?: string | null;
    terms?: string | null;
    sentAt?: Date | string | null;
    paidAt?: Date | string | null;
    createdBy?: string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    siteId?: string | null;
    tenantId?: string | null;
    payment?: PaymentCreateNestedManyWithoutInvoiceInput;
    billingSchedules?: BillingScheduleCreateNestedManyWithoutInvoiceInput;
  };

  export type InvoiceUncheckedCreateWithoutInvoiceItemInput = {
    id: string;
    invoiceNumber: string;
    pelangganId: string;
    issueDate?: Date | string;
    dueDate: Date | string;
    status?: $Enums.InvoiceStatus;
    subtotal?: bigint | number;
    taxAmount?: bigint | number;
    discountAmount?: bigint | number;
    totalAmount?: bigint | number;
    paidAmount?: bigint | number;
    notes?: string | null;
    terms?: string | null;
    sentAt?: Date | string | null;
    paidAt?: Date | string | null;
    createdBy?: string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    siteId?: string | null;
    tenantId?: string | null;
    payment?: PaymentUncheckedCreateNestedManyWithoutInvoiceInput;
    billingSchedules?: BillingScheduleUncheckedCreateNestedManyWithoutInvoiceInput;
  };

  export type InvoiceCreateOrConnectWithoutInvoiceItemInput = {
    where: InvoiceWhereUniqueInput;
    create: XOR<
      InvoiceCreateWithoutInvoiceItemInput,
      InvoiceUncheckedCreateWithoutInvoiceItemInput
    >;
  };

  export type InvoiceUpsertWithoutInvoiceItemInput = {
    update: XOR<
      InvoiceUpdateWithoutInvoiceItemInput,
      InvoiceUncheckedUpdateWithoutInvoiceItemInput
    >;
    create: XOR<
      InvoiceCreateWithoutInvoiceItemInput,
      InvoiceUncheckedCreateWithoutInvoiceItemInput
    >;
    where?: InvoiceWhereInput;
  };

  export type InvoiceUpdateToOneWithWhereWithoutInvoiceItemInput = {
    where?: InvoiceWhereInput;
    data: XOR<
      InvoiceUpdateWithoutInvoiceItemInput,
      InvoiceUncheckedUpdateWithoutInvoiceItemInput
    >;
  };

  export type InvoiceUpdateWithoutInvoiceItemInput = {
    id?: StringFieldUpdateOperationsInput | string;
    invoiceNumber?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus;
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number;
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    terms?: NullableStringFieldUpdateOperationsInput | string | null;
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    payment?: PaymentUpdateManyWithoutInvoiceNestedInput;
    billingSchedules?: BillingScheduleUpdateManyWithoutInvoiceNestedInput;
  };

  export type InvoiceUncheckedUpdateWithoutInvoiceItemInput = {
    id?: StringFieldUpdateOperationsInput | string;
    invoiceNumber?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus;
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number;
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    terms?: NullableStringFieldUpdateOperationsInput | string | null;
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    payment?: PaymentUncheckedUpdateManyWithoutInvoiceNestedInput;
    billingSchedules?: BillingScheduleUncheckedUpdateManyWithoutInvoiceNestedInput;
  };

  export type InvoiceCreateWithoutPaymentInput = {
    id: string;
    invoiceNumber: string;
    pelangganId: string;
    issueDate?: Date | string;
    dueDate: Date | string;
    status?: $Enums.InvoiceStatus;
    subtotal?: bigint | number;
    taxAmount?: bigint | number;
    discountAmount?: bigint | number;
    totalAmount?: bigint | number;
    paidAmount?: bigint | number;
    notes?: string | null;
    terms?: string | null;
    sentAt?: Date | string | null;
    paidAt?: Date | string | null;
    createdBy?: string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    siteId?: string | null;
    tenantId?: string | null;
    invoiceItem?: InvoiceItemCreateNestedManyWithoutInvoiceInput;
    billingSchedules?: BillingScheduleCreateNestedManyWithoutInvoiceInput;
  };

  export type InvoiceUncheckedCreateWithoutPaymentInput = {
    id: string;
    invoiceNumber: string;
    pelangganId: string;
    issueDate?: Date | string;
    dueDate: Date | string;
    status?: $Enums.InvoiceStatus;
    subtotal?: bigint | number;
    taxAmount?: bigint | number;
    discountAmount?: bigint | number;
    totalAmount?: bigint | number;
    paidAmount?: bigint | number;
    notes?: string | null;
    terms?: string | null;
    sentAt?: Date | string | null;
    paidAt?: Date | string | null;
    createdBy?: string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    siteId?: string | null;
    tenantId?: string | null;
    invoiceItem?: InvoiceItemUncheckedCreateNestedManyWithoutInvoiceInput;
    billingSchedules?: BillingScheduleUncheckedCreateNestedManyWithoutInvoiceInput;
  };

  export type InvoiceCreateOrConnectWithoutPaymentInput = {
    where: InvoiceWhereUniqueInput;
    create: XOR<
      InvoiceCreateWithoutPaymentInput,
      InvoiceUncheckedCreateWithoutPaymentInput
    >;
  };

  export type UnmatchedMutationCreateWithoutPaymentInput = {
    id?: string;
    provider?: string;
    transactionId?: string | null;
    amount: Decimal | DecimalJsLike | number | string;
    description?: string | null;
    type?: string | null;
    date: Date | string;
    bankId?: string | null;
    rawPayload?: NullableJsonNullValueInput | InputJsonValue;
    status?: $Enums.UnmatchedStatus;
    resolvedAt?: Date | string | null;
    resolvedById?: string | null;
    matchedInvoiceId?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
  };

  export type UnmatchedMutationUncheckedCreateWithoutPaymentInput = {
    id?: string;
    provider?: string;
    transactionId?: string | null;
    amount: Decimal | DecimalJsLike | number | string;
    description?: string | null;
    type?: string | null;
    date: Date | string;
    bankId?: string | null;
    rawPayload?: NullableJsonNullValueInput | InputJsonValue;
    status?: $Enums.UnmatchedStatus;
    resolvedAt?: Date | string | null;
    resolvedById?: string | null;
    matchedInvoiceId?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
  };

  export type UnmatchedMutationCreateOrConnectWithoutPaymentInput = {
    where: UnmatchedMutationWhereUniqueInput;
    create: XOR<
      UnmatchedMutationCreateWithoutPaymentInput,
      UnmatchedMutationUncheckedCreateWithoutPaymentInput
    >;
  };

  export type InvoiceUpsertWithoutPaymentInput = {
    update: XOR<
      InvoiceUpdateWithoutPaymentInput,
      InvoiceUncheckedUpdateWithoutPaymentInput
    >;
    create: XOR<
      InvoiceCreateWithoutPaymentInput,
      InvoiceUncheckedCreateWithoutPaymentInput
    >;
    where?: InvoiceWhereInput;
  };

  export type InvoiceUpdateToOneWithWhereWithoutPaymentInput = {
    where?: InvoiceWhereInput;
    data: XOR<
      InvoiceUpdateWithoutPaymentInput,
      InvoiceUncheckedUpdateWithoutPaymentInput
    >;
  };

  export type InvoiceUpdateWithoutPaymentInput = {
    id?: StringFieldUpdateOperationsInput | string;
    invoiceNumber?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus;
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number;
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    terms?: NullableStringFieldUpdateOperationsInput | string | null;
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    invoiceItem?: InvoiceItemUpdateManyWithoutInvoiceNestedInput;
    billingSchedules?: BillingScheduleUpdateManyWithoutInvoiceNestedInput;
  };

  export type InvoiceUncheckedUpdateWithoutPaymentInput = {
    id?: StringFieldUpdateOperationsInput | string;
    invoiceNumber?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus;
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number;
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    terms?: NullableStringFieldUpdateOperationsInput | string | null;
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    siteId?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    invoiceItem?: InvoiceItemUncheckedUpdateManyWithoutInvoiceNestedInput;
    billingSchedules?: BillingScheduleUncheckedUpdateManyWithoutInvoiceNestedInput;
  };

  export type UnmatchedMutationUpsertWithoutPaymentInput = {
    update: XOR<
      UnmatchedMutationUpdateWithoutPaymentInput,
      UnmatchedMutationUncheckedUpdateWithoutPaymentInput
    >;
    create: XOR<
      UnmatchedMutationCreateWithoutPaymentInput,
      UnmatchedMutationUncheckedCreateWithoutPaymentInput
    >;
    where?: UnmatchedMutationWhereInput;
  };

  export type UnmatchedMutationUpdateToOneWithWhereWithoutPaymentInput = {
    where?: UnmatchedMutationWhereInput;
    data: XOR<
      UnmatchedMutationUpdateWithoutPaymentInput,
      UnmatchedMutationUncheckedUpdateWithoutPaymentInput
    >;
  };

  export type UnmatchedMutationUpdateWithoutPaymentInput = {
    id?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    amount?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    description?: NullableStringFieldUpdateOperationsInput | string | null;
    type?: NullableStringFieldUpdateOperationsInput | string | null;
    date?: DateTimeFieldUpdateOperationsInput | Date | string;
    bankId?: NullableStringFieldUpdateOperationsInput | string | null;
    rawPayload?: NullableJsonNullValueInput | InputJsonValue;
    status?:
      | EnumUnmatchedStatusFieldUpdateOperationsInput
      | $Enums.UnmatchedStatus;
    resolvedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    resolvedById?: NullableStringFieldUpdateOperationsInput | string | null;
    matchedInvoiceId?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type UnmatchedMutationUncheckedUpdateWithoutPaymentInput = {
    id?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    amount?:
      | DecimalFieldUpdateOperationsInput
      | Decimal
      | DecimalJsLike
      | number
      | string;
    description?: NullableStringFieldUpdateOperationsInput | string | null;
    type?: NullableStringFieldUpdateOperationsInput | string | null;
    date?: DateTimeFieldUpdateOperationsInput | Date | string;
    bankId?: NullableStringFieldUpdateOperationsInput | string | null;
    rawPayload?: NullableJsonNullValueInput | InputJsonValue;
    status?:
      | EnumUnmatchedStatusFieldUpdateOperationsInput
      | $Enums.UnmatchedStatus;
    resolvedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    resolvedById?: NullableStringFieldUpdateOperationsInput | string | null;
    matchedInvoiceId?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type PaymentCreateWithoutUnmatchedMutationInput = {
    id: string;
    pelangganId: string;
    amount: bigint | number;
    paymentDate: Date | string;
    paymentMethod: $Enums.PaymentMethod;
    reference?: string | null;
    notes?: string | null;
    verifiedBy?: string | null;
    verifiedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    accountId?: string | null;
    gatewayStatus?: $Enums.GatewayPaymentStatus | null;
    gatewayProvider?: string | null;
    transactionId?: string | null;
    paymentUrl?: string | null;
    expiresAt?: Date | string | null;
    receiptUrl?: string | null;
    tenantId?: string | null;
    invoice?: InvoiceCreateNestedOneWithoutPaymentInput;
  };

  export type PaymentUncheckedCreateWithoutUnmatchedMutationInput = {
    id: string;
    invoiceId?: string | null;
    pelangganId: string;
    amount: bigint | number;
    paymentDate: Date | string;
    paymentMethod: $Enums.PaymentMethod;
    reference?: string | null;
    notes?: string | null;
    verifiedBy?: string | null;
    verifiedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    accountId?: string | null;
    gatewayStatus?: $Enums.GatewayPaymentStatus | null;
    gatewayProvider?: string | null;
    transactionId?: string | null;
    paymentUrl?: string | null;
    expiresAt?: Date | string | null;
    receiptUrl?: string | null;
    tenantId?: string | null;
  };

  export type PaymentCreateOrConnectWithoutUnmatchedMutationInput = {
    where: PaymentWhereUniqueInput;
    create: XOR<
      PaymentCreateWithoutUnmatchedMutationInput,
      PaymentUncheckedCreateWithoutUnmatchedMutationInput
    >;
  };

  export type PaymentUpsertWithoutUnmatchedMutationInput = {
    update: XOR<
      PaymentUpdateWithoutUnmatchedMutationInput,
      PaymentUncheckedUpdateWithoutUnmatchedMutationInput
    >;
    create: XOR<
      PaymentCreateWithoutUnmatchedMutationInput,
      PaymentUncheckedCreateWithoutUnmatchedMutationInput
    >;
    where?: PaymentWhereInput;
  };

  export type PaymentUpdateToOneWithWhereWithoutUnmatchedMutationInput = {
    where?: PaymentWhereInput;
    data: XOR<
      PaymentUpdateWithoutUnmatchedMutationInput,
      PaymentUncheckedUpdateWithoutUnmatchedMutationInput
    >;
  };

  export type PaymentUpdateWithoutUnmatchedMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    amount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    paymentMethod?:
      | EnumPaymentMethodFieldUpdateOperationsInput
      | $Enums.PaymentMethod;
    reference?: NullableStringFieldUpdateOperationsInput | string | null;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accountId?: NullableStringFieldUpdateOperationsInput | string | null;
    gatewayStatus?:
      | NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput
      | $Enums.GatewayPaymentStatus
      | null;
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    expiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    invoice?: InvoiceUpdateOneWithoutPaymentNestedInput;
  };

  export type PaymentUncheckedUpdateWithoutUnmatchedMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    invoiceId?: NullableStringFieldUpdateOperationsInput | string | null;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    amount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    paymentMethod?:
      | EnumPaymentMethodFieldUpdateOperationsInput
      | $Enums.PaymentMethod;
    reference?: NullableStringFieldUpdateOperationsInput | string | null;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accountId?: NullableStringFieldUpdateOperationsInput | string | null;
    gatewayStatus?:
      | NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput
      | $Enums.GatewayPaymentStatus
      | null;
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    expiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type InvoiceItemCreateManyInvoiceInput = {
    id: string;
    description: string;
    quantity?: number;
    unitPrice: bigint | number;
    totalPrice: bigint | number;
    itemType?: $Enums.ItemType;
    tenantId?: string | null;
  };

  export type PaymentCreateManyInvoiceInput = {
    id: string;
    pelangganId: string;
    amount: bigint | number;
    paymentDate: Date | string;
    paymentMethod: $Enums.PaymentMethod;
    reference?: string | null;
    notes?: string | null;
    verifiedBy?: string | null;
    verifiedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt: Date | string;
    accountId?: string | null;
    gatewayStatus?: $Enums.GatewayPaymentStatus | null;
    gatewayProvider?: string | null;
    transactionId?: string | null;
    paymentUrl?: string | null;
    expiresAt?: Date | string | null;
    unmatchedMutationId?: string | null;
    receiptUrl?: string | null;
    tenantId?: string | null;
  };

  export type BillingScheduleCreateManyInvoiceInput = {
    id?: string;
    dedupeKey: string;
    jobType: $Enums.BillingScheduleJobType;
    pelangganId?: string | null;
    runAt: Date | string;
    status?: $Enums.BillingScheduleStatus;
    queueJobId?: string | null;
    payload?: NullableJsonNullValueInput | InputJsonValue;
    version?: number;
    attemptCount?: number;
    queuedAt?: Date | string | null;
    processingAt?: Date | string | null;
    completedAt?: Date | string | null;
    cancelledAt?: Date | string | null;
    failedAt?: Date | string | null;
    lastAttemptAt?: Date | string | null;
    lastError?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenantId?: string | null;
  };

  export type InvoiceItemUpdateWithoutInvoiceInput = {
    id?: StringFieldUpdateOperationsInput | string;
    description?: StringFieldUpdateOperationsInput | string;
    quantity?: IntFieldUpdateOperationsInput | number;
    unitPrice?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalPrice?: BigIntFieldUpdateOperationsInput | bigint | number;
    itemType?: EnumItemTypeFieldUpdateOperationsInput | $Enums.ItemType;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type InvoiceItemUncheckedUpdateWithoutInvoiceInput = {
    id?: StringFieldUpdateOperationsInput | string;
    description?: StringFieldUpdateOperationsInput | string;
    quantity?: IntFieldUpdateOperationsInput | number;
    unitPrice?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalPrice?: BigIntFieldUpdateOperationsInput | bigint | number;
    itemType?: EnumItemTypeFieldUpdateOperationsInput | $Enums.ItemType;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type InvoiceItemUncheckedUpdateManyWithoutInvoiceInput = {
    id?: StringFieldUpdateOperationsInput | string;
    description?: StringFieldUpdateOperationsInput | string;
    quantity?: IntFieldUpdateOperationsInput | number;
    unitPrice?: BigIntFieldUpdateOperationsInput | bigint | number;
    totalPrice?: BigIntFieldUpdateOperationsInput | bigint | number;
    itemType?: EnumItemTypeFieldUpdateOperationsInput | $Enums.ItemType;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type PaymentUpdateWithoutInvoiceInput = {
    id?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    amount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    paymentMethod?:
      | EnumPaymentMethodFieldUpdateOperationsInput
      | $Enums.PaymentMethod;
    reference?: NullableStringFieldUpdateOperationsInput | string | null;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accountId?: NullableStringFieldUpdateOperationsInput | string | null;
    gatewayStatus?:
      | NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput
      | $Enums.GatewayPaymentStatus
      | null;
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    expiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    unmatchedMutation?: UnmatchedMutationUpdateOneWithoutPaymentNestedInput;
  };

  export type PaymentUncheckedUpdateWithoutInvoiceInput = {
    id?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    amount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    paymentMethod?:
      | EnumPaymentMethodFieldUpdateOperationsInput
      | $Enums.PaymentMethod;
    reference?: NullableStringFieldUpdateOperationsInput | string | null;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accountId?: NullableStringFieldUpdateOperationsInput | string | null;
    gatewayStatus?:
      | NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput
      | $Enums.GatewayPaymentStatus
      | null;
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    expiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    unmatchedMutationId?:
      | NullableStringFieldUpdateOperationsInput
      | string
      | null;
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type PaymentUncheckedUpdateManyWithoutInvoiceInput = {
    id?: StringFieldUpdateOperationsInput | string;
    pelangganId?: StringFieldUpdateOperationsInput | string;
    amount?: BigIntFieldUpdateOperationsInput | bigint | number;
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string;
    paymentMethod?:
      | EnumPaymentMethodFieldUpdateOperationsInput
      | $Enums.PaymentMethod;
    reference?: NullableStringFieldUpdateOperationsInput | string | null;
    notes?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null;
    verifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accountId?: NullableStringFieldUpdateOperationsInput | string | null;
    gatewayStatus?:
      | NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput
      | $Enums.GatewayPaymentStatus
      | null;
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null;
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null;
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    expiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    unmatchedMutationId?:
      | NullableStringFieldUpdateOperationsInput
      | string
      | null;
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type BillingScheduleUpdateWithoutInvoiceInput = {
    id?: StringFieldUpdateOperationsInput | string;
    dedupeKey?: StringFieldUpdateOperationsInput | string;
    jobType?:
      | EnumBillingScheduleJobTypeFieldUpdateOperationsInput
      | $Enums.BillingScheduleJobType;
    pelangganId?: NullableStringFieldUpdateOperationsInput | string | null;
    runAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?:
      | EnumBillingScheduleStatusFieldUpdateOperationsInput
      | $Enums.BillingScheduleStatus;
    queueJobId?: NullableStringFieldUpdateOperationsInput | string | null;
    payload?: NullableJsonNullValueInput | InputJsonValue;
    version?: IntFieldUpdateOperationsInput | number;
    attemptCount?: IntFieldUpdateOperationsInput | number;
    queuedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    processingAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    completedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    cancelledAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    failedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastAttemptAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastError?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type BillingScheduleUncheckedUpdateWithoutInvoiceInput = {
    id?: StringFieldUpdateOperationsInput | string;
    dedupeKey?: StringFieldUpdateOperationsInput | string;
    jobType?:
      | EnumBillingScheduleJobTypeFieldUpdateOperationsInput
      | $Enums.BillingScheduleJobType;
    pelangganId?: NullableStringFieldUpdateOperationsInput | string | null;
    runAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?:
      | EnumBillingScheduleStatusFieldUpdateOperationsInput
      | $Enums.BillingScheduleStatus;
    queueJobId?: NullableStringFieldUpdateOperationsInput | string | null;
    payload?: NullableJsonNullValueInput | InputJsonValue;
    version?: IntFieldUpdateOperationsInput | number;
    attemptCount?: IntFieldUpdateOperationsInput | number;
    queuedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    processingAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    completedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    cancelledAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    failedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastAttemptAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastError?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type BillingScheduleUncheckedUpdateManyWithoutInvoiceInput = {
    id?: StringFieldUpdateOperationsInput | string;
    dedupeKey?: StringFieldUpdateOperationsInput | string;
    jobType?:
      | EnumBillingScheduleJobTypeFieldUpdateOperationsInput
      | $Enums.BillingScheduleJobType;
    pelangganId?: NullableStringFieldUpdateOperationsInput | string | null;
    runAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    status?:
      | EnumBillingScheduleStatusFieldUpdateOperationsInput
      | $Enums.BillingScheduleStatus;
    queueJobId?: NullableStringFieldUpdateOperationsInput | string | null;
    payload?: NullableJsonNullValueInput | InputJsonValue;
    version?: IntFieldUpdateOperationsInput | number;
    attemptCount?: IntFieldUpdateOperationsInput | number;
    queuedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    processingAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    completedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    cancelledAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    failedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastAttemptAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastError?: NullableStringFieldUpdateOperationsInput | string | null;
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
