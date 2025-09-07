import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Brand */}
          <div className="text-center md:text-left">
            <p className="text-sm font-medium">ChordSnap</p>
            <p className="text-xs text-muted-foreground">
              Hear it. See it. Play it.
            </p>
          </div>

          {/* Links */}
          <nav className="flex items-center space-x-6">
            <Link 
              href="/about" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </Link>
            <Link 
              href="/privacy" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <a 
              href="https://github.com/your-repo/chordsnap" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </nav>

          {/* Copyright */}
          <div className="text-center md:text-right">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} ChordSnap
            </p>
            <p className="text-xs text-muted-foreground">
              Built with Claude Code
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto">
            ChordSnap is an independent project for educational and creative purposes. 
            Chord detection accuracy may vary depending on audio quality, complexity, and musical context. 
            All audio processing happens locally in your browser for privacy.
          </p>
        </div>
      </div>
    </footer>
  );
}