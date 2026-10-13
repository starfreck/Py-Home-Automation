import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/home_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/device_card.dart';
import '../widgets/kpi_card.dart';
import '../widgets/synapse_bar.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<HomeProvider>();
    final isOnline = provider.isConnected;
    final telemetry = provider.telemetry;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.primary.withValues(alpha: 0.4)),
              ),
              child: const Icon(Icons.home_max_rounded, color: AppTheme.primary, size: 20),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'OmniHome',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.4,
                    color: AppTheme.textMain,
                  ),
                ),
                Text(
                  provider.status?.gateway ?? 'Hardware Gateway Hub',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                    color: AppTheme.textMuted,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Connection status pill
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              color: isOnline ? AppTheme.accentGreen.withValues(alpha: 0.12) : AppTheme.primary.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isOnline ? AppTheme.accentGreen.withValues(alpha: 0.3) : AppTheme.primary.withValues(alpha: 0.3),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: isOnline ? AppTheme.accentGreen : Colors.redAccent,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 5),
                Text(
                  isOnline ? '${provider.latencyMs}ms' : 'Offline',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: isOnline ? AppTheme.accentGreen : Colors.redAccent,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20, color: AppTheme.textMuted),
            onPressed: () => provider.pingStatus(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => provider.pingStatus(),
        color: AppTheme.primary,
        backgroundColor: AppTheme.card,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // KPI METRICS BENTO
              LayoutBuilder(
                builder: (context, constraints) {
                  final isWide = constraints.maxWidth > 600;
                  final crossCount = isWide ? 4 : 2;
                  return GridView.count(
                    crossAxisCount: crossCount,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    childAspectRatio: isWide ? 1.4 : 1.25,
                    children: [
                      KpiCard(
                        icon: Icons.thermostat_rounded,
                        label: 'Indoor Climate',
                        value: '${telemetry.temperature.toStringAsFixed(1)}°C',
                        subtitle: 'Optimal comfort',
                        accentColor: AppTheme.accentCyan,
                      ),
                      KpiCard(
                        icon: Icons.water_drop_rounded,
                        label: 'Relative Humidity',
                        value: '${telemetry.humidity.toStringAsFixed(0)}%',
                        subtitle: 'Nominal ambient',
                        accentColor: AppTheme.accentCyan,
                      ),
                      KpiCard(
                        icon: Icons.bolt_rounded,
                        label: 'Power Consumption',
                        value: '${telemetry.totalWatts.toStringAsFixed(0)} W',
                        subtitle: 'Live hardware load',
                        accentColor: AppTheme.accentAmber,
                      ),
                      KpiCard(
                        icon: Icons.power_rounded,
                        label: 'Active Relays',
                        value: '${telemetry.activeCount} / ${telemetry.totalCount}',
                        subtitle: 'GPIO channels',
                        accentColor: AppTheme.accentGreen,
                      ),
                    ],
                  );
                },
              ),

              const SizedBox(height: 18),

              // GEMMA 4 SYNAPSE BAR
              const SynapseBar(),

              const SizedBox(height: 22),

              // AUTOMATION SCENES
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Automation Scenes',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.3,
                      color: AppTheme.textMain,
                    ),
                  ),
                  Text(
                    '${provider.scenes.length} configured',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: AppTheme.textDim,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 94,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: provider.scenes.length,
                  separatorBuilder: (context, index) => const SizedBox(width: 10),
                  itemBuilder: (context, index) {
                    final scene = provider.scenes[index];
                    return InkWell(
                      onTap: () {
                        provider.activateScene(scene.id);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Activated scene: ${scene.name}'),
                            duration: const Duration(seconds: 2),
                            behavior: SnackBarBehavior.floating,
                            backgroundColor: AppTheme.card,
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        width: 160,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppTheme.card,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppTheme.cardBorder),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  scene.icon,
                                  style: const TextStyle(fontSize: 22),
                                ),
                                Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: BoxDecoration(
                                    color: AppTheme.surface,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: AppTheme.cardBorder),
                                  ),
                                  child: const Icon(Icons.play_arrow_rounded, size: 14, color: AppTheme.textMuted),
                                ),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  scene.name,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: AppTheme.textMain,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  scene.description,
                                  style: const TextStyle(
                                    fontSize: 9,
                                    color: AppTheme.textMuted,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),

              const SizedBox(height: 24),

              // DEVICES QUICK CONTROLS
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Device Actuators',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.3,
                      color: AppTheme.textMain,
                    ),
                  ),
                  Text(
                    '${provider.devices.where((d) => d.state).length} Active',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Room Filter Chips
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: ['All', 'Living Room', 'Bedroom', 'Kitchen', 'Office', 'Entrance'].map((room) {
                    final isSelected = provider.currentFilter.toLowerCase() == room.toLowerCase();
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: FilterChip(
                        selected: isSelected,
                        label: Text(room),
                        labelStyle: TextStyle(
                          fontSize: 11,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                          color: isSelected ? Colors.white : AppTheme.textMuted,
                        ),
                        selectedColor: AppTheme.primary,
                        backgroundColor: AppTheme.card,
                        side: BorderSide(
                          color: isSelected ? AppTheme.primary : AppTheme.cardBorder,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        onSelected: (_) => provider.setFilter(room),
                      ),
                    );
                  }).toList(),
                ),
              ),

              const SizedBox(height: 14),

              // Devices Grid
              if (provider.filteredDevices.isEmpty)
                Container(
                  padding: const EdgeInsets.all(28),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppTheme.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.cardBorder),
                  ),
                  child: const Column(
                    children: [
                      Icon(Icons.devices_outlined, size: 36, color: AppTheme.textDim),
                      SizedBox(height: 8),
                      Text(
                        'No devices found in this room',
                        style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
                      ),
                    ],
                  ),
                )
              else
                LayoutBuilder(
                  builder: (context, constraints) {
                    final isWide = constraints.maxWidth > 550;
                    return GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: isWide ? 2 : 1,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        mainAxisExtent: 215,
                      ),
                      itemCount: provider.filteredDevices.length,
                      itemBuilder: (context, index) {
                        final dev = provider.filteredDevices[index];
                        return DeviceCard(
                          device: dev,
                          onToggle: (_) => provider.toggleDevice(dev.id),
                          onSliderChanged: (val) => provider.setSliderValue(dev.id, val),
                        );
                      },
                    );
                  },
                ),

              const SizedBox(height: 24),

              // CAMERA PREVIEW & SURVEILLANCE SHORTCUT
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppTheme.cardBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.videocam_rounded, size: 18, color: AppTheme.accentCyan),
                            SizedBox(width: 8),
                            Text(
                              'CSI Vision Surveillance',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.textMain,
                              ),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.accentGreen.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'LIVE 30 FPS',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.accentGreen,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Camera simulated viewport
                    Container(
                      height: 140,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Colors.black,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.cardBorder),
                      ),
                      child: Stack(
                        children: [
                          Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.camera_alt_outlined, size: 36, color: AppTheme.textDim.withValues(alpha: 0.6)),
                                const SizedBox(height: 6),
                                const Text(
                                  'CSI Camera 01 • Entrance Portal',
                                  style: TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                ),
                              ],
                            ),
                          ),
                          // Reticle lines
                          Positioned(
                            top: 10,
                            left: 10,
                            child: Text(
                              DateFormat('HH:mm:ss.SS').format(DateTime.now()),
                              style: const TextStyle(
                                fontSize: 10,
                                fontFamily: 'monospace',
                                color: AppTheme.accentGreen,
                              ),
                            ),
                          ),
                          Positioned(
                            top: 10,
                            right: 10,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.6),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'AI DETECT: ON',
                                style: TextStyle(
                                  fontSize: 9,
                                  fontFamily: 'monospace',
                                  color: AppTheme.accentCyan,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: AppTheme.cardBorder),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            onPressed: () => provider.triggerBiometricScan(),
                            icon: const Icon(Icons.fingerprint_rounded, size: 16, color: AppTheme.accentCyan),
                            label: const Text(
                              'Face Scan',
                              style: TextStyle(fontSize: 12, color: AppTheme.textMain),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primary,
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            onPressed: () => provider.captureSnapshot(),
                            icon: const Icon(Icons.photo_camera_rounded, size: 16, color: Colors.white),
                            label: const Text(
                              'Capture',
                              style: TextStyle(fontSize: 12, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // AUDIT TIMELINE PREVIEW
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Real-Time Activity',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.3,
                      color: AppTheme.textMain,
                    ),
                  ),
                  Text(
                    '${provider.activities.length} total events',
                    style: const TextStyle(fontSize: 11, color: AppTheme.textDim),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (provider.activities.isEmpty)
                Container(
                  padding: const EdgeInsets.all(20),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppTheme.card,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppTheme.cardBorder),
                  ),
                  child: const Text(
                    'No activities logged yet.',
                    style: TextStyle(fontSize: 12, color: AppTheme.textDim),
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: provider.activities.take(4).length,
                  separatorBuilder: (context, index) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final item = provider.activities[index];
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppTheme.card,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.cardBorder),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: item.category == 'security'
                                  ? AppTheme.accentGreen
                                  : item.category == 'ai'
                                      ? AppTheme.primary
                                      : AppTheme.accentCyan,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.message,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme.textMain,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${item.source.toUpperCase()} • ${DateFormat('HH:mm:ss').format(item.timestamp)}',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    color: AppTheme.textDim,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),

              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}
