# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PineApple Travel Agency is a full-stack MERN application (MongoDB, Express, React, Node.js) for booking travel packages. It features user authentication, package management, order/reservation systems, an interactive map with destinations, and admin functionality.

## Architecture

**Frontend** (React 17, Create React App):
- Single-page application with React Router for navigation
- Components organized by feature domain in `src/components/` (login-and-signup-components, package-components, orders-components, etc.)
- State managed within components; uses React Context for homepage
- UI libraries: React Bootstrap, FontAwesome, Leaflet (maps), MDBReact
- API communication via Axios (proxied to backend in development)

**Backend** (Express.js):
- Modular architecture with feature-based routers in `server/routers/`
- Main app configuration in `server/app-source.js`
- Two server entry points:
  - `server/dev-app.js`: Development server, serves from `/public` on port 3001
  - `server/app.js`: Production server, serves built React app from `/build`
- MongoDB with Mongoose ODM; connection initialized in `server/database/mongoclient.js`
- CORS enabled; body-parser middleware for JSON

**Database**: MongoDB with collections for users, admins, packages, orders, customers, messages

**Testing**: Jest with Supertest for API integration tests; React Testing Library for frontend tests

## Common Development Commands

- `npm run dev` - Start both frontend (port 3000) and backend (port 3001) concurrently with hot reload
- `npm run server` - Start only the backend server (development mode)
- `npm run client` - Start only the React frontend (development mode)
- `npm start` - Start production server (serves built frontend)
- `npm run build` - Build React app for production (outputs to `server/build/`)
- `npm test` - Run all tests (backend Jest + frontend tests concurrently)
- `npm run lint` - Run ESLint with zero warnings
- `npm run format` - Fix ESLint issues and format code with Prettier

**Running a single test**: Modify the test command or use Jest directly with `npx jest <test-file>`; see `npm test` script for the exact configuration with environment variables.

## Environment Configuration

- Development server uses env file: `./config/dev.env`
- Test suite uses env file: `./test/test.env` with `MONGODB_URL` and `DATABASE_NAME`
- Backend runs on port 3001 by default; frontend proxies API requests to it (see `package.json` "proxy" field)
- Heroku: uses `heroku-postbuild` script to build frontend on deployment

## Code Style

- ESLint extends react-app rules; parser is babel-eslint
- Prettier configured in `.eslintrc.json`:
  - 80 character print width
  - Semi-colons: **disabled**
  - Single quotes (including JSX)
  - Use tabs for indentation
  - Trailing commas: ES5
- Always run `npm run format` before committing

## Important Files

- `server/app-source.js` - Central Express app; all routers registered here
- `server/routers/` - API endpoint handlers (user, admin, package, order, customers, email, messages, agents-admins)
- `src/App.js` - Main React component with route definitions
- `src/components/` - Feature-based component directories
- `.circleci/config.yml` - CI pipeline: install, test, lint, format

## Notes

- The proxy in `package.json` ensures API calls from React (`/api/*`) are forwarded to `http://localhost:3001` in development
- Production build is placed in `server/build/` and served statically by Express
- Tests create and clean up test data in MongoDB; ensure your local MongoDB instance is running
