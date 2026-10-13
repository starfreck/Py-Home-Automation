enum DeviceType {
  relay,
  dimmer,
  fan,
  lock,
  sensor;

  static DeviceType fromString(String str) {
    switch (str.toLowerCase()) {
      case 'dimmer':
        return DeviceType.dimmer;
      case 'fan':
        return DeviceType.fan;
      case 'lock':
        return DeviceType.lock;
      case 'sensor':
        return DeviceType.sensor;
      case 'relay':
      default:
        return DeviceType.relay;
    }
  }

  String toApiString() {
    switch (this) {
      case DeviceType.dimmer:
        return 'dimmer';
      case DeviceType.fan:
        return 'fan';
      case DeviceType.lock:
        return 'lock';
      case DeviceType.sensor:
        return 'sensor';
      case DeviceType.relay:
        return 'relay';
    }
  }
}

class Device {
  final String id;
  final String name;
  final DeviceType type;
  final String room;
  final bool state;
  final int value;
  final int? gpioPin;
  final double powerWatts;
  final String icon;
  final DateTime lastUpdated;

  Device({
    required this.id,
    required this.name,
    required this.type,
    required this.room,
    required this.state,
    required this.value,
    this.gpioPin,
    required this.powerWatts,
    required this.icon,
    required this.lastUpdated,
  });

  factory Device.fromJson(Map<String, dynamic> json) {
    return Device(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      type: DeviceType.fromString(json['type'] ?? 'relay'),
      room: json['room'] ?? 'General',
      state: json['state'] == true,
      value: (json['value'] is num) ? (json['value'] as num).toInt() : 0,
      gpioPin: json['gpio_pin'] != null ? (json['gpio_pin'] as num).toInt() : null,
      powerWatts: (json['power_watts'] is num) ? (json['power_watts'] as num).toDouble() : 0.0,
      icon: json['icon'] ?? '💡',
      lastUpdated: json['last_updated'] != null
          ? DateTime.tryParse(json['last_updated']) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'type': type.toApiString(),
      'room': room,
      'state': state,
      'value': value,
      if (gpioPin != null) 'gpio_pin': gpioPin,
      'power_watts': powerWatts,
      'icon': icon,
      'last_updated': lastUpdated.toIso8601String(),
    };
  }

  Device copyWith({
    String? id,
    String? name,
    DeviceType? type,
    String? room,
    bool? state,
    int? value,
    int? gpioPin,
    double? powerWatts,
    String? icon,
    DateTime? lastUpdated,
  }) {
    return Device(
      id: id ?? this.id,
      name: name ?? this.name,
      type: type ?? this.type,
      room: room ?? this.room,
      state: state ?? this.state,
      value: value ?? this.value,
      gpioPin: gpioPin ?? this.gpioPin,
      powerWatts: powerWatts ?? this.powerWatts,
      icon: icon ?? this.icon,
      lastUpdated: lastUpdated ?? this.lastUpdated,
    );
  }
}

class Telemetry {
  final double temperature;
  final double humidity;
  final double totalWatts;
  final double cpuUsage;
  final double memoryUsage;
  final double cpuTemp;
  final int activeCount;
  final int totalCount;
  final DateTime timestamp;

  Telemetry({
    required this.temperature,
    required this.humidity,
    required this.totalWatts,
    required this.cpuUsage,
    required this.memoryUsage,
    required this.cpuTemp,
    required this.activeCount,
    required this.totalCount,
    required this.timestamp,
  });

  factory Telemetry.initial() {
    return Telemetry(
      temperature: 22.4,
      humidity: 48.0,
      totalWatts: 180.0,
      cpuUsage: 5.2,
      memoryUsage: 22.5,
      cpuTemp: 38.5,
      activeCount: 4,
      totalCount: 6,
      timestamp: DateTime.now(),
    );
  }

  factory Telemetry.fromJson(Map<String, dynamic> json) {
    return Telemetry(
      temperature: (json['temperature'] is num) ? (json['temperature'] as num).toDouble() : 22.0,
      humidity: (json['humidity'] is num) ? (json['humidity'] as num).toDouble() : 45.0,
      totalWatts: (json['total_watts'] is num) ? (json['total_watts'] as num).toDouble() : 0.0,
      cpuUsage: (json['cpu_usage'] is num) ? (json['cpu_usage'] as num).toDouble() : 0.0,
      memoryUsage: (json['memory_usage'] is num) ? (json['memory_usage'] as num).toDouble() : 0.0,
      cpuTemp: (json['cpu_temp'] is num) ? (json['cpu_temp'] as num).toDouble() : 40.0,
      activeCount: (json['active_count'] is num) ? (json['active_count'] as num).toInt() : 0,
      totalCount: (json['total_count'] is num) ? (json['total_count'] as num).toInt() : 0,
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp']) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

class AutomationScene {
  final String id;
  final String name;
  final String icon;
  final String description;
  final Map<String, bool> actions;

  AutomationScene({
    required this.id,
    required this.name,
    required this.icon,
    required this.description,
    required this.actions,
  });

  factory AutomationScene.fromJson(Map<String, dynamic> json) {
    final actionsMap = <String, bool>{};
    if (json['actions'] is Map) {
      (json['actions'] as Map).forEach((k, v) {
        actionsMap[k.toString()] = v == true;
      });
    }
    return AutomationScene(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      icon: json['icon'] ?? '⚡',
      description: json['description'] ?? '',
      actions: actionsMap,
    );
  }
}

class ActivityItem {
  final String id;
  final DateTime timestamp;
  final String category;
  final String message;
  final String source;

  ActivityItem({
    required this.id,
    required this.timestamp,
    required this.category,
    required this.message,
    required this.source,
  });

  factory ActivityItem.fromJson(Map<String, dynamic> json) {
    return ActivityItem(
      id: json['id'] ?? '',
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp']) ?? DateTime.now()
          : DateTime.now(),
      category: json['category'] ?? 'hardware',
      message: json['message'] ?? '',
      source: json['source'] ?? 'system',
    );
  }
}

class CameraSnapshot {
  final String id;
  final DateTime timestamp;
  final String dataUrl;
  final String? storagePath;
  final String? storageUrl;
  final String source;
  final int width;
  final int height;
  final String? recognizedName;

  CameraSnapshot({
    required this.id,
    required this.timestamp,
    required this.dataUrl,
    this.storagePath,
    this.storageUrl,
    required this.source,
    required this.width,
    required this.height,
    this.recognizedName,
  });

  factory CameraSnapshot.fromJson(Map<String, dynamic> json) {
    return CameraSnapshot(
      id: json['id'] ?? '',
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp']) ?? DateTime.now()
          : DateTime.now(),
      dataUrl: json['data_url'] ?? '',
      storagePath: json['storage_path'],
      storageUrl: json['storage_url'],
      source: json['source'] ?? 'CAM-01',
      width: (json['width'] is num) ? (json['width'] as num).toInt() : 480,
      height: (json['height'] is num) ? (json['height'] as num).toInt() : 270,
      recognizedName: json['recognized_name'],
    );
  }
}

class GatewayStatus {
  final String status;
  final String version;
  final int uptimeSeconds;
  final String gateway;
  final int devicesCount;
  final int activeRelays;
  final bool edgeConnected;
  final DateTime timestamp;

  GatewayStatus({
    required this.status,
    required this.version,
    required this.uptimeSeconds,
    required this.gateway,
    required this.devicesCount,
    required this.activeRelays,
    this.edgeConnected = false,
    required this.timestamp,
  });

  factory GatewayStatus.fromJson(Map<String, dynamic> json) {
    return GatewayStatus(
      status: json['status'] ?? 'offline',
      version: json['version'] ?? '2.4.0',
      uptimeSeconds: (json['uptime_seconds'] is num) ? (json['uptime_seconds'] as num).toInt() : 0,
      gateway: json['gateway'] ?? 'OmniHome Cloud Hub',
      devicesCount: (json['devices_count'] is num) ? (json['devices_count'] as num).toInt() : 0,
      activeRelays: (json['active_relays'] is num) ? (json['active_relays'] as num).toInt() : 0,
      edgeConnected: json['edge_connected'] == true,
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp']) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

class AuthUser {
  final String id;
  final String email;
  final String name;
  final String token;

  AuthUser({
    required this.id,
    required this.email,
    required this.name,
    required this.token,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json, {String token = ''}) {
    final userMap = json['user'] is Map<String, dynamic> ? json['user'] as Map<String, dynamic> : json;
    return AuthUser(
      id: userMap['id'] ?? '',
      email: userMap['email'] ?? '',
      name: userMap['name'] ?? '',
      token: token.isNotEmpty ? token : (json['token'] ?? ''),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'name': name,
    'token': token,
  };
}

class FaceProfile {
  final String id;
  final String userId;
  final String name;
  final String role;
  final String photoUrl;
  final String actionDeviceId;
  final String actionType;
  final String actionSceneId;
  final String actionLabel;
  final int cooldownSec;
  final DateTime? lastSeen;
  final double confidence;

  FaceProfile({
    required this.id,
    required this.userId,
    required this.name,
    this.role = 'Family Member',
    this.photoUrl = '',
    this.actionDeviceId = '',
    this.actionType = 'none',
    this.actionSceneId = '',
    this.actionLabel = 'Log & Notify Only',
    this.cooldownSec = 30,
    this.lastSeen,
    this.confidence = 0.95,
  });

  factory FaceProfile.fromJson(Map<String, dynamic> json) {
    return FaceProfile(
      id: json['id'] ?? '',
      userId: json['user_id'] ?? '',
      name: json['name'] ?? '',
      role: json['role'] ?? 'Family Member',
      photoUrl: json['photo_url'] ?? '',
      actionDeviceId: json['action_device_id'] ?? '',
      actionType: json['action_type'] ?? 'none',
      actionSceneId: json['action_scene_id'] ?? '',
      actionLabel: json['action_label'] ?? 'Log & Notify Only',
      cooldownSec: (json['cooldown_sec'] is num) ? (json['cooldown_sec'] as num).toInt() : 30,
      lastSeen: json['last_seen'] != null ? DateTime.tryParse(json['last_seen']) : null,
      confidence: (json['confidence'] is num) ? (json['confidence'] as num).toDouble() : 0.95,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'user_id': userId,
    'name': name,
    'role': role,
    'photo_url': photoUrl,
    'action_device_id': actionDeviceId,
    'action_type': actionType,
    'action_scene_id': actionSceneId,
    'action_label': actionLabel,
    'cooldown_sec': cooldownSec,
  };
}

class FaceRecognitionEvent {
  final String profileId;
  final String name;
  final double confidence;
  final String cameraId;
  final String actionExecuted;
  final String snapshot;
  final DateTime timestamp;

  FaceRecognitionEvent({
    required this.profileId,
    required this.name,
    required this.confidence,
    required this.cameraId,
    required this.actionExecuted,
    required this.snapshot,
    required this.timestamp,
  });

  factory FaceRecognitionEvent.fromJson(Map<String, dynamic> json) {
    return FaceRecognitionEvent(
      profileId: json['profile_id'] ?? '',
      name: json['name'] ?? '',
      confidence: (json['confidence'] is num) ? (json['confidence'] as num).toDouble() : 0.95,
      cameraId: json['camera_id'] ?? '',
      actionExecuted: json['action_executed'] ?? '',
      snapshot: json['snapshot'] ?? '',
      timestamp: json['timestamp'] != null ? DateTime.tryParse(json['timestamp']) ?? DateTime.now() : DateTime.now(),
    );
  }
}

