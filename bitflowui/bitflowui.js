var BitflowUI = function(config){
    // init variables 
    var socket,
        transactions_length, //calculated length of transactions to render
        transactions = [],//transaction data from socket
        transactions_paused = null,//clone of transactions to be used when paused
        paused = false, //boolean if transactions paused
        audio = false, //audio context
        osc = false, //oscillator
        widths = null, //calculated x position and width for each bar in to be graphed
        window_width, 
        window_height,
        hovered_widths_index = false, //currently hovered bar in graph
        selected_widths_index = false; //currently selected bar in graph
    var handle_transaction = function(tx){
        transactions.push( tx );
        while ( transactions.length > transactions_length ) {
            transactions.shift()
        }
        if ( !paused ) {
            render( transactions, tx, canvas[0] );
        }
    }
    // initialize socket        
    socket = io.connect( config['socket'] );
    socket.on('tx', handle_transaction );
    // initialize html 
    var title = $('<div id="title" >Bitcoin Live Transactions</div>');         
    var sound_button = $('<span id="sound">Sound is Off</span>');
    var pause_button = $('<span id="pause">Pause</span>');
    var menu = $('<div id="menu"></div>');
    menu.append(sound_button).append(pause_button);
    var canvas = $('<canvas id="graph" width="150" height="150" title="Click to Pause"></canvas>');
    var incoming = $('<div id="incoming"></div>');
    $('body')
        .append(title)
        .append(menu)
        .append(incoming)
        .append(canvas);
    var calculate_transactions_length = function(){
        window_width = $(window).width();
        window_height = $(window).height();
        transactions_length = Math.round(window_width/2);
        while ( transactions.length < transactions_length ) {
            transactions.splice(0, 0, false);
        }
        while ( transactions.length > transactions_length ) {
            transactions.shift()
        }
        // calculate the x position and width for each bar
        var end_width = 17;
        var start_width = 0.0000004;
        var start_scale = 0.000001;
        var scale_ratio = Math.pow( end_width / start_width , 1 / transactions_length );
        widths = [{x:0,w:start_width,s:start_scale}];
        for ( var i=1; i<transactions_length; i++ ){
            var w = widths[i-1]['w'] * scale_ratio;
            var s = widths[i-1]['s'] * scale_ratio;
            widths.push( { x: widths[i-1]['x']+w, w: w, s: s} );
        }
    }
    // only calculate when resized
    calculate_transactions_length();
    $(window).resize(function(){
        calculate_transactions_length();
    });
    // initialize ui actions 
    var handle_pause = function(t){
        hovered_widths_index = false;
        selected_widths_index = false;
        var t = $('#pause');
        if ( t.hasClass('on') ){
            t.removeClass('on').text('Pause');
            paused = false;
        } else {
            t.addClass('on').text('Start');
            paused = true;
            // clone the transactions
            transactions_paused = JSON.parse(JSON.stringify(transactions));
        }
    }
    pause_button.click(function(){
        handle_pause(this);
    });
    sound_button.click(function(){
        var t = $(this);
        if ( t.hasClass('on') ){
            t.removeClass('on').text('Sound is Off');
            osc.stop(0);
            audio = false, osc = false;
        } else {
            t.addClass('on').text('Sound is On');
            if ( window.webkitAudioContext ) {
                audio = new window.webkitAudioContext();
            } else if ( window.mozAudioContext ) {
                audio = new window.mozAudioContext();
            } else if ( window.AudioContext ) {
                audio = new window.AudioContext();
            } 
            osc = audio.createOscillator();
            osc.connect(audio.destination);
            osc.start(0);        
        }
    });
    canvas.click(function(e){
        if ( paused && hovered_widths_index ) {
            selected_widths_index = hovered_widths_index;
            var tx = transactions_paused[hovered_widths_index]
            // render graph
            render( transactions_paused, tx, canvas[0] );
        } else {
            handle_pause();
        }
    })
    canvas.mousemove(function(e){
        if ( paused ) {
            var t = $(this), x = e.pageX, y = e.pageY;
            // check all bars except the last
            for ( var ii=0, ll=widths.length-1; ii<ll; ii++) {
                if ( x > widths[ii]['x'] && x < widths[ii+1]['x'] ) {
                    t.css('cursor', 'pointer').attr('title', '');
                    hovered_widths_index = ii;
                    break;
                } else {
                    t.css('cursor', 'default');
                }
            }
            // check the last bar
            var li = widths.length-1;
            if ( x > widths[li]['x'] && x < widths[li]['x'] + widths[li]['w']) {
                t.css('cursor', 'pointer').attr('title', '');
                hovered_widths_index = widths.length-1;
            } 
            // render graph
            render( transactions_paused, false, canvas[0] );
        }
    })        
    // initialize functions
    var render_transaction_info = function(tx){
        var html = '<div>';
        var outs_length = tx['outputs'].length;
        html += '<div class="transaction">';
        html += '<div class="transaction-id-wrapper"><h3 class="transaction-output-header">Transaction ID</h3>';
        html += '<div class="transaction-id"><a target="insight" href="http://live.insight.is/tx/'+tx['hash']+'">'+tx['hash']+'</a></div></div>';
        html += '<div class="transaction-outputs-wrapper"><h3 class="transaction-output-header">Outputs ('+outs_length+')</h3><div id="transaction-outputs-inner-wrapper">';
        for ( var i=0; i<outs_length; i++){
            var value = tx['outputs'][i]['value'];
            var addresses = tx['outputs'][i]['addresses'];
            html += '<div class="output"> &#10141; '+value;
            for ( var ai=0,al=addresses.length; ai<al;ai++){
                html += '<div><a target="insight" href="http://live.insight.is/address/'+addresses[0]+'">'+addresses[ai]+'</a></div>';
            }
            html += '</div>';
            if ( i > 4 ) {
                html += '<div id="view-more-seperator"><a target="insight" href="http://live.insight.is/tx/'+tx['hash']+'">+ More</a></div>';
                break;
            }
        }
        html += '</div></div></div>';
        $('#incoming')
            .html( html )
            .css('left', window_width / 2 )
            .css('top', window_height / 2 - incoming.height() / 2) 

    }
    var render = function( txs, tx, canvas ){
        if ( tx ) {
            render_transaction_info( tx );
        }
        canvas.width = window_width;
        canvas.height = window_height;
        if ( canvas.getContext ){
            var ctx = canvas.getContext('2d');
            for (var k=0,txs_length=txs.length; k<txs_length; k++){
                var total = 0;
                if ( txs[k] ) {
                    for ( var j=0,jl=txs[k]['outputs'].length; j<jl; j++){
                        var value = txs[k]['outputs'][j]['value'];
                        total += parseFloat(value);
                    }
                    var x = widths[k]['x'],
                        width = widths[k]['w'],
                        height = Math.round(total*widths[k]['s']),
                        y = (window_height/2)-(height/2);

                    if ( audio && osc ) {
                        osc.type = "square";
                        var frequency = total * 1000 + 10;
                        osc.frequency.value = frequency;
                    }
                    if ( paused && hovered_widths_index == k ) {
                        ctx.fillStyle = 'rgba(0, 121, 255, 1)';
                    } else if ( paused && selected_widths_index == k ) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
                    } else {
                        ctx.fillStyle = 'rgba(255, 134, 0, 1)';
                    }
                    var bar_height, percentage, value;
                    for ( var j=0,jl=txs[k]['outputs'].length; j<jl; j++){
                        bar_height = height * parseFloat( txs[k]['outputs'][j]['value'] ) / total;
                        ctx.fillRect(x, y - 3, width, bar_height - 3);
                        y += bar_height;
                    }
                }
            }
        }
    }
}
