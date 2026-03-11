package server

import (
	"fmt"
	"net/http"
	"strconv"
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

	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	router.GET("/api/years", func(c *gin.Context) {
		payload, err := svc.ListYears(c.Request.Context())
		if err != nil {
			httputil.JSONError(c, http.StatusInternalServerError, "years_failed", err.Error())
			return
		}
		c.JSON(http.StatusOK, payload)
	})

	listLeaguesByYear := func(c *gin.Context) {
		yearText := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
		lang := normalizeLocale(c.Query("lang"))
		year, err := strconv.Atoi(yearText)
		if err != nil {
			httputil.JSONError(c, http.StatusBadRequest, "invalid_year", "year must be numeric")
			return
		}

		payload, err := svc.ListSportsByYear(c.Request.Context(), year)
		if err != nil {
			httputil.JSONError(c, http.StatusInternalServerError, "list_failed", err.Error())
			return
		}

		c.JSON(http.StatusOK, localizeSportsYearResponse(payload, lang))
	}

	router.GET("/api/leagues", listLeaguesByYear)

	router.GET("/api/sports/:league", func(c *gin.Context) {
		handleLeagueDetail(c, svc, c.Param("league"), "", normalizeLocale(c.Query("lang")))
	})

	router.GET("/api/sports/:league/:season", func(c *gin.Context) {
		handleLeagueDetail(c, svc, c.Param("league"), c.Param("season"), normalizeLocale(c.Query("lang")))
	})

	router.GET("/ics/:sport/:league/:season/matches.ics", func(c *gin.Context) {
		content, err := svc.BuildSeasonICS(c.Request.Context(), c.Param("sport"), c.Param("league"), c.Param("season"))
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
	})

	return router
}

func handleLeagueDetail(c *gin.Context, svc *service.Service, league, season, lang string) {
	payload, err := svc.GetLeagueSeason(c.Request.Context(), league, season)
	if err != nil {
		if err == service.ErrNotFound {
			httputil.JSONError(c, http.StatusNotFound, "not_found", "league season not found")
			return
		}
		httputil.JSONError(c, http.StatusInternalServerError, "detail_failed", err.Error())
		return
	}

	c.JSON(http.StatusOK, localizeSeasonDetail(payload, lang))
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
