/**
 * Hand-maintained fetcher for `@openapi-codegen` output (`desktopComponents.ts`).
 * Re-run `bun run generate:api` after changing `DesktopFetcherExtraProps`.
 */

export type DesktopFetcherExtraProps = {
  /** Loopback base URL without trailing slash (from control.json / env). */
  baseUrl: string;
  /** Bearer token; never log the raw value. */
  token: string;
};

export type ErrorWrapper<TError> =
  | TError
  | { status: "unknown"; payload: string }
  | { status: number; payload: unknown };

export type DesktopFetcherOptions<TBody, THeaders, TQueryParams, TPathParams> = {
  url: string;
  method: string;
  body?: TBody;
  headers?: THeaders;
  queryParams?: TQueryParams;
  pathParams?: TPathParams;
  signal?: AbortSignal;
} & DesktopFetcherExtraProps;

export async function desktopFetch<
  TData,
  TError,
  TBody extends {} | FormData | undefined | null,
  THeaders extends {},
  TQueryParams extends {},
  TPathParams extends {},
>({
  url,
  method,
  body,
  headers,
  pathParams,
  queryParams,
  signal,
  baseUrl,
  token,
}: DesktopFetcherOptions<TBody, THeaders, TQueryParams, TPathParams>): Promise<TData> {
  const path = resolveUrl(url, queryParams as Record<string, unknown>, pathParams as Record<
    string,
    string
  >);
  const target = `${baseUrl.replace(/\/$/, "")}${path}`;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const response = await fetch(target, {
    method: method.toUpperCase(),
    signal,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(isForm || body === undefined || body === null
        ? {}
        : { "Content-Type": "application/json" }),
      ...(headers as Record<string, string> | undefined),
    },
    body:
      body === undefined || body === null
        ? undefined
        : isForm
          ? (body as FormData)
          : JSON.stringify(body),
  });

  const text = await response.text();
  let payload: unknown = text;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  } else {
    payload = undefined;
  }

  if (!response.ok) {
    const error: ErrorWrapper<TError> = {
      status: response.status,
      payload,
    };
    throw error;
  }

  return payload as TData;
}

function resolveUrl(
  url: string,
  queryParams: Record<string, unknown> = {},
  pathParams: Record<string, string> = {},
): string {
  const query = toQueryString(queryParams);
  const path = url.replace(/\{\w*\}/g, (key) => pathParams[key.slice(1, -1)] ?? "");
  return query ? `${path}?${query}` : path;
}

function toQueryString(queryParams: Record<string, unknown>): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(queryParams)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue;
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
      }
      continue;
    }
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return pairs.join("&");
}
