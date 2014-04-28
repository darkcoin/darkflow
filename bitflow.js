var bitflow = require('./bitflow-server');

var config = {
    host : 'http://127.0.0.1', // host for the web server
    port : '8080', // port for the web server
    debug : false, // true or false
    network : 'livenet', // livenet or testnet
    max_peers : 6
}

if ( process.env['BITFLOW_HOST'] )
    config['host'] = process.env['BITFLOW_HOST'];
if ( process.env['BITFLOW_PORT'] )
    config['port'] = process.env['BITFLOW_PORT'];

var bitflow = new bitflow.BitflowServer(config);
