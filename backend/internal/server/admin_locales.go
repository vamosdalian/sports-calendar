package server

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
	"github.com/vamosdalian/sports-calendar/backend/internal/httputil"
)

func (h *Handler) listAdminLocales(c *gin.Context) {
	payload, err := h.service.ListAdminLocales(c.Request.Context())
	if err != nil {
		handleServiceError(c, err, "list_admin_locales_failed", "list admin locales failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) createAdminLocale(c *gin.Context) {
	var input domain.CreateAdminLocaleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	payload, err := h.service.CreateAdminLocale(c.Request.Context(), input)
	if err != nil {
		handleServiceError(c, err, "create_admin_locale_failed", "create admin locale failed")
		return
	}
	c.JSON(http.StatusCreated, payload)
}

func (h *Handler) updateAdminLocale(c *gin.Context) {
	var input domain.UpdateAdminLocaleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	input.Code = c.Param("code")
	payload, err := h.service.UpdateAdminLocale(c.Request.Context(), input)
	if err != nil {
		handleServiceError(c, err, "update_admin_locale_failed", "update admin locale failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) deleteAdminLocale(c *gin.Context) {
	if err := h.service.DeleteAdminLocale(c.Request.Context(), c.Param("code")); err != nil {
		handleServiceError(c, err, "delete_admin_locale_failed", "delete admin locale failed")
		return
	}
	c.Status(http.StatusNoContent)
}
