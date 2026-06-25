import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const SORTLY_API_BASE = "https://api.sortly.com/api/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Roles allowed to perform write operations */
const WRITE_ROLES = ["warehouse_manager", "admin", "apm"];

/** All roles that can use the proxy */
const ALL_ROLES = [...WRITE_ROLES, "driver"];

/** Item write actions that should trigger a realtime broadcast */
const ITEM_WRITE_ACTIONS = new Set([
  "createItem",
  "updateItem",
  "deleteItem",
  "moveItem",
  "copyItem",
]);

/** Actions that mutate data (require elevated role) */
const WRITE_ACTIONS = new Set([
  "createItem",
  "updateItem",
  "deleteItem",
  "moveItem",
  "copyItem",
  "createAlert",
  "updateAlert",
  "deleteAlert",
]);

interface ProxyRequest {
  action: string;
  params: Record<string, unknown>;
}

/**
 * Maps an action + params to a Sortly API request (url, method, body).
 */
function buildSortlyRequest(
  action: string,
  params: Record<string, unknown>
): { url: string; method: string; body?: string } {
  switch (action) {
    // ── Items ──────────────────────────────────────
    case "listItems": {
      const query = new URLSearchParams();
      if (params.parent_id !== undefined)
        query.append("parent_id", String(params.parent_id));
      if (params.per_page) query.append("per_page", String(params.per_page));
      if (params.page) query.append("page", String(params.page));
      if (params.type) query.append("type", String(params.type));
      if (params.include) query.append("include", String(params.include));
      else query.append("include", "photos,custom_attributes");
      if (params.folder_id !== undefined)
        query.append("folder_id", String(params.folder_id));
      return { url: `${SORTLY_API_BASE}/items?${query}`, method: "GET" };
    }

    case "createItem": {
      return {
        url: `${SORTLY_API_BASE}/items`,
        method: "POST",
        body: JSON.stringify(params),
      };
    }

    case "getItem": {
      const include =
        (params.include as string) || "photos,custom_attributes";
      return {
        url: `${SORTLY_API_BASE}/items/${params.itemId}?include=${encodeURIComponent(include)}`,
        method: "GET",
      };
    }

    case "updateItem": {
      const { itemId, ...updates } = params;
      return {
        url: `${SORTLY_API_BASE}/items/${itemId}`,
        method: "PUT",
        body: JSON.stringify(updates),
      };
    }

    case "deleteItem": {
      return {
        url: `${SORTLY_API_BASE}/items/${params.itemId}`,
        method: "DELETE",
      };
    }

    case "moveItem": {
      const { itemId: moveId, ...moveBody } = params;
      return {
        url: `${SORTLY_API_BASE}/items/${moveId}/move`,
        method: "POST",
        body: JSON.stringify(moveBody),
      };
    }

    case "copyItem": {
      const { itemId: copyId, ...copyBody } = params;
      return {
        url: `${SORTLY_API_BASE}/items/${copyId}/copy`,
        method: "POST",
        body: JSON.stringify(copyBody),
      };
    }

    case "searchItems": {
      return {
        url: `${SORTLY_API_BASE}/items/search`,
        method: "POST",
        body: JSON.stringify(params),
      };
    }

    case "getRecentItems": {
      const rQuery = new URLSearchParams();
      if (params.per_page) rQuery.append("per_page", String(params.per_page));
      if (params.page) rQuery.append("page", String(params.page));
      if (params.updated_since)
        rQuery.append("updated_since", String(params.updated_since));
      if (params.include) rQuery.append("include", String(params.include));
      else rQuery.append("include", "photos,custom_attributes");
      return {
        url: `${SORTLY_API_BASE}/items/recent?${rQuery}`,
        method: "GET",
      };
    }

    // ── Custom Fields ─────────────────────────────
    case "listCustomFields": {
      const cfQuery = new URLSearchParams();
      if (params.per_page) cfQuery.append("per_page", String(params.per_page));
      if (params.page) cfQuery.append("page", String(params.page));
      return {
        url: `${SORTLY_API_BASE}/custom_fields?${cfQuery}`,
        method: "GET",
      };
    }

    // ── Alerts ────────────────────────────────────
    case "listAlerts": {
      const aQuery = new URLSearchParams();
      if (params.per_page) aQuery.append("per_page", String(params.per_page));
      if (params.page) aQuery.append("page", String(params.page));
      return { url: `${SORTLY_API_BASE}/alerts?${aQuery}`, method: "GET" };
    }

    case "createAlert": {
      return {
        url: `${SORTLY_API_BASE}/alerts`,
        method: "POST",
        body: JSON.stringify(params),
      };
    }

    case "updateAlert": {
      const { alertId, ...alertUpdates } = params;
      return {
        url: `${SORTLY_API_BASE}/alerts/${alertId}`,
        method: "PUT",
        body: JSON.stringify(alertUpdates),
      };
    }

    case "deleteAlert": {
      return {
        url: `${SORTLY_API_BASE}/alerts/${params.alertId}`,
        method: "DELETE",
      };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── Parse + validate input ──────────────────
    const { action, params } = (await req.json()) as ProxyRequest;

    if (!action || typeof action !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'action' field" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Auth: verify JWT ────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const sortlyKey = Deno.env.get("SORTLY_SECRET_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !sortlyKey) {
      console.error("Missing env vars: SUPABASE_URL, SUPABASE_ANON_KEY, or SORTLY_SECRET_KEY");
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");

    if (!jwt) {
      console.error("sortly-proxy: missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await userClient.auth.getUser(jwt);

    if (!user) {
      console.error("sortly-proxy: getUser failed —", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: authError?.message || "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Role check ──────────────────────────────
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await adminClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !ALL_ROLES.includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Write actions require elevated role
    if (WRITE_ACTIONS.has(action) && !WRITE_ROLES.includes(profile.role)) {
      return new Response(
        JSON.stringify({
          error: "Forbidden: insufficient permissions for write operations",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Build + forward Sortly request ──────────
    const { url, method, body } = buildSortlyRequest(action, params || {});

    const sortlyHeaders: Record<string, string> = {
      Authorization: `Bearer ${sortlyKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const sortlyResponse = await fetch(url, {
      method,
      headers: sortlyHeaders,
      ...(body ? { body } : {}),
    });

    // ── Return Sortly response ──────────────────
    if (sortlyResponse.status === 204) {
      // Broadcast inventory update for delete actions (no response body)
      if (ITEM_WRITE_ACTIONS.has(action)) {
        try {
          await adminClient.channel("inventory-updates").send({
            type: "broadcast",
            event: "inventory_update",
            payload: {
              event_type: action,
              item_id: params.itemId ?? null,
              item_name: null,
              timestamp: new Date().toISOString(),
            },
          });
        } catch (e) {
          console.error("Broadcast failed (204):", e);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseText = await sortlyResponse.text();

    if (!sortlyResponse.ok) {
      console.error(
        `Sortly API error [${action}]: ${sortlyResponse.status} ${sortlyResponse.statusText} — ${responseText}`
      );
      return new Response(
        JSON.stringify({
          error: `Sortly API error: ${sortlyResponse.status} ${sortlyResponse.statusText}`,
          details: responseText,
        }),
        {
          status: sortlyResponse.status >= 500 ? 502 : sortlyResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Broadcast inventory update for item write actions
    if (ITEM_WRITE_ACTIONS.has(action)) {
      try {
        const parsed = JSON.parse(responseText);
        const itemData = parsed?.data;
        await adminClient.channel("inventory-updates").send({
          type: "broadcast",
          event: "inventory_update",
          payload: {
            event_type: action,
            item_id: itemData?.id ?? params.itemId ?? null,
            item_name: itemData?.name ?? null,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (e) {
        console.error("Broadcast failed:", e);
      }
    }

    // Return the raw Sortly JSON
    return new Response(responseText, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("sortly-proxy error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
