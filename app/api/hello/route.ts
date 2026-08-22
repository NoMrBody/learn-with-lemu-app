// File path app/api/hello/route.ts -> automatically becomes the endpoint GET/POST /api/hello
// This is your Spring Boot @RestController equivalent, but it's just a function per HTTP verb.
// No annotations, no bean wiring — the exported function name (GET, POST, ...) IS the routing.

import { NextRequest, NextResponse } from "next/server";

// Handles: GET /api/hello
export async function GET() {
  return NextResponse.json({
    message: "This runs on the server, not the browser.",
    note: "Safe to use secrets/DB access here — this code never ships to the client.",
  });
}

// Handles: POST /api/hello
export async function POST(request: NextRequest) {
  const body = await request.json();

  // In a real route this is where you'd validate input and call your DB
  // (e.g. Supabase client, or Prisma) -- same spot your Spring @Service call would go.
  return NextResponse.json({
    youSent: body,
    echoedAt: new Date().toISOString(),
  });
}
