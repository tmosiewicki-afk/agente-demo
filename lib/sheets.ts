const SHEET_ID = "1jq4l8Qg4ZYK46FZ2eN4j9_-0vl7PPjJt9g1vHn2rEoo";

export interface ProductoInventario {
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
}

interface HojaInfo {
  gid: number;
  nombre: string;
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

async function fetchHojas(): Promise<HojaInfo[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [{ gid: 0, nombre: "" }];

  const html = await res.text();
  const matches = [
    ...html.matchAll(/items\.push\(\{name: "([^"]+)"[^}]+gid: "(\d+)"/g),
  ];

  if (matches.length === 0) return [{ gid: 0, nombre: "" }];

  return matches.map((m) => ({ nombre: m[1], gid: parseInt(m[2]) }));
}

async function fetchHoja(gid: number): Promise<ProductoInventario[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return [];

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

export async function fetchInventario(): Promise<ProductoInventario[]> {
  const hojas = await fetchHojas();
  const resultados = await Promise.all(hojas.map((h) => fetchHoja(h.gid)));
  return resultados.flat();
}

export async function listarPorComida(
  comida: string
): Promise<ProductoInventario[]> {
  const hojas = await fetchHojas();
  const q = comida.toLowerCase();

  const hojaTodoElDia = hojas.find((h) =>
    h.nombre.toLowerCase().includes("todo")
  );

  const hojaComida = hojas.find((h) => {
    const n = h.nombre.toLowerCase();
    if (q === "almuerzo") return n.includes("almuerzo");
    if (q === "desayuno" || q === "merienda")
      return n.includes("desayuno") || n.includes("merienda");
    return false;
  });

  const gidsAFetchear = [
    ...(hojaComida ? [hojaComida.gid] : []),
    ...(hojaTodoElDia && hojaTodoElDia.gid !== hojaComida?.gid
      ? [hojaTodoElDia.gid]
      : []),
  ];

  if (gidsAFetchear.length === 0) return fetchInventario();

  const resultados = await Promise.all(gidsAFetchear.map(fetchHoja));
  return resultados.flat();
}

export async function consultarProducto(
  busqueda: string
): Promise<ProductoInventario | null> {
  const inventario = await fetchInventario();
  const query = busqueda.toLowerCase().trim();

  const directa = inventario.find((p) =>
    p.nombre.toLowerCase().includes(query)
  );
  if (directa) return directa;

  const palabras = query.split(/\s+/).filter((p) => p.length > 2);
  return (
    inventario.find((p) =>
      palabras.some((palabra) => p.nombre.toLowerCase().includes(palabra))
    ) ?? null
  );
}
