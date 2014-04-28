var BitflowUI = function(config){

    // init variables 
    var socket,
        synth,
        transactions_length, //calculated length of transactions to render
        transactions = [],//transaction data from socket
        transaction = false, //current transaction
        transactions_paused = false,//clone of transactions to be used when paused
        widths = null, //calculated x position and width for each bar in to be graphed
        window_width = $(window).width(), 
        window_height = $(window).height(),
        selected_widths_index = false, //currently selected bar in graph
        svgns = "http://www.w3.org/2000/svg",
        version = '0.1.7';

    var incoming = $('<div id="incoming"></div>');

    // init synthesizer
    function SynthAudio(){}
    SynthAudio.prototype = {
        stop : function(){
            if ( this.osc ) {
                this.osc.stop(0);
            }
            this.audio = false, this.osc = false;
        },
        start : function(){
            if ( window.webkitAudioContext ) {
                this.audio = new window.webkitAudioContext();
            } else if ( window.mozAudioContext ) {
                this.audio = new window.mozAudioContext();
            } else if ( window.AudioContext ) {
                this.audio = new window.AudioContext();
            } 
            this.osc = this.audio.createOscillator();
            this.osc.connect(this.audio.destination);
            this.osc.start(0);
        },
        change : function(f){
            if ( this.osc ) {
                this.osc.type = "square";
                this.osc.frequency.value = f;
            }
        }
    }
    synth = new SynthAudio();

    // define function to render the graph
    var render = function(){

        if ( transactions_paused ) {
            txs = transactions_paused;
        } else {
            txs = transactions;
        }

        var svg = document.createElementNS(svgns,"svg");
        svg.setAttributeNS(null,'id', 'graph');
        svg.setAttributeNS(null,'width', window_width);
        svg.setAttributeNS(null,'height', window_height);

        svg.width = window_width;
        svg.height = window_height;

        for (var k=0,txs_length=txs.length; k<txs_length; k++){
            var total = 0;
            if ( txs[k] ) {

                // calculate values
                for ( var j=0,jl=txs[k]['outputs'].length; j<jl; j++){
                    var value = txs[k]['outputs'][j]['value'];
                    total += parseFloat(value);
                }
                var x = widths[k]['x'],
                    width = widths[k]['w'],
                    height = Math.round(total*widths[k]['s']),
                    y = (window_height/2)-(height/2);

                // change audio    
                eval('synth.change')( total * 100 + 10 );

                // draw graph
                var style;
                if ( transactions_paused && selected_widths_index == k ) {
                    style = '#000';
                } else {
                    style = '#ff8600';
                }

                var bar_height;

                var group = document.createElementNS(svgns,"g");
                group.onclick = handle_svg_click;
                group.onmouseover = handle_svg_hover;
                group.onmouseout = handle_svg_hoverout;

                for ( var j=0,jl=txs[k]['outputs'].length; j<jl; j++){

                    bar_height = height * parseFloat( txs[k]['outputs'][j]['value'] ) / total;

                    var rect = document.createElementNS(svgns,"rect");
                    rect.setAttributeNS(null,'x',x);
                    rect.setAttributeNS(null,'y',(y-3));
                    rect.setAttributeNS(null, 'data-color', style );
                    rect.setAttributeNS(null, 'data-tx', txs[k]['hash'] );
                    rect.setAttributeNS(null, 'data-index', k );
                    rect.setAttributeNS(null, 'data-output', j );
                    rect.setAttributeNS(null, 'width', width);
                    rect.setAttributeNS(null, 'height',(bar_height-3) > 0 ? (bar_height-3) : 1 );
                    rect.setAttributeNS(null, 'fill', style);

                    group.appendChild( rect );

                    y += bar_height;
                }

                svg.appendChild( group );

            }
        }

        var graph = document.getElementById('graph');
        if ( graph ) {
            graph.parentNode.removeChild(graph);
        }
        document.body.appendChild( svg );

        if ( transaction ) {

            var tx = transaction;

            var html = '<div>';
            var outs_length = tx['outputs'].length;
            html += '<div class="transaction">';
            html += '<div class="transaction-id-wrapper"><h3 class="transaction-output-header">Transaction ID</h3>';
            html += '<div class="transaction-id"><a title="View Transactions Details" target="insight" href="http://live.insight.is/tx/'+tx['hash']+'">'+tx['hash']+'</a></div></div>';
            html += '<div class="transaction-outputs-wrapper"><h3 class="transaction-output-header">BTC Outputs ('+outs_length+')</h3><div id="transaction-outputs-inner-wrapper">';
            for ( var i=0; i<outs_length; i++){
                var value = tx['outputs'][i]['value'];
                var addresses = tx['outputs'][i]['addresses'];
                html += '<div class="output">'+value;
                for ( var ai=0,al=addresses.length; ai<al;ai++){
                    html += '<div class="publickeyaddress"><a title="View Address Details" target="insight" href="http://live.insight.is/address/'+addresses[0]+'">'+addresses[ai]+'</a></div>';
                }
                html += '</div>';
                if ( i > 4 ) {
                    html += '<div id="view-more-seperator"><a title="View Transactions Details" target="insight" href="http://live.insight.is/tx/'+tx['hash']+'">+ More</a></div>';
                    break;
                }
            }
            html += '</div></div></div>';
            $('#incoming')
                .html( html )
                .css('left', window_width / 2 )
                .css('top', window_height / 2 - incoming.height() / 2) 

        }
    }

    // initialize socket
    var handle_transaction = function(tx){
        transactions.push( tx );
        while ( transactions.length > transactions_length ) {
            transactions.shift()
        }
        if ( !transactions_paused ) {
            transaction = tx;
            render();
        }
    }
    socket = io.connect( config['socket'] );
    socket.on('tx', handle_transaction );

    // determine graph bar positions and widths
    var calculate_transactions_length = function(){
        if ( transactions_paused ) {
            var txs = transactions_paused;
        } else {
            var txs = transactions;
        }
        window_width = $(window).width();
        window_height = $(window).height();
        transactions_length = Math.round(window_width/2);
        while ( txs.length < transactions_length ) {
            txs.splice(0, 0, false);
        }
        while ( txs.length > transactions_length ) {
            txs.shift()
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
        render();
    };
    $(window).bind('resize', calculate_transactions_length );

    var Button = function(options){
        this.elm = $('<span id="'+options['id']+'"></span>');
        this.elm.attr('data-options', JSON.stringify(options));
        var change_state = function( state, elm ){
            var options = JSON.parse(elm.attr('data-options'));
            if ( state == 'on' ){
                elm.addClass('on');
                elm.attr('title', options['on_title']);
                elm.text( options['on_text'] );
                eval(options['on_callback'])();
            } else {
                elm.removeClass('on');
                elm.attr('title', options['off_title']);
                elm.text( options['off_text'] );
                eval(options['off_callback'])();
            }
        }
        var handle_click = function(){
            var t = $(this)
            if ( t.hasClass( 'on' ) ) {
                change_state( 'off', t );
            } else {
                change_state( 'on', t );
            }
        }
        this.elm.bind('click', handle_click );
        change_state( options['state'], this.elm );
    }

    // initialize html 
    var title = $('<div id="title">Bitcoin Transactions</div>');
    var footer = $('<div id="footer"><a title="Bitflow Source Code" href="https://www.npmjs.org/package/bitflow">Bitflow</a> v'+version+' powered by <a title="Bitcore Project Website" href="http://bitcore.io">Bitcore</a> and <a title="Node.js Project Website" href="http://nodejs.org/">Node.js</a></div>');

    var sound_button = new Button({
        id : 'sound',
        on_text : 'Sound is On',
        on_title : 'Turn Sound Off',
        on_callback : 'synth.start',
        off_text : 'Sound is Off',
        off_title : 'Turn Sound On',
        off_callback : 'synth.stop',
        state : 'off'
    });

    var handle_pause = function(){
        if ( sound_button.elm.hasClass('on') ){
            sound_button.elm.trigger('click');
        }
        selected_widths_index = false;
        transactions_paused = JSON.parse(JSON.stringify(transactions));
        calculate_transactions_length();
    }        

    var handle_play = function(){
        transactions_paused = false;
        calculate_transactions_length();
    }

    var pause_button = new Button({
        id : 'pause',
        on_text : 'Live',
        on_title : 'Pause',
        on_callback : 'handle_play',
        off_text : 'Paused',
        off_title : 'Resume',
        off_callback : 'handle_pause',
        state : 'on'
    });

    var menu = $('<div id="menu"></div>')
        .append(sound_button.elm)
        .append(pause_button.elm);


    $('body')
        .append(title)
        .append(footer)
        .append(menu)
        .append(incoming)

    var handle_svg_hover = function(e){
        var elm = e.target;
        elm.setAttributeNS(null, 'fill', '#0079ff');
        elm.style.cursor = 'pointer';
        elm.setAttributeNS(null, '', '#0079ff');
    }

    var handle_svg_hoverout = function(e){
        var elm = e.target;
        elm.style.cursor = 'default';
        var color = e.target.getAttribute('data-color');
        elm.setAttributeNS(null, 'fill', color);
    }

    var handle_svg_click = function(e){
        if ( !transactions_paused ) {
            pause_button.elm.trigger('click');
        }
        var elm = e.target;
        selected_widths_index = elm.getAttribute('data-index');
        transaction = transactions_paused[selected_widths_index];
        render();
    }

}
