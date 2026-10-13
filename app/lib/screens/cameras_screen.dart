import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/device.dart';
import '../providers/home_provider.dart';
import '../theme/app_theme.dart';

class CamerasScreen extends StatefulWidget {
  const CamerasScreen({super.key});

  @override
  State<CamerasScreen> createState() => _CamerasScreenState();
}

class _CamerasScreenState extends State<CamerasScreen> {
  bool _motionDetectionArmed = true;
  bool _isScanning = false;

  void _runFaceScan(HomeProvider provider) async {
    setState(() => _isScanning = true);
    await provider.triggerBiometricScan();
    await Future.delayed(const Duration(milliseconds: 1200));
    if (mounted) {
      setState(() => _isScanning = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Biometric verification: Identity matched (Confidence: 98.2%)'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppTheme.card,
        ),
      );
    }
  }

  void _showSnapshotDetails(BuildContext context, CameraSnapshot snap) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: AppTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 550),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      snap.source,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textMain),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 18, color: AppTheme.textDim),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Container(
                  height: 220,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.black,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: snap.dataUrl.isNotEmpty && snap.dataUrl.startsWith('data:image')
                      ? Image.memory(
                          base64Decode(snap.dataUrl.split(',').last),
                          fit: BoxFit.cover,
                        )
                      : const Center(
                          child: Icon(Icons.security, size: 48, color: AppTheme.accentCyan),
                        ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Recorded: ${DateFormat('yyyy-MM-dd HH:mm:ss').format(snap.timestamp)}',
                  style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                ),
                Text(
                  'Resolution: ${snap.width}x${snap.height} • Security CSI',
                  style: const TextStyle(fontSize: 11, color: AppTheme.textDim),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLiveFeedViewport(HomeProvider provider) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: _isScanning ? AppTheme.accentCyan : AppTheme.cardBorder,
          width: _isScanning ? 2 : 1,
        ),
        boxShadow: [
          if (_isScanning)
            BoxShadow(
              color: AppTheme.accentCyan.withValues(alpha: 0.3),
              blurRadius: 16,
              spreadRadius: 2,
            ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Camera stream viewport
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              children: [
                // Background simulated camera lens
                Container(
                  decoration: const BoxDecoration(
                    gradient: RadialGradient(
                      center: Alignment.center,
                      radius: 0.9,
                      colors: [Color(0xFF162032), Color(0xFF090D14)],
                    ),
                  ),
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.videocam_outlined,
                          size: 48,
                          color: AppTheme.accentCyan.withValues(alpha: 0.4),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'CSI-01 ENTRANCE PORTAL',
                          style: TextStyle(
                            fontSize: 12,
                            letterSpacing: 1.5,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textDim,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Face detection reticle
                Center(
                  child: Container(
                    width: 140,
                    height: 140,
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: _isScanning ? AppTheme.accentCyan : AppTheme.accentGreen.withValues(alpha: 0.6),
                        width: 1.5,
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Stack(
                      children: [
                        Positioned(
                          top: -1,
                          left: 4,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            color: Colors.black,
                            child: Text(
                              _isScanning ? 'SCANNING...' : 'FACE: ADMIN 98%',
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                color: _isScanning ? AppTheme.accentCyan : AppTheme.accentGreen,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // HUD Overlays
                Positioned(
                  top: 12,
                  left: 12,
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Colors.redAccent,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'REC',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: Colors.redAccent,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        DateFormat('yyyy-MM-dd HH:mm:ss').format(DateTime.now()),
                        style: const TextStyle(
                          fontSize: 10,
                          fontFamily: 'monospace',
                          color: AppTheme.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),

                Positioned(
                  bottom: 12,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'H.264 • 1080p • 30 FPS • 4.2 Mbps',
                      style: TextStyle(
                        fontSize: 9,
                        fontFamily: 'monospace',
                        color: AppTheme.textDim,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Camera Control Action Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: AppTheme.surface,
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.accentCyan.withValues(alpha: 0.2),
                      foregroundColor: AppTheme.accentCyan,
                      side: const BorderSide(color: AppTheme.accentCyan, width: 1),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: _isScanning ? null : () => _runFaceScan(provider),
                    icon: const Icon(Icons.fingerprint_rounded, size: 18),
                    label: const Text('Biometric Scan', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () {
                      provider.captureSnapshot();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Surveillance snapshot captured & saved'),
                          duration: Duration(seconds: 2),
                          behavior: SnackBarBehavior.floating,
                          backgroundColor: AppTheme.card,
                        ),
                      );
                    },
                    icon: const Icon(Icons.camera_alt_rounded, size: 18),
                    label: const Text('Snapshot', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStreamDiagnosticsCard(HomeProvider provider) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.insights_rounded, size: 18, color: AppTheme.accentCyan),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Vision Stream Diagnostics',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textMain),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildDiagRow('Stream Status', 'Active • WebRTC Low-Latency', AppTheme.accentGreen),
          const Divider(color: AppTheme.cardBorder, height: 16),
          _buildDiagRow('Frame Resolution', '1920x1080 @ 30 FPS', AppTheme.textMain),
          const Divider(color: AppTheme.cardBorder, height: 16),
          _buildDiagRow(
            'Motion Sensor',
            _motionDetectionArmed ? 'Armed (Auto-Trigger ON)' : 'Disarmed',
            _motionDetectionArmed ? AppTheme.accentGreen : AppTheme.textMuted,
          ),
          const Divider(color: AppTheme.cardBorder, height: 16),
          _buildDiagRow('Facial Biometric Match', 'Admin (98.2% confidence)', AppTheme.accentCyan),
        ],
      ),
    );
  }

  Widget _buildDiagRow(String label, String value, Color valueColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            value,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: valueColor),
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.end,
          ),
        ),
      ],
    );
  }

  Widget _buildSnapshotGalleryHeader(HomeProvider provider) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Expanded(
          child: Text(
            'Captured Surveillance Snapshots',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.3,
              color: AppTheme.textMain,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          '${provider.snapshots.length} frames',
          style: const TextStyle(fontSize: 11, color: AppTheme.textDim),
        ),
      ],
    );
  }

  Widget _buildSnapshotGallery(BuildContext context, HomeProvider provider, {required int crossAxisCount}) {
    if (provider.snapshots.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(28),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.cardBorder),
        ),
        child: const Column(
          children: [
            Icon(Icons.photo_library_outlined, size: 36, color: AppTheme.textDim),
            SizedBox(height: 8),
            Text(
              'No snapshots recorded yet',
              style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
            ),
            Text(
              'Tap "Snapshot" above to capture a frame from the CSI camera',
              style: TextStyle(fontSize: 11, color: AppTheme.textDim),
            ),
          ],
        ),
      );
    }

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.25,
      ),
      itemCount: provider.snapshots.length,
      itemBuilder: (context, index) {
        final snap = provider.snapshots[index];
        return InkWell(
          onTap: () => _showSnapshotDetails(context, snap),
          borderRadius: BorderRadius.circular(14),
          child: Container(
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppTheme.cardBorder),
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (snap.dataUrl.isNotEmpty && snap.dataUrl.startsWith('data:image'))
                  Image.memory(
                    base64Decode(snap.dataUrl.split(',').last),
                    fit: BoxFit.cover,
                  )
                else
                  Container(
                    color: AppTheme.surface,
                    child: const Icon(Icons.image, size: 32, color: AppTheme.textDim),
                  ),
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    color: Colors.black.withValues(alpha: 0.75),
                    child: Text(
                      DateFormat('HH:mm:ss').format(snap.timestamp),
                      style: const TextStyle(
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: AppTheme.textMain,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<HomeProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Vision & Surveillance'),
        actions: [
          IconButton(
            icon: Icon(
              _motionDetectionArmed ? Icons.shield_rounded : Icons.shield_outlined,
              color: _motionDetectionArmed ? AppTheme.accentGreen : AppTheme.textDim,
            ),
            tooltip: 'Motion Defense',
            onPressed: () {
              setState(() => _motionDetectionArmed = !_motionDetectionArmed);
            },
          ),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1600),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final isDesktop = constraints.maxWidth >= 1000;
              if (isDesktop) {
                return SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Studio viewport left (flex: 3)
                      Expanded(
                        flex: 3,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildLiveFeedViewport(provider),
                            const SizedBox(height: 16),
                            _buildStreamDiagnosticsCard(provider),
                          ],
                        ),
                      ),
                      const SizedBox(width: 20),
                      // Studio right (flex: 2)
                      Expanded(
                        flex: 2,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildSnapshotGalleryHeader(provider),
                            const SizedBox(height: 12),
                            _buildSnapshotGallery(context, provider, crossAxisCount: 2),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              } else {
                final snapCols = constraints.maxWidth > 600 ? 3 : 2;
                return SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildLiveFeedViewport(provider),
                      const SizedBox(height: 16),
                      _buildStreamDiagnosticsCard(provider),
                      const SizedBox(height: 24),
                      _buildSnapshotGalleryHeader(provider),
                      const SizedBox(height: 12),
                      _buildSnapshotGallery(context, provider, crossAxisCount: snapCols),
                    ],
                  ),
                );
              }
            },
          ),
        ),
      ),
    );
  }
}
