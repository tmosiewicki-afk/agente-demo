import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { consultarProducto } from "@/lib/sheets";

const client = new Anthropic();

const SYSTEM_PROMPT = `Sos un agente de atención al cliente de Oli Café. Respondé preguntas usando la información a continuación y las herramientas disponibles. El tono debe ser profesional y cálido, sin usar emojis. Sé directo y breve. Si te preguntan algo que no figura aquí, indicá amablemente que lo vas a consultar con el equipo.

━━━━━━━━━━━━━━━━━━━━━━
INFORMACIÓN DEL NEGOCIO
━━━━━━━━━━━━━━━━━━━━━━

NOMBRE: Oli Café

UBICACIÓN:
Costa Rica 6020, Palermo, CABA

HORARIOS:
Todos los días excepto los martes, de 9:00 a 20:00.
- Desayuno: 9:00 a 12:30
- Almuerzo: 12:30 a 16:00
- Merienda: 16:00 a 20:00

RESERVAS:
No se toman reservas. La atención es por orden de llegada.

MENÚ:
Si alguien pide el menú completo, compartí este enlace: https://ugc.production.linktr.ee/18a232c0-868f-4a75-8784-384c9f4dd257_MENU-OLI-ESPAOL-9.04.pdf

MASCOTAS:
El local es pet friendly. Hay agua disponible para perros.

━━━━━━━━━━━━━━━━━━━━━━
STOCK E INVENTARIO
━━━━━━━━━━━━━━━━━━━━━━

Cuando alguien pregunte por disponibilidad o descripción de un producto de COMIDA, usá la herramienta consultar_stock.

Según el stock obtenido, respondé exactamente así:
- 10 o más → "sí tenemos"
- 3 a 9 → "quedan pocos"
- 1 o 2 → "vení rápido que queda el último"
- 0 → "por hoy se terminó"

Para BEBIDAS (café, cortado, latte, capuchino, té, jugo, agua, licuado, etc.) siempre respondé que están disponibles, sin usar la herramienta.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "consultar_stock",
    description:
      "Consulta el stock disponible y la descripción de un producto de comida del inventario. Usá esta herramienta para productos de comida, nunca para bebidas.",
    input_schema: {
      type: "object" as const,
      properties: {
        producto: {
          type: "string",
          description: "Nombre o parte del nombre del producto a consultar",
        },
      },
      required: ["producto"],
    },
  },
];

async function ejecutarHerramienta(
  nombre: string,
  input: Record<string, string>
): Promise<string> {
  if (nombre === "consultar_stock") {
    const producto = await consultarProducto(input.producto);
    if (!producto) {
      return JSON.stringify({ encontrado: false });
    }
    return JSON.stringify({
      encontrado: true,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: producto.precio,
      stock: producto.stock,
    });
  }
  return JSON.stringify({ error: "herramienta desconocida" });
}

async function loopAgente(
  messages: Anthropic.MessageParam[]
): Promise<string> {
  let mensajesActuales = [...messages];

  while (true) {
    const respuesta = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: TOOLS,
      messages: mensajesActuales,
    });

    if (respuesta.stop_reason === "end_turn") {
      const bloque = respuesta.content.find((b) => b.type === "text");
      return bloque?.type === "text" ? bloque.text : "";
    }

    if (respuesta.stop_reason === "tool_use") {
      mensajesActuales.push({
        role: "assistant",
        content: respuesta.content,
      });

      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const bloque of respuesta.content) {
        if (bloque.type === "tool_use") {
          const resultado = await ejecutarHerramienta(
            bloque.name,
            bloque.input as Record<string, string>
          );
          resultados.push({
            type: "tool_result",
            tool_use_id: bloque.id,
            content: resultado,
          });
        }
      }

      mensajesActuales.push({ role: "user", content: resultados });
    }
  }
}

async function saveConversation(
  sessionId: string,
  messages: { role: string; content: string }[]
) {
  await supabase.from("conversations").upsert(
    {
      session_id: sessionId,
      messages,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id" }
  );
}

export async function POST(req: NextRequest) {
  const { messages, sessionId } = await req.json();

  const encoder = new TextEncoder();
  let assistantContent = "";

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        assistantContent = await loopAgente(messages);
        controller.enqueue(encoder.encode(assistantContent));
      } finally {
        controller.close();
      }

      if (sessionId && assistantContent) {
        await saveConversation(sessionId, [
          ...messages,
          { role: "assistant", content: assistantContent },
        ]);
      }
    },
    cancel() {},
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
