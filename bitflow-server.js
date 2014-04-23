var fs = require('fs');
var fileserver = require('node-static');
var bitcore = require('bitcore');
var Address = bitcore.Address;
var util = bitcore.util;
var Script = bitcore.Script;
var dns = require('dns');
var http = require('http');
var socket = require('socket.io');
var networks = bitcore.networks;
var Peer = bitcore.Peer;

exports.BitflowServer = function(config) {

    // init variables

    var known_tx_hashes = {},
    known_tx_hashes_max_length = 5000,
    known_tx_hashes_length = 0,
    network = null,
    app = null,
    io = null,
    peermanager = null,
    server = null,
    websockets = [];

    // define functions

    var handle_socket_connection = function(websocket) {
        websockets.push( websocket );
        websocket.on('end', function () {
            var i = websockets.indexOf(socket)
            websockets.splice(i, 1)
        });
    }

    var handle_peer_connection = function(conn){
        conn.on('inv', handle_inv);
        conn.on('tx', handle_tx);
    }

    var handle_index = function(request, response) {
        server.serve(request, response, function (err, res) {
            if (err) { // An error as occured
                console.error("> Error serving " + request.url + " - " + err.message);
                response.writeHead(err.status, err.headers);
                response.end();
            } else { // The file was served successfully
                console.log("> " + request.url + " - " + res.message);
            }
        })
    }

    var handle_tx = function(info) {

        var tx = info.message.tx;

        var outputs = [];

        for (var i=0; i < tx['outs'].length; i++ ) {

            var s = new Script(tx['outs'][i].s);
            var v = tx['outs'][i].v;

            var addr_strs = [];
            var type = s.classify();
            var addr;

            switch (type) {
            case Script.TX_PUBKEY:
                var chunk = s.captureOne();
                addr = new Address(network.addressVersion, util.sha256ripe160(chunk));
                addr_strs.push(addr.toString());
                break;
            case Script.TX_PUBKEYHASH:
                addr = new Address(network.addressVersion, s.captureOne());
                addr_strs.push(addr.toString());
                break;
            case Script.TX_SCRIPTHASH:
                addr = new Address(network.P2SHVersion, s.captureOne());
                addr_strs.push(addr.toString());
                break;
            case Script.TX_MULTISIG:
                var chunks = s.capture();
                chunks.forEach(function(chunk) {
                    var a = new Address(network.addressVersion, util.sha256ripe160(chunk));
                    addr_strs.push(a.toString());
                });
                break;
            case Script.TX_UNKNOWN:
                console.log('tx type unkown');
                break;
            }

            outputs.push( { addresses : addr_strs, value : util.formatValue(v) } );
        }

        var hash = util.formatHashFull(tx.getHash());

        if ( known_tx_hashes[hash] == undefined ) {

            // do not use too much memory
            if ( known_tx_hashes_length >= known_tx_hashes_max_length ) {
                known_tx_hashes = {};
                known_tx_hashes_length = 0;
            } 
            
            known_tx_hashes[hash] = true;
            known_tx_hashes_length++;

            for ( var i = 0; i < websockets.length; i++ ) {
                websockets[i].emit('tx', { hash: hash, outputs: outputs });
            }
        }
    }
    
    var handle_inv = function(info) {

    	for ( var i = 0; i < websockets.length; i++ ) {
    		websockets[i].emit('inv', { message: info.message });
    	}
        var invs = info.message.invs;
        info.conn.sendGetData(invs);
    }

    // initialize

    server = new fileserver.Server(  __dirname + '/bitflowui/' );
    app = http.createServer(handle_index)
    io = socket.listen(app)
    app.listen( config['port'] );

    if ( config['network'] == 'livenet' ) {
        network = networks.livenet;
    } else if ( config['network'] == 'testnet' ) {
        network = networks.testnet;
    }

    io.sockets.on('connection', handle_socket_connection );
    peermanager = new bitcore.PeerManager( { network: network } );
    peermanager.on('connection', handle_peer_connection );
    
    //seeds
    //bitseed.xf2.org
    //bitseed.bitcoin.org.uk
    //dnsseed.bluematt.me
        
    //todo: discover in a better way        

    dns.resolve4('dnsseed.bluematt.me', function(err, addresses){
        addresses.forEach(function(address){
            peermanager.addPeer(new Peer(address, 8333));
        })    
    });    
    
    peermanager.start();

}
