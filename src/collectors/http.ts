export type FetchText = (url: string) => Promise<string>;
export type FetchJson = (url: string) => Promise<unknown>;

const DEFAULT_INTERVAL_MS = 1000;
// Hosts whose robots.txt asks for a longer Crawl-delay.
const INTERVAL_BY_HOST: Record<string, number> = {
  "gdg.community.dev": 2000,
};
const lastRequestByHost = new Map<string, number>();

const USER_AGENT = `OportunidadesBot/0.1 (+${
  process.env.COLLECTOR_CONTACT ?? "https://github.com/LuisFelipeGon-dev/gerenciador-oportunidades"
})`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function politeFetch(url: string, accept: string): Promise<Response> {
  const host = new URL(url).host;
  const interval = INTERVAL_BY_HOST[host] ?? DEFAULT_INTERVAL_MS;
  const wait = (lastRequestByHost.get(host) ?? 0) + interval - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestByHost.set(host, Date.now());

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: accept },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  return res;
}

/** GET with at most one request per interval per host and an identifying User-Agent. */
export const politeFetchJson: FetchJson = async (url) =>
  (await politeFetch(url, "application/json")).json();

export const politeFetchText: FetchText = async (url) =>
  (await politeFetch(url, "text/html,application/xml;q=0.9,*/*;q=0.8")).text();
