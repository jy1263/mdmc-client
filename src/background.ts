'use strict'

import path from 'path'
import { app, protocol, BrowserWindow, ipcMain, dialog } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
const isDevelopment = process.env.NODE_ENV !== 'production'

let win: BrowserWindow;

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

async function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: (process.env
          .ELECTRON_NODE_INTEGRATION as unknown) as boolean,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
      preload: path.join(__dirname, "preload.js")
    },
  })

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL as string)
    if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    createProtocol('app')
    // Load the index.html when not in development
    win.loadURL('app://./index.html')
  }
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS_DEVTOOLS)
    } catch (e:any) {
      console.error('Vue Devtools failed to install:', e.toString())
    }
  }
  createWindow()
  libraryScan()
})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}

// custom code
import Store from "electron-store";

const store = new Store();

import axios from "axios"

import fs from 'fs';
import { Chart } from '@/types/chart'
import JSZip, { remove } from "jszip";

import { API } from './modules/api'
const api = new API();
import uniqid from 'uniqid'

import async, { doWhilst } from 'async'
import getRawBody from 'raw-body'
import { WriteStream } from 'original-fs'

// library scanning
let library: Chart[] = [];
store.events.on("change", (key: string) => {
  if(key == "gamePath") {
    libraryScan()
  }
})
function libraryScan() {
  library = []
  const gamePath = store.get("gamePath") as string;
  console.log(`scanning: ${gamePath}`)
  if (gamePath) {
    fs.readdirSync(gamePath).forEach(async file => {
      if (file.endsWith(".mdm")) {
        const zip = new JSZip();
        try {
          const localPath = path.join(gamePath, file);
          const zipfile = await zip.loadAsync(fs.readFileSync(localPath));
          let tempChartFile = {
            isLocal: true,
            localPath: localPath
          } as Chart
          for (const [name, file] of Object.entries(zipfile.files)) {
            if (name.endsWith(".png")) {
              tempChartFile.b64Cover = await file.async("base64");
            }
            if (name.endsWith(".json")) {
              Object.assign(tempChartFile, JSON.parse(await file.async("string")) as Chart);
            }
          }
          library.push(tempChartFile)
        }
        catch {
          console.error(`failed to load chart: ${file}`)
        }
      }
    });
    console.log(`scan complete: ${gamePath}`)
  }
}

//handlers
ipcMain.on('library-get', (event) => {
  event.returnValue = library;
})
ipcMain.handle('request-get', async (_, axios_request: string | any) => {
  const result = await axios(axios_request)
  return { data: result.data, status: result.status }
})

// IPC listener
ipcMain.on("electron-store-get", async (event, val) => {
  event.returnValue = store.get(val);
});
ipcMain.on("electron-store-set", async (event, key, val) => {
  store.set(key, val);
});

ipcMain.on('dialog-open', (event) => {
  try {
    event.returnValue = dialog.showOpenDialogSync({
      properties: ['openDirectory']
    })
  }
  catch {
    event.returnValue = null
  } 
})

// download
const axiosDownloadInst = axios.create({
  baseURL: `${api.getChartDownloadBaseUrl()}`,
  timeout: 60000,
  responseType: "stream"
});
let downloads: async.QueueObject<Chart> = async.queue((chart: Chart, cb) => {
  win.webContents.send("download-changed", getAllDownloads())
  try {
    console.log("Starting Download > " + api.getChartDownloadUrl(chart.id as number));
    axiosDownloadInst.get(`${chart.id}`).then( async resp => {
      var len = 0;
      resp.data.on("data", function (chunk:Uint8Array) {
        len += chunk.length;
        win.webContents.send("download-prog", len, 100*(len/20971520))
      });
      const buf = Buffer.from(await getRawBody(resp.data, {
        encoding: "ascii"
      }), "base64")
      fs.writeFileSync(path.join(store.get("gamePath") as string, chart.id + ".mdm"), buf);
      cb()
    })
  }
  catch {
    console.error("Failed Download > " + chart.name);
    cb(Error("Download failed"))
  }
}, 1);

downloads.drain(() => {
  win.webContents.send("download-changed", getAllDownloads())
  console.log("All downloads finished");
});

ipcMain.on("download-add", (event, chart: Chart) => {
  win.webContents.send("download-changed", getAllDownloads())
  console.log("Added Download > " + chart.name);
  downloads.push(chart);
});

ipcMain.on("download-getAll", (event) => {
  event.returnValue = getAllDownloads();
});

function getAllDownloads() {
  return downloads.workersList().map(w => w.data);
}