import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oli Café – Atención al Cliente",
  description: "Asistente virtual de Oli Café",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
