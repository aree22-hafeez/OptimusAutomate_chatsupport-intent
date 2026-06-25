import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ChatRequestBody = { messages?: unknown };

// --- Mock e-commerce data (stands in for a real OMS/PIM) ---
const ORDERS: Record<
  string,
  {
    status: "processing" | "shipped" | "delivered" | "cancelled";
    items: { name: string; qty: number }[];
    carrier?: string;
    tracking?: string;
    eta?: string;
    total: number;
    placedAt: string;
  }
> = {
  "1001": {
    status: "shipped",
    items: [{ name: "Linen Tee — Sand", qty: 2 }],
    carrier: "UPS",
    tracking: "1Z999AA10123456784",
    eta: "Jun 28, 2026",
    total: 78.0,
    placedAt: "Jun 22, 2026",
  },
  "1002": {
    status: "processing",
    items: [{ name: "Canvas Tote — Olive", qty: 1 }],
    total: 42.0,
    placedAt: "Jun 24, 2026",
  },
  "1003": {
    status: "delivered",
    items: [{ name: "Wool Beanie — Charcoal", qty: 1 }],
    carrier: "USPS",
    tracking: "9400111899223712345678",
    total: 24.0,
    placedAt: "Jun 10, 2026",
  },
};

const PRODUCTS: Record<
  string,
  { name: string; price: number; inStock: boolean; sizes: string[]; description: string }
> = {
  "linen-tee": {
    name: "Linen Tee",
    price: 39,
    inStock: true,
    sizes: ["XS", "S", "M", "L", "XL"],
    description: "Breathable European linen tee, pre-washed for a soft hand-feel.",
  },
  "canvas-tote": {
    name: "Canvas Tote",
    price: 42,
    inStock: true,
    sizes: ["One size"],
    description: "12oz heavyweight canvas tote with reinforced straps.",
  },
  "wool-beanie": {
    name: "Wool Beanie",
    price: 24,
    inStock: false,
    sizes: ["One size"],
    description: "Merino wool beanie. Restocking late July.",
  },
};

const SYSTEM_PROMPT = `You are Shopbot, the customer support assistant for an online clothing store called "Northbound Goods".

Your job:
1. Recognize the customer's intent (order status, returns/refunds, shipping, product info, sizing, billing, general greeting, escalation, other).
2. Briefly acknowledge the intent in plain language (e.g. "Got it — checking your order status.") so the user sees you understood.
3. Use tools whenever a tool can answer the question. Never invent order numbers, tracking numbers, prices, or stock levels. If a customer asks about an order without giving a number, ask for it.
4. Track context across the conversation — remember the order number, product, or issue the customer already mentioned, and don't re-ask.
5. Keep replies short, warm, and specific. Use markdown lists for multi-step instructions.
6. Policies you can rely on:
   - Free standard shipping on orders over $50, otherwise $6 flat.
   - 30-day returns on unworn items with tags. Refunds issued to original payment within 5 business days of receipt.
   - We ship to US and Canada only.
7. If the customer is upset, frustrated, or asks for a human, offer to escalate using the escalate_to_human tool.

Always start fresh conversations with a one-sentence greeting that mentions you handle orders, returns, shipping, and product questions.`;

const tools = {
  lookup_order: tool({
    description:
      "Look up the status, items, tracking, and ETA for a customer order by order number.",
    inputSchema: z.object({
      order_number: z.string().describe("The order number, e.g. '1001'."),
    }),
    execute: async ({ order_number }) => {
      const order = ORDERS[order_number.trim()];
      if (!order) {
        return {
          found: false,
          order_number,
          message: "No order found with that number.",
        };
      }
      return { found: true, order_number, ...order };
    },
  }),
  start_return: tool({
    description:
      "Start a return for an order. Use after confirming the order number and the items the customer wants to return.",
    inputSchema: z.object({
      order_number: z.string(),
      reason: z.string().describe("Short reason for the return."),
    }),
    execute: async ({ order_number, reason }) => {
      const order = ORDERS[order_number.trim()];
      if (!order) {
        return { success: false, message: "Order not found." };
      }
      const rma = `RMA-${Math.floor(100000 + Math.random() * 900000)}`;
      return {
        success: true,
        rma,
        order_number,
        reason,
        label_url: `https://example.com/labels/${rma}.pdf`,
        instructions:
          "Print the prepaid label, drop the package at any UPS location, and you'll see a refund within 5 business days of receipt.",
      };
    },
  }),
  get_product: tool({
    description:
      "Get product details (price, stock, available sizes, description) by product slug. Slugs are lowercase with hyphens, e.g. 'linen-tee'.",
    inputSchema: z.object({
      product_slug: z.string(),
    }),
    execute: async ({ product_slug }) => {
      const product = PRODUCTS[product_slug.trim().toLowerCase()];
      if (!product) {
        return {
          found: false,
          available_slugs: Object.keys(PRODUCTS),
          message: "Product not found.",
        };
      }
      return { found: true, slug: product_slug, ...product };
    },
  }),
  shipping_quote: tool({
    description:
      "Quote shipping cost and ETA for a destination and order subtotal.",
    inputSchema: z.object({
      country: z.enum(["US", "CA"]),
      subtotal: z.number().describe("Order subtotal in USD."),
    }),
    execute: async ({ country, subtotal }) => {
      const cost = subtotal >= 50 ? 0 : country === "CA" ? 12 : 6;
      const eta = country === "CA" ? "5–8 business days" : "2–4 business days";
      return { country, subtotal, shipping_cost: cost, eta };
    },
  }),
  escalate_to_human: tool({
    description:
      "Escalate the conversation to a human support agent. Use when the customer asks for a human or the issue is outside policy.",
    inputSchema: z.object({
      summary: z.string().describe("One-sentence summary of the issue for the agent."),
      priority: z.enum(["low", "normal", "high"]).default("normal"),
    }),
    execute: async ({ summary, priority }) => {
      const ticket = `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
      return {
        ticket_id: ticket,
        priority,
        summary,
        eta_response: priority === "high" ? "under 1 hour" : "within 4 business hours",
      };
    },
  }),
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("messages required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages as UIMessage[]),
          tools,
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});