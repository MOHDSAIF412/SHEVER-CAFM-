import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shever_cafm/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: SheverCafmApp(),
      ),
    );
    expect(find.text('SHEVER TECHNICAL'), findsOneWidget);
  });
}
