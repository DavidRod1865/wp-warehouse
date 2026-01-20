import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const { userId } = await req.json();
    if (!userId) {
      return new Response("Missing userId", {
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

    // Generate a temporary password
    const tempPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

    const { error: resetError } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: tempPassword }
    );

    if (resetError) {
      return new Response(resetError.message, {
        status: 500,
        headers: corsHeaders,
      });
    }

    const { error: auditError } = await adminClient
      .from("users")
      .update({
        last_password_reset_at: new Date().toISOString(),
        last_password_reset_by: requester.id,
      })
      .eq("id", userId);

    if (auditError) {
      return new Response(auditError.message, {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({ tempPassword }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(message, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
