FROM golang:1.25-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app
RUN git clone https://github.com/gensyn-ai/axl.git .
RUN go mod download
RUN go build -o node ./cmd/node/

FROM alpine:latest
RUN apk --no-cache add ca-certificates openssl
WORKDIR /app
COPY --from=builder /app/node .
COPY vigil-node-config.json node-config.json
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

EXPOSE 9001
EXPOSE 9002

ENTRYPOINT ["./entrypoint.sh"]
