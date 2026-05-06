import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic();

// El prompt del sistema describe el negocio y sus FAQs.
// Usamos cache_control para evitar re-procesar este texto en cada turno.
const SYSTEM_PROMPT = `Sos un agente de atención al cliente de Oli Café. Respondé preguntas usando la información a continuación. El tono debe ser profesional y cálido, sin usar emojis. Sé directo y breve. Si te preguntan algo que no figura aquí, indicá amablemente que lo vas a consultar con el equipo.

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
Cuando alguien pregunte por el menú, compartí este enlace y aclará que ahí está el menú actualizado: https://ugc.production.linktr.ee/18a232c0-868f-4a75-8784-384c9f4dd257_MENU-OLI-ESPAOL-9.04.pdf

MASCOTAS:
El local es pet friendly. Hay agua disponible para perros.`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const stream = await client.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // El FAQ es estático: lo cacheamos para ahorrar tokens en cada turno
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(event.delta.text));
        }
      }
      controller.close();
    },
    cancel() {
      stream.controller.abort();
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
