package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"time"

	// Embed the IANA timezone database in the binary so time.LoadLocation works
	// on the minimal alpine image (which ships no tzdata). The spider fetcher
	// reinterprets Transfermarkt kickoff times in Europe/Berlin.
	_ "time/tzdata"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"
	"golang.org/x/time/rate"

	"github.com/vamosdalian/sports-calendar/backend/internal/analytics"
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
	svc.SetWebBaseURL(cfg.Site.WebBaseURL)
	tokenManager, err := auth.NewManager(cfg.AdminAuth.Secret, time.Duration(cfg.AdminAuth.TokenTTLMinute)*time.Minute)
	if err != nil {
		logger.WithError(err).Fatal("create auth token manager")
	}
	svc.SetTokenManager(tokenManager)

	// The local Transfermarkt spider is the only automatic sync data source. Its
	// upstream is therefore required, and ListSyncTargets only returns
	// spider-backed leagues, so every fetch routes here.
	if cfg.Spider.UpstreamURL == "" {
		logger.Fatal("spider upstreamURL is required: it is the only sync data source")
	}
	spiderFetcher, err := syncer.NewSpiderFetcher(
		cfg.Spider.UpstreamURL,
		time.Duration(cfg.Spider.TimeoutSeconds)*time.Second,
		logger,
	)
	if err != nil {
		logger.WithError(err).Fatal("create spider fetcher")
	}
	logger.WithField("upstream", cfg.Spider.UpstreamURL).Info("spider snapshot fetcher enabled")

	leagueSyncer, err := syncer.NewLeagueSyncer(logger, repo, spiderFetcher)
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

	// ICS fetch analytics. Calendar clients poll their subscribed feeds on a
	// fixed schedule, so these logs — not page views — are what shows how many
	// live subscriptions exist and which clients they use.
	var recorder *analytics.Recorder
	if cfg.Analytics.IsEnabled() {
		recorder = analytics.NewRecorder(repo, cfg.Analytics.SubscriberSalt, logger)
		recorder.Start()
		defer recorder.Stop()

		maintainer := analytics.NewMaintainer(repo, logger)
		maintainer.Start()
		defer maintainer.Stop()
		logger.Info("ics fetch analytics enabled")
	}

	svc.SetAnalyticsStore(repo)

	router := server.NewRouter(logger, svc, rate.NewLimiter(rate.Limit(cfg.RateLimit.RequestsPerSecond), cfg.RateLimit.Burst), cfg.Spider.UpstreamURL, recorder)

	address := fmt.Sprintf(":%d", cfg.Server.Port)
	logger.WithField("addr", address).Info("starting API server")
	if err := http.ListenAndServe(address, router); err != nil {
		logger.WithError(err).Fatal("server stopped")
	}
}
