import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/home_provider.dart';
import '../theme/app_theme.dart';

class ActivityScreen extends StatefulWidget {
  const ActivityScreen({super.key});

  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  String _selectedCategory = 'All';

  Color _getCategoryColor(String cat) {
    switch (cat.toLowerCase()) {
      case 'security':
        return AppTheme.accentGreen;
      case 'ai':
        return AppTheme.primary;
      case 'scene':
      case 'automation':
        return AppTheme.accentAmber;
      case 'hardware':
      default:
        return AppTheme.accentCyan;
    }
  }

  IconData _getCategoryIcon(String cat) {
    switch (cat.toLowerCase()) {
      case 'security':
        return Icons.shield_rounded;
      case 'ai':
        return Icons.auto_awesome_rounded;
      case 'scene':
      case 'automation':
        return Icons.flash_on_rounded;
      case 'hardware':
      default:
        return Icons.memory_rounded;
    }
  }

  void _confirmClear(BuildContext context, HomeProvider provider) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Clear Activity Ledger?'),
        content: const Text(
          'This will purge all logged hardware events and audit records from the gateway.',
          style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () {
              provider.clearActivityLedger();
              Navigator.pop(ctx);
            },
            child: const Text('Clear All', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<HomeProvider>();

    final filteredActivities = _selectedCategory == 'All'
        ? provider.activities
        : provider.activities.where((a) => a.category.toLowerCase() == _selectedCategory.toLowerCase()).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('System Audit Ledger'),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded, size: 20, color: AppTheme.textDim),
            tooltip: 'Clear Audit Logs',
            onPressed: () => _confirmClear(context, provider),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter chips
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: ['All', 'Hardware', 'Security', 'AI', 'Scene'].map((cat) {
                  final isSelected = _selectedCategory.toLowerCase() == cat.toLowerCase();
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: FilterChip(
                      selected: isSelected,
                      label: Text(cat),
                      labelStyle: TextStyle(
                        fontSize: 11,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                        color: isSelected ? Colors.white : AppTheme.textMuted,
                      ),
                      selectedColor: AppTheme.primary,
                      backgroundColor: AppTheme.card,
                      side: BorderSide(color: isSelected ? AppTheme.primary : AppTheme.cardBorder),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      onSelected: (_) => setState(() => _selectedCategory = cat),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),

          // Total events counter
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${filteredActivities.length} Events in Ledger',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textMuted),
                ),
                const Row(
                  children: [
                    Icon(Icons.lock_clock_rounded, size: 12, color: AppTheme.accentGreen),
                    SizedBox(width: 4),
                    Text(
                      'Tamper-Evident Ledger',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.accentGreen),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Ledger timeline list
          Expanded(
            child: filteredActivities.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.history_toggle_off_rounded, size: 48, color: AppTheme.textDim),
                        const SizedBox(height: 12),
                        const Text(
                          'No audit activities recorded',
                          style: TextStyle(fontSize: 14, color: AppTheme.textMuted),
                        ),
                        Text(
                          _selectedCategory == 'All'
                              ? 'Gateway is idling with no state changes'
                              : 'No events under $_selectedCategory category',
                          style: const TextStyle(fontSize: 12, color: AppTheme.textDim),
                        ),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: filteredActivities.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final item = filteredActivities[index];
                      final catColor = _getCategoryColor(item.category);
                      final catIcon = _getCategoryIcon(item.category);

                      return Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppTheme.card,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppTheme.cardBorder),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: catColor.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: catColor.withValues(alpha: 0.3)),
                              ),
                              child: Icon(catIcon, size: 16, color: catColor),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.message,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: AppTheme.textMain,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                        decoration: BoxDecoration(
                                          color: AppTheme.surface,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          item.source.toUpperCase(),
                                          style: const TextStyle(
                                            fontSize: 9,
                                            fontWeight: FontWeight.w700,
                                            letterSpacing: 0.5,
                                            color: AppTheme.textDim,
                                            fontFamily: 'monospace',
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        DateFormat('MMM dd, HH:mm:ss').format(item.timestamp),
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: AppTheme.textMuted,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
