FROM node:18-alpine

WORKDIR /app

# Install dependencies including TypeScript globally
RUN npm install -g typescript

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm install --include=dev

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 8081

# Start command
CMD ["npm", "start"] 