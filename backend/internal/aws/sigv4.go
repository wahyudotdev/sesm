package aws

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"
)

// Credentials holds AWS credentials for SigV4 signing.
type Credentials struct {
	AccessKeyID     string
	SecretAccessKey string
	Region          string
	Service         string
}

// Sign adds AWS Signature Version 4 authentication to req.
// body must be the raw request body bytes (may be nil/empty).
func Sign(req *http.Request, body []byte, creds Credentials) error {
	now := time.Now().UTC()
	datetime := now.Format("20060102T150405Z")
	date := datetime[:8]

	// Set required headers before signing.
	req.Header.Set("X-Amz-Date", datetime)

	// Collect headers to sign: host + x-amz-date + any x-amz-* headers.
	host := req.Host
	if host == "" {
		host = req.URL.Host
	}

	// Build canonical headers (sorted).
	type kv struct{ k, v string }
	var headersToSign []kv
	headersToSign = append(headersToSign, kv{"host", host})
	headersToSign = append(headersToSign, kv{"x-amz-date", datetime})

	// Include additional x-amz-* headers.
	for name, vals := range req.Header {
		lower := strings.ToLower(name)
		if lower == "x-amz-date" || lower == "host" {
			continue
		}
		if strings.HasPrefix(lower, "x-amz-") {
			headersToSign = append(headersToSign, kv{lower, strings.Join(vals, ",")})
		}
	}

	sort.Slice(headersToSign, func(i, j int) bool {
		return headersToSign[i].k < headersToSign[j].k
	})

	var canonicalHeaderLines strings.Builder
	var signedHeaderNames []string
	for _, h := range headersToSign {
		canonicalHeaderLines.WriteString(h.k)
		canonicalHeaderLines.WriteByte(':')
		canonicalHeaderLines.WriteString(strings.TrimSpace(h.v))
		canonicalHeaderLines.WriteByte('\n')
		signedHeaderNames = append(signedHeaderNames, h.k)
	}
	signedHeaders := strings.Join(signedHeaderNames, ";")

	// Body hash.
	if body == nil {
		body = []byte{}
	}
	bodyHash := hashSHA256(body)

	// Canonical query string (sorted by key).
	queryParts := make([]string, 0)
	for k, vs := range req.URL.Query() {
		for _, v := range vs {
			queryParts = append(queryParts, uriEncode(k)+"="+uriEncode(v))
		}
	}
	sort.Strings(queryParts)
	canonicalQuery := strings.Join(queryParts, "&")

	// Canonical request.
	canonicalPath := req.URL.EscapedPath()
	if canonicalPath == "" {
		canonicalPath = "/"
	}

	canonicalRequest := strings.Join([]string{
		req.Method,
		canonicalPath,
		canonicalQuery,
		canonicalHeaderLines.String(),
		signedHeaders,
		bodyHash,
	}, "\n")

	// Credential scope.
	credentialScope := fmt.Sprintf("%s/%s/%s/aws4_request", date, creds.Region, creds.Service)

	// String to sign.
	stringToSign := "AWS4-HMAC-SHA256\n" +
		datetime + "\n" +
		credentialScope + "\n" +
		hashSHA256([]byte(canonicalRequest))

	// Derive signing key.
	signingKey := hmacSHA256(
		hmacSHA256(
			hmacSHA256(
				hmacSHA256([]byte("AWS4"+creds.SecretAccessKey), date),
				creds.Region,
			),
			creds.Service,
		),
		"aws4_request",
	)

	// Compute signature.
	signature := hex.EncodeToString(hmacSHA256Bytes(signingKey, []byte(stringToSign)))

	// Set Authorization header.
	req.Header.Set("Authorization", fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		creds.AccessKeyID, credentialScope, signedHeaders, signature,
	))

	return nil
}

func hashSHA256(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

func hmacSHA256(key []byte, data string) []byte {
	return hmacSHA256Bytes(key, []byte(data))
}

func hmacSHA256Bytes(key, data []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write(data)
	return mac.Sum(nil)
}

// uriEncode percent-encodes a string per AWS SigV4 rules.
func uriEncode(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		if isUnreserved(c) {
			b.WriteByte(c)
		} else {
			b.WriteString(fmt.Sprintf("%%%02X", c))
		}
	}
	return b.String()
}

func isUnreserved(c byte) bool {
	return (c >= 'A' && c <= 'Z') ||
		(c >= 'a' && c <= 'z') ||
		(c >= '0' && c <= '9') ||
		c == '-' || c == '_' || c == '.' || c == '~'
}
