# Use Node.js 20 LTS Alpine para imagem mais leve
FROM node:20-alpine

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar todo o código da aplicação
COPY . .

# Expor porta 3007(conforme vite.config.ts)
EXPOSE 3007

# Comando para iniciar o servidor de desenvolvimento
CMD ["npm", "run", "dev"]