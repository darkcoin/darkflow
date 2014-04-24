var bitflow = require('./bitflow-server');

// start the application
var bitflow = new bitflow.BitflowServer({
    host : 'http://127.0.0.1', // host for the web server
    port : '80', // port for the web server
    debug : false, // true or false
    network : 'livenet', // livenet or testnet
    max_peers : 6
})
