import { type NextRequest, NextResponse } from "next/server";

const API_URL = process.env.INTERNAL_API_URL ?? "http://localhost:3001";

async function handler(request: NextRequest) {
  const { pathname, search } = new URL(request.url);
  const targetUrl = `${API_URL}${pathname}${search}`;

  // Forward select headers — exclude host, forward cookie explicitly
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  // Forward auth cookie from web domain to API
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) headers.set("cookie", cookieHeader);

  const body =
    request.method !== "GET" && request.method !== "HEAD"
      ? await request.arrayBuffer()
      : undefined;

  const apiResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });

  const nextResponse = new NextResponse(apiResponse.body, {
    status: apiResponse.status,
  });

  // Forward non-cookie response headers
  apiResponse.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k !== "set-cookie" && k !== "transfer-encoding") {
      nextResponse.headers.set(key, value);
    }
  });

  // Forward Set-Cookie headers properly (Node 20+ getSetCookie())
  const responseHeaders = apiResponse.headers as unknown as { getSetCookie?: () => string[] };
  const setCookies: string[] = typeof responseHeaders.getSetCookie === "function" ? responseHeaders.getSetCookie() : [];

  for (const cookieStr of setCookies) {
    const [nameValue, ...attrs] = cookieStr.split(";").map((s) => s.trim());
    const eqIdx = nameValue.indexOf("=");
    const name = nameValue.slice(0, eqIdx);
    const value = nameValue.slice(eqIdx + 1);

    const opts: Parameters<typeof nextResponse.cookies.set>[2] = { path: "/" };
    for (const attr of attrs) {
      const lower = attr.toLowerCase();
      if (lower === "httponly") opts.httpOnly = true;
      else if (lower === "secure") opts.secure = true;
      else if (lower.startsWith("samesite="))
        opts.sameSite = attr.split("=")[1].toLowerCase() as "lax" | "strict" | "none";
      else if (lower.startsWith("max-age="))
        opts.maxAge = parseInt(attr.split("=")[1], 10);
      else if (lower.startsWith("path=")) opts.path = attr.split("=")[1];
    }

    nextResponse.cookies.set(name, value, opts);
  }

  return nextResponse;
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as DELETE,
  handler as PATCH,
};
