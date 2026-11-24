#!/usr/bin/env bash
set -e

PROFILE=$1

if [ -z "$PROFILE" ]; then
    echo "Usage: ./run-profile.sh <profile-number-or-name> [down|build]"
    echo "Profiles:"
    echo "  1) react-springboot-mysql"
    echo "  2) react-springboot-mongodb"
    echo "  3) react-dotnet-mysql"
    echo "  4) react-dotnet-mongodb"
    echo "  5) angular-springboot-mysql"
    echo "  6) angular-springboot-mongodb"
    echo "  7) angular-dotnet-mysql"
    echo "  8) angular-dotnet-mongodb"
    exit 1
fi

case "$PROFILE" in
    1) SELECTED="react-springboot-mysql" ;;
    2) SELECTED="react-springboot-mongodb" ;;
    3) SELECTED="react-dotnet-mysql" ;;
    4) SELECTED="react-dotnet-mongodb" ;;
    5) SELECTED="angular-springboot-mysql" ;;
    6) SELECTED="angular-springboot-mongodb" ;;
    7) SELECTED="angular-dotnet-mysql" ;;
    8) SELECTED="angular-dotnet-mongodb" ;;
    *) SELECTED="$PROFILE" ;;
esac

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$DIR/configurations/docker-compose.$SELECTED.yml"
ENV_FILE="$DIR/configurations/$SELECTED.env"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Error: Compose file $COMPOSE_FILE does not exist"
    exit 1
fi

ACTION="up -d"
if [ "$2" == "down" ]; then
    ACTION="down"
elif [ "$2" == "build" ]; then
    ACTION="up -d --build"
fi

echo "Launching AETHERIS Profile: $SELECTED ($ACTION)"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" $ACTION
