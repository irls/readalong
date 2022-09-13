/**
 * HTML5 Audio Read-Along
 * @author Weston Ruter, X-Team
 * @modified Chad Jones - injectable object
 *  Some changes include: 
 *   Improved speed of getCurrentWord and class highlighting
 *   Simplified timers to use just one, improving reliability at higher speeds
 *   Added a bunch of consumer events (on_start, on_complete, on_pause, on_resume, on_newline)
 *   Made tags and classes somewhat configurable, with terse deaults
 *   Removed the tab index stuff (I probably shouldn't have)
 *   Changed seconds to ms
 *   Changed data-attributes to use a single 'data-map' attribute like data-map="7464,844"
 *   Wrapped code in instantiatable object with configuration in constructor
 *   If no audio src, src is extracted from block's data-audiosrc
 *   Added top-level play controls such as playBlock, pause, resume, playRange, playWord
 *   Audio element is created automatically and need not be provided in HTML
 * 
 * @license MIT/GPL
 * https://github.com/westonruter/html5-audio-read-along
 */
class ReadAlong {
    
  constructor(args, events, config) {
    let name = ''
    // default arguments
    let default_args = { 
      playbackRate: 1,
      prevOffsetTop: 0, 
      forceLineScroll: false,  
      keep_highlight_on_pause: false,
      highlight_trail: false,
      auto_continue: false,
      click_listener: false,
      spacebar_toggle: false
    }
    args = Object.assign(default_args, args)
    for (name in args) this[name] = args[name] 
    // default events
    let default_events = {
      on_pause: null,
      on_resume: null,
      on_move: null,
      on_start: null,
      on_complete: null,
      on_newline: null   
    }
    events = Object.assign(default_events, events)
    this.events = {}
    for (name in events) this.events[name] = events[name] 
    // default configuration
    let default_config = {
      block_attr: 'audiosrc',
      tag: 'w',
      map_attr: 'map',
      gap_attr: 'gap',
      gap_before_attr: 'gapbefore',
      reading_class: 'audio-highlight',
      trail_class: 'audio-trail'
    }
    config = Object.assign(default_config, config)
    this.config={}
    for (name in config) this.config[name] = config[name]
    // setup audio player 
    if (!this.audio_element) this.audio_element = document.createElement('audio')
    this.playbackRate = Math.max(this.playbackRate, 0.5)
    this.playbackRate = Math.min(this.playbackRate, 2.0) 
    this.audio_element.playbackRate = this.playbackRate
    // internal stuff
    this._current_select_timeout = null 
    this._next_select_timeout = null
    this.words = []
    this.word = null
    this.last_word = null 
    this.block_duration = 0 
    this.block_duration_adjusted = 0 
    this.load_delay = 0;
    this.addGlobalEventListeners()
    this.stop_time = null;
  }

  loadBlock (blockid, startFrom = null) {
    let reload = this.blockid != blockid;
    this.blockid = blockid  
    this.block_element = document.getElementById(blockid) 
    // assign audio to src
    if (!this.audio_element.paused) this.audio_element.pause
    this.audio_src = this.block_element.dataset[this.config.block_attr]
    // console.log('audio: ', this.audio_src, this.config.block_attr,  this.block_element.dataset)
    this.audio_element.src = this.audio_src 
    this.audio_element.playbackRate = this.playbackRate
    // clear out any previous activity, probably not necessary
    this.word = null
    this.words = []
    // prep this block
    this.generateWordList(startFrom)
    if (reload) {
      this.addBlockEventListeners()
    }
    this.stop_time = null;
  }

  playBlock (blockid, fromWord=null, speed=null, scrollFromWord=null) { 
    if (!this.audio_element.paused) {
      this.audio_element.pause() // how to wait until this is done?
      if (!this.audio_element.paused) console.error('Warning, could not stop audio element!')
    }
    //console.log('playBlock', blockid, speed, scrollFromWord)
    if (speed) this.changePlayRate(speed)


    // todo, if already playing, stop, clear and reset   
    let startTime = null;
    if (fromWord && fromWord.dataset && fromWord.dataset.map) {
      let map = fromWord.dataset.map.split(',');
      if (map && map[0]) {
        startTime = parseInt(map[0]);
      }
    }
    this.loadBlock(blockid, startTime);


    // I think we're all ready to go
    // set playhead to first word
    if (this.words.length>0) {
      let word = this.words[0] 
      //if (fromWord) {
        //this.generateWordList(parseInt(fromWord.dataset.index));
        //word = this.words[0];
      //}
      this.audio_element.currentTime = (word.begin / 1000) + 0.01 
      if (this.forceLineScroll && scrollFromWord) this.lineScrollByWords(scrollFromWord, word, 200) 
      this.audioElementPlay() 
    }
  }
 
  // used from user click. Element must be a word
  playFromWordElement(target, blockid) {
    if (target.localName==='w' && target.getAttribute('data-map')) {
      if (blockid === this.blockid && target.getAttribute('data-index')) {
        //console.log('playing from word in current paragraph', target)
        this.playFromWord(this.words[target.dataset.index])
      } else {
        //console.log('playing from word in non-current paragraph', blockid) 
        this.removeWordSelectionClass()
        this.playBlock(blockid, target)
      } 
    }
  }

  playFromWord (word) { 
    //console.log('Play from word', word)
    // Note: times apparently cannot be exactly set and sometimes selected too early 
    this.audio_element.currentTime = (word.begin / 1000) + 0.01
    this.removeWordSelectionClass()
    this.selectCurrentWord() 
    if (this.audio_element.paused && word.index>0 && word && this.events.on_resume) this.events.on_resume(word)
    this.audio_element.play() 
  } 

  playWord (word) {
    this.playRange(word.begin, word.end)
  }

  playRange(blockid, start, stop) { 
    this.loadBlock(blockid)
    
    this.audio_element.pause()
    this.audio_element.currentTime = start / 1000  
    this.generateWordList(start, stop);
    this.stop_time = stop / 1000;
    this.audioElementPlay(false)  
  }
  
  audioElementPlay(setSelection = true) {
    let startLoad = new Date();
    this.load_delay = 0;
    let playPromise = this.audio_element.play() 
    playPromise.then(() => {
      this.load_delay = (new Date()).getTime() - startLoad.getTime() + 500;
      if (setSelection) {
        this.selectCurrentWord()
      }
    });
  }

  resume () { 
    if (!this.audio_element.paused) return  
    this.removeWordSelectionClass()
    let word = this.getCurrentWord()
    if (Math.abs(this.audio_element.currentTime - this.audio_element.duration) < 0.2) {
      return this.onEndBlock();
    }
    this.audio_element.play()
    if (this.events.on_resume) this.events.on_resume(word)
  }

  pause () { 
    this.audio_element.pause()
    clearTimeout(this._next_select_timeout);
    let word = this.getCurrentWord();
    if (word && (word.index === this.words.length-1) && this.events.on_pause) {
      this.events.on_pause(word);
    }
  }

  changePlayRate (playbackRate=1) {
    if (playbackRate === this.playbackRate) return
    playbackRate = Math.max(playbackRate, 0.5)
    playbackRate = Math.min(playbackRate, 2.0) 
    this.playbackRate = playbackRate
    this.audio_element.playbackRate = playbackRate
    //this.block_duration_adjusted = Math.round(this.block_duration* 1.0/this.playbackRate)
    //this.selectCurrentWord()
  }

  /**
   * Build an index of all of the words this can be read along with their begin,
   * and end times, and the DOM element representing the word.
   */
  generateWordList  (startPos = null, endPos = null) { 
    let word_els = this.block_element.querySelectorAll(`${this.config.tag}[data-${this.config.map_attr}]`);
    let index = 0
    let words = Array.prototype.map.call(word_els, function (word_el) {
      delete word_el.dataset.index;
      let [begin, dur, end=parseInt(begin)+parseInt(dur)] = word_el.dataset.map.split(',');
      begin = parseInt(begin);
      let startEndInRange = (startPos !== null && endPos !== null && (
              (begin >= startPos && begin <= endPos) || (end > startPos && end <= endPos)
              ));
      if ((((!startPos || begin >= startPos) && (!endPos || end <= endPos)) || 
              startEndInRange) && typeof begin !== 'undefined' && typeof dur !== 'undefined') {
        word_el.dataset.index = index;
        let word = {
          begin: parseInt(begin),
          end: end,
          dur: parseInt(dur),
          element: word_el,
          index: index,
          text: word_el.innerText,
          html: word_el.innerHTML
        } 
        ++index;
        return word;
      } else {
        delete word_el.dataset.index;
      }
    })  
    this.words = [];
    Array.prototype.forEach.call(words, (el) => {
      if (el) {
        this.words.push(el)
      }
    })
    let lastWord = this.words[this.words.length-1] 
    this.block_duration = lastWord.begin+lastWord.end-this.words[0].begin
    this.block_duration_adjusted = Math.round(this.block_duration* 1.0/this.playbackRate)
  }

  /**
   * From the audio's currentTime, find the word that is currently being played
   * // chad: optimized by storing previous word for quick shortcut -- and binary search lookup 
   */
  getCurrentWord () { 
    let word = this.last_word
    let play_time = Math.round(this.audio_element.currentTime * 1000) // playhead time in ms
    // first, quickly check if last_word is still valid
    if (word && (word.begin<play_time) && (word.end>play_time)) return word 
    // otherwise, use quick binary search to lookup current word 
    let min = 0, max = this.words.length - 1, index 
    while (min <= max) {
      index = (min + max) / 2 | 0
      word = this.words[index]
      if (play_time > word.end) { 
        min = index + 1 ;
      } else if (play_time < word.begin) {
        max = index - 1 ;
      } else {
        if (word && word.element && !word.element.isConnected) {
          this.generateWordList();
        }
        return this.last_word = word;
      }
    }
    return this.last_word = word ; //this.words[index] 
  }

  /**
   * Select the current word and set timeout to select the next one if playing
   */
  selectCurrentWord () {
    let that = this
    let is_playing = !this.audio_element.paused
    let current_word = this.getCurrentWord() // very fast 
    if (!is_playing & !this.keep_highlight_on_pause) this.removeWordSelectionClass(current_word)  

    /**
     * The timeupdate Media event does not fire repeatedly enough to be
     * able to rely on for updating the selected word (it hovers around
     * 250ms resolution), so we add a setTimeout with the exact duration
     * of the word.
     */
    if (is_playing) {
      // Automatically trigger selectCurrentWord when the next word begins
      if (current_word.index < this.words.length) {
        this.setWordSelectionClass(current_word) 
        let isLastWord = (current_word.index === this.words.length-1)
        let current_time = this.audio_element.currentTime * 1000
        let playbackRate = 1.0/this.audio_element.playbackRate
        // timeout to beginning of next word -- or end of this word (if last word)
        let ms_until_next = 0
        if (isLastWord) {
          //console.log('last word!', '"'+current_word.text+'"')
          // on the last word, we have to use the word end minus 200ms because the HTML5 player takes 200ms to stop
          ms_until_next = Math.max(Math.round((current_word.end-current_time) * playbackRate),0) - 200 + this.load_delay;
        } else {
          let next_word = this.words[current_word.index + 1]
          ms_until_next = Math.max(Math.round((next_word.begin-current_time) * playbackRate),0) 
        } 
       // console.log('Setting timer for word: "'+current_word.text+'"', ms_until_next, current_word.dur,
       // Math.round((current_word.end-current_time) * playbackRate))
        this._next_select_timeout = setTimeout( () => {
          clearTimeout(this._next_select_timeout) // not sure why this is needed 
          if (!this.audio_element.paused) {
            this.removeWordSelectionClass(current_word)
            if (isLastWord) {
              //this.pause();
              this.onEndBlock() // just finished last word in block
            } else {
              this.selectCurrentWord()
            }
          } else if (isLastWord) {
            this.onEndBlock();
          }
        }, ms_until_next)
      } // else (this.onEndBlock())
    } else if (!this.keep_highlight_on_pause) this.removeWordSelectionClass(current_word)  

  }

  removeWordSelectionClass (word=null) { 
    // console.log('removeWordSelectionClass')
    let reading_class = this.config.reading_class
    let trail_class = this.config.trail_class 
    // Remove .audio-highlight and .audio-trail classes from current word and trail
    if (word) {
      word.element.classList.remove(reading_class, trail_class)
      if (word.index>0) this.words[word.index-1].element.classList.remove(reading_class, trail_class)
      if (word.index>1) this.words[word.index-2].element.classList.remove(reading_class, trail_class)  
    }  
    // this is slower since it requires querying, so we avoid it when possible 
    else if (this.block_element) {  
      var spoken_word_els = this.block_element.querySelectorAll(`.${reading_class}, .${trail_class}`) 
      Array.prototype.forEach.call(spoken_word_els, function (spoken_word_el) {
        spoken_word_el.classList.remove(reading_class, trail_class) 
      }) 
    }
  }

  removeSelectionTrail() {
    //console.log("forced removeal of trails")
    let els = this.block_element.querySelectorAll(`.${this.config.trail_class}`) 
    Array.prototype.forEach.call(els, (el) => {
      el.classList.remove(this.config.trail_class) 
    }) 
  }

  setWordSelectionClass (word) {
    let reading_class = this.config.reading_class
    let trail_class = this.config.trail_class
    if (!word || !word.element) return // word = this.last_word
    let isNewline = (word.index>0) && (word.element.offsetTop> this.prevOffsetTop)
    word.element.classList.add(reading_class) 
    let percentComplete = Math.round((word.index+1)/this.words.length * 100)
    let onNewLine = this.events.on_newline
    if (isNewline && onNewLine) onNewLine(this.prevOffsetTop, word.element.offsetTop, percentComplete) 
    if (isNewline && this.forceLineScroll) this.lineScrollByWords(word, this.words[word.index-1]) 
    this.prevOffsetTop = word.element.offsetTop;
    // clear previous word highlight
    if (word.index>0) this.words[word.index-1].element.classList.remove(reading_class) 
    // clear previous words trail
    if (word.index>1) this.words[word.index-2].element.classList.remove(trail_class) 
    if (word.index>2) this.words[word.index-3].element.classList.remove(trail_class)  
    if (word.index>3) this.words[word.index-4].element.classList.remove(trail_class)     
    // when word changes line, flush everything before
    if (isNewline) { 
      for (let i=word.index-1; i>word.index-15 && i>0; i--) this.words[i].element.classList.remove(trail_class)   
    }  else if (this.highlight_trail && word.index>0) this.words[word.index-1].element.classList.add(trail_class) 
  }

  onEndBlock() { 
    if (!this.audio_element.paused) {
      setTimeout(() => {
        this.audio_element.pause(); 
      }, this.load_delay);
    }
    // scroll to next block with audio
    if (this.auto_continue) setTimeout(() => {
      this.removeWordSelectionClass()
      let nextID = this.nextAudioBlockID()
      if (nextID != null) this.playBlock(nextID, null, null, this.words[this.words.length-1])
    }, 1000) 
    // fire off completed event for cuurent block
    if (this.events.on_complete) this.events.on_complete(this.blockid)       
  }

  lineScroll(pixles, duration = 100) {  
    // window.scrollBy(0, pixles) 
    scrollBy(pixles, duration)
  }

  lineScrollByWords(wordFrom, wordTo, duration = 100) {
    let from = wordFrom.element.offsetTop
    let to = wordTo.element.offsetTop
    this.lineScroll(from-to, duration) 
    this.removeSelectionTrail()
  }

  nextAudioBlockID() {
    let i, blocks = document.querySelectorAll(`[id][data-${this.config.block_attr}]`)
    for (i=0; i<blocks.length-1; i++) { 
      if (blocks[i].getAttribute('id') === this.blockid && (i<blocks.length-1)) return blocks[i+1].getAttribute('id')
    }
    console.log('No next block found', this.blockid, blocks)
    return null 
  }

  addBlockEventListeners () {
    //console.log('Adding block event listeners: ', this.blockid)
    var that = this
     /**
     * Select next word (at that.audio_element.currentTime) when playing begins
     */
    that.audio_element.addEventListener('timeupdate', () => {
      if (this.stop_time && this.audio_element.currentTime > this.stop_time) {
        this.audio_element.pause();
        this.onEndBlock();
      }
    });
    that.audio_element.addEventListener('play', function (e) {
      that.selectCurrentWord() 
    }, false);

    /**
     * Abandon seeking the next word because we're paused
     */
    that.audio_element.addEventListener('pause', function (e) { 
      that.selectCurrentWord() // We always want a word to be selected  
      let word = that.getCurrentWord()  
      that.removeSelectionTrail()
      if ((word.index<that.words.length-1) && that.events.on_pause) that.events.on_pause(word) 
    }, false);

    /**
     * Event just for completion of block
     */
    // that.audio_element.addEventListener('ended', function (e) {  
    //   //that.onEndBlock();
    // }, false);

    /**
     * Seek by selecting a word (event delegation)
     */
    // function on_select_word_el(e) {  
    //   if (!e.target.dataset.map) return 
    //   e.preventDefault()  
    //   that.playFromWord(that.words[e.target.dataset.index]) 
    // }

    // word click
    // that.block_element.addEventListener('click', on_select_word_el, false)
    // enter
    // that.block_element.addEventListener('keypress', function (e) { 
    //   if ( (e.charCode || e.keyCode) === 13) on_select_word_el.call(this, e) 
    // }, false)


    /**
     * First click handler sets currentTime to the word, and second click
     * here then causes it to play.
     * @todo Should it stop playing once the duration is over?
     */
    // that.block_element.addEventListener('dblclick', function (e) {
    //   e.preventDefault()
    //   //that.audio_element.play()
    //   //that.audio_element.pause()
    //   //let word = that.getCurrentWord()
    //   let word = that.words[e.target.dataset.index]
    //   that.playWord(word)
    // }, false);

    // that.block_element.addEventListener('dblclick', function (e) {
    //   e.preventDefault()
    //   //that.audio_element.play()
    //   //that.audio_element.pause()
    //   //let word = that.getCurrentWord()
    //   let word = that.words[e.target.dataset.index]
    //   that.playWord(word)
    // }, false);
    

    /**
     * Select a word when seeking
     */
    that.audio_element.addEventListener('seeked', function (e) {
      that.selectCurrentWord()
      /**
       * Address probem with Chrome where sometimes it seems to get stuck upon seeked:
       * http://code.google.com/p/chromium/issues/detail?id=99749
      */
      var audio_element = this
      if (!audio_element.paused) {
      var previousTime = audio_element.currentTime
      setTimeout(function () {
        if (!audio_element.paused && previousTime === audio_element.currentTime) {
        audio_element.currentTime += 0.01 // Attempt to unstick
        }
      }, 500)
      // fire moved event 
      if (that.events.on_move) that.events.on_move(that.getCurrentWord())
      }  

    }, false)

    /**
     * Select a word when adjusting speed
     */
    that.audio_element.addEventListener('ratechange', function (e) {
      that.selectCurrentWord()
    }, false)

    /**
     * When audio begins, fire the on_start event, if assigned
     */
    that.audio_element.addEventListener('playing', function (e) { 
      let word = that.getCurrentWord()
      if (that.events.on_start && word.index===0) that.events.on_start(that.blockid, that.words, that.block_duration, that.playbackRate)
    }, false)
  }

  addGlobalEventListeners  () {
    //console.log('Adding global event listeners')
    var that = this
    /**
     * Spacebar toggles playback
     */
    if (that.spacebar_toggle) document.addEventListener('keypress', function (e) { 
      if ( (e.charCode || e.keyCode) === 32) {
        e.preventDefault()
        //console.log('space bar pressed')
        if (that.audio_element.paused) that.resume()
          else that.audio_element.pause() 
      }
    }, false)

    if (that.click_listener) document.addEventListener('click', function (e) {
      e.preventDefault() 
      that.playFromWordElement(e.target)
    }, false)

  }
  
  regenerateAndHighlight() {
    if (this.audio_element.paused) {
      this.last_word = null;
      this.generateWordList();
      let current_word = this.getCurrentWord();
      this.setWordSelectionClass(current_word);
    } else {
      this.generateWordList();
      this.selectCurrentWord();
    }
  }
  
  setAudiosrc(audiosrc) {
    //return new Promise((resolve, reject) => {
      if (this.audio_element) {
        let currentTime = this.audio_element.currentTime || 0;
        /*this.audio_element.addEventListener('loadeddata', (a, b, c) => {
          console.log('onloadeddata', a, b, c, this.audio_element.networkState);
          //this.audio_element.removeEventListener('loadeddata');
          //this.audio_element.currentTime = currentTime;
          console.log(currentTime);
          return resolve();
        });*/
        this.audio_src = audiosrc;
        this.audio_element.src = this.audio_src;
        this.audio_element.currentTime = currentTime;
      } else {
        //return resolve();
      }
    //});
  }
  
  setCurrentTime(currentTime) {
    this.audio_element.currentTime = currentTime;
  }
}

function scrollBy(distance, duration) {
    var initialY = document.body.scrollTop;
    var y = initialY + distance;
    var baseY = (initialY + y) * 0.5;
    var difference = initialY - baseY;
    var startTime = performance.now();
    function step() {
        var normalizedTime = (performance.now() - startTime) / duration;
        if (normalizedTime > 1) normalizedTime = 1;

        window.scrollTo(0, baseY + difference * Math.cos(normalizedTime * Math.PI));
        if (normalizedTime < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
}


if (typeof module !== 'undefined')  module.exports = ReadAlong
