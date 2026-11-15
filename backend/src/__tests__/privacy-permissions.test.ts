import { canReceiveMention } from "../security/privacyPermissions";

describe("mention privacy permissions", () => {
  test("defaults missing and unknown settings to everyone", () => {
    expect(canReceiveMention(undefined, false)).toBe(true);
    expect(canReceiveMention("unexpected-value", false)).toBe(true);
    expect(canReceiveMention("everyone", false)).toBe(true);
  });

  test.each(["nobody", "noone", "none"])("blocks mentions when mode is %s", mode => {
    expect(canReceiveMention(mode, true)).toBe(false);
  });

  test("followers-only allows an account that follows the target", () => {
    expect(canReceiveMention("followers", true)).toBe(true);
    expect(canReceiveMention("following", true)).toBe(true);
  });

  test("followers-only blocks an account that does not follow the target", () => {
    expect(canReceiveMention("followers", false)).toBe(false);
    expect(canReceiveMention("following", false)).toBe(false);
  });
});
