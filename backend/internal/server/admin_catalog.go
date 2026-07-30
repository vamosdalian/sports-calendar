package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) listAdminTeams(c *gin.Context) {
	payload, err := h.service.ListAdminTeams(c.Request.Context(), c.Param("sport"), c.Param("league"))
	if err != nil {
		handleServiceError(c, err, "list_admin_teams_failed", "list admin teams failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}
