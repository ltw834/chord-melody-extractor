import { NextRequest, NextResponse } from 'next/server';
import { Document, Page, Text, View, StyleSheet, PDFViewer, pdf } from '@react-pdf/renderer';
import { TimelineSegment } from '@/components/Timeline';
import { formatChordSheet, ExportOptions } from '@/lib/chords/formatters';
import { formatTime } from '@/lib/utils/time';

interface PDFExportRequest {
  segments: TimelineSegment[];
  options: ExportOptions;
}

// PDF Styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#10b981',
  },
  subtitle: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 5,
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  metadataItem: {
    fontSize: 10,
    color: '#64748b',
  },
  chordSheet: {
    fontSize: 14,
    lineHeight: 1.8,
    fontFamily: 'Courier',
    marginBottom: 20,
  },
  timeline: {
    marginTop: 20,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  timelineRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  timelineTime: {
    width: '20%',
    fontSize: 10,
    color: '#64748b',
  },
  timelineChord: {
    width: '30%',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timelineDuration: {
    width: '25%',
    fontSize: 10,
    color: '#64748b',
  },
  timelineConfidence: {
    width: '25%',
    fontSize: 10,
    color: '#64748b',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#94a3b8',
  },
});

// PDF Document Component
function ChordSheetPDF({ segments, options }: { segments: TimelineSegment[], options: ExportOptions }) {
  const chordSheet = formatChordSheet(segments, options);
  const totalDuration = segments.length > 0 ? segments[segments.length - 1].endTime : 0;
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>ChordSnap Export</Text>
          <Text style={styles.subtitle}>
            Generated on {new Date().toLocaleDateString()}
          </Text>
        </View>

        {/* Metadata */}
        <View style={styles.metadata}>
          <View>
            <Text style={styles.metadataItem}>
              Total Chords: {segments.length}
            </Text>
            <Text style={styles.metadataItem}>
              Duration: {formatTime(totalDuration)}
            </Text>
          </View>
          <View>
            {options.key && (
              <Text style={styles.metadataItem}>
                Key: {options.key}
              </Text>
            )}
            {options.transpose !== 0 && (
              <Text style={styles.metadataItem}>
                Transposed: {options.transpose > 0 ? '+' : ''}{options.transpose} semitones
              </Text>
            )}
            {options.capoFret !== 0 && (
              <Text style={styles.metadataItem}>
                Capo: Fret {options.capoFret}
              </Text>
            )}
          </View>
        </View>

        {/* Chord Sheet */}
        <Text style={styles.chordSheet}>
          {chordSheet}
        </Text>

        {/* Timeline */}
        <View style={styles.timeline}>
          <Text style={styles.timelineTitle}>Chord Timeline</Text>
          
          {/* Header Row */}
          <View style={[styles.timelineRow, { backgroundColor: '#f1f5f9' }]}>
            <Text style={[styles.timelineTime, { fontWeight: 'bold' }]}>Time</Text>
            <Text style={[styles.timelineChord, { fontWeight: 'bold' }]}>Chord</Text>
            <Text style={[styles.timelineDuration, { fontWeight: 'bold' }]}>Duration</Text>
            <Text style={[styles.timelineConfidence, { fontWeight: 'bold' }]}>Confidence</Text>
          </View>

          {/* Data Rows */}
          {segments.slice(0, 30).map((segment, index) => (
            <View key={index} style={styles.timelineRow}>
              <Text style={styles.timelineTime}>
                {formatTime(segment.startTime)}
              </Text>
              <Text style={styles.timelineChord}>
                {segment.chord}
              </Text>
              <Text style={styles.timelineDuration}>
                {formatTime(segment.endTime - segment.startTime)}
              </Text>
              <Text style={styles.timelineConfidence}>
                {Math.round(segment.confidence * 100)}%
              </Text>
            </View>
          ))}
          
          {segments.length > 30 && (
            <Text style={[styles.timelineTime, { marginTop: 10, textAlign: 'center' }]}>
              ... and {segments.length - 30} more chords
            </Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generated with ChordSnap - Real-time Chord Recognition
          </Text>
          <Text style={styles.footerText}>
            https://chordsnap.app
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function POST(request: NextRequest) {
  try {
    const { segments, options }: PDFExportRequest = await request.json();

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { error: 'No chord segments provided' },
        { status: 400 }
      );
    }

    // Generate PDF
    const doc = <ChordSheetPDF segments={segments} options={options || {}} />;
    const pdfBuffer = await pdf(doc).toBuffer();

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="chordsnap-export-${Date.now()}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}