import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/device.dart';

class GatewayService {
  String baseUrl;
  String? authToken;
  AuthUser? currentUser;
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  bool _isConnected = false;
  Timer? _reconnectTimer;

  final void Function(Map<String, dynamic>)? onInit;
  final void Function(Device)? onDeviceUpdate;
  final void Function(Device)? onDeviceAdded;
  final void Function(String)? onDeviceDeleted;
  final void Function(Telemetry)? onTelemetry;
  final void Function(ActivityItem)? onActivityEvent;
  final void Function(String)? onSceneActivated;
  final void Function(Map<String, dynamic>)? onCameraScan;
  final void Function(CameraSnapshot)? onCameraSnapshot;
  final void Function(bool)? onConnectionChange;
  final void Function(bool)? onEdgeStatus;

  GatewayService({
    this.baseUrl = 'http://localhost:8080',
    this.authToken,
    this.currentUser,
    this.onInit,
    this.onDeviceUpdate,
    this.onDeviceAdded,
    this.onDeviceDeleted,
    this.onTelemetry,
    this.onActivityEvent,
    this.onSceneActivated,
    this.onCameraScan,
    this.onCameraSnapshot,
    this.onConnectionChange,
    this.onEdgeStatus,
  });

  bool get isConnected => _isConnected;
  bool get isAuthenticated => authToken != null && authToken!.isNotEmpty;

  Map<String, String> get authHeaders {
    final headers = {'Content-Type': 'application/json'};
    if (authToken != null && authToken!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $authToken';
    }
    return headers;
  }

  String get wsUrl {
    final uri = Uri.parse(baseUrl);
    final wsScheme = uri.scheme == 'https' ? 'wss' : 'ws';
    final tokenParam = (authToken != null && authToken!.isNotEmpty)
        ? '?token=${Uri.encodeComponent(authToken!)}'
        : '';
    final portPart = uri.hasPort ? ':${uri.port}' : '';
    return '$wsScheme://${uri.host}$portPart/ws$tokenParam';
  }

  void updateBaseUrl(String newUrl) {
    if (newUrl.endsWith('/')) {
      newUrl = newUrl.substring(0, newUrl.length - 1);
    }
    baseUrl = newUrl;
    disconnect();
    if (isAuthenticated) {
      connectWebSocket();
    }
  }

  // AUTHENTICATION

  Future<AuthUser> login(String email, String password) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'email': email, 'password': password}),
    );

    if (res.statusCode == 200) {
      final data = json.decode(res.body) as Map<String, dynamic>;
      final token = data['token'] as String;
      final user = AuthUser.fromJson(data, token: token);
      authToken = token;
      currentUser = user;
      disconnect();
      connectWebSocket();
      return user;
    } else {
      final err = json.decode(res.body);
      throw Exception(err['error'] ?? 'Authentication failed');
    }
  }

  Future<AuthUser> register(String name, String email, String password) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'name': name, 'email': email, 'password': password}),
    );

    if (res.statusCode == 201 || res.statusCode == 200) {
      final data = json.decode(res.body) as Map<String, dynamic>;
      final token = data['token'] as String;
      final user = AuthUser.fromJson(data, token: token);
      authToken = token;
      currentUser = user;
      disconnect();
      connectWebSocket();
      return user;
    } else {
      final err = json.decode(res.body);
      throw Exception(err['error'] ?? 'Registration failed');
    }
  }

  void logout() {
    authToken = null;
    currentUser = null;
    disconnect();
  }

  void connectWebSocket() {
    _reconnectTimer?.cancel();
    try {
      final uri = Uri.parse(wsUrl);
      _channel = WebSocketChannel.connect(uri);
      _isConnected = true;
      onConnectionChange?.call(true);

      _subscription = _channel!.stream.listen(
        (data) {
          try {
            final decoded = json.decode(data);
            if (decoded is Map<String, dynamic>) {
              _handleMessage(decoded);
            }
          } catch (_) {
            // parse error
          }
        },
        onError: (err) {
          _handleDisconnect();
        },
        onDone: () {
          _handleDisconnect();
        },
      );
    } catch (_) {
      _handleDisconnect();
    }
  }

  void _handleDisconnect() {
    _isConnected = false;
    onConnectionChange?.call(false);
    _subscription?.cancel();
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), () {
      if (isAuthenticated) {
        connectWebSocket();
      }
    });
  }

  void disconnect() {
    _reconnectTimer?.cancel();
    _subscription?.cancel();
    _channel?.sink.close();
    _isConnected = false;
    onConnectionChange?.call(false);
  }

  void _handleMessage(Map<String, dynamic> msg) {
    final type = msg['type'] as String?;
    final payload = msg['payload'];

    switch (type) {
      case 'init':
        if (payload is Map<String, dynamic>) {
          onInit?.call(payload);
          if (payload['status'] is Map<String, dynamic>) {
            final st = payload['status'] as Map<String, dynamic>;
            if (st['edge_connected'] != null) {
              onEdgeStatus?.call(st['edge_connected'] == true);
            }
          }
        }
        break;
      case 'edge_status':
        if (payload is Map<String, dynamic>) {
          onEdgeStatus?.call(payload['online'] == true);
        }
        break;
      case 'device_update':
        if (payload is Map<String, dynamic>) {
          onDeviceUpdate?.call(Device.fromJson(payload));
        }
        break;
      case 'device_added':
        if (payload is Map<String, dynamic>) {
          onDeviceAdded?.call(Device.fromJson(payload));
        }
        break;
      case 'device_deleted':
        if (payload is Map<String, dynamic> && payload['id'] != null) {
          onDeviceDeleted?.call(payload['id'].toString());
        }
        break;
      case 'telemetry':
        if (payload is Map<String, dynamic>) {
          onTelemetry?.call(Telemetry.fromJson(payload));
        }
        break;
      case 'activity_event':
        if (payload is Map<String, dynamic>) {
          onActivityEvent?.call(ActivityItem.fromJson(payload));
        }
        break;
      case 'scene_activated':
        if (payload is Map<String, dynamic> && payload['id'] != null) {
          onSceneActivated?.call(payload['id'].toString());
        }
        break;
      case 'camera_scan':
        if (payload is Map<String, dynamic>) {
          onCameraScan?.call(payload);
        }
        break;
      case 'camera_snapshot':
        if (payload is Map<String, dynamic>) {
          onCameraSnapshot?.call(CameraSnapshot.fromJson(payload));
        }
        break;
    }
  }

  // OUTBOUND ACTIONS

  void toggleDevice(String id) {
    if (_isConnected && _channel != null) {
      _channel!.sink.add(json.encode({
        'type': 'toggle',
        'payload': {'id': id}
      }));
    } else {
      http.post(
        Uri.parse('$baseUrl/api/devices/$id/toggle'),
        headers: authHeaders,
      );
    }
  }

  void setDeviceState(String id, bool state, int value) {
    if (_isConnected && _channel != null) {
      _channel!.sink.add(json.encode({
        'type': 'set_state',
        'payload': {'id': id, 'state': state, 'value': value}
      }));
    } else {
      http.post(
        Uri.parse('$baseUrl/api/devices/$id/state'),
        headers: authHeaders,
        body: json.encode({'state': state, 'value': value}),
      );
    }
  }

  void saveDevice(Device dev) {
    if (_isConnected && _channel != null) {
      _channel!.sink.add(json.encode({
        'type': 'save_device',
        'payload': dev.toJson(),
      }));
    } else {
      http.post(
        Uri.parse('$baseUrl/api/devices'),
        headers: authHeaders,
        body: json.encode(dev.toJson()),
      );
    }
  }

  void deleteDevice(String id) {
    if (_isConnected && _channel != null) {
      _channel!.sink.add(json.encode({
        'type': 'delete_device',
        'payload': {'id': id},
      }));
    } else {
      http.delete(
        Uri.parse('$baseUrl/api/devices/$id'),
        headers: authHeaders,
      );
    }
  }

  void activateScene(String sceneId) {
    if (_isConnected && _channel != null) {
      _channel!.sink.add(json.encode({
        'type': 'scene',
        'payload': {'id': sceneId}
      }));
    } else {
      http.post(
        Uri.parse('$baseUrl/api/scenes/$sceneId/activate'),
        headers: authHeaders,
      );
    }
  }

  Future<Map<String, dynamic>> submitVoicePrompt(String prompt) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/voice'),
      headers: authHeaders,
      body: json.encode({'prompt': prompt}),
    );
    if (res.statusCode == 200) {
      return json.decode(res.body);
    }
    throw Exception('Voice server error: ${res.statusCode}');
  }

  Future<Map<String, dynamic>> scanCameraFace() async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/camera/scan'),
      headers: authHeaders,
    );
    if (res.statusCode == 200) {
      return json.decode(res.body);
    }
    throw Exception('Camera scan failed: ${res.statusCode}');
  }

  Future<CameraSnapshot> saveSnapshot(String dataUrl, String source) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/camera/snapshot'),
      headers: authHeaders,
      body: json.encode({'data_url': dataUrl, 'source': source}),
    );
    if (res.statusCode == 200) {
      return CameraSnapshot.fromJson(json.decode(res.body));
    }
    throw Exception('Save snapshot failed: ${res.statusCode}');
  }

  Future<List<Device>> fetchDevices() async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/devices'),
      headers: authHeaders,
    );
    if (res.statusCode == 200) {
      final list = json.decode(res.body) as List;
      return list.map((e) => Device.fromJson(e)).toList();
    }
    return [];
  }

  Future<GatewayStatus?> fetchStatus() async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/api/status'),
        headers: authHeaders,
      );
      if (res.statusCode == 200) {
        return GatewayStatus.fromJson(json.decode(res.body));
      }
    } catch (_) {}
    return null;
  }

  Future<void> clearActivities() async {
    if (_isConnected && _channel != null) {
      _channel!.sink.add(json.encode({'type': 'clear_activity'}));
    } else {
      await http.delete(
        Uri.parse('$baseUrl/api/activities'),
        headers: authHeaders,
      );
    }
  }
}
