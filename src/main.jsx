import React from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "./dashboard.jsx";

// Extrai parâmetros da URL
const params = new URLSearchParams(window.location.search);
const boardId = params.get("boardId");
const mode = params.get("mode");
const access = params.get("access");

// Passa via props, sem usar TrelloPowerUp.iframe()
const root = createRoot(document.getElementById("root"));
root.render(<Dashboard boardId={boardId} mode={mode} access={access} />);