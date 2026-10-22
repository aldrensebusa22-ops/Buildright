# BuildRight — Single VS Code Window

## What changed
- `frontend/` contains the React + Vite application from the frontend ZIP.
- `backend/` contains the existing Node.js/Express API.
- The root `package.json` runs both dev servers from one integrated terminal using `concurrently`.
- The original `frontend/customer-order/` subproject is preserved, but the root startup command launches the main React app in `frontend/`.

## Run it
1. Extract this ZIP.
2. Open the extracted **BuildRight-Single-Window** folder in one VS Code window (`File > Open Folder`).
3. Ensure Node.js and npm are installed.
4. In VS Code, open one integrated terminal at the project root and run:

   ```bash
   npm install
   npm install --prefix frontend
   npm install --prefix backend
   npm run dev
   ```

5. Open the Vite URL shown in the terminal (usually `http://localhost:5173`). The backend listens at `http://localhost:5000`.

## MySQL
The existing `backend/server.js` configuration connects to a local MySQL database named `buildright_hardware` with user `root` and an empty password. Make sure MySQL is running and that this database and its expected tables exist. If your local MySQL credentials differ, update the pool configuration in `backend/server.js` before running.

## Notes
- Both applications remain separate folders, but they can be opened and managed in the same VS Code window and started with one command.
- `node_modules` were excluded from the ZIP; npm will reinstall dependencies.
- The backend code and existing API routes were preserved. This package only adds root-level startup orchestration and a backend npm script.
