import { timingSafeEqual } from "node:crypto";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new HttpError(503, `The server is missing the ${name} setting.`);
  return value;
}

// Every route spends API credits, so an access code is mandatory.
function checkAccess(request: Request): void {
  const expected = Buffer.from(requireEnv("SOTTO_ACCESS_CODE"));
  const provided = Buffer.from(request.headers.get("x-access-code") ?? "");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new HttpError(401, "Wrong or missing access code. Enter it in Settings.");
  }
}

export function route(handler: (request: Request) => Promise<Response>): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      checkAccess(request);
      return await handler(request);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error(error);
      return json({ error: "Unexpected server error." }, 500);
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "The request body must be JSON.");
  }
}
