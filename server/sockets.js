/**
 * 
 * WEB CLIENT <=====> NODEJS SERVER <=====> SPEECH SERVER
 *           socket.io             NamedPipe  
 */

module.exports = function(server) {
    const io = require('socket.io')(server);
    //const path = require('path');
    const net = require('net');
    const lame = require('node-lame').Lame;

    const PIPE_PATH = "\\\\.\\pipe\\PSSST.Pipe.Server";
    var clientMap = new Map();

    // Socket communication: WEB CLIENT <=> NODEJS SERVER
    const pssst = io
        .of('/PSSST')
        .on('connection', (socket) => {
            // for every socket connection, store to client map
            // TODO: reconnect???? disconnect????
            let clientData = {
                local: null,
                //incomingRaw: false,
                audioData: []
            }
            clientMap.set(socket.id, clientData);

            //webclient_id = socket.id;
            addToLog('[WebClient]', 'Socket connection established: '+socket.id);

            // Initial handshake
            socket.emit('server-to-client', {msg:'Greetings from PSSST Socket Server'});
            socket.on('client-to-server', (data) => {
                addToLog('[WebClient]',`${data.id}: ${data.msg}`);
            });
            socket.on('disconnect', () => {
                addToLog('[WebClient]',`Socket disconnect: `+socket.id);
                // disconnect local pipe as well if connected
                // disconnect pipe to speech server
                if (clientMap.has(socket.id) && clientMap.get(socket.id).local) {
                    clientMap.get(socket.id).local.end(JSON.stringify({cmd:"disconnect", data:""}));
                    // TODO: cleanup
                    clientMap.delete(socket.id);    
                }
            })

            // Handle server actions
            //socket.on("serverAction", serverActions);
            socket.on("serverAction", (params) => {
                serverActions(socket, params);
            })
        })

    // Named Pipe communication: NODEJS SERVER <=> SPEECH SERVER
    /**
     * Perform socket server actions
     * @param socket - socket.io connection to web client
     * @param params - JSON object containing commands and data
     */
    function serverActions (socket, params) {
        switch (params.cmd) {
            case 'connect':
                // WEB CLIENT requests connection to SPEECH SERVER
                let client = net.connect(PIPE_PATH, function() {
                    // store client server
                    //clientMap.get(socket.id).public = client;

                    // (1) client is connected to pipe server
                    addToLog('[WebClient]','Query server: '+params.data.id);
                    client.on('end', ()=>{
                        addToLog('[PipeServer]','Query completed.');
                        client.end();
                    });
                    client.on('data', (data)=>{
                        let incoming = JSON.parse(data.toString());
                        switch (incoming.cmd) {
                            case "requestAck":
                                // (3) pipe server grants request and creates local pipe
                                PIPE_LOCAL_PATH = "\\\\.\\pipe\\"+incoming.data;
                                addToLog('[PipeServer]',"Received server ack");
                                client.end();

                                // (4) client automatically connect to local pipe: add delay?
                                let local = net.connect(PIPE_LOCAL_PATH, function() {
                                    // store local connection
                                    clientMap.get(socket.id).local = local;
                                    addToLog('[WebClient]', 'Initiate Local connection');

                                    local.on('end', local.end);
                                    local.on('data', (params) => {
                                        localActions(socket, local, params);
                                    });

                                    // (5) request voice list
                                    local.write(JSON.stringify({cmd:"getVoices", data:params.data.gender}));
                                });                                                                           
                                break;
                            default:
                                break;
                        }
                    });
                    // (2) client requests dedicated local pipe
                    var msg = {cmd:"request", data:params.data.id};
                    client.write(JSON.stringify(msg));
                });
                
                break;
            case "setVoice":
            case "setVolume":
            case "setRate":
            case "setPitch":
                // (7) Select voice/volume/rate/pitch; simply pass command to pipe
                clientMap.get(socket.id).local.write(JSON.stringify(params));
                break;
            case "speak":
                // (8) Speak text
                clientMap.get(socket.id).local.write(JSON.stringify(params));
                clientMap.get(socket.id).audioData = [];
                break;
            case 'disconnect':
                // disconnect socketio to webclient
                //io.of('/VRMP').sockets.get(webclient_id).disconnect(true);
                socket.disconnect(true);
                // below code now performed at socket listener
                // disconnect pipe to speech server
                //clientMap.get(socket.id).local.end(JSON.stringify({cmd:"disconnect", data:""}));
                // TODO: cleanup
                //clientMap.delete(socket.id);
                break;
        }
    }

    /**
     * Perform local pipe actions
     * @param socket - socket.io connection to web client
     * @param local - local pipe connection to speech server
     * @param params - JSON object containg commands and data
     */
    function localActions(socket, local, params) {
        try {
            // RECEIVED a JSON object
            let incoming = JSON.parse(params.toString());
            //let client_io = io.of('/VRMP').sockets.get(webclient_id);
            switch (incoming.cmd) {
                case "getVoicesResponse":
                    // (6) Received voice list from server, send back to client    
                    socket.emit('serverResponse', {cmd:"listVoice", data:incoming.data});

                    if (incoming.data.length > 0) {
                        // set initial voice to 0
                        local.write(JSON.stringify({cmd:"setVoice", data:0}));
                    }
                    break;
                case "setVoiceResponse":
                    addToLog('[SpeechServer]',"Set voice: "+incoming.data);
                    break;
                case "setVolumeResponse":
                    addToLog('[SpeechServer]',"Set volume: "+incoming.data);
                    break;
                case "setRateResponse":
                    addToLog('[SpeechServer]',"Set rate: "+incoming.data);
                    break;
                case "setPitchResponse":
                    addToLog('[SpeechServer]',"Set pitch: "+incoming.data);
                    break;                        
                case "speakResponse":
                    // (9) send audio data to web client
                    //console.log(incoming.data);
                    socket.emit('serverResponse', {cmd:"speakResponse", data:incoming.data});
                    let data = {
                        Text: incoming.data.Text,
                        Visemes: incoming.data.VisemeList,
                        Length: incoming.data.Length,
                        Stream: null
                    };
                    clientMap.get(socket.id).audioData.push(data);
                    // clientMap.get(socket.id).audioData = {
                    //     Text: incoming.data.Text,
                    //     Visemes: incoming.data.VisemeList,
                    //     //Length: incoming.data.Length
                    // };
                    //clientMap.get(socket.id).incomingRaw = true;
                    break;
                defaulr:
                    break;
            }
        }
        catch (err) {
            // RECEIVED a BINARY object
            //let client_io = io.of('/VRMP').sockets.get(webclient_id);
            let audio_stream = [];
            let clientData = clientMap.get(socket.id);
            //if (clientData.incomingRaw == true) {
            //    clientData.incomingRaw = false;
                audio_stream = params;
                console.log ("Received audio stream ["+audio_stream[0]+audio_stream[1]+audio_stream[2]+audio_stream[3]+"]:"+audio_stream.length);
                
                // check audio stream if WAV, then convert to MP3
                const encoder = new lame({
                    //"output": "./test.mp3",
                    "output": "buffer",
                    "bitrate": 192,
                }).setBuffer(audio_stream);
                encoder.encode()
                    .then(() => {
                        // (10) Send audio buffer to web client
                        const audioBuffer = encoder.getBuffer();
                        // send to web client
                        // TODO: async errors; try single send of audio data
                        for (let audioData of clientData.audioData) {
                            //if ((audioData.Length == 0) || (!audioData.Stream)) {
                            if ((audioData.Length == audio_stream.length) && 
                                (audioData.Stream === null)){
                                console.log("speak here");
                                audioData.Length = audioBuffer.Length;
                                audioData.Stream = audioBuffer;
                                socket.emit('audioStream', audioData);
                                break;
                            }
                        }
                        // clientData.audioData.Length = audioBuffer.length;
                        // clientData.audioData.Stream = audioBuffer;
                        // //clientMap.get(socket.id).audioData = audioData;
                        //socket.emit('audioStream', clientData.audioData);
                    })
                    .catch((error) => {
                        addToLog('[ERROR]', error);
                    })
            // }
            // else
            //     addToLog('[ERROR]',"Not expecting raw data");
        }
        finally {

        }
    }

    function addToLog (src, msg) {
        function pad (num) {
            return (num<10 ? '0' : '') + num;
        }   

        let timestamp = new Date();
        let year = pad(timestamp.getFullYear()-2000);
        let month = pad(timestamp.getMonth() + 1);
        let day = pad(timestamp.getDate());
        let hour = pad(timestamp.getHours());
        let minute = pad(timestamp.getMinutes());
        let seconds = pad(timestamp.getSeconds());
        let timestamp_string = year+month+day+hour+minute+seconds+" ";

        console.log(timestamp_string+src+" "+msg);
    }
} 