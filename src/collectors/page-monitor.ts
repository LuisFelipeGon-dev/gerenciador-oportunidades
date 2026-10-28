import { createHash } from "node:crypto";

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
};

/**
 * Visible text of a page, one block per line. Scripts, styles and markup are dropped so that
 * build ids, tokens and tracking attributes do not count as changes.
 */
export function extractText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/?(p|div|li|h[1-6]|section|article|br|tr|td|th|ul|ol|header|footer|main)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:#(\d+)|#x([0-9a-f]+)|[a-z]+);/gi, (entity, dec, hex) =>
      dec ? String.fromCodePoint(Number(dec)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : (ENTITIES[entity] ?? entity),
    )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Hash of the set of lines. Order and repetition are ignored: some pages shuffle or repeat
 * blocks (carousels, testimonials) on every load without any real change.
 */
export function fingerprint(text: string): string {
  const lines = [...new Set(text.split("\n"))].sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

/** Lines that appeared and disappeared, for a short human-readable summary. */
export function diffLines(before: string, after: string, limit = 15) {
  const oldLines = new Set(before.split("\n"));
  const newLines = new Set(after.split("\n"));
  return {
    added: [...newLines].filter((l) => !oldLines.has(l)).slice(0, limit),
    removed: [...oldLines].filter((l) => !newLines.has(l)).slice(0, limit),
  };
}
