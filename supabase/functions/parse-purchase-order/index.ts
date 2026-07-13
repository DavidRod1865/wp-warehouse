import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ParsedLine {
  line_number: number;
  description: string;
  part_number: string | null;
  quantity_ordered: number;
  unit_price: number | null;
  confidence: "high" | "low";
}

interface ParsedPurchaseOrder {
  po_number: string | null;
  vendor_name: string | null;
  po_date: string | null; // 'YYYY-MM-DD' or null
  lines: ParsedLine[];
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
    const { pdf_base64, pdf_text } = body as {
      pdf_base64?: string;
      pdf_text?: string;
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

    // Get Anthropic API key
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

    const systemPrompt = `You are a purchase order parser for a warehouse management system. Extract structured data from purchase order documents.

Return a JSON object with this exact shape:
{
  "po_number": "string or null (if not found)",
  "vendor_name": "string or null (if not found)",
  "po_date": "YYYY-MM-DD format or null (if not found)",
  "lines": [
    {
      "line_number": number (1-indexed),
      "description": "string (item/product description)",
      "part_number": "string or null",
      "quantity_ordered": number (positive integer),
      "unit_price": number or null (if not found),
      "confidence": "high" or "low"
    }
  ]
}

Rules for extraction:
- PO Number: Look for "PO", "PO#", "Order Number", "Purchase Order No" or similar. Return null if not found.
- Vendor Name: Extract vendor/supplier name. Return null if not found.
- PO Date: Look for date field. Parse as YYYY-MM-DD. Return null if not found.
- Lines: Extract all line items (skip headers, totals, and shipping info).
  - line_number: 1-indexed sequential number
  - description: Clean product/item description (no extra codes unless they're part of name)
  - part_number: SKU, part number, catalog number, or null if not found
  - quantity_ordered: Integer quantity ordered. Default to 1 if unclear.
  - unit_price: Unit price as number, or null if not found
  - confidence: "high" if all fields are clearly readable, "low" if any field is unclear/missing/inferred

Return ONLY the JSON object, no other text.`;

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
        text: "Extract structured data from this purchase order. Return only the JSON object.",
      });
    } else {
      userContent.push({
        type: "text",
        text: `Extract structured data from this purchase order text:\n\n${pdf_text}\n\nReturn only the JSON object.`,
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
          error: "Failed to parse purchase order",
          detail: errText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const anthropicData = await anthropicResponse.json();
    const responseText = anthropicData.content?.[0]?.text || "{}";

    // Parse the JSON from Claude's response
    let parsedPO: ParsedPurchaseOrder;
    try {
      // Handle case where Claude wraps the JSON in markdown code blocks
      const jsonStr = responseText
        .replace(/^```json?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      parsedPO = JSON.parse(jsonStr);
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

    // Validate and normalize the response
    const normalized: ParsedPurchaseOrder = {
      po_number: parsedPO.po_number || null,
      vendor_name: parsedPO.vendor_name || null,
      po_date: parsedPO.po_date || null,
      lines: (parsedPO.lines || []).map((line, idx) => ({
        line_number: line.line_number || idx + 1,
        description: String(line.description || "Unknown item"),
        part_number: line.part_number ? String(line.part_number) : null,
        quantity_ordered: Math.max(1, Math.round(Number(line.quantity_ordered) || 1)),
        unit_price:
          line.unit_price != null
            ? parseFloat(String(line.unit_price))
            : null,
        confidence: line.confidence === "low" ? "low" : "high",
      })),
    };

    return new Response(JSON.stringify(normalized), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("parse-purchase-order error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
