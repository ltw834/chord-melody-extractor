import SwiftUI
import UIKit

/// App theme and design system for DrumAI Studio
public struct AppTheme {
    
    // MARK: - Colors
    
    public struct Colors {
        // Primary brand colors
        public static let accent = Color(hex: "#6C63FF")
        public static let accentSecondary = Color(hex: "#5A52E8")
        public static let accentTertiary = Color(hex: "#4845D1")
        
        // Background colors (dark theme)
        public static let background = Color(hex: "#0A0A0B")
        public static let backgroundSecondary = Color(hex: "#111113")
        public static let backgroundTertiary = Color(hex: "#1A1A1D")
        public static let surface = Color(hex: "#1F1F23")
        public static let surfaceElevated = Color(hex: "#28282D")
        
        // Text colors
        public static let textPrimary = Color.white
        public static let textSecondary = Color(hex: "#A0A0A4")
        public static let textTertiary = Color(hex: "#68686D")
        
        // UI element colors
        public static let border = Color(hex: "#2A2A2E")
        public static let borderFocused = accent
        public static let separator = Color(hex: "#1E1E21")
        
        // Semantic colors
        public static let success = Color(hex: "#4CAF50")
        public static let warning = Color(hex: "#FF9800")
        public static let error = Color(hex: "#F44336")
        public static let info = Color(hex: "#2196F3")
        
        // Chord quality colors
        public static let chordMajor = Color(hex: "#4CAF50")
        public static let chordMinor = Color(hex: "#2196F3")
        public static let chordDominant = Color(hex: "#FF9800")
        public static let chordDiminished = Color(hex: "#F44336")
        public static let chordAugmented = Color(hex: "#E91E63")
        public static let chordSuspended = Color(hex: "#9C27B0")
        public static let chordExtended = Color(hex: "#795548")
        
        // Playhead and timeline
        public static let playhead = accent
        public static let playheadGlow = accent.opacity(0.3)
        public static let beatLine = Color(hex: "#3A3A3E")
        public static let barLine = Color(hex: "#4A4A4E")
        
        // Dynamics colors (velocity-based)
        public static let dynamicsPP = Color(hex: "#6A6A6E")
        public static let dynamicsP = Color(hex: "#8A8A8E")
        public static let dynamicsMP = Color(hex: "#AAAAB2")
        public static let dynamicsMF = Color(hex: "#CACAD2")
        public static let dynamicsF = Color(hex: "#EAEAF2")
        public static let dynamicsFF = Color.white
    }
    
    // MARK: - Typography
    
    public struct Typography {
        // Display text
        public static let displayLarge = Font.system(size: 32, weight: .bold, design: .rounded)
        public static let displayMedium = Font.system(size: 28, weight: .bold, design: .rounded)
        public static let displaySmall = Font.system(size: 24, weight: .bold, design: .rounded)
        
        // Headings
        public static let headlineLarge = Font.system(size: 22, weight: .semibold, design: .default)
        public static let headlineMedium = Font.system(size: 18, weight: .semibold, design: .default)
        public static let headlineSmall = Font.system(size: 16, weight: .semibold, design: .default)
        
        // Body text
        public static let bodyLarge = Font.system(size: 16, weight: .regular, design: .default)
        public static let bodyMedium = Font.system(size: 14, weight: .regular, design: .default)
        public static let bodySmall = Font.system(size: 12, weight: .regular, design: .default)
        
        // Labels
        public static let labelLarge = Font.system(size: 14, weight: .medium, design: .default)
        public static let labelMedium = Font.system(size: 12, weight: .medium, design: .default)
        public static let labelSmall = Font.system(size: 10, weight: .medium, design: .default)
        
        // Monospace (for time displays, chord symbols)
        public static let mono = Font.system(size: 14, weight: .medium, design: .monospaced)
        public static let monoLarge = Font.system(size: 16, weight: .medium, design: .monospaced)
        public static let monoSmall = Font.system(size: 12, weight: .medium, design: .monospaced)
    }
    
    // MARK: - Spacing
    
    public struct Spacing {
        public static let xs: CGFloat = 4
        public static let sm: CGFloat = 8
        public static let md: CGFloat = 16
        public static let lg: CGFloat = 24
        public static let xl: CGFloat = 32
        public static let xxl: CGFloat = 48
    }
    
    // MARK: - Layout
    
    public struct Layout {
        // Viewport dimensions
        public static let viewportHeight: CGFloat = 200
        public static let viewportMinWidth: CGFloat = 320
        
        // Timeline lanes
        public static let laneHeight: CGFloat = 60
        public static let rulerHeight: CGFloat = 40
        public static let playheadWidth: CGFloat = 2
        
        // Transport bar
        public static let transportHeight: CGFloat = 80
        public static let transportButtonSize: CGFloat = 44
        
        // Corner radius
        public static let cornerRadiusSmall: CGFloat = 6
        public static let cornerRadiusMedium: CGFloat = 12
        public static let cornerRadiusLarge: CGFloat = 16
        
        // Card properties
        public static let cardPadding: CGFloat = 16
        public static let cardSpacing: CGFloat = 12
        
        // Tab bar
        public static let tabBarHeight: CGFloat = 60
        
        // Safe areas
        public static let screenPadding: CGFloat = 16
        public static let controlSpacing: CGFloat = 12
    }
    
    // MARK: - Shadows
    
    public struct Shadows {
        public static let small = Shadow(
            color: Color.black.opacity(0.1),
            radius: 2,
            x: 0,
            y: 1
        )
        
        public static let medium = Shadow(
            color: Color.black.opacity(0.15),
            radius: 4,
            x: 0,
            y: 2
        )
        
        public static let large = Shadow(
            color: Color.black.opacity(0.2),
            radius: 8,
            x: 0,
            y: 4
        )
        
        public static let playhead = Shadow(
            color: Colors.accent.opacity(0.5),
            radius: 3,
            x: 0,
            y: 0
        )
    }
    
    public struct Shadow {
        let color: Color
        let radius: CGFloat
        let x: CGFloat
        let y: CGFloat
    }
    
    // MARK: - Animation
    
    public struct Animation {
        public static let quick = SwiftUI.Animation.easeInOut(duration: 0.2)
        public static let standard = SwiftUI.Animation.easeInOut(duration: 0.3)
        public static let slow = SwiftUI.Animation.easeInOut(duration: 0.5)
        
        // Playhead animation (smooth)
        public static let playhead = SwiftUI.Animation.linear(duration: 1.0/60.0)
        
        // Spring animations
        public static let springBouncy = SwiftUI.Animation.spring(response: 0.5, dampingFraction: 0.6)
        public static let springSmooth = SwiftUI.Animation.spring(response: 0.4, dampingFraction: 0.8)
    }
}

// MARK: - Extensions

extension Color {
    /// Initialize Color from hex string
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - View Extensions

extension View {
    /// Apply theme shadow
    public func themeShadow(_ shadow: AppTheme.Shadow) -> some View {
        self.shadow(
            color: shadow.color,
            radius: shadow.radius,
            x: shadow.x,
            y: shadow.y
        )
    }
    
    /// Standard card appearance
    public func cardStyle() -> some View {
        self
            .background(AppTheme.Colors.surface)
            .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
            .themeShadow(AppTheme.Shadows.small)
    }
    
    /// Elevated card appearance
    public func elevatedCardStyle() -> some View {
        self
            .background(AppTheme.Colors.surfaceElevated)
            .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
            .themeShadow(AppTheme.Shadows.medium)
    }
    
    /// Primary button style
    public func primaryButtonStyle() -> some View {
        self
            .foregroundColor(.white)
            .background(AppTheme.Colors.accent)
            .cornerRadius(AppTheme.Layout.cornerRadiusSmall)
    }
    
    /// Secondary button style
    public func secondaryButtonStyle() -> some View {
        self
            .foregroundColor(AppTheme.Colors.textPrimary)
            .background(AppTheme.Colors.surface)
            .cornerRadius(AppTheme.Layout.cornerRadiusSmall)
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.Layout.cornerRadiusSmall)
                    .stroke(AppTheme.Colors.border, lineWidth: 1)
            )
    }
}

// MARK: - Haptics

public final class HapticManager {
    public static let shared = HapticManager()
    
    private let impactLight = UIImpactFeedbackGenerator(style: .light)
    private let impactMedium = UIImpactFeedbackGenerator(style: .medium)
    private let impactHeavy = UIImpactFeedbackGenerator(style: .heavy)
    private let notification = UINotificationFeedbackGenerator()
    
    private init() {
        impactLight.prepare()
        impactMedium.prepare()
        impactHeavy.prepare()
        notification.prepare()
    }
    
    public func playTap() {
        impactLight.impactOccurred()
    }
    
    public func playSelect() {
        impactMedium.impactOccurred()
    }
    
    public func playButton() {
        impactMedium.impactOccurred()
    }
    
    public func playTransport() {
        impactHeavy.impactOccurred()
    }
    
    public func playSuccess() {
        notification.notificationOccurred(.success)
    }
    
    public func playError() {
        notification.notificationOccurred(.error)
    }
    
    public func playWarning() {
        notification.notificationOccurred(.warning)
    }
}

// MARK: - Utility Functions

public extension AppTheme {
    /// Get color for chord quality
    static func colorForChordQuality(_ quality: ChordQuality) -> Color {
        switch quality {
        case .major, .major7:
            return Colors.chordMajor
        case .minor, .minor7:
            return Colors.chordMinor
        case .dominant7, .ninth, .eleventh, .thirteenth:
            return Colors.chordDominant
        case .diminished, .minorSeven5:
            return Colors.chordDiminished
        case .augmented:
            return Colors.chordAugmented
        case .suspended2, .suspended4:
            return Colors.chordSuspended
        case .add9, .sixth:
            return Colors.chordExtended
        }
    }
    
    /// Get color for dynamics level
    static func colorForDynamics(_ rmsDB: Double) -> Color {
        switch rmsDB {
        case ..<(-40): return Colors.dynamicsPP
        case -40..<(-30): return Colors.dynamicsP
        case -30..<(-20): return Colors.dynamicsMP
        case -20..<(-10): return Colors.dynamicsMF
        case -10..<0: return Colors.dynamicsF
        default: return Colors.dynamicsFF
        }
    }
}