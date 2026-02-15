import { App } from "./app";
import "./style.css";

/**
 * Application entry point.
 * Waits for DOM to be ready, then initializes the App.
 */
document.addEventListener("DOMContentLoaded", () => {
  new App();
});

