package server

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
	"github.com/vamosdalian/sports-calendar/backend/internal/httputil"
)

func (h *Handler) listAdminVenues(c *gin.Context) {
	payload, err := h.service.ListAdminVenues(c.Request.Context())
	if err != nil {
		handleServiceError(c, err, "list_admin_venues_failed", "list admin venues failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) createVenue(c *gin.Context) {
	var input domain.CreateVenueInput
	if err := c.ShouldBindJSON(&input); err != nil {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	payload, err := h.service.CreateVenue(c.Request.Context(), input)
	if err != nil {
		handleServiceError(c, err, "create_venue_failed", "create venue failed")
		return
	}
	c.JSON(http.StatusCreated, payload)
}

func (h *Handler) updateVenue(c *gin.Context) {
	venueID, err := strconv.ParseInt(c.Param("venueID"), 10, 64)
	if err != nil || venueID <= 0 {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_argument", "venue id must be a positive integer")
		return
	}
	var input domain.UpdateVenueInput
	if err := c.ShouldBindJSON(&input); err != nil {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	input.ID = venueID
	payload, err := h.service.UpdateVenue(c.Request.Context(), input)
	if err != nil {
		handleServiceError(c, err, "update_venue_failed", "update venue failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) deleteVenue(c *gin.Context) {
	venueID, err := strconv.ParseInt(c.Param("venueID"), 10, 64)
	if err != nil || venueID <= 0 {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_argument", "venue id must be a positive integer")
		return
	}
	if err := h.service.DeleteVenue(c.Request.Context(), venueID); err != nil {
		handleServiceError(c, err, "delete_venue_failed", "delete venue failed")
		return
	}
	c.Status(http.StatusNoContent)
}
