jQuery(document).ready(function($) {

    //todo: use window focus and blur to pause all activity?

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
            t.text('Resume');
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

    var transactions = [];
    var max_transactions = Math.round($(window).width()/2);
    for ( var i=0; i<max_transactions; i++ ){
        transactions.push(false);
    }
    var max_height = 10;
    var max_height_divisor = 10;

    $('body').css('overflow', 'hidden');

    var widths = null;
    var hovered_widths_index = false;
    var selected_widths_index = false;

    $('#graph').click(function(e){
        if ( pause && hovered_widths_index ) {

            selected_widths_index = hovered_widths_index;

            var tx = transactions_paused[hovered_widths_index]

            var output_html = '<div>';
            var il = tx['outputs'].length;
            output_html += '<div>TX:<a target="insight" href="http://live.insight.is/tx/'+tx['hash']+'">'+tx['hash']+'</a></div>';
            for ( var i=0; i<il; i++){
                var value = tx['outputs'][i]['value'];
                var addresses = tx['outputs'][i]['addresses'];
                output_html += '<div> &#10141; '+value+addresses[0]+'</div>';
            }
            output_html += '</div>';

            var incoming = $('#incoming');        
            incoming.html( output_html );
            incoming.css('left', $(window).width() /2 )
            incoming.css('top', $(window).height() /2 - incoming.height()/2)            

            render( transactions_paused );
        } else {
            handle_pause();
        }
    })

    $('#graph').mousemove(function(e){

        if ( pause ) {

            var x = e.pageX, y = e.pageY;
            for ( var ii= 0, ll=widths.length-1; ii<ll; i++ ) {
                //todo: select last element                    
                if ( x > widths[ii]['x'] && x < widths[ii+1]['x'] ) {
                    hovered_widths_index = ii;
                    break;
                }
                ii++;
            }

            render( transactions_paused );
        }

    })

    var render = function( data ){
        max_transactions = Math.round($(window).width()/2);

        // calculate these values based on window size/number of transactions
        var scale_ratio = 1.027;
        var start_width = 0.0000004;
        var start_scale = 0.000001;

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
        transactions.push(data)

        if ( !pause ) {
            render( transactions );
        }

        if ( !pause ) {

            var output_html = '<div>';
            var il = data['outputs'].length;
            for ( var i=0; i<il; i++){
                var value = data['outputs'][i]['value'];
                output_html += '<div> &#10141; '+value+'</div>';
            }
            output_html += '</div>';

            var incoming = $('#incoming');        
            incoming.html( output_html );
            incoming.css('left', $(window).width() /2 )
            incoming.css('top', $(window).height() /2 - incoming.height()/2)

        }
    });
});



