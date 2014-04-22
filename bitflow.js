var bitflow = require('./bitflow-server');

// start the application
var bitflow = new bitflow.BitflowServer({
    port : 1337, // port for the web server
    network : 'livenet', // livenet or testnet
})