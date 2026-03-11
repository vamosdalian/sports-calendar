package repository

import (
	"context"
	"fmt"

	"github.com/vamosdalian/sports-calendar/backend/internal/mockdata"
)

type MockRepository struct {
	catalog *mockdata.Catalog
}

func NewMockRepository(path string) (*MockRepository, error) {
	catalog, err := mockdata.LoadCatalog(path)
	if err != nil {
		return nil, err
	}
	return &MockRepository{catalog: catalog}, nil
}

func (r *MockRepository) Catalog(_ context.Context) (*mockdata.Catalog, error) {
	if r.catalog == nil {
		return nil, fmt.Errorf("catalog not loaded")
	}
	return r.catalog, nil
}
