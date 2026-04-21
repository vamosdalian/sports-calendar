package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

func (r *PostgresRepository) ListAdminLocales(ctx context.Context) (domain.AdminLocalesResponse, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT code, label
		FROM admin_locales
		ORDER BY code ASC
	`)
	if err != nil {
		return domain.AdminLocalesResponse{}, fmt.Errorf("list admin locales: %w", err)
	}
	defer rows.Close()

	items := make([]domain.AdminLocaleItem, 0)
	for rows.Next() {
		var item domain.AdminLocaleItem
		if scanErr := rows.Scan(&item.Code, &item.Label); scanErr != nil {
			return domain.AdminLocalesResponse{}, fmt.Errorf("scan admin locale: %w", scanErr)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return domain.AdminLocalesResponse{}, fmt.Errorf("iterate admin locales: %w", err)
	}
	return domain.AdminLocalesResponse{Items: items}, nil
}

func (r *PostgresRepository) CreateAdminLocale(ctx context.Context, input domain.CreateAdminLocaleInput) (domain.AdminLocaleItem, error) {
	var item domain.AdminLocaleItem
	err := r.pool.QueryRow(ctx, `
		INSERT INTO admin_locales (code, label)
		VALUES ($1, $2)
		RETURNING code, label
	`, input.Code, input.Label).Scan(&item.Code, &item.Label)
	if err != nil {
		return domain.AdminLocaleItem{}, mapWriteError("create admin locale", err)
	}
	return item, nil
}

func (r *PostgresRepository) UpdateAdminLocale(ctx context.Context, input domain.UpdateAdminLocaleInput) (domain.AdminLocaleItem, error) {
	var item domain.AdminLocaleItem
	err := r.pool.QueryRow(ctx, `
		UPDATE admin_locales
		SET label = $2,
		    updated_at = NOW()
		WHERE code = $1
		RETURNING code, label
	`, input.Code, input.Label).Scan(&item.Code, &item.Label)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.AdminLocaleItem{}, domain.ErrNotFound
		}
		return domain.AdminLocaleItem{}, mapWriteError("update admin locale", err)
	}
	return item, nil
}

func (r *PostgresRepository) DeleteAdminLocale(ctx context.Context, code string) error {
	result, err := r.pool.Exec(ctx, `DELETE FROM admin_locales WHERE code = $1`, code)
	if err != nil {
		return fmt.Errorf("delete admin locale: %w", err)
	}
	if result.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
