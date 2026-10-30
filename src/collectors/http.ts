export type FetchText = (url: string) => Promise<string>;
export type FetchJson = (url: string) => Promise<unknown>;
export type FetchBytes = (url: string) => Promise<Uint8Array>;

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

/**
 * Any request (GET or POST) with at most one request per interval per host and an identifying
 * User-Agent. Throws on an HTTP error.
 */
export async function politeFetchResponse(url: string, init: RequestInit & { headers?: Record<string, string> } = {}): Promise<Response> {
  const host = new URL(url).host;
  const interval = INTERVAL_BY_HOST[host] ?? DEFAULT_INTERVAL_MS;
  const wait = (lastRequestByHost.get(host) ?? 0) + interval - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestByHost.set(host, Date.now());

  const res = await fetch(url, {
    ...init,
    // Fixed language: without it some sites (developers.google.com) pick one per request,
    // which the page monitor would report as a change.
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9", ...init.headers },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${url} failed: ${res.status} ${res.statusText}`);
  return res;
}

const politeFetch = (url: string, accept: string) => politeFetchResponse(url, { headers: { Accept: accept } });

/** GET with at most one request per interval per host and an identifying User-Agent. */
export const politeFetchJson: FetchJson = async (url) =>
  (await politeFetch(url, "application/json")).json();

/** Same rules, for binary files such as PDFs. */
export const politeFetchBytes: FetchBytes = async (url) =>
  new Uint8Array(await (await politeFetch(url, "application/pdf,*/*;q=0.8")).arrayBuffer());

export const politeFetchText: FetchText = async (url) =>
  (await politeFetch(url, "text/html,application/xml;q=0.9,*/*;q=0.8")).text();
