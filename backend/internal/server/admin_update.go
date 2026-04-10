package server

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
	"github.com/vamosdalian/sports-calendar/backend/internal/httputil"
)

func (h *Handler) updateSport(c *gin.Context) {
	var input domain.UpdateSportInput
	if err := c.ShouldBindJSON(&input); err != nil {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	input.CurrentSlug = c.Param("sport")
	payload, err := h.service.UpdateSport(c.Request.Context(), input)
	if err != nil {
		handleServiceError(c, err, "update_sport_failed", "update sport failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) createMatch(c *gin.Context) {
	var input domain.CreateMatchInput
	if err := c.ShouldBindJSON(&input); err != nil {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if err := h.service.CreateMatch(c.Request.Context(), input); err != nil {
		handleServiceError(c, err, "create_match_failed", "create match failed")
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) deleteSport(c *gin.Context) {
	err := h.service.DeleteSport(c.Request.Context(), domain.DeleteSportInput{SportSlug: c.Param("sport")})
	if err != nil {
		handleServiceError(c, err, "delete_sport_failed", "delete sport failed")
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) updateLeague(c *gin.Context) {
	var input domain.UpdateLeagueInput
	if err := c.ShouldBindJSON(&input); err != nil {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	input.SportSlug = c.Param("sport")
	input.CurrentSlug = c.Param("league")
	payload, err := h.service.UpdateLeague(c.Request.Context(), input)
	if err != nil {
		handleServiceError(c, err, "update_league_failed", "update league failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) deleteLeague(c *gin.Context) {
	err := h.service.DeleteLeague(c.Request.Context(), domain.DeleteLeagueInput{
		SportSlug:  c.Param("sport"),
		LeagueSlug: c.Param("league"),
	})
	if err != nil {
		handleServiceError(c, err, "delete_league_failed", "delete league failed")
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) updateSeason(c *gin.Context) {
	var input domain.UpdateSeasonInput
	if err := c.ShouldBindJSON(&input); err != nil {
		httputil.JSONError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	input.SportSlug = c.Param("sport")
	input.LeagueSlug = c.Param("league")
	input.CurrentSlug = c.Param("season")
	payload, err := h.service.UpdateSeason(c.Request.Context(), input)
	if err != nil {
		handleServiceError(c, err, "update_season_failed", "update season failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) refreshSeasonNow(c *gin.Context) {
	err := h.service.RefreshSeasonNow(c.Request.Context(), domain.RefreshSeasonInput{
		SportSlug:  c.Param("sport"),
		LeagueSlug: c.Param("league"),
		SeasonSlug: c.Param("season"),
	})
	if err != nil {
		handleServiceError(c, err, "refresh_season_failed", "refresh season failed")
		return
	}

	c.Status(http.StatusNoContent)
}
