// Package client talks to the TokenWatch server: it trades a pairing code for
// a device token, and uploads batches of sanitized events. Stdlib net/http
// only — nothing here justifies a dependency.
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jclement/tokenwatch/agent/internal/parser"
)

// Client is a thin wrapper over the server's base URL and the device token.
type Client struct {
	BaseURL      string
	DeviceToken  string
	AgentVersion string
	HTTP         *http.Client
}

// New builds a Client. baseURL trailing slashes are trimmed so path joins are clean.
func New(baseURL, deviceToken, agentVersion string) *Client {
	return &Client{
		BaseURL:      strings.TrimRight(baseURL, "/"),
		DeviceToken:  deviceToken,
		AgentVersion: agentVersion,
		HTTP:         &http.Client{Timeout: 30 * time.Second},
	}
}

// ---- pairing ----------------------------------------------------------------

type pairRequest struct {
	Code         string `json:"code"`
	Name         string `json:"name"`
	Platform     string `json:"platform"`
	Arch         string `json:"arch"`
	AgentVersion string `json:"agentVersion"`
}

type pairResponse struct {
	DeviceToken string `json:"deviceToken"`
}

// Pair exchanges a one-time pairing code for a durable device token. name is
// usually the machine's hostname; platform/arch are runtime.GOOS/GOARCH.
func (c *Client) Pair(ctx context.Context, code, name, platform, arch string) (string, error) {
	body, err := json.Marshal(pairRequest{
		Code: code, Name: name, Platform: platform, Arch: arch, AgentVersion: c.AgentVersion,
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/api/pair/claim", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("pairing failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(data)))
	}
	var pr pairResponse
	if err := json.Unmarshal(data, &pr); err != nil {
		return "", fmt.Errorf("bad pairing response: %w", err)
	}
	if pr.DeviceToken == "" {
		return "", fmt.Errorf("server returned an empty device token")
	}
	return pr.DeviceToken, nil
}

// ---- ingest -----------------------------------------------------------------

// IngestRequest mirrors the TS wire contract.
type IngestRequest struct {
	AgentVersion string               `json:"agentVersion"`
	Events       []parser.IngestEvent `json:"events"`
}

// IngestResponse is what the server reports back.
type IngestResponse struct {
	Received int `json:"received"`
	Inserted int `json:"inserted"`
}

// IngestBatch is the max events per request. The server dedups, so the batch
// size is purely about keeping each POST body reasonable.
const IngestBatch = 500

// Ingest uploads every event in batches, returning the cumulative totals. A
// failed batch aborts the upload and surfaces the error (the caller can retry
// safely — dedup makes re-sends harmless).
func (c *Client) Ingest(ctx context.Context, events []parser.IngestEvent) (IngestResponse, error) {
	var total IngestResponse
	for start := 0; start < len(events); start += IngestBatch {
		end := start + IngestBatch
		if end > len(events) {
			end = len(events)
		}
		r, err := c.ingestOne(ctx, events[start:end])
		if err != nil {
			return total, err
		}
		total.Received += r.Received
		total.Inserted += r.Inserted
	}
	return total, nil
}

func (c *Client) ingestOne(ctx context.Context, batch []parser.IngestEvent) (IngestResponse, error) {
	body, err := json.Marshal(IngestRequest{AgentVersion: c.AgentVersion, Events: batch})
	if err != nil {
		return IngestResponse{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/api/ingest", bytes.NewReader(body))
	if err != nil {
		return IngestResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.DeviceToken)

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return IngestResponse{}, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return IngestResponse{}, fmt.Errorf("ingest failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(data)))
	}
	var ir IngestResponse
	if err := json.Unmarshal(data, &ir); err != nil {
		return IngestResponse{}, fmt.Errorf("bad ingest response: %w", err)
	}
	return ir, nil
}
