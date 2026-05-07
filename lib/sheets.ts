const SHEET_ID = "1jq4l8Qg4ZYK46FZ2eN4j9_-0vl7PPjJt9g1vHn2rEoo";

export interface ProductoInventario {
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
}

function parsearLinea(linea: string): string[] {
  const resultado: string[] = [];
  let campo = "";
  let enComillas = false;

  for (const char of linea) {
    if (char === '"') {
      enComillas = !enComillas;
    } else if (char === "," && !enComillas) {
      resultado.push(campo.trim());
      campo = "";
    } else {
      campo += char;
    }
  }
  resultado.push(campo.trim());
  return resultado;
}

export async function fetchInventario(): Promise<ProductoInventario[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error("No se pudo acceder al inventario");

  const csv = await res.text();
  const lineas = csv.trim().split("\n");

  return lineas
    .slice(1)
    .map((linea) => {
      const v = parsearLinea(linea);
      return {
        nombre: v[0] ?? "",
        descripcion: v[1] ?? "",
        precio: parseInt(v[2] ?? "0"),
        stock: parseInt(v[3] ?? "0"),
      };
    })
    .filter((p) => p.nombre);
}

export async function consultarProducto(
  busqueda: string
): Promise<ProductoInventario | null> {
  const inventario = await fetchInventario();
  const query = busqueda.toLowerCase().trim();

  // Primero busca coincidencia directa
  const directa = inventario.find((p) =>
    p.nombre.toLowerCase().includes(query)
  );
  if (directa) return directa;

  // Fallback: cualquier palabra significativa del query
  const palabras = query.split(/\s+/).filter((p) => p.length > 2);
  return (
    inventario.find((p) =>
      palabras.some((palabra) => p.nombre.toLowerCase().includes(palabra))
    ) ?? null
  );
}
