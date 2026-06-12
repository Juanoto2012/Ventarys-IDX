// Archivo principal de Electron
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
    // Crear la ventana del navegador.
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        titleBarStyle: 'hidden', // Oculta la barra de título nativa para un look más moderno
        titleBarOverlay: {
            color: '#252526', // Color de la barra superior (estilo VS Code)
            symbolColor: '#ffffff', // Color de los botones de cerrar/minimizar
            height: 40
        },
        webPreferences: {
            nodeIntegration: true, // Permite usar Node.js en el renderizador
            contextIsolation: false
        },
        icon: path.join(__dirname, 'assets', 'logo.png')
    });

    // Oculta el menú por defecto
    mainWindow.setMenuBarVisibility(false);

    // Cargar el index.html de la aplicación.
    mainWindow.loadFile('index.html');

    // Handle quit app request from updater
    ipcMain.on('quit-app', () => {
        console.log('Quit app requested by updater');
        if (mainWindow) {
            mainWindow.close();
        }
    });
}

// Este método se llamará cuando Electron haya finalizado la inicialización
app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Salir cuando todas las ventanas estén cerradas, excepto en macOS.
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});