package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) getRefreshQueue(c *gin.Context) {
	payload, err := h.service.GetRefreshQueueSnapshot(c.Request.Context())
	if err != nil {
		handleServiceError(c, err, "get_refresh_queue_failed", "get refresh queue failed")
		return
	}
	c.JSON(http.StatusOK, payload)
}
