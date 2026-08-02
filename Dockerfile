# ============================================================================
# Image de production — VOIE ALTERNATIVE
# ----------------------------------------------------------------------------
# Le chemin recommandé reste S3 + CloudFront (infra/) : l'application est un
# site statique, un conteneur n'y apporte rien et coûte davantage.
#
# Cette image sert à deux choses concrètes :
#   · vérifier EN LOCAL le comportement de production — repli SPA, types MIME,
#     en-têtes — avant de payer un déploiement pour le découvrir ;
#   · disposer d'une porte de sortie si le projet doit un jour tourner sur
#     ECS, App Runner, Scaleway ou un simple VPS.
#
#   docker build -t musea \
#     --build-arg VITE_SUPABASE_URL=... \
#     --build-arg VITE_SUPABASE_ANON_KEY=... .
#   docker run --rm -p 8080:8080 musea
# ============================================================================

# ---------------------------------------------------------------- compilation
FROM node:20-alpine AS build

WORKDIR /app

# Les dépendances d'abord : cette couche est réutilisée tant que les
# verrouillages ne bougent pas, ce qui évite de tout réinstaller à chaque build.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inscrit ces valeurs DANS le bundle : elles doivent exister à la
# compilation. Les fournir au `docker run` n'aurait aucun effet.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_PLATFORM_DOMAIN
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_PLATFORM_DOMAIN=$VITE_PLATFORM_DOMAIN

RUN npm run build \
    && test -f dist/index.html \
    && test -f dist/modeles/tabouret.glb

# ------------------------------------------------------------------ diffusion
FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Port non privilégié : le conteneur tourne sans root.
EXPOSE 8080

# nginx a besoin d'écrire ses fichiers temporaires ; on lui en donne le droit
# sans lui rendre le reste du système accessible.
RUN chown -R nginx:nginx /var/cache/nginx /var/run /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid
USER nginx

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
