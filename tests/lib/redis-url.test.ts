import { describe, expect, it } from "vitest";

import { DEFAULT_LOCAL_REDIS_URL, redisOptionsFromUrl } from "@/lib/redis-url";

describe("redisOptionsFromUrl", () => {
  it("parses the local default", () => {
    expect(redisOptionsFromUrl(DEFAULT_LOCAL_REDIS_URL)).toEqual({
      host: "localhost",
      port: 6379,
    });
  });

  it("parses the production form with password only", () => {
    expect(redisOptionsFromUrl("redis://:s3cret@redis:6379")).toEqual({
      host: "redis",
      port: 6379,
      password: "s3cret",
    });
  });

  it("decodes username and password", () => {
    expect(
      redisOptionsFromUrl("redis://app%40user:p%40ss%3Aw0rd@cache:6380"),
    ).toEqual({
      host: "cache",
      port: 6380,
      username: "app@user",
      password: "p@ss:w0rd",
    });
  });

  it("reads the database from the path or ?db=", () => {
    expect(redisOptionsFromUrl("redis://redis:6379/2").db).toBe(2);
    expect(redisOptionsFromUrl("redis://redis:6379?db=5").db).toBe(5);
  });

  it("ignores malformed family values but keeps valid ones", () => {
    expect(
      redisOptionsFromUrl("redis://redis:6379?family=undefined").family,
    ).toBeUndefined();
    expect(redisOptionsFromUrl("redis://redis:6379?family=6").family).toBe(6);
  });

  it("does not send empty auth", () => {
    const options = redisOptionsFromUrl("redis://:@redis:6379");
    expect(options.username).toBeUndefined();
    expect(options.password).toBeUndefined();
  });

  it("enables TLS for rediss:// and unwraps IPv6 hosts", () => {
    expect(redisOptionsFromUrl("rediss://[::1]:6379")).toEqual({
      host: "::1",
      port: 6379,
      tls: {},
    });
  });

  it("rejects non-redis protocols", () => {
    expect(() => redisOptionsFromUrl("http://redis:6379")).toThrow(
      "Protokol REDIS_URL tidak didukung",
    );
  });
});
