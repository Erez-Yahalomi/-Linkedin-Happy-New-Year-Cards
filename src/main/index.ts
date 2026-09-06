import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import { chooseModelFile, disposeModel, downloadModel, generateGreeting, getModelState } from "./gemma-service.js";
import { importProfilePdf } from "./profile-pdf-service.js";
import type { ProfileInput } from "../shared/contracts.js";

let mainWindow: BrowserWindow | undefined;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 980,
    minHeight: 700,
    show: false,
    backgroundColor: "#f7f3ec",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.local.gemmagreetings");
  ipcMain.handle("model:state", () => getModelState());
  ipcMain.handle("model:download", () => downloadModel());
  ipcMain.handle("model:choose", () => chooseModelFile());
  ipcMain.handle("profile:import-pdf", () => importProfilePdf());
  ipcMain.handle("greeting:generate", (_event, profile: ProfileInput) => generateGreeting(profile));
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  void disposeModel();
});
