import { useState, useRef, useCallback } from 'react';
import { Upload, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileDropProps {
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  selectedFile?: File | null;
  isProcessing?: boolean;
  className?: string;
  accept?: string;
}

export function FileDrop({
  onFileSelect,
  onFileRemove,
  selectedFile,
  isProcessing = false,
  className,
  accept = '.mp3,.wav,.m4a,.aac,.ogg'
}: FileDropProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(file => 
      file.type.startsWith('audio/') || 
      ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].some(ext => 
        file.name.toLowerCase().endsWith(ext)
      )
    );

    if (audioFile) {
      onFileSelect(audioFile);
    }
  }, [onFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleButtonClick = () => {
    if (!isProcessing) {
      fileInputRef.current?.click();
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileRemove?.();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={cn("w-full", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={isProcessing}
      />

      {selectedFile ? (
        <div className="border-2 border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <File className="w-8 h-8 text-primary" />
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
            
            {!isProcessing && onFileRemove && (
              <Button
                onClick={handleRemoveFile}
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {isProcessing && (
            <div className="mt-4">
              <div className="flex items-center space-x-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-pulse rounded-full" style={{ width: '60%' }} />
                </div>
                <span className="text-sm text-muted-foreground">Processing...</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleButtonClick}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            "hover:border-primary hover:bg-primary/5",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
            isDragging && "border-primary bg-primary/10",
            isProcessing && "opacity-50 cursor-not-allowed"
          )}
          role="button"
          tabIndex={0}
          aria-label="Upload audio file"
        >
          <Upload className={cn(
            "w-12 h-12 mx-auto mb-4 transition-colors",
            isDragging ? "text-primary" : "text-muted-foreground"
          )} />
          
          <h3 className="text-lg font-medium mb-2">
            {isDragging ? "Drop your audio file here" : "Upload Audio File"}
          </h3>
          
          <p className="text-muted-foreground mb-4">
            {isDragging 
              ? "Release to upload" 
              : "Drag and drop an audio file here, or click to browse"
            }
          </p>
          
          <p className="text-sm text-muted-foreground">
            Supports MP3, WAV, M4A, AAC, OGG files
          </p>
          
          <Button 
            variant="outline" 
            className="mt-4"
            disabled={isProcessing}
          >
            Choose File
          </Button>
        </div>
      )}
    </div>
  );
}