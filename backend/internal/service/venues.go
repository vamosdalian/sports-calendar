package service

import (
	"context"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

func (s *Service) CreateVenue(ctx context.Context, input domain.CreateVenueInput) (domain.VenueRecord, error) {
	input.Name = trimLocalizedText(input.Name)
	input.City = trimLocalizedText(input.City)
	input.Country = trimLocalizedText(input.Country)

	if input.ID <= 0 {
		return domain.VenueRecord{}, invalidArgument("venue id must be a positive integer")
	}
	if err := validateLocalizedText(input.Name, "venue name"); err != nil {
		return domain.VenueRecord{}, err
	}

	return s.repo.CreateVenue(ctx, input)
}

func (s *Service) UpdateVenue(ctx context.Context, input domain.UpdateVenueInput) (domain.VenueRecord, error) {
	input.Name = trimLocalizedText(input.Name)
	input.City = trimLocalizedText(input.City)
	input.Country = trimLocalizedText(input.Country)

	if input.ID <= 0 {
		return domain.VenueRecord{}, invalidArgument("venue id must be a positive integer")
	}
	if err := validateLocalizedText(input.Name, "venue name"); err != nil {
		return domain.VenueRecord{}, err
	}

	return s.repo.UpdateVenue(ctx, input)
}

func (s *Service) DeleteVenue(ctx context.Context, venueID int64) error {
	if venueID <= 0 {
		return invalidArgument("venue id must be a positive integer")
	}
	return s.repo.DeleteVenue(ctx, venueID)
}
