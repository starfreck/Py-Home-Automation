import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/home_provider.dart';
import '../theme/app_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late TextEditingController _urlController;
  bool _isTesting = false;
  String? _testResult;

  @override
  void initState() {
    super.initState();
    final provider = context.read<HomeProvider>();
    _urlController = TextEditingController(text: provider.baseUrl);
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  void _testConnection(HomeProvider provider) async {
    setState(() {
      _isTesting = true;
      _testResult = null;
    });

    final target = _urlController.text.trim();
    provider.updateGatewayUrl(target);
    await provider.pingStatus();

    setState(() {
      _isTesting = false;
      if (provider.isConnected) {
        _testResult = 'Connected to ${provider.status?.gateway ?? "OmniHome Hub"} (${provider.latencyMs}ms latency)';
      } else {
        _testResult = 'Connection failed to $target. Verify host and port.';
      }
    });
  }

  String _formatUptime(int seconds) {
    if (seconds <= 0) return '0m';
    final d = seconds ~/ 86400;
    final h = (seconds % 86400) ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    if (d > 0) return '${d}d ${h}h ${m}m';
    if (h > 0) return '${h}h ${m}m';
    return '${m}m ${seconds % 60}s';
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<HomeProvider>();
    final status = provider.status;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Gateway & Settings'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // TENANT ACCOUNT CARD
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.card,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppTheme.cardBorder),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 22,
                    backgroundColor: AppTheme.accentCyan.withValues(alpha: 0.2),
                    child: Text(
                      (provider.currentUser?.name.isNotEmpty == true)
                          ? provider.currentUser!.name.substring(0, 1).toUpperCase()
                          : 'U',
                      style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.accentCyan),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          provider.currentUser?.name ?? 'Authenticated Tenant',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textMain),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          provider.currentUser?.email ?? 'tenant@omnihome.cloud',
                          style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => provider.logout(),
                    icon: const Icon(Icons.logout_rounded, color: Colors.redAccent, size: 20),
                    tooltip: 'Sign Out',
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // GATEWAY CONNECTION CARD
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
                  const Row(
                    children: [
                      Icon(Icons.router_rounded, size: 20, color: AppTheme.primary),
                      SizedBox(width: 8),
                      Text(
                        'Gateway Server Endpoint',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textMain),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Specify the IP address or hostname of your Go/Raspberry Pi hub.',
                    style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _urlController,
                    style: const TextStyle(fontSize: 13, color: AppTheme.textMain),
                    decoration: InputDecoration(
                      labelText: 'Gateway Base URL',
                      hintText: 'http://localhost:8080 or http://192.168.1.100:8080',
                      prefixIcon: const Icon(Icons.link_rounded, size: 18, color: AppTheme.textDim),
                      filled: true,
                      fillColor: AppTheme.surface,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: _isTesting ? null : () => _testConnection(provider),
                      icon: _isTesting
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.network_check_rounded, size: 18, color: Colors.white),
                      label: Text(
                        _isTesting ? 'Pinging Gateway...' : 'Apply & Test Connection',
                        style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white),
                      ),
                    ),
                  ),
                  if (_testResult != null) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: provider.isConnected
                            ? AppTheme.accentGreen.withValues(alpha: 0.12)
                            : Colors.redAccent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: provider.isConnected
                              ? AppTheme.accentGreen.withValues(alpha: 0.3)
                              : Colors.redAccent.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            provider.isConnected ? Icons.check_circle_rounded : Icons.error_rounded,
                            size: 16,
                            color: provider.isConnected ? AppTheme.accentGreen : Colors.redAccent,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _testResult!,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: provider.isConnected ? AppTheme.accentGreen : Colors.redAccent,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 20),

            // SYSTEM TELEMETRY & HARDWARE SPECS
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
                  const Row(
                    children: [
                      Icon(Icons.developer_board_rounded, size: 20, color: AppTheme.accentCyan),
                      SizedBox(width: 8),
                      Text(
                        'Hub Hardware & Specs',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textMain),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _buildSpecRow('Gateway Daemon', status?.gateway ?? 'OmniHome Main Hub'),
                  const Divider(color: AppTheme.cardBorder, height: 16),
                  _buildSpecRow('Firmware Version', status?.version ?? '2.4.0 (Synapse Engine)'),
                  const Divider(color: AppTheme.cardBorder, height: 16),
                  _buildSpecRow('System Uptime', _formatUptime(status?.uptimeSeconds ?? 1420)),
                  const Divider(color: AppTheme.cardBorder, height: 16),
                  _buildSpecRow(
                    'Edge Reverse Tunnel',
                    provider.isEdgeOnline ? '🟢 Connected (Raspberry Pi Online)' : '🔴 Offline (Run omnihome-edge start)',
                  ),
                  const Divider(color: AppTheme.cardBorder, height: 16),
                  _buildSpecRow('CPU Temp', '${provider.telemetry.cpuTemp.toStringAsFixed(1)} °C'),
                  const Divider(color: AppTheme.cardBorder, height: 16),
                  _buildSpecRow('CPU Load', '${provider.telemetry.cpuUsage.toStringAsFixed(1)}%'),
                  const Divider(color: AppTheme.cardBorder, height: 16),
                  _buildSpecRow('RAM Usage', '${provider.telemetry.memoryUsage.toStringAsFixed(1)}%'),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // ARCHITECTURE & EDGE DEPLOYMENT
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
                  const Row(
                    children: [
                      Icon(Icons.hub_rounded, size: 20, color: AppTheme.accentAmber),
                      SizedBox(width: 8),
                      Text(
                        'Deployment Topology',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textMain),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'OmniHome runs fully offline-first with zero cloud dependencies required for local control, paired with Gemma 4 local AI inference.',
                    style: TextStyle(fontSize: 12, color: AppTheme.textMuted, height: 1.4),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.surface,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Edge Hardware Daemon', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                        Text('edge/daemon.py (Py 3)', style: TextStyle(fontSize: 11, fontFamily: 'monospace', color: AppTheme.accentCyan)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.surface,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Core Gateway Engine', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                        Text('Go 1.22+ Native Binary', style: TextStyle(fontSize: 11, fontFamily: 'monospace', color: AppTheme.accentGreen)),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // ABOUT
            Center(
              child: Column(
                children: [
                  Text(
                    'OmniHome Suite v2.4.0',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textMuted),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Multi-Platform Flutter Client • Cross-Platform Engine',
                    style: TextStyle(fontSize: 11, color: AppTheme.textDim),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildSpecRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
        ),
        Text(
          value,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.textMain),
        ),
      ],
    );
  }
}
