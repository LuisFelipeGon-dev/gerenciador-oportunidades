import { describe, expect, it } from "vitest";
import { diffLines, extractText, hashText } from "./page-monitor";

describe("extractText", () => {
  it("keeps visible text and drops scripts, styles and markup", () => {
    const html = `<html><head><style>.a{}</style><script>window.build="abc123"</script></head>
      <body><h1>Claude&nbsp;Campus</h1><p>Applications open <b>September 1</b> &amp; close September 12.</p>
      <!-- tracking --><ul><li>18+</li></ul></body></html>`;
    expect(extractText(html)).toBe(
      "Claude Campus\nApplications open September 1 & close September 12.\n18+",
    );
  });

  it("ignores changes that only touch scripts or attributes", () => {
    const a = `<p class="x" data-id="1">Texto</p><script>var t=1</script>`;
    const b = `<p class="y" data-id="2">Texto</p><script>var t=2</script>`;
    expect(hashText(extractText(a))).toBe(hashText(extractText(b)));
  });
});

describe("diffLines", () => {
  it("lists added and removed lines", () => {
    expect(diffLines("Fechado\nRequisitos: 18+", "Inscrições abertas\nRequisitos: 18+")).toEqual({
      added: ["Inscrições abertas"],
      removed: ["Fechado"],
    });
  });
});
