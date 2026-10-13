import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnihome_app/main.dart';
import 'package:omnihome_app/providers/home_provider.dart';
import 'package:omnihome_app/screens/login_screen.dart';

void main() {
  testWidgets('OmniHomeApp UI hierarchy and navigation test', (WidgetTester tester) async {
    final provider = HomeProvider(autoConnect: false);
    await tester.pumpWidget(OmniHomeApp(provider: provider));
    await tester.pumpAndSettle();

    expect(find.byType(OmniHomeApp), findsOneWidget);
    expect(find.text('OmniHome'), findsOneWidget);
    expect(find.text('Gemma 4 Synapse'), findsOneWidget);
    expect(find.text('Automation Scenes'), findsOneWidget);
    expect(find.text('Device Actuators'), findsOneWidget);
  });

  testWidgets('OmniHomeApp displays LoginScreen when unauthenticated', (WidgetTester tester) async {
    final provider = HomeProvider(autoConnect: false, token: null, user: null);
    await tester.pumpWidget(OmniHomeApp(provider: provider));
    await tester.pumpAndSettle();

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.text('Welcome to OmniHome'), findsOneWidget);
    expect(find.text('Sign In to Dashboard'), findsOneWidget);
    expect(find.text('Cloud Gateway Endpoint'), findsOneWidget);
  });

  testWidgets('OmniHomeApp responsive mobile layout (< 768px)', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() => tester.view.resetPhysicalSize());

    final provider = HomeProvider(autoConnect: false);
    await tester.pumpWidget(OmniHomeApp(provider: provider));
    await tester.pumpAndSettle();

    // In mobile mode, BottomNavigationBar is used
    expect(find.byType(BottomNavigationBar), findsOneWidget);

    // Switch to Devices screen
    await tester.tap(find.text('Devices'));
    await tester.pumpAndSettle();
    expect(find.text('Hardware Devices'), findsOneWidget);

    // Switch to Vision screen
    await tester.tap(find.text('Vision'));
    await tester.pumpAndSettle();
    expect(find.text('Vision & Surveillance'), findsOneWidget);

    // Switch to Activity screen
    await tester.tap(find.text('Audit'));
    await tester.pumpAndSettle();
    expect(find.text('System Audit Ledger'), findsOneWidget);

    // Switch to Settings screen (labeled 'Hub' in mobile BottomNav)
    await tester.tap(find.text('Hub'));
    await tester.pumpAndSettle();
    expect(find.text('Gateway & Settings'), findsOneWidget);
  });

  testWidgets('OmniHomeApp responsive desktop layout (>= 768px)', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() => tester.view.resetPhysicalSize());

    final provider = HomeProvider(autoConnect: false);
    await tester.pumpWidget(OmniHomeApp(provider: provider));
    await tester.pumpAndSettle();

    // In desktop mode, sidebar navigation is used, BottomNavigationBar is not
    expect(find.byType(BottomNavigationBar), findsNothing);
    expect(find.textContaining('Edge:'), findsWidgets);

    // Switch to Devices tab
    await tester.tap(find.text('Devices'));
    await tester.pumpAndSettle();
    expect(find.text('Hardware Devices'), findsOneWidget);

    // Switch to Vision tab
    await tester.tap(find.text('Vision'));
    await tester.pumpAndSettle();
    expect(find.text('Vision & Surveillance'), findsOneWidget);

    // Switch to Activity tab
    await tester.tap(find.text('Audit'));
    await tester.pumpAndSettle();
    expect(find.text('System Audit Ledger'), findsOneWidget);

    // Switch to Settings tab
    await tester.tap(find.text('Hub Settings'));
    await tester.pumpAndSettle();
    expect(find.text('Gateway & Settings'), findsOneWidget);
  });
}
