var BitflowUI = function(config){

    // init variables 

    var socket;
    var transactions_length;
    var transactions = [];
    var paused = false;
    var transactions_paused = null;
    var audio = false;
    var osc = false;
    var widths = null;
    var hovered_widths_index = false;
    var selected_widths_index = false;

    var handle_transaction = function(tx){
        transactions.push( tx );
        if ( !paused ) {
            render( transactions, tx );
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
        
    $('body').append(title)
            .append(menu)
            .append(incoming)
            .append(canvas);
        
        
    // initialize actions 

    var handle_pause = function(t){

        hovered_widths_index = false;
        selected_widths_index = false;

        var t = $('#pause');
        
        if ( t.hasClass('on') ){

            t.removeClass('on');
            t.text('Pause');
            paused = false;

        } else {

            t.addClass('on');
            t.text('Start');
            paused = true;

            transactions_paused = JSON.parse(JSON.stringify(transactions));
        }
    }

    pause_button.click(function(){
        handle_pause(this);
    });

    sound_button.click(function(){
        var t = $(this);
        if ( t.hasClass('on') ){
            t.removeClass('on');
            t.text('Sound is Off');
            osc.stop(0);
            audio = false, osc = false;

        } else {

            t.addClass('on');
            t.text('Sound is On');

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
            render( transactions_paused, tx );

        } else {
            handle_pause();
        }
    })

    canvas.mousemove(function(e){

        if ( paused ) {

            var t = $(this);

            var x = e.pageX, y = e.pageY;

            // check all widths(bars), except the last
            for ( var ii=0, ll=widths.length-1; ii<ll; ii++) {
                if ( x > widths[ii]['x'] && x < widths[ii+1]['x'] ) {
                    t.css('cursor', 'pointer').attr('title', '');
                    hovered_widths_index = ii;
                    break;
                } else {
                    t.css('cursor', 'default');
                }
            }

            // check the last widths(bar)
            var li = widths.length-1;
            if ( x > widths[li]['x'] && x < widths[li]['x'] + widths[li]['w']) {
                t.css('cursor', 'pointer').attr('title', '');
                hovered_widths_index = widths.length-1;
            } 

            render( transactions_paused, false );

        }

    })        
        

    // initialize functions
    
    var calculate_transactions_length = function(){
        transactions_length = Math.round($(window).width()/2);
        if ( transactions.length < transactions_length ) {
            while ( transactions.length < transactions_length ) {
                transactions.splice(0, 0, false);
            }
        } else if ( transactions.length > transactions_length ) {
            while ( transactions.length > transactions_length ) {
                transactions.shift()
            }
        }
    }

    var render_transaction_info = function(tx){

        var output_html = '<div>';
        var il = tx['outputs'].length;
        output_html += '<div class="transaction">';
        output_html += '<div class="transaction-id-wrapper"><h3 class="transaction-output-header">Transaction ID</h3>';
        output_html += '<div class="transaction-id"><a target="insight" href="http://live.insight.is/tx/'+tx['hash']+'">'+tx['hash']+'</a></div></div>';
        output_html += '<div class="transaction-outputs-wrapper"><h3 class="transaction-output-header">Outputs ('+il+')</h3><div id="transaction-outputs-inner-wrapper">';
        for ( var i=0; i<il; i++){
            var value = tx['outputs'][i]['value'];
            var addresses = tx['outputs'][i]['addresses'];
            output_html += '<div class="output"> &#10141; '+value;
            for ( var ai=0,al=addresses.length; ai<al;ai++){
                output_html += '<div><a target="insight" href="http://live.insight.is/address/'+addresses[0]+'">'+addresses[ai]+'</a></div>';
            }
            output_html += '</div>';
            if ( i > 4 ) {
                output_html += '<div id="view-more-seperator"><a target="insight" href="http://live.insight.is/tx/'+tx['hash']+'">+ More</a></div>';
                break;
            }
        }
        output_html += '</div></div></div>';

        var incoming = $('#incoming');        
        incoming.html( output_html );
        incoming.css('left', $(window).width() /2 )
        incoming.css('top', $(window).height() /2 - incoming.height()/2) 


    }

    var render = function( txs, tx ){

        calculate_transactions_length();

        if ( tx ) {
            render_transaction_info( tx );
        }

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

        var canvas = document.getElementById('graph');
        canvas.width = $(window).width();
        canvas.height = $(window).height();

        if ( canvas.getContext ){
            var ctx = canvas.getContext('2d');

            var c = 0;
            var il = txs.length;
            for (var k=0; k<il; k++){
                var total = 0;
                if ( txs[k] ) {
                    var jl = txs[k]['outputs'].length;
                    for ( var j=0; j<jl; j++){
                        var value = txs[k]['outputs'][j]['value'];
                        total += parseFloat(value);
                    }

                    var x = widths[c]['x'];
    
                    var width = widths[c]['w'];

                    var height = Math.round(total*widths[c]['s']);

                    var y = ($(window).height()/2)-(height/2);

                    if ( audio && osc ) {
                        osc.type = "square";
                        var frequency = total * 1000 + 10;
                        osc.frequency.value = frequency;
                    }
                    if ( paused && hovered_widths_index == c ) {
                        ctx.fillStyle = 'rgba(0, 121, 255, 1)';
                    } else if ( paused && selected_widths_index == c ) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
                    } else {
                        ctx.fillStyle = 'rgba(255, 134, 0, 1)';
                    }
        
                    var jl = txs[k]['outputs'].length;
                    var bar_height, percentage, value;
                    for ( var j=0; j<jl; j++){
                        value = parseFloat( txs[k]['outputs'][j]['value'] );
                        percentage = value / total;
                        bar_height = height * percentage;
                        ctx.fillRect(x, y - 3, width, bar_height - 3);
                        y = y + bar_height;
                    }
                    y = null;
    
                }
                c++;
            }
        
        }
    }
}

