package server

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	ical "github.com/emersion/go-ical"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"golang.org/x/time/rate"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
	"github.com/vamosdalian/sports-calendar/backend/internal/httputil"
	"github.com/vamosdalian/sports-calendar/backend/internal/service"
)

func NewRouter(logger *logrus.Logger, svc *service.Service, limiter *rate.Limiter) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(corsMiddleware())
	router.Use(requestLogger(logger))
	router.Use(rateLimitMiddleware(limiter))
	handler := &Handler{service: svc}

	router.GET("/healthz", handler.healthz)

	api := router.Group("/api")
	auth := api.Group("/auth")
	auth.POST("/register", handler.registerAdmin)
	auth.POST("/login", handler.loginAdmin)
	auth.POST("/refresh", handler.refreshAdminToken)
	api.GET("/leagues", handler.listLeagues)
	api.GET("/:sport/:league/seasons", handler.listLeagueSeasons)
	api.GET("/:sport/:league/:season", handler.getLeagueSeason)
	admin := api.Group("/admin")
	admin.Use(adminAuthMiddleware(svc))
	admin.GET("/sports", handler.listAdminSports)
	admin.GET("/:sport/leagues", handler.listAdminLeagues)
	admin.POST("/sports", handler.createSport)
	admin.POST("/leagues", handler.createLeague)
	admin.POST("/seasons", handler.createSeason)
	admin.DELETE("/:sport/:league/seasons/:season", handler.deleteSeason)

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
		logger.WithFields(logrus.Fields{
			"method": c.Request.Method,
			"path":   c.Request.URL.Path,
			"status": c.Writer.Status(),
			"took":   timeNow().Sub(startedAt).String(),
		}).Info("request completed")
	}
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
		c.Header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
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
