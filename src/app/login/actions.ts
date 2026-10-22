"use server";

import { cookies } from "next/headers";
import {
  fetchLoginAccess,
  resolveLoginAccess,
  type LoginDenial,
} from "@/lib/auth/login-access";
import type { PostLoginDestination } from "@/lib/auth/post-login";
import { createClient } from "@/lib/supabase/server";

export type PostLoginResult =
  | { kind: "redirect"; destination: PostLoginDestination }
  | { kind: "denied"; reason: LoginDenial };

export async function getPostLoginDestination(
  clientSavedOrganizationId: string | null = null,
): Promise<PostLoginResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sesi login tidak valid");

  let access;
  try {
    access = await fetchLoginAccess(supabase);
  } catch {
    throw new Error("Pemeriksaan akses gagal sementara. Coba beberapa saat lagi.");
  }

  const cookieStore = await cookies();
  const savedOrganizationId =
    cookieStore.get("cervise_org")?.value ?? clientSavedOrganizationId;

  const decision = resolveLoginAccess({ access, savedOrganizationId });

  if (decision.kind === "denied") {
    // Akun yang tenant-nya tidak aktif tidak boleh memegang sesi.
    try {
      await supabase.auth.signOut();
    } catch {
      // Kalau signOut gagal, middleware tetap menolak akses ke halaman tenant.
    }
    return { kind: "denied", reason: decision.reason };
  }

  return { kind: "redirect", destination: decision.destination };
}
