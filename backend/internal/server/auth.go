package server

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
	"github.com/vamosdalian/sports-calendar/backend/internal/httputil"
	"github.com/vamosdalian/sports-calendar/backend/internal/service"
)

func (h *Handler) registerAdmin(c *gin.Context) {
	var input domain.RegisterAdminInput
	if err := c.ShouldBindJSON(&input); err != nil {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	payload, err := h.service.RegisterAdmin(c.Request.Context(), input)
	if err != nil {
		handleServiceError(c, err, "register_admin_failed", "register admin failed")
		return
	}
	c.JSON(http.StatusCreated, payload)
}

func (h *Handler) loginAdmin(c *gin.Context) {
	var input domain.LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	payload, err := h.service.LoginAdmin(c.Request.Context(), input)
	if err != nil {
		handleServiceError(c, err, "login_failed", "login failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) refreshAdminToken(c *gin.Context) {
	token := bearerToken(c.GetHeader("Authorization"))
	payload, err := h.service.RefreshAdminToken(c.Request.Context(), domain.RefreshTokenInput{Token: token})
	if err != nil {
		handleServiceError(c, err, "refresh_failed", "refresh token failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) listAdminSports(c *gin.Context) {
	payload, err := h.service.ListAdminSports(c.Request.Context())
	if err != nil {
		handleServiceError(c, err, "list_admin_sports_failed", "list admin sports failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) listAdminLeagues(c *gin.Context) {
	payload, err := h.service.ListAdminLeagues(c.Request.Context(), c.Param("sport"))
	if err != nil {
		handleServiceError(c, err, "list_admin_leagues_failed", "list admin leagues failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) listAdminSeasons(c *gin.Context) {
	payload, err := h.service.ListAdminSeasons(c.Request.Context(), c.Param("sport"), c.Param("league"))
	if err != nil {
		handleServiceError(c, err, "list_admin_seasons_failed", "list admin seasons failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func adminAuthMiddleware(svc *service.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := bearerToken(c.GetHeader("Authorization"))
		if token == "" {
			httputil.JSONError(c, http.StatusUnauthorized, "unauthorized", "missing bearer token")
			c.Abort()
			return
		}
		claims, err := svc.VerifyAdminToken(token)
		if err != nil {
			httputil.JSONError(c, http.StatusUnauthorized, "unauthorized", "invalid or expired token")
			c.Abort()
			return
		}
		c.Set("adminEmail", claims.Email)
		c.Next()
	}
}

func bearerToken(value string) string {
	if value == "" {
		return ""
	}
	const prefix = "Bearer "
	if strings.HasPrefix(value, prefix) {
		return strings.TrimSpace(strings.TrimPrefix(value, prefix))
	}
	return strings.TrimSpace(value)
}
