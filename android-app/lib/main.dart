import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme.dart';
import 'presentation/auth/login_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    const ProviderScope(
      child: OcsCafmApp(),
    ),
  );
}

class OcsCafmApp extends StatelessWidget {
  const OcsCafmApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OCS CAFM',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      home: const LoginScreen(),
    );
  }
}
