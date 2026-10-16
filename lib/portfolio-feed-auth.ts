import { createClient } from "@supabase/supabase-js";

export type StarrPortfolioFeedIdentity = {
  email: string;
  fullName: string;
  role: string;
};

const STARR_SUPABASE_URL = "https://puqicqiyjqgsbtsxxgxq.supabase.co";
const STARR_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_IDZSSBfQ9SDstdeFFHXH_A_z-LlxqTh";
const COMPANY_ID = "workforge";

export async function verifyStarrPortfolioFeed(
  authorization: string | null,
): Promise<StarrPortfolioFeedIdentity | null> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;

  try {
    const supabase = createClient(STARR_SUPABASE_URL, STARR_SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const email = userData.user?.email?.trim().toLowerCase();
    if (userError || !userData.user || !email) return null;

    const { data: profile, error: profileError } = await supabase
      .from("portal_user_profiles")
      .select("id,role,is_active,full_name")
      .eq("email", email)
      .eq("is_active", true)
      .maybeSingle();
    if (profileError || !profile?.id || !profile.is_active) return null;

    const { data: access, error: accessError } = await supabase
      .from("portal_user_company_access")
      .select("company_role,is_active")
      .eq("profile_id", profile.id)
      .eq("company_id", COMPANY_ID)
      .eq("is_active", true)
      .maybeSingle();
    if (accessError || !access?.is_active) return null;

    return { email, fullName: profile.full_name || email, role: access.company_role || profile.role };
  } catch {
    return null;
  }
}
