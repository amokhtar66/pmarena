FROM node:20

WORKDIR /app

# Copy package.json and package-lock.json/pnpm-lock.yaml
COPY package*.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install

# Copy the rest of the application code
COPY . .

# Build TypeScript
RUN pnpm build

# Expose the port your app runs on
EXPOSE 3000

# Environment variables should be set in Railway dashboard
# DO NOT hardcode sensitive credentials here

# Start the application with the dev parameter
CMD ["node", "dist/agent.js", "dev"] 