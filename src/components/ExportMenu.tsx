import { useState } from 'react';
import { Download, FileText, Code, FileImage, Settings, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { TimelineSegment } from '@/components/Timeline';
import { formatChordSheet, exportToJSON, ExportOptions } from '@/lib/chords/formatters';
import { cn } from '@/lib/utils';
import { exportSegmentsToMidi } from '@/lib/midi/export';

interface ExportMenuProps {
  segments: TimelineSegment[];
  detectedKey?: string;
  className?: string;
  disabled?: boolean;
}

export function ExportMenu({ segments, detectedKey, className, disabled }: ExportMenuProps) {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    transpose: 0,
    capoFret: 0,
    useNashville: false,
    key: detectedKey || '',
    includeTimestamps: false,
    includeConfidence: false
  });

  const handleExport = (format: 'txt' | 'json' | 'pdf' | 'midi') => {
    if (segments.length === 0) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'txt':
        content = formatChordSheet(segments, exportOptions);
        filename = `chordsnap-export-${Date.now()}.txt`;
        mimeType = 'text/plain';
        break;
      case 'json':
        content = exportToJSON(segments, exportOptions);
        filename = `chordsnap-export-${Date.now()}.json`;
        mimeType = 'application/json';
        break;
      case 'pdf':
        // For PDF, we'll use a server route
        handlePDFExport();
        return;
      case 'midi':
        const blob = exportSegmentsToMidi(segments,  detectedKey ? parseInt(String(detectedKey)) : undefined);
        downloadBlob(blob, `chordsnap-chords-${Date.now()}.mid`);
        return;
      default:
        return;
    }

    // Create and download file
    const blob = new Blob([content], { type: mimeType });
    downloadBlob(blob, filename);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePDFExport = async () => {
    try {
      const response = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          segments,
          options: exportOptions
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `chordsnap-export-${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('PDF export failed:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || segments.length === 0}
          className={cn("gap-2", className)}
        >
          <Download className="w-4 h-4" />
          Export
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        
        <DropdownMenuItem onClick={() => handleExport('txt')}>
          <FileText className="w-4 h-4 mr-2" />
          Text (.txt)
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleExport('json')}>
          <Code className="w-4 h-4 mr-2" />
          JSON (.json)
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileImage className="w-4 h-4 mr-2" />
          PDF (.pdf)
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleExport('midi')}>
          <Music className="w-4 h-4 mr-2" />
          MIDI (.mid)
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <Sheet open={isOptionsOpen} onOpenChange={setIsOptionsOpen}>
          <SheetTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Settings className="w-4 h-4 mr-2" />
              Export Options
            </DropdownMenuItem>
          </SheetTrigger>

          <SheetContent>
            <SheetHeader>
              <SheetTitle>Export Options</SheetTitle>
            </SheetHeader>

            <div className="space-y-6 mt-6">
              {/* Transpose */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Transpose ({exportOptions.transpose} semitones)
                </label>
                <Slider
                  value={[exportOptions.transpose || 0]}
                  onValueChange={([value]) => 
                    setExportOptions(prev => ({ ...prev, transpose: value }))
                  }
                  min={-12}
                  max={12}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Adjust pitch up or down by semitones
                </p>
              </div>

              {/* Capo */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Capo Fret ({exportOptions.capoFret})
                </label>
                <Slider
                  value={[exportOptions.capoFret || 0]}
                  onValueChange={([value]) => 
                    setExportOptions(prev => ({ ...prev, capoFret: value }))
                  }
                  min={0}
                  max={12}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Adjust chords for capo placement
                </p>
              </div>

              {/* Key */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Key</label>
                <input
                  type="text"
                  value={exportOptions.key || ''}
                  onChange={(e) => 
                    setExportOptions(prev => ({ ...prev, key: e.target.value }))
                  }
                  placeholder={detectedKey || "Enter key (e.g., C, Am)"}
                  className="w-full px-3 py-2 text-sm border rounded-md"
                />
              </div>

              {/* Options checkboxes */}
              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.useNashville || false}
                    onChange={(e) => 
                      setExportOptions(prev => ({ ...prev, useNashville: e.target.checked }))
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Use Nashville Numbers</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeTimestamps || false}
                    onChange={(e) => 
                      setExportOptions(prev => ({ ...prev, includeTimestamps: e.target.checked }))
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Include Timestamps</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeConfidence || false}
                    onChange={(e) => 
                      setExportOptions(prev => ({ ...prev, includeConfidence: e.target.checked }))
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Include Confidence Scores</span>
                </label>
              </div>

              {/* Preview */}
              {segments.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preview</label>
                  <div className="p-3 bg-muted rounded-md text-sm font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {formatChordSheet(segments.slice(0, 8), exportOptions)}
                    {segments.length > 8 && '\n...'}
                  </div>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
