#!/bin/bash
echo "========================================="
echo "  AttackZap SaaS - Deploy DigitalOcean"
echo "========================================="

# 1. Instalar Docker (se não tiver)
if ! command -v docker &> /dev/null; then
    echo "[1/5] Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
else
    echo "[1/5] Docker já instalado."
fi

if ! command -v docker-compose &> /dev/null; then
    echo "       Instalando Docker Compose..."
    apt install -y docker-compose
fi

# 2. Criar banco de dados
echo "[2/5] Criando banco attackzap_saas..."
docker exec php_db mysql -ulocaluser -ploterias123 -e "CREATE DATABASE IF NOT EXISTS attackzap_saas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "       Banco criado!"

# 3. Verificar rede Docker
echo "[3/5] Verificando rede loterias-bet-network..."
if ! docker network inspect loterias-bet-network &> /dev/null; then
    echo "       ERRO: Rede loterias-bet-network não encontrada!"
    echo "       Certifique-se que o autojob está rodando."
    exit 1
fi
echo "       Rede OK!"

# 4. Build e start dos containers
echo "[4/5] Construindo e iniciando containers..."
docker-compose up -d --build

# 5. Verificar
echo "[5/5] Verificando status..."
sleep 5
docker-compose ps

echo ""
echo "========================================="
echo "  Deploy concluído!"
echo "  Frontend: http://SEU_IP:8080"
echo "  Backend:  http://SEU_IP:3001"
echo "========================================="
