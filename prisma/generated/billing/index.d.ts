
/**
 * Client
**/

import * as runtime from './runtime/client.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Invoice
 * 
 */
export type Invoice = $Result.DefaultSelection<Prisma.$InvoicePayload>
/**
 * Model InvoiceItem
 * 
 */
export type InvoiceItem = $Result.DefaultSelection<Prisma.$InvoiceItemPayload>
/**
 * Model Payment
 * 
 */
export type Payment = $Result.DefaultSelection<Prisma.$PaymentPayload>
/**
 * Model PaymentGatewayConfig
 * 
 */
export type PaymentGatewayConfig = $Result.DefaultSelection<Prisma.$PaymentGatewayConfigPayload>
/**
 * Model UnmatchedMutation
 * 
 */
export type UnmatchedMutation = $Result.DefaultSelection<Prisma.$UnmatchedMutationPayload>
/**
 * Model Transaction
 * 
 */
export type Transaction = $Result.DefaultSelection<Prisma.$TransactionPayload>
/**
 * Model TransactionCategory
 * 
 */
export type TransactionCategory = $Result.DefaultSelection<Prisma.$TransactionCategoryPayload>
/**
 * Model MixRadiusInvoice
 * 
 */
export type MixRadiusInvoice = $Result.DefaultSelection<Prisma.$MixRadiusInvoicePayload>
/**
 * Model MixRadiusCustomer
 * 
 */
export type MixRadiusCustomer = $Result.DefaultSelection<Prisma.$MixRadiusCustomerPayload>
/**
 * Model MixRadiusOwnerGroup
 * 
 */
export type MixRadiusOwnerGroup = $Result.DefaultSelection<Prisma.$MixRadiusOwnerGroupPayload>
/**
 * Model MixRadiusInvestorSite
 * 
 */
export type MixRadiusInvestorSite = $Result.DefaultSelection<Prisma.$MixRadiusInvestorSitePayload>
/**
 * Model MixRadiusConfig
 * 
 */
export type MixRadiusConfig = $Result.DefaultSelection<Prisma.$MixRadiusConfigPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const UnmatchedStatus: {
  PENDING: 'PENDING',
  RESOLVED: 'RESOLVED',
  IGNORED: 'IGNORED'
};

export type UnmatchedStatus = (typeof UnmatchedStatus)[keyof typeof UnmatchedStatus]


export const InvoiceStatus: {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  OVERDUE: 'OVERDUE',
  PAID: 'PAID',
  PARTIAL_PAID: 'PARTIAL_PAID',
  CANCELLED: 'CANCELLED'
};

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus]


export const ItemType: {
  SERVICE: 'SERVICE',
  PRODUCT: 'PRODUCT',
  SETUP_FEE: 'SETUP_FEE',
  MONTHLY_FEE: 'MONTHLY_FEE',
  ONE_TIME_FEE: 'ONE_TIME_FEE',
  OTHER: 'OTHER'
};

export type ItemType = (typeof ItemType)[keyof typeof ItemType]


export const PaymentMethod: {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
  E_WALLET: 'E_WALLET',
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  CHECK: 'CHECK',
  OTHER: 'OTHER'
};

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]


export const Status: {
  AKTIF: 'AKTIF',
  NONAKTIF: 'NONAKTIF',
  MAINTENANCE: 'MAINTENANCE',
  ISOLIR: 'ISOLIR',
  DISMANTLE: 'DISMANTLE'
};

export type Status = (typeof Status)[keyof typeof Status]


export const TransactionType: {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE'
};

export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType]


export const ExpenseType: {
  OPERATIONAL: 'OPERATIONAL',
  CAPITAL: 'CAPITAL',
  OTHER: 'OTHER'
};

export type ExpenseType = (typeof ExpenseType)[keyof typeof ExpenseType]


export const PaymentStatus: {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID'
};

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]


export const GatewayPaymentStatus: {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED'
};

export type GatewayPaymentStatus = (typeof GatewayPaymentStatus)[keyof typeof GatewayPaymentStatus]

}

export type UnmatchedStatus = $Enums.UnmatchedStatus

export const UnmatchedStatus: typeof $Enums.UnmatchedStatus

export type InvoiceStatus = $Enums.InvoiceStatus

export const InvoiceStatus: typeof $Enums.InvoiceStatus

export type ItemType = $Enums.ItemType

export const ItemType: typeof $Enums.ItemType

export type PaymentMethod = $Enums.PaymentMethod

export const PaymentMethod: typeof $Enums.PaymentMethod

export type Status = $Enums.Status

export const Status: typeof $Enums.Status

export type TransactionType = $Enums.TransactionType

export const TransactionType: typeof $Enums.TransactionType

export type ExpenseType = $Enums.ExpenseType

export const ExpenseType: typeof $Enums.ExpenseType

export type PaymentStatus = $Enums.PaymentStatus

export const PaymentStatus: typeof $Enums.PaymentStatus

export type GatewayPaymentStatus = $Enums.GatewayPaymentStatus

export const GatewayPaymentStatus: typeof $Enums.GatewayPaymentStatus

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
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

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

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

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
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

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
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

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
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


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
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>

  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

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
  get paymentGatewayConfig(): Prisma.PaymentGatewayConfigDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.unmatchedMutation`: Exposes CRUD operations for the **UnmatchedMutation** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more UnmatchedMutations
    * const unmatchedMutations = await prisma.unmatchedMutation.findMany()
    * ```
    */
  get unmatchedMutation(): Prisma.UnmatchedMutationDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.transaction`: Exposes CRUD operations for the **Transaction** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Transactions
    * const transactions = await prisma.transaction.findMany()
    * ```
    */
  get transaction(): Prisma.TransactionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.transactionCategory`: Exposes CRUD operations for the **TransactionCategory** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TransactionCategories
    * const transactionCategories = await prisma.transactionCategory.findMany()
    * ```
    */
  get transactionCategory(): Prisma.TransactionCategoryDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.mixRadiusInvoice`: Exposes CRUD operations for the **MixRadiusInvoice** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MixRadiusInvoices
    * const mixRadiusInvoices = await prisma.mixRadiusInvoice.findMany()
    * ```
    */
  get mixRadiusInvoice(): Prisma.MixRadiusInvoiceDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.mixRadiusCustomer`: Exposes CRUD operations for the **MixRadiusCustomer** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MixRadiusCustomers
    * const mixRadiusCustomers = await prisma.mixRadiusCustomer.findMany()
    * ```
    */
  get mixRadiusCustomer(): Prisma.MixRadiusCustomerDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.mixRadiusOwnerGroup`: Exposes CRUD operations for the **MixRadiusOwnerGroup** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MixRadiusOwnerGroups
    * const mixRadiusOwnerGroups = await prisma.mixRadiusOwnerGroup.findMany()
    * ```
    */
  get mixRadiusOwnerGroup(): Prisma.MixRadiusOwnerGroupDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.mixRadiusInvestorSite`: Exposes CRUD operations for the **MixRadiusInvestorSite** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MixRadiusInvestorSites
    * const mixRadiusInvestorSites = await prisma.mixRadiusInvestorSite.findMany()
    * ```
    */
  get mixRadiusInvestorSite(): Prisma.MixRadiusInvestorSiteDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.mixRadiusConfig`: Exposes CRUD operations for the **MixRadiusConfig** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MixRadiusConfigs
    * const mixRadiusConfigs = await prisma.mixRadiusConfig.findMany()
    * ```
    */
  get mixRadiusConfig(): Prisma.MixRadiusConfigDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 7.4.2
   * Query Engine version: 94a226be1cf2967af2541cca5529f0f7ba866919
   */
  export type PrismaVersion = {
    client: string
    engine: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

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
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
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
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Invoice: 'Invoice',
    InvoiceItem: 'InvoiceItem',
    Payment: 'Payment',
    PaymentGatewayConfig: 'PaymentGatewayConfig',
    UnmatchedMutation: 'UnmatchedMutation',
    Transaction: 'Transaction',
    TransactionCategory: 'TransactionCategory',
    MixRadiusInvoice: 'MixRadiusInvoice',
    MixRadiusCustomer: 'MixRadiusCustomer',
    MixRadiusOwnerGroup: 'MixRadiusOwnerGroup',
    MixRadiusInvestorSite: 'MixRadiusInvestorSite',
    MixRadiusConfig: 'MixRadiusConfig'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]



  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "invoice" | "invoiceItem" | "payment" | "paymentGatewayConfig" | "unmatchedMutation" | "transaction" | "transactionCategory" | "mixRadiusInvoice" | "mixRadiusCustomer" | "mixRadiusOwnerGroup" | "mixRadiusInvestorSite" | "mixRadiusConfig"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Invoice: {
        payload: Prisma.$InvoicePayload<ExtArgs>
        fields: Prisma.InvoiceFieldRefs
        operations: {
          findUnique: {
            args: Prisma.InvoiceFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.InvoiceFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>
          }
          findFirst: {
            args: Prisma.InvoiceFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.InvoiceFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>
          }
          findMany: {
            args: Prisma.InvoiceFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>[]
          }
          create: {
            args: Prisma.InvoiceCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>
          }
          createMany: {
            args: Prisma.InvoiceCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.InvoiceCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>[]
          }
          delete: {
            args: Prisma.InvoiceDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>
          }
          update: {
            args: Prisma.InvoiceUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>
          }
          deleteMany: {
            args: Prisma.InvoiceDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.InvoiceUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.InvoiceUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>[]
          }
          upsert: {
            args: Prisma.InvoiceUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>
          }
          aggregate: {
            args: Prisma.InvoiceAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateInvoice>
          }
          groupBy: {
            args: Prisma.InvoiceGroupByArgs<ExtArgs>
            result: $Utils.Optional<InvoiceGroupByOutputType>[]
          }
          count: {
            args: Prisma.InvoiceCountArgs<ExtArgs>
            result: $Utils.Optional<InvoiceCountAggregateOutputType> | number
          }
        }
      }
      InvoiceItem: {
        payload: Prisma.$InvoiceItemPayload<ExtArgs>
        fields: Prisma.InvoiceItemFieldRefs
        operations: {
          findUnique: {
            args: Prisma.InvoiceItemFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.InvoiceItemFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>
          }
          findFirst: {
            args: Prisma.InvoiceItemFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.InvoiceItemFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>
          }
          findMany: {
            args: Prisma.InvoiceItemFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>[]
          }
          create: {
            args: Prisma.InvoiceItemCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>
          }
          createMany: {
            args: Prisma.InvoiceItemCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.InvoiceItemCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>[]
          }
          delete: {
            args: Prisma.InvoiceItemDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>
          }
          update: {
            args: Prisma.InvoiceItemUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>
          }
          deleteMany: {
            args: Prisma.InvoiceItemDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.InvoiceItemUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.InvoiceItemUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>[]
          }
          upsert: {
            args: Prisma.InvoiceItemUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoiceItemPayload>
          }
          aggregate: {
            args: Prisma.InvoiceItemAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateInvoiceItem>
          }
          groupBy: {
            args: Prisma.InvoiceItemGroupByArgs<ExtArgs>
            result: $Utils.Optional<InvoiceItemGroupByOutputType>[]
          }
          count: {
            args: Prisma.InvoiceItemCountArgs<ExtArgs>
            result: $Utils.Optional<InvoiceItemCountAggregateOutputType> | number
          }
        }
      }
      Payment: {
        payload: Prisma.$PaymentPayload<ExtArgs>
        fields: Prisma.PaymentFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PaymentFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PaymentFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>
          }
          findFirst: {
            args: Prisma.PaymentFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PaymentFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>
          }
          findMany: {
            args: Prisma.PaymentFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>[]
          }
          create: {
            args: Prisma.PaymentCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>
          }
          createMany: {
            args: Prisma.PaymentCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PaymentCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>[]
          }
          delete: {
            args: Prisma.PaymentDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>
          }
          update: {
            args: Prisma.PaymentUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>
          }
          deleteMany: {
            args: Prisma.PaymentDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PaymentUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PaymentUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>[]
          }
          upsert: {
            args: Prisma.PaymentUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentPayload>
          }
          aggregate: {
            args: Prisma.PaymentAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePayment>
          }
          groupBy: {
            args: Prisma.PaymentGroupByArgs<ExtArgs>
            result: $Utils.Optional<PaymentGroupByOutputType>[]
          }
          count: {
            args: Prisma.PaymentCountArgs<ExtArgs>
            result: $Utils.Optional<PaymentCountAggregateOutputType> | number
          }
        }
      }
      PaymentGatewayConfig: {
        payload: Prisma.$PaymentGatewayConfigPayload<ExtArgs>
        fields: Prisma.PaymentGatewayConfigFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PaymentGatewayConfigFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PaymentGatewayConfigFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>
          }
          findFirst: {
            args: Prisma.PaymentGatewayConfigFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PaymentGatewayConfigFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>
          }
          findMany: {
            args: Prisma.PaymentGatewayConfigFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>[]
          }
          create: {
            args: Prisma.PaymentGatewayConfigCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>
          }
          createMany: {
            args: Prisma.PaymentGatewayConfigCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PaymentGatewayConfigCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>[]
          }
          delete: {
            args: Prisma.PaymentGatewayConfigDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>
          }
          update: {
            args: Prisma.PaymentGatewayConfigUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>
          }
          deleteMany: {
            args: Prisma.PaymentGatewayConfigDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PaymentGatewayConfigUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PaymentGatewayConfigUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>[]
          }
          upsert: {
            args: Prisma.PaymentGatewayConfigUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PaymentGatewayConfigPayload>
          }
          aggregate: {
            args: Prisma.PaymentGatewayConfigAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePaymentGatewayConfig>
          }
          groupBy: {
            args: Prisma.PaymentGatewayConfigGroupByArgs<ExtArgs>
            result: $Utils.Optional<PaymentGatewayConfigGroupByOutputType>[]
          }
          count: {
            args: Prisma.PaymentGatewayConfigCountArgs<ExtArgs>
            result: $Utils.Optional<PaymentGatewayConfigCountAggregateOutputType> | number
          }
        }
      }
      UnmatchedMutation: {
        payload: Prisma.$UnmatchedMutationPayload<ExtArgs>
        fields: Prisma.UnmatchedMutationFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UnmatchedMutationFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UnmatchedMutationFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>
          }
          findFirst: {
            args: Prisma.UnmatchedMutationFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UnmatchedMutationFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>
          }
          findMany: {
            args: Prisma.UnmatchedMutationFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>[]
          }
          create: {
            args: Prisma.UnmatchedMutationCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>
          }
          createMany: {
            args: Prisma.UnmatchedMutationCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UnmatchedMutationCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>[]
          }
          delete: {
            args: Prisma.UnmatchedMutationDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>
          }
          update: {
            args: Prisma.UnmatchedMutationUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>
          }
          deleteMany: {
            args: Prisma.UnmatchedMutationDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UnmatchedMutationUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UnmatchedMutationUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>[]
          }
          upsert: {
            args: Prisma.UnmatchedMutationUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UnmatchedMutationPayload>
          }
          aggregate: {
            args: Prisma.UnmatchedMutationAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUnmatchedMutation>
          }
          groupBy: {
            args: Prisma.UnmatchedMutationGroupByArgs<ExtArgs>
            result: $Utils.Optional<UnmatchedMutationGroupByOutputType>[]
          }
          count: {
            args: Prisma.UnmatchedMutationCountArgs<ExtArgs>
            result: $Utils.Optional<UnmatchedMutationCountAggregateOutputType> | number
          }
        }
      }
      Transaction: {
        payload: Prisma.$TransactionPayload<ExtArgs>
        fields: Prisma.TransactionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TransactionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TransactionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          findFirst: {
            args: Prisma.TransactionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TransactionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          findMany: {
            args: Prisma.TransactionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>[]
          }
          create: {
            args: Prisma.TransactionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          createMany: {
            args: Prisma.TransactionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TransactionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>[]
          }
          delete: {
            args: Prisma.TransactionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          update: {
            args: Prisma.TransactionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          deleteMany: {
            args: Prisma.TransactionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TransactionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TransactionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>[]
          }
          upsert: {
            args: Prisma.TransactionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          aggregate: {
            args: Prisma.TransactionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTransaction>
          }
          groupBy: {
            args: Prisma.TransactionGroupByArgs<ExtArgs>
            result: $Utils.Optional<TransactionGroupByOutputType>[]
          }
          count: {
            args: Prisma.TransactionCountArgs<ExtArgs>
            result: $Utils.Optional<TransactionCountAggregateOutputType> | number
          }
        }
      }
      TransactionCategory: {
        payload: Prisma.$TransactionCategoryPayload<ExtArgs>
        fields: Prisma.TransactionCategoryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TransactionCategoryFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionCategoryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TransactionCategoryFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionCategoryPayload>
          }
          findFirst: {
            args: Prisma.TransactionCategoryFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionCategoryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TransactionCategoryFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionCategoryPayload>
          }
          findMany: {
            args: Prisma.TransactionCategoryFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionCategoryPayload>[]
          }
          create: {
            args: Prisma.TransactionCategoryCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionCategoryPayload>
          }
          createMany: {
            args: Prisma.TransactionCategoryCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TransactionCategoryCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionCategoryPayload>[]
          }
          delete: {
            args: Prisma.TransactionCategoryDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionCategoryPayload>
          }
          update: {
            args: Prisma.TransactionCategoryUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionCategoryPayload>
          }
          deleteMany: {
            args: Prisma.TransactionCategoryDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TransactionCategoryUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TransactionCategoryUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionCategoryPayload>[]
          }
          upsert: {
            args: Prisma.TransactionCategoryUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionCategoryPayload>
          }
          aggregate: {
            args: Prisma.TransactionCategoryAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTransactionCategory>
          }
          groupBy: {
            args: Prisma.TransactionCategoryGroupByArgs<ExtArgs>
            result: $Utils.Optional<TransactionCategoryGroupByOutputType>[]
          }
          count: {
            args: Prisma.TransactionCategoryCountArgs<ExtArgs>
            result: $Utils.Optional<TransactionCategoryCountAggregateOutputType> | number
          }
        }
      }
      MixRadiusInvoice: {
        payload: Prisma.$MixRadiusInvoicePayload<ExtArgs>
        fields: Prisma.MixRadiusInvoiceFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MixRadiusInvoiceFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvoicePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MixRadiusInvoiceFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvoicePayload>
          }
          findFirst: {
            args: Prisma.MixRadiusInvoiceFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvoicePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MixRadiusInvoiceFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvoicePayload>
          }
          findMany: {
            args: Prisma.MixRadiusInvoiceFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvoicePayload>[]
          }
          create: {
            args: Prisma.MixRadiusInvoiceCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvoicePayload>
          }
          createMany: {
            args: Prisma.MixRadiusInvoiceCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MixRadiusInvoiceCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvoicePayload>[]
          }
          delete: {
            args: Prisma.MixRadiusInvoiceDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvoicePayload>
          }
          update: {
            args: Prisma.MixRadiusInvoiceUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvoicePayload>
          }
          deleteMany: {
            args: Prisma.MixRadiusInvoiceDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MixRadiusInvoiceUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.MixRadiusInvoiceUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvoicePayload>[]
          }
          upsert: {
            args: Prisma.MixRadiusInvoiceUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvoicePayload>
          }
          aggregate: {
            args: Prisma.MixRadiusInvoiceAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMixRadiusInvoice>
          }
          groupBy: {
            args: Prisma.MixRadiusInvoiceGroupByArgs<ExtArgs>
            result: $Utils.Optional<MixRadiusInvoiceGroupByOutputType>[]
          }
          count: {
            args: Prisma.MixRadiusInvoiceCountArgs<ExtArgs>
            result: $Utils.Optional<MixRadiusInvoiceCountAggregateOutputType> | number
          }
        }
      }
      MixRadiusCustomer: {
        payload: Prisma.$MixRadiusCustomerPayload<ExtArgs>
        fields: Prisma.MixRadiusCustomerFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MixRadiusCustomerFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusCustomerPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MixRadiusCustomerFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusCustomerPayload>
          }
          findFirst: {
            args: Prisma.MixRadiusCustomerFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusCustomerPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MixRadiusCustomerFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusCustomerPayload>
          }
          findMany: {
            args: Prisma.MixRadiusCustomerFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusCustomerPayload>[]
          }
          create: {
            args: Prisma.MixRadiusCustomerCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusCustomerPayload>
          }
          createMany: {
            args: Prisma.MixRadiusCustomerCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MixRadiusCustomerCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusCustomerPayload>[]
          }
          delete: {
            args: Prisma.MixRadiusCustomerDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusCustomerPayload>
          }
          update: {
            args: Prisma.MixRadiusCustomerUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusCustomerPayload>
          }
          deleteMany: {
            args: Prisma.MixRadiusCustomerDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MixRadiusCustomerUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.MixRadiusCustomerUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusCustomerPayload>[]
          }
          upsert: {
            args: Prisma.MixRadiusCustomerUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusCustomerPayload>
          }
          aggregate: {
            args: Prisma.MixRadiusCustomerAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMixRadiusCustomer>
          }
          groupBy: {
            args: Prisma.MixRadiusCustomerGroupByArgs<ExtArgs>
            result: $Utils.Optional<MixRadiusCustomerGroupByOutputType>[]
          }
          count: {
            args: Prisma.MixRadiusCustomerCountArgs<ExtArgs>
            result: $Utils.Optional<MixRadiusCustomerCountAggregateOutputType> | number
          }
        }
      }
      MixRadiusOwnerGroup: {
        payload: Prisma.$MixRadiusOwnerGroupPayload<ExtArgs>
        fields: Prisma.MixRadiusOwnerGroupFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MixRadiusOwnerGroupFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusOwnerGroupPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MixRadiusOwnerGroupFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusOwnerGroupPayload>
          }
          findFirst: {
            args: Prisma.MixRadiusOwnerGroupFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusOwnerGroupPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MixRadiusOwnerGroupFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusOwnerGroupPayload>
          }
          findMany: {
            args: Prisma.MixRadiusOwnerGroupFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusOwnerGroupPayload>[]
          }
          create: {
            args: Prisma.MixRadiusOwnerGroupCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusOwnerGroupPayload>
          }
          createMany: {
            args: Prisma.MixRadiusOwnerGroupCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MixRadiusOwnerGroupCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusOwnerGroupPayload>[]
          }
          delete: {
            args: Prisma.MixRadiusOwnerGroupDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusOwnerGroupPayload>
          }
          update: {
            args: Prisma.MixRadiusOwnerGroupUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusOwnerGroupPayload>
          }
          deleteMany: {
            args: Prisma.MixRadiusOwnerGroupDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MixRadiusOwnerGroupUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.MixRadiusOwnerGroupUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusOwnerGroupPayload>[]
          }
          upsert: {
            args: Prisma.MixRadiusOwnerGroupUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusOwnerGroupPayload>
          }
          aggregate: {
            args: Prisma.MixRadiusOwnerGroupAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMixRadiusOwnerGroup>
          }
          groupBy: {
            args: Prisma.MixRadiusOwnerGroupGroupByArgs<ExtArgs>
            result: $Utils.Optional<MixRadiusOwnerGroupGroupByOutputType>[]
          }
          count: {
            args: Prisma.MixRadiusOwnerGroupCountArgs<ExtArgs>
            result: $Utils.Optional<MixRadiusOwnerGroupCountAggregateOutputType> | number
          }
        }
      }
      MixRadiusInvestorSite: {
        payload: Prisma.$MixRadiusInvestorSitePayload<ExtArgs>
        fields: Prisma.MixRadiusInvestorSiteFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MixRadiusInvestorSiteFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvestorSitePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MixRadiusInvestorSiteFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvestorSitePayload>
          }
          findFirst: {
            args: Prisma.MixRadiusInvestorSiteFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvestorSitePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MixRadiusInvestorSiteFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvestorSitePayload>
          }
          findMany: {
            args: Prisma.MixRadiusInvestorSiteFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvestorSitePayload>[]
          }
          create: {
            args: Prisma.MixRadiusInvestorSiteCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvestorSitePayload>
          }
          createMany: {
            args: Prisma.MixRadiusInvestorSiteCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MixRadiusInvestorSiteCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvestorSitePayload>[]
          }
          delete: {
            args: Prisma.MixRadiusInvestorSiteDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvestorSitePayload>
          }
          update: {
            args: Prisma.MixRadiusInvestorSiteUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvestorSitePayload>
          }
          deleteMany: {
            args: Prisma.MixRadiusInvestorSiteDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MixRadiusInvestorSiteUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.MixRadiusInvestorSiteUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvestorSitePayload>[]
          }
          upsert: {
            args: Prisma.MixRadiusInvestorSiteUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusInvestorSitePayload>
          }
          aggregate: {
            args: Prisma.MixRadiusInvestorSiteAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMixRadiusInvestorSite>
          }
          groupBy: {
            args: Prisma.MixRadiusInvestorSiteGroupByArgs<ExtArgs>
            result: $Utils.Optional<MixRadiusInvestorSiteGroupByOutputType>[]
          }
          count: {
            args: Prisma.MixRadiusInvestorSiteCountArgs<ExtArgs>
            result: $Utils.Optional<MixRadiusInvestorSiteCountAggregateOutputType> | number
          }
        }
      }
      MixRadiusConfig: {
        payload: Prisma.$MixRadiusConfigPayload<ExtArgs>
        fields: Prisma.MixRadiusConfigFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MixRadiusConfigFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusConfigPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MixRadiusConfigFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusConfigPayload>
          }
          findFirst: {
            args: Prisma.MixRadiusConfigFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusConfigPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MixRadiusConfigFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusConfigPayload>
          }
          findMany: {
            args: Prisma.MixRadiusConfigFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusConfigPayload>[]
          }
          create: {
            args: Prisma.MixRadiusConfigCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusConfigPayload>
          }
          createMany: {
            args: Prisma.MixRadiusConfigCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MixRadiusConfigCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusConfigPayload>[]
          }
          delete: {
            args: Prisma.MixRadiusConfigDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusConfigPayload>
          }
          update: {
            args: Prisma.MixRadiusConfigUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusConfigPayload>
          }
          deleteMany: {
            args: Prisma.MixRadiusConfigDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MixRadiusConfigUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.MixRadiusConfigUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusConfigPayload>[]
          }
          upsert: {
            args: Prisma.MixRadiusConfigUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MixRadiusConfigPayload>
          }
          aggregate: {
            args: Prisma.MixRadiusConfigAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMixRadiusConfig>
          }
          groupBy: {
            args: Prisma.MixRadiusConfigGroupByArgs<ExtArgs>
            result: $Utils.Optional<MixRadiusConfigGroupByOutputType>[]
          }
          count: {
            args: Prisma.MixRadiusConfigCountArgs<ExtArgs>
            result: $Utils.Optional<MixRadiusConfigCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
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
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl?: string
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
    omit?: Prisma.GlobalOmitConfig
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
    comments?: runtime.SqlCommenterPlugin[]
  }
  export type GlobalOmitConfig = {
    invoice?: InvoiceOmit
    invoiceItem?: InvoiceItemOmit
    payment?: PaymentOmit
    paymentGatewayConfig?: PaymentGatewayConfigOmit
    unmatchedMutation?: UnmatchedMutationOmit
    transaction?: TransactionOmit
    transactionCategory?: TransactionCategoryOmit
    mixRadiusInvoice?: MixRadiusInvoiceOmit
    mixRadiusCustomer?: MixRadiusCustomerOmit
    mixRadiusOwnerGroup?: MixRadiusOwnerGroupOmit
    mixRadiusInvestorSite?: MixRadiusInvestorSiteOmit
    mixRadiusConfig?: MixRadiusConfigOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type InvoiceCountOutputType
   */

  export type InvoiceCountOutputType = {
    invoiceItem: number
    payment: number
  }

  export type InvoiceCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invoiceItem?: boolean | InvoiceCountOutputTypeCountInvoiceItemArgs
    payment?: boolean | InvoiceCountOutputTypeCountPaymentArgs
  }

  // Custom InputTypes
  /**
   * InvoiceCountOutputType without action
   */
  export type InvoiceCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the InvoiceCountOutputType
     */
    select?: InvoiceCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * InvoiceCountOutputType without action
   */
  export type InvoiceCountOutputTypeCountInvoiceItemArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: InvoiceItemWhereInput
  }

  /**
   * InvoiceCountOutputType without action
   */
  export type InvoiceCountOutputTypeCountPaymentArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PaymentWhereInput
  }


  /**
   * Count Type TransactionCategoryCountOutputType
   */

  export type TransactionCategoryCountOutputType = {
    transactions: number
  }

  export type TransactionCategoryCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    transactions?: boolean | TransactionCategoryCountOutputTypeCountTransactionsArgs
  }

  // Custom InputTypes
  /**
   * TransactionCategoryCountOutputType without action
   */
  export type TransactionCategoryCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TransactionCategoryCountOutputType
     */
    select?: TransactionCategoryCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * TransactionCategoryCountOutputType without action
   */
  export type TransactionCategoryCountOutputTypeCountTransactionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TransactionWhereInput
  }


  /**
   * Models
   */

  /**
   * Model Invoice
   */

  export type AggregateInvoice = {
    _count: InvoiceCountAggregateOutputType | null
    _avg: InvoiceAvgAggregateOutputType | null
    _sum: InvoiceSumAggregateOutputType | null
    _min: InvoiceMinAggregateOutputType | null
    _max: InvoiceMaxAggregateOutputType | null
  }

  export type InvoiceAvgAggregateOutputType = {
    subtotal: number | null
    taxAmount: number | null
    discountAmount: number | null
    totalAmount: number | null
    paidAmount: number | null
  }

  export type InvoiceSumAggregateOutputType = {
    subtotal: bigint | null
    taxAmount: bigint | null
    discountAmount: bigint | null
    totalAmount: bigint | null
    paidAmount: bigint | null
  }

  export type InvoiceMinAggregateOutputType = {
    id: string | null
    invoiceNumber: string | null
    pelangganId: string | null
    issueDate: Date | null
    dueDate: Date | null
    status: $Enums.InvoiceStatus | null
    subtotal: bigint | null
    taxAmount: bigint | null
    discountAmount: bigint | null
    totalAmount: bigint | null
    paidAmount: bigint | null
    notes: string | null
    terms: string | null
    sentAt: Date | null
    paidAt: Date | null
    createdBy: string | null
    createdAt: Date | null
    updatedAt: Date | null
    siteId: string | null
  }

  export type InvoiceMaxAggregateOutputType = {
    id: string | null
    invoiceNumber: string | null
    pelangganId: string | null
    issueDate: Date | null
    dueDate: Date | null
    status: $Enums.InvoiceStatus | null
    subtotal: bigint | null
    taxAmount: bigint | null
    discountAmount: bigint | null
    totalAmount: bigint | null
    paidAmount: bigint | null
    notes: string | null
    terms: string | null
    sentAt: Date | null
    paidAt: Date | null
    createdBy: string | null
    createdAt: Date | null
    updatedAt: Date | null
    siteId: string | null
  }

  export type InvoiceCountAggregateOutputType = {
    id: number
    invoiceNumber: number
    pelangganId: number
    issueDate: number
    dueDate: number
    status: number
    subtotal: number
    taxAmount: number
    discountAmount: number
    totalAmount: number
    paidAmount: number
    notes: number
    terms: number
    sentAt: number
    paidAt: number
    createdBy: number
    createdAt: number
    updatedAt: number
    siteId: number
    _all: number
  }


  export type InvoiceAvgAggregateInputType = {
    subtotal?: true
    taxAmount?: true
    discountAmount?: true
    totalAmount?: true
    paidAmount?: true
  }

  export type InvoiceSumAggregateInputType = {
    subtotal?: true
    taxAmount?: true
    discountAmount?: true
    totalAmount?: true
    paidAmount?: true
  }

  export type InvoiceMinAggregateInputType = {
    id?: true
    invoiceNumber?: true
    pelangganId?: true
    issueDate?: true
    dueDate?: true
    status?: true
    subtotal?: true
    taxAmount?: true
    discountAmount?: true
    totalAmount?: true
    paidAmount?: true
    notes?: true
    terms?: true
    sentAt?: true
    paidAt?: true
    createdBy?: true
    createdAt?: true
    updatedAt?: true
    siteId?: true
  }

  export type InvoiceMaxAggregateInputType = {
    id?: true
    invoiceNumber?: true
    pelangganId?: true
    issueDate?: true
    dueDate?: true
    status?: true
    subtotal?: true
    taxAmount?: true
    discountAmount?: true
    totalAmount?: true
    paidAmount?: true
    notes?: true
    terms?: true
    sentAt?: true
    paidAt?: true
    createdBy?: true
    createdAt?: true
    updatedAt?: true
    siteId?: true
  }

  export type InvoiceCountAggregateInputType = {
    id?: true
    invoiceNumber?: true
    pelangganId?: true
    issueDate?: true
    dueDate?: true
    status?: true
    subtotal?: true
    taxAmount?: true
    discountAmount?: true
    totalAmount?: true
    paidAmount?: true
    notes?: true
    terms?: true
    sentAt?: true
    paidAt?: true
    createdBy?: true
    createdAt?: true
    updatedAt?: true
    siteId?: true
    _all?: true
  }

  export type InvoiceAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Invoice to aggregate.
     */
    where?: InvoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Invoices to fetch.
     */
    orderBy?: InvoiceOrderByWithRelationInput | InvoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: InvoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Invoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Invoices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Invoices
    **/
    _count?: true | InvoiceCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: InvoiceAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: InvoiceSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: InvoiceMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: InvoiceMaxAggregateInputType
  }

  export type GetInvoiceAggregateType<T extends InvoiceAggregateArgs> = {
        [P in keyof T & keyof AggregateInvoice]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateInvoice[P]>
      : GetScalarType<T[P], AggregateInvoice[P]>
  }




  export type InvoiceGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: InvoiceWhereInput
    orderBy?: InvoiceOrderByWithAggregationInput | InvoiceOrderByWithAggregationInput[]
    by: InvoiceScalarFieldEnum[] | InvoiceScalarFieldEnum
    having?: InvoiceScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: InvoiceCountAggregateInputType | true
    _avg?: InvoiceAvgAggregateInputType
    _sum?: InvoiceSumAggregateInputType
    _min?: InvoiceMinAggregateInputType
    _max?: InvoiceMaxAggregateInputType
  }

  export type InvoiceGroupByOutputType = {
    id: string
    invoiceNumber: string
    pelangganId: string
    issueDate: Date
    dueDate: Date
    status: $Enums.InvoiceStatus
    subtotal: bigint
    taxAmount: bigint
    discountAmount: bigint
    totalAmount: bigint
    paidAmount: bigint
    notes: string | null
    terms: string | null
    sentAt: Date | null
    paidAt: Date | null
    createdBy: string | null
    createdAt: Date
    updatedAt: Date
    siteId: string | null
    _count: InvoiceCountAggregateOutputType | null
    _avg: InvoiceAvgAggregateOutputType | null
    _sum: InvoiceSumAggregateOutputType | null
    _min: InvoiceMinAggregateOutputType | null
    _max: InvoiceMaxAggregateOutputType | null
  }

  type GetInvoiceGroupByPayload<T extends InvoiceGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<InvoiceGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof InvoiceGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], InvoiceGroupByOutputType[P]>
            : GetScalarType<T[P], InvoiceGroupByOutputType[P]>
        }
      >
    >


  export type InvoiceSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    invoiceNumber?: boolean
    pelangganId?: boolean
    issueDate?: boolean
    dueDate?: boolean
    status?: boolean
    subtotal?: boolean
    taxAmount?: boolean
    discountAmount?: boolean
    totalAmount?: boolean
    paidAmount?: boolean
    notes?: boolean
    terms?: boolean
    sentAt?: boolean
    paidAt?: boolean
    createdBy?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    siteId?: boolean
    invoiceItem?: boolean | Invoice$invoiceItemArgs<ExtArgs>
    payment?: boolean | Invoice$paymentArgs<ExtArgs>
    _count?: boolean | InvoiceCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["invoice"]>

  export type InvoiceSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    invoiceNumber?: boolean
    pelangganId?: boolean
    issueDate?: boolean
    dueDate?: boolean
    status?: boolean
    subtotal?: boolean
    taxAmount?: boolean
    discountAmount?: boolean
    totalAmount?: boolean
    paidAmount?: boolean
    notes?: boolean
    terms?: boolean
    sentAt?: boolean
    paidAt?: boolean
    createdBy?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    siteId?: boolean
  }, ExtArgs["result"]["invoice"]>

  export type InvoiceSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    invoiceNumber?: boolean
    pelangganId?: boolean
    issueDate?: boolean
    dueDate?: boolean
    status?: boolean
    subtotal?: boolean
    taxAmount?: boolean
    discountAmount?: boolean
    totalAmount?: boolean
    paidAmount?: boolean
    notes?: boolean
    terms?: boolean
    sentAt?: boolean
    paidAt?: boolean
    createdBy?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    siteId?: boolean
  }, ExtArgs["result"]["invoice"]>

  export type InvoiceSelectScalar = {
    id?: boolean
    invoiceNumber?: boolean
    pelangganId?: boolean
    issueDate?: boolean
    dueDate?: boolean
    status?: boolean
    subtotal?: boolean
    taxAmount?: boolean
    discountAmount?: boolean
    totalAmount?: boolean
    paidAmount?: boolean
    notes?: boolean
    terms?: boolean
    sentAt?: boolean
    paidAt?: boolean
    createdBy?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    siteId?: boolean
  }

  export type InvoiceOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "invoiceNumber" | "pelangganId" | "issueDate" | "dueDate" | "status" | "subtotal" | "taxAmount" | "discountAmount" | "totalAmount" | "paidAmount" | "notes" | "terms" | "sentAt" | "paidAt" | "createdBy" | "createdAt" | "updatedAt" | "siteId", ExtArgs["result"]["invoice"]>
  export type InvoiceInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invoiceItem?: boolean | Invoice$invoiceItemArgs<ExtArgs>
    payment?: boolean | Invoice$paymentArgs<ExtArgs>
    _count?: boolean | InvoiceCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type InvoiceIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type InvoiceIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $InvoicePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Invoice"
    objects: {
      invoiceItem: Prisma.$InvoiceItemPayload<ExtArgs>[]
      payment: Prisma.$PaymentPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      invoiceNumber: string
      pelangganId: string
      issueDate: Date
      dueDate: Date
      status: $Enums.InvoiceStatus
      subtotal: bigint
      taxAmount: bigint
      discountAmount: bigint
      totalAmount: bigint
      paidAmount: bigint
      notes: string | null
      terms: string | null
      sentAt: Date | null
      paidAt: Date | null
      createdBy: string | null
      createdAt: Date
      updatedAt: Date
      siteId: string | null
    }, ExtArgs["result"]["invoice"]>
    composites: {}
  }

  type InvoiceGetPayload<S extends boolean | null | undefined | InvoiceDefaultArgs> = $Result.GetResult<Prisma.$InvoicePayload, S>

  type InvoiceCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<InvoiceFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: InvoiceCountAggregateInputType | true
    }

  export interface InvoiceDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Invoice'], meta: { name: 'Invoice' } }
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
    findUnique<T extends InvoiceFindUniqueArgs>(args: SelectSubset<T, InvoiceFindUniqueArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

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
    findUniqueOrThrow<T extends InvoiceFindUniqueOrThrowArgs>(args: SelectSubset<T, InvoiceFindUniqueOrThrowArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    findFirst<T extends InvoiceFindFirstArgs>(args?: SelectSubset<T, InvoiceFindFirstArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

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
    findFirstOrThrow<T extends InvoiceFindFirstOrThrowArgs>(args?: SelectSubset<T, InvoiceFindFirstOrThrowArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    findMany<T extends InvoiceFindManyArgs>(args?: SelectSubset<T, InvoiceFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

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
    create<T extends InvoiceCreateArgs>(args: SelectSubset<T, InvoiceCreateArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    createMany<T extends InvoiceCreateManyArgs>(args?: SelectSubset<T, InvoiceCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

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
    createManyAndReturn<T extends InvoiceCreateManyAndReturnArgs>(args?: SelectSubset<T, InvoiceCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

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
    delete<T extends InvoiceDeleteArgs>(args: SelectSubset<T, InvoiceDeleteArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    update<T extends InvoiceUpdateArgs>(args: SelectSubset<T, InvoiceUpdateArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    deleteMany<T extends InvoiceDeleteManyArgs>(args?: SelectSubset<T, InvoiceDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

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
    updateMany<T extends InvoiceUpdateManyArgs>(args: SelectSubset<T, InvoiceUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

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
    updateManyAndReturn<T extends InvoiceUpdateManyAndReturnArgs>(args: SelectSubset<T, InvoiceUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

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
    upsert<T extends InvoiceUpsertArgs>(args: SelectSubset<T, InvoiceUpsertArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


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
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], InvoiceCountAggregateOutputType>
        : number
    >

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
    aggregate<T extends InvoiceAggregateArgs>(args: Subset<T, InvoiceAggregateArgs>): Prisma.PrismaPromise<GetInvoiceAggregateType<T>>

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
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: InvoiceGroupByArgs['orderBy'] }
        : { orderBy?: InvoiceGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
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
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, InvoiceGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetInvoiceGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
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
  export interface Prisma__InvoiceClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    invoiceItem<T extends Invoice$invoiceItemArgs<ExtArgs> = {}>(args?: Subset<T, Invoice$invoiceItemArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$InvoiceItemPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    payment<T extends Invoice$paymentArgs<ExtArgs> = {}>(args?: Subset<T, Invoice$paymentArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Invoice model
   */
  interface InvoiceFieldRefs {
    readonly id: FieldRef<"Invoice", 'String'>
    readonly invoiceNumber: FieldRef<"Invoice", 'String'>
    readonly pelangganId: FieldRef<"Invoice", 'String'>
    readonly issueDate: FieldRef<"Invoice", 'DateTime'>
    readonly dueDate: FieldRef<"Invoice", 'DateTime'>
    readonly status: FieldRef<"Invoice", 'InvoiceStatus'>
    readonly subtotal: FieldRef<"Invoice", 'BigInt'>
    readonly taxAmount: FieldRef<"Invoice", 'BigInt'>
    readonly discountAmount: FieldRef<"Invoice", 'BigInt'>
    readonly totalAmount: FieldRef<"Invoice", 'BigInt'>
    readonly paidAmount: FieldRef<"Invoice", 'BigInt'>
    readonly notes: FieldRef<"Invoice", 'String'>
    readonly terms: FieldRef<"Invoice", 'String'>
    readonly sentAt: FieldRef<"Invoice", 'DateTime'>
    readonly paidAt: FieldRef<"Invoice", 'DateTime'>
    readonly createdBy: FieldRef<"Invoice", 'String'>
    readonly createdAt: FieldRef<"Invoice", 'DateTime'>
    readonly updatedAt: FieldRef<"Invoice", 'DateTime'>
    readonly siteId: FieldRef<"Invoice", 'String'>
  }
    

  // Custom InputTypes
  /**
   * Invoice findUnique
   */
  export type InvoiceFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * Filter, which Invoice to fetch.
     */
    where: InvoiceWhereUniqueInput
  }

  /**
   * Invoice findUniqueOrThrow
   */
  export type InvoiceFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * Filter, which Invoice to fetch.
     */
    where: InvoiceWhereUniqueInput
  }

  /**
   * Invoice findFirst
   */
  export type InvoiceFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * Filter, which Invoice to fetch.
     */
    where?: InvoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Invoices to fetch.
     */
    orderBy?: InvoiceOrderByWithRelationInput | InvoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Invoices.
     */
    cursor?: InvoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Invoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Invoices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Invoices.
     */
    distinct?: InvoiceScalarFieldEnum | InvoiceScalarFieldEnum[]
  }

  /**
   * Invoice findFirstOrThrow
   */
  export type InvoiceFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * Filter, which Invoice to fetch.
     */
    where?: InvoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Invoices to fetch.
     */
    orderBy?: InvoiceOrderByWithRelationInput | InvoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Invoices.
     */
    cursor?: InvoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Invoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Invoices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Invoices.
     */
    distinct?: InvoiceScalarFieldEnum | InvoiceScalarFieldEnum[]
  }

  /**
   * Invoice findMany
   */
  export type InvoiceFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * Filter, which Invoices to fetch.
     */
    where?: InvoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Invoices to fetch.
     */
    orderBy?: InvoiceOrderByWithRelationInput | InvoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Invoices.
     */
    cursor?: InvoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Invoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Invoices.
     */
    skip?: number
    distinct?: InvoiceScalarFieldEnum | InvoiceScalarFieldEnum[]
  }

  /**
   * Invoice create
   */
  export type InvoiceCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * The data needed to create a Invoice.
     */
    data: XOR<InvoiceCreateInput, InvoiceUncheckedCreateInput>
  }

  /**
   * Invoice createMany
   */
  export type InvoiceCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Invoices.
     */
    data: InvoiceCreateManyInput | InvoiceCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Invoice createManyAndReturn
   */
  export type InvoiceCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * The data used to create many Invoices.
     */
    data: InvoiceCreateManyInput | InvoiceCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Invoice update
   */
  export type InvoiceUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * The data needed to update a Invoice.
     */
    data: XOR<InvoiceUpdateInput, InvoiceUncheckedUpdateInput>
    /**
     * Choose, which Invoice to update.
     */
    where: InvoiceWhereUniqueInput
  }

  /**
   * Invoice updateMany
   */
  export type InvoiceUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Invoices.
     */
    data: XOR<InvoiceUpdateManyMutationInput, InvoiceUncheckedUpdateManyInput>
    /**
     * Filter which Invoices to update
     */
    where?: InvoiceWhereInput
    /**
     * Limit how many Invoices to update.
     */
    limit?: number
  }

  /**
   * Invoice updateManyAndReturn
   */
  export type InvoiceUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * The data used to update Invoices.
     */
    data: XOR<InvoiceUpdateManyMutationInput, InvoiceUncheckedUpdateManyInput>
    /**
     * Filter which Invoices to update
     */
    where?: InvoiceWhereInput
    /**
     * Limit how many Invoices to update.
     */
    limit?: number
  }

  /**
   * Invoice upsert
   */
  export type InvoiceUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * The filter to search for the Invoice to update in case it exists.
     */
    where: InvoiceWhereUniqueInput
    /**
     * In case the Invoice found by the `where` argument doesn't exist, create a new Invoice with this data.
     */
    create: XOR<InvoiceCreateInput, InvoiceUncheckedCreateInput>
    /**
     * In case the Invoice was found with the provided `where` argument, update it with this data.
     */
    update: XOR<InvoiceUpdateInput, InvoiceUncheckedUpdateInput>
  }

  /**
   * Invoice delete
   */
  export type InvoiceDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * Filter which Invoice to delete.
     */
    where: InvoiceWhereUniqueInput
  }

  /**
   * Invoice deleteMany
   */
  export type InvoiceDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Invoices to delete
     */
    where?: InvoiceWhereInput
    /**
     * Limit how many Invoices to delete.
     */
    limit?: number
  }

  /**
   * Invoice.invoiceItem
   */
  export type Invoice$invoiceItemArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null
    where?: InvoiceItemWhereInput
    orderBy?: InvoiceItemOrderByWithRelationInput | InvoiceItemOrderByWithRelationInput[]
    cursor?: InvoiceItemWhereUniqueInput
    take?: number
    skip?: number
    distinct?: InvoiceItemScalarFieldEnum | InvoiceItemScalarFieldEnum[]
  }

  /**
   * Invoice.payment
   */
  export type Invoice$paymentArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    where?: PaymentWhereInput
    orderBy?: PaymentOrderByWithRelationInput | PaymentOrderByWithRelationInput[]
    cursor?: PaymentWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PaymentScalarFieldEnum | PaymentScalarFieldEnum[]
  }

  /**
   * Invoice without action
   */
  export type InvoiceDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
  }


  /**
   * Model InvoiceItem
   */

  export type AggregateInvoiceItem = {
    _count: InvoiceItemCountAggregateOutputType | null
    _avg: InvoiceItemAvgAggregateOutputType | null
    _sum: InvoiceItemSumAggregateOutputType | null
    _min: InvoiceItemMinAggregateOutputType | null
    _max: InvoiceItemMaxAggregateOutputType | null
  }

  export type InvoiceItemAvgAggregateOutputType = {
    quantity: number | null
    unitPrice: number | null
    totalPrice: number | null
  }

  export type InvoiceItemSumAggregateOutputType = {
    quantity: number | null
    unitPrice: bigint | null
    totalPrice: bigint | null
  }

  export type InvoiceItemMinAggregateOutputType = {
    id: string | null
    invoiceId: string | null
    description: string | null
    quantity: number | null
    unitPrice: bigint | null
    totalPrice: bigint | null
    itemType: $Enums.ItemType | null
  }

  export type InvoiceItemMaxAggregateOutputType = {
    id: string | null
    invoiceId: string | null
    description: string | null
    quantity: number | null
    unitPrice: bigint | null
    totalPrice: bigint | null
    itemType: $Enums.ItemType | null
  }

  export type InvoiceItemCountAggregateOutputType = {
    id: number
    invoiceId: number
    description: number
    quantity: number
    unitPrice: number
    totalPrice: number
    itemType: number
    _all: number
  }


  export type InvoiceItemAvgAggregateInputType = {
    quantity?: true
    unitPrice?: true
    totalPrice?: true
  }

  export type InvoiceItemSumAggregateInputType = {
    quantity?: true
    unitPrice?: true
    totalPrice?: true
  }

  export type InvoiceItemMinAggregateInputType = {
    id?: true
    invoiceId?: true
    description?: true
    quantity?: true
    unitPrice?: true
    totalPrice?: true
    itemType?: true
  }

  export type InvoiceItemMaxAggregateInputType = {
    id?: true
    invoiceId?: true
    description?: true
    quantity?: true
    unitPrice?: true
    totalPrice?: true
    itemType?: true
  }

  export type InvoiceItemCountAggregateInputType = {
    id?: true
    invoiceId?: true
    description?: true
    quantity?: true
    unitPrice?: true
    totalPrice?: true
    itemType?: true
    _all?: true
  }

  export type InvoiceItemAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which InvoiceItem to aggregate.
     */
    where?: InvoiceItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of InvoiceItems to fetch.
     */
    orderBy?: InvoiceItemOrderByWithRelationInput | InvoiceItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: InvoiceItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` InvoiceItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` InvoiceItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned InvoiceItems
    **/
    _count?: true | InvoiceItemCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: InvoiceItemAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: InvoiceItemSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: InvoiceItemMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: InvoiceItemMaxAggregateInputType
  }

  export type GetInvoiceItemAggregateType<T extends InvoiceItemAggregateArgs> = {
        [P in keyof T & keyof AggregateInvoiceItem]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateInvoiceItem[P]>
      : GetScalarType<T[P], AggregateInvoiceItem[P]>
  }




  export type InvoiceItemGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: InvoiceItemWhereInput
    orderBy?: InvoiceItemOrderByWithAggregationInput | InvoiceItemOrderByWithAggregationInput[]
    by: InvoiceItemScalarFieldEnum[] | InvoiceItemScalarFieldEnum
    having?: InvoiceItemScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: InvoiceItemCountAggregateInputType | true
    _avg?: InvoiceItemAvgAggregateInputType
    _sum?: InvoiceItemSumAggregateInputType
    _min?: InvoiceItemMinAggregateInputType
    _max?: InvoiceItemMaxAggregateInputType
  }

  export type InvoiceItemGroupByOutputType = {
    id: string
    invoiceId: string
    description: string
    quantity: number
    unitPrice: bigint
    totalPrice: bigint
    itemType: $Enums.ItemType
    _count: InvoiceItemCountAggregateOutputType | null
    _avg: InvoiceItemAvgAggregateOutputType | null
    _sum: InvoiceItemSumAggregateOutputType | null
    _min: InvoiceItemMinAggregateOutputType | null
    _max: InvoiceItemMaxAggregateOutputType | null
  }

  type GetInvoiceItemGroupByPayload<T extends InvoiceItemGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<InvoiceItemGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof InvoiceItemGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], InvoiceItemGroupByOutputType[P]>
            : GetScalarType<T[P], InvoiceItemGroupByOutputType[P]>
        }
      >
    >


  export type InvoiceItemSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    invoiceId?: boolean
    description?: boolean
    quantity?: boolean
    unitPrice?: boolean
    totalPrice?: boolean
    itemType?: boolean
    invoice?: boolean | InvoiceDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["invoiceItem"]>

  export type InvoiceItemSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    invoiceId?: boolean
    description?: boolean
    quantity?: boolean
    unitPrice?: boolean
    totalPrice?: boolean
    itemType?: boolean
    invoice?: boolean | InvoiceDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["invoiceItem"]>

  export type InvoiceItemSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    invoiceId?: boolean
    description?: boolean
    quantity?: boolean
    unitPrice?: boolean
    totalPrice?: boolean
    itemType?: boolean
    invoice?: boolean | InvoiceDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["invoiceItem"]>

  export type InvoiceItemSelectScalar = {
    id?: boolean
    invoiceId?: boolean
    description?: boolean
    quantity?: boolean
    unitPrice?: boolean
    totalPrice?: boolean
    itemType?: boolean
  }

  export type InvoiceItemOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "invoiceId" | "description" | "quantity" | "unitPrice" | "totalPrice" | "itemType", ExtArgs["result"]["invoiceItem"]>
  export type InvoiceItemInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invoice?: boolean | InvoiceDefaultArgs<ExtArgs>
  }
  export type InvoiceItemIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invoice?: boolean | InvoiceDefaultArgs<ExtArgs>
  }
  export type InvoiceItemIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invoice?: boolean | InvoiceDefaultArgs<ExtArgs>
  }

  export type $InvoiceItemPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "InvoiceItem"
    objects: {
      invoice: Prisma.$InvoicePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      invoiceId: string
      description: string
      quantity: number
      unitPrice: bigint
      totalPrice: bigint
      itemType: $Enums.ItemType
    }, ExtArgs["result"]["invoiceItem"]>
    composites: {}
  }

  type InvoiceItemGetPayload<S extends boolean | null | undefined | InvoiceItemDefaultArgs> = $Result.GetResult<Prisma.$InvoiceItemPayload, S>

  type InvoiceItemCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<InvoiceItemFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: InvoiceItemCountAggregateInputType | true
    }

  export interface InvoiceItemDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['InvoiceItem'], meta: { name: 'InvoiceItem' } }
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
    findUnique<T extends InvoiceItemFindUniqueArgs>(args: SelectSubset<T, InvoiceItemFindUniqueArgs<ExtArgs>>): Prisma__InvoiceItemClient<$Result.GetResult<Prisma.$InvoiceItemPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

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
    findUniqueOrThrow<T extends InvoiceItemFindUniqueOrThrowArgs>(args: SelectSubset<T, InvoiceItemFindUniqueOrThrowArgs<ExtArgs>>): Prisma__InvoiceItemClient<$Result.GetResult<Prisma.$InvoiceItemPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    findFirst<T extends InvoiceItemFindFirstArgs>(args?: SelectSubset<T, InvoiceItemFindFirstArgs<ExtArgs>>): Prisma__InvoiceItemClient<$Result.GetResult<Prisma.$InvoiceItemPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

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
    findFirstOrThrow<T extends InvoiceItemFindFirstOrThrowArgs>(args?: SelectSubset<T, InvoiceItemFindFirstOrThrowArgs<ExtArgs>>): Prisma__InvoiceItemClient<$Result.GetResult<Prisma.$InvoiceItemPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    findMany<T extends InvoiceItemFindManyArgs>(args?: SelectSubset<T, InvoiceItemFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$InvoiceItemPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

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
    create<T extends InvoiceItemCreateArgs>(args: SelectSubset<T, InvoiceItemCreateArgs<ExtArgs>>): Prisma__InvoiceItemClient<$Result.GetResult<Prisma.$InvoiceItemPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    createMany<T extends InvoiceItemCreateManyArgs>(args?: SelectSubset<T, InvoiceItemCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

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
    createManyAndReturn<T extends InvoiceItemCreateManyAndReturnArgs>(args?: SelectSubset<T, InvoiceItemCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$InvoiceItemPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

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
    delete<T extends InvoiceItemDeleteArgs>(args: SelectSubset<T, InvoiceItemDeleteArgs<ExtArgs>>): Prisma__InvoiceItemClient<$Result.GetResult<Prisma.$InvoiceItemPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    update<T extends InvoiceItemUpdateArgs>(args: SelectSubset<T, InvoiceItemUpdateArgs<ExtArgs>>): Prisma__InvoiceItemClient<$Result.GetResult<Prisma.$InvoiceItemPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    deleteMany<T extends InvoiceItemDeleteManyArgs>(args?: SelectSubset<T, InvoiceItemDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

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
    updateMany<T extends InvoiceItemUpdateManyArgs>(args: SelectSubset<T, InvoiceItemUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

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
    updateManyAndReturn<T extends InvoiceItemUpdateManyAndReturnArgs>(args: SelectSubset<T, InvoiceItemUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$InvoiceItemPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

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
    upsert<T extends InvoiceItemUpsertArgs>(args: SelectSubset<T, InvoiceItemUpsertArgs<ExtArgs>>): Prisma__InvoiceItemClient<$Result.GetResult<Prisma.$InvoiceItemPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


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
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], InvoiceItemCountAggregateOutputType>
        : number
    >

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
    aggregate<T extends InvoiceItemAggregateArgs>(args: Subset<T, InvoiceItemAggregateArgs>): Prisma.PrismaPromise<GetInvoiceItemAggregateType<T>>

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
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: InvoiceItemGroupByArgs['orderBy'] }
        : { orderBy?: InvoiceItemGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
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
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, InvoiceItemGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetInvoiceItemGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
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
  export interface Prisma__InvoiceItemClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    invoice<T extends InvoiceDefaultArgs<ExtArgs> = {}>(args?: Subset<T, InvoiceDefaultArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the InvoiceItem model
   */
  interface InvoiceItemFieldRefs {
    readonly id: FieldRef<"InvoiceItem", 'String'>
    readonly invoiceId: FieldRef<"InvoiceItem", 'String'>
    readonly description: FieldRef<"InvoiceItem", 'String'>
    readonly quantity: FieldRef<"InvoiceItem", 'Int'>
    readonly unitPrice: FieldRef<"InvoiceItem", 'BigInt'>
    readonly totalPrice: FieldRef<"InvoiceItem", 'BigInt'>
    readonly itemType: FieldRef<"InvoiceItem", 'ItemType'>
  }
    

  // Custom InputTypes
  /**
   * InvoiceItem findUnique
   */
  export type InvoiceItemFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null
    /**
     * Filter, which InvoiceItem to fetch.
     */
    where: InvoiceItemWhereUniqueInput
  }

  /**
   * InvoiceItem findUniqueOrThrow
   */
  export type InvoiceItemFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null
    /**
     * Filter, which InvoiceItem to fetch.
     */
    where: InvoiceItemWhereUniqueInput
  }

  /**
   * InvoiceItem findFirst
   */
  export type InvoiceItemFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null
    /**
     * Filter, which InvoiceItem to fetch.
     */
    where?: InvoiceItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of InvoiceItems to fetch.
     */
    orderBy?: InvoiceItemOrderByWithRelationInput | InvoiceItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for InvoiceItems.
     */
    cursor?: InvoiceItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` InvoiceItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` InvoiceItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of InvoiceItems.
     */
    distinct?: InvoiceItemScalarFieldEnum | InvoiceItemScalarFieldEnum[]
  }

  /**
   * InvoiceItem findFirstOrThrow
   */
  export type InvoiceItemFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null
    /**
     * Filter, which InvoiceItem to fetch.
     */
    where?: InvoiceItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of InvoiceItems to fetch.
     */
    orderBy?: InvoiceItemOrderByWithRelationInput | InvoiceItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for InvoiceItems.
     */
    cursor?: InvoiceItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` InvoiceItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` InvoiceItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of InvoiceItems.
     */
    distinct?: InvoiceItemScalarFieldEnum | InvoiceItemScalarFieldEnum[]
  }

  /**
   * InvoiceItem findMany
   */
  export type InvoiceItemFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null
    /**
     * Filter, which InvoiceItems to fetch.
     */
    where?: InvoiceItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of InvoiceItems to fetch.
     */
    orderBy?: InvoiceItemOrderByWithRelationInput | InvoiceItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing InvoiceItems.
     */
    cursor?: InvoiceItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` InvoiceItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` InvoiceItems.
     */
    skip?: number
    distinct?: InvoiceItemScalarFieldEnum | InvoiceItemScalarFieldEnum[]
  }

  /**
   * InvoiceItem create
   */
  export type InvoiceItemCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null
    /**
     * The data needed to create a InvoiceItem.
     */
    data: XOR<InvoiceItemCreateInput, InvoiceItemUncheckedCreateInput>
  }

  /**
   * InvoiceItem createMany
   */
  export type InvoiceItemCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many InvoiceItems.
     */
    data: InvoiceItemCreateManyInput | InvoiceItemCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * InvoiceItem createManyAndReturn
   */
  export type InvoiceItemCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null
    /**
     * The data used to create many InvoiceItems.
     */
    data: InvoiceItemCreateManyInput | InvoiceItemCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * InvoiceItem update
   */
  export type InvoiceItemUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null
    /**
     * The data needed to update a InvoiceItem.
     */
    data: XOR<InvoiceItemUpdateInput, InvoiceItemUncheckedUpdateInput>
    /**
     * Choose, which InvoiceItem to update.
     */
    where: InvoiceItemWhereUniqueInput
  }

  /**
   * InvoiceItem updateMany
   */
  export type InvoiceItemUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update InvoiceItems.
     */
    data: XOR<InvoiceItemUpdateManyMutationInput, InvoiceItemUncheckedUpdateManyInput>
    /**
     * Filter which InvoiceItems to update
     */
    where?: InvoiceItemWhereInput
    /**
     * Limit how many InvoiceItems to update.
     */
    limit?: number
  }

  /**
   * InvoiceItem updateManyAndReturn
   */
  export type InvoiceItemUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null
    /**
     * The data used to update InvoiceItems.
     */
    data: XOR<InvoiceItemUpdateManyMutationInput, InvoiceItemUncheckedUpdateManyInput>
    /**
     * Filter which InvoiceItems to update
     */
    where?: InvoiceItemWhereInput
    /**
     * Limit how many InvoiceItems to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * InvoiceItem upsert
   */
  export type InvoiceItemUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null
    /**
     * The filter to search for the InvoiceItem to update in case it exists.
     */
    where: InvoiceItemWhereUniqueInput
    /**
     * In case the InvoiceItem found by the `where` argument doesn't exist, create a new InvoiceItem with this data.
     */
    create: XOR<InvoiceItemCreateInput, InvoiceItemUncheckedCreateInput>
    /**
     * In case the InvoiceItem was found with the provided `where` argument, update it with this data.
     */
    update: XOR<InvoiceItemUpdateInput, InvoiceItemUncheckedUpdateInput>
  }

  /**
   * InvoiceItem delete
   */
  export type InvoiceItemDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null
    /**
     * Filter which InvoiceItem to delete.
     */
    where: InvoiceItemWhereUniqueInput
  }

  /**
   * InvoiceItem deleteMany
   */
  export type InvoiceItemDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which InvoiceItems to delete
     */
    where?: InvoiceItemWhereInput
    /**
     * Limit how many InvoiceItems to delete.
     */
    limit?: number
  }

  /**
   * InvoiceItem without action
   */
  export type InvoiceItemDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the InvoiceItem
     */
    select?: InvoiceItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the InvoiceItem
     */
    omit?: InvoiceItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceItemInclude<ExtArgs> | null
  }


  /**
   * Model Payment
   */

  export type AggregatePayment = {
    _count: PaymentCountAggregateOutputType | null
    _avg: PaymentAvgAggregateOutputType | null
    _sum: PaymentSumAggregateOutputType | null
    _min: PaymentMinAggregateOutputType | null
    _max: PaymentMaxAggregateOutputType | null
  }

  export type PaymentAvgAggregateOutputType = {
    amount: number | null
  }

  export type PaymentSumAggregateOutputType = {
    amount: bigint | null
  }

  export type PaymentMinAggregateOutputType = {
    id: string | null
    invoiceId: string | null
    pelangganId: string | null
    amount: bigint | null
    paymentDate: Date | null
    paymentMethod: $Enums.PaymentMethod | null
    reference: string | null
    notes: string | null
    verifiedBy: string | null
    verifiedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
    accountId: string | null
    gatewayStatus: $Enums.GatewayPaymentStatus | null
    gatewayProvider: string | null
    transactionId: string | null
    paymentUrl: string | null
    expiresAt: Date | null
    unmatchedMutationId: string | null
    receiptUrl: string | null
  }

  export type PaymentMaxAggregateOutputType = {
    id: string | null
    invoiceId: string | null
    pelangganId: string | null
    amount: bigint | null
    paymentDate: Date | null
    paymentMethod: $Enums.PaymentMethod | null
    reference: string | null
    notes: string | null
    verifiedBy: string | null
    verifiedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
    accountId: string | null
    gatewayStatus: $Enums.GatewayPaymentStatus | null
    gatewayProvider: string | null
    transactionId: string | null
    paymentUrl: string | null
    expiresAt: Date | null
    unmatchedMutationId: string | null
    receiptUrl: string | null
  }

  export type PaymentCountAggregateOutputType = {
    id: number
    invoiceId: number
    pelangganId: number
    amount: number
    paymentDate: number
    paymentMethod: number
    reference: number
    notes: number
    verifiedBy: number
    verifiedAt: number
    createdAt: number
    updatedAt: number
    accountId: number
    gatewayStatus: number
    gatewayProvider: number
    transactionId: number
    paymentUrl: number
    expiresAt: number
    unmatchedMutationId: number
    receiptUrl: number
    _all: number
  }


  export type PaymentAvgAggregateInputType = {
    amount?: true
  }

  export type PaymentSumAggregateInputType = {
    amount?: true
  }

  export type PaymentMinAggregateInputType = {
    id?: true
    invoiceId?: true
    pelangganId?: true
    amount?: true
    paymentDate?: true
    paymentMethod?: true
    reference?: true
    notes?: true
    verifiedBy?: true
    verifiedAt?: true
    createdAt?: true
    updatedAt?: true
    accountId?: true
    gatewayStatus?: true
    gatewayProvider?: true
    transactionId?: true
    paymentUrl?: true
    expiresAt?: true
    unmatchedMutationId?: true
    receiptUrl?: true
  }

  export type PaymentMaxAggregateInputType = {
    id?: true
    invoiceId?: true
    pelangganId?: true
    amount?: true
    paymentDate?: true
    paymentMethod?: true
    reference?: true
    notes?: true
    verifiedBy?: true
    verifiedAt?: true
    createdAt?: true
    updatedAt?: true
    accountId?: true
    gatewayStatus?: true
    gatewayProvider?: true
    transactionId?: true
    paymentUrl?: true
    expiresAt?: true
    unmatchedMutationId?: true
    receiptUrl?: true
  }

  export type PaymentCountAggregateInputType = {
    id?: true
    invoiceId?: true
    pelangganId?: true
    amount?: true
    paymentDate?: true
    paymentMethod?: true
    reference?: true
    notes?: true
    verifiedBy?: true
    verifiedAt?: true
    createdAt?: true
    updatedAt?: true
    accountId?: true
    gatewayStatus?: true
    gatewayProvider?: true
    transactionId?: true
    paymentUrl?: true
    expiresAt?: true
    unmatchedMutationId?: true
    receiptUrl?: true
    _all?: true
  }

  export type PaymentAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Payment to aggregate.
     */
    where?: PaymentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Payments to fetch.
     */
    orderBy?: PaymentOrderByWithRelationInput | PaymentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PaymentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Payments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Payments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Payments
    **/
    _count?: true | PaymentCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PaymentAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PaymentSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PaymentMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PaymentMaxAggregateInputType
  }

  export type GetPaymentAggregateType<T extends PaymentAggregateArgs> = {
        [P in keyof T & keyof AggregatePayment]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePayment[P]>
      : GetScalarType<T[P], AggregatePayment[P]>
  }




  export type PaymentGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PaymentWhereInput
    orderBy?: PaymentOrderByWithAggregationInput | PaymentOrderByWithAggregationInput[]
    by: PaymentScalarFieldEnum[] | PaymentScalarFieldEnum
    having?: PaymentScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PaymentCountAggregateInputType | true
    _avg?: PaymentAvgAggregateInputType
    _sum?: PaymentSumAggregateInputType
    _min?: PaymentMinAggregateInputType
    _max?: PaymentMaxAggregateInputType
  }

  export type PaymentGroupByOutputType = {
    id: string
    invoiceId: string | null
    pelangganId: string
    amount: bigint
    paymentDate: Date
    paymentMethod: $Enums.PaymentMethod
    reference: string | null
    notes: string | null
    verifiedBy: string | null
    verifiedAt: Date | null
    createdAt: Date
    updatedAt: Date
    accountId: string | null
    gatewayStatus: $Enums.GatewayPaymentStatus | null
    gatewayProvider: string | null
    transactionId: string | null
    paymentUrl: string | null
    expiresAt: Date | null
    unmatchedMutationId: string | null
    receiptUrl: string | null
    _count: PaymentCountAggregateOutputType | null
    _avg: PaymentAvgAggregateOutputType | null
    _sum: PaymentSumAggregateOutputType | null
    _min: PaymentMinAggregateOutputType | null
    _max: PaymentMaxAggregateOutputType | null
  }

  type GetPaymentGroupByPayload<T extends PaymentGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PaymentGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PaymentGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PaymentGroupByOutputType[P]>
            : GetScalarType<T[P], PaymentGroupByOutputType[P]>
        }
      >
    >


  export type PaymentSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    invoiceId?: boolean
    pelangganId?: boolean
    amount?: boolean
    paymentDate?: boolean
    paymentMethod?: boolean
    reference?: boolean
    notes?: boolean
    verifiedBy?: boolean
    verifiedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    accountId?: boolean
    gatewayStatus?: boolean
    gatewayProvider?: boolean
    transactionId?: boolean
    paymentUrl?: boolean
    expiresAt?: boolean
    unmatchedMutationId?: boolean
    receiptUrl?: boolean
    invoice?: boolean | Payment$invoiceArgs<ExtArgs>
    unmatchedMutation?: boolean | Payment$unmatchedMutationArgs<ExtArgs>
  }, ExtArgs["result"]["payment"]>

  export type PaymentSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    invoiceId?: boolean
    pelangganId?: boolean
    amount?: boolean
    paymentDate?: boolean
    paymentMethod?: boolean
    reference?: boolean
    notes?: boolean
    verifiedBy?: boolean
    verifiedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    accountId?: boolean
    gatewayStatus?: boolean
    gatewayProvider?: boolean
    transactionId?: boolean
    paymentUrl?: boolean
    expiresAt?: boolean
    unmatchedMutationId?: boolean
    receiptUrl?: boolean
    invoice?: boolean | Payment$invoiceArgs<ExtArgs>
    unmatchedMutation?: boolean | Payment$unmatchedMutationArgs<ExtArgs>
  }, ExtArgs["result"]["payment"]>

  export type PaymentSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    invoiceId?: boolean
    pelangganId?: boolean
    amount?: boolean
    paymentDate?: boolean
    paymentMethod?: boolean
    reference?: boolean
    notes?: boolean
    verifiedBy?: boolean
    verifiedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    accountId?: boolean
    gatewayStatus?: boolean
    gatewayProvider?: boolean
    transactionId?: boolean
    paymentUrl?: boolean
    expiresAt?: boolean
    unmatchedMutationId?: boolean
    receiptUrl?: boolean
    invoice?: boolean | Payment$invoiceArgs<ExtArgs>
    unmatchedMutation?: boolean | Payment$unmatchedMutationArgs<ExtArgs>
  }, ExtArgs["result"]["payment"]>

  export type PaymentSelectScalar = {
    id?: boolean
    invoiceId?: boolean
    pelangganId?: boolean
    amount?: boolean
    paymentDate?: boolean
    paymentMethod?: boolean
    reference?: boolean
    notes?: boolean
    verifiedBy?: boolean
    verifiedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    accountId?: boolean
    gatewayStatus?: boolean
    gatewayProvider?: boolean
    transactionId?: boolean
    paymentUrl?: boolean
    expiresAt?: boolean
    unmatchedMutationId?: boolean
    receiptUrl?: boolean
  }

  export type PaymentOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "invoiceId" | "pelangganId" | "amount" | "paymentDate" | "paymentMethod" | "reference" | "notes" | "verifiedBy" | "verifiedAt" | "createdAt" | "updatedAt" | "accountId" | "gatewayStatus" | "gatewayProvider" | "transactionId" | "paymentUrl" | "expiresAt" | "unmatchedMutationId" | "receiptUrl", ExtArgs["result"]["payment"]>
  export type PaymentInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invoice?: boolean | Payment$invoiceArgs<ExtArgs>
    unmatchedMutation?: boolean | Payment$unmatchedMutationArgs<ExtArgs>
  }
  export type PaymentIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invoice?: boolean | Payment$invoiceArgs<ExtArgs>
    unmatchedMutation?: boolean | Payment$unmatchedMutationArgs<ExtArgs>
  }
  export type PaymentIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invoice?: boolean | Payment$invoiceArgs<ExtArgs>
    unmatchedMutation?: boolean | Payment$unmatchedMutationArgs<ExtArgs>
  }

  export type $PaymentPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Payment"
    objects: {
      invoice: Prisma.$InvoicePayload<ExtArgs> | null
      unmatchedMutation: Prisma.$UnmatchedMutationPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      invoiceId: string | null
      pelangganId: string
      amount: bigint
      paymentDate: Date
      paymentMethod: $Enums.PaymentMethod
      reference: string | null
      notes: string | null
      verifiedBy: string | null
      verifiedAt: Date | null
      createdAt: Date
      updatedAt: Date
      accountId: string | null
      gatewayStatus: $Enums.GatewayPaymentStatus | null
      gatewayProvider: string | null
      transactionId: string | null
      paymentUrl: string | null
      expiresAt: Date | null
      unmatchedMutationId: string | null
      receiptUrl: string | null
    }, ExtArgs["result"]["payment"]>
    composites: {}
  }

  type PaymentGetPayload<S extends boolean | null | undefined | PaymentDefaultArgs> = $Result.GetResult<Prisma.$PaymentPayload, S>

  type PaymentCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PaymentFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PaymentCountAggregateInputType | true
    }

  export interface PaymentDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Payment'], meta: { name: 'Payment' } }
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
    findUnique<T extends PaymentFindUniqueArgs>(args: SelectSubset<T, PaymentFindUniqueArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

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
    findUniqueOrThrow<T extends PaymentFindUniqueOrThrowArgs>(args: SelectSubset<T, PaymentFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    findFirst<T extends PaymentFindFirstArgs>(args?: SelectSubset<T, PaymentFindFirstArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

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
    findFirstOrThrow<T extends PaymentFindFirstOrThrowArgs>(args?: SelectSubset<T, PaymentFindFirstOrThrowArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    findMany<T extends PaymentFindManyArgs>(args?: SelectSubset<T, PaymentFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

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
    create<T extends PaymentCreateArgs>(args: SelectSubset<T, PaymentCreateArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    createMany<T extends PaymentCreateManyArgs>(args?: SelectSubset<T, PaymentCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

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
    createManyAndReturn<T extends PaymentCreateManyAndReturnArgs>(args?: SelectSubset<T, PaymentCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

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
    delete<T extends PaymentDeleteArgs>(args: SelectSubset<T, PaymentDeleteArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    update<T extends PaymentUpdateArgs>(args: SelectSubset<T, PaymentUpdateArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    deleteMany<T extends PaymentDeleteManyArgs>(args?: SelectSubset<T, PaymentDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

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
    updateMany<T extends PaymentUpdateManyArgs>(args: SelectSubset<T, PaymentUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

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
    updateManyAndReturn<T extends PaymentUpdateManyAndReturnArgs>(args: SelectSubset<T, PaymentUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

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
    upsert<T extends PaymentUpsertArgs>(args: SelectSubset<T, PaymentUpsertArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


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
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PaymentCountAggregateOutputType>
        : number
    >

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
    aggregate<T extends PaymentAggregateArgs>(args: Subset<T, PaymentAggregateArgs>): Prisma.PrismaPromise<GetPaymentAggregateType<T>>

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
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PaymentGroupByArgs['orderBy'] }
        : { orderBy?: PaymentGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
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
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PaymentGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPaymentGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
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
  export interface Prisma__PaymentClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    invoice<T extends Payment$invoiceArgs<ExtArgs> = {}>(args?: Subset<T, Payment$invoiceArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    unmatchedMutation<T extends Payment$unmatchedMutationArgs<ExtArgs> = {}>(args?: Subset<T, Payment$unmatchedMutationArgs<ExtArgs>>): Prisma__UnmatchedMutationClient<$Result.GetResult<Prisma.$UnmatchedMutationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Payment model
   */
  interface PaymentFieldRefs {
    readonly id: FieldRef<"Payment", 'String'>
    readonly invoiceId: FieldRef<"Payment", 'String'>
    readonly pelangganId: FieldRef<"Payment", 'String'>
    readonly amount: FieldRef<"Payment", 'BigInt'>
    readonly paymentDate: FieldRef<"Payment", 'DateTime'>
    readonly paymentMethod: FieldRef<"Payment", 'PaymentMethod'>
    readonly reference: FieldRef<"Payment", 'String'>
    readonly notes: FieldRef<"Payment", 'String'>
    readonly verifiedBy: FieldRef<"Payment", 'String'>
    readonly verifiedAt: FieldRef<"Payment", 'DateTime'>
    readonly createdAt: FieldRef<"Payment", 'DateTime'>
    readonly updatedAt: FieldRef<"Payment", 'DateTime'>
    readonly accountId: FieldRef<"Payment", 'String'>
    readonly gatewayStatus: FieldRef<"Payment", 'GatewayPaymentStatus'>
    readonly gatewayProvider: FieldRef<"Payment", 'String'>
    readonly transactionId: FieldRef<"Payment", 'String'>
    readonly paymentUrl: FieldRef<"Payment", 'String'>
    readonly expiresAt: FieldRef<"Payment", 'DateTime'>
    readonly unmatchedMutationId: FieldRef<"Payment", 'String'>
    readonly receiptUrl: FieldRef<"Payment", 'String'>
  }
    

  // Custom InputTypes
  /**
   * Payment findUnique
   */
  export type PaymentFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * Filter, which Payment to fetch.
     */
    where: PaymentWhereUniqueInput
  }

  /**
   * Payment findUniqueOrThrow
   */
  export type PaymentFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * Filter, which Payment to fetch.
     */
    where: PaymentWhereUniqueInput
  }

  /**
   * Payment findFirst
   */
  export type PaymentFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * Filter, which Payment to fetch.
     */
    where?: PaymentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Payments to fetch.
     */
    orderBy?: PaymentOrderByWithRelationInput | PaymentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Payments.
     */
    cursor?: PaymentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Payments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Payments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Payments.
     */
    distinct?: PaymentScalarFieldEnum | PaymentScalarFieldEnum[]
  }

  /**
   * Payment findFirstOrThrow
   */
  export type PaymentFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * Filter, which Payment to fetch.
     */
    where?: PaymentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Payments to fetch.
     */
    orderBy?: PaymentOrderByWithRelationInput | PaymentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Payments.
     */
    cursor?: PaymentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Payments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Payments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Payments.
     */
    distinct?: PaymentScalarFieldEnum | PaymentScalarFieldEnum[]
  }

  /**
   * Payment findMany
   */
  export type PaymentFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * Filter, which Payments to fetch.
     */
    where?: PaymentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Payments to fetch.
     */
    orderBy?: PaymentOrderByWithRelationInput | PaymentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Payments.
     */
    cursor?: PaymentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Payments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Payments.
     */
    skip?: number
    distinct?: PaymentScalarFieldEnum | PaymentScalarFieldEnum[]
  }

  /**
   * Payment create
   */
  export type PaymentCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * The data needed to create a Payment.
     */
    data: XOR<PaymentCreateInput, PaymentUncheckedCreateInput>
  }

  /**
   * Payment createMany
   */
  export type PaymentCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Payments.
     */
    data: PaymentCreateManyInput | PaymentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Payment createManyAndReturn
   */
  export type PaymentCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null
    /**
     * The data used to create many Payments.
     */
    data: PaymentCreateManyInput | PaymentCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Payment update
   */
  export type PaymentUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * The data needed to update a Payment.
     */
    data: XOR<PaymentUpdateInput, PaymentUncheckedUpdateInput>
    /**
     * Choose, which Payment to update.
     */
    where: PaymentWhereUniqueInput
  }

  /**
   * Payment updateMany
   */
  export type PaymentUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Payments.
     */
    data: XOR<PaymentUpdateManyMutationInput, PaymentUncheckedUpdateManyInput>
    /**
     * Filter which Payments to update
     */
    where?: PaymentWhereInput
    /**
     * Limit how many Payments to update.
     */
    limit?: number
  }

  /**
   * Payment updateManyAndReturn
   */
  export type PaymentUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null
    /**
     * The data used to update Payments.
     */
    data: XOR<PaymentUpdateManyMutationInput, PaymentUncheckedUpdateManyInput>
    /**
     * Filter which Payments to update
     */
    where?: PaymentWhereInput
    /**
     * Limit how many Payments to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Payment upsert
   */
  export type PaymentUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * The filter to search for the Payment to update in case it exists.
     */
    where: PaymentWhereUniqueInput
    /**
     * In case the Payment found by the `where` argument doesn't exist, create a new Payment with this data.
     */
    create: XOR<PaymentCreateInput, PaymentUncheckedCreateInput>
    /**
     * In case the Payment was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PaymentUpdateInput, PaymentUncheckedUpdateInput>
  }

  /**
   * Payment delete
   */
  export type PaymentDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    /**
     * Filter which Payment to delete.
     */
    where: PaymentWhereUniqueInput
  }

  /**
   * Payment deleteMany
   */
  export type PaymentDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Payments to delete
     */
    where?: PaymentWhereInput
    /**
     * Limit how many Payments to delete.
     */
    limit?: number
  }

  /**
   * Payment.invoice
   */
  export type Payment$invoiceArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    where?: InvoiceWhereInput
  }

  /**
   * Payment.unmatchedMutation
   */
  export type Payment$unmatchedMutationArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null
    where?: UnmatchedMutationWhereInput
  }

  /**
   * Payment without action
   */
  export type PaymentDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
  }


  /**
   * Model PaymentGatewayConfig
   */

  export type AggregatePaymentGatewayConfig = {
    _count: PaymentGatewayConfigCountAggregateOutputType | null
    _avg: PaymentGatewayConfigAvgAggregateOutputType | null
    _sum: PaymentGatewayConfigSumAggregateOutputType | null
    _min: PaymentGatewayConfigMinAggregateOutputType | null
    _max: PaymentGatewayConfigMaxAggregateOutputType | null
  }

  export type PaymentGatewayConfigAvgAggregateOutputType = {
    priority: number | null
  }

  export type PaymentGatewayConfigSumAggregateOutputType = {
    priority: number | null
  }

  export type PaymentGatewayConfigMinAggregateOutputType = {
    id: string | null
    provider: string | null
    providerName: string | null
    isEnabled: boolean | null
    isProduction: boolean | null
    priority: number | null
    apiKey: string | null
    apiSecret: string | null
    clientKey: string | null
    merchantId: string | null
    webhookUrl: string | null
    callbackUrl: string | null
    lastTestedAt: Date | null
    testStatus: string | null
    createdAt: Date | null
    updatedAt: Date | null
    createdBy: string | null
  }

  export type PaymentGatewayConfigMaxAggregateOutputType = {
    id: string | null
    provider: string | null
    providerName: string | null
    isEnabled: boolean | null
    isProduction: boolean | null
    priority: number | null
    apiKey: string | null
    apiSecret: string | null
    clientKey: string | null
    merchantId: string | null
    webhookUrl: string | null
    callbackUrl: string | null
    lastTestedAt: Date | null
    testStatus: string | null
    createdAt: Date | null
    updatedAt: Date | null
    createdBy: string | null
  }

  export type PaymentGatewayConfigCountAggregateOutputType = {
    id: number
    provider: number
    providerName: number
    isEnabled: number
    isProduction: number
    priority: number
    apiKey: number
    apiSecret: number
    clientKey: number
    merchantId: number
    webhookUrl: number
    callbackUrl: number
    settings: number
    lastTestedAt: number
    testStatus: number
    createdAt: number
    updatedAt: number
    createdBy: number
    _all: number
  }


  export type PaymentGatewayConfigAvgAggregateInputType = {
    priority?: true
  }

  export type PaymentGatewayConfigSumAggregateInputType = {
    priority?: true
  }

  export type PaymentGatewayConfigMinAggregateInputType = {
    id?: true
    provider?: true
    providerName?: true
    isEnabled?: true
    isProduction?: true
    priority?: true
    apiKey?: true
    apiSecret?: true
    clientKey?: true
    merchantId?: true
    webhookUrl?: true
    callbackUrl?: true
    lastTestedAt?: true
    testStatus?: true
    createdAt?: true
    updatedAt?: true
    createdBy?: true
  }

  export type PaymentGatewayConfigMaxAggregateInputType = {
    id?: true
    provider?: true
    providerName?: true
    isEnabled?: true
    isProduction?: true
    priority?: true
    apiKey?: true
    apiSecret?: true
    clientKey?: true
    merchantId?: true
    webhookUrl?: true
    callbackUrl?: true
    lastTestedAt?: true
    testStatus?: true
    createdAt?: true
    updatedAt?: true
    createdBy?: true
  }

  export type PaymentGatewayConfigCountAggregateInputType = {
    id?: true
    provider?: true
    providerName?: true
    isEnabled?: true
    isProduction?: true
    priority?: true
    apiKey?: true
    apiSecret?: true
    clientKey?: true
    merchantId?: true
    webhookUrl?: true
    callbackUrl?: true
    settings?: true
    lastTestedAt?: true
    testStatus?: true
    createdAt?: true
    updatedAt?: true
    createdBy?: true
    _all?: true
  }

  export type PaymentGatewayConfigAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PaymentGatewayConfig to aggregate.
     */
    where?: PaymentGatewayConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PaymentGatewayConfigs to fetch.
     */
    orderBy?: PaymentGatewayConfigOrderByWithRelationInput | PaymentGatewayConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PaymentGatewayConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PaymentGatewayConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PaymentGatewayConfigs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PaymentGatewayConfigs
    **/
    _count?: true | PaymentGatewayConfigCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PaymentGatewayConfigAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PaymentGatewayConfigSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PaymentGatewayConfigMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PaymentGatewayConfigMaxAggregateInputType
  }

  export type GetPaymentGatewayConfigAggregateType<T extends PaymentGatewayConfigAggregateArgs> = {
        [P in keyof T & keyof AggregatePaymentGatewayConfig]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePaymentGatewayConfig[P]>
      : GetScalarType<T[P], AggregatePaymentGatewayConfig[P]>
  }




  export type PaymentGatewayConfigGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PaymentGatewayConfigWhereInput
    orderBy?: PaymentGatewayConfigOrderByWithAggregationInput | PaymentGatewayConfigOrderByWithAggregationInput[]
    by: PaymentGatewayConfigScalarFieldEnum[] | PaymentGatewayConfigScalarFieldEnum
    having?: PaymentGatewayConfigScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PaymentGatewayConfigCountAggregateInputType | true
    _avg?: PaymentGatewayConfigAvgAggregateInputType
    _sum?: PaymentGatewayConfigSumAggregateInputType
    _min?: PaymentGatewayConfigMinAggregateInputType
    _max?: PaymentGatewayConfigMaxAggregateInputType
  }

  export type PaymentGatewayConfigGroupByOutputType = {
    id: string
    provider: string
    providerName: string
    isEnabled: boolean
    isProduction: boolean
    priority: number
    apiKey: string | null
    apiSecret: string | null
    clientKey: string | null
    merchantId: string | null
    webhookUrl: string | null
    callbackUrl: string | null
    settings: JsonValue | null
    lastTestedAt: Date | null
    testStatus: string | null
    createdAt: Date
    updatedAt: Date
    createdBy: string | null
    _count: PaymentGatewayConfigCountAggregateOutputType | null
    _avg: PaymentGatewayConfigAvgAggregateOutputType | null
    _sum: PaymentGatewayConfigSumAggregateOutputType | null
    _min: PaymentGatewayConfigMinAggregateOutputType | null
    _max: PaymentGatewayConfigMaxAggregateOutputType | null
  }

  type GetPaymentGatewayConfigGroupByPayload<T extends PaymentGatewayConfigGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PaymentGatewayConfigGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PaymentGatewayConfigGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PaymentGatewayConfigGroupByOutputType[P]>
            : GetScalarType<T[P], PaymentGatewayConfigGroupByOutputType[P]>
        }
      >
    >


  export type PaymentGatewayConfigSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    provider?: boolean
    providerName?: boolean
    isEnabled?: boolean
    isProduction?: boolean
    priority?: boolean
    apiKey?: boolean
    apiSecret?: boolean
    clientKey?: boolean
    merchantId?: boolean
    webhookUrl?: boolean
    callbackUrl?: boolean
    settings?: boolean
    lastTestedAt?: boolean
    testStatus?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    createdBy?: boolean
  }, ExtArgs["result"]["paymentGatewayConfig"]>

  export type PaymentGatewayConfigSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    provider?: boolean
    providerName?: boolean
    isEnabled?: boolean
    isProduction?: boolean
    priority?: boolean
    apiKey?: boolean
    apiSecret?: boolean
    clientKey?: boolean
    merchantId?: boolean
    webhookUrl?: boolean
    callbackUrl?: boolean
    settings?: boolean
    lastTestedAt?: boolean
    testStatus?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    createdBy?: boolean
  }, ExtArgs["result"]["paymentGatewayConfig"]>

  export type PaymentGatewayConfigSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    provider?: boolean
    providerName?: boolean
    isEnabled?: boolean
    isProduction?: boolean
    priority?: boolean
    apiKey?: boolean
    apiSecret?: boolean
    clientKey?: boolean
    merchantId?: boolean
    webhookUrl?: boolean
    callbackUrl?: boolean
    settings?: boolean
    lastTestedAt?: boolean
    testStatus?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    createdBy?: boolean
  }, ExtArgs["result"]["paymentGatewayConfig"]>

  export type PaymentGatewayConfigSelectScalar = {
    id?: boolean
    provider?: boolean
    providerName?: boolean
    isEnabled?: boolean
    isProduction?: boolean
    priority?: boolean
    apiKey?: boolean
    apiSecret?: boolean
    clientKey?: boolean
    merchantId?: boolean
    webhookUrl?: boolean
    callbackUrl?: boolean
    settings?: boolean
    lastTestedAt?: boolean
    testStatus?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    createdBy?: boolean
  }

  export type PaymentGatewayConfigOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "provider" | "providerName" | "isEnabled" | "isProduction" | "priority" | "apiKey" | "apiSecret" | "clientKey" | "merchantId" | "webhookUrl" | "callbackUrl" | "settings" | "lastTestedAt" | "testStatus" | "createdAt" | "updatedAt" | "createdBy", ExtArgs["result"]["paymentGatewayConfig"]>

  export type $PaymentGatewayConfigPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PaymentGatewayConfig"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      provider: string
      providerName: string
      isEnabled: boolean
      isProduction: boolean
      priority: number
      apiKey: string | null
      apiSecret: string | null
      clientKey: string | null
      merchantId: string | null
      webhookUrl: string | null
      callbackUrl: string | null
      settings: Prisma.JsonValue | null
      lastTestedAt: Date | null
      testStatus: string | null
      createdAt: Date
      updatedAt: Date
      createdBy: string | null
    }, ExtArgs["result"]["paymentGatewayConfig"]>
    composites: {}
  }

  type PaymentGatewayConfigGetPayload<S extends boolean | null | undefined | PaymentGatewayConfigDefaultArgs> = $Result.GetResult<Prisma.$PaymentGatewayConfigPayload, S>

  type PaymentGatewayConfigCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PaymentGatewayConfigFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PaymentGatewayConfigCountAggregateInputType | true
    }

  export interface PaymentGatewayConfigDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PaymentGatewayConfig'], meta: { name: 'PaymentGatewayConfig' } }
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
    findUnique<T extends PaymentGatewayConfigFindUniqueArgs>(args: SelectSubset<T, PaymentGatewayConfigFindUniqueArgs<ExtArgs>>): Prisma__PaymentGatewayConfigClient<$Result.GetResult<Prisma.$PaymentGatewayConfigPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

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
    findUniqueOrThrow<T extends PaymentGatewayConfigFindUniqueOrThrowArgs>(args: SelectSubset<T, PaymentGatewayConfigFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PaymentGatewayConfigClient<$Result.GetResult<Prisma.$PaymentGatewayConfigPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    findFirst<T extends PaymentGatewayConfigFindFirstArgs>(args?: SelectSubset<T, PaymentGatewayConfigFindFirstArgs<ExtArgs>>): Prisma__PaymentGatewayConfigClient<$Result.GetResult<Prisma.$PaymentGatewayConfigPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

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
    findFirstOrThrow<T extends PaymentGatewayConfigFindFirstOrThrowArgs>(args?: SelectSubset<T, PaymentGatewayConfigFindFirstOrThrowArgs<ExtArgs>>): Prisma__PaymentGatewayConfigClient<$Result.GetResult<Prisma.$PaymentGatewayConfigPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    findMany<T extends PaymentGatewayConfigFindManyArgs>(args?: SelectSubset<T, PaymentGatewayConfigFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaymentGatewayConfigPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

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
    create<T extends PaymentGatewayConfigCreateArgs>(args: SelectSubset<T, PaymentGatewayConfigCreateArgs<ExtArgs>>): Prisma__PaymentGatewayConfigClient<$Result.GetResult<Prisma.$PaymentGatewayConfigPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    createMany<T extends PaymentGatewayConfigCreateManyArgs>(args?: SelectSubset<T, PaymentGatewayConfigCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

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
    createManyAndReturn<T extends PaymentGatewayConfigCreateManyAndReturnArgs>(args?: SelectSubset<T, PaymentGatewayConfigCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaymentGatewayConfigPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

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
    delete<T extends PaymentGatewayConfigDeleteArgs>(args: SelectSubset<T, PaymentGatewayConfigDeleteArgs<ExtArgs>>): Prisma__PaymentGatewayConfigClient<$Result.GetResult<Prisma.$PaymentGatewayConfigPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    update<T extends PaymentGatewayConfigUpdateArgs>(args: SelectSubset<T, PaymentGatewayConfigUpdateArgs<ExtArgs>>): Prisma__PaymentGatewayConfigClient<$Result.GetResult<Prisma.$PaymentGatewayConfigPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    deleteMany<T extends PaymentGatewayConfigDeleteManyArgs>(args?: SelectSubset<T, PaymentGatewayConfigDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

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
    updateMany<T extends PaymentGatewayConfigUpdateManyArgs>(args: SelectSubset<T, PaymentGatewayConfigUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

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
    updateManyAndReturn<T extends PaymentGatewayConfigUpdateManyAndReturnArgs>(args: SelectSubset<T, PaymentGatewayConfigUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PaymentGatewayConfigPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

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
    upsert<T extends PaymentGatewayConfigUpsertArgs>(args: SelectSubset<T, PaymentGatewayConfigUpsertArgs<ExtArgs>>): Prisma__PaymentGatewayConfigClient<$Result.GetResult<Prisma.$PaymentGatewayConfigPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


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
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PaymentGatewayConfigCountAggregateOutputType>
        : number
    >

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
    aggregate<T extends PaymentGatewayConfigAggregateArgs>(args: Subset<T, PaymentGatewayConfigAggregateArgs>): Prisma.PrismaPromise<GetPaymentGatewayConfigAggregateType<T>>

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
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PaymentGatewayConfigGroupByArgs['orderBy'] }
        : { orderBy?: PaymentGatewayConfigGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
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
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PaymentGatewayConfigGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPaymentGatewayConfigGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
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
  export interface Prisma__PaymentGatewayConfigClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PaymentGatewayConfig model
   */
  interface PaymentGatewayConfigFieldRefs {
    readonly id: FieldRef<"PaymentGatewayConfig", 'String'>
    readonly provider: FieldRef<"PaymentGatewayConfig", 'String'>
    readonly providerName: FieldRef<"PaymentGatewayConfig", 'String'>
    readonly isEnabled: FieldRef<"PaymentGatewayConfig", 'Boolean'>
    readonly isProduction: FieldRef<"PaymentGatewayConfig", 'Boolean'>
    readonly priority: FieldRef<"PaymentGatewayConfig", 'Int'>
    readonly apiKey: FieldRef<"PaymentGatewayConfig", 'String'>
    readonly apiSecret: FieldRef<"PaymentGatewayConfig", 'String'>
    readonly clientKey: FieldRef<"PaymentGatewayConfig", 'String'>
    readonly merchantId: FieldRef<"PaymentGatewayConfig", 'String'>
    readonly webhookUrl: FieldRef<"PaymentGatewayConfig", 'String'>
    readonly callbackUrl: FieldRef<"PaymentGatewayConfig", 'String'>
    readonly settings: FieldRef<"PaymentGatewayConfig", 'Json'>
    readonly lastTestedAt: FieldRef<"PaymentGatewayConfig", 'DateTime'>
    readonly testStatus: FieldRef<"PaymentGatewayConfig", 'String'>
    readonly createdAt: FieldRef<"PaymentGatewayConfig", 'DateTime'>
    readonly updatedAt: FieldRef<"PaymentGatewayConfig", 'DateTime'>
    readonly createdBy: FieldRef<"PaymentGatewayConfig", 'String'>
  }
    

  // Custom InputTypes
  /**
   * PaymentGatewayConfig findUnique
   */
  export type PaymentGatewayConfigFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null
    /**
     * Filter, which PaymentGatewayConfig to fetch.
     */
    where: PaymentGatewayConfigWhereUniqueInput
  }

  /**
   * PaymentGatewayConfig findUniqueOrThrow
   */
  export type PaymentGatewayConfigFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null
    /**
     * Filter, which PaymentGatewayConfig to fetch.
     */
    where: PaymentGatewayConfigWhereUniqueInput
  }

  /**
   * PaymentGatewayConfig findFirst
   */
  export type PaymentGatewayConfigFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null
    /**
     * Filter, which PaymentGatewayConfig to fetch.
     */
    where?: PaymentGatewayConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PaymentGatewayConfigs to fetch.
     */
    orderBy?: PaymentGatewayConfigOrderByWithRelationInput | PaymentGatewayConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PaymentGatewayConfigs.
     */
    cursor?: PaymentGatewayConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PaymentGatewayConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PaymentGatewayConfigs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PaymentGatewayConfigs.
     */
    distinct?: PaymentGatewayConfigScalarFieldEnum | PaymentGatewayConfigScalarFieldEnum[]
  }

  /**
   * PaymentGatewayConfig findFirstOrThrow
   */
  export type PaymentGatewayConfigFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null
    /**
     * Filter, which PaymentGatewayConfig to fetch.
     */
    where?: PaymentGatewayConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PaymentGatewayConfigs to fetch.
     */
    orderBy?: PaymentGatewayConfigOrderByWithRelationInput | PaymentGatewayConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PaymentGatewayConfigs.
     */
    cursor?: PaymentGatewayConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PaymentGatewayConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PaymentGatewayConfigs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PaymentGatewayConfigs.
     */
    distinct?: PaymentGatewayConfigScalarFieldEnum | PaymentGatewayConfigScalarFieldEnum[]
  }

  /**
   * PaymentGatewayConfig findMany
   */
  export type PaymentGatewayConfigFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null
    /**
     * Filter, which PaymentGatewayConfigs to fetch.
     */
    where?: PaymentGatewayConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PaymentGatewayConfigs to fetch.
     */
    orderBy?: PaymentGatewayConfigOrderByWithRelationInput | PaymentGatewayConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PaymentGatewayConfigs.
     */
    cursor?: PaymentGatewayConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PaymentGatewayConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PaymentGatewayConfigs.
     */
    skip?: number
    distinct?: PaymentGatewayConfigScalarFieldEnum | PaymentGatewayConfigScalarFieldEnum[]
  }

  /**
   * PaymentGatewayConfig create
   */
  export type PaymentGatewayConfigCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null
    /**
     * The data needed to create a PaymentGatewayConfig.
     */
    data: XOR<PaymentGatewayConfigCreateInput, PaymentGatewayConfigUncheckedCreateInput>
  }

  /**
   * PaymentGatewayConfig createMany
   */
  export type PaymentGatewayConfigCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PaymentGatewayConfigs.
     */
    data: PaymentGatewayConfigCreateManyInput | PaymentGatewayConfigCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PaymentGatewayConfig createManyAndReturn
   */
  export type PaymentGatewayConfigCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null
    /**
     * The data used to create many PaymentGatewayConfigs.
     */
    data: PaymentGatewayConfigCreateManyInput | PaymentGatewayConfigCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PaymentGatewayConfig update
   */
  export type PaymentGatewayConfigUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null
    /**
     * The data needed to update a PaymentGatewayConfig.
     */
    data: XOR<PaymentGatewayConfigUpdateInput, PaymentGatewayConfigUncheckedUpdateInput>
    /**
     * Choose, which PaymentGatewayConfig to update.
     */
    where: PaymentGatewayConfigWhereUniqueInput
  }

  /**
   * PaymentGatewayConfig updateMany
   */
  export type PaymentGatewayConfigUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PaymentGatewayConfigs.
     */
    data: XOR<PaymentGatewayConfigUpdateManyMutationInput, PaymentGatewayConfigUncheckedUpdateManyInput>
    /**
     * Filter which PaymentGatewayConfigs to update
     */
    where?: PaymentGatewayConfigWhereInput
    /**
     * Limit how many PaymentGatewayConfigs to update.
     */
    limit?: number
  }

  /**
   * PaymentGatewayConfig updateManyAndReturn
   */
  export type PaymentGatewayConfigUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null
    /**
     * The data used to update PaymentGatewayConfigs.
     */
    data: XOR<PaymentGatewayConfigUpdateManyMutationInput, PaymentGatewayConfigUncheckedUpdateManyInput>
    /**
     * Filter which PaymentGatewayConfigs to update
     */
    where?: PaymentGatewayConfigWhereInput
    /**
     * Limit how many PaymentGatewayConfigs to update.
     */
    limit?: number
  }

  /**
   * PaymentGatewayConfig upsert
   */
  export type PaymentGatewayConfigUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null
    /**
     * The filter to search for the PaymentGatewayConfig to update in case it exists.
     */
    where: PaymentGatewayConfigWhereUniqueInput
    /**
     * In case the PaymentGatewayConfig found by the `where` argument doesn't exist, create a new PaymentGatewayConfig with this data.
     */
    create: XOR<PaymentGatewayConfigCreateInput, PaymentGatewayConfigUncheckedCreateInput>
    /**
     * In case the PaymentGatewayConfig was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PaymentGatewayConfigUpdateInput, PaymentGatewayConfigUncheckedUpdateInput>
  }

  /**
   * PaymentGatewayConfig delete
   */
  export type PaymentGatewayConfigDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null
    /**
     * Filter which PaymentGatewayConfig to delete.
     */
    where: PaymentGatewayConfigWhereUniqueInput
  }

  /**
   * PaymentGatewayConfig deleteMany
   */
  export type PaymentGatewayConfigDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PaymentGatewayConfigs to delete
     */
    where?: PaymentGatewayConfigWhereInput
    /**
     * Limit how many PaymentGatewayConfigs to delete.
     */
    limit?: number
  }

  /**
   * PaymentGatewayConfig without action
   */
  export type PaymentGatewayConfigDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PaymentGatewayConfig
     */
    select?: PaymentGatewayConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PaymentGatewayConfig
     */
    omit?: PaymentGatewayConfigOmit<ExtArgs> | null
  }


  /**
   * Model UnmatchedMutation
   */

  export type AggregateUnmatchedMutation = {
    _count: UnmatchedMutationCountAggregateOutputType | null
    _avg: UnmatchedMutationAvgAggregateOutputType | null
    _sum: UnmatchedMutationSumAggregateOutputType | null
    _min: UnmatchedMutationMinAggregateOutputType | null
    _max: UnmatchedMutationMaxAggregateOutputType | null
  }

  export type UnmatchedMutationAvgAggregateOutputType = {
    amount: Decimal | null
  }

  export type UnmatchedMutationSumAggregateOutputType = {
    amount: Decimal | null
  }

  export type UnmatchedMutationMinAggregateOutputType = {
    id: string | null
    provider: string | null
    transactionId: string | null
    amount: Decimal | null
    description: string | null
    type: string | null
    date: Date | null
    bankId: string | null
    status: $Enums.UnmatchedStatus | null
    resolvedAt: Date | null
    resolvedById: string | null
    matchedInvoiceId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UnmatchedMutationMaxAggregateOutputType = {
    id: string | null
    provider: string | null
    transactionId: string | null
    amount: Decimal | null
    description: string | null
    type: string | null
    date: Date | null
    bankId: string | null
    status: $Enums.UnmatchedStatus | null
    resolvedAt: Date | null
    resolvedById: string | null
    matchedInvoiceId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UnmatchedMutationCountAggregateOutputType = {
    id: number
    provider: number
    transactionId: number
    amount: number
    description: number
    type: number
    date: number
    bankId: number
    rawPayload: number
    status: number
    resolvedAt: number
    resolvedById: number
    matchedInvoiceId: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UnmatchedMutationAvgAggregateInputType = {
    amount?: true
  }

  export type UnmatchedMutationSumAggregateInputType = {
    amount?: true
  }

  export type UnmatchedMutationMinAggregateInputType = {
    id?: true
    provider?: true
    transactionId?: true
    amount?: true
    description?: true
    type?: true
    date?: true
    bankId?: true
    status?: true
    resolvedAt?: true
    resolvedById?: true
    matchedInvoiceId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UnmatchedMutationMaxAggregateInputType = {
    id?: true
    provider?: true
    transactionId?: true
    amount?: true
    description?: true
    type?: true
    date?: true
    bankId?: true
    status?: true
    resolvedAt?: true
    resolvedById?: true
    matchedInvoiceId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UnmatchedMutationCountAggregateInputType = {
    id?: true
    provider?: true
    transactionId?: true
    amount?: true
    description?: true
    type?: true
    date?: true
    bankId?: true
    rawPayload?: true
    status?: true
    resolvedAt?: true
    resolvedById?: true
    matchedInvoiceId?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UnmatchedMutationAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UnmatchedMutation to aggregate.
     */
    where?: UnmatchedMutationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UnmatchedMutations to fetch.
     */
    orderBy?: UnmatchedMutationOrderByWithRelationInput | UnmatchedMutationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UnmatchedMutationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UnmatchedMutations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UnmatchedMutations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned UnmatchedMutations
    **/
    _count?: true | UnmatchedMutationCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UnmatchedMutationAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UnmatchedMutationSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UnmatchedMutationMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UnmatchedMutationMaxAggregateInputType
  }

  export type GetUnmatchedMutationAggregateType<T extends UnmatchedMutationAggregateArgs> = {
        [P in keyof T & keyof AggregateUnmatchedMutation]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUnmatchedMutation[P]>
      : GetScalarType<T[P], AggregateUnmatchedMutation[P]>
  }




  export type UnmatchedMutationGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UnmatchedMutationWhereInput
    orderBy?: UnmatchedMutationOrderByWithAggregationInput | UnmatchedMutationOrderByWithAggregationInput[]
    by: UnmatchedMutationScalarFieldEnum[] | UnmatchedMutationScalarFieldEnum
    having?: UnmatchedMutationScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UnmatchedMutationCountAggregateInputType | true
    _avg?: UnmatchedMutationAvgAggregateInputType
    _sum?: UnmatchedMutationSumAggregateInputType
    _min?: UnmatchedMutationMinAggregateInputType
    _max?: UnmatchedMutationMaxAggregateInputType
  }

  export type UnmatchedMutationGroupByOutputType = {
    id: string
    provider: string
    transactionId: string | null
    amount: Decimal
    description: string | null
    type: string | null
    date: Date
    bankId: string | null
    rawPayload: JsonValue | null
    status: $Enums.UnmatchedStatus
    resolvedAt: Date | null
    resolvedById: string | null
    matchedInvoiceId: string | null
    createdAt: Date
    updatedAt: Date
    _count: UnmatchedMutationCountAggregateOutputType | null
    _avg: UnmatchedMutationAvgAggregateOutputType | null
    _sum: UnmatchedMutationSumAggregateOutputType | null
    _min: UnmatchedMutationMinAggregateOutputType | null
    _max: UnmatchedMutationMaxAggregateOutputType | null
  }

  type GetUnmatchedMutationGroupByPayload<T extends UnmatchedMutationGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UnmatchedMutationGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UnmatchedMutationGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UnmatchedMutationGroupByOutputType[P]>
            : GetScalarType<T[P], UnmatchedMutationGroupByOutputType[P]>
        }
      >
    >


  export type UnmatchedMutationSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    provider?: boolean
    transactionId?: boolean
    amount?: boolean
    description?: boolean
    type?: boolean
    date?: boolean
    bankId?: boolean
    rawPayload?: boolean
    status?: boolean
    resolvedAt?: boolean
    resolvedById?: boolean
    matchedInvoiceId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    payment?: boolean | UnmatchedMutation$paymentArgs<ExtArgs>
  }, ExtArgs["result"]["unmatchedMutation"]>

  export type UnmatchedMutationSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    provider?: boolean
    transactionId?: boolean
    amount?: boolean
    description?: boolean
    type?: boolean
    date?: boolean
    bankId?: boolean
    rawPayload?: boolean
    status?: boolean
    resolvedAt?: boolean
    resolvedById?: boolean
    matchedInvoiceId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["unmatchedMutation"]>

  export type UnmatchedMutationSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    provider?: boolean
    transactionId?: boolean
    amount?: boolean
    description?: boolean
    type?: boolean
    date?: boolean
    bankId?: boolean
    rawPayload?: boolean
    status?: boolean
    resolvedAt?: boolean
    resolvedById?: boolean
    matchedInvoiceId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["unmatchedMutation"]>

  export type UnmatchedMutationSelectScalar = {
    id?: boolean
    provider?: boolean
    transactionId?: boolean
    amount?: boolean
    description?: boolean
    type?: boolean
    date?: boolean
    bankId?: boolean
    rawPayload?: boolean
    status?: boolean
    resolvedAt?: boolean
    resolvedById?: boolean
    matchedInvoiceId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UnmatchedMutationOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "provider" | "transactionId" | "amount" | "description" | "type" | "date" | "bankId" | "rawPayload" | "status" | "resolvedAt" | "resolvedById" | "matchedInvoiceId" | "createdAt" | "updatedAt", ExtArgs["result"]["unmatchedMutation"]>
  export type UnmatchedMutationInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    payment?: boolean | UnmatchedMutation$paymentArgs<ExtArgs>
  }
  export type UnmatchedMutationIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type UnmatchedMutationIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UnmatchedMutationPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "UnmatchedMutation"
    objects: {
      payment: Prisma.$PaymentPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      provider: string
      transactionId: string | null
      amount: Prisma.Decimal
      description: string | null
      type: string | null
      date: Date
      bankId: string | null
      rawPayload: Prisma.JsonValue | null
      status: $Enums.UnmatchedStatus
      resolvedAt: Date | null
      resolvedById: string | null
      matchedInvoiceId: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["unmatchedMutation"]>
    composites: {}
  }

  type UnmatchedMutationGetPayload<S extends boolean | null | undefined | UnmatchedMutationDefaultArgs> = $Result.GetResult<Prisma.$UnmatchedMutationPayload, S>

  type UnmatchedMutationCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UnmatchedMutationFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UnmatchedMutationCountAggregateInputType | true
    }

  export interface UnmatchedMutationDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['UnmatchedMutation'], meta: { name: 'UnmatchedMutation' } }
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
    findUnique<T extends UnmatchedMutationFindUniqueArgs>(args: SelectSubset<T, UnmatchedMutationFindUniqueArgs<ExtArgs>>): Prisma__UnmatchedMutationClient<$Result.GetResult<Prisma.$UnmatchedMutationPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

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
    findUniqueOrThrow<T extends UnmatchedMutationFindUniqueOrThrowArgs>(args: SelectSubset<T, UnmatchedMutationFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UnmatchedMutationClient<$Result.GetResult<Prisma.$UnmatchedMutationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    findFirst<T extends UnmatchedMutationFindFirstArgs>(args?: SelectSubset<T, UnmatchedMutationFindFirstArgs<ExtArgs>>): Prisma__UnmatchedMutationClient<$Result.GetResult<Prisma.$UnmatchedMutationPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

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
    findFirstOrThrow<T extends UnmatchedMutationFindFirstOrThrowArgs>(args?: SelectSubset<T, UnmatchedMutationFindFirstOrThrowArgs<ExtArgs>>): Prisma__UnmatchedMutationClient<$Result.GetResult<Prisma.$UnmatchedMutationPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    findMany<T extends UnmatchedMutationFindManyArgs>(args?: SelectSubset<T, UnmatchedMutationFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UnmatchedMutationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

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
    create<T extends UnmatchedMutationCreateArgs>(args: SelectSubset<T, UnmatchedMutationCreateArgs<ExtArgs>>): Prisma__UnmatchedMutationClient<$Result.GetResult<Prisma.$UnmatchedMutationPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    createMany<T extends UnmatchedMutationCreateManyArgs>(args?: SelectSubset<T, UnmatchedMutationCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

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
    createManyAndReturn<T extends UnmatchedMutationCreateManyAndReturnArgs>(args?: SelectSubset<T, UnmatchedMutationCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UnmatchedMutationPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

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
    delete<T extends UnmatchedMutationDeleteArgs>(args: SelectSubset<T, UnmatchedMutationDeleteArgs<ExtArgs>>): Prisma__UnmatchedMutationClient<$Result.GetResult<Prisma.$UnmatchedMutationPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    update<T extends UnmatchedMutationUpdateArgs>(args: SelectSubset<T, UnmatchedMutationUpdateArgs<ExtArgs>>): Prisma__UnmatchedMutationClient<$Result.GetResult<Prisma.$UnmatchedMutationPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

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
    deleteMany<T extends UnmatchedMutationDeleteManyArgs>(args?: SelectSubset<T, UnmatchedMutationDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

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
    updateMany<T extends UnmatchedMutationUpdateManyArgs>(args: SelectSubset<T, UnmatchedMutationUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

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
    updateManyAndReturn<T extends UnmatchedMutationUpdateManyAndReturnArgs>(args: SelectSubset<T, UnmatchedMutationUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UnmatchedMutationPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

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
    upsert<T extends UnmatchedMutationUpsertArgs>(args: SelectSubset<T, UnmatchedMutationUpsertArgs<ExtArgs>>): Prisma__UnmatchedMutationClient<$Result.GetResult<Prisma.$UnmatchedMutationPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


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
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UnmatchedMutationCountAggregateOutputType>
        : number
    >

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
    aggregate<T extends UnmatchedMutationAggregateArgs>(args: Subset<T, UnmatchedMutationAggregateArgs>): Prisma.PrismaPromise<GetUnmatchedMutationAggregateType<T>>

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
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UnmatchedMutationGroupByArgs['orderBy'] }
        : { orderBy?: UnmatchedMutationGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
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
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UnmatchedMutationGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUnmatchedMutationGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
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
  export interface Prisma__UnmatchedMutationClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    payment<T extends UnmatchedMutation$paymentArgs<ExtArgs> = {}>(args?: Subset<T, UnmatchedMutation$paymentArgs<ExtArgs>>): Prisma__PaymentClient<$Result.GetResult<Prisma.$PaymentPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the UnmatchedMutation model
   */
  interface UnmatchedMutationFieldRefs {
    readonly id: FieldRef<"UnmatchedMutation", 'String'>
    readonly provider: FieldRef<"UnmatchedMutation", 'String'>
    readonly transactionId: FieldRef<"UnmatchedMutation", 'String'>
    readonly amount: FieldRef<"UnmatchedMutation", 'Decimal'>
    readonly description: FieldRef<"UnmatchedMutation", 'String'>
    readonly type: FieldRef<"UnmatchedMutation", 'String'>
    readonly date: FieldRef<"UnmatchedMutation", 'DateTime'>
    readonly bankId: FieldRef<"UnmatchedMutation", 'String'>
    readonly rawPayload: FieldRef<"UnmatchedMutation", 'Json'>
    readonly status: FieldRef<"UnmatchedMutation", 'UnmatchedStatus'>
    readonly resolvedAt: FieldRef<"UnmatchedMutation", 'DateTime'>
    readonly resolvedById: FieldRef<"UnmatchedMutation", 'String'>
    readonly matchedInvoiceId: FieldRef<"UnmatchedMutation", 'String'>
    readonly createdAt: FieldRef<"UnmatchedMutation", 'DateTime'>
    readonly updatedAt: FieldRef<"UnmatchedMutation", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * UnmatchedMutation findUnique
   */
  export type UnmatchedMutationFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null
    /**
     * Filter, which UnmatchedMutation to fetch.
     */
    where: UnmatchedMutationWhereUniqueInput
  }

  /**
   * UnmatchedMutation findUniqueOrThrow
   */
  export type UnmatchedMutationFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null
    /**
     * Filter, which UnmatchedMutation to fetch.
     */
    where: UnmatchedMutationWhereUniqueInput
  }

  /**
   * UnmatchedMutation findFirst
   */
  export type UnmatchedMutationFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null
    /**
     * Filter, which UnmatchedMutation to fetch.
     */
    where?: UnmatchedMutationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UnmatchedMutations to fetch.
     */
    orderBy?: UnmatchedMutationOrderByWithRelationInput | UnmatchedMutationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UnmatchedMutations.
     */
    cursor?: UnmatchedMutationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UnmatchedMutations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UnmatchedMutations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UnmatchedMutations.
     */
    distinct?: UnmatchedMutationScalarFieldEnum | UnmatchedMutationScalarFieldEnum[]
  }

  /**
   * UnmatchedMutation findFirstOrThrow
   */
  export type UnmatchedMutationFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null
    /**
     * Filter, which UnmatchedMutation to fetch.
     */
    where?: UnmatchedMutationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UnmatchedMutations to fetch.
     */
    orderBy?: UnmatchedMutationOrderByWithRelationInput | UnmatchedMutationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UnmatchedMutations.
     */
    cursor?: UnmatchedMutationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UnmatchedMutations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UnmatchedMutations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UnmatchedMutations.
     */
    distinct?: UnmatchedMutationScalarFieldEnum | UnmatchedMutationScalarFieldEnum[]
  }

  /**
   * UnmatchedMutation findMany
   */
  export type UnmatchedMutationFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null
    /**
     * Filter, which UnmatchedMutations to fetch.
     */
    where?: UnmatchedMutationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UnmatchedMutations to fetch.
     */
    orderBy?: UnmatchedMutationOrderByWithRelationInput | UnmatchedMutationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing UnmatchedMutations.
     */
    cursor?: UnmatchedMutationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UnmatchedMutations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UnmatchedMutations.
     */
    skip?: number
    distinct?: UnmatchedMutationScalarFieldEnum | UnmatchedMutationScalarFieldEnum[]
  }

  /**
   * UnmatchedMutation create
   */
  export type UnmatchedMutationCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null
    /**
     * The data needed to create a UnmatchedMutation.
     */
    data: XOR<UnmatchedMutationCreateInput, UnmatchedMutationUncheckedCreateInput>
  }

  /**
   * UnmatchedMutation createMany
   */
  export type UnmatchedMutationCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many UnmatchedMutations.
     */
    data: UnmatchedMutationCreateManyInput | UnmatchedMutationCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UnmatchedMutation createManyAndReturn
   */
  export type UnmatchedMutationCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null
    /**
     * The data used to create many UnmatchedMutations.
     */
    data: UnmatchedMutationCreateManyInput | UnmatchedMutationCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UnmatchedMutation update
   */
  export type UnmatchedMutationUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null
    /**
     * The data needed to update a UnmatchedMutation.
     */
    data: XOR<UnmatchedMutationUpdateInput, UnmatchedMutationUncheckedUpdateInput>
    /**
     * Choose, which UnmatchedMutation to update.
     */
    where: UnmatchedMutationWhereUniqueInput
  }

  /**
   * UnmatchedMutation updateMany
   */
  export type UnmatchedMutationUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update UnmatchedMutations.
     */
    data: XOR<UnmatchedMutationUpdateManyMutationInput, UnmatchedMutationUncheckedUpdateManyInput>
    /**
     * Filter which UnmatchedMutations to update
     */
    where?: UnmatchedMutationWhereInput
    /**
     * Limit how many UnmatchedMutations to update.
     */
    limit?: number
  }

  /**
   * UnmatchedMutation updateManyAndReturn
   */
  export type UnmatchedMutationUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null
    /**
     * The data used to update UnmatchedMutations.
     */
    data: XOR<UnmatchedMutationUpdateManyMutationInput, UnmatchedMutationUncheckedUpdateManyInput>
    /**
     * Filter which UnmatchedMutations to update
     */
    where?: UnmatchedMutationWhereInput
    /**
     * Limit how many UnmatchedMutations to update.
     */
    limit?: number
  }

  /**
   * UnmatchedMutation upsert
   */
  export type UnmatchedMutationUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null
    /**
     * The filter to search for the UnmatchedMutation to update in case it exists.
     */
    where: UnmatchedMutationWhereUniqueInput
    /**
     * In case the UnmatchedMutation found by the `where` argument doesn't exist, create a new UnmatchedMutation with this data.
     */
    create: XOR<UnmatchedMutationCreateInput, UnmatchedMutationUncheckedCreateInput>
    /**
     * In case the UnmatchedMutation was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UnmatchedMutationUpdateInput, UnmatchedMutationUncheckedUpdateInput>
  }

  /**
   * UnmatchedMutation delete
   */
  export type UnmatchedMutationDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null
    /**
     * Filter which UnmatchedMutation to delete.
     */
    where: UnmatchedMutationWhereUniqueInput
  }

  /**
   * UnmatchedMutation deleteMany
   */
  export type UnmatchedMutationDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UnmatchedMutations to delete
     */
    where?: UnmatchedMutationWhereInput
    /**
     * Limit how many UnmatchedMutations to delete.
     */
    limit?: number
  }

  /**
   * UnmatchedMutation.payment
   */
  export type UnmatchedMutation$paymentArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Payment
     */
    select?: PaymentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Payment
     */
    omit?: PaymentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PaymentInclude<ExtArgs> | null
    where?: PaymentWhereInput
  }

  /**
   * UnmatchedMutation without action
   */
  export type UnmatchedMutationDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UnmatchedMutation
     */
    select?: UnmatchedMutationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UnmatchedMutation
     */
    omit?: UnmatchedMutationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UnmatchedMutationInclude<ExtArgs> | null
  }


  /**
   * Model Transaction
   */

  export type AggregateTransaction = {
    _count: TransactionCountAggregateOutputType | null
    _avg: TransactionAvgAggregateOutputType | null
    _sum: TransactionSumAggregateOutputType | null
    _min: TransactionMinAggregateOutputType | null
    _max: TransactionMaxAggregateOutputType | null
  }

  export type TransactionAvgAggregateOutputType = {
    amount: number | null
  }

  export type TransactionSumAggregateOutputType = {
    amount: number | null
  }

  export type TransactionMinAggregateOutputType = {
    id: string | null
    date: Date | null
    amount: number | null
    type: $Enums.TransactionType | null
    description: string | null
    referenceId: string | null
    categoryId: string | null
    accountId: string | null
    purchaseOrderId: string | null
    createdById: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TransactionMaxAggregateOutputType = {
    id: string | null
    date: Date | null
    amount: number | null
    type: $Enums.TransactionType | null
    description: string | null
    referenceId: string | null
    categoryId: string | null
    accountId: string | null
    purchaseOrderId: string | null
    createdById: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TransactionCountAggregateOutputType = {
    id: number
    date: number
    amount: number
    type: number
    description: number
    referenceId: number
    categoryId: number
    accountId: number
    purchaseOrderId: number
    createdById: number
    attachments: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type TransactionAvgAggregateInputType = {
    amount?: true
  }

  export type TransactionSumAggregateInputType = {
    amount?: true
  }

  export type TransactionMinAggregateInputType = {
    id?: true
    date?: true
    amount?: true
    type?: true
    description?: true
    referenceId?: true
    categoryId?: true
    accountId?: true
    purchaseOrderId?: true
    createdById?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TransactionMaxAggregateInputType = {
    id?: true
    date?: true
    amount?: true
    type?: true
    description?: true
    referenceId?: true
    categoryId?: true
    accountId?: true
    purchaseOrderId?: true
    createdById?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TransactionCountAggregateInputType = {
    id?: true
    date?: true
    amount?: true
    type?: true
    description?: true
    referenceId?: true
    categoryId?: true
    accountId?: true
    purchaseOrderId?: true
    createdById?: true
    attachments?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type TransactionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Transaction to aggregate.
     */
    where?: TransactionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Transactions to fetch.
     */
    orderBy?: TransactionOrderByWithRelationInput | TransactionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TransactionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Transactions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Transactions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Transactions
    **/
    _count?: true | TransactionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TransactionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TransactionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TransactionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TransactionMaxAggregateInputType
  }

  export type GetTransactionAggregateType<T extends TransactionAggregateArgs> = {
        [P in keyof T & keyof AggregateTransaction]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTransaction[P]>
      : GetScalarType<T[P], AggregateTransaction[P]>
  }




  export type TransactionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TransactionWhereInput
    orderBy?: TransactionOrderByWithAggregationInput | TransactionOrderByWithAggregationInput[]
    by: TransactionScalarFieldEnum[] | TransactionScalarFieldEnum
    having?: TransactionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TransactionCountAggregateInputType | true
    _avg?: TransactionAvgAggregateInputType
    _sum?: TransactionSumAggregateInputType
    _min?: TransactionMinAggregateInputType
    _max?: TransactionMaxAggregateInputType
  }

  export type TransactionGroupByOutputType = {
    id: string
    date: Date
    amount: number
    type: $Enums.TransactionType
    description: string | null
    referenceId: string | null
    categoryId: string
    accountId: string | null
    purchaseOrderId: string | null
    createdById: string
    attachments: string[]
    createdAt: Date
    updatedAt: Date
    _count: TransactionCountAggregateOutputType | null
    _avg: TransactionAvgAggregateOutputType | null
    _sum: TransactionSumAggregateOutputType | null
    _min: TransactionMinAggregateOutputType | null
    _max: TransactionMaxAggregateOutputType | null
  }

  type GetTransactionGroupByPayload<T extends TransactionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TransactionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TransactionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TransactionGroupByOutputType[P]>
            : GetScalarType<T[P], TransactionGroupByOutputType[P]>
        }
      >
    >


  export type TransactionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    date?: boolean
    amount?: boolean
    type?: boolean
    description?: boolean
    referenceId?: boolean
    categoryId?: boolean
    accountId?: boolean
    purchaseOrderId?: boolean
    createdById?: boolean
    attachments?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    category?: boolean | TransactionCategoryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["transaction"]>

  export type TransactionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    date?: boolean
    amount?: boolean
    type?: boolean
    description?: boolean
    referenceId?: boolean
    categoryId?: boolean
    accountId?: boolean
    purchaseOrderId?: boolean
    createdById?: boolean
    attachments?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    category?: boolean | TransactionCategoryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["transaction"]>

  export type TransactionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    date?: boolean
    amount?: boolean
    type?: boolean
    description?: boolean
    referenceId?: boolean
    categoryId?: boolean
    accountId?: boolean
    purchaseOrderId?: boolean
    createdById?: boolean
    attachments?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    category?: boolean | TransactionCategoryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["transaction"]>

  export type TransactionSelectScalar = {
    id?: boolean
    date?: boolean
    amount?: boolean
    type?: boolean
    description?: boolean
    referenceId?: boolean
    categoryId?: boolean
    accountId?: boolean
    purchaseOrderId?: boolean
    createdById?: boolean
    attachments?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type TransactionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "date" | "amount" | "type" | "description" | "referenceId" | "categoryId" | "accountId" | "purchaseOrderId" | "createdById" | "attachments" | "createdAt" | "updatedAt", ExtArgs["result"]["transaction"]>
  export type TransactionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    category?: boolean | TransactionCategoryDefaultArgs<ExtArgs>
  }
  export type TransactionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    category?: boolean | TransactionCategoryDefaultArgs<ExtArgs>
  }
  export type TransactionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    category?: boolean | TransactionCategoryDefaultArgs<ExtArgs>
  }

  export type $TransactionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Transaction"
    objects: {
      category: Prisma.$TransactionCategoryPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      date: Date
      amount: number
      type: $Enums.TransactionType
      description: string | null
      referenceId: string | null
      categoryId: string
      accountId: string | null
      purchaseOrderId: string | null
      createdById: string
      attachments: string[]
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["transaction"]>
    composites: {}
  }

  type TransactionGetPayload<S extends boolean | null | undefined | TransactionDefaultArgs> = $Result.GetResult<Prisma.$TransactionPayload, S>

  type TransactionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TransactionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TransactionCountAggregateInputType | true
    }

  export interface TransactionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Transaction'], meta: { name: 'Transaction' } }
    /**
     * Find zero or one Transaction that matches the filter.
     * @param {TransactionFindUniqueArgs} args - Arguments to find a Transaction
     * @example
     * // Get one Transaction
     * const transaction = await prisma.transaction.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TransactionFindUniqueArgs>(args: SelectSubset<T, TransactionFindUniqueArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Transaction that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TransactionFindUniqueOrThrowArgs} args - Arguments to find a Transaction
     * @example
     * // Get one Transaction
     * const transaction = await prisma.transaction.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TransactionFindUniqueOrThrowArgs>(args: SelectSubset<T, TransactionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Transaction that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionFindFirstArgs} args - Arguments to find a Transaction
     * @example
     * // Get one Transaction
     * const transaction = await prisma.transaction.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TransactionFindFirstArgs>(args?: SelectSubset<T, TransactionFindFirstArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Transaction that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionFindFirstOrThrowArgs} args - Arguments to find a Transaction
     * @example
     * // Get one Transaction
     * const transaction = await prisma.transaction.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TransactionFindFirstOrThrowArgs>(args?: SelectSubset<T, TransactionFindFirstOrThrowArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Transactions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Transactions
     * const transactions = await prisma.transaction.findMany()
     * 
     * // Get first 10 Transactions
     * const transactions = await prisma.transaction.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const transactionWithIdOnly = await prisma.transaction.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TransactionFindManyArgs>(args?: SelectSubset<T, TransactionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Transaction.
     * @param {TransactionCreateArgs} args - Arguments to create a Transaction.
     * @example
     * // Create one Transaction
     * const Transaction = await prisma.transaction.create({
     *   data: {
     *     // ... data to create a Transaction
     *   }
     * })
     * 
     */
    create<T extends TransactionCreateArgs>(args: SelectSubset<T, TransactionCreateArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Transactions.
     * @param {TransactionCreateManyArgs} args - Arguments to create many Transactions.
     * @example
     * // Create many Transactions
     * const transaction = await prisma.transaction.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TransactionCreateManyArgs>(args?: SelectSubset<T, TransactionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Transactions and returns the data saved in the database.
     * @param {TransactionCreateManyAndReturnArgs} args - Arguments to create many Transactions.
     * @example
     * // Create many Transactions
     * const transaction = await prisma.transaction.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Transactions and only return the `id`
     * const transactionWithIdOnly = await prisma.transaction.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TransactionCreateManyAndReturnArgs>(args?: SelectSubset<T, TransactionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Transaction.
     * @param {TransactionDeleteArgs} args - Arguments to delete one Transaction.
     * @example
     * // Delete one Transaction
     * const Transaction = await prisma.transaction.delete({
     *   where: {
     *     // ... filter to delete one Transaction
     *   }
     * })
     * 
     */
    delete<T extends TransactionDeleteArgs>(args: SelectSubset<T, TransactionDeleteArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Transaction.
     * @param {TransactionUpdateArgs} args - Arguments to update one Transaction.
     * @example
     * // Update one Transaction
     * const transaction = await prisma.transaction.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TransactionUpdateArgs>(args: SelectSubset<T, TransactionUpdateArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Transactions.
     * @param {TransactionDeleteManyArgs} args - Arguments to filter Transactions to delete.
     * @example
     * // Delete a few Transactions
     * const { count } = await prisma.transaction.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TransactionDeleteManyArgs>(args?: SelectSubset<T, TransactionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Transactions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Transactions
     * const transaction = await prisma.transaction.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TransactionUpdateManyArgs>(args: SelectSubset<T, TransactionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Transactions and returns the data updated in the database.
     * @param {TransactionUpdateManyAndReturnArgs} args - Arguments to update many Transactions.
     * @example
     * // Update many Transactions
     * const transaction = await prisma.transaction.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Transactions and only return the `id`
     * const transactionWithIdOnly = await prisma.transaction.updateManyAndReturn({
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
    updateManyAndReturn<T extends TransactionUpdateManyAndReturnArgs>(args: SelectSubset<T, TransactionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Transaction.
     * @param {TransactionUpsertArgs} args - Arguments to update or create a Transaction.
     * @example
     * // Update or create a Transaction
     * const transaction = await prisma.transaction.upsert({
     *   create: {
     *     // ... data to create a Transaction
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Transaction we want to update
     *   }
     * })
     */
    upsert<T extends TransactionUpsertArgs>(args: SelectSubset<T, TransactionUpsertArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Transactions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionCountArgs} args - Arguments to filter Transactions to count.
     * @example
     * // Count the number of Transactions
     * const count = await prisma.transaction.count({
     *   where: {
     *     // ... the filter for the Transactions we want to count
     *   }
     * })
    **/
    count<T extends TransactionCountArgs>(
      args?: Subset<T, TransactionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TransactionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Transaction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends TransactionAggregateArgs>(args: Subset<T, TransactionAggregateArgs>): Prisma.PrismaPromise<GetTransactionAggregateType<T>>

    /**
     * Group by Transaction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionGroupByArgs} args - Group by arguments.
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
      T extends TransactionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TransactionGroupByArgs['orderBy'] }
        : { orderBy?: TransactionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
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
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TransactionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTransactionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Transaction model
   */
  readonly fields: TransactionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Transaction.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TransactionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    category<T extends TransactionCategoryDefaultArgs<ExtArgs> = {}>(args?: Subset<T, TransactionCategoryDefaultArgs<ExtArgs>>): Prisma__TransactionCategoryClient<$Result.GetResult<Prisma.$TransactionCategoryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Transaction model
   */
  interface TransactionFieldRefs {
    readonly id: FieldRef<"Transaction", 'String'>
    readonly date: FieldRef<"Transaction", 'DateTime'>
    readonly amount: FieldRef<"Transaction", 'Float'>
    readonly type: FieldRef<"Transaction", 'TransactionType'>
    readonly description: FieldRef<"Transaction", 'String'>
    readonly referenceId: FieldRef<"Transaction", 'String'>
    readonly categoryId: FieldRef<"Transaction", 'String'>
    readonly accountId: FieldRef<"Transaction", 'String'>
    readonly purchaseOrderId: FieldRef<"Transaction", 'String'>
    readonly createdById: FieldRef<"Transaction", 'String'>
    readonly attachments: FieldRef<"Transaction", 'String[]'>
    readonly createdAt: FieldRef<"Transaction", 'DateTime'>
    readonly updatedAt: FieldRef<"Transaction", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Transaction findUnique
   */
  export type TransactionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter, which Transaction to fetch.
     */
    where: TransactionWhereUniqueInput
  }

  /**
   * Transaction findUniqueOrThrow
   */
  export type TransactionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter, which Transaction to fetch.
     */
    where: TransactionWhereUniqueInput
  }

  /**
   * Transaction findFirst
   */
  export type TransactionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter, which Transaction to fetch.
     */
    where?: TransactionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Transactions to fetch.
     */
    orderBy?: TransactionOrderByWithRelationInput | TransactionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Transactions.
     */
    cursor?: TransactionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Transactions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Transactions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Transactions.
     */
    distinct?: TransactionScalarFieldEnum | TransactionScalarFieldEnum[]
  }

  /**
   * Transaction findFirstOrThrow
   */
  export type TransactionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter, which Transaction to fetch.
     */
    where?: TransactionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Transactions to fetch.
     */
    orderBy?: TransactionOrderByWithRelationInput | TransactionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Transactions.
     */
    cursor?: TransactionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Transactions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Transactions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Transactions.
     */
    distinct?: TransactionScalarFieldEnum | TransactionScalarFieldEnum[]
  }

  /**
   * Transaction findMany
   */
  export type TransactionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter, which Transactions to fetch.
     */
    where?: TransactionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Transactions to fetch.
     */
    orderBy?: TransactionOrderByWithRelationInput | TransactionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Transactions.
     */
    cursor?: TransactionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Transactions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Transactions.
     */
    skip?: number
    distinct?: TransactionScalarFieldEnum | TransactionScalarFieldEnum[]
  }

  /**
   * Transaction create
   */
  export type TransactionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * The data needed to create a Transaction.
     */
    data: XOR<TransactionCreateInput, TransactionUncheckedCreateInput>
  }

  /**
   * Transaction createMany
   */
  export type TransactionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Transactions.
     */
    data: TransactionCreateManyInput | TransactionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Transaction createManyAndReturn
   */
  export type TransactionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * The data used to create many Transactions.
     */
    data: TransactionCreateManyInput | TransactionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Transaction update
   */
  export type TransactionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * The data needed to update a Transaction.
     */
    data: XOR<TransactionUpdateInput, TransactionUncheckedUpdateInput>
    /**
     * Choose, which Transaction to update.
     */
    where: TransactionWhereUniqueInput
  }

  /**
   * Transaction updateMany
   */
  export type TransactionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Transactions.
     */
    data: XOR<TransactionUpdateManyMutationInput, TransactionUncheckedUpdateManyInput>
    /**
     * Filter which Transactions to update
     */
    where?: TransactionWhereInput
    /**
     * Limit how many Transactions to update.
     */
    limit?: number
  }

  /**
   * Transaction updateManyAndReturn
   */
  export type TransactionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * The data used to update Transactions.
     */
    data: XOR<TransactionUpdateManyMutationInput, TransactionUncheckedUpdateManyInput>
    /**
     * Filter which Transactions to update
     */
    where?: TransactionWhereInput
    /**
     * Limit how many Transactions to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Transaction upsert
   */
  export type TransactionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * The filter to search for the Transaction to update in case it exists.
     */
    where: TransactionWhereUniqueInput
    /**
     * In case the Transaction found by the `where` argument doesn't exist, create a new Transaction with this data.
     */
    create: XOR<TransactionCreateInput, TransactionUncheckedCreateInput>
    /**
     * In case the Transaction was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TransactionUpdateInput, TransactionUncheckedUpdateInput>
  }

  /**
   * Transaction delete
   */
  export type TransactionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter which Transaction to delete.
     */
    where: TransactionWhereUniqueInput
  }

  /**
   * Transaction deleteMany
   */
  export type TransactionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Transactions to delete
     */
    where?: TransactionWhereInput
    /**
     * Limit how many Transactions to delete.
     */
    limit?: number
  }

  /**
   * Transaction without action
   */
  export type TransactionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
  }


  /**
   * Model TransactionCategory
   */

  export type AggregateTransactionCategory = {
    _count: TransactionCategoryCountAggregateOutputType | null
    _min: TransactionCategoryMinAggregateOutputType | null
    _max: TransactionCategoryMaxAggregateOutputType | null
  }

  export type TransactionCategoryMinAggregateOutputType = {
    id: string | null
    name: string | null
    type: $Enums.TransactionType | null
    expenseType: $Enums.ExpenseType | null
    description: string | null
    isSystem: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TransactionCategoryMaxAggregateOutputType = {
    id: string | null
    name: string | null
    type: $Enums.TransactionType | null
    expenseType: $Enums.ExpenseType | null
    description: string | null
    isSystem: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TransactionCategoryCountAggregateOutputType = {
    id: number
    name: number
    type: number
    expenseType: number
    description: number
    isSystem: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type TransactionCategoryMinAggregateInputType = {
    id?: true
    name?: true
    type?: true
    expenseType?: true
    description?: true
    isSystem?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TransactionCategoryMaxAggregateInputType = {
    id?: true
    name?: true
    type?: true
    expenseType?: true
    description?: true
    isSystem?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TransactionCategoryCountAggregateInputType = {
    id?: true
    name?: true
    type?: true
    expenseType?: true
    description?: true
    isSystem?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type TransactionCategoryAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TransactionCategory to aggregate.
     */
    where?: TransactionCategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TransactionCategories to fetch.
     */
    orderBy?: TransactionCategoryOrderByWithRelationInput | TransactionCategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TransactionCategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TransactionCategories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TransactionCategories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TransactionCategories
    **/
    _count?: true | TransactionCategoryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TransactionCategoryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TransactionCategoryMaxAggregateInputType
  }

  export type GetTransactionCategoryAggregateType<T extends TransactionCategoryAggregateArgs> = {
        [P in keyof T & keyof AggregateTransactionCategory]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTransactionCategory[P]>
      : GetScalarType<T[P], AggregateTransactionCategory[P]>
  }




  export type TransactionCategoryGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TransactionCategoryWhereInput
    orderBy?: TransactionCategoryOrderByWithAggregationInput | TransactionCategoryOrderByWithAggregationInput[]
    by: TransactionCategoryScalarFieldEnum[] | TransactionCategoryScalarFieldEnum
    having?: TransactionCategoryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TransactionCategoryCountAggregateInputType | true
    _min?: TransactionCategoryMinAggregateInputType
    _max?: TransactionCategoryMaxAggregateInputType
  }

  export type TransactionCategoryGroupByOutputType = {
    id: string
    name: string
    type: $Enums.TransactionType
    expenseType: $Enums.ExpenseType | null
    description: string | null
    isSystem: boolean
    createdAt: Date
    updatedAt: Date
    _count: TransactionCategoryCountAggregateOutputType | null
    _min: TransactionCategoryMinAggregateOutputType | null
    _max: TransactionCategoryMaxAggregateOutputType | null
  }

  type GetTransactionCategoryGroupByPayload<T extends TransactionCategoryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TransactionCategoryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TransactionCategoryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TransactionCategoryGroupByOutputType[P]>
            : GetScalarType<T[P], TransactionCategoryGroupByOutputType[P]>
        }
      >
    >


  export type TransactionCategorySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    type?: boolean
    expenseType?: boolean
    description?: boolean
    isSystem?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    transactions?: boolean | TransactionCategory$transactionsArgs<ExtArgs>
    _count?: boolean | TransactionCategoryCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["transactionCategory"]>

  export type TransactionCategorySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    type?: boolean
    expenseType?: boolean
    description?: boolean
    isSystem?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["transactionCategory"]>

  export type TransactionCategorySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    type?: boolean
    expenseType?: boolean
    description?: boolean
    isSystem?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["transactionCategory"]>

  export type TransactionCategorySelectScalar = {
    id?: boolean
    name?: boolean
    type?: boolean
    expenseType?: boolean
    description?: boolean
    isSystem?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type TransactionCategoryOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "type" | "expenseType" | "description" | "isSystem" | "createdAt" | "updatedAt", ExtArgs["result"]["transactionCategory"]>
  export type TransactionCategoryInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    transactions?: boolean | TransactionCategory$transactionsArgs<ExtArgs>
    _count?: boolean | TransactionCategoryCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type TransactionCategoryIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type TransactionCategoryIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $TransactionCategoryPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TransactionCategory"
    objects: {
      transactions: Prisma.$TransactionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      type: $Enums.TransactionType
      expenseType: $Enums.ExpenseType | null
      description: string | null
      isSystem: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["transactionCategory"]>
    composites: {}
  }

  type TransactionCategoryGetPayload<S extends boolean | null | undefined | TransactionCategoryDefaultArgs> = $Result.GetResult<Prisma.$TransactionCategoryPayload, S>

  type TransactionCategoryCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TransactionCategoryFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TransactionCategoryCountAggregateInputType | true
    }

  export interface TransactionCategoryDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TransactionCategory'], meta: { name: 'TransactionCategory' } }
    /**
     * Find zero or one TransactionCategory that matches the filter.
     * @param {TransactionCategoryFindUniqueArgs} args - Arguments to find a TransactionCategory
     * @example
     * // Get one TransactionCategory
     * const transactionCategory = await prisma.transactionCategory.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TransactionCategoryFindUniqueArgs>(args: SelectSubset<T, TransactionCategoryFindUniqueArgs<ExtArgs>>): Prisma__TransactionCategoryClient<$Result.GetResult<Prisma.$TransactionCategoryPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TransactionCategory that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TransactionCategoryFindUniqueOrThrowArgs} args - Arguments to find a TransactionCategory
     * @example
     * // Get one TransactionCategory
     * const transactionCategory = await prisma.transactionCategory.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TransactionCategoryFindUniqueOrThrowArgs>(args: SelectSubset<T, TransactionCategoryFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TransactionCategoryClient<$Result.GetResult<Prisma.$TransactionCategoryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TransactionCategory that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionCategoryFindFirstArgs} args - Arguments to find a TransactionCategory
     * @example
     * // Get one TransactionCategory
     * const transactionCategory = await prisma.transactionCategory.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TransactionCategoryFindFirstArgs>(args?: SelectSubset<T, TransactionCategoryFindFirstArgs<ExtArgs>>): Prisma__TransactionCategoryClient<$Result.GetResult<Prisma.$TransactionCategoryPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TransactionCategory that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionCategoryFindFirstOrThrowArgs} args - Arguments to find a TransactionCategory
     * @example
     * // Get one TransactionCategory
     * const transactionCategory = await prisma.transactionCategory.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TransactionCategoryFindFirstOrThrowArgs>(args?: SelectSubset<T, TransactionCategoryFindFirstOrThrowArgs<ExtArgs>>): Prisma__TransactionCategoryClient<$Result.GetResult<Prisma.$TransactionCategoryPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TransactionCategories that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionCategoryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TransactionCategories
     * const transactionCategories = await prisma.transactionCategory.findMany()
     * 
     * // Get first 10 TransactionCategories
     * const transactionCategories = await prisma.transactionCategory.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const transactionCategoryWithIdOnly = await prisma.transactionCategory.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TransactionCategoryFindManyArgs>(args?: SelectSubset<T, TransactionCategoryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TransactionCategoryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TransactionCategory.
     * @param {TransactionCategoryCreateArgs} args - Arguments to create a TransactionCategory.
     * @example
     * // Create one TransactionCategory
     * const TransactionCategory = await prisma.transactionCategory.create({
     *   data: {
     *     // ... data to create a TransactionCategory
     *   }
     * })
     * 
     */
    create<T extends TransactionCategoryCreateArgs>(args: SelectSubset<T, TransactionCategoryCreateArgs<ExtArgs>>): Prisma__TransactionCategoryClient<$Result.GetResult<Prisma.$TransactionCategoryPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TransactionCategories.
     * @param {TransactionCategoryCreateManyArgs} args - Arguments to create many TransactionCategories.
     * @example
     * // Create many TransactionCategories
     * const transactionCategory = await prisma.transactionCategory.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TransactionCategoryCreateManyArgs>(args?: SelectSubset<T, TransactionCategoryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many TransactionCategories and returns the data saved in the database.
     * @param {TransactionCategoryCreateManyAndReturnArgs} args - Arguments to create many TransactionCategories.
     * @example
     * // Create many TransactionCategories
     * const transactionCategory = await prisma.transactionCategory.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many TransactionCategories and only return the `id`
     * const transactionCategoryWithIdOnly = await prisma.transactionCategory.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TransactionCategoryCreateManyAndReturnArgs>(args?: SelectSubset<T, TransactionCategoryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TransactionCategoryPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a TransactionCategory.
     * @param {TransactionCategoryDeleteArgs} args - Arguments to delete one TransactionCategory.
     * @example
     * // Delete one TransactionCategory
     * const TransactionCategory = await prisma.transactionCategory.delete({
     *   where: {
     *     // ... filter to delete one TransactionCategory
     *   }
     * })
     * 
     */
    delete<T extends TransactionCategoryDeleteArgs>(args: SelectSubset<T, TransactionCategoryDeleteArgs<ExtArgs>>): Prisma__TransactionCategoryClient<$Result.GetResult<Prisma.$TransactionCategoryPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TransactionCategory.
     * @param {TransactionCategoryUpdateArgs} args - Arguments to update one TransactionCategory.
     * @example
     * // Update one TransactionCategory
     * const transactionCategory = await prisma.transactionCategory.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TransactionCategoryUpdateArgs>(args: SelectSubset<T, TransactionCategoryUpdateArgs<ExtArgs>>): Prisma__TransactionCategoryClient<$Result.GetResult<Prisma.$TransactionCategoryPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TransactionCategories.
     * @param {TransactionCategoryDeleteManyArgs} args - Arguments to filter TransactionCategories to delete.
     * @example
     * // Delete a few TransactionCategories
     * const { count } = await prisma.transactionCategory.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TransactionCategoryDeleteManyArgs>(args?: SelectSubset<T, TransactionCategoryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TransactionCategories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionCategoryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TransactionCategories
     * const transactionCategory = await prisma.transactionCategory.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TransactionCategoryUpdateManyArgs>(args: SelectSubset<T, TransactionCategoryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TransactionCategories and returns the data updated in the database.
     * @param {TransactionCategoryUpdateManyAndReturnArgs} args - Arguments to update many TransactionCategories.
     * @example
     * // Update many TransactionCategories
     * const transactionCategory = await prisma.transactionCategory.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more TransactionCategories and only return the `id`
     * const transactionCategoryWithIdOnly = await prisma.transactionCategory.updateManyAndReturn({
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
    updateManyAndReturn<T extends TransactionCategoryUpdateManyAndReturnArgs>(args: SelectSubset<T, TransactionCategoryUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TransactionCategoryPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one TransactionCategory.
     * @param {TransactionCategoryUpsertArgs} args - Arguments to update or create a TransactionCategory.
     * @example
     * // Update or create a TransactionCategory
     * const transactionCategory = await prisma.transactionCategory.upsert({
     *   create: {
     *     // ... data to create a TransactionCategory
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TransactionCategory we want to update
     *   }
     * })
     */
    upsert<T extends TransactionCategoryUpsertArgs>(args: SelectSubset<T, TransactionCategoryUpsertArgs<ExtArgs>>): Prisma__TransactionCategoryClient<$Result.GetResult<Prisma.$TransactionCategoryPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TransactionCategories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionCategoryCountArgs} args - Arguments to filter TransactionCategories to count.
     * @example
     * // Count the number of TransactionCategories
     * const count = await prisma.transactionCategory.count({
     *   where: {
     *     // ... the filter for the TransactionCategories we want to count
     *   }
     * })
    **/
    count<T extends TransactionCategoryCountArgs>(
      args?: Subset<T, TransactionCategoryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TransactionCategoryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TransactionCategory.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionCategoryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends TransactionCategoryAggregateArgs>(args: Subset<T, TransactionCategoryAggregateArgs>): Prisma.PrismaPromise<GetTransactionCategoryAggregateType<T>>

    /**
     * Group by TransactionCategory.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionCategoryGroupByArgs} args - Group by arguments.
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
      T extends TransactionCategoryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TransactionCategoryGroupByArgs['orderBy'] }
        : { orderBy?: TransactionCategoryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
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
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TransactionCategoryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTransactionCategoryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TransactionCategory model
   */
  readonly fields: TransactionCategoryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TransactionCategory.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TransactionCategoryClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    transactions<T extends TransactionCategory$transactionsArgs<ExtArgs> = {}>(args?: Subset<T, TransactionCategory$transactionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TransactionCategory model
   */
  interface TransactionCategoryFieldRefs {
    readonly id: FieldRef<"TransactionCategory", 'String'>
    readonly name: FieldRef<"TransactionCategory", 'String'>
    readonly type: FieldRef<"TransactionCategory", 'TransactionType'>
    readonly expenseType: FieldRef<"TransactionCategory", 'ExpenseType'>
    readonly description: FieldRef<"TransactionCategory", 'String'>
    readonly isSystem: FieldRef<"TransactionCategory", 'Boolean'>
    readonly createdAt: FieldRef<"TransactionCategory", 'DateTime'>
    readonly updatedAt: FieldRef<"TransactionCategory", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * TransactionCategory findUnique
   */
  export type TransactionCategoryFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TransactionCategory
     */
    select?: TransactionCategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TransactionCategory
     */
    omit?: TransactionCategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionCategoryInclude<ExtArgs> | null
    /**
     * Filter, which TransactionCategory to fetch.
     */
    where: TransactionCategoryWhereUniqueInput
  }

  /**
   * TransactionCategory findUniqueOrThrow
   */
  export type TransactionCategoryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TransactionCategory
     */
    select?: TransactionCategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TransactionCategory
     */
    omit?: TransactionCategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionCategoryInclude<ExtArgs> | null
    /**
     * Filter, which TransactionCategory to fetch.
     */
    where: TransactionCategoryWhereUniqueInput
  }

  /**
   * TransactionCategory findFirst
   */
  export type TransactionCategoryFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TransactionCategory
     */
    select?: TransactionCategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TransactionCategory
     */
    omit?: TransactionCategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionCategoryInclude<ExtArgs> | null
    /**
     * Filter, which TransactionCategory to fetch.
     */
    where?: TransactionCategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TransactionCategories to fetch.
     */
    orderBy?: TransactionCategoryOrderByWithRelationInput | TransactionCategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TransactionCategories.
     */
    cursor?: TransactionCategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TransactionCategories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TransactionCategories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TransactionCategories.
     */
    distinct?: TransactionCategoryScalarFieldEnum | TransactionCategoryScalarFieldEnum[]
  }

  /**
   * TransactionCategory findFirstOrThrow
   */
  export type TransactionCategoryFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TransactionCategory
     */
    select?: TransactionCategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TransactionCategory
     */
    omit?: TransactionCategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionCategoryInclude<ExtArgs> | null
    /**
     * Filter, which TransactionCategory to fetch.
     */
    where?: TransactionCategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TransactionCategories to fetch.
     */
    orderBy?: TransactionCategoryOrderByWithRelationInput | TransactionCategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TransactionCategories.
     */
    cursor?: TransactionCategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TransactionCategories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TransactionCategories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TransactionCategories.
     */
    distinct?: TransactionCategoryScalarFieldEnum | TransactionCategoryScalarFieldEnum[]
  }

  /**
   * TransactionCategory findMany
   */
  export type TransactionCategoryFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TransactionCategory
     */
    select?: TransactionCategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TransactionCategory
     */
    omit?: TransactionCategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionCategoryInclude<ExtArgs> | null
    /**
     * Filter, which TransactionCategories to fetch.
     */
    where?: TransactionCategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TransactionCategories to fetch.
     */
    orderBy?: TransactionCategoryOrderByWithRelationInput | TransactionCategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TransactionCategories.
     */
    cursor?: TransactionCategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TransactionCategories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TransactionCategories.
     */
    skip?: number
    distinct?: TransactionCategoryScalarFieldEnum | TransactionCategoryScalarFieldEnum[]
  }

  /**
   * TransactionCategory create
   */
  export type TransactionCategoryCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TransactionCategory
     */
    select?: TransactionCategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TransactionCategory
     */
    omit?: TransactionCategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionCategoryInclude<ExtArgs> | null
    /**
     * The data needed to create a TransactionCategory.
     */
    data: XOR<TransactionCategoryCreateInput, TransactionCategoryUncheckedCreateInput>
  }

  /**
   * TransactionCategory createMany
   */
  export type TransactionCategoryCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TransactionCategories.
     */
    data: TransactionCategoryCreateManyInput | TransactionCategoryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TransactionCategory createManyAndReturn
   */
  export type TransactionCategoryCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TransactionCategory
     */
    select?: TransactionCategorySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TransactionCategory
     */
    omit?: TransactionCategoryOmit<ExtArgs> | null
    /**
     * The data used to create many TransactionCategories.
     */
    data: TransactionCategoryCreateManyInput | TransactionCategoryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TransactionCategory update
   */
  export type TransactionCategoryUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TransactionCategory
     */
    select?: TransactionCategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TransactionCategory
     */
    omit?: TransactionCategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionCategoryInclude<ExtArgs> | null
    /**
     * The data needed to update a TransactionCategory.
     */
    data: XOR<TransactionCategoryUpdateInput, TransactionCategoryUncheckedUpdateInput>
    /**
     * Choose, which TransactionCategory to update.
     */
    where: TransactionCategoryWhereUniqueInput
  }

  /**
   * TransactionCategory updateMany
   */
  export type TransactionCategoryUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TransactionCategories.
     */
    data: XOR<TransactionCategoryUpdateManyMutationInput, TransactionCategoryUncheckedUpdateManyInput>
    /**
     * Filter which TransactionCategories to update
     */
    where?: TransactionCategoryWhereInput
    /**
     * Limit how many TransactionCategories to update.
     */
    limit?: number
  }

  /**
   * TransactionCategory updateManyAndReturn
   */
  export type TransactionCategoryUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TransactionCategory
     */
    select?: TransactionCategorySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TransactionCategory
     */
    omit?: TransactionCategoryOmit<ExtArgs> | null
    /**
     * The data used to update TransactionCategories.
     */
    data: XOR<TransactionCategoryUpdateManyMutationInput, TransactionCategoryUncheckedUpdateManyInput>
    /**
     * Filter which TransactionCategories to update
     */
    where?: TransactionCategoryWhereInput
    /**
     * Limit how many TransactionCategories to update.
     */
    limit?: number
  }

  /**
   * TransactionCategory upsert
   */
  export type TransactionCategoryUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TransactionCategory
     */
    select?: TransactionCategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TransactionCategory
     */
    omit?: TransactionCategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionCategoryInclude<ExtArgs> | null
    /**
     * The filter to search for the TransactionCategory to update in case it exists.
     */
    where: TransactionCategoryWhereUniqueInput
    /**
     * In case the TransactionCategory found by the `where` argument doesn't exist, create a new TransactionCategory with this data.
     */
    create: XOR<TransactionCategoryCreateInput, TransactionCategoryUncheckedCreateInput>
    /**
     * In case the TransactionCategory was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TransactionCategoryUpdateInput, TransactionCategoryUncheckedUpdateInput>
  }

  /**
   * TransactionCategory delete
   */
  export type TransactionCategoryDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TransactionCategory
     */
    select?: TransactionCategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TransactionCategory
     */
    omit?: TransactionCategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionCategoryInclude<ExtArgs> | null
    /**
     * Filter which TransactionCategory to delete.
     */
    where: TransactionCategoryWhereUniqueInput
  }

  /**
   * TransactionCategory deleteMany
   */
  export type TransactionCategoryDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TransactionCategories to delete
     */
    where?: TransactionCategoryWhereInput
    /**
     * Limit how many TransactionCategories to delete.
     */
    limit?: number
  }

  /**
   * TransactionCategory.transactions
   */
  export type TransactionCategory$transactionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    where?: TransactionWhereInput
    orderBy?: TransactionOrderByWithRelationInput | TransactionOrderByWithRelationInput[]
    cursor?: TransactionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TransactionScalarFieldEnum | TransactionScalarFieldEnum[]
  }

  /**
   * TransactionCategory without action
   */
  export type TransactionCategoryDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TransactionCategory
     */
    select?: TransactionCategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the TransactionCategory
     */
    omit?: TransactionCategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionCategoryInclude<ExtArgs> | null
  }


  /**
   * Model MixRadiusInvoice
   */

  export type AggregateMixRadiusInvoice = {
    _count: MixRadiusInvoiceCountAggregateOutputType | null
    _avg: MixRadiusInvoiceAvgAggregateOutputType | null
    _sum: MixRadiusInvoiceSumAggregateOutputType | null
    _min: MixRadiusInvoiceMinAggregateOutputType | null
    _max: MixRadiusInvoiceMaxAggregateOutputType | null
  }

  export type MixRadiusInvoiceAvgAggregateOutputType = {
    amount: Decimal | null
  }

  export type MixRadiusInvoiceSumAggregateOutputType = {
    amount: Decimal | null
  }

  export type MixRadiusInvoiceMinAggregateOutputType = {
    id: string | null
    invoiceNumber: string | null
    mixRadiusId: string | null
    username: string | null
    fullName: string | null
    ownerName: string | null
    planName: string | null
    amount: Decimal | null
    status: string | null
    paymentMethod: string | null
    issuedDate: Date | null
    dueDate: Date | null
    expiredOn: Date | null
    syncedAt: Date | null
  }

  export type MixRadiusInvoiceMaxAggregateOutputType = {
    id: string | null
    invoiceNumber: string | null
    mixRadiusId: string | null
    username: string | null
    fullName: string | null
    ownerName: string | null
    planName: string | null
    amount: Decimal | null
    status: string | null
    paymentMethod: string | null
    issuedDate: Date | null
    dueDate: Date | null
    expiredOn: Date | null
    syncedAt: Date | null
  }

  export type MixRadiusInvoiceCountAggregateOutputType = {
    id: number
    invoiceNumber: number
    mixRadiusId: number
    username: number
    fullName: number
    ownerName: number
    planName: number
    amount: number
    status: number
    paymentMethod: number
    issuedDate: number
    dueDate: number
    expiredOn: number
    syncedAt: number
    _all: number
  }


  export type MixRadiusInvoiceAvgAggregateInputType = {
    amount?: true
  }

  export type MixRadiusInvoiceSumAggregateInputType = {
    amount?: true
  }

  export type MixRadiusInvoiceMinAggregateInputType = {
    id?: true
    invoiceNumber?: true
    mixRadiusId?: true
    username?: true
    fullName?: true
    ownerName?: true
    planName?: true
    amount?: true
    status?: true
    paymentMethod?: true
    issuedDate?: true
    dueDate?: true
    expiredOn?: true
    syncedAt?: true
  }

  export type MixRadiusInvoiceMaxAggregateInputType = {
    id?: true
    invoiceNumber?: true
    mixRadiusId?: true
    username?: true
    fullName?: true
    ownerName?: true
    planName?: true
    amount?: true
    status?: true
    paymentMethod?: true
    issuedDate?: true
    dueDate?: true
    expiredOn?: true
    syncedAt?: true
  }

  export type MixRadiusInvoiceCountAggregateInputType = {
    id?: true
    invoiceNumber?: true
    mixRadiusId?: true
    username?: true
    fullName?: true
    ownerName?: true
    planName?: true
    amount?: true
    status?: true
    paymentMethod?: true
    issuedDate?: true
    dueDate?: true
    expiredOn?: true
    syncedAt?: true
    _all?: true
  }

  export type MixRadiusInvoiceAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MixRadiusInvoice to aggregate.
     */
    where?: MixRadiusInvoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusInvoices to fetch.
     */
    orderBy?: MixRadiusInvoiceOrderByWithRelationInput | MixRadiusInvoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MixRadiusInvoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusInvoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusInvoices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MixRadiusInvoices
    **/
    _count?: true | MixRadiusInvoiceCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: MixRadiusInvoiceAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: MixRadiusInvoiceSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MixRadiusInvoiceMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MixRadiusInvoiceMaxAggregateInputType
  }

  export type GetMixRadiusInvoiceAggregateType<T extends MixRadiusInvoiceAggregateArgs> = {
        [P in keyof T & keyof AggregateMixRadiusInvoice]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMixRadiusInvoice[P]>
      : GetScalarType<T[P], AggregateMixRadiusInvoice[P]>
  }




  export type MixRadiusInvoiceGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MixRadiusInvoiceWhereInput
    orderBy?: MixRadiusInvoiceOrderByWithAggregationInput | MixRadiusInvoiceOrderByWithAggregationInput[]
    by: MixRadiusInvoiceScalarFieldEnum[] | MixRadiusInvoiceScalarFieldEnum
    having?: MixRadiusInvoiceScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MixRadiusInvoiceCountAggregateInputType | true
    _avg?: MixRadiusInvoiceAvgAggregateInputType
    _sum?: MixRadiusInvoiceSumAggregateInputType
    _min?: MixRadiusInvoiceMinAggregateInputType
    _max?: MixRadiusInvoiceMaxAggregateInputType
  }

  export type MixRadiusInvoiceGroupByOutputType = {
    id: string
    invoiceNumber: string
    mixRadiusId: string | null
    username: string
    fullName: string | null
    ownerName: string | null
    planName: string | null
    amount: Decimal
    status: string
    paymentMethod: string | null
    issuedDate: Date
    dueDate: Date | null
    expiredOn: Date | null
    syncedAt: Date
    _count: MixRadiusInvoiceCountAggregateOutputType | null
    _avg: MixRadiusInvoiceAvgAggregateOutputType | null
    _sum: MixRadiusInvoiceSumAggregateOutputType | null
    _min: MixRadiusInvoiceMinAggregateOutputType | null
    _max: MixRadiusInvoiceMaxAggregateOutputType | null
  }

  type GetMixRadiusInvoiceGroupByPayload<T extends MixRadiusInvoiceGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MixRadiusInvoiceGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MixRadiusInvoiceGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MixRadiusInvoiceGroupByOutputType[P]>
            : GetScalarType<T[P], MixRadiusInvoiceGroupByOutputType[P]>
        }
      >
    >


  export type MixRadiusInvoiceSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    invoiceNumber?: boolean
    mixRadiusId?: boolean
    username?: boolean
    fullName?: boolean
    ownerName?: boolean
    planName?: boolean
    amount?: boolean
    status?: boolean
    paymentMethod?: boolean
    issuedDate?: boolean
    dueDate?: boolean
    expiredOn?: boolean
    syncedAt?: boolean
  }, ExtArgs["result"]["mixRadiusInvoice"]>

  export type MixRadiusInvoiceSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    invoiceNumber?: boolean
    mixRadiusId?: boolean
    username?: boolean
    fullName?: boolean
    ownerName?: boolean
    planName?: boolean
    amount?: boolean
    status?: boolean
    paymentMethod?: boolean
    issuedDate?: boolean
    dueDate?: boolean
    expiredOn?: boolean
    syncedAt?: boolean
  }, ExtArgs["result"]["mixRadiusInvoice"]>

  export type MixRadiusInvoiceSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    invoiceNumber?: boolean
    mixRadiusId?: boolean
    username?: boolean
    fullName?: boolean
    ownerName?: boolean
    planName?: boolean
    amount?: boolean
    status?: boolean
    paymentMethod?: boolean
    issuedDate?: boolean
    dueDate?: boolean
    expiredOn?: boolean
    syncedAt?: boolean
  }, ExtArgs["result"]["mixRadiusInvoice"]>

  export type MixRadiusInvoiceSelectScalar = {
    id?: boolean
    invoiceNumber?: boolean
    mixRadiusId?: boolean
    username?: boolean
    fullName?: boolean
    ownerName?: boolean
    planName?: boolean
    amount?: boolean
    status?: boolean
    paymentMethod?: boolean
    issuedDate?: boolean
    dueDate?: boolean
    expiredOn?: boolean
    syncedAt?: boolean
  }

  export type MixRadiusInvoiceOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "invoiceNumber" | "mixRadiusId" | "username" | "fullName" | "ownerName" | "planName" | "amount" | "status" | "paymentMethod" | "issuedDate" | "dueDate" | "expiredOn" | "syncedAt", ExtArgs["result"]["mixRadiusInvoice"]>

  export type $MixRadiusInvoicePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "MixRadiusInvoice"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      invoiceNumber: string
      mixRadiusId: string | null
      username: string
      fullName: string | null
      ownerName: string | null
      planName: string | null
      amount: Prisma.Decimal
      status: string
      paymentMethod: string | null
      issuedDate: Date
      dueDate: Date | null
      expiredOn: Date | null
      syncedAt: Date
    }, ExtArgs["result"]["mixRadiusInvoice"]>
    composites: {}
  }

  type MixRadiusInvoiceGetPayload<S extends boolean | null | undefined | MixRadiusInvoiceDefaultArgs> = $Result.GetResult<Prisma.$MixRadiusInvoicePayload, S>

  type MixRadiusInvoiceCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<MixRadiusInvoiceFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: MixRadiusInvoiceCountAggregateInputType | true
    }

  export interface MixRadiusInvoiceDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['MixRadiusInvoice'], meta: { name: 'MixRadiusInvoice' } }
    /**
     * Find zero or one MixRadiusInvoice that matches the filter.
     * @param {MixRadiusInvoiceFindUniqueArgs} args - Arguments to find a MixRadiusInvoice
     * @example
     * // Get one MixRadiusInvoice
     * const mixRadiusInvoice = await prisma.mixRadiusInvoice.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MixRadiusInvoiceFindUniqueArgs>(args: SelectSubset<T, MixRadiusInvoiceFindUniqueArgs<ExtArgs>>): Prisma__MixRadiusInvoiceClient<$Result.GetResult<Prisma.$MixRadiusInvoicePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one MixRadiusInvoice that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MixRadiusInvoiceFindUniqueOrThrowArgs} args - Arguments to find a MixRadiusInvoice
     * @example
     * // Get one MixRadiusInvoice
     * const mixRadiusInvoice = await prisma.mixRadiusInvoice.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MixRadiusInvoiceFindUniqueOrThrowArgs>(args: SelectSubset<T, MixRadiusInvoiceFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MixRadiusInvoiceClient<$Result.GetResult<Prisma.$MixRadiusInvoicePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MixRadiusInvoice that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusInvoiceFindFirstArgs} args - Arguments to find a MixRadiusInvoice
     * @example
     * // Get one MixRadiusInvoice
     * const mixRadiusInvoice = await prisma.mixRadiusInvoice.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MixRadiusInvoiceFindFirstArgs>(args?: SelectSubset<T, MixRadiusInvoiceFindFirstArgs<ExtArgs>>): Prisma__MixRadiusInvoiceClient<$Result.GetResult<Prisma.$MixRadiusInvoicePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MixRadiusInvoice that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusInvoiceFindFirstOrThrowArgs} args - Arguments to find a MixRadiusInvoice
     * @example
     * // Get one MixRadiusInvoice
     * const mixRadiusInvoice = await prisma.mixRadiusInvoice.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MixRadiusInvoiceFindFirstOrThrowArgs>(args?: SelectSubset<T, MixRadiusInvoiceFindFirstOrThrowArgs<ExtArgs>>): Prisma__MixRadiusInvoiceClient<$Result.GetResult<Prisma.$MixRadiusInvoicePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more MixRadiusInvoices that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusInvoiceFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MixRadiusInvoices
     * const mixRadiusInvoices = await prisma.mixRadiusInvoice.findMany()
     * 
     * // Get first 10 MixRadiusInvoices
     * const mixRadiusInvoices = await prisma.mixRadiusInvoice.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const mixRadiusInvoiceWithIdOnly = await prisma.mixRadiusInvoice.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MixRadiusInvoiceFindManyArgs>(args?: SelectSubset<T, MixRadiusInvoiceFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MixRadiusInvoicePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a MixRadiusInvoice.
     * @param {MixRadiusInvoiceCreateArgs} args - Arguments to create a MixRadiusInvoice.
     * @example
     * // Create one MixRadiusInvoice
     * const MixRadiusInvoice = await prisma.mixRadiusInvoice.create({
     *   data: {
     *     // ... data to create a MixRadiusInvoice
     *   }
     * })
     * 
     */
    create<T extends MixRadiusInvoiceCreateArgs>(args: SelectSubset<T, MixRadiusInvoiceCreateArgs<ExtArgs>>): Prisma__MixRadiusInvoiceClient<$Result.GetResult<Prisma.$MixRadiusInvoicePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many MixRadiusInvoices.
     * @param {MixRadiusInvoiceCreateManyArgs} args - Arguments to create many MixRadiusInvoices.
     * @example
     * // Create many MixRadiusInvoices
     * const mixRadiusInvoice = await prisma.mixRadiusInvoice.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MixRadiusInvoiceCreateManyArgs>(args?: SelectSubset<T, MixRadiusInvoiceCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many MixRadiusInvoices and returns the data saved in the database.
     * @param {MixRadiusInvoiceCreateManyAndReturnArgs} args - Arguments to create many MixRadiusInvoices.
     * @example
     * // Create many MixRadiusInvoices
     * const mixRadiusInvoice = await prisma.mixRadiusInvoice.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many MixRadiusInvoices and only return the `id`
     * const mixRadiusInvoiceWithIdOnly = await prisma.mixRadiusInvoice.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MixRadiusInvoiceCreateManyAndReturnArgs>(args?: SelectSubset<T, MixRadiusInvoiceCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MixRadiusInvoicePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a MixRadiusInvoice.
     * @param {MixRadiusInvoiceDeleteArgs} args - Arguments to delete one MixRadiusInvoice.
     * @example
     * // Delete one MixRadiusInvoice
     * const MixRadiusInvoice = await prisma.mixRadiusInvoice.delete({
     *   where: {
     *     // ... filter to delete one MixRadiusInvoice
     *   }
     * })
     * 
     */
    delete<T extends MixRadiusInvoiceDeleteArgs>(args: SelectSubset<T, MixRadiusInvoiceDeleteArgs<ExtArgs>>): Prisma__MixRadiusInvoiceClient<$Result.GetResult<Prisma.$MixRadiusInvoicePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one MixRadiusInvoice.
     * @param {MixRadiusInvoiceUpdateArgs} args - Arguments to update one MixRadiusInvoice.
     * @example
     * // Update one MixRadiusInvoice
     * const mixRadiusInvoice = await prisma.mixRadiusInvoice.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MixRadiusInvoiceUpdateArgs>(args: SelectSubset<T, MixRadiusInvoiceUpdateArgs<ExtArgs>>): Prisma__MixRadiusInvoiceClient<$Result.GetResult<Prisma.$MixRadiusInvoicePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more MixRadiusInvoices.
     * @param {MixRadiusInvoiceDeleteManyArgs} args - Arguments to filter MixRadiusInvoices to delete.
     * @example
     * // Delete a few MixRadiusInvoices
     * const { count } = await prisma.mixRadiusInvoice.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MixRadiusInvoiceDeleteManyArgs>(args?: SelectSubset<T, MixRadiusInvoiceDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MixRadiusInvoices.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusInvoiceUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MixRadiusInvoices
     * const mixRadiusInvoice = await prisma.mixRadiusInvoice.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MixRadiusInvoiceUpdateManyArgs>(args: SelectSubset<T, MixRadiusInvoiceUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MixRadiusInvoices and returns the data updated in the database.
     * @param {MixRadiusInvoiceUpdateManyAndReturnArgs} args - Arguments to update many MixRadiusInvoices.
     * @example
     * // Update many MixRadiusInvoices
     * const mixRadiusInvoice = await prisma.mixRadiusInvoice.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more MixRadiusInvoices and only return the `id`
     * const mixRadiusInvoiceWithIdOnly = await prisma.mixRadiusInvoice.updateManyAndReturn({
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
    updateManyAndReturn<T extends MixRadiusInvoiceUpdateManyAndReturnArgs>(args: SelectSubset<T, MixRadiusInvoiceUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MixRadiusInvoicePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one MixRadiusInvoice.
     * @param {MixRadiusInvoiceUpsertArgs} args - Arguments to update or create a MixRadiusInvoice.
     * @example
     * // Update or create a MixRadiusInvoice
     * const mixRadiusInvoice = await prisma.mixRadiusInvoice.upsert({
     *   create: {
     *     // ... data to create a MixRadiusInvoice
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MixRadiusInvoice we want to update
     *   }
     * })
     */
    upsert<T extends MixRadiusInvoiceUpsertArgs>(args: SelectSubset<T, MixRadiusInvoiceUpsertArgs<ExtArgs>>): Prisma__MixRadiusInvoiceClient<$Result.GetResult<Prisma.$MixRadiusInvoicePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of MixRadiusInvoices.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusInvoiceCountArgs} args - Arguments to filter MixRadiusInvoices to count.
     * @example
     * // Count the number of MixRadiusInvoices
     * const count = await prisma.mixRadiusInvoice.count({
     *   where: {
     *     // ... the filter for the MixRadiusInvoices we want to count
     *   }
     * })
    **/
    count<T extends MixRadiusInvoiceCountArgs>(
      args?: Subset<T, MixRadiusInvoiceCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MixRadiusInvoiceCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MixRadiusInvoice.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusInvoiceAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends MixRadiusInvoiceAggregateArgs>(args: Subset<T, MixRadiusInvoiceAggregateArgs>): Prisma.PrismaPromise<GetMixRadiusInvoiceAggregateType<T>>

    /**
     * Group by MixRadiusInvoice.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusInvoiceGroupByArgs} args - Group by arguments.
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
      T extends MixRadiusInvoiceGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MixRadiusInvoiceGroupByArgs['orderBy'] }
        : { orderBy?: MixRadiusInvoiceGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
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
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MixRadiusInvoiceGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMixRadiusInvoiceGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the MixRadiusInvoice model
   */
  readonly fields: MixRadiusInvoiceFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MixRadiusInvoice.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MixRadiusInvoiceClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the MixRadiusInvoice model
   */
  interface MixRadiusInvoiceFieldRefs {
    readonly id: FieldRef<"MixRadiusInvoice", 'String'>
    readonly invoiceNumber: FieldRef<"MixRadiusInvoice", 'String'>
    readonly mixRadiusId: FieldRef<"MixRadiusInvoice", 'String'>
    readonly username: FieldRef<"MixRadiusInvoice", 'String'>
    readonly fullName: FieldRef<"MixRadiusInvoice", 'String'>
    readonly ownerName: FieldRef<"MixRadiusInvoice", 'String'>
    readonly planName: FieldRef<"MixRadiusInvoice", 'String'>
    readonly amount: FieldRef<"MixRadiusInvoice", 'Decimal'>
    readonly status: FieldRef<"MixRadiusInvoice", 'String'>
    readonly paymentMethod: FieldRef<"MixRadiusInvoice", 'String'>
    readonly issuedDate: FieldRef<"MixRadiusInvoice", 'DateTime'>
    readonly dueDate: FieldRef<"MixRadiusInvoice", 'DateTime'>
    readonly expiredOn: FieldRef<"MixRadiusInvoice", 'DateTime'>
    readonly syncedAt: FieldRef<"MixRadiusInvoice", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * MixRadiusInvoice findUnique
   */
  export type MixRadiusInvoiceFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvoice
     */
    select?: MixRadiusInvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvoice
     */
    omit?: MixRadiusInvoiceOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusInvoice to fetch.
     */
    where: MixRadiusInvoiceWhereUniqueInput
  }

  /**
   * MixRadiusInvoice findUniqueOrThrow
   */
  export type MixRadiusInvoiceFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvoice
     */
    select?: MixRadiusInvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvoice
     */
    omit?: MixRadiusInvoiceOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusInvoice to fetch.
     */
    where: MixRadiusInvoiceWhereUniqueInput
  }

  /**
   * MixRadiusInvoice findFirst
   */
  export type MixRadiusInvoiceFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvoice
     */
    select?: MixRadiusInvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvoice
     */
    omit?: MixRadiusInvoiceOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusInvoice to fetch.
     */
    where?: MixRadiusInvoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusInvoices to fetch.
     */
    orderBy?: MixRadiusInvoiceOrderByWithRelationInput | MixRadiusInvoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MixRadiusInvoices.
     */
    cursor?: MixRadiusInvoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusInvoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusInvoices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MixRadiusInvoices.
     */
    distinct?: MixRadiusInvoiceScalarFieldEnum | MixRadiusInvoiceScalarFieldEnum[]
  }

  /**
   * MixRadiusInvoice findFirstOrThrow
   */
  export type MixRadiusInvoiceFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvoice
     */
    select?: MixRadiusInvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvoice
     */
    omit?: MixRadiusInvoiceOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusInvoice to fetch.
     */
    where?: MixRadiusInvoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusInvoices to fetch.
     */
    orderBy?: MixRadiusInvoiceOrderByWithRelationInput | MixRadiusInvoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MixRadiusInvoices.
     */
    cursor?: MixRadiusInvoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusInvoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusInvoices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MixRadiusInvoices.
     */
    distinct?: MixRadiusInvoiceScalarFieldEnum | MixRadiusInvoiceScalarFieldEnum[]
  }

  /**
   * MixRadiusInvoice findMany
   */
  export type MixRadiusInvoiceFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvoice
     */
    select?: MixRadiusInvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvoice
     */
    omit?: MixRadiusInvoiceOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusInvoices to fetch.
     */
    where?: MixRadiusInvoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusInvoices to fetch.
     */
    orderBy?: MixRadiusInvoiceOrderByWithRelationInput | MixRadiusInvoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MixRadiusInvoices.
     */
    cursor?: MixRadiusInvoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusInvoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusInvoices.
     */
    skip?: number
    distinct?: MixRadiusInvoiceScalarFieldEnum | MixRadiusInvoiceScalarFieldEnum[]
  }

  /**
   * MixRadiusInvoice create
   */
  export type MixRadiusInvoiceCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvoice
     */
    select?: MixRadiusInvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvoice
     */
    omit?: MixRadiusInvoiceOmit<ExtArgs> | null
    /**
     * The data needed to create a MixRadiusInvoice.
     */
    data: XOR<MixRadiusInvoiceCreateInput, MixRadiusInvoiceUncheckedCreateInput>
  }

  /**
   * MixRadiusInvoice createMany
   */
  export type MixRadiusInvoiceCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many MixRadiusInvoices.
     */
    data: MixRadiusInvoiceCreateManyInput | MixRadiusInvoiceCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MixRadiusInvoice createManyAndReturn
   */
  export type MixRadiusInvoiceCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvoice
     */
    select?: MixRadiusInvoiceSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvoice
     */
    omit?: MixRadiusInvoiceOmit<ExtArgs> | null
    /**
     * The data used to create many MixRadiusInvoices.
     */
    data: MixRadiusInvoiceCreateManyInput | MixRadiusInvoiceCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MixRadiusInvoice update
   */
  export type MixRadiusInvoiceUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvoice
     */
    select?: MixRadiusInvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvoice
     */
    omit?: MixRadiusInvoiceOmit<ExtArgs> | null
    /**
     * The data needed to update a MixRadiusInvoice.
     */
    data: XOR<MixRadiusInvoiceUpdateInput, MixRadiusInvoiceUncheckedUpdateInput>
    /**
     * Choose, which MixRadiusInvoice to update.
     */
    where: MixRadiusInvoiceWhereUniqueInput
  }

  /**
   * MixRadiusInvoice updateMany
   */
  export type MixRadiusInvoiceUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update MixRadiusInvoices.
     */
    data: XOR<MixRadiusInvoiceUpdateManyMutationInput, MixRadiusInvoiceUncheckedUpdateManyInput>
    /**
     * Filter which MixRadiusInvoices to update
     */
    where?: MixRadiusInvoiceWhereInput
    /**
     * Limit how many MixRadiusInvoices to update.
     */
    limit?: number
  }

  /**
   * MixRadiusInvoice updateManyAndReturn
   */
  export type MixRadiusInvoiceUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvoice
     */
    select?: MixRadiusInvoiceSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvoice
     */
    omit?: MixRadiusInvoiceOmit<ExtArgs> | null
    /**
     * The data used to update MixRadiusInvoices.
     */
    data: XOR<MixRadiusInvoiceUpdateManyMutationInput, MixRadiusInvoiceUncheckedUpdateManyInput>
    /**
     * Filter which MixRadiusInvoices to update
     */
    where?: MixRadiusInvoiceWhereInput
    /**
     * Limit how many MixRadiusInvoices to update.
     */
    limit?: number
  }

  /**
   * MixRadiusInvoice upsert
   */
  export type MixRadiusInvoiceUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvoice
     */
    select?: MixRadiusInvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvoice
     */
    omit?: MixRadiusInvoiceOmit<ExtArgs> | null
    /**
     * The filter to search for the MixRadiusInvoice to update in case it exists.
     */
    where: MixRadiusInvoiceWhereUniqueInput
    /**
     * In case the MixRadiusInvoice found by the `where` argument doesn't exist, create a new MixRadiusInvoice with this data.
     */
    create: XOR<MixRadiusInvoiceCreateInput, MixRadiusInvoiceUncheckedCreateInput>
    /**
     * In case the MixRadiusInvoice was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MixRadiusInvoiceUpdateInput, MixRadiusInvoiceUncheckedUpdateInput>
  }

  /**
   * MixRadiusInvoice delete
   */
  export type MixRadiusInvoiceDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvoice
     */
    select?: MixRadiusInvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvoice
     */
    omit?: MixRadiusInvoiceOmit<ExtArgs> | null
    /**
     * Filter which MixRadiusInvoice to delete.
     */
    where: MixRadiusInvoiceWhereUniqueInput
  }

  /**
   * MixRadiusInvoice deleteMany
   */
  export type MixRadiusInvoiceDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MixRadiusInvoices to delete
     */
    where?: MixRadiusInvoiceWhereInput
    /**
     * Limit how many MixRadiusInvoices to delete.
     */
    limit?: number
  }

  /**
   * MixRadiusInvoice without action
   */
  export type MixRadiusInvoiceDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvoice
     */
    select?: MixRadiusInvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvoice
     */
    omit?: MixRadiusInvoiceOmit<ExtArgs> | null
  }


  /**
   * Model MixRadiusCustomer
   */

  export type AggregateMixRadiusCustomer = {
    _count: MixRadiusCustomerCountAggregateOutputType | null
    _min: MixRadiusCustomerMinAggregateOutputType | null
    _max: MixRadiusCustomerMaxAggregateOutputType | null
  }

  export type MixRadiusCustomerMinAggregateOutputType = {
    id: string | null
    mixRadiusId: string | null
    username: string | null
    fullName: string | null
    address: string | null
    phoneNumber: string | null
    planName: string | null
    status: string | null
    ownerName: string | null
    expiredOn: Date | null
    lastSyncedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MixRadiusCustomerMaxAggregateOutputType = {
    id: string | null
    mixRadiusId: string | null
    username: string | null
    fullName: string | null
    address: string | null
    phoneNumber: string | null
    planName: string | null
    status: string | null
    ownerName: string | null
    expiredOn: Date | null
    lastSyncedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MixRadiusCustomerCountAggregateOutputType = {
    id: number
    mixRadiusId: number
    username: number
    fullName: number
    address: number
    phoneNumber: number
    planName: number
    status: number
    ownerName: number
    expiredOn: number
    lastSyncedAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type MixRadiusCustomerMinAggregateInputType = {
    id?: true
    mixRadiusId?: true
    username?: true
    fullName?: true
    address?: true
    phoneNumber?: true
    planName?: true
    status?: true
    ownerName?: true
    expiredOn?: true
    lastSyncedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MixRadiusCustomerMaxAggregateInputType = {
    id?: true
    mixRadiusId?: true
    username?: true
    fullName?: true
    address?: true
    phoneNumber?: true
    planName?: true
    status?: true
    ownerName?: true
    expiredOn?: true
    lastSyncedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MixRadiusCustomerCountAggregateInputType = {
    id?: true
    mixRadiusId?: true
    username?: true
    fullName?: true
    address?: true
    phoneNumber?: true
    planName?: true
    status?: true
    ownerName?: true
    expiredOn?: true
    lastSyncedAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type MixRadiusCustomerAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MixRadiusCustomer to aggregate.
     */
    where?: MixRadiusCustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusCustomers to fetch.
     */
    orderBy?: MixRadiusCustomerOrderByWithRelationInput | MixRadiusCustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MixRadiusCustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusCustomers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusCustomers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MixRadiusCustomers
    **/
    _count?: true | MixRadiusCustomerCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MixRadiusCustomerMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MixRadiusCustomerMaxAggregateInputType
  }

  export type GetMixRadiusCustomerAggregateType<T extends MixRadiusCustomerAggregateArgs> = {
        [P in keyof T & keyof AggregateMixRadiusCustomer]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMixRadiusCustomer[P]>
      : GetScalarType<T[P], AggregateMixRadiusCustomer[P]>
  }




  export type MixRadiusCustomerGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MixRadiusCustomerWhereInput
    orderBy?: MixRadiusCustomerOrderByWithAggregationInput | MixRadiusCustomerOrderByWithAggregationInput[]
    by: MixRadiusCustomerScalarFieldEnum[] | MixRadiusCustomerScalarFieldEnum
    having?: MixRadiusCustomerScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MixRadiusCustomerCountAggregateInputType | true
    _min?: MixRadiusCustomerMinAggregateInputType
    _max?: MixRadiusCustomerMaxAggregateInputType
  }

  export type MixRadiusCustomerGroupByOutputType = {
    id: string
    mixRadiusId: string
    username: string
    fullName: string | null
    address: string | null
    phoneNumber: string | null
    planName: string | null
    status: string | null
    ownerName: string | null
    expiredOn: Date | null
    lastSyncedAt: Date
    createdAt: Date
    updatedAt: Date
    _count: MixRadiusCustomerCountAggregateOutputType | null
    _min: MixRadiusCustomerMinAggregateOutputType | null
    _max: MixRadiusCustomerMaxAggregateOutputType | null
  }

  type GetMixRadiusCustomerGroupByPayload<T extends MixRadiusCustomerGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MixRadiusCustomerGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MixRadiusCustomerGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MixRadiusCustomerGroupByOutputType[P]>
            : GetScalarType<T[P], MixRadiusCustomerGroupByOutputType[P]>
        }
      >
    >


  export type MixRadiusCustomerSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    mixRadiusId?: boolean
    username?: boolean
    fullName?: boolean
    address?: boolean
    phoneNumber?: boolean
    planName?: boolean
    status?: boolean
    ownerName?: boolean
    expiredOn?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["mixRadiusCustomer"]>

  export type MixRadiusCustomerSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    mixRadiusId?: boolean
    username?: boolean
    fullName?: boolean
    address?: boolean
    phoneNumber?: boolean
    planName?: boolean
    status?: boolean
    ownerName?: boolean
    expiredOn?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["mixRadiusCustomer"]>

  export type MixRadiusCustomerSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    mixRadiusId?: boolean
    username?: boolean
    fullName?: boolean
    address?: boolean
    phoneNumber?: boolean
    planName?: boolean
    status?: boolean
    ownerName?: boolean
    expiredOn?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["mixRadiusCustomer"]>

  export type MixRadiusCustomerSelectScalar = {
    id?: boolean
    mixRadiusId?: boolean
    username?: boolean
    fullName?: boolean
    address?: boolean
    phoneNumber?: boolean
    planName?: boolean
    status?: boolean
    ownerName?: boolean
    expiredOn?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type MixRadiusCustomerOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "mixRadiusId" | "username" | "fullName" | "address" | "phoneNumber" | "planName" | "status" | "ownerName" | "expiredOn" | "lastSyncedAt" | "createdAt" | "updatedAt", ExtArgs["result"]["mixRadiusCustomer"]>

  export type $MixRadiusCustomerPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "MixRadiusCustomer"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      mixRadiusId: string
      username: string
      fullName: string | null
      address: string | null
      phoneNumber: string | null
      planName: string | null
      status: string | null
      ownerName: string | null
      expiredOn: Date | null
      lastSyncedAt: Date
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["mixRadiusCustomer"]>
    composites: {}
  }

  type MixRadiusCustomerGetPayload<S extends boolean | null | undefined | MixRadiusCustomerDefaultArgs> = $Result.GetResult<Prisma.$MixRadiusCustomerPayload, S>

  type MixRadiusCustomerCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<MixRadiusCustomerFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: MixRadiusCustomerCountAggregateInputType | true
    }

  export interface MixRadiusCustomerDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['MixRadiusCustomer'], meta: { name: 'MixRadiusCustomer' } }
    /**
     * Find zero or one MixRadiusCustomer that matches the filter.
     * @param {MixRadiusCustomerFindUniqueArgs} args - Arguments to find a MixRadiusCustomer
     * @example
     * // Get one MixRadiusCustomer
     * const mixRadiusCustomer = await prisma.mixRadiusCustomer.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MixRadiusCustomerFindUniqueArgs>(args: SelectSubset<T, MixRadiusCustomerFindUniqueArgs<ExtArgs>>): Prisma__MixRadiusCustomerClient<$Result.GetResult<Prisma.$MixRadiusCustomerPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one MixRadiusCustomer that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MixRadiusCustomerFindUniqueOrThrowArgs} args - Arguments to find a MixRadiusCustomer
     * @example
     * // Get one MixRadiusCustomer
     * const mixRadiusCustomer = await prisma.mixRadiusCustomer.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MixRadiusCustomerFindUniqueOrThrowArgs>(args: SelectSubset<T, MixRadiusCustomerFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MixRadiusCustomerClient<$Result.GetResult<Prisma.$MixRadiusCustomerPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MixRadiusCustomer that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusCustomerFindFirstArgs} args - Arguments to find a MixRadiusCustomer
     * @example
     * // Get one MixRadiusCustomer
     * const mixRadiusCustomer = await prisma.mixRadiusCustomer.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MixRadiusCustomerFindFirstArgs>(args?: SelectSubset<T, MixRadiusCustomerFindFirstArgs<ExtArgs>>): Prisma__MixRadiusCustomerClient<$Result.GetResult<Prisma.$MixRadiusCustomerPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MixRadiusCustomer that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusCustomerFindFirstOrThrowArgs} args - Arguments to find a MixRadiusCustomer
     * @example
     * // Get one MixRadiusCustomer
     * const mixRadiusCustomer = await prisma.mixRadiusCustomer.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MixRadiusCustomerFindFirstOrThrowArgs>(args?: SelectSubset<T, MixRadiusCustomerFindFirstOrThrowArgs<ExtArgs>>): Prisma__MixRadiusCustomerClient<$Result.GetResult<Prisma.$MixRadiusCustomerPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more MixRadiusCustomers that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusCustomerFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MixRadiusCustomers
     * const mixRadiusCustomers = await prisma.mixRadiusCustomer.findMany()
     * 
     * // Get first 10 MixRadiusCustomers
     * const mixRadiusCustomers = await prisma.mixRadiusCustomer.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const mixRadiusCustomerWithIdOnly = await prisma.mixRadiusCustomer.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MixRadiusCustomerFindManyArgs>(args?: SelectSubset<T, MixRadiusCustomerFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MixRadiusCustomerPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a MixRadiusCustomer.
     * @param {MixRadiusCustomerCreateArgs} args - Arguments to create a MixRadiusCustomer.
     * @example
     * // Create one MixRadiusCustomer
     * const MixRadiusCustomer = await prisma.mixRadiusCustomer.create({
     *   data: {
     *     // ... data to create a MixRadiusCustomer
     *   }
     * })
     * 
     */
    create<T extends MixRadiusCustomerCreateArgs>(args: SelectSubset<T, MixRadiusCustomerCreateArgs<ExtArgs>>): Prisma__MixRadiusCustomerClient<$Result.GetResult<Prisma.$MixRadiusCustomerPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many MixRadiusCustomers.
     * @param {MixRadiusCustomerCreateManyArgs} args - Arguments to create many MixRadiusCustomers.
     * @example
     * // Create many MixRadiusCustomers
     * const mixRadiusCustomer = await prisma.mixRadiusCustomer.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MixRadiusCustomerCreateManyArgs>(args?: SelectSubset<T, MixRadiusCustomerCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many MixRadiusCustomers and returns the data saved in the database.
     * @param {MixRadiusCustomerCreateManyAndReturnArgs} args - Arguments to create many MixRadiusCustomers.
     * @example
     * // Create many MixRadiusCustomers
     * const mixRadiusCustomer = await prisma.mixRadiusCustomer.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many MixRadiusCustomers and only return the `id`
     * const mixRadiusCustomerWithIdOnly = await prisma.mixRadiusCustomer.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MixRadiusCustomerCreateManyAndReturnArgs>(args?: SelectSubset<T, MixRadiusCustomerCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MixRadiusCustomerPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a MixRadiusCustomer.
     * @param {MixRadiusCustomerDeleteArgs} args - Arguments to delete one MixRadiusCustomer.
     * @example
     * // Delete one MixRadiusCustomer
     * const MixRadiusCustomer = await prisma.mixRadiusCustomer.delete({
     *   where: {
     *     // ... filter to delete one MixRadiusCustomer
     *   }
     * })
     * 
     */
    delete<T extends MixRadiusCustomerDeleteArgs>(args: SelectSubset<T, MixRadiusCustomerDeleteArgs<ExtArgs>>): Prisma__MixRadiusCustomerClient<$Result.GetResult<Prisma.$MixRadiusCustomerPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one MixRadiusCustomer.
     * @param {MixRadiusCustomerUpdateArgs} args - Arguments to update one MixRadiusCustomer.
     * @example
     * // Update one MixRadiusCustomer
     * const mixRadiusCustomer = await prisma.mixRadiusCustomer.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MixRadiusCustomerUpdateArgs>(args: SelectSubset<T, MixRadiusCustomerUpdateArgs<ExtArgs>>): Prisma__MixRadiusCustomerClient<$Result.GetResult<Prisma.$MixRadiusCustomerPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more MixRadiusCustomers.
     * @param {MixRadiusCustomerDeleteManyArgs} args - Arguments to filter MixRadiusCustomers to delete.
     * @example
     * // Delete a few MixRadiusCustomers
     * const { count } = await prisma.mixRadiusCustomer.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MixRadiusCustomerDeleteManyArgs>(args?: SelectSubset<T, MixRadiusCustomerDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MixRadiusCustomers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusCustomerUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MixRadiusCustomers
     * const mixRadiusCustomer = await prisma.mixRadiusCustomer.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MixRadiusCustomerUpdateManyArgs>(args: SelectSubset<T, MixRadiusCustomerUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MixRadiusCustomers and returns the data updated in the database.
     * @param {MixRadiusCustomerUpdateManyAndReturnArgs} args - Arguments to update many MixRadiusCustomers.
     * @example
     * // Update many MixRadiusCustomers
     * const mixRadiusCustomer = await prisma.mixRadiusCustomer.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more MixRadiusCustomers and only return the `id`
     * const mixRadiusCustomerWithIdOnly = await prisma.mixRadiusCustomer.updateManyAndReturn({
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
    updateManyAndReturn<T extends MixRadiusCustomerUpdateManyAndReturnArgs>(args: SelectSubset<T, MixRadiusCustomerUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MixRadiusCustomerPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one MixRadiusCustomer.
     * @param {MixRadiusCustomerUpsertArgs} args - Arguments to update or create a MixRadiusCustomer.
     * @example
     * // Update or create a MixRadiusCustomer
     * const mixRadiusCustomer = await prisma.mixRadiusCustomer.upsert({
     *   create: {
     *     // ... data to create a MixRadiusCustomer
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MixRadiusCustomer we want to update
     *   }
     * })
     */
    upsert<T extends MixRadiusCustomerUpsertArgs>(args: SelectSubset<T, MixRadiusCustomerUpsertArgs<ExtArgs>>): Prisma__MixRadiusCustomerClient<$Result.GetResult<Prisma.$MixRadiusCustomerPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of MixRadiusCustomers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusCustomerCountArgs} args - Arguments to filter MixRadiusCustomers to count.
     * @example
     * // Count the number of MixRadiusCustomers
     * const count = await prisma.mixRadiusCustomer.count({
     *   where: {
     *     // ... the filter for the MixRadiusCustomers we want to count
     *   }
     * })
    **/
    count<T extends MixRadiusCustomerCountArgs>(
      args?: Subset<T, MixRadiusCustomerCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MixRadiusCustomerCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MixRadiusCustomer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusCustomerAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends MixRadiusCustomerAggregateArgs>(args: Subset<T, MixRadiusCustomerAggregateArgs>): Prisma.PrismaPromise<GetMixRadiusCustomerAggregateType<T>>

    /**
     * Group by MixRadiusCustomer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusCustomerGroupByArgs} args - Group by arguments.
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
      T extends MixRadiusCustomerGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MixRadiusCustomerGroupByArgs['orderBy'] }
        : { orderBy?: MixRadiusCustomerGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
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
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MixRadiusCustomerGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMixRadiusCustomerGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the MixRadiusCustomer model
   */
  readonly fields: MixRadiusCustomerFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MixRadiusCustomer.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MixRadiusCustomerClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the MixRadiusCustomer model
   */
  interface MixRadiusCustomerFieldRefs {
    readonly id: FieldRef<"MixRadiusCustomer", 'String'>
    readonly mixRadiusId: FieldRef<"MixRadiusCustomer", 'String'>
    readonly username: FieldRef<"MixRadiusCustomer", 'String'>
    readonly fullName: FieldRef<"MixRadiusCustomer", 'String'>
    readonly address: FieldRef<"MixRadiusCustomer", 'String'>
    readonly phoneNumber: FieldRef<"MixRadiusCustomer", 'String'>
    readonly planName: FieldRef<"MixRadiusCustomer", 'String'>
    readonly status: FieldRef<"MixRadiusCustomer", 'String'>
    readonly ownerName: FieldRef<"MixRadiusCustomer", 'String'>
    readonly expiredOn: FieldRef<"MixRadiusCustomer", 'DateTime'>
    readonly lastSyncedAt: FieldRef<"MixRadiusCustomer", 'DateTime'>
    readonly createdAt: FieldRef<"MixRadiusCustomer", 'DateTime'>
    readonly updatedAt: FieldRef<"MixRadiusCustomer", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * MixRadiusCustomer findUnique
   */
  export type MixRadiusCustomerFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusCustomer
     */
    select?: MixRadiusCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusCustomer
     */
    omit?: MixRadiusCustomerOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusCustomer to fetch.
     */
    where: MixRadiusCustomerWhereUniqueInput
  }

  /**
   * MixRadiusCustomer findUniqueOrThrow
   */
  export type MixRadiusCustomerFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusCustomer
     */
    select?: MixRadiusCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusCustomer
     */
    omit?: MixRadiusCustomerOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusCustomer to fetch.
     */
    where: MixRadiusCustomerWhereUniqueInput
  }

  /**
   * MixRadiusCustomer findFirst
   */
  export type MixRadiusCustomerFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusCustomer
     */
    select?: MixRadiusCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusCustomer
     */
    omit?: MixRadiusCustomerOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusCustomer to fetch.
     */
    where?: MixRadiusCustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusCustomers to fetch.
     */
    orderBy?: MixRadiusCustomerOrderByWithRelationInput | MixRadiusCustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MixRadiusCustomers.
     */
    cursor?: MixRadiusCustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusCustomers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusCustomers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MixRadiusCustomers.
     */
    distinct?: MixRadiusCustomerScalarFieldEnum | MixRadiusCustomerScalarFieldEnum[]
  }

  /**
   * MixRadiusCustomer findFirstOrThrow
   */
  export type MixRadiusCustomerFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusCustomer
     */
    select?: MixRadiusCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusCustomer
     */
    omit?: MixRadiusCustomerOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusCustomer to fetch.
     */
    where?: MixRadiusCustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusCustomers to fetch.
     */
    orderBy?: MixRadiusCustomerOrderByWithRelationInput | MixRadiusCustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MixRadiusCustomers.
     */
    cursor?: MixRadiusCustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusCustomers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusCustomers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MixRadiusCustomers.
     */
    distinct?: MixRadiusCustomerScalarFieldEnum | MixRadiusCustomerScalarFieldEnum[]
  }

  /**
   * MixRadiusCustomer findMany
   */
  export type MixRadiusCustomerFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusCustomer
     */
    select?: MixRadiusCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusCustomer
     */
    omit?: MixRadiusCustomerOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusCustomers to fetch.
     */
    where?: MixRadiusCustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusCustomers to fetch.
     */
    orderBy?: MixRadiusCustomerOrderByWithRelationInput | MixRadiusCustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MixRadiusCustomers.
     */
    cursor?: MixRadiusCustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusCustomers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusCustomers.
     */
    skip?: number
    distinct?: MixRadiusCustomerScalarFieldEnum | MixRadiusCustomerScalarFieldEnum[]
  }

  /**
   * MixRadiusCustomer create
   */
  export type MixRadiusCustomerCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusCustomer
     */
    select?: MixRadiusCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusCustomer
     */
    omit?: MixRadiusCustomerOmit<ExtArgs> | null
    /**
     * The data needed to create a MixRadiusCustomer.
     */
    data: XOR<MixRadiusCustomerCreateInput, MixRadiusCustomerUncheckedCreateInput>
  }

  /**
   * MixRadiusCustomer createMany
   */
  export type MixRadiusCustomerCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many MixRadiusCustomers.
     */
    data: MixRadiusCustomerCreateManyInput | MixRadiusCustomerCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MixRadiusCustomer createManyAndReturn
   */
  export type MixRadiusCustomerCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusCustomer
     */
    select?: MixRadiusCustomerSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusCustomer
     */
    omit?: MixRadiusCustomerOmit<ExtArgs> | null
    /**
     * The data used to create many MixRadiusCustomers.
     */
    data: MixRadiusCustomerCreateManyInput | MixRadiusCustomerCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MixRadiusCustomer update
   */
  export type MixRadiusCustomerUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusCustomer
     */
    select?: MixRadiusCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusCustomer
     */
    omit?: MixRadiusCustomerOmit<ExtArgs> | null
    /**
     * The data needed to update a MixRadiusCustomer.
     */
    data: XOR<MixRadiusCustomerUpdateInput, MixRadiusCustomerUncheckedUpdateInput>
    /**
     * Choose, which MixRadiusCustomer to update.
     */
    where: MixRadiusCustomerWhereUniqueInput
  }

  /**
   * MixRadiusCustomer updateMany
   */
  export type MixRadiusCustomerUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update MixRadiusCustomers.
     */
    data: XOR<MixRadiusCustomerUpdateManyMutationInput, MixRadiusCustomerUncheckedUpdateManyInput>
    /**
     * Filter which MixRadiusCustomers to update
     */
    where?: MixRadiusCustomerWhereInput
    /**
     * Limit how many MixRadiusCustomers to update.
     */
    limit?: number
  }

  /**
   * MixRadiusCustomer updateManyAndReturn
   */
  export type MixRadiusCustomerUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusCustomer
     */
    select?: MixRadiusCustomerSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusCustomer
     */
    omit?: MixRadiusCustomerOmit<ExtArgs> | null
    /**
     * The data used to update MixRadiusCustomers.
     */
    data: XOR<MixRadiusCustomerUpdateManyMutationInput, MixRadiusCustomerUncheckedUpdateManyInput>
    /**
     * Filter which MixRadiusCustomers to update
     */
    where?: MixRadiusCustomerWhereInput
    /**
     * Limit how many MixRadiusCustomers to update.
     */
    limit?: number
  }

  /**
   * MixRadiusCustomer upsert
   */
  export type MixRadiusCustomerUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusCustomer
     */
    select?: MixRadiusCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusCustomer
     */
    omit?: MixRadiusCustomerOmit<ExtArgs> | null
    /**
     * The filter to search for the MixRadiusCustomer to update in case it exists.
     */
    where: MixRadiusCustomerWhereUniqueInput
    /**
     * In case the MixRadiusCustomer found by the `where` argument doesn't exist, create a new MixRadiusCustomer with this data.
     */
    create: XOR<MixRadiusCustomerCreateInput, MixRadiusCustomerUncheckedCreateInput>
    /**
     * In case the MixRadiusCustomer was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MixRadiusCustomerUpdateInput, MixRadiusCustomerUncheckedUpdateInput>
  }

  /**
   * MixRadiusCustomer delete
   */
  export type MixRadiusCustomerDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusCustomer
     */
    select?: MixRadiusCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusCustomer
     */
    omit?: MixRadiusCustomerOmit<ExtArgs> | null
    /**
     * Filter which MixRadiusCustomer to delete.
     */
    where: MixRadiusCustomerWhereUniqueInput
  }

  /**
   * MixRadiusCustomer deleteMany
   */
  export type MixRadiusCustomerDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MixRadiusCustomers to delete
     */
    where?: MixRadiusCustomerWhereInput
    /**
     * Limit how many MixRadiusCustomers to delete.
     */
    limit?: number
  }

  /**
   * MixRadiusCustomer without action
   */
  export type MixRadiusCustomerDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusCustomer
     */
    select?: MixRadiusCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusCustomer
     */
    omit?: MixRadiusCustomerOmit<ExtArgs> | null
  }


  /**
   * Model MixRadiusOwnerGroup
   */

  export type AggregateMixRadiusOwnerGroup = {
    _count: MixRadiusOwnerGroupCountAggregateOutputType | null
    _min: MixRadiusOwnerGroupMinAggregateOutputType | null
    _max: MixRadiusOwnerGroupMaxAggregateOutputType | null
  }

  export type MixRadiusOwnerGroupMinAggregateOutputType = {
    id: string | null
    name: string | null
    siteId: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MixRadiusOwnerGroupMaxAggregateOutputType = {
    id: string | null
    name: string | null
    siteId: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MixRadiusOwnerGroupCountAggregateOutputType = {
    id: number
    name: number
    owners: number
    siteId: number
    isActive: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type MixRadiusOwnerGroupMinAggregateInputType = {
    id?: true
    name?: true
    siteId?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MixRadiusOwnerGroupMaxAggregateInputType = {
    id?: true
    name?: true
    siteId?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MixRadiusOwnerGroupCountAggregateInputType = {
    id?: true
    name?: true
    owners?: true
    siteId?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type MixRadiusOwnerGroupAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MixRadiusOwnerGroup to aggregate.
     */
    where?: MixRadiusOwnerGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusOwnerGroups to fetch.
     */
    orderBy?: MixRadiusOwnerGroupOrderByWithRelationInput | MixRadiusOwnerGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MixRadiusOwnerGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusOwnerGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusOwnerGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MixRadiusOwnerGroups
    **/
    _count?: true | MixRadiusOwnerGroupCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MixRadiusOwnerGroupMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MixRadiusOwnerGroupMaxAggregateInputType
  }

  export type GetMixRadiusOwnerGroupAggregateType<T extends MixRadiusOwnerGroupAggregateArgs> = {
        [P in keyof T & keyof AggregateMixRadiusOwnerGroup]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMixRadiusOwnerGroup[P]>
      : GetScalarType<T[P], AggregateMixRadiusOwnerGroup[P]>
  }




  export type MixRadiusOwnerGroupGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MixRadiusOwnerGroupWhereInput
    orderBy?: MixRadiusOwnerGroupOrderByWithAggregationInput | MixRadiusOwnerGroupOrderByWithAggregationInput[]
    by: MixRadiusOwnerGroupScalarFieldEnum[] | MixRadiusOwnerGroupScalarFieldEnum
    having?: MixRadiusOwnerGroupScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MixRadiusOwnerGroupCountAggregateInputType | true
    _min?: MixRadiusOwnerGroupMinAggregateInputType
    _max?: MixRadiusOwnerGroupMaxAggregateInputType
  }

  export type MixRadiusOwnerGroupGroupByOutputType = {
    id: string
    name: string
    owners: string[]
    siteId: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count: MixRadiusOwnerGroupCountAggregateOutputType | null
    _min: MixRadiusOwnerGroupMinAggregateOutputType | null
    _max: MixRadiusOwnerGroupMaxAggregateOutputType | null
  }

  type GetMixRadiusOwnerGroupGroupByPayload<T extends MixRadiusOwnerGroupGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MixRadiusOwnerGroupGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MixRadiusOwnerGroupGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MixRadiusOwnerGroupGroupByOutputType[P]>
            : GetScalarType<T[P], MixRadiusOwnerGroupGroupByOutputType[P]>
        }
      >
    >


  export type MixRadiusOwnerGroupSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    owners?: boolean
    siteId?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["mixRadiusOwnerGroup"]>

  export type MixRadiusOwnerGroupSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    owners?: boolean
    siteId?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["mixRadiusOwnerGroup"]>

  export type MixRadiusOwnerGroupSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    owners?: boolean
    siteId?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["mixRadiusOwnerGroup"]>

  export type MixRadiusOwnerGroupSelectScalar = {
    id?: boolean
    name?: boolean
    owners?: boolean
    siteId?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type MixRadiusOwnerGroupOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "owners" | "siteId" | "isActive" | "createdAt" | "updatedAt", ExtArgs["result"]["mixRadiusOwnerGroup"]>

  export type $MixRadiusOwnerGroupPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "MixRadiusOwnerGroup"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      owners: string[]
      siteId: string | null
      isActive: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["mixRadiusOwnerGroup"]>
    composites: {}
  }

  type MixRadiusOwnerGroupGetPayload<S extends boolean | null | undefined | MixRadiusOwnerGroupDefaultArgs> = $Result.GetResult<Prisma.$MixRadiusOwnerGroupPayload, S>

  type MixRadiusOwnerGroupCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<MixRadiusOwnerGroupFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: MixRadiusOwnerGroupCountAggregateInputType | true
    }

  export interface MixRadiusOwnerGroupDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['MixRadiusOwnerGroup'], meta: { name: 'MixRadiusOwnerGroup' } }
    /**
     * Find zero or one MixRadiusOwnerGroup that matches the filter.
     * @param {MixRadiusOwnerGroupFindUniqueArgs} args - Arguments to find a MixRadiusOwnerGroup
     * @example
     * // Get one MixRadiusOwnerGroup
     * const mixRadiusOwnerGroup = await prisma.mixRadiusOwnerGroup.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MixRadiusOwnerGroupFindUniqueArgs>(args: SelectSubset<T, MixRadiusOwnerGroupFindUniqueArgs<ExtArgs>>): Prisma__MixRadiusOwnerGroupClient<$Result.GetResult<Prisma.$MixRadiusOwnerGroupPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one MixRadiusOwnerGroup that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MixRadiusOwnerGroupFindUniqueOrThrowArgs} args - Arguments to find a MixRadiusOwnerGroup
     * @example
     * // Get one MixRadiusOwnerGroup
     * const mixRadiusOwnerGroup = await prisma.mixRadiusOwnerGroup.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MixRadiusOwnerGroupFindUniqueOrThrowArgs>(args: SelectSubset<T, MixRadiusOwnerGroupFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MixRadiusOwnerGroupClient<$Result.GetResult<Prisma.$MixRadiusOwnerGroupPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MixRadiusOwnerGroup that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusOwnerGroupFindFirstArgs} args - Arguments to find a MixRadiusOwnerGroup
     * @example
     * // Get one MixRadiusOwnerGroup
     * const mixRadiusOwnerGroup = await prisma.mixRadiusOwnerGroup.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MixRadiusOwnerGroupFindFirstArgs>(args?: SelectSubset<T, MixRadiusOwnerGroupFindFirstArgs<ExtArgs>>): Prisma__MixRadiusOwnerGroupClient<$Result.GetResult<Prisma.$MixRadiusOwnerGroupPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MixRadiusOwnerGroup that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusOwnerGroupFindFirstOrThrowArgs} args - Arguments to find a MixRadiusOwnerGroup
     * @example
     * // Get one MixRadiusOwnerGroup
     * const mixRadiusOwnerGroup = await prisma.mixRadiusOwnerGroup.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MixRadiusOwnerGroupFindFirstOrThrowArgs>(args?: SelectSubset<T, MixRadiusOwnerGroupFindFirstOrThrowArgs<ExtArgs>>): Prisma__MixRadiusOwnerGroupClient<$Result.GetResult<Prisma.$MixRadiusOwnerGroupPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more MixRadiusOwnerGroups that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusOwnerGroupFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MixRadiusOwnerGroups
     * const mixRadiusOwnerGroups = await prisma.mixRadiusOwnerGroup.findMany()
     * 
     * // Get first 10 MixRadiusOwnerGroups
     * const mixRadiusOwnerGroups = await prisma.mixRadiusOwnerGroup.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const mixRadiusOwnerGroupWithIdOnly = await prisma.mixRadiusOwnerGroup.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MixRadiusOwnerGroupFindManyArgs>(args?: SelectSubset<T, MixRadiusOwnerGroupFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MixRadiusOwnerGroupPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a MixRadiusOwnerGroup.
     * @param {MixRadiusOwnerGroupCreateArgs} args - Arguments to create a MixRadiusOwnerGroup.
     * @example
     * // Create one MixRadiusOwnerGroup
     * const MixRadiusOwnerGroup = await prisma.mixRadiusOwnerGroup.create({
     *   data: {
     *     // ... data to create a MixRadiusOwnerGroup
     *   }
     * })
     * 
     */
    create<T extends MixRadiusOwnerGroupCreateArgs>(args: SelectSubset<T, MixRadiusOwnerGroupCreateArgs<ExtArgs>>): Prisma__MixRadiusOwnerGroupClient<$Result.GetResult<Prisma.$MixRadiusOwnerGroupPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many MixRadiusOwnerGroups.
     * @param {MixRadiusOwnerGroupCreateManyArgs} args - Arguments to create many MixRadiusOwnerGroups.
     * @example
     * // Create many MixRadiusOwnerGroups
     * const mixRadiusOwnerGroup = await prisma.mixRadiusOwnerGroup.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MixRadiusOwnerGroupCreateManyArgs>(args?: SelectSubset<T, MixRadiusOwnerGroupCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many MixRadiusOwnerGroups and returns the data saved in the database.
     * @param {MixRadiusOwnerGroupCreateManyAndReturnArgs} args - Arguments to create many MixRadiusOwnerGroups.
     * @example
     * // Create many MixRadiusOwnerGroups
     * const mixRadiusOwnerGroup = await prisma.mixRadiusOwnerGroup.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many MixRadiusOwnerGroups and only return the `id`
     * const mixRadiusOwnerGroupWithIdOnly = await prisma.mixRadiusOwnerGroup.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MixRadiusOwnerGroupCreateManyAndReturnArgs>(args?: SelectSubset<T, MixRadiusOwnerGroupCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MixRadiusOwnerGroupPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a MixRadiusOwnerGroup.
     * @param {MixRadiusOwnerGroupDeleteArgs} args - Arguments to delete one MixRadiusOwnerGroup.
     * @example
     * // Delete one MixRadiusOwnerGroup
     * const MixRadiusOwnerGroup = await prisma.mixRadiusOwnerGroup.delete({
     *   where: {
     *     // ... filter to delete one MixRadiusOwnerGroup
     *   }
     * })
     * 
     */
    delete<T extends MixRadiusOwnerGroupDeleteArgs>(args: SelectSubset<T, MixRadiusOwnerGroupDeleteArgs<ExtArgs>>): Prisma__MixRadiusOwnerGroupClient<$Result.GetResult<Prisma.$MixRadiusOwnerGroupPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one MixRadiusOwnerGroup.
     * @param {MixRadiusOwnerGroupUpdateArgs} args - Arguments to update one MixRadiusOwnerGroup.
     * @example
     * // Update one MixRadiusOwnerGroup
     * const mixRadiusOwnerGroup = await prisma.mixRadiusOwnerGroup.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MixRadiusOwnerGroupUpdateArgs>(args: SelectSubset<T, MixRadiusOwnerGroupUpdateArgs<ExtArgs>>): Prisma__MixRadiusOwnerGroupClient<$Result.GetResult<Prisma.$MixRadiusOwnerGroupPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more MixRadiusOwnerGroups.
     * @param {MixRadiusOwnerGroupDeleteManyArgs} args - Arguments to filter MixRadiusOwnerGroups to delete.
     * @example
     * // Delete a few MixRadiusOwnerGroups
     * const { count } = await prisma.mixRadiusOwnerGroup.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MixRadiusOwnerGroupDeleteManyArgs>(args?: SelectSubset<T, MixRadiusOwnerGroupDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MixRadiusOwnerGroups.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusOwnerGroupUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MixRadiusOwnerGroups
     * const mixRadiusOwnerGroup = await prisma.mixRadiusOwnerGroup.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MixRadiusOwnerGroupUpdateManyArgs>(args: SelectSubset<T, MixRadiusOwnerGroupUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MixRadiusOwnerGroups and returns the data updated in the database.
     * @param {MixRadiusOwnerGroupUpdateManyAndReturnArgs} args - Arguments to update many MixRadiusOwnerGroups.
     * @example
     * // Update many MixRadiusOwnerGroups
     * const mixRadiusOwnerGroup = await prisma.mixRadiusOwnerGroup.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more MixRadiusOwnerGroups and only return the `id`
     * const mixRadiusOwnerGroupWithIdOnly = await prisma.mixRadiusOwnerGroup.updateManyAndReturn({
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
    updateManyAndReturn<T extends MixRadiusOwnerGroupUpdateManyAndReturnArgs>(args: SelectSubset<T, MixRadiusOwnerGroupUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MixRadiusOwnerGroupPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one MixRadiusOwnerGroup.
     * @param {MixRadiusOwnerGroupUpsertArgs} args - Arguments to update or create a MixRadiusOwnerGroup.
     * @example
     * // Update or create a MixRadiusOwnerGroup
     * const mixRadiusOwnerGroup = await prisma.mixRadiusOwnerGroup.upsert({
     *   create: {
     *     // ... data to create a MixRadiusOwnerGroup
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MixRadiusOwnerGroup we want to update
     *   }
     * })
     */
    upsert<T extends MixRadiusOwnerGroupUpsertArgs>(args: SelectSubset<T, MixRadiusOwnerGroupUpsertArgs<ExtArgs>>): Prisma__MixRadiusOwnerGroupClient<$Result.GetResult<Prisma.$MixRadiusOwnerGroupPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of MixRadiusOwnerGroups.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusOwnerGroupCountArgs} args - Arguments to filter MixRadiusOwnerGroups to count.
     * @example
     * // Count the number of MixRadiusOwnerGroups
     * const count = await prisma.mixRadiusOwnerGroup.count({
     *   where: {
     *     // ... the filter for the MixRadiusOwnerGroups we want to count
     *   }
     * })
    **/
    count<T extends MixRadiusOwnerGroupCountArgs>(
      args?: Subset<T, MixRadiusOwnerGroupCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MixRadiusOwnerGroupCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MixRadiusOwnerGroup.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusOwnerGroupAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends MixRadiusOwnerGroupAggregateArgs>(args: Subset<T, MixRadiusOwnerGroupAggregateArgs>): Prisma.PrismaPromise<GetMixRadiusOwnerGroupAggregateType<T>>

    /**
     * Group by MixRadiusOwnerGroup.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusOwnerGroupGroupByArgs} args - Group by arguments.
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
      T extends MixRadiusOwnerGroupGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MixRadiusOwnerGroupGroupByArgs['orderBy'] }
        : { orderBy?: MixRadiusOwnerGroupGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
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
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MixRadiusOwnerGroupGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMixRadiusOwnerGroupGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the MixRadiusOwnerGroup model
   */
  readonly fields: MixRadiusOwnerGroupFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MixRadiusOwnerGroup.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MixRadiusOwnerGroupClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the MixRadiusOwnerGroup model
   */
  interface MixRadiusOwnerGroupFieldRefs {
    readonly id: FieldRef<"MixRadiusOwnerGroup", 'String'>
    readonly name: FieldRef<"MixRadiusOwnerGroup", 'String'>
    readonly owners: FieldRef<"MixRadiusOwnerGroup", 'String[]'>
    readonly siteId: FieldRef<"MixRadiusOwnerGroup", 'String'>
    readonly isActive: FieldRef<"MixRadiusOwnerGroup", 'Boolean'>
    readonly createdAt: FieldRef<"MixRadiusOwnerGroup", 'DateTime'>
    readonly updatedAt: FieldRef<"MixRadiusOwnerGroup", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * MixRadiusOwnerGroup findUnique
   */
  export type MixRadiusOwnerGroupFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusOwnerGroup
     */
    select?: MixRadiusOwnerGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusOwnerGroup
     */
    omit?: MixRadiusOwnerGroupOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusOwnerGroup to fetch.
     */
    where: MixRadiusOwnerGroupWhereUniqueInput
  }

  /**
   * MixRadiusOwnerGroup findUniqueOrThrow
   */
  export type MixRadiusOwnerGroupFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusOwnerGroup
     */
    select?: MixRadiusOwnerGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusOwnerGroup
     */
    omit?: MixRadiusOwnerGroupOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusOwnerGroup to fetch.
     */
    where: MixRadiusOwnerGroupWhereUniqueInput
  }

  /**
   * MixRadiusOwnerGroup findFirst
   */
  export type MixRadiusOwnerGroupFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusOwnerGroup
     */
    select?: MixRadiusOwnerGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusOwnerGroup
     */
    omit?: MixRadiusOwnerGroupOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusOwnerGroup to fetch.
     */
    where?: MixRadiusOwnerGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusOwnerGroups to fetch.
     */
    orderBy?: MixRadiusOwnerGroupOrderByWithRelationInput | MixRadiusOwnerGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MixRadiusOwnerGroups.
     */
    cursor?: MixRadiusOwnerGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusOwnerGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusOwnerGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MixRadiusOwnerGroups.
     */
    distinct?: MixRadiusOwnerGroupScalarFieldEnum | MixRadiusOwnerGroupScalarFieldEnum[]
  }

  /**
   * MixRadiusOwnerGroup findFirstOrThrow
   */
  export type MixRadiusOwnerGroupFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusOwnerGroup
     */
    select?: MixRadiusOwnerGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusOwnerGroup
     */
    omit?: MixRadiusOwnerGroupOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusOwnerGroup to fetch.
     */
    where?: MixRadiusOwnerGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusOwnerGroups to fetch.
     */
    orderBy?: MixRadiusOwnerGroupOrderByWithRelationInput | MixRadiusOwnerGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MixRadiusOwnerGroups.
     */
    cursor?: MixRadiusOwnerGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusOwnerGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusOwnerGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MixRadiusOwnerGroups.
     */
    distinct?: MixRadiusOwnerGroupScalarFieldEnum | MixRadiusOwnerGroupScalarFieldEnum[]
  }

  /**
   * MixRadiusOwnerGroup findMany
   */
  export type MixRadiusOwnerGroupFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusOwnerGroup
     */
    select?: MixRadiusOwnerGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusOwnerGroup
     */
    omit?: MixRadiusOwnerGroupOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusOwnerGroups to fetch.
     */
    where?: MixRadiusOwnerGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusOwnerGroups to fetch.
     */
    orderBy?: MixRadiusOwnerGroupOrderByWithRelationInput | MixRadiusOwnerGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MixRadiusOwnerGroups.
     */
    cursor?: MixRadiusOwnerGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusOwnerGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusOwnerGroups.
     */
    skip?: number
    distinct?: MixRadiusOwnerGroupScalarFieldEnum | MixRadiusOwnerGroupScalarFieldEnum[]
  }

  /**
   * MixRadiusOwnerGroup create
   */
  export type MixRadiusOwnerGroupCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusOwnerGroup
     */
    select?: MixRadiusOwnerGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusOwnerGroup
     */
    omit?: MixRadiusOwnerGroupOmit<ExtArgs> | null
    /**
     * The data needed to create a MixRadiusOwnerGroup.
     */
    data: XOR<MixRadiusOwnerGroupCreateInput, MixRadiusOwnerGroupUncheckedCreateInput>
  }

  /**
   * MixRadiusOwnerGroup createMany
   */
  export type MixRadiusOwnerGroupCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many MixRadiusOwnerGroups.
     */
    data: MixRadiusOwnerGroupCreateManyInput | MixRadiusOwnerGroupCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MixRadiusOwnerGroup createManyAndReturn
   */
  export type MixRadiusOwnerGroupCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusOwnerGroup
     */
    select?: MixRadiusOwnerGroupSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusOwnerGroup
     */
    omit?: MixRadiusOwnerGroupOmit<ExtArgs> | null
    /**
     * The data used to create many MixRadiusOwnerGroups.
     */
    data: MixRadiusOwnerGroupCreateManyInput | MixRadiusOwnerGroupCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MixRadiusOwnerGroup update
   */
  export type MixRadiusOwnerGroupUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusOwnerGroup
     */
    select?: MixRadiusOwnerGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusOwnerGroup
     */
    omit?: MixRadiusOwnerGroupOmit<ExtArgs> | null
    /**
     * The data needed to update a MixRadiusOwnerGroup.
     */
    data: XOR<MixRadiusOwnerGroupUpdateInput, MixRadiusOwnerGroupUncheckedUpdateInput>
    /**
     * Choose, which MixRadiusOwnerGroup to update.
     */
    where: MixRadiusOwnerGroupWhereUniqueInput
  }

  /**
   * MixRadiusOwnerGroup updateMany
   */
  export type MixRadiusOwnerGroupUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update MixRadiusOwnerGroups.
     */
    data: XOR<MixRadiusOwnerGroupUpdateManyMutationInput, MixRadiusOwnerGroupUncheckedUpdateManyInput>
    /**
     * Filter which MixRadiusOwnerGroups to update
     */
    where?: MixRadiusOwnerGroupWhereInput
    /**
     * Limit how many MixRadiusOwnerGroups to update.
     */
    limit?: number
  }

  /**
   * MixRadiusOwnerGroup updateManyAndReturn
   */
  export type MixRadiusOwnerGroupUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusOwnerGroup
     */
    select?: MixRadiusOwnerGroupSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusOwnerGroup
     */
    omit?: MixRadiusOwnerGroupOmit<ExtArgs> | null
    /**
     * The data used to update MixRadiusOwnerGroups.
     */
    data: XOR<MixRadiusOwnerGroupUpdateManyMutationInput, MixRadiusOwnerGroupUncheckedUpdateManyInput>
    /**
     * Filter which MixRadiusOwnerGroups to update
     */
    where?: MixRadiusOwnerGroupWhereInput
    /**
     * Limit how many MixRadiusOwnerGroups to update.
     */
    limit?: number
  }

  /**
   * MixRadiusOwnerGroup upsert
   */
  export type MixRadiusOwnerGroupUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusOwnerGroup
     */
    select?: MixRadiusOwnerGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusOwnerGroup
     */
    omit?: MixRadiusOwnerGroupOmit<ExtArgs> | null
    /**
     * The filter to search for the MixRadiusOwnerGroup to update in case it exists.
     */
    where: MixRadiusOwnerGroupWhereUniqueInput
    /**
     * In case the MixRadiusOwnerGroup found by the `where` argument doesn't exist, create a new MixRadiusOwnerGroup with this data.
     */
    create: XOR<MixRadiusOwnerGroupCreateInput, MixRadiusOwnerGroupUncheckedCreateInput>
    /**
     * In case the MixRadiusOwnerGroup was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MixRadiusOwnerGroupUpdateInput, MixRadiusOwnerGroupUncheckedUpdateInput>
  }

  /**
   * MixRadiusOwnerGroup delete
   */
  export type MixRadiusOwnerGroupDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusOwnerGroup
     */
    select?: MixRadiusOwnerGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusOwnerGroup
     */
    omit?: MixRadiusOwnerGroupOmit<ExtArgs> | null
    /**
     * Filter which MixRadiusOwnerGroup to delete.
     */
    where: MixRadiusOwnerGroupWhereUniqueInput
  }

  /**
   * MixRadiusOwnerGroup deleteMany
   */
  export type MixRadiusOwnerGroupDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MixRadiusOwnerGroups to delete
     */
    where?: MixRadiusOwnerGroupWhereInput
    /**
     * Limit how many MixRadiusOwnerGroups to delete.
     */
    limit?: number
  }

  /**
   * MixRadiusOwnerGroup without action
   */
  export type MixRadiusOwnerGroupDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusOwnerGroup
     */
    select?: MixRadiusOwnerGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusOwnerGroup
     */
    omit?: MixRadiusOwnerGroupOmit<ExtArgs> | null
  }


  /**
   * Model MixRadiusInvestorSite
   */

  export type AggregateMixRadiusInvestorSite = {
    _count: MixRadiusInvestorSiteCountAggregateOutputType | null
    _min: MixRadiusInvestorSiteMinAggregateOutputType | null
    _max: MixRadiusInvestorSiteMaxAggregateOutputType | null
  }

  export type MixRadiusInvestorSiteMinAggregateOutputType = {
    id: string | null
    name: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MixRadiusInvestorSiteMaxAggregateOutputType = {
    id: string | null
    name: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MixRadiusInvestorSiteCountAggregateOutputType = {
    id: number
    name: number
    owners: number
    isActive: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type MixRadiusInvestorSiteMinAggregateInputType = {
    id?: true
    name?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MixRadiusInvestorSiteMaxAggregateInputType = {
    id?: true
    name?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MixRadiusInvestorSiteCountAggregateInputType = {
    id?: true
    name?: true
    owners?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type MixRadiusInvestorSiteAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MixRadiusInvestorSite to aggregate.
     */
    where?: MixRadiusInvestorSiteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusInvestorSites to fetch.
     */
    orderBy?: MixRadiusInvestorSiteOrderByWithRelationInput | MixRadiusInvestorSiteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MixRadiusInvestorSiteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusInvestorSites from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusInvestorSites.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MixRadiusInvestorSites
    **/
    _count?: true | MixRadiusInvestorSiteCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MixRadiusInvestorSiteMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MixRadiusInvestorSiteMaxAggregateInputType
  }

  export type GetMixRadiusInvestorSiteAggregateType<T extends MixRadiusInvestorSiteAggregateArgs> = {
        [P in keyof T & keyof AggregateMixRadiusInvestorSite]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMixRadiusInvestorSite[P]>
      : GetScalarType<T[P], AggregateMixRadiusInvestorSite[P]>
  }




  export type MixRadiusInvestorSiteGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MixRadiusInvestorSiteWhereInput
    orderBy?: MixRadiusInvestorSiteOrderByWithAggregationInput | MixRadiusInvestorSiteOrderByWithAggregationInput[]
    by: MixRadiusInvestorSiteScalarFieldEnum[] | MixRadiusInvestorSiteScalarFieldEnum
    having?: MixRadiusInvestorSiteScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MixRadiusInvestorSiteCountAggregateInputType | true
    _min?: MixRadiusInvestorSiteMinAggregateInputType
    _max?: MixRadiusInvestorSiteMaxAggregateInputType
  }

  export type MixRadiusInvestorSiteGroupByOutputType = {
    id: string
    name: string
    owners: string[]
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count: MixRadiusInvestorSiteCountAggregateOutputType | null
    _min: MixRadiusInvestorSiteMinAggregateOutputType | null
    _max: MixRadiusInvestorSiteMaxAggregateOutputType | null
  }

  type GetMixRadiusInvestorSiteGroupByPayload<T extends MixRadiusInvestorSiteGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MixRadiusInvestorSiteGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MixRadiusInvestorSiteGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MixRadiusInvestorSiteGroupByOutputType[P]>
            : GetScalarType<T[P], MixRadiusInvestorSiteGroupByOutputType[P]>
        }
      >
    >


  export type MixRadiusInvestorSiteSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    owners?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["mixRadiusInvestorSite"]>

  export type MixRadiusInvestorSiteSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    owners?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["mixRadiusInvestorSite"]>

  export type MixRadiusInvestorSiteSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    owners?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["mixRadiusInvestorSite"]>

  export type MixRadiusInvestorSiteSelectScalar = {
    id?: boolean
    name?: boolean
    owners?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type MixRadiusInvestorSiteOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "owners" | "isActive" | "createdAt" | "updatedAt", ExtArgs["result"]["mixRadiusInvestorSite"]>

  export type $MixRadiusInvestorSitePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "MixRadiusInvestorSite"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      owners: string[]
      isActive: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["mixRadiusInvestorSite"]>
    composites: {}
  }

  type MixRadiusInvestorSiteGetPayload<S extends boolean | null | undefined | MixRadiusInvestorSiteDefaultArgs> = $Result.GetResult<Prisma.$MixRadiusInvestorSitePayload, S>

  type MixRadiusInvestorSiteCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<MixRadiusInvestorSiteFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: MixRadiusInvestorSiteCountAggregateInputType | true
    }

  export interface MixRadiusInvestorSiteDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['MixRadiusInvestorSite'], meta: { name: 'MixRadiusInvestorSite' } }
    /**
     * Find zero or one MixRadiusInvestorSite that matches the filter.
     * @param {MixRadiusInvestorSiteFindUniqueArgs} args - Arguments to find a MixRadiusInvestorSite
     * @example
     * // Get one MixRadiusInvestorSite
     * const mixRadiusInvestorSite = await prisma.mixRadiusInvestorSite.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MixRadiusInvestorSiteFindUniqueArgs>(args: SelectSubset<T, MixRadiusInvestorSiteFindUniqueArgs<ExtArgs>>): Prisma__MixRadiusInvestorSiteClient<$Result.GetResult<Prisma.$MixRadiusInvestorSitePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one MixRadiusInvestorSite that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MixRadiusInvestorSiteFindUniqueOrThrowArgs} args - Arguments to find a MixRadiusInvestorSite
     * @example
     * // Get one MixRadiusInvestorSite
     * const mixRadiusInvestorSite = await prisma.mixRadiusInvestorSite.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MixRadiusInvestorSiteFindUniqueOrThrowArgs>(args: SelectSubset<T, MixRadiusInvestorSiteFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MixRadiusInvestorSiteClient<$Result.GetResult<Prisma.$MixRadiusInvestorSitePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MixRadiusInvestorSite that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusInvestorSiteFindFirstArgs} args - Arguments to find a MixRadiusInvestorSite
     * @example
     * // Get one MixRadiusInvestorSite
     * const mixRadiusInvestorSite = await prisma.mixRadiusInvestorSite.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MixRadiusInvestorSiteFindFirstArgs>(args?: SelectSubset<T, MixRadiusInvestorSiteFindFirstArgs<ExtArgs>>): Prisma__MixRadiusInvestorSiteClient<$Result.GetResult<Prisma.$MixRadiusInvestorSitePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MixRadiusInvestorSite that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusInvestorSiteFindFirstOrThrowArgs} args - Arguments to find a MixRadiusInvestorSite
     * @example
     * // Get one MixRadiusInvestorSite
     * const mixRadiusInvestorSite = await prisma.mixRadiusInvestorSite.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MixRadiusInvestorSiteFindFirstOrThrowArgs>(args?: SelectSubset<T, MixRadiusInvestorSiteFindFirstOrThrowArgs<ExtArgs>>): Prisma__MixRadiusInvestorSiteClient<$Result.GetResult<Prisma.$MixRadiusInvestorSitePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more MixRadiusInvestorSites that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusInvestorSiteFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MixRadiusInvestorSites
     * const mixRadiusInvestorSites = await prisma.mixRadiusInvestorSite.findMany()
     * 
     * // Get first 10 MixRadiusInvestorSites
     * const mixRadiusInvestorSites = await prisma.mixRadiusInvestorSite.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const mixRadiusInvestorSiteWithIdOnly = await prisma.mixRadiusInvestorSite.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MixRadiusInvestorSiteFindManyArgs>(args?: SelectSubset<T, MixRadiusInvestorSiteFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MixRadiusInvestorSitePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a MixRadiusInvestorSite.
     * @param {MixRadiusInvestorSiteCreateArgs} args - Arguments to create a MixRadiusInvestorSite.
     * @example
     * // Create one MixRadiusInvestorSite
     * const MixRadiusInvestorSite = await prisma.mixRadiusInvestorSite.create({
     *   data: {
     *     // ... data to create a MixRadiusInvestorSite
     *   }
     * })
     * 
     */
    create<T extends MixRadiusInvestorSiteCreateArgs>(args: SelectSubset<T, MixRadiusInvestorSiteCreateArgs<ExtArgs>>): Prisma__MixRadiusInvestorSiteClient<$Result.GetResult<Prisma.$MixRadiusInvestorSitePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many MixRadiusInvestorSites.
     * @param {MixRadiusInvestorSiteCreateManyArgs} args - Arguments to create many MixRadiusInvestorSites.
     * @example
     * // Create many MixRadiusInvestorSites
     * const mixRadiusInvestorSite = await prisma.mixRadiusInvestorSite.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MixRadiusInvestorSiteCreateManyArgs>(args?: SelectSubset<T, MixRadiusInvestorSiteCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many MixRadiusInvestorSites and returns the data saved in the database.
     * @param {MixRadiusInvestorSiteCreateManyAndReturnArgs} args - Arguments to create many MixRadiusInvestorSites.
     * @example
     * // Create many MixRadiusInvestorSites
     * const mixRadiusInvestorSite = await prisma.mixRadiusInvestorSite.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many MixRadiusInvestorSites and only return the `id`
     * const mixRadiusInvestorSiteWithIdOnly = await prisma.mixRadiusInvestorSite.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MixRadiusInvestorSiteCreateManyAndReturnArgs>(args?: SelectSubset<T, MixRadiusInvestorSiteCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MixRadiusInvestorSitePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a MixRadiusInvestorSite.
     * @param {MixRadiusInvestorSiteDeleteArgs} args - Arguments to delete one MixRadiusInvestorSite.
     * @example
     * // Delete one MixRadiusInvestorSite
     * const MixRadiusInvestorSite = await prisma.mixRadiusInvestorSite.delete({
     *   where: {
     *     // ... filter to delete one MixRadiusInvestorSite
     *   }
     * })
     * 
     */
    delete<T extends MixRadiusInvestorSiteDeleteArgs>(args: SelectSubset<T, MixRadiusInvestorSiteDeleteArgs<ExtArgs>>): Prisma__MixRadiusInvestorSiteClient<$Result.GetResult<Prisma.$MixRadiusInvestorSitePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one MixRadiusInvestorSite.
     * @param {MixRadiusInvestorSiteUpdateArgs} args - Arguments to update one MixRadiusInvestorSite.
     * @example
     * // Update one MixRadiusInvestorSite
     * const mixRadiusInvestorSite = await prisma.mixRadiusInvestorSite.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MixRadiusInvestorSiteUpdateArgs>(args: SelectSubset<T, MixRadiusInvestorSiteUpdateArgs<ExtArgs>>): Prisma__MixRadiusInvestorSiteClient<$Result.GetResult<Prisma.$MixRadiusInvestorSitePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more MixRadiusInvestorSites.
     * @param {MixRadiusInvestorSiteDeleteManyArgs} args - Arguments to filter MixRadiusInvestorSites to delete.
     * @example
     * // Delete a few MixRadiusInvestorSites
     * const { count } = await prisma.mixRadiusInvestorSite.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MixRadiusInvestorSiteDeleteManyArgs>(args?: SelectSubset<T, MixRadiusInvestorSiteDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MixRadiusInvestorSites.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusInvestorSiteUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MixRadiusInvestorSites
     * const mixRadiusInvestorSite = await prisma.mixRadiusInvestorSite.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MixRadiusInvestorSiteUpdateManyArgs>(args: SelectSubset<T, MixRadiusInvestorSiteUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MixRadiusInvestorSites and returns the data updated in the database.
     * @param {MixRadiusInvestorSiteUpdateManyAndReturnArgs} args - Arguments to update many MixRadiusInvestorSites.
     * @example
     * // Update many MixRadiusInvestorSites
     * const mixRadiusInvestorSite = await prisma.mixRadiusInvestorSite.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more MixRadiusInvestorSites and only return the `id`
     * const mixRadiusInvestorSiteWithIdOnly = await prisma.mixRadiusInvestorSite.updateManyAndReturn({
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
    updateManyAndReturn<T extends MixRadiusInvestorSiteUpdateManyAndReturnArgs>(args: SelectSubset<T, MixRadiusInvestorSiteUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MixRadiusInvestorSitePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one MixRadiusInvestorSite.
     * @param {MixRadiusInvestorSiteUpsertArgs} args - Arguments to update or create a MixRadiusInvestorSite.
     * @example
     * // Update or create a MixRadiusInvestorSite
     * const mixRadiusInvestorSite = await prisma.mixRadiusInvestorSite.upsert({
     *   create: {
     *     // ... data to create a MixRadiusInvestorSite
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MixRadiusInvestorSite we want to update
     *   }
     * })
     */
    upsert<T extends MixRadiusInvestorSiteUpsertArgs>(args: SelectSubset<T, MixRadiusInvestorSiteUpsertArgs<ExtArgs>>): Prisma__MixRadiusInvestorSiteClient<$Result.GetResult<Prisma.$MixRadiusInvestorSitePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of MixRadiusInvestorSites.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusInvestorSiteCountArgs} args - Arguments to filter MixRadiusInvestorSites to count.
     * @example
     * // Count the number of MixRadiusInvestorSites
     * const count = await prisma.mixRadiusInvestorSite.count({
     *   where: {
     *     // ... the filter for the MixRadiusInvestorSites we want to count
     *   }
     * })
    **/
    count<T extends MixRadiusInvestorSiteCountArgs>(
      args?: Subset<T, MixRadiusInvestorSiteCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MixRadiusInvestorSiteCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MixRadiusInvestorSite.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusInvestorSiteAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends MixRadiusInvestorSiteAggregateArgs>(args: Subset<T, MixRadiusInvestorSiteAggregateArgs>): Prisma.PrismaPromise<GetMixRadiusInvestorSiteAggregateType<T>>

    /**
     * Group by MixRadiusInvestorSite.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusInvestorSiteGroupByArgs} args - Group by arguments.
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
      T extends MixRadiusInvestorSiteGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MixRadiusInvestorSiteGroupByArgs['orderBy'] }
        : { orderBy?: MixRadiusInvestorSiteGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
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
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MixRadiusInvestorSiteGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMixRadiusInvestorSiteGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the MixRadiusInvestorSite model
   */
  readonly fields: MixRadiusInvestorSiteFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MixRadiusInvestorSite.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MixRadiusInvestorSiteClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the MixRadiusInvestorSite model
   */
  interface MixRadiusInvestorSiteFieldRefs {
    readonly id: FieldRef<"MixRadiusInvestorSite", 'String'>
    readonly name: FieldRef<"MixRadiusInvestorSite", 'String'>
    readonly owners: FieldRef<"MixRadiusInvestorSite", 'String[]'>
    readonly isActive: FieldRef<"MixRadiusInvestorSite", 'Boolean'>
    readonly createdAt: FieldRef<"MixRadiusInvestorSite", 'DateTime'>
    readonly updatedAt: FieldRef<"MixRadiusInvestorSite", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * MixRadiusInvestorSite findUnique
   */
  export type MixRadiusInvestorSiteFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvestorSite
     */
    select?: MixRadiusInvestorSiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvestorSite
     */
    omit?: MixRadiusInvestorSiteOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusInvestorSite to fetch.
     */
    where: MixRadiusInvestorSiteWhereUniqueInput
  }

  /**
   * MixRadiusInvestorSite findUniqueOrThrow
   */
  export type MixRadiusInvestorSiteFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvestorSite
     */
    select?: MixRadiusInvestorSiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvestorSite
     */
    omit?: MixRadiusInvestorSiteOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusInvestorSite to fetch.
     */
    where: MixRadiusInvestorSiteWhereUniqueInput
  }

  /**
   * MixRadiusInvestorSite findFirst
   */
  export type MixRadiusInvestorSiteFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvestorSite
     */
    select?: MixRadiusInvestorSiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvestorSite
     */
    omit?: MixRadiusInvestorSiteOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusInvestorSite to fetch.
     */
    where?: MixRadiusInvestorSiteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusInvestorSites to fetch.
     */
    orderBy?: MixRadiusInvestorSiteOrderByWithRelationInput | MixRadiusInvestorSiteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MixRadiusInvestorSites.
     */
    cursor?: MixRadiusInvestorSiteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusInvestorSites from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusInvestorSites.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MixRadiusInvestorSites.
     */
    distinct?: MixRadiusInvestorSiteScalarFieldEnum | MixRadiusInvestorSiteScalarFieldEnum[]
  }

  /**
   * MixRadiusInvestorSite findFirstOrThrow
   */
  export type MixRadiusInvestorSiteFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvestorSite
     */
    select?: MixRadiusInvestorSiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvestorSite
     */
    omit?: MixRadiusInvestorSiteOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusInvestorSite to fetch.
     */
    where?: MixRadiusInvestorSiteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusInvestorSites to fetch.
     */
    orderBy?: MixRadiusInvestorSiteOrderByWithRelationInput | MixRadiusInvestorSiteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MixRadiusInvestorSites.
     */
    cursor?: MixRadiusInvestorSiteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusInvestorSites from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusInvestorSites.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MixRadiusInvestorSites.
     */
    distinct?: MixRadiusInvestorSiteScalarFieldEnum | MixRadiusInvestorSiteScalarFieldEnum[]
  }

  /**
   * MixRadiusInvestorSite findMany
   */
  export type MixRadiusInvestorSiteFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvestorSite
     */
    select?: MixRadiusInvestorSiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvestorSite
     */
    omit?: MixRadiusInvestorSiteOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusInvestorSites to fetch.
     */
    where?: MixRadiusInvestorSiteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusInvestorSites to fetch.
     */
    orderBy?: MixRadiusInvestorSiteOrderByWithRelationInput | MixRadiusInvestorSiteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MixRadiusInvestorSites.
     */
    cursor?: MixRadiusInvestorSiteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusInvestorSites from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusInvestorSites.
     */
    skip?: number
    distinct?: MixRadiusInvestorSiteScalarFieldEnum | MixRadiusInvestorSiteScalarFieldEnum[]
  }

  /**
   * MixRadiusInvestorSite create
   */
  export type MixRadiusInvestorSiteCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvestorSite
     */
    select?: MixRadiusInvestorSiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvestorSite
     */
    omit?: MixRadiusInvestorSiteOmit<ExtArgs> | null
    /**
     * The data needed to create a MixRadiusInvestorSite.
     */
    data: XOR<MixRadiusInvestorSiteCreateInput, MixRadiusInvestorSiteUncheckedCreateInput>
  }

  /**
   * MixRadiusInvestorSite createMany
   */
  export type MixRadiusInvestorSiteCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many MixRadiusInvestorSites.
     */
    data: MixRadiusInvestorSiteCreateManyInput | MixRadiusInvestorSiteCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MixRadiusInvestorSite createManyAndReturn
   */
  export type MixRadiusInvestorSiteCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvestorSite
     */
    select?: MixRadiusInvestorSiteSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvestorSite
     */
    omit?: MixRadiusInvestorSiteOmit<ExtArgs> | null
    /**
     * The data used to create many MixRadiusInvestorSites.
     */
    data: MixRadiusInvestorSiteCreateManyInput | MixRadiusInvestorSiteCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MixRadiusInvestorSite update
   */
  export type MixRadiusInvestorSiteUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvestorSite
     */
    select?: MixRadiusInvestorSiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvestorSite
     */
    omit?: MixRadiusInvestorSiteOmit<ExtArgs> | null
    /**
     * The data needed to update a MixRadiusInvestorSite.
     */
    data: XOR<MixRadiusInvestorSiteUpdateInput, MixRadiusInvestorSiteUncheckedUpdateInput>
    /**
     * Choose, which MixRadiusInvestorSite to update.
     */
    where: MixRadiusInvestorSiteWhereUniqueInput
  }

  /**
   * MixRadiusInvestorSite updateMany
   */
  export type MixRadiusInvestorSiteUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update MixRadiusInvestorSites.
     */
    data: XOR<MixRadiusInvestorSiteUpdateManyMutationInput, MixRadiusInvestorSiteUncheckedUpdateManyInput>
    /**
     * Filter which MixRadiusInvestorSites to update
     */
    where?: MixRadiusInvestorSiteWhereInput
    /**
     * Limit how many MixRadiusInvestorSites to update.
     */
    limit?: number
  }

  /**
   * MixRadiusInvestorSite updateManyAndReturn
   */
  export type MixRadiusInvestorSiteUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvestorSite
     */
    select?: MixRadiusInvestorSiteSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvestorSite
     */
    omit?: MixRadiusInvestorSiteOmit<ExtArgs> | null
    /**
     * The data used to update MixRadiusInvestorSites.
     */
    data: XOR<MixRadiusInvestorSiteUpdateManyMutationInput, MixRadiusInvestorSiteUncheckedUpdateManyInput>
    /**
     * Filter which MixRadiusInvestorSites to update
     */
    where?: MixRadiusInvestorSiteWhereInput
    /**
     * Limit how many MixRadiusInvestorSites to update.
     */
    limit?: number
  }

  /**
   * MixRadiusInvestorSite upsert
   */
  export type MixRadiusInvestorSiteUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvestorSite
     */
    select?: MixRadiusInvestorSiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvestorSite
     */
    omit?: MixRadiusInvestorSiteOmit<ExtArgs> | null
    /**
     * The filter to search for the MixRadiusInvestorSite to update in case it exists.
     */
    where: MixRadiusInvestorSiteWhereUniqueInput
    /**
     * In case the MixRadiusInvestorSite found by the `where` argument doesn't exist, create a new MixRadiusInvestorSite with this data.
     */
    create: XOR<MixRadiusInvestorSiteCreateInput, MixRadiusInvestorSiteUncheckedCreateInput>
    /**
     * In case the MixRadiusInvestorSite was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MixRadiusInvestorSiteUpdateInput, MixRadiusInvestorSiteUncheckedUpdateInput>
  }

  /**
   * MixRadiusInvestorSite delete
   */
  export type MixRadiusInvestorSiteDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvestorSite
     */
    select?: MixRadiusInvestorSiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvestorSite
     */
    omit?: MixRadiusInvestorSiteOmit<ExtArgs> | null
    /**
     * Filter which MixRadiusInvestorSite to delete.
     */
    where: MixRadiusInvestorSiteWhereUniqueInput
  }

  /**
   * MixRadiusInvestorSite deleteMany
   */
  export type MixRadiusInvestorSiteDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MixRadiusInvestorSites to delete
     */
    where?: MixRadiusInvestorSiteWhereInput
    /**
     * Limit how many MixRadiusInvestorSites to delete.
     */
    limit?: number
  }

  /**
   * MixRadiusInvestorSite without action
   */
  export type MixRadiusInvestorSiteDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusInvestorSite
     */
    select?: MixRadiusInvestorSiteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusInvestorSite
     */
    omit?: MixRadiusInvestorSiteOmit<ExtArgs> | null
  }


  /**
   * Model MixRadiusConfig
   */

  export type AggregateMixRadiusConfig = {
    _count: MixRadiusConfigCountAggregateOutputType | null
    _min: MixRadiusConfigMinAggregateOutputType | null
    _max: MixRadiusConfigMaxAggregateOutputType | null
  }

  export type MixRadiusConfigMinAggregateOutputType = {
    id: string | null
    name: string | null
    apiUrl: string | null
    username: string | null
    password: string | null
    apiKey: string | null
    isDefault: boolean | null
    lastSyncedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MixRadiusConfigMaxAggregateOutputType = {
    id: string | null
    name: string | null
    apiUrl: string | null
    username: string | null
    password: string | null
    apiKey: string | null
    isDefault: boolean | null
    lastSyncedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MixRadiusConfigCountAggregateOutputType = {
    id: number
    name: number
    apiUrl: number
    username: number
    password: number
    apiKey: number
    isDefault: number
    lastSyncedAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type MixRadiusConfigMinAggregateInputType = {
    id?: true
    name?: true
    apiUrl?: true
    username?: true
    password?: true
    apiKey?: true
    isDefault?: true
    lastSyncedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MixRadiusConfigMaxAggregateInputType = {
    id?: true
    name?: true
    apiUrl?: true
    username?: true
    password?: true
    apiKey?: true
    isDefault?: true
    lastSyncedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MixRadiusConfigCountAggregateInputType = {
    id?: true
    name?: true
    apiUrl?: true
    username?: true
    password?: true
    apiKey?: true
    isDefault?: true
    lastSyncedAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type MixRadiusConfigAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MixRadiusConfig to aggregate.
     */
    where?: MixRadiusConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusConfigs to fetch.
     */
    orderBy?: MixRadiusConfigOrderByWithRelationInput | MixRadiusConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MixRadiusConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusConfigs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MixRadiusConfigs
    **/
    _count?: true | MixRadiusConfigCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MixRadiusConfigMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MixRadiusConfigMaxAggregateInputType
  }

  export type GetMixRadiusConfigAggregateType<T extends MixRadiusConfigAggregateArgs> = {
        [P in keyof T & keyof AggregateMixRadiusConfig]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMixRadiusConfig[P]>
      : GetScalarType<T[P], AggregateMixRadiusConfig[P]>
  }




  export type MixRadiusConfigGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MixRadiusConfigWhereInput
    orderBy?: MixRadiusConfigOrderByWithAggregationInput | MixRadiusConfigOrderByWithAggregationInput[]
    by: MixRadiusConfigScalarFieldEnum[] | MixRadiusConfigScalarFieldEnum
    having?: MixRadiusConfigScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MixRadiusConfigCountAggregateInputType | true
    _min?: MixRadiusConfigMinAggregateInputType
    _max?: MixRadiusConfigMaxAggregateInputType
  }

  export type MixRadiusConfigGroupByOutputType = {
    id: string
    name: string
    apiUrl: string
    username: string
    password: string
    apiKey: string
    isDefault: boolean
    lastSyncedAt: Date | null
    createdAt: Date
    updatedAt: Date
    _count: MixRadiusConfigCountAggregateOutputType | null
    _min: MixRadiusConfigMinAggregateOutputType | null
    _max: MixRadiusConfigMaxAggregateOutputType | null
  }

  type GetMixRadiusConfigGroupByPayload<T extends MixRadiusConfigGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MixRadiusConfigGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MixRadiusConfigGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MixRadiusConfigGroupByOutputType[P]>
            : GetScalarType<T[P], MixRadiusConfigGroupByOutputType[P]>
        }
      >
    >


  export type MixRadiusConfigSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    apiUrl?: boolean
    username?: boolean
    password?: boolean
    apiKey?: boolean
    isDefault?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["mixRadiusConfig"]>

  export type MixRadiusConfigSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    apiUrl?: boolean
    username?: boolean
    password?: boolean
    apiKey?: boolean
    isDefault?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["mixRadiusConfig"]>

  export type MixRadiusConfigSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    apiUrl?: boolean
    username?: boolean
    password?: boolean
    apiKey?: boolean
    isDefault?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["mixRadiusConfig"]>

  export type MixRadiusConfigSelectScalar = {
    id?: boolean
    name?: boolean
    apiUrl?: boolean
    username?: boolean
    password?: boolean
    apiKey?: boolean
    isDefault?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type MixRadiusConfigOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "apiUrl" | "username" | "password" | "apiKey" | "isDefault" | "lastSyncedAt" | "createdAt" | "updatedAt", ExtArgs["result"]["mixRadiusConfig"]>

  export type $MixRadiusConfigPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "MixRadiusConfig"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      apiUrl: string
      username: string
      password: string
      apiKey: string
      isDefault: boolean
      lastSyncedAt: Date | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["mixRadiusConfig"]>
    composites: {}
  }

  type MixRadiusConfigGetPayload<S extends boolean | null | undefined | MixRadiusConfigDefaultArgs> = $Result.GetResult<Prisma.$MixRadiusConfigPayload, S>

  type MixRadiusConfigCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<MixRadiusConfigFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: MixRadiusConfigCountAggregateInputType | true
    }

  export interface MixRadiusConfigDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['MixRadiusConfig'], meta: { name: 'MixRadiusConfig' } }
    /**
     * Find zero or one MixRadiusConfig that matches the filter.
     * @param {MixRadiusConfigFindUniqueArgs} args - Arguments to find a MixRadiusConfig
     * @example
     * // Get one MixRadiusConfig
     * const mixRadiusConfig = await prisma.mixRadiusConfig.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MixRadiusConfigFindUniqueArgs>(args: SelectSubset<T, MixRadiusConfigFindUniqueArgs<ExtArgs>>): Prisma__MixRadiusConfigClient<$Result.GetResult<Prisma.$MixRadiusConfigPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one MixRadiusConfig that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MixRadiusConfigFindUniqueOrThrowArgs} args - Arguments to find a MixRadiusConfig
     * @example
     * // Get one MixRadiusConfig
     * const mixRadiusConfig = await prisma.mixRadiusConfig.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MixRadiusConfigFindUniqueOrThrowArgs>(args: SelectSubset<T, MixRadiusConfigFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MixRadiusConfigClient<$Result.GetResult<Prisma.$MixRadiusConfigPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MixRadiusConfig that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusConfigFindFirstArgs} args - Arguments to find a MixRadiusConfig
     * @example
     * // Get one MixRadiusConfig
     * const mixRadiusConfig = await prisma.mixRadiusConfig.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MixRadiusConfigFindFirstArgs>(args?: SelectSubset<T, MixRadiusConfigFindFirstArgs<ExtArgs>>): Prisma__MixRadiusConfigClient<$Result.GetResult<Prisma.$MixRadiusConfigPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MixRadiusConfig that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusConfigFindFirstOrThrowArgs} args - Arguments to find a MixRadiusConfig
     * @example
     * // Get one MixRadiusConfig
     * const mixRadiusConfig = await prisma.mixRadiusConfig.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MixRadiusConfigFindFirstOrThrowArgs>(args?: SelectSubset<T, MixRadiusConfigFindFirstOrThrowArgs<ExtArgs>>): Prisma__MixRadiusConfigClient<$Result.GetResult<Prisma.$MixRadiusConfigPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more MixRadiusConfigs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusConfigFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MixRadiusConfigs
     * const mixRadiusConfigs = await prisma.mixRadiusConfig.findMany()
     * 
     * // Get first 10 MixRadiusConfigs
     * const mixRadiusConfigs = await prisma.mixRadiusConfig.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const mixRadiusConfigWithIdOnly = await prisma.mixRadiusConfig.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MixRadiusConfigFindManyArgs>(args?: SelectSubset<T, MixRadiusConfigFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MixRadiusConfigPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a MixRadiusConfig.
     * @param {MixRadiusConfigCreateArgs} args - Arguments to create a MixRadiusConfig.
     * @example
     * // Create one MixRadiusConfig
     * const MixRadiusConfig = await prisma.mixRadiusConfig.create({
     *   data: {
     *     // ... data to create a MixRadiusConfig
     *   }
     * })
     * 
     */
    create<T extends MixRadiusConfigCreateArgs>(args: SelectSubset<T, MixRadiusConfigCreateArgs<ExtArgs>>): Prisma__MixRadiusConfigClient<$Result.GetResult<Prisma.$MixRadiusConfigPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many MixRadiusConfigs.
     * @param {MixRadiusConfigCreateManyArgs} args - Arguments to create many MixRadiusConfigs.
     * @example
     * // Create many MixRadiusConfigs
     * const mixRadiusConfig = await prisma.mixRadiusConfig.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MixRadiusConfigCreateManyArgs>(args?: SelectSubset<T, MixRadiusConfigCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many MixRadiusConfigs and returns the data saved in the database.
     * @param {MixRadiusConfigCreateManyAndReturnArgs} args - Arguments to create many MixRadiusConfigs.
     * @example
     * // Create many MixRadiusConfigs
     * const mixRadiusConfig = await prisma.mixRadiusConfig.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many MixRadiusConfigs and only return the `id`
     * const mixRadiusConfigWithIdOnly = await prisma.mixRadiusConfig.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MixRadiusConfigCreateManyAndReturnArgs>(args?: SelectSubset<T, MixRadiusConfigCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MixRadiusConfigPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a MixRadiusConfig.
     * @param {MixRadiusConfigDeleteArgs} args - Arguments to delete one MixRadiusConfig.
     * @example
     * // Delete one MixRadiusConfig
     * const MixRadiusConfig = await prisma.mixRadiusConfig.delete({
     *   where: {
     *     // ... filter to delete one MixRadiusConfig
     *   }
     * })
     * 
     */
    delete<T extends MixRadiusConfigDeleteArgs>(args: SelectSubset<T, MixRadiusConfigDeleteArgs<ExtArgs>>): Prisma__MixRadiusConfigClient<$Result.GetResult<Prisma.$MixRadiusConfigPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one MixRadiusConfig.
     * @param {MixRadiusConfigUpdateArgs} args - Arguments to update one MixRadiusConfig.
     * @example
     * // Update one MixRadiusConfig
     * const mixRadiusConfig = await prisma.mixRadiusConfig.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MixRadiusConfigUpdateArgs>(args: SelectSubset<T, MixRadiusConfigUpdateArgs<ExtArgs>>): Prisma__MixRadiusConfigClient<$Result.GetResult<Prisma.$MixRadiusConfigPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more MixRadiusConfigs.
     * @param {MixRadiusConfigDeleteManyArgs} args - Arguments to filter MixRadiusConfigs to delete.
     * @example
     * // Delete a few MixRadiusConfigs
     * const { count } = await prisma.mixRadiusConfig.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MixRadiusConfigDeleteManyArgs>(args?: SelectSubset<T, MixRadiusConfigDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MixRadiusConfigs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusConfigUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MixRadiusConfigs
     * const mixRadiusConfig = await prisma.mixRadiusConfig.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MixRadiusConfigUpdateManyArgs>(args: SelectSubset<T, MixRadiusConfigUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MixRadiusConfigs and returns the data updated in the database.
     * @param {MixRadiusConfigUpdateManyAndReturnArgs} args - Arguments to update many MixRadiusConfigs.
     * @example
     * // Update many MixRadiusConfigs
     * const mixRadiusConfig = await prisma.mixRadiusConfig.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more MixRadiusConfigs and only return the `id`
     * const mixRadiusConfigWithIdOnly = await prisma.mixRadiusConfig.updateManyAndReturn({
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
    updateManyAndReturn<T extends MixRadiusConfigUpdateManyAndReturnArgs>(args: SelectSubset<T, MixRadiusConfigUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MixRadiusConfigPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one MixRadiusConfig.
     * @param {MixRadiusConfigUpsertArgs} args - Arguments to update or create a MixRadiusConfig.
     * @example
     * // Update or create a MixRadiusConfig
     * const mixRadiusConfig = await prisma.mixRadiusConfig.upsert({
     *   create: {
     *     // ... data to create a MixRadiusConfig
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MixRadiusConfig we want to update
     *   }
     * })
     */
    upsert<T extends MixRadiusConfigUpsertArgs>(args: SelectSubset<T, MixRadiusConfigUpsertArgs<ExtArgs>>): Prisma__MixRadiusConfigClient<$Result.GetResult<Prisma.$MixRadiusConfigPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of MixRadiusConfigs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusConfigCountArgs} args - Arguments to filter MixRadiusConfigs to count.
     * @example
     * // Count the number of MixRadiusConfigs
     * const count = await prisma.mixRadiusConfig.count({
     *   where: {
     *     // ... the filter for the MixRadiusConfigs we want to count
     *   }
     * })
    **/
    count<T extends MixRadiusConfigCountArgs>(
      args?: Subset<T, MixRadiusConfigCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MixRadiusConfigCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MixRadiusConfig.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusConfigAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends MixRadiusConfigAggregateArgs>(args: Subset<T, MixRadiusConfigAggregateArgs>): Prisma.PrismaPromise<GetMixRadiusConfigAggregateType<T>>

    /**
     * Group by MixRadiusConfig.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MixRadiusConfigGroupByArgs} args - Group by arguments.
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
      T extends MixRadiusConfigGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MixRadiusConfigGroupByArgs['orderBy'] }
        : { orderBy?: MixRadiusConfigGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
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
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MixRadiusConfigGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMixRadiusConfigGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the MixRadiusConfig model
   */
  readonly fields: MixRadiusConfigFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MixRadiusConfig.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MixRadiusConfigClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the MixRadiusConfig model
   */
  interface MixRadiusConfigFieldRefs {
    readonly id: FieldRef<"MixRadiusConfig", 'String'>
    readonly name: FieldRef<"MixRadiusConfig", 'String'>
    readonly apiUrl: FieldRef<"MixRadiusConfig", 'String'>
    readonly username: FieldRef<"MixRadiusConfig", 'String'>
    readonly password: FieldRef<"MixRadiusConfig", 'String'>
    readonly apiKey: FieldRef<"MixRadiusConfig", 'String'>
    readonly isDefault: FieldRef<"MixRadiusConfig", 'Boolean'>
    readonly lastSyncedAt: FieldRef<"MixRadiusConfig", 'DateTime'>
    readonly createdAt: FieldRef<"MixRadiusConfig", 'DateTime'>
    readonly updatedAt: FieldRef<"MixRadiusConfig", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * MixRadiusConfig findUnique
   */
  export type MixRadiusConfigFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusConfig
     */
    select?: MixRadiusConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusConfig
     */
    omit?: MixRadiusConfigOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusConfig to fetch.
     */
    where: MixRadiusConfigWhereUniqueInput
  }

  /**
   * MixRadiusConfig findUniqueOrThrow
   */
  export type MixRadiusConfigFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusConfig
     */
    select?: MixRadiusConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusConfig
     */
    omit?: MixRadiusConfigOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusConfig to fetch.
     */
    where: MixRadiusConfigWhereUniqueInput
  }

  /**
   * MixRadiusConfig findFirst
   */
  export type MixRadiusConfigFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusConfig
     */
    select?: MixRadiusConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusConfig
     */
    omit?: MixRadiusConfigOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusConfig to fetch.
     */
    where?: MixRadiusConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusConfigs to fetch.
     */
    orderBy?: MixRadiusConfigOrderByWithRelationInput | MixRadiusConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MixRadiusConfigs.
     */
    cursor?: MixRadiusConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusConfigs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MixRadiusConfigs.
     */
    distinct?: MixRadiusConfigScalarFieldEnum | MixRadiusConfigScalarFieldEnum[]
  }

  /**
   * MixRadiusConfig findFirstOrThrow
   */
  export type MixRadiusConfigFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusConfig
     */
    select?: MixRadiusConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusConfig
     */
    omit?: MixRadiusConfigOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusConfig to fetch.
     */
    where?: MixRadiusConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusConfigs to fetch.
     */
    orderBy?: MixRadiusConfigOrderByWithRelationInput | MixRadiusConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MixRadiusConfigs.
     */
    cursor?: MixRadiusConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusConfigs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MixRadiusConfigs.
     */
    distinct?: MixRadiusConfigScalarFieldEnum | MixRadiusConfigScalarFieldEnum[]
  }

  /**
   * MixRadiusConfig findMany
   */
  export type MixRadiusConfigFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusConfig
     */
    select?: MixRadiusConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusConfig
     */
    omit?: MixRadiusConfigOmit<ExtArgs> | null
    /**
     * Filter, which MixRadiusConfigs to fetch.
     */
    where?: MixRadiusConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MixRadiusConfigs to fetch.
     */
    orderBy?: MixRadiusConfigOrderByWithRelationInput | MixRadiusConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MixRadiusConfigs.
     */
    cursor?: MixRadiusConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MixRadiusConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MixRadiusConfigs.
     */
    skip?: number
    distinct?: MixRadiusConfigScalarFieldEnum | MixRadiusConfigScalarFieldEnum[]
  }

  /**
   * MixRadiusConfig create
   */
  export type MixRadiusConfigCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusConfig
     */
    select?: MixRadiusConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusConfig
     */
    omit?: MixRadiusConfigOmit<ExtArgs> | null
    /**
     * The data needed to create a MixRadiusConfig.
     */
    data: XOR<MixRadiusConfigCreateInput, MixRadiusConfigUncheckedCreateInput>
  }

  /**
   * MixRadiusConfig createMany
   */
  export type MixRadiusConfigCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many MixRadiusConfigs.
     */
    data: MixRadiusConfigCreateManyInput | MixRadiusConfigCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MixRadiusConfig createManyAndReturn
   */
  export type MixRadiusConfigCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusConfig
     */
    select?: MixRadiusConfigSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusConfig
     */
    omit?: MixRadiusConfigOmit<ExtArgs> | null
    /**
     * The data used to create many MixRadiusConfigs.
     */
    data: MixRadiusConfigCreateManyInput | MixRadiusConfigCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MixRadiusConfig update
   */
  export type MixRadiusConfigUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusConfig
     */
    select?: MixRadiusConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusConfig
     */
    omit?: MixRadiusConfigOmit<ExtArgs> | null
    /**
     * The data needed to update a MixRadiusConfig.
     */
    data: XOR<MixRadiusConfigUpdateInput, MixRadiusConfigUncheckedUpdateInput>
    /**
     * Choose, which MixRadiusConfig to update.
     */
    where: MixRadiusConfigWhereUniqueInput
  }

  /**
   * MixRadiusConfig updateMany
   */
  export type MixRadiusConfigUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update MixRadiusConfigs.
     */
    data: XOR<MixRadiusConfigUpdateManyMutationInput, MixRadiusConfigUncheckedUpdateManyInput>
    /**
     * Filter which MixRadiusConfigs to update
     */
    where?: MixRadiusConfigWhereInput
    /**
     * Limit how many MixRadiusConfigs to update.
     */
    limit?: number
  }

  /**
   * MixRadiusConfig updateManyAndReturn
   */
  export type MixRadiusConfigUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusConfig
     */
    select?: MixRadiusConfigSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusConfig
     */
    omit?: MixRadiusConfigOmit<ExtArgs> | null
    /**
     * The data used to update MixRadiusConfigs.
     */
    data: XOR<MixRadiusConfigUpdateManyMutationInput, MixRadiusConfigUncheckedUpdateManyInput>
    /**
     * Filter which MixRadiusConfigs to update
     */
    where?: MixRadiusConfigWhereInput
    /**
     * Limit how many MixRadiusConfigs to update.
     */
    limit?: number
  }

  /**
   * MixRadiusConfig upsert
   */
  export type MixRadiusConfigUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusConfig
     */
    select?: MixRadiusConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusConfig
     */
    omit?: MixRadiusConfigOmit<ExtArgs> | null
    /**
     * The filter to search for the MixRadiusConfig to update in case it exists.
     */
    where: MixRadiusConfigWhereUniqueInput
    /**
     * In case the MixRadiusConfig found by the `where` argument doesn't exist, create a new MixRadiusConfig with this data.
     */
    create: XOR<MixRadiusConfigCreateInput, MixRadiusConfigUncheckedCreateInput>
    /**
     * In case the MixRadiusConfig was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MixRadiusConfigUpdateInput, MixRadiusConfigUncheckedUpdateInput>
  }

  /**
   * MixRadiusConfig delete
   */
  export type MixRadiusConfigDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusConfig
     */
    select?: MixRadiusConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusConfig
     */
    omit?: MixRadiusConfigOmit<ExtArgs> | null
    /**
     * Filter which MixRadiusConfig to delete.
     */
    where: MixRadiusConfigWhereUniqueInput
  }

  /**
   * MixRadiusConfig deleteMany
   */
  export type MixRadiusConfigDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MixRadiusConfigs to delete
     */
    where?: MixRadiusConfigWhereInput
    /**
     * Limit how many MixRadiusConfigs to delete.
     */
    limit?: number
  }

  /**
   * MixRadiusConfig without action
   */
  export type MixRadiusConfigDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MixRadiusConfig
     */
    select?: MixRadiusConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MixRadiusConfig
     */
    omit?: MixRadiusConfigOmit<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const InvoiceScalarFieldEnum: {
    id: 'id',
    invoiceNumber: 'invoiceNumber',
    pelangganId: 'pelangganId',
    issueDate: 'issueDate',
    dueDate: 'dueDate',
    status: 'status',
    subtotal: 'subtotal',
    taxAmount: 'taxAmount',
    discountAmount: 'discountAmount',
    totalAmount: 'totalAmount',
    paidAmount: 'paidAmount',
    notes: 'notes',
    terms: 'terms',
    sentAt: 'sentAt',
    paidAt: 'paidAt',
    createdBy: 'createdBy',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    siteId: 'siteId'
  };

  export type InvoiceScalarFieldEnum = (typeof InvoiceScalarFieldEnum)[keyof typeof InvoiceScalarFieldEnum]


  export const InvoiceItemScalarFieldEnum: {
    id: 'id',
    invoiceId: 'invoiceId',
    description: 'description',
    quantity: 'quantity',
    unitPrice: 'unitPrice',
    totalPrice: 'totalPrice',
    itemType: 'itemType'
  };

  export type InvoiceItemScalarFieldEnum = (typeof InvoiceItemScalarFieldEnum)[keyof typeof InvoiceItemScalarFieldEnum]


  export const PaymentScalarFieldEnum: {
    id: 'id',
    invoiceId: 'invoiceId',
    pelangganId: 'pelangganId',
    amount: 'amount',
    paymentDate: 'paymentDate',
    paymentMethod: 'paymentMethod',
    reference: 'reference',
    notes: 'notes',
    verifiedBy: 'verifiedBy',
    verifiedAt: 'verifiedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    accountId: 'accountId',
    gatewayStatus: 'gatewayStatus',
    gatewayProvider: 'gatewayProvider',
    transactionId: 'transactionId',
    paymentUrl: 'paymentUrl',
    expiresAt: 'expiresAt',
    unmatchedMutationId: 'unmatchedMutationId',
    receiptUrl: 'receiptUrl'
  };

  export type PaymentScalarFieldEnum = (typeof PaymentScalarFieldEnum)[keyof typeof PaymentScalarFieldEnum]


  export const PaymentGatewayConfigScalarFieldEnum: {
    id: 'id',
    provider: 'provider',
    providerName: 'providerName',
    isEnabled: 'isEnabled',
    isProduction: 'isProduction',
    priority: 'priority',
    apiKey: 'apiKey',
    apiSecret: 'apiSecret',
    clientKey: 'clientKey',
    merchantId: 'merchantId',
    webhookUrl: 'webhookUrl',
    callbackUrl: 'callbackUrl',
    settings: 'settings',
    lastTestedAt: 'lastTestedAt',
    testStatus: 'testStatus',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    createdBy: 'createdBy'
  };

  export type PaymentGatewayConfigScalarFieldEnum = (typeof PaymentGatewayConfigScalarFieldEnum)[keyof typeof PaymentGatewayConfigScalarFieldEnum]


  export const UnmatchedMutationScalarFieldEnum: {
    id: 'id',
    provider: 'provider',
    transactionId: 'transactionId',
    amount: 'amount',
    description: 'description',
    type: 'type',
    date: 'date',
    bankId: 'bankId',
    rawPayload: 'rawPayload',
    status: 'status',
    resolvedAt: 'resolvedAt',
    resolvedById: 'resolvedById',
    matchedInvoiceId: 'matchedInvoiceId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UnmatchedMutationScalarFieldEnum = (typeof UnmatchedMutationScalarFieldEnum)[keyof typeof UnmatchedMutationScalarFieldEnum]


  export const TransactionScalarFieldEnum: {
    id: 'id',
    date: 'date',
    amount: 'amount',
    type: 'type',
    description: 'description',
    referenceId: 'referenceId',
    categoryId: 'categoryId',
    accountId: 'accountId',
    purchaseOrderId: 'purchaseOrderId',
    createdById: 'createdById',
    attachments: 'attachments',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type TransactionScalarFieldEnum = (typeof TransactionScalarFieldEnum)[keyof typeof TransactionScalarFieldEnum]


  export const TransactionCategoryScalarFieldEnum: {
    id: 'id',
    name: 'name',
    type: 'type',
    expenseType: 'expenseType',
    description: 'description',
    isSystem: 'isSystem',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type TransactionCategoryScalarFieldEnum = (typeof TransactionCategoryScalarFieldEnum)[keyof typeof TransactionCategoryScalarFieldEnum]


  export const MixRadiusInvoiceScalarFieldEnum: {
    id: 'id',
    invoiceNumber: 'invoiceNumber',
    mixRadiusId: 'mixRadiusId',
    username: 'username',
    fullName: 'fullName',
    ownerName: 'ownerName',
    planName: 'planName',
    amount: 'amount',
    status: 'status',
    paymentMethod: 'paymentMethod',
    issuedDate: 'issuedDate',
    dueDate: 'dueDate',
    expiredOn: 'expiredOn',
    syncedAt: 'syncedAt'
  };

  export type MixRadiusInvoiceScalarFieldEnum = (typeof MixRadiusInvoiceScalarFieldEnum)[keyof typeof MixRadiusInvoiceScalarFieldEnum]


  export const MixRadiusCustomerScalarFieldEnum: {
    id: 'id',
    mixRadiusId: 'mixRadiusId',
    username: 'username',
    fullName: 'fullName',
    address: 'address',
    phoneNumber: 'phoneNumber',
    planName: 'planName',
    status: 'status',
    ownerName: 'ownerName',
    expiredOn: 'expiredOn',
    lastSyncedAt: 'lastSyncedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type MixRadiusCustomerScalarFieldEnum = (typeof MixRadiusCustomerScalarFieldEnum)[keyof typeof MixRadiusCustomerScalarFieldEnum]


  export const MixRadiusOwnerGroupScalarFieldEnum: {
    id: 'id',
    name: 'name',
    owners: 'owners',
    siteId: 'siteId',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type MixRadiusOwnerGroupScalarFieldEnum = (typeof MixRadiusOwnerGroupScalarFieldEnum)[keyof typeof MixRadiusOwnerGroupScalarFieldEnum]


  export const MixRadiusInvestorSiteScalarFieldEnum: {
    id: 'id',
    name: 'name',
    owners: 'owners',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type MixRadiusInvestorSiteScalarFieldEnum = (typeof MixRadiusInvestorSiteScalarFieldEnum)[keyof typeof MixRadiusInvestorSiteScalarFieldEnum]


  export const MixRadiusConfigScalarFieldEnum: {
    id: 'id',
    name: 'name',
    apiUrl: 'apiUrl',
    username: 'username',
    password: 'password',
    apiKey: 'apiKey',
    isDefault: 'isDefault',
    lastSyncedAt: 'lastSyncedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type MixRadiusConfigScalarFieldEnum = (typeof MixRadiusConfigScalarFieldEnum)[keyof typeof MixRadiusConfigScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'InvoiceStatus'
   */
  export type EnumInvoiceStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'InvoiceStatus'>
    


  /**
   * Reference to a field of type 'InvoiceStatus[]'
   */
  export type ListEnumInvoiceStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'InvoiceStatus[]'>
    


  /**
   * Reference to a field of type 'BigInt'
   */
  export type BigIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BigInt'>
    


  /**
   * Reference to a field of type 'BigInt[]'
   */
  export type ListBigIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BigInt[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'ItemType'
   */
  export type EnumItemTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ItemType'>
    


  /**
   * Reference to a field of type 'ItemType[]'
   */
  export type ListEnumItemTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ItemType[]'>
    


  /**
   * Reference to a field of type 'PaymentMethod'
   */
  export type EnumPaymentMethodFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PaymentMethod'>
    


  /**
   * Reference to a field of type 'PaymentMethod[]'
   */
  export type ListEnumPaymentMethodFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PaymentMethod[]'>
    


  /**
   * Reference to a field of type 'GatewayPaymentStatus'
   */
  export type EnumGatewayPaymentStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'GatewayPaymentStatus'>
    


  /**
   * Reference to a field of type 'GatewayPaymentStatus[]'
   */
  export type ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'GatewayPaymentStatus[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'Decimal'
   */
  export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal'>
    


  /**
   * Reference to a field of type 'Decimal[]'
   */
  export type ListDecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal[]'>
    


  /**
   * Reference to a field of type 'UnmatchedStatus'
   */
  export type EnumUnmatchedStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'UnmatchedStatus'>
    


  /**
   * Reference to a field of type 'UnmatchedStatus[]'
   */
  export type ListEnumUnmatchedStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'UnmatchedStatus[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    


  /**
   * Reference to a field of type 'TransactionType'
   */
  export type EnumTransactionTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'TransactionType'>
    


  /**
   * Reference to a field of type 'TransactionType[]'
   */
  export type ListEnumTransactionTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'TransactionType[]'>
    


  /**
   * Reference to a field of type 'ExpenseType'
   */
  export type EnumExpenseTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ExpenseType'>
    


  /**
   * Reference to a field of type 'ExpenseType[]'
   */
  export type ListEnumExpenseTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ExpenseType[]'>
    
  /**
   * Deep Input Types
   */


  export type InvoiceWhereInput = {
    AND?: InvoiceWhereInput | InvoiceWhereInput[]
    OR?: InvoiceWhereInput[]
    NOT?: InvoiceWhereInput | InvoiceWhereInput[]
    id?: StringFilter<"Invoice"> | string
    invoiceNumber?: StringFilter<"Invoice"> | string
    pelangganId?: StringFilter<"Invoice"> | string
    issueDate?: DateTimeFilter<"Invoice"> | Date | string
    dueDate?: DateTimeFilter<"Invoice"> | Date | string
    status?: EnumInvoiceStatusFilter<"Invoice"> | $Enums.InvoiceStatus
    subtotal?: BigIntFilter<"Invoice"> | bigint | number
    taxAmount?: BigIntFilter<"Invoice"> | bigint | number
    discountAmount?: BigIntFilter<"Invoice"> | bigint | number
    totalAmount?: BigIntFilter<"Invoice"> | bigint | number
    paidAmount?: BigIntFilter<"Invoice"> | bigint | number
    notes?: StringNullableFilter<"Invoice"> | string | null
    terms?: StringNullableFilter<"Invoice"> | string | null
    sentAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    paidAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    createdBy?: StringNullableFilter<"Invoice"> | string | null
    createdAt?: DateTimeFilter<"Invoice"> | Date | string
    updatedAt?: DateTimeFilter<"Invoice"> | Date | string
    siteId?: StringNullableFilter<"Invoice"> | string | null
    invoiceItem?: InvoiceItemListRelationFilter
    payment?: PaymentListRelationFilter
  }

  export type InvoiceOrderByWithRelationInput = {
    id?: SortOrder
    invoiceNumber?: SortOrder
    pelangganId?: SortOrder
    issueDate?: SortOrder
    dueDate?: SortOrder
    status?: SortOrder
    subtotal?: SortOrder
    taxAmount?: SortOrder
    discountAmount?: SortOrder
    totalAmount?: SortOrder
    paidAmount?: SortOrder
    notes?: SortOrderInput | SortOrder
    terms?: SortOrderInput | SortOrder
    sentAt?: SortOrderInput | SortOrder
    paidAt?: SortOrderInput | SortOrder
    createdBy?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    siteId?: SortOrderInput | SortOrder
    invoiceItem?: InvoiceItemOrderByRelationAggregateInput
    payment?: PaymentOrderByRelationAggregateInput
  }

  export type InvoiceWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    invoiceNumber?: string
    AND?: InvoiceWhereInput | InvoiceWhereInput[]
    OR?: InvoiceWhereInput[]
    NOT?: InvoiceWhereInput | InvoiceWhereInput[]
    pelangganId?: StringFilter<"Invoice"> | string
    issueDate?: DateTimeFilter<"Invoice"> | Date | string
    dueDate?: DateTimeFilter<"Invoice"> | Date | string
    status?: EnumInvoiceStatusFilter<"Invoice"> | $Enums.InvoiceStatus
    subtotal?: BigIntFilter<"Invoice"> | bigint | number
    taxAmount?: BigIntFilter<"Invoice"> | bigint | number
    discountAmount?: BigIntFilter<"Invoice"> | bigint | number
    totalAmount?: BigIntFilter<"Invoice"> | bigint | number
    paidAmount?: BigIntFilter<"Invoice"> | bigint | number
    notes?: StringNullableFilter<"Invoice"> | string | null
    terms?: StringNullableFilter<"Invoice"> | string | null
    sentAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    paidAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    createdBy?: StringNullableFilter<"Invoice"> | string | null
    createdAt?: DateTimeFilter<"Invoice"> | Date | string
    updatedAt?: DateTimeFilter<"Invoice"> | Date | string
    siteId?: StringNullableFilter<"Invoice"> | string | null
    invoiceItem?: InvoiceItemListRelationFilter
    payment?: PaymentListRelationFilter
  }, "id" | "invoiceNumber">

  export type InvoiceOrderByWithAggregationInput = {
    id?: SortOrder
    invoiceNumber?: SortOrder
    pelangganId?: SortOrder
    issueDate?: SortOrder
    dueDate?: SortOrder
    status?: SortOrder
    subtotal?: SortOrder
    taxAmount?: SortOrder
    discountAmount?: SortOrder
    totalAmount?: SortOrder
    paidAmount?: SortOrder
    notes?: SortOrderInput | SortOrder
    terms?: SortOrderInput | SortOrder
    sentAt?: SortOrderInput | SortOrder
    paidAt?: SortOrderInput | SortOrder
    createdBy?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    siteId?: SortOrderInput | SortOrder
    _count?: InvoiceCountOrderByAggregateInput
    _avg?: InvoiceAvgOrderByAggregateInput
    _max?: InvoiceMaxOrderByAggregateInput
    _min?: InvoiceMinOrderByAggregateInput
    _sum?: InvoiceSumOrderByAggregateInput
  }

  export type InvoiceScalarWhereWithAggregatesInput = {
    AND?: InvoiceScalarWhereWithAggregatesInput | InvoiceScalarWhereWithAggregatesInput[]
    OR?: InvoiceScalarWhereWithAggregatesInput[]
    NOT?: InvoiceScalarWhereWithAggregatesInput | InvoiceScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Invoice"> | string
    invoiceNumber?: StringWithAggregatesFilter<"Invoice"> | string
    pelangganId?: StringWithAggregatesFilter<"Invoice"> | string
    issueDate?: DateTimeWithAggregatesFilter<"Invoice"> | Date | string
    dueDate?: DateTimeWithAggregatesFilter<"Invoice"> | Date | string
    status?: EnumInvoiceStatusWithAggregatesFilter<"Invoice"> | $Enums.InvoiceStatus
    subtotal?: BigIntWithAggregatesFilter<"Invoice"> | bigint | number
    taxAmount?: BigIntWithAggregatesFilter<"Invoice"> | bigint | number
    discountAmount?: BigIntWithAggregatesFilter<"Invoice"> | bigint | number
    totalAmount?: BigIntWithAggregatesFilter<"Invoice"> | bigint | number
    paidAmount?: BigIntWithAggregatesFilter<"Invoice"> | bigint | number
    notes?: StringNullableWithAggregatesFilter<"Invoice"> | string | null
    terms?: StringNullableWithAggregatesFilter<"Invoice"> | string | null
    sentAt?: DateTimeNullableWithAggregatesFilter<"Invoice"> | Date | string | null
    paidAt?: DateTimeNullableWithAggregatesFilter<"Invoice"> | Date | string | null
    createdBy?: StringNullableWithAggregatesFilter<"Invoice"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Invoice"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Invoice"> | Date | string
    siteId?: StringNullableWithAggregatesFilter<"Invoice"> | string | null
  }

  export type InvoiceItemWhereInput = {
    AND?: InvoiceItemWhereInput | InvoiceItemWhereInput[]
    OR?: InvoiceItemWhereInput[]
    NOT?: InvoiceItemWhereInput | InvoiceItemWhereInput[]
    id?: StringFilter<"InvoiceItem"> | string
    invoiceId?: StringFilter<"InvoiceItem"> | string
    description?: StringFilter<"InvoiceItem"> | string
    quantity?: IntFilter<"InvoiceItem"> | number
    unitPrice?: BigIntFilter<"InvoiceItem"> | bigint | number
    totalPrice?: BigIntFilter<"InvoiceItem"> | bigint | number
    itemType?: EnumItemTypeFilter<"InvoiceItem"> | $Enums.ItemType
    invoice?: XOR<InvoiceScalarRelationFilter, InvoiceWhereInput>
  }

  export type InvoiceItemOrderByWithRelationInput = {
    id?: SortOrder
    invoiceId?: SortOrder
    description?: SortOrder
    quantity?: SortOrder
    unitPrice?: SortOrder
    totalPrice?: SortOrder
    itemType?: SortOrder
    invoice?: InvoiceOrderByWithRelationInput
  }

  export type InvoiceItemWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: InvoiceItemWhereInput | InvoiceItemWhereInput[]
    OR?: InvoiceItemWhereInput[]
    NOT?: InvoiceItemWhereInput | InvoiceItemWhereInput[]
    invoiceId?: StringFilter<"InvoiceItem"> | string
    description?: StringFilter<"InvoiceItem"> | string
    quantity?: IntFilter<"InvoiceItem"> | number
    unitPrice?: BigIntFilter<"InvoiceItem"> | bigint | number
    totalPrice?: BigIntFilter<"InvoiceItem"> | bigint | number
    itemType?: EnumItemTypeFilter<"InvoiceItem"> | $Enums.ItemType
    invoice?: XOR<InvoiceScalarRelationFilter, InvoiceWhereInput>
  }, "id">

  export type InvoiceItemOrderByWithAggregationInput = {
    id?: SortOrder
    invoiceId?: SortOrder
    description?: SortOrder
    quantity?: SortOrder
    unitPrice?: SortOrder
    totalPrice?: SortOrder
    itemType?: SortOrder
    _count?: InvoiceItemCountOrderByAggregateInput
    _avg?: InvoiceItemAvgOrderByAggregateInput
    _max?: InvoiceItemMaxOrderByAggregateInput
    _min?: InvoiceItemMinOrderByAggregateInput
    _sum?: InvoiceItemSumOrderByAggregateInput
  }

  export type InvoiceItemScalarWhereWithAggregatesInput = {
    AND?: InvoiceItemScalarWhereWithAggregatesInput | InvoiceItemScalarWhereWithAggregatesInput[]
    OR?: InvoiceItemScalarWhereWithAggregatesInput[]
    NOT?: InvoiceItemScalarWhereWithAggregatesInput | InvoiceItemScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"InvoiceItem"> | string
    invoiceId?: StringWithAggregatesFilter<"InvoiceItem"> | string
    description?: StringWithAggregatesFilter<"InvoiceItem"> | string
    quantity?: IntWithAggregatesFilter<"InvoiceItem"> | number
    unitPrice?: BigIntWithAggregatesFilter<"InvoiceItem"> | bigint | number
    totalPrice?: BigIntWithAggregatesFilter<"InvoiceItem"> | bigint | number
    itemType?: EnumItemTypeWithAggregatesFilter<"InvoiceItem"> | $Enums.ItemType
  }

  export type PaymentWhereInput = {
    AND?: PaymentWhereInput | PaymentWhereInput[]
    OR?: PaymentWhereInput[]
    NOT?: PaymentWhereInput | PaymentWhereInput[]
    id?: StringFilter<"Payment"> | string
    invoiceId?: StringNullableFilter<"Payment"> | string | null
    pelangganId?: StringFilter<"Payment"> | string
    amount?: BigIntFilter<"Payment"> | bigint | number
    paymentDate?: DateTimeFilter<"Payment"> | Date | string
    paymentMethod?: EnumPaymentMethodFilter<"Payment"> | $Enums.PaymentMethod
    reference?: StringNullableFilter<"Payment"> | string | null
    notes?: StringNullableFilter<"Payment"> | string | null
    verifiedBy?: StringNullableFilter<"Payment"> | string | null
    verifiedAt?: DateTimeNullableFilter<"Payment"> | Date | string | null
    createdAt?: DateTimeFilter<"Payment"> | Date | string
    updatedAt?: DateTimeFilter<"Payment"> | Date | string
    accountId?: StringNullableFilter<"Payment"> | string | null
    gatewayStatus?: EnumGatewayPaymentStatusNullableFilter<"Payment"> | $Enums.GatewayPaymentStatus | null
    gatewayProvider?: StringNullableFilter<"Payment"> | string | null
    transactionId?: StringNullableFilter<"Payment"> | string | null
    paymentUrl?: StringNullableFilter<"Payment"> | string | null
    expiresAt?: DateTimeNullableFilter<"Payment"> | Date | string | null
    unmatchedMutationId?: StringNullableFilter<"Payment"> | string | null
    receiptUrl?: StringNullableFilter<"Payment"> | string | null
    invoice?: XOR<InvoiceNullableScalarRelationFilter, InvoiceWhereInput> | null
    unmatchedMutation?: XOR<UnmatchedMutationNullableScalarRelationFilter, UnmatchedMutationWhereInput> | null
  }

  export type PaymentOrderByWithRelationInput = {
    id?: SortOrder
    invoiceId?: SortOrderInput | SortOrder
    pelangganId?: SortOrder
    amount?: SortOrder
    paymentDate?: SortOrder
    paymentMethod?: SortOrder
    reference?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    verifiedBy?: SortOrderInput | SortOrder
    verifiedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    accountId?: SortOrderInput | SortOrder
    gatewayStatus?: SortOrderInput | SortOrder
    gatewayProvider?: SortOrderInput | SortOrder
    transactionId?: SortOrderInput | SortOrder
    paymentUrl?: SortOrderInput | SortOrder
    expiresAt?: SortOrderInput | SortOrder
    unmatchedMutationId?: SortOrderInput | SortOrder
    receiptUrl?: SortOrderInput | SortOrder
    invoice?: InvoiceOrderByWithRelationInput
    unmatchedMutation?: UnmatchedMutationOrderByWithRelationInput
  }

  export type PaymentWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    unmatchedMutationId?: string
    AND?: PaymentWhereInput | PaymentWhereInput[]
    OR?: PaymentWhereInput[]
    NOT?: PaymentWhereInput | PaymentWhereInput[]
    invoiceId?: StringNullableFilter<"Payment"> | string | null
    pelangganId?: StringFilter<"Payment"> | string
    amount?: BigIntFilter<"Payment"> | bigint | number
    paymentDate?: DateTimeFilter<"Payment"> | Date | string
    paymentMethod?: EnumPaymentMethodFilter<"Payment"> | $Enums.PaymentMethod
    reference?: StringNullableFilter<"Payment"> | string | null
    notes?: StringNullableFilter<"Payment"> | string | null
    verifiedBy?: StringNullableFilter<"Payment"> | string | null
    verifiedAt?: DateTimeNullableFilter<"Payment"> | Date | string | null
    createdAt?: DateTimeFilter<"Payment"> | Date | string
    updatedAt?: DateTimeFilter<"Payment"> | Date | string
    accountId?: StringNullableFilter<"Payment"> | string | null
    gatewayStatus?: EnumGatewayPaymentStatusNullableFilter<"Payment"> | $Enums.GatewayPaymentStatus | null
    gatewayProvider?: StringNullableFilter<"Payment"> | string | null
    transactionId?: StringNullableFilter<"Payment"> | string | null
    paymentUrl?: StringNullableFilter<"Payment"> | string | null
    expiresAt?: DateTimeNullableFilter<"Payment"> | Date | string | null
    receiptUrl?: StringNullableFilter<"Payment"> | string | null
    invoice?: XOR<InvoiceNullableScalarRelationFilter, InvoiceWhereInput> | null
    unmatchedMutation?: XOR<UnmatchedMutationNullableScalarRelationFilter, UnmatchedMutationWhereInput> | null
  }, "id" | "unmatchedMutationId">

  export type PaymentOrderByWithAggregationInput = {
    id?: SortOrder
    invoiceId?: SortOrderInput | SortOrder
    pelangganId?: SortOrder
    amount?: SortOrder
    paymentDate?: SortOrder
    paymentMethod?: SortOrder
    reference?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    verifiedBy?: SortOrderInput | SortOrder
    verifiedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    accountId?: SortOrderInput | SortOrder
    gatewayStatus?: SortOrderInput | SortOrder
    gatewayProvider?: SortOrderInput | SortOrder
    transactionId?: SortOrderInput | SortOrder
    paymentUrl?: SortOrderInput | SortOrder
    expiresAt?: SortOrderInput | SortOrder
    unmatchedMutationId?: SortOrderInput | SortOrder
    receiptUrl?: SortOrderInput | SortOrder
    _count?: PaymentCountOrderByAggregateInput
    _avg?: PaymentAvgOrderByAggregateInput
    _max?: PaymentMaxOrderByAggregateInput
    _min?: PaymentMinOrderByAggregateInput
    _sum?: PaymentSumOrderByAggregateInput
  }

  export type PaymentScalarWhereWithAggregatesInput = {
    AND?: PaymentScalarWhereWithAggregatesInput | PaymentScalarWhereWithAggregatesInput[]
    OR?: PaymentScalarWhereWithAggregatesInput[]
    NOT?: PaymentScalarWhereWithAggregatesInput | PaymentScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Payment"> | string
    invoiceId?: StringNullableWithAggregatesFilter<"Payment"> | string | null
    pelangganId?: StringWithAggregatesFilter<"Payment"> | string
    amount?: BigIntWithAggregatesFilter<"Payment"> | bigint | number
    paymentDate?: DateTimeWithAggregatesFilter<"Payment"> | Date | string
    paymentMethod?: EnumPaymentMethodWithAggregatesFilter<"Payment"> | $Enums.PaymentMethod
    reference?: StringNullableWithAggregatesFilter<"Payment"> | string | null
    notes?: StringNullableWithAggregatesFilter<"Payment"> | string | null
    verifiedBy?: StringNullableWithAggregatesFilter<"Payment"> | string | null
    verifiedAt?: DateTimeNullableWithAggregatesFilter<"Payment"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Payment"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Payment"> | Date | string
    accountId?: StringNullableWithAggregatesFilter<"Payment"> | string | null
    gatewayStatus?: EnumGatewayPaymentStatusNullableWithAggregatesFilter<"Payment"> | $Enums.GatewayPaymentStatus | null
    gatewayProvider?: StringNullableWithAggregatesFilter<"Payment"> | string | null
    transactionId?: StringNullableWithAggregatesFilter<"Payment"> | string | null
    paymentUrl?: StringNullableWithAggregatesFilter<"Payment"> | string | null
    expiresAt?: DateTimeNullableWithAggregatesFilter<"Payment"> | Date | string | null
    unmatchedMutationId?: StringNullableWithAggregatesFilter<"Payment"> | string | null
    receiptUrl?: StringNullableWithAggregatesFilter<"Payment"> | string | null
  }

  export type PaymentGatewayConfigWhereInput = {
    AND?: PaymentGatewayConfigWhereInput | PaymentGatewayConfigWhereInput[]
    OR?: PaymentGatewayConfigWhereInput[]
    NOT?: PaymentGatewayConfigWhereInput | PaymentGatewayConfigWhereInput[]
    id?: StringFilter<"PaymentGatewayConfig"> | string
    provider?: StringFilter<"PaymentGatewayConfig"> | string
    providerName?: StringFilter<"PaymentGatewayConfig"> | string
    isEnabled?: BoolFilter<"PaymentGatewayConfig"> | boolean
    isProduction?: BoolFilter<"PaymentGatewayConfig"> | boolean
    priority?: IntFilter<"PaymentGatewayConfig"> | number
    apiKey?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
    apiSecret?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
    clientKey?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
    merchantId?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
    webhookUrl?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
    callbackUrl?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
    settings?: JsonNullableFilter<"PaymentGatewayConfig">
    lastTestedAt?: DateTimeNullableFilter<"PaymentGatewayConfig"> | Date | string | null
    testStatus?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
    createdAt?: DateTimeFilter<"PaymentGatewayConfig"> | Date | string
    updatedAt?: DateTimeFilter<"PaymentGatewayConfig"> | Date | string
    createdBy?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
  }

  export type PaymentGatewayConfigOrderByWithRelationInput = {
    id?: SortOrder
    provider?: SortOrder
    providerName?: SortOrder
    isEnabled?: SortOrder
    isProduction?: SortOrder
    priority?: SortOrder
    apiKey?: SortOrderInput | SortOrder
    apiSecret?: SortOrderInput | SortOrder
    clientKey?: SortOrderInput | SortOrder
    merchantId?: SortOrderInput | SortOrder
    webhookUrl?: SortOrderInput | SortOrder
    callbackUrl?: SortOrderInput | SortOrder
    settings?: SortOrderInput | SortOrder
    lastTestedAt?: SortOrderInput | SortOrder
    testStatus?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    createdBy?: SortOrderInput | SortOrder
  }

  export type PaymentGatewayConfigWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    provider?: string
    AND?: PaymentGatewayConfigWhereInput | PaymentGatewayConfigWhereInput[]
    OR?: PaymentGatewayConfigWhereInput[]
    NOT?: PaymentGatewayConfigWhereInput | PaymentGatewayConfigWhereInput[]
    providerName?: StringFilter<"PaymentGatewayConfig"> | string
    isEnabled?: BoolFilter<"PaymentGatewayConfig"> | boolean
    isProduction?: BoolFilter<"PaymentGatewayConfig"> | boolean
    priority?: IntFilter<"PaymentGatewayConfig"> | number
    apiKey?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
    apiSecret?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
    clientKey?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
    merchantId?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
    webhookUrl?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
    callbackUrl?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
    settings?: JsonNullableFilter<"PaymentGatewayConfig">
    lastTestedAt?: DateTimeNullableFilter<"PaymentGatewayConfig"> | Date | string | null
    testStatus?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
    createdAt?: DateTimeFilter<"PaymentGatewayConfig"> | Date | string
    updatedAt?: DateTimeFilter<"PaymentGatewayConfig"> | Date | string
    createdBy?: StringNullableFilter<"PaymentGatewayConfig"> | string | null
  }, "id" | "provider">

  export type PaymentGatewayConfigOrderByWithAggregationInput = {
    id?: SortOrder
    provider?: SortOrder
    providerName?: SortOrder
    isEnabled?: SortOrder
    isProduction?: SortOrder
    priority?: SortOrder
    apiKey?: SortOrderInput | SortOrder
    apiSecret?: SortOrderInput | SortOrder
    clientKey?: SortOrderInput | SortOrder
    merchantId?: SortOrderInput | SortOrder
    webhookUrl?: SortOrderInput | SortOrder
    callbackUrl?: SortOrderInput | SortOrder
    settings?: SortOrderInput | SortOrder
    lastTestedAt?: SortOrderInput | SortOrder
    testStatus?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    createdBy?: SortOrderInput | SortOrder
    _count?: PaymentGatewayConfigCountOrderByAggregateInput
    _avg?: PaymentGatewayConfigAvgOrderByAggregateInput
    _max?: PaymentGatewayConfigMaxOrderByAggregateInput
    _min?: PaymentGatewayConfigMinOrderByAggregateInput
    _sum?: PaymentGatewayConfigSumOrderByAggregateInput
  }

  export type PaymentGatewayConfigScalarWhereWithAggregatesInput = {
    AND?: PaymentGatewayConfigScalarWhereWithAggregatesInput | PaymentGatewayConfigScalarWhereWithAggregatesInput[]
    OR?: PaymentGatewayConfigScalarWhereWithAggregatesInput[]
    NOT?: PaymentGatewayConfigScalarWhereWithAggregatesInput | PaymentGatewayConfigScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PaymentGatewayConfig"> | string
    provider?: StringWithAggregatesFilter<"PaymentGatewayConfig"> | string
    providerName?: StringWithAggregatesFilter<"PaymentGatewayConfig"> | string
    isEnabled?: BoolWithAggregatesFilter<"PaymentGatewayConfig"> | boolean
    isProduction?: BoolWithAggregatesFilter<"PaymentGatewayConfig"> | boolean
    priority?: IntWithAggregatesFilter<"PaymentGatewayConfig"> | number
    apiKey?: StringNullableWithAggregatesFilter<"PaymentGatewayConfig"> | string | null
    apiSecret?: StringNullableWithAggregatesFilter<"PaymentGatewayConfig"> | string | null
    clientKey?: StringNullableWithAggregatesFilter<"PaymentGatewayConfig"> | string | null
    merchantId?: StringNullableWithAggregatesFilter<"PaymentGatewayConfig"> | string | null
    webhookUrl?: StringNullableWithAggregatesFilter<"PaymentGatewayConfig"> | string | null
    callbackUrl?: StringNullableWithAggregatesFilter<"PaymentGatewayConfig"> | string | null
    settings?: JsonNullableWithAggregatesFilter<"PaymentGatewayConfig">
    lastTestedAt?: DateTimeNullableWithAggregatesFilter<"PaymentGatewayConfig"> | Date | string | null
    testStatus?: StringNullableWithAggregatesFilter<"PaymentGatewayConfig"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"PaymentGatewayConfig"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PaymentGatewayConfig"> | Date | string
    createdBy?: StringNullableWithAggregatesFilter<"PaymentGatewayConfig"> | string | null
  }

  export type UnmatchedMutationWhereInput = {
    AND?: UnmatchedMutationWhereInput | UnmatchedMutationWhereInput[]
    OR?: UnmatchedMutationWhereInput[]
    NOT?: UnmatchedMutationWhereInput | UnmatchedMutationWhereInput[]
    id?: StringFilter<"UnmatchedMutation"> | string
    provider?: StringFilter<"UnmatchedMutation"> | string
    transactionId?: StringNullableFilter<"UnmatchedMutation"> | string | null
    amount?: DecimalFilter<"UnmatchedMutation"> | Decimal | DecimalJsLike | number | string
    description?: StringNullableFilter<"UnmatchedMutation"> | string | null
    type?: StringNullableFilter<"UnmatchedMutation"> | string | null
    date?: DateTimeFilter<"UnmatchedMutation"> | Date | string
    bankId?: StringNullableFilter<"UnmatchedMutation"> | string | null
    rawPayload?: JsonNullableFilter<"UnmatchedMutation">
    status?: EnumUnmatchedStatusFilter<"UnmatchedMutation"> | $Enums.UnmatchedStatus
    resolvedAt?: DateTimeNullableFilter<"UnmatchedMutation"> | Date | string | null
    resolvedById?: StringNullableFilter<"UnmatchedMutation"> | string | null
    matchedInvoiceId?: StringNullableFilter<"UnmatchedMutation"> | string | null
    createdAt?: DateTimeFilter<"UnmatchedMutation"> | Date | string
    updatedAt?: DateTimeFilter<"UnmatchedMutation"> | Date | string
    payment?: XOR<PaymentNullableScalarRelationFilter, PaymentWhereInput> | null
  }

  export type UnmatchedMutationOrderByWithRelationInput = {
    id?: SortOrder
    provider?: SortOrder
    transactionId?: SortOrderInput | SortOrder
    amount?: SortOrder
    description?: SortOrderInput | SortOrder
    type?: SortOrderInput | SortOrder
    date?: SortOrder
    bankId?: SortOrderInput | SortOrder
    rawPayload?: SortOrderInput | SortOrder
    status?: SortOrder
    resolvedAt?: SortOrderInput | SortOrder
    resolvedById?: SortOrderInput | SortOrder
    matchedInvoiceId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    payment?: PaymentOrderByWithRelationInput
  }

  export type UnmatchedMutationWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    transactionId?: string
    AND?: UnmatchedMutationWhereInput | UnmatchedMutationWhereInput[]
    OR?: UnmatchedMutationWhereInput[]
    NOT?: UnmatchedMutationWhereInput | UnmatchedMutationWhereInput[]
    provider?: StringFilter<"UnmatchedMutation"> | string
    amount?: DecimalFilter<"UnmatchedMutation"> | Decimal | DecimalJsLike | number | string
    description?: StringNullableFilter<"UnmatchedMutation"> | string | null
    type?: StringNullableFilter<"UnmatchedMutation"> | string | null
    date?: DateTimeFilter<"UnmatchedMutation"> | Date | string
    bankId?: StringNullableFilter<"UnmatchedMutation"> | string | null
    rawPayload?: JsonNullableFilter<"UnmatchedMutation">
    status?: EnumUnmatchedStatusFilter<"UnmatchedMutation"> | $Enums.UnmatchedStatus
    resolvedAt?: DateTimeNullableFilter<"UnmatchedMutation"> | Date | string | null
    resolvedById?: StringNullableFilter<"UnmatchedMutation"> | string | null
    matchedInvoiceId?: StringNullableFilter<"UnmatchedMutation"> | string | null
    createdAt?: DateTimeFilter<"UnmatchedMutation"> | Date | string
    updatedAt?: DateTimeFilter<"UnmatchedMutation"> | Date | string
    payment?: XOR<PaymentNullableScalarRelationFilter, PaymentWhereInput> | null
  }, "id" | "transactionId">

  export type UnmatchedMutationOrderByWithAggregationInput = {
    id?: SortOrder
    provider?: SortOrder
    transactionId?: SortOrderInput | SortOrder
    amount?: SortOrder
    description?: SortOrderInput | SortOrder
    type?: SortOrderInput | SortOrder
    date?: SortOrder
    bankId?: SortOrderInput | SortOrder
    rawPayload?: SortOrderInput | SortOrder
    status?: SortOrder
    resolvedAt?: SortOrderInput | SortOrder
    resolvedById?: SortOrderInput | SortOrder
    matchedInvoiceId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UnmatchedMutationCountOrderByAggregateInput
    _avg?: UnmatchedMutationAvgOrderByAggregateInput
    _max?: UnmatchedMutationMaxOrderByAggregateInput
    _min?: UnmatchedMutationMinOrderByAggregateInput
    _sum?: UnmatchedMutationSumOrderByAggregateInput
  }

  export type UnmatchedMutationScalarWhereWithAggregatesInput = {
    AND?: UnmatchedMutationScalarWhereWithAggregatesInput | UnmatchedMutationScalarWhereWithAggregatesInput[]
    OR?: UnmatchedMutationScalarWhereWithAggregatesInput[]
    NOT?: UnmatchedMutationScalarWhereWithAggregatesInput | UnmatchedMutationScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"UnmatchedMutation"> | string
    provider?: StringWithAggregatesFilter<"UnmatchedMutation"> | string
    transactionId?: StringNullableWithAggregatesFilter<"UnmatchedMutation"> | string | null
    amount?: DecimalWithAggregatesFilter<"UnmatchedMutation"> | Decimal | DecimalJsLike | number | string
    description?: StringNullableWithAggregatesFilter<"UnmatchedMutation"> | string | null
    type?: StringNullableWithAggregatesFilter<"UnmatchedMutation"> | string | null
    date?: DateTimeWithAggregatesFilter<"UnmatchedMutation"> | Date | string
    bankId?: StringNullableWithAggregatesFilter<"UnmatchedMutation"> | string | null
    rawPayload?: JsonNullableWithAggregatesFilter<"UnmatchedMutation">
    status?: EnumUnmatchedStatusWithAggregatesFilter<"UnmatchedMutation"> | $Enums.UnmatchedStatus
    resolvedAt?: DateTimeNullableWithAggregatesFilter<"UnmatchedMutation"> | Date | string | null
    resolvedById?: StringNullableWithAggregatesFilter<"UnmatchedMutation"> | string | null
    matchedInvoiceId?: StringNullableWithAggregatesFilter<"UnmatchedMutation"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"UnmatchedMutation"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"UnmatchedMutation"> | Date | string
  }

  export type TransactionWhereInput = {
    AND?: TransactionWhereInput | TransactionWhereInput[]
    OR?: TransactionWhereInput[]
    NOT?: TransactionWhereInput | TransactionWhereInput[]
    id?: StringFilter<"Transaction"> | string
    date?: DateTimeFilter<"Transaction"> | Date | string
    amount?: FloatFilter<"Transaction"> | number
    type?: EnumTransactionTypeFilter<"Transaction"> | $Enums.TransactionType
    description?: StringNullableFilter<"Transaction"> | string | null
    referenceId?: StringNullableFilter<"Transaction"> | string | null
    categoryId?: StringFilter<"Transaction"> | string
    accountId?: StringNullableFilter<"Transaction"> | string | null
    purchaseOrderId?: StringNullableFilter<"Transaction"> | string | null
    createdById?: StringFilter<"Transaction"> | string
    attachments?: StringNullableListFilter<"Transaction">
    createdAt?: DateTimeFilter<"Transaction"> | Date | string
    updatedAt?: DateTimeFilter<"Transaction"> | Date | string
    category?: XOR<TransactionCategoryScalarRelationFilter, TransactionCategoryWhereInput>
  }

  export type TransactionOrderByWithRelationInput = {
    id?: SortOrder
    date?: SortOrder
    amount?: SortOrder
    type?: SortOrder
    description?: SortOrderInput | SortOrder
    referenceId?: SortOrderInput | SortOrder
    categoryId?: SortOrder
    accountId?: SortOrderInput | SortOrder
    purchaseOrderId?: SortOrderInput | SortOrder
    createdById?: SortOrder
    attachments?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    category?: TransactionCategoryOrderByWithRelationInput
  }

  export type TransactionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: TransactionWhereInput | TransactionWhereInput[]
    OR?: TransactionWhereInput[]
    NOT?: TransactionWhereInput | TransactionWhereInput[]
    date?: DateTimeFilter<"Transaction"> | Date | string
    amount?: FloatFilter<"Transaction"> | number
    type?: EnumTransactionTypeFilter<"Transaction"> | $Enums.TransactionType
    description?: StringNullableFilter<"Transaction"> | string | null
    referenceId?: StringNullableFilter<"Transaction"> | string | null
    categoryId?: StringFilter<"Transaction"> | string
    accountId?: StringNullableFilter<"Transaction"> | string | null
    purchaseOrderId?: StringNullableFilter<"Transaction"> | string | null
    createdById?: StringFilter<"Transaction"> | string
    attachments?: StringNullableListFilter<"Transaction">
    createdAt?: DateTimeFilter<"Transaction"> | Date | string
    updatedAt?: DateTimeFilter<"Transaction"> | Date | string
    category?: XOR<TransactionCategoryScalarRelationFilter, TransactionCategoryWhereInput>
  }, "id">

  export type TransactionOrderByWithAggregationInput = {
    id?: SortOrder
    date?: SortOrder
    amount?: SortOrder
    type?: SortOrder
    description?: SortOrderInput | SortOrder
    referenceId?: SortOrderInput | SortOrder
    categoryId?: SortOrder
    accountId?: SortOrderInput | SortOrder
    purchaseOrderId?: SortOrderInput | SortOrder
    createdById?: SortOrder
    attachments?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: TransactionCountOrderByAggregateInput
    _avg?: TransactionAvgOrderByAggregateInput
    _max?: TransactionMaxOrderByAggregateInput
    _min?: TransactionMinOrderByAggregateInput
    _sum?: TransactionSumOrderByAggregateInput
  }

  export type TransactionScalarWhereWithAggregatesInput = {
    AND?: TransactionScalarWhereWithAggregatesInput | TransactionScalarWhereWithAggregatesInput[]
    OR?: TransactionScalarWhereWithAggregatesInput[]
    NOT?: TransactionScalarWhereWithAggregatesInput | TransactionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Transaction"> | string
    date?: DateTimeWithAggregatesFilter<"Transaction"> | Date | string
    amount?: FloatWithAggregatesFilter<"Transaction"> | number
    type?: EnumTransactionTypeWithAggregatesFilter<"Transaction"> | $Enums.TransactionType
    description?: StringNullableWithAggregatesFilter<"Transaction"> | string | null
    referenceId?: StringNullableWithAggregatesFilter<"Transaction"> | string | null
    categoryId?: StringWithAggregatesFilter<"Transaction"> | string
    accountId?: StringNullableWithAggregatesFilter<"Transaction"> | string | null
    purchaseOrderId?: StringNullableWithAggregatesFilter<"Transaction"> | string | null
    createdById?: StringWithAggregatesFilter<"Transaction"> | string
    attachments?: StringNullableListFilter<"Transaction">
    createdAt?: DateTimeWithAggregatesFilter<"Transaction"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Transaction"> | Date | string
  }

  export type TransactionCategoryWhereInput = {
    AND?: TransactionCategoryWhereInput | TransactionCategoryWhereInput[]
    OR?: TransactionCategoryWhereInput[]
    NOT?: TransactionCategoryWhereInput | TransactionCategoryWhereInput[]
    id?: StringFilter<"TransactionCategory"> | string
    name?: StringFilter<"TransactionCategory"> | string
    type?: EnumTransactionTypeFilter<"TransactionCategory"> | $Enums.TransactionType
    expenseType?: EnumExpenseTypeNullableFilter<"TransactionCategory"> | $Enums.ExpenseType | null
    description?: StringNullableFilter<"TransactionCategory"> | string | null
    isSystem?: BoolFilter<"TransactionCategory"> | boolean
    createdAt?: DateTimeFilter<"TransactionCategory"> | Date | string
    updatedAt?: DateTimeFilter<"TransactionCategory"> | Date | string
    transactions?: TransactionListRelationFilter
  }

  export type TransactionCategoryOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    type?: SortOrder
    expenseType?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    isSystem?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    transactions?: TransactionOrderByRelationAggregateInput
  }

  export type TransactionCategoryWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: TransactionCategoryWhereInput | TransactionCategoryWhereInput[]
    OR?: TransactionCategoryWhereInput[]
    NOT?: TransactionCategoryWhereInput | TransactionCategoryWhereInput[]
    name?: StringFilter<"TransactionCategory"> | string
    type?: EnumTransactionTypeFilter<"TransactionCategory"> | $Enums.TransactionType
    expenseType?: EnumExpenseTypeNullableFilter<"TransactionCategory"> | $Enums.ExpenseType | null
    description?: StringNullableFilter<"TransactionCategory"> | string | null
    isSystem?: BoolFilter<"TransactionCategory"> | boolean
    createdAt?: DateTimeFilter<"TransactionCategory"> | Date | string
    updatedAt?: DateTimeFilter<"TransactionCategory"> | Date | string
    transactions?: TransactionListRelationFilter
  }, "id">

  export type TransactionCategoryOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    type?: SortOrder
    expenseType?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    isSystem?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: TransactionCategoryCountOrderByAggregateInput
    _max?: TransactionCategoryMaxOrderByAggregateInput
    _min?: TransactionCategoryMinOrderByAggregateInput
  }

  export type TransactionCategoryScalarWhereWithAggregatesInput = {
    AND?: TransactionCategoryScalarWhereWithAggregatesInput | TransactionCategoryScalarWhereWithAggregatesInput[]
    OR?: TransactionCategoryScalarWhereWithAggregatesInput[]
    NOT?: TransactionCategoryScalarWhereWithAggregatesInput | TransactionCategoryScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"TransactionCategory"> | string
    name?: StringWithAggregatesFilter<"TransactionCategory"> | string
    type?: EnumTransactionTypeWithAggregatesFilter<"TransactionCategory"> | $Enums.TransactionType
    expenseType?: EnumExpenseTypeNullableWithAggregatesFilter<"TransactionCategory"> | $Enums.ExpenseType | null
    description?: StringNullableWithAggregatesFilter<"TransactionCategory"> | string | null
    isSystem?: BoolWithAggregatesFilter<"TransactionCategory"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"TransactionCategory"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"TransactionCategory"> | Date | string
  }

  export type MixRadiusInvoiceWhereInput = {
    AND?: MixRadiusInvoiceWhereInput | MixRadiusInvoiceWhereInput[]
    OR?: MixRadiusInvoiceWhereInput[]
    NOT?: MixRadiusInvoiceWhereInput | MixRadiusInvoiceWhereInput[]
    id?: StringFilter<"MixRadiusInvoice"> | string
    invoiceNumber?: StringFilter<"MixRadiusInvoice"> | string
    mixRadiusId?: StringNullableFilter<"MixRadiusInvoice"> | string | null
    username?: StringFilter<"MixRadiusInvoice"> | string
    fullName?: StringNullableFilter<"MixRadiusInvoice"> | string | null
    ownerName?: StringNullableFilter<"MixRadiusInvoice"> | string | null
    planName?: StringNullableFilter<"MixRadiusInvoice"> | string | null
    amount?: DecimalFilter<"MixRadiusInvoice"> | Decimal | DecimalJsLike | number | string
    status?: StringFilter<"MixRadiusInvoice"> | string
    paymentMethod?: StringNullableFilter<"MixRadiusInvoice"> | string | null
    issuedDate?: DateTimeFilter<"MixRadiusInvoice"> | Date | string
    dueDate?: DateTimeNullableFilter<"MixRadiusInvoice"> | Date | string | null
    expiredOn?: DateTimeNullableFilter<"MixRadiusInvoice"> | Date | string | null
    syncedAt?: DateTimeFilter<"MixRadiusInvoice"> | Date | string
  }

  export type MixRadiusInvoiceOrderByWithRelationInput = {
    id?: SortOrder
    invoiceNumber?: SortOrder
    mixRadiusId?: SortOrderInput | SortOrder
    username?: SortOrder
    fullName?: SortOrderInput | SortOrder
    ownerName?: SortOrderInput | SortOrder
    planName?: SortOrderInput | SortOrder
    amount?: SortOrder
    status?: SortOrder
    paymentMethod?: SortOrderInput | SortOrder
    issuedDate?: SortOrder
    dueDate?: SortOrderInput | SortOrder
    expiredOn?: SortOrderInput | SortOrder
    syncedAt?: SortOrder
  }

  export type MixRadiusInvoiceWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    invoiceNumber?: string
    AND?: MixRadiusInvoiceWhereInput | MixRadiusInvoiceWhereInput[]
    OR?: MixRadiusInvoiceWhereInput[]
    NOT?: MixRadiusInvoiceWhereInput | MixRadiusInvoiceWhereInput[]
    mixRadiusId?: StringNullableFilter<"MixRadiusInvoice"> | string | null
    username?: StringFilter<"MixRadiusInvoice"> | string
    fullName?: StringNullableFilter<"MixRadiusInvoice"> | string | null
    ownerName?: StringNullableFilter<"MixRadiusInvoice"> | string | null
    planName?: StringNullableFilter<"MixRadiusInvoice"> | string | null
    amount?: DecimalFilter<"MixRadiusInvoice"> | Decimal | DecimalJsLike | number | string
    status?: StringFilter<"MixRadiusInvoice"> | string
    paymentMethod?: StringNullableFilter<"MixRadiusInvoice"> | string | null
    issuedDate?: DateTimeFilter<"MixRadiusInvoice"> | Date | string
    dueDate?: DateTimeNullableFilter<"MixRadiusInvoice"> | Date | string | null
    expiredOn?: DateTimeNullableFilter<"MixRadiusInvoice"> | Date | string | null
    syncedAt?: DateTimeFilter<"MixRadiusInvoice"> | Date | string
  }, "id" | "invoiceNumber">

  export type MixRadiusInvoiceOrderByWithAggregationInput = {
    id?: SortOrder
    invoiceNumber?: SortOrder
    mixRadiusId?: SortOrderInput | SortOrder
    username?: SortOrder
    fullName?: SortOrderInput | SortOrder
    ownerName?: SortOrderInput | SortOrder
    planName?: SortOrderInput | SortOrder
    amount?: SortOrder
    status?: SortOrder
    paymentMethod?: SortOrderInput | SortOrder
    issuedDate?: SortOrder
    dueDate?: SortOrderInput | SortOrder
    expiredOn?: SortOrderInput | SortOrder
    syncedAt?: SortOrder
    _count?: MixRadiusInvoiceCountOrderByAggregateInput
    _avg?: MixRadiusInvoiceAvgOrderByAggregateInput
    _max?: MixRadiusInvoiceMaxOrderByAggregateInput
    _min?: MixRadiusInvoiceMinOrderByAggregateInput
    _sum?: MixRadiusInvoiceSumOrderByAggregateInput
  }

  export type MixRadiusInvoiceScalarWhereWithAggregatesInput = {
    AND?: MixRadiusInvoiceScalarWhereWithAggregatesInput | MixRadiusInvoiceScalarWhereWithAggregatesInput[]
    OR?: MixRadiusInvoiceScalarWhereWithAggregatesInput[]
    NOT?: MixRadiusInvoiceScalarWhereWithAggregatesInput | MixRadiusInvoiceScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"MixRadiusInvoice"> | string
    invoiceNumber?: StringWithAggregatesFilter<"MixRadiusInvoice"> | string
    mixRadiusId?: StringNullableWithAggregatesFilter<"MixRadiusInvoice"> | string | null
    username?: StringWithAggregatesFilter<"MixRadiusInvoice"> | string
    fullName?: StringNullableWithAggregatesFilter<"MixRadiusInvoice"> | string | null
    ownerName?: StringNullableWithAggregatesFilter<"MixRadiusInvoice"> | string | null
    planName?: StringNullableWithAggregatesFilter<"MixRadiusInvoice"> | string | null
    amount?: DecimalWithAggregatesFilter<"MixRadiusInvoice"> | Decimal | DecimalJsLike | number | string
    status?: StringWithAggregatesFilter<"MixRadiusInvoice"> | string
    paymentMethod?: StringNullableWithAggregatesFilter<"MixRadiusInvoice"> | string | null
    issuedDate?: DateTimeWithAggregatesFilter<"MixRadiusInvoice"> | Date | string
    dueDate?: DateTimeNullableWithAggregatesFilter<"MixRadiusInvoice"> | Date | string | null
    expiredOn?: DateTimeNullableWithAggregatesFilter<"MixRadiusInvoice"> | Date | string | null
    syncedAt?: DateTimeWithAggregatesFilter<"MixRadiusInvoice"> | Date | string
  }

  export type MixRadiusCustomerWhereInput = {
    AND?: MixRadiusCustomerWhereInput | MixRadiusCustomerWhereInput[]
    OR?: MixRadiusCustomerWhereInput[]
    NOT?: MixRadiusCustomerWhereInput | MixRadiusCustomerWhereInput[]
    id?: StringFilter<"MixRadiusCustomer"> | string
    mixRadiusId?: StringFilter<"MixRadiusCustomer"> | string
    username?: StringFilter<"MixRadiusCustomer"> | string
    fullName?: StringNullableFilter<"MixRadiusCustomer"> | string | null
    address?: StringNullableFilter<"MixRadiusCustomer"> | string | null
    phoneNumber?: StringNullableFilter<"MixRadiusCustomer"> | string | null
    planName?: StringNullableFilter<"MixRadiusCustomer"> | string | null
    status?: StringNullableFilter<"MixRadiusCustomer"> | string | null
    ownerName?: StringNullableFilter<"MixRadiusCustomer"> | string | null
    expiredOn?: DateTimeNullableFilter<"MixRadiusCustomer"> | Date | string | null
    lastSyncedAt?: DateTimeFilter<"MixRadiusCustomer"> | Date | string
    createdAt?: DateTimeFilter<"MixRadiusCustomer"> | Date | string
    updatedAt?: DateTimeFilter<"MixRadiusCustomer"> | Date | string
  }

  export type MixRadiusCustomerOrderByWithRelationInput = {
    id?: SortOrder
    mixRadiusId?: SortOrder
    username?: SortOrder
    fullName?: SortOrderInput | SortOrder
    address?: SortOrderInput | SortOrder
    phoneNumber?: SortOrderInput | SortOrder
    planName?: SortOrderInput | SortOrder
    status?: SortOrderInput | SortOrder
    ownerName?: SortOrderInput | SortOrder
    expiredOn?: SortOrderInput | SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MixRadiusCustomerWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    mixRadiusId?: string
    username?: string
    AND?: MixRadiusCustomerWhereInput | MixRadiusCustomerWhereInput[]
    OR?: MixRadiusCustomerWhereInput[]
    NOT?: MixRadiusCustomerWhereInput | MixRadiusCustomerWhereInput[]
    fullName?: StringNullableFilter<"MixRadiusCustomer"> | string | null
    address?: StringNullableFilter<"MixRadiusCustomer"> | string | null
    phoneNumber?: StringNullableFilter<"MixRadiusCustomer"> | string | null
    planName?: StringNullableFilter<"MixRadiusCustomer"> | string | null
    status?: StringNullableFilter<"MixRadiusCustomer"> | string | null
    ownerName?: StringNullableFilter<"MixRadiusCustomer"> | string | null
    expiredOn?: DateTimeNullableFilter<"MixRadiusCustomer"> | Date | string | null
    lastSyncedAt?: DateTimeFilter<"MixRadiusCustomer"> | Date | string
    createdAt?: DateTimeFilter<"MixRadiusCustomer"> | Date | string
    updatedAt?: DateTimeFilter<"MixRadiusCustomer"> | Date | string
  }, "id" | "mixRadiusId" | "username">

  export type MixRadiusCustomerOrderByWithAggregationInput = {
    id?: SortOrder
    mixRadiusId?: SortOrder
    username?: SortOrder
    fullName?: SortOrderInput | SortOrder
    address?: SortOrderInput | SortOrder
    phoneNumber?: SortOrderInput | SortOrder
    planName?: SortOrderInput | SortOrder
    status?: SortOrderInput | SortOrder
    ownerName?: SortOrderInput | SortOrder
    expiredOn?: SortOrderInput | SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: MixRadiusCustomerCountOrderByAggregateInput
    _max?: MixRadiusCustomerMaxOrderByAggregateInput
    _min?: MixRadiusCustomerMinOrderByAggregateInput
  }

  export type MixRadiusCustomerScalarWhereWithAggregatesInput = {
    AND?: MixRadiusCustomerScalarWhereWithAggregatesInput | MixRadiusCustomerScalarWhereWithAggregatesInput[]
    OR?: MixRadiusCustomerScalarWhereWithAggregatesInput[]
    NOT?: MixRadiusCustomerScalarWhereWithAggregatesInput | MixRadiusCustomerScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"MixRadiusCustomer"> | string
    mixRadiusId?: StringWithAggregatesFilter<"MixRadiusCustomer"> | string
    username?: StringWithAggregatesFilter<"MixRadiusCustomer"> | string
    fullName?: StringNullableWithAggregatesFilter<"MixRadiusCustomer"> | string | null
    address?: StringNullableWithAggregatesFilter<"MixRadiusCustomer"> | string | null
    phoneNumber?: StringNullableWithAggregatesFilter<"MixRadiusCustomer"> | string | null
    planName?: StringNullableWithAggregatesFilter<"MixRadiusCustomer"> | string | null
    status?: StringNullableWithAggregatesFilter<"MixRadiusCustomer"> | string | null
    ownerName?: StringNullableWithAggregatesFilter<"MixRadiusCustomer"> | string | null
    expiredOn?: DateTimeNullableWithAggregatesFilter<"MixRadiusCustomer"> | Date | string | null
    lastSyncedAt?: DateTimeWithAggregatesFilter<"MixRadiusCustomer"> | Date | string
    createdAt?: DateTimeWithAggregatesFilter<"MixRadiusCustomer"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"MixRadiusCustomer"> | Date | string
  }

  export type MixRadiusOwnerGroupWhereInput = {
    AND?: MixRadiusOwnerGroupWhereInput | MixRadiusOwnerGroupWhereInput[]
    OR?: MixRadiusOwnerGroupWhereInput[]
    NOT?: MixRadiusOwnerGroupWhereInput | MixRadiusOwnerGroupWhereInput[]
    id?: StringFilter<"MixRadiusOwnerGroup"> | string
    name?: StringFilter<"MixRadiusOwnerGroup"> | string
    owners?: StringNullableListFilter<"MixRadiusOwnerGroup">
    siteId?: StringNullableFilter<"MixRadiusOwnerGroup"> | string | null
    isActive?: BoolFilter<"MixRadiusOwnerGroup"> | boolean
    createdAt?: DateTimeFilter<"MixRadiusOwnerGroup"> | Date | string
    updatedAt?: DateTimeFilter<"MixRadiusOwnerGroup"> | Date | string
  }

  export type MixRadiusOwnerGroupOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    owners?: SortOrder
    siteId?: SortOrderInput | SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MixRadiusOwnerGroupWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: MixRadiusOwnerGroupWhereInput | MixRadiusOwnerGroupWhereInput[]
    OR?: MixRadiusOwnerGroupWhereInput[]
    NOT?: MixRadiusOwnerGroupWhereInput | MixRadiusOwnerGroupWhereInput[]
    name?: StringFilter<"MixRadiusOwnerGroup"> | string
    owners?: StringNullableListFilter<"MixRadiusOwnerGroup">
    siteId?: StringNullableFilter<"MixRadiusOwnerGroup"> | string | null
    isActive?: BoolFilter<"MixRadiusOwnerGroup"> | boolean
    createdAt?: DateTimeFilter<"MixRadiusOwnerGroup"> | Date | string
    updatedAt?: DateTimeFilter<"MixRadiusOwnerGroup"> | Date | string
  }, "id">

  export type MixRadiusOwnerGroupOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    owners?: SortOrder
    siteId?: SortOrderInput | SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: MixRadiusOwnerGroupCountOrderByAggregateInput
    _max?: MixRadiusOwnerGroupMaxOrderByAggregateInput
    _min?: MixRadiusOwnerGroupMinOrderByAggregateInput
  }

  export type MixRadiusOwnerGroupScalarWhereWithAggregatesInput = {
    AND?: MixRadiusOwnerGroupScalarWhereWithAggregatesInput | MixRadiusOwnerGroupScalarWhereWithAggregatesInput[]
    OR?: MixRadiusOwnerGroupScalarWhereWithAggregatesInput[]
    NOT?: MixRadiusOwnerGroupScalarWhereWithAggregatesInput | MixRadiusOwnerGroupScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"MixRadiusOwnerGroup"> | string
    name?: StringWithAggregatesFilter<"MixRadiusOwnerGroup"> | string
    owners?: StringNullableListFilter<"MixRadiusOwnerGroup">
    siteId?: StringNullableWithAggregatesFilter<"MixRadiusOwnerGroup"> | string | null
    isActive?: BoolWithAggregatesFilter<"MixRadiusOwnerGroup"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"MixRadiusOwnerGroup"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"MixRadiusOwnerGroup"> | Date | string
  }

  export type MixRadiusInvestorSiteWhereInput = {
    AND?: MixRadiusInvestorSiteWhereInput | MixRadiusInvestorSiteWhereInput[]
    OR?: MixRadiusInvestorSiteWhereInput[]
    NOT?: MixRadiusInvestorSiteWhereInput | MixRadiusInvestorSiteWhereInput[]
    id?: StringFilter<"MixRadiusInvestorSite"> | string
    name?: StringFilter<"MixRadiusInvestorSite"> | string
    owners?: StringNullableListFilter<"MixRadiusInvestorSite">
    isActive?: BoolFilter<"MixRadiusInvestorSite"> | boolean
    createdAt?: DateTimeFilter<"MixRadiusInvestorSite"> | Date | string
    updatedAt?: DateTimeFilter<"MixRadiusInvestorSite"> | Date | string
  }

  export type MixRadiusInvestorSiteOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    owners?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MixRadiusInvestorSiteWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: MixRadiusInvestorSiteWhereInput | MixRadiusInvestorSiteWhereInput[]
    OR?: MixRadiusInvestorSiteWhereInput[]
    NOT?: MixRadiusInvestorSiteWhereInput | MixRadiusInvestorSiteWhereInput[]
    name?: StringFilter<"MixRadiusInvestorSite"> | string
    owners?: StringNullableListFilter<"MixRadiusInvestorSite">
    isActive?: BoolFilter<"MixRadiusInvestorSite"> | boolean
    createdAt?: DateTimeFilter<"MixRadiusInvestorSite"> | Date | string
    updatedAt?: DateTimeFilter<"MixRadiusInvestorSite"> | Date | string
  }, "id">

  export type MixRadiusInvestorSiteOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    owners?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: MixRadiusInvestorSiteCountOrderByAggregateInput
    _max?: MixRadiusInvestorSiteMaxOrderByAggregateInput
    _min?: MixRadiusInvestorSiteMinOrderByAggregateInput
  }

  export type MixRadiusInvestorSiteScalarWhereWithAggregatesInput = {
    AND?: MixRadiusInvestorSiteScalarWhereWithAggregatesInput | MixRadiusInvestorSiteScalarWhereWithAggregatesInput[]
    OR?: MixRadiusInvestorSiteScalarWhereWithAggregatesInput[]
    NOT?: MixRadiusInvestorSiteScalarWhereWithAggregatesInput | MixRadiusInvestorSiteScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"MixRadiusInvestorSite"> | string
    name?: StringWithAggregatesFilter<"MixRadiusInvestorSite"> | string
    owners?: StringNullableListFilter<"MixRadiusInvestorSite">
    isActive?: BoolWithAggregatesFilter<"MixRadiusInvestorSite"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"MixRadiusInvestorSite"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"MixRadiusInvestorSite"> | Date | string
  }

  export type MixRadiusConfigWhereInput = {
    AND?: MixRadiusConfigWhereInput | MixRadiusConfigWhereInput[]
    OR?: MixRadiusConfigWhereInput[]
    NOT?: MixRadiusConfigWhereInput | MixRadiusConfigWhereInput[]
    id?: StringFilter<"MixRadiusConfig"> | string
    name?: StringFilter<"MixRadiusConfig"> | string
    apiUrl?: StringFilter<"MixRadiusConfig"> | string
    username?: StringFilter<"MixRadiusConfig"> | string
    password?: StringFilter<"MixRadiusConfig"> | string
    apiKey?: StringFilter<"MixRadiusConfig"> | string
    isDefault?: BoolFilter<"MixRadiusConfig"> | boolean
    lastSyncedAt?: DateTimeNullableFilter<"MixRadiusConfig"> | Date | string | null
    createdAt?: DateTimeFilter<"MixRadiusConfig"> | Date | string
    updatedAt?: DateTimeFilter<"MixRadiusConfig"> | Date | string
  }

  export type MixRadiusConfigOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    apiUrl?: SortOrder
    username?: SortOrder
    password?: SortOrder
    apiKey?: SortOrder
    isDefault?: SortOrder
    lastSyncedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MixRadiusConfigWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: MixRadiusConfigWhereInput | MixRadiusConfigWhereInput[]
    OR?: MixRadiusConfigWhereInput[]
    NOT?: MixRadiusConfigWhereInput | MixRadiusConfigWhereInput[]
    name?: StringFilter<"MixRadiusConfig"> | string
    apiUrl?: StringFilter<"MixRadiusConfig"> | string
    username?: StringFilter<"MixRadiusConfig"> | string
    password?: StringFilter<"MixRadiusConfig"> | string
    apiKey?: StringFilter<"MixRadiusConfig"> | string
    isDefault?: BoolFilter<"MixRadiusConfig"> | boolean
    lastSyncedAt?: DateTimeNullableFilter<"MixRadiusConfig"> | Date | string | null
    createdAt?: DateTimeFilter<"MixRadiusConfig"> | Date | string
    updatedAt?: DateTimeFilter<"MixRadiusConfig"> | Date | string
  }, "id">

  export type MixRadiusConfigOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    apiUrl?: SortOrder
    username?: SortOrder
    password?: SortOrder
    apiKey?: SortOrder
    isDefault?: SortOrder
    lastSyncedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: MixRadiusConfigCountOrderByAggregateInput
    _max?: MixRadiusConfigMaxOrderByAggregateInput
    _min?: MixRadiusConfigMinOrderByAggregateInput
  }

  export type MixRadiusConfigScalarWhereWithAggregatesInput = {
    AND?: MixRadiusConfigScalarWhereWithAggregatesInput | MixRadiusConfigScalarWhereWithAggregatesInput[]
    OR?: MixRadiusConfigScalarWhereWithAggregatesInput[]
    NOT?: MixRadiusConfigScalarWhereWithAggregatesInput | MixRadiusConfigScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"MixRadiusConfig"> | string
    name?: StringWithAggregatesFilter<"MixRadiusConfig"> | string
    apiUrl?: StringWithAggregatesFilter<"MixRadiusConfig"> | string
    username?: StringWithAggregatesFilter<"MixRadiusConfig"> | string
    password?: StringWithAggregatesFilter<"MixRadiusConfig"> | string
    apiKey?: StringWithAggregatesFilter<"MixRadiusConfig"> | string
    isDefault?: BoolWithAggregatesFilter<"MixRadiusConfig"> | boolean
    lastSyncedAt?: DateTimeNullableWithAggregatesFilter<"MixRadiusConfig"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"MixRadiusConfig"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"MixRadiusConfig"> | Date | string
  }

  export type InvoiceCreateInput = {
    id: string
    invoiceNumber: string
    pelangganId: string
    issueDate?: Date | string
    dueDate: Date | string
    status?: $Enums.InvoiceStatus
    subtotal?: bigint | number
    taxAmount?: bigint | number
    discountAmount?: bigint | number
    totalAmount?: bigint | number
    paidAmount?: bigint | number
    notes?: string | null
    terms?: string | null
    sentAt?: Date | string | null
    paidAt?: Date | string | null
    createdBy?: string | null
    createdAt?: Date | string
    updatedAt: Date | string
    siteId?: string | null
    invoiceItem?: InvoiceItemCreateNestedManyWithoutInvoiceInput
    payment?: PaymentCreateNestedManyWithoutInvoiceInput
  }

  export type InvoiceUncheckedCreateInput = {
    id: string
    invoiceNumber: string
    pelangganId: string
    issueDate?: Date | string
    dueDate: Date | string
    status?: $Enums.InvoiceStatus
    subtotal?: bigint | number
    taxAmount?: bigint | number
    discountAmount?: bigint | number
    totalAmount?: bigint | number
    paidAmount?: bigint | number
    notes?: string | null
    terms?: string | null
    sentAt?: Date | string | null
    paidAt?: Date | string | null
    createdBy?: string | null
    createdAt?: Date | string
    updatedAt: Date | string
    siteId?: string | null
    invoiceItem?: InvoiceItemUncheckedCreateNestedManyWithoutInvoiceInput
    payment?: PaymentUncheckedCreateNestedManyWithoutInvoiceInput
  }

  export type InvoiceUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceNumber?: StringFieldUpdateOperationsInput | string
    pelangganId?: StringFieldUpdateOperationsInput | string
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    terms?: NullableStringFieldUpdateOperationsInput | string | null
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceItem?: InvoiceItemUpdateManyWithoutInvoiceNestedInput
    payment?: PaymentUpdateManyWithoutInvoiceNestedInput
  }

  export type InvoiceUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceNumber?: StringFieldUpdateOperationsInput | string
    pelangganId?: StringFieldUpdateOperationsInput | string
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    terms?: NullableStringFieldUpdateOperationsInput | string | null
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceItem?: InvoiceItemUncheckedUpdateManyWithoutInvoiceNestedInput
    payment?: PaymentUncheckedUpdateManyWithoutInvoiceNestedInput
  }

  export type InvoiceCreateManyInput = {
    id: string
    invoiceNumber: string
    pelangganId: string
    issueDate?: Date | string
    dueDate: Date | string
    status?: $Enums.InvoiceStatus
    subtotal?: bigint | number
    taxAmount?: bigint | number
    discountAmount?: bigint | number
    totalAmount?: bigint | number
    paidAmount?: bigint | number
    notes?: string | null
    terms?: string | null
    sentAt?: Date | string | null
    paidAt?: Date | string | null
    createdBy?: string | null
    createdAt?: Date | string
    updatedAt: Date | string
    siteId?: string | null
  }

  export type InvoiceUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceNumber?: StringFieldUpdateOperationsInput | string
    pelangganId?: StringFieldUpdateOperationsInput | string
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    terms?: NullableStringFieldUpdateOperationsInput | string | null
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type InvoiceUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceNumber?: StringFieldUpdateOperationsInput | string
    pelangganId?: StringFieldUpdateOperationsInput | string
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    terms?: NullableStringFieldUpdateOperationsInput | string | null
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type InvoiceItemCreateInput = {
    id: string
    description: string
    quantity?: number
    unitPrice: bigint | number
    totalPrice: bigint | number
    itemType?: $Enums.ItemType
    invoice: InvoiceCreateNestedOneWithoutInvoiceItemInput
  }

  export type InvoiceItemUncheckedCreateInput = {
    id: string
    invoiceId: string
    description: string
    quantity?: number
    unitPrice: bigint | number
    totalPrice: bigint | number
    itemType?: $Enums.ItemType
  }

  export type InvoiceItemUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    unitPrice?: BigIntFieldUpdateOperationsInput | bigint | number
    totalPrice?: BigIntFieldUpdateOperationsInput | bigint | number
    itemType?: EnumItemTypeFieldUpdateOperationsInput | $Enums.ItemType
    invoice?: InvoiceUpdateOneRequiredWithoutInvoiceItemNestedInput
  }

  export type InvoiceItemUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceId?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    unitPrice?: BigIntFieldUpdateOperationsInput | bigint | number
    totalPrice?: BigIntFieldUpdateOperationsInput | bigint | number
    itemType?: EnumItemTypeFieldUpdateOperationsInput | $Enums.ItemType
  }

  export type InvoiceItemCreateManyInput = {
    id: string
    invoiceId: string
    description: string
    quantity?: number
    unitPrice: bigint | number
    totalPrice: bigint | number
    itemType?: $Enums.ItemType
  }

  export type InvoiceItemUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    unitPrice?: BigIntFieldUpdateOperationsInput | bigint | number
    totalPrice?: BigIntFieldUpdateOperationsInput | bigint | number
    itemType?: EnumItemTypeFieldUpdateOperationsInput | $Enums.ItemType
  }

  export type InvoiceItemUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceId?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    unitPrice?: BigIntFieldUpdateOperationsInput | bigint | number
    totalPrice?: BigIntFieldUpdateOperationsInput | bigint | number
    itemType?: EnumItemTypeFieldUpdateOperationsInput | $Enums.ItemType
  }

  export type PaymentCreateInput = {
    id: string
    pelangganId: string
    amount: bigint | number
    paymentDate: Date | string
    paymentMethod: $Enums.PaymentMethod
    reference?: string | null
    notes?: string | null
    verifiedBy?: string | null
    verifiedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt: Date | string
    accountId?: string | null
    gatewayStatus?: $Enums.GatewayPaymentStatus | null
    gatewayProvider?: string | null
    transactionId?: string | null
    paymentUrl?: string | null
    expiresAt?: Date | string | null
    receiptUrl?: string | null
    invoice?: InvoiceCreateNestedOneWithoutPaymentInput
    unmatchedMutation?: UnmatchedMutationCreateNestedOneWithoutPaymentInput
  }

  export type PaymentUncheckedCreateInput = {
    id: string
    invoiceId?: string | null
    pelangganId: string
    amount: bigint | number
    paymentDate: Date | string
    paymentMethod: $Enums.PaymentMethod
    reference?: string | null
    notes?: string | null
    verifiedBy?: string | null
    verifiedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt: Date | string
    accountId?: string | null
    gatewayStatus?: $Enums.GatewayPaymentStatus | null
    gatewayProvider?: string | null
    transactionId?: string | null
    paymentUrl?: string | null
    expiresAt?: Date | string | null
    unmatchedMutationId?: string | null
    receiptUrl?: string | null
  }

  export type PaymentUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    pelangganId?: StringFieldUpdateOperationsInput | string
    amount?: BigIntFieldUpdateOperationsInput | bigint | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: EnumPaymentMethodFieldUpdateOperationsInput | $Enums.PaymentMethod
    reference?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayStatus?: NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput | $Enums.GatewayPaymentStatus | null
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null
    invoice?: InvoiceUpdateOneWithoutPaymentNestedInput
    unmatchedMutation?: UnmatchedMutationUpdateOneWithoutPaymentNestedInput
  }

  export type PaymentUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceId?: NullableStringFieldUpdateOperationsInput | string | null
    pelangganId?: StringFieldUpdateOperationsInput | string
    amount?: BigIntFieldUpdateOperationsInput | bigint | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: EnumPaymentMethodFieldUpdateOperationsInput | $Enums.PaymentMethod
    reference?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayStatus?: NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput | $Enums.GatewayPaymentStatus | null
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    unmatchedMutationId?: NullableStringFieldUpdateOperationsInput | string | null
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type PaymentCreateManyInput = {
    id: string
    invoiceId?: string | null
    pelangganId: string
    amount: bigint | number
    paymentDate: Date | string
    paymentMethod: $Enums.PaymentMethod
    reference?: string | null
    notes?: string | null
    verifiedBy?: string | null
    verifiedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt: Date | string
    accountId?: string | null
    gatewayStatus?: $Enums.GatewayPaymentStatus | null
    gatewayProvider?: string | null
    transactionId?: string | null
    paymentUrl?: string | null
    expiresAt?: Date | string | null
    unmatchedMutationId?: string | null
    receiptUrl?: string | null
  }

  export type PaymentUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    pelangganId?: StringFieldUpdateOperationsInput | string
    amount?: BigIntFieldUpdateOperationsInput | bigint | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: EnumPaymentMethodFieldUpdateOperationsInput | $Enums.PaymentMethod
    reference?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayStatus?: NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput | $Enums.GatewayPaymentStatus | null
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type PaymentUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceId?: NullableStringFieldUpdateOperationsInput | string | null
    pelangganId?: StringFieldUpdateOperationsInput | string
    amount?: BigIntFieldUpdateOperationsInput | bigint | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: EnumPaymentMethodFieldUpdateOperationsInput | $Enums.PaymentMethod
    reference?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayStatus?: NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput | $Enums.GatewayPaymentStatus | null
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    unmatchedMutationId?: NullableStringFieldUpdateOperationsInput | string | null
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type PaymentGatewayConfigCreateInput = {
    id: string
    provider: string
    providerName: string
    isEnabled?: boolean
    isProduction?: boolean
    priority?: number
    apiKey?: string | null
    apiSecret?: string | null
    clientKey?: string | null
    merchantId?: string | null
    webhookUrl?: string | null
    callbackUrl?: string | null
    settings?: NullableJsonNullValueInput | InputJsonValue
    lastTestedAt?: Date | string | null
    testStatus?: string | null
    createdAt?: Date | string
    updatedAt: Date | string
    createdBy?: string | null
  }

  export type PaymentGatewayConfigUncheckedCreateInput = {
    id: string
    provider: string
    providerName: string
    isEnabled?: boolean
    isProduction?: boolean
    priority?: number
    apiKey?: string | null
    apiSecret?: string | null
    clientKey?: string | null
    merchantId?: string | null
    webhookUrl?: string | null
    callbackUrl?: string | null
    settings?: NullableJsonNullValueInput | InputJsonValue
    lastTestedAt?: Date | string | null
    testStatus?: string | null
    createdAt?: Date | string
    updatedAt: Date | string
    createdBy?: string | null
  }

  export type PaymentGatewayConfigUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    providerName?: StringFieldUpdateOperationsInput | string
    isEnabled?: BoolFieldUpdateOperationsInput | boolean
    isProduction?: BoolFieldUpdateOperationsInput | boolean
    priority?: IntFieldUpdateOperationsInput | number
    apiKey?: NullableStringFieldUpdateOperationsInput | string | null
    apiSecret?: NullableStringFieldUpdateOperationsInput | string | null
    clientKey?: NullableStringFieldUpdateOperationsInput | string | null
    merchantId?: NullableStringFieldUpdateOperationsInput | string | null
    webhookUrl?: NullableStringFieldUpdateOperationsInput | string | null
    callbackUrl?: NullableStringFieldUpdateOperationsInput | string | null
    settings?: NullableJsonNullValueInput | InputJsonValue
    lastTestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    testStatus?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type PaymentGatewayConfigUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    providerName?: StringFieldUpdateOperationsInput | string
    isEnabled?: BoolFieldUpdateOperationsInput | boolean
    isProduction?: BoolFieldUpdateOperationsInput | boolean
    priority?: IntFieldUpdateOperationsInput | number
    apiKey?: NullableStringFieldUpdateOperationsInput | string | null
    apiSecret?: NullableStringFieldUpdateOperationsInput | string | null
    clientKey?: NullableStringFieldUpdateOperationsInput | string | null
    merchantId?: NullableStringFieldUpdateOperationsInput | string | null
    webhookUrl?: NullableStringFieldUpdateOperationsInput | string | null
    callbackUrl?: NullableStringFieldUpdateOperationsInput | string | null
    settings?: NullableJsonNullValueInput | InputJsonValue
    lastTestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    testStatus?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type PaymentGatewayConfigCreateManyInput = {
    id: string
    provider: string
    providerName: string
    isEnabled?: boolean
    isProduction?: boolean
    priority?: number
    apiKey?: string | null
    apiSecret?: string | null
    clientKey?: string | null
    merchantId?: string | null
    webhookUrl?: string | null
    callbackUrl?: string | null
    settings?: NullableJsonNullValueInput | InputJsonValue
    lastTestedAt?: Date | string | null
    testStatus?: string | null
    createdAt?: Date | string
    updatedAt: Date | string
    createdBy?: string | null
  }

  export type PaymentGatewayConfigUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    providerName?: StringFieldUpdateOperationsInput | string
    isEnabled?: BoolFieldUpdateOperationsInput | boolean
    isProduction?: BoolFieldUpdateOperationsInput | boolean
    priority?: IntFieldUpdateOperationsInput | number
    apiKey?: NullableStringFieldUpdateOperationsInput | string | null
    apiSecret?: NullableStringFieldUpdateOperationsInput | string | null
    clientKey?: NullableStringFieldUpdateOperationsInput | string | null
    merchantId?: NullableStringFieldUpdateOperationsInput | string | null
    webhookUrl?: NullableStringFieldUpdateOperationsInput | string | null
    callbackUrl?: NullableStringFieldUpdateOperationsInput | string | null
    settings?: NullableJsonNullValueInput | InputJsonValue
    lastTestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    testStatus?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type PaymentGatewayConfigUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    providerName?: StringFieldUpdateOperationsInput | string
    isEnabled?: BoolFieldUpdateOperationsInput | boolean
    isProduction?: BoolFieldUpdateOperationsInput | boolean
    priority?: IntFieldUpdateOperationsInput | number
    apiKey?: NullableStringFieldUpdateOperationsInput | string | null
    apiSecret?: NullableStringFieldUpdateOperationsInput | string | null
    clientKey?: NullableStringFieldUpdateOperationsInput | string | null
    merchantId?: NullableStringFieldUpdateOperationsInput | string | null
    webhookUrl?: NullableStringFieldUpdateOperationsInput | string | null
    callbackUrl?: NullableStringFieldUpdateOperationsInput | string | null
    settings?: NullableJsonNullValueInput | InputJsonValue
    lastTestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    testStatus?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type UnmatchedMutationCreateInput = {
    id?: string
    provider?: string
    transactionId?: string | null
    amount: Decimal | DecimalJsLike | number | string
    description?: string | null
    type?: string | null
    date: Date | string
    bankId?: string | null
    rawPayload?: NullableJsonNullValueInput | InputJsonValue
    status?: $Enums.UnmatchedStatus
    resolvedAt?: Date | string | null
    resolvedById?: string | null
    matchedInvoiceId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    payment?: PaymentCreateNestedOneWithoutUnmatchedMutationInput
  }

  export type UnmatchedMutationUncheckedCreateInput = {
    id?: string
    provider?: string
    transactionId?: string | null
    amount: Decimal | DecimalJsLike | number | string
    description?: string | null
    type?: string | null
    date: Date | string
    bankId?: string | null
    rawPayload?: NullableJsonNullValueInput | InputJsonValue
    status?: $Enums.UnmatchedStatus
    resolvedAt?: Date | string | null
    resolvedById?: string | null
    matchedInvoiceId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    payment?: PaymentUncheckedCreateNestedOneWithoutUnmatchedMutationInput
  }

  export type UnmatchedMutationUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    type?: NullableStringFieldUpdateOperationsInput | string | null
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    bankId?: NullableStringFieldUpdateOperationsInput | string | null
    rawPayload?: NullableJsonNullValueInput | InputJsonValue
    status?: EnumUnmatchedStatusFieldUpdateOperationsInput | $Enums.UnmatchedStatus
    resolvedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    resolvedById?: NullableStringFieldUpdateOperationsInput | string | null
    matchedInvoiceId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    payment?: PaymentUpdateOneWithoutUnmatchedMutationNestedInput
  }

  export type UnmatchedMutationUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    type?: NullableStringFieldUpdateOperationsInput | string | null
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    bankId?: NullableStringFieldUpdateOperationsInput | string | null
    rawPayload?: NullableJsonNullValueInput | InputJsonValue
    status?: EnumUnmatchedStatusFieldUpdateOperationsInput | $Enums.UnmatchedStatus
    resolvedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    resolvedById?: NullableStringFieldUpdateOperationsInput | string | null
    matchedInvoiceId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    payment?: PaymentUncheckedUpdateOneWithoutUnmatchedMutationNestedInput
  }

  export type UnmatchedMutationCreateManyInput = {
    id?: string
    provider?: string
    transactionId?: string | null
    amount: Decimal | DecimalJsLike | number | string
    description?: string | null
    type?: string | null
    date: Date | string
    bankId?: string | null
    rawPayload?: NullableJsonNullValueInput | InputJsonValue
    status?: $Enums.UnmatchedStatus
    resolvedAt?: Date | string | null
    resolvedById?: string | null
    matchedInvoiceId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UnmatchedMutationUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    type?: NullableStringFieldUpdateOperationsInput | string | null
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    bankId?: NullableStringFieldUpdateOperationsInput | string | null
    rawPayload?: NullableJsonNullValueInput | InputJsonValue
    status?: EnumUnmatchedStatusFieldUpdateOperationsInput | $Enums.UnmatchedStatus
    resolvedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    resolvedById?: NullableStringFieldUpdateOperationsInput | string | null
    matchedInvoiceId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UnmatchedMutationUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    type?: NullableStringFieldUpdateOperationsInput | string | null
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    bankId?: NullableStringFieldUpdateOperationsInput | string | null
    rawPayload?: NullableJsonNullValueInput | InputJsonValue
    status?: EnumUnmatchedStatusFieldUpdateOperationsInput | $Enums.UnmatchedStatus
    resolvedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    resolvedById?: NullableStringFieldUpdateOperationsInput | string | null
    matchedInvoiceId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionCreateInput = {
    id?: string
    date?: Date | string
    amount: number
    type: $Enums.TransactionType
    description?: string | null
    referenceId?: string | null
    accountId?: string | null
    purchaseOrderId?: string | null
    createdById: string
    attachments?: TransactionCreateattachmentsInput | string[]
    createdAt?: Date | string
    updatedAt?: Date | string
    category: TransactionCategoryCreateNestedOneWithoutTransactionsInput
  }

  export type TransactionUncheckedCreateInput = {
    id?: string
    date?: Date | string
    amount: number
    type: $Enums.TransactionType
    description?: string | null
    referenceId?: string | null
    categoryId: string
    accountId?: string | null
    purchaseOrderId?: string | null
    createdById: string
    attachments?: TransactionCreateattachmentsInput | string[]
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TransactionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    amount?: FloatFieldUpdateOperationsInput | number
    type?: EnumTransactionTypeFieldUpdateOperationsInput | $Enums.TransactionType
    description?: NullableStringFieldUpdateOperationsInput | string | null
    referenceId?: NullableStringFieldUpdateOperationsInput | string | null
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    purchaseOrderId?: NullableStringFieldUpdateOperationsInput | string | null
    createdById?: StringFieldUpdateOperationsInput | string
    attachments?: TransactionUpdateattachmentsInput | string[]
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    category?: TransactionCategoryUpdateOneRequiredWithoutTransactionsNestedInput
  }

  export type TransactionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    amount?: FloatFieldUpdateOperationsInput | number
    type?: EnumTransactionTypeFieldUpdateOperationsInput | $Enums.TransactionType
    description?: NullableStringFieldUpdateOperationsInput | string | null
    referenceId?: NullableStringFieldUpdateOperationsInput | string | null
    categoryId?: StringFieldUpdateOperationsInput | string
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    purchaseOrderId?: NullableStringFieldUpdateOperationsInput | string | null
    createdById?: StringFieldUpdateOperationsInput | string
    attachments?: TransactionUpdateattachmentsInput | string[]
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionCreateManyInput = {
    id?: string
    date?: Date | string
    amount: number
    type: $Enums.TransactionType
    description?: string | null
    referenceId?: string | null
    categoryId: string
    accountId?: string | null
    purchaseOrderId?: string | null
    createdById: string
    attachments?: TransactionCreateattachmentsInput | string[]
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TransactionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    amount?: FloatFieldUpdateOperationsInput | number
    type?: EnumTransactionTypeFieldUpdateOperationsInput | $Enums.TransactionType
    description?: NullableStringFieldUpdateOperationsInput | string | null
    referenceId?: NullableStringFieldUpdateOperationsInput | string | null
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    purchaseOrderId?: NullableStringFieldUpdateOperationsInput | string | null
    createdById?: StringFieldUpdateOperationsInput | string
    attachments?: TransactionUpdateattachmentsInput | string[]
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    amount?: FloatFieldUpdateOperationsInput | number
    type?: EnumTransactionTypeFieldUpdateOperationsInput | $Enums.TransactionType
    description?: NullableStringFieldUpdateOperationsInput | string | null
    referenceId?: NullableStringFieldUpdateOperationsInput | string | null
    categoryId?: StringFieldUpdateOperationsInput | string
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    purchaseOrderId?: NullableStringFieldUpdateOperationsInput | string | null
    createdById?: StringFieldUpdateOperationsInput | string
    attachments?: TransactionUpdateattachmentsInput | string[]
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionCategoryCreateInput = {
    id?: string
    name: string
    type: $Enums.TransactionType
    expenseType?: $Enums.ExpenseType | null
    description?: string | null
    isSystem?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    transactions?: TransactionCreateNestedManyWithoutCategoryInput
  }

  export type TransactionCategoryUncheckedCreateInput = {
    id?: string
    name: string
    type: $Enums.TransactionType
    expenseType?: $Enums.ExpenseType | null
    description?: string | null
    isSystem?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    transactions?: TransactionUncheckedCreateNestedManyWithoutCategoryInput
  }

  export type TransactionCategoryUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: EnumTransactionTypeFieldUpdateOperationsInput | $Enums.TransactionType
    expenseType?: NullableEnumExpenseTypeFieldUpdateOperationsInput | $Enums.ExpenseType | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    isSystem?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    transactions?: TransactionUpdateManyWithoutCategoryNestedInput
  }

  export type TransactionCategoryUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: EnumTransactionTypeFieldUpdateOperationsInput | $Enums.TransactionType
    expenseType?: NullableEnumExpenseTypeFieldUpdateOperationsInput | $Enums.ExpenseType | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    isSystem?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    transactions?: TransactionUncheckedUpdateManyWithoutCategoryNestedInput
  }

  export type TransactionCategoryCreateManyInput = {
    id?: string
    name: string
    type: $Enums.TransactionType
    expenseType?: $Enums.ExpenseType | null
    description?: string | null
    isSystem?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TransactionCategoryUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: EnumTransactionTypeFieldUpdateOperationsInput | $Enums.TransactionType
    expenseType?: NullableEnumExpenseTypeFieldUpdateOperationsInput | $Enums.ExpenseType | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    isSystem?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionCategoryUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: EnumTransactionTypeFieldUpdateOperationsInput | $Enums.TransactionType
    expenseType?: NullableEnumExpenseTypeFieldUpdateOperationsInput | $Enums.ExpenseType | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    isSystem?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusInvoiceCreateInput = {
    id?: string
    invoiceNumber: string
    mixRadiusId?: string | null
    username: string
    fullName?: string | null
    ownerName?: string | null
    planName?: string | null
    amount: Decimal | DecimalJsLike | number | string
    status: string
    paymentMethod?: string | null
    issuedDate: Date | string
    dueDate?: Date | string | null
    expiredOn?: Date | string | null
    syncedAt?: Date | string
  }

  export type MixRadiusInvoiceUncheckedCreateInput = {
    id?: string
    invoiceNumber: string
    mixRadiusId?: string | null
    username: string
    fullName?: string | null
    ownerName?: string | null
    planName?: string | null
    amount: Decimal | DecimalJsLike | number | string
    status: string
    paymentMethod?: string | null
    issuedDate: Date | string
    dueDate?: Date | string | null
    expiredOn?: Date | string | null
    syncedAt?: Date | string
  }

  export type MixRadiusInvoiceUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceNumber?: StringFieldUpdateOperationsInput | string
    mixRadiusId?: NullableStringFieldUpdateOperationsInput | string | null
    username?: StringFieldUpdateOperationsInput | string
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    ownerName?: NullableStringFieldUpdateOperationsInput | string | null
    planName?: NullableStringFieldUpdateOperationsInput | string | null
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    status?: StringFieldUpdateOperationsInput | string
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    issuedDate?: DateTimeFieldUpdateOperationsInput | Date | string
    dueDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    expiredOn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    syncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusInvoiceUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceNumber?: StringFieldUpdateOperationsInput | string
    mixRadiusId?: NullableStringFieldUpdateOperationsInput | string | null
    username?: StringFieldUpdateOperationsInput | string
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    ownerName?: NullableStringFieldUpdateOperationsInput | string | null
    planName?: NullableStringFieldUpdateOperationsInput | string | null
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    status?: StringFieldUpdateOperationsInput | string
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    issuedDate?: DateTimeFieldUpdateOperationsInput | Date | string
    dueDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    expiredOn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    syncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusInvoiceCreateManyInput = {
    id?: string
    invoiceNumber: string
    mixRadiusId?: string | null
    username: string
    fullName?: string | null
    ownerName?: string | null
    planName?: string | null
    amount: Decimal | DecimalJsLike | number | string
    status: string
    paymentMethod?: string | null
    issuedDate: Date | string
    dueDate?: Date | string | null
    expiredOn?: Date | string | null
    syncedAt?: Date | string
  }

  export type MixRadiusInvoiceUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceNumber?: StringFieldUpdateOperationsInput | string
    mixRadiusId?: NullableStringFieldUpdateOperationsInput | string | null
    username?: StringFieldUpdateOperationsInput | string
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    ownerName?: NullableStringFieldUpdateOperationsInput | string | null
    planName?: NullableStringFieldUpdateOperationsInput | string | null
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    status?: StringFieldUpdateOperationsInput | string
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    issuedDate?: DateTimeFieldUpdateOperationsInput | Date | string
    dueDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    expiredOn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    syncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusInvoiceUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceNumber?: StringFieldUpdateOperationsInput | string
    mixRadiusId?: NullableStringFieldUpdateOperationsInput | string | null
    username?: StringFieldUpdateOperationsInput | string
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    ownerName?: NullableStringFieldUpdateOperationsInput | string | null
    planName?: NullableStringFieldUpdateOperationsInput | string | null
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    status?: StringFieldUpdateOperationsInput | string
    paymentMethod?: NullableStringFieldUpdateOperationsInput | string | null
    issuedDate?: DateTimeFieldUpdateOperationsInput | Date | string
    dueDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    expiredOn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    syncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusCustomerCreateInput = {
    id: string
    mixRadiusId: string
    username: string
    fullName?: string | null
    address?: string | null
    phoneNumber?: string | null
    planName?: string | null
    status?: string | null
    ownerName?: string | null
    expiredOn?: Date | string | null
    lastSyncedAt?: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MixRadiusCustomerUncheckedCreateInput = {
    id: string
    mixRadiusId: string
    username: string
    fullName?: string | null
    address?: string | null
    phoneNumber?: string | null
    planName?: string | null
    status?: string | null
    ownerName?: string | null
    expiredOn?: Date | string | null
    lastSyncedAt?: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MixRadiusCustomerUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    mixRadiusId?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    planName?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    ownerName?: NullableStringFieldUpdateOperationsInput | string | null
    expiredOn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastSyncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusCustomerUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    mixRadiusId?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    planName?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    ownerName?: NullableStringFieldUpdateOperationsInput | string | null
    expiredOn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastSyncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusCustomerCreateManyInput = {
    id: string
    mixRadiusId: string
    username: string
    fullName?: string | null
    address?: string | null
    phoneNumber?: string | null
    planName?: string | null
    status?: string | null
    ownerName?: string | null
    expiredOn?: Date | string | null
    lastSyncedAt?: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MixRadiusCustomerUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    mixRadiusId?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    planName?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    ownerName?: NullableStringFieldUpdateOperationsInput | string | null
    expiredOn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastSyncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusCustomerUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    mixRadiusId?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    fullName?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    phoneNumber?: NullableStringFieldUpdateOperationsInput | string | null
    planName?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    ownerName?: NullableStringFieldUpdateOperationsInput | string | null
    expiredOn?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastSyncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusOwnerGroupCreateInput = {
    id?: string
    name: string
    owners?: MixRadiusOwnerGroupCreateownersInput | string[]
    siteId?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MixRadiusOwnerGroupUncheckedCreateInput = {
    id?: string
    name: string
    owners?: MixRadiusOwnerGroupCreateownersInput | string[]
    siteId?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MixRadiusOwnerGroupUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    owners?: MixRadiusOwnerGroupUpdateownersInput | string[]
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusOwnerGroupUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    owners?: MixRadiusOwnerGroupUpdateownersInput | string[]
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusOwnerGroupCreateManyInput = {
    id?: string
    name: string
    owners?: MixRadiusOwnerGroupCreateownersInput | string[]
    siteId?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MixRadiusOwnerGroupUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    owners?: MixRadiusOwnerGroupUpdateownersInput | string[]
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusOwnerGroupUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    owners?: MixRadiusOwnerGroupUpdateownersInput | string[]
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusInvestorSiteCreateInput = {
    id?: string
    name: string
    owners?: MixRadiusInvestorSiteCreateownersInput | string[]
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MixRadiusInvestorSiteUncheckedCreateInput = {
    id?: string
    name: string
    owners?: MixRadiusInvestorSiteCreateownersInput | string[]
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MixRadiusInvestorSiteUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    owners?: MixRadiusInvestorSiteUpdateownersInput | string[]
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusInvestorSiteUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    owners?: MixRadiusInvestorSiteUpdateownersInput | string[]
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusInvestorSiteCreateManyInput = {
    id?: string
    name: string
    owners?: MixRadiusInvestorSiteCreateownersInput | string[]
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MixRadiusInvestorSiteUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    owners?: MixRadiusInvestorSiteUpdateownersInput | string[]
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusInvestorSiteUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    owners?: MixRadiusInvestorSiteUpdateownersInput | string[]
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusConfigCreateInput = {
    id?: string
    name?: string
    apiUrl: string
    username: string
    password: string
    apiKey: string
    isDefault?: boolean
    lastSyncedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MixRadiusConfigUncheckedCreateInput = {
    id?: string
    name?: string
    apiUrl: string
    username: string
    password: string
    apiKey: string
    isDefault?: boolean
    lastSyncedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MixRadiusConfigUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    apiUrl?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    apiKey?: StringFieldUpdateOperationsInput | string
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    lastSyncedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusConfigUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    apiUrl?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    apiKey?: StringFieldUpdateOperationsInput | string
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    lastSyncedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusConfigCreateManyInput = {
    id?: string
    name?: string
    apiUrl: string
    username: string
    password: string
    apiKey: string
    isDefault?: boolean
    lastSyncedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MixRadiusConfigUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    apiUrl?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    apiKey?: StringFieldUpdateOperationsInput | string
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    lastSyncedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MixRadiusConfigUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    apiUrl?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    apiKey?: StringFieldUpdateOperationsInput | string
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    lastSyncedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type EnumInvoiceStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.InvoiceStatus | EnumInvoiceStatusFieldRefInput<$PrismaModel>
    in?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumInvoiceStatusFilter<$PrismaModel> | $Enums.InvoiceStatus
  }

  export type BigIntFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntFilter<$PrismaModel> | bigint | number
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type InvoiceItemListRelationFilter = {
    every?: InvoiceItemWhereInput
    some?: InvoiceItemWhereInput
    none?: InvoiceItemWhereInput
  }

  export type PaymentListRelationFilter = {
    every?: PaymentWhereInput
    some?: PaymentWhereInput
    none?: PaymentWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type InvoiceItemOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PaymentOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type InvoiceCountOrderByAggregateInput = {
    id?: SortOrder
    invoiceNumber?: SortOrder
    pelangganId?: SortOrder
    issueDate?: SortOrder
    dueDate?: SortOrder
    status?: SortOrder
    subtotal?: SortOrder
    taxAmount?: SortOrder
    discountAmount?: SortOrder
    totalAmount?: SortOrder
    paidAmount?: SortOrder
    notes?: SortOrder
    terms?: SortOrder
    sentAt?: SortOrder
    paidAt?: SortOrder
    createdBy?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    siteId?: SortOrder
  }

  export type InvoiceAvgOrderByAggregateInput = {
    subtotal?: SortOrder
    taxAmount?: SortOrder
    discountAmount?: SortOrder
    totalAmount?: SortOrder
    paidAmount?: SortOrder
  }

  export type InvoiceMaxOrderByAggregateInput = {
    id?: SortOrder
    invoiceNumber?: SortOrder
    pelangganId?: SortOrder
    issueDate?: SortOrder
    dueDate?: SortOrder
    status?: SortOrder
    subtotal?: SortOrder
    taxAmount?: SortOrder
    discountAmount?: SortOrder
    totalAmount?: SortOrder
    paidAmount?: SortOrder
    notes?: SortOrder
    terms?: SortOrder
    sentAt?: SortOrder
    paidAt?: SortOrder
    createdBy?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    siteId?: SortOrder
  }

  export type InvoiceMinOrderByAggregateInput = {
    id?: SortOrder
    invoiceNumber?: SortOrder
    pelangganId?: SortOrder
    issueDate?: SortOrder
    dueDate?: SortOrder
    status?: SortOrder
    subtotal?: SortOrder
    taxAmount?: SortOrder
    discountAmount?: SortOrder
    totalAmount?: SortOrder
    paidAmount?: SortOrder
    notes?: SortOrder
    terms?: SortOrder
    sentAt?: SortOrder
    paidAt?: SortOrder
    createdBy?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    siteId?: SortOrder
  }

  export type InvoiceSumOrderByAggregateInput = {
    subtotal?: SortOrder
    taxAmount?: SortOrder
    discountAmount?: SortOrder
    totalAmount?: SortOrder
    paidAmount?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type EnumInvoiceStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.InvoiceStatus | EnumInvoiceStatusFieldRefInput<$PrismaModel>
    in?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumInvoiceStatusWithAggregatesFilter<$PrismaModel> | $Enums.InvoiceStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumInvoiceStatusFilter<$PrismaModel>
    _max?: NestedEnumInvoiceStatusFilter<$PrismaModel>
  }

  export type BigIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntWithAggregatesFilter<$PrismaModel> | bigint | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedBigIntFilter<$PrismaModel>
    _min?: NestedBigIntFilter<$PrismaModel>
    _max?: NestedBigIntFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type EnumItemTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.ItemType | EnumItemTypeFieldRefInput<$PrismaModel>
    in?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumItemTypeFilter<$PrismaModel> | $Enums.ItemType
  }

  export type InvoiceScalarRelationFilter = {
    is?: InvoiceWhereInput
    isNot?: InvoiceWhereInput
  }

  export type InvoiceItemCountOrderByAggregateInput = {
    id?: SortOrder
    invoiceId?: SortOrder
    description?: SortOrder
    quantity?: SortOrder
    unitPrice?: SortOrder
    totalPrice?: SortOrder
    itemType?: SortOrder
  }

  export type InvoiceItemAvgOrderByAggregateInput = {
    quantity?: SortOrder
    unitPrice?: SortOrder
    totalPrice?: SortOrder
  }

  export type InvoiceItemMaxOrderByAggregateInput = {
    id?: SortOrder
    invoiceId?: SortOrder
    description?: SortOrder
    quantity?: SortOrder
    unitPrice?: SortOrder
    totalPrice?: SortOrder
    itemType?: SortOrder
  }

  export type InvoiceItemMinOrderByAggregateInput = {
    id?: SortOrder
    invoiceId?: SortOrder
    description?: SortOrder
    quantity?: SortOrder
    unitPrice?: SortOrder
    totalPrice?: SortOrder
    itemType?: SortOrder
  }

  export type InvoiceItemSumOrderByAggregateInput = {
    quantity?: SortOrder
    unitPrice?: SortOrder
    totalPrice?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type EnumItemTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ItemType | EnumItemTypeFieldRefInput<$PrismaModel>
    in?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumItemTypeWithAggregatesFilter<$PrismaModel> | $Enums.ItemType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumItemTypeFilter<$PrismaModel>
    _max?: NestedEnumItemTypeFilter<$PrismaModel>
  }

  export type EnumPaymentMethodFilter<$PrismaModel = never> = {
    equals?: $Enums.PaymentMethod | EnumPaymentMethodFieldRefInput<$PrismaModel>
    in?: $Enums.PaymentMethod[] | ListEnumPaymentMethodFieldRefInput<$PrismaModel>
    notIn?: $Enums.PaymentMethod[] | ListEnumPaymentMethodFieldRefInput<$PrismaModel>
    not?: NestedEnumPaymentMethodFilter<$PrismaModel> | $Enums.PaymentMethod
  }

  export type EnumGatewayPaymentStatusNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.GatewayPaymentStatus | EnumGatewayPaymentStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.GatewayPaymentStatus[] | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.GatewayPaymentStatus[] | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumGatewayPaymentStatusNullableFilter<$PrismaModel> | $Enums.GatewayPaymentStatus | null
  }

  export type InvoiceNullableScalarRelationFilter = {
    is?: InvoiceWhereInput | null
    isNot?: InvoiceWhereInput | null
  }

  export type UnmatchedMutationNullableScalarRelationFilter = {
    is?: UnmatchedMutationWhereInput | null
    isNot?: UnmatchedMutationWhereInput | null
  }

  export type PaymentCountOrderByAggregateInput = {
    id?: SortOrder
    invoiceId?: SortOrder
    pelangganId?: SortOrder
    amount?: SortOrder
    paymentDate?: SortOrder
    paymentMethod?: SortOrder
    reference?: SortOrder
    notes?: SortOrder
    verifiedBy?: SortOrder
    verifiedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    accountId?: SortOrder
    gatewayStatus?: SortOrder
    gatewayProvider?: SortOrder
    transactionId?: SortOrder
    paymentUrl?: SortOrder
    expiresAt?: SortOrder
    unmatchedMutationId?: SortOrder
    receiptUrl?: SortOrder
  }

  export type PaymentAvgOrderByAggregateInput = {
    amount?: SortOrder
  }

  export type PaymentMaxOrderByAggregateInput = {
    id?: SortOrder
    invoiceId?: SortOrder
    pelangganId?: SortOrder
    amount?: SortOrder
    paymentDate?: SortOrder
    paymentMethod?: SortOrder
    reference?: SortOrder
    notes?: SortOrder
    verifiedBy?: SortOrder
    verifiedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    accountId?: SortOrder
    gatewayStatus?: SortOrder
    gatewayProvider?: SortOrder
    transactionId?: SortOrder
    paymentUrl?: SortOrder
    expiresAt?: SortOrder
    unmatchedMutationId?: SortOrder
    receiptUrl?: SortOrder
  }

  export type PaymentMinOrderByAggregateInput = {
    id?: SortOrder
    invoiceId?: SortOrder
    pelangganId?: SortOrder
    amount?: SortOrder
    paymentDate?: SortOrder
    paymentMethod?: SortOrder
    reference?: SortOrder
    notes?: SortOrder
    verifiedBy?: SortOrder
    verifiedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    accountId?: SortOrder
    gatewayStatus?: SortOrder
    gatewayProvider?: SortOrder
    transactionId?: SortOrder
    paymentUrl?: SortOrder
    expiresAt?: SortOrder
    unmatchedMutationId?: SortOrder
    receiptUrl?: SortOrder
  }

  export type PaymentSumOrderByAggregateInput = {
    amount?: SortOrder
  }

  export type EnumPaymentMethodWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PaymentMethod | EnumPaymentMethodFieldRefInput<$PrismaModel>
    in?: $Enums.PaymentMethod[] | ListEnumPaymentMethodFieldRefInput<$PrismaModel>
    notIn?: $Enums.PaymentMethod[] | ListEnumPaymentMethodFieldRefInput<$PrismaModel>
    not?: NestedEnumPaymentMethodWithAggregatesFilter<$PrismaModel> | $Enums.PaymentMethod
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPaymentMethodFilter<$PrismaModel>
    _max?: NestedEnumPaymentMethodFilter<$PrismaModel>
  }

  export type EnumGatewayPaymentStatusNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.GatewayPaymentStatus | EnumGatewayPaymentStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.GatewayPaymentStatus[] | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.GatewayPaymentStatus[] | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumGatewayPaymentStatusNullableWithAggregatesFilter<$PrismaModel> | $Enums.GatewayPaymentStatus | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumGatewayPaymentStatusNullableFilter<$PrismaModel>
    _max?: NestedEnumGatewayPaymentStatusNullableFilter<$PrismaModel>
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type PaymentGatewayConfigCountOrderByAggregateInput = {
    id?: SortOrder
    provider?: SortOrder
    providerName?: SortOrder
    isEnabled?: SortOrder
    isProduction?: SortOrder
    priority?: SortOrder
    apiKey?: SortOrder
    apiSecret?: SortOrder
    clientKey?: SortOrder
    merchantId?: SortOrder
    webhookUrl?: SortOrder
    callbackUrl?: SortOrder
    settings?: SortOrder
    lastTestedAt?: SortOrder
    testStatus?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    createdBy?: SortOrder
  }

  export type PaymentGatewayConfigAvgOrderByAggregateInput = {
    priority?: SortOrder
  }

  export type PaymentGatewayConfigMaxOrderByAggregateInput = {
    id?: SortOrder
    provider?: SortOrder
    providerName?: SortOrder
    isEnabled?: SortOrder
    isProduction?: SortOrder
    priority?: SortOrder
    apiKey?: SortOrder
    apiSecret?: SortOrder
    clientKey?: SortOrder
    merchantId?: SortOrder
    webhookUrl?: SortOrder
    callbackUrl?: SortOrder
    lastTestedAt?: SortOrder
    testStatus?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    createdBy?: SortOrder
  }

  export type PaymentGatewayConfigMinOrderByAggregateInput = {
    id?: SortOrder
    provider?: SortOrder
    providerName?: SortOrder
    isEnabled?: SortOrder
    isProduction?: SortOrder
    priority?: SortOrder
    apiKey?: SortOrder
    apiSecret?: SortOrder
    clientKey?: SortOrder
    merchantId?: SortOrder
    webhookUrl?: SortOrder
    callbackUrl?: SortOrder
    lastTestedAt?: SortOrder
    testStatus?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    createdBy?: SortOrder
  }

  export type PaymentGatewayConfigSumOrderByAggregateInput = {
    priority?: SortOrder
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type DecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type EnumUnmatchedStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.UnmatchedStatus | EnumUnmatchedStatusFieldRefInput<$PrismaModel>
    in?: $Enums.UnmatchedStatus[] | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.UnmatchedStatus[] | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumUnmatchedStatusFilter<$PrismaModel> | $Enums.UnmatchedStatus
  }

  export type PaymentNullableScalarRelationFilter = {
    is?: PaymentWhereInput | null
    isNot?: PaymentWhereInput | null
  }

  export type UnmatchedMutationCountOrderByAggregateInput = {
    id?: SortOrder
    provider?: SortOrder
    transactionId?: SortOrder
    amount?: SortOrder
    description?: SortOrder
    type?: SortOrder
    date?: SortOrder
    bankId?: SortOrder
    rawPayload?: SortOrder
    status?: SortOrder
    resolvedAt?: SortOrder
    resolvedById?: SortOrder
    matchedInvoiceId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UnmatchedMutationAvgOrderByAggregateInput = {
    amount?: SortOrder
  }

  export type UnmatchedMutationMaxOrderByAggregateInput = {
    id?: SortOrder
    provider?: SortOrder
    transactionId?: SortOrder
    amount?: SortOrder
    description?: SortOrder
    type?: SortOrder
    date?: SortOrder
    bankId?: SortOrder
    status?: SortOrder
    resolvedAt?: SortOrder
    resolvedById?: SortOrder
    matchedInvoiceId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UnmatchedMutationMinOrderByAggregateInput = {
    id?: SortOrder
    provider?: SortOrder
    transactionId?: SortOrder
    amount?: SortOrder
    description?: SortOrder
    type?: SortOrder
    date?: SortOrder
    bankId?: SortOrder
    status?: SortOrder
    resolvedAt?: SortOrder
    resolvedById?: SortOrder
    matchedInvoiceId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UnmatchedMutationSumOrderByAggregateInput = {
    amount?: SortOrder
  }

  export type DecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type EnumUnmatchedStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.UnmatchedStatus | EnumUnmatchedStatusFieldRefInput<$PrismaModel>
    in?: $Enums.UnmatchedStatus[] | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.UnmatchedStatus[] | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumUnmatchedStatusWithAggregatesFilter<$PrismaModel> | $Enums.UnmatchedStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumUnmatchedStatusFilter<$PrismaModel>
    _max?: NestedEnumUnmatchedStatusFilter<$PrismaModel>
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type EnumTransactionTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.TransactionType | EnumTransactionTypeFieldRefInput<$PrismaModel>
    in?: $Enums.TransactionType[] | ListEnumTransactionTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.TransactionType[] | ListEnumTransactionTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumTransactionTypeFilter<$PrismaModel> | $Enums.TransactionType
  }

  export type StringNullableListFilter<$PrismaModel = never> = {
    equals?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    has?: string | StringFieldRefInput<$PrismaModel> | null
    hasEvery?: string[] | ListStringFieldRefInput<$PrismaModel>
    hasSome?: string[] | ListStringFieldRefInput<$PrismaModel>
    isEmpty?: boolean
  }

  export type TransactionCategoryScalarRelationFilter = {
    is?: TransactionCategoryWhereInput
    isNot?: TransactionCategoryWhereInput
  }

  export type TransactionCountOrderByAggregateInput = {
    id?: SortOrder
    date?: SortOrder
    amount?: SortOrder
    type?: SortOrder
    description?: SortOrder
    referenceId?: SortOrder
    categoryId?: SortOrder
    accountId?: SortOrder
    purchaseOrderId?: SortOrder
    createdById?: SortOrder
    attachments?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TransactionAvgOrderByAggregateInput = {
    amount?: SortOrder
  }

  export type TransactionMaxOrderByAggregateInput = {
    id?: SortOrder
    date?: SortOrder
    amount?: SortOrder
    type?: SortOrder
    description?: SortOrder
    referenceId?: SortOrder
    categoryId?: SortOrder
    accountId?: SortOrder
    purchaseOrderId?: SortOrder
    createdById?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TransactionMinOrderByAggregateInput = {
    id?: SortOrder
    date?: SortOrder
    amount?: SortOrder
    type?: SortOrder
    description?: SortOrder
    referenceId?: SortOrder
    categoryId?: SortOrder
    accountId?: SortOrder
    purchaseOrderId?: SortOrder
    createdById?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TransactionSumOrderByAggregateInput = {
    amount?: SortOrder
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type EnumTransactionTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.TransactionType | EnumTransactionTypeFieldRefInput<$PrismaModel>
    in?: $Enums.TransactionType[] | ListEnumTransactionTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.TransactionType[] | ListEnumTransactionTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumTransactionTypeWithAggregatesFilter<$PrismaModel> | $Enums.TransactionType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumTransactionTypeFilter<$PrismaModel>
    _max?: NestedEnumTransactionTypeFilter<$PrismaModel>
  }

  export type EnumExpenseTypeNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.ExpenseType | EnumExpenseTypeFieldRefInput<$PrismaModel> | null
    in?: $Enums.ExpenseType[] | ListEnumExpenseTypeFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.ExpenseType[] | ListEnumExpenseTypeFieldRefInput<$PrismaModel> | null
    not?: NestedEnumExpenseTypeNullableFilter<$PrismaModel> | $Enums.ExpenseType | null
  }

  export type TransactionListRelationFilter = {
    every?: TransactionWhereInput
    some?: TransactionWhereInput
    none?: TransactionWhereInput
  }

  export type TransactionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TransactionCategoryCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    type?: SortOrder
    expenseType?: SortOrder
    description?: SortOrder
    isSystem?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TransactionCategoryMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    type?: SortOrder
    expenseType?: SortOrder
    description?: SortOrder
    isSystem?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TransactionCategoryMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    type?: SortOrder
    expenseType?: SortOrder
    description?: SortOrder
    isSystem?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumExpenseTypeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ExpenseType | EnumExpenseTypeFieldRefInput<$PrismaModel> | null
    in?: $Enums.ExpenseType[] | ListEnumExpenseTypeFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.ExpenseType[] | ListEnumExpenseTypeFieldRefInput<$PrismaModel> | null
    not?: NestedEnumExpenseTypeNullableWithAggregatesFilter<$PrismaModel> | $Enums.ExpenseType | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumExpenseTypeNullableFilter<$PrismaModel>
    _max?: NestedEnumExpenseTypeNullableFilter<$PrismaModel>
  }

  export type MixRadiusInvoiceCountOrderByAggregateInput = {
    id?: SortOrder
    invoiceNumber?: SortOrder
    mixRadiusId?: SortOrder
    username?: SortOrder
    fullName?: SortOrder
    ownerName?: SortOrder
    planName?: SortOrder
    amount?: SortOrder
    status?: SortOrder
    paymentMethod?: SortOrder
    issuedDate?: SortOrder
    dueDate?: SortOrder
    expiredOn?: SortOrder
    syncedAt?: SortOrder
  }

  export type MixRadiusInvoiceAvgOrderByAggregateInput = {
    amount?: SortOrder
  }

  export type MixRadiusInvoiceMaxOrderByAggregateInput = {
    id?: SortOrder
    invoiceNumber?: SortOrder
    mixRadiusId?: SortOrder
    username?: SortOrder
    fullName?: SortOrder
    ownerName?: SortOrder
    planName?: SortOrder
    amount?: SortOrder
    status?: SortOrder
    paymentMethod?: SortOrder
    issuedDate?: SortOrder
    dueDate?: SortOrder
    expiredOn?: SortOrder
    syncedAt?: SortOrder
  }

  export type MixRadiusInvoiceMinOrderByAggregateInput = {
    id?: SortOrder
    invoiceNumber?: SortOrder
    mixRadiusId?: SortOrder
    username?: SortOrder
    fullName?: SortOrder
    ownerName?: SortOrder
    planName?: SortOrder
    amount?: SortOrder
    status?: SortOrder
    paymentMethod?: SortOrder
    issuedDate?: SortOrder
    dueDate?: SortOrder
    expiredOn?: SortOrder
    syncedAt?: SortOrder
  }

  export type MixRadiusInvoiceSumOrderByAggregateInput = {
    amount?: SortOrder
  }

  export type MixRadiusCustomerCountOrderByAggregateInput = {
    id?: SortOrder
    mixRadiusId?: SortOrder
    username?: SortOrder
    fullName?: SortOrder
    address?: SortOrder
    phoneNumber?: SortOrder
    planName?: SortOrder
    status?: SortOrder
    ownerName?: SortOrder
    expiredOn?: SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MixRadiusCustomerMaxOrderByAggregateInput = {
    id?: SortOrder
    mixRadiusId?: SortOrder
    username?: SortOrder
    fullName?: SortOrder
    address?: SortOrder
    phoneNumber?: SortOrder
    planName?: SortOrder
    status?: SortOrder
    ownerName?: SortOrder
    expiredOn?: SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MixRadiusCustomerMinOrderByAggregateInput = {
    id?: SortOrder
    mixRadiusId?: SortOrder
    username?: SortOrder
    fullName?: SortOrder
    address?: SortOrder
    phoneNumber?: SortOrder
    planName?: SortOrder
    status?: SortOrder
    ownerName?: SortOrder
    expiredOn?: SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MixRadiusOwnerGroupCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    owners?: SortOrder
    siteId?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MixRadiusOwnerGroupMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    siteId?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MixRadiusOwnerGroupMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    siteId?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MixRadiusInvestorSiteCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    owners?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MixRadiusInvestorSiteMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MixRadiusInvestorSiteMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MixRadiusConfigCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    apiUrl?: SortOrder
    username?: SortOrder
    password?: SortOrder
    apiKey?: SortOrder
    isDefault?: SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MixRadiusConfigMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    apiUrl?: SortOrder
    username?: SortOrder
    password?: SortOrder
    apiKey?: SortOrder
    isDefault?: SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MixRadiusConfigMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    apiUrl?: SortOrder
    username?: SortOrder
    password?: SortOrder
    apiKey?: SortOrder
    isDefault?: SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type InvoiceItemCreateNestedManyWithoutInvoiceInput = {
    create?: XOR<InvoiceItemCreateWithoutInvoiceInput, InvoiceItemUncheckedCreateWithoutInvoiceInput> | InvoiceItemCreateWithoutInvoiceInput[] | InvoiceItemUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: InvoiceItemCreateOrConnectWithoutInvoiceInput | InvoiceItemCreateOrConnectWithoutInvoiceInput[]
    createMany?: InvoiceItemCreateManyInvoiceInputEnvelope
    connect?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[]
  }

  export type PaymentCreateNestedManyWithoutInvoiceInput = {
    create?: XOR<PaymentCreateWithoutInvoiceInput, PaymentUncheckedCreateWithoutInvoiceInput> | PaymentCreateWithoutInvoiceInput[] | PaymentUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: PaymentCreateOrConnectWithoutInvoiceInput | PaymentCreateOrConnectWithoutInvoiceInput[]
    createMany?: PaymentCreateManyInvoiceInputEnvelope
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
  }

  export type InvoiceItemUncheckedCreateNestedManyWithoutInvoiceInput = {
    create?: XOR<InvoiceItemCreateWithoutInvoiceInput, InvoiceItemUncheckedCreateWithoutInvoiceInput> | InvoiceItemCreateWithoutInvoiceInput[] | InvoiceItemUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: InvoiceItemCreateOrConnectWithoutInvoiceInput | InvoiceItemCreateOrConnectWithoutInvoiceInput[]
    createMany?: InvoiceItemCreateManyInvoiceInputEnvelope
    connect?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[]
  }

  export type PaymentUncheckedCreateNestedManyWithoutInvoiceInput = {
    create?: XOR<PaymentCreateWithoutInvoiceInput, PaymentUncheckedCreateWithoutInvoiceInput> | PaymentCreateWithoutInvoiceInput[] | PaymentUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: PaymentCreateOrConnectWithoutInvoiceInput | PaymentCreateOrConnectWithoutInvoiceInput[]
    createMany?: PaymentCreateManyInvoiceInputEnvelope
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type EnumInvoiceStatusFieldUpdateOperationsInput = {
    set?: $Enums.InvoiceStatus
  }

  export type BigIntFieldUpdateOperationsInput = {
    set?: bigint | number
    increment?: bigint | number
    decrement?: bigint | number
    multiply?: bigint | number
    divide?: bigint | number
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type InvoiceItemUpdateManyWithoutInvoiceNestedInput = {
    create?: XOR<InvoiceItemCreateWithoutInvoiceInput, InvoiceItemUncheckedCreateWithoutInvoiceInput> | InvoiceItemCreateWithoutInvoiceInput[] | InvoiceItemUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: InvoiceItemCreateOrConnectWithoutInvoiceInput | InvoiceItemCreateOrConnectWithoutInvoiceInput[]
    upsert?: InvoiceItemUpsertWithWhereUniqueWithoutInvoiceInput | InvoiceItemUpsertWithWhereUniqueWithoutInvoiceInput[]
    createMany?: InvoiceItemCreateManyInvoiceInputEnvelope
    set?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[]
    disconnect?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[]
    delete?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[]
    connect?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[]
    update?: InvoiceItemUpdateWithWhereUniqueWithoutInvoiceInput | InvoiceItemUpdateWithWhereUniqueWithoutInvoiceInput[]
    updateMany?: InvoiceItemUpdateManyWithWhereWithoutInvoiceInput | InvoiceItemUpdateManyWithWhereWithoutInvoiceInput[]
    deleteMany?: InvoiceItemScalarWhereInput | InvoiceItemScalarWhereInput[]
  }

  export type PaymentUpdateManyWithoutInvoiceNestedInput = {
    create?: XOR<PaymentCreateWithoutInvoiceInput, PaymentUncheckedCreateWithoutInvoiceInput> | PaymentCreateWithoutInvoiceInput[] | PaymentUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: PaymentCreateOrConnectWithoutInvoiceInput | PaymentCreateOrConnectWithoutInvoiceInput[]
    upsert?: PaymentUpsertWithWhereUniqueWithoutInvoiceInput | PaymentUpsertWithWhereUniqueWithoutInvoiceInput[]
    createMany?: PaymentCreateManyInvoiceInputEnvelope
    set?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    disconnect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    delete?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    update?: PaymentUpdateWithWhereUniqueWithoutInvoiceInput | PaymentUpdateWithWhereUniqueWithoutInvoiceInput[]
    updateMany?: PaymentUpdateManyWithWhereWithoutInvoiceInput | PaymentUpdateManyWithWhereWithoutInvoiceInput[]
    deleteMany?: PaymentScalarWhereInput | PaymentScalarWhereInput[]
  }

  export type InvoiceItemUncheckedUpdateManyWithoutInvoiceNestedInput = {
    create?: XOR<InvoiceItemCreateWithoutInvoiceInput, InvoiceItemUncheckedCreateWithoutInvoiceInput> | InvoiceItemCreateWithoutInvoiceInput[] | InvoiceItemUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: InvoiceItemCreateOrConnectWithoutInvoiceInput | InvoiceItemCreateOrConnectWithoutInvoiceInput[]
    upsert?: InvoiceItemUpsertWithWhereUniqueWithoutInvoiceInput | InvoiceItemUpsertWithWhereUniqueWithoutInvoiceInput[]
    createMany?: InvoiceItemCreateManyInvoiceInputEnvelope
    set?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[]
    disconnect?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[]
    delete?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[]
    connect?: InvoiceItemWhereUniqueInput | InvoiceItemWhereUniqueInput[]
    update?: InvoiceItemUpdateWithWhereUniqueWithoutInvoiceInput | InvoiceItemUpdateWithWhereUniqueWithoutInvoiceInput[]
    updateMany?: InvoiceItemUpdateManyWithWhereWithoutInvoiceInput | InvoiceItemUpdateManyWithWhereWithoutInvoiceInput[]
    deleteMany?: InvoiceItemScalarWhereInput | InvoiceItemScalarWhereInput[]
  }

  export type PaymentUncheckedUpdateManyWithoutInvoiceNestedInput = {
    create?: XOR<PaymentCreateWithoutInvoiceInput, PaymentUncheckedCreateWithoutInvoiceInput> | PaymentCreateWithoutInvoiceInput[] | PaymentUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: PaymentCreateOrConnectWithoutInvoiceInput | PaymentCreateOrConnectWithoutInvoiceInput[]
    upsert?: PaymentUpsertWithWhereUniqueWithoutInvoiceInput | PaymentUpsertWithWhereUniqueWithoutInvoiceInput[]
    createMany?: PaymentCreateManyInvoiceInputEnvelope
    set?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    disconnect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    delete?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    connect?: PaymentWhereUniqueInput | PaymentWhereUniqueInput[]
    update?: PaymentUpdateWithWhereUniqueWithoutInvoiceInput | PaymentUpdateWithWhereUniqueWithoutInvoiceInput[]
    updateMany?: PaymentUpdateManyWithWhereWithoutInvoiceInput | PaymentUpdateManyWithWhereWithoutInvoiceInput[]
    deleteMany?: PaymentScalarWhereInput | PaymentScalarWhereInput[]
  }

  export type InvoiceCreateNestedOneWithoutInvoiceItemInput = {
    create?: XOR<InvoiceCreateWithoutInvoiceItemInput, InvoiceUncheckedCreateWithoutInvoiceItemInput>
    connectOrCreate?: InvoiceCreateOrConnectWithoutInvoiceItemInput
    connect?: InvoiceWhereUniqueInput
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type EnumItemTypeFieldUpdateOperationsInput = {
    set?: $Enums.ItemType
  }

  export type InvoiceUpdateOneRequiredWithoutInvoiceItemNestedInput = {
    create?: XOR<InvoiceCreateWithoutInvoiceItemInput, InvoiceUncheckedCreateWithoutInvoiceItemInput>
    connectOrCreate?: InvoiceCreateOrConnectWithoutInvoiceItemInput
    upsert?: InvoiceUpsertWithoutInvoiceItemInput
    connect?: InvoiceWhereUniqueInput
    update?: XOR<XOR<InvoiceUpdateToOneWithWhereWithoutInvoiceItemInput, InvoiceUpdateWithoutInvoiceItemInput>, InvoiceUncheckedUpdateWithoutInvoiceItemInput>
  }

  export type InvoiceCreateNestedOneWithoutPaymentInput = {
    create?: XOR<InvoiceCreateWithoutPaymentInput, InvoiceUncheckedCreateWithoutPaymentInput>
    connectOrCreate?: InvoiceCreateOrConnectWithoutPaymentInput
    connect?: InvoiceWhereUniqueInput
  }

  export type UnmatchedMutationCreateNestedOneWithoutPaymentInput = {
    create?: XOR<UnmatchedMutationCreateWithoutPaymentInput, UnmatchedMutationUncheckedCreateWithoutPaymentInput>
    connectOrCreate?: UnmatchedMutationCreateOrConnectWithoutPaymentInput
    connect?: UnmatchedMutationWhereUniqueInput
  }

  export type EnumPaymentMethodFieldUpdateOperationsInput = {
    set?: $Enums.PaymentMethod
  }

  export type NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput = {
    set?: $Enums.GatewayPaymentStatus | null
  }

  export type InvoiceUpdateOneWithoutPaymentNestedInput = {
    create?: XOR<InvoiceCreateWithoutPaymentInput, InvoiceUncheckedCreateWithoutPaymentInput>
    connectOrCreate?: InvoiceCreateOrConnectWithoutPaymentInput
    upsert?: InvoiceUpsertWithoutPaymentInput
    disconnect?: InvoiceWhereInput | boolean
    delete?: InvoiceWhereInput | boolean
    connect?: InvoiceWhereUniqueInput
    update?: XOR<XOR<InvoiceUpdateToOneWithWhereWithoutPaymentInput, InvoiceUpdateWithoutPaymentInput>, InvoiceUncheckedUpdateWithoutPaymentInput>
  }

  export type UnmatchedMutationUpdateOneWithoutPaymentNestedInput = {
    create?: XOR<UnmatchedMutationCreateWithoutPaymentInput, UnmatchedMutationUncheckedCreateWithoutPaymentInput>
    connectOrCreate?: UnmatchedMutationCreateOrConnectWithoutPaymentInput
    upsert?: UnmatchedMutationUpsertWithoutPaymentInput
    disconnect?: UnmatchedMutationWhereInput | boolean
    delete?: UnmatchedMutationWhereInput | boolean
    connect?: UnmatchedMutationWhereUniqueInput
    update?: XOR<XOR<UnmatchedMutationUpdateToOneWithWhereWithoutPaymentInput, UnmatchedMutationUpdateWithoutPaymentInput>, UnmatchedMutationUncheckedUpdateWithoutPaymentInput>
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type PaymentCreateNestedOneWithoutUnmatchedMutationInput = {
    create?: XOR<PaymentCreateWithoutUnmatchedMutationInput, PaymentUncheckedCreateWithoutUnmatchedMutationInput>
    connectOrCreate?: PaymentCreateOrConnectWithoutUnmatchedMutationInput
    connect?: PaymentWhereUniqueInput
  }

  export type PaymentUncheckedCreateNestedOneWithoutUnmatchedMutationInput = {
    create?: XOR<PaymentCreateWithoutUnmatchedMutationInput, PaymentUncheckedCreateWithoutUnmatchedMutationInput>
    connectOrCreate?: PaymentCreateOrConnectWithoutUnmatchedMutationInput
    connect?: PaymentWhereUniqueInput
  }

  export type DecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type EnumUnmatchedStatusFieldUpdateOperationsInput = {
    set?: $Enums.UnmatchedStatus
  }

  export type PaymentUpdateOneWithoutUnmatchedMutationNestedInput = {
    create?: XOR<PaymentCreateWithoutUnmatchedMutationInput, PaymentUncheckedCreateWithoutUnmatchedMutationInput>
    connectOrCreate?: PaymentCreateOrConnectWithoutUnmatchedMutationInput
    upsert?: PaymentUpsertWithoutUnmatchedMutationInput
    disconnect?: PaymentWhereInput | boolean
    delete?: PaymentWhereInput | boolean
    connect?: PaymentWhereUniqueInput
    update?: XOR<XOR<PaymentUpdateToOneWithWhereWithoutUnmatchedMutationInput, PaymentUpdateWithoutUnmatchedMutationInput>, PaymentUncheckedUpdateWithoutUnmatchedMutationInput>
  }

  export type PaymentUncheckedUpdateOneWithoutUnmatchedMutationNestedInput = {
    create?: XOR<PaymentCreateWithoutUnmatchedMutationInput, PaymentUncheckedCreateWithoutUnmatchedMutationInput>
    connectOrCreate?: PaymentCreateOrConnectWithoutUnmatchedMutationInput
    upsert?: PaymentUpsertWithoutUnmatchedMutationInput
    disconnect?: PaymentWhereInput | boolean
    delete?: PaymentWhereInput | boolean
    connect?: PaymentWhereUniqueInput
    update?: XOR<XOR<PaymentUpdateToOneWithWhereWithoutUnmatchedMutationInput, PaymentUpdateWithoutUnmatchedMutationInput>, PaymentUncheckedUpdateWithoutUnmatchedMutationInput>
  }

  export type TransactionCreateattachmentsInput = {
    set: string[]
  }

  export type TransactionCategoryCreateNestedOneWithoutTransactionsInput = {
    create?: XOR<TransactionCategoryCreateWithoutTransactionsInput, TransactionCategoryUncheckedCreateWithoutTransactionsInput>
    connectOrCreate?: TransactionCategoryCreateOrConnectWithoutTransactionsInput
    connect?: TransactionCategoryWhereUniqueInput
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type EnumTransactionTypeFieldUpdateOperationsInput = {
    set?: $Enums.TransactionType
  }

  export type TransactionUpdateattachmentsInput = {
    set?: string[]
    push?: string | string[]
  }

  export type TransactionCategoryUpdateOneRequiredWithoutTransactionsNestedInput = {
    create?: XOR<TransactionCategoryCreateWithoutTransactionsInput, TransactionCategoryUncheckedCreateWithoutTransactionsInput>
    connectOrCreate?: TransactionCategoryCreateOrConnectWithoutTransactionsInput
    upsert?: TransactionCategoryUpsertWithoutTransactionsInput
    connect?: TransactionCategoryWhereUniqueInput
    update?: XOR<XOR<TransactionCategoryUpdateToOneWithWhereWithoutTransactionsInput, TransactionCategoryUpdateWithoutTransactionsInput>, TransactionCategoryUncheckedUpdateWithoutTransactionsInput>
  }

  export type TransactionCreateNestedManyWithoutCategoryInput = {
    create?: XOR<TransactionCreateWithoutCategoryInput, TransactionUncheckedCreateWithoutCategoryInput> | TransactionCreateWithoutCategoryInput[] | TransactionUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: TransactionCreateOrConnectWithoutCategoryInput | TransactionCreateOrConnectWithoutCategoryInput[]
    createMany?: TransactionCreateManyCategoryInputEnvelope
    connect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
  }

  export type TransactionUncheckedCreateNestedManyWithoutCategoryInput = {
    create?: XOR<TransactionCreateWithoutCategoryInput, TransactionUncheckedCreateWithoutCategoryInput> | TransactionCreateWithoutCategoryInput[] | TransactionUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: TransactionCreateOrConnectWithoutCategoryInput | TransactionCreateOrConnectWithoutCategoryInput[]
    createMany?: TransactionCreateManyCategoryInputEnvelope
    connect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
  }

  export type NullableEnumExpenseTypeFieldUpdateOperationsInput = {
    set?: $Enums.ExpenseType | null
  }

  export type TransactionUpdateManyWithoutCategoryNestedInput = {
    create?: XOR<TransactionCreateWithoutCategoryInput, TransactionUncheckedCreateWithoutCategoryInput> | TransactionCreateWithoutCategoryInput[] | TransactionUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: TransactionCreateOrConnectWithoutCategoryInput | TransactionCreateOrConnectWithoutCategoryInput[]
    upsert?: TransactionUpsertWithWhereUniqueWithoutCategoryInput | TransactionUpsertWithWhereUniqueWithoutCategoryInput[]
    createMany?: TransactionCreateManyCategoryInputEnvelope
    set?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    disconnect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    delete?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    connect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    update?: TransactionUpdateWithWhereUniqueWithoutCategoryInput | TransactionUpdateWithWhereUniqueWithoutCategoryInput[]
    updateMany?: TransactionUpdateManyWithWhereWithoutCategoryInput | TransactionUpdateManyWithWhereWithoutCategoryInput[]
    deleteMany?: TransactionScalarWhereInput | TransactionScalarWhereInput[]
  }

  export type TransactionUncheckedUpdateManyWithoutCategoryNestedInput = {
    create?: XOR<TransactionCreateWithoutCategoryInput, TransactionUncheckedCreateWithoutCategoryInput> | TransactionCreateWithoutCategoryInput[] | TransactionUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: TransactionCreateOrConnectWithoutCategoryInput | TransactionCreateOrConnectWithoutCategoryInput[]
    upsert?: TransactionUpsertWithWhereUniqueWithoutCategoryInput | TransactionUpsertWithWhereUniqueWithoutCategoryInput[]
    createMany?: TransactionCreateManyCategoryInputEnvelope
    set?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    disconnect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    delete?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    connect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    update?: TransactionUpdateWithWhereUniqueWithoutCategoryInput | TransactionUpdateWithWhereUniqueWithoutCategoryInput[]
    updateMany?: TransactionUpdateManyWithWhereWithoutCategoryInput | TransactionUpdateManyWithWhereWithoutCategoryInput[]
    deleteMany?: TransactionScalarWhereInput | TransactionScalarWhereInput[]
  }

  export type MixRadiusOwnerGroupCreateownersInput = {
    set: string[]
  }

  export type MixRadiusOwnerGroupUpdateownersInput = {
    set?: string[]
    push?: string | string[]
  }

  export type MixRadiusInvestorSiteCreateownersInput = {
    set: string[]
  }

  export type MixRadiusInvestorSiteUpdateownersInput = {
    set?: string[]
    push?: string | string[]
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedEnumInvoiceStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.InvoiceStatus | EnumInvoiceStatusFieldRefInput<$PrismaModel>
    in?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumInvoiceStatusFilter<$PrismaModel> | $Enums.InvoiceStatus
  }

  export type NestedBigIntFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntFilter<$PrismaModel> | bigint | number
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedEnumInvoiceStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.InvoiceStatus | EnumInvoiceStatusFieldRefInput<$PrismaModel>
    in?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumInvoiceStatusWithAggregatesFilter<$PrismaModel> | $Enums.InvoiceStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumInvoiceStatusFilter<$PrismaModel>
    _max?: NestedEnumInvoiceStatusFilter<$PrismaModel>
  }

  export type NestedBigIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntWithAggregatesFilter<$PrismaModel> | bigint | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedBigIntFilter<$PrismaModel>
    _min?: NestedBigIntFilter<$PrismaModel>
    _max?: NestedBigIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedEnumItemTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.ItemType | EnumItemTypeFieldRefInput<$PrismaModel>
    in?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumItemTypeFilter<$PrismaModel> | $Enums.ItemType
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedEnumItemTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ItemType | EnumItemTypeFieldRefInput<$PrismaModel>
    in?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.ItemType[] | ListEnumItemTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumItemTypeWithAggregatesFilter<$PrismaModel> | $Enums.ItemType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumItemTypeFilter<$PrismaModel>
    _max?: NestedEnumItemTypeFilter<$PrismaModel>
  }

  export type NestedEnumPaymentMethodFilter<$PrismaModel = never> = {
    equals?: $Enums.PaymentMethod | EnumPaymentMethodFieldRefInput<$PrismaModel>
    in?: $Enums.PaymentMethod[] | ListEnumPaymentMethodFieldRefInput<$PrismaModel>
    notIn?: $Enums.PaymentMethod[] | ListEnumPaymentMethodFieldRefInput<$PrismaModel>
    not?: NestedEnumPaymentMethodFilter<$PrismaModel> | $Enums.PaymentMethod
  }

  export type NestedEnumGatewayPaymentStatusNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.GatewayPaymentStatus | EnumGatewayPaymentStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.GatewayPaymentStatus[] | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.GatewayPaymentStatus[] | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumGatewayPaymentStatusNullableFilter<$PrismaModel> | $Enums.GatewayPaymentStatus | null
  }

  export type NestedEnumPaymentMethodWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PaymentMethod | EnumPaymentMethodFieldRefInput<$PrismaModel>
    in?: $Enums.PaymentMethod[] | ListEnumPaymentMethodFieldRefInput<$PrismaModel>
    notIn?: $Enums.PaymentMethod[] | ListEnumPaymentMethodFieldRefInput<$PrismaModel>
    not?: NestedEnumPaymentMethodWithAggregatesFilter<$PrismaModel> | $Enums.PaymentMethod
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPaymentMethodFilter<$PrismaModel>
    _max?: NestedEnumPaymentMethodFilter<$PrismaModel>
  }

  export type NestedEnumGatewayPaymentStatusNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.GatewayPaymentStatus | EnumGatewayPaymentStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.GatewayPaymentStatus[] | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.GatewayPaymentStatus[] | ListEnumGatewayPaymentStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumGatewayPaymentStatusNullableWithAggregatesFilter<$PrismaModel> | $Enums.GatewayPaymentStatus | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumGatewayPaymentStatusNullableFilter<$PrismaModel>
    _max?: NestedEnumGatewayPaymentStatusNullableFilter<$PrismaModel>
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedDecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type NestedEnumUnmatchedStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.UnmatchedStatus | EnumUnmatchedStatusFieldRefInput<$PrismaModel>
    in?: $Enums.UnmatchedStatus[] | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.UnmatchedStatus[] | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumUnmatchedStatusFilter<$PrismaModel> | $Enums.UnmatchedStatus
  }

  export type NestedDecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type NestedEnumUnmatchedStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.UnmatchedStatus | EnumUnmatchedStatusFieldRefInput<$PrismaModel>
    in?: $Enums.UnmatchedStatus[] | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.UnmatchedStatus[] | ListEnumUnmatchedStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumUnmatchedStatusWithAggregatesFilter<$PrismaModel> | $Enums.UnmatchedStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumUnmatchedStatusFilter<$PrismaModel>
    _max?: NestedEnumUnmatchedStatusFilter<$PrismaModel>
  }

  export type NestedEnumTransactionTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.TransactionType | EnumTransactionTypeFieldRefInput<$PrismaModel>
    in?: $Enums.TransactionType[] | ListEnumTransactionTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.TransactionType[] | ListEnumTransactionTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumTransactionTypeFilter<$PrismaModel> | $Enums.TransactionType
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type NestedEnumTransactionTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.TransactionType | EnumTransactionTypeFieldRefInput<$PrismaModel>
    in?: $Enums.TransactionType[] | ListEnumTransactionTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.TransactionType[] | ListEnumTransactionTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumTransactionTypeWithAggregatesFilter<$PrismaModel> | $Enums.TransactionType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumTransactionTypeFilter<$PrismaModel>
    _max?: NestedEnumTransactionTypeFilter<$PrismaModel>
  }

  export type NestedEnumExpenseTypeNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.ExpenseType | EnumExpenseTypeFieldRefInput<$PrismaModel> | null
    in?: $Enums.ExpenseType[] | ListEnumExpenseTypeFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.ExpenseType[] | ListEnumExpenseTypeFieldRefInput<$PrismaModel> | null
    not?: NestedEnumExpenseTypeNullableFilter<$PrismaModel> | $Enums.ExpenseType | null
  }

  export type NestedEnumExpenseTypeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ExpenseType | EnumExpenseTypeFieldRefInput<$PrismaModel> | null
    in?: $Enums.ExpenseType[] | ListEnumExpenseTypeFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.ExpenseType[] | ListEnumExpenseTypeFieldRefInput<$PrismaModel> | null
    not?: NestedEnumExpenseTypeNullableWithAggregatesFilter<$PrismaModel> | $Enums.ExpenseType | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumExpenseTypeNullableFilter<$PrismaModel>
    _max?: NestedEnumExpenseTypeNullableFilter<$PrismaModel>
  }

  export type InvoiceItemCreateWithoutInvoiceInput = {
    id: string
    description: string
    quantity?: number
    unitPrice: bigint | number
    totalPrice: bigint | number
    itemType?: $Enums.ItemType
  }

  export type InvoiceItemUncheckedCreateWithoutInvoiceInput = {
    id: string
    description: string
    quantity?: number
    unitPrice: bigint | number
    totalPrice: bigint | number
    itemType?: $Enums.ItemType
  }

  export type InvoiceItemCreateOrConnectWithoutInvoiceInput = {
    where: InvoiceItemWhereUniqueInput
    create: XOR<InvoiceItemCreateWithoutInvoiceInput, InvoiceItemUncheckedCreateWithoutInvoiceInput>
  }

  export type InvoiceItemCreateManyInvoiceInputEnvelope = {
    data: InvoiceItemCreateManyInvoiceInput | InvoiceItemCreateManyInvoiceInput[]
    skipDuplicates?: boolean
  }

  export type PaymentCreateWithoutInvoiceInput = {
    id: string
    pelangganId: string
    amount: bigint | number
    paymentDate: Date | string
    paymentMethod: $Enums.PaymentMethod
    reference?: string | null
    notes?: string | null
    verifiedBy?: string | null
    verifiedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt: Date | string
    accountId?: string | null
    gatewayStatus?: $Enums.GatewayPaymentStatus | null
    gatewayProvider?: string | null
    transactionId?: string | null
    paymentUrl?: string | null
    expiresAt?: Date | string | null
    receiptUrl?: string | null
    unmatchedMutation?: UnmatchedMutationCreateNestedOneWithoutPaymentInput
  }

  export type PaymentUncheckedCreateWithoutInvoiceInput = {
    id: string
    pelangganId: string
    amount: bigint | number
    paymentDate: Date | string
    paymentMethod: $Enums.PaymentMethod
    reference?: string | null
    notes?: string | null
    verifiedBy?: string | null
    verifiedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt: Date | string
    accountId?: string | null
    gatewayStatus?: $Enums.GatewayPaymentStatus | null
    gatewayProvider?: string | null
    transactionId?: string | null
    paymentUrl?: string | null
    expiresAt?: Date | string | null
    unmatchedMutationId?: string | null
    receiptUrl?: string | null
  }

  export type PaymentCreateOrConnectWithoutInvoiceInput = {
    where: PaymentWhereUniqueInput
    create: XOR<PaymentCreateWithoutInvoiceInput, PaymentUncheckedCreateWithoutInvoiceInput>
  }

  export type PaymentCreateManyInvoiceInputEnvelope = {
    data: PaymentCreateManyInvoiceInput | PaymentCreateManyInvoiceInput[]
    skipDuplicates?: boolean
  }

  export type InvoiceItemUpsertWithWhereUniqueWithoutInvoiceInput = {
    where: InvoiceItemWhereUniqueInput
    update: XOR<InvoiceItemUpdateWithoutInvoiceInput, InvoiceItemUncheckedUpdateWithoutInvoiceInput>
    create: XOR<InvoiceItemCreateWithoutInvoiceInput, InvoiceItemUncheckedCreateWithoutInvoiceInput>
  }

  export type InvoiceItemUpdateWithWhereUniqueWithoutInvoiceInput = {
    where: InvoiceItemWhereUniqueInput
    data: XOR<InvoiceItemUpdateWithoutInvoiceInput, InvoiceItemUncheckedUpdateWithoutInvoiceInput>
  }

  export type InvoiceItemUpdateManyWithWhereWithoutInvoiceInput = {
    where: InvoiceItemScalarWhereInput
    data: XOR<InvoiceItemUpdateManyMutationInput, InvoiceItemUncheckedUpdateManyWithoutInvoiceInput>
  }

  export type InvoiceItemScalarWhereInput = {
    AND?: InvoiceItemScalarWhereInput | InvoiceItemScalarWhereInput[]
    OR?: InvoiceItemScalarWhereInput[]
    NOT?: InvoiceItemScalarWhereInput | InvoiceItemScalarWhereInput[]
    id?: StringFilter<"InvoiceItem"> | string
    invoiceId?: StringFilter<"InvoiceItem"> | string
    description?: StringFilter<"InvoiceItem"> | string
    quantity?: IntFilter<"InvoiceItem"> | number
    unitPrice?: BigIntFilter<"InvoiceItem"> | bigint | number
    totalPrice?: BigIntFilter<"InvoiceItem"> | bigint | number
    itemType?: EnumItemTypeFilter<"InvoiceItem"> | $Enums.ItemType
  }

  export type PaymentUpsertWithWhereUniqueWithoutInvoiceInput = {
    where: PaymentWhereUniqueInput
    update: XOR<PaymentUpdateWithoutInvoiceInput, PaymentUncheckedUpdateWithoutInvoiceInput>
    create: XOR<PaymentCreateWithoutInvoiceInput, PaymentUncheckedCreateWithoutInvoiceInput>
  }

  export type PaymentUpdateWithWhereUniqueWithoutInvoiceInput = {
    where: PaymentWhereUniqueInput
    data: XOR<PaymentUpdateWithoutInvoiceInput, PaymentUncheckedUpdateWithoutInvoiceInput>
  }

  export type PaymentUpdateManyWithWhereWithoutInvoiceInput = {
    where: PaymentScalarWhereInput
    data: XOR<PaymentUpdateManyMutationInput, PaymentUncheckedUpdateManyWithoutInvoiceInput>
  }

  export type PaymentScalarWhereInput = {
    AND?: PaymentScalarWhereInput | PaymentScalarWhereInput[]
    OR?: PaymentScalarWhereInput[]
    NOT?: PaymentScalarWhereInput | PaymentScalarWhereInput[]
    id?: StringFilter<"Payment"> | string
    invoiceId?: StringNullableFilter<"Payment"> | string | null
    pelangganId?: StringFilter<"Payment"> | string
    amount?: BigIntFilter<"Payment"> | bigint | number
    paymentDate?: DateTimeFilter<"Payment"> | Date | string
    paymentMethod?: EnumPaymentMethodFilter<"Payment"> | $Enums.PaymentMethod
    reference?: StringNullableFilter<"Payment"> | string | null
    notes?: StringNullableFilter<"Payment"> | string | null
    verifiedBy?: StringNullableFilter<"Payment"> | string | null
    verifiedAt?: DateTimeNullableFilter<"Payment"> | Date | string | null
    createdAt?: DateTimeFilter<"Payment"> | Date | string
    updatedAt?: DateTimeFilter<"Payment"> | Date | string
    accountId?: StringNullableFilter<"Payment"> | string | null
    gatewayStatus?: EnumGatewayPaymentStatusNullableFilter<"Payment"> | $Enums.GatewayPaymentStatus | null
    gatewayProvider?: StringNullableFilter<"Payment"> | string | null
    transactionId?: StringNullableFilter<"Payment"> | string | null
    paymentUrl?: StringNullableFilter<"Payment"> | string | null
    expiresAt?: DateTimeNullableFilter<"Payment"> | Date | string | null
    unmatchedMutationId?: StringNullableFilter<"Payment"> | string | null
    receiptUrl?: StringNullableFilter<"Payment"> | string | null
  }

  export type InvoiceCreateWithoutInvoiceItemInput = {
    id: string
    invoiceNumber: string
    pelangganId: string
    issueDate?: Date | string
    dueDate: Date | string
    status?: $Enums.InvoiceStatus
    subtotal?: bigint | number
    taxAmount?: bigint | number
    discountAmount?: bigint | number
    totalAmount?: bigint | number
    paidAmount?: bigint | number
    notes?: string | null
    terms?: string | null
    sentAt?: Date | string | null
    paidAt?: Date | string | null
    createdBy?: string | null
    createdAt?: Date | string
    updatedAt: Date | string
    siteId?: string | null
    payment?: PaymentCreateNestedManyWithoutInvoiceInput
  }

  export type InvoiceUncheckedCreateWithoutInvoiceItemInput = {
    id: string
    invoiceNumber: string
    pelangganId: string
    issueDate?: Date | string
    dueDate: Date | string
    status?: $Enums.InvoiceStatus
    subtotal?: bigint | number
    taxAmount?: bigint | number
    discountAmount?: bigint | number
    totalAmount?: bigint | number
    paidAmount?: bigint | number
    notes?: string | null
    terms?: string | null
    sentAt?: Date | string | null
    paidAt?: Date | string | null
    createdBy?: string | null
    createdAt?: Date | string
    updatedAt: Date | string
    siteId?: string | null
    payment?: PaymentUncheckedCreateNestedManyWithoutInvoiceInput
  }

  export type InvoiceCreateOrConnectWithoutInvoiceItemInput = {
    where: InvoiceWhereUniqueInput
    create: XOR<InvoiceCreateWithoutInvoiceItemInput, InvoiceUncheckedCreateWithoutInvoiceItemInput>
  }

  export type InvoiceUpsertWithoutInvoiceItemInput = {
    update: XOR<InvoiceUpdateWithoutInvoiceItemInput, InvoiceUncheckedUpdateWithoutInvoiceItemInput>
    create: XOR<InvoiceCreateWithoutInvoiceItemInput, InvoiceUncheckedCreateWithoutInvoiceItemInput>
    where?: InvoiceWhereInput
  }

  export type InvoiceUpdateToOneWithWhereWithoutInvoiceItemInput = {
    where?: InvoiceWhereInput
    data: XOR<InvoiceUpdateWithoutInvoiceItemInput, InvoiceUncheckedUpdateWithoutInvoiceItemInput>
  }

  export type InvoiceUpdateWithoutInvoiceItemInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceNumber?: StringFieldUpdateOperationsInput | string
    pelangganId?: StringFieldUpdateOperationsInput | string
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    terms?: NullableStringFieldUpdateOperationsInput | string | null
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
    payment?: PaymentUpdateManyWithoutInvoiceNestedInput
  }

  export type InvoiceUncheckedUpdateWithoutInvoiceItemInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceNumber?: StringFieldUpdateOperationsInput | string
    pelangganId?: StringFieldUpdateOperationsInput | string
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    terms?: NullableStringFieldUpdateOperationsInput | string | null
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
    payment?: PaymentUncheckedUpdateManyWithoutInvoiceNestedInput
  }

  export type InvoiceCreateWithoutPaymentInput = {
    id: string
    invoiceNumber: string
    pelangganId: string
    issueDate?: Date | string
    dueDate: Date | string
    status?: $Enums.InvoiceStatus
    subtotal?: bigint | number
    taxAmount?: bigint | number
    discountAmount?: bigint | number
    totalAmount?: bigint | number
    paidAmount?: bigint | number
    notes?: string | null
    terms?: string | null
    sentAt?: Date | string | null
    paidAt?: Date | string | null
    createdBy?: string | null
    createdAt?: Date | string
    updatedAt: Date | string
    siteId?: string | null
    invoiceItem?: InvoiceItemCreateNestedManyWithoutInvoiceInput
  }

  export type InvoiceUncheckedCreateWithoutPaymentInput = {
    id: string
    invoiceNumber: string
    pelangganId: string
    issueDate?: Date | string
    dueDate: Date | string
    status?: $Enums.InvoiceStatus
    subtotal?: bigint | number
    taxAmount?: bigint | number
    discountAmount?: bigint | number
    totalAmount?: bigint | number
    paidAmount?: bigint | number
    notes?: string | null
    terms?: string | null
    sentAt?: Date | string | null
    paidAt?: Date | string | null
    createdBy?: string | null
    createdAt?: Date | string
    updatedAt: Date | string
    siteId?: string | null
    invoiceItem?: InvoiceItemUncheckedCreateNestedManyWithoutInvoiceInput
  }

  export type InvoiceCreateOrConnectWithoutPaymentInput = {
    where: InvoiceWhereUniqueInput
    create: XOR<InvoiceCreateWithoutPaymentInput, InvoiceUncheckedCreateWithoutPaymentInput>
  }

  export type UnmatchedMutationCreateWithoutPaymentInput = {
    id?: string
    provider?: string
    transactionId?: string | null
    amount: Decimal | DecimalJsLike | number | string
    description?: string | null
    type?: string | null
    date: Date | string
    bankId?: string | null
    rawPayload?: NullableJsonNullValueInput | InputJsonValue
    status?: $Enums.UnmatchedStatus
    resolvedAt?: Date | string | null
    resolvedById?: string | null
    matchedInvoiceId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UnmatchedMutationUncheckedCreateWithoutPaymentInput = {
    id?: string
    provider?: string
    transactionId?: string | null
    amount: Decimal | DecimalJsLike | number | string
    description?: string | null
    type?: string | null
    date: Date | string
    bankId?: string | null
    rawPayload?: NullableJsonNullValueInput | InputJsonValue
    status?: $Enums.UnmatchedStatus
    resolvedAt?: Date | string | null
    resolvedById?: string | null
    matchedInvoiceId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UnmatchedMutationCreateOrConnectWithoutPaymentInput = {
    where: UnmatchedMutationWhereUniqueInput
    create: XOR<UnmatchedMutationCreateWithoutPaymentInput, UnmatchedMutationUncheckedCreateWithoutPaymentInput>
  }

  export type InvoiceUpsertWithoutPaymentInput = {
    update: XOR<InvoiceUpdateWithoutPaymentInput, InvoiceUncheckedUpdateWithoutPaymentInput>
    create: XOR<InvoiceCreateWithoutPaymentInput, InvoiceUncheckedCreateWithoutPaymentInput>
    where?: InvoiceWhereInput
  }

  export type InvoiceUpdateToOneWithWhereWithoutPaymentInput = {
    where?: InvoiceWhereInput
    data: XOR<InvoiceUpdateWithoutPaymentInput, InvoiceUncheckedUpdateWithoutPaymentInput>
  }

  export type InvoiceUpdateWithoutPaymentInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceNumber?: StringFieldUpdateOperationsInput | string
    pelangganId?: StringFieldUpdateOperationsInput | string
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    terms?: NullableStringFieldUpdateOperationsInput | string | null
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceItem?: InvoiceItemUpdateManyWithoutInvoiceNestedInput
  }

  export type InvoiceUncheckedUpdateWithoutPaymentInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceNumber?: StringFieldUpdateOperationsInput | string
    pelangganId?: StringFieldUpdateOperationsInput | string
    issueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    dueDate?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus
    subtotal?: BigIntFieldUpdateOperationsInput | bigint | number
    taxAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    discountAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    totalAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    paidAmount?: BigIntFieldUpdateOperationsInput | bigint | number
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    terms?: NullableStringFieldUpdateOperationsInput | string | null
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    siteId?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceItem?: InvoiceItemUncheckedUpdateManyWithoutInvoiceNestedInput
  }

  export type UnmatchedMutationUpsertWithoutPaymentInput = {
    update: XOR<UnmatchedMutationUpdateWithoutPaymentInput, UnmatchedMutationUncheckedUpdateWithoutPaymentInput>
    create: XOR<UnmatchedMutationCreateWithoutPaymentInput, UnmatchedMutationUncheckedCreateWithoutPaymentInput>
    where?: UnmatchedMutationWhereInput
  }

  export type UnmatchedMutationUpdateToOneWithWhereWithoutPaymentInput = {
    where?: UnmatchedMutationWhereInput
    data: XOR<UnmatchedMutationUpdateWithoutPaymentInput, UnmatchedMutationUncheckedUpdateWithoutPaymentInput>
  }

  export type UnmatchedMutationUpdateWithoutPaymentInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    type?: NullableStringFieldUpdateOperationsInput | string | null
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    bankId?: NullableStringFieldUpdateOperationsInput | string | null
    rawPayload?: NullableJsonNullValueInput | InputJsonValue
    status?: EnumUnmatchedStatusFieldUpdateOperationsInput | $Enums.UnmatchedStatus
    resolvedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    resolvedById?: NullableStringFieldUpdateOperationsInput | string | null
    matchedInvoiceId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UnmatchedMutationUncheckedUpdateWithoutPaymentInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    type?: NullableStringFieldUpdateOperationsInput | string | null
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    bankId?: NullableStringFieldUpdateOperationsInput | string | null
    rawPayload?: NullableJsonNullValueInput | InputJsonValue
    status?: EnumUnmatchedStatusFieldUpdateOperationsInput | $Enums.UnmatchedStatus
    resolvedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    resolvedById?: NullableStringFieldUpdateOperationsInput | string | null
    matchedInvoiceId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PaymentCreateWithoutUnmatchedMutationInput = {
    id: string
    pelangganId: string
    amount: bigint | number
    paymentDate: Date | string
    paymentMethod: $Enums.PaymentMethod
    reference?: string | null
    notes?: string | null
    verifiedBy?: string | null
    verifiedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt: Date | string
    accountId?: string | null
    gatewayStatus?: $Enums.GatewayPaymentStatus | null
    gatewayProvider?: string | null
    transactionId?: string | null
    paymentUrl?: string | null
    expiresAt?: Date | string | null
    receiptUrl?: string | null
    invoice?: InvoiceCreateNestedOneWithoutPaymentInput
  }

  export type PaymentUncheckedCreateWithoutUnmatchedMutationInput = {
    id: string
    invoiceId?: string | null
    pelangganId: string
    amount: bigint | number
    paymentDate: Date | string
    paymentMethod: $Enums.PaymentMethod
    reference?: string | null
    notes?: string | null
    verifiedBy?: string | null
    verifiedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt: Date | string
    accountId?: string | null
    gatewayStatus?: $Enums.GatewayPaymentStatus | null
    gatewayProvider?: string | null
    transactionId?: string | null
    paymentUrl?: string | null
    expiresAt?: Date | string | null
    receiptUrl?: string | null
  }

  export type PaymentCreateOrConnectWithoutUnmatchedMutationInput = {
    where: PaymentWhereUniqueInput
    create: XOR<PaymentCreateWithoutUnmatchedMutationInput, PaymentUncheckedCreateWithoutUnmatchedMutationInput>
  }

  export type PaymentUpsertWithoutUnmatchedMutationInput = {
    update: XOR<PaymentUpdateWithoutUnmatchedMutationInput, PaymentUncheckedUpdateWithoutUnmatchedMutationInput>
    create: XOR<PaymentCreateWithoutUnmatchedMutationInput, PaymentUncheckedCreateWithoutUnmatchedMutationInput>
    where?: PaymentWhereInput
  }

  export type PaymentUpdateToOneWithWhereWithoutUnmatchedMutationInput = {
    where?: PaymentWhereInput
    data: XOR<PaymentUpdateWithoutUnmatchedMutationInput, PaymentUncheckedUpdateWithoutUnmatchedMutationInput>
  }

  export type PaymentUpdateWithoutUnmatchedMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    pelangganId?: StringFieldUpdateOperationsInput | string
    amount?: BigIntFieldUpdateOperationsInput | bigint | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: EnumPaymentMethodFieldUpdateOperationsInput | $Enums.PaymentMethod
    reference?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayStatus?: NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput | $Enums.GatewayPaymentStatus | null
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null
    invoice?: InvoiceUpdateOneWithoutPaymentNestedInput
  }

  export type PaymentUncheckedUpdateWithoutUnmatchedMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    invoiceId?: NullableStringFieldUpdateOperationsInput | string | null
    pelangganId?: StringFieldUpdateOperationsInput | string
    amount?: BigIntFieldUpdateOperationsInput | bigint | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: EnumPaymentMethodFieldUpdateOperationsInput | $Enums.PaymentMethod
    reference?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayStatus?: NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput | $Enums.GatewayPaymentStatus | null
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type TransactionCategoryCreateWithoutTransactionsInput = {
    id?: string
    name: string
    type: $Enums.TransactionType
    expenseType?: $Enums.ExpenseType | null
    description?: string | null
    isSystem?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TransactionCategoryUncheckedCreateWithoutTransactionsInput = {
    id?: string
    name: string
    type: $Enums.TransactionType
    expenseType?: $Enums.ExpenseType | null
    description?: string | null
    isSystem?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TransactionCategoryCreateOrConnectWithoutTransactionsInput = {
    where: TransactionCategoryWhereUniqueInput
    create: XOR<TransactionCategoryCreateWithoutTransactionsInput, TransactionCategoryUncheckedCreateWithoutTransactionsInput>
  }

  export type TransactionCategoryUpsertWithoutTransactionsInput = {
    update: XOR<TransactionCategoryUpdateWithoutTransactionsInput, TransactionCategoryUncheckedUpdateWithoutTransactionsInput>
    create: XOR<TransactionCategoryCreateWithoutTransactionsInput, TransactionCategoryUncheckedCreateWithoutTransactionsInput>
    where?: TransactionCategoryWhereInput
  }

  export type TransactionCategoryUpdateToOneWithWhereWithoutTransactionsInput = {
    where?: TransactionCategoryWhereInput
    data: XOR<TransactionCategoryUpdateWithoutTransactionsInput, TransactionCategoryUncheckedUpdateWithoutTransactionsInput>
  }

  export type TransactionCategoryUpdateWithoutTransactionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: EnumTransactionTypeFieldUpdateOperationsInput | $Enums.TransactionType
    expenseType?: NullableEnumExpenseTypeFieldUpdateOperationsInput | $Enums.ExpenseType | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    isSystem?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionCategoryUncheckedUpdateWithoutTransactionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: EnumTransactionTypeFieldUpdateOperationsInput | $Enums.TransactionType
    expenseType?: NullableEnumExpenseTypeFieldUpdateOperationsInput | $Enums.ExpenseType | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    isSystem?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionCreateWithoutCategoryInput = {
    id?: string
    date?: Date | string
    amount: number
    type: $Enums.TransactionType
    description?: string | null
    referenceId?: string | null
    accountId?: string | null
    purchaseOrderId?: string | null
    createdById: string
    attachments?: TransactionCreateattachmentsInput | string[]
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TransactionUncheckedCreateWithoutCategoryInput = {
    id?: string
    date?: Date | string
    amount: number
    type: $Enums.TransactionType
    description?: string | null
    referenceId?: string | null
    accountId?: string | null
    purchaseOrderId?: string | null
    createdById: string
    attachments?: TransactionCreateattachmentsInput | string[]
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TransactionCreateOrConnectWithoutCategoryInput = {
    where: TransactionWhereUniqueInput
    create: XOR<TransactionCreateWithoutCategoryInput, TransactionUncheckedCreateWithoutCategoryInput>
  }

  export type TransactionCreateManyCategoryInputEnvelope = {
    data: TransactionCreateManyCategoryInput | TransactionCreateManyCategoryInput[]
    skipDuplicates?: boolean
  }

  export type TransactionUpsertWithWhereUniqueWithoutCategoryInput = {
    where: TransactionWhereUniqueInput
    update: XOR<TransactionUpdateWithoutCategoryInput, TransactionUncheckedUpdateWithoutCategoryInput>
    create: XOR<TransactionCreateWithoutCategoryInput, TransactionUncheckedCreateWithoutCategoryInput>
  }

  export type TransactionUpdateWithWhereUniqueWithoutCategoryInput = {
    where: TransactionWhereUniqueInput
    data: XOR<TransactionUpdateWithoutCategoryInput, TransactionUncheckedUpdateWithoutCategoryInput>
  }

  export type TransactionUpdateManyWithWhereWithoutCategoryInput = {
    where: TransactionScalarWhereInput
    data: XOR<TransactionUpdateManyMutationInput, TransactionUncheckedUpdateManyWithoutCategoryInput>
  }

  export type TransactionScalarWhereInput = {
    AND?: TransactionScalarWhereInput | TransactionScalarWhereInput[]
    OR?: TransactionScalarWhereInput[]
    NOT?: TransactionScalarWhereInput | TransactionScalarWhereInput[]
    id?: StringFilter<"Transaction"> | string
    date?: DateTimeFilter<"Transaction"> | Date | string
    amount?: FloatFilter<"Transaction"> | number
    type?: EnumTransactionTypeFilter<"Transaction"> | $Enums.TransactionType
    description?: StringNullableFilter<"Transaction"> | string | null
    referenceId?: StringNullableFilter<"Transaction"> | string | null
    categoryId?: StringFilter<"Transaction"> | string
    accountId?: StringNullableFilter<"Transaction"> | string | null
    purchaseOrderId?: StringNullableFilter<"Transaction"> | string | null
    createdById?: StringFilter<"Transaction"> | string
    attachments?: StringNullableListFilter<"Transaction">
    createdAt?: DateTimeFilter<"Transaction"> | Date | string
    updatedAt?: DateTimeFilter<"Transaction"> | Date | string
  }

  export type InvoiceItemCreateManyInvoiceInput = {
    id: string
    description: string
    quantity?: number
    unitPrice: bigint | number
    totalPrice: bigint | number
    itemType?: $Enums.ItemType
  }

  export type PaymentCreateManyInvoiceInput = {
    id: string
    pelangganId: string
    amount: bigint | number
    paymentDate: Date | string
    paymentMethod: $Enums.PaymentMethod
    reference?: string | null
    notes?: string | null
    verifiedBy?: string | null
    verifiedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt: Date | string
    accountId?: string | null
    gatewayStatus?: $Enums.GatewayPaymentStatus | null
    gatewayProvider?: string | null
    transactionId?: string | null
    paymentUrl?: string | null
    expiresAt?: Date | string | null
    unmatchedMutationId?: string | null
    receiptUrl?: string | null
  }

  export type InvoiceItemUpdateWithoutInvoiceInput = {
    id?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    unitPrice?: BigIntFieldUpdateOperationsInput | bigint | number
    totalPrice?: BigIntFieldUpdateOperationsInput | bigint | number
    itemType?: EnumItemTypeFieldUpdateOperationsInput | $Enums.ItemType
  }

  export type InvoiceItemUncheckedUpdateWithoutInvoiceInput = {
    id?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    unitPrice?: BigIntFieldUpdateOperationsInput | bigint | number
    totalPrice?: BigIntFieldUpdateOperationsInput | bigint | number
    itemType?: EnumItemTypeFieldUpdateOperationsInput | $Enums.ItemType
  }

  export type InvoiceItemUncheckedUpdateManyWithoutInvoiceInput = {
    id?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    unitPrice?: BigIntFieldUpdateOperationsInput | bigint | number
    totalPrice?: BigIntFieldUpdateOperationsInput | bigint | number
    itemType?: EnumItemTypeFieldUpdateOperationsInput | $Enums.ItemType
  }

  export type PaymentUpdateWithoutInvoiceInput = {
    id?: StringFieldUpdateOperationsInput | string
    pelangganId?: StringFieldUpdateOperationsInput | string
    amount?: BigIntFieldUpdateOperationsInput | bigint | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: EnumPaymentMethodFieldUpdateOperationsInput | $Enums.PaymentMethod
    reference?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayStatus?: NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput | $Enums.GatewayPaymentStatus | null
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null
    unmatchedMutation?: UnmatchedMutationUpdateOneWithoutPaymentNestedInput
  }

  export type PaymentUncheckedUpdateWithoutInvoiceInput = {
    id?: StringFieldUpdateOperationsInput | string
    pelangganId?: StringFieldUpdateOperationsInput | string
    amount?: BigIntFieldUpdateOperationsInput | bigint | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: EnumPaymentMethodFieldUpdateOperationsInput | $Enums.PaymentMethod
    reference?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayStatus?: NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput | $Enums.GatewayPaymentStatus | null
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    unmatchedMutationId?: NullableStringFieldUpdateOperationsInput | string | null
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type PaymentUncheckedUpdateManyWithoutInvoiceInput = {
    id?: StringFieldUpdateOperationsInput | string
    pelangganId?: StringFieldUpdateOperationsInput | string
    amount?: BigIntFieldUpdateOperationsInput | bigint | number
    paymentDate?: DateTimeFieldUpdateOperationsInput | Date | string
    paymentMethod?: EnumPaymentMethodFieldUpdateOperationsInput | $Enums.PaymentMethod
    reference?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedBy?: NullableStringFieldUpdateOperationsInput | string | null
    verifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayStatus?: NullableEnumGatewayPaymentStatusFieldUpdateOperationsInput | $Enums.GatewayPaymentStatus | null
    gatewayProvider?: NullableStringFieldUpdateOperationsInput | string | null
    transactionId?: NullableStringFieldUpdateOperationsInput | string | null
    paymentUrl?: NullableStringFieldUpdateOperationsInput | string | null
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    unmatchedMutationId?: NullableStringFieldUpdateOperationsInput | string | null
    receiptUrl?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type TransactionCreateManyCategoryInput = {
    id?: string
    date?: Date | string
    amount: number
    type: $Enums.TransactionType
    description?: string | null
    referenceId?: string | null
    accountId?: string | null
    purchaseOrderId?: string | null
    createdById: string
    attachments?: TransactionCreateattachmentsInput | string[]
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TransactionUpdateWithoutCategoryInput = {
    id?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    amount?: FloatFieldUpdateOperationsInput | number
    type?: EnumTransactionTypeFieldUpdateOperationsInput | $Enums.TransactionType
    description?: NullableStringFieldUpdateOperationsInput | string | null
    referenceId?: NullableStringFieldUpdateOperationsInput | string | null
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    purchaseOrderId?: NullableStringFieldUpdateOperationsInput | string | null
    createdById?: StringFieldUpdateOperationsInput | string
    attachments?: TransactionUpdateattachmentsInput | string[]
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionUncheckedUpdateWithoutCategoryInput = {
    id?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    amount?: FloatFieldUpdateOperationsInput | number
    type?: EnumTransactionTypeFieldUpdateOperationsInput | $Enums.TransactionType
    description?: NullableStringFieldUpdateOperationsInput | string | null
    referenceId?: NullableStringFieldUpdateOperationsInput | string | null
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    purchaseOrderId?: NullableStringFieldUpdateOperationsInput | string | null
    createdById?: StringFieldUpdateOperationsInput | string
    attachments?: TransactionUpdateattachmentsInput | string[]
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionUncheckedUpdateManyWithoutCategoryInput = {
    id?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    amount?: FloatFieldUpdateOperationsInput | number
    type?: EnumTransactionTypeFieldUpdateOperationsInput | $Enums.TransactionType
    description?: NullableStringFieldUpdateOperationsInput | string | null
    referenceId?: NullableStringFieldUpdateOperationsInput | string | null
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    purchaseOrderId?: NullableStringFieldUpdateOperationsInput | string | null
    createdById?: StringFieldUpdateOperationsInput | string
    attachments?: TransactionUpdateattachmentsInput | string[]
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}