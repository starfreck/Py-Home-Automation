import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color background = Color(0xFF090D14);
  static const Color surface = Color(0xFF0F1726);
  static const Color card = Color(0xFF141F33);
  static const Color cardBorder = Color(0xFF22314E);
  static const Color primary = Color(0xFFD97757); // Claude Terra-Cotta
  static const Color primaryGlow = Color(0x33D97757);
  static const Color accentCyan = Color(0xFF06B6D4);
  static const Color accentGreen = Color(0xFF10B981);
  static const Color accentAmber = Color(0xFFF59E0B);
  static const Color textMain = Color(0xFFF8FAFC);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color textDim = Color(0xFF64748B);

  static ThemeData get darkTheme {
    final fontFam = GoogleFonts.plusJakartaSans().fontFamily;

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: fontFam,
      scaffoldBackgroundColor: background,
      primaryColor: primary,
      colorScheme: const ColorScheme.dark(
        primary: primary,
        secondary: accentCyan,
        surface: surface,
        error: Color(0xFFEF4444),
      ),
      textTheme: ThemeData.dark().textTheme.apply(
        fontFamily: fontFam,
        bodyColor: textMain,
        displayColor: textMain,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: surface.withValues(alpha: 0.85),
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontFamily: fontFam,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: textMain,
          letterSpacing: -0.3,
        ),
      ),
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: cardBorder, width: 1),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: surface.withValues(alpha: 0.95),
        selectedItemColor: primary,
        unselectedItemColor: textDim,
        type: BottomNavigationBarType.fixed,
        elevation: 10,
      ),
      sliderTheme: const SliderThemeData(
        activeTrackColor: primary,
        inactiveTrackColor: cardBorder,
        thumbColor: Colors.white,
        overlayColor: primaryGlow,
        thumbShape: RoundSliderThumbShape(enabledThumbRadius: 8),
        trackHeight: 4,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith<Color>((states) {
          if (states.contains(WidgetState.selected)) {
            return Colors.white;
          }
          return textDim;
        }),
        trackColor: WidgetStateProperty.resolveWith<Color>((states) {
          if (states.contains(WidgetState.selected)) {
            return primary;
          }
          return cardBorder;
        }),
      ),
    );
  }
}
