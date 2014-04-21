jQuery(document).ready(function($) {

    var mute = true;
    var hide_output = true;

    if ( window.webkitAudioContext ) {
        var audio = new window.webkitAudioContext();
    } else if ( window.mozAudioContext ) {
        var audio = new window.mozAudioContext();
    } else if ( window.AudioContext ) {
        var audio = new window.AudioContext();
    } else {
        var audio = false;
    }

    if ( audio && !mute ) {
        osc = audio.createOscillator(),
        osc.connect(audio.destination);
        osc.start(0);
    }

    var transactions = [];
    var max_transactions = 300;
    var max_height = 10;
    var max_height_divisor = 10;

    $('body').css('overflow', 'hidden');

    var render = function( data ){
        max_transactions = Math.round($(window).width()/2);
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
                var jl = data[k]['outputs'].length;
                for ( var j=0; j<jl; j++){
                    var value = data[k]['outputs'][j]['value'];
                    total += parseFloat(value);
                }
                var width = 1;
        
                if ( il < max_transactions ) {
                    var x = max_transactions*width - il*width + c*width;
                } else {
                    var x = c*width;
                }
        
                var height = Math.round(total*x/max_height_divisor);
        
                var y = ($(window).height()/2)-(height/2);
        
                if ( height/$(window).height() > max_height_divisor ) {
                    max_height_divisor = height/$(window).height();
                }

                if ( height > local_max_height ) {
                    local_max_height = height;
                }

                if ( audio && !mute ) {
                    osc.type = "square";
                    var frequency = height/(max_height*0.5) * 1000 + 10;
                    osc.frequency.value = frequency;
                }
        
                ctx.fillStyle = 'rgba(247, 147, 26, 1)';
        
                ctx.fillRect(x, y, width, height);
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
        render( transactions );

        if ( !hide_output ) {

            var output_html = '<div>';
            var il = data['outputs'].length;
            for ( var i=0; i<il; i++){
                var value = data['outputs'][i]['value'];
                output_html += '<div> &#10141; &#xe3f;'+value+'</div>';
            }
            output_html += '</div>';

            var incoming = $('#incoming');        
            incoming.html( output_html );
            incoming.css('left', $(window).width() /2 )
            incoming.css('top', $(window).height() /2 - incoming.height()/2)
        
        }


    });

});



