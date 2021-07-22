const { exec } = require("child_process");
const fs = require('fs');
const internal = require("stream");
const util = require('util');
const execProm = util.promisify(exec);

const VOICE_PATH = "./server/linux/voices";

class SpeechStreamData {
    constructor() {
        this.Text = "";
        //this.VisemeList = [];
        this.AudioStream = [];
        this.Length = 0;
        this.tmpFile = "";
    }
}

class Voice {
    constructor (id, debug=false) {
        this._id = id;
        this.__debug = debug;
        this._voiceList = {
            Name: [],
            Source: []
        };
        //this._speechStreamData = new Map();

        this._currentVoice = 0;
        this._volume = 0;
        this._rate = 1;
        this._tts = "flite";
    }

    async getVoices (gender, callback) {
        // get built-in default voices
        let resArray1 = [], resArray2 = [];
        let res = await this.execProcess(`${this._tts} -lv`);
        if (!res.stderr) {
            resArray1 = res.stdout.split(' ');
        }
        // read voices folder
        res = await this.execProcess(`ls ${VOICE_PATH}`);
        if (!res.stderr) {
            resArray2 = res.stdout.split('\n');
        }
        let voicesArray = [...resArray1, ...resArray2];
        //if (this.__debug) console.log(voicesArray);

        // match with voices.json and return
        // Only those listed in voices.json will be returned
        // even if there are more available voices
        const data = fs.readFileSync(`${VOICE_PATH}/voices.json`);
        const voices = JSON.parse(data);
        voices.forEach(voice => {
            if ((voice.Gender == gender) && (voicesArray.includes(voice.Source))) {
                this._voiceList.Name.push(voice.Name);
                this._voiceList.Source.push(voice.Source);
            }
        });

        if (callback) {
            let result = {};
            result.voices = this._voiceList.Name;
            result.count = this._voiceList.Name.length;
            callback(result);   
        }
    }

    async speak (sentences, callback=null) {
        //this._speechStream = new Map();

        for (let index=0; index<sentences.length; index++) {
            let stream = new SpeechStreamData();
            //this._speechStream.set(index, stream);
            stream.Text = sentences[index];
            stream.tmpFile = this.generateFile() + ".wav"

            // build command line
            let cli = `${this._tts} -voice ${this.getVoice(this._currentVoice)} --setf duration_stretch=${this._rate} `;
            cli += '"'+stream.Text+' "';
            cli += " /tmp/" + stream.tmpFile;
            if (this.__debug) console.log(cli);
            //console.log(this._speechStream);

            // speak!
            let res = await this.execProcess(`${cli}`);
            if (!res.stderr) {
                const data = fs.readFileSync("/tmp/"+stream.tmpFile);
                fs.unlink("/tmp/"+stream.tmpFile, (err) => {});
                stream.AudioStream = data;
                stream.Length = data.length;
                if (callback) callback(stream);
            }
            else {
                console.log(res.stderr);
            }

        }
    }

    getVoice (index) {
        let voice = this._voiceList.Source[index];
        if (voice.includes("flitevox"))
            return VOICE_PATH+"/"+voice;
        return voice;
    }

    generateFile () {
        let name1 = (Math.floor(Math.random()*0xFFFFFFFF)).toString(16);
        let name2 = (Math.floor(Math.random()*0xFFFFFFFF)).toString(16);
        return `${name1}${name2}`;
    }

    async execProcess (cmd) {
        let result;
        try {
            result = await execProm(cmd);
        }
        catch (e) {
            result = e;
        }
        //if (Error[Symbol.hasInstance](result))
        //    return;
        return result;
    }
}

module.exports = { Voice }