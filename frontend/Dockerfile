FROM node:20-alpine

WORKDIR /app

# Installer les dépendances
COPY package*.json .
RUN npm install

# Copier le code source
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]