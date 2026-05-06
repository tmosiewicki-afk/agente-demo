import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Café Luna – Atención al Cliente",
  description: "Asistente virtual de Café Luna",
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
