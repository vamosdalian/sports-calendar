package server

import (
	"errors"
	"fmt"
	"net/http"
	stdhttputil "net/http/httputil"
	"strconv"
	"strings"
	"time"

	ical "github.com/emersion/go-ical"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"golang.org/x/time/rate"

	"github.com/vamosdalian/sports-calendar/backend/internal/analytics"
	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
	"github.com/vamosdalian/sports-calendar/backend/internal/httputil"
	"github.com/vamosdalian/sports-calendar/backend/internal/service"
)

// spiderUpstream is the base URL of the sports-spider backend the admin-only
// proxy forwards to; empty disables the proxy. recorder may be nil, which
// disables ICS fetch analytics.
func NewRouter(logger *logrus.Logger, svc *service.Service, limiter *rate.Limiter, spiderUpstream string, recorder *analytics.Recorder) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(corsMiddleware())
	router.Use(func(c *gin.Context) {
		c.Set("logger", logger)
		c.Next()
	})
	router.Use(requestLogger(logger))
	router.Use(rateLimitMiddleware(limiter))
	handler := &Handler{service: svc, recorder: recorder}
	if spiderUpstream != "" {
		proxy, err := newSpiderProxy(spiderUpstream)
		if err != nil {
			logger.WithError(err).Error("invalid spider upstream URL; spider proxy disabled")
		} else {
			handler.spiderProxy = proxy
			logger.WithField("upstream", spiderUpstream).Info("spider proxy enabled")
		}
	}

	router.GET("/healthz", handler.healthz)

	api := router.Group("/api")
	auth := api.Group("/auth")
	auth.POST("/register", handler.registerAdmin)
	auth.POST("/login", handler.loginAdmin)
	auth.POST("/refresh", handler.refreshAdminToken)
	api.GET("/leagues", publicCacheMiddleware(), handler.listLeagues)
	api.GET("/:sport/:league/seasons", publicCacheMiddleware(), handler.listLeagueSeasons)
	api.GET("/:sport/:league/:season", publicCacheMiddleware(), handler.getLeagueSeason)
	admin := api.Group("/admin")
	admin.Use(adminAuthMiddleware(svc))
	admin.GET("/locales", handler.listAdminLocales)
	admin.POST("/locales", handler.createAdminLocale)
	admin.PUT("/locales/:code", handler.updateAdminLocale)
	admin.DELETE("/locales/:code", handler.deleteAdminLocale)
	admin.GET("/refresh-queue", handler.getRefreshQueue)
	admin.GET("/analytics/ics", handler.getICSAnalytics)
	admin.GET("/sports", handler.listAdminSports)
	admin.GET("/venues", handler.listAdminVenues)
	admin.GET("/:sport/leagues", handler.listAdminLeagues)
	admin.GET("/:sport/:league/seasons", handler.listAdminSeasons)
	admin.GET("/:sport/:league/seasons/:season", handler.getAdminLeagueSeason)
	admin.GET("/:sport/:league/teams", handler.listAdminTeams)
	admin.POST("/sports", handler.createSport)
	admin.POST("/venues", handler.createVenue)
	admin.PUT("/sports/:sport", handler.updateSport)
	admin.PUT("/venues/:venueID", handler.updateVenue)
	admin.DELETE("/venues/:venueID", handler.deleteVenue)
	admin.DELETE("/sports/:sport", handler.deleteSport)
	admin.POST("/leagues", handler.createLeague)
	admin.PUT("/:sport/leagues/:league", handler.updateLeague)
	admin.PUT("/:sport/:league/teams/:teamID", handler.updateTeam)
	admin.DELETE("/:sport/leagues/:league", handler.deleteLeague)
	admin.POST("/seasons", handler.createSeason)
	admin.POST("/matches", handler.createMatch)
	admin.PUT("/matches/:matchID", handler.updateMatch)
	admin.DELETE("/matches/:matchID", handler.deleteMatch)
	admin.POST("/:sport/:league/seasons/:season/refresh", handler.refreshSeasonNow)
	admin.PUT("/:sport/:league/seasons/:season", handler.updateSeason)
	admin.DELETE("/:sport/:league/seasons/:season", handler.deleteSeason)

	// Admin-only reverse proxy to the sports-spider crawler backend. Reuses
	// admin auth; the crawler is never exposed publicly. Mounted as its own
	// /api/spider subtree (a catch-all here would conflict with /api/:sport).
	spider := api.Group("/spider")
	spider.Use(adminAuthMiddleware(svc))
	spider.Any("/*path", handler.proxySpider)

	// The evergreen feed is the only shape the site hands out now. The
	// season-scoped route is kept solely so subscriptions saved before the
	// change keep working -- it serves the current season too, and is meant to
	// be deleted once analytics show the legacy shape has drained.
	router.GET("/ics/:sport/:league/matches.ics", handler.getLeagueICS)
	router.GET("/ics/:sport/:league/:season/matches.ics", handler.getLeagueICS)

	return router
}

type Handler struct {
	service     *service.Service
	spiderProxy *stdhttputil.ReverseProxy
	recorder    *analytics.Recorder
}

func (h *Handler) healthz(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *Handler) listLeagues(c *gin.Context) {
	payload, err := h.service.ListLeagues(c.Request.Context())
	if err != nil {
		httputil.JSONError(c, http.StatusInternalServerError, "list_failed", err.Error())
		return
	}

	c.JSON(http.StatusOK, localizeLeaguesResponse(payload, normalizeLocale(c.Query("lang"))))
}

func (h *Handler) listLeagueSeasons(c *gin.Context) {
	payload, err := h.service.ListLeagueSeasons(c.Request.Context(), c.Param("sport"), c.Param("league"))
	if err != nil {
		if err == service.ErrNotFound {
			httputil.JSONError(c, http.StatusNotFound, "not_found", "league seasons not found")
			return
		}
		httputil.JSONError(c, http.StatusInternalServerError, "seasons_failed", err.Error())
		return
	}

	c.JSON(http.StatusOK, localizeLeagueSeasons(payload, normalizeLocale(c.Query("lang"))))
}

func (h *Handler) getLeagueSeason(c *gin.Context) {
	payload, err := h.service.GetLeagueSeason(c.Request.Context(), c.Param("sport"), c.Param("league"), c.Param("season"))
	if err != nil {
		if err == service.ErrNotFound {
			httputil.JSONError(c, http.StatusNotFound, "not_found", "league season not found")
			return
		}
		httputil.JSONError(c, http.StatusInternalServerError, "detail_failed", err.Error())
		return
	}

	c.JSON(http.StatusOK, localizeSeasonDetail(payload, normalizeLocale(c.Query("lang"))))
}

// getLeagueICS serves a league's current-season feed. It backs both the
// evergreen route and the legacy season-scoped one, and the season segment of
// the legacy URL is deliberately ignored rather than honoured: a client that
// subscribed to last season must start receiving this season's fixtures without
// touching anything, which is the whole point of the change. The segment is
// still read for analytics, to measure how much traffic the legacy shape has
// left before it is removed.
func (h *Handler) getLeagueICS(c *gin.Context) {
	locale := normalizeLocale(c.Query("lang"))
	teamSlug := c.Query("team")
	content, err := h.service.BuildLeagueICS(c.Request.Context(), c.Param("sport"), c.Param("league"), locale, teamSlug)
	if err != nil {
		if err == service.ErrNotFound {
			// Recorded too: a rising 404 count on a feed means subscribers are
			// still polling a URL that no longer resolves.
			h.recordICSFetch(c, teamSlug, locale, http.StatusNotFound)
			httputil.JSONError(c, http.StatusNotFound, "not_found", "league feed not found")
			return
		}
		h.recordICSFetch(c, teamSlug, locale, http.StatusInternalServerError)
		httputil.JSONError(c, http.StatusInternalServerError, "ics_failed", err.Error())
		return
	}
	h.recordICSFetch(c, teamSlug, locale, http.StatusOK)

	c.Header("Content-Type", ical.MIMEType+"; charset=utf-8")
	c.Header("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600")
	// No season in the filename: it would go stale in the subscriber's client
	// the moment the feed rolls over to the next season.
	filename := fmt.Sprintf("%s.ics", c.Param("league"))
	if teamSlug != "" {
		filename = fmt.Sprintf("%s-%s.ics", c.Param("league"), teamSlug)
	}
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%s", filename))
	c.Data(http.StatusOK, ical.MIMEType+"; charset=utf-8", content)
}

func (h *Handler) getICSAnalytics(c *gin.Context) {
	trendDays := 0
	if raw := c.Query("trendDays"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			httputil.JSONError(c, http.StatusBadRequest, "invalid_request", "trendDays must be an integer")
			return
		}
		trendDays = parsed
	}

	overview, err := h.service.GetICSAnalyticsOverview(c.Request.Context(), trendDays)
	if err != nil {
		if err == service.ErrNotFound {
			httputil.JSONError(c, http.StatusServiceUnavailable, "analytics_disabled", "ics analytics is not enabled")
			return
		}
		httputil.JSONError(c, http.StatusInternalServerError, "analytics_failed", err.Error())
		return
	}

	c.JSON(http.StatusOK, overview)
}

// recordICSFetch queues one feed pull for analytics. It never blocks and never
// fails the response.
//
// SeasonSlug records the season segment the *client asked for*, not the season
// that was served -- the served one is always the current season and can be
// derived. Empty therefore means the caller is on the evergreen URL, and any
// non-empty value means it is still replaying a legacy season-scoped one, which
// is how the migration is tracked to the point where that route can be dropped.
func (h *Handler) recordICSFetch(c *gin.Context, teamSlug, locale string, status int) {
	if h.recorder == nil {
		return
	}
	userAgent := c.Request.UserAgent()
	h.recorder.Record(analytics.FetchEvent{
		SportSlug:      c.Param("sport"),
		LeagueSlug:     c.Param("league"),
		SeasonSlug:     c.Param("season"),
		TeamSlug:       teamSlug,
		Locale:         locale,
		Client:         analytics.ClassifyUserAgent(userAgent),
		UserAgent:      userAgent,
		SubscriberHash: h.recorder.SubscriberHash(clientIP(c), userAgent),
		Status:         status,
	})
}

// clientIP resolves the caller address behind Cloudflare. gin's ClientIP only
// consults X-Forwarded-For once proxies are declared trusted, so the
// Cloudflare-specific header is preferred: it is set by the edge and cannot be
// spoofed by the client the way X-Forwarded-For can.
func clientIP(c *gin.Context) string {
	if ip := strings.TrimSpace(c.GetHeader("CF-Connecting-IP")); ip != "" {
		return ip
	}
	if forwarded := c.GetHeader("X-Forwarded-For"); forwarded != "" {
		if first, _, found := strings.Cut(forwarded, ","); found {
			return strings.TrimSpace(first)
		}
		return strings.TrimSpace(forwarded)
	}
	return c.ClientIP()
}

func (h *Handler) createSport(c *gin.Context) {
	var input domain.CreateSportInput
	if err := c.ShouldBindJSON(&input); err != nil {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	payload, err := h.service.CreateSport(c.Request.Context(), input)
	if err != nil {
		handleServiceError(c, err, "create_sport_failed", "create sport failed")
		return
	}

	c.JSON(http.StatusCreated, payload)
}

func (h *Handler) createLeague(c *gin.Context) {
	var input domain.CreateLeagueInput
	if err := c.ShouldBindJSON(&input); err != nil {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	payload, err := h.service.CreateLeague(c.Request.Context(), input)
	if err != nil {
		handleServiceError(c, err, "create_league_failed", "create league failed")
		return
	}

	c.JSON(http.StatusCreated, payload)
}

func (h *Handler) createSeason(c *gin.Context) {
	var input domain.CreateSeasonInput
	if err := c.ShouldBindJSON(&input); err != nil {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	payload, err := h.service.CreateSeason(c.Request.Context(), input)
	if err != nil {
		handleServiceError(c, err, "create_season_failed", "create season failed")
		return
	}

	c.JSON(http.StatusCreated, payload)
}

func (h *Handler) deleteSeason(c *gin.Context) {
	err := h.service.DeleteSeason(c.Request.Context(), domain.DeleteSeasonInput{
		SportSlug:  c.Param("sport"),
		LeagueSlug: c.Param("league"),
		SeasonSlug: c.Param("season"),
	})
	if err != nil {
		handleServiceError(c, err, "delete_season_failed", "delete season failed")
		return
	}

	c.Status(http.StatusNoContent)
}

func normalizeLocale(value string) string {
	if value == "" {
		return "en"
	}
	return value
}

func requestLogger(logger *logrus.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		startedAt := timeNow()
		c.Next()

		fields := logrus.Fields{
			"method": c.Request.Method,
			"path":   c.Request.URL.Path,
			"status": c.Writer.Status(),
			"took":   timeNow().Sub(startedAt).String(),
		}
		if isICSRequest(c.Request.URL.Path) {
			fields["query"] = c.Request.URL.RawQuery
			fields["request_headers"] = sanitizeRequestHeaders(c.Request.Header)
		}

		logger.WithFields(fields).Info("request completed")
	}
}

func isICSRequest(path string) bool {
	return strings.HasPrefix(path, "/ics/")
}

func sanitizeRequestHeaders(header http.Header) map[string][]string {
	if len(header) == 0 {
		return map[string][]string{}
	}

	sanitized := make(map[string][]string, len(header))
	for key, values := range header {
		copied := append([]string(nil), values...)
		switch http.CanonicalHeaderKey(key) {
		case "Authorization", "Cookie":
			sanitized[key] = []string{"[REDACTED]"}
		default:
			sanitized[key] = copied
		}
	}

	return sanitized
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			c.Header("Access-Control-Allow-Origin", "*")
		} else {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
		c.Header("Access-Control-Max-Age", "600")

		if c.Request.Method == http.MethodOptions {
			c.Status(http.StatusNoContent)
			c.Abort()
			return
		}

		c.Next()
	}
}

var timeNow = func() time.Time {
	return time.Now()
}

// publicCacheMiddleware sets Cache-Control headers for public read-only API endpoints.
// s-maxage=3600: CDN (Cloudflare) caches for 1 hour, matching Next.js ISR revalidate interval.
// must-revalidate: CDN must revalidate with the origin after the TTL expires (no serving stale).
func publicCacheMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "public, max-age=0, s-maxage=3600, must-revalidate")
		c.Next()
	}
}

func rateLimitMiddleware(limiter *rate.Limiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		if limiter == nil || limiter.Allow() {
			c.Next()
			return
		}
		httputil.JSONError(c, http.StatusTooManyRequests, "rate_limited", "too many requests")
	}
}

func handleServiceError(c *gin.Context, err error, internalCode, defaultMessage string) {
	if loggerValue, ok := c.Get("logger"); ok {
		if logger, ok := loggerValue.(*logrus.Logger); ok && logger != nil {
			logger.WithError(err).WithFields(logrus.Fields{
				"method":        c.Request.Method,
				"path":          c.Request.URL.Path,
				"internal_code": internalCode,
			}).Error("request failed")
		}
	}

	switch {
	case errors.Is(err, service.ErrInvalidArgument):
		httputil.JSONError(c, http.StatusBadRequest, "invalid_argument", err.Error())
	case errors.Is(err, service.ErrConflict):
		httputil.JSONError(c, http.StatusConflict, "conflict", err.Error())
	case errors.Is(err, service.ErrNotFound):
		httputil.JSONError(c, http.StatusNotFound, "not_found", err.Error())
	case errors.Is(err, service.ErrUnauthorized):
		httputil.JSONError(c, http.StatusUnauthorized, "unauthorized", err.Error())
	default:
		httputil.JSONError(c, http.StatusInternalServerError, internalCode, defaultMessage)
	}
}
