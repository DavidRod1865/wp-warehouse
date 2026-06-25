import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface NotificationRequest {
  type: "assigned" | "started" | "completed" | "failed";
  delivery_id: number;
  delivery_number: string;
  recipient_id: string;
  recipient_email?: string;
  recipient_username?: string;
  additional_data?: Record<string, unknown>;
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

    // JWT verification
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
    const { data: { user: requester }, error: authError } =
      await userClient.auth.getUser(jwt);

    if (!requester) {
      console.error("send-delivery-notification: getUser failed —", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Role check — allow managers, admins, APMs, and drivers
    const { data: requesterProfile } = await adminClient
      .from("users")
      .select("role")
      .eq("id", requester.id)
      .single();

    if (
      !requesterProfile ||
      !["warehouse_manager", "admin", "apm", "driver"].includes(requesterProfile.role)
    ) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const {
      type,
      delivery_id,
      delivery_number,
      recipient_id,
      recipient_email,
      recipient_username,
      additional_data,
    }: NotificationRequest = await req.json();

    // Validate required fields
    if (!type || !delivery_id || !delivery_number || !recipient_id) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: type, delivery_id, delivery_number, recipient_id",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user notification preferences
    const { data: user, error: userError } = await adminClient
      .from("users")
      .select("notification_preferences, email, username")
      .eq("id", recipient_id)
      .single();

    if (userError) {
      console.error("Error fetching user:", userError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if user has email notifications enabled
    const preferences = user?.notification_preferences as {
      email?: boolean;
      sms?: boolean;
    } | null;

    if (!preferences || !preferences.email) {
      console.log(`User ${recipient_id} has email notifications disabled. Skipping.`);
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "User has email notifications disabled",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare notification metadata
    const metadata = {
      delivery_number,
      recipient_email: recipient_email || user.email,
      recipient_username: recipient_username || user.username,
      ...additional_data,
    };

    // Format notification message based on type
    let notificationMessage = "";
    switch (type) {
      case "assigned":
        notificationMessage = `You have been assigned to delivery ${delivery_number}`;
        break;
      case "started":
        notificationMessage = `Delivery ${delivery_number} has been started`;
        break;
      case "completed":
        notificationMessage = `Delivery ${delivery_number} has been completed`;
        break;
      case "failed":
        notificationMessage = `Delivery ${delivery_number} has encountered an issue`;
        break;
      default:
        notificationMessage = `Update on delivery ${delivery_number}`;
    }

    console.log(`Notification for ${type}:`, notificationMessage);

    // TODO: Integrate with email service (Resend, SendGrid, etc.)
    // For MVP, we're just logging and tracking in the database
    //
    // Example integration with Resend:
    // const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    // const response = await fetch("https://api.resend.com/emails", {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Bearer ${RESEND_API_KEY}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     from: "notifications@yourapp.com",
    //     to: recipient_email,
    //     subject: `Delivery ${delivery_number} - ${type}`,
    //     text: notificationMessage,
    //   }),
    // });

    // Record notification in database
    const { data: notification, error: insertError } = await adminClient
      .from("notifications")
      .insert({
        user_id: recipient_id,
        delivery_id,
        notification_type: type,
        status: "sent", // Change to "pending" if actually sending emails
        metadata,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error recording notification:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to record notification" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Notification recorded:`, notification);

    return new Response(
      JSON.stringify({
        success: true,
        notification_id: notification.id,
        message: notificationMessage,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-delivery-notification:", error);
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
