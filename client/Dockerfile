FROM node:22-alpine

WORKDIR /app

# install dependencies
COPY package*.json ./
RUN npm ci

# copy source
COPY . .

# build frontend
RUN npm run build

# expose port
EXPOSE 3000

# start unified server
CMD ["npm", "run", "start"]
