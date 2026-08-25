import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme.dart';
import 'presentation/auth/login_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    const ProviderScope(
      child: SheverCafmApp(),
    ),
  );
}

class SheverCafmApp extends StatelessWidget {
  const SheverCafmApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Shever CAFM Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      home: const LoginScreen(),
    );
  }
}
