import { validateWithdrawalInput } from "./wallet-input-validation";

describe("validateWithdrawalInput", () => {
  const validAddress = "0x0123456789abcdef0123456789abcdef01234567";

  it("accepts a positive finite amount with at most two decimal places and a valid BEP-20 address", () => {
    expect(validateWithdrawalInput(12.34, ` ${validAddress} `)).toEqual({
      amount: 12.34,
      walletAddress: validAddress,
    });
  });

  it.each([0, -1, NaN, Infinity, -Infinity, 1.001, Number.MAX_VALUE, "10", null, undefined])(
    "rejects invalid amount %p",
    (amount) => {
      expect(() => validateWithdrawalInput(amount, validAddress)).toThrow();
    }
  );

  it.each(["", "not-an-address", "0x1234", "0xGG23456789abcdef0123456789abcdef01234567", null, undefined, 123])(
    "rejects invalid wallet address %p",
    (address) => {
      expect(() => validateWithdrawalInput(10, address)).toThrow(
        "A valid USDT (BEP-20) wallet address is required"
      );
    }
  );
});
