import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function PrivacyPage() {
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
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-xl text-muted-foreground">
              Your privacy is our priority
            </p>
          </div>

          {/* Main Content */}
          <div className="prose prose-gray dark:prose-invert max-w-none">
            
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 mb-8">
              <div className="flex items-start space-x-3">
                <Lock className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-primary mb-2">Privacy-First Design</h3>
                  <p className="text-sm text-muted-foreground">
                    ChordSnap processes all audio locally in your browser. No audio data, 
                    chord progressions, or personal information is ever transmitted to our servers.
                  </p>
                </div>
              </div>
            </div>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Data Collection</h2>
              
              <h3 className="text-lg font-medium mb-3">What We Don't Collect</h3>
              <ul className="text-muted-foreground space-y-2 mb-4">
                <li className="flex items-start space-x-2">
                  <Eye className="w-4 h-4 mt-1 flex-shrink-0" />
                  <span><strong>Audio Data:</strong> Your microphone input and uploaded files never leave your device</span>
                </li>
                <li className="flex items-start space-x-2">
                  <Eye className="w-4 h-4 mt-1 flex-shrink-0" />
                  <span><strong>Chord Progressions:</strong> Detected chords and musical analysis remain private</span>
                </li>
                <li className="flex items-start space-x-2">
                  <Eye className="w-4 h-4 mt-1 flex-shrink-0" />
                  <span><strong>Personal Files:</strong> Uploaded audio files are processed locally and not stored</span>
                </li>
                <li className="flex items-start space-x-2">
                  <Eye className="w-4 h-4 mt-1 flex-shrink-0" />
                  <span><strong>Usage Patterns:</strong> We don't track what you play or analyze</span>
                </li>
              </ul>

              <h3 className="text-lg font-medium mb-3">What We May Collect</h3>
              <ul className="text-muted-foreground space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>Basic Analytics:</strong> Anonymous page views and feature usage statistics (if enabled)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>Error Reports:</strong> Crash reports and error logs to improve stability</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>Device Info:</strong> Browser type and screen size for compatibility</span>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">How Your Data is Protected</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="font-semibold mb-2">Local Processing</h3>
                  <p className="text-sm text-muted-foreground">
                    All audio analysis happens directly in your browser using Web Audio APIs 
                    and Web Workers. No audio ever leaves your device.
                  </p>
                </div>
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="font-semibold mb-2">No Server Storage</h3>
                  <p className="text-sm text-muted-foreground">
                    ChordSnap doesn't maintain audio databases or store user sessions. 
                    Each visit is completely independent.
                  </p>
                </div>
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="font-semibold mb-2">HTTPS Encryption</h3>
                  <p className="text-sm text-muted-foreground">
                    All web traffic is encrypted using TLS/SSL protocols to protect 
                    data in transit, even though we don't transmit sensitive data.
                  </p>
                </div>
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="font-semibold mb-2">Open Source</h3>
                  <p className="text-sm text-muted-foreground">
                    Our code is publicly available, allowing security researchers 
                    to verify our privacy claims and contribute improvements.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Browser Permissions</h2>
              <p className="text-muted-foreground mb-4">
                ChordSnap requires certain browser permissions to function:
              </p>
              <ul className="text-muted-foreground space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>Microphone Access:</strong> Required for real-time chord detection from your device's microphone</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>File Access:</strong> Needed to read uploaded audio files for analysis</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>Storage Access:</strong> Used to save your preferences and settings locally</span>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Third-Party Services</h2>
              <p className="text-muted-foreground mb-4">
                ChordSnap may use minimal third-party services:
              </p>
              <ul className="text-muted-foreground space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>Analytics:</strong> We may use privacy-focused analytics (like Plausible) to understand feature usage</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>CDN:</strong> Static assets may be served through content delivery networks for better performance</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span><strong>Hosting:</strong> The application is hosted on privacy-conscious platforms like Vercel</span>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Data Retention</h2>
              <p className="text-muted-foreground mb-4">
                Since ChordSnap doesn't collect or store personal data:
              </p>
              <ul className="text-muted-foreground space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span>Audio files and microphone input are never stored beyond active processing</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span>User preferences are stored only in your browser's local storage</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span>Anonymous analytics data may be retained for up to 24 months</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span>You can clear all local data by resetting your browser settings</span>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Your Rights</h2>
              <p className="text-muted-foreground mb-4">
                Since we don't collect personal information, traditional data rights don't directly apply. 
                However, you maintain complete control:
              </p>
              <ul className="text-muted-foreground space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span>Deny microphone permission at any time through browser settings</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span>Clear all local storage and cached data through browser controls</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span>Use private/incognito browsing mode for completely session-free usage</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                  <span>Contact us with any privacy concerns through our GitHub repository</span>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this privacy policy to reflect changes in our practices or for legal reasons. 
                Any changes will be posted on this page with an updated revision date. We encourage you to 
                review this policy periodically to stay informed about how we protect your privacy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Contact Information</h2>
              <p className="text-muted-foreground mb-4">
                If you have questions about this privacy policy or ChordSnap's privacy practices, 
                please reach out through our GitHub repository or create an issue for community discussion.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
              </p>
            </section>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}