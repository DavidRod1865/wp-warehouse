import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { compareSync } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;

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
    const { name, pin } = await req.json();

    if (!name || !pin) {
      return new Response(
        JSON.stringify({ error: "Name and PIN are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Normalize the name for lookup (lowercase, trimmed, single spaces)
    const normalizedName = name.trim().toLowerCase().replace(/\s+/g, " ");

    // Look up driver by username
    const { data: driver, error: lookupError } = await adminClient
      .from("users")
      .select(
        "id, username, email, active, pin_code, internal_auth_token, force_pin_change, pin_failed_attempts, pin_locked_until"
      )
      .eq("role", "driver")
      .eq("username", normalizedName)
      .single();

    if (lookupError || !driver) {
      // Generic error to avoid leaking whether the name exists
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if driver is active
    if (!driver.active) {
      return new Response(
        JSON.stringify({ error: "Account is deactivated. Contact your manager." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check lockout
    if (driver.pin_locked_until) {
      const lockedUntil = new Date(driver.pin_locked_until);
      const now = new Date();
      if (lockedUntil > now) {
        const remainingSeconds = Math.ceil(
          (lockedUntil.getTime() - now.getTime()) / 1000
        );
        return new Response(
          JSON.stringify({
            error: "Too many failed attempts. Try again later.",
            locked_until: driver.pin_locked_until,
            remaining_seconds: remainingSeconds,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Verify PIN code exists
    if (!driver.pin_code) {
      return new Response(
        JSON.stringify({ error: "PIN not set. Contact your manager." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Compare PIN
    const pinMatch = compareSync(pin, driver.pin_code);

    if (!pinMatch) {
      const newAttempts = (driver.pin_failed_attempts || 0) + 1;
      const updates: Record<string, unknown> = {
        pin_failed_attempts: newAttempts,
      };

      // Lock after MAX_ATTEMPTS
      if (newAttempts >= MAX_ATTEMPTS) {
        const lockUntil = new Date(
          Date.now() + LOCKOUT_MINUTES * 60 * 1000
        ).toISOString();
        updates.pin_locked_until = lockUntil;
      }

      await adminClient
        .from("users")
        .update(updates)
        .eq("id", driver.id);

      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // PIN matched — reset failed attempts
    await adminClient
      .from("users")
      .update({
        pin_failed_attempts: 0,
        pin_locked_until: null,
      })
      .eq("id", driver.id);

    // Verify internal_auth_token exists
    if (!driver.internal_auth_token || !driver.email) {
      return new Response(
        JSON.stringify({
          error: "Account not fully configured. Contact your manager.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Sign in server-side using the internal password
    const { data: signInData, error: signInError } =
      await adminClient.auth.signInWithPassword({
        email: driver.email,
        password: driver.internal_auth_token,
      });

    if (signInError || !signInData.session) {
      console.error("verify-driver-pin: signInWithPassword failed —", signInError?.message);
      return new Response(
        JSON.stringify({ error: "Authentication failed. Contact your manager." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        force_pin_change: driver.force_pin_change || false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("verify-driver-pin error:", error);
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
