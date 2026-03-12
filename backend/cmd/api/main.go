package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
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

	pool, err := pgxpool.New(context.Background(), cfg.Database.ConnectionString())
	if err != nil {
		logger.WithError(err).Fatal("connect postgres")
	}
	defer pool.Close()

	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		logger.WithError(err).Fatal("ping postgres")
	}

	repo, err := repository.NewPostgresRepository(pool)
	if err != nil {
		logger.WithError(err).Fatal("create postgres repository")
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
