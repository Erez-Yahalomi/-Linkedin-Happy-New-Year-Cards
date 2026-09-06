import { contextBridge, ipcRenderer } from "electron";
import type { AppApi, ProfileInput } from "../shared/contracts.js";

const api: AppApi = {
  getModelState: () => ipcRenderer.invoke("model:state"),
  downloadModel: () => ipcRenderer.invoke("model:download"),
  chooseModel: () => ipcRenderer.invoke("model:choose"),
  importProfilePdf: () => ipcRenderer.invoke("profile:import-pdf"),
  generateGreeting: (profile: ProfileInput) => ipcRenderer.invoke("greeting:generate", profile),
  onModelProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state as Parameters<typeof callback>[0]);
    ipcRenderer.on("model:progress", listener);
    return () => ipcRenderer.removeListener("model:progress", listener);
  }
};

contextBridge.exposeInMainWorld("gemma", api);
