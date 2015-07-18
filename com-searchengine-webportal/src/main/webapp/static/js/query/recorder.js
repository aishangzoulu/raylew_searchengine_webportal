(function (window) {

    var WORKER_PATH = '/static/js/query/recorderWorker.js';

    var Recorder = function (source, cfg) {
        var config = cfg || {};
        var bufferLen = config.bufferLen || 4096;
        var numChannels = 1;//config.numChannels || 2;
        this.context = source.context;
        this.node = (this.context.createScriptProcessor ||
        this.context.createJavaScriptNode).call(this.context,
            bufferLen, numChannels, numChannels);
        var worker = new Worker(config.workerPath || WORKER_PATH);
        worker.postMessage({
            command: 'init',
            config: {
                sampleRate: this.context.sampleRate,
                numChannels: numChannels
            }
        });
        var recording = false,
            currCallback;

        this.node.onaudioprocess = function (e) {
            if (!recording) return;
            var buffer = [];
            for (var channel = 0; channel < numChannels; channel++) {
                buffer.push(e.inputBuffer.getChannelData(channel));
            }
            worker.postMessage({
                command: 'record',
                buffer: buffer
            });
        }

        this.configure = function (cfg) {
            for (var prop in cfg) {
                if (cfg.hasOwnProperty(prop)) {
                    config[prop] = cfg[prop];
                }
            }
        }

        this.record = function () {
            recording = true;
        }

        this.stop = function () {
            recording = false;
        }

        this.clear = function () {
            worker.postMessage({command: 'clear'});
        }

        this.getBuffer = function (cb) {
            currCallback = cb || config.callback;
            worker.postMessage({command: 'getBuffer'})
        }

        this.exportWAV = function (cb, type) {
            currCallback = cb || config.callback;
            type = type || config.type || 'audio/wav';
            if (!currCallback) throw new Error('Callback not set');
            worker.postMessage({
                command: 'exportWAV',
                type: type
            });
        }

        worker.onmessage = function (e) {
            var blob = e.data;
            uploadAudio(blob);
            currCallback(blob);
        }

        source.connect(this.node);
        this.node.connect(this.context.destination);    //this should not be necessary
    };

    Recorder.forceDownload = function (blob, filename) {
        var url = (window.URL || window.webkitURL).createObjectURL(blob);
        var link = window.document.createElement('a');
        link.href = url;
        link.download = filename || 'output.wav';
        var click = document.createEvent("Event");
        click.initEvent("click", true, true);
        link.dispatchEvent(click);
    }

    window.Recorder = Recorder;

})(window);

function uploadAudio(wavData) {
    var reader = new FileReader();
    reader.onload = function (event) {
        var fd = new FormData();
        var mp3Name = encodeURIComponent('audio_recording_' + new Date().getTime() + '.wav');
        console.log("mp3name = " + mp3Name);
        fd.append('fname', mp3Name);
        fd.append('data', event.target.result);
        $.ajax({
            type: 'POST',
            url: '/query/voice',
            data: fd,
            processData: false,
            contentType: false
        }).done(function (data) {
            var res = JSON.parse(data);
            query(res.queryContent);
            log.innerHTML += "\n" + data;
        });
    };
    reader.readAsDataURL(wavData);
}

//点击搜索历史
function query(queryContent) {
    $("#queryContent").val(queryContent);
    /*
    var action = $("#search_form").attr("action");
    $("#search_form").attr("action", action + "?from=voice");
    */
    $("#search_form").submit();
}
