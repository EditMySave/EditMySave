import Link from "next/link"
import { Gamepad2 } from "lucide-react"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg">EditMySave</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Free online game save editor. Edit save files directly in your browser.
            </p>
          </div>

          {/* Available Editors */}
          <div>
            <h3 className="font-semibold mb-3">Available Editors</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/sworn" className="text-muted-foreground hover:text-foreground transition-colors">
                  Sworn Save Editor
                </Link>
              </li>
              <li>
                <Link href="/megabonk" className="text-muted-foreground hover:text-foreground transition-colors">
                  Megabonk Save Editor
                </Link>
              </li>
              <li>
                <Link href="/cloverpit" className="text-muted-foreground hover:text-foreground transition-colors">
                  Cloverpit Save Editor
                </Link>
              </li>
              <li>
                <Link href="/balatro" className="text-muted-foreground hover:text-foreground transition-colors">
                  Balatro Save Editor
                </Link>
              </li>
              <li>
                <Link href="/ballxpit" className="text-muted-foreground hover:text-foreground transition-colors">
                  BALL x PIT Save Editor
                </Link>
              </li>
              <li>
                <Link
                  href="/drg-survivor"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  DRG Survivor Save Editor
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold mb-3">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                  All Editors
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/EditMySave/EditMySave"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  GitHub Repository
                </a>
              </li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h3 className="font-semibold mb-3">Information</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>100% Free & Open Source</li>
              <li>No Registration Required</li>
              <li>Client-Side Processing</li>
              <li>Your Data Never Leaves Your Device</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© {currentYear} EditMySave. All rights reserved.</p>
          <p className="mt-2">
            Always backup your save files before editing. Use at your own risk.
          </p>
        </div>
      </div>
    </footer>
  )
}
