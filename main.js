const electron = require('electron');
const binance = require('node-binance-api');
const {ipcMain} = require('electron');
const fs = require("fs");

// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;
const Menu = electron.Menu;
const path = require('path');
const url = require('url');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
var apicache = require("./apicache.json");
function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 900, height: 800})

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))
  mainWindow.setResizable(false);
  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
  
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function(){
  createWindow();
  Menu.setApplicationMenu(null);



});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// Authentication

ipcMain.on('apiAuth', (event,arg) => {
  console.log("Authenticating...");
  
  binance.options({
    APIKEY: arg[0],
    APISECRET: arg[1],
    useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
    test: false, // Add extra output when subscribing to websockets, etc
    log: log => {
      console.log(log); // You can create your own logger here, or disable console output
    }
  });
  binance.balance((error, balances) => {
    try{
    if(!balances.BTC){
      throw "Authentication Failed !";
    }else{
      console.log("Success");
      event.sender.send('auth_ok');
      fs.writeFile( "apicache.json", JSON.stringify(arg) , "utf8",function(){
        console.log('cached');
      });
    }
    }
      catch(err){
        console.log(err.message);
        event.sender.send('auth_error');
      }
  });
  
});
// Writing...

// And then, to read it...

// Type of symbol BTC / ETH / BNB / USDT

function pairType(pair){
  if(pair.slice(pair.length-4,pair.length) == "USDT"){
    return "USDT";
  }else{
    return pair.slice(pair.length-3,pair.length);
  }
}

function coinType(pair){
  return pair.slice(0,pair.length - pairType(pair).length);
}

function sendOpenOrders(){
  binance.openOrders(false, (error, openOrders) => {
    mainWindow.webContents.send('orderbook',openOrders);
  });
}
binance.prices((error, ticker) => {
  mainWindow.webContents.send('apicache',apicache);
  mainWindow.webContents.send('ticker',ticker);
  console.log('ticker');
});
ipcMain.on('reqTicker',(event, arg) => {
  binance.prices(arg, (error, ticker) => {
      event.sender.send('resTicker', ticker[arg]);
      console.log(ticker[arg]);
  });
  binance.balance((error, balances) => {
    console.log(coinType(arg)+" balance: ", balances[coinType(arg)].available);
    console.log(pairType(arg)+" balance: ", balances[pairType(arg)].available);
    event.sender.send('balance', [[coinType(arg),balances[coinType(arg)].available],[pairType(arg),balances[pairType(arg)].available]]);
  });
  sendOpenOrders();
});

//Ordering

ipcMain.on('buy_limit', (event,arg) => {
  binance.buy(arg[0],arg[1],arg[2],{type:'LIMIT'}, (error, response) => {
    if(error){
      event.sender.send("alert","Error : "+error.body);
    }else if(response){
      event.sender.send('alert',"Order status : "+response.status);
    }else{
      event.sender.send('alert',"Insufficient balance..");
    }
    event.sender.send('refresh');
    console.log(response);
    if(error) console.log(error.body);
  });
});
ipcMain.on('sell_limit', (event,arg) => {
  binance.sell(arg[0],arg[1],arg[2],{type:'LIMIT'}, (error, response) => {
    if(error){
      event.sender.send("alert","Error : "+error.body);
    }else if(response){
      event.sender.send('alert',"Order status : "+response.status);
    }else{
      event.sender.send('alert',"Insufficient balance..");
    }
    event.sender.send('refresh');
    console.log(response);
    if(error) console.log(error.body);
  });
});
ipcMain.on('buy_market', (event,arg) => {
  binance.marketBuy(arg[0],arg[1], (error, response) => {
    if(error){
      event.sender.send("alert","Error : "+error.body);
    }else if(response){
      event.sender.send('alert',"Order status : "+response.status);
    }else{
      event.sender.send('alert',"Insufficient balance..");
    }
    event.sender.send('refresh');
    console.log(response);
    if(error) console.log(error.body);
  });
});
ipcMain.on('sell_market', (event,arg) => {
  binance.marketSell(arg[0],arg[1], (error, response) => {
    if(error){
      event.sender.send("alert","Error : "+error.body);
      
    }else if(response){
      event.sender.send('alert',"Order status : "+response.status);
    }else{
      event.sender.send('alert',"Insufficient balance..");
    }
    event.sender.send('refresh');
    console.log(response);
    if(error) console.log(error.body);
  });
});

ipcMain.on('cancelOrder', (event,arg)=>{
  binance.cancel(arg[0], arg[1], (error, response, symbol) => {
    console.log(symbol+" cancel response:", response);
    event.sender.send('alert',"Order canceled !");
    event.sender.send('refresh');
  });
});

ipcMain.on('cancelAll', (event,arg)=>{
  binance.openOrders(false, (error, openOrders) => {
    for(var i = 0;i<openOrders.length;i++){
      binance.cancel(openOrders[i].symbol, openOrders[i].orderId, (error, response, symbol) => {
        console.log(symbol+" cancel response:", response);
      });
    }
    event.sender.send('alert',"All orders canceled !");
    event.sender.send('refresh');
  });
});

ipcMain.on('getBalances', (event,arg)=>{
  binance.balance((error, balances) => {
    event.sender.send('balancesbook',balances);
  });
});