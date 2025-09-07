import { useState, useEffect } from 'react';
import { Settings, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { VocabularyLevel } from '@/lib/chords/vocab';
import { AppSettings } from '@/lib/store/useAppStore';
import { cn } from '@/lib/utils';

interface SettingsSheetProps {
  settings: AppSettings;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
  onResetSettings: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function SettingsSheet({
  settings,
  onSettingsChange,
  onResetSettings,
  className,
  children
}: SettingsSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<AppSettings>(settings);

  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  const handleSettingChange = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    const newSettings = { ...tempSettings, [key]: value };
    setTempSettings(newSettings);
    onSettingsChange({ [key]: value });
  };

  const handleReset = () => {
    onResetSettings();
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className={cn("gap-2", className)}>
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        )}
      </SheetTrigger>

      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Settings</span>
            <Button
              onClick={handleReset}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-8 mt-6">
          {/* Chord Vocabulary Level */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Chord Vocabulary</label>
            <div className="space-y-2">
              {(['basic', 'extended', 'rich'] as VocabularyLevel[]).map((level) => (
                <label key={level} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="vocabularyLevel"
                    value={level}
                    checked={tempSettings.vocabularyLevel === level}
                    onChange={() => handleSettingChange('vocabularyLevel', level)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <span className="text-sm capitalize font-medium">{level}</span>
                    <p className="text-xs text-muted-foreground">
                      {level === 'basic' && 'Major and minor triads only'}
                      {level === 'extended' && 'Includes 7th chords (maj7, 7, m7)'}
                      {level === 'rich' && 'Full vocabulary (sus, dim, aug, add9)'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Smoothing Strength */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Smoothing Strength ({Math.round(tempSettings.smoothingStrength * 100)}%)
            </label>
            <Slider
              value={[tempSettings.smoothingStrength]}
              onValueChange={([value]) => handleSettingChange('smoothingStrength', value)}
              min={0}
              max={1}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Responsive</span>
              <span>Stable</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Higher values reduce rapid chord changes but may miss quick transitions
            </p>
          </div>

          {/* Update Rate */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Update Rate ({tempSettings.updateRate} Hz)
            </label>
            <Slider
              value={[tempSettings.updateRate]}
              onValueChange={([value]) => handleSettingChange('updateRate', value)}
              min={10}
              max={50}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10 Hz</span>
              <span>50 Hz</span>
            </div>
            <p className="text-xs text-muted-foreground">
              How often chords are detected per second. Higher values use more CPU
            </p>
          </div>

          {/* Tuning Offset */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Tuning Offset ({tempSettings.tuningOffset > 0 ? '+' : ''}{tempSettings.tuningOffset} cents)
            </label>
            <Slider
              value={[tempSettings.tuningOffset]}
              onValueChange={([value]) => handleSettingChange('tuningOffset', value)}
              min={-50}
              max={50}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>-50¢</span>
              <span>+50¢</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Compensate for instruments tuned slightly sharp or flat
            </p>
          </div>

          {/* Capo Offset */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Capo Offset (Fret {tempSettings.capoOffset})
            </label>
            <Slider
              value={[tempSettings.capoOffset]}
              onValueChange={([value]) => handleSettingChange('capoOffset', value)}
              min={0}
              max={12}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>No capo</span>
              <span>12th fret</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Display chords as if a capo were placed at this fret
            </p>
          </div>

          {/* Performance Info */}
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="text-sm font-medium mb-2">Performance Tips</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Lower update rates save battery on mobile devices</li>
              <li>• Basic vocabulary is fastest, rich vocabulary most accurate</li>
              <li>• Higher smoothing reduces CPU usage but may miss quick changes</li>
              <li>• Use Chrome or Safari for best performance</li>
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}