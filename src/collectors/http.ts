export type FetchJson = (url: string) => Promise<unknown>;

const MIN_INTERVAL_MS = 1000;
const lastRequestByHost = new Map<string, number>();

const USER_AGENT = `OportunidadesBot/0.1 (+${
  process.env.COLLECTOR_CONTACT ?? "https://github.com/LuisFelipeGon-dev/gerenciador-oportunidades"
})`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** GET JSON with at most one request per second per host and an identifying User-Agent. */
export const politeFetchJson: FetchJson = async (url) => {
  const host = new URL(url).host;
  const wait = (lastRequestByHost.get(host) ?? 0) + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestByHost.set(host, Date.now());

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  return res.json();
};
