package server

import (
	"fmt"
	"net/http"
	"time"

	ical "github.com/emersion/go-ical"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"golang.org/x/time/rate"

	"github.com/vamosdalian/sports-calendar/backend/internal/httputil"
	"github.com/vamosdalian/sports-calendar/backend/internal/service"
)

func NewRouter(logger *logrus.Logger, svc *service.Service, limiter *rate.Limiter) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(requestLogger(logger))
	router.Use(rateLimitMiddleware(limiter))
	handler := &Handler{service: svc}

	router.GET("/healthz", handler.healthz)

	api := router.Group("/api")
	api.GET("/leagues", handler.listLeagues)
	api.GET("/:sport/:league/seasons", handler.listLeagueSeasons)
	api.GET("/:sport/:league/:season", handler.getLeagueSeason)

	router.GET("/ics/:sport/:league/:season/matches.ics", handler.getSeasonICS)

	return router
}

type Handler struct {
	service *service.Service
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

func (h *Handler) getSeasonICS(c *gin.Context) {
	content, err := h.service.BuildSeasonICS(c.Request.Context(), c.Param("sport"), c.Param("league"), c.Param("season"))
	if err != nil {
		if err == service.ErrNotFound {
			httputil.JSONError(c, http.StatusNotFound, "not_found", "season feed not found")
			return
		}
		httputil.JSONError(c, http.StatusInternalServerError, "ics_failed", err.Error())
		return
	}

	c.Header("Content-Type", ical.MIMEType+"; charset=utf-8")
	c.Header("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%s-%s.ics", c.Param("league"), c.Param("season")))
	c.Data(http.StatusOK, ical.MIMEType+"; charset=utf-8", content)
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
		logger.WithFields(logrus.Fields{
			"method": c.Request.Method,
			"path":   c.Request.URL.Path,
			"status": c.Writer.Status(),
			"took":   timeNow().Sub(startedAt).String(),
		}).Info("request completed")
	}
}

var timeNow = func() time.Time {
	return time.Now()
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
