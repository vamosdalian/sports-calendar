package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

func (r *PostgresRepository) ListAdminVenues(ctx context.Context) (domain.AdminVenuesResponse, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, city, country, updated_at
		FROM venues
		ORDER BY id ASC
	`)
	if err != nil {
		return domain.AdminVenuesResponse{}, fmt.Errorf("list admin venues: %w", err)
	}
	defer rows.Close()

	items := make([]domain.AdminVenueItem, 0)
	lastUpdatedAt := time.Time{}
	for rows.Next() {
		var (
			item      domain.AdminVenueItem
			nameRaw   []byte
			cityRaw   []byte
			countryRaw []byte
			updatedAt time.Time
		)
		if scanErr := rows.Scan(&item.ID, &nameRaw, &cityRaw, &countryRaw, &updatedAt); scanErr != nil {
			return domain.AdminVenuesResponse{}, fmt.Errorf("scan admin venue: %w", scanErr)
		}
		item.Name = decodeLocalizedText(nameRaw)
		item.City = decodeLocalizedText(cityRaw)
		item.Country = decodeLocalizedText(countryRaw)
		item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		items = append(items, item)
		lastUpdatedAt = maxTime(lastUpdatedAt, updatedAt)
	}
	if err := rows.Err(); err != nil {
		return domain.AdminVenuesResponse{}, fmt.Errorf("iterate admin venues: %w", err)
	}
	if lastUpdatedAt.IsZero() {
		lastUpdatedAt = time.Now().UTC()
	}
	return domain.AdminVenuesResponse{Items: items, UpdatedAt: lastUpdatedAt.UTC().Format(time.RFC3339)}, nil
}

func (r *PostgresRepository) CreateVenue(ctx context.Context, input domain.CreateVenueInput) (domain.VenueRecord, error) {
	var (
		record     domain.VenueRecord
		nameRaw    []byte
		cityRaw    []byte
		countryRaw []byte
		createdAt  time.Time
		updatedAt  time.Time
	)
	err := r.pool.QueryRow(ctx, `
		INSERT INTO venues (id, name, city, country)
		VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
		RETURNING id, name, city, country, created_at, updated_at
	`, input.ID, encodeLocalizedText(input.Name), encodeLocalizedText(input.City), encodeLocalizedText(input.Country)).Scan(
		&record.ID, &nameRaw, &cityRaw, &countryRaw, &createdAt, &updatedAt,
	)
	if err != nil {
		return domain.VenueRecord{}, mapWriteError("create venue", err)
	}
	record.Name = decodeLocalizedText(nameRaw)
	record.City = decodeLocalizedText(cityRaw)
	record.Country = decodeLocalizedText(countryRaw)
	record.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	record.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return record, nil
}

func (r *PostgresRepository) UpdateVenue(ctx context.Context, input domain.UpdateVenueInput) (domain.VenueRecord, error) {
	var (
		record     domain.VenueRecord
		nameRaw    []byte
		cityRaw    []byte
		countryRaw []byte
		createdAt  time.Time
		updatedAt  time.Time
	)
	err := r.pool.QueryRow(ctx, `
		UPDATE venues
		SET name = $2::jsonb,
		    city = $3::jsonb,
		    country = $4::jsonb,
		    updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, city, country, created_at, updated_at
	`, input.ID, encodeLocalizedText(input.Name), encodeLocalizedText(input.City), encodeLocalizedText(input.Country)).Scan(
		&record.ID, &nameRaw, &cityRaw, &countryRaw, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.VenueRecord{}, domain.ErrNotFound
		}
		return domain.VenueRecord{}, mapWriteError("update venue", err)
	}
	record.Name = decodeLocalizedText(nameRaw)
	record.City = decodeLocalizedText(cityRaw)
	record.Country = decodeLocalizedText(countryRaw)
	record.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	record.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return record, nil
}

func (r *PostgresRepository) DeleteVenue(ctx context.Context, venueID int64) error {
	var inUse bool
	if err := r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM matches WHERE venue_id = $1)`, venueID).Scan(&inUse); err != nil {
		return fmt.Errorf("check venue usage %d: %w", venueID, err)
	}
	if inUse {
		return fmt.Errorf("%w: venue %d is referenced by matches", domain.ErrConflict, venueID)
	}
	result, err := r.pool.Exec(ctx, `DELETE FROM venues WHERE id = $1`, venueID)
	if err != nil {
		return fmt.Errorf("delete venue %d: %w", venueID, err)
	}
	if result.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func lookupVenueExistsTx(ctx context.Context, tx pgx.Tx, venueID *int64) error {
	if venueID == nil {
		return nil
	}
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM venues WHERE id = $1)`, *venueID).Scan(&exists); err != nil {
		return fmt.Errorf("validate venue %d: %w", *venueID, err)
	}
	if !exists {
		return fmt.Errorf("%w: venue %d does not exist", domain.ErrInvalidArgument, *venueID)
	}
	return nil
}

func upsertVenueSnapshotRecord(ctx context.Context, tx pgx.Tx, venue domain.VenueSyncRecord) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO venues (id, name, city, country)
		VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
		ON CONFLICT (id) DO UPDATE
		SET name = venues.name || EXCLUDED.name,
		    city = venues.city || EXCLUDED.city,
		    country = venues.country || EXCLUDED.country,
		    updated_at = NOW()
		WHERE venues.name IS DISTINCT FROM venues.name || EXCLUDED.name
		   OR venues.city IS DISTINCT FROM venues.city || EXCLUDED.city
		   OR venues.country IS DISTINCT FROM venues.country || EXCLUDED.country
	`, venue.ID, encodeLocalizedText(venue.Name), encodeLocalizedText(venue.City), encodeLocalizedText(venue.Country))
	if err != nil {
		return fmt.Errorf("upsert venue %d: %w", venue.ID, err)
	}
	return nil
}
