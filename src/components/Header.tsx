import { Settings, Download, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface HeaderProps {
  onSettingsClick?: () => void;
  onExportClick?: () => void;
}

export function Header({ onSettingsClick, onExportClick }: HeaderProps) {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">ChordSnap</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Real-time chord recognition
            </p>
          </div>
        </div>

        {/* Navigation Actions */}
        <nav className="flex items-center space-x-2">
          {/* Export Button */}
          {onExportClick && (
            <Button
              onClick={onExportClick}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          )}

          {/* Settings Button */}
          {onSettingsClick && (
            <Button
              onClick={onSettingsClick}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <Settings className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          )}

          {/* About Link */}
          <Link href="/about" passHref>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <Info className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">About</span>
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}