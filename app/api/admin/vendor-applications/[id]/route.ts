import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { hasPermission, isAdminEmail } from "@/lib/roles";
import { dbQuery, ensureDatabase } from "@/lib/db";
import { createNotification } from "@/lib/p2p/notifications";
import { ensureVendorListings } from "@/lib/p2p/vendor";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;
  const isAllowed = allowDevAdmin || isAdminEmail(session?.user?.email) ||
    hasPermission(session?.user?.role ?? "member", session?.user?.permissions ?? [], "view_dashboard");

  if (!isAllowed) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const action = String(body.action ?? "");
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Action must be 'approve' or 'reject'." }, { status: 400 });
  }

  await ensureDatabase();

  const rows = await dbQuery<{
    id: string;
    user_id: string;
    status: string;
    details: string;
  }>(
    `SELECT id::TEXT AS id, user_id::TEXT AS user_id, status, details::TEXT AS details
     FROM p2p_advertiser_applications WHERE id = $1`,
    [params.id]
  );

  const appRow = rows[0];
  if (!appRow) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  if (appRow.status !== "pending") {
    return NextResponse.json({ error: "Application has already been reviewed." }, { status: 400 });
  }

  const adminId = session?.user?.id;

  await dbQuery(
    `UPDATE p2p_advertiser_applications SET status = $2, reviewed_by = $3, reviewed_at = NOW() WHERE id = $1`,
    [params.id, action === "approve" ? "approved" : "rejected", adminId]
  );

  if (action === "approve") {
    // Set the user as a vendor
    await dbQuery(
      `UPDATE users SET p2p_advertiser_status = 'general', p2p_advertiser_level = 'beginner', updated_at = NOW() WHERE id = $1`,
      [appRow.user_id]
    );

    // Provision the vendor's listings from their application so they actually
    // appear on the trade page once they declare inventory.
    await ensureVendorListings(appRow.user_id);

    await createNotification(appRow.user_id, {
      type: "vendor_approved",
      title: "Vendor application approved",
      body: "Your vendor application has been approved. You can now start trading as a vendor."
    });
  } else {
    await createNotification(appRow.user_id, {
      type: "vendor_rejected",
      title: "Vendor application update",
      body: "Your vendor application was not approved at this time. You may reapply later."
    });
  }

  return NextResponse.json({ ok: true });
}
