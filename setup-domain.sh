#!/bin/bash
# =========================================
#  AttackZap - Setup Domain + SSL
#  Run on the Digital Ocean server as root
# =========================================

DOMAIN="attackzap.com"
EMAIL="admin@attackzap.com"

echo "========================================="
echo "  Configurando $DOMAIN com SSL"
echo "========================================="

# 1. Instalar Nginx e Certbot
echo "[1/5] Instalando Nginx e Certbot..."
apt update -y
apt install -y nginx certbot python3-certbot-nginx

# 2. Parar nginx default se estiver rodando
systemctl stop nginx 2>/dev/null

# 3. Criar config do Nginx
echo "[2/5] Configurando Nginx..."
cat > /etc/nginx/sites-available/attackzap <<'NGINX'
server {
    listen 80;
    server_name attackzap.com www.attackzap.com;

    # Redirect www to non-www
    if ($host = www.attackzap.com) {
        return 301 https://attackzap.com$request_uri;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        client_max_body_size 50m;
    }
}
NGINX

# Ativar site e desativar default
ln -sf /etc/nginx/sites-available/attackzap /etc/nginx/sites-enabled/attackzap
rm -f /etc/nginx/sites-enabled/default

# Testar config
nginx -t
if [ $? -ne 0 ]; then
    echo "ERRO: Configuracao do Nginx invalida!"
    exit 1
fi

# 4. Iniciar Nginx
echo "[3/5] Iniciando Nginx..."
systemctl start nginx
systemctl enable nginx

# 5. Gerar certificado SSL
echo "[4/5] Gerando certificado SSL com Let's Encrypt..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m $EMAIL --redirect

if [ $? -ne 0 ]; then
    echo "ERRO: Falha ao gerar SSL. Verifique se o DNS esta apontando para este servidor."
    echo "Teste: dig $DOMAIN +short"
    exit 1
fi

# 6. Auto-renovacao do certificado
echo "[5/5] Configurando renovacao automatica do SSL..."
systemctl enable certbot.timer 2>/dev/null
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | sort -u | crontab -

echo ""
echo "========================================="
echo "  Dominio configurado com sucesso!"
echo ""
echo "  https://attackzap.com"
echo ""
echo "  SSL: Let's Encrypt (renova automatico)"
echo "========================================="
