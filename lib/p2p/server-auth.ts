import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail } from "@/lib/users";

export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (id) return id;

  const email = session?.user?.email;
  if (!email) return null;

  const user = await getUserByEmail(email);
  return user?.id ?? null;
}
