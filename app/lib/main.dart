import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/home_provider.dart';
import 'screens/activity_screen.dart';
import 'screens/cameras_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/devices_screen.dart';
import 'screens/login_screen.dart';
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
        home: Consumer<HomeProvider>(
          builder: (context, home, child) {
            if (!home.isAuthenticated) {
              return const LoginScreen();
            }
            return const MainNavigationShell();
          },
        ),
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
    final home = context.watch<HomeProvider>();

    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth >= 768;

        if (isDesktop) {
          // DESKTOP & TABLET ADAPTIVE SIDEBAR NAVIGATION
          return Scaffold(
            body: Row(
              children: [
                // SIDEBAR
                Container(
                  width: constraints.maxWidth >= 1100 ? 230 : 80,
                  decoration: const BoxDecoration(
                    color: AppTheme.surface,
                    border: Border(
                      right: BorderSide(
                        color: AppTheme.cardBorder,
                        width: 1,
                      ),
                    ),
                  ),
                  child: Column(
                    children: [
                      // LOGO & HEADER
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                        child: Row(
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: const LinearGradient(
                                  colors: [AppTheme.primary, AppTheme.accentCyan],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppTheme.primary.withValues(alpha: 0.3),
                                    blurRadius: 10,
                                  ),
                                ],
                              ),
                              child: const Icon(Icons.home_work_rounded, color: Colors.white, size: 20),
                            ),
                            if (constraints.maxWidth >= 1100) ...[
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'OmniHome',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.textMain,
                                        letterSpacing: -0.3,
                                      ),
                                    ),
                                    Text(
                                      home.currentUser?.name ?? 'Cloud Tenant',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: AppTheme.textMuted,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const Divider(color: AppTheme.cardBorder, height: 1),

                      const SizedBox(height: 12),

                      // NAVIGATION DESTINATIONS
                      Expanded(
                        child: ListView(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          children: [
                            _buildNavItem(
                              index: 0,
                              icon: Icons.dashboard_outlined,
                              activeIcon: Icons.dashboard_rounded,
                              label: 'Overview',
                              isExpanded: constraints.maxWidth >= 1100,
                            ),
                            _buildNavItem(
                              index: 1,
                              icon: Icons.devices_other_outlined,
                              activeIcon: Icons.devices_other_rounded,
                              label: 'Devices',
                              isExpanded: constraints.maxWidth >= 1100,
                            ),
                            _buildNavItem(
                              index: 2,
                              icon: Icons.videocam_outlined,
                              activeIcon: Icons.videocam_rounded,
                              label: 'Vision',
                              isExpanded: constraints.maxWidth >= 1100,
                            ),
                            _buildNavItem(
                              index: 3,
                              icon: Icons.receipt_long_outlined,
                              activeIcon: Icons.receipt_long_rounded,
                              label: 'Audit',
                              isExpanded: constraints.maxWidth >= 1100,
                            ),
                            _buildNavItem(
                              index: 4,
                              icon: Icons.settings_outlined,
                              activeIcon: Icons.settings_rounded,
                              label: 'Hub Settings',
                              isExpanded: constraints.maxWidth >= 1100,
                            ),
                          ],
                        ),
                      ),

                      // FOOTER (EDGE LINK & LOGOUT)
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          children: [
                            // EDGE REVERSE TUNNEL STATUS BADGE
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: home.isEdgeOnline
                                    ? AppTheme.accentGreen.withValues(alpha: 0.12)
                                    : Colors.redAccent.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: home.isEdgeOnline
                                      ? AppTheme.accentGreen.withValues(alpha: 0.3)
                                      : Colors.redAccent.withValues(alpha: 0.3),
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Container(
                                    width: 8,
                                    height: 8,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: home.isEdgeOnline ? AppTheme.accentGreen : Colors.redAccent,
                                    ),
                                  ),
                                  if (constraints.maxWidth >= 1100) ...[
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        home.isEdgeOnline ? 'Edge: Online' : 'Edge: Offline',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                          color: home.isEdgeOnline ? AppTheme.accentGreen : Colors.redAccent,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(height: 8),
                            // SIGN OUT BUTTON
                            InkWell(
                              onTap: () => home.logout(),
                              borderRadius: BorderRadius.circular(10),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(Icons.logout_rounded, size: 16, color: AppTheme.textDim),
                                    if (constraints.maxWidth >= 1100) ...[
                                      const SizedBox(width: 8),
                                      const Text(
                                        'Sign Out',
                                        style: TextStyle(fontSize: 12, color: AppTheme.textDim),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // ACTIVE VIEW
                Expanded(
                  child: IndexedStack(
                    index: _selectedIndex,
                    children: _screens,
                  ),
                ),
              ],
            ),
          );
        }

        // MOBILE SCREEN: BOTTOM NAVIGATION BAR
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
      },
    );
  }

  Widget _buildNavItem({
    required int index,
    required IconData icon,
    required IconData activeIcon,
    required String label,
    required bool isExpanded,
  }) {
    final isSelected = _selectedIndex == index;

    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: InkWell(
        onTap: () => setState(() => _selectedIndex = index),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: isExpanded ? 14 : 12, vertical: 11),
          decoration: BoxDecoration(
            color: isSelected ? AppTheme.primary.withValues(alpha: 0.15) : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? AppTheme.primary.withValues(alpha: 0.35) : Colors.transparent,
            ),
          ),
          child: Row(
            mainAxisAlignment: isExpanded ? MainAxisAlignment.start : MainAxisAlignment.center,
            children: [
              Icon(
                isSelected ? activeIcon : icon,
                color: isSelected ? AppTheme.primary : AppTheme.textMuted,
                size: 20,
              ),
              if (isExpanded) ...[
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected ? AppTheme.textMain : AppTheme.textMuted,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
