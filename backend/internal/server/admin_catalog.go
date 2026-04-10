package server

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/vamosdalian/sports-calendar/backend/internal/httputil"
)

func (h *Handler) listTheSportsDBSports(c *gin.Context) {
	payload, err := h.service.ListExternalSports(c.Request.Context())
	if err != nil {
		handleServiceError(c, err, "list_external_sports_failed", "list external sports failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) listTheSportsDBLeagues(c *gin.Context) {
	payload, err := h.service.ListExternalLeagues(c.Request.Context(), c.Param("sport"))
	if err != nil {
		handleServiceError(c, err, "list_external_leagues_failed", "list external leagues failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) lookupTheSportsDBLeague(c *gin.Context) {
	leagueID, err := strconv.ParseInt(c.Param("leagueID"), 10, 64)
	if err != nil || leagueID <= 0 {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_argument", "league id must be a positive integer")
		return
	}
	payload, err := h.service.LookupExternalLeague(c.Request.Context(), leagueID)
	if err != nil {
		handleServiceError(c, err, "lookup_external_league_failed", "lookup external league failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) listTheSportsDBSeasons(c *gin.Context) {
	payload, err := h.service.ListExternalSeasons(c.Request.Context(), c.Param("sport"), c.Param("league"))
	if err != nil {
		handleServiceError(c, err, "list_external_seasons_failed", "list external seasons failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) listAdminTeams(c *gin.Context) {
	payload, err := h.service.ListAdminTeams(c.Request.Context(), c.Param("sport"), c.Param("league"))
	if err != nil {
		handleServiceError(c, err, "list_admin_teams_failed", "list admin teams failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}
