/**
 * Camera service — file-input based capture on Web. Capacitor Camera ready.
 */
export type CameraSource = "camera" | "gallery";

export interface CameraService {
  pickImage(source?: CameraSource): Promise<File | null>;
}

export const camera: CameraService = {
  pickImage(source = "gallery") {
    return new Promise((resolve) => {
      if (typeof document === "undefined") return resolve(null);
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      if (source === "camera") input.setAttribute("capture", "environment");
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.oncancel = () => resolve(null);
      input.click();
    });
  },
};