import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { hashSync, compareSync } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

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
    const body = await req.json();
    const { userId, pin, currentPin, newPin } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate the requester
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");

    if (!jwt) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey);
    const {
      data: { user: requester },
      error: authError,
    } = await userClient.auth.getUser(jwt);

    if (!requester) {
      console.error("set-driver-pin: getUser failed —", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: requesterProfile } = await adminClient
      .from("users")
      .select("role, pin_code, force_pin_change")
      .eq("id", requester.id)
      .single();

    if (!requesterProfile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const isManager = ["warehouse_manager", "admin", "apm"].includes(
      requesterProfile.role
    );
    const isDriverSelf =
      requesterProfile.role === "driver" && !userId;

    // --- Mode 1: Manager sets PIN for a driver ---
    if (isManager && userId && pin) {
      if (!/^\d{4,6}$/.test(pin)) {
        return new Response(
          JSON.stringify({ error: "PIN must be 4-6 digits" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const hashedPin = hashSync(pin);

      const { error: updateError } = await adminClient
        .from("users")
        .update({
          pin_code: hashedPin,
          force_pin_change: true,
          pin_failed_attempts: 0,
          pin_locked_until: null,
        })
        .eq("id", userId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Audit log
      await adminClient.from("activity_log").insert({
        user_id: requester.id,
        action: "driver_pin_set",
        entity_type: "user",
        entity_id: userId,
        details: { set_by: "manager" },
      });

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // --- Mode 2: Driver changes own PIN ---
    if (isDriverSelf && newPin) {
      if (!/^\d{4,6}$/.test(newPin)) {
        return new Response(
          JSON.stringify({ error: "PIN must be 4-6 digits" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // If not a forced change, verify current PIN
      if (!requesterProfile.force_pin_change) {
        if (!currentPin) {
          return new Response(
            JSON.stringify({ error: "Current PIN is required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        if (!requesterProfile.pin_code) {
          return new Response(
            JSON.stringify({ error: "No PIN set. Contact your manager." }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const currentMatch = compareSync(
          currentPin,
          requesterProfile.pin_code
        );

        if (!currentMatch) {
          return new Response(
            JSON.stringify({ error: "Current PIN is incorrect" }),
            {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      const hashedPin = hashSync(newPin);

      const { error: updateError } = await adminClient
        .from("users")
        .update({
          pin_code: hashedPin,
          force_pin_change: false,
          pin_failed_attempts: 0,
          pin_locked_until: null,
        })
        .eq("id", requester.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Audit log
      await adminClient.from("activity_log").insert({
        user_id: requester.id,
        action: "driver_pin_changed",
        entity_type: "user",
        entity_id: requester.id,
        details: { changed_by: "driver" },
      });

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid request. Provide either (userId + pin) as a manager, or (newPin) as a driver." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("set-driver-pin error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
