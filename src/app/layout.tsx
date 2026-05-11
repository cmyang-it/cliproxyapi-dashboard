import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "CLIProxyAPI Dashboard",
  description: "CLIProxyAPI 用量统计与监控面板",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (localStorage.getItem('theme') === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}