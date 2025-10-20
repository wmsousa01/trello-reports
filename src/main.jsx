import React from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "./dashboard.jsx";

const t = window.TrelloPowerUp.iframe();

const root = createRoot(document.getElementById("root"));
root.render(<Dashboard t={t} />);
