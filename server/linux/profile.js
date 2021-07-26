const { Voice } = require("./voice");

class Profile {

    constructor (id, debug=false) {
        this._id = id;
        this._pipe = null;
        this._voice = new Voice(id, debug);
        this._gender = "Female";
        //this._currentVoice = 0;
    }

    speak (text, callback = null) {
        let sentences = [];
        // TODO: don't split??
        sentences = text.replace(/([.?!])\s*(?=[A-Z])/g,"$1|").split("|");

        this._voice.speak(sentences, (data) => {
            // send back this data to client
            // console.log(`Received speech: ${data.Text}`);
            
            let response = {
                Text: data.Text,
                VisemeList: [],     // does not support
                Length: data.Length
            }
            if (callback) {
                // console.log ("Speak callback: "+data.Text);
                callback(response, data.AudioStream);
            }
        });
    }


}

module.exports = { Profile }