import 'package:flutter/material.dart';
import '../models/device.dart';
import '../theme/app_theme.dart';

class DeviceCard extends StatelessWidget {
  final Device device;
  final ValueChanged<bool>? onToggle;
  final ValueChanged<int>? onSliderChanged;
  final VoidCallback? onLongPress;

  const DeviceCard({
    super.key,
    required this.device,
    this.onToggle,
    this.onSliderChanged,
    this.onLongPress,
  });

  IconData _getDeviceIcon(DeviceType type) {
    switch (type) {
      case DeviceType.dimmer:
        return Icons.lightbulb_circle_outlined;
      case DeviceType.fan:
        return Icons.mode_fan_off_outlined;
      case DeviceType.lock:
        return device.state ? Icons.lock_outline_rounded : Icons.lock_open_rounded;
      case DeviceType.sensor:
        return Icons.sensors_rounded;
      case DeviceType.relay:
        return Icons.power_settings_new_rounded;
    }
  }

  Color _getAccentColor() {
    if (!device.state) return AppTheme.textDim;
    switch (device.type) {
      case DeviceType.dimmer:
        return AppTheme.accentAmber;
      case DeviceType.fan:
        return AppTheme.accentCyan;
      case DeviceType.lock:
        return AppTheme.accentGreen;
      case DeviceType.sensor:
        return AppTheme.accentCyan;
      case DeviceType.relay:
        return AppTheme.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final accent = _getAccentColor();
    final isActive = device.state;

    return InkWell(
      onLongPress: onLongPress,
      borderRadius: BorderRadius.circular(18),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isActive ? AppTheme.card.withValues(alpha: 0.95) : AppTheme.surface.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isActive ? accent.withValues(alpha: 0.35) : AppTheme.cardBorder,
            width: 1.2,
          ),
          boxShadow: [
            if (isActive)
              BoxShadow(
                color: accent.withValues(alpha: 0.12),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Icon pill
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isActive ? accent.withValues(alpha: 0.18) : AppTheme.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isActive ? accent.withValues(alpha: 0.4) : AppTheme.cardBorder,
                      width: 1,
                    ),
                  ),
                  child: Icon(
                    _getDeviceIcon(device.type),
                    size: 22,
                    color: isActive ? accent : AppTheme.textDim,
                  ),
                ),

                // Toggle switch / status chip
                if (device.type == DeviceType.lock)
                  GestureDetector(
                    onTap: () => onToggle?.call(!device.state),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: isActive ? AppTheme.accentGreen.withValues(alpha: 0.15) : AppTheme.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isActive ? AppTheme.accentGreen.withValues(alpha: 0.4) : AppTheme.primary.withValues(alpha: 0.4),
                          width: 1,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isActive ? Icons.lock : Icons.lock_open,
                            size: 13,
                            color: isActive ? AppTheme.accentGreen : AppTheme.primary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            isActive ? 'SECURED' : 'UNLOCKED',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                              color: isActive ? AppTheme.accentGreen : AppTheme.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  Switch(
                    value: device.state,
                    onChanged: (val) => onToggle?.call(val),
                  ),
              ],
            ),

            const SizedBox(height: 14),

            // Device Name & Room
            Text(
              device.name,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppTheme.textMain,
                letterSpacing: -0.2,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),

            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.cardBorder.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    device.room.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textMuted,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
                if (device.powerWatts > 0 && device.state) ...[
                  const SizedBox(width: 6),
                  Text(
                    '${device.powerWatts.toStringAsFixed(0)}W',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.accentAmber,
                    ),
                  ),
                ],
                const Spacer(),
                if (device.gpioPin != null)
                  Text(
                    'GPIO ${device.gpioPin}',
                    style: const TextStyle(
                      fontSize: 9,
                      fontFamily: 'monospace',
                      color: AppTheme.textDim,
                    ),
                  ),
              ],
            ),

            // Slider for Dimmer or Fan
            if ((device.type == DeviceType.dimmer || device.type == DeviceType.fan)) ...[
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    device.type == DeviceType.dimmer ? 'Brightness' : 'Speed',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: AppTheme.textDim,
                    ),
                  ),
                  Text(
                    '${device.value}%',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: isActive ? accent : AppTheme.textDim,
                    ),
                  ),
                ],
              ),
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  activeTrackColor: accent,
                  thumbColor: Colors.white,
                  trackHeight: 3,
                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                ),
                child: Slider(
                  value: device.value.toDouble().clamp(0.0, 100.0),
                  min: 0,
                  max: 100,
                  onChanged: (val) {
                    onSliderChanged?.call(val.round());
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
