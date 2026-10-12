import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/home_provider.dart';
import 'screens/activity_screen.dart';
import 'screens/cameras_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/devices_screen.dart';
import 'screens/settings_screen.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const OmniHomeApp());
}

class OmniHomeApp extends StatelessWidget {
  final HomeProvider? provider;

  const OmniHomeApp({super.key, this.provider});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => provider ?? HomeProvider()),
      ],
      child: MaterialApp(
        title: 'OmniHome Synapse',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        home: const MainNavigationShell(),
      ),
    );
  }
}

class MainNavigationShell extends StatefulWidget {
  const MainNavigationShell({super.key});

  @override
  State<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends State<MainNavigationShell> {
  int _selectedIndex = 0;

  final List<Widget> _screens = const [
    DashboardScreen(),
    DevicesScreen(),
    CamerasScreen(),
    ActivityScreen(),
    SettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _selectedIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(
            top: BorderSide(
              color: AppTheme.cardBorder,
              width: 1,
            ),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: _selectedIndex,
          onTap: (index) {
            setState(() => _selectedIndex = index);
          },
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined),
              activeIcon: Icon(Icons.dashboard_rounded),
              label: 'Overview',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.devices_other_outlined),
              activeIcon: Icon(Icons.devices_other_rounded),
              label: 'Devices',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.videocam_outlined),
              activeIcon: Icon(Icons.videocam_rounded),
              label: 'Vision',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.receipt_long_outlined),
              activeIcon: Icon(Icons.receipt_long_rounded),
              label: 'Audit',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.settings_outlined),
              activeIcon: Icon(Icons.settings_rounded),
              label: 'Hub',
            ),
          ],
        ),
      ),
    );
  }
}
