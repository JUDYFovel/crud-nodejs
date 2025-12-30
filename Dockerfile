# Utiliser l'image Node 20 alpine (compatible avec votre package.json)
FROM node:20-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier uniquement les fichiers de dépendances d'abord (optimisation du cache)
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste du projet
COPY . .

# Exposer le port sur lequel l'application écoute
EXPOSE 3000

# Commande pour démarrer l'application
CMD ["node", "app.js"]
