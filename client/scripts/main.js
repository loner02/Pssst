var CLIENT_ID = "Lei"
var CLIENT_GENDER = "Female"
var connected = false
var context = null;
var audioQueue = [];
//var testform;

try {
    var socket = io('/PSSST');
    socket.on('server-to-client', (data) => {
        console.log(data.msg);
    });
    socket.on("serverResponse", (params) => {
        //console.log("serverResppnse");
        switch (params.cmd) {
            case "listVoice":
                //console.log(params.data);
                addToVoiceList(params.data);
                break;
            case "speakResponse":
                //showResponse(params.data);
                break;
        }        
    })
    socket.on('audioStream', (data) => {
        // TODO: what if multiple or successive audioStream
        console.log("Received MP3 stream: "+data.Text);
        audioQueue.push(data);

        // for testing, use WebAudio
        // for VRM integration, use Three audio: is there a streaming option, so as to be in-sync with visemes?
        if (audioQueue.length == 1) {
            showResponse(data);
            playAudio();    
        }
    })
}
catch(e) {
    var socket = null;
}

function connectToServer (form) {
    //testform = form;
    //socket.emit("client-to-server", {id:CLIENT_ID, msg:'vrmtest connect'});
    if (!connected) {
        if (!socket.connected)
            socket.connect();

        if (form.w_name1.value) CLIENT_ID = form.w_name1.value;
        if (form.w_gender1.selectedIndex == 1) 
            CLIENT_GENDER = "Male";
        else
            CLIENT_GENDER = "Female";

        socket.emit("serverAction", {cmd:"connect", data:{id:CLIENT_ID, gender:CLIENT_GENDER}});
        //socket.emit("serverAction", {cmd:"connect", data:CLIENT_ID});
        //document.getElementById("w_connect1").textContent = "Disconnect";    
        form.w_connect1.textContent = "Disconnect";
        connected = true;

        // also create the audio context here
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();

        //disable controls
        form.w_name1.disabled = true;
        form.w_gender1.disabled = true;
    }
    else {
        // TODO: not yet handled in server
        socket.emit("serverAction", {cmd:"disconnect", data:CLIENT_ID}); 
        form.w_connect1.textContent = "Connect";
        connected = false;

        //enable controls
        form.w_name1.disabled = false;
        form.w_gender1.disabled = false;

        // TODO: cleanup
    }
}

function addToVoiceList (voicesArray) {
    //console.log("list voices here");
    let select = document.getElementById('w_select1');
    select.options.length = 0;
    voicesArray.forEach(voice => {
        let opt = document.createElement("option");
		opt.text = voice;
		select.add(opt);
    });
}

function voiceChange (form) {
    //console.log("voice select change");
    if (connected) {
        socket.emit("serverAction", {cmd:"setVoice", data:form.w_select1.selectedIndex});
    }
}

function volumeChange (form) {
    if (connected) {
        socket.emit("serverAction", {cmd:"setVolume", data:form.w_volume1.value});
    }
}

function rateChange (form) {
    if (connected) {
        socket.emit("serverAction", {cmd:"setRate", data:form.w_rate1.value});
    }
}

function pitchChange (form) {
    if (connected) {
        socket.emit("serverAction", {cmd:"setPitch", data:form.w_pitch1.value});
    }
}

function inputTextChange (form, e) {
    if (connected) {
        if (e.key === "Enter") {
            //console.log(form.w_speak1.value.length);
            socket.emit("serverAction", {cmd:"speak", data:form.w_speak1.value});
        }
    }
}

function showResponse (data) {
    if (connected) {
        let text = JSON.stringify({
            Text: data.Text,
            Visemes: data.Visemes,
            Length: data.Length
        })
        let textarea = document.getElementById("w_response1");
        //textarea.style.fontSize = '1.0em'; 
        textarea.value = text;    
    }
}

function playAudio () {
    if (connected) {
        //let audioData = audioQueue.shift();
        let audioData = audioQueue[0];  // get first in queue

        let source = context.createBufferSource();
        source.onended = () => {
            // check if audio streams in queue
            audioQueue.shift();     // discard first in queue
            if (audioQueue.length > 0) {
                showResponse(audioQueue[0]);
                playAudio();
            }
        }
        context.decodeAudioData(audioData.Stream)
            .then((decodedAudio) => {
                source.buffer = decodedAudio;
                source.connect(context.destination);
                source.start(0);
            })
    }
}