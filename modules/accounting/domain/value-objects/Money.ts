import { Decimal } from "decimal.js";

export class Money {
  private readonly value: Decimal;

  private constructor(value: Decimal) {
    this.value = value;
  }

  static fromNumber(n: number): Money {
    if (!Number.isFinite(n)) {
      throw new Error(`Invalid Money value: ${n}`);
    }
    return new Money(new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
  }

  static fromString(s: string): Money {
    return new Money(new Decimal(s).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
  }

  static fromDecimal(d: Decimal | { toString(): string }): Money {
    return Money.fromString(d.toString());
  }

  static zero(): Money {
    return new Money(new Decimal(0).toDecimalPlaces(2));
  }

  add(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  subtract(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  multiply(scalar: number | string): Money {
    return new Money(
      this.value.times(scalar).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    );
  }

  equals(other: Money): boolean {
    return this.value.equals(other.value);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.isPositive() && !this.value.isZero();
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  toString(): string {
    return this.value.toFixed(2);
  }

  toNumber(): number {
    return this.value.toNumber();
  }

  toDecimal(): Decimal {
    return this.value;
  }
}
