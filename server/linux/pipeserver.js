const net = require("net");
const fs = require("fs");
const { Profile } = require("./profile");

class PipeClass {

    constructor (id, debug) {
        this._pipe = null;
        this._connected = false;
        this.__debug = debug;
    }

    close (id) {
        // TODO
        this._pipe.close((err) => {
            this.check(id);
            this._connected = false;    
        });
    }

    check (id) {
        fs.stat(id, (err, stats) => {
            if (err) {
                return true;
            }
            fs.unlink(id, (err) => {
                if (err) {
                    console.error(err);
                    process.exit(0);
                }
                return true;
            })
        })
        return false;
    }

    addToLog(src, msg) {
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

    composeMessage(cmd, data) {
        let msg = {
            cmd: cmd,
            data: data
        };
        return JSON.stringify(msg);
    }
}


class PipeServer extends PipeClass {

    constructor (id, debug=false) {
        super(id, debug);
        this._pipeName = "/tmp/PSSST.Pipe.Server";
        this._profiles = null;
        this._tts = "flite";
    }

    set Profiles (value) { this._profiles = value; }
    get Profiles ()      { return this._profiles; }
    set TTS (value) { this._tts = value; }
    get TTS ()      { return this._tts; }

    async Listen () {   // async not needed?
        this.addToLog ("[PipeServer]", "Waiting for query...");

        try {
            this.check(this._pipeName);
            this._pipe = net.createServer((stream) => {
                this.addToLog("[PipeServer]", "Received query.");
                this._connected = true;

                stream.on("end", () => {
                    this.addToLog("[PipeServer]", "Client query disconnect.");
                })
                stream.on("data", (msg) => {
                    msg = msg.toString();
                    if (this.__debug) this.addToLog("[PipeServer]",msg);

                    let json = JSON.parse(msg);
                    switch (json.cmd) {
                        case "query":
                        case "request":
                            // TODO: how to add profile, won't let me instantiate profile class
                            let p = new Profile(json.data, this.__debug);
                            p._pipe = new LocalServer(p._id, this.__debug);
                            //p._pipe._profile = p; // pointer to self profile
                            p._voice._tts = this._tts;
                            this._profiles.set(p._pipe._id, p);
                            p._pipe._profiles = this._profiles; // pointer to profile map
                            p._pipe.Listen();
                            
                            // send acknowledgement
                            stream.write(this.composeMessage("requestAck", p._pipe._pipeName));
                            // TODO: clear public pipe?
                            break;
                        default:
                            console.log("[ERROR] Invalid command: " + msg.cmd);
                            break;
                    }
                })
            })
            .listen(this._pipeName)
        }
        catch {
            // TODO
        }

    }
}

class LocalServer extends PipeClass {
    constructor (id, debug=false) {
        super(id, debug);
        let suffix = (Math.floor( Math.random()*0xFFFFFF)).toString(16);
        this._id = id + suffix;
        this._prefix = "/tmp/";
        this._pipeName = this._id + ".Pipe.Server";
        //this._profile = null;
        this._profiles = null;
    }

    get Id () { return this._id; }
    get Profile () { return this._profiles.get(this._id); }
    set Profile (value) { this._profiles.set(this._id, value); }

    async Listen () {   // async not needed?
        this.addToLog("[" + this._id + "]", this._pipeName + " waiting for connection...");
        try {
            this.check(this._prefix+this._pipeName);
            this._pipe = net.createServer((stream) => {
                this.addToLog("[" + this._id + "]", "Connection established.");
                this._connected = true;
    
                // TODO: listen to data
                stream.on("end", () => {
                    // client disconnected    
                    this.addToLog("[" + this._id + "]", "Client disconnected.");
                })
                stream.on("data", (msg) => {
                    msg = msg.toString();
                    if (this.__debug) this.addToLog("[" + this._id + "]", msg);

                    let json = JSON.parse(msg);
                    switch (json.cmd) {
                        case "getVoices":
                            this.addToLog("[" + this._id + "]", "Getting voice list...");
                            if (this.Profile && this.Profile._voice) {
                                if (json.data) this.Profile._gender = json.data;
                                this.Profile._voice.getVoices(this.Profile._gender, (result) => {
                                    if (this.__debug) console.log (result.voices);
                                    stream.write(this.composeMessage("getVoicesResponse", result.voices));                                    
                                });
                            }
                            break;
                        case "setVoice":
                            if (this.Profile && this.Profile._voice) {
                                this.Profile._voice._currentVoice = json.data;
                                this.addToLog("[" + this._id + "]", "Setting voice to " + this.Profile._voice._voiceList.Name[json.data]);
                                stream.write(this.composeMessage("setVoiceResponse", "Success"));
                            }
                            break;
                        case "setVolume":
                            if (this.Profile && this.Profile._voice) {
                                // default range is 0 to 100
                                this.Profile._voice._volume = json.data;
                                this.addToLog("[" + this._id + "]", "Setting volume to " + this.Profile._voice._volume);
                                stream.write(this.composeMessage("setVolumeResponse", "Not supported"));
                            }
                            break;
                        case "setRate":
                            if (this.Profile && this.Profile._voice) {
                                // TODO:
                                // default range is -10 to 10, default 0
                                // new range = 0.2 to 5.0, log???
                                // for rate: --setf duration_stretch=xx
                                // for pitch: --setf int_f0_target_mean=145
                                let val = Math.pow(10, (parseInt(json.data)/14));
                                this.Profile._voice._rate = val;
                                this.addToLog("[" + this._id + "]", "Setting rate to " + this.Profile._voice._rate);
                                stream.write(this.composeMessage("setRateResponse", "Success"));
                            }
                            break;
                        case "speak":
                            if (this.Profile && this.Profile._voice) {
                                this.Profile.speak(json.data, (response, data) => {
                                    // BUG: while this is always reached when there's a speak call,
                                    //  sometimes the speakResponse on sockets.js is not always called.
                                    //  Consecutive stream,write issue?
                                    // // TRY: delay next write for 100msec
                                    stream.write(this.composeMessage("speakResponse", response));
                                    setTimeout(() => {
                                        stream.write(data);
                                    }, 100);
                                    // // OR: do a callback on the first call
                                    // stream.write(this.composeMessage("speakResponse", response), (err) => {
                                    //     if (!err) stream.write(data);
                                    // });
                                });
                            }
                            break;
                        case "disconnect":
                            this.addToLog("[" + this._id + "]", "Client requests to disconnect.");
                            this.close(this._prefix+this._pipeName); 
                            this._profiles.delete(this._id);
                            break;
                        default:
                            console.log("[ERROR] Invalid command: " + msg.cmd);
                            break;
                    }
    
                })
            })
            .listen(this._prefix+this._pipeName)    
        }
        catch {
            // TODO
        }
    }
}



module.exports = { PipeServer, LocalServer }
