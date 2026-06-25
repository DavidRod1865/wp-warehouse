# Warehouse - Sortly Inventory Management

A React + TypeScript + Vite application that displays inventory items from the Sortly API.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Sortly API Credentials

Create a `.env` file in the root directory with your Sortly API secret key:

```env
VITE_SORTLY_SECRET_KEY=your_secret_key_here
```

**To get your API credentials:**
1. Visit: https://app.sortly.com/public-api to obtain an API access key pair for your account
2. Copy your **Secret Key** (this is used as the Bearer token for OAuth 2.0 authentication)
3. Add it to your `.env` file as `VITE_SORTLY_SECRET_KEY`

**Note:** The Sortly API uses OAuth 2.0 authentication. Only the secret key is required as it's used as the Bearer token in the Authorization header.

### 3. Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the port shown in the terminal).

## Features

- Fetches and displays all items from your Sortly inventory
- Responsive grid layout with Tailwind CSS
- Loading and error states
- Displays item details including:
  - Name and SKU
  - Quantity
  - Description
  - Images
  - Folder information
  - Low stock indicators

## Build for Production

```bash
npm run build
```

---

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
