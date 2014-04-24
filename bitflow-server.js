var fs = require('fs');
var express = require('express');
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

    // defaults

    if ( config['host'] == undefined )
        config['host'] = 'http://127.0.0.1';
    if ( config['port'] == undefined )
        config['port'] = '80';
    if ( config['debug'] == undefined )
        config['debug'] = false;
    if ( config['network'] == undefined ) 
        config['network'] = 'livenet';


    // init variables
    var site_url,
    known_tx_hashes = {},
    known_tx_hashes_max_length = 5000,
    known_tx_hashes_length = 0,
    network = null,
    web = null,
    app = null,
    io = null,
    peermanager = null,
    server = null,
    websockets = [];

    if ( config['port'].toString() != '80' ) {
        site_url = config['host']+':'+config['port'];
    } else {
        site_url = config['host'];
    }

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

    web = express();
    web.set('views', __dirname + '/bitflowui');
    web.set('view engine', 'ejs');
    web.get('/', function(req, res, next){
        res.render('index.ejs', { site_url: site_url }, function(err, html){
            res.send(html);
        });
    });
    web.use('/static', express.static(__dirname + '/bitflowui'));
    app = http.createServer(web);
    io = socket.listen(app, {log: config['debug']} );
    app.listen( config['port'] );

    if ( config['network'] == 'livenet' ) {
        network = networks.livenet;
    } else if ( config['network'] == 'testnet' ) {
        network = networks.testnet;
    }

    io.sockets.on('connection', handle_socket_connection );
    peermanager = new bitcore.PeerManager( { network: network } );
    peermanager.on('connection', handle_peer_connection );

    if ( peermanager.discover != undefined ) {

        // only available in versions > 0.1.12
        peermanager.discover({ limit: 12 }).start();

    } else {
    
        //bitseed.xf2.org
        //bitseed.bitcoin.org.uk
        //dnsseed.bluematt.me
        
        dns.resolve4('dnsseed.bluematt.me', function(err, addresses){
            addresses.forEach(function(address){
                peermanager.addPeer(new Peer(address, 8333));
            })    
        });    
    
        peermanager.start();
    }

}
