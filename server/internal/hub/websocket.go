package hub

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/starfreck/omnihome-server/internal/model"
)

var (
	ErrEdgeOffline = errors.New("edge hardware device is currently offline")

	upgrader = websocket.Upgrader{
		ReadBufferSize:  2048,
		WriteBufferSize: 2048,
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all verified clients (JWT authenticated)
		},
	}
)

// Client represents a connected browser or mobile app session for a specific tenant.
type Client struct {
	hub    *Hub
	userID string
	conn   *websocket.Conn
	send   chan []byte
}

// EdgeClient represents an active WebSocket tunnel from an edge device CLI.
type EdgeClient struct {
	hub      *Hub
	userID   string
	hubID    string
	hostname string
	conn     *websocket.Conn
	send     chan []byte
}

// Hub manages multi-tenant client sessions and hardware edge tunnels.
type Hub struct {
	// UserID -> map of active client sessions
	clients map[string]map[*Client]bool

	// UserID -> active edge client
	edgeClients map[string]*EdgeClient

	mu        sync.RWMutex
	onMessage func(userID string, msg model.WSMessage)
	onEdgeMsg func(userID, hubID string, msg model.WSMessage)
	onEdgeDis func(userID, hubID string)
}

// NewHub initializes a multi-tenant event hub.
func NewHub(
	onMessage func(userID string, msg model.WSMessage),
	onEdgeMsg func(userID, hubID string, msg model.WSMessage),
	onEdgeDis func(userID, hubID string),
) *Hub {
	return &Hub{
		clients:     make(map[string]map[*Client]bool),
		edgeClients: make(map[string]*EdgeClient),
		onMessage:   onMessage,
		onEdgeMsg:   onEdgeMsg,
		onEdgeDis:   onEdgeDis,
	}
}

// BroadcastToUser serializes and pushes a payload strictly to that user's active client sessions.
func (h *Hub) BroadcastToUser(userID string, msgType string, payload interface{}) {
	envelope := model.WSMessage{
		Type:    msgType,
		Payload: payload,
	}
	bytes, err := json.Marshal(envelope)
	if err != nil {
		log.Printf("[WebSocket] Marshal error: %v", err)
		return
	}

	h.mu.RLock()
	userClients, ok := h.clients[userID]
	if !ok || len(userClients) == 0 {
		h.mu.RUnlock()
		return
	}

	for client := range userClients {
		select {
		case client.send <- bytes:
		default:
			close(client.send)
			delete(userClients, client)
		}
	}
	h.mu.RUnlock()
}

// SendCommandToEdge forwards a command directly to the user's connected edge device CLI.
func (h *Hub) SendCommandToEdge(userID string, msgType string, payload interface{}) error {
	envelope := model.WSMessage{
		Type:    msgType,
		Payload: payload,
	}
	bytes, err := json.Marshal(envelope)
	if err != nil {
		return err
	}

	h.mu.RLock()
	edge, ok := h.edgeClients[userID]
	h.mu.RUnlock()

	if !ok || edge == nil {
		return ErrEdgeOffline
	}

	select {
	case edge.send <- bytes:
		return nil
	case <-time.After(3 * time.Second):
		return fmt.Errorf("timeout delivering action to edge device")
	}
}

// IsEdgeOnline checks if a user's edge device is actively connected.
func (h *Hub) IsEdgeOnline(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.edgeClients[userID]
	return ok
}

// HandleClientWebSocket upgrades browser or mobile app connections for an authenticated user.
func (h *Hub) HandleClientWebSocket(w http.ResponseWriter, r *http.Request, userID string, initialData interface{}) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WebSocket] Client upgrade error: %v", err)
		return
	}

	client := &Client{
		hub:    h,
		userID: userID,
		conn:   conn,
		send:   make(chan []byte, 256),
	}

	h.mu.Lock()
	if _, exists := h.clients[userID]; !exists {
		h.clients[userID] = make(map[*Client]bool)
	}
	h.clients[userID][client] = true
	h.mu.Unlock()

	log.Printf("[WebSocket] App/Web client connected for user: %s", userID)

	// Send initial state snapshot immediately upon connection
	if initialData != nil {
		initEnvelope := model.WSMessage{
			Type:    "init",
			Payload: initialData,
		}
		if bytes, err := json.Marshal(initEnvelope); err == nil {
			client.send <- bytes
		}
	}

	go client.writePump()
	go client.readPump()
}

// HandleEdgeWebSocket establishes the authenticated reverse tunnel from the edge device CLI.
func (h *Hub) HandleEdgeWebSocket(w http.ResponseWriter, r *http.Request, userID string, hubID string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WebSocket] Edge upgrade error: %v", err)
		return
	}

	edge := &EdgeClient{
		hub:    h,
		userID: userID,
		hubID:  hubID,
		conn:   conn,
		send:   make(chan []byte, 256),
	}

	h.mu.Lock()
	// Replace previous edge connection if any
	if prev, exists := h.edgeClients[userID]; exists && prev != nil {
		prev.conn.Close()
	}
	h.edgeClients[userID] = edge
	h.mu.Unlock()

	log.Printf("[WebSocket] Edge Device CLI connected for user: %s (Hub: %s)", userID, hubID)

	// Notify user's clients that their edge hardware is now online
	h.BroadcastToUser(userID, "edge_status", map[string]interface{}{
		"online": true,
		"hub_id": hubID,
	})

	go edge.writePump()
	go edge.readPump()
}

// Client Pumps
func (c *Client) readPump() {
	defer func() {
		c.hub.mu.Lock()
		if userClients, ok := c.hub.clients[c.userID]; ok {
			delete(userClients, c)
			if len(userClients) == 0 {
				delete(c.hub.clients, c.userID)
			}
		}
		c.hub.mu.Unlock()
		close(c.send)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(8192)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		var msg model.WSMessage
		if err := json.Unmarshal(message, &msg); err == nil {
			if c.hub.onMessage != nil {
				c.hub.onMessage(c.userID, msg)
			}
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(25 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Drain queued messages into the same frame
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// Edge Client Pumps
func (e *EdgeClient) readPump() {
	defer func() {
		e.hub.mu.Lock()
		if curr, ok := e.hub.edgeClients[e.userID]; ok && curr == e {
			delete(e.hub.edgeClients, e.userID)
		}
		e.hub.mu.Unlock()
		close(e.send)
		e.conn.Close()
		log.Printf("[WebSocket] Edge Device CLI disconnected for user: %s", e.userID)

		if e.hub.onEdgeDis != nil {
			e.hub.onEdgeDis(e.userID, e.hubID)
		}
		e.hub.BroadcastToUser(e.userID, "edge_status", map[string]interface{}{
			"online": false,
			"hub_id": e.hubID,
		})
	}()

	e.conn.SetReadLimit(65536) // Allow telemetry and camera frames
	e.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	e.conn.SetPongHandler(func(string) error {
		e.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := e.conn.ReadMessage()
		if err != nil {
			break
		}

		var msg model.WSMessage
		if err := json.Unmarshal(message, &msg); err == nil {
			if e.hub.onEdgeMsg != nil {
				e.hub.onEdgeMsg(e.userID, e.hubID, msg)
			}
		}
	}
}

func (e *EdgeClient) writePump() {
	ticker := time.NewTicker(20 * time.Second)
	defer func() {
		ticker.Stop()
		e.conn.Close()
	}()

	for {
		select {
		case message, ok := <-e.send:
			e.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				e.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			w, err := e.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)
			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			e.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := e.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
