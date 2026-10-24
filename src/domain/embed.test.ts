import { describe, expect, it } from "vitest";
import { parseVideoEmbed } from "./embed";

const ID = "aqz-KE-bpKQ";
const SRC = `https://www.youtube-nocookie.com/embed/${ID}`;

describe("parseVideoEmbed", () => {
  it("accepts the privacy-enhanced embed URL and rebuilds it", () => {
    expect(parseVideoEmbed(SRC)).toEqual({ provider: "youtube", id: ID, src: SRC });
    expect(parseVideoEmbed(`${SRC}?autoplay=1&start=3`)?.src).toBe(SRC);
  });

  it("normalizes watch and short links to the privacy-enhanced embed", () => {
    for (const u of [
      `https://www.youtube.com/watch?v=${ID}&t=5`,
      `https://youtube.com/watch?v=${ID}`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
    ]) {
      expect(parseVideoEmbed(u)?.src, u).toBe(SRC);
    }
  });

  it("rejects everything else", () => {
    for (const u of [
      "",
      "not a url",
      `http://www.youtube-nocookie.com/embed/${ID}`,
      `javascript:alert(1)`,
      `data:text/html,<script>alert(1)</script>`,
      `https://www.youtube-nocookie.com.evil.example/embed/${ID}`,
      `https://evil.example/embed/${ID}?x=www.youtube-nocookie.com`,
      `https://www.youtube-nocookie.com@evil.example/embed/${ID}`,
      `https://user:pw@www.youtube-nocookie.com/embed/${ID}`,
      `https://www.youtube-nocookie.com:8443/embed/${ID}`,
      `https://www.youtube-nocookie.com/embed/short`,
      `https://www.youtube-nocookie.com/embed/${ID}/extra`,
      `https://www.youtube-nocookie.com/embed/${ID.slice(0, 10)}"`,
      `https://vimeo.com/123456`,
      `https://www.youtube.com/watch?v=<script>`,
    ]) {
      expect(parseVideoEmbed(u), u).toBeNull();
    }
    expect(parseVideoEmbed(null)).toBeNull();
    expect(parseVideoEmbed(undefined)).toBeNull();
  });
});
