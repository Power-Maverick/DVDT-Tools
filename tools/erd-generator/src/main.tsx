import "@xyflow/react/dist/style.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const applyThemeClass = (theme: string) => {
    if (theme === "dark") {
        document.body.classList.add("dark-theme");
    } else {
        document.body.classList.remove("dark-theme");
    }
};

const resolveTheme = async () => {
    if (window.toolboxAPI) {
        const currentTheme = await window.toolboxAPI.utils.getCurrentTheme();
        applyThemeClass(currentTheme);
    }
};

const themeEventHandler = (_event: any, payload: any) => {
    if (payload.event !== "settings:updated") return;

    const theme = (payload.data as { theme?: string }).theme;
    if (theme) {
        applyThemeClass(theme);
    } else {
        resolveTheme();
    }
};

const registerToolboxEvents = () => {
    if (window.toolboxAPI) {
        window.toolboxAPI.events.on(themeEventHandler);
    }
};

// Apply initial theme
resolveTheme();

// Register event handler
registerToolboxEvents();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
