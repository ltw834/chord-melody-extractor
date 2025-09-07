import Foundation

/// MusicXML export functionality for analysis results
public final class MusicXMLExporter {
    
    public init() {}
    
    /// Export analysis result to MusicXML format
    public func exportToMusicXML(_ analysis: AnalysisResult) -> String {
        var xml = xmlHeader()
        xml += partListStart()
        xml += partStart()
        
        // Add measures based on bars
        for (index, bar) in analysis.bars.enumerated() {
            xml += measureStart(number: index + 1)
            
            if index == 0 {
                xml += attributes(analysis)
            }
            
            // Add chords and melody for this bar
            xml += chordsAndMelodyForBar(bar, analysis: analysis)
            
            xml += measureEnd()
        }
        
        xml += partEnd()
        xml += xmlFooter()
        
        return xml
    }
    
    /// Export to file URL
    public func exportToFile(_ analysis: AnalysisResult, filename: String) throws -> URL {
        let xml = exportToMusicXML(analysis)
        
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let fileURL = documentsPath.appendingPathComponent("\(filename).musicxml")
        
        try xml.write(to: fileURL, atomically: true, encoding: .utf8)
        
        return fileURL
    }
    
    // MARK: - Private Methods
    
    private func xmlHeader() -> String {
        return """
        <?xml version="1.0" encoding="UTF-8" standalone="no"?>
        <!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
        <score-partwise version="3.1">
          <work>
            <work-title>DrumAI Studio Analysis</work-title>
          </work>
          <identification>
            <creator type="software">DrumAI Studio</creator>
            <encoding>
              <software>DrumAI Studio iOS</software>
              <encoding-date>\(currentDateString())</encoding-date>
            </encoding>
          </identification>
        
        """
    }
    
    private func partListStart() -> String {
        return """
          <part-list>
            <score-part id="P1">
              <part-name>Melody</part-name>
              <score-instrument id="P1-I1">
                <instrument-name>Piano</instrument-name>
              </score-instrument>
              <midi-device id="P1-I1">
                <midi-channel>1</midi-channel>
                <midi-program>1</midi-program>
              </midi-device>
            </score-part>
          </part-list>
        
        """
    }
    
    private func partStart() -> String {
        return """
          <part id="P1">
        
        """
    }
    
    private func measureStart(number: Int) -> String {
        return """
            <measure number="\(number)">
        
        """
    }
    
    private func attributes(_ analysis: AnalysisResult) -> String {
        let keySignature = keySignatureForKey(analysis.key)
        
        return """
              <attributes>
                <divisions>4</divisions>
                <key>
                  <fifths>\(keySignature)</fifths>
                  <mode>\(analysis.key.mode)</mode>
                </key>
                <time>
                  <beats>\(analysis.timeSig.numerator)</beats>
                  <beat-type>\(analysis.timeSig.denominator)</beat-type>
                </time>
                <clef>
                  <sign>G</sign>
                  <line>2</line>
                </clef>
              </attributes>
        
        """
    }
    
    private func chordsAndMelodyForBar(_ bar: Bar, analysis: AnalysisResult) -> String {
        var content = ""
        
        // Get chords for this bar
        let barChords = analysis.chords.filter { chord in
            chord.start < bar.end && chord.end > bar.start
        }
        
        // Get melody notes for this bar
        let barMelody = analysis.melody.filter { note in
            note.start < bar.end && note.end > bar.start
        }
        
        // Simple implementation: add one chord and melody notes per beat
        let beatsInBar = analysis.timeSig.numerator
        let beatDuration = (bar.end - bar.start) / Double(beatsInBar)
        
        for beat in 0..<beatsInBar {
            let beatStart = bar.start + Double(beat) * beatDuration
            let beatEnd = beatStart + beatDuration
            
            // Find chord for this beat
            let currentChord = barChords.first { chord in
                chord.start <= beatStart && chord.end > beatStart
            }
            
            // Find melody note for this beat
            let currentNote = barMelody.first { note in
                note.start <= beatStart && note.end > beatStart
            }
            
            if let note = currentNote {
                content += melodyNote(note, divisions: 4)
            } else {
                content += restNote(divisions: 4)
            }
            
            // Add harmony (chord symbol)
            if let chord = currentChord, beat == 0 {
                content += harmonySymbol(chord)
            }
        }
        
        return content
    }
    
    private func melodyNote(_ note: MelodyNote, divisions: Int) -> String {
        let (step, alter, octave) = midiToMusicXML(note.midi)
        
        var xml = """
              <note>
                <pitch>
                  <step>\(step)</step>
        
        """
        
        if alter != 0 {
            xml += "          <alter>\(alter)</alter>\n"
        }
        
        xml += """
                  <octave>\(octave)</octave>
                </pitch>
                <duration>\(divisions)</duration>
                <voice>1</voice>
                <type>quarter</type>
              </note>
        
        """
        
        return xml
    }
    
    private func restNote(divisions: Int) -> String {
        return """
              <note>
                <rest/>
                <duration>\(divisions)</duration>
                <voice>1</voice>
                <type>quarter</type>
              </note>
        
        """
    }
    
    private func harmonySymbol(_ chord: ChordSpan) -> String {
        let rootStep = noteNameToStep(chord.root)
        
        return """
              <harmony>
                <root>
                  <root-step>\(rootStep.step)</root-step>
                  <root-alter>\(rootStep.alter)</root-alter>
                </root>
                <kind>\(chordQualityToKind(chord.quality))</kind>
              </harmony>
        
        """
    }
    
    private func measureEnd() -> String {
        return """
            </measure>
        
        """
    }
    
    private func partEnd() -> String {
        return """
          </part>
        
        """
    }
    
    private func xmlFooter() -> String {
        return """
        </score-partwise>
        """
    }
    
    // MARK: - Helper Methods
    
    private func currentDateString() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate]
        return formatter.string(from: Date())
    }
    
    private func keySignatureForKey(_ key: Key) -> Int {
        // Circle of fifths mapping
        let majorKeys = [
            "C": 0, "G": 1, "D": 2, "A": 3, "E": 4, "B": 5, "F#": 6,
            "F": -1, "Bb": -2, "Eb": -3, "Ab": -4, "Db": -5, "Gb": -6
        ]
        
        let minorKeys = [
            "A": 0, "E": 1, "B": 2, "F#": 3, "C#": 4, "G#": 5, "D#": 6,
            "D": -1, "G": -2, "C": -3, "F": -4, "Bb": -5, "Eb": -6
        ]
        
        if key.isMajor {
            return majorKeys[key.tonic] ?? 0
        } else {
            return minorKeys[key.tonic] ?? 0
        }
    }
    
    private func midiToMusicXML(_ midi: Int) -> (step: String, alter: Int, octave: Int) {
        let noteClass = midi % 12
        let octave = (midi / 12) - 1
        
        let notes: [(String, Int)] = [
            ("C", 0), ("C", 1), ("D", 0), ("D", 1), ("E", 0), ("F", 0),
            ("F", 1), ("G", 0), ("G", 1), ("A", 0), ("A", 1), ("B", 0)
        ]
        
        let (step, alter) = notes[noteClass]
        return (step: step, alter: alter, octave: octave)
    }
    
    private func noteNameToStep(_ noteName: String) -> (step: String, alter: Int) {
        let cleanName = noteName.replacingOccurrences(of: "#", with: "").replacingOccurrences(of: "b", with: "")
        let step = String(cleanName.first ?? "C")
        
        let alter: Int
        if noteName.contains("#") {
            alter = 1
        } else if noteName.contains("b") {
            alter = -1
        } else {
            alter = 0
        }
        
        return (step: step, alter: alter)
    }
    
    private func chordQualityToKind(_ quality: ChordQuality) -> String {
        switch quality {
        case .major: return "major"
        case .minor: return "minor"
        case .diminished: return "diminished"
        case .augmented: return "augmented"
        case .major7: return "major-seventh"
        case .minor7: return "minor-seventh"
        case .dominant7: return "dominant-seventh"
        case .minorSeven5: return "half-diminished-seventh"
        case .suspended2: return "suspended-second"
        case .suspended4: return "suspended-fourth"
        case .add9: return "major-ninth"
        case .sixth: return "major-sixth"
        case .ninth: return "dominant-ninth"
        case .eleventh: return "dominant-11th"
        case .thirteenth: return "dominant-13th"
        }
    }
}