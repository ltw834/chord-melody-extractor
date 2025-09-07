import Link from 'next/link';
import { ArrowLeft, Github, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Back Button */}
          <Link href="/" passHref>
            <Button variant="ghost" className="mb-8">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to ChordSnap
            </Button>
          </Link>

          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Music className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4">About ChordSnap</h1>
            <p className="text-xl text-muted-foreground">
              Real-time chord recognition powered by modern web technologies
            </p>
          </div>

          {/* Main Content */}
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">What is ChordSnap?</h2>
              <p className="text-muted-foreground mb-4">
                ChordSnap is an independent, original project that provides real-time chord recognition 
                directly in your web browser. Whether you're learning guitar, piano, or any other instrument, 
                ChordSnap helps you understand the harmonic structure of music by identifying chords as they're played.
              </p>
              <p className="text-muted-foreground">
                Our technology works entirely in your browser - no data is sent to servers, ensuring your 
                musical sessions remain private and secure.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">How It Works</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="font-semibold mb-2">Audio Processing</h3>
                  <p className="text-sm text-muted-foreground">
                    Uses advanced signal processing techniques including FFT analysis and 
                    chromagram extraction to identify pitch content in real-time.
                  </p>
                </div>
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="font-semibold mb-2">Pattern Matching</h3>
                  <p className="text-sm text-muted-foreground">
                    Compares audio features against known chord templates using machine 
                    learning techniques for accurate chord identification.
                  </p>
                </div>
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="font-semibold mb-2">Temporal Smoothing</h3>
                  <p className="text-sm text-muted-foreground">
                    Applies sophisticated smoothing algorithms to reduce detection noise 
                    and provide stable chord progressions.
                  </p>
                </div>
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="font-semibold mb-2">Context Awareness</h3>
                  <p className="text-sm text-muted-foreground">
                    Uses musical context like detected key signatures to improve 
                    chord recognition accuracy within tonal frameworks.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">Features</h2>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>Real-time listening:</strong> Detect chords from your microphone with low latency</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>File analysis:</strong> Upload audio files (MP3, WAV, M4A) for chord analysis</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>Progressive vocabulary:</strong> From basic triads to complex jazz chords</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>Key and tempo detection:</strong> Automatic musical context analysis</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>Export capabilities:</strong> Save chord sheets in multiple formats</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>Mobile-optimized:</strong> Works seamlessly on phones and tablets</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>Privacy-focused:</strong> All processing happens locally in your browser</span>
                </li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">Technical Details</h2>
              <p className="text-muted-foreground mb-4">
                ChordSnap is built using cutting-edge web technologies:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                <li>• <strong>Next.js 14</strong> with App Router for the user interface</li>
                <li>• <strong>Web Audio API</strong> for real-time audio processing</li>
                <li>• <strong>Web Workers</strong> for background audio analysis</li>
                <li>• <strong>TensorFlow.js</strong> for machine learning chord classification</li>
                <li>• <strong>TypeScript</strong> for type-safe development</li>
                <li>• <strong>Tailwind CSS</strong> for responsive design</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                The application implements advanced music information retrieval techniques including 
                constant-Q transforms, chroma feature extraction, and Hidden Markov Model-based 
                chord sequence modeling for optimal recognition accuracy.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">Open Source</h2>
              <p className="text-muted-foreground mb-4">
                ChordSnap is an open-source project. The complete source code is available on GitHub, 
                and we welcome contributions from the developer community.
              </p>
              <Button variant="outline" asChild>
                <a 
                  href="https://github.com/your-repo/chordsnap" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center"
                >
                  <Github className="w-4 h-4 mr-2" />
                  View on GitHub
                </a>
              </Button>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">Accuracy & Limitations</h2>
              <p className="text-muted-foreground mb-4">
                ChordSnap provides accurate chord recognition for most musical contexts, but like all 
                automated music analysis tools, it has some limitations:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Works best with clear, harmonic content (piano, guitar, vocals with accompaniment)</li>
                <li>• May struggle with heavily distorted or percussive audio</li>
                <li>• Complex jazz harmonies might be simplified to their basic triadic components</li>
                <li>• Performance depends on audio quality and environmental noise</li>
                <li>• Real-time processing may vary based on device performance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Support & Feedback</h2>
              <p className="text-muted-foreground mb-4">
                We're continuously improving ChordSnap and would love to hear your feedback. 
                If you encounter issues or have suggestions for improvement, please reach out through our GitHub repository.
              </p>
              <p className="text-sm text-muted-foreground">
                ChordSnap is provided as-is for educational and creative purposes. We make no guarantees 
                about recognition accuracy and recommend using multiple tools for critical musical analysis work.
              </p>
            </section>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}