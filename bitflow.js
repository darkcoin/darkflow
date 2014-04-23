var bitflow = require('./bitflow-server');

// start the application
var bitflow = new bitflow.BitflowServer({
    port : 1337, // port for the web server
    debug : false, // true or false
    network : 'livenet', // livenet or testnet
})

var memory_interval = setInterval(function(){
    console.log( process.memoryUsage() );
}, 1000);

