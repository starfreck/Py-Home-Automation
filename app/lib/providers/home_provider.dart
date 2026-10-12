import 'package:flutter/foundation.dart';
import '../models/device.dart';
import '../services/gateway_service.dart';

class HomeProvider extends ChangeNotifier {
  late GatewayService _gateway;
  
  List<Device> _devices = [];
  Telemetry _telemetry = Telemetry.initial();
  List<AutomationScene> _scenes = [];
  List<ActivityItem> _activities = [];
  List<CameraSnapshot> _snapshots = [];
  GatewayStatus? _status;
  
  bool _isConnected = false;
  int _latencyMs = 18;
  String _currentFilter = 'All';
  String _searchQuery = '';
  
  String _lastVoiceTranscript = 'System diagnostic status';
  String _lastAssistantReply = 'All systems nominal • 4 relays active • Energy draw 181 Watts';
  bool _isAiThinking = false;
  bool _isEdgeOnline = false;

  HomeProvider({
    String initialUrl = 'http://localhost:8080',
    String? token = 'dev-token-default',
    AuthUser? user,
    bool autoConnect = true,
  }) {
    final effectiveUser = user ??
        (token != null
            ? AuthUser(
                id: 'usr-admin',
                email: 'admin@omnihome.cloud',
                name: 'Home Admin',
                token: token,
              )
            : null);

    _gateway = GatewayService(
      baseUrl: initialUrl,
      authToken: token,
      currentUser: effectiveUser,
      onInit: _handleInit,
      onDeviceUpdate: _handleDeviceUpdate,
      onDeviceAdded: _handleDeviceAdded,
      onDeviceDeleted: _handleDeviceDeleted,
      onTelemetry: _handleTelemetry,
      onActivityEvent: _handleActivityEvent,
      onSceneActivated: _handleSceneActivated,
      onCameraScan: _handleCameraScan,
      onCameraSnapshot: _handleCameraSnapshot,
      onConnectionChange: (connected) {
        _isConnected = connected;
        notifyListeners();
      },
      onEdgeStatus: (online) {
        _isEdgeOnline = online;
        notifyListeners();
      },
    );
    _initDefaultScenes();
    if (autoConnect) {
      _gateway.connectWebSocket();
      pingStatus();
    }
  }

  // GETTERS
  bool get isEdgeOnline => _isEdgeOnline;
  bool get isAuthenticated => _gateway.isAuthenticated;
  AuthUser? get currentUser => _gateway.currentUser;
  List<Device> get devices => _devices;
  Telemetry get telemetry => _telemetry;
  List<AutomationScene> get scenes => _scenes;
  List<ActivityItem> get activities => _activities;
  List<CameraSnapshot> get snapshots => _snapshots;
  GatewayStatus? get status => _status;
  bool get isConnected => _isConnected;
  int get latencyMs => _latencyMs;
  String get currentFilter => _currentFilter;
  String get searchQuery => _searchQuery;
  String get lastVoiceTranscript => _lastVoiceTranscript;
  String get lastAssistantReply => _lastAssistantReply;
  bool get isAiThinking => _isAiThinking;
  String get baseUrl => _gateway.baseUrl;

  List<Device> get filteredDevices {
    var list = _currentFilter == 'All'
        ? _devices
        : _devices.where((d) => d.room.toLowerCase() == _currentFilter.toLowerCase()).toList();

    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.toLowerCase().trim();
      list = list.where((d) {
        return d.name.toLowerCase().contains(q) ||
            d.room.toLowerCase().contains(q) ||
            d.type.name.toLowerCase().contains(q);
      }).toList();
    }
    return list;
  }

  void setFilter(String room) {
    _currentFilter = room;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  void updateGatewayUrl(String url) {
    _gateway.updateBaseUrl(url);
    notifyListeners();
    pingStatus();
  }

  Future<void> pingStatus() async {
    final sw = Stopwatch()..start();
    final st = await _gateway.fetchStatus();
    sw.stop();
    if (st != null) {
      _status = st;
      _isEdgeOnline = st.edgeConnected;
      _latencyMs = sw.elapsedMilliseconds;
      notifyListeners();
    }
  }

  Future<void> login(String email, String password) async {
    await _gateway.login(email, password);
    await pingStatus();
    notifyListeners();
  }

  Future<void> register(String name, String email, String password) async {
    await _gateway.register(name, email, password);
    await pingStatus();
    notifyListeners();
  }

  void logout() {
    _gateway.logout();
    _devices.clear();
    _isEdgeOnline = false;
    notifyListeners();
  }

  // ACTIONS
  void toggleDevice(String id) {
    _gateway.toggleDevice(id);
    // Optimistic UI update
    final idx = _devices.indexWhere((d) => d.id == id);
    if (idx != -1) {
      final curr = _devices[idx];
      _devices[idx] = curr.copyWith(state: !curr.state);
      notifyListeners();
    }
  }

  void setSliderValue(String id, int val) {
    final idx = _devices.indexWhere((d) => d.id == id);
    if (idx != -1) {
      final curr = _devices[idx];
      _devices[idx] = curr.copyWith(value: val, state: true);
      notifyListeners();
      _gateway.setDeviceState(id, true, val);
    }
  }

  void addDevice(Device dev) {
    if (!_devices.any((d) => d.id == dev.id)) {
      _devices.add(dev);
      notifyListeners();
      _gateway.saveDevice(dev);
    }
  }

  void deleteDevice(String id) {
    _devices.removeWhere((d) => d.id == id);
    notifyListeners();
    _gateway.deleteDevice(id);
  }

  void activateScene(String sceneId) {
    _gateway.activateScene(sceneId);
  }

  Future<void> submitVoiceCommand(String prompt) async {
    if (prompt.trim().isEmpty) return;
    _isAiThinking = true;
    _lastVoiceTranscript = prompt;
    _lastAssistantReply = 'Analyzing directive with Gemma 4 edge model...';
    notifyListeners();

    try {
      final res = await _gateway.submitVoicePrompt(prompt);
      _lastAssistantReply = res['speech_reply'] ?? 'Directive executed successfully.';
    } catch (e) {
      _lastAssistantReply = 'Gateway connection timeout. Local directive buffered.';
    } finally {
      _isAiThinking = false;
      notifyListeners();
    }
  }

  Future<void> triggerBiometricScan() async {
    try {
      await _gateway.scanCameraFace();
    } catch (_) {}
  }

  Future<void> captureSnapshot() async {
    try {
      await _gateway.saveSnapshot('', 'Front CSI Camera (Mobile)');
    } catch (_) {}
  }

  Future<void> clearActivityLedger() async {
    await _gateway.clearActivities();
    _activities.clear();
    notifyListeners();
  }

  // WEBSOCKET HANDLERS
  void _handleInit(Map<String, dynamic> data) {
    if (data['devices'] is List) {
      _devices = (data['devices'] as List).map((e) => Device.fromJson(e)).toList();
    }
    if (data['telemetry'] is Map<String, dynamic>) {
      _telemetry = Telemetry.fromJson(data['telemetry']);
    }
    if (data['scenes'] is List) {
      _scenes = (data['scenes'] as List).map((e) => AutomationScene.fromJson(e)).toList();
    }
    if (data['activities'] is List) {
      _activities = (data['activities'] as List).map((e) => ActivityItem.fromJson(e)).toList();
    }
    if (data['snapshots'] is List) {
      _snapshots = (data['snapshots'] as List).map((e) => CameraSnapshot.fromJson(e)).toList();
    }
    if (data['status'] is Map<String, dynamic>) {
      _status = GatewayStatus.fromJson(data['status']);
    }
    notifyListeners();
  }

  void _handleDeviceUpdate(Device dev) {
    final idx = _devices.indexWhere((d) => d.id == dev.id);
    if (idx != -1) {
      _devices[idx] = dev;
    } else {
      _devices.add(dev);
    }
    notifyListeners();
  }

  void _handleDeviceAdded(Device dev) {
    if (!_devices.any((d) => d.id == dev.id)) {
      _devices.add(dev);
      notifyListeners();
    }
  }

  void _handleDeviceDeleted(String id) {
    _devices.removeWhere((d) => d.id == id);
    notifyListeners();
  }

  void _handleTelemetry(Telemetry t) {
    _telemetry = t;
    notifyListeners();
  }

  void _handleActivityEvent(ActivityItem item) {
    _activities.insert(0, item);
    if (_activities.length > 80) _activities.removeLast();
    notifyListeners();
  }

  void _handleSceneActivated(String sceneId) {
    notifyListeners();
  }

  void _handleCameraScan(Map<String, dynamic> scan) {
    notifyListeners();
  }

  void _handleCameraSnapshot(CameraSnapshot snap) {
    _snapshots.insert(0, snap);
    notifyListeners();
  }

  void _initDefaultScenes() {
    if (_scenes.isEmpty) {
      _scenes = [
        AutomationScene(
          id: 'movie_night',
          name: 'Cinema',
          icon: '🎬',
          description: 'Living room dims, theater active',
          actions: {'device-1': false, 'device-3': true, 'device-5': true},
        ),
        AutomationScene(
          id: 'secure_perimeter',
          name: 'Secure',
          icon: '🛡️',
          description: 'Lock front door deadbolt & vision armed',
          actions: {'device-6': true},
        ),
        AutomationScene(
          id: 'all_on',
          name: 'All On',
          icon: '☀️',
          description: 'All relays and illumination active',
          actions: {},
        ),
        AutomationScene(
          id: 'all_off',
          name: 'All Off',
          icon: '🌙',
          description: 'Eco standby mode for all rooms',
          actions: {},
        ),
      ];
    }
  }

  @override
  void dispose() {
    _gateway.disconnect();
    super.dispose();
  }
}
