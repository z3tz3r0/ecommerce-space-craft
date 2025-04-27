# Spacecraft E-commerce App

## Description

A full-stack e-commerce proof-of-concept application for Browse and managing a simulated inventory of spacecraft. Built primarily as a learning project over a weekend sprint (April 26-27, 2025), focusing on React, TypeScript, Material UI for the frontend, and Node.js/Express/MongoDB for the backend.

## Live Demo

- **Frontend (Vercel):** [https://ecommerce-space-craft.vercel.app](https://ecommerce-space-craft.vercel.app)
- **Backend API Base (Render):** [https://spacecraft-api-z3tz3r0.onrender.com](https://spacecraft-api-z3tz3r0.onrender.com)

## Features Implemented

- View a list of available spacecraft products from API.
- View detailed information for a single spacecraft.
- Add items to a client-side shopping cart.
- View the shopping cart contents.
- Update item quantities within the cart (respecting stock).
- Remove individual items from the cart.
- Clear the entire cart.
- API CRUD operations for products (GET all, GET one, POST, PUT, DELETE).
- Snackbar notifications for cart actions (Add, Remove, Update, Clear).
- Basic responsive design using Material UI components.
- Basic Homepage and Navigation.

## Tech Stack

- **Frontend:**
  - Vite
  - React v18+
  - TypeScript
  - Material UI (MUI) v5
  - React Router v6
  - Context API (for Cart & Snackbar)
  - Fetch API
  - `@fontsource/roboto`
- **Backend:**
  - Node.js
  - Express
  - Mongoose
  - MongoDB Atlas (Cloud Database)
  - `cors`
  - `dotenv`
- **Deployment:**
  - Frontend: Vercel
  - Backend: Render (Free Tier)
- **Development:**
  - Git / GitHub
  - VS Code
  - Postman/Insomnia (API testing)
  - npm

## Getting Started / Local Setup

### Prerequisites

- Node.js (v18 or later recommended)
- npm (usually comes with Node.js)
- Git
- MongoDB Atlas Account & Cluster (needed for the connection string)

### Installation & Running

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/z3tz3r0/ecommerce-space-craft.git
    cd ecommerce-space-craft
    ```

2.  **Backend Setup:**

    ```bash
    cd backend
    npm install
    ```

- Create a `.env` file in the `backend` directory.
- Add your environment variables:

  ```dotenv
  # Example backend/.env
  PORT=5000
  MONGO_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@YOUR_CLUSTER/YOUR_MONGO_DATABASE?retryWrites=true&w=majority
  # NODE_ENV=development (Optional for local)
  ```

- Start the backend server:
  ```bash
  npm run dev
  ```

3.  **Frontend Setup:**

    ```bash
    cd ../frontend # Or from root: cd frontend
    npm install
    ```

- Create a `.env` file in the `frontend` directory.
- Add the environment variable pointing to your _local_ backend:
  ```dotenv
  # frontend/.env
  VITE_API_URL=http://localhost:5000
  ```
- Start the frontend development server:
  ```bash
  npm run dev
  ```
  _(Frontend should be running on http://localhost:5173 or similar)_

4.  Open your local frontend URL (e.g., `http://localhost:5173`) in your browser.

## API Endpoints (Backend)

- `GET /api/products`: Fetches all products.
- `GET /api/products/:id`: Fetches a single product by its ID.
- `POST /api/products`: Creates a new product (expects product data in JSON body).
- `PUT /api/products/:id`: Updates a product by its ID (expects updated data in JSON body).
- `DELETE /api/products/:id`: Deletes a product by its ID.

## Known Issues / Future Ideas

- **(Deferred)** Direct access to frontend routes (e.g., `/products`, `/cart`) on the deployed Vercel site currently results in a 404 error. Requires SPA rewrite configuration on Vercel.
- No user authentication or persistent carts.
- No payment processing.
- No admin interface for managing products via UI.
- Basic loading and error state visuals.
- Further UI/UX polish desired.
