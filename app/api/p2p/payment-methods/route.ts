import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import {
  createPaymentMethod,
  listUserPaymentMethods,
  validatePaymentMethodInput
} from "@/lib/p2p/payment-methods";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const methods = await listUserPaymentMethods(userId);
  return NextResponse.json({ methods });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const input = {
    method_type: String(body.method_type ?? ""),
    method_name: String(body.method_name ?? ""),
    account_holder_name: body.account_holder_name ? String(body.account_holder_name) : null,
    details: body.details && typeof body.details === "object" ? (body.details as Record<string, unknown>) : {}
  };

  const error = validatePaymentMethodInput(input);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const method = await createPaymentMethod(userId, input);
  return NextResponse.json({ method }, { status: 201 });
}
