#!/usr/bin/env sh
set -eu

echo "Mero Health server readiness"
echo "============================"
printf "Host: "; hostname
printf "Kernel: "; uname -sr
printf "Architecture: "; uname -m
printf "CPU cores: "; getconf _NPROCESSORS_ONLN
echo
echo "Memory:"
free -h
echo
echo "Root disk:"
df -h /
echo
echo "Docker:"
if command -v docker >/dev/null 2>&1; then
  docker --version
  docker compose version
else
  echo "NOT INSTALLED"
fi
echo
echo "Listening ports (80/443/4000):"
ss -lnt 2>/dev/null | grep -E ':(80|443|4000)[[:space:]]' || echo "No matching listeners"
echo
echo "Minimum: 2 vCPU, 4 GB RAM, 20 GB free disk."
echo "Recommended for on-server builds: 4 vCPU, 8 GB RAM, 40 GB free disk."
