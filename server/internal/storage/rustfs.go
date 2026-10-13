package storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

var (
	ErrAccessDenied = errors.New("access denied: cannot access files belonging to another user")
	ErrNotFound     = errors.New("file not found in storage")
)

// StoredObjectInfo represents file metadata in RustFS.
type StoredObjectInfo struct {
	Path         string    `json:"path"`
	FileName     string    `json:"file_name"`
	Date         string    `json:"date"` // YYYY-MM-DD
	Size         int64     `json:"size"`
	ContentType  string    `json:"content_type"`
	LastModified time.Time `json:"last_modified"`
	URL          string    `json:"url"`
}

// Client manages multi-tenant object storage interactions backed by RustFS.
type Client struct {
	client     *minio.Client
	bucketName string
	isOnline   bool
	localDir   string
	mu         sync.RWMutex
}

// Config provides connection settings for RustFS.
type Config struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	UseSSL    bool
	LocalDir  string
}

// NewClient initializes a connection to RustFS with automatic bucket creation.
func NewClient(cfg Config) *Client {
	if cfg.Endpoint == "" {
		cfg.Endpoint = "127.0.0.1:9000"
	}
	if cfg.AccessKey == "" {
		cfg.AccessKey = "rustfsadmin"
	}
	if cfg.SecretKey == "" {
		cfg.SecretKey = "rustfsadminpassword"
	}
	if cfg.Bucket == "" {
		cfg.Bucket = "omnihome-storage"
	}
	if cfg.LocalDir == "" {
		home, _ := os.UserHomeDir()
		cfg.LocalDir = filepath.Join(home, ".omnihome", "rustfs_fallback")
	}

	sc := &Client{
		bucketName: cfg.Bucket,
		localDir:   cfg.LocalDir,
	}

	_ = os.MkdirAll(cfg.LocalDir, 0700)

	minioClient, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})

	if err != nil {
		log.Printf("[RustFS] Failed to initialize S3 client: %v. Operating in local fallback mode.", err)
		return sc
	}

	sc.client = minioClient

	// Test connectivity and create bucket if not existing
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	exists, err := minioClient.BucketExists(ctx, cfg.Bucket)
	if err != nil {
		log.Printf("[RustFS] Warning: Bucket check failed (%v). Operating with fallback support.", err)
	} else {
		sc.isOnline = true
		if !exists {
			if err := minioClient.MakeBucket(ctx, cfg.Bucket, minio.MakeBucketOptions{}); err != nil {
				log.Printf("[RustFS] Warning: Failed to create bucket %s: %v", cfg.Bucket, err)
			} else {
				log.Printf("[RustFS] Successfully created storage bucket: %s", cfg.Bucket)
			}
		} else {
			log.Printf("[RustFS] Connected to storage bucket: %s (Endpoint: %s)", cfg.Bucket, cfg.Endpoint)
		}
	}

	return sc
}

// IsOnline reports whether RustFS S3 service is responding.
func (c *Client) IsOnline() bool {
	return c.isOnline
}

// formatPartitionPath constructs partitioned path: users/<userID>/<category>/YYYY/MM/DD/<filename>
func formatPartitionPath(userID, category string, t time.Time, filename string) string {
	y := t.Format("2006")
	m := t.Format("01")
	d := t.Format("02")
	return fmt.Sprintf("users/%s/%s/%s/%s/%s/%s", userID, category, y, m, d, filename)
}

// UploadFaceSnapshot stores a camera detection image partitioned by date into RustFS.
func (c *Client) UploadFaceSnapshot(ctx context.Context, userID, snapshotID string, jpegBytes []byte, t time.Time) (string, error) {
	if t.IsZero() {
		t = time.Now()
	}
	filename := fmt.Sprintf("%s.jpg", snapshotID)
	objectPath := formatPartitionPath(userID, "faces", t, filename)

	err := c.putObject(ctx, objectPath, jpegBytes, "image/jpeg")
	if err != nil {
		return "", err
	}
	return objectPath, nil
}

// UploadProfilePhoto stores an enrolled face photo into RustFS.
func (c *Client) UploadProfilePhoto(ctx context.Context, userID, profileID string, jpegBytes []byte, t time.Time) (string, error) {
	if t.IsZero() {
		t = time.Now()
	}
	filename := fmt.Sprintf("%s.jpg", profileID)
	objectPath := formatPartitionPath(userID, "profiles", t, filename)

	err := c.putObject(ctx, objectPath, jpegBytes, "image/jpeg")
	if err != nil {
		return "", err
	}
	return objectPath, nil
}

// UploadArchivedActivities stores 24h-old activity ledgers partitioned by date into RustFS.
func (c *Client) UploadArchivedActivities(ctx context.Context, userID, dateStr string, jsonData []byte) (string, error) {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		t = time.Now()
	}
	objectPath := formatPartitionPath(userID, "activities", t, "activities.json")

	err = c.putObject(ctx, objectPath, jsonData, "application/json")
	if err != nil {
		return "", err
	}
	return objectPath, nil
}

// putObject handles uploading to RustFS with fallback to local filesystem.
func (c *Client) putObject(ctx context.Context, objectPath string, data []byte, contentType string) error {
	if c.isOnline && c.client != nil {
		reader := bytes.NewReader(data)
		_, err := c.client.PutObject(ctx, c.bucketName, objectPath, reader, int64(len(data)), minio.PutObjectOptions{
			ContentType: contentType,
		})
		if err == nil {
			return nil
		}
		log.Printf("[RustFS] S3 putObject error (%v), storing to local fallback.", err)
	}

	// Local fallback write
	targetFile := filepath.Join(c.localDir, objectPath)
	if err := os.MkdirAll(filepath.Dir(targetFile), 0700); err != nil {
		return err
	}
	return os.WriteFile(targetFile, data, 0600)
}

// GetUserObject streams an object ensuring strict multi-tenant authorization.
// It verifies that objectPath begins with "users/<userID>/".
func (c *Client) GetUserObject(ctx context.Context, userID, objectPath string) (io.ReadCloser, string, int64, error) {
	expectedPrefix := fmt.Sprintf("users/%s/", userID)
	if !strings.HasPrefix(objectPath, expectedPrefix) {
		return nil, "", 0, ErrAccessDenied
	}

	if c.isOnline && c.client != nil {
		obj, err := c.client.GetObject(ctx, c.bucketName, objectPath, minio.GetObjectOptions{})
		if err == nil {
			stat, errStat := obj.Stat()
			if errStat == nil {
				contentType := stat.ContentType
				if contentType == "" {
					contentType = "application/octet-stream"
				}
				return obj, contentType, stat.Size, nil
			}
			obj.Close()
		}
	}

	// Try local fallback
	localPath := filepath.Join(c.localDir, objectPath)
	info, err := os.Stat(localPath)
	if err != nil {
		return nil, "", 0, ErrNotFound
	}
	file, err := os.Open(localPath)
	if err != nil {
		return nil, "", 0, err
	}

	ct := "application/octet-stream"
	if strings.HasSuffix(objectPath, ".jpg") || strings.HasSuffix(objectPath, ".jpeg") {
		ct = "image/jpeg"
	} else if strings.HasSuffix(objectPath, ".json") {
		ct = "application/json"
	}

	return file, ct, info.Size(), nil
}

// ListUserObjectsByDate lists stored items for a specific date (YYYY-MM-DD) or all dates.
func (c *Client) ListUserObjectsByDate(ctx context.Context, userID, category, dateStr string) ([]StoredObjectInfo, error) {
	prefix := fmt.Sprintf("users/%s/%s/", userID, category)
	if dateStr != "" {
		parts := strings.Split(dateStr, "-")
		if len(parts) == 3 {
			prefix = fmt.Sprintf("users/%s/%s/%s/%s/%s/", userID, category, parts[0], parts[1], parts[2])
		}
	}

	var results []StoredObjectInfo

	if c.isOnline && c.client != nil {
		objectCh := c.client.ListObjects(ctx, c.bucketName, minio.ListObjectsOptions{
			Prefix:    prefix,
			Recursive: true,
		})

		for obj := range objectCh {
			if obj.Err != nil {
				continue
			}
			parts := strings.Split(obj.Key, "/")
			if len(parts) < 7 {
				continue
			}
			dateVal := fmt.Sprintf("%s-%s-%s", parts[3], parts[4], parts[5])
			fileName := parts[len(parts)-1]

			results = append(results, StoredObjectInfo{
				Path:         obj.Key,
				FileName:     fileName,
				Date:         dateVal,
				Size:         obj.Size,
				ContentType:  obj.ContentType,
				LastModified: obj.LastModified,
				URL:          fmt.Sprintf("/api/storage/file?path=%s", obj.Key),
			})
		}
	}

	// Also scan local fallback directory for any additional items
	localBase := filepath.Join(c.localDir, prefix)
	if _, err := os.Stat(localBase); err == nil {
		_ = filepath.Walk(localBase, func(p string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return nil
			}
			rel, _ := filepath.Rel(c.localDir, p)
			parts := strings.Split(rel, string(filepath.Separator))
			if len(parts) < 7 {
				return nil
			}
			dateVal := fmt.Sprintf("%s-%s-%s", parts[3], parts[4], parts[5])

			// Check duplicate
			found := false
			for _, r := range results {
				if r.Path == rel {
					found = true
					break
				}
			}
			if !found {
				results = append(results, StoredObjectInfo{
					Path:         rel,
					FileName:     parts[len(parts)-1],
					Date:         dateVal,
					Size:         info.Size(),
					ContentType:  "image/jpeg",
					LastModified: info.ModTime(),
					URL:          fmt.Sprintf("/api/storage/file?path=%s", rel),
				})
			}
			return nil
		})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].LastModified.After(results[j].LastModified)
	})

	return results, nil
}

// ListAvailableDates returns unique dates (YYYY-MM-DD) that have stored objects.
func (c *Client) ListAvailableDates(ctx context.Context, userID, category string) ([]string, error) {
	objs, err := c.ListUserObjectsByDate(ctx, userID, category, "")
	if err != nil {
		return nil, err
	}

	dateSet := make(map[string]bool)
	for _, obj := range objs {
		if obj.Date != "" {
			dateSet[obj.Date] = true
		}
	}

	dates := make([]string, 0, len(dateSet))
	for d := range dateSet {
		dates = append(dates, d)
	}

	sort.Sort(sort.Reverse(sort.StringSlice(dates)))
	return dates, nil
}

// GetArchivedActivities retrieves archived activity JSON for a given date.
func (c *Client) GetArchivedActivities(ctx context.Context, userID, dateStr string) ([]byte, error) {
	parts := strings.Split(dateStr, "-")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid date format: expected YYYY-MM-DD")
	}

	objectPath := fmt.Sprintf("users/%s/activities/%s/%s/%s/activities.json", userID, parts[0], parts[1], parts[2])
	rc, _, _, err := c.GetUserObject(ctx, userID, objectPath)
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	return io.ReadAll(rc)
}
