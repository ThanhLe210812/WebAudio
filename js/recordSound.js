function AudioService() {
    window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
    window.cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame;
    window.AudioContext = window.AudioContext || window.webkitAudioContext;

    this.config = {
        broadcastAudioProcessEvents: false,
        createAnalyserNode: false,
        createDynamicsCompressorNode: false,
        forceScriptProcessor: false,
        micGain: 1.0,
        processorBufferSize: 2048,
        stopTracksAndCloseCtxWhenFinished: true,
        usingMediaRecorder: typeof window.MediaRecorder !== 'undefined',
        enableEchoCancellation: true,
      }

    this.result = {
        frequency: null,
    };

    this.startRecorder = function () {
        var thisObj = this;
        thisObj.audioCtx = new AudioContext({ sampleRate: 44100 }).sampleRate === 44100;
        thisObj.micGainNode = thisObj.audioCtx.createGain();
        thisObj.analyserNode = thisObj.audioCtx.createAnalyser();

        thisObj.outputGainNode = thisObj.audioCtx.createGain();

        if (thisObj.audioCtx.createMediaStreamDestination) {
            thisObj.destinationNode = thisObj.audioCtx.createMediaStreamDestination();
        } else {
            thisObj.destinationNode = thisObj.audioCtx.destination;
        }

        try {
            var mediaConstraints = {
                video: false,
                audio: true
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
        thisObj.PrintDebugInfo()
        //thisObj.audioCtx = thisObj.inputStreamNode.context
        
        //thisObj.processor.connect(thisObj.destinationNode);

        //thisObj.inputStreamNode.connect(thisObj.micGainNode);
        //thisObj.micGainNode.gain.setValueAtTime(thisObj.config.micGain, thisObj.audioCtx.currentTime);
        //thisObj.inputStreamNode.connect(thisObj.analyserNode);

        /* thisObj.inputStreamNode.connect(thisObj.micGainNode)
        thisObj.micGainNode.gain.setValueAtTime(thisObj.config.micGain, thisObj.audioCtx.currentTime)
        thisObj.inputStreamNode.connect(thisObj.analyserNode) */

        /* let nextNode = this.micGainNode
        if (this.dynamicsCompressorNode) {
        this.micGainNode.connect(this.dynamicsCompressorNode)
        nextNode = this.dynamicsCompressorNode
        }

        this.state = 'recording'

        if (this.processorNode) {
            nextNode.connect(this.processorNode)
            this.processorNode.connect(this.outputGainNode)
            this.processorNode.onaudioprocess = (e) => this._onAudioProcess(e)
        }
        else {
        nextNode.connect(this.outputGainNode)
        }

        if (this.analyserNode) {
            // TODO: If we want the analyser node to receive the processorNode's output, this needs to be changed _and_
            //       processor node needs to be modified to copy input to output. It currently doesn't because it's not
            //       needed when doing manual encoding.
            // this.processorNode.connect(this.analyserNode)
            nextNode.connect(this.analyserNode)
        }*/
        
        //thisObj.outputGainNode.connect(thisObj.destinationNode) ;
    }

    this._onAudioProcess = function (e) {
        // console.log('onaudioprocess', e)
        // let inputBuffer = e.inputBuffer
        // let outputBuffer = e.outputBuffer
        // console.log(this.micAudioStream)
        // console.log(this.audioCtx)
        // console.log(this.micAudioStream.getTracks().forEach((track) => console.log(track)))
    
        // this.onAudioEm.dispatch(new Event('onaudioprocess', {inputBuffer:inputBuffer,outputBuffer:outputBuffer}))
    
        if (this.config.broadcastAudioProcessEvents) {
          this.em.dispatchEvent(new CustomEvent('onaudioprocess', {
            detail: {
              inputBuffer: e.inputBuffer,
              outputBuffer: e.outputBuffer
            }
          }))
        }
    }

    this.PrintDebugInfo = function () {
        // DEBUG ===================================
        var thisObj = this;
        var debugText = 'this.analyserNode.frequencyBinCount: ' + thisObj.analyserNode.frequencyBinCount + '\r\n';
        debugText += 'this.audioCtx.sampleRate:' + thisObj.audioCtx.sampleRate + '\r\n';
        debugText += 'this.analyserNode.fftSize:' + thisObj.analyserNode.fftSize + '\r\n';
        //debugText += 'thisObj.analyserNode.getByteFrequencyData:' + thisObj.analyserNode.getByteFrequencyData(1024) + '\r\n';

        var supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
        debugText += 'supportedConstraints:' + JSON.stringify(supportedConstraints, null, 4) + '\r\n';

        var trackLenght = thisObj.micAudioStream.getTracks().length;
        console.log(trackLenght);
        for (i = 0; i < trackLenght; i++) {
            debugText += 'currentConstraints:' + JSON.stringify(thisObj.micAudioStream.getTracks()[i].getConstraints(), null, 4) + '\r\n';
            debugText += 'currentSettings:' + JSON.stringify(thisObj.micAudioStream.getTracks()[i].getSettings(), null, 4) + '\r\n';
            debugText += 'get​Capabilities:' + JSON.stringify(thisObj.micAudioStream.getTracks()[i].getCapabilities(), null, 4) + '\r\n';
        }

        var debugTextArea = document.createElement("textarea");
        debugTextArea.name = "debug";
        debugTextArea.maxLength = "5000";
        debugTextArea.cols = "80";
        debugTextArea.rows = "40";
        debugTextArea.value = debugText;
        document.body.appendChild(debugTextArea);
    }

    var saveidx = 0;
    this.calculateFrequency = function (callback) {
        var thisObj = this;

        // using for getFloatFrequencyData
        var frequencies = new Uint8Array(thisObj.analyserNode.frequencyBinCount);
        thisObj.analyserNode.getByteFrequencyData(frequencies);
        thisObj.result.frequency = thisObj._calculateHertz(frequencies);
        //thisObj.result.frequency = 24000;

        if (callback) callback(thisObj.result.frequency);

        thisObj.tmp_AnimationFrameId = window.requestAnimationFrame(function () {
            thisObj.calculateFrequency(callback);
        });
    }

    // this function using for getFloatFrequencyData
    // Formular : [hz = index * rate] Where [rate = sampleRate / fftSize]
    // => hz = index * (sampleRate / fftSize);
    this._calculateHertz = function (frequencies) {
        var thisObj = this;

        var rate = thisObj.audioCtx.sampleRate / thisObj.analyserNode.fftSize;
        var maxIndex, max = frequencies[0];
        
        for (var i = 1; frequencies.length > i; i++) {
            var oldmax = parseFloat(max);
            var newmax = Math.max(max, frequencies[i]);
            if (oldmax != newmax) {
                max = newmax;
                maxIndex = i;
            }
        }
        return maxIndex * rate;
    }

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
            thisObj.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
            
            thisObj.oscillatorNode.start ? thisObj.oscillatorNode.start() : thisObj.oscillatorNode.noteOn();
            thisObj.oscillatorNode.stop(thisObj.audioCtx.currentTime + duration);
        } catch (e) {

        }

    }

    //This function stop sounds
    this.stopSound = function () {
        var thisObj = this;
        if (thisObj.oscillatorNode) {
            thisObj.oscillatorNode.disconnect()
            thisObj.oscillatorNode = null
        }
        if (thisObj.gainNode) {
            thisObj.gainNode.disconnect()
            thisObj.gainNode = null
        }
        if (thisObj.audioCtx) {
            thisObj.audioCtx.close()
            thisObj.audioCtx = null
        }
        
    }

}