var fs = require('fs');
var fileserver = require('node-static');
var file = new fileserver.Server('./static/');

// html index
var handle_index = function(request, response) {

    file.serve(request, response, function (err, res) {
        if (err) { // An error as occured
            console.error("> Error serving " + request.url + " - " + err.message);
            response.writeHead(err.status, err.headers);
            response.end();
        } else { // The file was served successfully
            console.log("> " + request.url + " - " + res.message);
        }
    });

}
// load server
var app = require('http').createServer(handle_index)
var io = require('socket.io').listen(app)

// load bitcoin
var bitcore = require('bitcore');
var Address = bitcore.Address;
var util = bitcore.util;
var Script = bitcore.Script;
var dns = require('dns');
var networks = bitcore.networks;
var network = networks.livenet;
var Peer = bitcore.Peer;

app.listen(1337);

var websockets = [];

io.sockets.on('connection', function (websocket) {
	websockets.push( websocket );
	websocket.emit('news', { hello: 'world' });
	websocket.on('end', function () {
		var i = websockets.indexOf(socket)
		websockets.splice(i, 1)
	});
});

var handle_block = function(info) {
    console.log('** Block Received **');

	for ( var i = 0; i < websockets.length; i++ ) {
		websockets[i].emit('block', { message: info.message });
	}

//    console.log(info.message);
};

var handle_tx = function(info) {
    
//    var tx = info.message.tx.getStandardizedObject();

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

	for ( var i = 0; i < websockets.length; i++ ) {
		websockets[i].emit('tx', { hash: hash, outputs: outputs });
	}

};

var handle_inv = function(info) {
    console.log('** Inv **');
//    console.log(info.message);

	for ( var i = 0; i < websockets.length; i++ ) {
		websockets[i].emit('inv', { message: info.message });
	}

    var invs = info.message.invs;
    info.conn.sendGetData(invs);
};

var peerman = new bitcore.PeerManager( { network: networks.livenet } );
peerman.on('connection', function(conn) {
    conn.on('inv', handle_inv);
//    conn.on('block', handle_block);
    conn.on('tx', handle_tx);
});

//seeds
//bitseed.xf2.org
//bitseed.bitcoin.org.uk
//dnsseed.bluematt.me

dns.resolve4('dnsseed.bluematt.me', function(error, addresses){
    addresses.forEach(function(address){
        peerman.addPeer(new Peer(address, 8333));
    })
})

peerman.start();


