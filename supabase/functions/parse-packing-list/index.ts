import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ParsedItem {
  item_name: string;
  part_number: string | null;
  quantity_ordered: number;
  quantity_shipped: number;
  back_order: number;
  confidence: "high" | "low";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse the request body
    const body = await req.json();
    const { pdf_base64, pdf_text, vendor, po_number } = body as {
      pdf_base64?: string;
      pdf_text?: string;
      vendor?: string;
      po_number?: string;
    };

    if (!pdf_base64 && !pdf_text) {
      return new Response(
        JSON.stringify({ error: "Provide pdf_base64 or pdf_text" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If we have base64 PDF, extract text using Claude's vision capability
    // If we have raw text, use it directly
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const systemPrompt = `You are a packing list parser for a warehouse management system. Extract line items from the packing list content provided.

Return a JSON array of items. Each item should have:
- "item_name": The product/item description (clean, without extra codes unless they are part of the name)
- "part_number": The part number, SKU, or catalog number (null if not found)
- "quantity_ordered": The quantity originally ordered (from columns like "Qty Ordered", "Order Qty", "Ordered"). If not present, use the shipped quantity.
- "quantity_shipped": The quantity actually shipped/received (from columns like "Qty Shipped", "Ship Qty", "Shipped", "Qty"). This is the most important quantity.
- "back_order": The back-ordered quantity (from columns like "B/O", "Back Order", "Backorder"). Default to 0 if not present.
- "confidence": "high" if ALL quantities are clearly readable and unambiguous, "low" if any quantity is unclear, missing, or had to be inferred

Rules:
- Only include actual line items, not headers, totals, or shipping info
- If a quantity is unclear, default to 1 for shipped and mark confidence as "low"
- If the item name is cut off or garbled, include what you can read and mark confidence as "low"
- If quantity_ordered is not explicitly on the document, set it equal to quantity_shipped and mark confidence as "low"
- Return ONLY the JSON array, no other text`;

    const userContent: Array<Record<string, unknown>> = [];

    if (pdf_base64) {
      // Use Claude's document/vision capability for PDF
      userContent.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: pdf_base64,
        },
      });
      userContent.push({
        type: "text",
        text: `Extract all line items from this packing list.${vendor ? ` Vendor: ${vendor}.` : ""}${po_number ? ` PO: ${po_number}.` : ""} Return only the JSON array.`,
      });
    } else {
      userContent.push({
        type: "text",
        text: `Extract all line items from this packing list text:\n\n${pdf_text}\n\n${vendor ? `Vendor: ${vendor}. ` : ""}${po_number ? `PO: ${po_number}. ` : ""}Return only the JSON array.`,
      });
    }

    const anthropicResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        }),
      }
    );

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error("Anthropic API error:", errText);
      return new Response(
        JSON.stringify({
          error: "Failed to parse packing list",
          detail: errText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const anthropicData = await anthropicResponse.json();
    const responseText =
      anthropicData.content?.[0]?.text || "[]";

    // Parse the JSON from Claude's response
    let items: ParsedItem[] = [];
    try {
      // Handle case where Claude wraps the JSON in markdown code blocks
      const jsonStr = responseText
        .replace(/^```json?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      items = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse Claude response as JSON:", responseText);
      return new Response(
        JSON.stringify({
          error: "Failed to parse AI response",
          raw_response: responseText,
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate and normalize items
    const validatedItems: ParsedItem[] = items.map((item) => {
      const shipped = Math.max(1, Math.round(Number(item.quantity_shipped) || Number(item.quantity) || 1));
      const ordered = Math.max(0, Math.round(Number(item.quantity_ordered) || shipped));
      const backOrder = Math.max(0, Math.round(Number(item.back_order) || 0));
      return {
        item_name: String(item.item_name || "Unknown item"),
        part_number: item.part_number ? String(item.part_number) : null,
        quantity_ordered: ordered,
        quantity_shipped: shipped,
        back_order: backOrder,
        confidence: item.confidence === "low" ? "low" : "high",
      };
    });

    return new Response(
      JSON.stringify({ items: validatedItems }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("parse-packing-list error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
