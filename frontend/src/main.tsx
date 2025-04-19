import CssBaseline from "@mui/material/CssBaseline";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

// Add these lines for Roboto font weights:
import { ThemeProvider } from "@emotion/react";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css"; // Regular
import "@fontsource/roboto/500.css"; // Medium
import "@fontsource/roboto/700.css"; // Bold
import { createTheme } from "@mui/material";

import { BrowserRouter } from "react-router-dom";

const theme = createTheme({});

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BrowserRouter>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <App />
            </ThemeProvider>
        </BrowserRouter>
    </StrictMode>
);
