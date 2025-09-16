import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hikari Beam",
  description: "Secure peer-to-peer file sharing using WebRTC",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" type="image/png" href="/favicon.png" />
      </head>
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 overflow-x-hidden">
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-14 sm:h-16">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <img
                    src="/logo.png"
                    alt="Hikari Beam"
                    className="h-10 sm:h-12"
                  />
                  <h1 className="!ml-0 text-lg sm:text-xl font-semibold text-gray-900">
                    Hikari Beam
                  </h1>
                </div>
                <div className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                  Secure · Decentralized · No Servers
                </div>
                <div className="text-xs text-gray-500 sm:hidden">
                  P2P Sharing
                </div>
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-20">
            {children}
          </main>

          {/* GitHub Link - Bottom Right Corner */}
          <div className="fixed bottom-6 right-6 z-50">
            <a
              href="https://github.com/souravrane/hikari-beam"
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-full shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl"
              title="View on GitHub"
            >
              <img
                src="/github.png"
                alt="GitHub"
                className="w-12 h-12 rounded-full"
              />
            </a>
          </div>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-200 mt-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* About */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
                    About Hikari Beam
                  </h3>
                  <p className="mt-4 text-sm text-gray-600 leading-relaxed">
                    A pure web P2P file sharing application using WebRTC
                    DataChannels. Share files directly between browsers without
                    servers or storage.
                  </p>
                </div>

                {/* Features */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
                    Features
                  </h3>
                  <ul className="mt-4 space-y-2">
                    <li className="text-sm text-gray-600">
                      🔒 Secure P2P Transfer
                    </li>
                    <li className="text-sm text-gray-600">
                      ⚡ Direct Browser-to-Browser
                    </li>
                    <li className="text-sm text-gray-600">
                      🌐 No Server Storage
                    </li>
                  </ul>
                </div>

                {/* Links */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
                    Links
                  </h3>
                  <ul className="mt-4 space-y-2">
                    <li>
                      <a
                        href="https://webrtc.org/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        Learn about WebRTC
                      </a>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row justify-between items-center">
                  <p className="text-sm text-gray-500">
                    © {new Date().getFullYear()} Hikari Beam. Built with WebRTC
                    & Next.js
                  </p>
                  <div className="mt-2 sm:mt-0 flex items-center space-x-4">
                    <span className="text-xs text-gray-400">Open Source</span>
                    <span className="text-xs text-gray-400">Privacy First</span>
                    <span className="text-xs text-gray-400">No Tracking</span>
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
