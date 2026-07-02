/**
 * Service Layer — platform-agnostic abstractions.
 * Each service exports a singleton with a stable interface so a Capacitor
 * implementation can replace the Web one without touching UI code.
 */
export { haptics } from "./haptics";
export { share } from "./share";
export { notifications } from "./notifications";
export { storage } from "./storage";
export { camera } from "./camera";
export { biometric } from "./biometric";
export { files } from "./files";