import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SortlyWebhookPayload {
  event: "Created" | "Edited" | "Moved" | "Deleted";
  item: {
    id: number;
    name: string;
    quantity?: number;
    parent_id?: number;
    type?: string;
    [key: string]: unknown;
  };
  timestamp: string;
  [key: string]: unknown;
}

serve(async (req) => {
  // Handle CORS preflight
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
    const payload: SortlyWebhookPayload = await req.json();

    // Validate required fields
    if (!payload.event || !payload.item || !payload.item.id) {
      console.error("Invalid webhook payload:", payload);
      return new Response(
        JSON.stringify({
          error: "Invalid payload: missing required fields (event, item.id)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Server misconfigured: missing Supabase credentials");
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log(
      `Received Sortly webhook: ${payload.event} for item ${payload.item.id} (${payload.item.name})`
    );

    // Log webhook to database
    const { error: logError } = await supabase
      .from("sortly_webhook_logs")
      .insert({
        event_type: payload.event,
        item_id: payload.item.id,
        payload: payload,
        status: "processed",
        error_message: null,
      });

    if (logError) {
      console.error("Error logging webhook:", logError);
      // Continue processing even if logging fails
    }

    // Broadcast Realtime event to all connected clients
    // This allows frontend apps to invalidate their cache and refresh data
    const channel = supabase.channel("inventory-updates");

    try {
      // Send Realtime broadcast for cache invalidation
      await channel.send({
        type: "broadcast",
        event: "inventory_update",
        payload: {
          event_type: payload.event,
          item_id: payload.item.id,
          item_name: payload.item.name,
          timestamp: payload.timestamp,
        },
      });

      console.log(
        `Broadcast Realtime event for ${payload.event} on item ${payload.item.id}`
      );
    } catch (broadcastError) {
      console.error("Error broadcasting Realtime event:", broadcastError);
      // Log the broadcast failure but don't fail the webhook
      await supabase
        .from("sortly_webhook_logs")
        .update({
          status: "partial",
          error_message: `Broadcast failed: ${
            broadcastError instanceof Error
              ? broadcastError.message
              : "Unknown error"
          }`,
        })
        .eq("item_id", payload.item.id)
        .eq("event_type", payload.event)
        .order("processed_at", { ascending: false })
        .limit(1);
    }

    // Log activity for certain events (Created, Moved, Deleted)
    if (["Created", "Moved", "Deleted"].includes(payload.event)) {
      const activityType =
        payload.event === "Created"
          ? "item_created"
          : payload.event === "Moved"
          ? "item_moved"
          : "item_deleted";

      const { error: activityError } = await supabase
        .from("activity_log")
        .insert({
          user_id: null, // Webhook events don't have a user
          action_type: activityType,
          entity_type: "sortly_item",
          entity_id: payload.item.id.toString(),
          details: {
            item_name: payload.item.name,
            event: payload.event,
            quantity: payload.item.quantity,
            parent_id: payload.item.parent_id,
          },
        });

      if (activityError) {
        console.error("Error logging activity:", activityError);
        // Continue processing even if activity logging fails
      }
    }

    console.log(`Successfully processed webhook for item ${payload.item.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processed successfully",
        event: payload.event,
        item_id: payload.item.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing webhook:", error);

    // Attempt to log the error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (supabaseUrl && serviceRoleKey) {
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const payload = await req.clone().json();

        await supabase.from("sortly_webhook_logs").insert({
          event_type: payload?.event || "Unknown",
          item_id: payload?.item?.id || null,
          payload: payload || {},
          status: "failed",
          error_message:
            error instanceof Error ? error.message : "Unknown error",
        });
      }
    } catch (logError) {
      console.error("Failed to log error to database:", logError);
    }

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
