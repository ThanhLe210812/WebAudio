function AudioService() {
    window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
    window.cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame;
    window.AudioContext = window.AudioContext || window.webkitAudioContext;

    this.config = {
        micVolume: 1.0,
        calculator: 'getFloatTimeDomainData',
    };

    this.result = {
        frequency: null,
    };

    this.startRecorder = function () {
        var thisObj = this;
        thisObj.audioCtx = new AudioContext();
        thisObj.micGainNode = thisObj.audioCtx.createGain();
        thisObj.analyserNode = thisObj.audioCtx.createAnalyser();
        //thisObj.biquadFilter = thisObj.audioCtx.createBiquadFilter();
        //thisObj.biquadfilter.Q.value = 100;

        if (thisObj.audioCtx.createMediaStreamDestination) {
            thisObj.destinationNode = thisObj.audioCtx.createMediaStreamDestination();
        } else {
            thisObj.destinationNode = thisObj.audioCtx.destination;
        }

        try {
            var mediaConstraints = {
                video: false,
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                    // highpassFilter: false,
                    // typingNoiseDetection: false,
                }
            };
            navigator.mediaDevices.getUserMedia(mediaConstraints)
                .then((stream) => {
                    thisObj._onReceiveStream(stream)
                })
                .catch((error) => {
                    alert('Error with getUserMedia: ' + error.message) // temp: helps when testing for strange issues on ios/safari
                    console.log(error)
                });
        } catch (e) {
            alert('navigator.mediaDevices.getUserMedia threw exception :' + e);
        }
    }

    this._onReceiveStream = function (stream) {
        var thisObj = this;
        thisObj.micAudioStream = stream
        thisObj.inputStreamNode = thisObj.audioCtx.createMediaStreamSource(thisObj.micAudioStream)
        // thisObj.audioCtx = thisObj.inputStreamNode.context

        thisObj.inputStreamNode.connect(thisObj.micGainNode)
        thisObj.micGainNode.gain.setValueAtTime(thisObj.config.micVolume, thisObj.audioCtx.currentTime)

        thisObj.inputStreamNode.connect(thisObj.analyserNode)
    }

    this.calculateFrequency = function (callback) {
        var thisObj = this;

        if (thisObj.config.calculator == 'getFloatFrequencyData') {
            // using for getFloatFrequencyData
            var frequencies = new Float32Array(thisObj.analyserNode.frequencyBinCount);
            thisObj.analyserNode.getFloatFrequencyData(frequencies);
            thisObj.result.frequency = frequencies;//thisObj.calculateHertz(frequencies);
        }

        if (thisObj.config.calculator == 'getFloatTimeDomainData') {
            /* // using for getFloatTimeDomainData
            var buffer = new Float32Array(thisObj.analyserNode.frequencyBinCount);
            thisObj.analyserNode.getFloatTimeDomainData(buffer);
            thisObj.result.frequency = thisObj._autoCorrelate(buffer, thisObj.audioCtx.sampleRate); */
        }

        if (callback) callback(thisObj.result.frequency);

        thisObj.tmp_AnimationFrameId = window.requestAnimationFrame(function () {
            thisObj.calculateFrequency(callback);
        });
    }

    /* // this function using for getFloatFrequencyData
    this.calculateHertz = function (frequencies, options) {
        var rate = 22050 / 1024; // defaults in audioContext.

        if (options) {
            if (options.rate) {
                rate = options.rate;
            }
        }

        var maxI, max = frequencies[0];

        for (var i = 0; frequencies.length > i; i++) {
            var oldmax = parseFloat(max);
            var newmax = Math.max(max, frequencies[i]);
            if (oldmax != newmax) {
                max = newmax;
                maxI = i;
            }
        }
        return maxI * rate;
    }

    // this function using for getFloatTimeDomainData
    this._autoCorrelate = function (buf, sampleRate) {
        var MIN_SAMPLES = 0; // will be initialized when AudioContext is created.
        var GOOD_ENOUGH_CORRELATION = 0.9; // this is the "bar" for how close a correlation needs to be        
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
    } */

    this.stopRecorder = function () {
        var thisObj = this;
        if (thisObj.tmp_AnimationFrameId) {
            window.cancelAnimationFrame(thisObj.tmp_AnimationFrameId);
        }

        if (thisObj.destinationNode) {
            thisObj.destinationNode.disconnect()
            thisObj.destinationNode = null
        }
        if (thisObj.analyserNode) {
            thisObj.analyserNode.disconnect()
            thisObj.analyserNode = null
        }
        if (thisObj.micGainNode) {
            thisObj.micGainNode.disconnect()
            thisObj.micGainNode = null
        }
        if (thisObj.inputStreamNode) {
            thisObj.inputStreamNode.disconnect()
            thisObj.inputStreamNode = null
        }
        if (thisObj.micAudioStream) {
            thisObj.micAudioStream.getTracks().forEach((track) => track.stop())
            thisObj.micAudioStream = null
        }
        if (thisObj.audioCtx) {
            thisObj.audioCtx.close()
            thisObj.audioCtx = null
        }
    }

    //This function plays sounds
    this.playSound = function (waveType, frequency, duration) {
        var thisObj = this;
        try {
            thisObj.audioCtx = new AudioContext();
            thisObj.oscillatorNode = thisObj.audioCtx.createOscillator();
            thisObj.gainNode = thisObj.audioCtx.createGain();

            thisObj.oscillatorNode.type = waveType;
            thisObj.oscillatorNode.frequency.setValueAtTime(frequency, thisObj.audioCtx.currentTime);

            for (var i = 3; i < arguments.length; i += 2) {
                thisObj.oscillatorNode.frequency.exponentialRampToValueAtTime(arguments[i], thisObj.audioCtx.currentTime + arguments[i + 1]);
            }
            thisObj.gainNode.gain.setValueAtTime(0.3, thisObj.audioCtx.currentTime);
            thisObj.gainNode.gain.exponentialRampToValueAtTime(0.1, thisObj.audioCtx.currentTime + 0.5);

            thisObj.oscillatorNode.connect(thisObj.gainNode);
            thisObj.gainNode.connect(thisObj.audioCtx.destination);

            thisObj.oscillatorNode.start();
            thisObj.oscillatorNode.stop(thisObj.audioCtx.currentTime + duration);
        } catch (e) {

        }

    }

    //This function stop sounds
    this.stopSound = function () {
        var thisObj = this;
        if (thisObj.gainNode) {
            thisObj.gainNode.disconnect()
            thisObj.gainNode = null
        }
        if (thisObj.oscillatorNode) {
            thisObj.oscillatorNode.stop(0);
            thisObj.oscillatorNode.disconnect()
            thisObj.oscillatorNode = null
        }
        if (thisObj.audioCtx) {
            thisObj.audioCtx.close()
            thisObj.audioCtx = null
        }
    }

}