import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const normalizeUsername = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const usernameToAlias = (value: string) => {
  const normalized = normalizeUsername(value);
  return normalized
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const { username, driverFolderId } = await req.json();
    if (!username) {
      return new Response("Missing username", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response("Server misconfigured", {
        status: 500,
        headers: corsHeaders,
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user: requester },
    } = await userClient.auth.getUser();

    if (!requester) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { data: requesterProfile } = await adminClient
      .from("users")
      .select("role")
      .eq("id", requester.id)
      .single();

    if (
      !requesterProfile ||
      !["warehouse_manager", "admin", "apm"].includes(requesterProfile.role)
    ) {
      return new Response("Forbidden", {
        status: 403,
        headers: corsHeaders,
      });
    }

    const normalizedUsername = normalizeUsername(username);
    const alias = usernameToAlias(normalizedUsername);
    if (!alias) {
      return new Response("Invalid username", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const emailAlias = `${alias}@drivers.local`;
    const { data: authUser, error: authError } =
      await adminClient.auth.admin.getUserByEmail(emailAlias);

    if (authError || !authUser?.user) {
      return new Response("Auth user not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    const { error: upsertError } = await adminClient.from("users").upsert({
      id: authUser.user.id,
      email: emailAlias,
      username: normalizedUsername,
      role: "driver",
      active: true,
      driver_sortly_folder_id: driverFolderId ?? null,
    });

    if (upsertError) {
      return new Response(upsertError.message, {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(message, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
