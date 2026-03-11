FROM golang:1.25-alpine AS build

WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/. ./
COPY shared /shared
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/sports-calendar-api ./cmd/api

FROM alpine:3.22

WORKDIR /app
COPY --from=build /bin/sports-calendar-api /usr/local/bin/sports-calendar-api
COPY backend/config ./config
COPY shared /shared

EXPOSE 8080

CMD ["sports-calendar-api", "-config", "/app/config/config.yaml"]