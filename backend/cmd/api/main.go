package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/sirupsen/logrus"
	"golang.org/x/time/rate"

	"github.com/vamosdalian/sports-calendar/backend/internal/config"
	"github.com/vamosdalian/sports-calendar/backend/internal/repository"
	"github.com/vamosdalian/sports-calendar/backend/internal/server"
	"github.com/vamosdalian/sports-calendar/backend/internal/service"
	"github.com/vamosdalian/sports-calendar/backend/internal/syncer"
)

func main() {
	configPath := flag.String("config", "./config/config.yaml", "path to YAML config")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "load config: %v\n", err)
		os.Exit(1)
	}

	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{TimestampFormat: time.RFC3339})

	repo, err := repository.NewMockRepository(cfg.Data.MockFile)
	if err != nil {
		logger.WithError(err).Fatal("load mock catalog")
	}

	svc := service.New(repo)
	scheduler, err := syncer.NewScheduler(logger)
	if err != nil {
		logger.WithError(err).Fatal("create sync scheduler")
	}
	scheduler.Start()
	defer scheduler.Stop()

	router := server.NewRouter(logger, svc, rate.NewLimiter(rate.Limit(cfg.RateLimit.RequestsPerSecond), cfg.RateLimit.Burst))

	address := fmt.Sprintf(":%d", cfg.Server.Port)
	logger.WithField("addr", address).Info("starting API server")
	if err := http.ListenAndServe(address, router); err != nil {
		logger.WithError(err).Fatal("server stopped")
	}
}
