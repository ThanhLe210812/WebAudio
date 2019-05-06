window.AudioContext = window.AudioContext || window.webkitAudioContext;
var context = null;
var analyser = null;
var audioStreamSource = null;
var mediaStreamSource = null;

var rafID = null;
var buflen = 1024;
var buf = new Float32Array(buflen);
var MIN_SAMPLES = 0; // will be initialized when AudioContext is created.
var GOOD_ENOUGH_CORRELATION = 0.9; // this is the "bar" for how close a correlation needs to be

function autoCorrelate(buf, sampleRate) {
    var SIZE = buf.length;
    var MAX_SAMPLES = Math.floor(SIZE / 2);
    var best_offset = -1;
    var best_correlation = 0;
    var rms = 0;
    var foundGoodCorrelation = false;
    var correlations = new Array(MAX_SAMPLES);

    for (var i = 0; i < SIZE; i++) {
        var val = buf[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) // not enough signal
        return -1;

    var lastCorrelation = 1;
    for (var offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
        var correlation = 0;

        for (var i = 0; i < MAX_SAMPLES; i++) {
            correlation += Math.abs((buf[i]) - (buf[i + offset]));
        }
        correlation = 1 - (correlation / MAX_SAMPLES);
        correlations[offset] = correlation; // store it, for the tweaking we need to do below.
        if ((correlation > GOOD_ENOUGH_CORRELATION) && (correlation > lastCorrelation)) {
            foundGoodCorrelation = true;
            if (correlation > best_correlation) {
                best_correlation = correlation;
                best_offset = offset;
            }
        } else if (foundGoodCorrelation) {
            // short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
            // Now we need to tweak the offset - by interpolating between the values to the left and right of the
            // best offset, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
            // we need to do a curve fit on correlations[] around best_offset in order to better determine precise
            // (anti-aliased) offset.

            // we know best_offset >=1, 
            // since foundGoodCorrelation cannot go to true until the second pass (offset=1), and 
            // we can't drop into this clause until the following pass (else if).
            var shift = (correlations[best_offset + 1] - correlations[best_offset - 1]) / correlations[best_offset];
            return sampleRate / (best_offset + (8 * shift));
        }
        lastCorrelation = correlation;
    }
    if (best_correlation > 0.01) {
        // console.log("f = " + sampleRate/best_offset + "Hz (rms: " + rms + " confidence: " + best_correlation + ")")
        return sampleRate / best_offset;
    }
    return -1;
    //	var best_frequency = sampleRate/best_offset;
}

function error() {
    alert('Stream generation failed.');
}

function getUserMedia(dictionary, callback) {
    if (typeof (navigator.mediaDevices) == 'undefined') {
        alert('Cannot access the microphone of your device.');
        return;
    }

    try {
        //navigator.getUserMedia = (navigator.mediaDevices.getUserMedia || navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
        //navigator.getUserMedia(dictionary, callback, error);
        navigator.mediaDevices.getUserMedia(dictionary).then(callback);
    } catch (e) {
        alert('navigator.mediaDevices.getUserMedia threw exception :' + e);
    }
}

function gotStream(stream) {
    // Assign stream for to global for disconnect microphone
    audioStreamSource = stream;

    // Create an AudioNode from the stream.
    mediaStreamSource = context.createMediaStreamSource(stream);

    // Connect it to the destination.
    analyser = context.createAnalyser();
    analyser.fftSize = 2048;

    // Volume 100 %
    gainNode = context.createGain();
    gainNode.gain.value = 1;
    //gainNode.connect(analyser);

    mediaStreamSource.connect(analyser);
    mediaStreamSource.connect(gainNode);

    updateFrequency();
}

function startRecord() {
    var constraints = { audio: true, video:false }
    navigator.mediaDevices.getUserMedia(constraints).then(function(gotStream){
        var audioContext = new(window.AudioContext || window.webkitAudioContext)();
        var input = audioContext.createMediaStreamSource(localStream);
        var analyser = audioContext.createAnalyser();
        var scriptProcessor = audioContext.createScriptProcessor();
        // Some analyser setup
        analyser.smoothingTimeConstant = 0;
        analyser.fftSize = 64;
      
        input.connect(analyser);
        analyser.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);
        var getAverageVolume  =  function( array){
            var length = array.length;
            var values = 0;
            var i = 0;
           for (; i < length; i++) {
              values += array[i];
           }
          return values / length;
        };
        var onAudio = function(){
          var tempArray = new window.Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(tempArray);
          var latestFrequency = (getAverageVolume(tempArray));
          //use latestFrequency
        };
        scriptProcessor.onaudioprocess = onAudio;
      })
      .catch(function(){
        //Handle error
      });
}



function stopRecord() {
    if (audioStreamSource != null) {
        analyser.disconnect();
        mediaStreamSource.disconnect();
        audioStreamSource.getTracks().forEach(track => track.stop());
        analyser = null;
        mediaStreamSource = null;
        audioStreamSource = null;
        if (!window.requestAnimationFrame) window.requestAnimationFrame = window.webkitRequestAnimationFrame;
        window.cancelAnimationFrame(rafID);
        context.close();
        context = null;
    }
}

function updateFrequency() {
    analyser.getFloatTimeDomainData(buf);
    var frequency = autoCorrelate(buf, context.sampleRate);
    if (callBackFunction !== null) callBackFunction(Math.round(frequency));
    if (!window.requestAnimationFrame) window.requestAnimationFrame = window.webkitRequestAnimationFrame;
    rafID = window.requestAnimationFrame(updateFrequency);
}

window.addEventListener('beforeunload', function (event) {
    stopRecord();
});