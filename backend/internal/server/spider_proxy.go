package server

import (
	"net/http"
	stdhttputil "net/http/httputil"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/vamosdalian/sports-calendar/backend/internal/httputil"
)

// spiderProxyPrefix is stripped from the incoming admin request path before the
// request is forwarded to the spider backend. The admin console calls
// /api/spider/api/tree/countries which is proxied to
// <upstream>/api/tree/countries.
const spiderProxyPrefix = "/api/spider"

// newSpiderProxy builds a reverse proxy to the sports-spider backend. It strips
// the /api/spider prefix and forwards the remainder (which itself starts with
// /api/...) to the upstream. The admin bearer token is dropped so it is never
// leaked to the crawler, which has no notion of admin auth.
func newSpiderProxy(rawURL string) (*stdhttputil.ReverseProxy, error) {
	target, err := url.Parse(rawURL)
	if err != nil {
		return nil, err
	}

	proxy := &stdhttputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host

			forwardPath := strings.TrimPrefix(req.URL.Path, spiderProxyPrefix)
			if forwardPath == "" {
				forwardPath = "/"
			}
			req.URL.Path = singleJoiningSlash(target.Path, forwardPath)
			// req.URL.RawQuery is preserved as-is.

			// Do not forward the admin session token to the crawler.
			req.Header.Del("Authorization")
			// Ensure a User-Agent header is always set so Go's default is not added.
			if _, ok := req.Header["User-Agent"]; !ok {
				req.Header.Set("User-Agent", "")
			}
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte(`{"error":{"code":"spider_unreachable","message":"spider backend unreachable"}}`))
		},
	}
	return proxy, nil
}

func singleJoiningSlash(a, b string) string {
	aslash := strings.HasSuffix(a, "/")
	bslash := strings.HasPrefix(b, "/")
	switch {
	case aslash && bslash:
		return a + b[1:]
	case !aslash && !bslash:
		return a + "/" + b
	}
	return a + b
}

// proxySpider forwards an authenticated admin request to the spider backend.
func (h *Handler) proxySpider(c *gin.Context) {
	if h.spiderProxy == nil {
		httputil.JSONError(c, http.StatusServiceUnavailable, "spider_disabled", "spider upstream not configured")
		return
	}
	h.spiderProxy.ServeHTTP(c.Writer, c.Request)
}
