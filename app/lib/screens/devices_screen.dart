import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/device.dart';
import '../providers/home_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/device_card.dart';

class DevicesScreen extends StatefulWidget {
  const DevicesScreen({super.key});

  @override
  State<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends State<DevicesScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _showAddDeviceModal(BuildContext context) {
    final formKey = GlobalKey<FormState>();
    String name = '';
    String room = 'Living Room';
    DeviceType type = DeviceType.relay;
    int? gpioPin = 17;
    double powerWatts = 40.0;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalContext, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(modalContext).viewInsets.bottom + 20,
              ),
              child: Form(
                key: formKey,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Enroll New Hardware Device',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textMain,
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, color: AppTheme.textDim),
                            onPressed: () => Navigator.pop(modalContext),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        decoration: InputDecoration(
                          labelText: 'Device Name',
                          hintText: 'e.g. Master Chandelier, AC Fan',
                          filled: true,
                          fillColor: AppTheme.surface,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Please enter a name' : null,
                        onSaved: (v) => name = v!.trim(),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<DeviceType>(
                        initialValue: type,
                        decoration: InputDecoration(
                          labelText: 'Device Type',
                          filled: true,
                          fillColor: AppTheme.surface,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        items: DeviceType.values.map((t) {
                          return DropdownMenuItem(
                            value: t,
                            child: Text(t.name.toUpperCase()),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setModalState(() => type = val);
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        initialValue: room,
                        decoration: InputDecoration(
                          labelText: 'Room',
                          hintText: 'e.g. Living Room, Bedroom',
                          filled: true,
                          fillColor: AppTheme.surface,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onSaved: (v) => room = v?.trim() ?? 'General',
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              initialValue: '17',
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(
                                labelText: 'Raspberry Pi GPIO',
                                hintText: 'Pin 2-27',
                                filled: true,
                                fillColor: AppTheme.surface,
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              onSaved: (v) => gpioPin = int.tryParse(v ?? ''),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              initialValue: '40',
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(
                                labelText: 'Rated Watts',
                                hintText: 'Watts',
                                filled: true,
                                fillColor: AppTheme.surface,
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              onSaved: (v) => powerWatts = double.tryParse(v ?? '') ?? 0.0,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primary,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: () {
                            if (formKey.currentState!.validate()) {
                              formKey.currentState!.save();
                              final newDev = Device(
                                id: 'device-${DateTime.now().millisecondsSinceEpoch}',
                                name: name,
                                type: type,
                                room: room,
                                state: false,
                                value: (type == DeviceType.dimmer || type == DeviceType.fan) ? 50 : 0,
                                gpioPin: gpioPin,
                                powerWatts: powerWatts,
                                icon: '⚡',
                                lastUpdated: DateTime.now(),
                              );
                              final provider = context.read<HomeProvider>();
                              provider.addDevice(newDev);
                              Navigator.pop(modalContext);
                            }
                          },
                          child: const Text(
                            'Save Device to Hub',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _confirmDelete(BuildContext context, Device device) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Delete ${device.name}?'),
        content: Text(
          'Are you sure you want to remove this device (${device.room}) from OmniHome Hub?',
          style: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () {
              final provider = context.read<HomeProvider>();
              provider.deleteDevice(device.id);
              Navigator.pop(ctx);
            },
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<HomeProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Hardware Devices'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded, color: AppTheme.primary, size: 24),
            tooltip: 'Add Device',
            onPressed: () => _showAddDeviceModal(context),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search & Filter header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  onChanged: (val) => provider.setSearchQuery(val),
                  style: const TextStyle(fontSize: 14, color: AppTheme.textMain),
                  decoration: InputDecoration(
                    hintText: 'Search devices by name, room, or type...',
                    hintStyle: const TextStyle(fontSize: 13, color: AppTheme.textDim),
                    prefixIcon: const Icon(Icons.search_rounded, size: 20, color: AppTheme.textDim),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, size: 18, color: AppTheme.textDim),
                            onPressed: () {
                              _searchController.clear();
                              provider.setSearchQuery('');
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: AppTheme.surface,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: AppTheme.cardBorder),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: AppTheme.cardBorder),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
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
                          side: BorderSide(color: isSelected ? AppTheme.primary : AppTheme.cardBorder),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          onSelected: (_) => provider.setFilter(room),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),

          // Count summary bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${provider.filteredDevices.length} Devices Registered',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textMuted),
                ),
                Text(
                  '${provider.devices.where((d) => d.state).length} Active Now',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.accentGreen),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),

          // Device grid
          Expanded(
            child: provider.filteredDevices.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.devices_other_rounded, size: 48, color: AppTheme.textDim),
                        const SizedBox(height: 12),
                        const Text(
                          'No devices match the criteria',
                          style: TextStyle(fontSize: 14, color: AppTheme.textMuted),
                        ),
                        const SizedBox(height: 8),
                        TextButton.icon(
                          onPressed: () => _showAddDeviceModal(context),
                          icon: const Icon(Icons.add, size: 18, color: AppTheme.primary),
                          label: const Text('Add a new device', style: TextStyle(color: AppTheme.primary)),
                        ),
                      ],
                    ),
                  )
                : LayoutBuilder(
                    builder: (context, constraints) {
                      final isWide = constraints.maxWidth > 550;
                      return GridView.builder(
                        padding: const EdgeInsets.all(16),
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
                            onLongPress: () => _confirmDelete(context, dev),
                          );
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
