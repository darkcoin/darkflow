var bitflow = require('./bitflow-server');

// start the application
var bitflow = new bitflow.BitflowServer({
    port : 8080, // port for the web server
    debug : false, // true or false
    network : 'livenet', // livenet or testnet
})
