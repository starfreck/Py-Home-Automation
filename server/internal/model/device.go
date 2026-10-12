package model

import "time"

// User represents a registered tenant in the cloud system.
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	CreatedAt    time.Time `json:"created_at"`
}

// HubNode represents a registered Edge Raspberry Pi or hardware client connected via CLI.
type HubNode struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	Online    bool      `json:"online"`
	LastSeen  time.Time `json:"last_seen"`
	Pins      []int     `json:"pins"`
	IsMock    bool      `json:"is_mock"`
	Hostname  string    `json:"hostname"`
}

// DeviceType defines the classification of home devices.
type DeviceType string

const (
	TypeRelay   DeviceType = "relay"   // On/Off switches (lights, appliances)
	TypeDimmer  DeviceType = "dimmer"  // Dimmable lights (0-100%)
	TypeFan     DeviceType = "fan"     // Fans with speed control
	TypeLock    DeviceType = "lock"    // Smart locks
	TypeSensor  DeviceType = "sensor"  // Environmental sensors
)

// Device represents an individual smart home endpoint, scoped to a User and Hub.
type Device struct {
	ID          string     `json:"id"`
	UserID      string     `json:"user_id"`
	HubID       string     `json:"hub_id,omitempty"`
	Name        string     `json:"name"`
	Type        DeviceType `json:"type"`
	Room        string     `json:"room"`
	State       bool       `json:"state"`
	Value       int        `json:"value"` // Brightness %, Fan speed (0-100)
	GPIOPin     int        `json:"gpio_pin,omitempty"`
	PowerWatts  float64    `json:"power_watts"`
	Icon        string     `json:"icon"`
	LastUpdated time.Time  `json:"last_updated"`
}

// Telemetry holds aggregated real-time metrics for a user's edge hardware.
type Telemetry struct {
	UserID      string    `json:"user_id"`
	HubID       string    `json:"hub_id,omitempty"`
	Temperature float64   `json:"temperature"` // Celsius
	Humidity    float64   `json:"humidity"`    // Percentage
	TotalWatts  float64   `json:"total_watts"` // Current power draw
	CPUUsage    float64   `json:"cpu_usage"`   // Pi CPU %
	MemoryUsage float64   `json:"memory_usage"`// Pi RAM %
	CPUTemp     float64   `json:"cpu_temp"`    // Pi core temp °C
	ActiveCount int       `json:"active_count"`
	TotalCount  int       `json:"total_count"`
	Timestamp   time.Time `json:"timestamp"`
}

// Scene represents a one-touch automation preset.
type Scene struct {
	ID          string          `json:"id"`
	UserID      string          `json:"user_id"`
	Name        string          `json:"name"`
	Icon        string          `json:"icon"`
	Description string          `json:"description"`
	Actions     map[string]bool `json:"actions"` // DeviceID -> Desired state
}

// WSMessage is the envelope for all WebSocket messages.
type WSMessage struct {
	Type    string      `json:"type"`    // "init", "device_update", "telemetry", "execute_action", "action_result"
	Payload interface{} `json:"payload"`
}

// Settings holds configurable cloud, AI, and hardware parameters.
type Settings struct {
	HubName            string  `json:"hub_name"`
	AIProvider         string  `json:"ai_provider"` // "openai", "gemini", "anthropic", "custom", "local"
	AIAPIUrl           string  `json:"ai_api_url"`
	AIAPIKey           string  `json:"ai_api_key"`
	AIModel            string  `json:"ai_model"`
	CameraSource       string  `json:"camera_source"`
	BiometricThreshold float64 `json:"biometric_threshold"`
	TelemetryInterval  int     `json:"telemetry_interval"`
}

// ActivityItem represents an entry in the system activity and audit ledger.
type ActivityItem struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Timestamp time.Time `json:"timestamp"`
	Category  string    `json:"category"` // "hardware", "assistant", "security", "system"
	Message   string    `json:"message"`
	Source    string    `json:"source"`   // "web", "voice", "gpio", "camera", "edge-cli"
}

// CameraSnapshot represents a frame captured from edge surveillance feeds.
type CameraSnapshot struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Timestamp time.Time `json:"timestamp"`
	DataURL   string    `json:"data_url,omitempty"`
	Source    string    `json:"source"`
	Width     int       `json:"width"`
	Height    int       `json:"height"`
}

// BiometricScanResult represents facial recognition output from edge cameras.
type BiometricScanResult struct {
	Success    bool      `json:"success"`
	Subject    string    `json:"subject"`
	Confidence float64   `json:"confidence"`
	Threshold  float64   `json:"threshold"`
	Timestamp  time.Time `json:"timestamp"`
	CameraID   string    `json:"camera_id"`
}

// SystemStatus represents gateway uptime, runtime health, and metrics.
type SystemStatus struct {
	Status        string    `json:"status"`
	Version       string    `json:"version"`
	UptimeSeconds int64     `json:"uptime_seconds"`
	Gateway       string    `json:"gateway"`
	DevicesCount  int       `json:"devices_count"`
	ActiveRelays  int       `json:"active_relays"`
	EdgeConnected bool      `json:"edge_connected"`
	Timestamp     time.Time `json:"timestamp"`
}
