#!/bin/sh
# Eliminar locks de Chromium antes de iniciar para evitar "profile in use"
find /data -name "SingletonLock" -delete 2>/dev/null || true
find /data -name "SingletonSocket" -delete 2>/dev/null || true
find /data -name "SingletonCookie" -delete 2>/dev/null || true
echo "[start.sh] Locks eliminados, iniciando Node.js..."
exec node src/main.js
