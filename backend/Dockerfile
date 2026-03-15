FROM golang:1.25-alpine AS build

WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/. ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/sports-calendar-api ./cmd/api

FROM alpine:3.22

WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY --from=build /bin/sports-calendar-api /usr/local/bin/sports-calendar-api

EXPOSE 8080

ENTRYPOINT ["sports-calendar-api"]