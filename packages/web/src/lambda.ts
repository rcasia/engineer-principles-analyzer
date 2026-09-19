/**
 * Driven adapter translating an AWS Lambda Function URL invocation (payload
 * format 2.0) into the `Request -> Response` contract the rest of the web
 * package speaks. Nothing outside this file knows the app runs on Lambda.
 */

export interface FunctionUrlEvent {
  readonly rawPath: string;
  readonly rawQueryString: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body?: string;
  readonly isBase64Encoded: boolean;
  readonly requestContext: { readonly http: { readonly method: string } };
}

export interface FunctionUrlResult {
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

const METHODS_WITHOUT_BODY: ReadonlySet<string> = new Set(["GET", "HEAD"]);

export function toRequest(event: FunctionUrlEvent): Request {
  const host = event.headers["host"] ?? "localhost";
  const query = event.rawQueryString === "" ? "" : `?${event.rawQueryString}`;
  const method = event.requestContext.http.method;

  const headers = Object.entries(event.headers).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );

  const carriesBody =
    event.body !== undefined && !METHODS_WITHOUT_BODY.has(method);

  return new Request(`https://${host}${event.rawPath}${query}`, {
    method,
    headers,
    ...(carriesBody
      ? {
          body: event.isBase64Encoded
            ? Buffer.from(event.body as string, "base64")
            : event.body,
        }
      : {}),
  });
}

export function createLambdaHandler(
  handle: (request: Request) => Promise<Response>,
): (event: FunctionUrlEvent) => Promise<FunctionUrlResult> {
  return async (event: FunctionUrlEvent): Promise<FunctionUrlResult> => {
    const response = await handle(toRequest(event));

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
    };
  };
}
