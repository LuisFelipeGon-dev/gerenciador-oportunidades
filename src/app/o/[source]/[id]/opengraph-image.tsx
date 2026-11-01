import { ImageResponse } from "next/og";
import { getOpportunity } from "@/lib/opportunities";
import { sourceIdFromSegment } from "@/lib/program-alerts";
import { MODALITY_LABEL, TYPE_LABEL, placeLine } from "../../../_components/format";

// The card WhatsApp, Instagram and others show for a shared link: the hero's look (dark slate,
// fine grid, the "?" in dots), with the title, where and the deadline.

export const alt = "Oportunidade no Topa?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const C = { bg: "#070f1d", ink: "#e8f0ff", muted: "#8fa3c4", line: "#1d2c47", action: "#4ea1ff", signal: "#35e8c8", urgent: "#ff8080" };
const MATRIX = [".#####.", "#.....#", "#.....#", "......#", ".....#.", "....#..", "...#...", "...#...", ".......", "...#..."];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default async function Image({ params }: { params: Promise<{ source: string; id: string }> }) {
  const { source, id } = await params;
  const found = await getOpportunity(source, sourceIdFromSegment(id));
  const o = found.configured ? found.item : null;

  const title = o?.title ?? "Oportunidades pra estudantes";
  const kicker = o ? [TYPE_LABEL[o.type], MODALITY_LABEL[o.modality], o.modality === "online" ? null : placeLine(o)].filter(Boolean).join("  ·  ") : "Topa?";
  const date = o?.registrationDeadline ?? o?.startsOn ?? null;
  const dateLabel = o?.registrationDeadline ? "inscrições até" : "acontece em";
  const benefit = o?.benefits[0] ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: C.bg,
          backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
          backgroundSize: "56px 56px",
          color: C.ink,
          padding: "56px 64px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 820, height: "100%" }}>
          <div style={{ display: "flex", alignItems: "flex-end", fontSize: 34, letterSpacing: -2 }}>
            topa<span style={{ color: C.action }}>?</span>
          </div>
          <div style={{ display: "flex", marginTop: 56, fontSize: 26, color: C.action }}>{kicker}</div>
          <div style={{ display: "flex", marginTop: 14, fontSize: title.length > 60 ? 50 : 62, lineHeight: 1.12, letterSpacing: -2 }}>{title}</div>
          <div style={{ display: "flex", marginTop: "auto", alignItems: "stretch", gap: 18 }}>
            {date && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  padding: "10px 22px",
                  border: `2px solid ${o?.registrationDeadline ? C.urgent : C.action}`,
                  color: o?.registrationDeadline ? C.urgent : C.action,
                }}
              >
                <span style={{ fontSize: 20 }}>{dateLabel}</span>
                <span style={{ fontSize: 44, letterSpacing: -1 }}>{`${date.slice(8, 10)} ${MONTHS[Number(date.slice(5, 7)) - 1]}`}</span>
              </div>
            )}
            {benefit && (
              <div style={{ display: "flex", alignItems: "center", padding: "0 22px", borderLeft: `4px solid ${C.action}`, background: "rgba(78,161,255,0.14)", fontSize: 28 }}>
                {benefit.length > 48 ? `${benefit.slice(0, 46)}…` : benefit}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", position: "absolute", right: 64, top: 96, gap: 10 }}>
          {MATRIX.map((row, y) => (
            <div key={y} style={{ display: "flex", gap: 10 }}>
              {[...row].map((c, x) => {
                const on = c === "#";
                const last = on && y === MATRIX.length - 1;
                return (
                  <div key={x} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div
                      style={{
                        width: on ? 26 : 7,
                        height: on ? 26 : 7,
                        borderRadius: 999,
                        background: last ? C.signal : on ? C.action : "#33496d",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
