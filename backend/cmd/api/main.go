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

	"github.com/vamosdalian/sports-calendar/backend/internal/auth"
	"github.com/vamosdalian/sports-calendar/backend/internal/config"
	"github.com/vamosdalian/sports-calendar/backend/internal/migrations"
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

	migrationCtx, migrationCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer migrationCancel()
	if err := migrations.Run(migrationCtx, pool, logger); err != nil {
		logger.WithError(err).Fatal("run database migrations")
	}

	repo, err := repository.NewPostgresRepository(pool)
	if err != nil {
		logger.WithError(err).Fatal("create postgres repository")
	}

	svc := service.New(repo)
	tokenManager, err := auth.NewManager(cfg.AdminAuth.Secret, time.Duration(cfg.AdminAuth.TokenTTLMinute)*time.Minute)
	if err != nil {
		logger.WithError(err).Fatal("create auth token manager")
	}
	svc.SetTokenManager(tokenManager)
	client, err := syncer.NewTheSportsDBClient(
		cfg.TheSportsDB.BaseURL,
		cfg.TheSportsDB.APIKey,
		time.Duration(cfg.TheSportsDB.TimeoutSeconds)*time.Second,
		cfg.RefreshExecutor.QPS,
	)
	if err != nil {
		logger.WithError(err).Fatal("create TheSportsDB client")
	}
	svc.SetSportsDataProvider(client)

	leagueSyncer, err := syncer.NewLeagueSyncer(logger, repo, client)
	if err != nil {
		logger.WithError(err).Fatal("create league syncer")
	}
	refreshExecutor, err := syncer.NewRefreshExecutor(logger, leagueSyncer)
	if err != nil {
		logger.WithError(err).Fatal("create refresh executor")
	}
	refreshExecutor.Start()
	defer refreshExecutor.Stop()
	svc.SetRefreshExecutor(refreshExecutor)

	scheduler, err := syncer.NewScheduler(logger, repo, refreshExecutor)
	if err != nil {
		logger.WithError(err).Fatal("create sync scheduler")
	}
	svc.SetSyncScheduleRefresher(scheduler)
	scheduler.Start()
	defer scheduler.Stop()

	router := server.NewRouter(logger, svc, rate.NewLimiter(rate.Limit(cfg.RateLimit.RequestsPerSecond), cfg.RateLimit.Burst))

	address := fmt.Sprintf(":%d", cfg.Server.Port)
	logger.WithField("addr", address).Info("starting API server")
	if err := http.ListenAndServe(address, router); err != nil {
		logger.WithError(err).Fatal("server stopped")
	}
}
