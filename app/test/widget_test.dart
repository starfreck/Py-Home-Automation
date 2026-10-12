import 'package:flutter_test/flutter_test.dart';
import 'package:omnihome_app/main.dart';
import 'package:omnihome_app/providers/home_provider.dart';

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
}
