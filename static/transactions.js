jQuery(document).ready(function($) {

    //todo: use window focus and blur to pause all activity?

    var max_transactions;
    var transactions = [];
    
    var calculate_max_transactions = function(){
        max_transactions = Math.round($(window).width()/2);
        if ( transactions.length < max_transactions ) {
            while ( transactions.length < max_transactions ) {
                transactions.splice(0, 0, false);
            }
        } else if ( transactions.length > max_transactions ) {
            while ( transactions.length > max_transactions ) {
                transactions.shift()
            }
        }
    }

    var handle_transaction = function(tx){

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

    var pause = false, transactions_paused = null;

    var handle_pause = function(t){
        hovered_widths_index = false;
        selected_widths_index = false;
        var t = $('#pause');
        if ( t.hasClass('on') ){
            t.removeClass('on');
            t.text('Pause');
            pause = false;
        } else {

            t.addClass('on');
            t.text('Start');
            pause = true;

            transactions_paused = JSON.parse(JSON.stringify(transactions));
        }
    }

    $('#pause').click(function(){
        handle_pause(this);
    });

    var audio = false, osc = false;

    $('#sound').click(function(){
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

    //xxx
    for ( var i=0; i<max_transactions; i++ ){
        transactions.push(false);
    }

    var max_height = 10;
    var max_height_divisor = 10;

    var widths = null;
    var hovered_widths_index = false;
    var selected_widths_index = false;

    $('#graph').click(function(e){
        if ( pause && hovered_widths_index ) {

            selected_widths_index = hovered_widths_index;

            var tx = transactions_paused[hovered_widths_index]

            // display info
            handle_transaction( tx );

            // render graph
            render( transactions_paused );

        } else {
            handle_pause();
        }
    })

    $('#graph').mousemove(function(e){

        var t = $(this);

        if ( pause ) {

            var x = e.pageX, y = e.pageY;
            for ( var ii= 0, ll=widths.length-1; ii<ll; i++ ) {
                //todo: select last element                    
                if ( x > widths[ii]['x'] && x < widths[ii+1]['x'] ) {
                    t.css('cursor', 'pointer').attr('title', '');
                    hovered_widths_index = ii;
                    break;
                } else {
                    t.css('cursor', 'default');
                }
                ii++;
            }

            render( transactions_paused );
        }

    })

    var render = function( data ){

        // determine the number of transactions to render
        calculate_max_transactions();

        var end_width = 17;
        var start_width = 0.0000004;
        var start_scale = 0.000001;
        var scale_ratio = Math.pow( end_width / start_width , 1 / max_transactions );

        widths = [{x:0,w:start_width,s:start_scale}];

        for ( var i=1; i<max_transactions; i++ ){
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
            var il = data.length;
            var local_max_height = 0;
            for (var k=0; k<il; k++){
                var total = 0;
                if ( data[k] ) {
                    var jl = data[k]['outputs'].length;
                    for ( var j=0; j<jl; j++){
                        var value = data[k]['outputs'][j]['value'];
                        total += parseFloat(value);
                    }

                    var x = widths[c]['x'];
    
                    var width = widths[c]['w'];

                    var height = Math.round(total*widths[c]['s']);

                    var y = ($(window).height()/2)-(height/2);

                    if ( height/$(window).height() > max_height_divisor ) {
                        max_height_divisor = height/$(window).height();
                    }

                    if ( height > local_max_height ) {
                        local_max_height = height;
                    }

                    if ( audio && osc ) {
                        osc.type = "square";
                        var frequency = height/(max_height*0.5) * 1000 + 10;
                        osc.frequency.value = frequency;
                    }
                    if ( pause && hovered_widths_index == c ) {
                        ctx.fillStyle = 'rgba(0, 121, 255, 1)';
                    } else if ( pause && selected_widths_index == c ) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
                    } else {
                        ctx.fillStyle = 'rgba(255, 134, 0, 1)';
                    }
        
                    var jl = data[k]['outputs'].length;
                    var bar_height, percentage, value;
                    for ( var j=0; j<jl; j++){
                        value = parseFloat( data[k]['outputs'][j]['value'] );
                        percentage = value / total;
                        bar_height = height * percentage;
                        ctx.fillRect(x, y - 3, width, bar_height - 3);
                        y = y + bar_height;
                    }
                    y = null;
    
                }
                c++;
            }
        
            max_height = local_max_height;
        
        }
    }

    var socket = io.connect('http://127.0.0.1:1337');

    socket.on('tx', function (data) {

        while ( transactions.length > max_transactions - 1 ) {
            transactions.shift()
        }

        transactions.push(data);

        if ( !pause ) {
            render( transactions );
        }

        if ( !pause ) {
            handle_transaction( data );
        }
    });
});



