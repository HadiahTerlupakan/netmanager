export class Money {
  private constructor(public readonly amount: number) {}

  static of(amount: number): Money {
    return new Money(Math.floor(amount));
  }

  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return Money.of(this.amount + other.amount);
  }

  subtract(other: Money): Money {
    return Money.of(this.amount - other.amount);
  }

  multiply(factor: number): Money {
    return Money.of(this.amount * factor);
  }

  divide(divisor: number): Money {
    if (divisor === 0) throw new Error("Cannot divide by zero");
    return Money.of(this.amount / divisor);
  }

  capAt(max: number): Money {
    return this.amount > max ? Money.of(max) : this;
  }

  isGreaterThan(other: Money): boolean {
    return this.amount > other.amount;
  }

  isLessThan(other: Money): boolean {
    return this.amount < other.amount;
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  isNegative(): boolean {
    return this.amount < 0;
  }
}
