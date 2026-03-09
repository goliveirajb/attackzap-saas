#!/bin/bash
echo "========================================="
echo "  AttackZap SaaS - Deploy DigitalOcean"
echo "========================================="

# 1. Instalar Docker (se não tiver)
if ! command -v docker &> /dev/null; then
    echo "[1/4] Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
else
    echo "[1/4] Docker já instalado."
fi

if ! command -v docker-compose &> /dev/null; then
    echo "       Instalando Docker Compose..."
    apt install -y docker-compose
fi

# 2. Criar .env a partir do .env.example se nao existir
if [ ! -f .env ]; then
    echo "[2/5] Criando .env a partir do .env.example..."
    cp .env.example .env
else
    echo "[2/5] .env já existe."
fi

# 3. Criar banco de dados na AWS RDS
echo "[3/5] Criando banco attackzap_saas na AWS RDS..."
docker run --rm mysql:8 mysql \
  -h database-1.c5yjijbhddcp.us-east-1.rds.amazonaws.com \
  -u root \
  -pcjkhqobnbp8bmyrehuwihow5hgjucub4dpwi7gwgn \
  -e "CREATE DATABASE IF NOT EXISTS attackzap_saas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "       Banco criado!"

# 3. Build e start dos containers
echo "[4/5] Construindo e iniciando containers..."
docker-compose up -d --build

# 4. Verificar
echo "[5/5] Verificando status..."
sleep 5
docker-compose ps

echo ""
echo "========================================="
echo "  Deploy concluído!"
echo "  Frontend: http://$(curl -s ifconfig.me):8080"
echo "  Backend:  http://$(curl -s ifconfig.me):3001"
echo "========================================="
