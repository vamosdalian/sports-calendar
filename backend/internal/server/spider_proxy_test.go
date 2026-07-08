package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"golang.org/x/time/rate"

	"github.com/vamosdalian/sports-calendar/backend/internal/auth"
	"github.com/vamosdalian/sports-calendar/backend/internal/service"
)

// closeNotifyRecorder makes httptest.ResponseRecorder satisfy http.CloseNotifier,
// which net/http/httputil.ReverseProxy probes via gin's ResponseWriter. A real
// net/http server's ResponseWriter already implements it, so this only papers
// over the test recorder; production is unaffected.
type closeNotifyRecorder struct {
	*httptest.ResponseRecorder
	closed chan bool
}

func (c *closeNotifyRecorder) CloseNotify() <-chan bool { return c.closed }

func newCloseNotifyRecorder() *closeNotifyRecorder {
	return &closeNotifyRecorder{ResponseRecorder: httptest.NewRecorder(), closed: make(chan bool, 1)}
}

func spiderTestRouter(t *testing.T, upstream string) (*gin.Engine, *auth.Manager) {
	t.Helper()
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	repo := newFakeRepository()
	svc := service.New(repo)
	svc.SetRefreshExecutor(&fakeRefreshExecutor{repo: repo})
	manager, err := auth.NewManager("test-secret", 30*time.Minute)
	if err != nil {
		t.Fatalf("create test token manager: %v", err)
	}
	svc.SetTokenManager(manager)
	return NewRouter(logger, svc, rate.NewLimiter(rate.Limit(100), 100), upstream), manager
}

func TestSpiderProxyRequiresAuth(t *testing.T) {
	router, _ := spiderTestRouter(t, "http://127.0.0.1:1") // upstream never reached

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/spider/api/tree/countries", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", recorder.Code)
	}
}

func TestSpiderProxyForwardsStrippedPath(t *testing.T) {
	var gotPath, gotQuery, gotAuth string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotQuery = r.URL.RawQuery
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"id":1,"name":"England"}]`))
	}))
	defer upstream.Close()

	router, manager := spiderTestRouter(t, upstream.URL)

	recorder := newCloseNotifyRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/spider/api/tree/countries?limit=5", nil)
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body=%s)", recorder.Code, recorder.Body.String())
	}
	if gotPath != "/api/tree/countries" {
		t.Fatalf("expected upstream path /api/tree/countries, got %q", gotPath)
	}
	if gotQuery != "limit=5" {
		t.Fatalf("expected upstream query limit=5, got %q", gotQuery)
	}
	if gotAuth != "" {
		t.Fatalf("expected admin Authorization to be stripped, got %q", gotAuth)
	}
	if body := recorder.Body.String(); body != `[{"id":1,"name":"England"}]` {
		t.Fatalf("unexpected proxied body: %s", body)
	}
}

func TestSpiderProxyDisabledWhenNoUpstream(t *testing.T) {
	router, manager := spiderTestRouter(t, "")

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/spider/api/tree/countries", nil)
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when upstream not configured, got %d", recorder.Code)
	}
}
