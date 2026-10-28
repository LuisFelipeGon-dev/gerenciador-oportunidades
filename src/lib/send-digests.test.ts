import { describe, expect, it } from "vitest";
import { sendDigests, type Recipient } from "./send-digests";

const recipient = (userId: string): Recipient => ({
  userId,
  email: `${userId}@x`,
  subject: "s",
  html: "<p>h</p>",
  text: "t",
});

describe("sendDigests", () => {
  it("sends to everyone in order and reports who failed without stopping", async () => {
    const calls: string[] = [];
    const send = async (msg: { to: string }) => {
      calls.push(msg.to);
      if (msg.to === "b@x") throw new Error("SMTP 550");
    };
    const result = await sendDigests([recipient("a"), recipient("b"), recipient("c")], send, { delayMs: 0 });
    expect(calls).toEqual(["a@x", "b@x", "c@x"]);
    expect(result).toEqual({ sent: ["a", "c"], failed: ["b"] });
  });

  it("passes the subject, HTML and text through", async () => {
    let received: unknown;
    await sendDigests([recipient("a")], async (msg) => void (received = msg), { delayMs: 0 });
    expect(received).toEqual({ to: "a@x", subject: "s", html: "<p>h</p>", text: "t" });
  });
});
